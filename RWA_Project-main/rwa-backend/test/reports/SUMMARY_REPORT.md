# 📊 RWA 平台全系統測試與效能驗證總報告 (Test Execution & Performance Summary)

**測試執行日期：** 2026-08-29
**基準 Commit：** `41d822c`（工作目錄乾淨，與遠端 `origin/main` 同步）
**報告儲存目錄：** `RWA_Project-main/rwa-backend/test/reports/`
**自動化測試總結：** ✅ **94 筆全數通過 (100% PASS)**

---

## 🧪 自動化測試總覽

| 類別 | 執行指令 | 測試數 | 通過 | 通過率 |
|---|---|---|---|---|
| 後端單元／負向／併發／故障注入 | `npx jest` | 59（6 suites） | 59 | 100% |
| 後端整合／權限驗證 (E2E, RBAC) | `npx jest --config ./test/jest-e2e.json` | 15（1 suite） | 15 | 100% |
| ERC-3643 智能合約 | `npx hardhat test` | 20 | 20 | 100% |
| **合計** | | **94** | **94** | **100%** |

> 註 1：後端測試分兩次執行取得 —— `src/` 底下與 `test/` 底下使用不同的 jest 設定，必須分開跑。
> 註 2：本次報告已用 `2>&1` 一併導入 stderr，因此各報告檔內可直接查得 `Tests: N passed` 統計行。
> （`run-all-tests.js` 目前僅收 stdout，在測試全數通過時會漏掉該統計行。）

### 後端單元測試明細（59 筆）

| 測試檔 | 筆數 |
|---|---|
| `src/transactions/transactions.service.spec.ts` | 24 |
| `src/blockchain/fault-injection-integrity.spec.ts` | 12 |
| `src/blockchain/fault-injection.spec.ts` | 12 |
| `src/properties/properties.service.spec.ts` | 7 |
| `src/transactions/fault-injection.spec.ts` | 2 |
| `src/auth/fault-injection.spec.ts` | 2 |

其中 `fault-injection-integrity.spec.ts` 的 12 筆為**鏈上／鏈下狀態一致性五情境**故障注入測試
（服務重啟、重複事件、Nonce 衝突、區塊重組、通知失敗）。

---

## 📑 報告檔案索引

| 序號 | 報告檔名 | 測試類別 | 測試重點與指標 | 結果 |
|---|---|---|---|---|
| **01** | `01-jest-unit-fault-injection.txt` | NestJS 單元與故障注入 | AMM 定價公式 (k=x*y)、P2P 撮合防呆、現金餘額防護、併發悲觀鎖、冪等性檢查、DB/RPC 中斷故障注入、鏈上鏈下一致性五情境 | 🟢 **PASS** (6/6 suites, 59/59) |
| **02** | `02-jest-e2e-auth.txt` | 後端整合與權限驗證 | JWT 驗證、RBAC 角色權限（TECHNICAL / BUSINESS / INVESTOR）、系統暫停時的 Service 層攔截 | 🟢 **PASS** (15/15) |
| **03** | `03-smart-contracts-hardhat.txt` | ERC-3643 智能合約核心 | 代幣部署、Identity Registry KYC 合規閘門、Agent 權限、`forcedTransfer` 權限邊界、緊急暫停與餘額邊界 | 🟢 **PASS** (20/20) |
| **04** | `04-db-constraints.txt` | 資料庫約束檢驗 | `user_holdings` 的主鍵、外鍵、Holder Type 檢查與 (user_id, property_id, holder_type) 唯一約束 | ⚪ **本次未執行**（需 `DATABASE_URL`，檔案內容為前次結果） |
| **05** | `05-scale-50k-explain.txt` | 巨量資料壓力測試 (50K) | 注入 50,000 筆模擬成交資料，K 線查詢命中 `idx_transactions_property_time` 複合索引，回傳 3,000 筆耗時 **3.89 ms** | ⚪ **本次未執行**（需 `DATABASE_URL`，檔案內容為前次結果） |
| **06** | `06-rpc-latency-test.txt` | 區塊鏈 RPC 節點延遲 | 本機 Hardhat 節點與雲端節點之 `eth_blockNumber` 響應與逾時容錯 | ⚪ **本次未執行**（需啟動 Hardhat 節點，檔案內容為前次結果） |
| **附** | `02-kline-query-explain.txt` | 查詢執行計畫 (EXPLAIN) | K 線查詢的執行計畫，確認 planner 選用 `idx_transactions_property_time` 而非 Seq Scan | ⚪ **本次未執行**（見下方註記） |

> ℹ️ **關於 `02-kline-query-explain.txt` 的正確引述方式**：該次 EXPLAIN 的實際輸出為
> `rows=0`、`Execution Time: 0.042 ms`——查詢當下 `property_id = 1` 在 31 天窗口內**沒有任何交易資料**。
> 因此它能證明的是「**執行計畫確實走索引，沒有退化成 Seq Scan**」，
> **不能**用來宣稱查詢吞吐效能。真正有資料量支撐的效能數字請引用 `05-scale-50k-explain.txt`
> （50,000 筆資料下回傳 3,000 筆，Execution Time 3.89 ms）。兩者不要混用。

> ⚠️ **04 / 05 / 06 本次未重跑**：此三項需要外部相依（PostgreSQL 連線字串、運行中的 Hardhat 節點），
> 本次驗證環境未具備。相關 `.txt` 檔保留前次執行結果，**其時間戳與本報告的 2026-08-29 不一致**，
> 引用時請注意區分。要完整重跑六步請確認 `.env` 的 `DATABASE_URL` 指向**開發用資料庫**後執行：
> ```
> node test/run-all-tests.js
> ```

---

## 🔬 測試方法論補充

### 突變測試（Mutation Testing）驗證測試有效性
`blockchain/fault-injection.spec.ts` 中「🔒 getCode 因網路異常拋錯時不得重建 —— RPC 瞬斷不等於合約消失」
一筆做過**反向確認**：刻意把 `isConfigStale()` 例外分支的 `return false` 改成 `return true` 後重跑，
該筆測試立即失敗，證明測試確實守住該行為分支而非「恰好通過」。驗證後以 `git checkout` 還原程式碼。

### 故障注入的適用性標註
鏈上／鏈下一致性五情境中，「重複事件」與「區塊重組」在目前架構下沒有字面對應的機制
（全專案無鏈上事件監聽器；所有 `.wait()` 均為預設 1 個確認數），
因此改測**等價風險**——分別為「對帳重複執行是否重複入帳」與「已入帳交易遭 reorg 後對帳能否偵測」。

---

## 🛠️ 效能與壓力測試工具腳本

以下為供即時壓測使用的工具腳本，非自動化測試套件的一部分：
1. `test/perf/autocannon-test.js`：以 `autocannon` 進行 20 併發連線壓測 K 線圖與掛單簿 API。
2. `test/perf/autocannon-rpc.js`：對區塊鏈 RPC 節點進行 20 併發連線壓測。
3. `test/perf/k6-loadtest.js`：以 k6 進行漸進式階梯加壓（1 → 10 → 50 VUs）壓測。
