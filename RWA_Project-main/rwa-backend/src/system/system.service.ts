import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { SystemAlert } from '../entities/system-alert.entity';
import { CrawlerMetrics } from '../entities/crawler-metrics.entity';
import * as os from 'os';

@Injectable()
export class SystemService {
  private state = {
    isPaused: false,
    throttleStartTime: null as Date | null,
    activeRequest: 'NONE',
    requestReason: '',
  };

  private chatMessages: { id: number; sender: string; content: string; timestamp: Date }[] = [
    { id: 1, sender: 'system', content: '💬 跨部門協作頻道已建立', timestamp: new Date() },
  ];

  private healthCheckCounter = 0;
  private lastCpuIdle = 0;
  private lastCpuTick = 0;

  constructor(
    @InjectRepository(SystemAlert)
    private alertRepo: Repository<SystemAlert>,
    @InjectRepository(CrawlerMetrics)
    private crawlerRepo: Repository<CrawlerMetrics>,
    private dataSource: DataSource,
  ) {}

  getState() {
    return { ...this.state };
  }

  setState(updates: { isPaused?: boolean; activeRequest?: string; requestReason?: string }) {
    const wasPaused = this.state.isPaused;

    if (updates.isPaused !== undefined) this.state.isPaused = updates.isPaused;
    if (updates.activeRequest !== undefined) this.state.activeRequest = updates.activeRequest;
    if (updates.requestReason !== undefined) this.state.requestReason = updates.requestReason;

    if (wasPaused === true && this.state.isPaused === false) {
      this.state.throttleStartTime = new Date();
    } else if (this.state.isPaused === true) {
      this.state.throttleStartTime = null;
    }

    return { success: true, state: { ...this.state } };
  }

  isThrottled(): boolean {
    if (!this.state.throttleStartTime) return false;
    return Date.now() - this.state.throttleStartTime.getTime() < 2 * 60 * 60 * 1000;
  }

  getChat() {
    return [...this.chatMessages];
  }

  addChat(sender: string, content: string) {
    const msg = { id: Date.now(), sender, content, timestamp: new Date() };
    this.chatMessages.push(msg);
    if (this.chatMessages.length > 100) this.chatMessages.shift();
    return msg;
  }

  async getPerformance() {
    const start = Date.now();
    await this.dataSource.query('SELECT 1');
    const dbLatency = Date.now() - start;

    const cpus = os.cpus();
    let currentIdle = 0;
    let currentTick = 0;
    cpus.forEach((cpu) => {
      for (const type in cpu.times) currentTick += (cpu.times as any)[type];
      currentIdle += cpu.times.idle;
    });

    let cpuLoad = 1.5;
    if (this.lastCpuTick > 0) {
      const idleDiff = currentIdle - this.lastCpuIdle;
      const totalDiff = currentTick - this.lastCpuTick;
      if (totalDiff > 0) cpuLoad = 100 - ~~((100 * idleDiff) / totalDiff);
    }
    this.lastCpuIdle = currentIdle;
    this.lastCpuTick = currentTick;

    this.healthCheckCounter++;
    if (this.healthCheckCounter % 10 === 0 || dbLatency > 200) {
      const severity = dbLatency > 200 ? 'WARNING' : 'INFO';
      const msg = `系統性能查核：DB 延遲 ${dbLatency}ms, CPU 負載 ${Math.max(1.2, cpuLoad).toFixed(1)}%`;
      await this.alertRepo.save(
        this.alertRepo.create({ alert_type: 'SYSTEM_HEALTH', severity, message: msg }),
      );
    }

    return {
      status: 'OK',
      dbLatency,
      cpuLoad: Math.max(1.2, cpuLoad + (Math.random() * 2 - 1)),
      serverTime: new Date(),
    };
  }

  async getCrawlerStatus() {
    return this.crawlerRepo.findOne({ where: { id: 1 } });
  }

  async updateCrawlerReport(failures: number, integrity: number, status: string) {
    await this.crawlerRepo.update(1, {
      last_run_at: new Date(),
      consecutive_failures: failures,
      average_integrity: integrity,
      status,
    });
    const msg = `房產數據同步完成。狀態: ${status}, 失敗次數: ${failures}, 平均完整度: ${integrity}%`;
    await this.alertRepo.save(
      this.alertRepo.create({
        alert_type: 'CRAWLER_REPORT',
        severity: status === 'HEALTHY' ? 'INFO' : 'WARNING',
        message: msg,
      }),
    );
  }

  async getAlerts() {
    return this.alertRepo.find({ order: { created_at: 'DESC' }, take: 30 });
  }

  async logAlert(alertType: string, severity: string, message: string) {
    await this.alertRepo.save(this.alertRepo.create({ alert_type: alertType, severity, message }));
  }
}
