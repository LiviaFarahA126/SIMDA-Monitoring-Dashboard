import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

const sql = neon(process.env.DATABASE_URL!);

export async function GET() {
  const sites = await sql`
    SELECT s.id, s.site_id, s.address, s.lat_east, s.long_north,
           s.start_date, s.end_date, s.pipe_size,
           l.battery_level, l.signal_level, l.last_call_in,
           l.logger_type, l.logger_network, l.id as logger_id
    FROM sites s
    LEFT JOIN loggers l ON s.logger_id = l.id
    ORDER BY l.last_call_in DESC NULLS LAST
  `;
  return NextResponse.json({ sites });
}