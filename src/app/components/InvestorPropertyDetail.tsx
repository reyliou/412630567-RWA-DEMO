import { ArrowLeft, TrendingUp, TrendingDown, Clock, Info, ChevronRight, BarChart3, Coins, Wallet, Trash2, ShieldAlert, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { TransactionSuccessModal } from "./TransactionSuccessModal";
import { OrderBook } from "./OrderBook";

interface PendingOrder {
  id: string;
  type: "BUY" | "SELL";
  price: number;
  amount: number;
  time: string;
}

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
        const response = await fetch(`http://localhost:3001/api/properties/${property.id}/valuation-logs`);
        if (response.ok) {
          const res = await response.json();
          setVLogs(res);
        }
      } catch (e) {
        console.error("無法加載歷史估值");
      } finally {
        setIsLoadingLogs(false);
      }
    };
    fetchLogs();
  }, [property.id]);

  const totalTwdValue = parseFloat(tokenAmount || "0") * (orderType === "market" ? property.price : parseFloat(limitTokenPrice || "0"));
  const totalTwdFormatted = totalTwdValue.toLocaleString();

  const handlePriceFromBook = (price: number) => {
    setOrderType("limit");
    setLimitTokenPrice(price.toString());
  };

  const confirmOrder = async () => {
    setIsConfirmOpen(false);
    try {
      const amount = parseFloat(tokenAmount);
      const price = orderType === 'market' ? property.price : parseFloat(limitTokenPrice);
      
      if (isNaN(amount) || amount <= 0) {
        alert("請輸入有效的代幣數量");
        return;
      }

      const response = await fetch('http://localhost:3001/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId, 
          property_id: property.id,
          tx_type: txType,
          order_type: orderType.toUpperCase(),
          token_amount: amount,
          price_per_token: price
        })
      });

      if (response.ok) {
        // 限價單不應立即刷新資產，讓後端 10 秒後處理
        setIsSuccessOpen(true); 
      } else {
        const errorData = await response.json();
        alert("交易失敗: " + (errorData.error || "資料庫寫入失敗"));
      }
    } catch (e) { 
      alert("無法連接交易伺服器"); 
    }
  };

  const chartBars = vLogs.length > 0 
    ? vLogs.map(l => parseFloat(l.market_value_k))
    : [40, 65, 50, 80, 55, 90, 70, 85, 65, 50, 75, 60, 40, 95, 100, 80, 60, 70, 45, 90, 55, 75, 40, 60, 80];

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-right-4 duration-300 pb-20 text-slate-800">
      
      {isConfirmOpen && (
        <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white rounded-[2.5rem] p-10 max-w-sm w-full shadow-2xl animate-in zoom-in-95">
              <div className="flex flex-col items-center text-center mb-8">
                 <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${txType === 'BUY' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                    <ShieldAlert className="w-8 h-8" />
                 </div>
                 <h3 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">委託確認</h3>
              </div>
              <div className="space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-8 text-slate-800 font-sans">
                 <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase"><span>類型</span><span className={txType === 'BUY' ? 'text-red-600' : 'text-green-600'}>{orderType === 'market' ? '現買 (Spot)' : '限價 (Limit)'}</span></div>
                 <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase"><span>價格</span><span className="text-slate-800 font-black">${orderType === 'market' ? property.price : limitTokenPrice}</span></div>
                 <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase"><span>數量</span><span className="text-slate-800 font-black">{tokenAmount} Tokens</span></div>
                 <div className="h-px bg-slate-200" />
                 <div className="flex justify-between text-sm font-black text-slate-800 uppercase tracking-tighter"><span>總計</span><span>${totalTwdValue.toLocaleString()} TWD</span></div>
              </div>
              <div className="flex gap-3">
                 <button onClick={() => setIsConfirmOpen(false)} className="flex-1 py-4 bg-slate-100 rounded-xl font-black text-xs text-slate-400 uppercase">取消</button>
                 <button onClick={confirmOrder} className={`flex-[2] py-4 rounded-xl font-black text-xs text-white uppercase shadow-lg ${txType === 'BUY' ? 'bg-red-600 shadow-red-200' : 'bg-green-600 shadow-green-200'}`}>確認下單</button>
              </div>
           </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-8 px-4">
        <button onClick={onBack} className="flex items-center gap-2 text-base font-black text-slate-400 hover:text-blue-600 transition-colors uppercase tracking-tighter italic">
          <ArrowLeft className="w-5 h-5" /> Back to Market
        </button>
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500 bg-blue-50 px-5 py-2 rounded-full border border-blue-100 italic">Audit Trace: User {userId}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 px-4">
        
        <div className="lg:col-span-8 space-y-10 font-sans">
          <div className="bg-white border border-border rounded-[3rem] p-10 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
              <div>
                <h2 className="text-5xl font-black tracking-tighter text-slate-800">{property.name}</h2>
                <div className="flex items-center gap-8 mt-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">當前行情 K 值</span>
                    <span className="font-mono font-black text-blue-600 text-5xl tracking-tighter">${property.price}</span>
                  </div>
                  <div className="flex flex-col items-start h-full self-end pb-1 border-l border-slate-100 pl-6 space-y-1">
                    <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none">Yesterday Close</div>
                    <div className="text-lg font-black text-slate-400 tracking-tighter italic leading-none">${property.yesterday_close_price || (property.price * 0.98).toFixed(2)}</div>
                  </div>
                </div>
              </div>
              <div className="flex bg-slate-100 p-2 rounded-[1.5rem] gap-1">
                {["1D", "1W", "1M"].map(t => (
                  <button key={t} className={`px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${t === '1D' ? 'bg-white shadow-xl text-blue-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}>{t}</button>
                ))}
              </div>
            </div>

            <div className="aspect-[21/9] bg-slate-950 rounded-[2.5rem] relative flex items-end p-8 gap-2 overflow-hidden border border-slate-800 mb-8 shadow-inner">
               <div className="absolute inset-0 flex items-center justify-center opacity-5"><BarChart3 className="w-48 h-48 text-white" /></div>
               {isLoadingLogs ? (
                 <div className="absolute inset-0 flex items-center justify-center text-white/20 italic font-black uppercase text-xs tracking-widest animate-pulse">正在與 RWA 節點同步估值紀錄...</div>
               ) : (
                 chartBars.map((h, i) => (
                   <div key={i} className={`flex-1 border-t-2 rounded-t-sm bg-blue-500/20 border-blue-400/50`} style={{ height: `${(h / Math.max(...chartBars)) * 100}%` }} />
                 ))
               )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="bg-white border border-border p-8 rounded-[2rem] text-center shadow-sm">
                <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">今日最高 (High)</div>
                <div className="text-3xl font-mono font-black text-red-500 tracking-tighter">${marketStats.high}</div>
             </div>
             <div className="bg-white border border-border p-8 rounded-[2rem] text-center shadow-sm">
                <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">今日最低 (Low)</div>
                <div className="text-3xl font-mono font-black text-green-500 tracking-tighter">${marketStats.low}</div>
             </div>
             <div className="bg-white border border-border p-8 rounded-[2rem] text-center shadow-sm text-slate-800">
                <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 font-black">房屋總價值 (Base)</div>
                <div className="text-3xl font-black text-slate-800 tracking-tighter">${((property.price * (property.total_supply || 100000)) / 10000).toLocaleString()}萬</div>
             </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-8 font-sans">
          <div className="bg-white border border-border rounded-[3rem] p-10 shadow-2xl flex flex-col ring-1 ring-slate-100 text-slate-800">
            <h3 className="font-black text-2xl mb-8 border-b border-slate-50 pb-4 uppercase tracking-tighter text-slate-800">交易面板 (HUB)</h3>
            <div className="flex bg-slate-100 p-2 rounded-[1.5rem] mb-10">
              <button onClick={() => setOrderType("market")} className={`flex-1 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${orderType === 'market' ? 'bg-white shadow-xl text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>市價交易</button>
              <button onClick={() => setOrderType("limit")} className={`flex-1 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${orderType === 'limit' ? 'bg-white shadow-xl text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>限價委託</button>
            </div>
            
            <div className="space-y-10 mb-12">
              {orderType === "market" ? (
                /* 市價：僅數量 */
                <div className="animate-in fade-in zoom-in-95 duration-200">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">購買數量 (TOKENS)</label>
                  <div className="relative mt-3">
                    <input type="number" placeholder="0" value={tokenAmount} onChange={(e) => setTokenAmount(e.target.value)} className="w-full px-8 py-6 bg-slate-50 border-none rounded-[2rem] font-mono font-black text-4xl outline-none focus:ring-4 focus:ring-blue-600/10 transition-all text-slate-800" />
                    <span className="absolute right-8 top-7 text-xs font-black opacity-20 uppercase tracking-widest">Tokens</span>
                  </div>
                  <div className="flex justify-between mt-6 px-3 items-end">
                    <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">預估支出金額:</span>
                    <span className="text-2xl font-mono font-black text-blue-600">${totalTwdFormatted} <span className="text-xs text-slate-800">TWD</span></span>
                  </div>
                </div>
              ) : (
                /* 限價：單價 + 數量 */
                <div className="space-y-8 animate-in fade-in zoom-in-95 duration-200">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">委託代幣單價 (TOKEN PRICE)</label>
                    <div className="relative mt-3">
                      <input type="number" value={limitTokenPrice} onChange={(e) => setLimitTokenPrice(e.target.value)} className="w-full px-8 py-6 bg-slate-50 border-none rounded-[2rem] font-mono font-black text-4xl outline-none focus:ring-4 focus:ring-blue-600/10 transition-all text-blue-600 shadow-sm" />
                      <span className="absolute right-8 top-7 text-[8px] font-black opacity-20 uppercase leading-none text-right">TWD /<br/>Token</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">購買數量 (QUANTITY)</label>
                    <div className="relative mt-3">
                      <input type="number" placeholder="0" value={tokenAmount} onChange={(e) => setTokenAmount(e.target.value)} className="w-full px-8 py-6 bg-slate-50 border-none rounded-[2rem] font-mono font-black text-4xl outline-none focus:ring-4 focus:ring-blue-600/10 transition-all text-slate-800 shadow-sm" />
                      <span className="absolute right-8 top-7 text-xs font-black opacity-20 uppercase tracking-widest">Tokens</span>
                    </div>
                  </div>
                  <div className="p-6 bg-blue-600 text-white rounded-[2rem] flex justify-between items-center shadow-2xl shadow-blue-200 border border-blue-500">
                    <span className="text-xs font-black uppercase tracking-[0.2em] opacity-80">總交易金額預估</span>
                    <span className="text-3xl font-mono font-black">${totalTwdFormatted} <span className="text-xs">TWD</span></span>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-6 mt-auto">
              <button onClick={() => { setTxType("BUY"); setIsConfirmOpen(true); }} className="py-6 bg-red-600 hover:bg-red-700 text-white rounded-3xl font-black uppercase tracking-widest shadow-xl shadow-red-200 transition-all active:scale-95 text-lg">申購</button>
              <button onClick={() => { setTxType("SELL"); setIsConfirmOpen(true); }} className="py-6 bg-green-600 hover:bg-green-700 text-white rounded-3xl font-black uppercase tracking-widest shadow-xl shadow-green-200 transition-all active:scale-95 text-lg">委賣</button>
            </div>
          </div>
          <OrderBook onPriceSelect={handlePriceFromBook} />
        </div>
      </div>

      <TransactionSuccessModal 
        isOpen={isSuccessOpen}
        onClose={() => setIsSuccessOpen(false)}
        type={txType}
        orderType={orderType}
        tokenAmount={tokenAmount}
        price={orderType === "market" ? property.price : parseFloat(limitTokenPrice)}
        propertyName={property.name}
      />
    </div>
  );
}
