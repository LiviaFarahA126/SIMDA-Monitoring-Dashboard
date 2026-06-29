"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Activity, AlertTriangle, BarChart2,
  Battery, ChevronRight, Droplets,
  RefreshCw, WifiOff, Zap,
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import Chatbot from "@/components/Chatbot";

type AlertData = {
  batteryAlerts: any[];
  offlineAlerts: any[];
  dataGapAlerts: any[];
  flowAnomalies: any[];
  pressureAnomalies: any[];
  summary: {
    battery: number;
    offline: number;
    dataGap: number;
    flowAnomaly: number;
    pressureAnomaly: number;
  };
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

function AlertCard({ icon: Icon, title, subtitle, level, meta, onClick }: any) {
  const cfg = {
    critical: { color: "#ef4444", bg: "rgba(239,68,68,0.06)", border: "rgba(239,68,68,0.15)" },
    warning:  { color: "#f59e0b", bg: "rgba(245,158,11,0.06)", border: "rgba(245,158,11,0.15)" },
    info:     { color: "var(--accent)", bg: "var(--accent-bg)", border: "var(--border-accent)" },
  }[level as "critical"|"warning"|"info"];
  return (
    <div onClick={onClick}
      className="flex items-start gap-3 p-4 rounded-xl transition-all"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, cursor: onClick ? "pointer" : "default" }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: `${cfg.color}18` }}>
        <Icon size={15} style={{ color: cfg.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold truncate" style={{ color: cfg.color }}>{title}</div>
        <div className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{subtitle}</div>
        {meta && <div className="text-xs mt-1" style={{ color: "var(--text-dimmer)" }}>{meta}</div>}
      </div>
      {onClick && <ChevronRight size={13} style={{ color: "var(--text-dimmer)", flexShrink: 0 }} />}
    </div>
  );
}

type TabKey = "battery"|"offline"|"dataGap"|"flow"|"pressure";

const TABS: { key: TabKey; label: string; icon: any; summaryKey: keyof AlertData["summary"] }[] = [
  { key: "battery",  label: "Battery Kritis",   icon: Battery,   summaryKey: "battery" },
  { key: "offline",  label: "Logger Offline",   icon: WifiOff,   summaryKey: "offline" },
  { key: "dataGap",  label: "Data Gap",         icon: BarChart2, summaryKey: "dataGap" },
  { key: "flow",     label: "Flow Anomaly",     icon: Droplets,  summaryKey: "flowAnomaly" },
  { key: "pressure", label: "Pressure Anomaly", icon: Zap,       summaryKey: "pressureAnomaly" },
];

const TAB_COLORS: Record<TabKey, string> = {
  battery: "#f59e0b", offline: "#ef4444",
  dataGap: "var(--accent)", flow: "#22c55e", pressure: "#a78bfa",
};

function Empty() {
  return (
    <div className="text-center py-12">
      <div className="text-2xl mb-2">✅</div>
      <div className="text-sm font-medium" style={{ color: "#22c55e" }}>Tidak ada alert</div>
      <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Semua dalam kondisi normal</div>
    </div>
  );
}

export default function AlertsPage() {
  const router = useRouter();
  const [data, setData] = useState<AlertData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("battery");
  const [refreshing, setRefreshing] = useState(false);

  const loadData = () => {
    setRefreshing(true);
    fetch("/api/alerts")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); setRefreshing(false); });
  };

  useEffect(() => { loadData(); }, []);

  const totalAlerts = data ? Object.values(data.summary).reduce((a, b) => a + b, 0) : 0;

  const renderContent = () => {
    if (!data) return null;
    if (activeTab === "battery") return (
      <div className="flex flex-col gap-2">
        {data.batteryAlerts.length === 0 ? <Empty /> : data.batteryAlerts.map((a, i) => (
          <AlertCard key={i} icon={Battery} level="warning"
            title={`Battery ${a.battery_level}% — Logger #${a.logger_id}`}
            subtitle={a.address ?? "Unknown site"}
            meta={`Site: ${a.site_id ?? "—"} · Last call: ${timeAgo(a.last_call_in)}`}
            onClick={() => a.site_id_num && router.push(`/sites/${a.site_id_num}`)} />
        ))}
      </div>
    );
    if (activeTab === "offline") return (
      <div className="flex flex-col gap-2">
        {data.offlineAlerts.length === 0 ? <Empty /> : data.offlineAlerts.map((a, i) => (
          <AlertCard key={i} icon={WifiOff} level="critical"
            title={`Logger #${a.logger_id} — ${a.logger_type ?? "Unknown"}`}
            subtitle={a.address ?? "Unknown site"}
            meta={`Last call: ${timeAgo(a.last_call_in)} · Site: ${a.site_id ?? "—"}`}
            onClick={() => a.site_id_num && router.push(`/sites/${a.site_id_num}`)} />
        ))}
      </div>
    );
    if (activeTab === "dataGap") return (
      <div className="flex flex-col gap-2">
        {data.dataGapAlerts.length === 0 ? <Empty /> : data.dataGapAlerts.map((a, i) => (
          <AlertCard key={i} icon={BarChart2} level="info"
            title={`Data Gap — ${a.site_id ?? "Unknown"}`}
            subtitle={a.address ?? "Unknown site"}
            meta={`Last data: ${a.last_data_time ? timeAgo(a.last_data_time) : "No data ever"}`}
            onClick={() => a.site_id_num && router.push(`/sites/${a.site_id_num}`)} />
        ))}
      </div>
    );
    if (activeTab === "flow") return (
      <div className="flex flex-col gap-2">
        {data.flowAnomalies.length === 0 ? <Empty /> : data.flowAnomalies.map((a, i) => (
          <AlertCard key={i} icon={Droplets} level="warning"
            title={`Flow Anomaly — ${a.site_code ?? "Unknown"}`}
            subtitle={a.address ?? "Unknown site"}
            meta={`Nilai: ${parseFloat(a.value).toFixed(2)} L/s · ${timeAgo(a.data_time)}`}
            onClick={() => a.site_id && router.push(`/sites/${a.site_id}`)} />
        ))}
      </div>
    );
    if (activeTab === "pressure") return (
      <div className="flex flex-col gap-2">
        {data.pressureAnomalies.length === 0 ? <Empty /> : data.pressureAnomalies.map((a, i) => (
          <AlertCard key={i} icon={Zap} level="critical"
            title={`Pressure Anomaly — ${a.site_code ?? "Unknown"}`}
            subtitle={a.address ?? "Unknown site"}
            meta={`Nilai: ${parseFloat(a.value).toFixed(3)} bar · ${timeAgo(a.data_time)}`}
            onClick={() => a.site_id && router.push(`/sites/${a.site_id}`)} />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');`}</style>
      <Sidebar />
      <main className="ml-56 flex flex-col min-h-screen">
        <Topbar
          title="Alerts & Anomaly Detection"
          subtitle="Deteksi otomatis anomali dan kondisi kritis jaringan"
          rightContent={
            <div className="flex items-center gap-2">
              {!loading && (
                <span className="text-xs px-3 py-1.5 rounded-full font-semibold"
                  style={{
                    background: totalAlerts > 0 ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)",
                    color: totalAlerts > 0 ? "#ef4444" : "#22c55e",
                  }}>
                  {totalAlerts} active alerts
                </span>
              )}
              <button onClick={loadData}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                style={{ background: "var(--card-bg)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}>
                <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
          }
        />

        <div className="flex-1 p-8 flex flex-col gap-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-5 gap-3">
            {TABS.map(({ key, label, icon: Icon, summaryKey }) => {
              const count = data?.summary[summaryKey] ?? 0;
              const color = TAB_COLORS[key];
              return (
                <button key={key} onClick={() => setActiveTab(key)}
                  className="card p-4 text-left transition-all"
                  style={{
                    borderColor: activeTab === key ? `${color}40` : "var(--border-color)",
                    background: activeTab === key ? `${color}08` : "var(--card-bg)",
                  }}>
                  <div className="flex items-center justify-between mb-2">
                    <Icon size={15} style={{ color }} />
                    {count > 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                        style={{ background: `${color}18`, color }}>
                        {count}
                      </span>
                    )}
                  </div>
                  <div className="text-lg font-bold" style={{ fontFamily: "'DM Mono', monospace", color }}>
                    {loading ? "—" : count}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{label}</div>
                </button>
              );
            })}
          </div>

          {/* Method Info */}
          <div className="card p-4 flex items-start gap-3">
            <Activity size={14} className="mt-0.5 flex-shrink-0" style={{ color: "var(--accent)" }} />
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              <span style={{ color: "var(--text-secondary)" }}>Metode deteksi: </span>
              Battery & offline menggunakan threshold statis. Flow & pressure anomaly menggunakan metode statistik{" "}
              <strong style={{ color: "var(--accent)" }}>Z-score (3σ)</strong> — nilai yang menyimpang lebih dari 3 standar deviasi dari rata-rata historis per site dianggap anomali.
            </div>
          </div>

          {/* Content */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {(() => {
                  const tab = TABS.find(t => t.key === activeTab)!;
                  const Icon = tab.icon;
                  return (
                    <>
                      <Icon size={15} style={{ color: TAB_COLORS[activeTab] }} />
                      <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{tab.label}</span>
                    </>
                  );
                })()}
              </div>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {data?.summary[TABS.find(t => t.key === activeTab)!.summaryKey] ?? 0} item
              </span>
            </div>
            {loading
              ? <div className="flex flex-col gap-2">
                  {Array(5).fill(0).map((_, i) => (
                    <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "var(--border-color)" }} />
                  ))}
                </div>
              : renderContent()}
          </div>
        </div>
      </main>
      <Chatbot />
    </div>
  );
}