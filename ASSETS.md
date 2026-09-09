# Assets and licensing

このリポジトリの素材は、以下の区分で公開しています。オリジナル素材は[MITライセンス](LICENSE)で利用・変更・再配布できます。第三者の音楽やフォントは、それぞれのライセンスを維持してください。

## オリジナル素材 — MIT

| 素材 | 主な場所 | 制作方法 |
| --- | --- | --- |
| DWロゴ、ワードマーク、アプリアイコン | `public/icons/`、`public/apple-touch-icon*.png` | 編集可能なSVGと、そのPNG書き出し |
| 架空の紙幣・硬貨・イントロ画像 | `public/banknotes/`、`public/work-banknote.png`、`public/flip-*-coin.png`、`public/intro-cash*.png` | プロジェクト向けに制作したAI生成画像と加工画像 |
| 共有用の画像 | `public/og*.png` | プロジェクト向けに制作・編集したブランド画像 |
| 効果音・合成BGM | `src/audio.ts`、`src/audioPalette.ts`、音声生成用コード | Web AudioやPCMによるプログラム生成 |
| 音声確認用の生成物 | `public/audio-check*`、`scripts/generate-audio-check.mjs` | 合成音の確認用ツールと出力 |

紙幣・硬貨はゲーム内の架空の意匠です。画像の一部はAI画像生成ツールを使って制作しています。編集可能なロゴの元データは`public/icons/dontwork.svg`と`public/icons/dontwork-wordmark.svg`です。

通常のビルドはコミット済みの画像を使用します。アイコンを再生成する場合は`sharp`を利用できる環境で`scripts/generate-icons.mjs`を実行します。素材の再利用が公式運営の承認や提携を意味するものではありません。

## 録音BGM — CC BY 4.0

次の4曲は**Kevin MacLeod (incompetech.com)**の作品です。オリジナルのコードや画像に適用するMITライセンスには含めません。

| 曲名 | 配信ファイル |
| --- | --- |
| Bit Quest | `public/music/bit-quest.m4a` |
| Pixelland | `public/music/pixelland.m4a` |
| Cipher | `public/music/cipher.m4a` |
| Envision | `public/music/envision.m4a` |

[Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)で配布しています。公式MP3をWeb配信用のAAC-LCへ変換しており、曲の構成・テンポ・演奏時間は編集していません。

音源を再配布するときは[public/music/ATTRIBUTION.md](public/music/ATTRIBUTION.md)を同梱し、ゲーム内にも見つけやすい音楽クレジットを残してください。正確な作者・曲名・配布元・ライセンス・加工内容を同ファイルに記載しています。[作者のクレジット案内](https://incompetech.com/music/royalty-free/faq.html)も参照できます。

## フォントと依存コード

ManropeとDM MonoはSIL Open Font License 1.1です。JavaScriptパッケージを含むその他の依存関係は[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)を参照してください。

## English

Original artwork, editable logos, generated images, synthesized audio, and their source code are available under MIT. Some original images were created with AI image-generation tools. The four Kevin MacLeod recordings are separate CC BY 4.0 works: retain their attribution file and visible in-game music credits. Fonts and dependency code retain their upstream licenses.
