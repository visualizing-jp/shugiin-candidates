/**
 * 党・地域の一覧。右端は候補者数と当選者数、その回の最大の行を基準にした当選者の棒。
 * 「その他」にまとめられる小党もここからは選べる。
 */

import { useEffect, useRef } from "react";
import { num } from "../data/format.ts";

export interface CountRow {
  key: string;
  cand: number;
  win: number;
  /** 行頭の色見本。党のときだけ。 */
  color?: string;
  faded?: string;
}

export function CountList({
  rows,
  selected,
  onSelect,
  none,
}: {
  rows: CountRow[];
  /** 空文字は先頭の「すべて」の行。 */
  selected: string;
  onSelect: (key: string) => void;
  /** 先頭に置く「すべて」の行（すべての党・全国）。選択を解除できるようにする。 */
  none?: { label: string; cand: number; win: number; swatch?: string[] };
}) {
  const max = Math.max(...rows.map((r) => r.win), 1);
  const boxRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // 選んだ行が見えるよう、一覧の枠の中だけをスクロールする。scrollIntoView はページごと動かすので、
  // 一覧が本文の下に回る狭い画面では、開いた途端にページの末尾へ飛んでしまう。
  useEffect(() => {
    const box = boxRef.current;
    const el = selectedRef.current;
    if (box === null || el === null || box.scrollHeight <= box.clientHeight) return;
    const b = box.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (r.top < b.top) box.scrollTop += r.top - b.top;
    else if (r.bottom > b.bottom) box.scrollTop += r.bottom - b.bottom;
  }, [selected]);

  const item = (isSelected: boolean) =>
    `flex w-full cursor-pointer items-center gap-2 rounded px-2 py-[3px] text-left transition-colors duration-150 ${
      isSelected ? "bg-ink/[0.06]" : "hover:bg-ink/[0.03]"
    }`;

  return (
    <div ref={boxRef} className="min-h-0 flex-1 overflow-y-auto">
    <ul className="flex flex-col">
      {none !== undefined && (
        <li className="mb-1 border-b border-rule pb-1">
          <button
            type="button"
            ref={selected === "" ? selectedRef : null}
            onClick={() => onSelect("")}
            aria-pressed={selected === ""}
            className={item(selected === "")}
          >
            {none.swatch !== undefined && (
              <span aria-hidden className="flex size-[9px] shrink-0 overflow-hidden rounded-[2px]">
                {none.swatch.map((c) => (
                  <span key={c} className="flex-1" style={{ backgroundColor: c }} />
                ))}
              </span>
            )}
            <span className={`flex-1 text-[12px] ${selected === "" ? "font-semibold text-ink" : "text-muted"}`}>
              {none.label}
            </span>
            <Numbers cand={none.cand} win={none.win} strong={selected === ""} />
            <span className="w-[40px] shrink-0" />
          </button>
        </li>
      )}
      {rows.map((row) => {
        const isSelected = row.key === selected;
        const dim = selected !== "" && !isSelected;
        return (
          <li key={row.key}>
            <button
              type="button"
              ref={isSelected ? selectedRef : null}
              onClick={() => onSelect(row.key)}
              aria-pressed={isSelected}
              title={`${row.key} 候補者 ${num(row.cand)}人・当選者 ${num(row.win)}人`}
              className={item(isSelected)}
            >
              {row.color !== undefined && (
                <span aria-hidden className="size-[9px] shrink-0 rounded-[2px]" style={{ backgroundColor: row.color }} />
              )}
              <span
                className={`min-w-0 flex-1 truncate text-[12px] ${isSelected ? "font-semibold text-ink" : "text-muted"}`}
              >
                {row.key}
              </span>
              <Numbers cand={row.cand} win={row.win} strong={isSelected} />
              <span className="h-[9px] w-[40px] shrink-0 bg-ink/[0.05]">
                <span
                  className="block h-full"
                  style={{
                    width: `${(row.win / max) * 100}%`,
                    backgroundColor: (dim ? row.faded : row.color) ?? "var(--color-muted)",
                    opacity: row.color === undefined && dim ? 0.45 : 1,
                  }}
                />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
    </div>
  );
}

function Numbers({ cand, win, strong }: { cand: number; win: number; strong: boolean }) {
  return (
    <span className={`tnum flex shrink-0 text-right text-[11px] ${strong ? "text-ink" : "text-faint"}`}>
      <span className="w-[2.6rem]">{num(cand)}</span>
      <span className="w-[2.4rem]">{num(win)}</span>
    </span>
  );
}

/** 一覧の見出し。列の位置を CountList の数字に揃える。 */
export function CountListHeader({ label }: { label: string }) {
  return (
    <h2 className="flex items-baseline gap-2 px-2 pb-1 text-[11px] font-semibold tracking-wide text-faint">
      <span className="flex-1">{label}</span>
      <span className="tnum flex shrink-0 text-right font-normal">
        <span className="w-[2.6rem]">候補者</span>
        <span className="w-[2.4rem]">当選</span>
      </span>
      <span className="w-[40px] shrink-0" />
    </h2>
  );
}
