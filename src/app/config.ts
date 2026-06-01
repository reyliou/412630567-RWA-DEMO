// 自動偵測目前的後端網址
export const API_BASE_URL = import.meta.env.MODE === 'development' 
  ? 'http://localhost:3001' 
  : 'https://four12630567-rwa-demo.onrender.com';
