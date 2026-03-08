import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, Bot, FileKey, RefreshCw, Settings, Sigma, Sparkles, TriangleAlert } from "lucide-react";
import { usageApi, type DashboardSummary } from "@/lib/http/apis/usage";
import { KpiCard, MonitorCard } from "@/modules/monitor/MonitorPagePieces";
import { Button } from "@/modules/ui/Button";
import { EmptyState } from "@/modules/ui/EmptyState";
import { Tabs, TabsList, TabsTrigger } from "@/modules/ui/Tabs";
import { useToast } from "@/modules/ui/ToastProvider";

type DashboardRange = 1 | 7 | 30;

const RANGE_OPTIONS: ReadonlyArray<{ value: DashboardRange; label: string }> = [
  { value: 1, label: "今天" },
  { value: 7, label: "近 7 天" },
  { value: 30, label: "近 30 天" },
];

const formatNumber = (n: number) =>
  n >= 10_000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString();

const formatRate = (rate: number) =>
  `${rate.toFixed(2)}%`;

export function DashboardPage() {
  const { notify } = useToast();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [range, setRange] = useState<DashboardRange>(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (days: DashboardRange) => {
    setLoading(true);
    setError(null);
    try {
      const data = await usageApi.getDashboardSummary(days);
      setSummary(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "数据获取失败";
      setError(message);
      notify({ type: "error", message });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void refresh(range);
  }, [refresh, range]);

  const kpi = summary?.kpi;
  const counts = summary?.counts;
  const isEmpty = !kpi || kpi.total_requests === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
            仪表盘
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={String(range)} onValueChange={(next) => setRange(Number(next) as DashboardRange)}>
            <TabsList>
              {RANGE_OPTIONS.map((opt) => (
                <TabsTrigger key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => void refresh(range)}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            刷新
          </Button>
        </div>
      </div>

      {error ? (
        <EmptyState
          title="加载失败"
          description={error}
          icon={<TriangleAlert size={18} />}
          action={
            <Button variant="secondary" onClick={() => void refresh(range)}>
              <RefreshCw size={14} />
              重试
            </Button>
          }
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="请求数"
          value={<span className="tabular-nums">{formatNumber(kpi?.total_requests ?? 0)}</span>}
          hint={`${range === 1 ? "今天" : `最近 ${range} 天`}的总请求数`}
          icon={Activity}
        />
        <KpiCard
          title="成功率"
          value={<span className="tabular-nums">{formatRate(kpi?.success_rate ?? 0)}</span>}
          hint={`成功 ${formatNumber(kpi?.success_requests ?? 0)} · 失败 ${formatNumber(kpi?.failed_requests ?? 0)}`}
          icon={Sigma}
        />
        <KpiCard
          title="Token 总量"
          value={<span className="tabular-nums">{formatNumber(kpi?.total_tokens ?? 0)}</span>}
          hint={`输入 ${formatNumber(kpi?.input_tokens ?? 0)} · 输出 ${formatNumber(kpi?.output_tokens ?? 0)}`}
          icon={Sigma}
        />
        <KpiCard
          title="失败请求"
          value={<span className="tabular-nums">{formatNumber(kpi?.failed_requests ?? 0)}</span>}
          hint="失败请求数（用于定位 provider/key 质量问题）"
          icon={TriangleAlert}
        />
      </div>

      <MonitorCard
        title="快捷入口"
        description={isEmpty ? "当前时间范围内暂无 usage 数据。" : "进入对应页面继续操作。"}
        loading={loading}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Link
            to="/monitor"
            viewTransition
            className="group rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition hover:bg-slate-50 dark:border-neutral-800 dark:bg-neutral-950/60 dark:text-white dark:hover:bg-neutral-900"
          >
            <div className="flex items-center justify-between font-semibold">
              <span className="flex items-center gap-2">
                <Activity size={16} />
                监控中心
              </span>
              {kpi ? (
                <span className="rounded-lg bg-emerald-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                  {formatNumber(kpi.total_requests)}
                </span>
              ) : null}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-white/55">
              {kpi ? `${range === 1 ? "今天" : `近 ${range} 天`}共 ${formatNumber(kpi.total_requests)} 次请求` : "KPI、图表、请求趋势与模型分布"}
            </div>
          </Link>
          <Link
            to="/ai-providers"
            viewTransition
            className="group rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition hover:bg-slate-50 dark:border-neutral-800 dark:bg-neutral-950/60 dark:text-white dark:hover:bg-neutral-900"
          >
            <div className="flex items-center justify-between font-semibold">
              <span className="flex items-center gap-2">
                <Bot size={16} />
                AI 供应商
              </span>
              {counts ? (
                <span className="rounded-lg bg-emerald-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                  {counts.providers_total}
                </span>
              ) : null}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-white/55">
              {counts ? `已添加 ${counts.providers_total} 个供应渠道` : "配置/测试/禁用模型，查看 key 状态"}
            </div>
          </Link>
          <Link
            to="/api-keys"
            viewTransition
            className="group rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition hover:bg-slate-50 dark:border-neutral-800 dark:bg-neutral-950/60 dark:text-white dark:hover:bg-neutral-900"
          >
            <div className="flex items-center justify-between font-semibold">
              <span className="flex items-center gap-2">
                <Sparkles size={16} />
                API Keys
              </span>
              {counts ? (
                <span className="rounded-lg bg-emerald-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                  {counts.api_keys}
                </span>
              ) : null}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-white/55">
              {counts ? `已设置 ${counts.api_keys} 个 API Key` : "创建/编辑 API Key，设置配额与模型权限"}
            </div>
          </Link>
          <Link
            to="/auth-files"
            viewTransition
            className="group rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition hover:bg-slate-50 dark:border-neutral-800 dark:bg-neutral-950/60 dark:text-white dark:hover:bg-neutral-900"
          >
            <div className="flex items-center justify-between font-semibold">
              <span className="flex items-center gap-2">
                <FileKey size={16} />
                认证文件
              </span>
              {counts ? (
                <span className="rounded-lg bg-emerald-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                  {counts.auth_files}
                </span>
              ) : null}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-white/55">
              {counts ? `已管理 ${counts.auth_files} 个认证文件` : "管理 auth file、排除模型与别名"}
            </div>
          </Link>
          <Link
            to="/config"
            viewTransition
            className="group rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition hover:bg-slate-50 dark:border-neutral-800 dark:bg-neutral-950/60 dark:text-white dark:hover:bg-neutral-900"
          >
            <div className="flex items-center gap-2 font-semibold">
              <Settings size={16} />
              配置面板
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-white/55">
              可视化/源码/运行时配置
            </div>
          </Link>
        </div>
      </MonitorCard>
    </div>
  );
}
