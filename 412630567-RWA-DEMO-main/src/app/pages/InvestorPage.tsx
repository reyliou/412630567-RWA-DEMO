import React, { useState } from "react";
import { PieChart, Landmark, History } from "lucide-react";
import { InvestorPortfolio } from "../components/InvestorPortfolio";
import { InvestorMarket } from "../components/InvestorMarket";
import { InvestorTransactions } from "../components/InvestorTransactions";
import { InvestorPropertyDetail } from "../components/InvestorPropertyDetail";
import { NotificationCenter } from "../components/NotificationCenter";
import { useAuth } from "../context/AuthContext";
import { InvestorSubMode } from "../App";

export function InvestorPage() {
  const { userId, userName } = useAuth();
  const [investorSubMode, setInvestorSubMode] = useState<InvestorSubMode>("PORTFOLIO");
  const [selectedProperty, setSelectedProperty] = useState<any>(null);

  return (
    <div className="space-y-10 animate-in fade-in duration-500 text-slate-800">
      {!selectedProperty && (
        <div className="bg-white border border-border p-3 rounded-3xl shadow-sm flex items-center justify-between ring-1 ring-slate-100">
          <div className="flex items-center gap-2">
            <button onClick={() => setInvestorSubMode("PORTFOLIO")} className={`px-8 py-3 rounded-2xl text-sm font-black uppercase tracking-widest transition-all ${investorSubMode === 'PORTFOLIO' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-400 hover:text-slate-800'}`}><PieChart className="w-4 h-4 inline-block mr-2" /> 持倉總覽</button>
            <button onClick={() => setInvestorSubMode("MARKET")} className={`px-8 py-3 rounded-2xl text-sm font-black uppercase tracking-widest transition-all ${investorSubMode === 'MARKET' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-400 hover:text-slate-800'}`}><Landmark className="w-4 h-4 inline-block mr-2" /> 房產市場</button>
            <button onClick={() => setInvestorSubMode("TRANSACTIONS")} className={`px-8 py-3 rounded-2xl text-sm font-black uppercase tracking-widest transition-all ${investorSubMode === 'TRANSACTIONS' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-400 hover:text-slate-800'}`}><History className="w-4 h-4 inline-block mr-2" /> 交易紀錄</button>
          </div>
          <div className="pr-4 border-l border-slate-100 pl-6 ml-4">
            <NotificationCenter userId={userId || 1} />
          </div>
        </div>
      )}

      {selectedProperty ? (
        <InvestorPropertyDetail userId={userId || 1} property={selectedProperty} onBack={() => setSelectedProperty(null)} />
      ) : (
        <div className="pt-4">
          {investorSubMode === "PORTFOLIO" && <InvestorPortfolio userId={userId || 1} userName={userName} />}
          {investorSubMode === "MARKET" && <InvestorMarket onSelectProperty={(p) => setSelectedProperty(p)} />}
          {investorSubMode === "TRANSACTIONS" && <InvestorTransactions userId={userId || 1} />}
        </div>
      )}
    </div>
  );
}
