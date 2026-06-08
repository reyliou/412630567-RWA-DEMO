import { Timer, Zap, TrendingUp, Users } from "lucide-react";
import { useState, useEffect } from "react";

interface ThrottleTimerProps {
  isActive: boolean;
  startTime: Date | null;
  realActiveTransactions?: number; // 🟢 新增：從外部傳入真實交易量
}

export function ThrottleTimerCard({ isActive, startTime, realActiveTransactions = 0 }: ThrottleTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>("--:--:--");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isActive || !startTime) {
      setTimeRemaining("--:--:--");
      setProgress(0);
      return;
    }

    const interval = setInterval(() => {
      const now = new Date();
      const elapsed = now.getTime() - startTime.getTime();
      const totalDuration = 2 * 60 * 60 * 1000; // 2 hours in ms
      const remaining = Math.max(0, totalDuration - elapsed);

      if (remaining === 0) {
        setTimeRemaining("00:00:00");
        setProgress(100);
        return;
      }

      const hours = Math.floor(remaining / (60 * 60 * 1000));
      const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
      const seconds = Math.floor((remaining % (60 * 1000)) / 1000);

      setTimeRemaining(
        `${hours.toString().padStart(2, "0")}:${minutes
          .toString()
          .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      );
      setProgress((elapsed / totalDuration) * 100);
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, startTime]);

  const getAutoResumeTime = () => {
    if (!startTime) return "--:--";
    const resumeTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);
    return resumeTime.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
  };

  const currentLimit = (isActive && startTime && progress < 100) ? "1%" : "5%";
  const isThrottled = !!(isActive && startTime && progress < 100);
  
  // 🟢 最終決定：使用傳入的真實交易量 (過去一小時總量)
  const displayTransactions = isActive ? realActiveTransactions : 0;

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="flex items-center gap-2">
          <Timer className="w-5 h-5" />
          恢復期緩衝鎖 (Throttling)
        </h2>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isThrottled ? "bg-yellow-500 animate-pulse" : "bg-gray-400"}`} />
          <span className={`text-sm font-semibold ${isThrottled ? "text-yellow-500" : "text-muted-foreground"}`}>
            {isThrottled ? "限流中" : "未啟動"}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {/* Current Status - 新增功能 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-muted/50 rounded-md">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">目前持倉限制</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-bold ${isThrottled ? "text-yellow-500" : "text-green-500"}`}>
                {currentLimit}
              </span>
              <span className="text-xs text-muted-foreground">
                {isThrottled ? "(恢復期)" : "(正常期)"}
              </span>
            </div>
          </div>

          <div className="p-3 bg-muted/50 rounded-md">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">活躍交易量 (1h)</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold">{displayTransactions}</span>
              <span className="text-xs text-muted-foreground">筆</span>
            </div>
          </div>
        </div>

        <div className="text-center py-2">
          <div className="text-4xl mb-2 tabular-nums font-mono font-bold">
            {timeRemaining}
          </div>
          <div className="text-sm text-muted-foreground">剩餘時間</div>
        </div>

        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>恢復進度</span>
            <span>{progress.toFixed(1)}%</span>
          </div>
          <div className="relative h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-yellow-500 to-green-500 transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {isThrottled ? (
          <>
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
              <p className="text-yellow-600 dark:text-yellow-400 flex items-center gap-2 text-sm">
                <Zap className="w-4 h-4" />
                <span>當前處於恢復期：每位使用者僅能交易 1% 持倉</span>
              </p>
            </div>
            {/* 自動解除預告 - 新增功能 */}
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-md">
              <div className="flex items-center justify-between">
                <span className="text-sm text-green-600 dark:text-green-400">預計自動解除時間</span>
                <span className="text-sm font-mono font-semibold text-green-600 dark:text-green-400">
                  {getAutoResumeTime()}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                系統將自動切換回 5% 持倉限制
              </p>
            </div>
          </>
        ) : (
          <div className="p-3 bg-gray-500/10 border border-gray-500/20 rounded-md">
            <p className="text-gray-600 dark:text-gray-400 text-xs text-center">
              恢復期緩衝鎖未啟動 - 執行 UNPAUSE 後將自動啟動 2 小時限流期
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
