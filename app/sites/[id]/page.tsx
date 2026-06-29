"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  AlertTriangle, ArrowLeft, Battery,
  CheckCircle2, Clock, Radio, Signal, WifiOff,
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import Chatbot from "@/components/Chatbot";

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} days ago`;
}

function InfoRow({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-center justify-between py-2.5"
      style={{ borderBottom: "1px solid var(--border-color)" }}>
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{value ?? "—"}</span>
    </div>
  );
}

const CHANNEL_COLORS = ["#38bdf8","#22c55e","#f59e0b","#ef4444","#a78bfa"];
const CHANNEL_LABELS: Record<number, string> = {
  0: "Flow (L/s)", 1: "Pressure (bar)", 2: "Temperature (°C)", 3: "Level (m)",
};

export default function SiteDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [site, setSite] = useState<any>(null);
  const [datapoints, setDatapoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChannels, setActiveChannels] = useState<number[]>([0]);

  useEffect(() => {
    fetch(`/api/sites/${id}`)
      .then(r => r.json())
      .then(d => {
        setSite(d.site);
        setDatapoints(d.datapoints);
        const channels = [...new Set(d.datapoints.map((p: any) => p.channel_number))] as number[];
        setActiveChannels(channels.slice(0, 2));
        setLoading(false);
      });
  }, [id]);

  const chartData = (() => {
    const map: Record<string, any> = {};
    [...datapoints].reverse().forEach(p => {
      const time = new Date(p.data_time).toLocaleString("id-ID", {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
      });
      if (!map[time]) map[time] = { time };
      map[time][`ch${p.channel_number}`] = parseFloat(parseFloat(p.value).toFixed(3));
    });
    return Object.values(map);
  })();

  const availableChannels = [...new Set(datapoints.map(p => p.channel_number))];

  const status = !site?.last_call_in ? "offline"
    : (Date.now() - new Date(site.last_call_in).getTime()) / 3600000 > 24 * 30 ? "offline"
    : site?.battery_level < 20 ? "warning" : "online";

  const statusCfg: any = {
    online:  { color: "#22c55e", bg: "rgba(34,197,94,0.1)",  label: "Online",  icon: CheckCircle2 },
    offline: { color: "#ef4444", bg: "rgba(239,68,68,0.1)",  label: "Offline", icon: WifiOff },
    warning: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", label: "Warning", icon: AlertTriangle },
  }[status];
  const StatusIcon = statusCfg?.icon ?? Clock;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');`}</style>
      <Sidebar />
      <main className="ml-56 flex flex-col min-h-screen">
        <Topbar
          title={loading ? "Loading..." : site?.site_id ?? "Site Detail"}
          subtitle={site?.address ?? ""}
          rightContent={
            <div className="flex items-center gap-2">
              {statusCfg && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{ color: statusCfg.color, background: statusCfg.bg }}>
                  <StatusIcon size={12} />{statusCfg.label}
                </span>
              )}
              <button onClick={() => router.push("/sites")}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                style={{ color: "var(--text-muted)", background: "var(--card-bg)", border: "1px solid var(--border-color)" }}>
                <ArrowLeft size={12} /> Back
              </button>
            </div>
          }
        />

        <div className="flex-1 p-8 flex flex-col gap-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>Loading site data...</div>
            </div>
          ) : (
            <>
              {/* Info Cards */}
              <div className="grid grid-cols-4 gap-4">
                {[
                  { icon: Battery, label: "Battery", value: site?.battery_level !== null ? `${site.battery_level}%` : "—", color: site?.battery_level > 50 ? "#22c55e" : site?.battery_level > 20 ? "#f59e0b" : "#ef4444" },
                  { icon: Signal,  label: "Signal",  value: site?.signal_level !== null ? `${site.signal_level} dBm` : "—", color: "var(--accent)" },
                  { icon: Clock,   label: "Last Call", value: timeAgo(site?.last_call_in), color: "var(--text-secondary)" },
                  { icon: Radio,   label: "Logger Type", value: site?.logger_type ?? "—", color: "#a78bfa" },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div key={label} className="card p-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${color}18` }}>
                      <Icon size={15} style={{ color }} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold" style={{ color }}>{value}</div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{label}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Chart */}
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Data History</div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>200 data terbaru</div>
                  </div>
                  <div className="flex gap-1">
                    {availableChannels.map(ch => {
                      const active = activeChannels.includes(ch);
                      const color = CHANNEL_COLORS[ch % CHANNEL_COLORS.length];
                      return (
                        <button key={ch}
                          onClick={() => setActiveChannels(prev =>
                            prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]
                          )}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                          style={{
                            background: active ? `${color}18` : "transparent",
                            color: active ? color : "var(--text-muted)",
                            border: `1px solid ${active ? `${color}40` : "transparent"}`,
                          }}>
                          {CHANNEL_LABELS[ch] ?? `Ch ${ch}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={chartData}>
                    <defs>
                      {activeChannels.map(ch => (
                        <linearGradient key={ch} id={`grad${ch}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={CHANNEL_COLORS[ch % CHANNEL_COLORS.length]} stopOpacity={0.25} />
                          <stop offset="100%" stopColor={CHANNEL_COLORS[ch % CHANNEL_COLORS.length]} stopOpacity={0} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis dataKey="time" tick={{ fill: "var(--text-muted)", fontSize: 9 }} axisLine={false} tickLine={false}
                      interval={Math.floor(chartData.length / 6)} />
                    <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--border-accent)", borderRadius: 8, fontSize: 11 }}
                      labelStyle={{ color: "var(--text-secondary)" }} />
                    <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-muted)" }} />
                    {activeChannels.map(ch => (
                      <Area key={ch} type="monotone" dataKey={`ch${ch}`}
                        name={CHANNEL_LABELS[ch] ?? `Channel ${ch}`}
                        stroke={CHANNEL_COLORS[ch % CHANNEL_COLORS.length]}
                        strokeWidth={1.5} fill={`url(#grad${ch})`} dot={false} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="card p-5">
                  <div className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Site Info</div>
                  <InfoRow label="Site ID" value={site?.site_id} />
                  <InfoRow label="Address" value={site?.address} />
              
                  <InfoRow label="Latitude" value={site?.lat_east} />
                  <InfoRow label="Longitude" value={site?.long_north} />
                  <InfoRow label="Pipe Size" value={site?.pipe_size ? `${site.pipe_size} mm` : "—"} />
                  <InfoRow label="Start Date" value={site?.start_date ? new Date(site.start_date).toLocaleDateString("id-ID") : "—"} />
                </div>
                <div className="card p-5">
                  <div className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Logger Info</div>
                  <InfoRow label="Logger ID" value={site?.logger_id} />
                  <InfoRow label="Type" value={site?.logger_type} />
                  <InfoRow label="Network" value={site?.logger_network} />
                  <InfoRow label="Call Frequency" value={site?.call_frequency ? `${site.call_frequency} min` : "—"} />
                  <InfoRow label="Roaming" value={site?.is_roaming === 1 ? "Yes" : "No"} />
                  <InfoRow label="Last Call" value={site?.last_call_in ? new Date(site.last_call_in).toLocaleString("id-ID") : "—"} />
                </div>
              </div>
            </>
          )}
        </div>
      </main>
      <Chatbot />
    </div>
  );
}