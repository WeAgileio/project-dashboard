/**
 * 儀表板頁面與網址 path 的對照。只處理 path，不讀寫 query。
 * @typedef {"trends" | "progressByTime" | "billingTasks" | "billingTasksByTime" | "sprintTrend"} DashboardPage
 */

/** @type {Record<DashboardPage, string>} */
const PATH_BY_PAGE = {
  progressByTime: "/progress",
  billingTasks: "/billing",
  billingTasksByTime: "/billing/by-time",
  trends: "/trends",
  sprintTrend: "/sprint",
};

/**
 * @param {string} pathname
 * @returns {string}
 */
function normalizePath(pathname) {
  const raw = typeof pathname === "string" && pathname !== "" ? pathname : "/";
  if (raw.length > 1 && raw.endsWith("/")) return raw.slice(0, -1);
  return raw;
}

/**
 * @param {string} pathname
 * @returns {DashboardPage | null}
 */
export function pageFromPath(pathname) {
  switch (normalizePath(pathname)) {
    case "/":
    case "/progress":
      return "progressByTime";
    case "/billing":
      return "billingTasks";
    case "/billing/by-time":
      return "billingTasksByTime";
    case "/trends":
      return "trends";
    case "/sprint":
      return "sprintTrend";
    default:
      return null;
  }
}

/**
 * 點「專案進展」時寫入 /progress。`/` 只在使用者直接打開根路徑時保留。
 * @param {DashboardPage} page
 * @returns {string}
 */
export function pathForPage(page) {
  return PATH_BY_PAGE[page] ?? "/progress";
}

/**
 * @param {string} pathname
 * @param {{ trends: boolean, sprint: boolean }} visible
 * @returns {{ page: DashboardPage, path: string }}
 */
export function resolveDashboardLocation(pathname, visible) {
  const page = pageFromPath(pathname);
  const allowed =
    page === "progressByTime" ||
    page === "billingTasks" ||
    page === "billingTasksByTime" ||
    (page === "trends" && visible.trends) ||
    (page === "sprintTrend" && visible.sprint);
  if (!page || !allowed) {
    return { page: "progressByTime", path: "/progress" };
  }
  if (page === "progressByTime" && normalizePath(pathname) === "/") {
    return { page, path: "/" };
  }
  return { page, path: pathForPage(page) };
}
