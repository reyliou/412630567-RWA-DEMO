import { X, CheckCircle2, AlertTriangle, RefreshCw, Loader2, ShieldCheck, Wrench, ArrowRight, Database, Cpu } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

interface Discrepancy {
  propertyId: number;
  propertyTitle: string;
  type: string;
  userId?: number;
  walletAddress: string;
  onChainBalance: string;
  dbBalance: string;
  detail: string;
  repaired?: boolean;
  repairDetail?: string;
}

interface ReconcileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLog?: (type: 'INFO' | 'WARNING' | 'ERROR', msg: string) => void;
}

export function ReconcileModal({ isOpen, onClose, onLog }: ReconcileModalProps) {
  const { apiFetch } = useAuth();
  const [status, setStatus] = useState<"SCANNING" | "MATCHED" | "DISCREPANCY" | "REPAIRED" | "ERROR">("SCANNING");
  const [checkedCount, setCheckedCount] = useState(0);
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [isRepairing, setIsRepairing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const runReconcile = async () => {
    setStatus("SCANNING");
    setDiscrepancies([]);
    setErrorMessage("");
    onLog?.("INFO", "🔍 啟動全節點對帳：正在掃描區塊鏈 Transfer 事件與資料庫持倉...");

    try {
      const res = await apiFetch("/api/blockchain/reconcile");
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "對帳請求失敗");

      setCheckedCount(data.checkedProperties || 0);

      if (data.discrepancies && data.discrepancies.length > 0) {
        setDiscrepancies(data.discrepancies);
        setStatus("DISCREPANCY");
        data.discrepancies.forEach((d: Discrepancy) => {
          onLog?.("WARNING", `[對帳異常 - ${d.type}] ${d.detail}`);
        });
      } else {
        setStatus("MATCHED");
        onLog?.("INFO", `✅ 對帳完成：${data.checkedProperties} 個代幣合約持倉與資料庫完全一致`);
      }
    } catch (err: any) {
      setStatus("ERROR");
      setErrorMessage(err.message || "無法連線至節點");
      onLog?.("ERROR", `❌ 對帳失敗: ${err.message}`);
    }
  };

  useEffect(() => {
    if (isOpen) {
      runReconcile();
    }
  }, [isOpen]);

  const handleAutoRepair = async () => {
    setIsRepairing(true);
    onLog?.("INFO", "🔧 正在執行全節點自動修復 (Auto-Repair)...");

    try {
      const res = await apiFetch("/api/blockchain/reconcile/repair", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "修復失敗");

      setStatus("REPAIRED");
      onLog?.("INFO", `✅ 自動修復完成！已依據區塊鏈真實帳本校正資料庫 ${data.discrepancies?.length || discrepancies.length} 筆持倉。`);
    } catch (err: any) {
      alert(`自動修復失敗: ${err.message}`);
      onLog?.("ERROR", `❌ 自動修復失敗: ${err.message}`);
    } finally {
      setIsRepairing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[250] p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 max-w-2xl w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl text-white shadow-lg ${
              status === "SCANNING" ? "bg-blue-600 shadow-blue-200" :
              status === "MATCHED" || status === "REPAIRED" ? "bg-green-600 shadow-green-200" :
              status === "DISCREPANCY" ? "bg-amber-600 shadow-amber-200" : "bg-red-600 shadow-red-200"
            }`}>
              {status === "SCANNING" && <Loader2 className="w-5 h-5 animate-spin" />}
              {(status === "MATCHED" || status === "REPAIRED") && <ShieldCheck className="w-5 h-5" />}
              {status === "DISCREPANCY" && <AlertTriangle className="w-5 h-5" />}
              {status === "ERROR" && <X className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-black text-lg text-slate-800">全節點對帳與雙帳本校驗</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                Full-Node Ledger Reconciliation & Auto-Repair
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-8 space-y-6">

          {/* 1. 正在掃描 (SCANNING) */}
          {status === "SCANNING" && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative w-20 h-20 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
                <div className="w-16 h-16 bg-blue-600 text-white rounded-3xl flex items-center justify-center shadow-xl">
                  <RefreshCw className="w-8 h-8 animate-spin" />
                </div>
              </div>
              <div className="space-y-1">
                <h4 className="text-xl font-black text-slate-800">正在進行全節點對帳掃描...</h4>
                <p className="text-xs text-slate-400 font-bold">
                  遍歷全鏈智能合約 Transfer 事件，正在重建不可篡改餘額並比對資料庫
                </p>
              </div>
            </div>
          )}

          {/* 2. 完全一致 (MATCHED) */}
          {status === "MATCHED" && (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-6">
              <div className="w-20 h-20 bg-green-500 text-white rounded-3xl flex items-center justify-center shadow-2xl shadow-green-200 animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h4 className="text-2xl font-black text-slate-800 tracking-tight">雙帳本 100% 完全一致</h4>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  系統已完整校驗 <span className="text-green-600 font-black">{checkedCount} 個代幣資產</span> 之鏈上 Transfer 歷史事件與雲端資料庫持倉，未發現任何差異或異常！
                </p>
              </div>
              <div className="w-full bg-green-50/50 border border-green-200 rounded-2xl p-4 flex items-center justify-around text-xs font-black text-green-800">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-green-600" />
                  <span>區塊鏈帳本：正常</span>
                </div>
                <div className="w-px h-4 bg-green-200" />
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-green-600" />
                  <span>資料庫持倉：同步</span>
                </div>
              </div>
            </div>
          )}

          {/* 3. 發現不一致 (DISCREPANCY) */}
          {status === "DISCREPANCY" && (
            <div className="space-y-6">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-amber-900">
                    偵測到雙帳本持倉不一致（發現 {discrepancies.length} 筆異常）
                  </h4>
                  <p className="text-xs text-amber-700 font-medium leading-relaxed">
                    依據 Web3 金融合規原則，區塊鏈合約為不可篡改之「單一真實來源 (Single Source of Truth)」。您可以點擊下方按鈕啟動自動修復，以鏈上實際值覆寫校正資料庫。
                  </p>
                </div>
              </div>

              {/* 不一致清單 Table */}
              <div className="space-y-2">
                <div className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">
                  異常明細清單 (Discrepancy List)
                </div>
                <div className="max-h-52 overflow-y-auto border border-slate-100 rounded-2xl divide-y divide-slate-100 bg-slate-50/50">
                  {discrepancies.map((d, idx) => (
                    <div key={idx} className="p-4 flex items-center justify-between text-xs">
                      <div className="space-y-1">
                        <div className="font-black text-slate-800 text-sm">{d.propertyTitle}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          錢包: {d.walletAddress.substring(0, 10)}...{d.walletAddress.substring(36)}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] text-slate-400 font-bold uppercase">資料庫記錄</span>
                          <span className="font-mono font-black text-red-600">{d.dbBalance} 枚</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-300" />
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] text-green-600 font-bold uppercase">鏈上真實值</span>
                          <span className="font-mono font-black text-green-600">{d.onChainBalance} 枚</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 4. 修復完成 (REPAIRED) */}
          {status === "REPAIRED" && (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-6">
              <div className="w-20 h-20 bg-blue-600 text-white rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-200 animate-in zoom-in-95">
                <Wrench className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h4 className="text-2xl font-black text-slate-800 tracking-tight">🎉 自動校正修復成功！</h4>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  已依據區塊鏈不可篡改之 Transfer 真實歷史事件，將資料庫中的不一致持倉全面校正同步完畢。
                </p>
              </div>
            </div>
          )}

          {/* 5. 錯誤 (ERROR) */}
          {status === "ERROR" && (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center">
                <X className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-black text-slate-800">對帳過程發生錯誤</h4>
                <p className="text-xs text-red-500 font-bold">{errorMessage}</p>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-6 py-3.5 rounded-2xl text-xs font-black text-slate-600 hover:bg-slate-200 transition-all uppercase"
          >
            {status === "DISCREPANCY" ? "稍後處理 (保持唯讀)" : "關閉視窗"}
          </button>

          <div className="flex gap-3">
            {status === "DISCREPANCY" && (
              <button
                onClick={handleAutoRepair}
                disabled={isRepairing}
                className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs shadow-xl shadow-blue-200 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isRepairing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
                {isRepairing ? "正在自動校正中..." : "🔧 立即執行自動修復 (Auto-Repair)"}
              </button>
            )}

            {(status === "MATCHED" || status === "REPAIRED") && (
              <button
                onClick={onClose}
                className="px-8 py-3.5 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-black text-xs shadow-xl shadow-green-200 transition-all"
              >
                確認完畢
              </button>
            )}

            {status === "ERROR" && (
              <button
                onClick={runReconcile}
                className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs shadow-xl shadow-blue-200 transition-all flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> 重新對帳
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
