import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { RequestType } from '../App';
import { useAuth } from './AuthContext';

export interface ChatMessage {
  id: number;
  sender: string;
  content: string;
  timestamp: Date;
}

interface SystemControlContextType {
  isPaused: boolean;
  throttleStartTime: Date | null;
  isModalOpen: boolean;
  activeRequest: RequestType;
  requestReason: string;
  unreadCount: number;
  chatMessages: ChatMessage[];
  openChat: () => void;
  closeChat: () => void;
  triggerRequest: (type: RequestType, reason: string) => void;
  executeOperation: (onLog: (type: 'info'|'warning'|'error'|'success', msg: string) => void) => void;
  sendMessage: (sender: string, content: string) => Promise<void>;
}

const SystemControlContext = createContext<SystemControlContextType | undefined>(undefined);

export function SystemControlProvider({ children }: { children: ReactNode }) {
  const { apiFetch } = useAuth();
  const [isPaused, setIsPaused] = useState(false);
  const [throttleStartTime, setThrottleStartTime] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeRequest, setActiveRequest] = useState<RequestType>("NONE");
  const [requestReason, setRequestReason] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // 定期輪詢獲取最新聊天紀錄
  useEffect(() => {
    let timer: any;
    if (isModalOpen) {
      const fetchChat = async () => {
        try {
          const res = await apiFetch('/api/chat');
          if (res.ok) {
            const data = await res.json();
            setChatMessages(data.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            })));
          }
        } catch (e) {
          console.error("Failed to fetch chat");
        }
      };
      fetchChat(); // 立即抓一次
      timer = setInterval(fetchChat, 2000); // 每 2 秒抓一次
    }
    return () => clearInterval(timer);
  }, [isModalOpen, apiFetch]);

  const openChat = () => {
    setIsModalOpen(true);
    setUnreadCount(0);
  };

  const closeChat = () => setIsModalOpen(false);

  const sendMessage = async (sender: string, content: string) => {
    try {
      await apiFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender, content })
      });
      // 樂觀更新 (Optimistic UI)
      setChatMessages(prev => [...prev, { id: Date.now(), sender, content, timestamp: new Date() }]);
    } catch (e) {
      console.error("Failed to send message");
    }
  };

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
      isPaused, throttleStartTime, isModalOpen, activeRequest, requestReason, unreadCount, chatMessages,
      openChat, closeChat, triggerRequest, executeOperation, sendMessage
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
