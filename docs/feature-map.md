# touring-gacha 機能↔ファイル対応表

## この文書について

「何を触ればどの機能に影響するか」を見失わないための対応表。機能追加・変更のたびに更新する。実装順序・フェーズの根拠は [docs/roadmap.md](./roadmap.md) を、要件の詳細は [docs/requirements.md](./requirements.md) を参照。

状態の凡例: 済＝実装済み／予定＝該当フェーズで実装予定・未着手

## バックエンド（`src/`）

| 機能 | 対応ファイル | 状態 | 対応フェーズ |
|---|---|---|---|
| ヘルスチェック | `src/index.ts` | 済 | Phase 1 |
| ルーティング全体の起点 | `src/index.ts` | 済 | Phase 1 |
| 共有の型定義（Env, Candidate等） | `src/types.ts` | 済 | Phase 1 |
| MapTilerキー配布API（`GET /api/config`） | `src/routes/config.ts` | 済 | Phase 1 |
| 検索キャッシュ確認・Overpassクエリ生成API（`POST /api/destinations/prepare`） | `src/routes/destinations.ts` | 済（「店」のみ対応） | Phase 1で実装、Phase 2で分割／Phase 4で「店以外」分岐を追加 |
| Overpass結果の受け取り・解釈・キャッシュ保存API（`POST /api/destinations/process`） | `src/routes/destinations.ts` | 済 | Phase 2 |
| Overpassへの実際の問い合わせ（ブラウザから直接fetch） | `public/js/api.js`（`fetchOverpassDirect`） | 済 | Phase 2（Cloudflare Workers共有IPの制限を回避するため、Phase1時点のサーバー側fetchから変更。[decision](./decisions/260829-overpass-client-side-fetch.md)） |
| 「店」の探索ロジック（Overpassタグ検索: amenity/shop、クエリ組み立て） | `src/lib/overpass.ts` | 済 | Phase 1 |
| 「店以外」の探索ロジック（交差点・行き止まり判定、峠/展望等） | 未作成（新規ファイルを追加予定） | 予定 | Phase 4 |
| Overpass応答の検証・エラー処理（remark検知含む） | `src/lib/overpass.ts`（`parseOverpassResponse`） | 済 | Phase 1で実装、Phase 2でサーバー側fetch実行部分を廃止し検証ロジックのみ残す形に整理 |
| 高速道路100m除外（点と線分の距離計算） | `src/lib/highway-filter.ts`, `src/lib/geo.ts`（`distanceToSegmentMeters`/`distanceToPolylineMeters`） | 済 | Phase 1（「店以外」でも共通利用予定） |
| 停車できる場所の条件判定 | 未作成 | 予定 | Phase 4 |
| Overpass要素→Candidate変換・住所組み立て | `src/lib/candidate.ts` | 済 | Phase 1 |
| 座標バケット化（キャッシュキー用）・距離／方角計算 | `src/lib/geo.ts`（`bucketCoordinate`/`haversineDistanceKm`/`bearingLabel`） | 済 | Phase 1 |
| KVキャッシュ（検索結果の保存・再抽選用） | `src/lib/cache.ts` | 済 | Phase 1 |
| 周辺POI取得API（`POST /api/nearby/prepare`, `/process`） | `src/routes/nearby.ts`, `src/lib/nearby.ts`, `src/lib/poi.ts`, `src/lib/cache.ts`（`buildNearbyCacheKey`等） | 済 | Phase 3 |
| KVバインディング設定 | `wrangler.jsonc` | 済 | Phase 1 |
| 本番シークレット設定（MAPTILER_API_KEY） | `wrangler secret put`（ファイルなし、CLI操作） | 済 | Phase 2 |

## フロントエンド（`public/`）

| 機能 | 対応ファイル | 状態 | 対応フェーズ |
|---|---|---|---|
| ページ骨格（条件設定・結果・コピーモーダルの3ブロック） | `public/index.html` | 済 | Phase 1 |
| 見た目全般（ダークテーマ） | `public/styles.css` | 済 | Phase 1 |
| エントリポイント・画面切り替え | `public/js/app.js` | 済 | Phase 1 |
| 状態管理（最小pub/subストア） | `public/js/state.js` | 済 | Phase 1 |
| API呼び出し（config取得・prepare/process・Overpass直接fetch） | `public/js/api.js` | 済 | Phase 1で新設、Phase 2でOverpass直接fetchを追加 |
| 検索実行の共通ロジック（初回・再抽選、prepare→(Overpass直接fetch)→process） | `public/js/search.js` | 済 | Phase 1で新設、Phase 2で改修 |
| 現在地取得・距離／方角の表示整形（クライアント側） | `public/js/geo.js` | 済 | Phase 1 |
| 条件設定画面（GPS・探索範囲・店タイプ選択） | `public/js/views/condition.js` | 済（「店」のみ。「店以外」選択肢は未実装） | Phase 1／Phase 4で拡張 |
| 停車できる場所の条件UI | `public/js/views/condition.js`（拡張予定） | 予定 | Phase 4 |
| 結果地図画面（下部シート、決める/別の場所/ナビ用情報ボタン） | `public/js/views/result.js` | 済 | Phase 1、Phase 3で周辺情報表示・Phase 3.x でコピー処理を拡張 |
| 地図描画（MapLibre初期化、ピン、破線ルート、POIマーカー、フォーカスリング） | `public/js/components/map.js` | 済 | Phase 1、Phase 3で拡張 |
| 周辺情報展開画面（POI一覧・地図フォーカス連動） | `public/js/views/result.js`（`sheet-expanded`部分）, `public/js/nearby.js` | 済 | Phase 3 |
| コピー項目設定（アプリ共通、緯度経度/名称/住所のチェックボックス） | `public/js/views/copy-modal.js`, `public/js/copy-preference.js` | 済 | Phase 1で「実行用モーダル」として新設、[decision](./decisions/260829-copy-preference.md)で「設定編集用」に役割変更 |
| 目的地・周辺POIのコピー実行（設定に従い直接コピー） | `public/js/views/result.js`（`copyItem`） | 済 | 同上 |
| 短時間通知（コピー完了トースト） | `public/js/toast.js` | 済 | 同上 |

## インフラ・設定・ドキュメント

| 機能 | 対応ファイル | 状態 |
|---|---|---|
| 依存パッケージ定義 | `package.json` | 済 |
| TypeScript設定 | `tsconfig.json` | 済 |
| Workers設定（KVバインディング、Static Assets） | `wrangler.jsonc` | 済 |
| ローカル環境変数テンプレート | `.dev.vars.example` | 済 |
| インフラ方針・技術選定の経緯 | `docs/decisions/260828-infra-cloudflare-kv.md` | 済 |
| Overpassをブラウザ直接fetchにした経緯 | `docs/decisions/260829-overpass-client-side-fetch.md` | 済 |
| 探索範囲を帯検索にした経緯 | `docs/decisions/260829-search-radius-band.md` | 済 |
| コピー方式をアプリ共通設定にした経緯 | `docs/decisions/260829-copy-preference.md` | 済 |
| 全体の実装順序 | `docs/roadmap.md` | 済 |
| 各フェーズの計画・実行記録 | `docs/plans/*.md` | Phase 1〜3分済 |

## 更新ルール

- 機能を追加・変更・削除したら、対応する行をこの表にも反映する
- 新しいフェーズに着手する際、そのフェーズで新規作成予定のファイルが確定したら「未作成」の行を更新する
