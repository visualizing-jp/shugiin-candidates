/**
 * 正規化 JSON の健全性チェック。1つでも落ちたら終了コード 1。
 * 表の中の「計」との突き合わせは読むとき（src/lib/parse/tables.ts）に済んでいる。ここでは表どうしを突き合わせる。
 *
 *   npm run verify
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PREFECTURES } from "../src/lib/data/areas.ts";
import { ELECTIONS } from "../src/lib/data/elections.ts";
import type { NormalizedElection, PartyCounts, SexStatus, Side, Status } from "../src/lib/parse/types.ts";

const DIR = resolve(import.meta.dirname, "../data/normalized");

type Quad = [新: number, 前: number, 元: number, 女性: number];

/**
 * 第49回確定結果調の推移表（新前元別候補者数・新前元別当選人数・女性の当選率）の値。
 * 速報結果ページの表から組み立てた値が確定値と一致するかを見る。
 * 第48回小選挙区の女性候補者数は、同じ冊子の「女性候補者数」の表では157人、「女性の当選率」の表では158人。
 * 第48回の結果ページの表は157人なので、こちらを採った。
 */
const CONFIRMED: Record<number, { cand: Record<"smd" | "pr" | "prDual" | "all", Quad>; win: Record<"smd" | "pr" | "all", Quad> }> = {
  44: {
    cand: { smd: [527, 415, 47, 123], pr: [320, 403, 55, 84], prDual: [233, 361, 42, 60], all: [614, 457, 60, 147] },
    win: { smd: [39, 249, 12, 19], pr: [62, 101, 17, 24], all: [101, 350, 29, 43] },
  },
  45: {
    cand: { smd: [677, 399, 63, 184], pr: [401, 418, 69, 128], prDual: [233, 366, 54, 83], all: [845, 451, 78, 229] },
    win: { smd: [77, 177, 46, 24], pr: [81, 89, 10, 30], all: [158, 266, 56, 54] },
  },
  46: {
    cand: { smd: [789, 403, 102, 193], pr: [602, 415, 100, 144], prDual: [438, 382, 87, 112], all: [953, 436, 115, 225] },
    win: { smd: [93, 142, 65, 16], pr: [91, 71, 18, 22], all: [184, 213, 83, 38] },
  },
  47: {
    cand: { smd: [442, 416, 101, 142], pr: [295, 432, 114, 125], prDual: [133, 378, 98, 69], all: [604, 470, 117, 198] },
    win: { smd: [4, 285, 6, 18], pr: [39, 121, 20, 27], all: [43, 406, 26, 45] },
  },
  48: {
    cand: { smd: [464, 398, 74, 157], pr: [369, 388, 98, 145], prDual: [203, 336, 72, 93], all: [630, 450, 100, 209] },
    win: { smd: [14, 269, 6, 23], pr: [42, 108, 26, 24], all: [56, 377, 32, 47] },
  },
  49: {
    cand: { smd: [412, 380, 65, 141], pr: [371, 377, 69, 142], prDual: [233, 338, 52, 97], all: [550, 419, 82, 186] },
    win: { smd: [41, 237, 11, 24], pr: [56, 107, 13, 21], all: [97, 344, 24, 45] },
  },
};

/**
 * 速報の表が確定値と違うと分かっているもの（確定値 − 速報の表）。値は速報の表のまま載せ、画面の注記で断る。
 * 第49回の当選人は、東京都の立憲民主党の1人が速報の表では前職、確定結果調（都道府県別党派別新前元別当選人数）では新人。
 * 確定結果調の男女別の表は新前元と掛け合わせていないので、その1人の男女は表からは決まらない。
 */
const KNOWN: Record<string, Quad> = {
  "49 win smd": [1, -1, 0, 0],
  "49 win all": [1, -1, 0, 0],
};

const failures: string[] = [];
let checks = 0;

function check(ok: boolean, message: string): void {
  checks++;
  if (!ok) failures.push(message);
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const same = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);
const add = (a: number[], b: number[]) => a.map((v, i) => v + b[i]!);
/** 男女を足して新前元にする。 */
const byStatus = (s: SexStatus): Status => [s[0]! + s[1]!, s[2]! + s[3]!, s[4]! + s[5]!];
const women = (s: SexStatus) => s[1]! + s[3]! + s[5]!;
const quad = (s: SexStatus): Quad => [...byStatus(s), women(s)] as Quad;

function checkSide(where: string, side: Side, hasDual: boolean): void {
  const parties = Object.entries(side.parties);
  const systems = ["smd", "pr", "all", ...(hasDual ? ["prDual"] : [])] as (keyof PartyCounts)[];

  // 党派別：合計列 = 党の和。全体 = 小選挙区 + 比例代表 − 重複立候補者。
  for (const system of systems) {
    const s = parties.reduce((acc, [, c]) => add(acc, c[system]!), [0, 0, 0, 0, 0, 0]);
    check(same(s, side.total[system]!), `${where} ${system}: 党の和 ${s} ≠ 合計 ${side.total[system]}`);
  }
  for (const [party, c] of [...parties, ["合計", side.total] as const]) {
    const expected = add(c.smd, c.pr).map((v, i) => v - (hasDual ? c.prDual![i]! : 0));
    check(same(c.all, expected), `${where} ${party}: 全体 ${c.all} ≠ 小選挙区 + 比例代表 − 重複 ${expected}`);
  }

  // 都道府県別：計の行 = 都道府県の和、党派別の小選挙区と一致、都道府県の合計 = 党の和。
  const names = new Set([...Object.values(side.prefs).flatMap((p) => Object.keys(p)), ...Object.keys(side.prefNational)]);
  for (const party of names) {
    const byPref = PREFECTURES.reduce((acc, p) => add(acc, side.prefs[p]![party] ?? [0, 0, 0]), [0, 0, 0]);
    const national = side.prefNational[party] ?? [0, 0, 0];
    check(same(byPref, national), `${where} ${party}: 都道府県の和 ${byPref} ≠ 計の行 ${national}`);
    if (party === "合計") continue;
    const table = side.parties[party];
    check(table !== undefined, `${where} ${party}: 都道府県別にあって党派別にない`);
    if (table !== undefined) {
      check(same(national, byStatus(table.smd)), `${where} ${party}: 都道府県別 ${national} ≠ 党派別の小選挙区 ${byStatus(table.smd)}`);
    }
  }
  for (const [party, c] of parties) {
    if (sum(c.smd) > 0) check(names.has(party), `${where} ${party}: 小選挙区にいるのに都道府県別にない`);
  }
  for (const p of PREFECTURES) {
    const { 合計: total, ...rest } = side.prefs[p]!;
    const s = Object.values(rest).reduce((acc, v) => add(acc, v), [0, 0, 0]);
    check(total !== undefined && same(s, total), `${where} ${p}: 党の和 ${s} ≠ 合計 ${total}`);
  }

  // 年齢段階別：計の行 = 都道府県の和、都道府県ごとの人数が都道府県別の表と一致。
  const ageSum = PREFECTURES.reduce((acc, p) => add(acc, side.ages[p]!), side.ageNational.map(() => 0));
  check(same(ageSum, side.ageNational), `${where} 年齢: 都道府県の和 ≠ 計の行`);
  for (const p of PREFECTURES) {
    const people = sum(side.prefs[p]!["合計"] ?? []);
    check(sum(side.ages[p]!) === people, `${where} ${p}: 年齢段階の和 ${sum(side.ages[p]!)} ≠ ${people}`);
  }
}

for (const e of ELECTIONS) {
  const d = JSON.parse(await readFile(resolve(DIR, `${e.n}.json`), "utf8")) as NormalizedElection;
  const where = `第${e.n}回`;
  check(d.n === e.n, `${where}: ファイルの回が ${d.n}`);
  checkSide(`${where} 候補者`, d.candidates, true);
  checkSide(`${where} 当選人`, d.winners, false);

  // 定数：都道府県の小選挙区の和、当選人の数。
  check(sum(Object.values(d.districts)) === e.seats.smd, `${where}: 小選挙区の数の和 ≠ 定数 ${e.seats.smd}`);
  check(sum(d.winners.total.smd) === e.seats.smd, `${where}: 小選挙区の当選人 ${sum(d.winners.total.smd)} ≠ 定数`);
  check(sum(d.winners.total.pr) === e.seats.pr, `${where}: 比例代表の当選人 ${sum(d.winners.total.pr)} ≠ 定数`);
  for (const p of PREFECTURES) {
    const won = sum(d.winners.prefs[p]!["合計"] ?? []);
    check(won === d.districts[p], `${where} ${p}: 当選人 ${won} ≠ 小選挙区の数 ${d.districts[p]}`);
  }

  const confirmed = CONFIRMED[e.n];
  if (confirmed !== undefined) {
    for (const [system, expected] of Object.entries(confirmed.cand)) {
      const mine = quad(d.candidates.total[system as keyof PartyCounts]!);
      check(same(mine, expected), `${where} 候補者 ${system}: ${mine} ≠ 確定 ${expected}（新・前・元・女性）`);
    }
    for (const [system, expected] of Object.entries(confirmed.win)) {
      const mine = quad(d.winners.total[system as keyof PartyCounts]!);
      const known = KNOWN[`${e.n} win ${system}`] ?? [0, 0, 0, 0];
      check(
        same(add(mine, known), expected),
        `${where} 当選人 ${system}: ${mine} ≠ 確定 ${expected}（新・前・元・女性、既知の差 ${known}）`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error(`✗ ${failures.length}/${checks} 件が不一致`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`✓ ${checks} 件すべて一致`);
