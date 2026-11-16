const fs = require("fs");
const path = require("path");

const SQLITE_PATH = process.env.SQLITE_PATH || path.join(__dirname, "data", "local.db");

let driver = null; // "pg" | "sqlite"
let pool = null;
let sqlite = null;

function isPostgresUrl(url) {
  if (!url) return false;
  return /^postgres(ql)?:\/\//i.test(url);
}

async function init() {
  const url = process.env.DATABASE_URL;
  if (isPostgresUrl(url)) {
    const { Pool } = require("pg");
    pool = new Pool({
      connectionString: url,
      ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false }
    });
    driver = "pg";
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT NOT NULL,
        address TEXT NOT NULL,
        city TEXT NOT NULL,
        zip TEXT NOT NULL,
        issue_type TEXT NOT NULL,
        urgency TEXT NOT NULL,
        landing_city TEXT,
        consent_given INTEGER NOT NULL,
        consent_text TEXT NOT NULL,
        consent_version TEXT NOT NULL,
        ip TEXT,
        user_agent TEXT,
        status TEXT NOT NULL DEFAULT 'new',
        sold_to_roofer TEXT,
        sale_price TEXT,
        notes TEXT
      )
    `);
    return { driver, storage: "postgres" };
  }

  const { DatabaseSync } = require("node:sqlite");
  fs.mkdirSync(path.dirname(SQLITE_PATH), { recursive: true });
  sqlite = new DatabaseSync(SQLITE_PATH);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      zip TEXT NOT NULL,
      issue_type TEXT NOT NULL,
      urgency TEXT NOT NULL,
      landing_city TEXT,
      consent_given INTEGER NOT NULL,
      consent_text TEXT NOT NULL,
      consent_version TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      sold_to_roofer TEXT,
      sale_price TEXT,
      notes TEXT
    )
  `);
  driver = "sqlite";
  return { driver, storage: SQLITE_PATH };
}

function rowFromPg(r) {
  return r;
}

function allLeads() {
  if (driver === "pg") {
    return pool
      .query("SELECT * FROM leads ORDER BY created_at DESC, id DESC")
      .then((res) => res.rows);
  }
  return Promise.resolve(sqlite.prepare("SELECT * FROM leads ORDER BY created_at DESC, id DESC").all());
}

function getLead(id) {
  if (driver === "pg") {
    return pool.query("SELECT * FROM leads WHERE id = $1", [id]).then((res) => res.rows[0] || null);
  }
  return Promise.resolve(sqlite.prepare("SELECT * FROM leads WHERE id = ?").get(id) || null);
}

function insertLead(lead) {
  const cols = [
    "name",
    "phone",
    "email",
    "address",
    "city",
    "zip",
    "issue_type",
    "urgency",
    "landing_city",
    "consent_given",
    "consent_text",
    "consent_version",
    "ip",
    "user_agent"
  ];
  if (driver === "pg") {
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
    const sql = `INSERT INTO leads (${cols.join(", ")}) VALUES (${placeholders}) RETURNING *`;
    const values = cols.map((c) => lead[c]);
    return pool.query(sql, values).then((res) => res.rows[0]);
  }
  const placeholders = cols.map(() => "?").join(", ");
  const sql = `INSERT INTO leads (${cols.join(", ")}) VALUES (${placeholders})`;
  const info = sqlite.prepare(sql).run(...cols.map((c) => lead[c]));
  return getLead(info.lastInsertRowid);
}

function updateLeadSale(id, fields) {
  const allowed = ["status", "sold_to_roofer", "sale_price", "notes"];
  const sets = [];
  const values = [];
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      sets.push(driver === "pg" ? `${key} = $${sets.length + 1}` : `${key} = ?`);
      values.push(fields[key]);
    }
  }
  if (!sets.length) return getLead(id);
  if (driver === "pg") {
    values.push(id);
    const sql = `UPDATE leads SET ${sets.join(", ")} WHERE id = $${values.length} RETURNING *`;
    return pool.query(sql, values).then((res) => res.rows[0] || null);
  }
  sqlite.prepare(`UPDATE leads SET ${sets.join(", ")} WHERE id = ?`).run(...values, id);
  return getLead(id);
}

module.exports = {
  init,
  allLeads,
  getLead,
  insertLead,
  updateLeadSale,
  storageInfo() {
    return { driver, sqlitePath: driver === "sqlite" ? SQLITE_PATH : null };
  }
};
