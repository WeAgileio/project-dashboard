# Proposal

## Why

Sprint 完成數、速率與插件已經彙整在 Notion「Sprint 表格彙整」，目前只是一份靜態圖。儀表板在 Notion 模式下仍看不到這條趨勢，每次要對數字都得另開那頁。

## What Changes

- Notion 模式登入後新增分頁「Sprint 趨勢」。頁內標題為「Sprint 完成數／速率／插件趨勢」。
- 圖的橫軸是各列「第一天｜日期」，由舊到新。三條線是該列最後一天的「完成數」、「速率」、「插件」。數字為空時該點不畫，線在那裡斷開。
- 有「第一天｜日期」的列都納入，不依「狀態」過濾。沒有這個日期的列略過。其餘欄位（湧、客戶、check、近三週數據）不出現在這一頁。
- 資料用同一個 Notion 整合金鑰，經新的後端端點讀取。Sprint 頁面 ID 可設定，未設定時用頁面 `10c53bdeb3b182b9b43b013316121b31`，再找其中標題為「Sprint 表格彙整」的內嵌資料庫。
- 這張表讀不到時，錯誤留在「Sprint 趨勢」頁，不退回登入卡。
- Asana 模式與展示模式不顯示這個分頁，也不請求這張表。

## Capabilities

### New Capabilities

- `notion-sprint-trend`: 在 Notion 模式下以三條折線顯示 Sprint 完成數、速率與插件，資料來自「Sprint 表格彙整」。

### Modified Capabilities

- `notion-data-source`: Notion 模式登入後的可見分頁改為包含「Sprint 趨勢」。「十週更新統計」仍然隱藏。

## Impact

- 前端：`src/App.vue` 的分頁；新增一個 Sprint 趨勢畫面。
- 後端：在既有 `/api/*` 轉發之前新增 Sprint 讀取端點；`server/notionSource.mjs` 增加對 Sprint 頁面與「Sprint 表格彙整」的讀取。沿用現有 Bearer 與伺服器代持金鑰。
- 設定：`.env.example` 與 compose 增加 Sprint 頁面 ID，預設為上述頁面。
- 依賴：該整合必須已被分享「Sprint 表格彙整」。未分享時專案總表仍可讀，只有這一頁失敗。
- 既有展示模式規格仍要求只顯示三個進展／請款分頁；本變更不放寬該要求。
