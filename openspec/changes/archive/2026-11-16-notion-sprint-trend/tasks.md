# Tasks

## 1. Sprint 列的對應

- [x] 1.1 在 `server/notionSource.mjs` 匯出 `resolveSprintPageId` 與 `sprintPointsFromPages`。空的頁面 ID 用 `10c53bdeb3b182b9b43b013316121b31`。列只取有 `第一天｜日期` 的 start（`YYYY-MM-DD`），不看 `狀態`；`最後一天｜完成數`、`最後一天｜速率`、`最後一天｜插件` 缺值為 null，0 保留。排序為日期升序、再 `排序` 升序（沒有排序的在後）、再 `日期（原文）`。欄名使用全形 `｜`。另匯出 `formatSprintNumber`：整數不帶小數，其餘一位小數。驗證：`node --test server/notionSource.test.mjs` 涵蓋預設與覆寫頁面 ID、進行中列仍在、無日期列排除、插件 null 不是 0、速率 91.6 原樣保留、`formatSprintNumber(91.6)` 為 `91.6`、`formatSprintNumber(102)` 為 `102`，且回應沒有湧、客戶、check、近三週欄位。

## 2. 讀取端點與設定

- [x] 2.1 在 `server/index.mjs` 的 `app.get("/api/*")` 之前加上 `GET /api/notion/sprints`。不是 Notion 來源時回 404 且不呼叫 Notion。是 Notion 時用 `requireAuth` 與 `notionAccessToken`，以 `childDatabaseId` 找標題「Sprint 表格彙整」，再查完全部列。找不到該資料庫回 404，不改成 401。`GET /api/notion/access` 仍只檢查專案總表。回應為 `{ sourceTitle, points }`。驗證：`node --test server/notionSource.test.mjs` 在 `DATA_SOURCE=asana` 時對該路徑得到 404；Notion 模式下缺資料庫的錯誤狀態不是 401。

- [x] 2.2 Sprint 結果用權杖雜湊與頁面 ID 做記憶體快取，TTL 沿用 `BUNDLE_TTL_MS`。請求帶現有 no-cache 信號（`Cache-Control: no-cache` 或 `_nocache`）時不讀這份快取。錯誤回應不寫入快取。驗證：同一測試檔覆蓋第二次讀取命中快取、帶 no-cache 時再次讀取、失敗結果不會被之後的成功請求擋下。

- [x] 2.3 在 `.env.example`、`docker-compose.prod.yml` 與 README 的環境變數表加上 `NOTION_SPRINT_PAGE_ID`，說明未設定時用預設 Sprint 頁，且該頁必須分享給整合。啟動日誌印出解析後的頁面 ID。驗證：三處都看得到這個變數名稱與預設行為；未設定時日誌為 `10c53bdeb3b182b9b43b013316121b31`。

## 3. Notion 分頁與趨勢圖

- [x] 3.1 `src/App.vue` 在非展示且 `dataSource === "notion"` 時顯示「Sprint 趨勢」，預設分頁仍是「專案進展」。Asana 與展示模式不渲染這個分頁、也不載入該畫面。驗證：對照 `notion-data-source` 的可見分頁為「專案進展」「請款進展」「請款進展·時間序」「Sprint 趨勢」，且「十週更新統計」在 Notion 模式仍不出現；展示模式仍只有原來三個分頁。

- [x] 3.2 新增 `src/views/SprintTrend.vue`，用現有 axios 實例讀 `/api/notion/sprints`。頁內標題為「Sprint 完成數／速率／插件趨勢」，副標說明橫軸是第一天、縱軸是最後一天的完成數、速率與插件。以淺色 SVG 畫三條線（完成 `#2783DE`、速率 `#D5803B`、插件 `#46A171`），空值斷線、不畫成 0，點上用 `formatSprintNumber` 的同一規則標數字，懸停顯示該日期與有畫出來的序列。頁面標明資料來源「Sprint 表格彙整」。不加圖表套件，不跟隨系統深色。驗證：用含 2026-05-25（插件 null）、2026-10-05（插件 35）、速率 91.6、完成 102 的資料，圖上 05-25 在 10-05 左邊、插件線只從有數字的點開始、看得到 `91.6` 與 `102`，懸停該點時出現日期與三個有值的數字。

- [x] 3.3 這一頁提供重新載入，按下時以 `pushAsanaProxyCacheBypass` 再請求。`points` 為空時顯示空狀態，不顯示讀取錯誤。404 或 403 時把後端訊息留在這一頁，不清除登入狀態，其他分頁仍可切換。驗證：重新載入的請求帶 `Cache-Control: no-cache`；空陣列看到空狀態；模擬 404 時仍留在儀表板且登入金鑰還在。
