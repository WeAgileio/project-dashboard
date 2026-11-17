# Tasks

## 1. Path table

- [x] 1.1 Add one module that parses a pathname into a dashboard page and builds the canonical path for a tab (`/` and `/progress` are 專案進展, `/billing`, `/billing/by-time`, `/trends`, `/sprint`; a trailing slash matches the same page; anything else is unknown; clicking 專案進展 builds `/progress`). Verify with a `node --test` file that covers those paths, the trailing slash, an unknown path, and each tab's written path.

## 2. Address bar and tabs

- [x] 2.1 After the existing loading gate knows the data source and login state, apply the path. Logged out, show the login card and leave the address unchanged; after a successful login, open the page for the path still in the bar. Verify logged out at `/billing`: the login card is shown and the path stays `/billing`; after login,「請款進展」is shown at `/billing`.
- [x] 2.2 On a visible tab click, `pushState` that page's path (`/progress` for「專案進展」) and show the page. On `popstate`, show the page for the path. Verify: from `/progress`, activate「請款進展」, then use Back, and「專案進展」is shown at `/progress`.
- [x] 2.3 For a hidden or unknown path, show「專案進展」, `replaceState` to `/progress`, and do not mount the hidden view. Verify Notion `/trends` does not load weekly updates, Asana `/sprint` does not request sprint data, demo `/trends` and `/sprint` open「專案進展」, `/not-a-page` becomes `/progress`, and Back from that rejected path returns to the previous page (from `/billing` to `/not-a-page`, Back shows「請款進展」at `/billing`).

## 3. Leave page state alone

- [x] 3.1 Do not read or write selected projects, search, sort, role filters, section overlays, week, updater, or Sprint range in the URL. Verify on「專案進展」: changing the project search leaves the path unchanged and adds no query; with projects selected, activating「請款進展」keeps those projects and sets the path to `/billing` with no project query.
