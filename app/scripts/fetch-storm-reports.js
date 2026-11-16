#!/usr/bin/env node
/**
 * Pull NOAA Storm Prediction Center hail/wind reports and flag
 * hits in the Atlanta-Sandy Springs-Roswell, GA MSA.
 *
 * Data sources (official, free):
 *  - Daily storm reports (CSV):
 *    https://www.spc.noaa.gov/climo/reports/today_hail.csv
 *    https://www.spc.noaa.gov/climo/reports/YYMMDD_rpts_hail.csv
 *    Same pattern for wind: today_wind.csv / YYMMDD_rpts_wind.csv
 *  - Annual WCM databases:
 *    https://www.spc.noaa.gov/wcm/data/YYYY_hail.csv
 *    https://www.spc.noaa.gov/wcm/data/YYYY_wind.csv
 *
 * Daily report notes (from the SPC reports page):
 *  - Hail size is in hundredths of an inch (175 = 1.75")
 *  - Wind gusts are in MPH
 *  - A day's page covers 1200 UTC that date through 1159 UTC the next day
 *
 * Usage:
 *   node scripts/fetch-storm-reports.js --today
 *   node scripts/fetch-storm-reports.js --date 2025-04-10 --also-wind
 *   node scripts/fetch-storm-reports.js --wcm 2025
 *   node scripts/fetch-storm-reports.js --yesterday --json
 */
const fs = require("fs");
const path = require("path");
const {
  METRO_ATLANTA_COUNTIES,
  isMetroAtlantaCountyName,
  isMetroAtlantaFips
} = require("../data/counties");

const SPC_BASE = "https://www.spc.noaa.gov/climo/reports";
const WCM_BASE = "https://www.spc.noaa.gov/wcm/data";

function parseArgs(argv) {
  const args = {
    today: false,
    yesterday: false,
    date: null,
    wcm: null,
    alsoWind: true,
    hailOnly: false,
    json: false,
    out: null
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--today") args.today = true;
    else if (a === "--yesterday") args.yesterday = true;
    else if (a === "--date") args.date = argv[++i];
    else if (a === "--wcm") args.wcm = argv[++i];
    else if (a === "--also-wind") args.alsoWind = true;
    else if (a === "--hail-only") args.hailOnly = true;
    else if (a === "--json") args.json = true;
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--help" || a === "-h") args.help = true;
  }
  if (!args.today && !args.yesterday && !args.date && !args.wcm) {
    args.today = true;
  }
  if (args.hailOnly) args.alsoWind = false;
  return args;
}

function yymmddFromIso(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Date must be YYYY-MM-DD, got ${iso}`);
  return `${m[1].slice(2)}${m[2]}${m[3]}`;
}

function yesterdayIso(now = new Date()) {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function todayIso(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  // Daily "raw" files may start with a title line before the header.
  let headerIndex = 0;
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    if (/^Time,/i.test(lines[i]) || /^om,/i.test(lines[i]) || /,County,State,/i.test(lines[i])) {
      headerIndex = i;
      break;
    }
  }
  const headerLine = lines[headerIndex];
  if (!headerLine) return { headers: [], rows: [] };
  const headers = splitCsvLine(headerLine);
  const rows = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // Daily filtered files sometimes include section markers
    if (/^Time,/i.test(line) || /^Filtered /i.test(line) || /^No reports/i.test(line)) continue;
    const cols = splitCsvLine(line);
    if (cols.length < 3) continue;
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] != null ? cols[idx] : "";
    });
    rows.push(row);
  }
  return { headers, rows };
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "atlanta-roof-check-storm-script/1.0 (research; metro Atlanta hail/wind filter)" }
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.text();
}

function pick(row, names) {
  for (const name of names) {
    if (row[name] != null && row[name] !== "") return row[name];
  }
  // case-insensitive fallback
  const keys = Object.keys(row);
  for (const name of names) {
    const hit = keys.find((k) => k.toLowerCase() === name.toLowerCase());
    if (hit && row[hit] !== "") return row[hit];
  }
  return "";
}

function normalizeDaily(row, kind, sourceUrl, label) {
  const state = String(pick(row, ["State", "ST"])).toUpperCase();
  const county = pick(row, ["County"]);
  const sizeOrSpeed = pick(row, ["Size", "Size(1/100in.)", "Speed"]);
  return {
    kind,
    source: "spc-daily",
    source_url: sourceUrl,
    period: label,
    time: pick(row, ["Time"]),
    date: label,
    state,
    county,
    location: pick(row, ["Location"]),
    lat: pick(row, ["Lat", "LAT"]),
    lon: pick(row, ["Lon", "LON"]),
    magnitude: sizeOrSpeed,
    magnitude_note:
      kind === "hail"
        ? "hail size in hundredths of an inch (175 = 1.75 in)"
        : "wind gust in MPH, or UNK",
    comments: pick(row, ["Comments", "Remarks"]),
    metro: state === "GA" && isMetroAtlantaCountyName(county)
  };
}

function normalizeWcm(row, kind, sourceUrl, year) {
  const state = String(pick(row, ["st"])).toUpperCase();
  const fips = Number(pick(row, ["f1"]));
  const county = isMetroAtlantaFips(fips) ? METRO_ATLANTA_COUNTIES[fips] : String(fips || "");
  return {
    kind,
    source: "spc-wcm",
    source_url: sourceUrl,
    period: String(year),
    time: pick(row, ["time"]),
    date: pick(row, ["date"]),
    state,
    county,
    county_fips: fips || "",
    location: "",
    lat: pick(row, ["slat"]),
    lon: pick(row, ["slon"]),
    magnitude: pick(row, ["mag"]),
    magnitude_note: kind === "hail" ? "hail size in inches" : "wind magnitude (knots in WCM files)",
    comments: "",
    metro: state === "GA" && isMetroAtlantaFips(fips)
  };
}

function printTable(rows) {
  if (!rows.length) {
    console.log("No metro Atlanta hits in the selected report set.");
    return;
  }
  const cols = ["date", "time", "kind", "county", "location", "magnitude", "lat", "lon"];
  const widths = {};
  for (const c of cols) {
    widths[c] = Math.max(c.length, ...rows.map((r) => String(r[c] ?? "").length));
  }
  const line = (row) => cols.map((c) => String(row[c] ?? "").padEnd(widths[c])).join("  ");
  console.log(line(Object.fromEntries(cols.map((c) => [c, c]))));
  console.log(cols.map((c) => "-".repeat(widths[c])).join("  "));
  for (const r of rows) console.log(line(r));
}

async function loadDaily(kind, args) {
  let url;
  let label;
  if (args.today) {
    url = `${SPC_BASE}/today_${kind}.csv`;
    label = `today (${todayIso()})`;
  } else if (args.yesterday) {
    url = `${SPC_BASE}/yesterday_${kind}.csv`;
    label = `yesterday (${yesterdayIso()})`;
  } else {
    const yymmdd = yymmddFromIso(args.date);
    url = `${SPC_BASE}/${yymmdd}_rpts_${kind}.csv`;
    label = args.date;
  }
  const text = await fetchText(url);
  const { rows } = parseCsv(text);
  return rows.map((r) => normalizeDaily(r, kind, url, label));
}

async function loadWcm(kind, year) {
  const url = `${WCM_BASE}/${year}_${kind}.csv`;
  const text = await fetchText(url);
  const { rows } = parseCsv(text);
  return rows.map((r) => normalizeWcm(r, kind, url, year));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage:
  node scripts/fetch-storm-reports.js --today
  node scripts/fetch-storm-reports.js --yesterday --also-wind
  node scripts/fetch-storm-reports.js --date 2025-04-10
  node scripts/fetch-storm-reports.js --wcm 2025 --json --out /tmp/atlanta-storms.json

Filters hail (and wind unless --hail-only) to the Atlanta-Sandy Springs-Roswell, GA MSA
counties listed in OMB Bulletin 23-01.
`);
    return;
  }

  const kinds = args.hailOnly ? ["hail"] : ["hail", "wind"];
  let records = [];

  if (args.wcm) {
    for (const kind of kinds) {
      process.stderr.write(`Fetching WCM ${args.wcm} ${kind}...\n`);
      records = records.concat(await loadWcm(kind, args.wcm));
    }
  } else {
    for (const kind of kinds) {
      process.stderr.write(`Fetching SPC daily ${kind} reports...\n`);
      records = records.concat(await loadDaily(kind, args));
    }
  }

  const metro = records.filter((r) => r.metro);
  const summary = {
    generated_at: new Date().toISOString(),
    filter: "Atlanta-Sandy Springs-Roswell, GA MSA (OMB Bulletin 23-01)",
    total_reports_in_files: records.length,
    metro_atlanta_hits: metro.length,
    hail_hits: metro.filter((r) => r.kind === "hail").length,
    wind_hits: metro.filter((r) => r.kind === "wind").length,
    counties: METRO_ATLANTA_COUNTIES,
    hits: metro
  };

  if (args.json) {
    const out = JSON.stringify(summary, null, 2);
    if (args.out) {
      fs.writeFileSync(path.resolve(args.out), out);
      console.error(`Wrote ${metro.length} hits to ${args.out}`);
    } else {
      console.log(out);
    }
  } else {
    console.log(`\nMetro Atlanta hits: ${metro.length} (hail ${summary.hail_hits}, wind ${summary.wind_hits})`);
    console.log(`Source rows scanned: ${records.length}`);
    printTable(metro);
    if (args.out) {
      fs.writeFileSync(path.resolve(args.out), JSON.stringify(summary, null, 2));
      console.error(`Also wrote JSON to ${args.out}`);
    }
  }

  if (!metro.length) {
    process.exitCode = 0;
  }
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
