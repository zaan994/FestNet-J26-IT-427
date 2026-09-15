import { NavLink, Outlet } from "react-router-dom";

import { NAV_ITEMS } from "@/constants/navigation";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/services/authService";

export function DashboardLayout() {
  const { profile, user } = useAuth();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 shrink-0 flex-col bg-brand-900 text-slate-200">
        <div className="px-6 py-5">
          <p className="text-lg font-bold text-white">FestNet</p>
          <p className="text-xs text-slate-400">Festival Safety Command</p>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                  isActive ? "bg-white/10 font-semibold text-white" : "hover:bg-white/5"
                }`
              }
            >
              <span className="w-5 text-center">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.component !== "shared" && <span className="text-[10px] text-slate-400">{item.component}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 px-6 py-4 text-xs">
          <p className="truncate font-medium text-white">{profile?.name ?? user?.email}</p>
          <p className="capitalize text-slate-400">{profile?.role}</p>
          <button className="mt-2 text-slate-300 underline hover:text-white" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-x-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
