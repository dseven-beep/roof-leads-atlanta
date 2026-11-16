function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const CITY_ROWS = [
  ["Atlanta", "Fulton"],
  ["Marietta", "Cobb"],
  ["Alpharetta", "Fulton"],
  ["Roswell", "Fulton"],
  ["Sandy Springs", "Fulton"],
  ["Decatur", "DeKalb"],
  ["Brookhaven", "DeKalb"],
  ["Dunwoody", "DeKalb"],
  ["Johns Creek", "Fulton"],
  ["Peachtree City", "Fayette"],
  ["Smyrna", "Cobb"],
  ["Kennesaw", "Cobb"],
  ["Acworth", "Cobb"],
  ["Woodstock", "Cherokee"],
  ["Canton", "Cherokee"],
  ["Lawrenceville", "Gwinnett"],
  ["Duluth", "Gwinnett"],
  ["Suwanee", "Gwinnett"],
  ["Buford", "Gwinnett"],
  ["Norcross", "Gwinnett"],
  ["Lilburn", "Gwinnett"],
  ["Snellville", "Gwinnett"],
  ["Sugar Hill", "Gwinnett"],
  ["Dacula", "Gwinnett"],
  ["Stone Mountain", "DeKalb"],
  ["Tucker", "DeKalb"],
  ["Chamblee", "DeKalb"],
  ["Doraville", "DeKalb"],
  ["Lithonia", "DeKalb"],
  ["Conyers", "Rockdale"],
  ["McDonough", "Henry"],
  ["Stockbridge", "Henry"],
  ["Jonesboro", "Clayton"],
  ["Forest Park", "Clayton"],
  ["Morrow", "Clayton"],
  ["East Point", "Fulton"],
  ["College Park", "Fulton"],
  ["Union City", "Fulton"],
  ["Fairburn", "Fulton"],
  ["Fayetteville", "Fayette"],
  ["Tyrone", "Fayette"],
  ["Newnan", "Coweta"],
  ["Douglasville", "Douglas"],
  ["Austell", "Cobb"],
  ["Powder Springs", "Cobb"],
  ["Mableton", "Cobb"],
  ["Milton", "Fulton"],
  ["Cumming", "Forsyth"],
  ["Dallas", "Paulding"],
  ["Hiram", "Paulding"],
  ["Villa Rica", "Carroll"],
  ["Loganville", "Walton"],
  ["Monroe", "Walton"],
  ["Covington", "Newton"],
  ["Griffin", "Spalding"],
  ["Holly Springs", "Cherokee"],
  ["Ball Ground", "Cherokee"],
  ["Peachtree Corners", "Gwinnett"]
];

const CITIES = CITY_ROWS.map(([name, county]) => ({
  name,
  county,
  slug: slugify(name)
}));

const CITIES_BY_SLUG = Object.fromEntries(CITIES.map((c) => [c.slug, c]));

function findCity(param) {
  if (!param) return null;
  const slug = slugify(param);
  return CITIES_BY_SLUG[slug] || null;
}

module.exports = { CITIES, CITIES_BY_SLUG, findCity, slugify };
