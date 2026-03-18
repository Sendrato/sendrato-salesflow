/**
 * ISO 3166-1 country name normalization.
 *
 * Canonical list of country names, an alias map for codes/variants,
 * and a normalizeCountry() function used at every data entry point.
 */

/** Sorted list of common ISO 3166-1 country names for dropdown/combobox use. */
export const COUNTRY_NAMES: string[] = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "Argentina",
  "Australia",
  "Austria",
  "Bahrain",
  "Bangladesh",
  "Belgium",
  "Brazil",
  "Bulgaria",
  "Cambodia",
  "Canada",
  "Chile",
  "China",
  "Colombia",
  "Croatia",
  "Cyprus",
  "Czech Republic",
  "Denmark",
  "Egypt",
  "Estonia",
  "Ethiopia",
  "Finland",
  "France",
  "Germany",
  "Ghana",
  "Greece",
  "Hong Kong",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kuwait",
  "Latvia",
  "Lebanon",
  "Lithuania",
  "Luxembourg",
  "Malaysia",
  "Malta",
  "Mexico",
  "Morocco",
  "Netherlands",
  "New Zealand",
  "Nigeria",
  "Norway",
  "Oman",
  "Pakistan",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Qatar",
  "Romania",
  "Russia",
  "Saudi Arabia",
  "Serbia",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "South Africa",
  "South Korea",
  "Spain",
  "Sri Lanka",
  "Sweden",
  "Switzerland",
  "Taiwan",
  "Thailand",
  "Tunisia",
  "Turkey",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Vietnam",
];

/**
 * Lowercase lookup mapping codes, variants, abbreviations, and UK regions
 * to their canonical ISO 3166-1 name.
 */
export const COUNTRY_ALIAS_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};

  // All canonical names map to themselves (case normalization)
  for (const name of COUNTRY_NAMES) {
    map[name.toLowerCase()] = name;
  }

  // ISO 3166-1 alpha-2 codes
  const codes: Record<string, string> = {
    af: "Afghanistan",
    al: "Albania",
    dz: "Algeria",
    ar: "Argentina",
    au: "Australia",
    at: "Austria",
    bh: "Bahrain",
    bd: "Bangladesh",
    be: "Belgium",
    br: "Brazil",
    bg: "Bulgaria",
    kh: "Cambodia",
    ca: "Canada",
    cl: "Chile",
    cn: "China",
    co: "Colombia",
    hr: "Croatia",
    cy: "Cyprus",
    cz: "Czech Republic",
    dk: "Denmark",
    eg: "Egypt",
    ee: "Estonia",
    et: "Ethiopia",
    fi: "Finland",
    fr: "France",
    de: "Germany",
    gh: "Ghana",
    gr: "Greece",
    hk: "Hong Kong",
    hu: "Hungary",
    is: "Iceland",
    in: "India",
    id: "Indonesia",
    ir: "Iran",
    iq: "Iraq",
    ie: "Ireland",
    il: "Israel",
    it: "Italy",
    jp: "Japan",
    jo: "Jordan",
    kz: "Kazakhstan",
    ke: "Kenya",
    kw: "Kuwait",
    lv: "Latvia",
    lb: "Lebanon",
    lt: "Lithuania",
    lu: "Luxembourg",
    my: "Malaysia",
    mt: "Malta",
    mx: "Mexico",
    ma: "Morocco",
    nl: "Netherlands",
    nz: "New Zealand",
    ng: "Nigeria",
    no: "Norway",
    om: "Oman",
    pk: "Pakistan",
    pe: "Peru",
    ph: "Philippines",
    pl: "Poland",
    pt: "Portugal",
    qa: "Qatar",
    ro: "Romania",
    ru: "Russia",
    sa: "South Africa",
    rs: "Serbia",
    sg: "Singapore",
    sk: "Slovakia",
    si: "Slovenia",
    za: "South Africa",
    kr: "South Korea",
    es: "Spain",
    lk: "Sri Lanka",
    se: "Sweden",
    ch: "Switzerland",
    tw: "Taiwan",
    th: "Thailand",
    tn: "Tunisia",
    tr: "Turkey",
    ua: "Ukraine",
    ae: "United Arab Emirates",
    gb: "United Kingdom",
    us: "United States",
    uy: "Uruguay",
    vn: "Vietnam",
  };
  for (const [code, name] of Object.entries(codes)) {
    map[code] = name;
  }

  // Common non-standard codes and abbreviations
  map["uk"] = "United Kingdom";
  map["uae"] = "United Arab Emirates";
  map["usa"] = "United States";
  map["ksa"] = "Saudi Arabia";

  // UK constituent countries and regions
  const ukRegions = [
    "england",
    "scotland",
    "wales",
    "northern ireland",
    "great britain",
    "britain",
    // English regions
    "south east",
    "south west",
    "north east",
    "north west",
    "east midlands",
    "west midlands",
    "east anglia",
    "east of england",
    "yorkshire",
    "london",
  ];
  for (const region of ukRegions) {
    map[region] = "United Kingdom";
  }

  // Common name variants
  map["united states of america"] = "United States";
  map["america"] = "United States";
  map["holland"] = "Netherlands";
  map["the netherlands"] = "Netherlands";
  map["republic of ireland"] = "Ireland";
  map["eire"] = "Ireland";
  map["czech"] = "Czech Republic";
  map["czechia"] = "Czech Republic";
  map["ussr"] = "Russia";
  map["korea"] = "South Korea";
  map["republic of korea"] = "South Korea";
  map["dprk"] = "South Korea";
  map["hong kong sar"] = "Hong Kong";
  map["prc"] = "China";

  return map;
})();

/**
 * Normalize a country string to its canonical ISO 3166-1 name.
 * Unknown values are title-cased and passed through.
 */
export function normalizeCountry(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const key = trimmed.toLowerCase();
  const mapped = COUNTRY_ALIAS_MAP[key];
  if (mapped) return mapped;
  // Fallback: title-case unknown values
  return trimmed
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
