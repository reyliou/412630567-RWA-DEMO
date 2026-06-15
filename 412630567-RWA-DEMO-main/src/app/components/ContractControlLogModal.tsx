import { X, Shield, Clock, AlertCircle, CheckCircle2, Info, Play, Pause } from "lucide-react";
import { useState, useEffect } from "react";

interface ContractControlLogModalProps {
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

export function ContractControlLogModal({
  isOpen,
  onClose,
}: ContractControlLogModalProps) {
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 1,
      timestamp: new Date(Date.now() - 7200000),
      type: "warning",
      message: "執行 PAUSE 操作",
      details: "原因: 591 爬蟲連續失敗 5 次，啟動緊急暫停",
    },
    {
      id: 2,
      timestamp: new Date(Date.now() - 7000000),
      type: "info",
      message: "合約狀態變更",
      details: "狀態: ACTIVE → PAUSED",
    },
    {
      id: 3,
      timestamp: new Date(Date.now() - 5400000),
      type: "info",
      message: "行員介入檢查",
      details: "行員開始進行人工資料校正",
    },
    {
      id: 4,
      timestamp: new Date(Date.now() - 3600000),
      type: "success",
      message: "行員確認完成",
      details: "所有檢查項目已完成，可執行 UNPAUSE",
    },
    {
      id: 5,
      timestamp: new Date(Date.now() - 3500000),
      type: "success",
      message: "執行 UNPAUSE 操作",
      details: "行員確認後恢復合約交易功能",
    },
    {
      id: 6,
      timestamp: new Date(Date.now() - 3490000),
      type: "info",
      message: "合約狀態變更",
      details: "狀態: PAUSED → ACTIVE",
    },
    {
      id: 7,
      timestamp: new Date(Date.now() - 3480000),
      type: "info",
      message: "啟動 Throttle 限流機制",
      details: "2 小時內限制流量 1%",
    },
    {
      id: 8,
      timestamp: new Date(Date.now() - 1800000),
      type: "info",
      message: "Gas Price 監控",
      details: "當前 Gas Price: 28.5 Gwei (正常範圍)",
    },
    {
      id: 9,
      timestamp: new Date(Date.now() - 600000),
      type: "success",
      message: "Throttle 限流期結束",
      details: "系統恢復正常交易流量",
    },
    {
      id: 10,
      timestamp: new Date(),
      type: "info",
      message: "合約狀態監控",
      details: "區塊高度: #1245678, 合約運行正常",
    },
  ]);

  // Simulate real-time log generation
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      const rand = Math.random();
      let type: "info" | "warning" | "success";
      let message: string;
      let details: string;

      if (rand < 0.7) {
        type = "info";
        const messages = [
          { msg: "Gas Price 監控", det: "當前 Gas Price: " + (Math.random() * 30 + 15).toFixed(1) + " Gwei" },
          { msg: "區塊鏈狀態檢查", det: "區塊高度: #" + (1245678 + Math.floor(Math.random() * 100)) },
          { msg: "合約健康檢查", det: "所有功能運行正常" },
        ];
        const selected = messages[Math.floor(Math.random() * messages.length)];
        message = selected.msg;
        details = selected.det;
      } else if (rand < 0.9) {
        type = "success";
        message = "交易處理成功";
        details = "Tx Hash: 0x" + Math.random().toString(16).substr(2, 16);
      } else {
        type = "warning";
        message = "Gas Price 異常";
        details = "Gas Price 超過 35 Gwei，建議延後交易";
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
    }, 12000);

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
            <Shield className="w-5 h-5 text-purple-500" />
            合約控管日誌
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
            <span>每 12 秒自動更新</span>
          </div>
        </div>
      </div>
    </div>
  );
}
