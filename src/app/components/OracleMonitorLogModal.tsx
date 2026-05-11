import { X, RefreshCw, Clock, AlertCircle, CheckCircle2, Info, XCircle } from "lucide-react";
import { useState, useEffect } from "react";

interface OracleMonitorLogModalProps {
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

export function OracleMonitorLogModal({
  isOpen,
  onClose,
}: OracleMonitorLogModalProps) {
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 1,
      timestamp: new Date(Date.now() - 600000),
      type: "success",
      message: "591 爬蟲執行成功",
      details: "抓取 287 筆建案資料，數據品質良好",
    },
    {
      id: 2,
      timestamp: new Date(Date.now() - 480000),
      type: "info",
      message: "數據更新至資料庫",
      details: "新增 12 筆，更新 45 筆",
    },
    {
      id: 3,
      timestamp: new Date(Date.now() - 360000),
      type: "warning",
      message: "591 網站響應緩慢",
      details: "請求超時 2 次，重試後成功",
    },
    {
      id: 4,
      timestamp: new Date(Date.now() - 240000),
      type: "error",
      message: "爬蟲執行失敗",
      details: "連線逾時，無法取得資料",
    },
    {
      id: 5,
      timestamp: new Date(Date.now() - 120000),
      type: "warning",
      message: "連續失敗次數增加",
      details: "已失敗 3 次，建議檢查爬蟲腳本",
    },
    {
      id: 6,
      timestamp: new Date(Date.now() - 60000),
      type: "success",
      message: "爬蟲恢復正常",
      details: "連續失敗計數已重置",
    },
    {
      id: 7,
      timestamp: new Date(),
      type: "info",
      message: "數據有效性檢查",
      details: "數據新鮮度: 2.3 小時，狀態良好",
    },
  ]);

  // Simulate real-time log generation
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      const rand = Math.random();
      let type: "info" | "warning" | "error" | "success";
      let message: string;
      let details: string;

      if (rand < 0.6) {
        type = "success";
        message = "591 爬蟲執行成功";
        details = "抓取 " + (Math.floor(Math.random() * 100) + 200) + " 筆建案資料";
      } else if (rand < 0.8) {
        type = "info";
        message = "數據有效性檢查";
        details = "數據新鮮度: " + (Math.random() * 10).toFixed(1) + " 小時";
      } else if (rand < 0.95) {
        type = "warning";
        message = "591 網站響應緩慢";
        details = "請求時間: " + (Math.random() * 3000 + 1000).toFixed(0) + "ms";
      } else {
        type = "error";
        message = "爬蟲執行失敗";
        details = "HTTP 錯誤或連線逾時";
      }

      setLogs((prev) => [
        {
          id: prev.length + 1,
          timestamp: new Date(),
          type,
          message,
          details,
        },
        ...prev,
      ].slice(0, 50));
    }, 8000);

    return () => clearInterval(interval);
  }, [isOpen]);

  const getLogIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "warning":
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case "error":
        return <XCircle className="w-4 h-4 text-red-500" />;
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
            <RefreshCw className="w-5 h-5 text-blue-500" />
            數據源監控日誌
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
            <span>每 8 秒自動更新</span>
          </div>
        </div>
      </div>
    </div>
  );
}
