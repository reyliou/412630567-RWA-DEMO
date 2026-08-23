import { Wallet, TrendingUp, Building2, PieChart, ArrowUpRight, Clock, TrendingDown, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useHeartbeat } from "../context/SystemHeartbeatContext";
import { useAuth } from "../context/AuthContext";

export function InvestorPortfolio({ userId, userName }: { userId: number, userName: string }) {
  const { tick } = useHeartbeat();
  const { apiFetch } = useAuth();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPortfolio = async () => {
    try {
      const response = await apiFetch(`/api/portfolio/${userId}`);
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

  useEffect(() => {
    fetchPortfolio();
  }, [userId]);

  useEffect(() => {
    if (tick % 30 === 0) fetchPortfolio();
  }, [tick]);

  if (isLoading && !data) {
    return (
      <div className="p-40 flex flex-col items-center justify-center text-slate-300 gap-4">
        <Loader2 className="w-12 h-12 animate-spin opacity-20" />
        <span className="font-black text-xs uppercase tracking-[0.3em]">Synchronizing Assets...</span>
      </div>
    );
  }

  const cashBalance = parseFloat(data?.summary?.cash_balance ?? data?.summary?.total_asset_value ?? "0");
  const holdingsMarketValue = parseFloat(data?.summary?.holdings_market_value || "0");
  const totalNetWorth = parseFloat(data?.summary?.total_net_worth || String(cashBalance + holdingsMarketValue));
  const unrealizedPnL = parseFloat(data?.summary?.total_profit_loss || "0");
  const todayProfit = unrealizedPnL * 0.01;
  const profitPercent = totalNetWorth > 0 ? ((todayProfit / totalNetWorth) * 100).toFixed(2) : "0.00";
  const holdings = data?.holdings || [];

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500 font-sans text-slate-800 font-black">
      <div className="px-4">
        <h2 className="text-3xl font-black tracking-tighter uppercase italic">Account Dashboard</h2>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1 opacity-60">Welcome back, {userName}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-2">
        {/* 總資產淨值 */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-8 rounded-[2rem] shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[220px]">
          <div className="relative z-10">
            <div className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-2">帳戶總資產 (NET ASSET VALUE)</div>
            <div className="text-4xl font-black tracking-tighter flex items-baseline gap-2">
              ${totalNetWorth.toLocaleString()} 
              <span className="text-sm font-bold opacity-60 font-mono">TWD</span>
            </div>
          </div>
          <div className="relative z-10 mt-6">
             <div className="inline-flex items-center gap-2 bg-black/20 px-4 py-2 rounded-xl border border-white/10 backdrop-blur-sm">
                <PieChart className="w-4 h-4 text-blue-200" />
                <span className="text-xs font-black">現金 $${cashBalance.toLocaleString()} + 代幣 $${holdingsMarketValue.toLocaleString()}</span>
             </div>
          </div>
          <PieChart className="absolute -right-6 -bottom-6 w-40 h-48 opacity-10 text-white rotate-12" />
        </div>

        {/* 可用現金餘額 */}
        <div className="bg-white border border-slate-200 p-8 rounded-[2rem] shadow-sm flex flex-col justify-between min-h-[220px]">
           <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                <span>可用現金餘額 (CASH BALANCE)</span>
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
              </div>
              <div className="text-4xl font-black tracking-tighter text-slate-800">
                ${cashBalance.toLocaleString()}
                <span className="text-sm font-bold text-slate-400 font-mono ml-1">TWD</span>
              </div>
           </div>
           <div className="text-xs font-bold text-slate-400 mt-4 flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-green-600" />
              <span>可用於買入房產代幣或提領</span>
           </div>
        </div>

        {/* 房產持倉市值 */}
        <div className="bg-white border border-slate-200 p-8 rounded-[2rem] shadow-sm flex flex-col justify-between min-h-[220px]">
           <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                <span>房產持倉市值 (HOLDINGS VALUE)</span>
                <Building2 className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-4xl font-black tracking-tighter text-blue-600">
                ${holdingsMarketValue.toLocaleString()}
                <span className="text-sm font-bold text-slate-400 font-mono ml-1">TWD</span>
              </div>
           </div>
           <div className="text-xs font-bold text-slate-400 mt-4 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-blue-500" />
              <span>共持有 {holdings.length} 個房產建案代幣</span>
           </div>
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden mx-2 text-slate-800">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-black text-lg tracking-tight flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            持倉明細 (Live Portfolio)
          </h3>
          <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest border border-slate-100 px-3 py-1 rounded-lg">Real-time Verified</span>
        </div>
        <div className="divide-y divide-slate-50 text-slate-800">
          {holdings.length > 0 ? holdings.map((item: any) => (
            <div key={item.id} className="p-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 border border-slate-200/50">
                   <img src={item.main_image} alt={item.title} className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="font-black text-sm">{item.title}</div>
                  <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">{item.token_symbol} // {parseFloat(item.balance).toLocaleString()} 枚</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-black">${parseFloat(item.current_price).toLocaleString()}</div>
                <div className="text-[10px] font-black text-red-500 mt-1 uppercase italic tracking-tighter">
                   Valuation: ${(parseFloat(item.balance) * parseFloat(item.current_price)).toLocaleString()}
                </div>
              </div>
            </div>
          )) : (
            <div className="p-24 text-center text-slate-300">
                <div className="font-black text-[10px] uppercase tracking-[0.3em] opacity-40 italic">No Holdings Detected in Wallet</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
