/**
 * PDF しかない回（第44回）の表を、Excel と同じ行 × 列のセルに組み直す。
 *
 * `pdftotext -bbox`（poppler）で語ごとの位置を取り、次の決まりで列に割り当てる。
 * - 列は、表の見出しの小見出し（男・女・計、新・前・元・計、25歳・30歳…）1つにつき1列。
 * - 数値は列の右端に揃っているので、数値の右端より左に右端がある最後の小見出しをその列とする。
 * - 党名などの文字は、中心が最も近い小見出しの列に置く。
 * - 最初の小見出しより左は地域名・区分の欄。区分の欄が2つある表では、左端の縦書きの欄と、その右の新前元の欄に分ける。
 * 空欄は詰まらずに位置で決まるので、Excel の空セルと同じになる。
 */

import { execFileSync } from "node:child_process";
import type { Row } from "./tables.ts";

interface Word {
  x0: number;
  x1: number;
  y: number;
  text: string;
}

const NUMBER = /^\d[\d,]*$/;
/** 同じ行とみなす縦位置の幅（pt）。行の間隔はどの表も 9pt 以上ある。 */
const LINE = 4;
/** 縦書きの区分の欄と新前元の欄を分ける幅（pt）。 */
const LABEL_GAP = 12;

/**
 * 重複立候補者数（内書）の「( 73)」は「(」と「73)」の2語に分かれる。括弧は位置を狂わせないよう語ごと落とす。
 * 表題の「(1)」は1語なのでそのまま残る。
 */
function words(page: string): Word[] {
  return [...page.matchAll(/xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</g)]
    .map((m) => ({
      x0: Number(m[1]),
      x1: Number(m[3]),
      y: (Number(m[2]) + Number(m[4])) / 2,
      text: unescape(m[5]!).normalize("NFKC").replace(/^(\d[\d,]*)\)$/, "$1"),
    }))
    .filter((w) => w.text !== "(" && w.text !== ")");
}

function unescape(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function lines(ws: Word[]): Word[][] {
  const sorted = [...ws].sort((a, b) => a.y - b.y);
  const out: Word[][] = [];
  for (const w of sorted) {
    const line = out.at(-1);
    if (line !== undefined && w.y - line[0]!.y <= LINE) line.push(w);
    else out.push([w]);
  }
  return out.map((l) => l.sort((a, b) => a.x0 - b.x0));
}

/**
 * @param isAnchor 小見出しの語か。列はこの語だけから作る。
 * @param labelColumns 最初の小見出しより左の欄の数（1: 地域名、2: 縦書きの区分と新前元）。
 */
export function readPdfRows(path: string, isAnchor: (text: string) => boolean, labelColumns: 1 | 2): Row[] {
  const xml = execFileSync("pdftotext", ["-bbox", path, "-"], { encoding: "utf8" });
  return xml
    .split("<page ")
    .slice(1)
    .flatMap((page) => pageRows(lines(words(page)), isAnchor, labelColumns));
}

function pageRows(ls: Word[][], isAnchor: (text: string) => boolean, labelColumns: 1 | 2): Row[] {
  const body = ls.findIndex((l) => l.some((w) => NUMBER.test(w.text)));
  if (body < 0) return [];
  // 小見出しは1行に並ぶ。見出しの「小 計」「合 計」の字を拾わないよう、小見出しの最も多い行を使う。
  // 年齢段階の表だけは「計」が1段上にあるので、その行より右にある小見出しを足す。
  const header = ls.slice(0, body).map((l) => l.filter((w) => isAnchor(w.text)));
  const main = header.reduce((a, b) => (b.length > a.length ? b : a), []);
  if (main.length === 0) throw new Error(`見出しに小見出しがないページ`);
  const right = main.at(-1)!.x1;
  const anchors = [...main, ...header.flat().filter((w) => w.x0 > right)].sort((a, b) => a.x0 - b.x0);

  const labelEdge = anchors[0]!.x0 - 2;
  const leftmost = Math.min(...ls.slice(body).flat().filter((w) => w.x1 < labelEdge).map((w) => w.x0));

  return ls.map((line) => {
    const row: string[] = Array.from({ length: labelColumns + anchors.length }, () => "");
    const put = (c: number, text: string) => {
      row[c] += text;
    };
    for (const w of line) {
      if (w.x1 < labelEdge) {
        put(labelColumns === 2 && w.x0 > leftmost + LABEL_GAP ? 1 : 0, w.text);
      } else if (NUMBER.test(w.text)) {
        let c = -1;
        anchors.forEach((a, i) => {
          if (a.x1 <= w.x1 + 1) c = i;
        });
        if (c < 0) throw new Error(`y=${w.y.toFixed(0)} x=${w.x0.toFixed(0)}: 列に当たらない数値 ${w.text}`);
        put(labelColumns + c, w.text);
      } else {
        const center = (w.x0 + w.x1) / 2;
        let best = 0;
        anchors.forEach((a, i) => {
          if (Math.abs((a.x0 + a.x1) / 2 - center) < Math.abs((anchors[best]!.x0 + anchors[best]!.x1) / 2 - center)) best = i;
        });
        put(labelColumns + best, w.text);
      }
    }
    return row;
  });
}
