# 曲ごとのプレイ時間

BGMは標準OFF。音楽画面でPulse / Night / Arcadeを選べます。旧録音曲の選択はOFFへ移行し、ゲームの進行を保持します。

`music_play_batch`を既存の計測送信に追加しています。通常の実プレイ時計と同じ条件・時間差で加算し、前景のみを計測します。開始前・非表示・停止した30分モード・長時間の無操作は含めません。15秒ごとの送信とページを離れる時の送信を使い、再送はeventIdで重複排除します。計測OFFのプレイは送信しません。

- `musicPack`: 公開済みのスピン状態・自動選曲を反映した曲ID。
- `music`: Web AudioがrunningかつBGMバスが有効、またはファイル再生要素が再生中か。
- `requested`: BGMの設定と音量から再生が要求されているか。
- `durationMs`: その状態で遊んだ時間。
- `phase`: normal / jackpot。

端末側で実際に聴こえたかや端末音量は検知できません。`requested=true, music=false`は再生待ち・停止であり、BGMなしを選んだ時間と区別します。これはユーザー自身が選曲した結果の比較で、ランダム割付による因果効果の検証ではありません。

以下を自分のD1で実行すると、人数・ラン数・合計時間・1ラン当たりの時間を確認できます。LABと通常モードは別に集計し、期間は必要に応じて変更してください。

```sql
WITH usage AS (
  SELECT player_id, run_id, debug, ruleset_version,
    CASE WHEN json_extract(props_json, '$.music') = 1
         THEN json_extract(props_json, '$.musicPack')
         WHEN json_extract(props_json, '$.requested') = 1
         THEN 'unavailable' ELSE 'off' END AS track,
    json_extract(props_json, '$.durationMs') AS ms
  FROM telemetry_events
  WHERE event_name = 'music_play_batch'
    AND received_at >= unixepoch() - 7 * 86400
)
SELECT track, debug, ruleset_version,
  COUNT(DISTINCT player_id) AS players,
  COUNT(DISTINCT run_id) AS runs,
  ROUND(SUM(ms) / 60000.0, 2) AS minutes,
  ROUND(SUM(ms) / 60000.0 / COUNT(DISTINCT run_id), 2) AS minutes_per_run
FROM usage GROUP BY track, debug, ruleset_version;
```
