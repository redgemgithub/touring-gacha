# touring-gacha

バイクツーリング向けに、現在地周辺からランダムに目的地を提案するWebアプリです。

## 現状のステータス

Phase 1〜4-B実装済み・本番運用中（`https://touring-gacha.redgem.workers.dev`）。

- 目的地種別は「スポット（店）」「スポット（店以外）」「交差点」の3種類から選べる
  - スポット（店）: 食事・休憩／買い物・その他
  - スポット（店以外）: 峠・展望・山頂等のタグ付き地点。停車できる場所の要否を条件にできる
  - 交差点: 次数ベースの交差点検出（道路網の構造だけで選ぶ、タグ不要）
- 条件設定→Overpass検索→地図表示→再抽選→ナビ用情報コピー（対象の行をタップでコピー、長押しで緯度経度を強制コピー）の一気通貫フローが動作する
- 周辺情報展開画面（画面遷移なしで目的地本体＋近くのPOI一覧を表示）も実装済み

進行中の作業・全体像は [docs/roadmap.md](./docs/roadmap.md)、機能とソースの対応は [docs/feature-map.md](./docs/feature-map.md) を参照。現在はPhase 5（仕上げ・残課題）の棚卸し中。

## 探索範囲の考え方

探索範囲は「指定距離**以内**」ではなく「指定距離**に近い帯**」で候補を探す（例: 10/30/50/100kmの選択肢なら、帯は5〜20km／20〜40km／40〜75km／75〜110km、選択肢間に中抜けがないよう隣接する選択肢との中間値を境界にする）。指定した距離を走ることそのものがこのアプリの目的のため。帯の範囲内に候補が見つからない場合は、範囲を自動的に広げず「見つからなかった」と伝える（その場で再検索できるボタンはある）。詳細: [docs/decisions/260829-search-radius-band.md](./docs/decisions/260829-search-radius-band.md)、[docs/decisions/260829-search-radius-band-gapless.md](./docs/decisions/260829-search-radius-band-gapless.md)

## 想定スタック

- Cloudflare Workers（[Hono](https://github.com/honojs/hono)採用） + Workers Static Assets（バンドラーなし）
- 地図・道路データ: OpenStreetMap系（Overpass API直接利用）
- Workers KVを前提として導入（Overpass APIのレート制限を吸収するキャッシュ用途）。D1は不採用に確定（ガチャという性質上、永続化・利用者特定は持たせない方針）
- 詳細な経緯: [docs/decisions/260828-infra-cloudflare-kv.md](./docs/decisions/260828-infra-cloudflare-kv.md)

## ドキュメント

- 要件定義: [docs/requirements.md](./docs/requirements.md)
- 全体の実装順序・進捗: [docs/roadmap.md](./docs/roadmap.md)
- 機能↔ファイル対応表: [docs/feature-map.md](./docs/feature-map.md)
- 画面イメージ: [docs/mockups/](./docs/mockups/)（初期構想のスナップショット。実装が進んでも更新しない方針。現状との乖離は[decision記録](./docs/decisions/)側で追う）
- 設計判断の記録: [docs/decisions/](./docs/decisions/)
- 作業計画・実行記録: [docs/plans/](./docs/plans/)

## プロジェクト構成

```
touring-gacha/
├── CLAUDE.md
├── README.md
├── package.json
├── tsconfig.json
├── wrangler.jsonc          # KVバインディング(CACHE)設定済み
├── .gitignore
├── .dev.vars.example
│
├── docs/
│   ├── requirements.md
│   ├── roadmap.md          # 全体の実装順序・進捗
│   ├── feature-map.md      # 機能↔ファイル対応表
│   ├── mockups/
│   ├── decisions/          # 設計判断の記録
│   └── plans/               # 作業計画・実行記録（yymmdd-hhmmss-内容.md）
│
├── public/                 # Static Assets配信対象（バンドラーなし、ES Modules）
│   ├── index.html
│   ├── styles.css
│   └── js/
│       ├── app.js               # エントリポイント
│       ├── state.js             # 最小pub/subストア
│       ├── api.js               # fetch()ラッパー
│       ├── geo.js               # navigator.geolocation、距離/方角、探索範囲の帯計算
│       ├── search.js            # 検索実行の共通ロジック（初回・再抽選、多段階fetchループ）
│       ├── nearby.js            # 周辺情報取得の共通ロジック
│       ├── copy-preference.js   # コピー項目設定（localStorage）
│       ├── long-press.js        # 長押し検出ユーティリティ（緯度経度強制コピー用）
│       ├── toast.js             # 短時間通知
│       ├── views/
│       │   ├── condition.js     # 条件設定画面
│       │   ├── result.js        # 結果地図画面・周辺情報展開画面
│       │   └── copy-modal.js    # コピー項目設定画面
│       └── components/
│           └── map.js           # MapLibre GL JS（CDNからESモジュールとしてimport）
│
└── src/                    # Cloudflare Workers側（Hono）
    ├── index.ts
    ├── types.ts
    ├── routes/
    │   ├── config.ts        # GET /api/config （MapTilerキー配布）
    │   ├── destinations.ts  # POST /api/destinations/prepare, /process
    │   └── nearby.ts        # POST /api/nearby/prepare, /process
    └── lib/
        ├── overpass.ts        # 「店」「店以外」のタグ検索クエリ組み立て・応答検証
        ├── intersection.ts    # 「交差点」の探索ロジック（道路網の次数計算）
        ├── candidate.ts       # Overpass要素→Candidate変換
        ├── highway-filter.ts  # 高速道路100m除外
        ├── parking-filter.ts  # 停車できる場所の条件判定
        ├── poi.ts             # 周辺POIの種別分類
        ├── nearby.ts          # 周辺情報クエリ組み立て
        ├── geo.ts             # 距離・方角・帯・仮地点計算
        └── cache.ts           # KVキャッシュキー組み立て
```

## セットアップ

```
npm install
npm run dev       # ローカル開発サーバー起動（wrangler dev）
npm run typecheck # 型チェック
npm run deploy    # Cloudflareへデプロイ
```

初回のみ `npx wrangler login` でCloudflareアカウントの認証が必要です。
