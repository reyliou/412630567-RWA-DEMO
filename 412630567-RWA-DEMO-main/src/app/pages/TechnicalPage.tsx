import React, { useRef } from "react";
import { SystemHealthCard } from "../components/SystemHealthCard";
import { OracleMonitorCard } from "../components/OracleMonitorCard";
import { ContractControlCard } from "../components/ContractControlCard";
import { StaffStatusCard } from "../components/StaffStatusCard";
import { ThrottleTimerCard } from "../components/ThrottleTimerCard";
import { SystemLogsCard, SystemLogsCardHandle } from "../components/SystemLogsCard";
import { useSystemControl } from "../context/SystemControlContext";
import { useAuth } from "../context/AuthContext";

export function TechnicalPage() {
  const { userName } = useAuth();
  const { activeRequest, isPaused, throttleStartTime, activeTransactions, unreadCount, openChat } = useSystemControl();
  const logRef = useRef<SystemLogsCardHandle>(null);

  return (
    <div className="space-y-10 animate-in fade-in duration-500 text-slate-800">
      {activeRequest !== "NONE" && (
        <div className={`${activeRequest === 'PAUSE_REQUEST' ? 'bg-red-600' : 'bg-blue-600'} text-white p-5 rounded-[2rem] flex items-center justify-between animate-pulse shadow-2xl`}>
          <div className="flex items-center gap-5 font-black uppercase">🚨 收到業務請求：【{activeRequest === 'PAUSE_REQUEST' ? '暫停' : '恢復'}】</div>
          <button onClick={openChat} className="bg-white text-slate-900 px-8 py-3 rounded-2xl text-sm font-black hover:bg-gray-100 transition-all shadow-xl uppercase">立即處理</button>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <SystemHealthCard />
        <OracleMonitorCard />
        <ContractControlCard onPauseToggle={openChat} isPaused={isPaused} />
        <StaffStatusCard onOpenChat={openChat} hasRequest={activeRequest !== "NONE"} unreadCount={unreadCount} userName={userName} requestType={activeRequest} />
      </div>
      <ThrottleTimerCard isActive={!isPaused} startTime={throttleStartTime} realActiveTransactions={activeTransactions} />
      <div className="pt-6 border-t border-border/50"><SystemLogsCard ref={logRef} /></div>
    </div>
  );
}
