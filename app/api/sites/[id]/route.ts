import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [site] = await sql`
    SELECT s.*, l.battery_level, l.signal_level, l.last_call_in,
           l.logger_type, l.logger_network, l.call_frequency, l.is_roaming
    FROM sites s
    LEFT JOIN loggers l ON s.logger_id = l.id
    WHERE s.id = ${parseInt(id)}
  `;

  const datapoints = await sql`
    SELECT data_time, channel_number, value
    FROM datapoints
    WHERE site_id = ${parseInt(id)}
    ORDER BY data_time DESC
    LIMIT 200
  `;

  return NextResponse.json({ site, datapoints });
}