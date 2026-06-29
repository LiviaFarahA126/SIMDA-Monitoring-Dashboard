"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import {
  AlertTriangle, ArrowLeft, Battery, CheckCircle2,
  ChevronDown, ChevronRight, ChevronUp, GitCompare,
  Layers, Radio, Search, Signal, WifiOff, X,
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

// ── Types ─────────────────────────────────────────────────────────────────────
type Site = {
  id: number; site_id: string; address: string;
  lat_east: number; long_north: number;
  battery_level: number | null; signal_level: number | null;
  last_call_in: string | null; logger_type: string | null;
  logger_network: string | null; logger_id: number | null;
};
type Logger = {
  id: number; logger_type: string | null; logger_software: number | null;
  logger_serial_number: number | null; last_call_in: string | null;
  signal_level: number | null; battery_level: number | null;
  logger_network: string | null; last_message_type: string | null;
  call_frequency: number | null; is_roaming: number | null;
  site_id: string | null; address: string | null;
};
type Datapoint = { data_time: string; channel_number: number; value: number };

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(d: string | null) {
  if (!d) return "Never";
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function getStatus(lastCall: string | null, battery: number | null) {
  if (!lastCall) return "offline";
  const hrs = (Date.now() - new Date(lastCall).getTime()) / 3600000;
  if (hrs > 24 * 30) return "offline";
  if (battery !== null && battery < 20) return "warning";
  return "online";
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const c: any = {
    online:  { color: "#22c55e", bg: "rgba(34,197,94,0.1)",  label: "Online",  Icon: CheckCircle2 },
    offline: { color: "#ef4444", bg: "rgba(239,68,68,0.1)",  label: "Offline", Icon: WifiOff },
    warning: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", label: "Warning", Icon: AlertTriangle },
  }[status] ?? { color: "#94a3b8", bg: "rgba(148,163,184,0.1)", label: status, Icon: AlertTriangle };
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ color: c.color, background: c.bg }}>
      <c.Icon size={11} />{c.label}
    </span>
  );
}
function BatteryBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>;
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

// ── CHANNEL CONFIG ─────────────────────────────────────────────────────────────
const CH_LABELS: Record<number, string> = { 0: "Flow (L/s)", 1: "Pressure (bar)", 2: "Temp (°C)", 3: "Level (m)" };
const CH_COLORS_A = ["#38bdf8", "#22c55e", "#f59e0b", "#ef4444"];
const CH_COLORS_B = ["#818cf8", "#34d399", "#fbbf24", "#f87171"];

// ── COMPARE PANEL ─────────────────────────────────────────────────────────────
function ComparePanel({ siteA, siteB, onClose }: {
  siteA: Site; siteB: Site; onClose: () => void;
}) {
  const [datapointsA, setDatapointsA] = useState<Datapoint[]>([]);
  const [datapointsB, setDatapointsB] = useState<Datapoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChannel, setActiveChannel] = useState(0);
  const [mode, setMode] = useState<"overlay"|"sidebyside">("overlay");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/sites/${siteA.id}`).then(r => r.json()),
      fetch(`/api/sites/${siteB.id}`).then(r => r.json()),
    ]).then(([dA, dB]) => {
      setDatapointsA(dA.datapoints ?? []);
      setDatapointsB(dB.datapoints ?? []);
      setLoading(false);
    });
  }, [siteA.id, siteB.id]);

  // Build chart data
  const availableChannels = [...new Set([
    ...datapointsA.map(d => d.channel_number),
    ...datapointsB.map(d => d.channel_number),
  ])].sort();

  function buildChartData(dps: Datapoint[], ch: number) {
    return [...dps]
      .filter(d => d.channel_number === ch)
      .reverse()
      .map(d => ({
        time: new Date(d.data_time).toLocaleString("id-ID", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
        value: parseFloat(parseFloat(String(d.value)).toFixed(3)),
      }));
  }

  // Overlay: merge both into one dataset
  function buildOverlayData() {
    const a = buildChartData(datapointsA, activeChannel);
    const b = buildChartData(datapointsB, activeChannel);
    const len = Math.max(a.length, b.length);
    return Array.from({ length: len }, (_, i) => ({
      i,
      a: a[i]?.value ?? null,
      b: b[i]?.value ?? null,
    }));
  }

  // Stats
  function stats(dps: Datapoint[], ch: number) {
    const vals = dps.filter(d => d.channel_number === ch).map(d => d.value);
    if (!vals.length) return { avg: "—", min: "—", max: "—", count: 0 };
    return {
      avg: (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2),
      min: Math.min(...vals).toFixed(2),
      max: Math.max(...vals).toFixed(2),
      count: vals.length,
    };
  }

  const statsA = stats(datapointsA, activeChannel);
  const statsB = stats(datapointsB, activeChannel);
  const chartA = buildChartData(datapointsA, activeChannel);
  const chartB = buildChartData(datapointsB, activeChannel);
  const overlayData = buildOverlayData();

  const tooltipStyle = {
    background: "var(--card-bg)",
    border: "1px solid var(--border-accent)",
    borderRadius: 8,
    fontSize: 11,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl flex flex-col"
        style={{ background: "var(--bg-primary)", border: "1px solid var(--border-accent)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--border-color)" }}>
          <div className="flex items-center gap-3">
            <GitCompare size={18} style={{ color: "var(--accent)" }} />
            <div>
              <div className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Compare Sites</div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>Perbandingan data sensor antar site</div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg transition-all"
            style={{ color: "var(--text-muted)", background: "var(--card-bg)" }}>
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 p-6 flex flex-col gap-5">
          {/* Site Headers */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { site: siteA, colors: CH_COLORS_A, label: "Site A" },
              { site: siteB, colors: CH_COLORS_B, label: "Site B" },
            ].map(({ site, colors, label }) => (
              <div key={site.id} className="card p-4 flex items-start gap-3"
                style={{ borderColor: colors[activeChannel] + "40" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: colors[activeChannel] + "18" }}>
                  <span className="text-xs font-bold" style={{ color: colors[activeChannel] }}>{label}</span>
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate"
                    style={{ fontFamily: "'DM Mono', monospace", color: colors[activeChannel] }}>
                    {site.site_id}
                  </div>
                  <div className="text-xs truncate mt-0.5" style={{ color: "var(--text-muted)" }}>{site.address}</div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <StatusBadge status={getStatus(site.last_call_in, site.battery_level)} />
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Battery: {site.battery_level ?? "—"}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            {/* Channel picker */}
            <div className="flex gap-1">
              {availableChannels.map(ch => (
                <button key={ch} onClick={() => setActiveChannel(ch)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: activeChannel === ch ? "var(--accent-bg)" : "transparent",
                    color: activeChannel === ch ? "var(--accent)" : "var(--text-muted)",
                    border: `1px solid ${activeChannel === ch ? "var(--border-accent)" : "transparent"}`,
                  }}>
                  {CH_LABELS[ch] ?? `Ch ${ch}`}
                </button>
              ))}
            </div>
            {/* Mode toggle */}
            <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-color)" }}>
              {(["overlay", "sidebyside"] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className="px-3 py-1.5 text-xs font-medium transition-all"
                  style={{
                    background: mode === m ? "var(--accent-bg)" : "var(--card-bg)",
                    color: mode === m ? "var(--accent)" : "var(--text-muted)",
                  }}>
                  {m === "overlay" ? "Overlay" : "Side by Side"}
                </button>
              ))}
            </div>
          </div>

          {/* Stats comparison */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Site A", s: statsA, color: CH_COLORS_A[activeChannel] },
              { label: "Site B", s: statsB, color: CH_COLORS_B[activeChannel] },
            ].map(({ label, s, color }) => (
              <div key={label} className="card p-4">
                <div className="text-xs font-semibold mb-3" style={{ color }}>
                  {label} — {CH_LABELS[activeChannel] ?? `Channel ${activeChannel}`}
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { k: "Avg", v: s.avg },
                    { k: "Min", v: s.min },
                    { k: "Max", v: s.max },
                    { k: "Data", v: String(s.count) },
                  ].map(({ k, v }) => (
                    <div key={k} className="text-center p-2 rounded-lg" style={{ background: "var(--bg-primary)" }}>
                      <div className="text-sm font-bold" style={{ color, fontFamily: "'DM Mono', monospace" }}>{v}</div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{k}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Chart */}
          {loading ? (
            <div className="h-64 rounded-xl animate-pulse" style={{ background: "var(--border-color)" }} />
          ) : mode === "overlay" ? (
            <div className="card p-5">
              <div className="text-xs font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
                Overlay — {CH_LABELS[activeChannel]}
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={overlayData}>
                  <defs>
                    <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CH_COLORS_A[activeChannel]} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={CH_COLORS_A[activeChannel]} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CH_COLORS_B[activeChannel]} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={CH_COLORS_B[activeChannel]} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="i" tick={{ fill: "var(--text-muted)", fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "var(--text-secondary)" }} />
                  <Area type="monotone" dataKey="a" name={siteA.site_id}
                    stroke={CH_COLORS_A[activeChannel]} strokeWidth={2} fill="url(#gA)" dot={false} />
                  <Area type="monotone" dataKey="b" name={siteB.site_id}
                    stroke={CH_COLORS_B[activeChannel]} strokeWidth={2} fill="url(#gB)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-3">
                {[
                  { label: siteA.site_id, color: CH_COLORS_A[activeChannel] },
                  { label: siteB.site_id, color: CH_COLORS_B[activeChannel] },
                ].map(({ label, color }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className="w-3 h-1.5 rounded-full" style={{ background: color }} />
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Site A", data: chartA, color: CH_COLORS_A[activeChannel], grad: "gSA", site: siteA },
                { label: "Site B", data: chartB, color: CH_COLORS_B[activeChannel], grad: "gSB", site: siteB },
              ].map(({ label, data, color, grad, site }) => (
                <div key={label} className="card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                    <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                      {label} — {site.site_id}
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={data}>
                      <defs>
                        <linearGradient id={grad} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                      <XAxis dataKey="time" tick={{ fill: "var(--text-muted)", fontSize: 8 }} axisLine={false} tickLine={false}
                        interval={Math.floor(data.length / 4)} />
                      <YAxis tick={{ fill: "var(--text-muted)", fontSize: 9 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "var(--text-secondary)" }} />
                      <Area type="monotone" dataKey="value" name={CH_LABELS[activeChannel]}
                        stroke={color} strokeWidth={1.5} fill={`url(#${grad})`} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
type SortKey = "last_call_in" | "battery_level" | "signal_level" | "id";

export default function MonitoringNetworkPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"sites" | "loggers">("sites");
  const [sites, setSites] = useState<Site[]>([]);
  const [loggers, setLoggers] = useState<Logger[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "online" | "offline" | "warning">("all");
  const [sortKey, setSortKey] = useState<SortKey>("last_call_in");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Compare state
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<Site[]>([]);
  const [compareSites, setCompareSites] = useState<[Site, Site] | null>(null);

  // Logger detail
  const [selectedLogger, setSelectedLogger] = useState<Logger | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/sites").then(r => r.json()),
      fetch("/api/loggers").then(r => r.json()),
    ]).then(([s, l]) => {
      setSites(s.sites);
      setLoggers(l.loggers);
      setLoading(false);
    });
  }, []);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  function toggleCompareSelect(site: Site) {
    setSelectedForCompare(prev => {
      if (prev.find(s => s.id === site.id)) return prev.filter(s => s.id !== site.id);
      if (prev.length >= 2) return [prev[1], site];
      return [...prev, site];
    });
  }

  function startCompare() {
    if (selectedForCompare.length === 2) {
      setCompareSites([selectedForCompare[0], selectedForCompare[1]]);
    }
  }

  const filterColors: any = {
    all: "var(--accent)", online: "#22c55e", warning: "#f59e0b", offline: "#ef4444"
  };

  const filteredSites = sites.filter(s => {
    const match = s.site_id?.toLowerCase().includes(search.toLowerCase()) ||
      s.address?.toLowerCase().includes(search.toLowerCase());
    const st = getStatus(s.last_call_in, s.battery_level);
    return match && (filterStatus === "all" || st === filterStatus);
  });

  const filteredLoggers = loggers
    .filter(l => {
      const match = l.id?.toString().includes(search) ||
        l.logger_type?.toLowerCase().includes(search.toLowerCase()) ||
        l.site_id?.toLowerCase().includes(search.toLowerCase());
      const st = getStatus(l.last_call_in, l.battery_level);
      return match && (filterStatus === "all" || st === filterStatus);
    })
    .sort((a, b) => {
      const av = a[sortKey] ?? ""; const bv = b[sortKey] ?? "";
      return sortDir === "asc" ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1);
    });

  const counts = {
    sites: {
      all: sites.length,
      online: sites.filter(s => getStatus(s.last_call_in, s.battery_level) === "online").length,
      warning: sites.filter(s => getStatus(s.last_call_in, s.battery_level) === "warning").length,
      offline: sites.filter(s => getStatus(s.last_call_in, s.battery_level) === "offline").length,
    },
    loggers: {
      all: loggers.length,
      online: loggers.filter(l => getStatus(l.last_call_in, l.battery_level) === "online").length,
      warning: loggers.filter(l => getStatus(l.last_call_in, l.battery_level) === "warning").length,
      offline: loggers.filter(l => getStatus(l.last_call_in, l.battery_level) === "offline").length,
    },
  };

  const activeCounts = counts[tab];

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
          title="Monitoring Network"
          subtitle="Manajemen sites dan loggers jaringan distribusi air"
          rightContent={
            <div className="flex items-center gap-2">
              {tab === "sites" && (
                compareMode ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {selectedForCompare.length}/2 dipilih
                    </span>
                    <button
                      onClick={startCompare}
                      disabled={selectedForCompare.length < 2}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                      style={{
                        background: selectedForCompare.length === 2 ? "var(--accent)" : "var(--border-color)",
                        color: selectedForCompare.length === 2 ? "#fff" : "var(--text-muted)",
                      }}>
                      <GitCompare size={12} /> Compare
                    </button>
                    <button onClick={() => { setCompareMode(false); setSelectedForCompare([]); }}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                      style={{ background: "var(--card-bg)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}>
                      <X size={12} /> Batal
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setCompareMode(true)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                    style={{ background: "var(--accent-bg)", color: "var(--accent)", border: "1px solid var(--border-accent)" }}>
                    <GitCompare size={12} /> Compare Sites
                  </button>
                )
              )}
            </div>
          }
        />

        <div className="flex-1 p-8 flex flex-col gap-5">

          {/* Compare hint banner */}
          {compareMode && (
            <div className="rounded-xl px-4 py-3 flex items-center gap-3"
              style={{ background: "var(--accent-bg)", border: "1px solid var(--border-accent)" }}>
              <GitCompare size={14} style={{ color: "var(--accent)" }} />
              <span className="text-xs" style={{ color: "var(--accent)" }}>
                Pilih 2 site untuk dibandingkan. Klik baris site untuk memilih.
              </span>
              {selectedForCompare.length > 0 && (
                <div className="flex items-center gap-2 ml-auto">
                  {selectedForCompare.map(s => (
                    <span key={s.id} className="text-xs px-2 py-1 rounded-lg font-medium"
                      style={{ background: "var(--accent)", color: "#fff" }}>
                      {s.site_id}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl w-fit"
            style={{ background: "var(--card-bg)", border: "1px solid var(--border-color)" }}>
            {(["sites", "loggers"] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); setSearch(""); setFilterStatus("all"); setSelectedLogger(null); }}
                className="px-5 py-2 rounded-lg text-sm font-medium capitalize transition-all flex items-center gap-2"
                style={{
                  background: tab === t ? "var(--accent-bg)" : "transparent",
                  color: tab === t ? "var(--accent)" : "var(--text-muted)",
                  border: tab === t ? "1px solid var(--border-accent)" : "1px solid transparent",
                }}>
                <Layers size={14} />
                {t === "sites" ? "Sites" : "Loggers"}
                <span className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{ background: tab === t ? "var(--accent)" : "var(--border-color)", color: tab === t ? "#fff" : "var(--text-muted)" }}>
                  {t === "sites" ? sites.length : loggers.length}
                </span>
              </button>
            ))}
          </div>

          {/* Stats mini cards */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Total",   value: activeCounts.all,     color: "var(--accent)" },
              { label: "Online",  value: activeCounts.online,  color: "#22c55e" },
              { label: "Warning", value: activeCounts.warning, color: "#f59e0b" },
              { label: "Offline", value: activeCounts.offline, color: "#ef4444" },
            ].map(({ label, value, color }) => (
              <div key={label} className="card px-4 py-3 flex items-center gap-3">
                <div className="text-xl font-bold" style={{ fontFamily: "'DM Mono', monospace", color }}>{value}</div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Filter Bar */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder={tab === "sites" ? "Cari site ID atau alamat..." : "Cari ID, tipe, atau site..."}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg outline-none"
                style={{ background: "var(--card-bg)", border: "1px solid var(--border-accent)", color: "var(--text-primary)" }} />
            </div>
            <div className="flex gap-1">
              {(["all", "online", "warning", "offline"] as const).map(s => (
                <button key={s} onClick={() => setFilterStatus(s)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
                  style={{
                    background: filterStatus === s ? `${filterColors[s]}18` : "transparent",
                    color: filterStatus === s ? filterColors[s] : "var(--text-muted)",
                    border: `1px solid ${filterStatus === s ? `${filterColors[s]}40` : "transparent"}`,
                  }}>
                  {s} ({activeCounts[s as keyof typeof activeCounts]})
                </button>
              ))}
            </div>
          </div>

          {/* Content area */}
          <div className="flex gap-5">
            {/* Table */}
            <div className="flex-1 min-w-0">
              {tab === "sites" ? (
                <div className="card overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border-color)", background: "var(--bg-primary)" }}>
                        {compareMode && <th className="px-4 py-3 w-8" />}
                        {["Site ID","Address","Status","Battery","Signal","Last Call",""].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-medium" style={{ color: "var(--text-muted)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? Array(6).fill(0).map((_, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--border-color)" }}>
                          {Array(7).fill(0).map((_, j) => (
                            <td key={j} className="px-4 py-4">
                              <div className="h-3 rounded animate-pulse w-20" style={{ background: "var(--border-color)" }} />
                            </td>
                          ))}
                        </tr>
                      )) : filteredSites.map(site => {
                        const isSelected = selectedForCompare.find(s => s.id === site.id);
                        return (
                          <tr key={site.id}
                            className="row-hover transition-colors"
                            style={{
                              borderBottom: "1px solid var(--border-color)",
                              background: isSelected ? "var(--accent-bg)" : undefined,
                              cursor: compareMode ? "pointer" : "pointer",
                            }}
                            onClick={() => compareMode ? toggleCompareSelect(site) : router.push(`/sites/${site.id}`)}>
                            {compareMode && (
                              <td className="px-4 py-3">
                                <div className="w-4 h-4 rounded border-2 flex items-center justify-center transition-all"
                                  style={{
                                    borderColor: isSelected ? "var(--accent)" : "var(--border-accent)",
                                    background: isSelected ? "var(--accent)" : "transparent",
                                  }}>
                                  {isSelected && <div className="w-2 h-2 rounded-sm bg-white" />}
                                </div>
                              </td>
                            )}
                            <td className="px-4 py-3 text-xs font-semibold"
                              style={{ fontFamily: "'DM Mono', monospace", color: "var(--accent)" }}>
                              {site.site_id}
                            </td>
                            <td className="px-4 py-3 text-xs max-w-xs truncate" style={{ color: "var(--text-secondary)" }}>{site.address}</td>
                            <td className="px-4 py-3"><StatusBadge status={getStatus(site.last_call_in, site.battery_level)} /></td>
                            <td className="px-4 py-3"><BatteryBar value={site.battery_level} /></td>
                            <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                              {site.signal_level !== null ? `${site.signal_level} dBm` : "—"}
                            </td>
                            <td className="px-4 py-3 text-xs" style={{ color: "var(--text-dimmer)" }}>{timeAgo(site.last_call_in)}</td>
                            <td className="px-4 py-3">
                              {!compareMode && <ChevronRight size={14} style={{ color: "var(--text-dimmer)" }} />}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {!loading && filteredSites.length === 0 && (
                    <div className="text-center py-16 text-sm" style={{ color: "var(--text-muted)" }}>Tidak ada site yang cocok.</div>
                  )}
                </div>
              ) : (
                // Loggers Table
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
                      {loading ? Array(6).fill(0).map((_, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--border-color)" }}>
                          {Array(7).fill(0).map((_, j) => (
                            <td key={j} className="px-4 py-4">
                              <div className="h-3 rounded animate-pulse w-16" style={{ background: "var(--border-color)" }} />
                            </td>
                          ))}
                        </tr>
                      )) : filteredLoggers.map(logger => (
                        <tr key={logger.id}
                          className="row-hover transition-colors"
                          style={{
                            borderBottom: "1px solid var(--border-color)",
                            background: selectedLogger?.id === logger.id ? "var(--accent-bg)" : undefined,
                          }}
                          onClick={() => setSelectedLogger(selectedLogger?.id === logger.id ? null : logger)}>
                          <td className="px-4 py-3 text-xs font-semibold"
                            style={{ fontFamily: "'DM Mono', monospace", color: "var(--accent)" }}>#{logger.id}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>{logger.logger_type ?? "—"}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>{logger.site_id ?? "—"}</td>
                          <td className="px-4 py-3"><StatusBadge status={getStatus(logger.last_call_in, logger.battery_level)} /></td>
                          <td className="px-4 py-3"><BatteryBar value={logger.battery_level} /></td>
                          <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                            {logger.signal_level !== null ? `${logger.signal_level} dBm` : "—"}
                          </td>
                          <td className="px-4 py-3 text-xs" style={{ color: "var(--text-dimmer)" }}>{timeAgo(logger.last_call_in)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!loading && filteredLoggers.length === 0 && (
                    <div className="text-center py-16 text-sm" style={{ color: "var(--text-muted)" }}>Tidak ada logger yang cocok.</div>
                  )}
                </div>
              )}
            </div>

            {/* Logger Detail Panel */}
            {tab === "loggers" && selectedLogger && (
              <div className="w-72 flex-shrink-0">
                <div className="card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Logger Detail</div>
                    <button onClick={() => setSelectedLogger(null)} className="text-xs px-2 py-1 rounded"
                      style={{ color: "var(--text-muted)" }}>✕</button>
                  </div>
                  <div className="flex items-center gap-3 mb-4 p-3 rounded-lg" style={{ background: "var(--accent-bg)" }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: "var(--accent-bg)" }}>
                      <Radio size={16} style={{ color: "var(--accent)" }} />
                    </div>
                    <div>
                      <div className="text-sm font-bold" style={{ fontFamily: "'DM Mono', monospace", color: "var(--accent)" }}>
                        #{selectedLogger.id}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{selectedLogger.logger_type}</div>
                    </div>
                  </div>
                  <StatusBadge status={getStatus(selectedLogger.last_call_in, selectedLogger.battery_level)} />
                  <div className="mt-4 flex flex-col">
                    {[
                      { label: "Site", value: selectedLogger.site_id },
                      { label: "Address", value: selectedLogger.address },
                      { label: "Network", value: selectedLogger.logger_network },
                      { label: "Protocol", value: selectedLogger.last_message_type },
                      { label: "Call Freq.", value: selectedLogger.call_frequency ? `${selectedLogger.call_frequency} min` : "—" },
                      { label: "Roaming", value: selectedLogger.is_roaming === 1 ? "Yes" : "No" },
                      { label: "Last Call", value: selectedLogger.last_call_in ? new Date(selectedLogger.last_call_in).toLocaleString("id-ID") : "Never" },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between py-2"
                        style={{ borderBottom: "1px solid var(--border-color)" }}>
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>
                        <span className="text-xs font-medium text-right max-w-[140px] truncate" style={{ color: "var(--text-secondary)" }}>{value ?? "—"}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {[
                      { label: "Battery", value: selectedLogger.battery_level !== null ? `${selectedLogger.battery_level}%` : "—", color: (selectedLogger.battery_level ?? 0) > 50 ? "#22c55e" : (selectedLogger.battery_level ?? 0) > 20 ? "#f59e0b" : "#ef4444", Icon: Battery },
                      { label: "Signal", value: selectedLogger.signal_level !== null ? `${selectedLogger.signal_level}` : "—", color: "var(--accent)", Icon: Signal },
                    ].map(({ label, value, color, Icon }) => (
                      <div key={label} className="p-3 rounded-lg text-center" style={{ background: "var(--bg-primary)" }}>
                        <Icon size={16} className="mx-auto mb-1" style={{ color }} />
                        <div className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{value}</div>
                        <div className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Compare Modal */}
      {compareSites && (
        <ComparePanel
          siteA={compareSites[0]}
          siteB={compareSites[1]}
          onClose={() => setCompareSites(null)}
        />
      )}
    </div>
  );
}