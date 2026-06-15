import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Role } from './role.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  username: string;

  @Column({ unique: true, nullable: true })
  email: string;

  @Column()
  password_hash: string;

  @Column({ default: 1 })
  role_id: number;

  @Column({ default: false })
  is_whitelisted: boolean;

  @Column({ default: 'PENDING' })
  kyc_status: string;

  @Column({ type: 'numeric', nullable: true, default: 0 })
  total_asset_value: number;

  @Column({ type: 'numeric', nullable: true, default: 0 })
  total_profit_loss: number;

  @Column({ nullable: true })
  wallet_address: string;

  @Column({ nullable: true })
  wallet_private_key: string;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Role)
  @JoinColumn({ name: 'role_id' })
  role: Role;
}
