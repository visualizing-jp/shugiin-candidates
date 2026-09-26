/**
 * 年齢ビュー（小選挙区）。年代ごとの候補者と当選者を、選んだ回の内訳と回ごとの推移で見せる。
 * 結果調の年齢段階別の表は小選挙区だけで、党派別・男女別の内訳はない。
 */

import { use, useMemo } from "react";
import type { Kind } from "../../lib/data/cube.ts";
import { toneColor } from "../../lib/data/palette.ts";
import { loadPref } from "../data/load.ts";
import { election, longDate, people, ratio } from "../data/format.ts";
import { AGE_GROUPS, partSegments } from "../data/segments.ts";
import { AgeBars } from "../components/AgeBars.tsx";
import { CountList, CountListHeader, type CountRow } from "../components/CountList.tsx";
import { ElectionSelect } from "../components/ElectionSelect.tsx";
import { PairedBars, type Measure, type Pair } from "../components/PairedBars.tsx";
import { Preliminary } from "../components/Preliminary.tsx";
import { Segmented } from "../components/Segmented.tsx";
import { useUrlState } from "../hooks/useUrlState.ts";

const MEASURES = [
  { value: "share", label: "割合" },
  { value: "count", label: "人数" },
] as const;

/** 若い層・高い層として要約に出す年代。 */
const YOUNG = ["20代", "30代"];
const OLD = ["60代", "70歳以上"];

const add = (a: number[], b: number[]) => a.map((v, i) => v + b[i]!);

export function AgeView() {
  const data = use(loadPref());
  const last = data.elections.at(-1)!;

  const [nParam, setN] = useUrlState<string>("n", String(last), (v) => data.elections.includes(Number(v)));
  const [area, setArea] = useUrlState<string>("area", "", (v) => data.prefs.includes(v));
  const [measure, setMeasure] = useUrlState<Measure>("measure", "share", (v) => v === "share" || v === "count");
  const n = Number(nParam);
  const ei = data.elections.indexOf(n);
  const ai = area === "" ? -1 : data.prefs.indexOf(area);

  /** bands[候補者/当選者][回]：選んだ地域の年齢段階ごとの人数。 */
  const bands = useMemo(() => {
    const of = (kind: Kind) =>
      data.ages[kind].map((byPref) => (ai < 0 ? byPref.reduce((acc, v) => add(acc, v), byPref[0]!.map(() => 0)) : byPref[ai]!));
    return { cand: of("cand"), win: of("win") };
  }, [data, ai]);

  const pairs = useMemo(
    (): Pair[] =>
      data.elections.map((en, e) => ({
        n: en,
        cand: partSegments(AGE_GROUPS, bands.cand[e]!),
        win: partSegments(AGE_GROUPS, bands.win[e]!),
      })),
    [data.elections, bands],
  );

  const focus = pairs[ei]!;
  const sum = (kind: "cand" | "win", keys?: string[]) =>
    focus[kind].filter((s) => keys === undefined || keys.includes(s.key)).reduce((a, s) => a + s.value, 0);
  const groups = focus.cand.map((s, i) => ({ key: s.key, cand: s.value, win: focus.win[i]!.value, color: toneColor(null, 0) }));

  const areaRows = useMemo(
    (): CountRow[] =>
      data.prefs.map((name, i) => ({
        key: name,
        cand: data.ages.cand[ei]![i]!.reduce((a, b) => a + b, 0),
        win: data.ages.win[ei]![i]!.reduce((a, b) => a + b, 0),
      })),
    [data, ei],
  );
  const where = area === "" ? "全国" : area;

  return (
    <div className="mx-auto flex w-full max-w-[1240px] gap-8 px-6 py-6 max-lg:flex-col-reverse">
      <aside className="w-[300px] shrink-0 max-lg:w-full lg:sticky lg:top-6 lg:flex lg:max-h-[calc(100dvh-3rem)] lg:flex-col lg:self-start">
        <CountListHeader label={`${longDate(n)} 小選挙区`} />
        <CountList
          rows={areaRows}
          selected={area}
          onSelect={(p) => setArea(p === area ? "" : p)}
          none={{
            label: "全国",
            cand: areaRows.reduce((a, r) => a + r.cand, 0),
            win: areaRows.reduce((a, r) => a + r.win, 0),
          }}
        />
      </aside>

      <main className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center justify-between gap-3 pb-4">
          <h1 className="text-[19px] font-semibold tracking-tight">{where}の候補者と当選者の年代</h1>
          <ElectionSelect elections={data.elections} value={n} onChange={(v) => setN(String(v))} />
        </header>

        <p className="tnum min-h-9 pb-3 text-[12.5px]">
          <span className="font-semibold">
            第{n}回 {longDate(n)}
          </span>
          {election(n).edition === "速報" && <Preliminary />}
          <span className="text-muted">{` · 小選挙区 候補者 ${people(sum("cand"))} → 当選者 ${people(sum("win"))}`}</span>
          <span className="text-muted"> · </span>
          <span className="font-semibold">40歳未満</span>
          <span className="text-muted">{` 候補者の${ratio(sum("cand", YOUNG), sum("cand"))} → 当選者の${ratio(sum("win", YOUNG), sum("win"))}`}</span>
          <span className="text-muted"> · </span>
          <span className="font-semibold">60歳以上</span>
          <span className="text-muted">{` ${ratio(sum("cand", OLD), sum("cand"))} → ${ratio(sum("win", OLD), sum("win"))}`}</span>
        </p>

        <div className="grid gap-8 xl:grid-cols-[minmax(380px,0.8fr)_minmax(420px,1fr)]">
          <section aria-label={`第${n}回の年代別`} className="min-w-0">
            <h2 className="pb-2 text-[14px] font-semibold">
              第{n}回
              <span className="ml-2 text-[11px] font-normal text-muted">年代別の当選率</span>
            </h2>
            <AgeBars rows={groups} />
          </section>

          <section aria-label="推移" className="min-w-0">
            <h2 className="flex flex-wrap items-center justify-between gap-2 pb-2">
              <span className="text-[14px] font-semibold">
                {where}の推移
                <span className="ml-2 text-[11px] font-normal text-muted">小選挙区</span>
              </span>
              <Segmented label="尺度" options={MEASURES} value={measure} onChange={setMeasure} />
            </h2>
            <div className="flex h-5 flex-wrap items-center gap-x-3 pb-1 text-[11px] text-muted">
              {focus.cand.map((s) => (
                <span key={s.key} className="flex items-center gap-1">
                  <span aria-hidden className="size-[9px] rounded-[2px]" style={{ backgroundColor: s.color }} />
                  {s.key}
                </span>
              ))}
            </div>
            <PairedBars
              pairs={pairs}
              measure={measure}
              labelKey=""
              focused={n}
              onFocus={(v) => setN(String(v))}
              height={280}
              label={`${where}の小選挙区の年代別の候補者と当選者`}
            />
          </section>
        </div>

        <ul className="mt-5 flex flex-col gap-1 border-t border-rule pt-3 text-[11px] leading-relaxed text-muted">
          <li>各回の左の棒（候）が候補者、右の棒（当）が当選者。濃いほど若い。</li>
          <li>
            年齢は結果調の年齢段階（5歳刻み）を10歳刻みにまとめたもの。結果調の最も若い段階は25〜29歳なので、20代はこの段階だけ。
          </li>
          <li>結果調の年齢段階別の表は小選挙区だけで、党派別・男女別の内訳はない。比例代表だけの候補者は含まない。</li>
        </ul>
      </main>
    </div>
  );
}
