# Contributing

不具合報告、遊びやすさ、ゲームバランス、翻訳、アクセシビリティ、音と演出の改善を歓迎します。大きなルール変更は、最初にIssueで目的とプレイへの影響を共有してください。

人間だけで開発しても、Codexなどと一緒に開発しても構いません。初めて参加する場合は[思想](docs/PHILOSOPHY.md)を読み、触る部分に応じて[設計](docs/ARCHITECTURE.md)と[LAB](docs/LAB.md)を参照してください。エージェント向けの作業指示は[AGENTS.md](AGENTS.md)にまとめています。

## 変更を送る

1. このリポジトリをforkしてcloneし、作業ブランチを作ります。既に書き込み権限がある場合は、このリポジトリ内の作業ブランチでも構いません。
2. Node.js 22.13以上で`npm ci`を実行します。
3. `npm run dev`で変更を確認します。
4. 動作を変える場合は、変更に関係するテストを追加・更新し、`npm test`と`npm run build`を実行します。文書だけの変更は、説明と実装の整合、リンクを確認します。
5. forkの作業ブランチから本家の`main`へPRを送ります。問題、変更後の動作、確認したことを記載してください。遊び方や見た目の変更には、操作手順と期待する結果を短く添えます。未実施の実機確認を、確認済みとは書きません。

LABの設定・既定値・ランキング適格性を変えたら[LABガイド](docs/LAB.md)、保存やデータの流れを変えたら[設計ガイド](docs/ARCHITECTURE.md)も更新してください。自分のforkでの実験と、本家への採用提案はどちらも歓迎します。

特定のテストだけを実行する例:

```sh
npm test -- src/presentation.test.ts
npm run test:watch
```

WorkerのテストはSQLiteのメモリ内DBを使います。通常の開発・テストにCloudflareアカウントや公開DBは必要ありません。

## 大切にしている動作

- **精算は一度だけ。** 抽選の確定と画面への公開を区別し、演出中のWORK・購入・FLIPで未公開の勝ち金を使えないようにします。
- **進行を守る。** セーブ形式を変えるときは移行を用意し、既存セーブと確定済みのクリア記録を確認します。ルール変更が記録の比較条件に影響する場合はPRに記載します。
- **操作を止めない。** モバイル、キーボード、ミュート、動きを抑える設定を確認します。タイマーや音は画面の終了・バックグラウンド移行・リセット時に片付けます。
- **日本語と英語を揃える。** UI文言は既存の翻訳方式を使い、短い画面幅で読める長さにします。
- **素材の出典を残す。** 画像や録音を追加するときは、作者・配布元・再配布ライセンス・加工内容を同じPRに含めます。

## 不具合を報告する

Issueにはバージョンまたはcommit、ブラウザとOS、通常タブかPWAか、再現手順、期待した結果と実際の結果を添えてください。再現用のセーブは新規プレイから作り、架空の名前を使ってください。プレイヤーの実データや秘密情報を含めずに再現できる小さな例が理想です。

## 任意のオンライン機能

forkのオンラインサービスは既定でOFFです。有効にする場合は自分の同一配信元のAPIとDBを使います。接続設定は[README](README.md#forkとオンライン機能)を参照してください。

`.env.local`、`.dev.vars`、実環境用の`wrangler.jsonc`、`.wrangler/`、ローカルDB、ビルド成果物はPRに含めません。設定の共有には秘密情報を持たない例を使います。

## ライセンス

オリジナルのコード・文書・素材への貢献は、このプロジェクトのMITライセンスで提供してください。第三者の素材は元のライセンスとクレジットを維持し、[ASSETS.md](ASSETS.md)または[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)を更新します。

## English

Bug reports and focused pull requests are welcome. Include reproduction steps, expected and actual behavior, and relevant validation. Use synthetic saves rather than player data. For behavior changes, run `npm test` and `npm run build`; for documentation-only changes, check source accuracy and links. Preserve save compatibility and single settlement of each result, and include source/license details for new assets. Original contributions are accepted under MIT; third-party material keeps its own license.
