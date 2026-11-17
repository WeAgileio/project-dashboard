# Spec Delta

## Purpose

Lets a logged-in user open any visible dashboard page directly from its URL, and return to that page after login.

## ADDED Requirements

### Requirement: Visible page opens from its path

When a dashboard page is visible, the application SHALL open it from its path. `/` and `/progress` open「專案進展」. `/billing` opens「請款進展」. `/billing/by-time` opens「請款進展·時間序」. `/trends` opens「十週更新統計」. `/sprint` opens「Sprint 趨勢」. A trailing slash SHALL open the same page as the path without it.

#### Scenario: Progress paths

- **WHEN** a logged-in user opens `/` or `/progress`
- **THEN**「專案進展」is shown and that tab is active

#### Scenario: Billing path

- **WHEN** a logged-in user opens `/billing`
- **THEN**「請款進展」is shown and that tab is active

#### Scenario: Billing by time path

- **WHEN** a logged-in user opens `/billing/by-time` or `/billing/by-time/`
- **THEN**「請款進展·時間序」is shown and that tab is active

#### Scenario: Weekly trends path

- **WHEN** the active source is Asana, demonstration mode is inactive, and a logged-in user opens `/trends`
- **THEN**「十週更新統計」is shown and that tab is active

#### Scenario: Sprint path

- **WHEN** the active source is Notion, demonstration mode is inactive, and a logged-in user opens `/sprint`
- **THEN**「Sprint 趨勢」is shown and that tab is active

### Requirement: Tab selection updates the path

When the user activates a visible dashboard tab, the application SHALL show that page and SHALL set the address path to that page's path. Activating「專案進展」SHALL set the path to `/progress`.

#### Scenario: Switch to billing

- **WHEN** the user activates「請款進展」
- **THEN**「請款進展」is shown and the address path is `/billing`

#### Scenario: Switch to progress

- **WHEN** the user activates「專案進展」
- **THEN**「專案進展」is shown and the address path is `/progress`

### Requirement: Browser back restores the previous page

After the user moves from one visible dashboard page to another, the browser Back action SHALL show the previous page and SHALL make the address path match that page.

#### Scenario: Back from billing to progress

- **WHEN** the user is on「專案進展」at `/progress`, activates「請款進展」, and then uses the browser Back action
- **THEN**「專案進展」is shown and the address path is `/progress`

### Requirement: Hidden or unknown path opens progress

When a logged-in user opens `/trends` while「十週更新統計」is hidden, `/sprint` while「Sprint 趨勢」is hidden, or any other non-dashboard path, the application SHALL show「專案進展」, SHALL set the address path to `/progress`, and SHALL NOT load that hidden page. The browser Back action SHALL return to the page that was open before the rejected path.

#### Scenario: Notion weekly trends path

- **WHEN** the active source is Notion and a logged-in user opens `/trends`
- **THEN**「專案進展」is shown, the address path is `/progress`, and weekly task-update data is not loaded

#### Scenario: Asana sprint path

- **WHEN** the active source is Asana and a logged-in user opens `/sprint`
- **THEN**「專案進展」is shown, the address path is `/progress`, and sprint trend data is not requested

#### Scenario: Demo hidden paths

- **WHEN** demonstration mode is active and the user opens `/trends` or `/sprint`
- **THEN**「專案進展」is shown and the address path is `/progress`

#### Scenario: Unknown path

- **WHEN** a logged-in user opens `/not-a-page`
- **THEN**「專案進展」is shown and the address path is `/progress`

#### Scenario: Back leaves a rejected path

- **WHEN** a logged-in user is on `/billing` and then opens `/not-a-page`
- **THEN** the address path becomes `/progress`
- **AND** the browser Back action shows「請款進展」at `/billing`

### Requirement: Login keeps the requested page

While the user is logged out, the application SHALL show the login card and SHALL leave the address path unchanged. After a successful login, the application SHALL open the page for the path still in the address bar, including the hidden-path rule.

#### Scenario: Address unchanged on the login card

- **WHEN** a logged-out user opens `/billing`
- **THEN** the login card is shown and the address path remains `/billing`

#### Scenario: Requested page opens after login

- **WHEN** a logged-out user opens `/billing` and then logs in successfully
- **THEN**「請款進展」is shown and the address path is `/billing`

#### Scenario: Hidden path is resolved after login

- **WHEN** a logged-out user opens `/sprint` while「Sprint 趨勢」is hidden and then logs in successfully
- **THEN**「專案進展」is shown and the address path is `/progress`

### Requirement: Page state stays out of the URL

The address SHALL identify only the dashboard page. The application SHALL NOT add a query parameter for selected projects, search text, sort order, role filters, a section overlay, the selected week, the updater filter, or the Sprint range. Changing those controls SHALL leave the address path unchanged. Switching pages SHALL leave the selected projects unchanged.

#### Scenario: Search does not change the address

- **WHEN** the user is on「專案進展」and changes the project search text
- **THEN** the address path is unchanged and no query parameter is added

#### Scenario: Selected projects survive a page change

- **WHEN** the user has one or more projects selected on「專案進展」and activates「請款進展」
- **THEN** those same projects stay selected and the address path is `/billing` with no project query
