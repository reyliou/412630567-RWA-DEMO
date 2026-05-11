import { Wallet, TrendingUp, Building2, PieChart, ArrowUpRight, Clock, TrendingDown } from "lucide-react";

interface InvestorPortfolioProps {
  userName: string;
}

export function InvestorPortfolio({ userName }: InvestorPortfolioProps) {
  const todayTotal = 42678391;
  const todayProfit = 12450;
  const profitPercent = 0.03;
  const unrealizedPnL = 5482913;

  const holdings = [
    { id: 1, name: "Hi-City 淡水建案", price: 1.37, amount: 1200, profit: 540, trend: "up" },
    { id: 2, name: "台北 101 周邊商辦", price: 2207, amount: 14, profit: -120, trend: "down" },
    { id: 3, name: "台中七期高級住宅", price: 850, amount: 50, profit: 2100, trend: "up" },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      
      <div className="px-4">
        <h2 className="text-3xl font-black text-slate-800 tracking-tighter">Hi, {userName}!</h2>
        <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-1 opacity-60">Portfolio Summary</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-2">
        <div className="md:col-span-2 bg-blue-600 text-white p-8 rounded-[2rem] shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[220px]">
          <div className="relative z-10">
            <div className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-2">個人總資產 (TOTAL BALANCE)</div>
            <div className="text-5xl font-black tracking-tighter flex items-baseline gap-2">
              ${todayTotal.toLocaleString()} 
              <span className="text-sm font-bold opacity-60">TWD</span>
            </div>
          </div>
          
          <div className="relative z-10 mt-6">
             <div className="inline-flex items-center gap-2 bg-black/10 px-4 py-2 rounded-xl border border-white/5 backdrop-blur-sm">
                {/* 台灣股市：漲用紅色 */}
                <TrendingUp className="w-4 h-4 text-red-400" />
                <span className="text-xs font-black">今日收益: <span className="text-red-400">+${todayProfit.toLocaleString()} ({profitPercent}%)</span></span>
             </div>
          </div>

          <PieChart className="absolute -right-6 -bottom-6 w-40 h-48 opacity-10 text-white rotate-12" />
        </div>

        <div className="bg-white border border-slate-200 p-8 rounded-[2rem] shadow-sm flex flex-col justify-between min-h-[220px]">
           <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">未實現損益 (UNREALIZED P/L)</div>
              {/* 台灣股市：正盈餘用紅色 */}
              <div className="text-4xl font-black text-red-500 tracking-tighter">
                +${unrealizedPnL.toLocaleString()}
              </div>
           </div>
           <div className="text-[10px] text-slate-400 font-bold leading-relaxed italic">
              根據所有持倉代幣當前市價計算
           </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden mx-2">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-black text-lg tracking-tight flex items-center gap-2 text-slate-800">
            <Building2 className="w-5 h-5 text-slate-800" />
            我的持倉 (My Holdings)
          </h3>
          <button className="text-xs font-black text-slate-800 hover:underline">查看全部記錄</button>
        </div>
        
        <div className="divide-y divide-slate-50">
          {holdings.map((item) => (
            <div key={item.id} className="p-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 border border-slate-200/50">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-black text-sm text-slate-800">{item.name}</div>
                  <div className="text-[10px] font-bold text-slate-400 mt-0.5">持有: {item.amount.toLocaleString()} Tokens</div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-sm font-black text-slate-800">${item.price.toLocaleString()}</div>
                {/* 漲紅跌綠修正 */}
                <div className={`text-[10px] font-black flex items-center justify-end gap-0.5 mt-0.5 ${item.profit > 0 ? 'text-red-500' : 'text-green-500'}`}>
                   {item.profit > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                   {item.profit > 0 ? '+' : ''}${item.profit}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
