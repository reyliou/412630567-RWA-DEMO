import React, { createContext, useContext, useState, useEffect } from 'react';

interface HeartbeatContextType {
  tick: number; // 從啟動開始累計的秒數
}

const HeartbeatContext = createContext<HeartbeatContextType>({ tick: 0 });

export const useHeartbeat = () => useContext(HeartbeatContext);

export const HeartbeatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 1000); // 基準節奏：每 1 秒跳動一次

    return () => clearInterval(interval);
  }, []);

  return (
    <HeartbeatContext.Provider value={{ tick }}>
      {children}
    </HeartbeatContext.Provider>
  );
};
