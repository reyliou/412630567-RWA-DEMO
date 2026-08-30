// 本地開發時自動連線至本地 NestJS (port 3001)，線上部署時連線至雲端 Render
export const API_BASE_URL =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3001'
    : 'https://four12630567-rwa-demo.onrender.com';
