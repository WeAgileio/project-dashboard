<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, defineAsyncComponent, type Component } from "vue";
import { isDemoMode } from "@/demo/isDemoMode";
import { useAuthStore } from "@/stores/auth";
import Login from "@/views/Login.vue";
import WeeklyTrends from "@/views/WeeklyTrends.vue";
import ProgressTimelineByTime from "@/views/ProgressTimelineByTime.vue";
import BillingTasks from "@/views/BillingTasks.vue";
import BillingTasksByTime from "@/views/BillingTasksByTime.vue";
import {
  pageFromPath,
  pathForPage,
  resolveDashboardLocation,
  type DashboardPage,
} from "@/utils/pageRoutes";

const auth = useAuthStore();
const demoMode = isDemoMode();

type Tab = DashboardPage;

function initialTab(): Tab {
  const page = pageFromPath(window.location.pathname);
  if (
    page === "progressByTime" ||
    page === "billingTasks" ||
    page === "billingTasksByTime"
  ) {
    return page;
  }
  return "progressByTime";
}

const currentTab = ref<Tab>(initialTab());
const addressReady = ref(false);

const tabComponents: Record<Tab, Component> = {
  trends: WeeklyTrends,
  progressByTime: ProgressTimelineByTime,
  billingTasks: BillingTasks,
  billingTasksByTime: BillingTasksByTime,
  sprintTrend: defineAsyncComponent(() => import("@/views/SprintTrend.vue")),
};

const trendsTabVisible = computed(() => !demoMode && auth.dataSource !== "notion");
const sprintTabVisible = computed(() => !demoMode && auth.dataSource === "notion");

function tabVisibility() {
  return { trends: trendsTabVisible.value, sprint: sprintTabVisible.value };
}

const currentView = computed(() => {
  if (currentTab.value === "trends" && !trendsTabVisible.value) {
    return tabComponents.progressByTime;
  }
  if (currentTab.value === "sprintTrend" && !sprintTabVisible.value) {
    return tabComponents.progressByTime;
  }
  return tabComponents[currentTab.value];
});

let routeReady = false;

function applyAddress() {
  const resolved = resolveDashboardLocation(
    window.location.pathname,
    tabVisibility()
  );
  currentTab.value = resolved.page;
  if (window.location.pathname !== resolved.path) {
    history.replaceState(null, "", resolved.path);
  }
}

function selectTab(tab: Tab) {
  if (
    (tab === "trends" && !trendsTabVisible.value) ||
    (tab === "sprintTrend" && !sprintTabVisible.value)
  ) {
    return;
  }
  currentTab.value = tab;
  const path = pathForPage(tab);
  if (window.location.pathname !== path) {
    history.pushState(null, "", path);
  }
}

function onPopState() {
  if (!routeReady || !auth.isLoggedIn) return;
  applyAddress();
}

onMounted(async () => {
  window.addEventListener("popstate", onPopState);
  if (!demoMode) await auth.loadDataSource();
  await auth.loadFromStorage();
  if (auth.isLoggedIn) applyAddress();
  routeReady = true;
  addressReady.value = true;
});

onUnmounted(() => {
  window.removeEventListener("popstate", onPopState);
});

watch(
  () => auth.isLoggedIn,
  (loggedIn) => {
    if (!routeReady || !loggedIn) return;
    applyAddress();
  }
);
</script>

<template>
  <div class="app-root">
    <div v-if="!auth.initialized || (auth.isLoggedIn && !addressReady)" class="app-loading">載入中…</div>
    <Login v-else-if="!auth.isLoggedIn" />
    <template v-else>
    <nav class="top-nav" aria-label="主要導覽">
      <div class="nav-left">
        <span v-if="demoMode" class="demo-badge">展示模式 · 示意資料</span>
        <div class="nav-tabs">
        <button
          v-if="trendsTabVisible"
          type="button"
          class="nav-tab"
          :class="{ active: currentTab === 'trends' }"
          @click="selectTab('trends')"
        >
          十週更新統計
        </button>
        <button
          type="button"
          class="nav-tab"
          :class="{ active: currentTab === 'progressByTime' }"
          @click="selectTab('progressByTime')"
        >
          專案進展
        </button>
        <button
          type="button"
          class="nav-tab"
          :class="{ active: currentTab === 'billingTasks' }"
          @click="selectTab('billingTasks')"
        >
          請款進展
        </button>
        <button
          type="button"
          class="nav-tab"
          :class="{ active: currentTab === 'billingTasksByTime' }"
          @click="selectTab('billingTasksByTime')"
        >
          請款進展·時間序
        </button>
        <button
          v-if="sprintTabVisible"
          type="button"
          class="nav-tab"
          :class="{ active: currentTab === 'sprintTrend' }"
          @click="selectTab('sprintTrend')"
        >
          Sprint 趨勢
        </button>
        </div>
      </div>
      <div class="nav-right">
        <span v-if="!demoMode && auth.dataSource === 'notion'" class="notion-mark">數據來源:Notion</span>
        <button
          v-if="!demoMode && !auth.serverHoldsNotionToken"
          type="button"
          class="nav-logout"
          @click="auth.clearToken()"
        >
          登出
        </button>
      </div>
    </nav>

    <main class="app-main">
      <keep-alive>
        <component :is="currentView" />
      </keep-alive>
    </main>
    </template>
  </div>
</template>

<style scoped>
.app-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.top-nav {
  min-height: 52px;
  padding: 8px 20px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12px 20px;
  border-bottom: 1px solid #e5e7eb;
  background: #ffffff;
}
.nav-tabs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  min-width: 0;
}
.nav-left {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  min-width: 0;
}
.nav-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.notion-mark {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  white-space: nowrap;
}
.demo-badge {
  flex-shrink: 0;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: #92400e;
  background: #fef3c7;
  border: 1px solid #fcd34d;
  line-height: 1.3;
}
.nav-tab {
  border: none;
  background: transparent;
  padding: 8px 14px;
  border-radius: 999px;
  font-size: 13px;
  color: #6b7280;
  cursor: pointer;
  font-weight: 500;
  line-height: 1.2;
}
.nav-tab:hover {
  color: #374151;
  background: #f3f4f6;
}
.nav-tab.active {
  background: #4f46e5;
  color: #ffffff;
  font-weight: 600;
}
.nav-tab.active:hover {
  background: #4338ca;
  color: #ffffff;
}
.nav-logout {
  flex-shrink: 0;
  border: none;
  background: transparent;
  padding: 6px 10px;
  font-size: 13px;
  color: #6b7280;
  cursor: pointer;
  border-radius: 6px;
}
.nav-logout:hover {
  color: #dc2626;
  background: #fef2f2;
}
.app-main {
  flex: 1;
}
.app-loading {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #6b7280;
}
</style>

