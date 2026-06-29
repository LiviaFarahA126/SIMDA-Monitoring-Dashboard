"use client";

import { useEffect, useState } from "react";
import { Clock, Moon, Sun } from "lucide-react";

type Props = {
  title: string;
  subtitle?: string;
  rightContent?: React.ReactNode;
};

export default function Topbar({ title, subtitle, rightContent }: Props) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("simda-theme") as "dark" | "light" | null;
    const initial = saved ?? "dark";
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("simda-theme", next);
  }

  return (
    <header
      className="sticky top-0 z-10 flex items-center justify-between px-8 py-4"
      style={{
        background: "var(--topbar-bg)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border-color)",
      }}
    >
      <div>
        <h1
          className="text-lg font-bold tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {rightContent}

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
          style={{
            background: "var(--card-bg)",
            color: "var(--text-secondary)",
            border: "1px solid var(--border-color)",
          }}
          title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
          {theme === "dark" ? "Light" : "Dark"}
        </button>
      </div>
    </header>
  );
}