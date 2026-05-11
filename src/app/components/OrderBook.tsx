import { TrendingUp, TrendingDown } from "lucide-react";

interface OrderBookProps {
  onPriceSelect?: (price: number) => void; // 新增：回傳點選的價格
}

export function OrderBook({ onPriceSelect }: OrderBookProps) {
  const bids = [
    { price: 40.89, qty: 73, ratio: 40 },
    { price: 40.88, qty: 78, ratio: 45 },
    { price: 40.87, qty: 51, ratio: 30 },
    { price: 40.86, qty: 267, ratio: 70 },
    { price: 40.85, qty: 489, ratio: 95 },
  ];

  const asks = [
    { price: 40.90, qty: 54, ratio: 35 },
    { price: 40.91, qty: 31, ratio: 20 },
    { price: 40.92, qty: 37, ratio: 25 },
    { price: 40.93, qty: 46, ratio: 30 },
    { price: 40.94, qty: 6, ratio: 5 },
  ];

  return (
    <div className="bg-white border border-border rounded-[3rem] p-10 shadow-2xl flex flex-col ring-1 ring-slate-100">
      <h3 className="font-black text-2xl mb-8 tracking-tight text-slate-800 border-b border-slate-50 pb-4">
        市場委託單 (Order Book)
      </h3>

      <div className="mb-8 space-y-3">
        <div className="flex justify-between text-[11px] font-black uppercase tracking-widest px-1">
          <span className="text-red-600 font-bold">委買 85%</span>
          <span className="text-green-600 font-bold">委賣 15%</span>
        </div>
        <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
          <div className="h-full bg-red-500 transition-all duration-1000 shadow-[0_0_10px_rgba(239,68,68,0.3)]" style={{ width: '85%' }} />
          <div className="h-full bg-green-500 transition-all duration-1000 shadow-[0_0_10px_rgba(34,197,94,0.3)]" style={{ width: '15%' }} />
        </div>
        <div className="flex justify-between text-[10px] font-black text-slate-400 px-1 uppercase tracking-tighter">
          <span>Total Bids: 958</span>
          <span>Total Asks: 174</span>
        </div>
      </div>

      <div className="grid grid-cols-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-4 mb-4">
        <span>買量</span>
        <span className="col-span-2 text-slate-500">價格 (點擊填入)</span>
        <span>賣量</span>
      </div>

      <div className="space-y-1.5 text-slate-800">
        {bids.map((bid, i) => (
          <div key={i} className="grid grid-cols-4 items-center text-sm h-10 group">
            <div className="relative h-full flex items-center justify-start pl-3">
               <div className="absolute right-0 top-1 bottom-1 bg-red-50 rounded-l-lg transition-all border-r-2 border-red-200" style={{ width: `${bid.ratio}%` }} />
               <span className="relative z-10 font-mono font-black text-slate-600">{bid.qty}</span>
            </div>

            {/* 買價按鈕 */}
            <button 
              onClick={() => onPriceSelect?.(bid.price)}
              className="text-center font-black text-red-600 font-mono text-lg transition-all hover:scale-110 active:opacity-50 border-r border-slate-100 h-full"
            >
               {bid.price.toFixed(2)}
            </button>

            {/* 賣價按鈕 */}
            <button 
              onClick={() => onPriceSelect?.(asks[i].price)}
              className="text-center font-black text-green-600 font-mono text-lg transition-all hover:scale-110 active:opacity-50 h-full"
            >
               {asks[i].price.toFixed(2)}
            </button>

            <div className="relative h-full flex items-center justify-end pr-3">
               <div className="absolute left-0 top-1 bottom-1 bg-green-50 rounded-r-lg transition-all border-l-2 border-green-200" style={{ width: `${asks[i].ratio}%` }} />
               <span className="relative z-10 font-mono font-black text-slate-600">{asks[i].qty}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 pt-6 border-t border-slate-50 flex justify-center">
         <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] flex items-center gap-3">
            <div className="flex gap-1">
               <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
               <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse delay-75" />
            </div>
            Real-time Order Matching
         </div>
      </div>
    </div>
  );
}
