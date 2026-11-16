/**
 * Atlanta-Sandy Springs-Roswell, GA Metropolitan Statistical Area
 * counties from OMB Bulletin No. 23-01 (July 21, 2023), List 2.
 * Source: https://www.bls.gov/bls/omb-bulletin-23-01-revised-delineations-of-metropolitan-statistical-areas.pdf
 *
 * The MSA is split into two Metropolitan Divisions:
 *  - 12054 Atlanta-Sandy Springs-Roswell, GA
 *  - 31924 Marietta, GA
 *
 * Georgia state FIPS is 13. County FIPS below are the 3-digit county codes
 * used in NOAA SPC WCM files (field f1). Full FIPS = 13 + these digits.
 *
 * Note: this 2023 delineation includes Lumpkin County and does not include
 * Lamar County, which appeared in some older 29-county lists.
 */
const METRO_ATLANTA_COUNTIES = {
  13: "Barrow",
  15: "Bartow",
  35: "Butts",
  45: "Carroll",
  57: "Cherokee",
  63: "Clayton",
  67: "Cobb",
  77: "Coweta",
  85: "Dawson",
  89: "DeKalb",
  97: "Douglas",
  113: "Fayette",
  117: "Forsyth",
  121: "Fulton",
  135: "Gwinnett",
  143: "Haralson",
  149: "Heard",
  151: "Henry",
  159: "Jasper",
  187: "Lumpkin",
  199: "Meriwether",
  211: "Morgan",
  217: "Newton",
  223: "Paulding",
  227: "Pickens",
  231: "Pike",
  247: "Rockdale",
  255: "Spalding",
  297: "Walton"
};

const COUNTY_ALIASES = {
  dekalb: 89,
  "de kalb": 89,
  "de-kalb": 89
};

function normalizeCountyName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\s+county$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function countyFipsFromName(name) {
  const key = normalizeCountyName(name);
  if (COUNTY_ALIASES[key] != null) return COUNTY_ALIASES[key];
  for (const [fips, label] of Object.entries(METRO_ATLANTA_COUNTIES)) {
    if (normalizeCountyName(label) === key) return Number(fips);
  }
  return null;
}

function isMetroAtlantaCountyName(name) {
  return countyFipsFromName(name) != null;
}

function isMetroAtlantaFips(fips) {
  const n = Number(fips);
  return Number.isFinite(n) && Object.prototype.hasOwnProperty.call(METRO_ATLANTA_COUNTIES, n);
}

module.exports = {
  METRO_ATLANTA_COUNTIES,
  countyFipsFromName,
  isMetroAtlantaCountyName,
  isMetroAtlantaFips,
  normalizeCountyName
};
