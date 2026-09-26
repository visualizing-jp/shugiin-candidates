# 衆議院選挙で、誰が立候補し、誰が当選したか

総務省「衆議院議員総選挙・最高裁判所裁判官国民審査結果調」をもとに、2005年以降の総選挙の候補者と当選者の顔ぶれ（性別・新前元・党派・年齢）を探索するダッシュボード。

visualizing.jp スタンドアロン（dataviz.jp サブスクツールではない）。
兄弟サイト: [衆議院選挙で、どの党がどれだけ票を得てきたか](https://election-shugiin-timeseries.visualizing.jp/)（[election-shugiin-timeseries](https://github.com/visualizing-jp/election-shugiin-timeseries)）。

想定URL: https://election-shugiin-candidates.visualizing.jp

## ビュー

| ビュー | 内容 |
| --- | --- |
| 時代 | 全国の候補者と当選者（第44〜51回、2005–2026）。性別／新前元／党の内訳、全体／小選挙区／比例代表、割合／人数 |
| 都道府県 | 小選挙区の都道府県別の当選・擁立（小選挙区の数に対する割合）と、選んだ県の推移 |
| 年齢 | 小選挙区の年代別の候補者・当選者・当選率と、その推移（全国・都道府県） |

データ設計の正本は [`docs/data-sources.md`](docs/data-sources.md)。

## 開発

```bash
npm install
npm run fetch && npm run normalize && npm run verify && npm run data
npm run dev
```

| スクリプト | 内容 |
| --- | --- |
| `npm run fetch` | 総務省の結果調（Excel / PDF）を `data/raw/` に取得 |
| `npm run normalize` | 回ごとの正規化 JSON を `data/normalized/` に書き出す（第44回の PDF には poppler の `pdftotext` が要る） |
| `npm run verify` | 表どうしの合計・定数・確定値との突合 |
| `npm run data` | 正規化 JSON から配信用 JSON を `public/data/` に書き出す |
| `npm run dev` | Vite 開発サーバ |
| `npm run build` | 本番ビルド |
| `npm run typecheck` | TypeScript 検査 |

配色のルールは `src/lib/data/palette.ts`（色相＝党、明度＝量・順序、CIE HCL）。党の色相は兄弟サイトの `palette.json` を `data/palette.json` に写したもの。性別・新前元の内訳だけは Okabe–Ito のカテゴリカル配色、年齢は無彩色の明度の段階。

`data/normalized/`・`data/palette.json`・`public/data/` は追跡する。

## GitHub Pages / DNS

- `.github/workflows/pages.yml` で Pages にデプロイする。
- カスタムドメイン `election-shugiin-candidates.visualizing.jp` は `public/CNAME` に置いた。Pages 設定と visualizing.jp 側 DNS（既存シリーズと同じ運用）で登録する。
- Google Analytics の測定ID（`src/app/analytics.ts`）はシリーズ共通（表紙 japan-election と同じ）。
