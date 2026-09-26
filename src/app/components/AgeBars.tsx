/**
 * 1回分の年代別の候補者と当選者。候補者の棒の中に当選者の棒を重ね、当選者が候補者の何割かを長さで見せる。
 * 棒の長さの基準はこの回の最大の年代の候補者数。
 */

import { num, ratio } from "../data/format.ts";

export interface AgeRow {
  key: string;
  cand: number;
  win: number;
  color: string;
}

export function AgeBars({ rows }: { rows: AgeRow[] }) {
  const max = Math.max(...rows.map((r) => r.cand), 1);
  return (
    <table className="tnum w-full border-collapse text-[12px]">
      <thead>
        <tr className="text-[10.5px] text-faint">
          <th className="w-[5.5rem] pb-1 text-left font-normal">年代</th>
          <th className="pb-1 text-left font-normal">
            <span className="mr-3 inline-flex items-center gap-1">
              <span aria-hidden className="inline-block size-[9px] rounded-[2px] bg-ink/[0.12]" />
              候補者
            </span>
            <span className="inline-flex items-center gap-1">
              <span aria-hidden className="inline-block size-[9px] rounded-[2px] bg-ink" />
              うち当選者
            </span>
          </th>
          <th className="w-[5.5rem] pb-1 text-right font-normal">当選/候補者</th>
          <th className="w-[4rem] pb-1 text-right font-normal">当選率</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className="border-t border-rule/70">
            <td className="py-[5px] text-muted">{r.key}</td>
            <td className="py-[5px] pr-3">
              <span className="relative block h-[12px] w-full">
                <span
                  className="absolute inset-0 origin-left bg-ink/[0.12] transition-transform duration-200 ease-out"
                  style={{ transform: `scaleX(${r.cand / max})` }}
                />
                <span
                  className="absolute inset-0 origin-left transition-transform duration-200 ease-out"
                  style={{ transform: `scaleX(${r.win / max})`, backgroundColor: r.color }}
                />
              </span>
            </td>
            <td className="py-[5px] text-right text-muted">
              {num(r.win)}/{num(r.cand)}
            </td>
            <td className="py-[5px] text-right font-medium">{ratio(r.win, r.cand)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
