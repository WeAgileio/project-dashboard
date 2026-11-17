export type DashboardPage =
  | "trends"
  | "progressByTime"
  | "billingTasks"
  | "billingTasksByTime"
  | "sprintTrend";

export function pageFromPath(pathname: string): DashboardPage | null;
export function pathForPage(page: DashboardPage): string;
export function resolveDashboardLocation(
  pathname: string,
  visible: { trends: boolean; sprint: boolean }
): { page: DashboardPage; path: string };
