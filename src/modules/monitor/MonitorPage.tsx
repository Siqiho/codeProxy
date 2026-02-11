import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  Activity,
  ChartSpline,
  Coins,
  Filter,
  RefreshCw,
  Search,
  ShieldCheck,
  Sigma,
} from "lucide-react";
import { usageApi } from "@/lib/http/apis";
import type { UsageData } from "@/lib/http/types";
import {
  computeKpiMetrics,
  filterUsageByDays,
  formatNumber,
  formatRate,
  iterateUsageRecords,
} from "@/modules/monitor/monitor-utils";
import { AnimatedNumber } from "@/modules/ui/AnimatedNumber";
import { TextInput } from "@/modules/ui/Input";
import { Reveal } from "@/modules/ui/Reveal";
import { EChart } from "@/modules/ui/charts/EChart";
import { useTheme } from "@/modules/ui/ThemeProvider";

type TimeRange = 1 | 7 | 14 | 30;

const TIME_RANGES: readonly TimeRange[] = [1, 7, 14, 30] as const;

const createEmptyUsage = (): UsageData => ({ apis: {} });

const CHART_COLORS: string[] = [
  "#60a5fa",
  "#34d399",
  "#a78bfa",
  "#fbbf24",
  "#fb7185",
  "#818cf8",
  "#2dd4bf",
  "#22d3ee",
  "#a3e635",
  "#f472b6",
];

const HOURLY_MODEL_COLORS: string[] = [
  "rgba(110,231,183,0.88)",
  "rgba(196,181,253,0.88)",
  "rgba(252,211,77,0.88)",
  "rgba(249,168,212,0.88)",
  "rgba(94,234,212,0.88)",
  "rgba(148,163,184,0.58)",
];

const CHART_COLOR_CLASSES: readonly string[] = [
  "bg-blue-400",
  "bg-emerald-400",
  "bg-violet-400",
  "bg-amber-400",
  "bg-rose-400",
  "bg-indigo-400",
  "bg-teal-400",
  "bg-cyan-400",
  "bg-lime-400",
  "bg-pink-400",
] as const;

const formatCompact = (value: number): string => {
  if (!Number.isFinite(value)) return "0";
  const abs = Math.abs(value);

  const compact = (divisor: number, suffix: string) => {
    const raw = value / divisor;
    const fixed = raw.toFixed(1);
    const trimmed = fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed;
    return `${trimmed}${suffix}`;
  };

  if (abs >= 1_000_000_000) return compact(1_000_000_000, "b");
  if (abs >= 1_000_000) return compact(1_000_000, "m");
  if (abs >= 1_000) return compact(1_000, "k");
  return formatNumber(value);
};

const formatLocalDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatMonthDay = (date: Date): string => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day}`;
};

const KpiCard = ({
  title,
  value,
  hint,
  icon: Icon,
}: {
  title: string;
  value: ReactNode;
  hint: string;
  icon: ComponentType<{ size?: number; className?: string }>;
}) => {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/70">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-white/55">
        <Icon size={14} className="text-slate-900 dark:text-white" />
        <span>{title}</span>
      </p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
        {value}
      </p>
      <p className="mt-2 text-xs text-slate-600 dark:text-white/65">{hint}</p>
    </article>
  );
};

const TimeRangeSelector = ({
  value,
  onChange,
}: {
  value: TimeRange;
  onChange: (next: TimeRange) => void;
}) => {
  return (
    <div className="inline-flex gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/60">
      {TIME_RANGES.map((range) => {
        const active = value === range;
        const label = range === 1 ? "今天" : `${range} 天`;
        return (
          <button
            key={range}
            type="button"
            onClick={() => onChange(range)}
            className={
              active
                ? "rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950"
                : "rounded-xl px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
            }
          >
            {label}
          </button>
        );
      })}
    </div>
  );
};

const Card = ({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) => {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/70">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
          {description ? (
            <p className="text-xs text-slate-600 dark:text-white/65">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
};

export function MonitorPage() {
  const {
    state: { mode },
  } = useTheme();
  const isDark = mode === "dark";

  const [rawUsage, setRawUsage] = useState<UsageData>(createEmptyUsage);
  const [timeRange, setTimeRange] = useState<TimeRange>(7);
  const [apiFilterInput, setApiFilterInput] = useState("");
  const [apiFilter, setApiFilter] = useState("");
  const [hourWindow, setHourWindow] = useState<6 | 12 | 24>(24);
  const [modelMetric, setModelMetric] = useState<"requests" | "tokens">("requests");
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const usageData = await usageApi.getUsage();
      startTransition(() => {
        setRawUsage(usageData);
      });
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "数据获取失败";
      setError(message);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const filteredUsage = useMemo(() => {
    return filterUsageByDays(rawUsage, timeRange, apiFilter);
  }, [rawUsage, timeRange, apiFilter]);

  const metrics = useMemo(() => computeKpiMetrics(filteredUsage), [filteredUsage]);

  const records = useMemo(() => iterateUsageRecords(filteredUsage), [filteredUsage]);

  const applyFilter = useCallback(() => {
    setApiFilter(apiFilterInput);
  }, [apiFilterInput]);

  const hasData = metrics.requestCount > 0;
  const isLoading = isRefreshing || isPending;

  const modelTotals = useMemo(() => {
    const byModel = new Map<string, { requests: number; tokens: number }>();
    records.forEach((record) => {
      const current = byModel.get(record.model) ?? { requests: 0, tokens: 0 };
      byModel.set(record.model, {
        requests: current.requests + 1,
        tokens: current.tokens + (record.tokens?.total_tokens ?? 0),
      });
    });

    return [...byModel.entries()]
      .map(([model, value]) => ({ model, ...value }))
      .sort(
        (left, right) => right.requests - left.requests || left.model.localeCompare(right.model),
      );
  }, [records]);

  const sortedModelsByMetric = useMemo(() => {
    const list = [...modelTotals];
    list.sort((left, right) => {
      const leftValue = modelMetric === "requests" ? left.requests : left.tokens;
      const rightValue = modelMetric === "requests" ? right.requests : right.tokens;
      return rightValue - leftValue || left.model.localeCompare(right.model);
    });
    return list;
  }, [modelMetric, modelTotals]);

  const topModelKeys = useMemo(
    () => sortedModelsByMetric.slice(0, 5).map((item) => item.model),
    [sortedModelsByMetric],
  );

  const modelDistributionData = useMemo(() => {
    const top = sortedModelsByMetric.slice(0, 10);
    const otherValue = sortedModelsByMetric.slice(10).reduce((acc, item) => {
      return acc + (modelMetric === "requests" ? item.requests : item.tokens);
    }, 0);

    const data = top.map((item) => ({
      name: item.model,
      value: modelMetric === "requests" ? item.requests : item.tokens,
    }));

    if (otherValue > 0) {
      data.push({ name: "其他", value: otherValue });
    }
    return data;
  }, [modelMetric, sortedModelsByMetric]);

  const dailySeries = useMemo(() => {
    const byDay = new Map<
      string,
      { requests: number; inputTokens: number; outputTokens: number }
    >();

    records.forEach((record) => {
      const date = new Date(record.timestamp);
      if (!Number.isFinite(date.getTime())) return;
      const key = formatLocalDateKey(date);
      const current = byDay.get(key) ?? { requests: 0, inputTokens: 0, outputTokens: 0 };
      byDay.set(key, {
        requests: current.requests + 1,
        inputTokens: current.inputTokens + (record.tokens?.input_tokens ?? 0),
        outputTokens: current.outputTokens + (record.tokens?.output_tokens ?? 0),
      });
    });

    const today = new Date();
    const points = Array.from({ length: timeRange }).map((_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (timeRange - 1 - index));
      const key = formatLocalDateKey(date);
      const label = formatMonthDay(date);
      const value = byDay.get(key) ?? { requests: 0, inputTokens: 0, outputTokens: 0 };
      return { label, ...value, totalTokens: value.inputTokens + value.outputTokens };
    });

    return points;
  }, [records, timeRange]);

  const hourlySeries = useMemo(() => {
    const now = Date.now();
    const endHour = Math.floor(now / 3_600_000);
    const startHour = endHour - hourWindow + 1;

    const hourLabels = Array.from({ length: hourWindow }).map((_, index) => {
      const hour = startHour + index;
      const date = new Date(hour * 3_600_000);
      const label = `${String(date.getHours()).padStart(2, "0")}:00`;
      return { hour, label };
    });

    const modelBuckets = new Map<number, Map<string, number>>();
    const tokenBuckets = new Map<
      number,
      { input: number; output: number; reasoning: number; cached: number }
    >();

    records.forEach((record) => {
      const ts = new Date(record.timestamp).getTime();
      if (!Number.isFinite(ts)) return;
      const hour = Math.floor(ts / 3_600_000);
      if (hour < startHour || hour > endHour) return;

      const modelMap = modelBuckets.get(hour) ?? new Map<string, number>();
      modelMap.set(record.model, (modelMap.get(record.model) ?? 0) + 1);
      modelBuckets.set(hour, modelMap);

      const tokens = tokenBuckets.get(hour) ?? { input: 0, output: 0, reasoning: 0, cached: 0 };
      tokenBuckets.set(hour, {
        input: tokens.input + (record.tokens?.input_tokens ?? 0),
        output: tokens.output + (record.tokens?.output_tokens ?? 0),
        reasoning: tokens.reasoning + (record.tokens?.reasoning_tokens ?? 0),
        cached: tokens.cached + (record.tokens?.cached_tokens ?? 0),
      });
    });

    const modelKeys = [...topModelKeys, "其他"];

    const modelPoints = hourLabels.map(({ hour, label }) => {
      const map = modelBuckets.get(hour) ?? new Map<string, number>();
      const stacks = modelKeys.map((key) => {
        if (key === "其他") {
          const sum = [...map.entries()].reduce((acc, [model, value]) => {
            return topModelKeys.includes(model) ? acc : acc + value;
          }, 0);
          return { key, value: sum };
        }
        return { key, value: map.get(key) ?? 0 };
      });
      return { label, stacks };
    });

    const tokenKeys = ["输入", "输出", "推理", "缓存"] as const;

    const tokenPoints = hourLabels.map(({ hour, label }) => {
      const totals = tokenBuckets.get(hour) ?? { input: 0, output: 0, reasoning: 0, cached: 0 };
      const stacks = [
        { key: "输入", value: totals.input },
        { key: "输出", value: totals.output },
        { key: "推理", value: totals.reasoning },
        { key: "缓存", value: totals.cached },
      ];
      return { label, stacks };
    });

    return { modelKeys, modelPoints, tokenKeys: [...tokenKeys], tokenPoints };
  }, [hourWindow, records, topModelKeys]);

  const modelDistributionOption = useMemo(() => {
    return {
      backgroundColor: "transparent",
      color: [...CHART_COLORS, "#94a3b8"],
      tooltip: {
        trigger: "item",
        borderWidth: 0,
        backgroundColor: "rgba(15, 23, 42, 0.92)",
        textStyle: { color: "#fff" },
        formatter: (params: { name: string; value: number; percent: number }) => {
          const valueLabel = formatCompact(params.value ?? 0);
          return `${params.name}<br/>${valueLabel}（${(params.percent ?? 0).toFixed(1)}%）`;
        },
      },
      series: [
        {
          name: "模型",
          type: "pie",
          radius: ["52%", "72%"],
          center: ["50%", "50%"],
          avoidLabelOverlap: true,
          label: { show: false },
          labelLine: { show: false },
          itemStyle: {
            borderRadius: 3,
            borderWidth: 2,
            borderColor: isDark ? "rgba(10,10,10,0.75)" : "rgba(255,255,255,0.92)",
          },
          emphasis: { scale: true, scaleSize: 6 },
          data: modelDistributionData,
        },
      ],
      animationEasing: "cubicOut" as const,
      animationDuration: 520,
      animationDurationUpdate: 360,
    };
  }, [isDark, modelDistributionData]);

  const modelDistributionLegend = useMemo(() => {
    const total = modelDistributionData.reduce(
      (acc, item) => acc + (Number.isFinite(item.value) ? item.value : 0),
      0,
    );

    return modelDistributionData.map((item, index) => {
      const colorClass =
        index < CHART_COLOR_CLASSES.length ? CHART_COLOR_CLASSES[index] : "bg-slate-400";
      const value = Number(item.value ?? 0);
      const percent = total > 0 ? (value / total) * 100 : 0;

      return {
        name: item.name,
        valueLabel: formatCompact(value),
        percentLabel: `${percent.toFixed(1)}%`,
        colorClass,
      };
    });
  }, [modelDistributionData]);

  const dailyTrendOption = useMemo(() => {
    const points = dailySeries.filter(
      (item) => item.requests > 0 || item.inputTokens > 0 || item.outputTokens > 0,
    );
    const visiblePoints = points.length > 0 ? points : dailySeries;

    const x = visiblePoints.map((item) => item.label);
    const requestY = visiblePoints.map((item) => item.requests);
    const inputY = visiblePoints.map((item) => item.inputTokens);
    const outputY = visiblePoints.map((item) => item.outputTokens);
    const tokenTotals = visiblePoints.map((item) => item.inputTokens + item.outputTokens);

    const formatTokenCompact = (value: number) => {
      const abs = Math.abs(value);
      if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
      if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
      return String(Math.round(value));
    };

    const visibleCount = visiblePoints.length;
    const barMaxWidth =
      visibleCount <= 1
        ? 56
        : visibleCount <= 3
          ? 44
          : visibleCount <= 7
            ? 36
            : visibleCount <= 14
              ? 28
              : 18;

    const hasInput = inputY.some((value) => value > 0);
    const hasOutput = outputY.some((value) => value > 0);
    const hasRequests = requestY.some((value) => value > 0);

    const tokenAxisMaxRaw = tokenTotals.reduce((acc, value) => Math.max(acc, value), 0);
    const requestAxisMaxRaw = requestY.reduce((acc, value) => Math.max(acc, value), 0);
    const tokenAxisMax = Math.max(1, Math.ceil(tokenAxisMaxRaw * 1.1));
    const requestAxisMax = Math.max(1, Math.ceil(requestAxisMaxRaw * 1.1));

    const legendData: Array<string | { name: string; icon: "circle" }> = [];
    if (hasInput) legendData.push({ name: "输入 Token", icon: "circle" });
    if (hasOutput) legendData.push({ name: "输出 Token", icon: "circle" });
    if (hasRequests) legendData.push("请求数");

    const series: Array<Record<string, unknown>> = [];
    if (hasInput) {
      series.push({
        name: "输入 Token",
        type: "bar",
        stack: "tokens",
        yAxisIndex: 0,
        barMaxWidth,
        itemStyle: { borderRadius: 0, color: "rgba(196,181,253,0.88)" },
        emphasis: { focus: "series" },
        data: inputY,
      });
    }

    if (hasOutput) {
      series.push({
        name: "输出 Token",
        type: "bar",
        stack: "tokens",
        yAxisIndex: 0,
        barMaxWidth,
        itemStyle: { borderRadius: [4, 4, 0, 0], color: "rgba(110,231,183,0.88)" },
        emphasis: { focus: "series" },
        data: outputY,
      });
    }

    if (hasRequests) {
      series.push({
        name: "请求数",
        type: "line",
        yAxisIndex: 1,
        smooth: true,
        symbol: "circle",
        symbolSize: 7,
        lineStyle: { width: 3 },
        itemStyle: { color: "#3b82f6" },
        data: requestY,
      });
    }

    series.push({
      name: "__token_axis__",
      type: "line",
      yAxisIndex: 0,
      data: tokenTotals,
      showSymbol: false,
      silent: true,
      tooltip: { show: false },
      emphasis: { disabled: true },
      lineStyle: { opacity: 0 },
      itemStyle: { opacity: 0 },
    });

    series.push({
      name: "__request_axis__",
      type: "line",
      yAxisIndex: 1,
      data: requestY,
      showSymbol: false,
      silent: true,
      tooltip: { show: false },
      emphasis: { disabled: true },
      lineStyle: { opacity: 0 },
      itemStyle: { opacity: 0 },
    });

    return {
      backgroundColor: "transparent",
      color: ["rgba(196,181,253,0.88)", "rgba(110,231,183,0.88)", "#3b82f6"],
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        borderWidth: 0,
        backgroundColor: "rgba(15, 23, 42, 0.92)",
        textStyle: { color: "#fff" },
      },
      legend: {
        bottom: 0,
        itemWidth: 10,
        itemHeight: 10,
        data: legendData,
      },
      grid: { left: 74, right: 74, top: 18, bottom: 42 },
      xAxis: {
        type: "category",
        data: x,
        axisTick: { show: false },
        axisLine: {
          lineStyle: { color: isDark ? "rgba(255,255,255,0.16)" : "rgba(148, 163, 184, 0.55)" },
        },
      },
      yAxis: [
        {
          type: "value",
          name: "Token",
          min: 0,
          max: tokenAxisMax,
          nameLocation: "middle",
          nameRotate: 90,
          nameGap: 58,
          nameTextStyle: { fontWeight: 600 },
          axisLabel: {
            formatter: (value: number) => formatTokenCompact(value),
            margin: 12,
            width: 56,
            overflow: "truncate",
          },
          splitNumber: 4,
          splitLine: {
            lineStyle: { color: isDark ? "rgba(255,255,255,0.08)" : "rgba(148, 163, 184, 0.25)" },
          },
        },
        {
          type: "value",
          name: "请求数",
          min: 0,
          max: requestAxisMax,
          nameLocation: "middle",
          nameRotate: 270,
          nameGap: 58,
          nameTextStyle: { fontWeight: 600 },
          axisLabel: {
            formatter: (value: number) => formatNumber(value),
            margin: 12,
            width: 56,
            overflow: "truncate",
          },
          splitNumber: 4,
          splitLine: { show: false },
        },
      ],
      series,
      animationEasing: "cubicOut" as const,
      animationDuration: 520,
      animationDurationUpdate: 360,
    };
  }, [dailySeries, isDark, timeRange]);

  const hourlyModelOption = useMemo(() => {
    const x = hourlySeries.modelPoints.map((point) => point.label);
    const barMaxWidth = hourWindow <= 6 ? 44 : hourWindow <= 12 ? 32 : 24;

    const series = hourlySeries.modelKeys.map((key) => {
      const data = hourlySeries.modelPoints.map((point) => {
        const item = point.stacks.find((stack) => stack.key === key);
        return item?.value ?? 0;
      });
      return {
        name: key,
        type: "bar",
        stack: "requests",
        emphasis: { focus: "series" },
        barMaxWidth,
        itemStyle:
          key === "其他"
            ? { borderRadius: 0, color: "rgba(148,163,184,0.58)" }
            : { borderRadius: 0 },
        data,
      };
    });

    const totals = hourlySeries.modelPoints.map((point) =>
      point.stacks.reduce((acc, item) => acc + (Number.isFinite(item.value) ? item.value : 0), 0),
    );

    const totalLineColor = "#3b82f6";

    return {
      backgroundColor: "transparent",
      color: HOURLY_MODEL_COLORS,
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        borderWidth: 0,
        backgroundColor: "rgba(15, 23, 42, 0.92)",
        textStyle: { color: "#fff" },
      },
      legend: {
        type: "scroll",
        bottom: 0,
        left: "center",
        width: "80%",
        itemWidth: 10,
        itemHeight: 10,
        data: hourlySeries.modelKeys,
      },
      grid: { left: 74, right: 74, top: 18, bottom: 64 },
      xAxis: {
        type: "category",
        data: x,
        axisTick: { show: false },
        axisLabel: { margin: 12, hideOverlap: true },
        axisLine: {
          lineStyle: { color: isDark ? "rgba(255,255,255,0.16)" : "rgba(148, 163, 184, 0.55)" },
        },
      },
      yAxis: {
        type: "value",
        splitNumber: 4,
        axisLabel: {
          formatter: (value: number) => formatNumber(value),
          margin: 12,
          width: 56,
          overflow: "truncate",
        },
        splitLine: {
          lineStyle: { color: isDark ? "rgba(255,255,255,0.08)" : "rgba(148, 163, 184, 0.25)" },
        },
      },
      series: [
        ...series,
        {
          name: "总请求",
          type: "line",
          smooth: true,
          symbol: "circle",
          symbolSize: 6,
          lineStyle: { width: 3, color: totalLineColor },
          itemStyle: { color: totalLineColor },
          emphasis: { focus: "series" },
          data: totals,
          z: 10,
        },
      ],
      animationEasing: "cubicOut" as const,
      animationDuration: 520,
      animationDurationUpdate: 360,
    };
  }, [hourWindow, hourlySeries.modelKeys, hourlySeries.modelPoints, isDark]);

  const hourlyTokenOption = useMemo(() => {
    const x = hourlySeries.tokenPoints.map((point) => point.label);
    const barMaxWidth = hourWindow <= 6 ? 44 : hourWindow <= 12 ? 32 : 24;
    const keyColor: Record<string, string> = {
      输入: "rgba(110,231,183,0.88)",
      输出: "rgba(196,181,253,0.88)",
      推理: "rgba(252,211,77,0.88)",
      缓存: "rgba(94,234,212,0.88)",
    };

    const series = hourlySeries.tokenKeys.map((key) => {
      const data = hourlySeries.tokenPoints.map((point) => {
        const item = point.stacks.find((stack) => stack.key === key);
        return item?.value ?? 0;
      });
      return {
        name: key,
        type: "bar",
        stack: "tokens",
        emphasis: { focus: "series" },
        barMaxWidth,
        itemStyle: { color: keyColor[key] ?? "rgba(148,163,184,0.58)", borderRadius: 0 },
        data,
      };
    });

    const totals = hourlySeries.tokenPoints.map((point) =>
      point.stacks.reduce((acc, item) => acc + (Number.isFinite(item.value) ? item.value : 0), 0),
    );
    const totalLineColor = "#3b82f6";

    return {
      backgroundColor: "transparent",
      color: [
        "rgba(110,231,183,0.88)",
        "rgba(196,181,253,0.88)",
        "rgba(252,211,77,0.88)",
        "rgba(94,234,212,0.88)",
      ],
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        borderWidth: 0,
        backgroundColor: "rgba(15, 23, 42, 0.92)",
        textStyle: { color: "#fff" },
      },
      legend: {
        type: "scroll",
        bottom: 0,
        left: "center",
        width: "80%",
        itemWidth: 10,
        itemHeight: 10,
        data: hourlySeries.tokenKeys.map((key) => ({ name: key, icon: "circle" as const })),
      },
      grid: { left: 74, right: 74, top: 18, bottom: 64 },
      xAxis: {
        type: "category",
        data: x,
        axisTick: { show: false },
        axisLabel: { margin: 12, hideOverlap: true },
        axisLine: {
          lineStyle: { color: isDark ? "rgba(255,255,255,0.16)" : "rgba(148, 163, 184, 0.55)" },
        },
      },
      yAxis: {
        type: "value",
        splitNumber: 4,
        axisLabel: {
          formatter: (value: number) => formatNumber(value),
          margin: 12,
          width: 56,
          overflow: "truncate",
        },
        splitLine: {
          lineStyle: { color: isDark ? "rgba(255,255,255,0.08)" : "rgba(148, 163, 184, 0.25)" },
        },
      },
      series: [
        ...series,
        {
          name: "总 Token",
          type: "line",
          smooth: true,
          symbol: "circle",
          symbolSize: 6,
          lineStyle: { width: 3, color: totalLineColor },
          itemStyle: { color: totalLineColor },
          emphasis: { focus: "series" },
          data: totals,
          z: 10,
        },
      ],
      animationEasing: "cubicOut" as const,
      animationDuration: 520,
      animationDurationUpdate: 360,
    };
  }, [hourWindow, hourlySeries.tokenKeys, hourlySeries.tokenPoints, isDark]);

  const hourActions = (
    <div className="inline-flex gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/60">
      {[6, 12, 24].map((range) => {
        const active = hourWindow === range;
        return (
          <button
            key={range}
            type="button"
            onClick={() => setHourWindow(range as 6 | 12 | 24)}
            className={
              active
                ? "rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950"
                : "rounded-xl px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
            }
          >
            {range}h
          </button>
        );
      })}
    </div>
  );

  const modelActions = (
    <div className="inline-flex gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/60">
      {[
        { key: "requests", label: "请求" },
        { key: "tokens", label: "Token" },
      ].map((item) => {
        const active = modelMetric === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => setModelMetric(item.key as "requests" | "tokens")}
            className={
              active
                ? "rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950"
                : "rounded-xl px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
            }
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/70">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
              <ChartSpline size={18} className="text-slate-900 dark:text-white" />
              <span>监控中心</span>
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-white/65">
              聚合展示调用数据分布与用量趋势，辅助日常运维分析。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
            <div className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/60">
              <Search size={14} className="text-slate-500 dark:text-white/55" />
              <TextInput
                value={apiFilterInput}
                onChange={(event) => setApiFilterInput(event.target.value)}
                variant="ghost"
                className="w-36"
                placeholder="按 API key 过滤"
              />
            </div>
            <button
              type="button"
              onClick={applyFilter}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-neutral-800 dark:bg-neutral-950/60 dark:text-white/80 dark:hover:bg-white/10"
            >
              <Filter size={14} />
              应用过滤
            </button>
            <button
              type="button"
              onClick={() => void refreshData()}
              disabled={isLoading}
              aria-busy={isLoading}
              className="inline-flex min-w-[96px] items-center justify-center gap-1.5 rounded-2xl bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-white dark:text-neutral-950 dark:hover:bg-slate-200"
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
              <span className="grid">
                <span
                  className={
                    isLoading
                      ? "col-start-1 row-start-1 opacity-0"
                      : "col-start-1 row-start-1 opacity-100"
                  }
                >
                  刷新
                </span>
                <span
                  className={
                    isLoading
                      ? "col-start-1 row-start-1 opacity-100"
                      : "col-start-1 row-start-1 opacity-0"
                  }
                >
                  刷新中
                </span>
              </span>
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </section>

      <Reveal>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            title="总请求"
            value={<AnimatedNumber value={metrics.requestCount} format={formatNumber} />}
            hint="已按时间范围过滤"
            icon={Activity}
          />
          <KpiCard
            title="成功率"
            value={<AnimatedNumber value={metrics.successRate} format={formatRate} />}
            hint={`成功 ${formatNumber(metrics.successCount)} / 失败 ${formatNumber(metrics.failedCount)}`}
            icon={ShieldCheck}
          />
          <KpiCard
            title="总 Token"
            value={<AnimatedNumber value={metrics.totalTokens} format={formatNumber} />}
            hint="输入 + 输出 + 推理 + 缓存"
            icon={Sigma}
          />
          <KpiCard
            title="输出 Token"
            value={<AnimatedNumber value={metrics.outputTokens} format={formatNumber} />}
            hint={`输入 Token：${formatNumber(metrics.inputTokens)}`}
            icon={Coins}
          />
        </section>
      </Reveal>

      {!hasData ? (
        <Reveal>
          <section className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-600 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/60 dark:text-white/70">
            暂无监控数据，请点击“刷新”拉取后端 usage。
          </section>
        </Reveal>
      ) : (
        <>
          <Reveal>
            <section className="grid gap-4 lg:grid-cols-[560px_1fr]">
              <Card
                title="模型用量分布"
                description={`最近 ${timeRange} 天 · 按${modelMetric === "requests" ? "请求数" : "Token"} · Top10`}
                actions={modelActions}
              >
                <div className="grid h-72 grid-cols-[1fr_220px] gap-4">
                  <EChart option={modelDistributionOption} loading={isLoading} className="h-72" />
                  <div className="flex h-72 flex-col justify-center gap-2 overflow-y-auto pr-1">
                    {modelDistributionLegend.map((item) => (
                      <div
                        key={item.name}
                        className="grid grid-cols-[minmax(0,120px)_40px_52px] items-center gap-x-1 text-sm"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={`h-3.5 w-3.5 shrink-0 rounded-full ${item.colorClass} opacity-80 ring-1 ring-black/5 dark:ring-white/10`}
                          />
                          <span className="min-w-0 truncate text-slate-700 dark:text-white/80">
                            {item.name}
                          </span>
                        </div>
                        <span className="text-right font-semibold tabular-nums text-slate-900 dark:text-white">
                          {item.valueLabel}
                        </span>
                        <span className="text-right tabular-nums text-slate-500 dark:text-white/55">
                          {item.percentLabel}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              <Card
                title="每日用量趋势"
                description={`最近 ${timeRange} 天 · 请求数与 Token 用量趋势`}
              >
                <EChart option={dailyTrendOption} loading={isLoading} className="h-72" />
              </Card>
            </section>
          </Reveal>

          <Reveal>
            <Card
              title="每小时模型请求分布"
              description="按小时聚合（Top5 模型 + 其他）"
              actions={hourActions}
            >
              <EChart option={hourlyModelOption} loading={isLoading} className="h-72" />
            </Card>
          </Reveal>

          <Reveal>
            <Card
              title="每小时 Token 用量"
              description="按小时聚合（输入 / 输出 / 推理 / 缓存）"
              actions={hourActions}
            >
              <EChart option={hourlyTokenOption} loading={isLoading} className="h-72" />
            </Card>
          </Reveal>
        </>
      )}
    </div>
  );
}
