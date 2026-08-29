import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { Property } from '../entities/property.entity';
import { ValuationLog } from '../entities/valuation-log.entity';
import { RentPayoutBatch } from '../entities/rent-payout-batch.entity';
import { RentPayoutDetail } from '../entities/rent-payout-detail.entity';
import { UserHolding } from '../entities/user-holdings.entity';
import { User } from '../entities/user.entity';
import { BankTrustAccount } from '../entities/bank-trust.entity';
import { BankTrustTransaction } from '../entities/bank-trust-transaction.entity';
import { AppTransaction } from '../entities/app-transaction.entity';
import { UserNotification } from '../entities/notification.entity';
import { BlockchainService } from '../blockchain/blockchain.service';

@Injectable()
export class PropertiesService {
  constructor(
    @InjectRepository(Property)
    private propertyRepo: Repository<Property>,
    @InjectRepository(ValuationLog)
    private valuationRepo: Repository<ValuationLog>,
    @InjectRepository(RentPayoutBatch)
    private batchRepo: Repository<RentPayoutBatch>,
    @InjectRepository(RentPayoutDetail)
    private detailRepo: Repository<RentPayoutDetail>,
    @InjectRepository(UserHolding)
    private holdingRepo: Repository<UserHolding>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(BankTrustAccount)
    private trustAccountRepo: Repository<BankTrustAccount>,
    @InjectRepository(BankTrustTransaction)
    private trustTxRepo: Repository<BankTrustTransaction>,
    @InjectRepository(AppTransaction)
    private appTxRepo: Repository<AppTransaction>,
    @InjectRepository(UserNotification)
    private notifRepo: Repository<UserNotification>,
    private blockchainService: BlockchainService,
  ) {}

  async findAll() {
    const properties = await this.propertyRepo.find({ order: { id: 'DESC' } });
    
    // 撈取所有使用者的持倉紀錄
    const holdings = await this.holdingRepo.find();
    
    // 依據 property_id 加總流通量
    const circulatingSupplies = holdings.reduce((acc, holding) => {
      acc[holding.property_id] = (acc[holding.property_id] || 0) + Number(holding.balance);
      return acc;
    }, {} as Record<number, number>);

    // 將流通量 (circulating_supply) 附加上去回傳給前端
    return properties.map(p => ({
      ...p,
      circulating_supply: circulatingSupplies[p.id] || 0,
    }));
  }

  async getValuationLogs(propertyId: number) {
    return this.valuationRepo.find({
      where: { property_id: propertyId },
      order: { recorded_at: 'ASC' },
    });
  }

  // K 線只呈現近期區間。沒有時間下限時，數月前的零星交易也會被畫進來，
  // 與主要區間之間隔著一大段沒有任何成交的空白，在圖上變成孤立的 K 棒。
  //
  // 視窗長度必須與造市資料的歷史長度一致（seed-market.js 產生過去 31 天）。
  // 先前設 60 天時，落在 31～60 天前的真實交易雖然進得了圖，卻沒有任何模擬資料
  // 陪襯，於是又變成孤島 —— 御心綻 6 月中的兩筆成交就是這樣冒出來的。
  // 對齊之後，視窗內的每一天都有造市資料，任何真實交易都不可能落單。
  private static readonly KLINE_WINDOW_DAYS = 31;

  async getKLineData(propertyId: number) {
    const since = new Date();
    since.setDate(since.getDate() - PropertiesService.KLINE_WINDOW_DAYS);

    // 修正 #4: 加上查詢上限與正確的排序，避免資料量無限增長時記憶體溢出
    const transactions = await this.appTxRepo.find({
      where: {
        property_id: propertyId,
        status: 'SUCCESS',
        created_at: MoreThanOrEqual(since),
      },
      order: { created_at: 'DESC' },
      take: 3000,
    });

    // 修正 #3: 移除 valuations，讓 K 線單純反映真實的市場買賣情緒，避免被鑑價強制拉動出現假紅黑 K
    const events = [
      ...transactions.map(t => ({ time: t.created_at, price: Number(t.price_per_token), volume: Number(t.token_amount) }))
    ].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    const dailyData = new Map<string, { open: number, high: number, low: number, close: number, volume: number }>();

    for (const ev of events) {
      if (!ev.time) continue;
      // 修正 #1: 使用台北時間 (UTC+8) 計算，避免凌晨 00:00~08:00 的交易被錯歸類到前一天
      const utcDate = new Date(ev.time);
      const taipeiDate = new Date(utcDate.getTime() + 8 * 60 * 60 * 1000);
      const dateStr = taipeiDate.toISOString().split('T')[0];
      if (!dailyData.has(dateStr)) {
        dailyData.set(dateStr, { open: ev.price, high: ev.price, low: ev.price, close: ev.price, volume: ev.volume });
      } else {
        const current = dailyData.get(dateStr)!;
        current.high = Math.max(current.high, ev.price);
        current.low = Math.min(current.low, ev.price);
        current.close = ev.price; 
        current.volume += ev.volume;
      }
    }

    return Array.from(dailyData.entries()).map(([time, data]) => ({ time, ...data }));
  }

  async executePayout(propertyId: number, totalRent: number) {
    // 1. Create a payout batch
    const batch = await this.batchRepo.save({
      property_id: propertyId,
      payout_period: new Date(),
      total_rent_collected: totalRent,
      status: 'PROCESSING',
    });

    // 2. Find all holders for this property
    const holdings = await this.holdingRepo.find({ where: { property_id: propertyId } });
    const property = await this.propertyRepo.findOne({ where: { id: propertyId } });
    if (!property) throw new Error('Property not found');

    const totalTokens = Number(property.total_supply_x) || 100000;
    
    // 3. Distribute rent based on holdings
    let processedDetails: any[] = [];
    let totalActualDistributed = 0;

    for (const holding of holdings) {
      if (Number(holding.balance) <= 0) continue;

      const holdingPercentage = (Number(holding.balance) / totalTokens) * 100;
      // 金融級精度：計算出法定分潤金額並精確至小數點後兩位（分），避免浮點數發散
      const rawPayout = (Number(holding.balance) / totalTokens) * totalRent;
      const payoutAmount = Math.round(rawPayout * 100) / 100;
      totalActualDistributed += payoutAmount;

      // 鏈上發放：admin wallet 送出對應金額給持有人錢包，失敗不影響資料庫面的撥款紀錄
      let txHash: string | undefined;
      let status = 'PAID';
      const holder = await this.userRepo.findOne({ where: { id: holding.user_id } });
      if (holder?.wallet_address) {
        try {
          txHash = await this.blockchainService.payoutRentOnChain(holder.wallet_address, payoutAmount);
        } catch {
          status = 'FAILED';
        }
      }

      const detail = await this.detailRepo.save({
        batch_id: batch.id,
        user_id: holding.user_id,
        holding_percentage: holdingPercentage,
        payout_amount: payoutAmount,
        status,
        tx_hash: txHash,
      });

      // Update user profit
      await this.userRepo.increment({ id: holding.user_id }, 'total_profit_loss', payoutAmount);

      // 傳送個人分潤入帳通知給投資人
      try {
        await this.notifRepo.save({
          user_id: holding.user_id,
          title: '💰 租金分潤入帳',
          message: `您持有的【${property.title}】已成功發放租金！您依持股比例 (${holdingPercentage.toFixed(2)}%) 獲得 $${Number(payoutAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TWD 收益。`,
          is_read: false,
        });
      } catch (notifErr: any) {
        console.error('Failed to create payout notification:', notifErr.message);
      }

      processedDetails.push(detail);
    }

    // 4. Complete the batch
    await this.batchRepo.update(batch.id, { status: 'COMPLETED' });

    // 5. Update Bank Trust Account and Record Transaction
    // 計算未被認購份額與除不盡尾數（實打實保留於銀行信託專戶/平台儲備）
    totalActualDistributed = Math.round(totalActualDistributed * 100) / 100;
    const retainedInTrust = Math.max(0, Math.round((totalRent - totalActualDistributed) * 100) / 100);

    const trustAccount = await this.trustAccountRepo.findOne({ where: { property_id: propertyId } });
    if (trustAccount) {
      // 待發放租金歸零/扣除本期總額
      trustAccount.pending_rent_amount = Math.max(0, Number(trustAccount.pending_rent_amount) - totalRent);
      // 信託現金餘額實報實銷：只扣除實際派發給投資人的總額，未售出份額與尾差實質留存於專戶
      trustAccount.current_cash_balance = Math.max(0, Number(trustAccount.current_cash_balance) - totalActualDistributed);
      await this.trustAccountRepo.save(trustAccount);

      // 記錄信託流水帳（實收實支，備註保留金額）
      await this.trustTxRepo.save({
        trust_account_id: trustAccount.id,
        tx_type: 'PAYOUT_DEDUCTION',
        amount: totalActualDistributed,
        reference_note: `Rent payout batch #${batch.id} (Paid: $${totalActualDistributed.toFixed(2)}, Retained in Trust: $${retainedInTrust.toFixed(2)})`,
      });
    }

    return {
      success: true,
      batch_id: batch.id,
      total_collected: totalRent,
      total_distributed: totalActualDistributed,
      retained_in_trust: retainedInTrust,
      recipients_count: processedDetails.length,
    };
  }
}
