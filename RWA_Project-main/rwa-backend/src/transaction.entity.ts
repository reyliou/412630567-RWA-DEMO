import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('rwa_transaction')
export class RwaTransaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  txHash: string;

  @Column()
  fromAddress: string; // ✨ 新增這行

  @Column()
  toAddress: string;

  @Column()
  amount: string; // ✨ 新增這行

  @Column()
  executionTimeMs: number;

  // 把原本的 @CreateDateColumn() 換成這個，讓它自動加 8 小時
  @CreateDateColumn({ 
    transformer: {
      to: (value: Date) => value,
      from: (value: Date) => {
        const date = new Date(value);
        date.setHours(date.getHours() + 8); // 手動加 8 小時變成台北時間
        return date;
      }
    }
  })
  createdAt: Date;
}