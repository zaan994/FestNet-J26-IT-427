import { ref, update } from "firebase/database";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

import { Badge } from "@/components/common/Badges";
import { OpenAlertsBadge, PushBanner } from "@/features/emergency_command/components/LiveAlertBar";
import { Icon } from "@/components/common/Icon";
import { Logo } from "@/components/common/Logo";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { NAV_ITEMS, type NavItem } from "@/constants/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useConnection } from "@/hooks/useConnection";
import { useEventContext } from "@/hooks/useEventContext";
import { db } from "@/config/firebase";
import { signOut } from "@/services/authService";
import { disablePush } from "@/services/push";
import { paths } from "@shared/paths";

const SECTIONS: NavItem["section"][] = ["Operations", "Administration", "Other components"];

/** Signing out also stops push to this browser and takes the user off duty (no stale routing). */
async function signOutResponder(uid: string | null) {
  if (uid) {
    await disablePush(uid).catch(() => {});
    await update(ref(db, paths.responder(uid)), { onDuty: false }).catch(() => {});
  }
  await signOut();
}

function EventSelector() {
  const { events, selectedEventId, setSelectedEventId, loading } = useEventContext();
  if (loading) return <div className="skeleton h-9 w-56" />;
  if (!events.length) return <Badge>No events assigned to you</Badge>;
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="eyebrow">Event</span>
      <select className="input w-64 py-1.5" value={selectedEventId ?? ""} onChange={(e) => setSelectedEventId(e.target.value)} aria-label="Select event">
        {events.map((e) => (
          <option key={e.eventId} value={e.eventId}>
            {e.name} · {e.status}
          </option>
        ))}
      </select>
    </label>
  );
}

function ConnectionBadge() {
  const state = useConnection();
  if (state === "connected") return <Badge tone="normal">Connected</Badge>;
  if (state === "disconnected")
    return (
      <Badge tone="danger" icon={<span aria-hidden="true">⚠</span>}>
        Offline — data may be outdated
      </Badge>
    );
  return <Badge>Connecting…</Badge>;
}

export function DashboardLayout() {
  const { profile, user, globalRoles, eventRoles } = useAuth();
  const { selectedEventId } = useEventContext();
  const [menuOpen, setMenuOpen] = useState(false);
  const displayName = profile?.displayName || user?.email || "";
  const roleText = [
    ...[...globalRoles],
    ...(selectedEventId && eventRoles[selectedEventId] ? [eventRoles[selectedEventId]] : []),
  ].join(" · ");

  return (
    <div className="flex min-h-screen">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-line bg-surface transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-5 pb-5 pt-6">
          <Logo subtitle="Festival Safety Command" />
        </div>
        <nav className="flex-1 overflow-y-auto px-3" aria-label="Main">
          {SECTIONS.map((section) => (
            <div key={section} className="mb-4">
              <p className="eyebrow px-3 pb-1.5">{section}</p>
              {NAV_ITEMS.filter((n) => n.section === section).map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                      isActive ? "bg-brand/10 text-brand" : "text-muted hover:bg-surface-2 hover:text-ink"
                    }`
                  }
                >
                  <Icon name={item.icon} className="h-[18px] w-[18px]" />
                  <span className="flex-1">{item.label}</span>
                  {item.component !== "shared" && <span className="text-[10px] font-semibold opacity-60">{item.component}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="space-y-3 border-t border-line p-4">
          <ThemeToggle />
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white dark:text-slate-900">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{displayName}</p>
              <p className="truncate text-xs text-muted">{roleText || "no role"}</p>
            </div>
            <button type="button" className="btn-ghost p-2" title="Sign out" aria-label="Sign out" onClick={() => void signOutResponder(user?.uid ?? null)}>
              <Icon name="logout" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
      {menuOpen && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMenuOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur lg:px-8">
          <button type="button" className="btn-ghost p-2 lg:hidden" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
            ☰
          </button>
          <EventSelector />
          <div className="ml-auto flex items-center gap-2">
            <OpenAlertsBadge eventId={selectedEventId} />
            <ConnectionBadge />
          </div>
        </header>
        <PushBanner />
        <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
