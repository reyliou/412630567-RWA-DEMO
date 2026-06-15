import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('valuation_logs')
export class ValuationLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  property_id: number;

  @Column({ type: 'numeric', nullable: true })
  value: number;

  @CreateDateColumn()
  recorded_at: Date;
}
