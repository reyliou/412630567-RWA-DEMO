import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Property } from '../entities/property.entity';
import { BankTrustAccount } from '../entities/bank-trust.entity';

@Injectable()
export class PortfolioService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Property)
    private propertyRepo: Repository<Property>,
    @InjectRepository(BankTrustAccount)
    private bankRepo: Repository<BankTrustAccount>,
    private dataSource: DataSource,
  ) {}

  async getPortfolio(userId: number) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['total_asset_value', 'total_profit_loss'],
    });

    const holdings = await this.dataSource.query(
      `SELECT h.*, p.title, p.token_symbol, p.current_price, p.main_image
       FROM user_holdings h
       JOIN properties p ON h.property_id = p.id
       WHERE h.user_id = $1 AND h.balance > 0`,
      [userId],
    );

    const cashBalance = parseFloat(String(user?.total_asset_value || '0'));
    const holdingsMarketValue = holdings.reduce((sum: number, h: any) => {
      const balance = parseFloat(String(h.balance || '0'));
      const price = parseFloat(String(h.current_price || '0'));
      return sum + (balance * price);
    }, 0);

    const totalNetWorth = cashBalance + holdingsMarketValue;

    return {
      summary: {
        cash_balance: cashBalance,
        holdings_market_value: holdingsMarketValue,
        total_net_worth: totalNetWorth,
        total_asset_value: totalNetWorth, // 向下相容
        total_profit_loss: parseFloat(String(user?.total_profit_loss || '0')),
      },
      holdings,
    };
  }

  async getTransactions(userId: number) {
    return this.dataSource.query(
      `SELECT t.*, p.title as property_name
       FROM transactions t
       JOIN properties p ON t.property_id = p.id
       WHERE t.user_id = $1
       ORDER BY t.created_at DESC`,
      [userId],
    );
  }

  async getOversight() {
    return this.dataSource.query(
      `SELECT p.*, b.current_cash_balance, b.pending_rent_amount
       FROM properties p
       LEFT JOIN bank_trust_accounts b ON p.id = b.property_id`,
    );
  }
}
