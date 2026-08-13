import { ArrowLeft, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { OrderBook } from "./OrderBook";
import { useAuth } from "../context/AuthContext";
import { API_BASE_URL } from "../config";
import { OrderEntryForm } from "./OrderEntryForm";
import { KLineChart } from "./KLineChart";

interface PropertyDetailProps {
  userId: number;
  property: any;
  onBack: () => void;
}

export function InvestorPropertyDetail({ userId, property, onBack }: PropertyDetailProps) {
  const { apiFetch } = useAuth();
  const [vLogs, setVLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [selectedOrderPrice, setSelectedOrderPrice] = useState<number | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // 修正 #6: 使用 local state 來同步即時價格
  const [livePrice, setLivePrice] = useState(property.price);
  
  const [marketStats, setMarketStats] = useState({ high: property.price.toFixed(2), low: property.price.toFixed(2), vol: "0" });

  useEffect(() => {
    const fetchLogs = async () => {
        try {
          const [klineRes, statsRes] = await Promise.all([
            apiFetch(`/api/properties/${property.id}/kline`),
            apiFetch(`/api/stats/${property.id}`)
          ]);
          
          if (klineRes.ok) {
            const res = await klineRes.json();
            setVLogs(res);
            // 修正 #6: 同步最新成交價給大字體與掛單簿
            if (res && res.length > 0) {
              setLivePrice(res[res.length - 1].close);
            }
          }
          if (statsRes.ok) {
            const stats = await statsRes.json();
            setMarketStats({
              high: (stats.high || property.price).toFixed(2),
              low: (stats.low || property.price).toFixed(2),
              vol: stats.volume ? stats.volume.toLocaleString() : "0"
            });
          }
        } catch (e) { console.error("Logs sync failed"); } finally { setIsLoadingLogs(false); }
    };
    fetchLogs();
  }, [property.id, refreshTrigger]);

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in duration-300 pb-20 text-slate-800 font-black">
      <div className="flex items-center justify-between mb-8 px-4">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-blue-600"><ArrowLeft className="w-5 h-5" /> Back</button>
        <span className="text-[10px] uppercase text-blue-500 bg-blue-50 px-5 py-2 rounded-full italic border border-blue-100">Live API Link: {API_BASE_URL}</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 px-4">
        <div className="lg:col-span-8 space-y-10">
          <div className="bg-white border border-border rounded-[3rem] p-10 shadow-sm">
            <h2 className="text-5xl font-black tracking-tighter mb-4">{property.name}</h2>
            <div className="flex items-center gap-8 mb-10">
               <div className="flex flex-col"><span className="text-[10px] text-slate-400 uppercase tracking-widest">Price</span><span className="font-mono text-blue-600 text-5xl tracking-tighter">${Number(livePrice).toFixed(4)}</span></div>
            </div>
            <div className="aspect-[21/9] bg-slate-900 border border-slate-800 rounded-[2.5rem] relative flex items-center justify-center p-2 overflow-hidden shadow-inner">
               <KLineChart currentPrice={livePrice} dataLogs={vLogs} />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-6">
             <div className="bg-white border p-8 rounded-[2rem] text-center shadow-sm"><div className="text-xs text-slate-400 uppercase mb-2">High</div><div className="text-3xl text-red-500">${marketStats.high}</div></div>
             <div className="bg-white border p-8 rounded-[2rem] text-center shadow-sm"><div className="text-xs text-slate-400 uppercase mb-2">Low</div><div className="text-3xl text-green-500">${marketStats.low}</div></div>
             <div className="bg-white border p-8 rounded-[2rem] text-center shadow-sm"><div className="text-xs text-slate-400 uppercase mb-2">Base</div><div className="text-3xl text-slate-800">${((property.price * 100000)/10000).toLocaleString()}萬</div></div>
             <div className="bg-white border p-8 rounded-[2rem] text-center shadow-sm"><div className="text-xs text-slate-400 uppercase mb-2">Supply</div><div className="text-3xl text-blue-500">{(property.circulating_supply || 0).toLocaleString()}</div></div>
          </div>
        </div>
        <div className="lg:col-span-4 space-y-8">
          <OrderEntryForm 
            userId={userId} 
            property={property} 
            selectedPrice={selectedOrderPrice} 
            onSuccess={() => setRefreshTrigger(prev => prev + 1)}
          />
          <OrderBook propertyId={property.id} currentPrice={livePrice} onPriceSelect={(p) => setSelectedOrderPrice(p)} />
        </div>
      </div>
    </div>
  );
}