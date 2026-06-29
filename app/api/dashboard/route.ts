import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

const sql = neon(process.env.DATABASE_URL!);

export async function GET() {
  const [totalSites] = await sql`SELECT COUNT(*) as count FROM sites`;

  const [onlineLoggers] = await sql`
    SELECT COUNT(*) as count FROM loggers 
    WHERE last_call_in > NOW() - INTERVAL '30 days'
  `;

  const [offlineLoggers] = await sql`
    SELECT COUNT(*) as count FROM loggers 
    WHERE last_call_in <= NOW() - INTERVAL '30 days' OR last_call_in IS NULL
  `;

  const [lowBattery] = await sql`
    SELECT COUNT(*) as count FROM loggers 
    WHERE battery_level < 20 AND battery_level IS NOT NULL
  `;

  const recentSites = await sql`
    SELECT s.id, s.site_id, s.address, s.logger_id,
           l.battery_level, l.signal_level, l.last_call_in
    FROM sites s
    LEFT JOIN loggers l ON s.logger_id = l.id
    ORDER BY l.last_call_in DESC NULLS LAST
    LIMIT 10
  `;

  const trendData = await sql`
    SELECT DATE_TRUNC('hour', data_time) as hour, AVG(value) as avg_value
    FROM datapoints
    WHERE channel_number = 0
    GROUP BY DATE_TRUNC('hour', data_time)
    ORDER BY hour DESC
    LIMIT 24
  `;

  const alerts = await sql`
    SELECT id, battery_level, last_call_in
    FROM loggers
    WHERE battery_level < 20 OR last_call_in < NOW() - INTERVAL '30 days'
    ORDER BY last_call_in ASC NULLS FIRST
    LIMIT 5
  `;

  return NextResponse.json({
    stats: {
      totalSites: Number(totalSites.count),
      onlineLoggers: Number(onlineLoggers.count),
      offlineLoggers: Number(offlineLoggers.count),
      lowBattery: Number(lowBattery.count),
    },
    recentSites,
    trendData: [...trendData].reverse(),
    alerts,
  });
}