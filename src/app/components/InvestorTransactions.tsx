import { ArrowUpRight, ArrowDownRight, Search, Filter, Calendar, History, Building2 } from "lucide-react";
import { useState } from "react";

interface Transaction {
  id: string;
  propertyName: string;
  type: "BUY" | "SELL";
  amount: number;
  price: number;
  status: "全部成交" | "處理中" | "已取消";
  date: string;
}

export function InvestorTransactions() {
  const [timeFilter, setTimeRange] = useState("今日");
  
  const transactions: Transaction[] = [
    { id: "TX1004", propertyName: "曉陽明2 奇岩欣境", type: "BUY", amount: 213, price: 17540.82, status: "全部成交", date: "2026-04-30 14:20" },
    { id: "TX1003", propertyName: "東騰元町", type: "BUY", amount: 3, price: 1822.5, status: "全部成交", date: "2026-04-28 09:15" },
    { id: "TX1002", propertyName: "中工雋詠", type: "SELL", amount: 2.5, price: 1795.6, status: "全部成交", date: "2026-04-25 16:40" },
    { id: "TX1001", propertyName: "潤泰之森", type: "BUY", amount: 5, price: 2102.5, status: "全部成交", date: "2026-04-20 11:30" },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Filter Bar - Based on your sample image */}
      <div className="bg-white border border-border p-8 rounded-[3rem] shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
           <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <History className="w-6 h-6" />
           </div>
           <div>
              <h2 className="text-3xl font-black text-slate-800 tracking-tighter">交易紀錄</h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Transaction History</p>
           </div>
        </div>

        <div className="flex bg-slate-100 p-2 rounded-[2rem] gap-1">
          {["今日", "一周", "一個月"].map(t => (
            <button 
              key={t} 
              onClick={() => setTimeRange(t)}
              className={`px-8 py-3 rounded-2xl text-sm font-black transition-all ${timeFilter === t ? 'bg-white shadow-lg text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction Table */}
      <div className="bg-white border border-border rounded-[3rem] shadow-sm overflow-hidden ring-1 ring-slate-100">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-border">
            <tr>
              <th className="px-10 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">案名 (Property)</th>
              <th className="px-10 py-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">類型</th>
              <th className="px-10 py-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">數量 (Tokens)</th>
              <th className="px-10 py-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">委託價格</th>
              <th className="px-10 py-6 text-xs font-black text-slate-400 uppercase tracking-widest text-right">狀態 / 時間</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {transactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-10 py-8">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-all">
                       <Building2 className="w-5 h-5" />
                    </div>
                    <span className="font-black text-xl text-slate-800">{tx.propertyName}</span>
                  </div>
                </td>
                <td className="px-10 py-8 text-center">
                  <span className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest ${
                    tx.type === 'BUY' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                  }`}>
                    {tx.type === 'BUY' ? '現買 (BUY)' : '現賣 (SELL)'}
                  </span>
                </td>
                <td className="px-10 py-8 text-center">
                   <div className="font-mono font-black text-xl text-slate-700">{tx.amount} 枚</div>
                </td>
                <td className="px-10 py-8 text-center">
                   <div className="font-mono font-black text-xl text-blue-600">${tx.price.toLocaleString()}</div>
                </td>
                <td className="px-10 py-8 text-right">
                   <div className="font-black text-sm text-slate-800">{tx.status}</div>
                   <div className="text-[10px] text-slate-400 font-bold mt-1 font-mono">{tx.date}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {/* Footer info */}
        <div className="p-8 bg-slate-50/50 border-t border-border flex justify-between items-center">
           <p className="text-xs text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2">
              <Calendar className="w-4 h-4" /> 所有數據已由 RWA 節點同步核對
           </p>
           <button className="text-xs font-black text-blue-600 hover:underline">下載完整 CSV 報表</button>
        </div>
      </div>
    </div>
  );
}
