import React, { useRef, useState } from "react";
import { SystemHealthCard } from "../components/SystemHealthCard";
import { OracleMonitorCard } from "../components/OracleMonitorCard";
import { ContractControlCard } from "../components/ContractControlCard";
import { BlockchainDeployCard } from "../components/BlockchainDeployCard";
import { StaffStatusCard } from "../components/StaffStatusCard";
import { ThrottleTimerCard } from "../components/ThrottleTimerCard";
import { SystemLogsCard, SystemLogsCardHandle } from "../components/SystemLogsCard";
import { useSystemControl } from "../context/SystemControlContext";
import { useAuth } from "../context/AuthContext";
import { API_BASE_URL } from "../config";

export function TechnicalPage() {
  const { userName, apiFetch } = useAuth();
  const { activeRequest, isPaused, throttleStartTime, activeTransactions, unreadCount, openChat } = useSystemControl();
  const logRef = useRef<SystemLogsCardHandle>(null);
  const [isReconciling, setIsReconciling] = useState(false);

  const handleReconcile = async () => {
    if (isReconciling) return;
    setIsReconciling(true);
    logRef.current?.addLog('INFO', '🔍 啟動全節點對帳：正在掃描全鏈 Transfer 事件與資料庫持倉...');

    try {
      const res = await apiFetch(`/api/blockchain/reconcile`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Reconcile failed');
      
      const { checkedProperties, discrepancies } = data;
      if (discrepancies.length > 0) {
        // 把詳細的不一致資訊寫入畫面下方的系統日誌
        discrepancies.forEach((d: any) => {
          logRef.current?.addLog('WARNING', `[對帳異常 - ${d.type}] ${d.detail}`);
        });

        const shouldRepair = window.confirm(
          `⚠️ 對帳完成！\n\n已掃描 ${checkedProperties} 個代幣合約，發現 ${discrepancies.length} 筆鏈上與資料庫不一致異常！\n\n以區塊鏈不可篡改真實帳本為準（Single Source of Truth），是否立即啟動「自動修復 (Auto-Repair)」校正資料庫持倉？`
        );

        if (shouldRepair) {
          logRef.current?.addLog('INFO', '🔧 正在執行鏈上/鏈下自動校正修復 (Auto-Repair)...');
          const repairRes = await apiFetch(`/api/blockchain/reconcile/repair`, { method: 'POST' });
          const repairData = await repairRes.json();
          if (repairRes.ok) {
            logRef.current?.addLog('INFO', `✅ 自動修復完成！已依據區塊鏈實際餘額修正資料庫 ${repairData.discrepancies?.length || discrepancies.length} 筆持倉。`);
            alert('✅ 自動修復成功！已將資料庫持倉資料同步校正為鏈上最新狀態。');
          } else {
            throw new Error(repairData.message || '修復失敗');
          }
        }
      } else {
        alert(`對帳完成！掃描了 ${checkedProperties} 個代幣，目前區塊鏈與資料庫資料完全一致！✅`);
        logRef.current?.addLog('INFO', `✅ 對帳完成：${checkedProperties} 個代幣持倉與資料庫完全一致`);
      }
    } catch (e: any) {
      alert(`對帳請求失敗: ${e.message}`);
      logRef.current?.addLog('ERROR', `❌ 對帳失敗: ${e.message}`);
    } finally {
      setIsReconciling(false);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 text-slate-800">
      {activeRequest !== "NONE" && (
        <div className={`${activeRequest === 'PAUSE_REQUEST' ? 'bg-red-600' : 'bg-blue-600'} text-white p-5 rounded-[2rem] flex items-center justify-between animate-pulse shadow-2xl`}>
          <div className="flex items-center gap-5 font-black uppercase">🚨 收到業務請求：【{activeRequest === 'PAUSE_REQUEST' ? '暫停' : '恢復'}】</div>
          <button onClick={openChat} className="bg-white text-slate-900 px-8 py-3 rounded-2xl text-sm font-black hover:bg-gray-100 transition-all shadow-xl uppercase">立即處理</button>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
        <SystemHealthCard />
        <OracleMonitorCard />
        <ContractControlCard onPauseToggle={openChat} onReconcile={handleReconcile} isPaused={isPaused} isReconciling={isReconciling} />
        <BlockchainDeployCard onLog={(type, message) => logRef.current?.addLog(type, message)} />
        <StaffStatusCard onOpenChat={openChat} hasRequest={activeRequest !== "NONE"} unreadCount={unreadCount} userName={userName} requestType={activeRequest} />
      </div>
      <ThrottleTimerCard isActive={!isPaused} startTime={throttleStartTime} realActiveTransactions={activeTransactions} />
      <div className="pt-6 border-t border-border/50"><SystemLogsCard ref={logRef} /></div>
    </div>
  );
}
