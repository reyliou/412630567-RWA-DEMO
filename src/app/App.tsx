import { useState, useRef, useEffect } from "react";
import { SystemHealthCard } from "./components/SystemHealthCard";
import { OracleMonitorCard } from "./components/OracleMonitorCard";
import { ContractControlCard } from "./components/ContractControlCard";
import { StaffStatusCard } from "./components/StaffStatusCard";
import { ThrottleTimerCard } from "./components/ThrottleTimerCard";
import { SystemLogsCard, SystemLogsCardHandle } from "./components/SystemLogsCard";
import { StaffChatModal } from "./components/StaffChatModal";
import { UserManagementCard } from "./components/UserManagementCard";
import { PropertyOversightCard } from "./components/PropertyOversightCard";
import { InvestorPortfolio } from "./components/InvestorPortfolio";
import { InvestorMarket } from "./components/InvestorMarket";
import { InvestorPropertyDetail } from "./components/InvestorPropertyDetail";
import { InvestorTransactions } from "./components/InvestorTransactions";
import { NotificationCenter } from "./components/NotificationCenter";
import { AuthView } from "./AuthView";
import { SettingsModal } from "./components/SettingsModal";
import { HeartbeatProvider } from "./context/SystemHeartbeatContext";
import { Shield, Bell, User, LogOut, Settings, History, PieChart, Landmark } from "lucide-react";

export type RequestType = "NONE" | "PAUSE_REQUEST" | "UNPAUSE_REQUEST";
export type AppMode = "TECHNICAL" | "BUSINESS" | "INVESTOR";
export type InvestorSubMode = "PORTFOLIO" | "MARKET" | "TRANSACTIONS";

export default function App() {
  return (
    <HeartbeatProvider>
      <AppContent />
    </HeartbeatProvider>
  );
}

function AppContent() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState<number | null>(null);
  const [appMode, setAppMode] = useState<AppMode>("TECHNICAL");
  const [investorSubMode, setInvestorSubMode] = useState<InvestorSubMode>("PORTFOLIO");
  
  const [isPaused, setIsPaused] = useState(false);
  const [throttleStartTime, setThrottleStartTime] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<any>(null);
  
  const [activeRequest, setActiveRequest] = useState<RequestType>("NONE");
  const [requestReason, setRequestReason] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  const logRef = useRef<SystemLogsCardHandle>(null);

  const handleLogin = (mode: AppMode, name: string, dbId?: number) => {
    setUserName(name);
    setUserId(dbId || null);
    setAppMode(mode);
    setIsLoggedIn(true);
  };

  const handleOpenChat = () => {
    setIsModalOpen(true);
    setUnreadCount(0);
  };

  const handleTriggerRequestFromBanker = (type: RequestType, reason: string) => {
    setActiveRequest(type);
    setRequestReason(reason);
    if (!isModalOpen) setUnreadCount(prev => prev + 1);
    logRef.current?.addLog(type === "PAUSE_REQUEST" ? "error" : "info", `⚠️ 跨部門請求：${reason}`);
  };

  const handleExecuteOperation = () => {
    if (activeRequest === "PAUSE_REQUEST") {
      setIsPaused(true);
      setThrottleStartTime(null);
      logRef.current?.addLog("warning", `技術負責人已授權：合約正式暫停。`);
    } else if (activeRequest === "UNPAUSE_REQUEST") {
      setIsPaused(false);
      setThrottleStartTime(new Date());
      logRef.current?.addLog("success", `技術負責人已授權：系統恢復交易。`);
    }
    setActiveRequest("NONE");
    setIsModalOpen(false);
  };

  if (!isLoggedIn) {
    return <AuthView onLogin={(mode, name, id) => handleLogin(mode, name, id)} />;
  }

  return (
    <div className="min-h-screen bg-[#f8f9fc] dark:bg-[#0a0a0c] text-foreground font-sans text-slate-800 font-black">
      <nav className="bg-white border-b border-border sticky top-0 z-40 shadow-sm transition-colors duration-500">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between h-20">
          <div className="flex items-center gap-8 text-slate-800">
            <div className="flex items-center gap-2 cursor-default">
              <Shield className={`w-10 h-10 ${appMode === 'BUSINESS' ? 'text-purple-600' : 'text-blue-600'}`} />
              <span className="font-black text-2xl tracking-tighter">RWA BANK</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-slate-800">
             <div className="text-right hidden sm:block">
                <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none mb-1.5 opacity-60 italic">Session: {userId || 'Dev'}</div>
                <div className="text-base font-black uppercase">{userName}</div>
             </div>
             <div className="flex items-center gap-2">
                <button onClick={() => setIsSettingsOpen(true)} className="p-2.5 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-800"><Settings className="w-6 h-6" /></button>
                <button onClick={() => setIsLoggedIn(false)} className="p-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm"><LogOut className="w-6 h-6" /></button>
             </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-10">
        {appMode === "TECHNICAL" && (
          <div className="space-y-10 animate-in fade-in duration-500 text-slate-800">
            {activeRequest !== "NONE" && (
              <div className={`${activeRequest === 'PAUSE_REQUEST' ? 'bg-red-600' : 'bg-blue-600'} text-white p-5 rounded-[2rem] flex items-center justify-between animate-pulse shadow-2xl`}>
                <div className="flex items-center gap-5 font-black uppercase">🚨 收到業務請求：【{activeRequest === 'PAUSE_REQUEST' ? '暫停' : '恢復'}】</div>
                <button onClick={handleOpenChat} className="bg-white text-slate-900 px-8 py-3 rounded-2xl text-sm font-black hover:bg-gray-100 transition-all shadow-xl uppercase">立即處理</button>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <SystemHealthCard />
              <OracleMonitorCard />
              <ContractControlCard onPauseToggle={handleOpenChat} isPaused={isPaused} />
              <StaffStatusCard onOpenChat={handleOpenChat} hasRequest={activeRequest !== "NONE"} unreadCount={unreadCount} userName={userName} requestType={activeRequest} />
            </div>
            <ThrottleTimerCard isActive={!isPaused} startTime={throttleStartTime} />
            <div className="pt-6 border-t border-border/50"><SystemLogsCard ref={logRef} /></div>
          </div>
        )}

        {appMode === "BUSINESS" && (
          <div className="space-y-10 animate-in fade-in duration-500 text-slate-800">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
               <div className="lg:col-span-3"><PropertyOversightCard /></div>
               <div className="lg:col-span-1"><StaffStatusCard onOpenChat={handleOpenChat} hasRequest={activeRequest !== "NONE"} isBankerView={true} userName={userName} requestType={activeRequest} /></div>
            </div>
            <ThrottleTimerCard isActive={!isPaused} startTime={throttleStartTime} />
            <UserManagementCard />
          </div>
        )}

        {appMode === "INVESTOR" && (
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
        )}
      </main>

      <StaffChatModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onConfirm={handleExecuteOperation} activeRequest={activeRequest} requestReason={requestReason} appMode={appMode} isPaused={isPaused} onTriggerRequest={handleTriggerRequestFromBanker} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} userName={userName} />
    </div>
  );
}
