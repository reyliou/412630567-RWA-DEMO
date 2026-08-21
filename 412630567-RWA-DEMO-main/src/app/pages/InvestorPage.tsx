import React, { useState, useEffect, useCallback } from "react";
import { PieChart, Landmark, History } from "lucide-react";
import { InvestorPortfolio } from "../components/InvestorPortfolio";
import { InvestorMarket } from "../components/InvestorMarket";
import { InvestorTransactions } from "../components/InvestorTransactions";
import { InvestorPropertyDetail } from "../components/InvestorPropertyDetail";
import { NotificationCenter } from "../components/NotificationCenter";
import { KycStatusBanner } from "../components/KycStatusBanner";
import { KycResubmitModal } from "../components/KycResubmitModal";
import { useAuth } from "../context/AuthContext";
import { InvestorSubMode } from "../App";

export function InvestorPage() {
  const { userId, userName, apiFetch } = useAuth();
  const [investorSubMode, setInvestorSubMode] = useState<InvestorSubMode>("PORTFOLIO");
  const [selectedProperty, setSelectedProperty] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isKycModalOpen, setIsKycModalOpen] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await apiFetch('/api/users/profile/me');
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch (e) {
      console.warn("無法取得用戶 KYC 狀態");
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchProfile();
    // 每 10 秒定期更新一次狀態（以防行員剛好在背景審核通過或退件）
    const interval = setInterval(fetchProfile, 10000);
    return () => clearInterval(interval);
  }, [fetchProfile]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-slate-800">
      {/* 頂部 KYC 狀態條 (審核中/退件/未認證提示) */}
      <KycStatusBanner 
        profile={profile} 
        onOpenResubmit={() => setIsKycModalOpen(true)} 
      />

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
        <InvestorPropertyDetail 
          userId={userId || 1} 
          property={selectedProperty} 
          userProfile={profile}
          onBack={() => setSelectedProperty(null)} 
        />
      ) : (
        <div className="pt-2">
          {investorSubMode === "PORTFOLIO" && <InvestorPortfolio userId={userId || 1} userName={userName} />}
          {investorSubMode === "MARKET" && <InvestorMarket onSelectProperty={(p) => setSelectedProperty(p)} />}
          {investorSubMode === "TRANSACTIONS" && <InvestorTransactions userId={userId || 1} />}
        </div>
      )}

      {/* KYC 補件彈窗 */}
      <KycResubmitModal
        isOpen={isKycModalOpen}
        onClose={() => setIsKycModalOpen(false)}
        onSuccess={() => {
          fetchProfile();
        }}
        currentStatus={profile?.kyc_status || 'UNSUBMITTED'}
        rejectionReason={profile?.kyc_rejection_reason}
      />
    </div>
  );
}
