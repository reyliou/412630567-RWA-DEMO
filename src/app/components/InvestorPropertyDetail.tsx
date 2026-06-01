import { ArrowLeft, TrendingUp, TrendingDown, Clock, Info, ChevronRight, BarChart3, Coins, Wallet, Trash2, ShieldAlert, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { TransactionSuccessModal } from "./TransactionSuccessModal";
import { OrderBook } from "./OrderBook";
import { API_BASE_URL } from "../config";

interface PropertyDetailProps {
  userId: number;
  property: {
    id: number;
    name: string;
    price: number;
    change: string;
    yesterday_close_price?: number;
    total_supply?: number;
    token_symbol?: string;
  };
  onBack: () => void;
}

export function InvestorPropertyDetail({ userId, property, onBack }: PropertyDetailProps) {
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [tokenAmount, setTokenAmount] = useState("");
  const [limitTokenPrice, setLimitTokenPrice] = useState(property.price.toString());
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [txType, setTxType] = useState<"BUY" | "SELL">("BUY");
  const [vLogs, setVLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [marketStats, setMarketStats] = useState({ high: 0, low: 0 });

  useEffect(() => {
    const base = property.price;
    setMarketStats({ high: +(base * 1.02).toFixed(2), low: +(base * 0.98).toFixed(2) });
  }, [property.price]);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/properties/${property.id}/valuation-logs`);
        if (response.ok) {
          const res = await response.json();
          setVLogs(res);
        }
      } catch (e) { console.error("Logs sync failed"); } finally { setIsLoadingLogs(false); }
    };
    fetchLogs();
  }, [property.id]);

  const totalTwdValue = parseFloat(tokenAmount || "0") * (orderType === "market" ? property.price : parseFloat(limitTokenPrice || "0"));

  const confirmOrder = async () => {
    setIsConfirmOpen(false);
    try {
      const amount = parseFloat(tokenAmount);
      const price = orderType === 'market' ? property.price : parseFloat(limitTokenPrice);
      if (isNaN(amount) || amount <= 0) return alert("請輸入數量");

      const response = await fetch(`${API_BASE_URL}/api/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, property_id: property.id, tx_type: txType, order_type: orderType.toUpperCase(), token_amount: amount, price_per_token: price })
      });
      if (response.ok) setIsSuccessOpen(true);
      else alert("交易失敗");
    } catch (e) { alert("連線失敗"); }
  };

  const chartBars = vLogs.length > 0 ? vLogs.map(l => parseFloat(l.market_value_k)) : [40, 65, 50, 80, 55, 90, 70, 85, 65, 50, 75];

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in duration-300 pb-20 text-slate-800 font-black">
      {isConfirmOpen && (
        <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white rounded-[2.5rem] p-10 max-w-sm w-full shadow-2xl">
              <div className="flex flex-col items-center text-center mb-8">
                 <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${txType === 'BUY' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}><ShieldAlert className="w-8 h-8" /></div>
                 <h3 className="text-2xl font-black uppercase">委託確認</h3>
              </div>
              <div className="space-y-4 bg-slate-50 p-6 rounded-2xl mb-8">
                 <div className="flex justify-between text-[10px] uppercase text-slate-400"><span>類型</span><span className={txType === 'BUY' ? 'text-red-600' : 'text-green-600'}>{orderType}</span></div>
                 <div className="flex justify-between text-sm uppercase"><span>總計</span><span>${totalTwdValue.toLocaleString()} TWD</span></div>
              </div>
              <div className="flex gap-3">
                 <button onClick={() => setIsConfirmOpen(false)} className="flex-1 py-4 bg-slate-100 rounded-xl">取消</button>
                 <button onClick={confirmOrder} className={`flex-[2] py-4 rounded-xl text-white ${txType === 'BUY' ? 'bg-red-600' : 'bg-green-600'}`}>確認下單</button>
              </div>
           </div>
        </div>
      )}
      <div className="flex items-center justify-between mb-8 px-4">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-blue-600"><ArrowLeft className="w-5 h-5" /> Back</button>
        <span className="text-[10px] uppercase text-blue-500 bg-blue-50 px-5 py-2 rounded-full italic border border-blue-100">Live API Link: {API_BASE_URL}</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 px-4">
        <div className="lg:col-span-8 space-y-10">
          <div className="bg-white border border-border rounded-[3rem] p-10 shadow-sm">
            <h2 className="text-5xl font-black tracking-tighter mb-4">{property.name}</h2>
            <div className="flex items-center gap-8 mb-10">
               <div className="flex flex-col"><span className="text-[10px] text-slate-400 uppercase tracking-widest">Price</span><span className="font-mono text-blue-600 text-5xl tracking-tighter">${property.price}</span></div>
            </div>
            <div className="aspect-[21/9] bg-slate-950 rounded-[2.5rem] relative flex items-end p-8 gap-2 overflow-hidden">
               {chartBars.map((h, i) => (<div key={i} className="flex-1 bg-blue-500/20 border-t-2 border-blue-400/50" style={{ height: `${(h / 100) * 100}%` }} />))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-6">
             <div className="bg-white border p-8 rounded-[2rem] text-center shadow-sm"><div className="text-xs text-slate-400 uppercase mb-2">High</div><div className="text-3xl text-red-500">${marketStats.high}</div></div>
             <div className="bg-white border p-8 rounded-[2rem] text-center shadow-sm"><div className="text-xs text-slate-400 uppercase mb-2">Low</div><div className="text-3xl text-green-500">${marketStats.low}</div></div>
             <div className="bg-white border p-8 rounded-[2rem] text-center shadow-sm"><div className="text-xs text-slate-400 uppercase mb-2">Base</div><div className="text-3xl text-slate-800">${((property.price * 100000)/10000).toLocaleString()}萬</div></div>
          </div>
        </div>
        <div className="lg:col-span-4 space-y-8">
          <div className="bg-white border rounded-[3rem] p-10 shadow-2xl flex flex-col ring-1 ring-slate-100">
            <h3 className="font-black text-2xl mb-8 border-b pb-4 uppercase">Trading HUB</h3>
            <div className="flex bg-slate-100 p-2 rounded-[1.5rem] mb-10">
              <button onClick={() => setOrderType("market")} className={`flex-1 py-4 rounded-2xl text-xs font-black uppercase ${orderType === 'market' ? 'bg-white text-blue-600' : 'text-slate-400'}`}>市價</button>
              <button onClick={() => setOrderType("limit")} className={`flex-1 py-4 rounded-2xl text-xs font-black uppercase ${orderType === 'limit' ? 'bg-white text-blue-600' : 'text-slate-400'}`}>限價</button>
            </div>
            <div className="space-y-10 mb-12">
               <label className="text-[10px] text-slate-400 uppercase ml-2">Tokens</label>
               <input type="number" value={tokenAmount} onChange={(e) => setTokenAmount(e.target.value)} className="w-full px-8 py-6 bg-slate-50 rounded-[2rem] text-4xl outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-6">
              <button onClick={() => { setTxType("BUY"); setIsConfirmOpen(true); }} className="py-6 bg-red-600 text-white rounded-3xl uppercase font-black shadow-lg">申購</button>
              <button onClick={() => { setTxType("SELL"); setIsConfirmOpen(true); }} className="py-6 bg-green-600 text-white rounded-3xl uppercase font-black shadow-lg">委賣</button>
            </div>
          </div>
          <OrderBook onPriceSelect={(p) => { setOrderType("limit"); setLimitTokenPrice(p.toString()); }} />
        </div>
      </div>
      <TransactionSuccessModal isOpen={isSuccessOpen} onClose={() => setIsSuccessOpen(false)} type={txType} orderType={orderType} tokenAmount={tokenAmount} price={parseFloat(limitTokenPrice)} propertyName={property.name} />
    </div>
  );
}
