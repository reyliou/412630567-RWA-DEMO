import { useState, useRef } from "react";
import { AuthView } from "./AuthView";
import { SettingsModal } from "./components/SettingsModal";
import { StaffChatModal } from "./components/StaffChatModal";
import { HeartbeatProvider } from "./context/SystemHeartbeatContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SystemControlProvider, useSystemControl } from "./context/SystemControlContext";
import { Shield, LogOut, Settings } from "lucide-react";
import { TechnicalPage } from "./pages/TechnicalPage";
import { BusinessPage } from "./pages/BusinessPage";
import { InvestorPage } from "./pages/InvestorPage";

export type RequestType = "NONE" | "PAUSE_REQUEST" | "UNPAUSE_REQUEST";
export type AppMode = "TECHNICAL" | "BUSINESS" | "INVESTOR";
export type InvestorSubMode = "PORTFOLIO" | "MARKET" | "TRANSACTIONS";

export default function App() {
  return (
    <HeartbeatProvider>
      <AuthProvider>
        <SystemControlProvider>
          <AppContent />
        </SystemControlProvider>
      </AuthProvider>
    </HeartbeatProvider>
  );
}

function AppContent() {
  const { isLoggedIn, userName, userId, appMode, login, logout } = useAuth();
  const { 
    isPaused, isModalOpen, activeRequest, requestReason,
    closeChat, triggerRequest, executeOperation
  } = useSystemControl();
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // We need a dummy ref here just to satisfy the onConfirm signature if it logs internally,
  // but since we moved the logRef to TechnicalPage, we handle logging there.
  // Actually, executeOperation currently takes an onLog callback.
  // We can pass a console.log or a no-op if we are not on the technical page.
  const handleConfirmAction = () => {
    executeOperation((type, msg) => console.log(`[Log] ${type}: ${msg}`));
  };

  if (!isLoggedIn) {
    return <AuthView onLogin={(mode, name, id, token, isWhitelisted, kycStatus) => login(mode, name, id, token, isWhitelisted, kycStatus)} />;
  }

  return (
    <div className="min-h-screen bg-[#f8f9fc] dark:bg-[#0a0a0c] text-foreground font-sans text-slate-800 font-black">
      {/* 導覽列 (全域共用) */}
      <nav className="bg-white border-b border-border sticky top-0 z-40 shadow-sm transition-colors duration-500">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between h-20">
          <div className="flex items-center gap-8 text-slate-800">
            <div className="flex items-center gap-2 cursor-default">
              <Shield className={`w-10 h-10 ${appMode === 'BUSINESS' ? 'text-purple-600' : 'text-blue-600'}`} />
              <span className="font-black text-2xl tracking-tighter">RWA BANK</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-slate-800">
             <div className="text-right hidden sm:flex items-center gap-3">
                <span className={`px-3 py-1 rounded-xl text-xs font-bold shadow-sm ${
                  appMode === 'BUSINESS' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                  appMode === 'TECHNICAL' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' :
                  'bg-blue-100 text-blue-700 border border-blue-200'
                }`}>
                  {appMode === 'BUSINESS' ? '業務審查專區' : appMode === 'TECHNICAL' ? '技術監控核心' : '投資人專區'}
                </span>
                <div className="text-base font-black">{userName}</div>
             </div>
             <div className="flex items-center gap-2">
                <button onClick={() => setIsSettingsOpen(true)} className="p-2.5 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-800"><Settings className="w-6 h-6" /></button>
                <button onClick={() => logout()} className="p-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm"><LogOut className="w-6 h-6" /></button>
             </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-10">
        {/* 路由切換邏輯：根據角色載入不同的 Page */}
        {appMode === "TECHNICAL" && <TechnicalPage />}
        {appMode === "BUSINESS" && <BusinessPage />}
        {appMode === "INVESTOR" && <InvestorPage />}
      </main>

      {/* 全域 Modal */}
      <StaffChatModal 
        isOpen={isModalOpen} 
        onClose={closeChat} 
        onConfirm={handleConfirmAction} 
        activeRequest={activeRequest} 
        requestReason={requestReason} 
        appMode={appMode} 
        isPaused={isPaused} 
        onTriggerRequest={(type, reason) => triggerRequest(type, reason)} 
      />
      
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        userName={userName} 
      />
    </div>
  );
}
