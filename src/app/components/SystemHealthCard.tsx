import { Activity, Database, Server, AlertCircle, CheckCircle2, HardDrive, FileText } from "lucide-react";
import { useState, useEffect } from "react";
import { SystemHealthLogModal } from "./SystemHealthLogModal";

interface HealthMetric {
  name: string;
  value: string;
  status: "healthy" | "warning" | "critical";
  icon: typeof Activity;
}

export function SystemHealthCard() {
  const [metrics, setMetrics] = useState<HealthMetric[]>([
    {
      name: "PostgreSQL 延遲",
      value: "12ms",
      status: "healthy",
      icon: Database,
    },
    {
      name: "NestJS API 響應",
      value: "45ms",
      status: "healthy",
      icon: Server,
    },
    {
      name: "Docker 容器狀態",
      value: "2/2 運行中",
      status: "healthy",
      icon: HardDrive,
    },
  ]);

  const [dbSyncRate, setDbSyncRate] = useState(99.8);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics((prev) =>
        prev.map((metric) => {
          let newValue = metric.value;
          let newStatus: "healthy" | "warning" | "critical" = "healthy";

          if (metric.name === "PostgreSQL 延遲") {
            const latency = Math.floor(Math.random() * 30 + 10);
            newValue = `${latency}ms`;
            if (latency > 100) newStatus = "critical";
            else if (latency > 50) newStatus = "warning";
          } else if (metric.name === "NestJS API 響應") {
            const response = Math.floor(Math.random() * 50 + 30);
            newValue = `${response}ms`;
            if (response > 200) newStatus = "critical";
            else if (response > 100) newStatus = "warning";
          }

          return { ...metric, value: newValue, status: newStatus };
        })
      );

      // Update DB sync rate
      setDbSyncRate(Math.random() * 0.5 + 99.5);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "text-green-500";
      case "warning":
        return "text-yellow-500";
      case "critical":
        return "text-red-500";
      default:
        return "text-gray-500";
    }
  };

  const overallStatus = metrics.some(m => m.status === "critical")
    ? "critical"
    : metrics.some(m => m.status === "warning")
    ? "warning"
    : "healthy";

  return (
    <>
      <div className="bg-card rounded-lg border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            系統核心健康度
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsLogModalOpen(true)}
              className="p-1.5 hover:bg-muted rounded-md transition-colors"
              title="查看日誌"
            >
              <FileText className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
            {overallStatus === "healthy" ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : (
              <AlertCircle className={`w-5 h-5 ${getStatusColor(overallStatus)}`} />
            )}
          </div>
        </div>
        <div className="space-y-4">
        {metrics.map((metric) => (
          <div key={metric.name} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <metric.icon className={`w-5 h-5 ${getStatusColor(metric.status)}`} />
              <span className="text-muted-foreground">{metric.name}</span>
            </div>
            <span className={getStatusColor(metric.status)}>{metric.value}</span>
          </div>
        ))}

        {/* DB 同步率 - 新增功能 */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className={`w-5 h-5 ${dbSyncRate >= 99.5 ? "text-green-500" : dbSyncRate >= 98 ? "text-yellow-500" : "text-red-500"}`} />
              <span className="text-muted-foreground">DB 同步率</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={dbSyncRate >= 99.5 ? "text-green-500" : dbSyncRate >= 98 ? "text-yellow-500" : "text-red-500"}>
                {dbSyncRate.toFixed(1)}%
              </span>
              {dbSyncRate >= 99.5 ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : (
                <AlertCircle className="w-4 h-4 text-yellow-500" />
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1 ml-8">
            資料庫與鏈上紀錄一致性
          </p>
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
