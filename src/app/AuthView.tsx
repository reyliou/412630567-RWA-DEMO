import { Shield, LogIn, UserPlus, Upload, CheckCircle, ArrowRight, User, Fingerprint, FileText, Mail, Phone, Loader2, Lock, Eye, EyeOff, RefreshCcw } from "lucide-react";
import { useState, useEffect } from "react";
import { AppMode } from "./App";

interface AuthViewProps {
  onLogin: (mode: AppMode, name: string) => void;
}

export function AuthView({ onLogin }: AuthViewProps) {
  const [view, setView] = useState<"LOGIN" | "REGISTER">("LOGIN");
  const [kycStep, setKycStep] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);

  // 預設帳號模擬 - 移除鑑價師
  const demoUsers = [
    { name: "廖偉哲", role: "TECHNICAL" as AppMode, label: "技術負責人", color: "bg-blue-600" },
    { name: "陳政齊", role: "BUSINESS" as AppMode, label: "業務值班行員", color: "bg-purple-600" },
    { name: "翁國祥", role: "INVESTOR" as AppMode, label: "實名認證投資人", color: "bg-slate-800" },
  ];

  useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleKycUpload = () => {
    setIsUploading(true);
    setTimeout(() => {
      setIsUploading(false);
      setKycStep(3);
    }, 2000);
  };

  const handleResendEmail = () => {
    setIsResending(true);
    setTimeout(() => {
      setIsResending(false);
      setResendCooldown(60);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 font-sans text-slate-900">
      <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden flex flex-col transition-all duration-500">
        
        <div className="p-12 pb-6 text-center border-b border-slate-50">
          <div className="w-24 h-24 bg-blue-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-blue-200 mb-8 mx-auto rotate-3 hover:rotate-0 transition-transform duration-500">
            <Shield className="w-14 h-14 text-white" />
          </div>
          <h1 className="text-5xl font-black tracking-tighter text-slate-800">RWA BANK</h1>
          <p className="text-slate-400 text-sm font-black uppercase tracking-[0.3em] mt-3 italic text-center">Secure Financial Terminal</p>
        </div>

        {view === "LOGIN" ? (
          <div className="px-12 py-12 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-4">
              <div className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Demo Quick Access</div>
              {demoUsers.map((user) => (
                <button
                  key={user.name}
                  onClick={() => onLogin(user.role, user.name)}
                  className="w-full group p-5 bg-slate-50 border border-slate-100 rounded-3xl flex items-center justify-between hover:bg-white hover:border-blue-300 hover:shadow-xl transition-all"
                >
                  <div className="flex items-center gap-5">
                    <div className={`w-14 h-14 ${user.color} rounded-2xl flex items-center justify-center text-white shadow-lg`}>
                      <User className="w-7 h-7" />
                    </div>
                    <div className="text-left">
                      <div className="font-black text-xl text-slate-800">{user.name}</div>
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-tighter">{user.label}</div>
                    </div>
                  </div>
                  <ArrowRight className="w-6 h-6 text-slate-300 group-hover:text-blue-600 transition-colors" />
                </button>
              ))}
            </div>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
              <div className="relative flex justify-center text-xs uppercase font-black text-slate-300"><span className="bg-white px-4">或使用帳號密碼登入</span></div>
            </div>

            <div className="space-y-4">
              <div className="space-y-3">
                <input type="text" placeholder="Email / Phone Number" className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-600/20 transition-all font-bold text-lg" />
                <div className="relative group">
                  <input type={showPassword ? "text" : "password"} placeholder="Password" className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-600/20 transition-all font-bold text-lg" />
                  <button onClick={() => setShowPassword(!showPassword)} className="absolute right-6 top-5 text-slate-300 hover:text-slate-600 transition-colors">{showPassword ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}</button>
                </div>
              </div>
              <button className="w-full py-6 bg-slate-800 text-white rounded-3xl font-black text-xl flex items-center justify-center gap-3 hover:opacity-90 active:scale-95 transition-all shadow-xl shadow-slate-200">
                <LogIn className="w-6 h-6" /> 進入系統
              </button>
            </div>
            <div className="text-center pt-4">
              <span className="text-sm text-slate-400 font-bold">尚未擁有帳戶？</span>
              <button onClick={() => setView("REGISTER")} className="text-sm font-black text-blue-600 hover:underline ml-2">立即註冊 KYC</button>
            </div>
          </div>
        ) : (
          <div className="px-12 py-12 space-y-8 animate-in fade-in slide-in-from-right-6 duration-500">
            <div className="flex items-center justify-between px-8">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black transition-colors ${kycStep >= s ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-300'}`}>
                    {kycStep > s ? <CheckCircle className="w-6 h-6" /> : s}
                  </div>
                  {s < 3 && <div className={`w-16 h-1 ${kycStep > s ? 'bg-blue-600' : 'bg-slate-100'}`} />}
                </div>
              ))}
            </div>

            {kycStep === 1 && (
              <div className="space-y-6 animate-in fade-in">
                <div className="text-center"><h3 className="text-3xl font-black text-slate-800 tracking-tight text-center">建立個人帳戶</h3><p className="text-sm text-slate-400 mt-2 font-bold uppercase tracking-widest text-center">Step 1: Account Info</p></div>
                <div className="grid grid-cols-1 gap-4 text-center">
                  <div className="relative group text-left"><User className="absolute left-5 top-5 w-5 h-5 text-slate-400" /><input type="text" placeholder="真實姓名 (與身分證一致)" className="w-full pl-14 pr-6 py-5 bg-slate-50 border border-slate-100 rounded-3xl outline-none focus:ring-2 focus:ring-blue-600/20 font-bold" /></div>
                  <div className="grid grid-cols-2 gap-4 text-left">
                    <div className="relative"><Mail className="absolute left-5 top-5 w-5 h-5 text-slate-400" /><input type="email" placeholder="電子郵件" className="w-full pl-14 pr-6 py-5 bg-slate-50 border border-slate-100 rounded-3xl outline-none focus:ring-2 focus:ring-blue-600/20 font-bold" /></div>
                    <div className="relative"><Phone className="absolute left-5 top-5 w-5 h-5 text-slate-400" /><input type="tel" pattern="09[0-9]{8}" placeholder="手機號碼 (09...)" className="w-full pl-14 pr-6 py-5 bg-slate-50 border border-slate-100 rounded-3xl outline-none focus:ring-2 focus:ring-blue-600/20 font-bold" /></div>
                  </div>
                  <div className="relative text-left">
                    <Lock className="absolute left-5 top-5 w-5 h-5 text-slate-400" />
                    <input type={showPassword ? "text" : "password"} placeholder="設定登入密碼" className="w-full pl-14 pr-14 py-5 bg-slate-50 border border-slate-100 rounded-3xl outline-none focus:ring-2 focus:ring-blue-600/20 font-bold" />
                    <button onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-5 text-slate-300 hover:text-slate-600">{showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
                  </div>
                  <div className="relative text-left"><Fingerprint className="absolute left-5 top-5 w-5 h-5 text-slate-400" /><input type="text" placeholder="身分證字號" className="w-full pl-14 pr-6 py-5 bg-slate-50 border border-slate-100 rounded-3xl outline-none focus:ring-2 focus:ring-blue-600/20 font-bold uppercase" /></div>
                </div>
                <button onClick={() => setKycStep(2)} className="w-full py-6 bg-blue-600 text-white rounded-3xl font-black text-xl shadow-xl shadow-blue-200 mt-4 uppercase">下一步: 證件上傳</button>
              </div>
            )}

            {kycStep === 2 && (
              <div className="space-y-6 animate-in fade-in">
                <div className="text-center"><h3 className="text-3xl font-black text-slate-800">證件影像上傳</h3><p className="text-sm text-slate-400 mt-2 font-bold uppercase tracking-widest">Step 2: ID Verification</p></div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="aspect-square bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center p-6 group hover:bg-blue-50 transition-all cursor-pointer">
                    <div className="w-16 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform"><FileText className="w-8 h-8 text-blue-500" /></div>
                    <span className="text-xs font-black text-slate-800 mb-1 text-center">身分證正面</span><span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded uppercase">僅支援 .JPG 格式</span>
                  </div>
                  <div className="aspect-square bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center p-6 group hover:bg-blue-50 transition-all cursor-pointer">
                    <div className="w-16 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform"><FileText className="w-8 h-8 text-blue-500" /></div>
                    <span className="text-xs font-black text-slate-800 mb-1 text-center">身分證背面</span><span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded uppercase">僅支援 .JPG 格式</span>
                  </div>
                </div>
                <div className="p-5 bg-amber-50 border border-amber-200 rounded-[1.5rem] flex items-start gap-4"><div className="p-2 bg-amber-200 rounded-lg text-amber-700"><Shield className="w-5 h-5" /></div><p className="text-xs text-amber-800 leading-relaxed font-bold">資訊安全提示：影像將加密處理。請確保影像無反光且文字清晰。</p></div>
                <button onClick={handleKycUpload} disabled={isUploading} className="w-full py-6 bg-blue-600 text-white rounded-3xl font-black text-xl flex items-center justify-center gap-3 shadow-xl shadow-blue-200 disabled:opacity-50">
                  {isUploading ? <Loader2 className="w-7 h-7 animate-spin" /> : <Upload className="w-6 h-6" />}
                  {isUploading ? "正在上傳..." : "確認並提交審核"}
                </button>
              </div>
            )}

            {kycStep === 3 && (
              <div className="space-y-8 animate-in zoom-in duration-500 text-center py-6">
                <div className="w-32 h-32 bg-green-500 rounded-[2.5rem] flex items-center justify-center text-white mx-auto shadow-2xl shadow-green-200 animate-bounce">
                  <CheckCircle className="w-16 h-16" />
                </div>
                <div>
                  <h3 className="text-4xl font-black text-slate-800 tracking-tighter">申請已受理</h3>
                  <p className="text-slate-500 mt-6 text-sm font-medium px-4 leading-relaxed">您的資料已提交成功！我們已發送確認信至您的信箱。<br/>請於 24 小時內注意系統通知。</p>
                </div>
                <div className="pt-4 border-t border-slate-100 mt-6">
                   <p className="text-xs text-slate-400 font-bold mb-3 uppercase tracking-widest text-center">沒有收到郵件？</p>
                   <button onClick={handleResendEmail} disabled={resendCooldown > 0 || isResending} className="flex items-center gap-2 mx-auto text-sm font-black text-blue-600 hover:text-blue-700 transition-colors disabled:text-slate-300">
                     {isResending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className={`w-4 h-4 ${resendCooldown > 0 ? '' : 'animate-in'}`} />}
                     {resendCooldown > 0 ? `再次發送確認信 (${resendCooldown}s)` : "立即重新發送一次"}
                   </button>
                </div>
                <button onClick={() => setView("LOGIN")} className="w-full py-6 bg-slate-800 text-white rounded-3xl font-black text-xl mt-4">返回登入畫面</button>
              </div>
            )}

            {kycStep < 3 && (
              <button onClick={() => setView("LOGIN")} className="w-full text-lg font-black text-slate-400 hover:text-red-500 transition-colors py-2 uppercase tracking-tighter text-center">取消註冊並返回</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
