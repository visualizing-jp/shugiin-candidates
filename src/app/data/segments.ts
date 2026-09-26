/**
 * 積み上げの組み立て。色は配色ルール（lib/data/palette.ts）から受け取る。
 */

import { AGE_BANDS } from "../../lib/data/elections.ts";
import { CATEGORICAL, MINOR, toneColor } from "../../lib/data/palette.ts";
import type { Palette } from "./load.ts";

export interface Segment {
  key: string;
  value: number;
  color: string;
  /** 他の区分を強調しているときの色。 */
  faded: string;
}

export const OTHER = "その他";

/** 無所属・諸派は「その他」に混ぜず、いつも独立した系列として一番上に置く。 */
export const TRAILING = ["諸派", "無所属"];

/** 人数の並び [新男, 新女, 前男, 前女, 元男, 元女] の和。 */
export const total = (v: number[]) => v.reduce((a, b) => a + b, 0);

/**
 * 内訳の区分。index は [新男, 新女, 前男, 前女, 元男, 元女]（年齢は年齢段階）のどれを足すか。
 * 読ませたい区分（女性・新人・若い層）を底に置く。
 */
export interface Part {
  key: string;
  index: number[];
  color: string;
}

export const SEX: Part[] = [
  { key: "女性", index: [1, 3, 5], color: CATEGORICAL.vermilion },
  { key: "男性", index: [0, 2, 4], color: CATEGORICAL.skyBlue },
];

export const STATUS: Part[] = [
  { key: "新人", index: [0, 1], color: CATEGORICAL.bluishGreen },
  { key: "元職", index: [4, 5], color: CATEGORICAL.orange },
  { key: "前職", index: [2, 3], color: CATEGORICAL.blue },
];

/** 年齢段階（5歳刻み）を10歳刻みにまとめる。25〜29歳は20代。年代は順序なので明度の段階で塗る。 */
export const AGE_GROUPS: Part[] = [
  { key: "20代", index: [0] },
  { key: "30代", index: [1, 2] },
  { key: "40代", index: [3, 4] },
  { key: "50代", index: [5, 6] },
  { key: "60代", index: [7, 8] },
  { key: "70歳以上", index: [9] },
].map((g, i, all) => ({ ...g, color: toneColor(null, i / (all.length - 1)) }));

if (import.meta.env.DEV && AGE_GROUPS.flatMap((g) => g.index).length !== AGE_BANDS.length) {
  throw new Error("年齢のまとめ方が年齢段階の数と合わない");
}

/** 区分ごとの積み上げ（下から）。 */
export function partSegments(parts: Part[], values: number[]): Segment[] {
  return parts.map((p) => ({
    key: p.key,
    value: p.index.reduce((a, i) => a + values[i]!, 0),
    color: p.color,
    faded: p.color,
  }));
}

/**
 * 「その他」にまとめない党。この制度で全国の候補者か当選者の割合が一度でも MINOR に届いた党。
 * cand[党][回]・win[党][回] は全国の人数。
 */
export function majorParties(parties: string[], cand: number[][], win: number[][]): Set<string> {
  const share = (rows: number[][], i: number, e: number) => {
    const sum = rows.reduce((a, r) => a + r[e]!, 0);
    return sum === 0 ? 0 : rows[i]![e]! / sum;
  };
  return new Set(
    parties.filter(
      (p, i) =>
        TRAILING.includes(p) ||
        cand[i]!.some((_, e) => share(cand, i, e) >= MINOR || share(win, i, e) >= MINOR),
    ),
  );
}

/**
 * 党の積み上げ（下から）。主要な党 → 選択中の小党 → その他 → 諸派・無所属。
 * values は parties と同じ並びの人数。
 */
export function partySegments(
  parties: string[],
  values: number[],
  major: Set<string>,
  selected: string,
  palette: Palette,
): Segment[] {
  const segment = (key: string, value: number): Segment => {
    const c = palette(key);
    return { key, value, color: c.base, faded: c.faded };
  };
  const main: Segment[] = [];
  const trailing: Segment[] = [];
  let pickedMinor: Segment | null = null;
  let other = 0;
  parties.forEach((p, i) => {
    const v = values[i]!;
    if (v === 0) return;
    if (TRAILING.includes(p)) trailing.push(segment(p, v));
    else if (major.has(p)) main.push(segment(p, v));
    else if (p === selected) pickedMinor = segment(p, v);
    else other += v;
  });
  return [
    ...main,
    ...(pickedMinor === null ? [] : [pickedMinor]),
    ...(other > 0 ? [segment(OTHER, other)] : []),
    ...trailing,
  ];
}
