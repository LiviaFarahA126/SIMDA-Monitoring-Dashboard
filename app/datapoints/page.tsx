"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { BarChart2, ChevronDown, Download, Filter } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import Chatbot from "@/components/Chatbot";

type Site = { id: number; site_id: string; address: string };
type Datapoint = { data_time: string; channel_number: number; value: number };

const CHANNEL_LABELS: Record<number, string> = {
  0: "Flow (L/s)", 1: "Pressure (bar)", 2: "Temperature (°C)", 3: "Level (m)",
};
const CHANNEL_COLORS = ["#38bdf8","#22c55e","#f59e0b","#ef4444","#a78bfa"];

function exportCSV(datapoints: Datapoint[], siteLabel: string) {
  const header = "data_time,channel_number,value\n";
  const rows = datapoints.map(d => `${d.data_time},${d.channel_number},${d.value}`).join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `datapoints_${siteLabel.replace(/\s/g, "_")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DataPointsPage() {
  const router = useRouter();
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState<string>("");
  const [selectedChannel, setSelectedChannel] = useState<string>("all");
  const [limit, setLimit] = useState<string>("200");
  const [channels, setChannels] = useState<number[]>([]);
  const [datapoints, setDatapoints] = useState<Datapoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    fetch("/api/datapoints")
      .then(r => r.json())
      .then(d => { setSites(d.sites); setInitialLoading(false); });
  }, []);

  const fetchData = useCallback(() => {
    if (!selectedSite) return;
    setLoading(true);
    const params = new URLSearchParams({ siteId: selectedSite, limit });
    if (selectedChannel !== "all") params.set("channel", selectedChannel);
    fetch(`/api/datapoints?${params}`)
      .then(r => r.json())
      .then(d => { setDatapoints(d.datapoints); setChannels(d.channels); setLoading(false); });
  }, [selectedSite, selectedChannel, limit]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const chartData = (() => {
    const map: Record<string, any> = {};
    [...datapoints].reverse().forEach(p => {
      const time = new Date(p.data_time).toLocaleString("id-ID", {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
      });
      if (!map[time]) map[time] = { time };
      map[time][`ch${p.channel_number}`] = parseFloat(parseFloat(String(p.value)).toFixed(3));
    });
    return Object.values(map);
  })();

  const activeChannels = selectedChannel === "all" ? channels : [parseInt(selectedChannel)];
  const selectedSiteObj = sites.find(s => s.id === parseInt(selectedSite));
  const values = datapoints.map(d => d.value);
  const avg = values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(3) : "—";
  const min = values.length ? Math.min(...values).toFixed(3) : "—";
  const max = values.length ? Math.max(...values).toFixed(3) : "—";

  const selectStyle = {
    background: "var(--card-bg)",
    border: "1px solid var(--border-accent)",
    color: "var(--text-primary)",
    appearance: "none" as const,
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap'); select { appearance: none; }`}</style>
      <Sidebar />
      <main className="ml-56 flex flex-col min-h-screen">
        <Topbar
          title="Data Points"
          subtitle="Explorer data sensor per site dan channel"
          rightContent={
            datapoints.length > 0 ? (
              <button onClick={() => exportCSV(datapoints, selectedSiteObj?.site_id ?? "data")}
                className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg transition-all"
                style={{ background: "var(--accent-bg)", color: "var(--accent)", border: "1px solid var(--border-accent)" }}>
                <Download size={12} /> Export CSV
              </button>
            ) : undefined
          }
        />

        <div className="flex-1 p-8 flex flex-col gap-5">
          {/* Filter Bar */}
          <div className="card p-4 flex flex-wrap items-end gap-4">
            <Filter size={15} style={{ color: "var(--text-muted)", marginBottom: 4 }} />
            <div className="flex flex-col gap-1 min-w-64">
              <label className="text-xs" style={{ color: "var(--text-muted)" }}>Site</label>
              <div className="relative">
                <select value={selectedSite} onChange={e => { setSelectedSite(e.target.value); setSelectedChannel("all"); }}
                  className="w-full pl-3 pr-8 py-2 text-sm rounded-lg outline-none" style={selectStyle}>
                  <option value="">-- Pilih Site --</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.site_id} — {s.address.slice(0, 40)}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs" style={{ color: "var(--text-muted)" }}>Channel</label>
              <div className="relative">
                <select value={selectedChannel} onChange={e => setSelectedChannel(e.target.value)}
                  disabled={!selectedSite}
                  className="pl-3 pr-8 py-2 text-sm rounded-lg outline-none" style={{ ...selectStyle, minWidth: 160 }}>
                  <option value="all">Semua Channel</option>
                  {channels.map(ch => <option key={ch} value={ch}>{CHANNEL_LABELS[ch] ?? `Channel ${ch}`}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs" style={{ color: "var(--text-muted)" }}>Tampilkan</label>
              <div className="relative">
                <select value={limit} onChange={e => setLimit(e.target.value)}
                  className="pl-3 pr-8 py-2 text-sm rounded-lg outline-none" style={selectStyle}>
                  {["100","200","500","1000"].map(l => <option key={l} value={l}>{l} data terbaru</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
              </div>
            </div>
          </div>

          {!selectedSite ? (
            <div className="card flex flex-col items-center justify-center py-24 gap-4">
              <BarChart2 size={40} style={{ color: "var(--border-accent)" }} />
              <div className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Pilih site untuk melihat data</div>
              <div className="text-xs" style={{ color: "var(--text-dimmer)" }}>Gunakan filter di atas untuk memilih site dan channel</div>
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: "Total Data", value: loading ? "—" : datapoints.length.toLocaleString(), color: "var(--accent)" },
                  { label: "Rata-rata",  value: loading ? "—" : avg, color: "#22c55e" },
                  { label: "Min",        value: loading ? "—" : min, color: "#a78bfa" },
                  { label: "Max",        value: loading ? "—" : max, color: "#f59e0b" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="card p-4">
                    <div className="text-xl font-bold" style={{ fontFamily: "'DM Mono', monospace", color }}>{value}</div>
                    <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Chart */}
              <div className="card p-5">
                <div className="mb-4">
                  <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Grafik Data Sensor</div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {selectedSiteObj?.site_id} — {selectedChannel === "all" ? "Semua channel" : (CHANNEL_LABELS[parseInt(selectedChannel)] ?? `Channel ${selectedChannel}`)}
                  </div>
                </div>
                {loading ? (
                  <div className="h-56 rounded-lg animate-pulse" style={{ background: "var(--border-color)" }} />
                ) : chartData.length === 0 ? (
                  <div className="h-56 flex items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>Tidak ada data</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
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
                        interval={Math.floor(chartData.length / 5)} />
                      <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--border-accent)", borderRadius: 8, fontSize: 11 }}
                        labelStyle={{ color: "var(--text-secondary)" }} />
                      {activeChannels.map(ch => (
                        <Area key={ch} type="monotone" dataKey={`ch${ch}`}
                          name={CHANNEL_LABELS[ch] ?? `Channel ${ch}`}
                          stroke={CHANNEL_COLORS[ch % CHANNEL_COLORS.length]}
                          strokeWidth={1.5} fill={`url(#grad${ch})`} dot={false} />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Table */}
              <div className="card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4"
                  style={{ borderBottom: "1px solid var(--border-color)" }}>
                  <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Raw Data</div>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {loading ? "Loading..." : `${datapoints.length} baris`}
                  </span>
                </div>
                <div className="overflow-auto" style={{ maxHeight: 400 }}>
                  <table className="w-full">
                    <thead className="sticky top-0" style={{ background: "var(--card-bg)" }}>
                      <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                        {["#","Waktu","Channel","Nilai"].map(h => (
                          <th key={h} className="text-left px-5 py-2.5 text-xs font-medium" style={{ color: "var(--text-muted)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? Array(6).fill(0).map((_, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--border-color)" }}>
                          {[1,2,3,4].map(j => (
                            <td key={j} className="px-5 py-3">
                              <div className="h-3 rounded animate-pulse w-24" style={{ background: "var(--border-color)" }} />
                            </td>
                          ))}
                        </tr>
                      )) : datapoints.map((d, i) => (
                        <tr key={i} className="row-hover transition-colors"
                          style={{ borderBottom: "1px solid var(--border-color)" }}>
                          <td className="px-5 py-2.5 text-xs" style={{ color: "var(--text-dimmer)" }}>{i + 1}</td>
                          <td className="px-5 py-2.5 text-xs" style={{ fontFamily: "'DM Mono', monospace", color: "var(--text-muted)" }}>
                            {new Date(d.data_time).toLocaleString("id-ID")}
                          </td>
                          <td className="px-5 py-2.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                              style={{
                                background: `${CHANNEL_COLORS[d.channel_number % CHANNEL_COLORS.length]}15`,
                                color: CHANNEL_COLORS[d.channel_number % CHANNEL_COLORS.length],
                              }}>
                              {CHANNEL_LABELS[d.channel_number] ?? `Ch ${d.channel_number}`}
                            </span>
                          </td>
                          <td className="px-5 py-2.5 text-xs font-semibold"
                            style={{ fontFamily: "'DM Mono', monospace", color: "var(--text-primary)" }}>
                            {parseFloat(String(d.value)).toFixed(3)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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