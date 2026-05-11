import { Activity, Database, Server, AlertCircle, CheckCircle2, HardDrive, FileText, Search, ShieldCheck, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { OracleMonitorLogModal } from "./OracleMonitorLogModal";

export function OracleMonitorCard() {
  const [engineStatus, setEngineStatus] = useState({
    lastSync: new Date(),
    failures: 0,
    status: "healthy" as "healthy" | "warning" | "critical"
  });
  
  const [dataIntegrity, setDataIntegrity] = useState(99.9);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  // 模擬與系統健康度一致的更新頻率
  useEffect(() => {
    const interval = setInterval(() => {
      const shouldFail = Math.random() < 0.05;
      setEngineStatus(prev => ({
        lastSync: shouldFail ? prev.lastSync : new Date(),
        failures: shouldFail ? prev.failures + 1 : 0,
        status: shouldFail ? "warning" : "healthy"
      }));
      setDataIntegrity(99.7 + Math.random() * 0.3);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    return diffSec < 60 ? `${diffSec} 秒前` : `${Math.floor(diffSec / 60)} 分鐘前`;
  };

  return (
    <>
      <div className="bg-card rounded-lg border border-border p-6 shadow-sm">
        {/* Header - 同步風格 */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            數據源監控 (Oracle)
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsLogModalOpen(true)}
              className="p-1.5 hover:bg-muted rounded-md transition-colors"
            >
              <FileText className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          </div>
        </div>

        {/* Content Rows - 同步風格 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Search className="w-5 h-5 text-green-500" />
              <span className="text-muted-foreground">591 爬蟲狀態</span>
            </div>
            <span className="text-green-500">運作正常</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-green-500" />
              <span className="text-muted-foreground">最後成功執行</span>
            </div>
            <span className="text-foreground">{formatTime(engineStatus.lastSync)}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <HardDrive className="w-5 h-5 text-green-500" />
              <span className="text-muted-foreground">連線失敗次數</span>
            </div>
            <span className="text-green-500">{engineStatus.failures} / 5</span>
          </div>

          {/* 數據完整度 - 同步風格 (帶有分隔線與底部說明) */}
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-green-500" />
                <span className="text-muted-foreground">數據完整度</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-500 font-medium">
                  {dataIntegrity.toFixed(1)}%
                </span>
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1 ml-8">
              自研爬蟲核心數據一致性
            </p>
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
