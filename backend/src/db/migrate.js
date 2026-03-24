const fs = require("fs");
const path = require("path");
const db = require("../config/db");

const runMigrations = () => {
  const schemaPath = path.join(__dirname, "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf-8");

  const statements = schema
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const runAll = db.transaction(() => {
    statements.forEach((stmt) => db.exec(stmt + ";"));
  });

  runAll();
  console.log("[DB] Migrations complete — all tables created.");
};

runMigrations();
