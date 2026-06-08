import { Activity, Database, Server, AlertCircle, CheckCircle2, HardDrive, FileText, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { SystemHealthLogModal } from "./SystemHealthLogModal";
import { useHeartbeat } from "../context/SystemHeartbeatContext"; // 訂閱心跳
import { API_BASE_URL } from "../config";

export function SystemHealthCard() {
  const { tick } = useHeartbeat(); // 獲取全域 tick
  const [metrics, setMetrics] = useState({
    apiResponse: 0,
    dbLatency: 0,
    cpuLoad: 12.5,
    isSynced: true
  });
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  const fetchPerformance = async () => {
    const startTime = Date.now();
    try {
      const response = await fetch(`${API_BASE_URL}/api/system/performance`);
      if (response.ok) {
        const data = await response.json();
        setMetrics({
          apiResponse: Date.now() - startTime,
          dbLatency: data.dbLatency,
          cpuLoad: data.cpuLoad,
          isSynced: true
        });
      }
    } catch (e) {
      setMetrics(prev => ({ ...prev, isSynced: false }));
    }
  };

  // 根據全域心跳觸發：每 5 秒執行一次
  useEffect(() => {
    if (tick % 5 === 0) {
      fetchPerformance();
    }
  }, [tick]);

  return (
    <>
      <div className="bg-card rounded-lg border border-border p-6 shadow-sm font-sans text-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 font-bold uppercase tracking-tight">
            <Activity className="w-5 h-5 text-blue-500" />
            系統核心運行狀態
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsLogModalOpen(true)}
              className="p-1.5 hover:bg-muted rounded-md transition-colors"
            >
              <FileText className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
            <CheckCircle2 className={`w-5 h-5 ${metrics.isSynced ? 'text-green-500' : 'text-red-500'}`} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between text-slate-800">
            <div className="flex items-center gap-3">
              <Server className="w-5 h-5 text-green-500" />
              <span className="text-muted-foreground text-sm font-black uppercase">API 響應時間</span>
            </div>
            <span className={`font-mono font-black ${metrics.apiResponse > 100 ? 'text-yellow-500' : 'text-green-500'}`}>
              {metrics.apiResponse} ms
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-800">
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-green-500" />
              <span className="text-muted-foreground text-sm font-black uppercase">PostgreSQL 延遲</span>
            </div>
            <span className={`font-mono font-black ${metrics.dbLatency > 50 ? 'text-yellow-500' : 'text-green-500'}`}>
              {metrics.dbLatency} ms
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-800">
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-green-500" />
              <span className="text-muted-foreground text-sm font-black uppercase">伺服器負載 (CPU)</span>
            </div>
            <span className="font-mono font-black">{metrics.cpuLoad.toFixed(1)}%</span>
          </div>

          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <HardDrive className="w-5 h-5 text-green-500" />
                <span className="text-muted-foreground text-sm font-black uppercase">資料庫一致性</span>
              </div>
              <div className="flex items-center gap-2 text-green-500">
                <span className="text-sm font-black uppercase tracking-tighter">Synced</span>
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <SystemHealthLogModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
      />
    </>
  );
}
