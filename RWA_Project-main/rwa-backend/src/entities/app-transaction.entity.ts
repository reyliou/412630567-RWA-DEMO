import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('transactions')
export class AppTransaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  user_id: number;

  @Column()
  property_id: number;

  @Column()
  tx_type: string;

  @Column({ nullable: true })
  order_type: string;

  @Column({ type: 'numeric' })
  token_amount: number;

  @Column({ type: 'numeric' })
  price_per_token: number;

  @Column({ default: 'SUCCESS' })
  status: string;

  @Column({ nullable: true })
  tx_hash: string;

  @CreateDateColumn()
  created_at: Date;
}
