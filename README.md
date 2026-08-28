# touring-gacha（仮称）

バイクツーリング向けに、現在地周辺からランダムに目的地を提案するWebアプリです。

## 現状のステータス

プロジェクト雛形作成済み（`wrangler dev` で疎通確認済み）。機能実装はこれから着手します。

## 想定スタック

- Cloudflare Workers（[Hono](https://github.com/honojs/hono)採用） + Workers Static Assets（バンドラーなし）
- 地図・道路データ: OpenStreetMap系
- Workers KVを前提として導入（Overpass APIのレート制限を吸収するキャッシュ用途）。D1は必要になった場合のみ追加
- 詳細な経緯: [docs/decisions/260828-infra-cloudflare-kv.md](./docs/decisions/260828-infra-cloudflare-kv.md)

## ドキュメント

- 要件定義: [docs/requirements.md](./docs/requirements.md)
- 画面イメージ: [docs/mockups/](./docs/mockups/)

## プロジェクト構成（案）

```
touring-gacha/
├── CLAUDE.md
├── README.md
├── package.json
├── tsconfig.json
├── wrangler.jsonc
├── .gitignore
├── .dev.vars.example
│
├── docs/
│   ├── requirements.md
│   ├── mockups/
│   └── decisions/
│
├── public/                 # Static Assets配信対象（現状ビルドレス想定）
│   ├── index.html
│   ├── styles.css
│   ├── favicon.svg
│   └── js/
│       ├── app.js
│       ├── views/
│       │   ├── condition.js
│       │   ├── result.js
│       │   └── copy-sheet.js
│       └── components/
│           └── map.js
│
└── src/                    # Cloudflare Workers側
    ├── index.ts
    ├── routes/
    │   ├── destination.ts
    │   └── poi.ts
    └── lib/
        ├── overpass.ts
        ├── candidate-filter.ts
        └── geo.ts
```

上記は現時点の案であり、実装を進める中で変更され得ます。

## セットアップ

```
npm install
npm run dev       # ローカル開発サーバー起動（wrangler dev）
npm run typecheck # 型チェック
npm run deploy    # Cloudflareへデプロイ
```

初回のみ `npx wrangler login` でCloudflareアカウントの認証が必要です。
