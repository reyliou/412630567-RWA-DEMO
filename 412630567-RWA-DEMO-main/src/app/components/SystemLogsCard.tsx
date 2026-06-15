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
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filters, setFilters] = useState({
    system: false,
    crawler: false,
    audit: true,
  });

  const fetchLogs = async () => {
    try {
      const response = await apiFetch(`/api/system-alerts`);
      if (response.ok) {
        const data = await response.json();
        // 🛡️ 關鍵修正：底層稽核日誌根據過濾器狀態進行動態過濾
        const mappedLogs = data
          .filter((item: any) => {
            if (item.alert_type === 'SYSTEM_HEALTH') return filters.system;
            if (item.alert_type === 'CRAWLER_REPORT') return filters.crawler;
            // 其他皆視為操作稽核 (ORDER_MATCH, SECURITY_AUDIT 等)
            return filters.audit;
          })
          .map((item: any) => ({
            id: item.id,
            timestamp: new Date(item.created_at),
            type: item.severity === 'ERROR' ? 'error' : item.severity === 'WARNING' ? 'warning' : 'info',
            message: `[${item.alert_type}] ${item.message}`,
          }));
        setLogs(mappedLogs);
      }
    } catch (e) {
      console.warn("無法同步日誌");
    }
  };

  // 每 5 秒執行一次日誌同步，或當過濾器變更時立即同步
  useEffect(() => {
    if (tick % 5 === 0 || true) {
      fetchLogs();
    }
  }, [tick, filters]);

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
      <div className="p-3 border-b border-border bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-black uppercase tracking-widest text-slate-800">底層核心稽核日誌 (Live Audit)</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 bg-white/50 px-3 py-1 rounded-lg border border-border/50">
            <label className="flex items-center gap-1.5 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={filters.system} 
                onChange={() => setFilters(f => ({...f, system: !f.system}))}
                className="w-3 h-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className={`text-[10px] uppercase font-black tracking-tighter ${filters.system ? 'text-blue-600' : 'text-slate-400'}`}>系統運行</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={filters.crawler} 
                onChange={() => setFilters(f => ({...f, crawler: !f.crawler}))}
                className="w-3 h-3 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className={`text-[10px] uppercase font-black tracking-tighter ${filters.crawler ? 'text-purple-600' : 'text-slate-400'}`}>房產爬蟲</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={filters.audit} 
                onChange={() => setFilters(f => ({...f, audit: !f.audit}))}
                className="w-3 h-3 rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className={`text-[10px] uppercase font-black tracking-tighter ${filters.audit ? 'text-green-600' : 'text-slate-400'}`}>操作稽核</span>
            </label>
          </div>

          <div className="hidden sm:flex items-center gap-1.5">
             <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
             <span className="text-[9px] font-black text-muted-foreground uppercase italic tracking-tighter">Live Sync</span>
          </div>
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
