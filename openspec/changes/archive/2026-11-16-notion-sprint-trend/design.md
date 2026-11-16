# Design

## Context

見 `proposal.md` 的 Why，行為見 `specs/notion-sprint-trend/spec.md` 與 `specs/notion-data-source/spec.md`。

現況：`App.vue` 用分頁元件切畫面，沒有獨立網址。「十週更新統計」只在非展示且 `dataSource !== "notion"` 時出現。Notion 讀取集中在 `server/notionSource.mjs`：`childDatabaseId` 依子資料庫標題找 id，`queryAllPages` 會翻頁。`server/index.mjs` 的 `app.get("/api/*")` 把其餘 `/api` 路徑轉成專案／階段／任務。401 會被 `src/api/asana.ts` 的 interceptor 清掉瀏覽器金鑰。快取略過已有兩條路：`Cache-Control: no-cache`（`pushAsanaProxyCacheBypass`）與 `shouldBypassApiCache`。儀表板是淺色，沒有圖表套件。

Sprint 頁 `10c53bdeb3b182b9b43b013316121b31` 內嵌標題恰好為「Sprint 表格彙整」的資料庫。欄名裡的直線是全形 `｜`（U+FF5C）。日期是 date 的 start，數字是 number，空值是 null。

## Goals / Non-Goals

**Goals:**

- 用現有整合金鑰讀這張表，回應只含圖需要的日期與三個數字。
- 圖的畫法沿用使用者提供的 SVG：三條線、圖例、點上數字、懸停、空值斷線。
- 登入探針仍只確認專案總表。Sprint 讀取失敗不變成 401。

**Non-Goals:**

- 不加圖表套件，也不做深色主題。
- 不把 Sprint 列塞進 `/api/projects` 那套形狀。
- 不改登入條件，不為展示模式做假資料。
- 不顯示湧、客戶、check、近三週數據。

## Decisions

1. **獨立端點，掛在萬用路由之前。** 新增 `GET /api/notion/sprints`。`DATA_SOURCE` 不是 `notion` 時回 404，不呼叫 Notion。是 Notion 時走現有 `requireAuth` 與 `notionAccessToken`（瀏覽器 Bearer，或伺服器 `NOTION_TOKEN`）。
   - 替代方案：塞進 `handleNotionRequest`。那條路徑的回應形狀是 Asana 專案資料，錯誤文案也是那一套，Sprint 失敗容易被寫成 401。

2. **頁面 ID 用環境變數，資料庫用標題尋找。** `NOTION_SPRINT_PAGE_ID` 空值時為 `10c53bdeb3b182b9b43b013316121b31`。對該頁 `listAllBlocks`，用現有 `childDatabaseId(blocks, "Sprint 表格彙整")`。找不到回 404，訊息指出要分享這張表。不把資料庫 ID 寫死。
   - 替代方案：寫死資料庫 ID。頁面被重建後標題還在、ID 會變。

3. **登入不檢查 Sprint 頁。** `GET /api/notion/access` 維持只讀專案總表。Sprint 的 403／404 原樣回傳，不改成 401，這樣 interceptor 不會登出，其他分頁仍在。金鑰本身無效時 Notion 回 401，仍依現況登出。
   - 替代方案：登入時兩頁都要可讀。表沒分享就進不了整個儀表板，與規格相反。

4. **列的對應與排序放在可測的純函式。** 讀 `第一天｜日期` 的 start，取 `YYYY-MM-DD`。沒有日期的列丟掉。`最後一天｜完成數`、`最後一天｜速率`、`最後一天｜插件` 缺欄或 number 為 null 時回 null，0 保留。不看 `狀態`。排序：日期升序，同一天再依 `排序` 升序（沒有排序的放後面），再依 `日期（原文）`。回應：

```json
{ "sourceTitle": "Sprint 表格彙整", "points": [{ "date": "2026-11-09", "done": 102, "rate": 97, "plugin": 7 }] }
```

5. **Sprint 自己的記憶體快取。** 鍵含權杖雜湊與頁面 ID，TTL 沿用 `BUNDLE_TTL_MS`（5 分鐘）。請求帶現有的 no-cache 信號時不讀這份快取。錯誤不寫入快取。
   - 替代方案：走 `/api/*` 的通用快取。這個路由不進那條萬用處理。

6. **前端一個分頁、一支畫面。** `App.vue` 在 `!demoMode && dataSource === "notion"` 時加入「Sprint 趨勢」，預設分頁仍是「專案進展」。新畫面 `src/views/SprintTrend.vue` 用現有 axios 實例打 `/api/notion/sprints`，因此會帶上同一個 Bearer，重新載入時呼叫 `pushAsanaProxyCacheBypass`。不使用 `PageToolbar`：那是專案選擇器。頁上自備重新載入、標題、副標（橫軸是第一天、縱軸是最後一天的三個數）、圖例、圖、以及「Sprint 表格彙整」出處。空的 `points` 顯示空狀態。404／403 顯示後端訊息。

7. **SVG 沿用那份 HTML 的淺色配色，不跟系統深色。** 完成 `#2783DE`、速率 `#D5803B`、插件 `#46A171`。整數不帶小數，其餘 `toFixed(1)`。標籤避讓與懸停沿用該 HTML 的做法。窄螢幕沿用它的高度與刻度稀疏規則。
   - 替代方案：連 `prefers-color-scheme` 一起搬。儀表板其餘畫面是固定淺色，圖單獨變深色會脫節。

## Risks / Trade-offs

- [整合只分享了專案總表] → 這一頁 404，其他分頁不受影響；訊息要求分享「Sprint 表格彙整」。
- [全形 `｜` 被打成半形] → 欄位對不上，數字會變成全空。實作與測試使用頁面上的全形字元。
- [點上每個數字，Sprint 變多以後會擠] → 沿用現有避讓。不在這次改成只在懸停時顯示。
- [同一天有多列] → 依 `排序` 再依標題排，兩點都畫。目前資料沒有這種列。

## Migration Plan

1. 把「Sprint 表格彙整」所在頁分享給現有的 Notion 整合。
2. 頁面就是預設那頁時不必設變數。否則設 `NOTION_SPRINT_PAGE_ID`，並寫進 `.env.example`、`docker-compose.prod.yml` 與 README 的環境變數表。
3. 重啟後端。已登入的 Notion 工作階段重新整理後看得到分頁。
4. 退回：還原這次程式並重啟。不需清金鑰，Asana 模式本來就沒有這個分頁。

## Open Questions

無。分頁何時出現、三條序列、空值斷線與登入範圍已在規格裡。
