/** 新前元 × 男女の人数。[新男, 新女, 前男, 前女, 元男, 元女]。 */
export type SexStatus = number[];

/** 新前元の人数。[新, 前, 元]。 */
export type Status = number[];

/**
 * 党派別男女別新前元別の表の1列（1党）。
 * all は「候補者数計」（候補者）または「合計」（当選人）。候補者の all は重複立候補者を1人と数える。
 */
export interface PartyCounts {
  smd: SexStatus;
  pr: SexStatus;
  all: SexStatus;
  /** 比例代表のうち重複立候補者（内書）。候補者の表だけにある。 */
  prDual?: SexStatus;
}

/** 候補者または当選人。 */
export interface Side {
  /** 党派別男女別新前元別（全国）。 */
  parties: Record<string, PartyCounts>;
  /** 同じ表の「合計」列。 */
  total: PartyCounts;
  /** 都道府県別党派別新前元別（小選挙区）。都道府県 → 党 → 新前元。人数 0 の党は持たない。 */
  prefs: Record<string, Record<string, Status>>;
  /** 同じ表の「計」の行（全国）。 */
  prefNational: Record<string, Status>;
  /** 都道府県別年齢段階別（小選挙区）。都道府県 → 年齢段階。 */
  ages: Record<string, number[]>;
  /** 同じ表の「計」の行（全国）。 */
  ageNational: number[];
}

export interface NormalizedElection {
  n: number;
  /** 都道府県ごとの小選挙区の数（定数）。 */
  districts: Record<string, number>;
  candidates: Side;
  winners: Side;
}
