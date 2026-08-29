# touring-gacha（仮称）

バイクツーリング向けに、現在地周辺からランダムに目的地を提案するWebアプリです。

## 現状のステータス

Phase 1実装済み: 目的地種別「店」（食事・休憩／買い物・その他）に限定した、条件設定→Overpass検索→地図表示→再抽選→ナビ用情報コピーの一気通貫フローが動作する（`wrangler dev` + 実ブラウザで疎通確認済み）。目的地種別「店以外」・周辺情報展開画面は未実装。詳細は [docs/plans/260828-163014-phase1-店タイプ検索実装.md](./docs/plans/260828-163014-phase1-店タイプ検索実装.md) を参照。

## 探索範囲の考え方

探索範囲は「指定距離**以内**」ではなく「指定距離**に近い帯**」で候補を探す（例: 50km指定なら45〜55km）。指定した距離を走ることそのものがこのアプリの目的のため。帯の範囲内に候補が見つからない場合は、範囲を自動的に広げず「見つからなかった」と伝える。詳細: [docs/decisions/260829-search-radius-band.md](./docs/decisions/260829-search-radius-band.md)

## 想定スタック

- Cloudflare Workers（[Hono](https://github.com/honojs/hono)採用） + Workers Static Assets（バンドラーなし）
- 地図・道路データ: OpenStreetMap系
- Workers KVを前提として導入（Overpass APIのレート制限を吸収するキャッシュ用途）。D1は必要になった場合のみ追加
- 詳細な経緯: [docs/decisions/260828-infra-cloudflare-kv.md](./docs/decisions/260828-infra-cloudflare-kv.md)

## ドキュメント

- 要件定義: [docs/requirements.md](./docs/requirements.md)
- 画面イメージ: [docs/mockups/](./docs/mockups/)

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
│   ├── mockups/
│   ├── decisions/
│   └── plans/
│
├── public/                 # Static Assets配信対象（バンドラーなし、ES Modules）
│   ├── index.html
│   ├── styles.css
│   └── js/
│       ├── app.js          # エントリポイント
│       ├── state.js        # 最小pub/subストア
│       ├── api.js          # fetch()ラッパー
│       ├── geo.js          # navigator.geolocation、距離/方角
│       ├── search.js       # 検索実行の共通ロジック（初回・再抽選）
│       ├── views/
│       │   ├── condition.js
│       │   ├── result.js
│       │   └── copy-modal.js
│       └── components/
│           └── map.js      # MapLibre GL JS（CDNからESモジュールとしてimport）
│
└── src/                    # Cloudflare Workers側（Hono）
    ├── index.ts
    ├── types.ts
    ├── routes/
    │   ├── config.ts       # GET /api/config （MapTilerキー配布）
    │   └── destinations.ts # POST /api/destinations/prepare, /process
    └── lib/
        ├── overpass.ts
        ├── candidate.ts
        ├── highway-filter.ts
        ├── geo.ts
        └── cache.ts
```

「店以外」タイプ実装時にファイル構成は変更され得ます。

## セットアップ

```
npm install
npm run dev       # ローカル開発サーバー起動（wrangler dev）
npm run typecheck # 型チェック
npm run deploy    # Cloudflareへデプロイ
```

初回のみ `npx wrangler login` でCloudflareアカウントの認証が必要です。
