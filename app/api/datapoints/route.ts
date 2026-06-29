import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get("siteId");
  const channel = searchParams.get("channel");
  const limit = parseInt(searchParams.get("limit") ?? "500");

  const sites = await sql`
    SELECT id, site_id, address FROM sites ORDER BY site_id ASC
  `;

  let datapoints: any[] = [];
  let channels: number[] = [];

  if (siteId) {
    channels = (await sql`
      SELECT DISTINCT channel_number FROM datapoints
      WHERE site_id = ${parseInt(siteId)}
      ORDER BY channel_number ASC
    `).map((r: any) => r.channel_number);

    datapoints = await sql`
      SELECT data_time, channel_number, value
      FROM datapoints
      WHERE site_id = ${parseInt(siteId)}
        ${channel !== null ? sql`AND channel_number = ${parseInt(channel)}` : sql``}
      ORDER BY data_time DESC
      LIMIT ${limit}
    `;
  }

  return NextResponse.json({ sites, datapoints, channels });
}