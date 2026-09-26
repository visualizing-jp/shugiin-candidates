import { ELECTIONS, type Election } from "../../lib/data/elections.ts";

const int = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 });
const one = new Intl.NumberFormat("ja-JP", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function people(n: number): string {
  return `${int.format(n)}人`;
}

export function num(n: number): string {
  return int.format(n);
}

export function pct(share: number): string {
  return `${one.format(share * 100)}%`;
}

/** 分母が 0 のときは割合を出さない。 */
export function ratio(part: number, whole: number): string {
  return whole === 0 ? "—" : pct(part / whole);
}

const BY_N = new Map(ELECTIONS.map((e) => [e.n, e]));

export function election(n: number): Election {
  const e = BY_N.get(n);
  if (e === undefined) throw new Error(`第${n}回は目録にない`);
  return e;
}

export function year(n: number): string {
  return election(n).date.slice(0, 4);
}

export function longDate(n: number): string {
  const [y, m, d] = election(n).date.split("-").map(Number);
  return `${y}年${m}月${d}日`;
}
