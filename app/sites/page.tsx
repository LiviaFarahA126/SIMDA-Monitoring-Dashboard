"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, Battery, CheckCircle2,
  ChevronRight, Search, WifiOff,
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import Chatbot from "@/components/Chatbot";

type Site = {
  id: number;
  site_id: string;
  address: string;
  lat_east: number;
  long_north: number;
  battery_level: number | null;
  signal_level: number | null;
  last_call_in: string | null;
  logger_type: string | null;
  logger_network: string | null;
  logger_id: number | null;
};

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} days ago`;
}

function getSiteStatus(site: Site) {
  if (!site.last_call_in) return "offline";
  const hrs = (Date.now() - new Date(site.last_call_in).getTime()) / 3600000;
  if (hrs > 24 * 30) return "offline";
  if (site.battery_level !== null && site.battery_level < 20) return "warning";
  return "online";
}

function StatusBadge({ status }: { status: string }) {
  const cfg: any = {
    online:  { color: "#22c55e", bg: "rgba(34,197,94,0.1)",  label: "Online",  icon: CheckCircle2 },
    offline: { color: "#ef4444", bg: "rgba(239,68,68,0.1)",  label: "Offline", icon: WifiOff },
    warning: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", label: "Warning", icon: AlertTriangle },
  }[status] ?? { color: "#94a3b8", bg: "rgba(148,163,184,0.1)", label: status, icon: AlertTriangle };
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ color: cfg.color, background: cfg.bg }}>
      <Icon size={11} />{cfg.label}
    </span>
  );
}

function BatteryBar({ value }: { value: number | null }) {
  if (value === null || value === undefined)
    return <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>;
  const color = value > 50 ? "#22c55e" : value > 20 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border-color)" }}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(value, 100)}%`, background: color }} />
      </div>
      <span className="text-xs" style={{ color }}>{Math.round(value)}%</span>
    </div>
  );
}

export default function SitesPage() {
  const router = useRouter();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all"|"online"|"offline"|"warning">("all");

  useEffect(() => {
    fetch("/api/sites")
      .then(r => r.json())
      .then(d => { setSites(d.sites); setLoading(false); });
  }, []);

  const filtered = sites.filter(s => {
    const matchSearch =
      s.site_id?.toLowerCase().includes(search.toLowerCase()) ||
      s.address?.toLowerCase().includes(search.toLowerCase());
    const status = getSiteStatus(s);
    return matchSearch && (filterStatus === "all" || status === filterStatus);
  });

  const counts = {
    all: sites.length,
    online: sites.filter(s => getSiteStatus(s) === "online").length,
    warning: sites.filter(s => getSiteStatus(s) === "warning").length,
    offline: sites.filter(s => getSiteStatus(s) === "offline").length,
  };

  const filterColors: any = {
    all: "var(--accent)", online: "#22c55e", warning: "#f59e0b", offline: "#ef4444"
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');`}</style>
      <Sidebar />
      <main className="ml-56 flex flex-col min-h-screen">
        <Topbar
          title="Sites"
          subtitle="Semua lokasi monitoring jaringan distribusi air"
          rightContent={
            <span className="text-xs px-3 py-1.5 rounded-lg"
              style={{ background: "var(--card-bg)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}>
              {sites.length} total sites
            </span>
          }
        />
        <div className="flex-1 p-8 flex flex-col gap-5">
          {/* Filter Bar */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Cari site ID atau alamat..."
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg outline-none"
                style={{ background: "var(--card-bg)", border: "1px solid var(--border-accent)", color: "var(--text-primary)" }} />
            </div>
            <div className="flex gap-1">
              {(["all","online","warning","offline"] as const).map(s => (
                <button key={s} onClick={() => setFilterStatus(s)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
                  style={{
                    background: filterStatus === s ? `${filterColors[s]}18` : "transparent",
                    color: filterStatus === s ? filterColors[s] : "var(--text-muted)",
                    border: `1px solid ${filterStatus === s ? `${filterColors[s]}40` : "transparent"}`,
                  }}>
                  {s} ({counts[s]})
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-color)", background: "var(--bg-primary)" }}>
                  {["Site ID","Address","Status","Battery","Signal","Logger Type","Last Call",""].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-medium" style={{ color: "var(--text-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array(8).fill(0).map((_, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border-color)" }}>
                        {Array(8).fill(0).map((_, j) => (
                          <td key={j} className="px-5 py-4">
                            <div className="h-3 rounded animate-pulse w-20" style={{ background: "var(--border-color)" }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  : filtered.map(site => (
                      <tr key={site.id} className="row-hover transition-colors"
                        style={{ borderBottom: "1px solid var(--border-color)" }}
                        onClick={() => router.push(`/sites/${site.id}`)}>
                        <td className="px-5 py-3.5 text-xs font-semibold"
                          style={{ fontFamily: "'DM Mono', monospace", color: "var(--accent)" }}>
                          {site.site_id}
                        </td>
                        <td className="px-5 py-3.5 text-xs max-w-xs" style={{ color: "var(--text-secondary)" }}>{site.address}</td>
                        <td className="px-5 py-3.5"><StatusBadge status={getSiteStatus(site)} /></td>
                        <td className="px-5 py-3.5"><BatteryBar value={site.battery_level} /></td>
                        <td className="px-5 py-3.5 text-xs" style={{ color: "var(--text-muted)" }}>
                          {site.signal_level !== null ? `${site.signal_level} dBm` : "—"}
                        </td>
                        <td className="px-5 py-3.5 text-xs" style={{ color: "var(--text-muted)" }}>{site.logger_type ?? "—"}</td>
                        <td className="px-5 py-3.5 text-xs" style={{ color: "var(--text-dimmer)" }}>{timeAgo(site.last_call_in)}</td>
                        <td className="px-5 py-3.5">
                          <ChevronRight size={14} style={{ color: "var(--text-dimmer)" }} />
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
            {!loading && filtered.length === 0 && (
              <div className="text-center py-16 text-sm" style={{ color: "var(--text-muted)" }}>
                Tidak ada site yang cocok dengan filter.
              </div>
            )}
          </div>
        </div>
      </main>
      <Chatbot />
    </div>
  );
}