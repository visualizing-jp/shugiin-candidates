/**
 * 結果調の3種類の表を、行 × 列のセルから読む。Excel（excel.ts）と PDF（pdf.ts）で共通。
 *
 * 回によって列の組み方が揺れる。党名は結合セルのどの列にも置かれ得るし、
 * 長い党名は2行に折られる（「NHKと裁判してる党」「弁護士法72条違反で」）。
 * そこで党の列は、党名ではなく小見出し（男・女・計、新・前・元・計）の位置から決め、
 * 党名はその列の上にある見出しをつなげて読む。
 *
 * 表の中の「計」は読むたびに内訳の和と突き合わせ、合わなければ止める。
 */

import { PREFECTURES } from "../data/areas.ts";
import { AGE_BANDS } from "../data/elections.ts";
import { TOTAL, clean, count, isCount } from "./cells.ts";
import type { PartyCounts, Status } from "./types.ts";

export type Row = unknown[];

const PREF_SET = new Set<string>(PREFECTURES);
const STATUS = ["新", "前", "元"] as const;
const SYSTEMS = ["smd", "pr", "all"] as const;

function cell(row: Row | undefined, c: number): string {
  return clean(row?.[c]);
}

/** 表題（(1)…、1.…）と注記の行。見出しの探索と表の読み取りをここで止める。 */
function isTitleOrNote(row: Row): boolean {
  return row.some((v) => /^(\(\d+\)|\d+\.|\(注|注\))/.test(clean(v)));
}

/**
 * 見出し（党名）の列。小見出しの行 i の上を、前の表の本体か表題に当たるまでさかのぼり、
 * columns の範囲のセルを上から順につなげる。
 */
function headerName(rows: Row[], i: number, columns: number[]): string {
  let name = "";
  for (let k = i - 1; k >= Math.max(0, i - 5); k--) {
    const r = rows[k]!;
    if (isTitleOrNote(r) || r.some((v, c) => c > 0 && isCount(v))) break;
    name = columns.map((c) => cell(r, c)).join("") + name;
  }
  return name;
}

/**
 * 党の見出しの読み方。
 * 「その他」「本人・推薦届出」は、政党等所属・無所属・小計の3列をくくる上位の見出しなので外す
 * （どの列の上に置かれるかは回と形式で違う）。
 * 「政党等所属」は届出政党でない政治団体の候補。得票の表では「諸派」と呼ぶので、そちらに揃える
 * （第51回は表でも「諸派」）。「小計」は諸派と無所属の和なので読まない（SKIP）。
 * null は見出しのない列で、値があってはいけない。
 */
const SKIP = "小計";

function partyName(raw: string): string | null {
  const header = raw.replace(/^(その他|本人・推薦届出)/, "");
  if (header === "") return null;
  if (header === "政党等所属") return "諸派";
  if (/^(区分|定数|都道府県)$/.test(header)) throw new Error(`党名が読めない列: ${header}`);
  return header;
}

const zeros = (n: number) => Array.from({ length: n }, () => 0);

function mergeParty(target: Map<string, PartyCounts>, name: string, value: PartyCounts): void {
  if (target.has(name)) throw new Error(`党名が重複: ${name}`);
  target.set(name, value);
}

/**
 * 党派別男女別新前元別の候補者数・当選人数（小選挙区、比例代表）。
 *
 * 党ごとに男・女・計の3列。行は 小選挙区・比例代表・候補者数計（当選人は合計）の3区分で、
 * それぞれ 新・前・元・計 の4行。候補者の表では、比例代表の各行の下に重複立候補者数（内書）の行が付く。
 * 重複立候補者のいない党しか載らないページでは、その行ごと省かれる。
 */
export function parsePartyTable(rows: Row[], hasDual: boolean): {
  parties: Record<string, PartyCounts>;
  total: PartyCounts;
} {
  const parties = new Map<string, PartyCounts>();

  rows.forEach((row, i) => {
    const totals = row
      .map((_, c) => c)
      .filter((c) => cell(row, c) === "計" && cell(row, c - 2) === "男" && cell(row, c - 1) === "女");
    if (totals.length === 0) return;

    const columns = totals.map((c) => ({ col: c, name: partyName(headerName(rows, i, [c - 2, c - 1, c])) }));
    const values = columns.map(
      (): PartyCounts => ({ smd: zeros(6), pr: zeros(6), all: zeros(6), ...(hasDual ? { prDual: zeros(6) } : {}) }),
    );

    // 比例代表の計の行の下には内書の行が来得るので、区分を進めるのは次の行を見てから。
    let block = 0;
    let pending = false;
    let last = -1;
    for (let k = i + 1; k < rows.length && block < SYSTEMS.length; k++) {
      const r = rows[k]!;
      const label = cell(r, 1);
      const status = label === "計" ? 3 : STATUS.indexOf(label as (typeof STATUS)[number]);
      const hasValues = columns.some(({ col }) =>
        [col - 2, col - 1, col].some((c) => isCount(r[c]) && count(r[c]) > 0),
      );

      if (status < 0) {
        if (!hasValues) continue;
        // 区分のない行に値があるのは、比例代表の重複立候補者数（内書）だけ。
        if (!hasDual || SYSTEMS[block] !== "pr" || last < 0) throw new Error(`${k}行目: 区分のない行に値がある`);
        read(r, k, "prDual", last);
        last = -1;
        if (pending) {
          block++;
          pending = false;
        }
        continue;
      }
      if (pending) {
        block++;
        pending = false;
      }
      read(r, k, SYSTEMS[block]!, status);
      last = status;
      if (status === 3) {
        if (SYSTEMS[block] === "pr" && hasDual) pending = true;
        else block++;
      }
    }
    if (pending) block++;
    if (block !== SYSTEMS.length) throw new Error(`${i}行目: 表の区分が ${block} 個しかない`);

    function read(r: Row, k: number, system: keyof PartyCounts, status: number): void {
      columns.forEach(({ col, name }, p) => {
        const [m, f, t] = [col - 2, col - 1, col].map((c) => count(r[c])) as [number, number, number];
        if (name === null) {
          if (m + f + t > 0) throw new Error(`${k}行目: 党名のない列 ${col} に値がある`);
          return;
        }
        if (name === SKIP) return;
        if (m + f !== t) throw new Error(`${k}行目 ${name}: 男 ${m} + 女 ${f} ≠ 計 ${t}`);
        const target = values[p]![system]!;
        if (status < 3) {
          target[status * 2] = m;
          target[status * 2 + 1] = f;
        } else {
          const sum = (sex: number) => target[sex]! + target[2 + sex]! + target[4 + sex]!;
          if (sum(0) !== m || sum(1) !== f) throw new Error(`${k}行目 ${name}: 新前元の和 ≠ 計`);
        }
      });
    }

    columns.forEach(({ name }, p) => {
      if (name !== null && name !== SKIP) mergeParty(parties, name, values[p]!);
    });
  });

  const total = parties.get(TOTAL);
  if (total === undefined) throw new Error("合計の列がない");
  parties.delete(TOTAL);
  return { parties: Object.fromEntries(parties), total };
}

/**
 * 都道府県別党派別新前元別の候補者数・当選人数（小選挙区）。党ごとに新・前・元・計の4列。
 * 「計」の行は全国。定数の列は最初の表から取る。
 */
export function parsePrefTable(rows: Row[]): {
  districts: Record<string, number>;
  prefs: Record<string, Record<string, Status>>;
  national: Record<string, Status>;
} {
  const byArea = new Map<string, Map<string, Status>>();
  const districts = new Map<string, number>();

  rows.forEach((row, i) => {
    const totals = row
      .map((_, c) => c)
      .filter(
        (c) =>
          cell(row, c) === "計" && cell(row, c - 3) === "新" && cell(row, c - 2) === "前" && cell(row, c - 1) === "元",
      );
    if (totals.length === 0) return;
    const columns = totals.map((c) => ({
      col: c,
      name: partyName(headerName(rows, i, [c - 3, c - 2, c - 1, c])),
    }));
    const seatsCol = totals[0]! - 4;

    for (let k = i + 1; k < rows.length; k++) {
      const r = rows[k]!;
      const area = cell(r, 0);
      if (!PREF_SET.has(area) && area !== "計") {
        if (r.every((v) => clean(v) === "")) continue;
        break;
      }
      const seats = count(r[seatsCol]);
      const known = districts.get(area);
      if (known !== undefined && known !== seats) throw new Error(`${area}: 定数が表によって違う ${known} ≠ ${seats}`);
      districts.set(area, seats);

      const parties = byArea.get(area) ?? new Map<string, Status>();
      for (const { col, name } of columns) {
        const [a, b, c, t] = [col - 3, col - 2, col - 1, col].map((cc) => count(r[cc])) as [number, number, number, number];
        if (name === null) {
          if (a + b + c + t > 0) throw new Error(`${k}行目: 党名のない列 ${col} に値がある`);
          continue;
        }
        if (name === SKIP) continue;
        if (a + b + c !== t) throw new Error(`${k}行目 ${area} ${name}: 新前元の和 ${a + b + c} ≠ 計 ${t}`);
        if (parties.has(name)) throw new Error(`${area}: 党名が重複 ${name}`);
        if (t > 0 || name === TOTAL) parties.set(name, [a, b, c]);
      }
      byArea.set(area, parties);
    }
  });

  const national = byArea.get("計");
  if (national === undefined) throw new Error("計（全国）の行がない");
  const prefs: Record<string, Record<string, Status>> = {};
  const seats: Record<string, number> = {};
  for (const pref of PREFECTURES) {
    const parties = byArea.get(pref);
    if (parties === undefined) throw new Error(`${pref} の行がない`);
    prefs[pref] = Object.fromEntries(parties);
    seats[pref] = districts.get(pref)!;
  }
  return { districts: seats, prefs, national: Object.fromEntries(national) };
}

/** 都道府県別年齢段階別の候補者数・当選人数（小選挙区）。「計」の行は全国。 */
export function parseAgeTable(rows: Row[]): { ages: Record<string, number[]>; national: number[] } {
  const header = rows.findIndex((r) => r.some((v) => clean(v) === "以上"));
  if (header < 0) throw new Error("年齢段階の見出し（以上）がない");
  const bands = rows[header]!.map((_, c) => c).filter((c) => /(歳|以上)$/.test(cell(rows[header], c)));
  if (bands.length !== AGE_BANDS.length) throw new Error(`年齢段階が ${bands.length} 列ある`);
  const totalCol = rows
    .slice(Math.max(0, header - 2), header)
    .flatMap((r) => r.map((_, c) => c).filter((c) => cell(r, c) === "計"))[0];
  if (totalCol === undefined) throw new Error("年齢段階の表に計の列がない");

  const byArea = new Map<string, number[]>();
  for (let k = header + 1; k < rows.length; k++) {
    const r = rows[k]!;
    const area = cell(r, 0);
    if (!PREF_SET.has(area) && area !== "計") {
      if (r.every((v) => clean(v) === "")) continue;
      break;
    }
    const values = bands.map((c) => count(r[c]));
    const sum = values.reduce((a, b) => a + b, 0);
    if (sum !== count(r[totalCol])) throw new Error(`${area}: 年齢段階の和 ${sum} ≠ 計 ${count(r[totalCol])}`);
    byArea.set(area, values);
  }

  const national = byArea.get("計");
  if (national === undefined) throw new Error("年齢段階の表に計（全国）の行がない");
  const ages: Record<string, number[]> = {};
  for (const pref of PREFECTURES) {
    const v = byArea.get(pref);
    if (v === undefined) throw new Error(`年齢段階の表に ${pref} の行がない`);
    ages[pref] = v;
  }
  return { ages, national };
}
