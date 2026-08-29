import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { SystemAlert } from '../entities/system-alert.entity';
import { CrawlerMetrics } from '../entities/crawler-metrics.entity';
import { ChatLog } from '../entities/chat-log.entity';
import * as os from 'os';

@Injectable()
export class SystemService {
  private state = {
    isPaused: false,
    throttleStartTime: null as Date | null,
    activeRequest: 'NONE',
    requestReason: '',
  };


  private healthCheckCounter = 0;
  private lastCpuIdle = 0;
  private lastCpuTick = 0;
  public lastActiveTime = Date.now();

  constructor(
    @InjectRepository(ChatLog)
    private chatRepo: Repository<ChatLog>,
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

  async getChat() {
    const chats = await this.chatRepo.find({
      order: { id: 'DESC' },
      take: 100,
    });
    return chats.reverse().map((c) => ({
      id: c.id,
      sender: c.channel,
      content: c.message,
      timestamp: c.created_at,
    }));
  }

  async addChat(sender_id: number, channel: string, message: string) {
    const chat = this.chatRepo.create({
      sender_id,
      channel,
      message,
    });
    const saved = await this.chatRepo.save(chat);
    return {
      id: saved.id,
      sender: saved.channel,
      content: saved.message,
      timestamp: saved.created_at,
    };
  }

  async getPerformance() {
    this.lastActiveTime = Date.now();
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

    // 監控數值一律回報實測值，不做任何美化。
    // 先前這裡在回傳前加了 ±1% 的隨機抖動（`+ (Math.random() * 2 - 1)`）並箝住 1.2% 下限，
    // 目的是讓儀表板的折線圖在系統閒置時「看起來會動」。但這會讓畫面顯示值不等於實測值，
    // 而監控的全部價值正在於數字可信 —— 一個會自己加噪音的監控，比沒有監控更危險。
    // 若嫌圖表太平，應該調整取樣頻率或 Y 軸刻度，而不是竄改數據。
    //
    // 首次呼叫沒有前一次取樣可做差值，原本回傳寫死的 1.5，同樣是憑空的數字；
    // 改為以「開機以來的累計平均」計算 —— 取樣窗口不同，但仍是真實量測值。
    let cpuLoad: number;
    if (this.lastCpuTick > 0) {
      const idleDiff = currentIdle - this.lastCpuIdle;
      const totalDiff = currentTick - this.lastCpuTick;
      cpuLoad = totalDiff > 0 ? 100 - (100 * idleDiff) / totalDiff : 0;
    } else {
      cpuLoad = currentTick > 0 ? 100 - (100 * currentIdle) / currentTick : 0;
    }
    // 只做四捨五入到小數一位，不改變量值本身
    cpuLoad = Math.round(cpuLoad * 10) / 10;
    this.lastCpuIdle = currentIdle;
    this.lastCpuTick = currentTick;

    this.healthCheckCounter++;
    if (this.healthCheckCounter % 10 === 0 || dbLatency > 200) {
      const severity = dbLatency > 200 ? 'WARNING' : 'INFO';
      const msg = `系統性能查核：DB 延遲 ${dbLatency}ms, CPU 負載 ${cpuLoad.toFixed(1)}%`;
      await this.alertRepo.save(
        this.alertRepo.create({ alert_type: 'SYSTEM_HEALTH', severity, message: msg }),
      );
    }

    return {
      status: 'OK',
      dbLatency,
      cpuLoad,
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
