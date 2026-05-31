import { Wallet, TrendingUp, Building2, PieChart, ArrowUpRight, Clock, TrendingDown } from "lucide-react";
import { useState, useEffect } from "react";
import { useHeartbeat } from "../context/SystemHeartbeatContext";

export function InvestorPortfolio({ userId, userName }: { userId: number, userName: string }) {
  const { tick } = useHeartbeat();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPortfolio = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/portfolio/${userId}`);
      if (response.ok) {
        const res = await response.json();
        setData(res);
      }
    } catch (e) {
      console.error("資產對接失敗");
    } finally {
      setIsLoading(false);
    }
  };

  // 每 30 秒自動刷新一次持倉 (效能考量)
  useEffect(() => {
    if (tick % 30 === 0) {
      fetchPortfolio();
    }
  }, [tick]);

  const todayTotal = parseFloat(data?.summary?.total_asset_value || "0");
  const unrealizedPnL = parseFloat(data?.summary?.total_profit_loss || "0");
  const todayProfit = unrealizedPnL * 0.01;
  const profitPercent = todayTotal > 0 ? ((todayProfit / todayTotal) * 100).toFixed(2) : "0.00";

  const holdings = data?.holdings || [];

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500 font-sans text-slate-800">
      
      <div className="px-4 text-slate-800">
        <h2 className="text-3xl font-black tracking-tighter">Hi, {userName}!</h2>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-2 opacity-60">Synchronized Portfolio Hub</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-2">
        <div className="md:col-span-2 bg-blue-600 text-white p-8 rounded-[2rem] shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[220px]">
          <div className="relative z-10">
            <div className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-2">個人總資產 (TOTAL BALANCE)</div>
            <div className="text-5xl font-black tracking-tighter flex items-baseline gap-2">
              ${todayTotal.toLocaleString()} 
              <span className="text-sm font-bold opacity-60 font-mono">TWD</span>
            </div>
          </div>
          
          <div className="relative z-10 mt-6">
             <div className="inline-flex items-center gap-2 bg-black/10 px-4 py-2 rounded-xl border border-white/5 backdrop-blur-sm">
                <TrendingUp className="w-4 h-4 text-red-400" />
                <span className="text-xs font-black uppercase">今日收益: <span className="text-red-400">+{profitPercent}%</span></span>
             </div>
          </div>

          <PieChart className="absolute -right-6 -bottom-6 w-40 h-48 opacity-10 text-white rotate-12" />
        </div>

        <div className="bg-white border border-slate-200 p-8 rounded-[2rem] shadow-sm flex flex-col justify-between min-h-[220px]">
           <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">累計損益 (TOTAL P/L)</div>
              <div className={`text-4xl font-black tracking-tighter ${unrealizedPnL >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                {unrealizedPnL >= 0 ? '+' : ''}${unrealizedPnL.toLocaleString()}
              </div>
           </div>
           <div className="text-[9px] text-slate-400 font-black leading-relaxed italic uppercase opacity-60">
              Heartbeat Sync Enabled: Tick {tick % 30}/30
           </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden mx-2 text-slate-800">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-black text-lg tracking-tight flex items-center gap-2 text-slate-800">
            <Building2 className="w-5 h-5" />
            實時持倉明細 (Live Holdings)
          </h3>
          <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest border border-slate-100 px-3 py-1 rounded-lg">Database Linked</span>
        </div>
        
        <div className="divide-y divide-slate-50 text-slate-800">
          {holdings.length > 0 ? holdings.map((item: any) => (
            <div key={item.id} className="p-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 border border-slate-200/50 shadow-inner">
                   <img src={item.main_image} alt={item.title} className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="font-black text-sm text-slate-800">{item.title}</div>
                  <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">{item.token_symbol} // {parseFloat(item.balance).toLocaleString()} Tokens</div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-sm font-black text-slate-800">${parseFloat(item.current_price).toLocaleString()}</div>
                <div className="text-[10px] font-black text-red-500 mt-1 uppercase italic tracking-tighter">
                   Valuation: ${(parseFloat(item.balance) * parseFloat(item.current_price)).toLocaleString()}
                </div>
              </div>
            </div>
          )) : (
            <div className="p-24 text-center text-slate-300">
                <Loader2 className={`w-8 h-8 mx-auto mb-4 opacity-20 ${isLoading ? 'animate-spin' : ''}`} />
                <div className="font-black text-[10px] uppercase tracking-[0.3em] opacity-40">Awaiting Database Response</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
