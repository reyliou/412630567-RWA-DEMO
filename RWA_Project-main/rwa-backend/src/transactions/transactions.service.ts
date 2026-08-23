import { Injectable, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
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
    // 修正 M-4：撮合既有掛單時直接帶主鍵，不要靠欄位組合反查
    pendingOrderId?: number,
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
      // 修正 H-1：AMM 的「讀流通量 → 算價與滑價 → 寫入」之間原本沒有任何鎖，
      // 預設 READ COMMITTED 下兩筆同時進來的交易會讀到相同的流通量、算出相同價格，
      // 各自通過滑價檢查後都成交，等於第二筆用了過期的價格（lost update）。
      // 在交易一開始就對該建案列取得排他鎖，讓同一建案的交易彼此序列化。
      // 這是本交易的第一個語句且永遠只鎖單一列，不會造成死鎖。
      const property = await qr.manager.findOne(Property, {
        where: { id: propertyId },
        lock: { mode: 'pessimistic_write' },
      });
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
      // 修正 M-4：原本用 user_id + property_id + token_amount + status 反查，
      // 同一使用者對同一建案掛了兩張數量相同但限價不同的單時會任意結算其中一張。
      // 改為由撮合引擎傳入該筆掛單的主鍵，語意明確且不會挑錯。
      const existingPendingTx = pendingOrderId
        ? await qr.manager.findOne(AppTransaction, {
            where: { id: pendingOrderId, status: 'PENDING' },
          })
        : null;

      if (existingPendingTx) {
        existingPendingTx.status = status;
        existingPendingTx.price_per_token = finalPrice;
        // 沒有鏈上雜湊時必須維持 NULL，不能寫入空字串。
        // 資料庫在 tx_hash 上有 transactions_tx_hash_unique 約束，而空字串是一個真實的值，
        // 只有第一筆能佔用；之後每筆結算都會撞 23505。PostgreSQL 的 UNIQUE 允許多個 NULL，
        // 所以留空即可 —— 市價單路徑本來就是這樣寫的（if (txHash) ...），這裡與之對齊。
        if (txHash) existingPendingTx.tx_hash = txHash;
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

      // 上方以 findOne 做的重複交易檢查發生在 startTransaction() 之前，屬於 TOCTOU：
      // 兩筆帶相同 idempotency_key 的請求可能都通過檢查，再由資料庫的 UNIQUE 約束擋下
      // 後到的那筆。少了這段判斷，那筆會以未處理的資料庫例外冒出去變成 500，
      // 而不是語意明確的「重複交易」。限價單路徑已有相同處理，這裡補齊市價單。
      //
      // 只認 idempotency_key 這一個約束。先前這裡攔截所有 23505，結果把
      // user_holdings 等其他唯一約束的衝突也一律回報成「重複交易」，
      // 真正的違反原因被吃掉，log 上完全看不出是哪個約束出問題。
      if (e.code === '23505') {
        // 不同驅動填的欄位不一致，三個來源都看過再判斷
        const constraintInfo = `${e.constraint ?? ''} ${e.detail ?? ''} ${e.message ?? ''}`.toLowerCase();
        if (constraintInfo.includes('idempotency')) {
          return { success: false, message: '偵測到重複交易，已為您安全攔截' };
        }
        this.logger.error(
          `唯一約束違反（非冪等性）: constraint=${e.constraint ?? '未知'} detail=${e.detail ?? '無'} table=${e.table ?? '未知'}`,
        );
        return {
          success: false,
          message: `資料庫唯一約束衝突（${e.constraint ?? '未知約束'}），請檢查資料表結構是否與 entity 定義一致`,
        };
      }

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

  /**
   * 混合撮合引擎：在執行 AMM 池子或存為 PENDING 前，先在訂單簿中尋找價格重疊的最佳對手盤（P2P Order Crossing）
   * - 買單 (BUY)：尋找賣價最低且 <= 我的買價的賣單 (tx_type = 'SELL' & price_per_token <= pricePerToken)
   * - 賣單 (SELL)：尋找買價最高且 >= 我的賣價的買單 (tx_type = 'BUY' & price_per_token >= pricePerToken)
   * - 若有對手盤，以 Maker 的價格直接優先撮合（零滑價 / 價格優先原則）！
   * - 回傳未成交的剩餘數量 (remainingAmount)。
   */
  private async tryP2PMatch(
    userId: number,
    propertyId: number,
    txType: string,
    orderType: string,
    tokenAmount: number,
    pricePerToken: number,
    idempotencyKey?: string,
  ): Promise<{ remainingAmount: number; matchedAmount: number }> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const property = await qr.manager.findOne(Property, {
        where: { id: propertyId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!property) throw new Error('建案不存在');

      const oppositeType = txType === 'BUY' ? 'SELL' : 'BUY';
      const query = qr.manager
        .createQueryBuilder(AppTransaction, 'tx')
        .where('tx.property_id = :propertyId', { propertyId })
        .andWhere('tx.status = :status', { status: 'PENDING' })
        .andWhere('tx.tx_type = :oppositeType', { oppositeType })
        .andWhere('tx.user_id != :userId', { userId })
        .andWhere('tx.is_simulated = :isSimulated', { isSimulated: false });

      // 限價單才加價格限制；市價單則可以直接吃對手盤
      if (orderType === 'LIMIT') {
        if (txType === 'BUY') {
          query.andWhere('tx.price_per_token <= :pricePerToken', { pricePerToken });
        } else {
          query.andWhere('tx.price_per_token >= :pricePerToken', { pricePerToken });
        }
      }

      // 價格與時間優先排序：
      // 買方吃賣單：優先吃最便宜的賣單 (ASC)
      // 賣方吃買單：優先吃出價最高的買單 (DESC)
      if (txType === 'BUY') {
        query.orderBy('tx.price_per_token', 'ASC').addOrderBy('tx.created_at', 'ASC');
      } else {
        query.orderBy('tx.price_per_token', 'DESC').addOrderBy('tx.created_at', 'ASC');
      }

      const matchingOrders = await query.getMany();
      let remainingAmount = tokenAmount;
      let matchedAmount = 0;

      for (const makerOrder of matchingOrders) {
        if (remainingAmount <= 0) break;

        const buyerId = txType === 'BUY' ? userId : makerOrder.user_id;
        const sellerId = txType === 'SELL' ? userId : makerOrder.user_id;

        // 檢查賣方持倉
        const sellerHolding = await qr.manager.findOne(UserHolding, {
          where: { user_id: sellerId, property_id: propertyId, holder_type: 'INVESTOR' },
        });
        const sellerBalance = sellerHolding ? parseFloat(String(sellerHolding.balance)) : 0;
        if (sellerBalance <= 0) {
          makerOrder.status = 'CANCELLED';
          await qr.manager.save(makerOrder);
          continue;
        }

        const availableSellerAmount = Math.min(sellerBalance, parseFloat(String(makerOrder.token_amount)));
        const thisMatchAmount = Math.min(remainingAmount, availableSellerAmount);
        if (thisMatchAmount <= 0) continue;

        // 檢查買方持倉上限
        const buyerHolding = await qr.manager.findOne(UserHolding, {
          where: { user_id: buyerId, property_id: propertyId, holder_type: 'INVESTOR' },
        });
        const buyerBalance = buyerHolding ? parseFloat(String(buyerHolding.balance)) : 0;
        const totalSupply = parseFloat(String(property.total_supply_x ?? 100000));
        const limitPercentage = this.systemService.isThrottled() ? 0.01 : 0.05;
        const maxAllowed = totalSupply * limitPercentage;
        if (buyerBalance + thisMatchAmount > maxAllowed) {
          break; // 買方超過持倉上限，停止撮合
        }

        const matchPrice = parseFloat(String(makerOrder.price_per_token));
        const matchTotalValue = thisMatchAmount * matchPrice;

        // 更新賣方持倉與資產
        await qr.manager.update(
          UserHolding,
          { user_id: sellerId, property_id: propertyId, holder_type: 'INVESTOR' },
          { balance: sellerBalance - thisMatchAmount },
        );
        await qr.manager
          .createQueryBuilder()
          .update(User)
          .set({ total_asset_value: () => `COALESCE(total_asset_value, 0) + ${matchTotalValue}` })
          .where('id = :userId', { userId: sellerId })
          .execute();

        // 更新買方持倉與資產
        if (buyerHolding) {
          await qr.manager.update(
            UserHolding,
            { user_id: buyerId, property_id: propertyId, holder_type: 'INVESTOR' },
            { balance: buyerBalance + thisMatchAmount },
          );
        } else {
          await qr.manager.save(UserHolding, {
            user_id: buyerId,
            property_id: propertyId,
            balance: thisMatchAmount,
            holder_type: 'INVESTOR',
          });
        }
        await qr.manager
          .createQueryBuilder()
          .update(User)
          .set({ total_asset_value: () => `COALESCE(total_asset_value, 0) - ${matchTotalValue}` })
          .where('id = :userId', { userId: buyerId })
          .execute();

        // 更新 Maker 掛單
        const makerRemaining = parseFloat(String(makerOrder.token_amount)) - thisMatchAmount;
        if (makerRemaining <= 0) {
          makerOrder.status = 'SUCCESS';
          makerOrder.price_per_token = matchPrice;
          await qr.manager.save(makerOrder);
        } else {
          makerOrder.token_amount = makerRemaining;
          await qr.manager.save(makerOrder);

          const makerFilled = new AppTransaction();
          makerFilled.user_id = makerOrder.user_id;
          makerFilled.property_id = propertyId;
          makerFilled.tx_type = makerOrder.tx_type;
          makerFilled.order_type = 'LIMIT_MATCHED';
          makerFilled.token_amount = thisMatchAmount;
          makerFilled.price_per_token = matchPrice;
          makerFilled.status = 'SUCCESS';
          await qr.manager.save(makerFilled);
        }

        // 記錄 Taker 成交紀錄
        const takerTx = new AppTransaction();
        takerTx.user_id = userId;
        takerTx.property_id = propertyId;
        takerTx.tx_type = txType;
        takerTx.order_type = orderType === 'MARKET' ? 'MARKET_MATCHED' : 'LIMIT_MATCHED';
        takerTx.token_amount = thisMatchAmount;
        takerTx.price_per_token = matchPrice;
        takerTx.status = 'SUCCESS';
        if (idempotencyKey) takerTx.idempotency_key = `${idempotencyKey}_p2p_${makerOrder.id}`;
        await qr.manager.save(takerTx);

        // 通知買賣雙方
        await qr.manager.save(UserNotification, {
          user_id: buyerId,
          title: '委託成交通知 (買入成功)',
          message: `您在 ${property.title} 的買入委託已透過訂單簿成功撮合！成交單價：$${matchPrice.toFixed(2)} TWD，數量：${thisMatchAmount} 枚，總額：$${matchTotalValue.toLocaleString()} TWD。`,
          is_read: false,
        });
        await qr.manager.save(UserNotification, {
          user_id: sellerId,
          title: '委託成交通知 (賣出成功)',
          message: `您在 ${property.title} 的賣出委託已透過訂單簿成功撮合！成交單價：$${matchPrice.toFixed(2)} TWD，數量：${thisMatchAmount} 枚，總額：$${matchTotalValue.toLocaleString()} TWD。`,
          is_read: false,
        });

        // 寫入審計記錄
        await qr.manager.save(SystemAlert, {
          alert_type: 'ORDER_MATCH',
          severity: 'INFO',
          message: `🤝 P2P 訂單撮合成交: Property #${propertyId} | Buyer UID ${buyerId} <-> Seller UID ${sellerId} | ${thisMatchAmount} tokens @ ${matchPrice} TWD`,
        });

        remainingAmount -= thisMatchAmount;
        matchedAmount += thisMatchAmount;
      }

      await qr.commitTransaction();
      return { remainingAmount, matchedAmount };
    } catch (err: any) {
      await qr.rollbackTransaction();
      this.logger.error(`P2P 撮合過程發生異常: ${err.message}`);
      return { remainingAmount: tokenAmount, matchedAmount: 0 };
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

    // 賣出前先檢查賣方持倉
    if (txType === 'SELL') {
      const holding = await this.dataSource.manager.findOne(UserHolding, {
        where: { user_id: userId, property_id: propertyId, holder_type: 'INVESTOR' },
      });
      const currentBalance = holding ? parseFloat(String(holding.balance)) : 0;
      if (currentBalance < tokenAmount) {
        throw new BadRequestException(`持倉不足，目前持有 ${currentBalance} 枚，無法賣出 ${tokenAmount} 枚。`);
      }
    }

    // 🌟 第一階段：先嘗試與訂單簿上的既有對手盤進行直接撮合 (P2P Order Crossing)
    const { remainingAmount, matchedAmount } = await this.tryP2PMatch(
      userId,
      propertyId,
      txType,
      orderType,
      tokenAmount,
      pricePerToken,
      idempotencyKey,
    );

    // 如果全部數量都已透過訂單簿撮合成交
    if (remainingAmount <= 0) {
      return { success: true, message: `已成功透過訂單簿以市場最佳價格完全撮合 ${matchedAmount} 枚代幣！` };
    }

    // 🌟 第二階段：處理剩餘未成交數量 (remainingAmount)
    if (orderType === 'LIMIT') {
      // 剩餘數量存入掛單追蹤系統等候後續撮合
      const order = new AppTransaction();
      order.user_id = userId;
      order.property_id = propertyId;
      order.tx_type = txType;
      order.order_type = 'LIMIT';
      order.token_amount = remainingAmount;
      order.price_per_token = pricePerToken;
      order.status = 'PENDING';
      if (idempotencyKey) order.idempotency_key = idempotencyKey;

      try {
        await this.dataSource.manager.save(order);
      } catch (err: any) {
        if (err.code === '23505') {
          throw new BadRequestException('偵測到重複的限價委託，已為您阻擋');
        }
        throw err;
      }

      await this.notifRepo.save({
        user_id: userId,
        title: matchedAmount > 0 ? '部分撮合成功，剩餘已掛單' : '掛單委託成功',
        message:
          matchedAmount > 0
            ? `您的 ${txType === 'BUY' ? '買入' : '賣出'} 委託已撮合 ${matchedAmount} 枚，剩餘 ${remainingAmount} 枚已加入掛單追蹤系統。`
            : `您的 ${txType === 'BUY' ? '買入' : '賣出'} 限價委託 (單價 ${pricePerToken} TWD, 數量 ${remainingAmount}) 已加入掛單追蹤系統，將於價格符合條件時自動撮合。`,
        is_read: false,
      });

      return {
        success: true,
        message:
          matchedAmount > 0
            ? `已撮合 ${matchedAmount} 枚，剩餘 ${remainingAmount} 枚已加入掛單追蹤系統`
            : '委託已送出，已加入掛單追蹤系統等候價格撮合',
      };
    }

    // 市價單剩餘數量由 AMM 流動性池承接
    const result = await this.runTrade(
      userId,
      propertyId,
      txType,
      orderType,
      remainingAmount,
      pricePerToken,
      idempotencyKey,
    );
    if (!result.success) throw new BadRequestException(result.message);
    return { success: true, txHash: result.txHash ?? null };
  }

  // 背景輪詢機器人 (每 5 秒檢查一次)
  /**
   * 依 AMM 曲線試算指定數量的成交均價（含滑價），不寫入任何資料。
   *
   * 撮合引擎必須用這個價格判斷是否觸發，而不是現貨價：沿著 x·y=k 成交時，
   * 買入會把價格往上推、賣出往下壓，因此成交均價永遠偏離現貨價。
   * 若以現貨價判斷，限價設得貼近市價的單會「觸發 → 被滑價檢查拒絕 → 5 秒後再觸發」
   * 無限循環 —— 線上就出現過一張限價 189.709 的買單，現貨 189.7088 通過觸發，
   * 但均價 189.71 超過限價而反覆失敗。
   */
  private async quoteAveragePrice(
    manager: EntityManager,
    property: Property,
    txType: string,
    tokenAmount: number,
  ): Promise<number | null> {
    const totalSupply = parseFloat(String(property.total_supply_x ?? 100000));
    const fundraisingGoal = parseFloat(
      String(property.fundraising_goal ?? totalSupply * parseFloat(String(property.current_price))),
    );
    const k = totalSupply * fundraisingGoal;

    const holdingResult = await manager
      .createQueryBuilder(UserHolding, 'h')
      .select('SUM(h.balance)', 'total')
      .where('h.property_id = :id', { id: property.id })
      .andWhere('h.holder_type = :holderType', { holderType: 'INVESTOR' })
      .getRawOne();
    const circulatingSupply = parseFloat(holdingResult?.total || '0');

    const currentX = totalSupply - circulatingSupply;
    if (currentX <= 0) return null;
    const currentY = k / currentX;

    const newX = txType === 'BUY' ? currentX - tokenAmount : currentX + tokenAmount;
    if (newX <= 0) return null;
    const newY = k / newX;

    return Math.abs(newY - currentY) / tokenAmount;
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async checkPendingOrders() {
    if (this.systemService.getState().isPaused) return;

    // 先確認是否有待處理的訂單
    const hasPending = await this.dataSource.manager.count(AppTransaction, {
      where: { status: 'PENDING', is_simulated: false },
    });

    // 如果沒有訂單，提早結束，避免無謂的資料庫查詢，達成自然閒置休眠
    if (hasPending === 0) return;

    // 找出所有在線的委託單 (過濾掉造市機器人的假單)
    const pendingOrders = await this.dataSource.manager.find(AppTransaction, { where: { status: 'PENDING', is_simulated: false } });
    if (pendingOrders.length === 0) return;

    for (const order of pendingOrders) {
      // 去看該房產的最新 AMM spot price (current_price)
      const property = await this.dataSource.manager.findOne(Property, { where: { id: order.property_id } });
      if (!property) continue;

      const spotPrice = parseFloat(String(property.current_price || 0));
      const limitPriceOfOrder = parseFloat(String(order.price_per_token));

      // 用「這筆數量實際會成交的均價」判斷，而不是現貨價 —— 兩者的差距就是滑價，
      // 而 runTrade 稍後正是以均價做限價檢查。用現貨價判斷會觸發注定被拒的單。
      const fillPrice = await this.quoteAveragePrice(
        this.dataSource.manager,
        property,
        order.tx_type,
        parseFloat(String(order.token_amount)),
      );
      if (fillPrice === null) continue; // 流動性池已抽乾，等下一輪

      let shouldExecute = false;

      // 買單：實際要付的均價 <= 我的限價
      if (order.tx_type === 'BUY' && fillPrice <= limitPriceOfOrder) {
        shouldExecute = true;
      }
      // 賣單：實際能拿到的均價 >= 我的限價
      if (order.tx_type === 'SELL' && fillPrice >= limitPriceOfOrder) {
        shouldExecute = true;
      }

      if (shouldExecute) {
        this.logger.log(
          `掛單觸發！OrderID: ${order.id}, 現貨價: ${spotPrice}, 預估成交均價: ${fillPrice.toFixed(4)}, 限價: ${limitPriceOfOrder}`,
        );
        // 為了避免再次觸發 Slippage Error，必須傳入使用者真實設定的限價 (order.price_per_token)，而不是目前的市價 (spotPrice)
        const limitPrice = parseFloat(String(order.price_per_token));
        const result = await this.runTrade(order.user_id, order.property_id, order.tx_type, 'LIMIT_MATCHED', parseFloat(String(order.token_amount)), limitPrice, undefined, order.id);
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
      .andWhere('tx.is_simulated = :simulated', { simulated: false })
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
      .andWhere('tx.is_simulated = :simulated', { simulated: false })
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
