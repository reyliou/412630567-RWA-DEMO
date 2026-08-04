import { Users, Search, MoreVertical, ShieldAlert, ShieldCheck, UserMinus, UserCheck, Mail, Activity, IdCard, X, Key, Lock, Unlock } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

interface UserData {
  id: string;
  name: string;
  email: string;
  status: "Whitelisted" | "Blacklisted";
  txStatus: "正常" | "交易異常" | "無法交易";
  joined: string;
}

export function UserManagementCard() {
  const { apiFetch } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [openMenuId, setOpenMenuMenuId] = useState<string | null>(null);
  const [kycUser, setKycUser] = useState<UserData | null>(null);
  const [decryptionKey, setDecryptionKey] = useState("");
  const [isDecrypted, setIsDecrypted] = useState(false);
  const [decryptionError, setDecryptionError] = useState("");
  const [frontImageUrl, setFrontImageUrl] = useState("https://images.unsplash.com/photo-1633265486064-086b219458ce?w=800&q=80");
  const [backImageUrl, setBackImageUrl] = useState("https://images.unsplash.com/photo-1614064641913-6b70fc8cb2c1?w=800&q=80");

  const closeKycModal = () => {
    setKycUser(null);
    setIsDecrypted(false);
    setDecryptionKey("");
    setDecryptionError("");
    setFrontImageUrl("https://images.unsplash.com/photo-1633265486064-086b219458ce?w=800&q=80");
    setBackImageUrl("https://images.unsplash.com/photo-1614064641913-6b70fc8cb2c1?w=800&q=80");
  };

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const response = await apiFetch(`/api/users`);
        if (response.ok) {
          const data = await response.json();
          // 資料庫欄位對齊：將 is_whitelisted 映射到 status
          const mappedData = data.map((u: any) => ({
            id: u.id.toString(),
            name: u.username,
            email: u.email || 'N/A',
            status: u.is_whitelisted ? "Whitelisted" : "Blacklisted",
            txStatus: u.is_whitelisted ? "正常" : "無法交易",
            joined: "2026-04-20" // 這裡可以根據實務需求從資料庫抓取
          }));
          setUsers(mappedData);
        }
      } catch (e) {
        console.error("無法加載真實用戶資料，請確保後端伺服器已啟動");
      }
    };
    loadUsers();
  }, []);

  const toggleStatus = async (id: string) => {
    const user = users.find(u => u.id === id);
    if (!user) return;

    const newWhitelisted = user.status === "Blacklisted";
    
    try {
      // 呼叫後端 API 進行真實更新，這會觸發 ISO 合規日誌
      const response = await apiFetch(`/api/users/${id}/whitelist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          is_whitelisted: newWhitelisted,
          reason: "Manual review by Banker Admin" // 符合 ISO 溯源要求
        })
      });

      if (response.ok) {
        setUsers(prevUsers => 
          prevUsers.map(u => {
            if (u.id === id) {
              return { 
                ...u, 
                status: newWhitelisted ? "Whitelisted" : "Blacklisted",
                txStatus: newWhitelisted ? "正常" : "無法交易"
              };
            }
            return u;
          })
        );
      }
    } catch (e) {
      alert("資料庫更新失敗");
    }
    setOpenMenuMenuId(null);
  };

  const getTxStatusBadge = (status: UserData["txStatus"]) => {
    switch (status) {
      case "正常": 
        return <span className="px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs font-black">正常</span>;
      case "交易異常": 
        return <span className="px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg text-xs font-black animate-pulse">交易異常!</span>;
      case "無法交易": 
        return <span className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-black">無法交易</span>;
    }
  };

  return (
    <div className="bg-white border border-border rounded-[2.5rem] shadow-sm flex flex-col transition-all duration-500 ring-1 ring-slate-100 relative">
      <div className="p-8 border-b border-border bg-slate-50 flex items-center justify-between rounded-t-[2.5rem]">
        <h3 className="font-black flex items-center gap-3 text-slate-800 text-xl uppercase tracking-tight">
          <Users className="w-8 h-8 text-blue-600" />
          KYC 已認證用戶註冊表
        </h3>
        <div className="relative group">
          <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
          <input 
            type="text" 
            placeholder="搜尋用戶姓名或 Email..." 
            className="pl-12 pr-6 py-3 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-blue-600/10 transition-all font-black text-slate-700 w-80 shadow-sm"
          />
        </div>
      </div>

      <div className="overflow-visible"> {/* 關鍵修正：改為 overflow-visible 避免遮擋選單 */}
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50/50 border-b border-border">
            <tr>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">用戶 ID</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">姓名</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">電子郵件</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">認證狀態</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">交易狀態</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right pr-12">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50/80 transition-all group">
                <td className="px-8 py-8 font-mono text-xs font-black text-slate-400 uppercase">{user.id}</td>
                <td className="px-8 py-8">
                  {/* 關鍵修正：whitespace-nowrap 確保姓名不換行 */}
                  <div className="font-black text-slate-800 text-lg whitespace-nowrap">{user.name}</div>
                </td>
                <td className="px-8 py-8">
                   <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                      <Mail className="w-4 h-4 opacity-30" />
                      {user.email}
                   </div>
                </td>
                <td className="px-8 py-8 text-center">
                  <div className={`inline-flex items-center gap-2 text-xs font-black px-4 py-2 rounded-full border ${user.status === 'Whitelisted' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                    {user.status === 'Whitelisted' ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                    {user.status}
                  </div>
                </td>
                <td className="px-8 py-8 text-center">
                   {getTxStatusBadge(user.txStatus)}
                </td>
                <td className="px-8 py-8 text-right pr-12 relative">
                  <button 
                    onClick={() => setOpenMenuMenuId(openMenuId === user.id ? null : user.id)}
                    className="p-3 hover:bg-slate-200 rounded-xl transition-all text-slate-400 group-hover:text-slate-800"
                  >
                    <MoreVertical className="w-6 h-6" />
                  </button>

                  {/* 關鍵修正：提高 z-index 並調整位置 */}
                  {openMenuId === user.id && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setOpenMenuMenuId(null)} />
                      <div className="absolute right-12 top-20 w-60 bg-white border border-border shadow-2xl rounded-[1.5rem] z-50 p-3 animate-in zoom-in-95 duration-200 ring-1 ring-slate-100">
                         <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest px-4 py-2 border-b border-slate-50 mb-2">Security Control</div>
                         <button 
                           onClick={() => toggleStatus(user.id)}
                           className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-black transition-all ${
                             user.status === 'Whitelisted' 
                               ? 'text-red-600 hover:bg-red-50' 
                               : 'text-green-600 hover:bg-green-50'
                           }`}
                         >
                           {user.status === 'Whitelisted' ? (
                             <><UserMinus className="w-5 h-5" /> 設為黑名單</>
                           ) : (
                             <><UserCheck className="w-5 h-5" /> 移回白名單</>
                           )}
                         </button>
                         <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-black text-slate-400 hover:bg-slate-50 mt-1">
                            <Activity className="w-5 h-5" /> 用戶交易分析
                         </button>
                         <button 
                           onClick={() => {
                             setKycUser(user);
                             setOpenMenuMenuId(null);
                             setIsDecrypted(false);
                             setDecryptionKey("");
                             setDecryptionError("");
                             setFrontImageUrl("https://images.unsplash.com/photo-1633265486064-086b219458ce?w=800&q=80");
                             setBackImageUrl("https://images.unsplash.com/photo-1614064641913-6b70fc8cb2c1?w=800&q=80");
                           }} 
                           className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-black text-blue-600 hover:bg-blue-50 mt-1"
                         >
                            <IdCard className="w-5 h-5" /> 審核 KYC 證件
                         </button>
                      </div>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="p-6 bg-slate-50/50 border-t border-border rounded-b-[2.5rem] text-center">
         <button className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] hover:text-blue-600 transition-colors">
            End of User Registry
         </button>
      </div>

      {/* KYC 證件審核 Modal */}
      {kycUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeKycModal} />
          <div className="relative w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
                  {isDecrypted ? <Unlock className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800">KYC 雙證件審核 (已加密)</h2>
                  <p className="text-sm font-bold text-slate-400 mt-1">用戶：{kycUser.name} ({kycUser.email})</p>
                </div>
              </div>
              <button onClick={closeKycModal} className="p-3 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-xl transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* 解密操作區 */}
            <div className="px-8 py-4 bg-blue-50/50 border-b border-blue-100 flex items-center justify-between">
               <div className="flex items-center gap-3 w-full max-w-md">
                 <div className="relative flex-1">
                   <Key className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                   <input 
                     type="password" 
                     value={decryptionKey}
                     onChange={(e) => setDecryptionKey(e.target.value)}
                     placeholder="輸入資料庫密鑰解密證件..." 
                     className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 text-sm font-black focus:ring-4 focus:ring-blue-500/20 outline-none transition-all"
                   />
                 </div>
                 <button 
                   onClick={async () => {
                     try {
                       // 【安全考量】絕對不能在前端寫死資料庫密碼！
                       // 專題 Demo 邏輯：呼叫後端 API 進行真實的密鑰驗證與解密
                       // 這是 100% 真實的全端系統驗證，密鑰不會寫死在前端，並會在資料庫留下 Security Audit Log
                       const response = await apiFetch(`/api/kyc/${kycUser?.id}/decrypt`, {
                         method: 'POST',
                         headers: { 'Content-Type': 'application/json' },
                         body: JSON.stringify({ adminKey: decryptionKey })
                       });
                       
                       if (response.ok) {
                         const data = await response.json();
                         if (data.frontIdUrl) setFrontImageUrl(data.frontIdUrl);
                         if (data.backIdUrl) setBackImageUrl(data.backIdUrl);
                         setIsDecrypted(true);
                         setDecryptionError("");
                       } else {
                         setIsDecrypted(false);
                         setDecryptionError("資料庫密鑰錯誤，解密失敗！");
                       }
                     } catch (e) {
                       setIsDecrypted(false);
                       setDecryptionError("無法連線至加密伺服器");
                     }
                   }}
                   className={`px-6 py-3 text-white rounded-2xl text-sm font-black shadow-lg transition-all whitespace-nowrap flex items-center gap-2 ${isDecrypted ? 'bg-green-500 shadow-green-500/20' : 'bg-slate-800 hover:bg-slate-700 shadow-slate-800/20'}`}
                 >
                   {isDecrypted ? <><Unlock className="w-4 h-4"/> 已解密</> : <><Lock className="w-4 h-4"/> 解密影像</>}
                 </button>
               </div>
               {decryptionError && <div className="text-red-500 text-sm font-bold flex items-center gap-2 animate-in slide-in-from-right-2"><ShieldAlert className="w-5 h-5"/>{decryptionError}</div>}
            </div>

            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 bg-slate-50/30">
              <div className="space-y-4">
                <h3 className="font-black text-sm text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${isDecrypted ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></span>
                  身分證正面 (Front)
                </h3>
                <div className="aspect-[1.6/1] bg-slate-100 rounded-3xl overflow-hidden border-2 border-slate-200 shadow-inner relative group p-2 transition-all">
                  {!isDecrypted && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-200/50 backdrop-blur-3xl z-10 rounded-2xl m-2">
                       <Lock className="w-12 h-12 text-slate-400 mb-3" />
                       <span className="text-slate-500 font-black text-sm uppercase tracking-widest bg-white/50 px-4 py-2 rounded-xl">資料已加密</span>
                    </div>
                  )}
                  <img src={frontImageUrl} alt="Front ID" className={`w-full h-full object-cover rounded-2xl transition-all duration-1000 ${!isDecrypted ? 'opacity-30 grayscale blur-xl' : 'opacity-100'}`} />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent flex items-end p-6 rounded-3xl pointer-events-none">
                     <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10">
                        <span className="text-white font-bold text-xs">ID_FRONT_ENCRYPTED.enc</span>
                     </div>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="font-black text-sm text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${isDecrypted ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></span>
                  身分證反面 (Back)
                </h3>
                <div className="aspect-[1.6/1] bg-slate-100 rounded-3xl overflow-hidden border-2 border-slate-200 shadow-inner relative group p-2 transition-all">
                  {!isDecrypted && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-200/50 backdrop-blur-3xl z-10 rounded-2xl m-2">
                       <Lock className="w-12 h-12 text-slate-400 mb-3" />
                       <span className="text-slate-500 font-black text-sm uppercase tracking-widest bg-white/50 px-4 py-2 rounded-xl">資料已加密</span>
                    </div>
                  )}
                  <img src={backImageUrl} alt="Back ID" className={`w-full h-full object-cover rounded-2xl transition-all duration-1000 ${!isDecrypted ? 'opacity-30 grayscale blur-xl' : 'opacity-100'}`} />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent flex items-end p-6 rounded-3xl pointer-events-none">
                     <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10">
                        <span className="text-white font-bold text-xs">ID_BACK_ENCRYPTED.enc</span>
                     </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-8 py-6 bg-white border-t border-slate-100 flex justify-end gap-4 relative z-20">
              <button onClick={closeKycModal} className="px-6 py-3 rounded-2xl text-sm font-black text-slate-500 hover:bg-slate-100 transition-colors">取消</button>
              <button 
                onClick={() => {
                   if(isDecrypted){
                     toggleStatus(kycUser.id);
                     closeKycModal();
                   } else {
                     setDecryptionError("請先解密影像再進行審核！");
                   }
                }}
                className={`px-8 py-3 rounded-2xl text-sm font-black text-white shadow-lg transition-all flex items-center gap-2 ${!isDecrypted ? 'bg-slate-300 cursor-not-allowed shadow-none' : kycUser.status === 'Whitelisted' ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'}`}
              >
                {!isDecrypted ? (
                  <><Lock className="w-4 h-4" /> 鎖定中</>
                ) : kycUser.status === 'Whitelisted' ? (
                  <><ShieldAlert className="w-4 h-4" /> 撤銷認證 (設為黑名單)</>
                ) : (
                  <><ShieldCheck className="w-4 h-4" /> 核准認證 (移入白名單)</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
