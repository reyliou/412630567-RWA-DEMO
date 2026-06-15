import { ShieldCheck, ShieldAlert, Lock, Unlock, AlertCircle } from "lucide-react";

interface ContractControlCardProps {
  onPauseToggle: (isPaused: boolean) => void;
  isPaused: boolean;
}

export function ContractControlCard({ onPauseToggle, isPaused }: ContractControlCardProps) {
  return (
    <div className={`bg-card border ${isPaused ? 'border-red-500/50 bg-red-500/5' : 'border-border'} rounded-xl shadow-sm overflow-hidden flex flex-col transition-all duration-500`}>
      <div className={`p-4 border-b border-border ${isPaused ? 'bg-red-500/10' : 'bg-muted/20'} flex items-center justify-between`}>
        <h3 className="font-bold flex items-center gap-2 text-sm">
          {isPaused ? <Lock className="w-4 h-4 text-red-600" /> : <Unlock className="w-4 h-4 text-green-600" />}
          合約狀態控制 (Protocol Guard)
        </h3>
        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isPaused ? 'bg-red-600 text-white animate-pulse' : 'bg-green-500/10 text-green-600'}`}>
          {isPaused ? 'SYSTEM_PAUSED' : 'SYSTEM_ACTIVE'}
        </span>
      </div>

      <div className="p-6 flex-1 flex flex-col items-center justify-center text-center">
        <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-4 transition-all duration-500 shadow-inner ${isPaused ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
          {isPaused ? <ShieldAlert className="w-10 h-10" /> : <ShieldCheck className="w-10 h-10" />}
        </div>

        <div className="space-y-1 mb-6">
          <h4 className={`text-lg font-black ${isPaused ? 'text-red-600' : 'text-foreground'}`}>
            {isPaused ? '全局交易暫停中' : '系統運行正常'}
          </h4>
          <p className="text-xs text-muted-foreground px-4">
            {isPaused 
              ? '當前所有鏈上交易、代幣轉移與租金分發均已暫時封鎖。' 
              : '智慧合約處於活動狀態，可自由進行房產申購與交易。'}
          </p>
        </div>

        <div className="w-full pt-2">
          <button
            onClick={() => onPauseToggle(!isPaused)}
            className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-lg active:scale-95 ${
              isPaused 
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20' 
                : 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/20'
            }`}
          >
            {isPaused ? '請求解除暫停 (Request Unpause)' : '強制緊急暫停 (Force Pause)'}
          </button>
        </div>
      </div>

      <div className="px-4 py-2 bg-muted/10 border-t border-border flex items-center justify-center gap-2">
        <AlertCircle className="w-3 h-3 text-muted-foreground" />
        <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-tighter">
          Security Level: High-Availability Standard
        </span>
      </div>
    </div>
  );
}
