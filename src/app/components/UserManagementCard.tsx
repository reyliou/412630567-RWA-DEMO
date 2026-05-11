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
        const response = await fetch('/mock_sql/users.json');
        if (response.ok) {
          const data = await response.json();
          setUsers(data);
        }
      } catch (e) {
        console.error("無法加載用戶資料");
      }
    };
    loadUsers();
  }, []);

  const toggleStatus = (id: string) => {
    setUsers(prevUsers => 
      prevUsers.map(user => {
        if (user.id === id) {
          const newStatus = user.status === "Whitelisted" ? "Blacklisted" : "Whitelisted";
          return { ...user, status: newStatus };
        }
        return user;
      })
    );
    setOpenMenuMenuId(null);
  };

  const getTxStatusBadge = (status: UserData["txStatus"]) => {
    switch (status) {
      case "正常": 
        return <span className="px-5 py-2 bg-green-50 text-green-600 rounded-xl text-sm font-black uppercase tracking-widest shadow-sm">正常</span>;
      case "交易異常": 
        return <span className="px-5 py-2 bg-orange-50 text-orange-600 rounded-xl text-sm font-black uppercase animate-pulse shadow-sm">交易異常!</span>;
      case "無法交易": 
        return <span className="px-5 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-black uppercase tracking-tighter shadow-sm">無法交易</span>;
    }
  };

  return (
    <div className="bg-white border border-border rounded-[3rem] shadow-sm overflow-hidden flex flex-col transition-all duration-500 ring-1 ring-slate-100/50">
      <div className="p-10 border-b border-border bg-slate-50 flex items-center justify-between">
        <h3 className="font-black flex items-center gap-4 text-slate-800 text-2xl uppercase tracking-tight">
          <Users className="w-10 h-10 text-blue-600" />
          KYC 已認證用戶註冊表
        </h3>
        <div className="relative group">
          <Search className="absolute left-5 top-5 w-6 h-6 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
          <input 
            type="text" 
            placeholder="搜尋用戶姓名或 Email..." 
            className="pl-14 pr-8 py-5 bg-white border border-slate-200 rounded-2xl text-base outline-none focus:ring-4 focus:ring-blue-600/10 transition-all font-black text-slate-700 w-96"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50/80 border-b border-border">
            <tr>
              <th className="px-12 py-8 text-sm font-black text-slate-400 uppercase tracking-[0.2em]">用戶 ID</th>
              <th className="px-12 py-8 text-sm font-black text-slate-400 uppercase tracking-[0.2em]">姓名</th>
              <th className="px-12 py-8 text-sm font-black text-slate-400 uppercase tracking-[0.2em]">電子郵件</th>
              <th className="px-12 py-8 text-sm font-black text-slate-400 uppercase tracking-[0.2em] text-center">認證狀態</th>
              <th className="px-12 py-8 text-sm font-black text-slate-400 uppercase tracking-[0.2em] text-center">交易狀態</th>
              <th className="px-12 py-8 text-sm font-black text-slate-400 uppercase tracking-[0.2em] text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-12 py-10 font-mono text-sm font-black text-slate-400 tracking-wider">{user.id}</td>
                <td className="px-12 py-10">
                  <div className="font-black text-slate-800 text-2xl tracking-tighter">{user.name}</div>
                </td>
                <td className="px-12 py-10">
                   <div className="flex items-center gap-3 text-base font-bold text-slate-500">
                      <Mail className="w-5 h-5 opacity-40 text-blue-600" />
                      {user.email}
                   </div>
                </td>
                <td className="px-12 py-10 text-center">
                  <div className={`inline-flex items-center gap-3 text-sm font-black px-6 py-2.5 rounded-full shadow-sm ${user.status === 'Whitelisted' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                    {user.status === 'Whitelisted' ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
                    {user.status}
                  </div>
                </td>
                <td className="px-12 py-10 text-center">
                   {getTxStatusBadge(user.txStatus)}
                </td>
                <td className="px-12 py-10 text-right relative">
                  <button 
                    onClick={() => setOpenMenuMenuId(openMenuId === user.id ? null : user.id)}
                    className="p-4 hover:bg-slate-200 rounded-2xl transition-all text-slate-400 group-hover:text-slate-800"
                  >
                    <MoreVertical className="w-8 h-8" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
