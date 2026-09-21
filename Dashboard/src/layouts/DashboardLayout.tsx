import { NavLink, Outlet } from "react-router-dom";

import { Icon } from "@/components/common/Icon";
import { Logo } from "@/components/common/Logo";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { NAV_ITEMS } from "@/constants/navigation";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/services/authService";

export function DashboardLayout() {
  const { profile, user } = useAuth();
  const displayName = profile?.name || user?.email || "";

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-line bg-surface/80 backdrop-blur">
        <div className="px-5 pb-6 pt-6">
          <Logo subtitle="Festival Safety Command" />
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          <p className="eyebrow px-3 pb-2">Monitoring</p>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? "bg-brand-gradient text-white shadow-glow" : "text-muted hover:bg-surface-2 hover:text-ink"
                }`
              }
            >
              <Icon name={item.icon} className="h-[18px] w-[18px]" />
              <span className="flex-1">{item.label}</span>
              {item.component !== "shared" && (
                <span className="rounded-md bg-black/5 px-1.5 py-0.5 text-[10px] font-semibold opacity-70 dark:bg-white/10">
                  {item.component}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-4 border-t border-line p-4">
          <ThemeToggle />
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-sm font-bold text-white">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{displayName}</p>
              <p className="text-xs capitalize text-muted">{profile?.role}</p>
            </div>
            <button type="button" className="btn-ghost p-2" title="Sign out" onClick={() => void signOut()}>
              <Icon name="logout" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-8 py-8">
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
