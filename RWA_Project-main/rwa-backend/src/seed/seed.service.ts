import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { ethers } from 'ethers';
import { Role } from '../entities/role.entity';
import { User } from '../entities/user.entity';
import { Property } from '../entities/property.entity';
import { CrawlerMetrics } from '../entities/crawler-metrics.entity';
import { BankTrustAccount } from '../entities/bank-trust.entity';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Property) private propertyRepo: Repository<Property>,
    @InjectRepository(CrawlerMetrics) private crawlerRepo: Repository<CrawlerMetrics>,
    @InjectRepository(BankTrustAccount) private bankRepo: Repository<BankTrustAccount>,
  ) {}

  async onApplicationBootstrap() {
    await this.seedRoles();
    await this.seedUsers();
    await this.seedProperties();
    await this.seedCrawlerMetrics();
  }

  private async seedRoles() {
    if ((await this.roleRepo.count()) > 0) return;
    await this.roleRepo.save([
      { role_name: 'TECHNICAL' },
      { role_name: 'BUSINESS' },
      { role_name: 'INVESTOR' },
    ]);
    this.logger.log('Roles seeded');
  }

  private makeWallet(): { wallet_address: string; wallet_private_key: string } {
    const w = ethers.Wallet.createRandom();
    return { wallet_address: w.address, wallet_private_key: w.privateKey };
  }

  private async seedUsers() {
    if ((await this.userRepo.count()) > 0) return;
    const roles = await this.roleRepo.find();
    const roleMap = Object.fromEntries(roles.map((r) => [r.role_name, r.id]));
    const hash = (pw: string) => bcrypt.hash(pw, 10);

    await this.userRepo.save([
      {
        username: 'tech01',
        email: 'tech01@rwabank.com',
        password_hash: await hash('demo1234'),
        role_id: roleMap['TECHNICAL'],
        is_whitelisted: true,
        kyc_status: 'VERIFIED',
        total_asset_value: 0,
        total_profit_loss: 0,
        ...this.makeWallet(),
      },
      {
        username: 'biz01',
        email: 'biz01@rwabank.com',
        password_hash: await hash('demo1234'),
        role_id: roleMap['BUSINESS'],
        is_whitelisted: true,
        kyc_status: 'VERIFIED',
        total_asset_value: 0,
        total_profit_loss: 0,
        ...this.makeWallet(),
      },
      {
        username: 'investor01',
        email: 'investor01@rwabank.com',
        password_hash: await hash('demo1234'),
        role_id: roleMap['INVESTOR'],
        is_whitelisted: true,
        kyc_status: 'VERIFIED',
        total_asset_value: 500000,
        total_profit_loss: 12000,
        ...this.makeWallet(),
      },
    ]);
    this.logger.log('Users seeded with Ethereum wallets (tech01/biz01/investor01 — password: demo1234)');
  }

  private async seedProperties() {
    if ((await this.propertyRepo.count()) > 0) return;

    const properties = await this.propertyRepo.save([
      {
        title: '東騰元町',
        location: '台南市',
        complete_address: '台南市安南區新吉工業區',
        main_image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400',
        token_symbol: 'RWA-1',
        total_supply_x: 100000,
        current_price: 32.5,
        fundraising_goal: 3250000,
        status: '交易中',
        expected_apy: 4.5,
      },
      {
        title: '中工雋詠',
        location: '台中市',
        complete_address: '台中市南屯區精武路',
        main_image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400',
        token_symbol: 'RWA-2',
        total_supply_x: 100000,
        current_price: 28.8,
        fundraising_goal: 2880000,
        status: '交易中',
        expected_apy: 4.2,
      },
      {
        title: '潤泰之森',
        location: '新北市',
        complete_address: '新北市淡水區中正東路',
        main_image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400',
        token_symbol: 'RWA-3',
        total_supply_x: 100000,
        current_price: 41.2,
        fundraising_goal: 4120000,
        status: '交易中',
        expected_apy: 5.1,
      },
    ]);

    await this.bankRepo.save(
      properties.map((p) => ({
        property_id: p.id,
        current_cash_balance: p.fundraising_goal * 0.3,
        pending_rent_amount: p.current_price * 500,
      })),
    );

    this.logger.log('Properties + bank trust accounts seeded');
  }

  private async seedCrawlerMetrics() {
    if ((await this.crawlerRepo.count()) > 0) return;
    await this.crawlerRepo.save({
      id: 1,
      last_run_at: new Date(),
      consecutive_failures: 0,
      average_integrity: 100,
      status: 'HEALTHY',
    });
    this.logger.log('Crawler metrics seeded');
  }
}
