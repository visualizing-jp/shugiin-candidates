/**
 * 配信データ（public/data/*.json）の型。scripts/build.ts が書き、画面が読む。
 * 回のメタ情報（執行日・版・定数）は elections.ts を正本とし、ここには回番号だけ持つ。
 */

/** smd 小選挙区、pr 比例代表、all 全体（重複立候補者は1人と数える）。 */
export type System = "smd" | "pr" | "all";

/** cand 候補者、win 当選者。 */
export type Kind = "cand" | "win";

/**
 * 全国。counts[候補者/当選者][制度][党][回] = [新男, 新女, 前男, 前女, 元男, 元女]。
 * その回に候補のない党は 0 が並ぶ。
 */
export interface NationalJson {
  elections: number[];
  parties: string[];
  counts: Record<Kind, Record<System, number[][][]>>;
}

/**
 * 都道府県（小選挙区）。
 * districts[回][県] は小選挙区の数、counts[候補者/当選者][党][回][県] は人数、
 * ages[候補者/当選者][回][県] は年齢段階（elections.ts の AGE_BANDS）ごとの人数。
 */
export interface PrefJson {
  elections: number[];
  prefs: string[];
  parties: string[];
  districts: number[][];
  counts: Record<Kind, number[][][]>;
  ages: Record<Kind, number[][][]>;
}
