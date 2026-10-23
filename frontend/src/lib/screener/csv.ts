import type { ScreenerField, StockRow } from "screener-contract";
import {
  columnLabel,
  formatRowMetric,
  getRowMetric,
} from "./column-presets";
import { slugifyScreenName } from "./url-spec";

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Build CSV for current results + visible metric columns. */
export function buildResultsCsv(
  rows: StockRow[],
  fields: ScreenerField[],
): string {
  const headers = ["Ticker", "Name", ...fields.map(columnLabel)];
  const lines = [headers.map(csvEscape).join(",")];

  for (const row of rows) {
    const cells = [
      row.ticker,
      row.name,
      ...fields.map((field) =>
        formatRowMetric(field, getRowMetric(row, field)),
      ),
    ];
    lines.push(cells.map(csvEscape).join(","));
  }

  return `${lines.join("\n")}\n`;
}

/** Trigger a browser download of the CSV. */
export function downloadResultsCsv(
  rows: StockRow[],
  fields: ScreenerField[],
  screenName: string,
): void {
  const csv = buildResultsCsv(rows, fields);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugifyScreenName(screenName)}-results.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
