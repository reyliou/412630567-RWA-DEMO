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
import { Cron, CronExpression } from '@nestjs/schedule';

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
    idempotencyKey?: string,
  ): Promise<{ success: boolean; message?: string; txHash?: string }> {
    // Look up user (needed for wallet info before DB tx)
    const user = await this.userRepo.findOne({ where: { id: userId } });

    // ── Step 1: Try on-chain transfer first (if blockchain is set up) ──────────
    let txHash: string | null = null;
    let chainError: string | null = null;
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();

    if (idempotencyKey) {
      const existing = await qr.manager.findOne(AppTransaction, { where: { idempotency_key: idempotencyKey } });
      if (existing) {
        await qr.release();
        return { success: false, message: '偵測到重複交易，已為您安全攔截' };
      }
    }

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
        .andWhere('h.holder_type = :holderType', { holderType: 'INVESTOR' })
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
      // 確保即使是大額掛單觸發，最終「含滑價的平均成交價」也絕對不能超過使用者的限價約束
      if (orderType === 'LIMIT' || orderType === 'LIMIT_MATCHED') {
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
        where: { user_id: userId, property_id: propertyId, holder_type: 'INVESTOR' },
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
      // 如果這是一筆原本就在 PENDING 的掛單，我們更新它而不是新增
      const existingPendingTx = orderType === 'LIMIT_MATCHED' 
        ? await qr.manager.findOne(AppTransaction, {
            where: { user_id: userId, property_id: propertyId, token_amount: tokenAmount, status: 'PENDING' }
          })
        : null;

      if (existingPendingTx) {
        existingPendingTx.status = status;
        existingPendingTx.price_per_token = finalPrice;
        existingPendingTx.tx_hash = txHash ?? '';
        await qr.manager.save(existingPendingTx);
      } else {
        const tx = new AppTransaction();
        tx.user_id = userId;
        tx.property_id = propertyId;
        tx.tx_type = txType;
        tx.order_type = orderType;
        tx.token_amount = tokenAmount;
        tx.price_per_token = finalPrice;
        tx.status = status;
        if (txHash) tx.tx_hash = txHash;
        if (idempotencyKey) tx.idempotency_key = idempotencyKey;
        
        await qr.manager.save(tx);
      }

      const change = txType === 'BUY' ? tokenAmount : -tokenAmount;
      const existing = await qr.manager.findOne(UserHolding, {
        where: { user_id: userId, property_id: propertyId, holder_type: 'INVESTOR' },
      });
      if (existing) {
        await qr.manager.update(UserHolding, { user_id: userId, property_id: propertyId, holder_type: 'INVESTOR' }, {
          balance: parseFloat(String(existing.balance)) + change,
        });
      } else {
        await qr.manager.save(UserHolding, { user_id: userId, property_id: propertyId, balance: change, holder_type: 'INVESTOR' });
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
    idempotencyKey?: string,
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
      // 真正的掛單追蹤系統 (利用既有的 AppTransaction 表)
      const order = new AppTransaction();
      order.user_id = userId;
      order.property_id = propertyId;
      order.tx_type = txType;
      order.order_type = 'LIMIT';
      order.token_amount = tokenAmount;
      order.price_per_token = pricePerToken; // 這裡暫存用戶的限價
      order.status = 'PENDING';
      if (idempotencyKey) order.idempotency_key = idempotencyKey;
      
      try {
        await this.dataSource.manager.save(order);
      } catch (err: any) {
        if (err.code === '23505') { // Postgres unique violation
           throw new BadRequestException('偵測到重複的限價委託，已為您阻擋');
        }
        throw err;
      }

      // 同步發送一則通知，讓用戶知道有掛單成功
      await this.notifRepo.save({
        user_id: userId,
        title: '掛單委託成功',
        message: `您的 ${txType === 'BUY' ? '買入' : '賣出'} 限價委託 (單價 ${pricePerToken} TWD, 數量 ${tokenAmount}) 已加入掛單追蹤系統，將於 AMM 價格符合條件時自動撮合。`,
        is_read: false,
      });

      return { success: true, message: '委託已送出，已加入掛單追蹤系統等候價格撮合' };
    }

    const result = await this.runTrade(userId, propertyId, txType, orderType, tokenAmount, pricePerToken, idempotencyKey);
    if (!result.success) throw new BadRequestException(result.message);
    return { success: true, txHash: result.txHash ?? null };
  }

  // 背景輪詢機器人 (每 5 秒檢查一次)
  @Cron(CronExpression.EVERY_5_SECONDS)
  async checkPendingOrders() {
    if (this.systemService.getState().isPaused) return;
    
    // 撈出所有在線的委託單 (過濾掉造市機器人的假單)
    const pendingOrders = await this.dataSource.manager.find(AppTransaction, { where: { status: 'PENDING', is_simulated: false } });
    if (pendingOrders.length === 0) return;

    for (const order of pendingOrders) {
      // 去看該房產的最新 AMM spot price (current_price)
      const property = await this.dataSource.manager.findOne(Property, { where: { id: order.property_id } });
      if (!property) continue;

      const spotPrice = parseFloat(String(property.current_price || 0));
      let shouldExecute = false;

      // 判斷是否滿足觸發條件
      // 買單：市價 <= 我的限價 (代表現在比較便宜，可以撿便宜)
      if (order.tx_type === 'BUY' && spotPrice <= parseFloat(String(order.price_per_token))) {
        shouldExecute = true;
      }
      // 賣單：市價 >= 我的限價 (代表現在比較貴，可以高點賣出)
      if (order.tx_type === 'SELL' && spotPrice >= parseFloat(String(order.price_per_token))) {
        shouldExecute = true;
      }

      if (shouldExecute) {
        this.logger.log(`掛單觸發！OrderID: ${order.id}, SpotPrice: ${spotPrice}`);
        // 為了避免再次觸發 Slippage Error，必須傳入使用者真實設定的限價 (order.price_per_token)，而不是目前的市價 (spotPrice)
        const limitPrice = parseFloat(String(order.price_per_token));
        const result = await this.runTrade(order.user_id, order.property_id, order.tx_type, 'LIMIT_MATCHED', parseFloat(String(order.token_amount)), limitPrice);
        if (result.success) {
          // runTrade 裡面已經更新狀態了
        } else {
            this.logger.error(`掛單自動執行失敗: ${result.message}`);
            // 如果是餘額不足、持倉不足、或是持倉上限等「無法藉由等待解決」的錯誤，直接設為 CANCELLED
            if (result.message?.includes('餘額不足') || result.message?.includes('持倉不足') || result.message?.includes('持倉上限')) {
              order.status = 'CANCELLED';
              await this.dataSource.manager.save(order);
            }
        }
      }
    }
  }

  async getPendingOrders(userId: number) {
    return this.dataSource.manager.find(AppTransaction, { where: { user_id: userId, status: 'PENDING' }, order: { created_at: 'DESC' } });
  }

  async cancelPendingOrder(orderId: number, userId: number) {
    const order = await this.dataSource.manager.findOne(AppTransaction, { where: { id: orderId, user_id: userId } });
    if (!order) throw new BadRequestException('找不到該掛單或無權取消');
    if (order.status !== 'PENDING') throw new BadRequestException('該掛單已被執行或取消');
    
    order.status = 'CANCELLED';
    await this.dataSource.manager.save(order);
    return { success: true, message: '已成功取消掛單' };
  }

  async getOrderBook(propertyId: number) {
    // 買方掛單 (Bids) - 從高價到低價排序 (願意出高價的人排最前面)
    const bids = await this.dataSource.manager
      .createQueryBuilder(AppTransaction, 'tx')
      .select('tx.price_per_token', 'price')
      .addSelect('SUM(tx.token_amount)', 'volume')
      .where('tx.property_id = :propertyId', { propertyId })
      .andWhere('tx.status = :status', { status: 'PENDING' })
      .andWhere('tx.tx_type = :type', { type: 'BUY' })
      .groupBy('tx.price_per_token')
      .orderBy('tx.price_per_token', 'DESC')
      .limit(5)
      .getRawMany();

    // 賣方掛單 (Asks) - 從低價到高價排序 (願意賤賣的人排最前面)
    const asks = await this.dataSource.manager
      .createQueryBuilder(AppTransaction, 'tx')
      .select('tx.price_per_token', 'price')
      .addSelect('SUM(tx.token_amount)', 'volume')
      .where('tx.property_id = :propertyId', { propertyId })
      .andWhere('tx.status = :status', { status: 'PENDING' })
      .andWhere('tx.tx_type = :type', { type: 'SELL' })
      .groupBy('tx.price_per_token')
      .orderBy('tx.price_per_token', 'ASC')
      .limit(5)
      .getRawMany();

    // TypeORM 的 SUM 回傳可能是字串，這裡轉回數字
    const formatOrder = (order: any) => ({
      price: parseFloat(order.price),
      volume: parseFloat(order.volume),
    });

    return {
      bids: bids.map(formatOrder),
      asks: asks.map(formatOrder),
    };
  }

  async getMarketStats(propertyId: number) {
    const stats = await this.dataSource.manager
      .createQueryBuilder(AppTransaction, 'tx')
      .select('MAX(tx.price_per_token)', 'high')
      .addSelect('MIN(tx.price_per_token)', 'low')
      .addSelect('SUM(tx.token_amount)', 'volume')
      .where('tx.property_id = :propertyId', { propertyId })
      .andWhere('tx.status = :status', { status: 'SUCCESS' })
      .getRawOne();
    
    return {
      high: stats?.high ? parseFloat(stats.high) : null,
      low: stats?.low ? parseFloat(stats.low) : null,
      volume: stats?.volume ? parseFloat(stats.volume) : 0,
    };
  }
}
