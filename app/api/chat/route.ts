import Groq from "groq-sdk";
import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const sql = neon(process.env.DATABASE_URL!);

export async function POST(req: Request) {
  const { messages } = await req.json();

  // ==========================================
  // AMBIL KONTEKS DATA DARI NEON
  // ==========================================

  const [totalSites] = await sql`
    SELECT COUNT(*) as count
    FROM sites
  `;

  const [totalLoggers] = await sql`
    SELECT COUNT(*) as count
    FROM loggers
  `;

  const [totalDatapoints] = await sql`
    SELECT COUNT(*) as count
    FROM datapoints
  `;

  // ==========================================
  // LOGGER DENGAN BATTERY KRITIS
  // ==========================================

  const lowBattery = await sql`
    SELECT
      l.id,
      l.battery_level,
      l.last_call_in,
      s.site_id,
      s.address
    FROM loggers l
    LEFT JOIN sites s ON s.logger_id = l.id
    WHERE l.battery_level < 20
      AND l.battery_level IS NOT NULL
    ORDER BY l.battery_level ASC
    LIMIT 10
  `;

  // ==========================================
  // LOGGER OFFLINE
  // ==========================================

  const offlineLoggers = await sql`
    SELECT
      l.id,
      l.last_call_in,
      l.logger_type,
      s.site_id,
      s.address
    FROM loggers l
    LEFT JOIN sites s ON s.logger_id = l.id
    WHERE
      l.last_call_in < NOW() - INTERVAL '30 days'
      OR l.last_call_in IS NULL
    ORDER BY l.last_call_in ASC NULLS FIRST
    LIMIT 10
  `;

  // ==========================================
  // DATA SENSOR TERBARU
  // ==========================================

  const recentData = await sql`
    SELECT
      s.site_id,
      s.address,
      d.data_time,
      d.channel_number,
      d.value
    FROM datapoints d
    JOIN sites s ON s.id = d.site_id
    ORDER BY d.data_time DESC
    LIMIT 20
  `;

  // ==========================================
  // SITE TERAKHIR AKTIF
  // ==========================================

  const topSites = await sql`
    SELECT
      s.site_id,
      s.address,
      l.battery_level,
      l.signal_level,
      l.last_call_in
    FROM sites s
    LEFT JOIN loggers l ON s.logger_id = l.id
    ORDER BY l.last_call_in DESC NULLS LAST
    LIMIT 10
  `;

  // ==========================================
  // SYSTEM PROMPT
  // ==========================================

  const systemPrompt = `
Kamu adalah asisten AI untuk sistem SIMDA
(Sistem Informasi Monitoring Distribusi Air)
milik Perumda Tirta Manuntung Balikpapan.

Tugasmu adalah membantu operator dan teknisi memahami
kondisi jaringan distribusi air berdasarkan data yang tersedia.

GAYA JAWABAN:
- Gunakan Bahasa Indonesia yang natural, jelas, singkat, dan profesional.
- Jawaban harus mudah dibaca di dalam chat bubble dengan lebar terbatas.
- Jangan membuat tabel Markdown.
- JANGAN menggunakan karakter "|" untuk membuat tabel.
- Jika pengguna meminta "tabel", "buatkan tabel", "list dalam bentuk tabel",
  atau permintaan sejenis, gunakan daftar bernomor yang rapi sebagai gantinya.
- Gunakan format seperti:

  1. **Nama/ID Site**
     - Address: ...
     - Battery: ...
     - Signal: ...
     - Last Call: ...

  2. **Nama/ID Site**
     - Address: ...
     - Battery: ...
     - Signal: ...
     - Last Call: ...

- Gunakan bullet point (-) untuk informasi tambahan.
- Gunakan **bold** hanya untuk informasi yang penting.
- Jangan menggunakan heading Markdown seperti # atau ##.
- Hindari paragraf yang terlalu panjang.
- Pisahkan setiap data agar mudah dibaca.
- Jika data terlalu banyak, tampilkan maksimal 10 data yang paling relevan.
- Jangan mengarang informasi yang tidak tersedia di data.
- Jangan menebak atau membuat nilai yang tidak ada.
- Jika suatu informasi tidak tersedia, tulis "N/A" atau "tidak tersedia".

ATURAN ID:
- Logger ID dan Site ID adalah dua hal yang berbeda.
- Jika menyebut logger, gunakan format "Logger #ID".
- Jika menyebut site, gunakan nilai "Site ID".
- JANGAN pernah menganggap nomor Site ID sebagai Logger ID.
- JANGAN pernah menyimpulkan Logger ID hanya dari Site ID.
- Gunakan data yang tersedia secara langsung.

ATURAN DATA:
- "Total Sites" adalah jumlah seluruh site di database.
- "Total Loggers" adalah jumlah seluruh logger di database.
- "Total Datapoints" adalah jumlah seluruh datapoint di database.
- Bagian "10 Site Terakhir Aktif" hanya berisi maksimal 10 site,
  bukan seluruh site yang ada di database.
- Bagian "20 Data Terbaru" hanya berisi 20 datapoint terbaru.
- Jika pengguna meminta "semua site", jangan mengatakan bahwa data
  yang diberikan adalah semua site. Jelaskan bahwa konteks saat ini
  hanya menyediakan 10 site terakhir aktif.

DATA JARINGAN SAAT INI
======================

Total Sites:
${totalSites.count}

Total Loggers:
${totalLoggers.count}

Total Datapoints:
${totalDatapoints.count}


LOGGER BATTERY KRITIS (< 20%)
=============================

${
  lowBattery.length === 0
    ? "Tidak ada logger dengan battery di bawah 20%."
    : lowBattery
        .map(
          (l) =>
            `• Logger #${l.id}
  Battery: ${l.battery_level}%
  Site ID: ${l.site_id ?? "N/A"}
  Address: ${l.address ?? "N/A"}`
        )
        .join("\n\n")
}


LOGGER OFFLINE (> 30 HARI TIDAK AKTIF)
======================================

${
  offlineLoggers.length === 0
    ? "Tidak ada logger yang terdeteksi offline."
    : offlineLoggers
        .map(
          (l) =>
            `• Logger #${l.id}
  Tipe: ${l.logger_type ?? "N/A"}
  Site ID: ${l.site_id ?? "N/A"}
  Address: ${l.address ?? "N/A"}
  Last Call: ${
    l.last_call_in
      ? new Date(l.last_call_in).toLocaleDateString("id-ID")
      : "Tidak pernah"
  }`
        )
        .join("\n\n")
}


20 DATA SENSOR TERBARU
======================

${
  recentData.length === 0
    ? "Tidak ada data sensor terbaru."
    : recentData
        .map(
          (d) =>
            `• Site ID: ${d.site_id}
  Address: ${d.address ?? "N/A"}
  Channel: ${d.channel_number}
  Value: ${d.value}
  Waktu: ${new Date(d.data_time).toLocaleString("id-ID")}`
        )
        .join("\n\n")
}


10 SITE TERAKHIR AKTIF
======================

${
  topSites.length === 0
    ? "Tidak ada data site."
    : topSites
        .map(
          (s) =>
            `• Site ID: ${s.site_id}
  Address: ${s.address ?? "N/A"}
  Battery: ${s.battery_level ?? "N/A"}%
  Signal: ${s.signal_level ?? "N/A"} dBm
  Last Call: ${
    s.last_call_in
      ? new Date(s.last_call_in).toLocaleDateString("id-ID")
      : "N/A"
  }`
        )
        .join("\n\n")
}


ATURAN TAMBAHAN:
- Fokus menjawab pertanyaan pengguna berdasarkan data di atas.
- Jika pengguna bertanya tentang battery kritis, gunakan bagian Logger Battery Kritis.
- Jika pengguna bertanya tentang logger offline, gunakan bagian Logger Offline.
- Jika pengguna bertanya tentang data terbaru, gunakan bagian 20 Data Sensor Terbaru.
- Jika pengguna bertanya tentang site terakhir aktif, gunakan bagian 10 Site Terakhir Aktif.
- Jika pengguna meminta daftar site dalam bentuk tabel, tetap gunakan format daftar bernomor, BUKAN tabel Markdown.
- Jangan menggabungkan data dari beberapa bagian jika hal tersebut dapat menyebabkan
  ID, site, logger, atau nilai menjadi tertukar.
- Jangan membuat kolom atau informasi baru yang tidak tersedia.
`;

  // ==========================================
  // REQUEST KE GROQ
  // ==========================================

  const completion = await groq.chat.completions.create({
    model: "openai/gpt-oss-120b",
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      ...messages,
    ],
    max_tokens: 1024,
    temperature: 0.3,
  });

  const reply = completion.choices[0].message.content;

  return NextResponse.json({ reply });
}