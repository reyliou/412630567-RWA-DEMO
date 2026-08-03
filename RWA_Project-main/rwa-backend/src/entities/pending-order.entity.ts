import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('pending_orders')
export class PendingOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  user_id: number;

  @Column()
  property_id: number;

  @Column()
  tx_type: string; // 'BUY' or 'SELL'

  @Column({ type: 'numeric' })
  token_amount: number;

  @Column({ type: 'numeric' })
  limit_price: number;

  @Column({ default: 'PENDING' })
  status: string; // 'PENDING', 'EXECUTED', 'CANCELLED'

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
