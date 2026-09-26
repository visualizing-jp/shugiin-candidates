/**
 * 都道府県ビュー（小選挙区）。回と党を選んで、県ごとの当選者・候補者を小選挙区の数に対する割合で塗り、
 * 選んだ県の回ごとの候補者と当選者を党の内訳で横に出す。
 */

import { use, useMemo } from "react";
import { prefCode } from "../../lib/data/areas.ts";
import type { Kind } from "../../lib/data/cube.ts";
import { loadPalette, loadPref } from "../data/load.ts";
import { election, longDate, people, ratio } from "../data/format.ts";
import { majorParties, partySegments } from "../data/segments.ts";
import { CountList, CountListHeader, type CountRow } from "../components/CountList.tsx";
import { ElectionSelect } from "../components/ElectionSelect.tsx";
import { PairedBars, type Pair } from "../components/PairedBars.tsx";
import { Preliminary } from "../components/Preliminary.tsx";
import { Segmented } from "../components/Segmented.tsx";
import { TileMap } from "../components/TileMap.tsx";
import { useUrlState } from "../hooks/useUrlState.ts";

const METRICS = [
  { value: "win", label: "当選" },
  { value: "cand", label: "擁立" },
] as const;

const METRIC_TEXT: Record<Kind, { noun: string; legend: string }> = {
  win: { noun: "当選者", legend: "当選者 ÷ 小選挙区の数" },
  cand: { noun: "候補者", legend: "候補者 ÷ 小選挙区の数" },
};

export function PrefView() {
  const data = use(loadPref());
  const palette = use(loadPalette());
  const last = data.elections.at(-1)!;

  const [nParam, setN] = useUrlState<string>("n", String(last), (v) => data.elections.includes(Number(v)));
  const [partyParam, setParty] = useUrlState<string>("party", "", (v) => data.parties.includes(v));
  const [metric, setMetric] = useUrlState<Kind>("metric", "win", (v) => v === "win" || v === "cand");
  const [area, setArea] = useUrlState<string>("area", "", (v) => data.prefs.includes(v));
  const n = Number(nParam);
  const ei = data.elections.indexOf(n);

  /** 全国の人数。heads[候補者/当選者][党][回]。 */
  const heads = useMemo(() => {
    const sum = (kind: Kind) => data.counts[kind].map((byElection) => byElection.map((row) => row.reduce((a, b) => a + b, 0)));
    return { cand: sum("cand"), win: sum("win") };
  }, [data]);
  const major = useMemo(() => majorParties(data.parties, heads.cand, heads.win), [data.parties, heads]);

  const rows = useMemo(
    (): CountRow[] =>
      data.parties
        .map((p, i) => {
          const c = palette(p);
          return { key: p, cand: heads.cand[i]![ei]!, win: heads.win[i]![ei]!, color: c.base, faded: c.faded };
        })
        .filter((r) => r.cand > 0)
        .sort((a, b) => b.win - a.win || b.cand - a.cand),
    [data.parties, heads, ei, palette],
  );

  // 選んだ党がこの回の小選挙区に候補を立てていなければ、この回の最大の党に落とす（URL の選択は残す）。
  const party = rows.some((r) => r.key === partyParam) ? partyParam : rows[0]!.key;
  const pi = data.parties.indexOf(party);
  const colors = palette(party);
  const row = rows.find((r) => r.key === party)!;
  const districts = data.districts[ei]!;
  const seats = districts.reduce((a, b) => a + b, 0);

  const values = data.counts[metric][pi]![ei]!;
  const cands = data.counts.cand[pi]![ei]!;
  const tiles = data.prefs.map((name, i) => ({
    code: prefCode(name),
    label: name,
    share: cands[i] === 0 ? null : Math.min(1, values[i]! / districts[i]!),
    text: cands[i] === 0 ? "—" : `${values[i]}/${districts[i]}`,
    title: `${name} ${METRIC_TEXT[metric].noun} ${values[i]}人・小選挙区 ${districts[i]}（候補者 ${cands[i]}人・当選者 ${data.counts.win[pi]![ei]![i]}人）`,
  }));

  const ranked = data.prefs
    .map((name, i) => ({ name, share: values[i]! / districts[i]!, count: values[i]!, seats: districts[i]! }))
    .filter((_, i) => cands[i]! > 0)
    .sort((a, b) => b.share - a.share || b.seats - a.seats);

  const ai = area === "" ? -1 : data.prefs.indexOf(area);
  const pairs = useMemo(
    (): Pair[] =>
      data.elections.map((en, e) => {
        const side = (kind: Kind) =>
          partySegments(
            data.parties,
            data.parties.map((_, p) => (ai < 0 ? heads[kind][p]![e]! : data.counts[kind][p]![e]![ai]!)),
            major,
            party,
            palette,
          );
        return { n: en, cand: side("cand"), win: side("win") };
      }),
    [data, heads, major, party, ai, palette],
  );

  return (
    <div className="mx-auto flex w-full max-w-[1240px] gap-8 px-6 py-6 max-lg:flex-col-reverse">
      <aside className="w-[300px] shrink-0 max-lg:w-full lg:sticky lg:top-6 lg:flex lg:max-h-[calc(100dvh-3rem)] lg:flex-col lg:self-start">
        <CountListHeader label={`党 ${rows.length}`} />
        <CountList rows={rows} selected={party} onSelect={setParty} />
        <p className="mt-2 border-t border-rule px-2 pt-2 text-[10.5px] leading-relaxed text-faint">
          小選挙区の全国の人数。党を選ぶと地図をその党で塗る。
        </p>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center justify-between gap-3 pb-4">
          <div className="flex min-w-0 items-baseline gap-3">
            <h1 className="flex min-w-0 items-center gap-2 text-[19px] font-semibold tracking-tight">
              <span aria-hidden className="size-[11px] shrink-0 rounded-[2px]" style={{ backgroundColor: colors.base }} />
              <span className="truncate">{party}</span>
            </h1>
            <p className="tnum shrink-0 text-[13px] text-muted">
              小選挙区 当選 {row.win}/{seats}・擁立 {row.cand}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented label="地図" options={METRICS} value={metric} onChange={setMetric} />
            <ElectionSelect elections={data.elections} value={n} onChange={(v) => setN(String(v))} />
          </div>
        </header>

        <p className="tnum min-h-9 pb-4 text-[12.5px] text-muted">
          {longDate(n)}
          {election(n).edition === "速報" && <Preliminary />}
          {` · 当選率 ${ratio(row.win, row.cand)}`}
          {ranked.length > 0 && ranked[0]!.count > 0 && (
            <>
              {" · 割合が最も高い "}
              <span className="font-semibold text-ink">
                {ranked[0]!.name} {ranked[0]!.count}/{ranked[0]!.seats}
              </span>
            </>
          )}
          {ranked.length < data.prefs.length && ` · 候補のいない都道府県 ${data.prefs.length - ranked.length}`}
        </p>

        <div className="grid gap-8 xl:grid-cols-[minmax(460px,1fr)_minmax(340px,0.85fr)]">
          <section aria-label={`都道府県別の${METRIC_TEXT[metric].noun}`} className="min-w-0">
            <TileMap
              tiles={tiles}
              hue={colors.hue}
              pinned={area === "" ? null : prefCode(area)}
              onPin={(code) => setArea(code === null ? "" : data.prefs[Number(code) - 1]!)}
              legend={{
                title: METRIC_TEXT[metric].legend,
                note: "色は党、明るさは割合。数字は人数/小選挙区の数。「—」は候補なし。",
              }}
            />
          </section>

          <section aria-label="推移" className="min-w-0">
            <h2 className="flex items-baseline justify-between pb-2">
              <span className="text-[14px] font-semibold">
                {area === "" ? "全国" : area}の推移
                <span className="ml-2 text-[11px] font-normal text-muted">小選挙区・人数</span>
              </span>
              {area !== "" && (
                <button
                  type="button"
                  onClick={() => setArea("")}
                  className="cursor-pointer text-[11px] text-muted transition-colors duration-150 hover:text-ink"
                >
                  全国に戻す
                </button>
              )}
            </h2>
            <PairedBars
              pairs={pairs}
              measure="count"
              highlighted={party}
              labelKey={party}
              focused={n}
              onFocus={(v) => setN(String(v))}
              height={280}
              label={`${area === "" ? "全国" : area}の小選挙区の党派別の候補者と当選者`}
            />
            <p className="pt-2 text-[11px] leading-relaxed text-faint">
              {area === ""
                ? "都道府県を選ぶと、その都道府県の推移に切り替わる。"
                : `小選挙区 ${districts[ai]}・候補者 ${people(data.counts.cand.reduce((a, byParty) => a + byParty[ei]![ai]!, 0))}（${longDate(n)}）`}
            </p>
          </section>
        </div>

        <ul className="mt-5 flex flex-col gap-1 border-t border-rule pt-3 text-[11px] leading-relaxed text-muted">
          <li>各回の左の棒（候）が候補者、右の棒（当）が当選者。当選者の棒の高さはその都道府県の小選挙区の数に等しい。</li>
          <li>
            「擁立」は候補者 ÷ 小選挙区の数。政党はふつう1選挙区に1人だが、無所属・諸派は同じ選挙区に何人も立つので 100% を超え得る（塗りは 100% で止める）。
          </li>
          <li>地図は模式図。比例代表だけの候補者は含まない。</li>
          <li>都道府県ごとの小選挙区の数は回によって違う（定数と区割りの見直し）。数は各回の結果調の「定数」の列による。</li>
        </ul>
      </main>
    </div>
  );
}
