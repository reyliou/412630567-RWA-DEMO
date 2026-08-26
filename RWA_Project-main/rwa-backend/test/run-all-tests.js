const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootBackend = path.resolve(__dirname, '..');
const blockchainDir = path.resolve(rootBackend, '..', 'blockchain');
const reportsDir = path.join(__dirname, 'reports');

if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

console.log('================================================================');
console.log('🚀 RWA 專案全自動化測試總執行器 (Master Test Suite Runner)');
console.log('時間：' + new Date().toLocaleString());
console.log('================================================================\n');

const results = [];

function runStep(name, cmd, cwd, logFile) {
  console.log(`▶ 正在執行: ${name}...`);
  const startTime = Date.now();
  let output = '';
  let success = true;

  try {
    output = execSync(cmd, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (err) {
    output = (err.stdout || '') + '\n' + (err.stderr || '') + '\n' + err.message;
    success = false;
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const statusIcon = success ? '✅ PASS' : '❌ FAIL';
  console.log(`   └─ ${statusIcon} (耗時: ${duration}s)\n`);

  if (logFile) {
    fs.writeFileSync(path.join(reportsDir, logFile), output, 'utf8');
  }

  results.push({ name, cmd, duration, success, logFile });
  return output;
}

// 1. Jest Unit & Fault Injection
runStep(
  '【1/6】後端單元與故障注入測試 (Jest Unit & Fault-Injection)',
  'npx jest --verbose',
  rootBackend,
  '01-jest-unit-fault-injection.txt'
);

// 2. Jest E2E Integration & RBAC
runStep(
  '【2/6】後端整合與權限驗證測試 (Jest E2E & RBAC)',
  'npx jest --config ./test/jest-e2e.json --verbose',
  rootBackend,
  '02-jest-e2e-auth.txt'
);

// 3. Hardhat ERC-3643 Smart Contracts
runStep(
  '【3/6】區塊鏈 ERC-3643 智能合約合規測試 (Hardhat)',
  'npx hardhat test',
  blockchainDir,
  '03-smart-contracts-hardhat.txt'
);

// 4. Database Constraints
runStep(
  '【4/6】資料庫約束完整性檢驗 (get-constraints.js)',
  'node test/perf/get-constraints.js',
  rootBackend,
  '04-db-constraints.txt'
);

// 5. Database EXPLAIN ANALYZE (50K Rows)
runStep(
  '【5/6】5萬筆巨量資料 K 線查詢執行計畫壓測 (scale-explain.js)',
  'node test/perf/scale-explain.js',
  rootBackend,
  '05-scale-50k-explain.txt'
);

// 6. RPC Latency Test
runStep(
  '【6/6】區塊鏈 RPC 節點連線延遲量測 (run-rpc-test.js)',
  'node test/perf/run-rpc-test.js',
  rootBackend,
  '06-rpc-latency-test.txt'
);

console.log('================================================================');
console.log('📊 全自動測試執行總結 (Execution Summary)');
console.log('================================================================');
results.forEach((r, idx) => {
  console.log(`${idx + 1}. [${r.success ? 'PASS' : 'FAIL'}] ${r.name} (${r.duration}s)`);
});
console.log('\n📁 詳細測試日誌已完整歸檔至: ' + reportsDir);
console.log('================================================================\n');
