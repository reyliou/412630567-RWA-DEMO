import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { TransactionSuccessModal } from "./TransactionSuccessModal";

interface OrderEntryFormProps {
  userId: number;
  property: any;
}

export function OrderEntryForm({ userId, property }: OrderEntryFormProps) {
  const { apiFetch } = useAuth();
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [tokenAmount, setTokenAmount] = useState("");
  const [limitTokenPrice, setLimitTokenPrice] = useState("");
  const [txType, setTxType] = useState<"BUY" | "SELL">("BUY");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);

  const totalTwdValue = parseFloat(tokenAmount || "0") * (orderType === "market" ? property.price : parseFloat(limitTokenPrice || "0"));

  const confirmOrder = async () => {
    setIsConfirmOpen(false);
    try {
      const amount = parseFloat(tokenAmount);
      const price = orderType === 'market' ? property.price : parseFloat(limitTokenPrice);
      if (isNaN(amount) || amount <= 0) return alert("請輸入有效的數量");
      if (orderType === 'limit' && (isNaN(price) || price <= 0)) return alert("請輸入有效的限價");

      const response = await apiFetch(`/api/transactions`, {
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
      
      const data = await response.json();
      if (response.ok && data.success) {
        setIsSuccessOpen(true);
      } else {
        alert(data.message || "交易失敗");
      }
    } catch (e) { 
      alert("連線後端 API 失敗"); 
    }
  };

  return (
    <>
      <div className="bg-white border rounded-[3rem] p-10 shadow-2xl flex flex-col ring-1 ring-slate-100">
        <h3 className="font-black text-2xl mb-8 border-b pb-4 uppercase">Trading HUB</h3>
        
        <div className="flex bg-slate-100 p-2 rounded-[1.5rem] mb-10">
          <button onClick={() => setOrderType("market")} className={`flex-1 py-4 rounded-2xl text-xs font-black uppercase transition-all ${orderType === 'market' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>市價委託</button>
          <button onClick={() => setOrderType("limit")} className={`flex-1 py-4 rounded-2xl text-xs font-black uppercase transition-all ${orderType === 'limit' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>限價排隊</button>
        </div>

        <div className="space-y-6 mb-12">
          {orderType === "limit" && (
            <div className="space-y-2 animate-in slide-in-from-top-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Target Price (TWD)</label>
              <div className="relative">
                <span className="absolute left-6 top-6 text-xl text-slate-400 font-black">$</span>
                <input 
                  type="number" 
                  value={limitTokenPrice} 
                  onChange={(e) => setLimitTokenPrice(e.target.value)} 
                  placeholder={property.price.toString()}
                  className="w-full pl-12 pr-8 py-6 bg-slate-50 border border-slate-100 focus:border-blue-200 focus:ring-4 focus:ring-blue-100 rounded-[2rem] text-3xl outline-none font-mono font-black text-blue-600 transition-all" 
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Amount (Tokens)</label>
            <input 
              type="number" 
              value={tokenAmount} 
              onChange={(e) => setTokenAmount(e.target.value)} 
              placeholder="0"
              className="w-full px-8 py-6 bg-slate-50 border border-slate-100 focus:border-blue-200 focus:ring-4 focus:ring-blue-100 rounded-[2rem] text-4xl outline-none font-mono font-black text-slate-800 transition-all" 
            />
          </div>
          
          <div className="flex justify-between px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
             <span className="text-xs font-bold text-slate-400 uppercase">預估總額 (Est. Value)</span>
             <span className="font-mono font-black text-slate-800">${totalTwdValue.toLocaleString()} TWD</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <button onClick={() => { setTxType("BUY"); setIsConfirmOpen(true); }} className="py-6 bg-red-600 hover:bg-red-700 text-white rounded-[2rem] uppercase font-black shadow-xl shadow-red-200 transition-all active:scale-95 text-lg">申購 BUY</button>
          <button onClick={() => { setTxType("SELL"); setIsConfirmOpen(true); }} className="py-6 bg-green-600 hover:bg-green-700 text-white rounded-[2rem] uppercase font-black shadow-xl shadow-green-200 transition-all active:scale-95 text-lg">委賣 SELL</button>
        </div>
      </div>

      {isConfirmOpen && (
        <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white rounded-[3rem] p-10 max-w-sm w-full shadow-2xl animate-in zoom-in-95">
              <div className="flex flex-col items-center text-center mb-8">
                 <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center mb-6 shadow-xl ${txType === 'BUY' ? 'bg-red-600 text-white shadow-red-200' : 'bg-green-600 text-white shadow-green-200'}`}>
                    <ShieldAlert className="w-10 h-10" />
                 </div>
                 <h3 className="text-3xl font-black uppercase tracking-tighter text-slate-800">委託確認</h3>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{orderType === 'market' ? 'Instant Execution' : 'Async 10s Queue'}</p>
              </div>
              <div className="space-y-4 bg-slate-50 p-6 rounded-2xl mb-8 border border-slate-100">
                 <div className="flex justify-between items-center text-xs font-black uppercase text-slate-500">
                    <span>類型</span>
                    <span className={`px-3 py-1 rounded-lg ${txType === 'BUY' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>{txType === 'BUY' ? '買入' : '賣出'} {orderType === 'market' ? '(市價)' : '(限價)'}</span>
                 </div>
                 <div className="flex justify-between items-center text-xs font-black uppercase text-slate-500">
                    <span>數量</span>
                    <span className="font-mono text-base text-slate-800">{parseFloat(tokenAmount || '0').toLocaleString()} 枚</span>
                 </div>
                 <div className="flex justify-between items-center text-xs font-black uppercase text-slate-500 border-t border-slate-200 pt-4">
                    <span>總計金額</span>
                    <span className="font-mono text-xl text-blue-600">${totalTwdValue.toLocaleString()} TWD</span>
                 </div>
              </div>
              <div className="flex gap-4">
                 <button onClick={() => setIsConfirmOpen(false)} className="flex-1 py-5 bg-slate-100 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-2xl font-black uppercase transition-colors">取消</button>
                 <button onClick={confirmOrder} className={`flex-[2] py-5 rounded-2xl text-white font-black uppercase shadow-xl transition-all active:scale-95 ${txType === 'BUY' ? 'bg-red-600 hover:bg-red-700 shadow-red-200' : 'bg-green-600 hover:bg-green-700 shadow-green-200'}`}>確認下單</button>
              </div>
           </div>
        </div>
      )}

      <TransactionSuccessModal 
        isOpen={isSuccessOpen} 
        onClose={() => setIsSuccessOpen(false)} 
        type={txType} 
        orderType={orderType} 
        tokenAmount={tokenAmount} 
        price={orderType === 'market' ? property.price : parseFloat(limitTokenPrice || '0')} 
        propertyName={property.name} 
      />
    </>
  );
}
