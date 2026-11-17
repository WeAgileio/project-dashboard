# Proposal

## Why

Dashboard tabs live only in memory. Refreshing or sharing a link always opens「專案進展」, so a person cannot jump straight to another page.

## What Changes

- Give each logged-in dashboard page its own path, and open that page when the path is requested.
- Update the address bar when the user switches tabs, and restore the previous page with the browser Back button.
- Keep the current page across the login card: the path stays in the address bar, and the matching page opens after login.
- When a path names a page the current mode does not show, open「專案進展」and do not load the hidden page.
- Leave in-page state out of the URL. Selected projects, search, sort, role filters, section overlays, week selection, and the Sprint range stay as they are today.

## Capabilities

### New Capabilities

- `dashboard-page-routes`: Addressable paths for the dashboard pages, including tab sync, login preservation, and fallback when a page is hidden.

### Modified Capabilities

- None. Existing tab-visibility rules in `demo-mode`, `notion-data-source`, and `notion-sprint-trend` stay as written. This capability follows them when choosing which path may open.

## Impact

- `src/App.vue` tab selection and the top navigation.
- Production already returns `index.html` for unknown GET paths. Dev server SPA fallback already does the same. Paths must stay clear of `/api`, `/auth`, and `/widget`.
- No API change and no new dependency.
