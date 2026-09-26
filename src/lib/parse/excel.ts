/**
 * 総務省の結果調 Excel（.xls / .xlsx）を行 × 列のセルとして読む。
 */

import * as fs from "node:fs";
import * as XLSX from "xlsx";
import * as cptable from "xlsx/dist/cpexcel.full.mjs";
import type { Row } from "./tables.ts";

XLSX.set_fs(fs);
XLSX.set_cptable(cptable);

/** すべてのシートを上から順につなげた行。 */
export function readRows(path: string): Row[] {
  const wb = XLSX.readFile(path);
  return wb.SheetNames.flatMap((name) =>
    XLSX.utils.sheet_to_json<Row>(wb.Sheets[name]!, { header: 1, raw: true, defval: "" }),
  );
}
