import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Property } from './property.entity';

@Entity('rent_payout_batches')
export class RentPayoutBatch {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  property_id: number;

  @ManyToOne(() => Property)
  @JoinColumn({ name: 'property_id' })
  property: Property;

  @Column({ type: 'date' })
  payout_period: Date;

  @Column({ type: 'numeric' })
  total_rent_collected: number;

  @Column({ default: 'PENDING' })
  status: string; // PENDING, PROCESSING, COMPLETED

  @CreateDateColumn()
  created_at: Date;
}
