# dontwork.fun

**働かず、相場で遊ぶ。**

WORKで元手を作り、ポジションを組み合わせ、架空の資産を増やしていくブラウザゲームです。1〜100の共通の出目で全ポジションが決着。連勝、急落、ジャックポットを眺めながら、$1Bを目指します。

[ゲームを遊ぶ](https://dontwork.fun/) · [開発に参加](CONTRIBUTING.md) · [素材とライセンス](ASSETS.md)

友達も、初めて来た人も、Codexなどのコーディングエージェントも開発に参加できます。forkして自由に改造し、本家へ取り込みたい変更はPull Requestで共有してください。

## 開発者向けの読み方

| 知りたいこと | 読むファイル |
| --- | --- |
| どんな面白さを目指しているか、変更の判断軸 | [思想と設計方針](docs/PHILOSOPHY.md) |
| 今のLABで何を試せるか、標準値とランキングへの影響 | [LAB機能ガイド](docs/LAB.md) |
| コードの分担、精算と演出、保存、API | [アーキテクチャ](docs/ARCHITECTURE.md) |
| fork、ローカル開発、PRの送り方 | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Codexなどが作業を始めるときの指示 | [AGENTS.md](AGENTS.md) |

LABと設計ガイドは、v3.0.0の現行実装を説明します。2026-09-10に2番目のギャンブルへの入替チュートリアルと全桁金額表示を追記しました。同じアプリバージョンでも仕様が更新されるため、変更するPRでは関連するガイドも一緒に更新してください。

## 現在のゲーム

- ポジションとアップグレードを組み合わせる通常プレイ、時間制チャレンジ、LABの比較ルール。
- 日本語・英語、モバイル・デスクトップ、PWAに対応。
- ブラウザ内の自動保存とセーブの書き出し・読み込み。
- コードで生成する効果音と3種類のBGM。BGMは標準OFFで、音楽アイコンから選べます。
- React / TypeScript / Vite。オンライン機能には任意でCloudflare Workers / D1を使用します。

通常モードをクリアすると30分モードが解放されます。通常モードのセーブとクリア記録は別に残ります。LABから先に解放することもできます。

通常モードの背景進行は標準ONで、音をONにして使います。通知は不要で、ジャックポットが出ると進行を停止します。ヘッダーのベルから任意でジャックポット通知を設定できます。30分モードは画面を離れると一時停止し、砂時計で再開します。通常モードはAUTOボタンなしが標準で、賭け金とギャンブルがそろえば自動で回ります。LABで手動AUTOへ戻したり、別バージョン、日本語のギャンブル名、序盤のスピン補助設定を試せます。標準のギャンブル名は英語です。合言葉によるセーブ転送は廃止し、端末内の自動保存を継続します。

曲別の計測は、同意済みプレイヤーの前景での実プレイ時間のみ記録します。集計方法は [音楽の比較](docs/music-usage.md) を参照してください。

## ローカルで遊ぶ・開発する

**Node.js 22.13以上とnpm**を使用します。サーバーのテストには組み込みの`node:sqlite`が必要です。

```sh
git clone https://github.com/aaagamesnuun/dontwork.fun.git
cd dontwork.fun
npm ci
npm run dev
```

変更を本家に提案する場合は、GitHubでforkし、自分のforkのURLをcloneしてください。Codexにはそのフォルダを開かせ、変更したい内容を伝えます。入口となる開発指示はルートの`AGENTS.md`にあります。

表示されたローカルURLを開きます。音は最初の操作後に再生できます。進行はブラウザのlocalStorageに保存されるため、配信元・ブラウザ・端末が変わると別のセーブになります。

```sh
npm test
npm run build
npm run preview
```

`npm test`はゲーム・UI・Worker・生成スクリプトのテストを実行します。ビルドした静的ファイルは`dist/client/`に出力されます。`npm run preview`はその確認用です。

静的ホスティングだけでもゲームとローカル保存を利用できます。現在の配信パスはサイトのルート(`/`)です。サブディレクトリで配信する場合は、Viteの`base`に加え、PWAと絶対パスの素材参照も合わせて変更してください。

## forkとオンライン機能

通常のforkでは、ランキング・問い合わせなどのオンラインサービスは**初期状態でOFF**です。公式サイト用のサービス接続を用意する必要はありません。

自分のAPIを同じ配信元の`/api/*`で運用する場合は、`.env.local`に次を設定してビルドします。

```dotenv
VITE_ENABLE_SERVICES=true
VITE_ENABLE_TELEMETRY=false
```

`VITE_ENABLE_TELEMETRY=true`は計測を別途有効にしたい場合の設定で、新規プレイの計測設定の初期値を変えます。保存済みの選択はゲーム内の設定で変更できます。localhostでの計測送信は抑止されます。

`VITE_*`はブラウザに公開されるビルド時設定です。サーバーの秘密情報は入れないでください。フォントのGoogle Fonts読み込みは、このオンラインサービス設定とは別です。[外部素材の詳細](THIRD_PARTY_NOTICES.md)を参照してください。

## 自分のCloudflare環境で動かす

以下は自分のWorkerとD1を使うための最小例です。ローカルゲームの開発には不要です。

1. [Cloudflare D1の手順](https://developers.cloudflare.com/d1/get-started/)で自分のデータベースを作成します。
2. 次の内容を`wrangler.jsonc`として保存し、名前とデータベースIDを置き換えます。

```jsonc
{
  "name": "dontwork-fork",
  "main": "server/worker.js",
  "compatibility_date": "2026-09-01",
  "assets": {
    "directory": "./dist/client",
    "binding": "ASSETS",
    "run_worker_first": true
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "dontwork-fork",
      "database_id": "YOUR_D1_DATABASE_ID",
      "migrations_dir": "drizzle"
    }
  ]
}
```

`DB`と`ASSETS`はコードが参照するbinding名なので、そのまま使います。`drizzle/`には空のデータベースから始めるためのマイグレーションがあります。

ローカルのWorkerには、Git管理しない`.dev.vars`で独立した秘密情報を渡します。

```dotenv
TELEMETRY_HASH_KEY=replace-with-your-own-random-local-key
```

計測・問い合わせなどの識別子のハッシュ化に使います。公開環境には[Wranglerのsecret storage](https://developers.cloudflare.com/workers/configuration/secrets/)で別の値を設定します。継続運用するデータに対応する秘密情報は保持してください。

```sh
npm run build
npx wrangler d1 migrations apply DB --local
npx wrangler dev
```

自分の公開環境へ配信する場合は、そのDBにマイグレーションを適用し、秘密情報を設定してからデプロイします。

```sh
npx wrangler d1 migrations apply DB --remote
npx wrangler secret put TELEMETRY_HASH_KEY
npx wrangler deploy
```

独自ドメインで配信するときは、`index.html`の共有用URLなども自分のURLに合わせてください。

## コードの構成

| パス | 内容 |
| --- | --- |
| `src/game/` | 抽選・精算・ポジション・強化・セーブ検証 |
| `src/presentation.ts` | 確定した結果と画面への公開タイミング |
| `src/` | React UI、翻訳、音、演出、PWA、ローカル保存 |
| `server/` | 任意のWorkers APIとテスト |
| `db/`, `drizzle/` | DBスキーマとマイグレーション |
| `public/` | 画像、アイコン、録音BGMとクレジット |
| `scripts/` | ビルド後処理、PWA生成、開発用ツール |

## ライセンス

オリジナルのコード・文書・生成画像・合成音源は[MIT](LICENSE)です。録音BGM4曲はKevin MacLeod作のCC BY 4.0作品で、[音楽クレジット](public/music/ATTRIBUTION.md)が適用されます。フォントと依存パッケージは各作者のライセンスに従います。

詳しくは[ASSETS.md](ASSETS.md)と[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)を参照してください。

## English overview

**dontwork.fun** is an incremental browser game about fictional money, shared random rolls, portfolio combinations, and jackpot chains. Play with local saves, experiment in the LAB, or try a timed challenge. Japanese and English UI, synthesized audio, three optional BGM styles, and PWA support are included.

Use Node.js 22.13+ and run `npm ci`, then `npm run dev`. Validate changes with `npm test` and `npm run build`. Ordinary forks start with online services disabled; opt in with `VITE_ENABLE_SERVICES=true` only when hosting your own same-origin API. Telemetry has a separate setting. Original code and generated artwork use MIT; the four recorded music tracks use CC BY 4.0 with attribution.

Contributor guides: [design philosophy](docs/PHILOSOPHY.md), [LAB reference](docs/LAB.md), [architecture](docs/ARCHITECTURE.md), and [coding-agent instructions](AGENTS.md). Forks and pull requests are welcome.
