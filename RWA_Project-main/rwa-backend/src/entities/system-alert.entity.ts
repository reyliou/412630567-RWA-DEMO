import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('system_alerts')
export class SystemAlert {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  alert_type: string;

  @Column({ nullable: true })
  severity: string;

  @Column({ nullable: true })
  message: string;

  @CreateDateColumn()
  created_at: Date;
}
