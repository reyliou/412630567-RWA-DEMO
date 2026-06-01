// 自動偵測目前的後端網址 (使用 window.location 進行瀏覽器端動態判斷)
export const API_BASE_URL = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:3001' 
  : 'https://four12630567-rwa-demo.onrender.com';
