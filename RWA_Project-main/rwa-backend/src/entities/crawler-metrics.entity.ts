import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('crawler_metrics')
export class CrawlerMetrics {
  @PrimaryColumn({ type: 'int' })
  id: number;

  @Column({ nullable: true, type: 'timestamp' })
  last_run_at: Date;

  @Column({ type: 'int', default: 0 })
  consecutive_failures: number;

  @Column({ type: 'numeric', default: 100 })
  average_integrity: number;

  @Column({ default: 'HEALTHY' })
  status: string;
}
