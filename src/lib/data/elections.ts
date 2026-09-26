/**
 * 対象とする総選挙の目録。出典の正本は docs/data-sources.md。
 *
 * 候補者・当選人の党派別・都道府県別・年齢段階別の表が回ごとに公開されているのは第44回から。
 */

export type Edition = "確定" | "速報";

/** 総務省の結果調から取る表。cand は候補者数、win は当選人数。 */
export const TABLES = ["candParty", "candPref", "candAge", "winParty", "winPref", "winAge"] as const;
export type TableId = (typeof TABLES)[number];

export interface Source {
  url: string;
  format: "xls" | "xlsx" | "pdf";
}

export interface Election {
  n: number;
  date: string;
  edition: Edition;
  /** 定数（小選挙区・比例代表）。 */
  seats: { smd: number; pr: number };
  page: string;
  tables: Record<TableId, Source>;
}

const MAIN = "https://www.soumu.go.jp/main_content/";
const PAGE = (n: number) =>
  `https://www.soumu.go.jp/senkyo/senkyo_s/data/shugiin${n}/index.html`;
const H17 = "https://www.soumu.go.jp/senkyo/senkyo_s/data/shugiin44/pdf/h17sousenkyo_050911_";

const x = (id: string): Source => ({ url: `${MAIN}${id}`, format: id.endsWith(".xlsx") ? "xlsx" : "xls" });
const pdf = (id: string): Source => ({ url: `${H17}${id}.pdf`, format: "pdf" });

/** TABLES と同じ並び。 */
const tables = (...sources: Source[]) =>
  Object.fromEntries(TABLES.map((t, i) => [t, sources[i]!])) as Record<TableId, Source>;

export const ELECTIONS: Election[] = [
  {
    n: 44,
    date: "2005-09-11",
    edition: "確定",
    seats: { smd: 300, pr: 180 },
    page: PAGE(44),
    tables: tables(pdf("01_01"), pdf("01_02"), pdf("01_03"), pdf("03_01"), pdf("03_02"), pdf("03_03")),
  },
  {
    n: 45,
    date: "2009-08-30",
    edition: "確定",
    seats: { smd: 300, pr: 180 },
    page: PAGE(45),
    tables: tables(
      x("000037604.xls"), x("000037606.xls"), x("000037608.xls"),
      x("000037622.xls"), x("000037623.xls"), x("000037625.xls"),
    ),
  },
  {
    n: 46,
    date: "2012-12-16",
    edition: "確定",
    seats: { smd: 300, pr: 180 },
    page: PAGE(46),
    tables: tables(
      x("000194169.xls"), x("000194176.xls"), x("000194177.xls"),
      x("000194183.xls"), x("000194184.xls"), x("000194185.xls"),
    ),
  },
  {
    n: 47,
    date: "2014-12-14",
    edition: "確定",
    seats: { smd: 295, pr: 180 },
    page: PAGE(47),
    tables: tables(
      x("000328937.xls"), x("000328938.xls"), x("000328939.xls"),
      x("000328943.xls"), x("000328944.xls"), x("000328945.xls"),
    ),
  },
  {
    n: 48,
    date: "2017-10-22",
    edition: "確定",
    seats: { smd: 289, pr: 176 },
    page: PAGE(48),
    tables: tables(
      x("000516712.xls"), x("000516713.xls"), x("000516714.xls"),
      x("000516719.xls"), x("000516720.xls"), x("000516721.xls"),
    ),
  },
  {
    n: 49,
    date: "2021-10-31",
    edition: "確定",
    seats: { smd: 289, pr: 176 },
    page: PAGE(49),
    tables: tables(
      x("000776960.xls"), x("000776961.xls"), x("000776962.xls"),
      x("000776967.xls"), x("000776968.xls"), x("000776969.xls"),
    ),
  },
  {
    n: 50,
    date: "2024-10-27",
    edition: "速報",
    seats: { smd: 289, pr: 176 },
    page: PAGE(50),
    tables: tables(
      x("000979115.xls"), x("000979116.xls"), x("000979117.xls"),
      x("000979122.xls"), x("000979123.xls"), x("000979124.xls"),
    ),
  },
  {
    n: 51,
    date: "2026-02-08",
    edition: "速報",
    seats: { smd: 289, pr: 176 },
    page: PAGE(51),
    tables: tables(
      x("001061468.xlsx"), x("001061469.xlsx"), x("001061470.xlsx"),
      x("001061475.xlsx"), x("001061476.xlsx"), x("001061477.xlsx"),
    ),
  },
];

/** 年齢段階（小選挙区の表の列）。 */
export const AGE_BANDS = [
  "25〜29歳", "30〜34歳", "35〜39歳", "40〜44歳", "45〜49歳",
  "50〜54歳", "55〜59歳", "60〜64歳", "65〜69歳", "70歳以上",
] as const;
