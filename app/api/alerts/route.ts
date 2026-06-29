import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

const sql = neon(process.env.DATABASE_URL!);

export async function GET() {
  // 1. Battery kritis
  const batteryAlerts = await sql`
    SELECT l.id as logger_id, l.battery_level, l.last_call_in,
           s.site_id, s.address, s.id as site_id_num
    FROM loggers l
    LEFT JOIN sites s ON s.logger_id = l.id
    WHERE l.battery_level < 20 AND l.battery_level IS NOT NULL
    ORDER BY l.battery_level ASC
  `;

  // 2. Logger offline lama (> 30 hari)
  const offlineAlerts = await sql`
    SELECT l.id as logger_id, l.battery_level, l.last_call_in,
           l.logger_type, s.site_id, s.address, s.id as site_id_num
    FROM loggers l
    LEFT JOIN sites s ON s.logger_id = l.id
    WHERE l.last_call_in < NOW() - INTERVAL '30 days'
       OR l.last_call_in IS NULL
    ORDER BY l.last_call_in ASC NULLS FIRST
    LIMIT 20
  `;

  // 3. Data gap (site yang tidak punya data dalam 7 hari terakhir dari data terbaru)
  const latestDate = await sql`SELECT MAX(data_time) as max_time FROM datapoints`;
  const maxTime = latestDate[0]?.max_time ?? new Date();

  const dataGapAlerts = await sql`
    SELECT s.id as site_id_num, s.site_id, s.address,
           MAX(d.data_time) as last_data_time
    FROM sites s
    LEFT JOIN datapoints d ON d.site_id = s.id
    GROUP BY s.id, s.site_id, s.address
    HAVING MAX(d.data_time) < ${maxTime}::timestamp - INTERVAL '7 days'
        OR MAX(d.data_time) IS NULL
    ORDER BY last_data_time ASC NULLS FIRST
    LIMIT 20
  `;

  // 4. Flow anomaly (nilai channel 0 yang jauh dari rata-rata, per site)
  const flowAnomalies = await sql`
    WITH stats AS (
      SELECT site_id,
             AVG(value) as avg_val,
             STDDEV(value) as std_val
      FROM datapoints
      WHERE channel_number = 0
      GROUP BY site_id
    ),
    recent AS (
      SELECT d.site_id, d.value, d.data_time,
             s.site_id as site_code, si.address
      FROM datapoints d
      JOIN stats s ON d.site_id = s.site_id
      JOIN sites si ON si.id = d.site_id
      WHERE d.channel_number = 0
        AND ABS(d.value - s.avg_val) > 3 * s.std_val
        AND s.std_val > 0
      ORDER BY d.data_time DESC
    )
    SELECT DISTINCT ON (site_id) *
    FROM recent
    LIMIT 15
  `;

  // 5. Pressure anomaly (channel 1)
  const pressureAnomalies = await sql`
    WITH stats AS (
      SELECT site_id,
             AVG(value) as avg_val,
             STDDEV(value) as std_val
      FROM datapoints
      WHERE channel_number = 1
      GROUP BY site_id
    ),
    recent AS (
      SELECT d.site_id, d.value, d.data_time,
             s.site_id as site_code, si.address
      FROM datapoints d
      JOIN stats s ON d.site_id = s.site_id
      JOIN sites si ON si.id = d.site_id
      WHERE d.channel_number = 1
        AND ABS(d.value - s.avg_val) > 3 * s.std_val
        AND s.std_val > 0
      ORDER BY d.data_time DESC
    )
    SELECT DISTINCT ON (site_id) *
    FROM recent
    LIMIT 15
  `;

  return NextResponse.json({
    batteryAlerts,
    offlineAlerts,
    dataGapAlerts,
    flowAnomalies,
    pressureAnomalies,
    summary: {
      battery: batteryAlerts.length,
      offline: offlineAlerts.length,
      dataGap: dataGapAlerts.length,
      flowAnomaly: flowAnomalies.length,
      pressureAnomaly: pressureAnomalies.length,
    }
  });
}