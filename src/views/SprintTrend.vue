<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import { fetchSprintTrend, popAsanaProxyCacheBypass, pushAsanaProxyCacheBypass, type SprintPoint } from "@/api/asana";
import { buildSprintChart } from "@/utils/sprintChart.mjs";

const loading = ref(false);
const error = ref<string | null>(null);
const sourceTitle = ref("Sprint 表格彙整");
const points = ref<SprintPoint[]>([]);
const svg = ref("");
const hits = ref<{ date: string; url: string; x: number; items: { label: string; color: string; text: string }[] }[]>([]);
const chartWidth = ref(800);
const wrap = ref<HTMLElement | null>(null);
const tip = ref<{ date: string; items: { label: string; color: string; text: string }[]; left: number; top: number } | null>(null);
const ranges = [
  { id: 6, label: "近六週" },
  { id: 12, label: "近十二週" },
  { id: 0, label: "全部" },
] as const;
const range = ref<(typeof ranges)[number]["id"]>(6);

const visiblePoints = computed(() => (range.value === 0 ? points.value : points.value.slice(-range.value)));
const showEmpty = computed(() => !loading.value && !error.value && points.value.length === 0);

function messageOf(err: unknown): string {
  const data = (err as { response?: { data?: { message?: string } } })?.response?.data;
  return data?.message || "讀取 Sprint 表格彙整失敗";
}

function paint() {
  const width = wrap.value?.clientWidth || chartWidth.value;
  chartWidth.value = width;
  if (!visiblePoints.value.length) {
    svg.value = "";
    hits.value = [];
    tip.value = null;
    return;
  }
  const chart = buildSprintChart(visiblePoints.value, width);
  svg.value = chart.svg;
  hits.value = chart.hits;
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const data = await fetchSprintTrend();
    sourceTitle.value = data.sourceTitle || "Sprint 表格彙整";
    points.value = data.points;
  } catch (err) {
    points.value = [];
    error.value = messageOf(err);
  } finally {
    loading.value = false;
    await nextTick();
    paint();
  }
}

async function reload() {
  pushAsanaProxyCacheBypass();
  try {
    await load();
  } finally {
    popAsanaProxyCacheBypass();
  }
}

function onMove(event: MouseEvent) {
  if (!wrap.value || !hits.value.length) return;
  const rect = wrap.value.getBoundingClientRect();
  const scale = chartWidth.value / (rect.width || 1);
  const mouseX = (event.clientX - rect.left) * scale;
  let nearest = 0;
  let min = Infinity;
  hits.value.forEach((hit, index) => {
    const dist = Math.abs(hit.x - mouseX);
    if (dist < min) {
      min = dist;
      nearest = index;
    }
  });
  const hit = hits.value[nearest];
  if (!hit || hit.items.length === 0) {
    tip.value = null;
    return;
  }
  tip.value = {
    date: hit.date,
    items: hit.items,
    left: event.clientX - rect.left + 12,
    top: event.clientY - rect.top - 12,
  };
}

function onLeave() {
  tip.value = null;
}

function onClick(event: MouseEvent) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const mark = target.closest(".data-mark");
  if (!mark) return;
  const index = Number(mark.getAttribute("data-index"));
  const url = hits.value[index]?.url;
  if (!url || !url.startsWith("https://")) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

let resizeTimer: ReturnType<typeof setTimeout> | undefined;
function selectRange(next: (typeof ranges)[number]["id"]) {
  if (range.value === next) return;
  range.value = next;
  tip.value = null;
  paint();
}

function onResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(paint, 100);
}

onMounted(async () => {
  window.addEventListener("resize", onResize);
  await load();
});

onUnmounted(() => {
  window.removeEventListener("resize", onResize);
  clearTimeout(resizeTimer);
});
</script>

<template>
  <div class="wrap">
    <header class="head">
      <div>
        <h1>Sprint 完成數／速率／插件趨勢</h1>
        <p class="subtitle">只計算狀態為完成的 Sprint。橫軸是第一天；完成與插件是最後一天的數字；速率是近三週完成的平均；插件平均是近三個 Sprint 插件的平均</p>
      </div>
      <button type="button" class="reload" :disabled="loading" @click="reload">重新載入</button>
    </header>

    <div class="chart-tools">
      <ul class="legend" role="list">
        <li><span class="swatch done"></span>完成</li>
        <li><span class="swatch rate"></span>速率</li>
        <li><span class="swatch plugin"></span>插件</li>
        <li><span class="swatch plugin-avg"></span>插件平均</li>
      </ul>
      <div class="range" role="group" aria-label="顯示週數">
        <button
          v-for="item in ranges"
          :key="item.id"
          type="button"
          :class="{ active: range === item.id }"
          :aria-pressed="range === item.id"
          @click="selectRange(item.id)"
        >
          {{ item.label }}
        </button>
      </div>
    </div>

    <p v-if="loading" class="status">載入中…</p>
    <p v-else-if="error" class="status error" role="alert">{{ error }}</p>
    <p v-else-if="showEmpty" class="status">目前沒有可畫的 Sprint。</p>

    <div v-show="!error && points.length" class="chart-card">
      <div ref="wrap" class="chart-wrap" @mousemove="onMove" @mouseleave="onLeave" @click="onClick">
        <div v-html="svg"></div>
        <div
          v-if="tip"
          class="chart-tooltip visible"
          :style="{ left: tip.left + 'px', top: tip.top + 'px' }"
        >
          <div class="t-title">{{ tip.date }}</div>
          <div v-for="item in tip.items" :key="item.label" class="t-row">
            <span class="t-swatch" :style="{ background: item.color }"></span>
            <span>{{ item.label }}</span>
            <span class="t-val">{{ item.text }}</span>
          </div>
        </div>
      </div>
    </div>

    <p v-if="!error && !loading" class="source">資料來源：{{ sourceTitle }}</p>
  </div>
</template>

<style scoped>
.wrap {
  max-width: 1040px;
  margin: 0 auto;
  padding: 32px 32px 40px;
  color: #2c2c2b;
}
.head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}
h1 {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 6px;
}
.subtitle,
.source,
.status {
  font-size: 13px;
  color: #7d7a75;
  margin: 0;
}
.source {
  margin-top: 16px;
}
.status.error {
  color: #b91c1c;
  margin-top: 16px;
}
.reload {
  border: 1px solid #e6e5e3;
  background: #fff;
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 13px;
  cursor: pointer;
  color: #2c2c2b;
}
.reload:disabled {
  opacity: 0.6;
  cursor: default;
}
.chart-tools {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px 20px;
  flex-wrap: wrap;
  margin: 20px 0 8px;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 13px;
}
.range {
  display: flex;
  border: 1px solid #e6e5e3;
  border-radius: 999px;
  overflow: hidden;
  background: #fff;
}
.range button {
  border: 0;
  background: transparent;
  padding: 6px 12px;
  font-size: 13px;
  color: #7d7a75;
  cursor: pointer;
}
.range button.active {
  background: #2c2c2b;
  color: #fff;
}
.legend li {
  display: flex;
  align-items: center;
  gap: 8px;
}
.swatch {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}
.swatch.done { background: #2783de; }
.swatch.rate { background: #d5803b; }
.swatch.plugin { background: #46a171; }
.swatch.plugin-avg { background: #7c5cbf; }
.chart-card {
  background: #f9f8f7;
  border: 1px solid #e6e5e3;
  border-radius: 12px;
  padding: 20px 20px 12px;
  margin-top: 8px;
}
.chart-wrap {
  position: relative;
  width: 100%;
}
.chart-tooltip {
  position: absolute;
  pointer-events: none;
  background: #fff;
  border: 1px solid #e6e5e3;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.5;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
  z-index: 10;
  white-space: nowrap;
}
.t-title { font-weight: 600; margin-bottom: 4px; }
.t-row { display: flex; align-items: center; gap: 6px; }
.t-swatch { width: 8px; height: 8px; border-radius: 2px; }
.t-val { margin-left: auto; font-variant-numeric: tabular-nums; padding-left: 12px; }
.chart-card :deep(.tick-label),
.chart-card :deep(.axis-title) {
  fill: #7d7a75;
  font-size: 11px;
}
.chart-card :deep(.axis-line),
.chart-card :deep(.grid-line) {
  stroke: #e6e5e3;
  stroke-width: 1;
}
.chart-card :deep(.point-value) {
  fill: #2c2c2b;
  font-size: 11px;
  font-weight: 550;
}
.chart-card :deep(.value-guide) {
  stroke: #7d7a75;
  stroke-width: 0.6;
  opacity: 0.5;
}
.chart-card :deep(svg) {
  display: block;
  width: 100%;
  height: auto;
}
.chart-card :deep(.data-mark) {
  cursor: pointer;
}
@media (max-width: 480px) {
  .wrap { padding: 20px 16px 28px; }
}
</style>
