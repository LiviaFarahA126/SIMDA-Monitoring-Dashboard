"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import {
  AlertTriangle, Battery, CheckCircle2,
  ChevronRight, Clock, MapPin, RefreshCw, Wifi, WifiOff,
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import Chatbot from "@/components/Chatbot";

type DashboardData = {
  stats: {
    totalSites: number;
    onlineLoggers: number;
    offlineLoggers: number;
    lowBattery: number;
  };
  recentSites: any[];
  trendData: any[];
  alerts: any[];
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

function getSiteStatus(site: any) {
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
  }[status] ?? { color: "#94a3b8", bg: "rgba(148,163,184,0.1)", label: status, icon: Clock };
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
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(value, 100)}%`, background: color }} />
      </div>
      <span className="text-xs" style={{ color }}>{Math.round(value)}%</span>
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`rounded animate-pulse ${className}`} style={{ background: "var(--border-color)" }} />;
}

const REFRESH_INTERVAL = 30; // detik

export default function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch("/api/dashboard");
      const d = await res.json();
      setData(d);
      setLastUpdated(new Date());
      setCountdown(REFRESH_INTERVAL);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchData(true), REFRESH_INTERVAL * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(c => c <= 1 ? REFRESH_INTERVAL : c - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const summaryCards = data ? [
    { label: "Total Sites",     value: data.stats.totalSites,     icon: MapPin,  color: "var(--accent)" },
    { label: "Online Loggers",  value: data.stats.onlineLoggers,  icon: Wifi,    color: "#22c55e" },
    { label: "Offline Loggers", value: data.stats.offlineLoggers, icon: WifiOff, color: "#ef4444" },
    { label: "Low Battery",     value: data.stats.lowBattery,     icon: Battery, color: "#f59e0b" },
  ] : [];

  const chartData = data?.trendData.map((d: any) => ({
    time: new Date(d.hour).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    value: parseFloat(parseFloat(d.avg_value).toFixed(2)),
  })) ?? [];

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: var(--bg-secondary); }
        ::-webkit-scrollbar-thumb { background: var(--border-accent); border-radius: 2px; }
        .card { background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 12px; }
        .row-hover:hover { background: var(--accent-bg); cursor: pointer; }
      `}</style>

      <Sidebar />

      <main className="ml-56 flex flex-col min-h-screen">
        <Topbar
          title="Dashboard"
          subtitle="Monitoring Overview — Jaringan Distribusi Air Balikpapan"
          rightContent={
            <div className="flex items-center gap-2">
              {/* Countdown + refresh */}
              <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg"
                style={{ background: "var(--card-bg)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}>
                <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} />
                {lastUpdated
                  ? `Updated ${lastUpdated.toLocaleTimeString("id-ID")} · refresh in ${countdown}s`
                  : "Loading..."}
              </div>
              <button onClick={() => fetchData(true)}
                className="text-xs px-3 py-1.5 rounded-lg transition-all"
                style={{ background: "var(--accent-bg)", color: "var(--accent)", border: "1px solid var(--border-accent)" }}>
                Refresh
              </button>
            </div>
          }
        />

        <div className="flex-1 p-8 flex flex-col gap-6">

          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4">
            {loading
              ? Array(4).fill(0).map((_, i) => (
                  <div key={i} className="card p-5"><Skeleton className="h-12 w-full" /></div>
                ))
              : summaryCards.map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="card p-5 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${color}18` }}>
                      <Icon size={18} style={{ color }} />
                    </div>
                    <div>
                      <div className="text-2xl font-bold"
                        style={{ fontFamily: "'DM Mono', monospace", color }}>
                        {value}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{label}</div>
                    </div>
                  </div>
                ))}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card col-span-2 p-5">
              <div className="mb-5">
                <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  Flow Trend — 24 Jam Terakhir
                </div>
                <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Rata-rata semua site, Channel 0
                </div>
              </div>
              {loading ? <Skeleton className="h-44 w-full" /> : (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis dataKey="time" tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--border-accent)", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: "var(--text-secondary)" }} itemStyle={{ color: "var(--accent)" }} />
                    <Area type="monotone" dataKey="value" stroke="var(--accent)"
                      strokeWidth={2} fill="url(#grad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Alerts Panel */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Active Alerts</div>
                <div className="flex items-center gap-2">
                  {data && data.alerts.length > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                      {data.alerts.length}
                    </span>
                  )}
                  <button onClick={() => router.push("/alerts")}
                    className="text-xs flex items-center gap-0.5"
                    style={{ color: "var(--accent)" }}>
                    Semua <ChevronRight size={11} />
                  </button>
                </div>
              </div>
              {loading ? <Skeleton className="h-40 w-full" /> : (
                <div className="flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: 200 }}>
                  {data?.alerts.length === 0 && (
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>Tidak ada alert aktif 🎉</p>
                  )}
                  {data?.alerts.map((a: any, i: number) => {
                    const isOffline = !a.last_call_in ||
                      (Date.now() - new Date(a.last_call_in).getTime()) > 3 * 86400000;
                    const color = isOffline ? "#ef4444" : "#f59e0b";
                    return (
                      <div key={i} className="flex gap-3 p-3 rounded-lg"
                        style={{ background: `${color}08`, border: `1px solid ${color}20` }}>
                        <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" style={{ color }} />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold" style={{ color }}>
                            {isOffline ? "Logger Offline" : "Low Battery"}
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                            Logger #{a.id} — {isOffline ? "No signal" : `Battery ${a.battery_level}%`}
                          </div>
                          <div className="text-xs mt-1" style={{ color: "var(--text-dimmer)" }}>
                            {timeAgo(a.last_call_in)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Recent Sites Table */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Recent Sites</div>
              <button
                onClick={() => router.push("/network")}
                className="flex items-center gap-1 text-xs transition-all"
                style={{ color: "var(--accent)" }}>
                View all <ChevronRight size={12} />
              </button>
            </div>
            {loading ? <Skeleton className="h-40 w-full" /> : (
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                    {["Site ID", "Address", "Status", "Battery", "Signal", "Last Call"].map(h => (
                      <th key={h} className="text-left pb-2 text-xs font-medium"
                        style={{ color: "var(--text-muted)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data?.recentSites.map((site: any) => (
                    <tr key={site.id}
                      className="row-hover transition-colors"
                      style={{ borderBottom: "1px solid var(--border-color)" }}
                      onClick={() => router.push(`/sites/${site.id}`)}>
                      <td className="py-3 text-xs font-medium pr-4"
                        style={{ fontFamily: "'DM Mono', monospace", color: "var(--accent)" }}>
                        {site.site_id}
                      </td>
                      <td className="py-3 text-xs pr-4" style={{ color: "var(--text-secondary)" }}>{site.address}</td>
                      <td className="py-3 pr-4"><StatusBadge status={getSiteStatus(site)} /></td>
                      <td className="py-3 pr-4"><BatteryBar value={site.battery_level} /></td>
                      <td className="py-3 text-xs pr-4" style={{ color: "var(--text-muted)" }}>
                        {site.signal_level !== null ? `${site.signal_level} dBm` : "—"}
                      </td>
                      <td className="py-3 text-xs" style={{ color: "var(--text-dimmer)" }}>
                        {timeAgo(site.last_call_in)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

        </div>
      </main>
      <Chatbot />
    </div>
  );
}