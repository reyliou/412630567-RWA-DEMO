import { Terminal, AlertCircle, CheckCircle, Info, XCircle } from "lucide-react";
import { useState, useImperativeHandle, forwardRef, useEffect } from "react";
import { useHeartbeat } from "../context/SystemHeartbeatContext";
import { useAuth } from "../context/AuthContext";

interface LogEntry {
  id: number;
  timestamp: Date;
  type: "info" | "success" | "warning" | "error";
  message: string;
}

export interface SystemLogsCardHandle {
  addLog: (type: LogEntry["type"], message: string) => void;
}

export const SystemLogsCard = forwardRef<SystemLogsCardHandle>((props, ref) => {
  const { tick } = useHeartbeat();
  const { apiFetch } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: 1, timestamp: new Date(), type: "info", message: "系統稽核引擎已啟動，等待全域心跳信號..." },
  ]);

  const fetchLogs = async () => {
    try {
      const response = await apiFetch(`/api/system-alerts`);
      if (response.ok) {
        const data = await response.json();
        // 🛡️ 關鍵修正：底層稽核日誌過濾掉性能與爬蟲，專注於業務邏輯 (交易與安全)
        const mappedLogs = data
          .filter((item: any) => item.alert_type !== 'CRAWLER_REPORT' && item.alert_type !== 'SYSTEM_HEALTH')
          .map((item: any) => ({
            id: item.id,
            timestamp: new Date(item.created_at),
            type: item.severity === 'ERROR' ? 'error' : item.severity === 'WARNING' ? 'warning' : 'info',
            message: item.message,
          }));
        setLogs(mappedLogs);
      }
    } catch (e) {
      console.warn("無法同步日誌");
    }
  };

  // 每 5 秒執行一次日誌同步
  useEffect(() => {
    if (tick % 5 === 0) {
      fetchLogs();
    }
  }, [tick]);

  useImperativeHandle(ref, () => ({
    addLog(type: LogEntry["type"], message: string) {
      const newLog: LogEntry = { id: Date.now(), timestamp: new Date(), type, message };
      setLogs((prev) => [newLog, ...prev].slice(0, 99));
    }
  }));

  const getLogIcon = (type: LogEntry["type"]) => {
    switch (type) {
      case "success": return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "warning": return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case "error": return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col font-sans text-slate-800 font-black">
      <div className="p-3 border-b border-border bg-muted/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-black uppercase tracking-widest text-slate-800">底層核心稽核日誌 (Live Audit)</span>
        </div>
        <div className="flex items-center gap-1.5">
           <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
           <span className="text-[9px] font-black text-muted-foreground uppercase italic tracking-tighter">Tick Synchronized</span>
        </div>
      </div>

      <div className="bg-black p-4 h-[300px] overflow-y-auto font-mono text-[11px] leading-5">
        <div className="space-y-0.5">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-2 hover:bg-white/5 px-1 py-0.5 rounded transition-colors text-slate-800">
              {getLogIcon(log.type)}
              <span className="text-gray-500 shrink-0 font-bold">[{log.timestamp.toLocaleTimeString()}]</span>
              <span className={
                log.type === "success" ? "text-green-400" : 
                log.type === "warning" ? "text-yellow-400" : 
                log.type === "error" ? "text-red-400" : "text-gray-300"
              }>{log.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

SystemLogsCard.displayName = "SystemLogsCard";
