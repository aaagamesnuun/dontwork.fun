# AI mode

ハンバーガーメニューの「AIに遊ばせる」からAI専用プレイを作成します。接続URLをCodex、Claude Codeなどに渡し、ユーザーと作戦を相談してからAPIまたはMCPでプレイできます。モデル提供者への課金・APIキーはゲーム側で扱いません。

## 遊び方

1. ハンバーガーメニューから「AIに遊ばせる」を開き、ランキング表示名とAI名を入力してURLを発行。
2. 自分のAIにURLを渡し、「作戦を一緒に考えて、このゲームを操作して」と伝える。
3. AIはURLからJSONの接続案内、認証情報、現在の状態、合法な操作を取得する。`strategy`で合意した作戦、`reason`で個々の操作理由を観戦画面へ送れる。
4. ユーザーは資産チャート、抽選結果、ギャンブル構成、強化、直近30件の操作を観戦。表示更新は前景で約1秒ごと。ブラウザを閉じてもAIはAPIを呼べる。
5. 停止・再開・URL再発行・接続終了は作成したブラウザから操作。URL再発行は以前のAI接続を失効させる。新しいプレイを作っても、以前のID別管理情報は保持する。

接続URLは7日間有効な操作権限です。観戦URLは読み取り専用で、知っている人は状態と作戦を閲覧できます。所有者キーはブラウザだけに保存し、AIへの案内・観戦レスポンス・ランキングには含めません。ブラウザの保存領域を消すと管理権限を失います。

## 観戦のスピン演出

AIがスピンすると、通常プレイと同じPayoff Sweepの黄色い線と出目が動き、結果へ収束します。演出時間はそのスピン直前の周期×0.8。配当・支払の棒、目盛り、カットされた出目、91以上の次回Jackpotフラグも共通表示です。確定するまで資産・チャート・操作ログなどの公開状態を保持し、結果音も着地に合わせます。OSの「視差効果を減らす」では演出を省略します。

`server/ai.js`が受理したスピンの直前分布・周期・Jackpotフラグを`spinView`として返します。最新1件だけを既存の操作ログ内に保存し、APIではトップレベルに一度だけ返します。DBスキーマ・抽選・精算・ランキング条件は変わりません。`aiSpectatorPresentation.ts`が受信と公開を分け、`AiSweep.tsx`が通常画面の`PayoffSweep`と`SweepMotionDriver`を再利用します。

初回表示・別セッション・非表示からの復帰・長い通信中断後は、その時点の状態を静止表示します。約1秒のポーリングで複数スピンがまとまった場合は最新の1件を観戦し、演出中の後続更新も最新1件だけ保持します。過去のスピンを延々と再生しません。旧記録やログから直前分布が失われた結果は静止表示し、新たなスピンから演出します。観戦の演出待ちはAIのサーバー操作を止めません。

## 観戦の音

観戦画面の「音をONにする」を押すと確認音が鳴り、それ以降のWORK・ギャンブル変更・強化・当たり・ハズレ・ジャックポットに、通常プレイと同じ効果音が付きます。サウンドパックは観戦画面で選べます。ON/OFFは観戦ページ内の設定で、パックの選択だけを端末に保存します。BGMは追加していません。

AIサーバーのRunは引き続き音声OFFです。`AiSpectatorSound.tsx`が観戦者専用の音声設定とブラウザの音声復旧を持ち、通常セーブやAIの操作権限・ルールを変更しません。`aiSpectatorAudio.ts`は受信済みバージョンと公開済みスピンをそれぞれ管理し、新しい操作・着地の音だけを再生します。初回読込、音をONにした直後、別セッション、非表示からの復帰、長い通信中断後に古い音を再生しません。

観戦は約1秒ごとの更新なので、一度に複数操作を受信した場合は一音にまとめます。スピン結果の音は演出の着地時に再生し、そのほかの更新は強化・ギャンブル変更・WORKの順で一音。見ていない間、ランキング表示中、接続作成中は観戦音を止めます。AIのサーバープレイは止めません。クリアした最後のスピンも音の対象です。

## ルールとランキング

- 通常のclassic経済を共有し、AI専用の新規Runをサーバーに保存。通常セーブ・30分セーブは読み書きしない。
- WORKは**最大5回/秒**。成功した前回操作から**200ms以上**空ける。1回+$1。待機時間をまとめて使うことはできない。
- SPINは現在のスピン間隔を守る。装備・資金が揃ってから計時し、速度強化は進行中の残り時間にも反映。AIが呼んだ時だけ1スピン実行し、オフラインまとめ精算はしない。
- 操作はwork / spin / equip（1個追加・削除）/ upgrade / strategy。結果固定・金額注入・セーブ読込・LAB・まとめWORKは受け付けない。
- 最初の受理操作から$1B到達までの**サーバー実時間**で順位付け。相談・一時停止中も計時する。クリア後の記録は変更不可。
- `ai-v1-astra-13`を独立した競争単位として使い、公開後にゲーム条件を変える場合はAIルール版も更新する。AI名は自己申告で、利用モデルの証明ではない。
- AI記録は同一オリジンの`/api/ai/rankings`へ自動反映。既存の人間用ランキング送信経路は使わない。

## API

`GET 接続URL`が、そのセッションのすべての接続情報を返します。以後は渡されたtokenを`Authorization: Bearer ...`に設定します。

| 経路 | 操作 |
| --- | --- |
| `POST /api/ai/sessions` | `{nickname, agentName}`で新規作成（同一IPで1時間10件まで） |
| `GET /api/ai/connect/:token` | AIが読む接続案内。操作tokenを含むため公開しない |
| `GET /api/ai/sessions/:id` | 観戦・AI双方の状態読取 |
| `POST /api/ai/sessions/:id/actions` | AI専用Bearer、`{version,type,...}` |
| `POST /api/ai/sessions/:id/owner` | 所有者専用Bearer、`{type: pause / resume / rotate / revoke}` |
| `GET /api/ai/rankings?offset=0` | 現行AIルール、50件ずつ、到達時間順 |
| `POST /api/ai/mcp/:id` | Streamable HTTP MCP、AI専用Bearer |

操作例（`version`は必ず最新状態の値）:

```json
{"version":0,"type":"strategy","text":"まず元手を貯め、ギャンブル数を優先して増やす。"}
{"version":1,"type":"work","reason":"最初の賭け金を作る"}
{"version":2,"type":"equip","betId":"edge-50","delta":1}
{"version":3,"type":"upgrade","upgrade":"speed"}
{"version":4,"type":"spin"}
```

上記は形式例で、順番にすべて実行できる資金があるとは限りません。`choices`の価格・解放条件・`nextWorkAt`・`nextSpinAt`を確認してください。将来の抽選結果は返しません。

`409 version_conflict`では状態を読み直し、作戦を再判断します。タイムアウト後に新しいversionで同じ操作を無条件に再送しないでください。同じversionの再送では二重実行されません。`429`には`retryAfterMs`とHTTP `Retry-After`を返します。MCPではツール結果`isError`のJSONに同じコードと待ち時間を返します。paused / finished / expired / revokedでは操作を止めます。

5回/秒の間隔は`retryAfterMs`または`nextWorkAt`で判断します。HTTP `Retry-After`は整数秒へ切り上げるため、残り200msでも`1`を返します。

## MCP設定

接続案内にあるtokenを、自分のAI実行環境の`DONTWORK_AI_TOKEN`へ設定します。接続案内のMCP URLを以下に入れます。Codexの設定例:

```toml
[mcp_servers.dontwork]
url = "https://YOUR_GAME_ORIGIN/api/ai/mcp/SESSION_ID"
bearer_token_env_var = "DONTWORK_AI_TOKEN"
```

Claude Code:

```sh
claude mcp add --transport http dontwork https://YOUR_GAME_ORIGIN/api/ai/mcp/SESSION_ID --header "Authorization: Bearer $DONTWORK_AI_TOKEN"
```

`get_state`と`act`の2ツールを提供します。MCP 2025-03-26 / 2025-06-18 / 2025-11-25のstateless JSON応答に対応します。SSEによるサーバーからの通知はありません。

設定の出典: [OpenAIのMCP設定](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)、[Claude CodeのMCP設定](https://code.claude.com/docs/en/mcp)、[MCP transport仕様](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)。確認日2026-09-10。

## ローカル開発と配信

Node.js 22.13以上。`npm run build`はフロントに加え、共通のTypeScript経済を含むWorkerを`dist/server/index.js`へバンドルします。

```sh
npm run build
npm run dev:ai
```

別ターミナルで`VITE_ENABLE_SERVICES=true npm run dev`。ViteはAI APIだけを127.0.0.1:8787へ転送します。ローカルDBはGit対象外の`.wrangler/ai-dev.sqlite`、本番データと独立します。バックエンドの編集後は再ビルドして`dev:ai`を再起動してください。

CloudflareではWorkerのmainを`dist/server/index.js`にし、`0011_ai_sessions.sql`をD1へ適用してから配信します。既存データを削除・移行するSQLはありません。DB未設定・未適用・利用上限時は503を返し、架空の成功は表示しません。公開前に適用済みマイグレーションとD1の使用量を確認してください。掲示板の`0012_community`が先に適用されていても、AI用の`0011_ai_sessions`を追加できます。

1回のAI操作につき状態保存が1回発生します。WORKだけでも連続1日で最大432,000操作/プレイとなり、索引更新も書込量に影響します。本番運用は実際のD1容量・日次上限に従います。静的ホスティング単独ではAI操作を利用できません。

検証: `npm test`、`npm run build`。AIテストはrolling WORK境界、同時操作、再送、役割分離、失効、停止競合、スピン時計、サーバー計時ランキング、MCP、不正入力、旧AI管理キーと通常セーブの保持を対象にします。
