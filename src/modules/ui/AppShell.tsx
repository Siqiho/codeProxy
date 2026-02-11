import { createContext, type PropsWithChildren, use, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Activity, LayoutDashboard, LogOut, Sparkles } from "lucide-react";
import { useAuth } from "@/modules/auth/AuthProvider";
import { PageBackground } from "@/modules/ui/PageBackground";
import { ThemeToggleButton } from "@/modules/ui/ThemeProvider";

interface ShellContextState {
  state: {
    title: string;
  };
  actions: {
    logout: () => void;
  };
}

const ShellContext = createContext<ShellContextState | null>(null);

const NAV_ITEMS = [{ to: "/monitor", label: "监控中心", icon: Activity }] as const;

const getPageTitle = (pathname: string): string => {
  if (pathname.startsWith("/monitor")) {
    return "监控中心";
  }
  return "后台首页";
};

function ShellFrame({ children }: PropsWithChildren) {
  return <PageBackground variant="app">{children}</PageBackground>;
}

function ShellSidebar() {
  const location = useLocation();

  return (
    <aside className="w-64 shrink-0 border-r border-slate-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/70">
      <div className="flex h-16 items-center gap-2 px-6 text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
        <LayoutDashboard size={18} className="text-slate-900 dark:text-white" />
        <span>控制台</span>
      </div>
      <nav className="space-y-1 px-3 pb-4">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active =
            location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
          return (
            <Link
              key={item.to}
              to={item.to}
              viewTransition
              className={
                active
                  ? "flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white dark:bg-white dark:text-neutral-950"
                  : "flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
              }
            >
              <Icon size={16} className="opacity-90" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function ShellHeader() {
  const navigate = useNavigate();
  const {
    state: { title },
    actions: { logout },
  } = useShell();

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/75 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/60">
      <div className="flex h-16 items-center justify-between px-6">
        <h1 className="flex items-center gap-2 text-base font-semibold tracking-tight text-slate-900 dark:text-white">
          <Sparkles size={16} className="text-slate-900 dark:text-white" />
          <span>{title}</span>
        </h1>
        <div className="flex items-center gap-2">
          <ThemeToggleButton className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white/70 text-slate-700 shadow-sm backdrop-blur transition hover:bg-white dark:border-neutral-800 dark:bg-neutral-950/60 dark:text-slate-200 dark:hover:bg-neutral-950/80" />
          <button
            type="button"
            onClick={() => {
              navigate("/login", { replace: true, viewTransition: true });
              logout();
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-slate-200"
          >
            <LogOut size={14} />
            退出登录
          </button>
        </div>
      </div>
    </header>
  );
}

function ShellMain({ children }: PropsWithChildren) {
  return <main className="p-6">{children}</main>;
}

export function AppShell({ children }: PropsWithChildren) {
  const location = useLocation();
  const {
    actions: { logout },
  } = useAuth();

  const value = useMemo<ShellContextState>(
    () => ({
      state: {
        title: getPageTitle(location.pathname),
      },
      actions: {
        logout,
      },
    }),
    [location.pathname, logout],
  );

  return (
    <ShellContext value={value}>
      <ShellFrame>
        <div className="flex min-h-screen">
          <ShellSidebar />
          <div className="flex min-h-screen min-w-0 flex-1 flex-col">
            <ShellHeader />
            <ShellMain>{children}</ShellMain>
          </div>
        </div>
      </ShellFrame>
    </ShellContext>
  );
}

const useShell = (): ShellContextState => {
  const context = use(ShellContext);
  if (!context) {
    throw new Error("useShell 必须在 AppShell 内使用");
  }
  return context;
};
