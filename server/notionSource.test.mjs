import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { apiCacheKey, shouldBypassApiCache } from "./index.mjs";
import {
  childDatabaseId,
  parseSectionGid,
  projectFromNotionPage,
  projectGidFromPage,
  clearSprintTrendCache,
  formatSprintNumber,
  loadSprintTrend,
  resolveDataSource,
  resolveRootPageId,
  resolveSprintPageId,
  sprintPointsFromPages,
  notionSectionsPayload,
  sectionsFromTasks,
  statusUpdatedAtFromPages,
  taskFromNotionPage,
} from "./notionSource.mjs";

test("DATA_SOURCE 空值是 asana，非法值帶出原字", () => {
  assert.equal(resolveDataSource(""), "asana");
  assert.equal(resolveDataSource(undefined), "asana");
  assert.equal(resolveDataSource(" Notion "), "notion");
  assert.throws(() => resolveDataSource("nope"), /無效的 DATA_SOURCE：nope/);
});

test("根頁面 ID 有預設", () => {
  assert.equal(resolveRootPageId(""), "");
  assert.equal(resolveRootPageId(" abc "), "abc");
});

function sprintNum(number) {
  return { type: "number", number };
}

function sprintPage({
  date,
  status = "完成",
  order = 1,
  title = "Sprint",
  done = 1,
  rate = 1,
  plugin = null,
  url,
}) {
  return {
    url: url ?? `https://www.notion.so/${title}`,
    properties: {
      狀態: { type: "status", status: { name: status } },
      排序: sprintNum(order),
      "日期（原文）": { type: "title", title: [{ plain_text: title }] },
      "第一天｜日期": date ? { type: "date", date: { start: date } } : { type: "date", date: null },
      "最後一天｜完成數": sprintNum(done),
      "最後一天｜速率": sprintNum(rate),
      "最後一天｜插件": sprintNum(plugin),
      "最後一天｜湧": sprintNum(9),
      "近三週數據": { type: "rich_text", rich_text: [{ plain_text: "1、2、3" }] },
      "第一天｜check": sprintNum(4),
      "第一天｜客戶": sprintNum(8),
    },
  };
}

test("Sprint 頁面 ID 空值用預設頁", () => {
  assert.equal(resolveSprintPageId(""), "10c53bdeb3b182b9b43b013316121b31");
  assert.equal(resolveSprintPageId(undefined), "10c53bdeb3b182b9b43b013316121b31");
  assert.equal(resolveSprintPageId("  abc "), "abc");
});

test("Sprint 列只留有第一天日期的三個數字，並依日期、排序、標題排", () => {
  const points = sprintPointsFromPages([
    sprintPage({ date: "2026-06-01", order: 1, title: "late", done: 10, rate: 11, plugin: 1 }),
    sprintPage({ date: "2026-05-25", order: 9, title: "b", done: 59, rate: 91.6, plugin: null, status: "進行中" }),
    sprintPage({ date: "2026-05-25", order: null, title: "z", done: 2, rate: 2, plugin: 0 }),
    sprintPage({ date: "2026-05-25", order: null, title: "a", done: 3, rate: 3, plugin: 0 }),
    sprintPage({
      date: "2026-05-25",
      order: 2,
      title: "early-order",
      done: 4,
      rate: 4,
      plugin: 5,
      url: "https://www.notion.so/early",
    }),
    sprintPage({ date: null, title: "undated", done: 100, rate: 100, plugin: 100 }),
  ]);
  assert.deepEqual(points, [
    { date: "2026-05-25", done: 4, rate: null, plugin: 5, pluginAvg: null, url: "https://www.notion.so/early" },
    { date: "2026-05-25", done: 3, rate: null, plugin: 0, pluginAvg: null, url: "https://www.notion.so/a" },
    { date: "2026-05-25", done: 2, rate: 3, plugin: 0, pluginAvg: 1.7, url: "https://www.notion.so/z" },
    { date: "2026-06-01", done: 10, rate: 5, plugin: 1, pluginAvg: 0.3, url: "https://www.notion.so/late" },
  ]);
  const bare = sprintPointsFromPages([
    { properties: { "第一天｜日期": { type: "date", date: { start: "2026-01-01" } } } },
  ]);
  assert.equal(bare.length, 0);
  for (const point of points) {
    assert.deepEqual(Object.keys(point).sort(), ["date", "done", "plugin", "pluginAvg", "rate", "url"]);
    assert.equal(JSON.stringify(point).includes("湧"), false);
    assert.equal(JSON.stringify(point).includes("近三週"), false);
    assert.equal(JSON.stringify(point).includes("check"), false);
    assert.equal(JSON.stringify(point).includes("客戶"), false);
  }
});

test("未完成的 Sprint 不進圖，也不進平均", () => {
  const points = sprintPointsFromPages([
    sprintPage({ date: "2026-05-25", done: 30, plugin: 3, title: "a" }),
    sprintPage({ date: "2026-06-01", done: 900, plugin: 90, title: "b", status: "進行中" }),
    sprintPage({ date: "2026-06-08", done: 60, plugin: 6, title: "c", status: "未開始" }),
    sprintPage({ date: "2026-06-15", done: 90, plugin: 9, title: "d" }),
    sprintPage({ date: "2026-06-22", done: 120, plugin: 12, title: "e" }),
  ]);
  assert.deepEqual(
    points.map((point) => point.date),
    ["2026-05-25", "2026-06-15", "2026-06-22"]
  );
  assert.equal(points[2].rate, 80);
  assert.equal(points[2].pluginAvg, 8);
});

test("完成數是公式時仍能算出近三週速率", () => {
  const page = (date, done) => {
    const row = sprintPage({ date, done, title: date });
    row.properties["最後一天｜完成數"] = {
      type: "formula",
      formula: { type: "number", number: done },
    };
    return row;
  };
  const blank = sprintPage({ date: "2026-06-15", title: "blank" });
  blank.properties["最後一天｜完成數"] = { type: "formula", formula: { type: "number", number: null } };
  const points = sprintPointsFromPages([
    page("2026-05-25", 59),
    page("2026-06-01", 116),
    page("2026-06-08", 90),
    blank,
  ]);
  assert.equal(points[2].done, 90);
  assert.equal(points[2].rate, 88.3);
  assert.equal(points[3].done, null);
  assert.equal(points[3].rate, null);
});

test("速率是近三週完成平均，插件平均要連續三個都有數字", () => {
  const points = sprintPointsFromPages([
    sprintPage({ date: "2026-05-25", done: 59, plugin: null, title: "a" }),
    sprintPage({ date: "2026-06-01", done: 116, plugin: null, title: "b" }),
    sprintPage({ date: "2026-06-08", done: 90, plugin: 35, title: "c" }),
    sprintPage({ date: "2026-06-15", done: 172, plugin: 13, title: "d" }),
    sprintPage({ date: "2026-06-22", done: 139, plugin: 16, title: "e" }),
  ]);
  assert.equal(points[0].rate, null);
  assert.equal(points[1].rate, null);
  assert.equal(points[2].rate, 88.3);
  assert.equal(points[2].pluginAvg, null);
  assert.equal(points[3].pluginAvg, null);
  assert.equal(points[4].pluginAvg, 21.3);
});

test("formatSprintNumber 整數不帶小數，其餘一位", () => {
  assert.equal(formatSprintNumber(102), "102");
  assert.equal(formatSprintNumber(91.6), "91.6");
  assert.equal(formatSprintNumber(91.64), "91.6");
});

test("專案 gid 優先 AsanaID，完成狀態仍可映射", () => {
  const page = {
    id: "3e453bde-b3b1-817f-b6c4-f6ed201cc261",
    created_time: "2026-01-02T00:00:00.000Z",
    url: "https://www.notion.so/page",
    properties: {
      名稱: { type: "title", title: [{ plain_text: "久樘-一心段" }] },
      AsanaID: { type: "rich_text", rich_text: [{ plain_text: "1213756671111644" }] },
      Asana連結: {
        type: "url",
        url: "https://app.asana.com/1/1/project/1213756671111644",
      },
      狀態: { type: "status", status: { name: "完成" } },
      請款金額: { type: "number", number: 999 },
    },
  };
  assert.equal(projectGidFromPage(page), "1213756671111644");
  const project = projectFromNotionPage(page, ["主設計甲", "窗口乙"]);
  assert.equal(project.gid, "1213756671111644");
  assert.equal(project.name, "久樘-一心段");
  assert.deepEqual(project.memberNames, ["主設計甲", "窗口乙"]);
  assert.equal(project.archived, false);
  assert.equal(project.notes_permalink_url, "https://www.notion.so/page");
  assert.equal(project.project_permalink_url, "https://www.notion.so/page");
  assert.equal(project.permalink_url, "https://www.notion.so/page");
  assert.equal(project.project_brief.permalink_url, "https://www.notion.so/page");
});

test("沒有 AsanaID 時用 Notion 頁面 id", () => {
  const page = { id: "aaaa-bbbb", properties: {} };
  assert.equal(projectGidFromPage(page), "aaaabbbb");
});

test("只認標題恰好為任務的子資料庫", () => {
  const blocks = [
    { type: "child_database", id: "status-db", child_database: { title: "狀態更新" } },
    { type: "child_database", id: "task-db", child_database: { title: "任務" } },
  ];
  assert.equal(childDatabaseId(blocks, "任務"), "task-db");
  assert.equal(childDatabaseId(blocks, "狀態更新"), "status-db");
  assert.equal(childDatabaseId(blocks, "任務 "), null);
});

test("階段只含有任務者，並依選項順序", () => {
  const rows = [
    { stage: "C15 圖說最終修正階段" },
    { stage: "C01-1 新案洽談" },
    { stage: "" },
  ];
  const sections = sectionsFromTasks("121", rows, [
    "C01-1 新案洽談",
    "C02 報價／議價",
    "C15 圖說最終修正階段",
  ]);
  assert.deepEqual(
    sections.map((section) => section.name),
    ["C01-1 新案洽談", "C15 圖說最終修正階段"]
  );
  assert.equal(sections[1].gid, "notion-section:121:C15 圖說最終修正階段");
  assert.deepEqual(parseSectionGid(sections[1].gid), {
    projectGid: "121",
    stageName: "C15 圖說最終修正階段",
  });
});

test("進行中的請款任務用任務金額，不是專案金額", () => {
  const page = {
    id: "task-1",
    created_time: "2026-03-01T00:00:00.000Z",
    url: "https://www.notion.so/task",
    properties: {
      名稱: { type: "title", title: [{ plain_text: "竣工圖確認" }] },
      狀態: { type: "status", status: { name: "進行中" } },
      任務類型: { type: "select", select: { name: "請款任務" } },
      請款金額: { type: "number", number: 1200 },
      階段: { type: "select", select: { name: "C15 圖說最終修正階段" } },
      計畫完成時間: { type: "date", date: { start: "2026-09-01T08:00:00.000+08:00" } },
      指派: { type: "people", people: [{ id: "u1", name: "周以恒" }] },
      Asana連結: { type: "url", url: "https://app.asana.com/0/1/2" },
    },
  };
  const mapped = taskFromNotionPage(page);
  assert.equal(mapped.stage, "C15 圖說最終修正階段");
  assert.equal(mapped.task.completed, false);
  assert.equal(mapped.task.due_on, "2026-09-01");
  assert.equal(mapped.task.assignee.name, "周以恒");
  assert.equal(mapped.task.permalink_url, "https://www.notion.so/task");
  const amount = mapped.task.custom_fields.find((field) => field.name === "請款金額");
  const flag = mapped.task.custom_fields.find((field) => field.name === "請款任務");
  assert.equal(amount.number_value, 1200);
  assert.equal(flag.enum_value.name, "是");
  assert.equal(
    mapped.task.custom_fields.some((field) => field.number_value === 999),
    false
  );
});

test("完成的一般任務不是請款任務", () => {
  const mapped = taskFromNotionPage({
    id: "task-2",
    url: "https://www.notion.so/t2",
    properties: {
      名稱: { type: "title", title: [{ plain_text: "調整圖說" }] },
      狀態: { type: "status", status: { name: "完成" } },
      任務類型: { type: "select", select: { name: "一般任務" } },
      請款金額: { type: "number", number: null },
    },
  });
  assert.equal(mapped.task.completed, true);
  assert.equal(
    mapped.task.custom_fields.find((field) => field.name === "請款任務").enum_value.name,
    "否"
  );
  assert.equal(
    mapped.task.custom_fields.find((field) => field.name === "請款金額").number_value,
    null
  );
});

test("狀態更新只取最新編輯時間，列不會變成階段或任務", () => {
  const statusPages = [
    {
      last_edited_time: "2026-09-27T01:00:00.000Z",
      properties: {
        日期: { type: "title", title: [{ plain_text: "2026/09/26" }] },
      },
    },
  ];
  assert.equal(statusUpdatedAtFromPages(statusPages), "2026-09-27T01:00:00.000Z");
  assert.equal(statusUpdatedAtFromPages([]), null);
  assert.equal(statusUpdatedAtFromPages([{ last_edited_time: "  " }]), null);
  assert.deepEqual(sectionsFromTasks("p", [], ["C01-1 新案洽談"]), []);
});

test("Notion 區段回應帶 status_updated_at，Asana 形狀沒有", () => {
  const withEdit = notionSectionsPayload(
    [{ gid: "s", name: "C01-1 新案洽談" }],
    "2026-09-27T01:00:00.000Z"
  );
  assert.equal(withEdit.status_updated_at, "2026-09-27T01:00:00.000Z");
  assert.equal(withEdit.data[0].name, "C01-1 新案洽談");
  assert.equal(notionSectionsPayload([{ gid: "s", name: "C01" }], null).status_updated_at, null);
  const proxy = readFileSync(new URL("./index.mjs", import.meta.url), "utf8");
  assert.equal(proxy.includes("status_updated_at"), false);
});

test("快取鍵含資料來源與權杖，換來源或換金鑰就不同", () => {
  const asanaKey = apiCacheKey("asana", "pat-a", "/projects", "limit=100");
  const notionKey = apiCacheKey("notion", "pat-a", "/projects", "limit=100");
  const otherToken = apiCacheKey("notion", "pat-b", "/projects", "limit=100");
  assert.notEqual(asanaKey, notionKey);
  assert.notEqual(notionKey, otherToken);
  assert.match(notionKey, /^notion:/);
  assert.match(asanaKey, /^asana:/);
});

function runServer(env) {
  return spawn(process.execPath, ["server/index.mjs"], {
    env: { ...process.env, ...env },
    cwd: fileURLToPath(new URL("..", import.meta.url)),
  });
}

function waitForExit(child, ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill();
      resolve({ code: null, stderr: "" });
    }, ms);
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve({ code, stderr });
    });
  });
}

test("非法 DATA_SOURCE 讓程序退出並印出該值", async () => {
  const child = runServer({ DATA_SOURCE: "nope", PORT: "0" });
  const result = await waitForExit(child, 8000);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /nope/);
});

test("未設定 DATA_SOURCE 時 /api/config 是 asana", async () => {
  const port = 9877;
  const env = { ...process.env, PORT: String(port), DATA_SOURCE: "" };
  delete env.NOTION_TOKEN;
  const child = spawn(process.execPath, ["server/index.mjs"], {
    env,
    cwd: fileURLToPath(new URL("..", import.meta.url)),
  });
  let stdout = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(stdout || "server did not start")), 8000);
    const tick = setInterval(() => {
      if (stdout.includes("監聽埠")) {
        clearInterval(tick);
        clearTimeout(timer);
        resolve();
      }
    }, 50);
    child.on("exit", (code) => {
      clearInterval(tick);
      clearTimeout(timer);
      reject(new Error(`server exited ${code}: ${stdout}`));
    });
  });
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/config`);
    const body = await res.json();
    assert.deepEqual(body, { dataSource: "asana" });
  } finally {
    child.kill();
  }
});

test("DATA_SOURCE=notion 時 /api/config 是 notion", async () => {
  const port = 9876;
  const child = runServer({ DATA_SOURCE: "notion", NOTION_TOKEN: "", PORT: String(port) });
  let stdout = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(stdout || "server did not start")), 8000);
    const tick = setInterval(() => {
      if (stdout.includes("監聽埠")) {
        clearInterval(tick);
        clearTimeout(timer);
        resolve();
      }
    }, 50);
    child.on("exit", (code) => {
      clearInterval(tick);
      clearTimeout(timer);
      reject(new Error(`server exited ${code}: ${stdout}`));
    });
  });
  await ready;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/config`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body, { dataSource: "notion", authRequired: true });
  } finally {
    child.kill();
  }
});

test("NOTION_TOKEN 有值時略過登入，且設定回應不含金鑰", async () => {
  const port = 9875;
  const child = runServer({
    DATA_SOURCE: "notion",
    NOTION_TOKEN: "secret-from-env",
    PORT: String(port),
  });
  let stdout = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(stdout || "server did not start")), 8000);
    const tick = setInterval(() => {
      if (stdout.includes("監聽埠")) {
        clearInterval(tick);
        clearTimeout(timer);
        resolve();
      }
    }, 50);
    child.on("exit", (code) => {
      clearInterval(tick);
      clearTimeout(timer);
      reject(new Error(`server exited ${code}: ${stdout}`));
    });
  });
  try {
    const configRes = await fetch(`http://127.0.0.1:${port}/api/config`);
    const config = await configRes.json();
    assert.equal(config.authRequired, false);
    assert.equal(JSON.stringify(config).includes("secret-from-env"), false);
    const projectsRes = await fetch(`http://127.0.0.1:${port}/api/projects`);
    const projects = await projectsRes.json();
    assert.notEqual(projects.message, "尚未登入，請輸入 Notion 整合金鑰。");
  } finally {
    child.kill();
  }
});

function sprintDatabaseBlock() {
  return [{ type: "child_database", id: "db-sprint", child_database: { title: "Sprint 表格彙整" } }];
}

test("找不到 Sprint 資料庫是 404，不是 401", async () => {
  clearSprintTrendCache();
  await assert.rejects(
    () => loadSprintTrend("missing-db", "page", { listBlocks: async () => [], queryPages: async () => [] }),
    (err) => {
      assert.equal(err.status, 404);
      assert.notEqual(err.status, 401);
      return true;
    }
  );
});

test("Cache-Control: no-cache 與 _nocache 都會略過快取", () => {
  assert.equal(shouldBypassApiCache({ headers: { "cache-control": "no-cache" }, query: {} }), true);
  assert.equal(shouldBypassApiCache({ headers: {}, query: { _nocache: "1" } }), true);
  assert.equal(shouldBypassApiCache({ headers: {}, query: {} }), false);
});

test("Sprint 快取第二次不重讀，no-cache 會重讀，失敗不留在快取", async () => {
  clearSprintTrendCache();
  let reads = 0;
  let fail = false;
  const listBlocks = async () => {
    reads += 1;
    if (fail) throw new Error("notion down");
    return sprintDatabaseBlock();
  };
  const queryPages = async () => [sprintPage({ date: "2026-05-25", done: 59, rate: 59, plugin: null })];
  const first = await loadSprintTrend("cache-token", "page-1", { listBlocks, queryPages, now: 1000 });
  const second = await loadSprintTrend("cache-token", "page-1", { listBlocks, queryPages, now: 1000 });
  assert.equal(reads, 1);
  assert.deepEqual(second, first);
  await loadSprintTrend("cache-token", "page-1", { listBlocks, queryPages, now: 1000, bypass: true });
  assert.equal(reads, 2);
  fail = true;
  await assert.rejects(() =>
    loadSprintTrend("cache-token", "page-1", { listBlocks, queryPages, now: 1000, bypass: true })
  );
  fail = false;
  const after = await loadSprintTrend("cache-token", "page-1", { listBlocks, queryPages, now: 1000, bypass: true });
  assert.equal(after.points[0].done, 59);
  assert.equal(reads, 4);
});

test("Asana 模式的 /api/notion/sprints 是 404，且未設定時日誌印出預設 Sprint 頁", async () => {
  const port = 9881;
  const child = runServer({
    DATA_SOURCE: "asana",
    NOTION_SPRINT_PAGE_ID: "",
    NOTION_TOKEN: "",
    PORT: String(port),
  });
  let stdout = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(stdout || "server did not start")), 20000);
    const tick = setInterval(() => {
      if (stdout.includes("監聽埠")) {
        clearInterval(tick);
        clearTimeout(timer);
        resolve();
      }
    }, 50);
    child.on("exit", (code) => {
      clearInterval(tick);
      clearTimeout(timer);
      reject(new Error(`server exited ${code}: ${stdout}`));
    });
  });
  try {
    assert.match(stdout, /NOTION_SPRINT_PAGE_ID=10c53bdeb3b182b9b43b013316121b31/);
    const res = await fetch(`http://127.0.0.1:${port}/api/notion/sprints`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.message, "目前資料來源不是 Notion。");
  } finally {
    child.kill();
  }
});
