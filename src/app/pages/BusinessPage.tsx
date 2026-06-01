import React from "react";
import { PropertyOversightCard } from "../components/PropertyOversightCard";
import { StaffStatusCard } from "../components/StaffStatusCard";
import { ThrottleTimerCard } from "../components/ThrottleTimerCard";
import { UserManagementCard } from "../components/UserManagementCard";
import { useSystemControl } from "../context/SystemControlContext";
import { useAuth } from "../context/AuthContext";

export function BusinessPage() {
  const { userName } = useAuth();
  const { activeRequest, isPaused, throttleStartTime, openChat } = useSystemControl();

  return (
    <div className="space-y-10 animate-in fade-in duration-500 text-slate-800">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
         <div className="lg:col-span-3"><PropertyOversightCard /></div>
         <div className="lg:col-span-1"><StaffStatusCard onOpenChat={openChat} hasRequest={activeRequest !== "NONE"} isBankerView={true} userName={userName} requestType={activeRequest} /></div>
      </div>
      <ThrottleTimerCard isActive={!isPaused} startTime={throttleStartTime} />
      <UserManagementCard />
    </div>
  );
}
