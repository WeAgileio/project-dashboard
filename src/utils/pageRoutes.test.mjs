import assert from "node:assert/strict";
import test from "node:test";
import { pageFromPath, pathForPage, resolveDashboardLocation } from "./pageRoutes.mjs";

test("根路徑與 /progress 都是專案進展", () => {
  assert.equal(pageFromPath("/"), "progressByTime");
  assert.equal(pageFromPath("/progress"), "progressByTime");
  assert.equal(pageFromPath("/progress/"), "progressByTime");
});

test("請款頁路徑", () => {
  assert.equal(pageFromPath("/billing"), "billingTasks");
  assert.equal(pageFromPath("/billing/"), "billingTasks");
  assert.equal(pageFromPath("/billing/by-time"), "billingTasksByTime");
  assert.equal(pageFromPath("/billing/by-time/"), "billingTasksByTime");
});

test("十週與 Sprint 路徑", () => {
  assert.equal(pageFromPath("/trends"), "trends");
  assert.equal(pageFromPath("/trends/"), "trends");
  assert.equal(pageFromPath("/sprint"), "sprintTrend");
  assert.equal(pageFromPath("/sprint/"), "sprintTrend");
});

test("未知路徑不是任何頁", () => {
  assert.equal(pageFromPath("/not-a-page"), null);
  assert.equal(pageFromPath("/billing/other"), null);
});

test("每個分頁寫入的 path", () => {
  assert.equal(pathForPage("progressByTime"), "/progress");
  assert.equal(pathForPage("billingTasks"), "/billing");
  assert.equal(pathForPage("billingTasksByTime"), "/billing/by-time");
  assert.equal(pathForPage("trends"), "/trends");
  assert.equal(pathForPage("sprintTrend"), "/sprint");
});

const asana = { trends: true, sprint: false };
const notion = { trends: false, sprint: true };
const demo = { trends: false, sprint: false };

test("看得到的頁面留在自己的 path，根路徑維持 /", () => {
  assert.deepEqual(resolveDashboardLocation("/", asana), {
    page: "progressByTime",
    path: "/",
  });
  assert.deepEqual(resolveDashboardLocation("/billing/", asana), {
    page: "billingTasks",
    path: "/billing",
  });
  assert.deepEqual(resolveDashboardLocation("/trends", asana), {
    page: "trends",
    path: "/trends",
  });
  assert.deepEqual(resolveDashboardLocation("/sprint", notion), {
    page: "sprintTrend",
    path: "/sprint",
  });
});

test("隱藏或未知路徑落到專案進展", () => {
  assert.deepEqual(resolveDashboardLocation("/trends", notion), {
    page: "progressByTime",
    path: "/progress",
  });
  assert.deepEqual(resolveDashboardLocation("/sprint", asana), {
    page: "progressByTime",
    path: "/progress",
  });
  assert.deepEqual(resolveDashboardLocation("/trends", demo), {
    page: "progressByTime",
    path: "/progress",
  });
  assert.deepEqual(resolveDashboardLocation("/sprint", demo), {
    page: "progressByTime",
    path: "/progress",
  });
  assert.deepEqual(resolveDashboardLocation("/not-a-page", asana), {
    page: "progressByTime",
    path: "/progress",
  });
});
