import React, { createContext, useContext, useState, ReactNode } from 'react';
import { AppMode } from '../App';

interface AuthContextType {
  isLoggedIn: boolean;
  userName: string;
  userId: number | null;
  appMode: AppMode;
  login: (mode: AppMode, name: string, dbId?: number) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState<number | null>(null);
  const [appMode, setAppMode] = useState<AppMode>("TECHNICAL");

  const login = (mode: AppMode, name: string, dbId?: number) => {
    setUserName(name);
    setUserId(dbId || null);
    setAppMode(mode);
    setIsLoggedIn(true);
  };

  const logout = () => {
    setIsLoggedIn(false);
    setUserName("");
    setUserId(null);
    setAppMode("TECHNICAL");
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, userName, userId, appMode, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
