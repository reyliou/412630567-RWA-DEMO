import { X, Lock, Key, CheckCircle2, ShieldCheck } from "lucide-react";
import { useState } from "react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
}

export function SettingsModal({ isOpen, onClose, userName }: SettingsModalProps) {
  const [step, setStep] = useState(1);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = () => {
    setIsUpdating(true);
    setTimeout(() => {
      setIsUpdating(false);
      setStep(2);
    }, 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-[2.5rem] border border-slate-200 max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-slate-800 rounded-2xl flex items-center justify-center text-white shadow-lg">
                <Lock className="w-5 h-5" />
             </div>
             <div>
                <h3 className="font-black text-sm text-slate-800">帳戶安全設定</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">User: {userName}</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        {step === 1 ? (
          <div className="p-8 space-y-6">
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">當前密碼</label>
                <input type="password" placeholder="請輸入舊密碼" className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-slate-200 mt-1 font-bold" />
              </div>
              <div className="h-px bg-slate-100 my-2" />
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">新密碼</label>
                <input type="password" placeholder="請輸入新密碼" className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-slate-200 mt-1 font-bold" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">確認新密碼</label>
                <input type="password" placeholder="再次輸入新密碼" className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-slate-200 mt-1 font-bold" />
              </div>
            </div>

            <button 
              onClick={handleUpdate}
              disabled={isUpdating}
              className="w-full py-5 bg-slate-800 text-white rounded-[1.5rem] font-black text-lg shadow-xl shadow-slate-200 hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {isUpdating ? <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span> : <Key className="w-5 h-5" />}
              更新安全密碼
            </button>
          </div>
        ) : (
          <div className="p-12 text-center space-y-6 animate-in fade-in zoom-in duration-500">
             <div className="w-20 h-20 bg-green-500 rounded-[2rem] flex items-center justify-center text-white mx-auto shadow-xl shadow-green-100">
                <ShieldCheck className="w-10 h-10" />
             </div>
             <div>
                <h4 className="text-2xl font-black text-slate-800">密碼修改成功</h4>
                <p className="text-sm text-slate-400 mt-2 font-medium">您的帳戶安全設定已更新，<br/>下次登入請使用新密碼。</p>
             </div>
             <button onClick={onClose} className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black transition-colors">
                關閉視窗
             </button>
          </div>
        )}
      </div>
    </div>
  );
}
