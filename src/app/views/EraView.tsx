/**
 * 時代ビュー。全国の候補者と当選者を回ごとに対の棒で並べ、性別・新前元・党の内訳で見せる。
 */

import { use, useMemo } from "react";
import type { Kind, System } from "../../lib/data/cube.ts";
import { loadNational, loadPalette } from "../data/load.ts";
import { election, longDate, people, ratio } from "../data/format.ts";
import { SEX, STATUS, majorParties, partSegments, partySegments, total, type Part } from "../data/segments.ts";
import { CountList, CountListHeader, type CountRow } from "../components/CountList.tsx";
import { PairedBars, type Measure, type Pair } from "../components/PairedBars.tsx";
import { Preliminary } from "../components/Preliminary.tsx";
import { Segmented } from "../components/Segmented.tsx";
import { useUrlState } from "../hooks/useUrlState.ts";

type Breakdown = "sex" | "status" | "party";

const BREAKDOWNS = [
  { value: "sex", label: "性別" },
  { value: "status", label: "新前元" },
  { value: "party", label: "党" },
] as const;

const SYSTEMS = [
  { value: "all", label: "全体" },
  { value: "smd", label: "小選挙区" },
  { value: "pr", label: "比例代表" },
] as const;

const MEASURES = [
  { value: "share", label: "割合" },
  { value: "count", label: "人数" },
] as const;

export const SYSTEM_LABEL: Record<System, string> = { all: "全体", smd: "小選挙区", pr: "比例代表" };

const PARTS: Record<Exclude<Breakdown, "party">, { parts: Part[]; key: string }> = {
  sex: { parts: SEX, key: "女性" },
  status: { parts: STATUS, key: "新人" },
};

export function EraView() {
  const nat = use(loadNational());
  const palette = use(loadPalette());
  const last = nat.elections.at(-1)!;

  const [breakdown, setBreakdown] = useUrlState<Breakdown>("by", "sex", (v) => BREAKDOWNS.some((b) => b.value === v));
  const [system, setSystem] = useUrlState<System>("sys", "all", (v) => SYSTEMS.some((s) => s.value === v));
  const [measure, setMeasure] = useUrlState<Measure>("measure", "share", (v) => v === "share" || v === "count");
  const [party, setParty] = useUrlState<string>("party", "", (v) => nat.parties.includes(v));
  const [focusParam, setFocusParam] = useUrlState<string>("n", String(last), (v) => nat.elections.includes(Number(v)));
  const focus = Number(focusParam);
  const fi = nat.elections.indexOf(focus);

  /** people[候補者/当選者][党][回]：この制度の人数。 */
  const heads = useMemo(() => {
    const sum = (kind: Kind) => nat.counts[kind][system].map((byElection) => byElection.map(total));
    return { cand: sum("cand"), win: sum("win") };
  }, [nat, system]);
  const major = useMemo(() => majorParties(nat.parties, heads.cand, heads.win), [nat.parties, heads]);
  const pi = nat.parties.indexOf(party);

  const pairs = useMemo(
    (): Pair[] =>
      nat.elections.map((n, e) => {
        const side = (kind: Kind) => {
          if (breakdown === "party") {
            return partySegments(nat.parties, heads[kind].map((v) => v[e]!), major, party, palette);
          }
          const rows = nat.counts[kind][system];
          const values =
            pi >= 0 ? rows[pi]![e]! : rows.reduce((acc, r) => acc.map((v, i) => v + r[e]![i]!), [0, 0, 0, 0, 0, 0]);
          return partSegments(PARTS[breakdown].parts, values);
        };
        return { n, cand: side("cand"), win: side("win") };
      }),
    [nat, system, breakdown, heads, major, party, pi, palette],
  );

  const rows = useMemo(
    (): CountRow[] =>
      nat.parties
        .map((p, i) => {
          const c = palette(p);
          return { key: p, cand: heads.cand[i]![fi]!, win: heads.win[i]![fi]!, color: c.base, faded: c.faded };
        })
        .filter((r) => r.cand > 0)
        .sort((a, b) => b.win - a.win || b.cand - a.cand),
    [nat.parties, heads, fi, palette],
  );

  const focusPair = pairs[fi]!;
  const sumOf = (segments: { value: number }[]) => total(segments.map((s) => s.value));
  const candAll = sumOf(focusPair.cand);
  const winAll = sumOf(focusPair.win);
  const key = breakdown === "party" ? party : PARTS[breakdown].key;
  const valueOf = (segments: { key: string; value: number }[]) => segments.find((s) => s.key === key)?.value ?? 0;
  const pick = rows.find((r) => r.key === party);

  return (
    <div className="mx-auto flex w-full max-w-[1240px] gap-8 px-6 py-6 max-lg:flex-col-reverse">
      <aside className="w-[300px] shrink-0 max-lg:w-full lg:sticky lg:top-6 lg:flex lg:max-h-[calc(100dvh-3rem)] lg:flex-col lg:self-start">
        <CountListHeader label={`${longDate(focus)} ${SYSTEM_LABEL[system]}`} />
        <CountList
          rows={rows}
          selected={party}
          onSelect={(p) => setParty(p === party ? "" : p)}
          none={{
            label: "すべての党",
            cand: rows.reduce((a, r) => a + r.cand, 0),
            win: rows.reduce((a, r) => a + r.win, 0),
            swatch: rows.slice(0, 3).map((r) => r.color!),
          }}
        />
        <p className="mt-2 border-t border-rule px-2 pt-2 text-[10.5px] leading-relaxed text-faint">
          党を選ぶと、性別・新前元はその党の候補者と当選者だけの内訳になり、党の内訳ではその党を濃くする。同じ党をもう一度押すと解除。棒を押すとその回の一覧をここに出す。
        </p>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center justify-between gap-3 pb-4">
          <h1 className="text-[19px] font-semibold tracking-tight">全国の候補者と当選者</h1>
          <div className="flex flex-wrap gap-2">
            <Segmented label="内訳" options={BREAKDOWNS} value={breakdown} onChange={setBreakdown} />
            <Segmented label="制度" options={SYSTEMS} value={system} onChange={setSystem} />
            <Segmented label="尺度" options={MEASURES} value={measure} onChange={setMeasure} />
          </div>
        </header>

        <p className="tnum min-h-9 pb-3 text-[12.5px]">
          <span className="font-semibold">
            第{focus}回 {longDate(focus)}
          </span>
          {election(focus).edition === "速報" && <Preliminary />}
          <span className="text-muted">
            {` · ${pi >= 0 && breakdown !== "party" ? `${party}の` : ""}候補者 ${people(candAll)} → 当選者 ${people(winAll)}`}
          </span>
          {breakdown !== "party" && (
            <>
              <span className="text-muted"> · </span>
              <span className="font-semibold">{key}</span>
              <span className="text-muted">{` 候補者の${ratio(valueOf(focusPair.cand), candAll)} → 当選者の${ratio(valueOf(focusPair.win), winAll)}`}</span>
            </>
          )}
          {breakdown === "party" && pick !== undefined && (
            <>
              <span className="text-muted"> · </span>
              <span
                aria-hidden
                className="mr-1 inline-block size-[9px] rounded-[2px] align-baseline"
                style={{ backgroundColor: pick.color }}
              />
              <span className="font-semibold">{pick.key}</span>
              <span className="text-muted">{` 候補者 ${people(pick.cand)} → 当選者 ${people(pick.win)}（当選率 ${ratio(pick.win, pick.cand)}）`}</span>
            </>
          )}
          {party !== "" && pick === undefined && (
            <span className="text-muted">{` · ${party}はこの回の${SYSTEM_LABEL[system]}に候補がいない`}</span>
          )}
          {party !== "" && (
            <button
              type="button"
              onClick={() => setParty("")}
              className="ml-2 cursor-pointer rounded border border-rule px-1.5 py-px text-[11px] text-muted transition-[color,border-color,transform] duration-150 ease-out hover:border-rule-strong hover:text-ink active:scale-[0.97]"
            >
              解除
            </button>
          )}
        </p>

        <Legend breakdown={breakdown} />

        <PairedBars
          pairs={pairs}
          measure={measure}
          highlighted={breakdown === "party" ? party : ""}
          labelKey={key}
          focused={focus}
          onFocus={(n) => setFocusParam(String(n))}
          height={340}
          label={`全国の${SYSTEM_LABEL[system]}の候補者と当選者の${BREAKDOWNS.find((b) => b.value === breakdown)!.label}別${measure === "share" ? "割合" : "人数"}`}
        />

        <ul className="mt-5 flex flex-col gap-1 border-t border-rule pt-3 text-[11px] leading-relaxed text-muted">
          <li>各回の左の棒（候）が候補者、右の棒（当）が当選者。棒の上の数字は、女性・新人・選んだ党の割合（人数では人数）。</li>
          <li>
            「全体」は小選挙区と比例代表の両方に立候補した人（重複立候補者）を1人と数える。比例代表の候補者は名簿の登載者。候補者数は選挙当日の数。
          </li>
          <li>前職は直前の衆議院議員、元職はそれより前に衆議院議員だった人、新人はどちらでもない人。</li>
          <li>
            小選挙区の「諸派」は、政党の届出でなく本人・推薦届出で立候補した、政党その他の政治団体に属する候補（結果調の「政党等所属」）。「その他」は、この制度で全国の候補者・当選者の割合が一度も2%に届かなかった党。一覧から選ぶと分けて表示する。
          </li>
          <li>
            党名が同じなら同じ系列として並べる。第46回と第48回以降の日本維新の会、第48回と第49回以降の立憲民主党は、名前が同じ別の政党。
          </li>
          <li>
            定数は第44〜46回 480（小選挙区300・比例180）、第47回 475（295・180）、第48回以降 465（289・176）。人数は定数の変化を補正していない。
          </li>
        </ul>
      </main>
    </div>
  );
}

/** 性別・新前元の凡例。党の内訳は一覧の色見本が凡例を兼ねる。 */
function Legend({ breakdown }: { breakdown: Breakdown }) {
  if (breakdown === "party") return <div className="h-5" />;
  return (
    <div className="flex h-5 items-center gap-3 text-[11px] text-muted">
      {PARTS[breakdown].parts.map((p) => (
        <span key={p.key} className="flex items-center gap-1">
          <span aria-hidden className="size-[9px] rounded-[2px]" style={{ backgroundColor: p.color }} />
          {p.key}
        </span>
      ))}
    </div>
  );
}
