/**
 * 正規化 JSON（data/normalized）と兄弟サイトの党の色相（data/palette.json）だけを入力に、
 * 配信データを public/data/ に書き出す。
 *
 *   npm run data
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PREFECTURES } from "../src/lib/data/areas.ts";
import type { Kind, NationalJson, PrefJson, System } from "../src/lib/data/cube.ts";
import { ELECTIONS } from "../src/lib/data/elections.ts";
import { NEUTRAL } from "../src/lib/data/palette.ts";
import type { NormalizedElection, Side } from "../src/lib/parse/types.ts";

const IN_DIR = resolve(import.meta.dirname, "../data/normalized");
const PALETTE = resolve(import.meta.dirname, "../data/palette.json");
const OUT_DIR = resolve(import.meta.dirname, "../public/data");

const KINDS: [Kind, "candidates" | "winners"][] = [
  ["cand", "candidates"],
  ["win", "winners"],
];
const SYSTEMS: System[] = ["smd", "pr", "all"];
/** 積み上げの一番上に置く。 */
const LAST = ["諸派", "無所属"];

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** 積み上げの底に置く順。全回の当選者が多い党ほど先、同じなら候補者が多い党ほど先。 */
function partyOrder(names: Iterable<string>, weight: (party: string, side: "candidates" | "winners") => number): string[] {
  const rank = (p: string) => LAST.indexOf(p);
  return [...new Set(names)].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      weight(b, "winners") - weight(a, "winners") ||
      weight(b, "candidates") - weight(a, "candidates") ||
      a.localeCompare(b, "ja"),
  );
}

function national(data: NormalizedElection[]): NationalJson {
  const names = data.flatMap((d) => [...Object.keys(d.candidates.parties), ...Object.keys(d.winners.parties)]);
  const parties = partyOrder(names, (p, side) => sum(data.map((d) => sum(d[side].parties[p]?.all ?? []))));
  const cube = (side: Side[], system: System) =>
    parties.map((p) => side.map((s) => s.parties[p]?.[system] ?? [0, 0, 0, 0, 0, 0]));
  const counts = Object.fromEntries(
    KINDS.map(([kind, key]) => [
      kind,
      Object.fromEntries(SYSTEMS.map((system) => [system, cube(data.map((d) => d[key]), system)])),
    ]),
  ) as NationalJson["counts"];
  return { elections: data.map((d) => d.n), parties, counts };
}

function pref(data: NormalizedElection[]): PrefJson {
  const people = (s: Side, party: string, p: string) => sum(s.prefs[p]![party] ?? []);
  const names = data.flatMap((d) =>
    [d.candidates, d.winners].flatMap((s) => Object.keys(s.prefNational).filter((p) => p !== "合計")),
  );
  const parties = partyOrder(names, (p, side) => sum(data.map((d) => sum(d[side].prefNational[p] ?? []))));
  return {
    elections: data.map((d) => d.n),
    prefs: [...PREFECTURES],
    parties,
    districts: data.map((d) => PREFECTURES.map((p) => d.districts[p]!)),
    counts: Object.fromEntries(
      KINDS.map(([kind, key]) => [
        kind,
        parties.map((party) => data.map((d) => PREFECTURES.map((p) => people(d[key], party, p)))),
      ]),
    ) as PrefJson["counts"],
    ages: Object.fromEntries(
      KINDS.map(([kind, key]) => [kind, data.map((d) => PREFECTURES.map((p) => d[key].ages[p]!))]),
    ) as PrefJson["ages"],
  };
}

async function writeJson(name: string, value: unknown): Promise<void> {
  const json = JSON.stringify(value);
  await writeFile(resolve(OUT_DIR, `${name}.json`), json);
  console.log(`  ${name}.json  ${(Buffer.byteLength(json) / 1024).toFixed(1)} KB`);
}

const data = await Promise.all(
  ELECTIONS.map(
    async (e) => JSON.parse(await readFile(resolve(IN_DIR, `${e.n}.json`), "utf8")) as NormalizedElection,
  ),
);
const hues = JSON.parse(await readFile(PALETTE, "utf8")) as Record<string, number>;

const nationalJson = national(data);
const missing = nationalJson.parties.filter((p) => !NEUTRAL.has(p) && !(p in hues));
if (missing.length > 0) throw new Error(`data/palette.json に色相のない党: ${missing.join("、")}`);

await mkdir(OUT_DIR, { recursive: true });
await writeJson("national", nationalJson);
await writeJson("pref", pref(data));
await writeJson("palette", Object.fromEntries(nationalJson.parties.filter((p) => p in hues).map((p) => [p, hues[p]])));
