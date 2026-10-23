export type SgxBoard = "Mainboard" | "Catalist";

export interface UniverseSeedEntry {
  ticker: string;
  name: string;
  board: SgxBoard;
  sector?: string;
  industry?: string;
  country?: string;
  currency?: string;
}
