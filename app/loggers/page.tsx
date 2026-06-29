"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, Battery, CheckCircle2,
  Radio, Search, Signal, ChevronUp, ChevronDown, WifiOff,
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import Chatbot from "@/components/Chatbot";

type Logger = {
  id: number;
  logger_type: string | null;
  logger_software: number | null;
  logger_serial_number: number | null;
  last_call_in: string | null;
  signal_level: number | null;
  battery_level: number | null;
  logger_network: string | null;
  last_message_type: string | null;
  call_frequency: number | null;
  is_roaming: number | null;
  utc_offset: number | null;
  external_battery: number | null;
  site_id: string | null;
  address: string | null;
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

function getLoggerStatus(logger: Logger) {
  if (!logger.last_call_in) return "offline";
  const hrs = (Date.now() - new Date(logger.last_call_in).getTime()) / 3600000;
  if (hrs > 24 * 30) return "offline";
  if (logger.battery_level !== null && logger.battery_level < 20) return "warning";
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
      <div className="w-14 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border-color)" }}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(value, 100)}%`, background: color }} />
      </div>
      <span className="text-xs" style={{ color }}>{Math.round(value)}%</span>
    </div>
  );
}

type SortKey = "last_call_in"|"battery_level"|"signal_level"|"id";

export default function LoggersPage() {
  const router = useRouter();
  const [loggers, setLoggers] = useState<Logger[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all"|"online"|"offline"|"warning">("all");
  const [sortKey, setSortKey] = useState<SortKey>("last_call_in");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");
  const [selected, setSelected] = useState<Logger | null>(null);

  useEffect(() => {
    fetch("/api/loggers")
      .then(r => r.json())
      .then(d => { setLoggers(d.loggers); setLoading(false); });
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const filtered = loggers
    .filter(l => {
      const matchSearch =
        l.id?.toString().includes(search) ||
        l.logger_type?.toLowerCase().includes(search.toLowerCase()) ||
        l.site_id?.toLowerCase().includes(search.toLowerCase()) ||
        l.address?.toLowerCase().includes(search.toLowerCase());
      const status = getLoggerStatus(l);
      return matchSearch && (filterStatus === "all" || status === filterStatus);
    })
    .sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

  const counts = {
    all: loggers.length,
    online: loggers.filter(l => getLoggerStatus(l) === "online").length,
    warning: loggers.filter(l => getLoggerStatus(l) === "warning").length,
    offline: loggers.filter(l => getLoggerStatus(l) === "offline").length,
  };

  const filterColors: any = {
    all: "var(--accent)", online: "#22c55e", warning: "#f59e0b", offline: "#ef4444"
  };

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronUp size={10} style={{ color: "var(--text-dimmer)" }} />;
    return sortDir === "asc"
      ? <ChevronUp size={10} style={{ color: "var(--accent)" }} />
      : <ChevronDown size={10} style={{ color: "var(--accent)" }} />;
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');`}</style>
      <Sidebar />
      <main className="ml-56 flex flex-col min-h-screen">
        <Topbar
          title="Loggers"
          subtitle="Manajemen perangkat logger jaringan"
          rightContent={
            <span className="text-xs px-3 py-1.5 rounded-lg"
              style={{ background: "var(--card-bg)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}>
              {loggers.length} total loggers
            </span>
          }
        />
        <div className="flex-1 p-8 flex gap-5">
          {/* Left */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            {/* Mini Cards */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Total",   value: counts.all,     color: "var(--accent)" },
                { label: "Online",  value: counts.online,  color: "#22c55e" },
                { label: "Warning", value: counts.warning, color: "#f59e0b" },
                { label: "Offline", value: counts.offline, color: "#ef4444" },
              ].map(({ label, value, color }) => (
                <div key={label} className="card px-4 py-3 flex items-center gap-3">
                  <div className="text-xl font-bold" style={{ fontFamily: "'DM Mono', monospace", color }}>{value}</div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Filter */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Cari ID, tipe, atau site..."
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
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-color)", background: "var(--bg-primary)" }}>
                    {[
                      { label: "ID", col: "id" as SortKey },
                      { label: "Type", col: null },
                      { label: "Site", col: null },
                      { label: "Status", col: null },
                      { label: "Battery", col: "battery_level" as SortKey },
                      { label: "Signal", col: "signal_level" as SortKey },
                      { label: "Last Call", col: "last_call_in" as SortKey },
                    ].map(({ label, col }) => (
                      <th key={label}
                        className={`text-left px-4 py-3 text-xs font-medium ${col ? "cursor-pointer select-none" : ""}`}
                        style={{ color: sortKey === col ? "var(--accent)" : "var(--text-muted)" }}
                        onClick={() => col && handleSort(col)}>
                        <span className="flex items-center gap-1">
                          {label}{col && <SortIcon col={col} />}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? Array(8).fill(0).map((_, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border-color)" }}>
                      {Array(7).fill(0).map((_, j) => (
                        <td key={j} className="px-4 py-3.5">
                          <div className="h-3 rounded animate-pulse w-16" style={{ background: "var(--border-color)" }} />
                        </td>
                      ))}
                    </tr>
                  )) : filtered.map(logger => (
                    <tr key={logger.id}
                      className="row-hover transition-colors"
                      style={{
                        borderBottom: "1px solid var(--border-color)",
                        background: selected?.id === logger.id ? "var(--accent-bg)" : undefined,
                      }}
                      onClick={() => setSelected(selected?.id === logger.id ? null : logger)}>
                      <td className="px-4 py-3 text-xs font-semibold"
                        style={{ fontFamily: "'DM Mono', monospace", color: "var(--accent)" }}>
                        #{logger.id}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>{logger.logger_type ?? "—"}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>{logger.site_id ?? "—"}</td>
                      <td className="px-4 py-3"><StatusBadge status={getLoggerStatus(logger)} /></td>
                      <td className="px-4 py-3"><BatteryBar value={logger.battery_level} /></td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                        {logger.signal_level !== null ? `${logger.signal_level} dBm` : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--text-dimmer)" }}>{timeAgo(logger.last_call_in)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!loading && filtered.length === 0 && (
                <div className="text-center py-16 text-sm" style={{ color: "var(--text-muted)" }}>Tidak ada logger yang cocok.</div>
              )}
            </div>
          </div>

          {/* Detail Panel */}
          {selected && (
            <div className="w-72 flex-shrink-0">
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Logger Detail</div>
                  <button onClick={() => setSelected(null)} className="text-xs px-2 py-1 rounded"
                    style={{ color: "var(--text-muted)" }}>✕</button>
                </div>
                <div className="flex items-center gap-3 mb-4 p-3 rounded-lg" style={{ background: "var(--accent-bg)" }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "var(--accent-bg)" }}>
                    <Radio size={16} style={{ color: "var(--accent)" }} />
                  </div>
                  <div>
                    <div className="text-sm font-bold" style={{ fontFamily: "'DM Mono', monospace", color: "var(--accent)" }}>
                      #{selected.id}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{selected.logger_type}</div>
                  </div>
                </div>
                <StatusBadge status={getLoggerStatus(selected)} />
                <div className="mt-4 flex flex-col">
                  {[
                    { label: "Site", value: selected.site_id },
                    { label: "Address", value: selected.address },
                    { label: "Serial No.", value: selected.logger_serial_number },
                    { label: "Software", value: selected.logger_software ? `v${selected.logger_software}` : "—" },
                    { label: "Network", value: selected.logger_network },
                    { label: "Protocol", value: selected.last_message_type },
                    { label: "Call Freq.", value: selected.call_frequency ? `${selected.call_frequency} min` : "—" },
                    { label: "Roaming", value: selected.is_roaming === 1 ? "Yes" : "No" },
                    { label: "Last Call", value: selected.last_call_in ? new Date(selected.last_call_in).toLocaleString("id-ID") : "Never" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between py-2"
                      style={{ borderBottom: "1px solid var(--border-color)" }}>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>
                      <span className="text-xs font-medium text-right max-w-[140px] truncate" style={{ color: "var(--text-secondary)" }}>{value ?? "—"}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg text-center" style={{ background: "var(--bg-primary)" }}>
                    <Battery size={16} className="mx-auto mb-1"
                      style={{ color: (selected.battery_level ?? 0) > 50 ? "#22c55e" : (selected.battery_level ?? 0) > 20 ? "#f59e0b" : "#ef4444" }} />
                    <div className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                      {selected.battery_level !== null ? `${selected.battery_level}%` : "—"}
                    </div>
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>Battery</div>
                  </div>
                  <div className="p-3 rounded-lg text-center" style={{ background: "var(--bg-primary)" }}>
                    <Signal size={16} className="mx-auto mb-1" style={{ color: "var(--accent)" }} />
                    <div className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                      {selected.signal_level !== null ? `${selected.signal_level}` : "—"}
                    </div>
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>Signal dBm</div>
                  </div>
                </div>
                <button onClick={() => router.push(`/sites/${selected.id}`)}
                  className="mt-4 w-full py-2 rounded-lg text-xs font-medium transition-all"
                  style={{ background: "var(--accent-bg)", color: "var(--accent)", border: "1px solid var(--border-accent)" }}>
                  Lihat Site Detail →
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
      <Chatbot />
    </div>
  );
}