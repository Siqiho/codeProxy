import { Suspense, lazy } from "react";
import type { ECBasicOption } from "echarts/types/dist/shared";
import { useTheme } from "@/modules/ui/ThemeProvider";

const ReactECharts = lazy(async () => {
  const mod = await import("echarts-for-react");
  return { default: mod.default };
});

export function EChart({
  option,
  loading = false,
  className,
}: {
  option: ECBasicOption;
  loading?: boolean;
  className?: string;
}) {
  const {
    state: { mode },
  } = useTheme();

  return (
    <div className={["w-full", className].filter(Boolean).join(" ")}>
      <Suspense
        fallback={
          <div className="flex h-full w-full items-center justify-center rounded-2xl border border-slate-200 bg-white/70 text-sm text-slate-600 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/60 dark:text-white/70">
            图表加载中...
          </div>
        }
      >
        <ReactECharts
          option={option}
          theme={mode === "dark" ? "dark" : undefined}
          showLoading={loading}
          notMerge={false}
          lazyUpdate
          className="h-full w-full"
        />
      </Suspense>
    </div>
  );
}
