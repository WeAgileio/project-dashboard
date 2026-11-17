# Design

## Context

`src/App.vue` keeps the dashboard page in a `currentTab` ref and swaps the view with `<component :is>`. There is no router. `main.ts` mounts Vue and Pinia only.

The production server already serves `index.html` for GET paths outside `/api` and `/auth` once `dist/` exists. The Vite dev server already falls back to `index.html`. Those paths must stay clear of `/api`, `/auth`, and `/widget`.

Which tabs exist is already decided elsewhere:「十週更新統計」is hidden in demonstration mode and when the source is Notion;「Sprint 趨勢」is shown only for Notion outside demonstration mode. `currentTab` is applied only after the existing loading gate, and `auth.loadDataSource()` already runs before that gate ends.

See proposal.md for why the paths exist.

## Goals / Non-Goals

**Goals:**

- Map the address path to the existing tab, and keep the address in step with tab clicks and Back.
- Resolve a path only after the app knows which tabs are visible.
- Leave selected projects in their current localStorage-backed store.

**Non-Goals:**

- Encoding filters, sort, overlays, week, updater, or Sprint range in the URL.
- Adding a router library.
- Changing the server catch-all or the data APIs.

## Decisions

### Read and write the path with the History API

Five pages already share one switch in `App.vue`. A small path parser and a `popstate` listener can drive `currentTab`. `vue-router` would add a dependency and a second place that decides which view is mounted.

A tab click uses `pushState`, so Back returns to the previous page. Opening a hidden or unknown path uses `replaceState` to `/progress`, so Back returns to the page before the rejected path instead of landing on it again.

`/` stays `/` when that is the address the user opened. Clicking「專案進展」writes `/progress`. Both paths show the same page.

A trailing slash is ignored when matching. The written path has no trailing slash.

The query string is not read and is not written. A tab change replaces the address with the page path only.

### One path table

| Path | Tab | Visible when |
| --- | --- | --- |
| `/`, `/progress` | 專案進展 | always |
| `/billing` | 請款進展 | always |
| `/billing/by-time` | 請款進展·時間序 | always |
| `/trends` | 十週更新統計 | Asana, and not demonstration mode |
| `/sprint` | Sprint 趨勢 | Notion, and not demonstration mode |

Anything else is unknown. A known path whose tab is hidden is treated like an unknown path: show「專案進展」and replace the address with `/progress`. Because `currentTab` never becomes the hidden tab, that view is not mounted and its load does not run.

Put the parse and build functions in one module so the table is not copied into the click handlers.

### Resolve after visibility is known

On startup the existing loading screen stays up until `loadDataSource()` and stored login state are ready. Read the path then.

Logged out: show the login card and do not change the address. Login already calls `auth.saveToken()` without touching the URL. When `isLoggedIn` becomes true, apply the path that is still in the address bar, including the hidden-path rule.

Logged in on a hidden or unknown path: replace the address before the dashboard paints, so the user does not see the hidden page first.

### Selected projects stay where they are

`useProjectProgress` already restores `selectedProjectGids` from localStorage for the current token. This change does not read or write that value. `keep-alive` already keeps the three progress views on the same store, so moving between them keeps the selection.

## Risks / Trade-offs

- [A shared link to a hidden page opens「專案進展」] → The address becomes `/progress`, which matches the tabs that person can use.
- [Direct `/billing` depends on the SPA fallback] → Production and Vite already serve `index.html` for it. No server change. A host that is not this Express app or Vite would need the same fallback; this repo's deploy path is the Express server.
- [Query strings on an old link disappear on the next tab click] → The app has no query contract today. Tab navigation writes the path only.
- [Fallback runs only once visibility is known] → The loading gate already waits for the data source, so a Notion user does not briefly mount「十週更新統計」.

## Migration Plan

Ship with the frontend bundle. Existing visits to `/` still open「專案進展」. Rollback is reverting the frontend change. No stored data moves.

## Open Questions

None.
