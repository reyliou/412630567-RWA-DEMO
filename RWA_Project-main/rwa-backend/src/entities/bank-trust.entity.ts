import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('bank_trust_accounts')
export class BankTrustAccount {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  property_id: number;

  @Column({ type: 'numeric', default: 0 })
  current_cash_balance: number;

  @Column({ type: 'numeric', default: 0 })
  pending_rent_amount: number;
}
