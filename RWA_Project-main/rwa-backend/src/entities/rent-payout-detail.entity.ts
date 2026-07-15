import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { RentPayoutBatch } from './rent-payout-batch.entity';
import { User } from './user.entity';

@Entity('rent_payout_details')
export class RentPayoutDetail {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  batch_id: number;

  @ManyToOne(() => RentPayoutBatch)
  @JoinColumn({ name: 'batch_id' })
  batch: RentPayoutBatch;

  @Column()
  user_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'numeric' })
  holding_percentage: number;

  @Column({ type: 'numeric' })
  payout_amount: number;

  @Column({ default: 'CALCULATED' })
  status: string; // CALCULATED, PAID, FAILED

  @Column({ nullable: true })
  tx_hash: string;

  @CreateDateColumn()
  created_at: Date;
}
