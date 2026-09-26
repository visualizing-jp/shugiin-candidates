/**
 * 回ごとに「候補者」と「当選者」の2本の積み上げ棒を並べる。
 *
 * 選挙は年次の連続系列ではないので、回は等間隔に置き、回と回のあいだを線でつながない。
 * 割合では2本とも 100% に揃い、同じ区分の高さを左右で見比べられる。
 * 人数では当選者の棒の高さが定数そのものになる。
 */

import { scaleBand, scaleLinear } from "d3-scale";
import { election, num, pct, year } from "../data/format.ts";
import { total, type Segment } from "../data/segments.ts";
import { useWidth } from "../hooks/useWidth.ts";

export type Measure = "share" | "count";

export interface Pair {
  n: number;
  cand: Segment[];
  win: Segment[];
}

const SIDES = [
  { key: "cand", mark: "候" },
  { key: "win", mark: "当" },
] as const;

export function PairedBars({
  pairs,
  measure,
  highlighted = "",
  labelKey,
  focused,
  onFocus,
  height = 300,
  label,
}: {
  pairs: Pair[];
  measure: Measure;
  /** この区分だけを濃く描く。空文字なら全区分を同じ濃さで描く。 */
  highlighted?: string;
  /** この区分の値を棒の上に書く。 */
  labelKey: string;
  focused: number | null;
  onFocus: (n: number) => void;
  height?: number;
  label: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const M = { left: 46, right: 6, top: 18, bottom: 50 };
  const right = Math.max(M.left + 1, width - M.right);

  const max = Math.max(...pairs.flatMap((p) => [total(p.cand.map((s) => s.value)), total(p.win.map((s) => s.value))]), 1);
  const y = scaleLinear()
    .domain([0, measure === "share" ? 1 : max])
    .nice(4)
    .range([height - M.bottom, M.top]);
  const ticks = y.ticks(4);
  const tick = (v: number) => (measure === "share" ? `${Math.round(v * 100)}%` : num(v));

  const band = scaleBand<number>()
    .domain(pairs.map((p) => p.n))
    .range([M.left, right])
    .paddingInner(0.3)
    .paddingOuter(0.1);
  const gap = Math.max(2, band.bandwidth() * 0.06);
  const bw = (band.bandwidth() - gap) / 2;
  // 細い棒では数字が隣と重なる。値は要約の行と一覧にもあるので、書かずに済ませる。
  const showValues = bw >= 20;
  const showMarks = bw >= 9;

  const emphasized = (key: string) => highlighted === "" || key === highlighted;

  return (
    <div ref={ref} className="w-full">
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label} className="block">
          {ticks.map((t) => (
            <g key={t} transform={`translate(0,${y(t)})`}>
              <line x1={M.left} x2={width - M.right} className="stroke-rule" />
              <text x={M.left - 6} dy="0.32em" textAnchor="end" className="tnum fill-faint text-[10px]">
                {tick(t)}
              </text>
            </g>
          ))}

          {pairs.map((p) => {
            const x0 = band(p.n)!;
            const cx = x0 + band.bandwidth() / 2;
            const isFocused = p.n === focused;
            const hit = band.bandwidth() + band.step() * 0.3 * 0.9;
            return (
              <g
                key={p.n}
                role="button"
                tabIndex={0}
                aria-pressed={isFocused}
                aria-label={`第${p.n}回（${year(p.n)}年）`}
                onClick={() => onFocus(p.n)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    onFocus(p.n);
                  }
                }}
                className="group cursor-pointer outline-none"
              >
                <rect
                  x={cx - hit / 2}
                  width={hit}
                  y={M.top - 16}
                  height={height - M.top + 16 - 2}
                  rx={4}
                  className={`group-focus-visible:stroke-ink group-focus-visible:stroke-2 ${
                    isFocused ? "fill-ink/[0.045]" : "fill-transparent hover:fill-ink/[0.025]"
                  }`}
                />
                {SIDES.map(({ key, mark }, side) => {
                  const segments = p[key];
                  const sum = total(segments.map((s) => s.value));
                  const scale = (v: number) => (measure === "share" ? (sum === 0 ? 0 : v / sum) : v);
                  const x = x0 + side * (bw + gap);
                  let acc = 0;
                  const stacks = segments.map((s) => {
                    const bottom = y(acc);
                    acc += scale(s.value);
                    return { s, top: y(acc), bottom };
                  });
                  const pick = sum === 0 || !showValues ? undefined : stacks.find((st) => st.s.key === labelKey);
                  return (
                    <g key={key}>
                      {stacks.map(({ s, top, bottom }) => (
                        <rect
                          key={s.key}
                          x={x}
                          width={bw}
                          y={top}
                          height={Math.max(0, bottom - top - 0.5)}
                          fill={emphasized(s.key) ? s.color : s.faded}
                          className="transition-[fill] duration-150 ease-out"
                        >
                          <title>{`${key === "cand" ? "候補者" : "当選者"} ${s.key} ${num(s.value)}人（${pct(sum === 0 ? 0 : s.value / sum)}）`}</title>
                        </rect>
                      ))}
                      {pick !== undefined && (
                        // 数字はすぐ上の区分の色に重なるので、紙色で縁取ってどの色の上でも読めるようにする。
                        <text
                          x={x + bw / 2}
                          y={pick.top - 4}
                          textAnchor="middle"
                          stroke="var(--color-paper)"
                          strokeWidth={3}
                          strokeLinejoin="round"
                          paintOrder="stroke"
                          className="tnum pointer-events-none fill-ink text-[9.5px] font-semibold"
                        >
                          {measure === "share" ? pct(pick.s.value / sum).replace("%", "") : num(pick.s.value)}
                        </text>
                      )}
                      {showMarks && (
                        <text
                          x={x + bw / 2}
                          y={height - M.bottom + 11}
                          textAnchor="middle"
                          className="pointer-events-none fill-faint text-[9px]"
                        >
                          {mark}
                        </text>
                      )}
                    </g>
                  );
                })}
                <text
                  x={cx}
                  y={height - M.bottom + 26}
                  textAnchor="middle"
                  className={`tnum text-[10.5px] ${isFocused ? "fill-ink font-semibold" : "fill-muted"}`}
                >
                  {year(p.n)}
                </text>
                {election(p.n).edition === "速報" && (
                  <text x={cx} y={height - M.bottom + 38} textAnchor="middle" className="fill-ink text-[9px] font-semibold">
                    速報
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
