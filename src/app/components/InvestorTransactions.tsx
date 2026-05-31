import { ArrowUpRight, ArrowDownRight, Search, Filter, Calendar, History, Building2, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

interface Transaction {
  id: string;
  property_name: string;
  tx_type: "BUY" | "SELL";
  token_amount: string;
  price_per_token: string;
  status: string;
  created_at: string;
}

interface InvestorTransactionsProps {
  userId: number; // 接收真實用戶 ID
}

export function InvestorTransactions({ userId }: InvestorTransactionsProps) {
  const [timeFilter, setTimeRange] = useState("今日");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTx = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`http://localhost:3001/api/transactions/${userId}`);
        if (response.ok) {
          const data = await response.json();
          setTransactions(data);
        }
      } catch (e) {
        console.error("交易歷史同步失敗");
      } finally {
        setIsLoading(false);
      }
    };
    fetchTx();
  }, [userId]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 text-slate-800">
      
      {/* Filter Bar */}
      <div className="bg-white border border-border p-8 rounded-[3rem] shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
           <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <History className="w-6 h-6" />
           </div>
           <div>
              <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase font-sans">交易紀錄</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] italic">Database Audit History // UID: {userId}</p>
           </div>
        </div>

        <div className="flex bg-slate-100 p-2 rounded-[2rem] gap-1 font-sans">
          {["今日", "一周", "一個月"].map(t => (
            <button 
              key={t} 
              onClick={() => setTimeRange(t)}
              className={`px-8 py-3 rounded-2xl text-xs font-black transition-all uppercase tracking-widest ${timeFilter === t ? 'bg-white shadow-lg text-blue-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction Table */}
      <div className="bg-white border border-border rounded-[3rem] shadow-sm overflow-hidden ring-1 ring-slate-100 font-sans">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-border">
            <tr>
              <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">案名 (Property)</th>
              <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">類型</th>
              <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">數量 (Tokens)</th>
              <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">委託價格</th>
              <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">狀態 / 時間</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-800">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="p-20 text-center">
                   <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-slate-300" />
                   <div className="text-xs font-black text-slate-400 uppercase">正在抓取資料庫紀錄...</div>
                </td>
              </tr>
            ) : transactions.length > 0 ? transactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-10 py-8">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-all">
                       <Building2 className="w-5 h-5" />
                    </div>
                    <span className="font-black text-lg text-slate-800">{tx.property_name}</span>
                  </div>
                </td>
                <td className="px-10 py-8 text-center">
                  <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                    tx.tx_type === 'BUY' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'
                  }`}>
                    {tx.tx_type === 'BUY' ? '買入' : '賣出'}
                  </span>
                </td>
                <td className="px-10 py-8 text-center">
                   <div className="font-mono font-black text-lg text-slate-700">{parseFloat(tx.token_amount).toLocaleString()} 枚</div>
                </td>
                <td className="px-10 py-8 text-center">
                   <div className="font-mono font-black text-lg text-blue-600">${parseFloat(tx.price_per_token).toLocaleString()}</div>
                </td>
                <td className="px-10 py-8 text-right">
                   <div className="font-black text-xs text-slate-800 uppercase tracking-tighter">{tx.status}</div>
                   <div className="text-[10px] text-slate-400 font-bold mt-1 font-mono">{new Date(tx.created_at).toLocaleString()}</div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5} className="p-20 text-center text-slate-300 font-black text-sm uppercase tracking-widest italic opacity-50">尚無歷史交易數據</td>
              </tr>
            )}
          </tbody>
        </table>
        
        {/* Footer info */}
        <div className="p-8 bg-slate-50/50 border-t border-border flex justify-between items-center">
           <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] flex items-center gap-2">
              <Calendar className="w-4 h-4" /> 所有數據已同步至 RWA-BANK POSTGRES 稽核節點
           </p>
           <button className="text-[10px] font-black text-blue-600 hover:underline uppercase tracking-widest">下載完整 CSV 稽核報表</button>
        </div>
      </div>
    </div>
  );
}
