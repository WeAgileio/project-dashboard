# notion-sprint-trend Specification

## Purpose
在 Notion 模式下，用已完成 Sprint 的完成數、近三週完成平均、插件與插件平均，畫出以第一天日期為橫軸的趨勢圖。

## Requirements

### Requirement: Sprint tab only in Notion mode

When the active source is Notion, demonstration mode is not active, and the user is logged in, the application SHALL show a「Sprint 趨勢」tab. When the active source is Asana or demonstration mode is active, the application SHALL NOT show that tab and SHALL NOT request sprint trend data.

#### Scenario: Notion dashboard shows the tab

- **WHEN** the active source is Notion, demonstration mode is not active, and the user is logged in
- **THEN** the top navigation includes「Sprint 趨勢」

#### Scenario: Asana dashboard omits the tab

- **WHEN** the active source is Asana and demonstration mode is not active
- **THEN** the top navigation does not include「Sprint 趨勢」and no sprint trend request is made

#### Scenario: Demo dashboard omits the tab

- **WHEN** demonstration mode is active
- **THEN** the top navigation does not include「Sprint 趨勢」and no sprint trend request is made

### Requirement: Sprint chart series

The Sprint trend page SHALL use the heading「Sprint 完成數／速率／插件趨勢」. It SHALL plot four labeled series: 完成 from `最後一天｜完成數` (including a formula number), 速率, 插件 from `最後一天｜插件`, and 插件平均. The horizontal axis SHALL be each included row's `第一天｜日期`, ordered from earliest to latest.

#### Scenario: Last-day values are plotted on the first day

- **WHEN** a completed sprint row has `第一天｜日期` 2026-11-09, `最後一天｜完成數` 102, and `最後一天｜插件` 7
- **THEN** the chart shows 完成 102 and 插件 7 at 2026-11-09

#### Scenario: Dates run from earliest to latest

- **WHEN** completed sprint rows exist for 2026-06-01 and 2026-05-25
- **THEN** 2026-05-25 appears before 2026-06-01 on the horizontal axis

### Requirement: Sprint rolling averages

速率 SHALL be the average of 完成 for the current completed sprint and the two completed sprints before it. 插件平均 SHALL be the same window over 插件. An average SHALL appear only when all three values are numbers, and SHALL be rounded to one decimal place. Choosing a shorter chart range SHALL NOT change those averages.

#### Scenario: Rate uses three completion numbers

- **WHEN** three consecutive completed sprints have 完成 59, 116, and 90
- **THEN** the third sprint's 速率 is 88.3

#### Scenario: Plugin average waits for three plugin numbers

- **WHEN** the last three completed sprints have 插件 35, 13, and 16
- **THEN** that sprint's 插件平均 is 21.3

#### Scenario: Missing value skips the average

- **WHEN** one of the three completed sprints has no 插件
- **THEN** that sprint has no 插件平均

### Requirement: Sprint value labels

Each plotted value SHALL be visible on the chart. A whole number SHALL be shown without a decimal fraction, and any other number SHALL be shown with one decimal place.

#### Scenario: Fractional rate keeps one decimal

- **WHEN** a plotted 速率 value is 91.6
- **THEN** the chart shows 91.6

#### Scenario: Whole number has no decimal

- **WHEN** a plotted 完成 value is 102
- **THEN** the chart shows 102

### Requirement: Sprint hover detail

Pointing at a sprint SHALL show that sprint's `第一天｜日期` and the series values plotted on that date.

#### Scenario: Hover lists the plotted series

- **WHEN** the user points at a sprint that has 完成, 速率, 插件, and 插件平均 plotted
- **THEN** the detail shows that sprint's date and those four values

### Requirement: Missing numbers leave a gap

An empty series value SHALL NOT be plotted as zero. The line for that series SHALL break across the missing point.

#### Scenario: Plugin starts only when a number exists

- **WHEN** earlier completed sprint rows have no `最後一天｜插件` and a later row has `最後一天｜插件` 35
- **THEN** the 插件 line has no point on those earlier sprints and is not drawn at zero there

### Requirement: Which sprint rows appear

The chart SHALL include a sprint row only when it has `第一天｜日期` and `狀態` equal to `完成`. A row without `第一天｜日期`, or whose `狀態` is not `完成`, SHALL be omitted and SHALL NOT affect averages. The page SHALL NOT display `湧`, `客戶`, `check`, or `近三週數據`.

#### Scenario: In-progress sprint is omitted

- **WHEN** a sprint row has `狀態` equal to `進行中` and has `第一天｜日期`
- **THEN** that row does not appear and is not used in an average

#### Scenario: Undated row is omitted

- **WHEN** a sprint row has completion numbers and no `第一天｜日期`
- **THEN** that row does not appear on the chart

#### Scenario: Extra columns stay off the page

- **WHEN** a sprint row has values for `最後一天｜湧` and `近三週數據`
- **THEN** the Sprint trend page does not show those values

### Requirement: Sprint range filter

The Sprint trend page SHALL offer 近六週, 近十二週, and 全部. It SHALL show 近六週 when the page opens.

#### Scenario: Default shows six sprints

- **WHEN** the user opens the Sprint trend page and more than six completed sprints exist
- **THEN** the chart shows the six latest completed sprints

#### Scenario: All shows every completed sprint

- **WHEN** the user selects 全部
- **THEN** the chart shows every completed sprint

### Requirement: Sprint point opens its page

Clicking a plotted point SHALL open that sprint's Notion page in a new browser tab.

#### Scenario: Click opens the row

- **WHEN** the user clicks a plotted point whose sprint has an https Notion page URL
- **THEN** that page opens in a new tab

### Requirement: Empty sprint table is not an error

When the sprint table can be read and no row has `第一天｜日期`, the page SHALL show an empty state and SHALL NOT show a read error.

#### Scenario: Readable table with no dated rows

- **WHEN** the sprint table is readable and every row lacks `第一天｜日期`
- **THEN** the Sprint trend page shows an empty state and does not show a read error

### Requirement: Sprint read failure stays on the page

When the sprint table cannot be read, the Sprint trend page SHALL show an error and SHALL keep the user in the dashboard. Failure to read the sprint table SHALL NOT return the user to the login card, and the other Notion tabs SHALL remain available.

#### Scenario: Unshared sprint table

- **WHEN** the integration can read the project root and cannot read the sprint table
- **THEN** the Sprint trend page shows an error, the user stays in the dashboard, and the progress and billing tabs remain available

### Requirement: Sprint source page and credential

The server SHALL read the sprint page id from `NOTION_SPRINT_PAGE_ID`. When that variable is missing or empty, the id SHALL be `10c53bdeb3b182b9b43b013316121b31`. The application SHALL read the child database titled `Sprint 表格彙整` on that page. A sprint request SHALL use the same Notion credential already used for the project dashboard, and SHALL NOT ask for a second secret. The sprint endpoint SHALL be available only when the active source is Notion.

#### Scenario: Default sprint page

- **WHEN** `NOTION_SPRINT_PAGE_ID` is unset and the active source is Notion
- **THEN** sprint rows are read from the child database titled `Sprint 表格彙整` on page `10c53bdeb3b182b9b43b013316121b31`

#### Scenario: Override sprint page

- **WHEN** `NOTION_SPRINT_PAGE_ID` is set to another page id and the active source is Notion
- **THEN** sprint rows are read from the child database titled `Sprint 表格彙整` on that page

#### Scenario: Same credential as the dashboard

- **WHEN** the user is logged in with a Notion integration token
- **THEN** the sprint request uses that token and does not prompt for another secret

#### Scenario: Endpoint is absent for Asana

- **WHEN** the active source is Asana and a client requests the sprint endpoint
- **THEN** the server responds with not found

### Requirement: Sprint page can reload

The Sprint trend page SHALL provide a control that reloads sprint rows from Notion and skips any cached sprint response.

#### Scenario: Reload bypasses the cache

- **WHEN** the user uses the reload control on the Sprint trend page
- **THEN** the page requests sprint rows again and the server does not satisfy that request from its sprint cache

### Requirement: Sprint page names its source

The Sprint trend page SHALL show that its data comes from `Sprint 表格彙整`.

#### Scenario: Source caption is visible

- **WHEN** the user opens the Sprint trend page and the table was read successfully
- **THEN** the page includes the text `Sprint 表格彙整`
