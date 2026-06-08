import { ArrowLeft, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { OrderBook } from "./OrderBook";
import { useAuth } from "../context/AuthContext";
import { API_BASE_URL } from "../config";
import { OrderEntryForm } from "./OrderEntryForm";

interface PropertyDetailProps {
  userId: number;
  property: any;
  onBack: () => void;
}

export function InvestorPropertyDetail({ userId, property, onBack }: PropertyDetailProps) {
  const { apiFetch } = useAuth();
  const [vLogs, setVLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);

  // 模擬市場數據
  const marketStats = { high: (property.price * 1.05).toFixed(2), low: (property.price * 0.95).toFixed(2), vol: "1.2M" };

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await apiFetch(`/api/properties/${property.id}/valuation-logs`);
        if (response.ok) {
          const res = await response.json();
          setVLogs(res);
        }
      } catch (e) { console.error("Logs sync failed"); } finally { setIsLoadingLogs(false); }
    };
    fetchLogs();
  }, [property.id]);

  const chartBars = vLogs.length > 0 ? vLogs.map(l => parseFloat(l.market_value_k)) : [40, 65, 50, 80, 55, 90, 70, 85, 65, 50, 75];

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
          <OrderEntryForm userId={userId} property={property} />
          <OrderBook onPriceSelect={() => {}} />
        </div>
      </div>
    </div>
  );
}