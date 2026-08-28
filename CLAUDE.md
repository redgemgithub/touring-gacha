# touring-gacha

バイクツーリング向けランダム目的地提案Webアプリ。Cloudflare Workers + Workers Static Assetsで運用する。

## ドキュメント

- 詳細要件: docs/requirements.md を参照（全体像を把握したい時に読む。実装作業では都度参照で十分）
- 画面イメージ: docs/mockups/ 配下のPNGを参照

## 構成

- `src/` : Cloudflare Workers側（API・目的地探索ロジック、TypeScript、Hono）
- `public/` : Static Assets配信対象。バンドラーなしの素のHTML/CSS/JS（ES Modules）。1枚のindex.htmlを画面状態の切り替えで構成する。MapLibre GL JSはCDNからESモジュールとしてimportする（v6以降はUMD/グローバル公開ビルドが廃止されたため、`<script src>`ではなく`import`を使うこと）
- `docs/` : 要件・画面イメージ・設計判断の記録

## 作業の進め方（計画・実行記録）

- 何らかの作業に着手する前に、原則としてまず計画を立て、`docs/plans/` 配下にファイルとして書き出す。ファイル名は `yymmdd-hhmmss-内容.md` の形式とする（日付のみだと同日内の前後関係が分からなくなるため、時刻まで含める）。内容部分は日本語でよい。英語の方が端的な場合は英語でも構わない（例: `docs/plans/260828-153045-計画ルール追加.md`、`docs/plans/260828-160210-fix-highway-buffer.md`）
- 実行結果は別ファイルに起こさず、同じ計画ファイルに追記して記録する（機械的に処理できるため、計画ファイル自体を実行結果の記録先として兼用する）
- 計画通りに実行できた場合は、結果として残しておくべき事柄を計画ファイルに追記する
- 計画から変更して実行した場合は、その変更点を計画ファイル末尾に「変化一覧」という項目としてまとめて追記する

## 守るべきドメインルール

- 高速道路・高規格道路は候補から常時除外し、そこから100m以内の候補地点も除外する
  - 実装上の注意: Overpass QLの`around.SET`による2集合間の近接フィルタ（例: `nwr.cand(around.hw:100)`）は計算コストが非常に高く、`shop=*`のような件数の多いカテゴリではタイムアウトする（実測済み）。高速道路除外は「候補検索」と「高速道路ジオメトリ取得（`out geom`）」を別々のOverpass文にして両方取得し、アプリ側（Workers）で点と線分の距離計算により除外する（`src/lib/highway-filter.ts`, `src/lib/geo.ts`の`distanceToPolylineMeters`）
- 候補地点は交差点など地点として区別できる場所に限定し、直線路途中の道端・行き止まりは除外する
- 目的地種別は「店（食事・休憩／買い物・その他）」と「店以外（停車場所の要否を選択、地図データで判断可能な場合のみ条件化）」を切り替えられるようにする
- ナビ連携は情報のコピーで十分。ナビアプリへの直接連携は不要
- 周辺情報一覧は画面遷移せず、地図確認の流れの中で1操作で表示できるようにする

## 運用・インフラ方針

- Cloudflare Workers（Hono） + Workers Static Assets（バンドラーなし） + Workers KV（すべて無料枠）で運用する
- 無料枠は未来永劫でなくてよい。自分ひとりが使う規模で維持できれば十分とする
- 無料枠を超えた場合は自動課金ではなく、サービス利用不可（停止）になることを許容する
- Overpass APIのレート制限を吸収するため、KV導入は「要否を検討する」段階を経ず、探索結果のキャッシュ用途として前提にする
- 地図ライブラリはMapLibre GL JS、タイル提供元はMapTiler無料プラン（月10万マップロードで自動課金なく停止）を採用する
- 詳細な経緯は docs/decisions/260828-infra-cloudflare-kv.md を参照

## 現状の未確定事項

- D1導入の要否（KVは運用・インフラ方針のとおり導入前提で確定済み）
- 目的地種別「店以外」の交差点・行き止まり判定ロジック（Phase 2以降）

OSMデータ取得方法はOverpass API直接利用で決定・実装済み（`src/lib/overpass.ts`）。

## コマンド

- `npm install` : 依存パッケージインストール
- `npm run dev` : ローカル開発サーバー起動（`wrangler dev`）
- `npm run typecheck` : 型チェック（`tsc --noEmit`）
- `npm run deploy` : Cloudflareへデプロイ（`wrangler deploy`）
- 初回のみ `npx wrangler login` でCloudflareアカウントの認証が必要
