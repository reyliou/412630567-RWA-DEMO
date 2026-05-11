import { Bell, CheckCircle2, TrendingUp, TrendingDown, X, Building2 } from "lucide-react";
import { useState } from "react";

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    { 
      id: 1, 
      type: "BUY_MATCH", 
      title: "限價買入委託已成交", 
      content: "您委託以 $17540.82 買入 曉陽明2 的 12 枚代幣已全部成交。", 
      time: "10 分鐘前", 
      unread: true 
    },
    { 
      id: 2, 
      type: "SELL_MATCH", 
      title: "限價賣出委託已成交", 
      content: "您委託以 $1822.50 賣出 東騰元町 的 5 枚代幣已完成撮合。", 
      time: "2 小時前", 
      unread: false 
    }
  ]);

  const unreadCount = notifications.filter(n => n.unread).length;

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2.5 bg-muted/50 rounded-xl hover:bg-slate-200 transition-all relative group"
      >
        <Bell className={`w-6 h-6 ${unreadCount > 0 ? 'text-blue-600 animate-swing' : 'text-slate-400'}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-lg">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-4 w-96 bg-white border border-border rounded-[2.5rem] shadow-2xl z-50 overflow-hidden animate-in slide-in-from-top-4 duration-300">
            <div className="p-6 border-b border-border bg-slate-50/50 flex justify-between items-center">
               <h3 className="font-black text-sm text-slate-800 uppercase tracking-widest">系統通知中心</h3>
               <button onClick={() => setNotifications(n => n.map(x => ({...x, unread: false})))} className="text-[10px] font-black text-blue-600 hover:underline">全部標記已讀</button>
            </div>
            
            <div className="max-h-[400px] overflow-y-auto divide-y divide-slate-50">
               {notifications.map(n => (
                 <div key={n.id} className={`p-6 hover:bg-slate-50 transition-colors flex gap-4 ${n.unread ? 'bg-blue-50/30' : ''}`}>
                    <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center ${n.type === 'BUY_MATCH' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                       {n.type === 'BUY_MATCH' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                    </div>
                    <div className="space-y-1">
                       <div className="flex justify-between items-start">
                          <p className="font-black text-sm text-slate-800 leading-none">{n.title}</p>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">{n.time}</span>
                       </div>
                       <p className="text-xs text-slate-500 leading-relaxed">{n.content}</p>
                    </div>
                 </div>
               ))}
            </div>

            <div className="p-4 bg-slate-50 border-t border-border text-center">
               <button className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hover:text-slate-800">查看所有歷史通知</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
