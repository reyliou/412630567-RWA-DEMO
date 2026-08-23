# 自動化測試原始 log

重跑日期：2026-08-19
基準 commit：`909db44`（test: update fault-injection assertion for reconcile offline node message）
＋尚未提交的異動：測試檔新增 16 筆，另有 2 項程式碼修正（見下方）
專案路徑：`C:\重要\412630567-RWA-DEMO\RWA_Project-main`
環境：Windows 10 Pro / Node v24.18.0 / Jest 30.4.1 / Hardhat 2.28.6

## 目錄內容

| 檔案 | 內容 |
|---|---|
| `自動化測試.md` | 測試計畫與結果（主文件） |
| `自動化測試原始log.log` | **全部原始終端機輸出**，四段合併於單一檔案 |
| `故障注入測試_五情境.md` | 服務重啟／重複事件／Nonce 衝突／區塊重組／通知失敗的獨立報告（主文件 8.4 節的抽出版，可單獨閱讀） |
| `README.md` | 本檔 —— 重跑環境、版本沿革、測試缺口 |

`自動化測試原始log.log` 內含四段：

| 段落 | 內容 | 指令 | 結果 |
|---|---|---|---|
| 【一】 | 後端單元／負向／併發／故障注入 | `npx jest --verbose --reporters=default --ci` | 6 suites, **54 passed** |
| 【二】 | 後端整合／權限 | `npx jest --config ./test/jest-e2e.json --verbose --reporters=default --ci` | 1 suite, **15 passed** |
| 【三】 | 智能合約 (ERC-3643) | `cd blockchain && npm test` | **20 passing** |
| 【四】 | 負向測試（篩選執行，對應文件第五章 log 摘要） | `npx jest src/transactions/transactions.service.spec.ts -t "負向"` | 9 passed / 10 skipped / 19 total |

【一】【二】【三】相加 = **89 筆**；【四】為【一】的子集合以名稱篩選後單獨執行，不另計入總數。

> 註：`npx jest` 在非 TTY（輸出導向到檔案）時預設不會印出 `PASS xxx` 與逐筆測試名稱，只會給最後統計。
> 需加 `--reporters=default` 才能取得完整清單，上表指令均已加上。

## 版本沿革

| 日期 | 基準 commit | 後端 src | e2e | 合約 | 合計 |
|---|---|---|---|---|---|
| 2026-08-15 | （較舊） | 36 | 15 | 20 | 71 |
| 2026-08-18 | `909db44` | 38 | 15 | 20 | 73 |
| 2026-08-18 | `909db44` + 新增 4 筆 | 42 | 15 | 20 | 77 |
| 2026-08-18 | `909db44` + 新增 13 筆 | 51 | 15 | 20 | 86 |
| 2026-08-19 | `909db44` + 新增 16 筆 + 2 項修正 | **54** | 15 | 20 | **89** |

71 → 73 的 2 筆來自 `transactions.service.spec.ts`，皆為限價單路徑的迴歸測試：

- `撮合引擎應以含滑價的成交均價判斷觸發，不可只看現貨價`（commit `0ef847d`）
- `限價單結算時若沒有鏈上雜湊，tx_hash 應維持未設定而非空字串`（commit `fcd3133`）

已歸入文件第一章「單元測試」，該章樣本數由 8 更新為 10。

## 本次新增的測試（73 → 77）

補在 `src/blockchain/fault-injection.spec.ts`，對應文件新增的 **8.3 節點失憶的自動重建判斷**：

| 測試 | 驗證內容 |
|---|---|
| 節點不可達時排程應直接跳過 | 不觸發重建，且不讀取 `ir_address` |
| 🔒 `getCode` 因網路異常拋錯時不得重建 | RPC 瞬斷不等於合約消失 |
| `getCode` 確實回傳 `0x` 時才應觸發重建 | 真的失憶才重建 |
| 重建進行中的下一次排程應被 `isRecovering` 擋下 | 不重複部署，且結束後旗標歸位仍能再次修復 |

覆蓋的是 `autoRecoverNodeState()`（每 30 秒的自動重建排程）與 `isConfigStale()` 的判斷分支。
這是整個服務裡後果最重的自動化路徑 —— 誤判會導致合約重部署、鏈上餘額歸零。

**突變驗證**：第 2 筆另做反向確認 —— 將 `isConfigStale()` 例外分支的 `return false` 改回
先前的 `return true` 後重跑，該筆立即失敗（`Expected number of calls: 0, Received: 1`），
確認測試確實守得住行為而非恰好通過。驗證後已用 `git checkout` 還原程式碼。

**第 4 筆尚未做同等的反向確認** —— 該驗證需暫時註解掉 `autoRecoverNodeState()` 開頭的
`if (this.isRecovering) return;`，此操作被權限設定擋下，未執行。

## 先前重跑期間處理掉的一筆失敗

commit `7fae829` 把 `reconcile()` 的例外由 `Error('Hardhat 節點未啟動，無法進行鏈上對帳')`
改為 `ServiceUnavailableException('區塊鏈節點目前離線休眠中，請等待喚醒後再試 (約需30~60秒)')`，
導致 `src/blockchain/fault-injection.spec.ts` 原本斷言 `/節點未啟動/` 的案例失敗。

程式碼的改動是正確的（裸 `Error` 會被包成 500，`ServiceUnavailableException` 才會正確回 503），
因此修正方向為更新測試斷言，已於 commit `909db44` 對齊為 `/區塊鏈節點目前離線休眠中/`。
文件第八章 8.2 的對應列已同步更新為「拋出 `ServiceUnavailableException`（HTTP 503）」。

註：`setupBlockchain()` 的訊息未變動，文件中「拋出『Hardhat 節點未啟動』」該列維持原狀是正確的。

## 第七章效能測試

**這次無法重跑**，因為：

1. `rwa-backend/` 底下沒有 `.env`（`DATABASE_URL` 等連線設定未在本機），無法啟動 `npm run start:dev`。
2. autocannon 壓測必須連線雲端 Supabase（ap-southeast-2 雪梨），數據會隨當下網路狀況變動，無法重現原文件的數值。
3. 情境 B 需要臨時把 Throttler 的 `limit` 改成 100000 再還原，屬於改程式碼的操作。

原始 autocannon 輸出已完整保留在文件的**附錄三**（三-1 ~ 三-5），該處即為當時的終端機原始輸出。

## 已知無原始輸出的項目

7.3 步驟 1 的 `EXPLAIN ANALYZE`：執行時因 PowerShell 巢狀引號跳脫問題失敗，原始查詢計畫未保留（文件已誠實註明）。
如需補齊，可用 `test/perf/run-explain.js`（用 Node 送查詢，避開引號問題）重新取得。

## 尚未涵蓋的測試缺口

`autoRecoverNodeState()` 的四個判斷分支目前皆已覆蓋。
`setupBlockchain()` 本身在重建過程中途失敗（例如部署到一半節點斷線）後的狀態一致性，
仍無測試涵蓋 —— 該情境需要真實 Hardhat 節點才能有意義地驗證。

## 追加：鏈上／鏈下狀態一致性五情境（77 → 86）

新檔 `src/blockchain/fault-injection-integrity.spec.ts`，9 筆，對應文件 **8.4**。
針對指定的五個故障情境：服務重啟、重複事件、Nonce 衝突、區塊重組、通知失敗。

**兩項情境在本架構下沒有字面上的機制，已改測等價風險並於測試名稱標明：**

- **重複事件**：全專案沒有任何鏈上事件訂閱（無 `contract.on` / WebSocket listener），
  唯一消費 `Transfer` 事件之處是 `reconcile()` 的 `queryFilter` 全量重建。
  改測「對帳重複執行是否重複入帳」。
- **區塊重組**：程式沒有 reorg 專門處理，所有 `.wait()` 皆為預設 1 個確認數。
  改測「已入帳的交易若在鏈上被 reorg 掉，對帳能否偵測」。

**測出來的兩個真實缺口（測試已標 🔴 已知風險，程式碼未修改）：**

1. **服務重啟會重複執行鏈上轉帳** —— 鏈上呼叫位於 DB commit 之前，且重新結算前
   未檢查是否已有 `tx_hash`。實測 `executeOnChainBuy` 被呼叫 2 次而使用者僅入帳 1 次。
2. **通知失敗會回滾已上鏈的交易** —— 成交通知與交易共用同一個 `queryRunner`
   且位於 commit 之前，純通知層故障會讓一筆已完成鏈上轉帳的交易被整筆回滾。

另觀察到：`NonceManager` 在鏈上呼叫失敗路徑沒有任何 `reset()`，
若內部 nonce 與鏈上脫節，後續交易會連續失敗直到服務重啟。

## 依 8.4 測出的缺口所做的程式碼修正（86 → 89）

8.4 測出三個缺口，其中兩個已修正（各補迴歸測試，故總數 +3）：

**1. 通知失敗會回滾已上鏈的交易 — 已修正**
`src/transactions/transactions.service.ts`：成交通知原以 `qr.manager.save(UserNotification, ...)`
寫在 commit 之前，通知層一旦故障就連帶把整筆交易回滾，但鏈上轉帳更早之前已成功送出。
現改為 `commitTransaction()` 之後以獨立的 `notifRepo` 寫入，自帶 try/catch，失敗僅記錄 ERROR。
代價：通知在極端情況下可能遺失 —— 相較於回滾一筆已上鏈的交易，是明確較小的損失。

**2. Nonce 脫節後無法自行恢復 — 已修正**
`src/blockchain/blockchain.service.ts`：`executeOnChainBuy()` / `executeOnChainSell()` 的
失敗路徑新增 `resetNonceIfDesynced()`。**刻意只在 `NONCE_EXPIRED` 與 `REPLACEMENT_UNDERPRICED`
時才 reset** —— 其他失敗（例如 ERC-3643 合規擋下轉帳）不會讓 nonce 脫節，
若一律 reset 反而可能在有交易在途時造成重號。已補一筆測試守住這個邊界。

**3. 服務重啟會重複執行鏈上轉帳 — 未修正（刻意保留）**
屬架構層面改動：需在鏈上呼叫前先落一筆「已送出」意圖紀錄，等同改為兩階段提交，
且該路徑位於 transactions 模組。現以測試釘住現況行為並在文件 8.4(a) 標記為 🔴 已知風險，
安全網仍是 `reconcile()`（事後偵測）。日後若有人改動該路徑，測試會立即反映行為變化。
