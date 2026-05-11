import { ArrowLeft, TrendingUp, TrendingDown, Clock, Info, ChevronRight, BarChart3, Coins, Wallet, Trash2, ShieldAlert } from "lucide-react";
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
  property: {
    id: number;
    name: string;
    price: number;
    change: string;
    size?: number;
    unit_price?: number;
    total_value?: number;
  };
  onBack: () => void;
}

export function InvestorPropertyDetail({ property, onBack }: PropertyDetailProps) {
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [tokenAmount, setTokenAmount] = useState("");
  const [limitTokenPrice, setLimitTokenPrice] = useState(property.price.toString());
  
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [txType, setTxType] = useState<"BUY" | "SELL">("BUY");
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [marketStats, setMarketStats] = useState({ high: 0, low: 0 });

  useEffect(() => {
    const base = property.price;
    setMarketStats({ high: +(base * 1.02).toFixed(2), low: +(base * 0.98).toFixed(2) });
  }, [property.price]);

  const totalTwdValue = parseFloat(tokenAmount || "0") * (orderType === "market" ? property.price : parseFloat(limitTokenPrice || "0"));
  const totalTwdFormatted = totalTwdValue.toLocaleString();

  const handlePriceFromBook = (price: number) => {
    setOrderType("limit");
    setLimitTokenPrice(price.toString());
  };

  const startOrderFlow = (type: "BUY" | "SELL") => {
    if (!tokenAmount || parseFloat(tokenAmount) <= 0) return;
    setTxType(type);
    setIsConfirmOpen(true);
  };

  const confirmOrder = () => {
    setIsConfirmOpen(false);
    if (orderType === "market") {
      setIsSuccessOpen(true);
    } else {
      const newOrder: PendingOrder = {
        id: `ORD-${Math.floor(Math.random() * 1000)}`,
        type: txType,
        price: parseFloat(limitTokenPrice),
        amount: parseFloat(tokenAmount),
        time: new Date().toLocaleTimeString(),
      };
      setPendingOrders([newOrder, ...pendingOrders]);
      setIsSuccessOpen(true); // 限價單也顯示「委託已送出」
    }
  };

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-right-4 duration-300 pb-20">
      
      {/* 委託確認彈窗 - 修正語義 */}
      {isConfirmOpen && (
        <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white rounded-[2.5rem] p-10 max-w-sm w-full shadow-2xl animate-in zoom-in-95">
              <div className="flex flex-col items-center text-center mb-8">
                 <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${txType === 'BUY' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                    <ShieldAlert className="w-8 h-8" />
                 </div>
                 <h3 className="text-2xl font-black text-slate-800">委託確認</h3>
                 <p className="text-sm text-slate-400 font-bold uppercase mt-1 tracking-widest italic">Confirm Your Order</p>
              </div>
              <div className="space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-8">
                 <div className="flex justify-between text-xs font-bold text-slate-500 uppercase">
                    <span>類型</span>
                    <span className={txType === 'BUY' ? 'text-red-600' : 'text-green-600'}>
                       {/* 修正語義：市價用現買/賣，限價用限價買/賣 */}
                       {orderType === 'market' 
                        ? (txType === 'BUY' ? '現買 (Spot)' : '現賣 (Spot)') 
                        : (txType === 'BUY' ? '限價買入 (Limit)' : '限價賣出 (Limit)')}
                    </span>
                 </div>
                 <div className="flex justify-between text-xs font-bold text-slate-500 uppercase"><span>單價</span><span className="text-slate-800 font-black">${orderType === 'market' ? property.price : limitTokenPrice}</span></div>
                 <div className="flex justify-between text-xs font-bold text-slate-500 uppercase"><span>數量</span><span className="text-slate-800 font-black">{tokenAmount} Tokens</span></div>
                 <div className="h-px bg-slate-200" />
                 <div className="flex justify-between text-sm font-black text-slate-800 uppercase"><span>總計</span><span>${totalTwdValue.toLocaleString()} TWD</span></div>
              </div>
              <div className="flex gap-3">
                 <button onClick={() => setIsConfirmOpen(false)} className="flex-1 py-4 bg-slate-100 rounded-xl font-black text-xs text-slate-400 hover:bg-slate-200 uppercase">取消</button>
                 <button onClick={confirmOrder} className={`flex-[2] py-4 rounded-xl font-black text-xs text-white uppercase shadow-lg ${txType === 'BUY' ? 'bg-red-600 shadow-red-200' : 'bg-green-600 shadow-green-200'}`}>確認下單</button>
              </div>
           </div>
        </div>
      )}

      {/* 頂部導覽 */}
      <div className="flex items-center justify-between mb-8 px-4 text-slate-800">
        <button onClick={onBack} className="flex items-center gap-2 text-base font-black text-slate-400 hover:text-blue-600 transition-colors">
          <ArrowLeft className="w-5 h-5" /> 返回房產市場
        </button>
        <span className="text-xs font-black uppercase tracking-widest text-blue-500 bg-blue-50 px-4 py-1.5 rounded-full border border-blue-100">Market Active</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 px-4">
        <div className="lg:col-span-8 space-y-10">
          <div className="bg-white border border-border rounded-[3rem] p-10 shadow-sm text-slate-800">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
              <div>
                <h2 className="text-5xl font-black tracking-tighter">{property.name}</h2>
                <div className="flex items-center gap-6 mt-4">
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Token Price</span>
                    <span className="font-mono font-black text-blue-600 text-5xl leading-tight">${property.price}</span>
                  </div>
                  <div className={`px-3 py-1.5 rounded-xl text-sm font-black flex items-center gap-1 self-end mb-1 ${property.change.startsWith('+') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                    {property.change}% {property.change.startsWith('+') ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  </div>
                </div>
              </div>
              <div className="flex bg-slate-100 p-2 rounded-[1.5rem] gap-1">
                {["1d", "1w", "1m"].map(t => (
                  <button key={t} className={`px-8 py-3 rounded-2xl text-sm font-black uppercase tracking-widest transition-all ${t === '1d' ? 'bg-white shadow-xl text-blue-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}>{t}</button>
                ))}
              </div>
            </div>
            <div className="aspect-[21/9] bg-slate-950 rounded-[2.5rem] relative flex items-end p-8 gap-2 overflow-hidden border border-slate-800 mb-8">
               <div className="absolute inset-0 flex items-center justify-center opacity-5"><BarChart3 className="w-48 h-48 text-white" /></div>
               {[40, 65, 50, 80, 55, 90, 70, 85, 65, 50, 75, 60, 40, 95, 100, 80, 60, 70, 45, 90, 55, 75, 40, 60, 80].map((h, i) => (
                 <div key={i} className={`flex-1 border-t-2 rounded-t-sm ${property.change.startsWith('+') ? 'bg-red-500/20 border-red-400/50' : 'bg-green-500/20 border-green-400/50'}`} style={{ height: `${h}%` }} />
               ))}
               <div className="absolute top-6 left-6 flex gap-4 text-[10px] font-mono font-black uppercase tracking-tighter text-white/60">
                  <span className="text-white/30">OPEN: {property.price}</span>
                  <span className="text-red-400">HIGH: {marketStats.high}</span>
                  <span className="text-green-400">LOW: {marketStats.low}</span>
               </div>
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
             <div className="bg-white border border-border p-8 rounded-[2rem] text-center shadow-sm">
                <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">房屋總價值 (Base)</div>
                <div className="text-3xl font-black text-slate-800 tracking-tighter">${((property.total_value || 0) / 10000).toFixed(1)}萬</div>
             </div>
          </div>

          <div className="bg-white border border-border rounded-[3rem] shadow-sm overflow-hidden text-slate-800">
             <div className="p-8 border-b border-border bg-slate-50/50 flex items-center justify-between">
                <h3 className="font-black text-xl text-slate-800 flex items-center gap-3">
                   <Clock className="w-6 h-6 text-blue-600" /> 當前委託中 (Pending Orders)
                </h3>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{pendingOrders.length} Orders</span>
             </div>
             {pendingOrders.length > 0 ? (
               <div className="divide-y divide-slate-100">
                  {pendingOrders.map(order => (
                    <div key={order.id} className="p-8 flex items-center justify-between hover:bg-slate-50 transition-all group">
                       <div className="flex items-center gap-6">
                          <div className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${order.type === 'BUY' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                             限價{order.type === 'BUY' ? '買入' : '賣出'}
                          </div>
                          <div className="space-y-1">
                             <div className="text-xl font-mono font-black text-slate-800">${order.price} <span className="text-xs text-slate-400 font-bold uppercase">TWD</span></div>
                             <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">數量: {order.amount} 枚 // {order.time}</div>
                          </div>
                       </div>
                       <button onClick={() => setPendingOrders(pendingOrders.filter(o => o.id !== order.id))} className="p-3 bg-slate-100 text-slate-400 rounded-xl hover:bg-red-50 hover:text-red-500 transition-all flex items-center gap-2 text-[10px] font-black uppercase">
                          <Trash2 className="w-4 h-4" /> 撤單
                       </button>
                    </div>
                  ))}
               </div>
             ) : (
               <div className="p-20 text-center text-slate-300 font-black text-sm uppercase tracking-widest italic opacity-50">暫無進行中的掛單</div>
             )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
          <div className="bg-white border border-border rounded-[3rem] p-10 shadow-2xl flex flex-col ring-1 ring-slate-100 text-slate-800">
            <h3 className="font-black text-2xl mb-8 border-b border-slate-50 pb-4 uppercase tracking-tighter text-slate-800">交易面板 (Trading HUB)</h3>
            <div className="flex bg-slate-100 p-2 rounded-[1.5rem] mb-10">
              <button onClick={() => setOrderType("market")} className={`flex-1 py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all ${orderType === 'market' ? 'bg-white shadow-xl text-blue-600' : 'text-slate-400'}`}>市價交易</button>
              <button onClick={() => setOrderType("limit")} className={`flex-1 py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all ${orderType === 'limit' ? 'bg-white shadow-xl text-blue-600' : 'text-slate-400'}`}>限價委託</button>
            </div>
            <div className="space-y-10 mb-12">
              {orderType === "market" ? (
                <div className="animate-in fade-in zoom-in-95 duration-200">
                  <label className="text-sm font-black text-slate-500 uppercase tracking-[0.1em] ml-2">購買數量 (TOKENS)</label>
                  <div className="relative mt-3">
                    <input type="number" placeholder="0" value={tokenAmount} onChange={(e) => setTokenAmount(e.target.value)} className="w-full px-8 py-6 bg-slate-50 border-none rounded-[2rem] font-mono font-black text-4xl outline-none focus:ring-4 focus:ring-blue-600/10 transition-all text-slate-800" />
                    <span className="absolute right-8 top-7 text-sm font-black opacity-20 uppercase tracking-widest text-slate-800">Tokens</span>
                  </div>
                  <div className="flex justify-between mt-6 px-3 items-end">
                    <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">預估支出金額:</span>
                    <span className="text-2xl font-mono font-black text-blue-600">${totalTwdFormatted} <span className="text-xs text-slate-800">TWD</span></span>
                  </div>
                </div>
              ) : (
                <div className="space-y-8 animate-in fade-in zoom-in-95 duration-200">
                  <div>
                    <label className="text-sm font-black text-slate-500 uppercase tracking-[0.1em] ml-2">委託價格 (TOKEN PRICE)</label>
                    <div className="relative mt-3">
                      <input type="number" value={limitTokenPrice} onChange={(e) => setLimitTokenPrice(e.target.value)} className="w-full px-8 py-6 bg-slate-50 border-none rounded-[2rem] font-mono font-black text-4xl outline-none focus:ring-4 focus:ring-blue-600/10 transition-all text-blue-600" />
                      <span className="absolute right-8 top-7 text-xs font-black opacity-20 uppercase text-slate-800">TWD / Token</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-black text-slate-500 uppercase tracking-[0.1em] ml-2">購買數量 (QUANTITY)</label>
                    <div className="relative mt-3">
                      <input type="number" placeholder="0" value={tokenAmount} onChange={(e) => setTokenAmount(e.target.value)} className="w-full px-8 py-6 bg-slate-50 border-none rounded-[2rem] font-mono font-black text-4xl outline-none focus:ring-4 focus:ring-blue-600/10 transition-all text-slate-800" />
                      <span className="absolute right-8 top-7 text-sm font-black opacity-20 uppercase text-slate-800">Tokens</span>
                    </div>
                  </div>
                  <div className="p-6 bg-blue-600 text-white rounded-[2rem] flex justify-between items-center shadow-2xl shadow-blue-300">
                    <span className="text-xs font-black uppercase tracking-[0.2em] opacity-80">總交易金額</span>
                    <span className="text-3xl font-mono font-black">${totalTwdFormatted} <span className="text-xs">TWD</span></span>
                  </div>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-6 mt-auto">
              <button onClick={() => startOrderFlow("BUY")} className="py-6 bg-red-600 hover:bg-red-700 text-white rounded-3xl font-black uppercase tracking-widest shadow-xl shadow-red-200 transition-all active:scale-95 text-xl tracking-widest">買入</button>
              <button onClick={() => startOrderFlow("SELL")} className="py-6 bg-green-600 hover:bg-green-700 text-white rounded-3xl font-black uppercase tracking-widest shadow-xl shadow-green-200 transition-all active:scale-95 text-xl tracking-widest">賣出</button>
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
