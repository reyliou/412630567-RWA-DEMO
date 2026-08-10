/**
 * 效能測試 (Performance Test) — k6 壓力測試腳本
 * -------------------------------------------------------------
 * 對應圖表相關的兩支高風險 API：
 *   - GET /api/klines/:id      （查詢無上限的那個，已知風險點）
 *   - GET /api/orderbook/:id   （掛單簿）
 *
 * 安裝 k6（在你自己的電腦上，不是在這個對話的沙盒環境）：
 *   macOS:   brew install k6
 *   Windows: choco install k6 或 winget install k6
 *   Linux:   參考 https://k6.io/docs/get-started/installation/
 *
 * 執行方式：
 *   k6 run tests/perf/k6-loadtest.js \
 *     -e BASE_URL=http://localhost:3000 \
 *     -e PROPERTY_ID=1 \
 *     -e TOKEN=你登入後拿到的JWT
 * -------------------------------------------------------------
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const PROPERTY_ID = __ENV.PROPERTY_ID || '1';
const TOKEN = __ENV.TOKEN || '';

const klineDuration = new Trend('kline_duration_ms');
const orderbookDuration = new Trend('orderbook_duration_ms');

// 漸進式加壓：1 -> 10 -> 50 個併發使用者，觀察延遲隨併發數的變化曲線
export const options = {
  scenarios: {
    ramping_load: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 50 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    // 依你們期末報告的目標自行調整，這裡先抓一個合理起點：
    // 95% 的請求應在 500ms 內完成，錯誤率應低於 1%
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

const headers = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};

export default function () {
  const klineRes = http.get(`${BASE_URL}/api/klines/${PROPERTY_ID}`, { headers });
  klineDuration.add(klineRes.timings.duration);
  check(klineRes, {
    'klines status 200': (r) => r.status === 200,
  });

  const obRes = http.get(`${BASE_URL}/api/orderbook/${PROPERTY_ID}`, { headers });
  orderbookDuration.add(obRes.timings.duration);
  check(obRes, {
    'orderbook status 200': (r) => r.status === 200,
  });

  sleep(1);
}
