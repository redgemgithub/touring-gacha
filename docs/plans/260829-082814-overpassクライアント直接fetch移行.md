# Overpass API問い合わせをブラウザ直接fetchに変更

## Context

Phase 2（初回デプロイ・本番運用の疎通確認）の実機確認で、`POST /api/destinations/search`が本番環境から一貫して503で失敗することが判明した。診断の結果、Cloudflare Workersの共有送信元IPアドレスがOverpass API側で制限されている可能性が高いと判断した。詳細な原因分析・検討した代替案・却下理由は [docs/decisions/260829-overpass-client-side-fetch.md](../decisions/260829-overpass-client-side-fetch.md) に記録済み。

本計画は、その決定に基づき、Overpassへの問い合わせをサーバー（Workers）からブラウザへ移す実装を行う。

## DoD（完了条件）

1. 検索実行時、Overpass APIへのHTTPリクエストがブラウザ（クライアント）から直接送信される（Cloudflare Workersを経由しない）
2. KVキャッシュがヒットする場合は、従来通りOverpassへ一切アクセスせず結果を返す（再抽選の高速性を維持）
3. 高速道路100m除外・候補変換・キャッシュ・ランダム選出のロジックはサーバー側に残り、変更前と同じ結果になる
4. Overpassの429/5xx・タイムアウト時、従来と同じエラーメッセージがブラウザに表示される
5. `npm run typecheck` が通る
6. ローカル（`wrangler dev`）で一連の流れが動作する
7. 本番（`wrangler deploy`後）で実機から検索し、候補が表示されるところまで到達する（Phase 2のDoD5を満たす）

## 技術設計

### バックエンド

`POST /api/destinations/search` を廃止し、2つのエンドポイントに分割する。

- **`POST /api/destinations/prepare`**
  - リクエスト: `{ lat, lon, radiusKm, category, excludeIds }`（現行と同じ）
  - KVキャッシュをチェックする（`buildCacheKey`は現行のまま）
  - **キャッシュヒット時**: 現行の`destinations.ts`同様、`excludeIds`を除いてランダム選出し、`{ status: "done", picked, candidates, cacheHit: true, searchedAt }` を返す（Overpassへは一切アクセスしない）
  - **キャッシュミス時**: `buildOverpassQuery`で組み立てたクエリ文字列とOverpassのエンドポイントURLを返す（`{ status: "need_fetch", query, endpoint, cacheKey }`）。`cacheKey`は次段の`process`で使うためクライアントに一時的に持たせる
- **`POST /api/destinations/process`**
  - リクエスト: `{ cacheKey, category, excludeIds, overpassResponse }`（`overpassResponse`はクライアントがOverpassから受け取った生JSON）
  - `overpassResponse`に`remark`フィールドがあればエラーとして扱う（現行`fetchOverpass`内のチェックと同等のロジックをここに移す）
  - 現行と同じ手順（要素を候補/高速道路に分離→`toCandidates`→`excludeNearHighways`→KV `put`→ランダム選出）を行い、`{ picked, candidates, cacheHit: false, searchedAt }` を返す

`src/lib/overpass.ts`の`fetchOverpass`（サーバー側からのfetch実行部分）は不要になるため削除する。`buildOverpassQuery`と`remark`検知ロジックは残し、後者は`process`ルート側の関数として整理する。

### フロントエンド

`public/js/search.js`の`performSearch`を変更する。

1. `POST /api/destinations/prepare` を呼ぶ
2. `status: "done"` ならそのまま結果を反映して終了（現行のキャッシュヒット時と同じ体感）
3. `status: "need_fetch"` なら、返された`query`を使いブラウザから直接Overpass APIへ`fetch`する
   - Overpassの応答が429/5xxならエラー（「混み合っています。しばらくしてからお試しください。」）として扱う
   - 成功したら生JSONを`POST /api/destinations/process`へ送る
4. `process`の結果を反映する

`public/js/api.js`に`prepareSearch`, `fetchOverpassDirect`, `processSearch`の3関数を用意する（現行の`searchDestinations`を置き換え）。

### 型定義

`src/types.ts`に`PrepareRequestBody`, `PrepareResponseBody`（done/need_fetchのユニオン型）, `ProcessRequestBody`を追加する。

## 実装ステップ順序（各ステップに検証方法つき）

1. `src/types.ts` に新しい型を追加 → typecheck
2. `src/lib/overpass.ts` を整理（`fetchOverpass`削除、`remark`検知ロジックを関数として独立させ`process`から呼べるようにする） → typecheck
3. `src/routes/destinations.ts` を `prepare`/`process`の2ルートに分割（ファイル名は`destinations.ts`のまま、パスを`/prepare`, `/process`にするか、`prepare.ts`/`process.ts`に分けるかは実装時に判断） → typecheck
4. `wrangler dev`を起動し、curlで`prepare`（キャッシュミス時に`query`が返る）→ 手動でそのクエリをOverpassへcurl → 結果を`process`にPOST、という一連をcurlのみで再現し、最終的な`picked`が返ることを確認
5. 同一条件で`prepare`を再度呼び、`status: "done"`（キャッシュヒット）になることを確認
6. `public/js/api.js` を書き換え（`prepareSearch`, `fetchOverpassDirect`, `processSearch`）
7. `public/js/search.js` の `performSearch` を新フローに書き換え
8. `wrangler dev` + ブラウザで、条件設定→検索→結果表示→再抽選の一連をE2E確認（Playwright、Phase 1と同様の手法）。ブラウザのNetworkタブで、Overpassへのリクエストが`overpass-api.de`に対して**ブラウザから直接**発生していることを確認する
9. Overpass 429/5xx時のエラー表示を確認（可能であれば。Overpassへ意図的に負荷をかけるテストは行わず、コードレビューで代替してもよい）
10. `npm run typecheck` 最終確認
11. `wrangler deploy` で本番反映
12. 実機で検索を実行し、候補表示まで到達することを確認する（Phase 2のDoD5達成の最終確認）
13. `docs/plans/260828-183112-phase2-初回デプロイ疎通確認.md` に、この変更によりPhase 2のDoD5が満たされたことを追記する

## リスク・注意点

- 決定記録に明記の通り、この変更は推定（Cloudflare共有IPのブロック）に基づく対症療法。本番実機確認で改善しなければ、原因の再調査が必要
- Overpassへのリクエストがブラウザから直接見える設計になるため、クエリ内容（緯度経度等）がブラウザの開発者ツール等から見えるようになるが、そもそも緯度経度はブラウザ自身が取得した値であり、新たな情報漏洩にはならない
- KVキャッシュキー（`cacheKey`）を`prepare`→`process`間でクライアントに一時的に持たせることになるが、キー自体は座標のバケット化文字列であり機密情報ではない

## 実行結果

計画通りステップ1〜11を実施した。

- ステップ1〜3（型定義、`overpass.ts`整理、`destinations.ts`を`/prepare`・`/process`に分割） → `npm run typecheck`エラーなし
- ステップ4〜5（curlでの動作確認）: `wrangler dev`で `/prepare`（キャッシュミス時に`need_fetch`とクエリ文字列を返す）→ 取得したクエリでOverpassへ直接curl → `/process`に生データを渡す、という一連をcurlのみで再現し成功。再度`/prepare`を呼ぶと`status:"done"`・`cacheHit:true`でキャッシュが効くことも確認
- ステップ6〜7（`public/js/api.js`, `search.js`書き換え） → `node --check`で構文確認
- ステップ8（Playwright E2E）: 探索範囲30km・買い物その他で検索 → 候補「日産」を地図・下部シートに表示、**Overpassへのリクエストがブラウザから直接`overpass-api.de`宛に1回発生したことをNetworkイベントで確認**（サーバー経由ではない）。再抽選時はOverpassへの追加リクエストなし（1回のまま）。コンソールエラーなし
- ステップ9（429/5xx時のエラー表示）: Overpassへの負荷を避けるため実際のエラー誘発はせず、`api.js`の`fetchOverpassDirect`が429/5xxを検知し`search.js`側で従来と同じエラーメッセージに変換するロジックをコードレビューで確認
- ステップ10（最終typecheck） → エラーなし
- ステップ11（`wrangler deploy`） → 成功。`/api/health`, `/api/config`とも本番で200 OK確認済み

ステップ12（実機での候補表示確認）はユーザー対応待ち。

### ステップ12 → 成功

ユーザーが実機（本番URL）で「目的地をさがす」を実行。約10数秒後（Overpassが実際にデータを処理して返す、成功時特有の所要時間）に候補が1件表示され、「この場所に決める」ボタンが有効化された。

これにより、Phase 2で発生していたブロッカー（本番Workerからの`POST /api/destinations/search`が503で失敗し続ける問題）は解消したことを確認した。[docs/decisions/260829-overpass-client-side-fetch.md](../decisions/260829-overpass-client-side-fetch.md)に記載した推定（Cloudflare Workersの共有送信元IPがOverpass側で制限されていた）が正しかったことが、この修正の成功によって裏付けられた。

DoD 1〜7すべて達成。ステップ13として、Phase 2の計画ファイルにこの結果を反映する。
