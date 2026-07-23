import { Injectable, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AppTransaction } from '../entities/app-transaction.entity';
import { Property } from '../entities/property.entity';
import { UserHolding } from '../entities/user-holdings.entity';
import { User } from '../entities/user.entity';
import { UserNotification } from '../entities/notification.entity';
import { SystemAlert } from '../entities/system-alert.entity';
import { SystemService } from '../system/system.service';
import { BlockchainService } from '../blockchain/blockchain.service';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    @InjectRepository(UserNotification)
    private notifRepo: Repository<UserNotification>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private dataSource: DataSource,
    private systemService: SystemService,
    private blockchainService: BlockchainService,
  ) {}

  private async runTrade(
    userId: number,
    propertyId: number,
    txType: string,
    orderType: string,
    tokenAmount: number,
    pricePerToken: number,
  ): Promise<{ success: boolean; message?: string; txHash?: string }> {
    // Look up user (needed for wallet info before DB tx)
    const user = await this.userRepo.findOne({ where: { id: userId } });

    // ── Step 1: Try on-chain transfer first (if blockchain is set up) ──────────
    let txHash: string | null = null;
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const property = await qr.manager.findOne(Property, { where: { id: propertyId } });
      if (!property) throw new Error('建案不存在');

      const totalSupply = parseFloat(String(property.total_supply_x ?? 100000));
      const finalPrice =
        orderType === 'MARKET' ? parseFloat(String(property.current_price)) : pricePerToken;

      // Holding limit check
      const holding = await qr.manager.findOne(UserHolding, {
        where: { user_id: userId, property_id: propertyId },
      });
      const currentBalance = holding ? parseFloat(String(holding.balance)) : 0;

      if (txType === 'BUY') {
        const newBalance = currentBalance + tokenAmount;
        const limitPercentage = this.systemService.isThrottled() ? 0.01 : 0.05;
        const maxAllowed = totalSupply * limitPercentage;
        if (newBalance > maxAllowed) {
          throw new Error(
            `超過單一帳戶持倉上限！目前限制為總發行量的 ${limitPercentage * 100}% (${maxAllowed.toLocaleString()} 枚)。`,
          );
        }
      } else {
        if (currentBalance < tokenAmount) {
          throw new Error(`持倉不足，目前持有 ${currentBalance} 枚，無法賣出 ${tokenAmount} 枚。`);
        }
      }

      // ── On-chain transfer (before DB commit) ────────────────────────────────
      if (property.token_address && user?.wallet_address) {
        try {
          if (txType === 'BUY') {
            txHash = await this.blockchainService.executeOnChainBuy(
              property.token_address,
              user.wallet_address,
              tokenAmount,
            );
          } else {
            if (!user.wallet_address) throw new Error('用戶尚無鏈上錢包');
            txHash = await this.blockchainService.executeOnChainSell(
              property.token_address,
              user.wallet_address,
              tokenAmount,
            );
          }
          this.logger.log(`⛓️ 鏈上 ${txType} 成功 txHash=${txHash}`);
        } catch (blockchainErr: any) {
          this.logger.warn(`⚠️ 鏈上轉帳失敗（DB 仍會記錄）: ${blockchainErr.message}`);
        }
      }

      // ── DB transaction ───────────────────────────────────────────────────────
      const totalValue = tokenAmount * finalPrice;

      const savedTx = await qr.manager.save(AppTransaction, {
        user_id: userId,
        property_id: propertyId,
        tx_type: txType,
        order_type: orderType,
        token_amount: tokenAmount,
        price_per_token: finalPrice,
        status: 'SUCCESS',
        tx_hash: txHash ?? undefined,
      });

      const change = txType === 'BUY' ? tokenAmount : -tokenAmount;
      const existing = await qr.manager.findOne(UserHolding, {
        where: { user_id: userId, property_id: propertyId },
      });
      if (existing) {
        await qr.manager.update(UserHolding, { user_id: userId, property_id: propertyId }, {
          balance: parseFloat(String(existing.balance)) + change,
        });
      } else {
        await qr.manager.save(UserHolding, { user_id: userId, property_id: propertyId, balance: change });
      }

      await qr.manager
        .createQueryBuilder()
        .update(User)
        .set({ total_asset_value: () => `COALESCE(total_asset_value, 0) + ${change * finalPrice}` })
        .where('id = :userId', { userId })
        .execute();

      const typeLabel = txType === 'BUY' ? '買入' : '賣出';
      const txInfo = txHash ? `（鏈上 txHash: ${txHash.slice(0, 12)}…）` : '（DB 模式）';
      const msg = `您對 ${property.title} 的委託已成交${txInfo}。數量：${tokenAmount.toLocaleString()} 枚，總額：$${totalValue.toLocaleString()} TWD。`;
      await qr.manager.save(UserNotification, {
        user_id: userId,
        title: `成交回報: ${typeLabel}成功`,
        message: msg,
        is_read: false,
      });
      await qr.manager.save(SystemAlert, {
        alert_type: 'ORDER_MATCH',
        severity: 'INFO',
        message: `${orderType} ${txType} for UID ${userId} | price=${finalPrice} | txHash=${txHash ?? 'DB_ONLY'}`,
      });

      await qr.commitTransaction();
      return { success: true, txHash: txHash ?? undefined };
    } catch (e: any) {
      await qr.rollbackTransaction();
      if (e.message?.includes('持倉上限')) {
        await this.notifRepo.save({
          user_id: userId,
          title: '交易失敗: 觸發持倉防護',
          message: e.message,
          is_read: false,
        });
      }
      return { success: false, message: e.message };
    } finally {
      await qr.release();
    }
  }

  async createTransaction(
    userId: number,
    propertyId: number,
    txType: string,
    orderType: string,
    tokenAmount: number,
    pricePerToken: number,
  ) {
    if (this.systemService.getState().isPaused) {
      throw new ForbiddenException('系統已暫停交易，請等待技術端解除鎖定。');
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user?.is_whitelisted) {
      throw new ForbiddenException('帳戶尚未通過 KYC 審核，無法進行交易。');
    }

    if (!tokenAmount || tokenAmount <= 0 || !pricePerToken || pricePerToken <= 0) {
      throw new BadRequestException('無效的交易數量或價格');
    }

    if (orderType === 'LIMIT') {
      setTimeout(
        () => this.runTrade(userId, propertyId, txType, orderType, tokenAmount, pricePerToken),
        10000,
      );
      return { success: true, message: '委託已送出，正在排隊撮合...' };
    }

    const result = await this.runTrade(userId, propertyId, txType, orderType, tokenAmount, pricePerToken);
    if (!result.success) throw new BadRequestException(result.message);
    return { success: true, txHash: result.txHash ?? null };
  }
}
