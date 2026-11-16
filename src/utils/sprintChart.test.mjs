import assert from "node:assert/strict";
import test from "node:test";
import { buildSprintChart, formatSprintNumber } from "./sprintChart.mjs";

const sample = [
  { date: "2026-05-25", done: 59, rate: 91.6, plugin: null, url: "https://www.notion.so/a" },
  { date: "2026-10-05", done: 102, rate: 99, plugin: 35, pluginAvg: 21.3, url: "https://www.notion.so/b" },
];

test("Sprint 圖由左到右，空的插件不畫成 0，數字標在圖上", () => {
  const chart = buildSprintChart(sample, 800);
  assert.ok(chart.hits[0].x < chart.hits[1].x);
  assert.equal(chart.series.find((item) => item.key === "plugin").points[0], null);
  assert.equal(chart.series.find((item) => item.key === "plugin").points[1].value, 35);
  assert.equal((chart.svg.match(/fill="#46A171"/g) || []).length, 1);
  assert.match(chart.svg, /91\.6/);
  assert.match(chart.svg, />102</);
  assert.equal(formatSprintNumber(91.6), "91.6");
  assert.equal(formatSprintNumber(102), "102");
});

test("懸停只列出有畫出來的序列", () => {
  const chart = buildSprintChart(sample, 800);
  assert.deepEqual(
    chart.hits[0].items.map((item) => item.text),
    ["59", "91.6"]
  );
  assert.equal(chart.hits[0].url, "https://www.notion.so/a");
  assert.equal(chart.hits[1].url, "https://www.notion.so/b");
  assert.match(chart.svg, /data-index="0"/);
  assert.match(chart.svg, /data-index="1"/);
  assert.equal(chart.hits[1].date, "2026-10-05");
  assert.deepEqual(
    chart.hits[1].items.map((item) => `${item.label} ${item.text}`),
    ["完成 102", "速率 99", "插件 35", "插件平均 21.3"]
  );
});
