/**
 * data/raw/ の結果調を読み、回ごとの正規化 JSON を data/normalized/ に書き出す。
 * 第44回の PDF には poppler の pdftotext が要る。
 *
 *   npm run normalize
 */

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ELECTIONS, type Election, type TableId } from "../src/lib/data/elections.ts";
import { readRows } from "../src/lib/parse/excel.ts";
import { readPdfRows } from "../src/lib/parse/pdf.ts";
import { parseAgeTable, parsePartyTable, parsePrefTable, type Row } from "../src/lib/parse/tables.ts";
import type { NormalizedElection, Side } from "../src/lib/parse/types.ts";
import { rawPath } from "./fetch-data.ts";

const OUT_DIR = resolve(import.meta.dirname, "../data/normalized");

/** PDF の列を作る小見出しと、その左の欄の数。表の種類ごと。 */
const PDF_LAYOUT = {
  party: { anchor: (t: string) => /^[男女計]$/.test(t), labels: 2 },
  pref: { anchor: (t: string) => /^[数新前元計]$/.test(t), labels: 1 },
  // 年齢段階は上下2段の見出し（25歳／29歳）のうち上の段だけを列にする。
  age: { anchor: (t: string) => /^(25|[3-7][05])歳$|^計$/.test(t), labels: 1 },
} as const;

function rows(e: Election, table: TableId, layout: keyof typeof PDF_LAYOUT): Row[] {
  const source = e.tables[table];
  const path = rawPath(e.n, table, source.format);
  if (source.format !== "pdf") return readRows(path);
  const { anchor, labels } = PDF_LAYOUT[layout];
  return readPdfRows(path, anchor, labels);
}

function side(e: Election, kind: "cand" | "win"): { side: Side; districts: Record<string, number> } {
  const where = (t: string) => `第${e.n}回 ${kind}${t}`;
  const run = <T>(t: string, f: () => T): T => {
    try {
      return f();
    } catch (err) {
      throw new Error(`${where(t)}: ${(err as Error).message}`);
    }
  };
  const party = run("Party", () => parsePartyTable(rows(e, `${kind}Party`, "party"), kind === "cand"));
  const pref = run("Pref", () => parsePrefTable(rows(e, `${kind}Pref`, "pref")));
  const age = run("Age", () => parseAgeTable(rows(e, `${kind}Age`, "age")));
  return {
    side: {
      parties: party.parties,
      total: party.total,
      prefs: pref.prefs,
      prefNational: pref.national,
      ages: age.ages,
      ageNational: age.national,
    },
    districts: pref.districts,
  };
}

function normalize(e: Election): NormalizedElection {
  const cand = side(e, "cand");
  const win = side(e, "win");
  for (const [pref, n] of Object.entries(cand.districts)) {
    if (win.districts[pref] !== n) throw new Error(`第${e.n}回 ${pref}: 定数が候補者と当選人の表で違う`);
  }
  return { n: e.n, districts: cand.districts, candidates: cand.side, winners: win.side };
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  for (const e of ELECTIONS) {
    const data = normalize(e);
    await writeFile(resolve(OUT_DIR, `${e.n}.json`), `${JSON.stringify(data, null, 1)}\n`);
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
    console.log(
      `  第${e.n}回  候補者 ${sum(data.candidates.total.all)}人（${Object.keys(data.candidates.parties).length}党）  当選人 ${sum(data.winners.total.all)}人（${Object.keys(data.winners.parties).length}党）`,
    );
  }
}

await main();
