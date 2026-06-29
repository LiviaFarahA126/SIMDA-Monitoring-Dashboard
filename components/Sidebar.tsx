"use client";

import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { Activity, AlertTriangle, BarChart2, Layers } from "lucide-react";

const NAV_ITEMS = [
  { icon: Activity,      label: "Dashboard",          href: "/" },
  { icon: Layers,        label: "Monitoring Network", href: "/network" },
  { icon: BarChart2,     label: "Data Points",        href: "/datapoints" },
  { icon: AlertTriangle, label: "Alerts",             href: "/alerts" },
];

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <aside
      className="fixed left-0 top-0 h-full w-56 flex flex-col z-20"
      style={{ background: "var(--bg-sidebar)", borderRight: "1px solid var(--border-color)" }}
    >
      <div className="px-5 py-4 border-b flex items-center gap-3"
        style={{ borderColor: "var(--border-color)" }}>
        <div className="flex-shrink-0">
          <Image src="/logo.png" alt="Perumda Tirta Manuntung" width={36} height={36}
            style={{ objectFit: "contain" }} />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold tracking-tight leading-tight"
            style={{ color: "var(--text-primary)", fontFamily: "'DM Mono', monospace" }}>
            SIMDA
          </div>
          <div className="text-xs leading-tight mt-0.5 truncate"
            style={{ color: "var(--accent)", opacity: 0.8 }}>
            Tirta Manuntung
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {NAV_ITEMS.map(({ icon: Icon, label, href }) => {
          const active = isActive(href);
          return (
            <button key={label} onClick={() => router.push(href)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full text-left transition-all"
              style={{
                background: active ? "var(--nav-active-bg)" : "transparent",
                color: active ? "var(--nav-active-color)" : "var(--text-muted)",
                borderLeft: active ? "2px solid var(--nav-active-border)" : "2px solid transparent",
              }}>
              <Icon size={15} />{label}
            </button>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t" style={{ borderColor: "var(--border-color)" }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>System Live</span>
        </div>
      </div>
    </aside>
  );
}