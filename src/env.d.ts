/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEMO_MODE?: string;
  readonly VITE_BILLING_FIELD?: string;
  readonly VITE_BILLING_TASK_FIELD?: string;
  readonly VITE_PROXY_TARGET?: string;
  readonly VITE_STORAGE_ENCRYPT_KEY?: string;
  readonly VITE_DEFAULT_PROJECT_GID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "@/utils/sprintChart.mjs" {
  export function formatSprintNumber(value: number): string;
  export function buildSprintChart(
    points: {
      date: string;
      done: number | null;
      rate: number | null;
      plugin: number | null;
      pluginAvg?: number | null;
      url?: string;
    }[],
    width: number
  ): {
    svg: string;
    width: number;
    height: number;
    hits: { date: string; url: string; x: number; items: { label: string; color: string; text: string }[] }[];
    series: {
      key: string;
      points: ({ x: number; y: number; value: number } | null)[];
    }[];
  };
}
