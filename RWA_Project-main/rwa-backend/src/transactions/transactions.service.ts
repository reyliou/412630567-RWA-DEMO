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
    let chainError: string | null = null;
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const property = await qr.manager.findOne(Property, { where: { id: propertyId } });
      if (!property) throw new Error('建案不存在');

      // ======== AMM 流動性池計算 (x * y = k) ========
      const totalSupply = parseFloat(String(property.total_supply_x ?? 100000));
      // 假設初始池的美金儲備等於募資目標
      const fundraisingGoal = parseFloat(String(property.fundraising_goal ?? (totalSupply * parseFloat(String(property.current_price)))));
      
      const k = totalSupply * fundraisingGoal;

      // 取得目前在外流通的代幣總數 (UserHoldings 的總和)
      const holdingResult = await qr.manager.createQueryBuilder(UserHolding, 'h')
        .select('SUM(h.balance)', 'total')
        .where('h.property_id = :id', { id: propertyId })
        .getRawOne();
      const circulatingSupply = parseFloat(holdingResult?.total || '0');

      // 目前流動性池狀態
      const currentX = totalSupply - circulatingSupply; // 池子裡剩餘的代幣
      if (currentX <= 0) throw new Error('AMM 流動性池已被抽乾！');
      const currentY = k / currentX; // 池子裡的美金儲備

      // 預測交易後的新狀態
      let newX: number;
      let newY: number;

      if (txType === 'BUY') {
        newX = currentX - tokenAmount;
        if (newX <= 0) throw new Error('流動性池餘額不足，無法購買這麼多代幣！');
        newY = k / newX;
      } else { // SELL
        newX = currentX + tokenAmount;
        newY = k / newX;
      }

      // 實際要付 / 收到的美金總額 (Y 的變化量)
      const totalValue = Math.abs(newY - currentY);
      const finalPrice = totalValue / tokenAmount; // 本次交易的平均單價 (含滑價)

      // 限價單保護機制 (Slippage Check)
      if (orderType === 'LIMIT') {
        if (txType === 'BUY' && finalPrice > pricePerToken) {
          throw new Error(`AMM 滑價過高：本次大量購買導致均價飆升至 ${finalPrice.toFixed(2)} TWD，超過您設定的限價 ${pricePerToken} TWD`);
        }
        if (txType === 'SELL' && finalPrice < pricePerToken) {
          throw new Error(`AMM 滑價過高：本次大量拋售導致均價暴跌至 ${finalPrice.toFixed(2)} TWD，低於您設定的限價 ${pricePerToken} TWD`);
        }
      }
      
      // 交易後的新 AMM 實時單價 (Spot Price)
      const newSpotPrice = newY / newX;
      // ==============================================

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
          chainError = blockchainErr.message;
          this.logger.warn(`⚠️ 鏈上轉帳失敗（DB 仍會記錄，狀態標記為 CHAIN_FAILED）: ${chainError}`);
        }
      }

      // 🚀 執行 DB 寫入 
      const status = chainError ? 'CHAIN_FAILED' : 'SUCCESS';
      const savedTx = await qr.manager.save(AppTransaction, {
        user_id: userId,
        property_id: propertyId,
        tx_type: txType,
        order_type: orderType,
        token_amount: tokenAmount,
        price_per_token: finalPrice, // 存入 AMM 算出來的含滑價均價
        status,
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
        .set({ total_asset_value: () => `COALESCE(total_asset_value, 0) + ${txType === 'BUY' ? totalValue : -totalValue}` })
        .where('id = :userId', { userId })
        .execute();

      // 同步更新房產的最新 AMM 價格 (讓前端 K 線圖跟著變動)
      await qr.manager.update(Property, { id: propertyId }, { current_price: newSpotPrice });

      const typeLabel = txType === 'BUY' ? '買入' : '賣出';
      const txInfo = txHash
        ? `（鏈上 txHash: ${txHash.slice(0, 12)}…）`
        : chainError
          ? '（⚠️ 鏈上同步失敗，暫僅記錄於平台資料庫，請留意技術端稽核）'
          : '（DB 模式）';
      const msg = `您對 ${property.title} 的委託已成交${txInfo}。數量：${tokenAmount.toLocaleString()} 枚，總額：$${totalValue.toLocaleString()} TWD。`;
      await qr.manager.save(UserNotification, {
        user_id: userId,
        title: `成交回報: ${typeLabel}成功`,
        message: msg,
        is_read: false,
      });
      await qr.manager.save(SystemAlert, {
        alert_type: chainError ? 'BLOCKCHAIN' : 'ORDER_MATCH',
        severity: chainError ? 'WARNING' : 'INFO',
        message: chainError
          ? `⚠️ 鏈上同步失敗（DB 已記錄為 CHAIN_FAILED）: ${orderType} ${txType} for UID ${userId} | price=${finalPrice} | error=${chainError}`
          : `${orderType} ${txType} for UID ${userId} | price=${finalPrice} | txHash=${txHash ?? 'DB_ONLY'}`,
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
