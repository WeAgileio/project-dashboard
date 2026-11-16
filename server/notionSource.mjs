import axios from "axios";
import { createHash } from "node:crypto";

const NOTION_VERSION = "2022-06-28";
const NOTION_API = "https://api.notion.com/v1";
const DEFAULT_ROOT_PAGE_ID = "";
const DEFAULT_SPRINT_PAGE_ID = "10c53bdeb3b182b9b43b013316121b31";
const TASK_DATABASE_TITLE = "任務";
const STATUS_DATABASE_TITLE = "狀態更新";
const SPRINT_DATABASE_TITLE = "Sprint 表格彙整";
const BUNDLE_TTL_MS = 5 * 60_000;

const notion = axios.create({ baseURL: NOTION_API });

/** @type {Map<string, { expiresAt: number, pages: any[] }>} */
const projectListCache = new Map();
/** @type {Map<string, { expiresAt: number, tasks: any[], stageOrder: string[], statusUpdatedAt: string | null }>} */
const taskBundleCache = new Map();
/** @type {Map<string, string>} */
const userNameCache = new Map();
/** @type {Map<string, { expiresAt: number, payload: { sourceTitle: string, points: { date: string, done: number | null, rate: number | null, plugin: number | null }[] } }>} */
const sprintTrendCache = new Map();

export function resolveDataSource(raw) {
  const trimmed = raw == null ? "" : String(raw).trim();
  if (trimmed === "") return "asana";
  const lower = trimmed.toLowerCase();
  if (lower === "asana" || lower === "notion") return lower;
  const err = new Error(`無效的 DATA_SOURCE：${raw}`);
  err.code = "INVALID_DATA_SOURCE";
  throw err;
}

export function resolveRootPageId(raw) {
  const trimmed = raw == null ? "" : String(raw).trim();
  return trimmed || DEFAULT_ROOT_PAGE_ID;
}

export function resolveSprintPageId(raw) {
  const trimmed = raw == null ? "" : String(raw).trim();
  return trimmed || DEFAULT_SPRINT_PAGE_ID;
}

export function formatSprintNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function sprintDateStart(prop) {
  if (!prop || prop.type !== "date") return null;
  const start = prop.date?.start;
  if (typeof start !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(start)) return null;
  return start.slice(0, 10);
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sprintStatusName(prop) {
  if (!prop || prop.type !== "status") return "";
  return typeof prop.status?.name === "string" ? prop.status.name : "";
}

function sprintNumber(prop) {
  if (!prop) return null;
  if (prop.type === "number") return finiteNumber(prop.number);
  if (prop.type === "formula" && prop.formula?.type === "number") return finiteNumber(prop.formula.number);
  return null;
}

export function sprintPointsFromPages(pages) {
  const rows = [];
  for (const page of pages || []) {
    const props = page?.properties || {};
    const date = sprintDateStart(props["第一天｜日期"]);
    if (!date || sprintStatusName(props["狀態"]) !== "完成") continue;
    const rawUrl = typeof page?.url === "string" ? page.url.trim() : "";
    rows.push({
      date,
      done: sprintNumber(props["最後一天｜完成數"]),
      plugin: sprintNumber(props["最後一天｜插件"]),
      order: sprintNumber(props["排序"]),
      title: plainText(props["日期（原文）"]),
      url: rawUrl.startsWith("https://") ? rawUrl : "",
    });
  }
  rows.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.order == null && b.order != null) return 1;
    if (a.order != null && b.order == null) return -1;
    if (a.order != null && b.order != null && a.order !== b.order) return a.order - b.order;
    if (a.title !== b.title) return a.title < b.title ? -1 : 1;
    return 0;
  });
  return rows.map((row, index) => ({
    date: row.date,
    done: row.done,
    rate: trailingAverage(rows, index, "done"),
    plugin: row.plugin,
    pluginAvg: trailingAverage(rows, index, "plugin"),
    url: row.url,
  }));
}

function trailingAverage(rows, index, key) {
  if (index < 2) return null;
  const window = [rows[index - 2][key], rows[index - 1][key], rows[index][key]];
  if (window.some((value) => value == null)) return null;
  return Math.round(((window[0] + window[1] + window[2]) / 3) * 10) / 10;
}

export function clearSprintTrendCache() {
  sprintTrendCache.clear();
}

export async function loadSprintTrend(token, pageId, options = {}) {
  const bypass = Boolean(options.bypass);
  const now = typeof options.now === "number" ? options.now : Date.now();
  const listBlocks = options.listBlocks || listAllBlocks;
  const queryPages = options.queryPages || queryAllPages;
  const key = `${tokenHash(token)}:${pageId}`;
  if (!bypass) {
    const hit = sprintTrendCache.get(key);
    if (hit && hit.expiresAt > now) return hit.payload;
  }
  const blocks = await listBlocks(token, pageId);
  const databaseId = childDatabaseId(blocks, SPRINT_DATABASE_TITLE);
  if (!databaseId) {
    const err = new Error("找不到 Sprint 表格彙整，請確認該頁已分享給這個整合。");
    err.status = 404;
    throw err;
  }
  const pages = await queryPages(token, databaseId);
  const payload = {
    sourceTitle: SPRINT_DATABASE_TITLE,
    points: sprintPointsFromPages(pages),
  };
  sprintTrendCache.set(key, { payload, expiresAt: now + BUNDLE_TTL_MS });
  return payload;
}

export function childDatabaseId(blocks, title) {
  for (const block of blocks || []) {
    if (block?.type !== "child_database") continue;
    if (block.child_database?.title === title) return block.id;
  }
  return null;
}

export function projectGidFromPage(page) {
  const asanaId = plainText(page?.properties?.["AsanaID"]).trim();
  if (asanaId) return asanaId;
  return String(page?.id || "").replace(/-/g, "");
}

export function projectFromNotionPage(page, memberNames) {
  const link = typeof page?.url === "string" ? page.url.trim() : "";
  const names = Array.isArray(memberNames) ? memberNames : [];
  return {
    gid: projectGidFromPage(page),
    name: plainText(page?.properties?.["名稱"]).trim(),
    color: null,
    archived: false,
    created_at: page?.created_time ?? null,
    workspace_gid: null,
    permalink_url: link || null,
    project_brief: link ? { gid: null, permalink_url: link } : null,
    notes_permalink_url: link || null,
    project_brief_gid: null,
    project_permalink_url: link || null,
    members: names.map((name) => ({ name })),
    memberNames: names,
  };
}

export function taskFromNotionPage(page) {
  const props = page?.properties || {};
  const status = plainText(props["狀態"]).trim();
  const taskType = plainText(props["任務類型"]).trim();
  const amount = props["請款金額"]?.type === "number" ? props["請款金額"].number : null;
  const dueRaw = props["計畫完成時間"]?.type === "date" ? props["計畫完成時間"].date?.start : "";
  const due = typeof dueRaw === "string" && /^\d{4}-\d{2}-\d{2}/.test(dueRaw) ? dueRaw.slice(0, 10) : null;
  const assigneeNames = peopleNamesFromProperty(props["指派"]);
  const link = typeof page?.url === "string" ? page.url.trim() : "";
  const billingYes = taskType === "請款任務";
  return {
    stage: plainText(props["階段"]).trim(),
    task: {
      gid: plainText(props["AsanaID"]).trim() || String(page?.id || "").replace(/-/g, ""),
      name: plainText(props["名稱"]).trim(),
      completed: status === "完成",
      completed_at: null,
      created_at: page?.created_time ?? null,
      modified_at: null,
      due_on: due,
      assignee: assigneeNames.length
        ? { gid: "notion-assignee", name: assigneeNames.join("、") }
        : null,
      resource_subtype: null,
      permalink_url: link,
      custom_fields: [
        {
          gid: "notion-billing-amount",
          name: "請款金額",
          type: "number",
          number_value: typeof amount === "number" && Number.isFinite(amount) ? amount : null,
        },
        {
          gid: "notion-billing-task",
          name: "請款任務",
          type: "enum",
          enum_value: { name: billingYes ? "是" : "否" },
        },
      ],
    },
  };
}

/** 查詢已依 last_edited_time 降序時，第一列就是最新編輯。空結果為 null。 */
export function statusUpdatedAtFromPages(pages) {
  const first = Array.isArray(pages) ? pages[0] : null;
  const time = first?.last_edited_time;
  return typeof time === "string" && time.trim() ? time.trim() : null;
}

export function notionSectionsPayload(sections, statusUpdatedAt) {
  return {
    data: sections,
    status_updated_at: statusUpdatedAt ?? null,
  };
}

export function sectionsFromTasks(projectGid, taskRows, stageOrder) {
  const present = new Set(
    (taskRows || []).map((row) => row.stage).filter((name) => name)
  );
  const ordered = [];
  for (const name of stageOrder || []) {
    if (present.has(name)) {
      ordered.push(name);
      present.delete(name);
    }
  }
  for (const name of present) ordered.push(name);
  return ordered.map((name) => ({
    gid: `notion-section:${projectGid}:${name}`,
    name,
  }));
}

export function parseSectionGid(sectionGid) {
  const prefix = "notion-section:";
  if (typeof sectionGid !== "string" || !sectionGid.startsWith(prefix)) return null;
  const rest = sectionGid.slice(prefix.length);
  const colon = rest.indexOf(":");
  if (colon <= 0) return null;
  return {
    projectGid: rest.slice(0, colon),
    stageName: rest.slice(colon + 1),
  };
}

function tokenHash(token) {
  return createHash("sha256").update(token, "utf8").digest("hex").slice(0, 32);
}

function notionHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

function plainText(prop) {
  if (!prop || typeof prop !== "object") return "";
  if (prop.type === "title") return joinRich(prop.title);
  if (prop.type === "rich_text") return joinRich(prop.rich_text);
  if (prop.type === "url") return prop.url || "";
  if (prop.type === "select") return prop.select?.name || "";
  if (prop.type === "status") return prop.status?.name || "";
  return "";
}

function joinRich(parts) {
  if (!Array.isArray(parts)) return "";
  return parts.map((part) => (part && part.plain_text) || "").join("");
}

function peopleNamesFromProperty(prop) {
  if (!prop || prop.type !== "people" || !Array.isArray(prop.people)) return [];
  return prop.people
    .map((person) => (person && typeof person.name === "string" ? person.name.trim() : ""))
    .filter(Boolean);
}

async function notionGet(token, path, params) {
  const res = await notion.get(path, { headers: notionHeaders(token), params });
  return res.data;
}

async function notionPost(token, path, body) {
  const res = await notion.post(path, body, { headers: notionHeaders(token) });
  return res.data;
}

async function listAllBlocks(token, blockId) {
  const blocks = [];
  let cursor;
  do {
    const page = await notionGet(token, `/blocks/${blockId}/children`, {
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    blocks.push(...(page.results || []));
    cursor = page.has_more ? page.next_cursor : undefined;
  } while (cursor);
  return blocks;
}

async function latestStatusUpdatedAt(token, databaseId) {
  const page = await notionPost(token, `/databases/${databaseId}/query`, {
    page_size: 1,
    sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
  });
  return statusUpdatedAtFromPages(page?.results);
}

async function queryAllPages(token, databaseId) {
  const pages = [];
  let cursor;
  do {
    const page = await notionPost(token, `/databases/${databaseId}/query`, {
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    pages.push(...(page.results || []));
    cursor = page.has_more ? page.next_cursor : undefined;
  } while (cursor);
  return pages;
}

async function userName(token, userId) {
  const key = `${tokenHash(token)}:${userId}`;
  if (userNameCache.has(key)) return userNameCache.get(key);
  let name = "";
  try {
    const user = await notionGet(token, `/users/${userId}`);
    name = typeof user?.name === "string" ? user.name.trim() : "";
  } catch {
    name = "";
  }
  userNameCache.set(key, name);
  return name;
}

async function memberNamesOf(token, page) {
  const names = [];
  for (const key of ["主設計", "窗口"]) {
    const prop = page?.properties?.[key];
    if (!prop || prop.type !== "people" || !Array.isArray(prop.people)) continue;
    for (const person of prop.people) {
      const direct = person && typeof person.name === "string" ? person.name.trim() : "";
      const name = direct || (person?.id ? await userName(token, person.id) : "");
      if (name && !names.includes(name)) names.push(name);
    }
  }
  return names;
}

async function assigneeNames(token, page) {
  const direct = peopleNamesFromProperty(page?.properties?.["指派"]);
  if (direct.length) return direct;
  const prop = page?.properties?.["指派"];
  if (!prop || prop.type !== "people" || !Array.isArray(prop.people)) return [];
  const names = [];
  for (const person of prop.people) {
    if (!person?.id) continue;
    const name = await userName(token, person.id);
    if (name) names.push(name);
  }
  return names;
}

const rootDatabaseCache = new Map();

async function rootDatabaseId(token, rootPageId) {
  const key = `${tokenHash(token)}:${rootPageId}`;
  const hit = rootDatabaseCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.id;
  const blocks = await listAllBlocks(token, rootPageId);
  const id =
    childDatabaseId(blocks, "專案總表") ||
    blocks.find((block) => block?.type === "child_database")?.id ||
    null;
  if (!id) {
    const err = new Error("根頁面裡找不到專案資料庫");
    err.status = 404;
    throw err;
  }
  rootDatabaseCache.set(key, { id, expiresAt: Date.now() + BUNDLE_TTL_MS });
  return id;
}

export async function assertRootReadable(token, rootPageId) {
  await notionGet(token, `/pages/${rootPageId}`);
}

async function allProjectPages(token, rootPageId, bypass) {
  const key = `${tokenHash(token)}:${rootPageId}`;
  if (!bypass) {
    const hit = projectListCache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.pages;
  }
  const databaseId = await rootDatabaseId(token, rootPageId);
  const pages = await queryAllPages(token, databaseId);
  projectListCache.set(key, { pages, expiresAt: Date.now() + BUNDLE_TTL_MS });
  return pages;
}

async function findProjectPage(token, rootPageId, projectGid, bypass) {
  const pages = await allProjectPages(token, rootPageId, bypass);
  const want = String(projectGid).replace(/-/g, "");
  return (
    pages.find((page) => projectGidFromPage(page).replace(/-/g, "") === want) || null
  );
}

async function taskBundle(token, rootPageId, projectGid, bypass) {
  const key = `${tokenHash(token)}:${rootPageId}:${projectGid}`;
  if (!bypass) {
    const hit = taskBundleCache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit;
  }
  const projectPage = await findProjectPage(token, rootPageId, projectGid, bypass);
  if (!projectPage) return null;
  const blocks = await listAllBlocks(token, projectPage.id);
  const databaseId = childDatabaseId(blocks, TASK_DATABASE_TITLE);
  const statusDatabaseId = childDatabaseId(blocks, STATUS_DATABASE_TITLE);
  let stageOrder = [];
  let tasks = [];
  const statusUpdatedAt = statusDatabaseId
    ? await latestStatusUpdatedAt(token, statusDatabaseId)
    : null;
  if (databaseId) {
    const schema = await notionGet(token, `/databases/${databaseId}`);
    const stageProp = schema?.properties?.["階段"];
    const options =
      stageProp?.select?.options || stageProp?.status?.options || [];
    stageOrder = options.map((option) => option?.name).filter(Boolean);
    const pages = await queryAllPages(token, databaseId);
    tasks = [];
    for (const page of pages) {
      const mapped = taskFromNotionPage(page);
      const names = await assigneeNames(token, page);
      if (names.length) {
        mapped.task.assignee = { gid: "notion-assignee", name: names.join("、") };
      }
      tasks.push(mapped);
    }
  }
  const bundle = {
    tasks,
    stageOrder,
    statusUpdatedAt,
    expiresAt: Date.now() + BUNDLE_TTL_MS,
  };
  taskBundleCache.set(key, bundle);
  return bundle;
}

export async function handleNotionRequest(token, path, { rootPageId, bypass }) {
  if (path === "/workspaces") {
    return { data: [{ gid: "notion", name: "Notion" }] };
  }

  if (path === "/projects") {
    const pages = await allProjectPages(token, rootPageId, bypass);
    const data = [];
    for (const page of pages) {
      data.push(projectFromNotionPage(page, await memberNamesOf(token, page)));
    }
    return { data };
  }

  const projectMatch = path.match(/^\/projects\/([^/]+)$/);
  if (projectMatch) {
    const page = await findProjectPage(token, rootPageId, decodeURIComponent(projectMatch[1]), bypass);
    if (!page) {
      const err = new Error("找不到專案");
      err.status = 404;
      throw err;
    }
    return { data: projectFromNotionPage(page, await memberNamesOf(token, page)) };
  }

  const sectionMatch = path.match(/^\/projects\/([^/]+)\/sections$/);
  if (sectionMatch) {
    const projectGid = decodeURIComponent(sectionMatch[1]);
    const bundle = await taskBundle(token, rootPageId, projectGid, bypass);
    if (!bundle) {
      const err = new Error("找不到專案");
      err.status = 404;
      throw err;
    }
    return notionSectionsPayload(
      sectionsFromTasks(projectGid, bundle.tasks, bundle.stageOrder),
      bundle.statusUpdatedAt
    );
  }

  const taskMatch = path.match(/^\/sections\/(.+)\/tasks$/);
  if (taskMatch) {
    const parsed = parseSectionGid(decodeURIComponent(taskMatch[1]));
    if (!parsed) {
      const err = new Error("階段 id 無法解析");
      err.status = 404;
      throw err;
    }
    const bundle = await taskBundle(token, rootPageId, parsed.projectGid, bypass);
    if (!bundle) {
      const err = new Error("找不到專案");
      err.status = 404;
      throw err;
    }
    const data = bundle.tasks
      .filter((row) => row.stage === parsed.stageName)
      .map((row) => row.task);
    return { data };
  }

  const err = new Error("Notion 模式不支援此路徑");
  err.status = 404;
  throw err;
}
