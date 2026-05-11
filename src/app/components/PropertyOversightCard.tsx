import { Building2, PieChart as PieChartIcon, DollarSign, Send, TrendingUp, Wallet, Clock, CheckCircle2 } from "lucide-react";
import { useState } from "react";

export function PropertyOversightCard() {
  const [isSending, setIsSending] = useState(false);
  const [payoutPeriod, setPayoutPeriod] = useState("30");
  const [isUpdatingPeriod, setIsUpdatingPeriod] = useState(false);

  const handleSendRent = () => {
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      alert("租金已成功發放給 4,200 位投資人！");
    }, 2000);
  };

  const handleUpdatePeriod = () => {
    setIsUpdatingPeriod(true);
    setTimeout(() => {
      setIsUpdatingPeriod(false);
      alert(`收益發放週期已成功更新為 ${payoutPeriod} 天！`);
    }, 1000);
  };

  return (
    <div className="bg-card border border-border rounded-[2rem] shadow-xl overflow-hidden flex flex-col transition-all duration-500 ring-1 ring-slate-100">
      <div className="p-6 border-b border-border bg-purple-500/5 flex items-center justify-between">
        <h3 className="font-black flex items-center gap-3 text-purple-700 dark:text-purple-400 text-lg uppercase tracking-tight">
          <Building2 className="w-6 h-6" />
          房產資產營運終端 (Property Ops)
        </h3>
        <span className="text-xs font-black bg-purple-100 text-purple-700 px-4 py-1.5 rounded-xl uppercase tracking-widest shadow-sm">
          Banker Mode
        </span>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left: Stats & Chart Simulation */}
          <div className="space-y-8">
            <div>
              <div className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em] mb-2">當前房產資產總價值 (BASE)</div>
              <div className="text-5xl font-black text-slate-800">$10,000,000 <span className="text-lg font-bold text-slate-400">TWD</span></div>
            </div>

            <div className="flex items-center gap-8 bg-slate-50/50 p-6 rounded-[2.5rem] border border-slate-100">
               <div className="relative w-36 h-32">
                  <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="transparent" stroke="#a855f7" strokeWidth="4" strokeDasharray="75 25" />
                    <circle cx="18" cy="18" r="15.9" fill="transparent" stroke="#f97316" strokeWidth="4" strokeDasharray="15 85" strokeDashoffset="-75" />
                    <circle cx="18" cy="18" r="15.9" fill="transparent" stroke="#eab308" strokeWidth="4" strokeDasharray="10 90" strokeDashoffset="-90" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className="text-[10px] text-slate-400 font-black">總持份</span>
                    <span className="text-base font-black text-slate-700">100%</span>
                  </div>
               </div>
               
               <div className="space-y-3">
                  <div className="flex items-center gap-3 text-xs">
                    <div className="w-3.5 h-3.5 rounded-full bg-purple-500 shadow-sm shadow-purple-200" />
                    <span className="text-slate-500 font-bold w-20">投資大眾:</span>
                    <span className="font-black text-slate-800">75%</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <div className="w-3.5 h-3.5 rounded-full bg-orange-500 shadow-sm shadow-orange-200" />
                    <span className="text-slate-500 font-bold w-20">保險合資:</span>
                    <span className="font-black text-slate-800">15%</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <div className="w-3.5 h-3.5 rounded-full bg-yellow-500 shadow-sm shadow-yellow-200" />
                    <span className="text-slate-500 font-bold w-20">銀行自持:</span>
                    <span className="font-black text-slate-800">10%</span>
                  </div>
               </div>
            </div>
            
            <div className="p-6 bg-slate-900 rounded-[2rem] border border-slate-800 shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-10">
                  <TrendingUp className="w-20 h-20 text-white" />
               </div>
               <h4 className="text-[10px] font-black text-slate-400 uppercase mb-3 flex items-center gap-2 tracking-[0.2em]">
                 <TrendingUp className="w-4 h-4 text-green-400" /> 營運績效動態
               </h4>
               <p className="text-sm text-white/90 leading-relaxed font-medium">
                 本季度代幣化資產 <span className="text-green-400 font-black">曉陽明2</span> 租金繳納率達 <span className="underline decoration-green-500 underline-offset-4">100%</span>，預計下個結算週期之年化收益率將維持在 <span className="text-green-400 font-bold">4.25%</span> 以上。
               </p>
            </div>
          </div>

          {/* Right: Actions & Distribution */}
          <div className="space-y-8 flex flex-col justify-center">
            {/* New: Payout Period Setting Section */}
            <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 space-y-5 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                   <Clock className="w-5 h-5 text-purple-600" />
                   <span className="text-sm font-black text-slate-800 uppercase tracking-tight">設定收益發放週期</span>
                </div>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <input 
                      type="number" 
                      value={payoutPeriod}
                      onChange={(e) => setPayoutPeriod(e.target.value)}
                      className="w-full pl-6 pr-12 py-5 bg-white border border-slate-200 rounded-2xl font-mono font-black text-xl outline-none focus:ring-4 focus:ring-purple-600/10 transition-all text-purple-700" 
                    />
                    <span className="absolute right-6 top-6 text-xs font-black text-slate-400 uppercase">Days</span>
                  </div>
                  <button 
                    onClick={handleUpdatePeriod}
                    disabled={isUpdatingPeriod}
                    className="px-8 py-5 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-purple-200 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
                  >
                    {isUpdatingPeriod ? <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span> : <CheckCircle2 className="w-5 h-5" />}
                    更新週期
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 font-bold italic ml-1">※ 智慧合約將根據此設定自動排程每期的租金分潤時間。</p>
            </div>

            {/* Existing: Send Payout Section */}
            <div className="space-y-5">
               <div className="p-6 bg-green-500/5 border border-green-500/10 rounded-[2rem] text-center relative overflow-hidden">
                  <div className="text-[10px] text-green-700 font-black uppercase tracking-[0.2em] mb-2">本期待撥發總收益 (Pending Payout)</div>
                  <div className="text-5xl font-mono font-black text-green-600 tracking-tighter">$420,000</div>
                  <div className="text-[10px] text-green-600/60 mt-2 font-bold uppercase tracking-widest">Calculated for 4,200 Holders</div>
               </div>

               <div className="pt-2">
                  <button 
                    onClick={handleSendRent}
                    disabled={isSending}
                    className="w-full py-6 bg-green-600 hover:bg-green-700 text-white rounded-[2rem] font-black text-xl flex items-center justify-center gap-4 shadow-2xl shadow-green-500/30 transition-all active:scale-[0.97] disabled:opacity-50"
                  >
                    {isSending ? (
                      <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></span>
                    ) : (
                      <>
                        <Send className="w-7 h-7" />
                        執行全球收益發送
                      </>
                    )}
                  </button>
               </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 text-[9px] text-slate-400 font-black uppercase tracking-[0.3em] flex justify-between">
        <span>Oracle Verified Data</span>
        <span>Node: BANK_HK_01</span>
      </div>
    </div>
  );
}
