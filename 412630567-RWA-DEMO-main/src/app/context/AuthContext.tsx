import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { AppMode } from '../App';
import { API_BASE_URL } from '../config';

interface AuthContextType {
  isLoggedIn: boolean;
  userName: string;
  userId: number | null;
  appMode: AppMode;
  token: string | null;
  isWhitelisted: boolean;
  kycStatus: string;
  refreshProfile: () => Promise<void>;
  login: (mode: AppMode, name: string, dbId: number, jwtToken: string, isWhitelisted?: boolean, kycStatus?: string) => void;
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
  const [isWhitelisted, setIsWhitelisted] = useState(false);
  const [kycStatus, setKycStatus] = useState<string>("UNSUBMITTED");

  const refreshProfile = useCallback(async () => {
    const currentToken = token || localStorage.getItem('rwa_jwt');
    if (!currentToken) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/profile/me`, {
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setIsWhitelisted(!!data.is_whitelisted);
        setKycStatus(data.kyc_status || 'UNSUBMITTED');
        
        const storedUser = localStorage.getItem('rwa_user');
        if (storedUser) {
          const userObj = JSON.parse(storedUser);
          userObj.is_whitelisted = data.is_whitelisted;
          userObj.kyc_status = data.kyc_status;
          localStorage.setItem('rwa_user', JSON.stringify(userObj));
        }
      }
    } catch (e) {
      console.warn("無法刷新個人權限狀態");
    }
  }, [token]);

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
      setIsWhitelisted(!!user.is_whitelisted);
      setKycStatus(user.kyc_status || 'UNSUBMITTED');
      setIsLoggedIn(true);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn && token) {
      refreshProfile();
    }
  }, [isLoggedIn, token, refreshProfile]);

  const login = (
    mode: AppMode, 
    name: string, 
    dbId: number, 
    jwtToken: string, 
    userIsWhitelisted?: boolean, 
    userKycStatus?: string
  ) => {
    setUserName(name);
    setUserId(dbId);
    setAppMode(mode);
    setToken(jwtToken);
    setIsWhitelisted(!!userIsWhitelisted);
    setKycStatus(userKycStatus || 'UNSUBMITTED');
    setIsLoggedIn(true);
    
    // 儲存至 localStorage，實現持久登入
    localStorage.setItem('rwa_jwt', jwtToken);
    localStorage.setItem('rwa_user', JSON.stringify({ 
      id: dbId, 
      username: name, 
      role: mode,
      is_whitelisted: !!userIsWhitelisted,
      kyc_status: userKycStatus || 'UNSUBMITTED'
    }));
  };

  const logout = useCallback(() => {
    setIsLoggedIn(false);
    setUserName("");
    setUserId(null);
    setAppMode("TECHNICAL");
    setToken(null);
    setIsWhitelisted(false);
    setKycStatus("UNSUBMITTED");
    localStorage.removeItem('rwa_jwt');
    localStorage.removeItem('rwa_user');
  }, []);

  // 登入狀態下的心跳探針 (Heartbeat)：每 10 秒檢查一次伺服器是否在線
  useEffect(() => {
    if (!isLoggedIn || !token) return;

    const intervalId = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/properties`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.status === 401 || res.status === 403) {
          logout();
        }
      } catch (e) {
        console.warn('[HEARTBEAT FAILED] 偵測到後端伺服器已關閉，執行強制踢出...');
        logout();
        alert('🚨 伺服器連線已中斷（後端已關閉），系統已將您安全登出！');
      }
    }, 10000);

    return () => clearInterval(intervalId);
  }, [isLoggedIn, token, logout]);

  // 封裝一個自定義的 apiFetch，自動幫所有請求帶上 JWT Token 與斷線攔截
  const apiFetch = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    
    try {
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
    } catch (networkErr: any) {
      console.error(`[NETWORK ERROR] 無法連線至伺服器 ${endpoint}:`, networkErr);
      if (isLoggedIn) {
        logout();
        alert('🚨 伺服器連線已中斷（後端已關閉），系統已將您安全登出！');
      }
      throw networkErr;
    }
  }, [token, logout, isLoggedIn]);

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
