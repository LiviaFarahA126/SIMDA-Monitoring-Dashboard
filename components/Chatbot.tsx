"use client";

import { useState, useRef, useEffect } from "react";
import {
  MessageCircle,
  Send,
  X,
  Minimize2,
  Bot,
  User,
  Loader2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const SUGGESTIONS = [
  "Logger mana yang battery-nya kritis?",
  "Berapa total site yang aktif?",
  "Site mana yang paling lama tidak aktif?",
  "Tunjukkan data flow terbaru",
];

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Halo! Saya asisten SIMDA. Saya bisa membantu kamu memantau kondisi jaringan distribusi air — tanyakan tentang status logger, battery, site aktif, atau data sensor terbaru.",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && !minimized) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open, minimized]);

  useEffect(() => {
    if (open && !minimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, minimized]);

  async function sendMessage(content: string) {
    if (!content.trim() || loading) return;

    const userMsg: Message = {
      role: "user",
      content,
    };

    const newMessages = [...messages, userMsg];

    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: newMessages,
        }),
      });

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            data.reply ||
            "Maaf, saya tidak mendapatkan respons dari server.",
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Maaf, terjadi kesalahan saat menghubungi server. Coba lagi.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all hover:scale-105"
          style={{
            background: "var(--accent)",
            color: "#fff",
          }}
        >
          <MessageCircle size={18} />
          <span className="text-sm font-medium">Tanya SIMDA</span>
        </button>
      )}

      {/* Chat Window */}
      {open && (
        <div
          className="fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl overflow-hidden"
          style={{
            width: 380,
            height: minimized ? "auto" : 520,
            background: "var(--card-bg)",
            border: "1px solid var(--border-accent)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{
              background: "var(--accent)",
              cursor: "pointer",
            }}
            onClick={() => setMinimized((m) => !m)}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{
                  background: "rgba(255,255,255,0.2)",
                }}
              >
                <Bot size={14} className="text-white" />
              </div>

              <div>
                <div className="text-sm font-semibold text-white">
                  Asisten SIMDA
                </div>

                <div className="text-xs text-white opacity-70">
                  {loading ? "Mengetik..." : "Online"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMinimized((m) => !m);
                }}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-all"
              >
                <Minimize2 size={14} className="text-white" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                }}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-all"
              >
                <X size={14} className="text-white" />
              </button>
            </div>
          </div>

          {!minimized && (
            <>
              {/* Messages */}
              <div
                className="flex-1 overflow-y-auto p-4 flex flex-col gap-3"
                style={{
                  background: "var(--bg-primary)",
                }}
              >
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex gap-2 ${
                      msg.role === "user"
                        ? "flex-row-reverse"
                        : "flex-row"
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
                      style={{
                        background:
                          msg.role === "assistant"
                            ? "var(--accent-bg)"
                            : "rgba(34,197,94,0.15)",
                      }}
                    >
                      {msg.role === "assistant" ? (
                        <Bot
                          size={12}
                          style={{
                            color: "var(--accent)",
                          }}
                        />
                      ) : (
                        <User
                          size={12}
                          style={{
                            color: "#22c55e",
                          }}
                        />
                      )}
                    </div>

                    {/* Bubble */}
                    <div
                      className="max-w-[80%] px-3 py-2 rounded-2xl text-xs leading-relaxed"
                      style={{
                        background:
                          msg.role === "assistant"
                            ? "var(--card-bg)"
                            : "var(--accent)",

                        color:
                          msg.role === "assistant"
                            ? "var(--text-primary)"
                            : "#fff",

                        border:
                          msg.role === "assistant"
                            ? "1px solid var(--border-color)"
                            : "none",

                        borderRadius:
                          msg.role === "assistant"
                            ? "4px 16px 16px 16px"
                            : "16px 4px 16px 16px",

                        overflowWrap: "anywhere",
                      }}
                    >
                      {msg.role === "assistant" ? (
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => (
                              <p className="mb-2 last:mb-0">
                                {children}
                              </p>
                            ),

                            strong: ({ children }) => (
                              <strong className="font-semibold">
                                {children}
                              </strong>
                            ),

                            ul: ({ children }) => (
                              <ul className="list-disc pl-4 mb-2 space-y-1">
                                {children}
                              </ul>
                            ),

                            ol: ({ children }) => (
                              <ol className="list-decimal pl-4 mb-2 space-y-1">
                                {children}
                              </ol>
                            ),

                            li: ({ children }) => (
                              <li>{children}</li>
                            ),

                            code: ({ children }) => (
                              <code className="px-1 py-0.5 rounded bg-black/10">
                                {children}
                              </code>
                            ),
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      ) : (
                        msg.content.split("\n").map((line, j) => (
                          <span key={j}>
                            {line}
                            {j <
                              msg.content.split("\n").length - 1 && (
                              <br />
                            )}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                ))}

                {/* Loading indicator */}
                {loading && (
                  <div className="flex gap-2">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        background: "var(--accent-bg)",
                      }}
                    >
                      <Bot
                        size={12}
                        style={{
                          color: "var(--accent)",
                        }}
                      />
                    </div>

                    <div
                      className="px-3 py-2 rounded-2xl flex items-center gap-1.5"
                      style={{
                        background: "var(--card-bg)",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      <Loader2
                        size={12}
                        className="animate-spin"
                        style={{
                          color: "var(--accent)",
                        }}
                      />

                      <span
                        className="text-xs"
                        style={{
                          color: "var(--text-muted)",
                        }}
                      >
                        Menganalisis data...
                      </span>
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              {/* Suggestions */}
              {messages.length === 1 && (
                <div
                  className="px-4 pb-2 flex flex-wrap gap-1.5 flex-shrink-0"
                  style={{
                    background: "var(--bg-primary)",
                  }}
                >
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(s)}
                      className="text-xs px-2.5 py-1.5 rounded-full transition-all"
                      style={{
                        background: "var(--card-bg)",
                        color: "var(--text-secondary)",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div
                className="px-3 py-3 flex items-center gap-2 flex-shrink-0"
                style={{
                  borderTop: "1px solid var(--border-color)",
                  background: "var(--card-bg)",
                }}
              >
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Tanya sesuatu tentang jaringan..."
                  className="flex-1 text-sm outline-none bg-transparent"
                  style={{
                    color: "var(--text-primary)",
                  }}
                  disabled={loading}
                />

                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || loading}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all flex-shrink-0"
                  style={{
                    background:
                      input.trim() && !loading
                        ? "var(--accent)"
                        : "var(--border-color)",

                    color:
                      input.trim() && !loading
                        ? "#fff"
                        : "var(--text-muted)",
                  }}
                >
                  <Send size={13} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}