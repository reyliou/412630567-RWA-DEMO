import { Users, Search, MoreVertical, ShieldAlert, ShieldCheck, UserMinus, UserCheck, Mail, Activity } from "lucide-react";
import { useState, useEffect } from "react";

interface UserData {
  id: string;
  name: string;
  email: string;
  status: "Whitelisted" | "Blacklisted";
  txStatus: "正常" | "交易異常" | "無法交易";
  joined: string;
}

export function UserManagementCard() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [openMenuId, setOpenMenuMenuId] = useState<string | null>(null);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/users');
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
      const response = await fetch(`http://localhost:3001/api/users/${id}/whitelist`, {
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
    </div>
  );
}
