import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { AppMode } from '../App';
import { API_BASE_URL } from '../config';

interface AuthContextType {
  isLoggedIn: boolean;
  userName: string;
  userId: number | null;
  appMode: AppMode;
  token: string | null;
  login: (mode: AppMode, name: string, dbId: number, jwtToken: string) => void;
  logout: () => void;
  apiFetch: (endpoint: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState<number | null>(null);
  const [appMode, setAppMode] = useState<AppMode>("TECHNICAL");
  const [token, setToken] = useState<string | null>(null);

  // 初始化時從 localStorage 讀取 token
  useEffect(() => {
    const storedToken = localStorage.getItem('rwa_jwt');
    const storedUser = localStorage.getItem('rwa_user');
    if (storedToken && storedUser) {
      const user = JSON.parse(storedUser);
      setToken(storedToken);
      setUserId(user.id);
      setUserName(user.username);
      setAppMode(user.role as AppMode);
      setIsLoggedIn(true);
    }
  }, []);

  const login = (mode: AppMode, name: string, dbId: number, jwtToken: string) => {
    setUserName(name);
    setUserId(dbId);
    setAppMode(mode);
    setToken(jwtToken);
    setIsLoggedIn(true);
    
    // 儲存至 localStorage，實現持久登入
    localStorage.setItem('rwa_jwt', jwtToken);
    localStorage.setItem('rwa_user', JSON.stringify({ id: dbId, username: name, role: mode }));
  };

  const logout = useCallback(() => {
    setIsLoggedIn(false);
    setUserName("");
    setUserId(null);
    setAppMode("TECHNICAL");
    setToken(null);
    localStorage.removeItem('rwa_jwt');
    localStorage.removeItem('rwa_user');
  }, []);

  // 封裝一個自定義的 apiFetch，自動幫所有請求帶上 JWT Token
  const apiFetch = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers
    });
    
    // 如果 Token 過期或權限不足，自動登出
    if (response.status === 401 || response.status === 403) {
       console.error(`[AUTH ERROR] API request to ${endpoint} failed with status ${response.status}. Automatically logging out.`);
       logout();
    }
    return response;
  }, [token, logout]);

  return (
    <AuthContext.Provider value={{ isLoggedIn, userName, userId, appMode, token, login, logout, apiFetch }}>
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
