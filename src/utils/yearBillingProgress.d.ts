export function dueCalendarYear(dueOn: string | null | undefined): number | null;
export function billingProgressPercent(collected: number, total: number): number | null;
export function yearBillingTotals(
  tasks: Array<{
    dueOn?: string | null;
    completed?: boolean;
    amount?: number | null;
  }>
): Array<{
  year: number;
  collected: number;
  total: number;
  percent: number | null;
}>;
