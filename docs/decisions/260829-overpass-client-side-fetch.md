# Overpass APIへの問い合わせをサーバー側からブラウザ側に変更

## 今の仕掛け（Phase 1〜2実装時点）がうまくいかない理由

touring-gachaは当初、Overpass APIへの問い合わせをCloudflare Workers（サーバー側）から行う設計だった。

```
ブラウザ → Cloudflare Worker（/api/destinations/search） → Overpass API
```

Phase 2で本番デプロイし実機確認したところ、この経路で送った検索リクエストが継続して失敗した。

- 症状: `POST /api/destinations/search` が毎回503（応答時間5〜9秒。Overpassが即座に拒否する挙動に近い）
- 切り分け: 同じ検索条件（緯度経度・半径・カテゴリ）のOverpass QLクエリを、本番Workerとは別のIPアドレス（開発機のローカル環境）から直接送ったところ、**HTTP 200・9.6秒で正常に成功**した。Overpass自体にもクエリ内容にも問題はない
- 一晩（12時間以上）空けても本番からのリクエストだけ症状が変わらなかった。単純な「テストで負荷をかけすぎたことによる一時的なレート制限」であれば時間経過で解消するはずだが、そうならなかった

**結論（推定、完全な確証はない）**: Cloudflare Workersの送信元IPアドレスは、touring-gacha専用ではなく他の無数のCloudflare Workers利用者と共有されている。そのIP帯が、Overpass API側で（他の利用者による負荷・乱用も含めて）ブロックないし強い制限を受けている可能性が高い。この種の「共有IP帯が外部サービス側で一括してブロックされる」事象は、Cloudflare Workersでは一般的に報告されている（[Cloudflare Community: My server's IP is being blocked by the workers](https://community.cloudflare.com/t/my-servers-ip-is-being-blocked-by-the-workers/669305)）。

### 検討した代替インスタンスと却下理由

無料枠運用方針（docs/decisions/260828-infra-cloudflare-kv.md）に沿って、Overpassの代替公開インスタンスを検討したが、いずれも採用しなかった。

| 候補 | 運営 | 却下理由 |
|---|---|---|
| `overpass.private.coffee`（旧 overpass.kumi.systems） | 個人運営 | 個人運営元への依存は避けたいというユーザーの判断 |
| `maps.mail.ru/osm/tools/overpass`（VK Maps） | ロシアのVK社 | 運営元の所在国を理由に除外というユーザーの判断 |
| Geofabrik Overpass API | ドイツの商用地理空間企業 | 有料（月10,000リクエストで€40/月〜、年払い）。無料枠運用方針に反する |

結果として、無料かつ組織的信頼性のある選択肢は現状使っている`overpass-api.de`（FOSSGIS運営）以外に見当たらなかった。

## 決定: Overpassへの問い合わせをブラウザから直接行う

インスタンスを変えるのではなく、**問い合わせの発信元を変える**方針とした。ブラウザが最初に問い合わせる先は変更後もCloudflare Workerのままであり、Overpassへ直接行くのはキャッシュがなかった場合のみである（この点は変更前と同じ。変わるのは「キャッシュミス時の実際のOverpassへの問い合わせを、Workerではなくブラウザが行う」という点だけ）。

```
変更後の順序:
1. ブラウザ → Worker（prepare）: キャッシュの有無を問い合わせる
2. キャッシュあり → Workerが結果を返して終了（Overpassには一切アクセスしない）
2'. キャッシュなし → WorkerがOverpass用クエリ文字列を返す
3. ブラウザ → Overpass API（直接、2'で受け取ったクエリを使用）
4. ブラウザ → Worker（process）: Overpassの生応答を渡す。Workerが解釈・フィルタ・キャッシュ保存・候補選定を行い最終結果を返す
```

Overpass APIは `Access-Control-Allow-Origin: *` を返しており、ブラウザからの直接アクセス（CORS）を明示的に許可していることをcurlで確認済み（Overpass Turboという公式Webツールも同じ方式で動いている）。ブラウザ（＝ユーザーの実機の回線）から直接問い合わせれば、Cloudflareの共有IPを経由しないため、今回の問題を回避できる。

### 設計変更の要点

- Overpass QLクエリの組み立て（`buildOverpassQuery`）、Overpass応答の解釈（`toCandidates`, `excludeNearHighways`）、KVキャッシュ、候補選定ロジックは**サーバー側に残す**（重複実装を避けるため）
- `POST /api/destinations/search` を2段階に分割する:
  1. `prepare`: クライアントが検索条件を送る。KVキャッシュがヒットすればそのまま結果を返す（＝Overpassへ一切アクセスしない。再抽選は従来通りこの経路で完結する）。ミスした場合はOverpass QLクエリ文字列を返す
  2. クライアントがそのクエリ文字列を使い、ブラウザから直接Overpass APIへfetchする
  3. `process`: クライアントがOverpassの生レスポンス（JSON）をそのままサーバーへ送る。サーバー側で今まで通り解釈・フィルタ・キャッシュ・候補選定を行い、最終結果を返す
- 識別ヘッダーは、ブラウザがJSから上書きできない`User-Agent`ではなく、ブラウザが自動送信する`Referer`ヘッダーに委ねる（Overpassの利用ポリシー上、どちらでも識別要件を満たす）
- Overpassの429/5xxやタイムアウト（`remark`フィールド）は、ブラウザでの直接fetch時にも検知し、既存と同等のエラーメッセージ（「混み合っています。しばらくしてからお試しください。」）を表示する

## 今後の留意点

- この変更は「Cloudflareの共有IPがブロックされている」という推定に基づく対症療法である。仮に推定が誤っていた場合（実は別の原因だった場合）、この変更をしても直らない可能性がある。実装後、実機での再確認が必須
- ブラウザから直接外部APIへ問い合わせる設計になるため、今後Overpass以外の外部APIをサーバー側から呼ぶ機能を追加する際は、同種の問題（Cloudflare共有IPのブロック）が起こり得ることを念頭に置く
