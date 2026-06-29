import { pgTable, serial, integer, varchar, timestamp, real } from "drizzle-orm/pg-core";

export const sites = pgTable("sites", {
  id: serial("id").primaryKey(),
  datagateId: integer("datagate_id"),
  ownerAccount: integer("owner_account"),
  siteId: varchar("site_id", { length: 100 }),
  address: varchar("address", { length: 255 }),
  latEast: real("lat_east"),
  longNorth: real("long_north"),
  heightAod: real("height_aod"),
  loggerId: integer("logger_id"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  pipeSize: real("pipe_size"),
  pipeMaterial: real("pipe_material"),
});

export const loggers = pgTable("loggers", {
  id: serial("id").primaryKey(),
  loggerType: varchar("logger_type", { length: 100 }),
  loggerSerialNumber: real("logger_serial_number"),
  lastCallIn: timestamp("last_call_in"),
  signalLevel: real("signal_level"),
  batteryLevel: real("battery_level"),
  loggerNetwork: varchar("logger_network", { length: 100 }),
  callFrequency: real("call_frequency"),
  isRoaming: real("is_roaming"),
  utcOffset: real("utc_offset"),
});

export const datapoints = pgTable("datapoints", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id"),
  dataTime: timestamp("data_time"),
  channelNumber: integer("channel_number"),
  value: real("value"),
});