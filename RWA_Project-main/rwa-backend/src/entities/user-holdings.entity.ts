import { Entity, PrimaryGeneratedColumn, Column, Unique } from 'typeorm';

@Entity('user_holdings')
@Unique(['user_id', 'property_id', 'holder_type'])
export class UserHolding {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  user_id: number;

  @Column()
  property_id: number;

  @Column({ type: 'numeric', default: 0 })
  balance: number;

  @Column({ default: 'INVESTOR' })
  holder_type: string;
}
