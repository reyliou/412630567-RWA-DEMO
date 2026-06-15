import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('blockchain_config')
export class BlockchainConfig {
  @PrimaryColumn()
  key: string;

  @Column({ nullable: true })
  value: string;
}
