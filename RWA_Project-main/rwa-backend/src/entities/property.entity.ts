import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('properties')
export class Property {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  title: string;

  @Column({ nullable: true })
  location: string;

  @Column({ nullable: true })
  complete_address: string;

  @Column({ nullable: true })
  main_image: string;

  @Column({ nullable: true, default: 'RWA' })
  token_symbol: string;

  @Column({ type: 'numeric', nullable: true, default: 100000 })
  total_supply_x: number;

  @Column({ type: 'numeric', nullable: true, default: 0 })
  current_price: number;

  @Column({ type: 'numeric', nullable: true, default: 0 })
  fundraising_goal: number;

  @Column({ nullable: true, default: '交易中' })
  status: string;

  @Column({ type: 'numeric', nullable: true, default: 4.5 })
  expected_apy: number;

  @Column({ nullable: true })
  token_address: string;
}
