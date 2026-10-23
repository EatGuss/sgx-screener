import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const data = JSON.parse(
  readFileSync(join(__dirname, "cleanup-universe-output.json"), "utf8"),
) as {
  sti30: Array<Record<string, string>>;
  sReits: Array<Record<string, string>>;
  liquidExtras: Array<Record<string, string>>;
  total: number;
};

function emit(
  filename: string,
  constName: string,
  header: string,
  entries: Array<Record<string, string>>,
): void {
  const lines = entries.map(
    (e) =>
      `  { ticker: ${JSON.stringify(e.ticker)}, name: ${JSON.stringify(e.name)}, board: ${JSON.stringify(e.board)}, sector: ${JSON.stringify(e.sector)}, industry: ${JSON.stringify(e.industry)} },`,
  );
  const content = `import type { UniverseSeedEntry } from "./types";

${header}
export const ${constName}: UniverseSeedEntry[] = [
${lines.join("\n")}
];
`;
  writeFileSync(join(__dirname, "../src/services/ingest/universe", filename), content);
}

emit(
  "sti30.ts",
  "STI_30",
  "/** Straits Times Index (STI) constituents — liquid Mainboard blue chips. */",
  data.sti30,
);
emit(
  "sReits.ts",
  "S_REITS",
  "/**\n * S-REITs and listed property/business trusts beyond STI names.\n * Board tagged from listing segment (Mainboard vs Catalist).\n */",
  data.sReits,
);
emit(
  "liquidExtras.ts",
  "LIQUID_EXTRAS",
  "/** Additional liquid Mainboard names rounding out the launch universe. */",
  data.liquidExtras,
);

console.log(
  `Applied seed files: STI ${data.sti30.length}, REITs ${data.sReits.length}, extras ${data.liquidExtras.length} (total ${data.total})`,
);
