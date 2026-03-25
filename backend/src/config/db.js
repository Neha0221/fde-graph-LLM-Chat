const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const { DB_PATH: DB_PATH_ENV } = require("./env");
const DB_PATH = path.isAbsolute(DB_PATH_ENV)
  ? DB_PATH_ENV
  : path.resolve(__dirname, "../../", DB_PATH_ENV);

// ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// enable WAL mode for better performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

console.log(`[DB] Connected to SQLite at ${DB_PATH}`);

module.exports = db;
