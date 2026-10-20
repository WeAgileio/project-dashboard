/**
 * 請款任務的年度進度。年份取截止日期字串的四碼年，與月欄的 YYYY-MM-DD 解析一致。
 * @param {string | null | undefined} dueOn
 * @returns {number | null}
 */
export function dueCalendarYear(dueOn) {
  if (typeof dueOn !== "string") return null;
  const match = dueOn.match(/^(\d{4})-(\d{2})-\d{2}/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || month < 1 || month > 12) return null;
  return year;
}

/**
 * @param {number} collected
 * @param {number} total
 * @returns {number | null}
 */
export function billingProgressPercent(collected, total) {
  if (!(total > 0)) return null;
  return Math.round((collected / total) * 100);
}

/**
 * @param {Array<{ dueOn?: string | null, completed?: boolean, amount?: number | null }>} tasks
 * @returns {Array<{ year: number, collected: number, total: number, percent: number | null }>}
 */
export function yearBillingTotals(tasks) {
  const byYear = new Map();
  for (const task of tasks) {
    const year = dueCalendarYear(task.dueOn);
    if (year == null) continue;
    const amount =
      typeof task.amount === "number" && Number.isFinite(task.amount) ? task.amount : 0;
    const row = byYear.get(year) ?? { collected: 0, total: 0 };
    row.total += amount;
    if (task.completed) row.collected += amount;
    byYear.set(year, row);
  }
  return [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, row]) => ({
      year,
      collected: row.collected,
      total: row.total,
      percent: billingProgressPercent(row.collected, row.total),
    }));
}
