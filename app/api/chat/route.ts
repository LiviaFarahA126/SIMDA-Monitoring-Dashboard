import Groq from "groq-sdk";
import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const sql = neon(process.env.DATABASE_URL!);

export async function POST(req: Request) {
  const { messages } = await req.json();
  const userMessage = messages[messages.length - 1].content;

  // Ambil konteks data dari Neon
  const [totalSites] = await sql`SELECT COUNT(*) as count FROM sites`;
  const [totalLoggers] = await sql`SELECT COUNT(*) as count FROM loggers`;
  const [totalDatapoints] = await sql`SELECT COUNT(*) as count FROM datapoints`;

  const lowBattery = await sql`
    SELECT l.id, l.battery_level, l.last_call_in, s.site_id, s.address
    FROM loggers l
    LEFT JOIN sites s ON s.logger_id = l.id
    WHERE l.battery_level < 20 AND l.battery_level IS NOT NULL
    ORDER BY l.battery_level ASC
    LIMIT 10
  `;

  const offlineLoggers = await sql`
    SELECT l.id, l.last_call_in, l.logger_type, s.site_id, s.address
    FROM loggers l
    LEFT JOIN sites s ON s.logger_id = l.id
    WHERE l.last_call_in < NOW() - INTERVAL '30 days' OR l.last_call_in IS NULL
    ORDER BY l.last_call_in ASC NULLS FIRST
    LIMIT 10
  `;

  const recentData = await sql`
    SELECT s.site_id, s.address, d.data_time, d.channel_number, d.value
    FROM datapoints d
    JOIN sites s ON s.id = d.site_id
    ORDER BY d.data_time DESC
    LIMIT 20
  `;

  const topSites = await sql`
    SELECT s.site_id, s.address, l.battery_level, l.signal_level, l.last_call_in
    FROM sites s
    LEFT JOIN loggers l ON s.logger_id = l.id
    ORDER BY l.last_call_in DESC NULLS LAST
    LIMIT 10
  `;

  const systemPrompt = `
Kamu adalah asisten AI untuk sistem SIMDA (Sistem Informasi Monitoring Distribusi Air) milik Perumda Tirta Manuntung Balikpapan.
Tugasmu adalah menjawab pertanyaan operator dan teknisi tentang kondisi jaringan distribusi air berdasarkan data real-time berikut.

Jawab dalam Bahasa Indonesia, singkat dan informatif. Gunakan angka spesifik dari data. Jangan mengarang data yang tidak ada.

=== DATA JARINGAN SAAT INI ===

Total Sites: ${totalSites.count}
Total Loggers: ${totalLoggers.count}  
Total Datapoints: ${totalDatapoints.count}

--- Logger Battery Kritis (< 20%) ---
${lowBattery.length === 0 ? "Tidak ada" : lowBattery.map(l =>
  `• Logger #${l.id} | Battery: ${l.battery_level}% | Site: ${l.site_id ?? "N/A"} | ${l.address ?? ""}`
).join("\n")}

--- Logger Offline (> 30 hari tidak aktif) ---
${offlineLoggers.length === 0 ? "Tidak ada" : offlineLoggers.map(l =>
  `• Logger #${l.id} | Tipe: ${l.logger_type ?? "N/A"} | Site: ${l.site_id ?? "N/A"} | Last call: ${l.last_call_in ? new Date(l.last_call_in).toLocaleDateString("id-ID") : "Tidak pernah"}`
).join("\n")}

--- 20 Data Terbaru ---
${recentData.map(d =>
  `• ${d.site_id} | Channel ${d.channel_number}: ${d.value} | ${new Date(d.data_time).toLocaleString("id-ID")}`
).join("\n")}

--- 10 Site Terakhir Aktif ---
${topSites.map(s =>
  `• ${s.site_id} | ${s.address} | Battery: ${s.battery_level ?? "N/A"}% | Signal: ${s.signal_level ?? "N/A"} dBm | Last call: ${s.last_call_in ? new Date(s.last_call_in).toLocaleDateString("id-ID") : "N/A"}`
).join("\n")}
`;

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
    max_tokens: 1024,
    temperature: 0.3,
  });

  const reply = completion.choices[0].message.content;
  return NextResponse.json({ reply });
}