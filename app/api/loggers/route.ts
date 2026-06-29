import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

const sql = neon(process.env.DATABASE_URL!);

export async function GET() {
  const loggers = await sql`
    SELECT l.*, s.site_id, s.address
    FROM loggers l
    LEFT JOIN sites s ON s.logger_id = l.id
    ORDER BY l.last_call_in DESC NULLS LAST
  `;
  return NextResponse.json({ loggers });
}