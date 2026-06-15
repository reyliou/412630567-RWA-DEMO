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

    return { summary: user, holdings };
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
