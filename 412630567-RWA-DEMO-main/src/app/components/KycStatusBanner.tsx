import { ShieldAlert, Clock, AlertTriangle, ShieldCheck, Upload, RefreshCw } from "lucide-react";

interface UserProfile {
  id: number;
  username: string;
  email: string;
  phone_number?: string;
  kyc_status: string;
  is_whitelisted: boolean;
  kyc_rejection_reason?: string | null;
}

interface KycStatusBannerProps {
  profile: UserProfile | null;
  onOpenResubmit: () => void;
}

export function KycStatusBanner({ profile, onOpenResubmit }: KycStatusBannerProps) {
  if (!profile) return null;

  const { kyc_status, is_whitelisted, kyc_rejection_reason } = profile;

  // 1. 已完全通過 KYC 與白名單
  if (kyc_status === "VERIFIED" && is_whitelisted) {
    return null; // 不需要顯示警示 Banner
  }

  // 2. 審核未通過 / 退件 (REJECTED)
  if (kyc_status === "REJECTED") {
    return (
      <div className="bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent border-2 border-red-500/30 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in slide-in-from-top-4 duration-300">
        <div className="flex items-start gap-4">
          <div className="p-3.5 bg-red-500 text-white rounded-2xl shadow-lg shadow-red-200 shrink-0">
            <AlertTriangle className="w-6 h-6 animate-pulse" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-black text-base text-red-800">❌ KYC 實名認證未通過（退件需補件）</h3>
              <span className="text-[10px] font-black bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full uppercase">
                REJECTED
              </span>
            </div>
            <p className="text-xs font-bold text-red-600">
              行員審查退件備註：<span className="underline decoration-red-400">{kyc_rejection_reason || "證件影像不清晰或不符合規範"}</span>
            </p>
            <p className="text-[11px] text-slate-500 font-medium">
              依據法規，尚未通過實名認證之帳號暫時無法進行下單交易。請點擊右方按鈕重新拍攝並補繳證件。
            </p>
          </div>
        </div>
        <button
          onClick={onOpenResubmit}
          className="px-6 py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs shadow-lg shadow-red-200 hover:scale-[1.02] active:scale-95 transition-all whitespace-nowrap flex items-center gap-2 self-stretch md:self-auto justify-center"
        >
          <RefreshCw className="w-4 h-4" /> 重新補繳證件
        </button>
      </div>
    );
  }

  // 3. 審核中 (PENDING)
  if (kyc_status === "PENDING") {
    return (
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-2 border-amber-500/30 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in slide-in-from-top-4 duration-300">
        <div className="flex items-start gap-4">
          <div className="p-3.5 bg-amber-500 text-white rounded-2xl shadow-lg shadow-amber-200 shrink-0">
            <Clock className="w-6 h-6 animate-spin-slow" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-black text-base text-amber-800">⏳ KYC 實名認證審核中</h3>
              <span className="text-[10px] font-black bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full uppercase">
                PENDING
              </span>
            </div>
            <p className="text-xs font-bold text-amber-700">
              您的身分證件已安全加密送交銀行合規人員審查，通常需 1 個工作天內完成。
            </p>
            <p className="text-[11px] text-slate-500 font-medium">
              審核通過後，系統將自動為您部署鏈上身分 (OnchainID) 並開通下單買賣權限。您目前可先行瀏覽市場與接收通知。
            </p>
          </div>
        </div>
        <button
          onClick={onOpenResubmit}
          className="px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black text-xs shadow-lg shadow-slate-200 hover:scale-[1.02] active:scale-95 transition-all whitespace-nowrap flex items-center gap-2 self-stretch md:self-auto justify-center"
        >
          <Upload className="w-4 h-4" /> 更換／補交證件
        </button>
      </div>
    );
  }

  // 4. 未上傳證件 (UNSUBMITTED)
  return (
    <div className="bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent border-2 border-blue-500/30 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in slide-in-from-top-4 duration-300">
      <div className="flex items-start gap-4">
        <div className="p-3.5 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-200 shrink-0">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-base text-blue-900">🛡️ 尚未完成 KYC 實名認證</h3>
            <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full uppercase">
              UNSUBMITTED
            </span>
          </div>
          <p className="text-xs font-bold text-blue-700">
            您已成功建立投資人帳戶！請上傳雙證件以開通 RWA 房產合規交易權限。
          </p>
          <p className="text-[11px] text-slate-500 font-medium">
            未完成認證前僅能瀏覽即時市場行情與接收系統公告，無法進行買賣下單。
          </p>
        </div>
      </div>
      <button
        onClick={onOpenResubmit}
        className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs shadow-lg shadow-blue-200 hover:scale-[1.02] active:scale-95 transition-all whitespace-nowrap flex items-center gap-2 self-stretch md:self-auto justify-center"
      >
        <Upload className="w-4 h-4" /> 立即上傳雙證件
      </button>
    </div>
  );
}
