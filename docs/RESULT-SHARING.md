# 結果とランキング順位の共有

通常クリアと30分モードの共有文、X投稿画面、記念PNG、スクリーンショット用カードに、取得できた全体順位・保存バージョン内順位を表示します。引用ポストと `#dontwork` は共通です。

順位は名前・タイムの照合や先頭50件からの推定ではなく、保存済みのクリアID／30分記録IDで取得します。通常は時間の昇順、同タイムでは登録IDの昇順です。30分は最終資産の降順、同額では登録IDの昇順。同じ採点ルール内で計算し、旧現金のみの記録と現金＋強化費の記録は混ぜません。

- `GET /api/rankings?completionId=UUID`
- `GET /api/bankroll-rankings?scoreId=UUID`

どちらも `{ranking: {recordId, appVersion, rulesetVersion, overallRank, versionRank} | null}` を返します。DBスキーマの変更はありません。`server/recordRank.js` が一つのSQL文で記録と両順位を読み、同じDBスナップショットを使います。

名前・記録の送信後、結果画面を開いた時点の順位を取得します。取得中はSNS共有を待機し、順位のない古いPNGを新しい共有文に添付しません。順位変更・名前変更・言語変更ではPNGを再生成します。結果画面を開き直すか再取得すると新しい順位になります。公開後に他の記録が増えれば順位は変わり、過去に保存・投稿した画像は更新されません。

未登録、過去のリセット対象、通信失敗では順位を省略し、結果や名前は保持します。LABの記録は順位を問い合わせません。通信失敗時の順位再取得は、記録の再登録や新しいIDの作成ではありません。登録済みフラグ・outboxを取り消しません。

公開フォークには公式DB固有のリセット境界を持ち込まないでください。公式の共有サービスでは、そのDBの履歴に応じて `clearRecordRank` の `afterId` を指定しています。通常のフォークでは既定の0を使用します。

関連実装: `src/resultRanking.tsx`、`src/useResultImage.ts`、`src/resultShare.ts`、`src/Leaderboard.tsx`、`src/TimeTrial.tsx`。テストは `server/recordRank.test.js` と `src/resultRanking.test.tsx` で、ページ外順位・同率の並び・旧採点ルール・巨大額・不正ID・未取得・別記録・PNGの文字を確認します。
