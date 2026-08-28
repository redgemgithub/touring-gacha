# touring-gacha（仮称）

バイクツーリング向けに、現在地周辺からランダムに目的地を提案するWebアプリです。

## 現状のステータス

要件定義・画面イメージの検討段階です。実装はこれから着手します。

## 想定スタック

- Cloudflare Workers + Workers Static Assets
- 地図・道路データ: OpenStreetMap系
- 必要になった場合のみ Cloudflare KV / D1 を追加

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

準備中です（Claude Codeでの実装開始後に追記します）。
