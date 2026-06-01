import { Activity, Database, Server, AlertCircle, CheckCircle2, HardDrive, FileText, Search, ShieldCheck, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { OracleMonitorLogModal } from "./OracleMonitorLogModal";
import { useHeartbeat } from "../context/SystemHeartbeatContext";
import { API_BASE_URL } from "../config";

export function OracleMonitorCard() {
  const { tick } = useHeartbeat();
  const [metrics, setMetrics] = useState({
    lastRunAt: new Date(),
    failures: 0,
    integrity: 100,
    status: "HEALTHY"
  });
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  const fetchCrawlerStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/system/crawler-status`);
      if (response.ok) {
        const data = await response.json();
        setMetrics({
          lastRunAt: new Date(data.last_run_at),
          failures: data.consecutive_failures,
          integrity: parseFloat(data.average_integrity),
          status: data.status
        });
      }
    } catch (e) {
      console.error("無法同步爬蟲狀態");
    }
  };

  // 每 5 秒同步一次，與健康度卡片對齊
  useEffect(() => {
    if (tick % 5 === 0) {
      fetchCrawlerStatus();
    }
  }, [tick]);

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSec < 0) return "剛剛";
    return diffSec < 60 ? `${diffSec} 秒前` : `${Math.floor(diffSec / 60)} 分鐘前`;
  };

  return (
    <>
      <div className="bg-card rounded-lg border border-border p-6 shadow-sm font-sans text-slate-800">
        <div className="flex items-center justify-between mb-4 text-slate-800 font-bold">
          <h2 className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-blue-500" />
            數據源監控 (Oracle)
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsLogModalOpen(true)}
              className="p-1.5 hover:bg-muted rounded-md transition-colors"
            >
              <FileText className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
            <CheckCircle2 className={`w-5 h-5 ${metrics.status === 'HEALTHY' ? 'text-green-500' : 'text-yellow-500'}`} />
          </div>
        </div>

        <div className="space-y-4 text-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Search className="w-5 h-5 text-green-500" />
              <span className="text-muted-foreground text-sm font-black uppercase tracking-tighter">591 爬蟲狀態</span>
            </div>
            <span className={`font-black uppercase text-sm ${metrics.status === 'HEALTHY' ? 'text-green-500' : 'text-yellow-500'}`}>
               {metrics.status === 'HEALTHY' ? '運作正常' : '需要注意'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-green-500" />
              <span className="text-muted-foreground text-sm font-black uppercase tracking-tighter">最後成功執行</span>
            </div>
            <span className="text-foreground font-mono font-bold tracking-tighter">{formatTime(metrics.lastRunAt)}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <HardDrive className="w-5 h-5 text-green-500" />
              <span className="text-muted-foreground text-sm font-black uppercase tracking-tighter">連線失敗次數</span>
            </div>
            <span className={`font-black ${metrics.failures > 0 ? 'text-red-500' : 'text-green-500'}`}>
              {metrics.failures} / 5
            </span>
          </div>

          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-green-500" />
                <span className="text-muted-foreground text-sm font-black uppercase tracking-tighter">數據完整度</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`font-mono font-black text-lg ${metrics.integrity < 95 ? 'text-yellow-500' : 'text-green-500'}`}>
                  {metrics.integrity.toFixed(1)}%
                </span>
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <OracleMonitorLogModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
      />
    </>
  );
}
