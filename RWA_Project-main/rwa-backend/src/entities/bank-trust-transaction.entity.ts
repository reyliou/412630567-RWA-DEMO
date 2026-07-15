import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { BankTrustAccount } from './bank-trust.entity';

@Entity('bank_trust_transactions')
export class BankTrustTransaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  trust_account_id: number;

  @ManyToOne(() => BankTrustAccount)
  @JoinColumn({ name: 'trust_account_id' })
  trust_account: BankTrustAccount;

  @Column()
  tx_type: string; // 'RENT_INCOME', 'PAYOUT_DEDUCTION', 'FEE', 'ADJUSTMENT'

  @Column({ type: 'numeric' })
  amount: number;

  @Column({ type: 'text', nullable: true })
  reference_note: string;

  @CreateDateColumn()
  recorded_at: Date;
}
