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
| 検索キャッシュ確認・Overpassクエリ生成API（`POST /api/destinations/prepare`） | `src/routes/destinations.ts` | 済 | Phase 1で実装、Phase 2で分割、Phase 4-Aで「店以外」分岐、Phase 4-Bで交差点の仮地点選定・プローブ問い合わせを追加 |
| Overpass結果の受け取り・解釈・キャッシュ保存API（`POST /api/destinations/process`） | `src/routes/destinations.ts` | 済 | Phase 2、Phase 4-Aで停車場所フィルタ分岐、Phase 4-Bでプローブ→拡張の多段階処理を追加 |
| Overpassへの実際の問い合わせ（ブラウザから直接fetch） | `public/js/api.js`（`fetchOverpassDirect`） | 済 | Phase 2（Cloudflare Workers共有IPの制限を回避するため、Phase1時点のサーバー側fetchから変更。[decision](./decisions/260829-overpass-client-side-fetch.md)） |
| 「店」の探索ロジック（Overpassタグ検索: amenity/shop、クエリ組み立て） | `src/lib/overpass.ts` | 済 | Phase 1 |
| 「店以外」の探索ロジック（峠/展望/山頂のタグ検索） | `src/lib/overpass.ts`（`CATEGORY_TAG_FILTERS.other`） | 済 | Phase 4-A |
| 交差点の探索ロジック（道路網の次数計算、仮地点・プローブ/拡張クエリ組み立て） | `src/lib/intersection.ts` | 済 | Phase 4-B、[decision](./decisions/260830-phase4b交差点検出実装.md) |
| 仮地点計算（起点・方角・距離→到達点） | `src/lib/geo.ts`（`destinationPoint`） | 済 | Phase 4-B |
| 交差点候補のキャッシュ（仮地点自身の座標でバケット化、帯フィルタは取得後に都度適用） | `src/lib/cache.ts`（`buildIntersectionCacheKey`） | 済 | Phase 4-B後の修正。現在地ベースのキャッシュだと仮地点の乱数決定が共有され毎回似た結果になる不具合があった（[decision](./decisions/260830-phase4b交差点検出実装.md)の追記） |
| 仮地点が完全な空振り（海上等）だった場合の内部リトライ（最大2回） | `src/routes/destinations.ts`、`src/lib/intersection.ts`（`INTERSECTION_MAX_ANCHOR_ATTEMPTS`） | 済 | Phase 4-B後の修正。仮地点の方角決定が陸海を考慮しておらず、海沿いの起点で空振りが頻発する問題への対応 |
| 周辺情報が500mで0件のとき1kmへ1回だけ拡張検索 | `src/lib/nearby.ts`（`NEARBY_ESCALATE_RADIUS_M`）、`src/routes/nearby.ts` | 済 | Phase 4-B後の修正（全カテゴリ共通） |
| Overpass応答の検証・エラー処理（remark検知含む） | `src/lib/overpass.ts`（`parseOverpassResponse`） | 済 | Phase 1で実装、Phase 2でサーバー側fetch実行部分を廃止し検証ロジックのみ残す形に整理 |
| 高速道路100m除外（点と線分の距離計算） | `src/lib/highway-filter.ts`, `src/lib/geo.ts`（`distanceToSegmentMeters`/`distanceToPolylineMeters`） | 済 | Phase 1（Phase 4-Aの「店以外」・Phase 4-Bの交差点でも共通利用） |
| 停車できる場所の条件判定（駐車場データが1km以内にない候補は除外） | `src/lib/parking-filter.ts` | 済 | Phase 4-A、[decision](./decisions/260829-phase4a-店以外タグ地点と停車場所.md) |
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
| エラーメッセージの一元化（同じ系統のエラーには同じ文言） | `public/js/api.js`（`describeApiError`） | 済 | Phase 5棚卸し中の指摘対応。`search.js`/`nearby.js`双方から利用 |
| 検索実行の共通ロジック（初回・再抽選、prepare→(Overpass直接fetch)→process、need_fetchが続く限り繰り返すループ） | `public/js/search.js` | 済 | Phase 1で新設、Phase 2で改修、Phase 4-Bで交差点のプローブ→拡張の多段階に対応 |
| 現在地取得・距離／方角の表示整形（クライアント側） | `public/js/geo.js` | 済 | Phase 1 |
| 条件設定画面（GPS・探索範囲・目的地種類「スポット(店)/スポット(店以外)/交差点」・店の種類選択） | `public/js/views/condition.js` | 済 | Phase 1、Phase 4-Aで「店以外」トグル、Phase 4-Bで「交差点」を追加し3択に拡張 |
| 停車できる場所の条件UI | `public/js/views/condition.js` | 済 | Phase 4-A（交差点には設けない） |
| 現在地取得アイコンの状態色分け（成功=緑／失敗=赤） | `public/js/views/condition.js`、`public/styles.css`（`.location-icon.ok`/`.error`） | 済 | Phase 5棚卸し中の指摘対応 |
| コピー失敗時の通知（トースト） | `public/js/views/result.js`（`copyItem`） | 済 | Phase 5棚卸し中の指摘対応。従来は無言で失敗していた |
| 地図読み込み失敗時のメッセージ表示 | `public/index.html`（`#map-error`）、`public/js/app.js`（`mapTilerApiKeyError`）、`public/js/views/result.js`、`public/styles.css`（`.map-error`） | 済 | Phase 5棚卸し中の指摘対応 |
| 結果地図画面（下部シート、目的地情報タップでコピー/再抽選ボタン） | `public/js/views/result.js` | 済 | Phase 1、Phase 3で周辺情報表示・Phase 3.xでコピー処理を拡張、2026-08-29に「決める」ボタン撤去・下部シート再構成（[decision](./decisions/260829-decide-button-removal.md)） |
| 見つからない・エラー時にその場で再検索できるボタン | `public/js/views/result.js`（`#retry-button`） | 済 | Phase 4-B後の修正。画面遷移を強制していたのが動線として分かりにくいという指摘への対応 |
| 地図描画（MapLibre初期化、ピン、破線ルート、POIマーカー、フォーカスリング） | `public/js/components/map.js` | 済 | Phase 1、Phase 3で拡張 |
| 周辺情報展開画面（POI一覧・地図フォーカス連動） | `public/js/views/result.js`（`sheet-expanded`部分）, `public/js/nearby.js` | 済 | Phase 3、Phase 4-Aで駐車場ワイド検索（停車場所条件との整合性）を追加 |
| コピー項目設定（アプリ共通、緯度経度/名称/住所のチェックボックス） | `public/js/views/copy-modal.js`, `public/js/copy-preference.js` | 済 | Phase 1で「実行用モーダル」として新設、[decision](./decisions/260829-copy-preference.md)で「設定編集用」に役割変更 |
| 目的地・周辺POIのコピー実行（設定に従い直接コピー） | `public/js/views/result.js`（`copyItem`） | 済 | 同上 |
| 短時間通知（コピー完了トースト） | `public/js/toast.js` | 済 | 同上 |
| 長押しによる緯度経度の強制コピー（設定を無視） | `public/js/long-press.js`, `public/js/views/result.js`（`copyItem`の`forceLatLon`） | 済 | Phase 3.x、[decision](./decisions/260829-copy-preference.md)の追記部分 |

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
| Phase 4-A分割・停車場所条件の判断経緯 | `docs/decisions/260829-phase4a-店以外タグ地点と停車場所.md` | 済 |
| 「決める」ボタン撤去・下部シート再構成の経緯 | `docs/decisions/260829-decide-button-removal.md` | 済 |
| Phase 4-B（交差点検出）の判断経緯 | `docs/decisions/260830-phase4b交差点検出実装.md` | 済 |
| 全体の実装順序 | `docs/roadmap.md` | 済 |
| 各フェーズの計画・実行記録 | `docs/plans/*.md` | Phase 1〜4-B分済 |

## 更新ルール

- 機能を追加・変更・削除したら、対応する行をこの表にも反映する
- 新しいフェーズに着手する際、そのフェーズで新規作成予定のファイルが確定したら「未作成」の行を更新する
