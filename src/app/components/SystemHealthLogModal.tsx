import { X, Activity, Clock, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { useState, useEffect } from "react";

interface SystemHealthLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface LogEntry {
  id: number;
  timestamp: Date;
  type: "info" | "warning" | "error" | "success";
  message: string;
  details?: string;
}

export function SystemHealthLogModal({
  isOpen,
  onClose,
}: SystemHealthLogModalProps) {
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 1,
      timestamp: new Date(Date.now() - 300000),
      type: "success",
      message: "系統健康檢查通過",
      details: "PostgreSQL: 12ms, NestJS: 45ms, Docker: 2/2",
    },
    {
      id: 2,
      timestamp: new Date(Date.now() - 180000),
      type: "info",
      message: "DB 同步率正常",
      details: "同步率: 99.8%",
    },
    {
      id: 3,
      timestamp: new Date(Date.now() - 120000),
      type: "warning",
      message: "NestJS API 響應時間略高",
      details: "響應時間: 156ms (閾值: 100ms)",
    },
    {
      id: 4,
      timestamp: new Date(Date.now() - 60000),
      type: "success",
      message: "系統恢復正常",
      details: "所有指標回到健康範圍",
    },
    {
      id: 5,
      timestamp: new Date(),
      type: "info",
      message: "定期健康檢查執行",
      details: "所有服務運行正常",
    },
  ]);

  // Simulate real-time log generation
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      const types: ("info" | "warning" | "success")[] = ["info", "success", "warning"];
      const messages = [
        { message: "PostgreSQL 連接測試成功", details: "延遲: " + (Math.random() * 30 + 10).toFixed(0) + "ms" },
        { message: "Docker 容器狀態檢查", details: "所有容器運行正常" },
        { message: "DB 同步率監測", details: "同步率: " + (Math.random() * 0.5 + 99.5).toFixed(1) + "%" },
        { message: "系統資源使用率檢查", details: "CPU: " + (Math.random() * 30 + 20).toFixed(1) + "%, Memory: " + (Math.random() * 20 + 40).toFixed(1) + "%" },
      ];

      const randomType = types[Math.floor(Math.random() * types.length)];
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];

      setLogs((prev) => [
        {
          id: prev.length + 1,
          timestamp: new Date(),
          type: randomType,
          message: randomMessage.message,
          details: randomMessage.details,
        },
        ...prev,
      ].slice(0, 50)); // Keep only last 50 logs
    }, 10000);

    return () => clearInterval(interval);
  }, [isOpen]);

  const getLogIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "warning":
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getLogColor = (type: string) => {
    switch (type) {
      case "success":
        return "bg-green-500/10 border-green-500/20";
      case "warning":
        return "bg-yellow-500/10 border-yellow-500/20";
      case "error":
        return "bg-red-500/10 border-red-500/20";
      default:
        return "bg-blue-500/10 border-blue-500/20";
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg border border-border max-w-4xl w-full mx-4 shadow-xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="flex items-center gap-2 font-semibold">
            <Activity className="w-5 h-5 text-green-500" />
            系統健康生成日誌
          </h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Log Entries */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className={`p-3 rounded-md border ${getLogColor(log.type)}`}
            >
              <div className="flex items-start gap-3">
                {getLogIcon(log.type)}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium">{log.message}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {log.timestamp.toLocaleTimeString("zh-TW")}
                    </div>
                  </div>
                  {log.details && (
                    <p className="text-xs text-muted-foreground">{log.details}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>共 {logs.length} 筆紀錄</span>
            <span>每 10 秒自動更新</span>
          </div>
        </div>
      </div>
    </div>
  );
}
