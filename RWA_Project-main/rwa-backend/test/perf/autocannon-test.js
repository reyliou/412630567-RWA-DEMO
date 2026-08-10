/**
 * 效能測試 (Performance Test) — autocannon 替代方案
 * -------------------------------------------------------------
 * 如果不想額外安裝 k6，這個用 npm 套件 autocannon 也可以做一樣的事，
 * 裝起來比較簡單（純 Node.js 生態系）。
 *
 * 安裝：
 *   npm install --save-dev autocannon
 *
 * 執行方式：
 *   node tests/perf/autocannon-test.js http://localhost:3000 1 你的JWT
 *   node tests/perf/autocannon-test.js http://localhost:3000 1
 *   （不帶 token 的話，如果 API 需要驗證會拿到 401，那也是一種有效的量測結果）
 * -------------------------------------------------------------
 */

const autocannon = require('autocannon');

const [baseUrl = 'http://localhost:3000', propertyId = '1', token = ''] = process.argv.slice(2);

const headers = token ? { authorization: `Bearer ${token}` } : {};

async function run(name, url) {
  console.log(`\n=== 壓測 ${name}: ${url} ===`);
  const result = await autocannon({
    url,
    connections: 20, // 20 個併發連線
    duration: 20, // 跑 20 秒
    headers,
  });

  console.log(
    `延遲: 平均 ${result.latency.average}ms / p99 ${result.latency.p99}ms\n` +
      `吞吐量: 平均 ${result.requests.average} req/s\n` +
      `錯誤: ${result.errors} / 逾時: ${result.timeouts} / 非 2xx: ${result.non2xx}`,
  );

  return result;
}

(async () => {
  await run('K線查詢 /api/klines/:id', `${baseUrl}/api/klines/${propertyId}`);
  await run('掛單簿 /api/orderbook/:id', `${baseUrl}/api/orderbook/${propertyId}`);
})();
