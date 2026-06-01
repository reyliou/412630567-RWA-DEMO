import React, { createContext, useContext, useState, ReactNode } from 'react';
import { RequestType } from '../App';

interface SystemControlContextType {
  isPaused: boolean;
  throttleStartTime: Date | null;
  isModalOpen: boolean;
  activeRequest: RequestType;
  requestReason: string;
  unreadCount: number;
  openChat: () => void;
  closeChat: () => void;
  triggerRequest: (type: RequestType, reason: string) => void;
  executeOperation: (onLog: (type: 'info'|'warning'|'error'|'success', msg: string) => void) => void;
}

const SystemControlContext = createContext<SystemControlContextType | undefined>(undefined);

export function SystemControlProvider({ children }: { children: ReactNode }) {
  const [isPaused, setIsPaused] = useState(false);
  const [throttleStartTime, setThrottleStartTime] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeRequest, setActiveRequest] = useState<RequestType>("NONE");
  const [requestReason, setRequestReason] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  const openChat = () => {
    setIsModalOpen(true);
    setUnreadCount(0);
  };

  const closeChat = () => setIsModalOpen(false);

  const triggerRequest = (type: RequestType, reason: string) => {
    setActiveRequest(type);
    setRequestReason(reason);
    if (!isModalOpen) setUnreadCount(prev => prev + 1);
  };

  const executeOperation = (onLog: (type: 'info'|'warning'|'error'|'success', msg: string) => void) => {
    if (activeRequest === "PAUSE_REQUEST") {
      setIsPaused(true);
      setThrottleStartTime(null);
      onLog("warning", `技術負責人已授權：合約正式暫停。`);
    } else if (activeRequest === "UNPAUSE_REQUEST") {
      setIsPaused(false);
      setThrottleStartTime(new Date());
      onLog("success", `技術負責人已授權：系統恢復交易。`);
    }
    setActiveRequest("NONE");
    setIsModalOpen(false);
  };

  return (
    <SystemControlContext.Provider value={{
      isPaused, throttleStartTime, isModalOpen, activeRequest, requestReason, unreadCount,
      openChat, closeChat, triggerRequest, executeOperation
    }}>
      {children}
    </SystemControlContext.Provider>
  );
}

export function useSystemControl() {
  const context = useContext(SystemControlContext);
  if (context === undefined) {
    throw new Error('useSystemControl must be used within a SystemControlProvider');
  }
  return context;
}
