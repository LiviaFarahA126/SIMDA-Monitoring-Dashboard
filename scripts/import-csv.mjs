import { neon } from "@neondatabase/serverless";
import { createReadStream } from "fs";
import { parse } from "csv-parse";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = neon(process.env.DATABASE_URL);

function val(v) {
  if (v === "" || v === "NULL" || v === null || v === undefined) return null;
  return v;
}
function numVal(v) {
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}
function intVal(v) {
  const n = parseInt(v);
  return isNaN(n) ? null : n;
}

async function readCSV(filename) {
  return new Promise((resolve2, reject) => {
    const rows = [];
    createReadStream(resolve(__dirname, filename))
      .pipe(parse({ columns: true, skip_empty_lines: true, relax_quotes: true }))
      .on("data", (row) => rows.push(row))
      .on("end", () => resolve2(rows))
      .on("error", reject);
  });
}

async function importSites() {
  console.log("Importing sites...");
  const rows = await readCSV("sites.csv");
  await sql`DROP TABLE IF EXISTS datapoints`;
  await sql`DROP TABLE IF EXISTS sites`;
  await sql`CREATE TABLE sites (id INTEGER PRIMARY KEY, datagate_id INTEGER, owner_account INTEGER, site_id VARCHAR(100), address VARCHAR(255), lat_east REAL, long_north REAL, height_aod REAL, logger_id INTEGER, create_date TIMESTAMP, update_date TIMESTAMP, start_date TIMESTAMP, end_date TIMESTAMP, pipe_size REAL, pipe_material REAL, chamber_type REAL, is_quiet REAL)`;
  for (const r of rows) {
    await sql`INSERT INTO sites (id, datagate_id, owner_account, site_id, address, lat_east, long_north, height_aod, logger_id, create_date, update_date, start_date, end_date, pipe_size, pipe_material, chamber_type, is_quiet) VALUES (${intVal(r.ID)}, ${intVal(r.DatagateID)}, ${intVal(r.OwnerAccount)}, ${val(r.SiteID)}, ${val(r.Address)}, ${numVal(r.LatEast)}, ${numVal(r.LongNorth)}, ${numVal(r.HeightAOD)}, ${intVal(r.LoggerID)}, ${val(r.CreateDate)}, ${val(r.UpdateDate)}, ${val(r.StartDate)}, ${val(r.EndDate)}, ${numVal(r.PipeSize)}, ${numVal(r.PipeMaterial)}, ${numVal(r.ChamberType)}, ${numVal(r.IsQuiet)})`;
  }
  console.log("Sites done: " + rows.length + " rows");
}

async function importLoggers() {
  console.log("Importing loggers...");
  const rows = await readCSV("loggers.csv");
  await sql`DROP TABLE IF EXISTS loggers`;
  await sql`CREATE TABLE loggers (id INTEGER PRIMARY KEY, logger_type VARCHAR(100), logger_software REAL, logger_serial_number REAL, last_call_in TIMESTAMP, signal_level REAL, battery_level REAL, log_rate_ms REAL, logger_network VARCHAR(100), last_message_type VARCHAR(50), call_frequency REAL, is_roaming REAL, utc_offset REAL, external_battery REAL, created_date VARCHAR(50))`;
  for (const r of rows) {
    await sql`INSERT INTO loggers (id, logger_type, logger_software, logger_serial_number, last_call_in, signal_level, battery_level, log_rate_ms, logger_network, last_message_type, call_frequency, is_roaming, utc_offset, external_battery, created_date) VALUES (${intVal(r.ID)}, ${val(r.LoggerType)}, ${numVal(r.LoggerSoftware)}, ${numVal(r.LoggerSerialNumber)}, ${val(r.LastCallIn)}, ${numVal(r.SignalLevel)}, ${numVal(r.BatteryLevel)}, ${numVal(r.LogRateMs)}, ${val(r.LoggerNetwork)}, ${val(r.LastMessageType)}, ${numVal(r.CallFrequency)}, ${numVal(r.IsRoaming)}, ${numVal(r.UTCOffset)}, ${numVal(r.ExternalBattery)}, ${val(r.CreatedDate)})`;
  }
  console.log("Loggers done: " + rows.length + " rows");
}

async function importDatapoints() {
  console.log("Importing datapoints... (this will take a few minutes)");
  const rows = await readCSV("datapoints.csv");
  await sql`DROP TABLE IF EXISTS datapoints`;
  await sql`CREATE TABLE datapoints (id INTEGER PRIMARY KEY, site_id INTEGER REFERENCES sites(id), data_time TIMESTAMP, channel_number INTEGER, value REAL)`;
  await sql`CREATE INDEX idx_datapoints_site_id ON datapoints(site_id)`;
  await sql`CREATE INDEX idx_datapoints_data_time ON datapoints(data_time)`;
  let count = 0;
  for (const r of rows) {
    await sql`INSERT INTO datapoints (id, site_id, data_time, channel_number, value) VALUES (${intVal(r.ID)}, ${intVal(r.SiteID)}, ${val(r.DataTime)}, ${intVal(r.ChannelNumber)}, ${numVal(r.value)})`;
    count++;
    if (count % 500 === 0) console.log(count + " / " + rows.length + " rows...");
  }
  console.log("Datapoints done: " + count + " rows");
}

async function main() {
  try {
    console.log("Starting import...");
    await importSites();
    await importLoggers();
    await importDatapoints();
    console.log("All done!");
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

main();