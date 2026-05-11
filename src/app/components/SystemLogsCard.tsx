import { Terminal, AlertCircle, CheckCircle, Info, XCircle } from "lucide-react";
import { useState, useImperativeHandle, forwardRef } from "react";

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
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: 1, timestamp: new Date(), type: "info", message: "系統底層終端已啟動。等待技術指令..." },
  ]);

  useImperativeHandle(ref, () => ({
    addLog(type: LogEntry["type"], message: string) {
      setLogs((prev) => [
        { id: Date.now(), timestamp: new Date(), type, message },
        ...prev.slice(0, 99),
      ]);
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
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
      <div className="p-3 border-b border-border bg-muted/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-widest text-foreground">底層核心稽核日誌 (Live Audit)</span>
        </div>
        <div className="flex items-center gap-1.5">
           <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
           <span className="text-[9px] font-bold text-muted-foreground uppercase">Stream Active</span>
        </div>
      </div>

      <div className="bg-black p-4 h-[300px] overflow-y-auto font-mono text-[11px] leading-5">
        <div className="space-y-0.5">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-2 hover:bg-white/5 px-1 py-0.5 rounded transition-colors">
              {getLogIcon(log.type)}
              <span className="text-gray-500 shrink-0">[{log.timestamp.toLocaleTimeString()}]</span>
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
