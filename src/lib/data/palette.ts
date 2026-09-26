/**
 * ツール全体の配色ルール。色空間は CIE HCL（d3-color の hcl）。兄弟サイト（election-shugiin-timeseries）と同じ。
 *
 * - 色相は党を表す。党の色相は兄弟サイトが全国の得票から決めたもの（data/palette.json）を写して使う。
 *   例外は性別・新前元の内訳で、党と同じ画面に出さない区分なのでカテゴリカル配色（CATEGORICAL）で塗る。
 * - 明度は量か順序だけを表す。量を色で表すとき（地図）は割合→明度を全党共通にする。
 *   年齢段階の内訳は順序なので、無彩色の明度の段階（toneColor）で塗る。
 * - 彩度は sRGB の色域に収めるためだけに下げる。
 * - 党でないもの（諸派・無所属・その他）は無彩色。
 */

import { hcl } from "d3-color";

export const NEUTRAL = new Set(["諸派", "無所属", "その他"]);

/** 候補者か当選者の全国の割合が、一度でもこれに届いた党を主要な党とする。届かない党は積み上げで「その他」にまとめる。 */
export const MINOR = 0.02;

/** 基準明度。地図の明度関数で割合 56% に当たる。 */
export const BASE_L = 58;
const BASE_C = 55;

/** 割合 0 → 明度 96（紙色に近い）、100% → 28。 */
const L_AT_0 = 96;
const L_AT_1 = 28;

/** 明度と色相を保ったまま、表示できるまで彩度を下げる。 */
function fit(h: number, c: number, l: number): string {
  let chroma = c;
  while (chroma > 0 && !hcl(h, chroma, l).displayable()) chroma -= 1;
  return hcl(h, Math.max(0, chroma), l).formatHex();
}

/** 棒・一覧で使う党の色（全党同じ明度）。無彩色の党は hue = null。 */
export function baseColor(hue: number | null): string {
  return hue === null ? fit(0, 0, BASE_L) : fit(hue, BASE_C, BASE_L);
}

/** 地図で使う色。明度は全党共通の割合の関数。 */
export function shareColor(hue: number | null, share: number): string {
  const v = Math.min(1, Math.max(0, share));
  const l = L_AT_0 + (L_AT_1 - L_AT_0) * v;
  const c = hue === null ? 0 : 12 + 48 * Math.min(1, v / 0.5);
  return fit(hue ?? 0, c, l);
}

/** 強調しない要素。明度を紙色へ寄せ、彩度を落とす。全画面で同じ割合。 */
export function fadedColor(hue: number | null): string {
  return fit(hue ?? 0, hue === null ? 0 : BASE_C * 0.3, BASE_L + (94 - BASE_L) * 0.75);
}

/**
 * 性別・新前元の内訳のカテゴリカル配色。Okabe–Ito の配色（色覚の型によらず見分けやすい8色）から取る。
 * 隣り合う区分は暖色と寒色を交互にする（出典の勧め）。
 * 出典: Okabe & Ito, Color Universal Design, Fig. 16 "Colorblind barrier-free color pallet"
 * https://jfly.uni-koeln.de/color/#pallet の R,G,B（0–255）。
 */
export const CATEGORICAL = {
  orange: "#e69f00",
  skyBlue: "#56b4e9",
  bluishGreen: "#009e73",
  blue: "#0072b2",
  vermilion: "#d55e00",
} as const;

/**
 * 順序のある内訳（年齢段階）の段階色。step は 0（最も濃い）〜 1（最も淡い）。
 * 濃い側を積み上げの底に置き、読ませたい区分（若い層）を底から測れるようにする。
 */
export function toneColor(hue: number | null, step: number): string {
  const l = 34 + (88 - 34) * step;
  return hue === null ? fit(0, 0, l) : fit(hue, BASE_C * (1 - 0.6 * step), l);
}

/** 党の色一式。画面はこれだけを使う。 */
export interface PartyColors {
  base: string;
  faded: string;
  hue: number | null;
}

export function colorsOf(hues: Record<string, number>, party: string): PartyColors {
  const hue = NEUTRAL.has(party) ? null : (hues[party] ?? null);
  return { base: baseColor(hue), faded: fadedColor(hue), hue };
}
