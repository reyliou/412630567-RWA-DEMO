import { useState, useEffect } from "react";
import { ShieldAlert, Lock, AlertTriangle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSystemControl } from "../context/SystemControlContext";
import { TransactionSuccessModal } from "./TransactionSuccessModal";

interface OrderEntryFormProps {
  userId: number;
  property: any;
  selectedPrice?: number | null;
  onSuccess?: () => void;
}

export function OrderEntryForm({ userId, property, selectedPrice, onSuccess }: OrderEntryFormProps) {
  const { apiFetch, isWhitelisted, kycStatus } = useAuth();
  const { isPaused } = useSystemControl(); // 取得系統暫停狀態
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [tokenAmount, setTokenAmount] = useState("");
  const [limitTokenPrice, setLimitTokenPrice] = useState("");
  const [txType, setTxType] = useState<"BUY" | "SELL">("BUY");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState("");

  const canTrade = isWhitelisted && kycStatus === 'VERIFIED';

  // 當使用者在 OrderBook 點擊價格時，自動切換至限價單並填入價格
  useEffect(() => {
    if (selectedPrice !== undefined && selectedPrice !== null) {
      setOrderType("limit");
      setLimitTokenPrice(selectedPrice.toFixed(2));
    }
  }, [selectedPrice]);

  const [tradeError, setTradeError] = useState<string | null>(null);

  const totalTwdValue = parseFloat(tokenAmount || "0") * (orderType === "market" ? property.price : parseFloat(limitTokenPrice || "0"));

  const confirmOrder = async () => {
    setTradeError(null);
    if (!canTrade) {
      setTradeError("您的帳號尚未通過 KYC 白名單審核，無法進行下單交易。");
      return;
    }

    if (isPaused) {
       setTradeError("系統目前處於暫停狀態，無法進行交易。");
       return;
    }

    const amount = parseFloat(tokenAmount);
    const price = orderType === 'market' ? property.price : parseFloat(limitTokenPrice);
    if (isNaN(amount) || amount <= 0) { 
      setTradeError("請輸入有效的代幣數量"); 
      return; 
    }
    if (orderType === 'limit' && (isNaN(price) || price <= 0)) { 
      setTradeError("請輸入有效的目標限價"); 
      return; 
    }

    setIsSubmitting(true);
    try {
      const response = await apiFetch(`/api/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          user_id: userId, 
          property_id: property.id, 
          tx_type: txType, 
          order_type: orderType.toUpperCase(), 
          token_amount: amount, 
          price_per_token: price,
          idempotency_key: idempotencyKey
        })
      });
      
      const data = await response.json();
      if (response.ok && data.success) {
        setIsConfirmOpen(false);
        setIsSuccessOpen(true);
        onSuccess?.();
      } else {
        setTradeError(data.message || "交易下單失敗，請檢查錢包或庫存");
      }
    } catch (e) { 
      setTradeError("連線後端 API 失敗，請確認伺服器在線"); 
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className={`bg-white border rounded-[3rem] p-10 shadow-2xl flex flex-col ring-1 ${isPaused ? 'ring-red-500/50' : !canTrade ? 'ring-amber-500/30 bg-slate-50/30' : 'ring-slate-100'} relative overflow-hidden`}>
        {isPaused && (
           <div className="absolute top-0 left-0 right-0 bg-red-600 text-white text-center text-[10px] font-black tracking-[0.2em] py-1 uppercase animate-pulse">
              SYSTEM LOCKED / 交易已暫停
           </div>
        )}
        
        <div className="flex items-center justify-between border-b pb-4 mt-2 mb-6">
          <h3 className="font-black text-2xl uppercase">Trading HUB</h3>
          {!canTrade && (
            <span className="text-[10px] font-black bg-amber-100 text-amber-800 px-3 py-1 rounded-full uppercase flex items-center gap-1.5 border border-amber-200">
              <Lock className="w-3 h-3" /> KYC 未開通
            </span>
          )}
        </div>

        {/* 權限不足提示鎖定條 */}
        {!canTrade && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-3 mb-6 animate-in fade-in text-amber-900">
            <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-black text-xs">帳號尚未開通交易權限</div>
              <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                {kycStatus === 'PENDING' 
                  ? '您的實名證件正在由銀行審核中，審核通過前無法進行下單交易。' 
                  : kycStatus === 'REJECTED' 
                  ? '您的 KYC 審核未通過，請至帳戶首頁補繳證件。' 
                  : '您尚未提交 KYC 雙證件，請先至首頁完成實名認證。'}
              </p>
            </div>
          </div>
        )}
        
        <div className="flex bg-slate-100 p-2 rounded-[1.5rem] mb-10">
          <button disabled={!canTrade || isPaused || isSubmitting} onClick={() => setOrderType("market")} className={`flex-1 py-4 rounded-2xl text-xs font-black uppercase transition-all ${orderType === 'market' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'} disabled:opacity-40 disabled:cursor-not-allowed`}>市價委託</button>
          <button disabled={!canTrade || isPaused || isSubmitting} onClick={() => setOrderType("limit")} className={`flex-1 py-4 rounded-2xl text-xs font-black uppercase transition-all ${orderType === 'limit' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'} disabled:opacity-40 disabled:cursor-not-allowed`}>限價排隊</button>
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
                  disabled={!canTrade || isPaused || isSubmitting}
                  className="w-full pl-12 pr-8 py-6 bg-slate-50 border border-slate-100 focus:border-blue-200 focus:ring-4 focus:ring-blue-100 rounded-[2rem] text-3xl outline-none font-mono font-black text-blue-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed" 
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
              disabled={!canTrade || isPaused || isSubmitting}
              className="w-full px-8 py-6 bg-slate-50 border border-slate-100 focus:border-blue-200 focus:ring-4 focus:ring-blue-100 rounded-[2rem] text-4xl outline-none font-mono font-black text-slate-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed" 
            />
          </div>
          
          <div className="flex justify-between px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
             <span className="text-xs font-bold text-slate-400 uppercase">預估總額 (Est. Value)</span>
             <span className="font-mono font-black text-slate-800">${totalTwdValue.toLocaleString()} TWD</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <button 
            disabled={!canTrade || isPaused || isSubmitting} 
            onClick={() => { setTxType("BUY"); setIdempotencyKey(crypto.randomUUID()); setIsConfirmOpen(true); }} 
            className={`py-6 text-white rounded-[2rem] uppercase font-black shadow-xl transition-all active:scale-95 text-lg flex items-center justify-center gap-2 ${
              !canTrade 
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none opacity-50' 
                : 'bg-red-600 hover:bg-red-700 shadow-red-200'
            } disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none`}
          >
            {isSubmitting && txType === "BUY" ? "處理中..." : !canTrade ? <><Lock className="w-5 h-5"/> 申購 (鎖定)</> : "申購 BUY"}
          </button>
          <button 
            disabled={!canTrade || isPaused || isSubmitting} 
            onClick={() => { setTxType("SELL"); setIdempotencyKey(crypto.randomUUID()); setIsConfirmOpen(true); }} 
            className={`py-6 text-white rounded-[2rem] uppercase font-black shadow-xl transition-all active:scale-95 text-lg flex items-center justify-center gap-2 ${
              !canTrade 
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none opacity-50' 
                : 'bg-green-600 hover:bg-green-700 shadow-green-200'
            } disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none`}
          >
            {isSubmitting && txType === "SELL" ? "處理中..." : !canTrade ? <><Lock className="w-5 h-5"/> 委賣 (鎖定)</> : "委賣 SELL"}
          </button>
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
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{orderType === 'market' ? 'Instant Execution' : 'Pending Order Book'}</p>
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

              {tradeError && (
                 <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-xs font-bold text-red-600 animate-in fade-in">
                   {tradeError}
                 </div>
               )}

              <div className="flex gap-4">
                 <button onClick={() => { setIsConfirmOpen(false); setTradeError(null); }} className="flex-1 py-5 bg-slate-100 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-2xl font-black uppercase transition-colors">取消</button>
                 <button onClick={confirmOrder} disabled={isSubmitting} className={`flex-[2] py-5 rounded-2xl text-white font-black uppercase shadow-xl transition-all active:scale-95 disabled:opacity-50 ${txType === 'BUY' ? 'bg-red-600 hover:bg-red-700 shadow-red-200' : 'bg-green-600 hover:bg-green-700 shadow-green-200'}`}>
                    {isSubmitting ? "正在下單..." : "確認下單"}
                 </button>
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
