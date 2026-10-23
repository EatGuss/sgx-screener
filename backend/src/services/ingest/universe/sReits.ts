import type { UniverseSeedEntry } from "./types";

/**
 * S-REITs and listed property/business trusts beyond STI names.
 * Board tagged from listing segment (Mainboard vs Catalist).
 */
export const S_REITS: UniverseSeedEntry[] = [
  { ticker: "A7RU.SI", name: "Keppel Infrastructure Trust", board: "Mainboard", sector: "Utilities", industry: "Infrastructure" },
  { ticker: "AJBU.SI", name: "Keppel DC REIT", board: "Mainboard", sector: "Real Estate", industry: "REIT - Office" },
  { ticker: "AW9U.SI", name: "First Real Estate Investment Trust", board: "Mainboard", sector: "Real Estate", industry: "REIT - Healthcare" },
  { ticker: "C2PU.SI", name: "Parkway Life Real Estate Investment Trust", board: "Mainboard", sector: "Real Estate", industry: "REIT - Healthcare" },
  { ticker: "CJLU.SI", name: "NetLink NBN Trust", board: "Mainboard", sector: "Communication Services", industry: "Telecom Infrastructure" },
  { ticker: "CRPU.SI", name: "Sasseur Real Estate Investment Trust", board: "Catalist", sector: "Real Estate", industry: "REIT - Retail" },
  { ticker: "J69U.SI", name: "Frasers Centrepoint Trust", board: "Mainboard", sector: "Real Estate", industry: "REIT - Retail" },
  { ticker: "J85.SI", name: "CDL Hospitality Trusts", board: "Mainboard", sector: "Real Estate", industry: "REIT - Hotel & Motel" },
  { ticker: "JYEU.SI", name: "Lendlease Global Commercial REIT", board: "Mainboard", sector: "Real Estate", industry: "REIT - Retail" },
  { ticker: "K71U.SI", name: "Keppel REIT", board: "Mainboard", sector: "Real Estate", industry: "REIT - Specialty" },
  { ticker: "P7VU.SI", name: "Hutchison Port Holdings Trust", board: "Mainboard", sector: "Industrials", industry: "Marine Shipping" },
  { ticker: "Q5T.SI", name: "Far East Hospitality Trust", board: "Mainboard", sector: "Real Estate", industry: "REIT - Hotel & Motel" },
  { ticker: "T82U.SI", name: "Suntec Real Estate Investment Trust", board: "Mainboard", sector: "Real Estate", industry: "REIT - Office" },
  { ticker: "UD1U.SI", name: "IREIT Global", board: "Mainboard", sector: "Real Estate", industry: "REIT - Diversified" },
];
