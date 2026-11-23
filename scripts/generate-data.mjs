/**
 * SIMDA — Synthetic Data Generator
 * Generates realistic datapoints for all active sites
 * Run manually: node scripts/generate-data.mjs
 * Run continuously: node scripts/generate-data.mjs --watch
 */

import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL);
const isWatch = process.argv.includes("--watch");
const INTERVAL_MINUTES = 15; // generate data every 15 minutes

// ── Realistic flow pattern based on hour of day ───────────────────────────────
// Pola konsumsi air: tinggi pagi & sore, rendah malam
function flowMultiplier(hour) {
  const pattern = {
    0: 0.35, 1: 0.30, 2: 0.28, 3: 0.27, 4: 0.30,
    5: 0.45, 6: 0.85, 7: 1.20, 8: 1.10, 9: 0.95,
    10: 0.90, 11: 0.88, 12: 0.92, 13: 0.85, 14: 0.80,
    15: 0.82, 16: 0.90, 17: 1.15, 18: 1.20, 19: 1.05,
    20: 0.88, 21: 0.75, 22: 0.60, 23: 0.45,
  };
  return pattern[hour] ?? 0.7;
}

// ── Realistic pressure pattern (inverse of flow) ──────────────────────────────
function pressureMultiplier(hour) {
  // Pressure turun saat flow tinggi (hukum Bernoulli)
  return 1.0 + (1.0 - flowMultiplier(hour)) * 0.15;
}

// ── Add realistic noise ───────────────────────────────────────────────────────
function addNoise(value, noisePercent = 0.05) {
  const noise = (Math.random() - 0.5) * 2 * noisePercent * value;
  return Math.max(0, value + noise);
}

// ── Occasionally generate anomaly (2% chance) ────────────────────────────────
function maybeAnomaly(value, channel) {
  if (Math.random() < 0.02) {
    const spike = Math.random() < 0.5;
    const factor = spike ? (3 + Math.random() * 2) : 0.1;
    console.log(`  ⚠️  Anomaly injected on channel ${channel}: ${(value * factor).toFixed(2)}`);
    return value * factor;
  }
  return value;
}

// ── Generate data for all sites ───────────────────────────────────────────────
async function generateData() {
  const now = new Date();
  const hour = now.getHours();
  console.log(`\n🔄 Generating data at ${now.toLocaleString("id-ID")} (hour: ${hour})`);

  // Get all sites with their baseline stats
  const siteStats = await sql`
    SELECT
      s.id as site_id,
      s.site_id as site_code,
      AVG(CASE WHEN d.channel_number = 0 THEN d.value END) as avg_flow,
      AVG(CASE WHEN d.channel_number = 1 THEN d.value END) as avg_pressure,
      STDDEV(CASE WHEN d.channel_number = 0 THEN d.value END) as std_flow,
      STDDEV(CASE WHEN d.channel_number = 1 THEN d.value END) as std_pressure
    FROM sites s
    LEFT JOIN datapoints d ON d.site_id = s.id
    GROUP BY s.id, s.site_id
    HAVING COUNT(d.id) > 0
    ORDER BY s.id
  `;

  if (siteStats.length === 0) {
    console.log("No sites with existing data found.");
    return;
  }

  let insertedCount = 0;
  const errors = [];

  for (const site of siteStats) {
    try {
      // Baseline values from historical data
      const baseFlow = parseFloat(site.avg_flow) || 20;
      const basePressure = parseFloat(site.avg_pressure) || 2.5;

      // Channel 0 — Flow
      const flowValue = maybeAnomaly(
        addNoise(baseFlow * flowMultiplier(hour), 0.08),
        0
      );

      // Channel 1 — Pressure (only if site has pressure data)
      if (site.avg_pressure) {
        const pressureValue = maybeAnomaly(
          addNoise(basePressure * pressureMultiplier(hour), 0.04),
          1
        );

        await sql`
          INSERT INTO datapoints (site_id, data_time, channel_number, value)
          VALUES (
            ${site.site_id},
            ${now.toISOString()},
            1,
            ${parseFloat(pressureValue.toFixed(3))}
          )
        `;
        insertedCount++;
      }

      await sql`
        INSERT INTO datapoints (site_id, data_time, channel_number, value)
        VALUES (
          ${site.site_id},
          ${now.toISOString()},
          0,
          ${parseFloat(flowValue.toFixed(3))}
        )
      `;
      insertedCount++;

    } catch (err) {
      errors.push(`Site ${site.site_code}: ${err.message}`);
    }
  }

  // Update battery levels slightly (simulate drain)
  await sql`
    UPDATE loggers
    SET battery_level = GREATEST(0, battery_level - (RANDOM() * 0.05))
    WHERE battery_level IS NOT NULL AND battery_level > 0
  `;

  // Update last_call_in for active loggers
  await sql`
    UPDATE loggers l
    SET last_call_in = ${now.toISOString()}
    FROM sites s
    WHERE s.logger_id = l.id
      AND l.battery_level > 10
  `;

  console.log(`✅ Inserted ${insertedCount} datapoints for ${siteStats.length} sites`);
  if (errors.length > 0) {
    console.log(`⚠️  ${errors.length} errors:`, errors.slice(0, 3));
  }

  return insertedCount;
}

// ── Backfill missing data (last 24 hours) ────────────────────────────────────
async function backfill() {
  console.log("\n📅 Backfilling last 24 hours of data...");

  const now = new Date();
  const siteStats = await sql`
    SELECT
      s.id as site_id,
      AVG(CASE WHEN d.channel_number = 0 THEN d.value END) as avg_flow,
      AVG(CASE WHEN d.channel_number = 1 THEN d.value END) as avg_pressure
    FROM sites s
    LEFT JOIN datapoints d ON d.site_id = s.id
    GROUP BY s.id
    HAVING COUNT(d.id) > 0
  `;

  let total = 0;

  // Generate data for each 15-minute interval in the past 24 hours
  for (let minutesAgo = 24 * 60; minutesAgo >= 15; minutesAgo -= 15) {
    const timestamp = new Date(now.getTime() - minutesAgo * 60 * 1000);
    const hour = timestamp.getHours();

    // Check if data already exists around this time
    const [existing] = await sql`
      SELECT COUNT(*) as count FROM datapoints
      WHERE data_time BETWEEN ${new Date(timestamp.getTime() - 7 * 60 * 1000).toISOString()}
        AND ${new Date(timestamp.getTime() + 7 * 60 * 1000).toISOString()}
    `;

    if (parseInt(existing.count) > 0) continue; // skip if data exists

    for (const site of siteStats) {
      const baseFlow = parseFloat(site.avg_flow) || 20;
      const basePressure = parseFloat(site.avg_pressure) || 2.5;

      await sql`
        INSERT INTO datapoints (site_id, data_time, channel_number, value)
        VALUES (
          ${site.site_id},
          ${timestamp.toISOString()},
          0,
          ${parseFloat(addNoise(baseFlow * flowMultiplier(hour), 0.08).toFixed(3))}
        )
      `;
      total++;

      if (site.avg_pressure) {
        await sql`
          INSERT INTO datapoints (site_id, data_time, channel_number, value)
          VALUES (
            ${site.site_id},
            ${timestamp.toISOString()},
            1,
            ${parseFloat(addNoise(basePressure * pressureMultiplier(hour), 0.04).toFixed(3))}
          )
        `;
        total++;
      }
    }

    process.stdout.write(`\r  Progress: ${Math.round((1 - minutesAgo / (24 * 60)) * 100)}%`);
  }

  console.log(`\n✅ Backfill complete: ${total} datapoints inserted`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🚀 SIMDA Synthetic Data Generator");
  console.log("==================================");

  if (isWatch) {
    console.log(`📡 Watch mode: generating data every ${INTERVAL_MINUTES} minutes`);
    console.log("Press Ctrl+C to stop\n");

    // Backfill first
    await backfill();

    // Then generate continuously
    await generateData();
    setInterval(generateData, INTERVAL_MINUTES * 60 * 1000);
  } else {
    // Check args for backfill
    if (process.argv.includes("--backfill")) {
      await backfill();
    } else {
      await generateData();
    }
    process.exit(0);
  }
}

main().catch(err => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
