import assert from "node:assert/strict";
import test from "node:test";
import {
  billingProgressPercent,
  dueCalendarYear,
  yearBillingTotals,
} from "./yearBillingProgress.mjs";

test("已完成計入已收與總額，未完成只計入總額", () => {
  const rows = yearBillingTotals([
    { dueOn: "2026-01-15", completed: true, amount: 100 },
    { dueOn: "2026-06-01", completed: false, amount: 50 },
  ]);
  assert.deepEqual(rows, [
    { year: 2026, collected: 100, total: 150, percent: 67 },
  ]);
});

test("沒有截止日期的任務不計入任何一年", () => {
  const rows = yearBillingTotals([
    { dueOn: null, completed: true, amount: 80 },
    { dueOn: "", completed: true, amount: 20 },
    { dueOn: "2026-03-01", completed: true, amount: 10 },
  ]);
  assert.deepEqual(rows, [{ year: 2026, collected: 10, total: 10, percent: 100 }]);
});

test("已收 1、總額 4 的百分比是 25", () => {
  assert.equal(billingProgressPercent(1, 4), 25);
  const rows = yearBillingTotals([
    { dueOn: "2026-02-01", completed: true, amount: 1 },
    { dueOn: "2026-02-02", completed: false, amount: 3 },
  ]);
  assert.equal(rows[0].percent, 25);
  assert.equal(rows[0].collected, 1);
  assert.equal(rows[0].total, 4);
});

test("總額為 0 時沒有百分比", () => {
  assert.equal(billingProgressPercent(0, 0), null);
  const rows = yearBillingTotals([
    { dueOn: "2026-04-01", completed: false, amount: 0 },
    { dueOn: "2026-04-02", completed: true, amount: null },
  ]);
  assert.deepEqual(rows, [{ year: 2026, collected: 0, total: 0, percent: null }]);
});

test("年份取截止日期字串，不跟別的欄位走", () => {
  assert.equal(dueCalendarYear("2026-12-31"), 2026);
  assert.equal(dueCalendarYear("2025-01-01"), 2025);
  const rows = yearBillingTotals([
    { dueOn: "2026-08-01", completed: true, amount: 9, sectionYear: 2025 },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].year, 2026);
  assert.equal(rows[0].collected, 9);
});
