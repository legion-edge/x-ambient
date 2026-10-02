# Shortsの透明overlayと余白描画の修正

Issue: https://github.com/legion-edge/x-ambient/issues/14

基準版はPR #13の `b4cc05f3b9ed3f211c5e8f4cc047ed4c35512568`。依存順は #7 → #9 → #11 → #13 → 本修正で、未マージのままレビューします。上流 `6977a59c26b731c4909970fdf814dc282c29093b` とmmngaのMIT表示を維持しています。

## 問題と修正

Shortsの `#overlay` と `yt-reel-player-overlay-view-model` は、動画・文字・操作以外の空白まで含む大きな透明wrapperです。従来はその外接矩形全体を保護maskの穴にしていたため、広い白いコンテナ内では色が出ず、外周だけに色が出ました。これは意図した余白描画ではなく、保護範囲が広すぎる不具合です。

新しい処理は、透明wrapper自体を保護せず、中の文字の行矩形を3pxの余裕付きで保護します。実際のボタン・画像・SVG・字幕、背景色やgradientのある局所カード、コメント／メニュー／サイドバーも保護します。CSS生成ラベルはleaf要素の矩形で保護します。文字の直接更新と折返しにもmaskを追従させます。切替中に見える隣reelの動画・文字も保護し、画面外・非表示のlayoutは詳細測定から除外します。描画する動画の選択は現在URLに一致する1本のままです。

描画色・広がりの計算、動画選択、watch／embedのmask分岐、権限と保存形式は変更していません。新しい通信、動画取得、ブラウザ内部APIも追加していません。文字計測に使う [Range.getClientRects](https://developer.mozilla.org/en-US/docs/Web/API/Range/getClientRects) と、直接文字変更に使う [MutationObserver.characterData](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/observe) は通常のDOM APIです。

## 修正前後の画像

以下は自作動画・自作ラベルの合成fixtureです。ユーザー原画像、アカウント情報、個人ブラウザの画面は含みません。比較時の強度85、広がり90は画素差を検出するための設定です。通常の設定値は変更しません。

| 状態 | 画像 |
| --- | --- |
| PR13版: 白いコンテナ内の空白が除外され、外周だけに色が出る | [修正前](https://raw.githubusercontent.com/legion-edge/x-ambient/youtube-shorts-local-ui/docs/shorts-overlay/light-before.png) |
| 修正版: 動画の周囲に色が出て、文字・操作を局所保護 | [ライト・修正後](https://raw.githubusercontent.com/legion-edge/x-ambient/youtube-shorts-local-ui/docs/shorts-overlay/light-after.png) |
| ダークテーマ／サイドバーあり | [ダーク・修正後](https://raw.githubusercontent.com/legion-edge/x-ambient/youtube-shorts-local-ui/docs/shorts-overlay/dark-sidebar-after.png) |

![修正前](https://raw.githubusercontent.com/legion-edge/x-ambient/youtube-shorts-local-ui/docs/shorts-overlay/light-before.png)
![修正後](https://raw.githubusercontent.com/legion-edge/x-ambient/youtube-shorts-local-ui/docs/shorts-overlay/light-after.png)

## 画素QA

Firefox 157 / Windows、専用の使い捨てheadlessプロファイル、動的localhostポートで検証します。すべての操作はWebDriverの専用ブラウザ内だけです。個人ブラウザ・他アプリ・デスクトップへの入力は使用しません。localhost権限、設定hook、paintカウンターはテストコピーだけに追加します。

合成fixtureは1500×965のviewportで、1444×867の透明wrapperと300×480の縦動画を持ちます。PR13版の左右内側bandはON/OFF変化率0%、修正版は約86%／83%です。動画の全面のうち画素全体が領域内にある部分と、文字・字幕・ボタン・アイコン・gradientカード・疑似要素ラベル等の比較領域は、RGBA配列のhashがON/OFFで一致します。単一の余白画素だけの検査ではありません。

ライト／ダーク、サイドバー有無、1050／1350pxへのresize、文字の直接更新と折返し、コメント開閉、transformされた隣reelの部分表示と動画・文字の画素保護、次のShortsへの切替、操作click、全画面／Escを検証しました。OFF時にpaintが止まり、復帰後にrendererが1つだけになることも確認します。隣reelが表示されても停止中にpaintが連続しないことを確認します。

別の実サイト検証は未ログインの公開Shortsを通常表示で開きます。動画を停止し、YouTube自身の操作UIのフェードが落ち着くまで待ってからON/OFFを比較します。最終実行は動画領域内とボタンの画素一致、左右band約100%／84%の色変化を確認しました。実サイトの全画面・全レイアウトへの保証とfixture検証を混同しません。

初回の実サイト比較は、撮影間にYouTubeの再生ボタンが消えたため不一致になりました。専用headlessセッションのポインタを動画外へ移し、5秒待った再撮影では一致しました。別のembed回帰でも初期再生が進まない試行があり、テストを「停止中だけPlayを押す・現在の再生状態を確認する」手順にして再検証しました。配布rendererの再生操作を追加したものではありません。成功した最終記録と画像だけをQA ZIPに同梱します。

## 再現と回帰

`npm ci` → `npm run check` → `npm test`（47件）→ `npm run package:firefox` → `npm run lint:firefox`。

`npm run test:youtube:shorts:overlay -- --live` が新fixtureと公開通常表示を検査し、`output/shorts-overlay-qa` に結果とON/OFF画像を保存します。修正前の再現はPR13版を別ディレクトリでpackageし、そのoutputを `X_AMBIENT_OUTPUT_DIR` に指定して `npm run test:youtube:shorts:overlay -- --baseline`。結果は `output/shorts-overlay-baseline` です。

既存の `test:firefox`、`test:youtube`、`test:youtube:fullscreen`、`test:youtube:shorts`、`test:youtube:shorts:fullscreen`、通常／nocookieの `test:youtube:embed -- --live` も回帰検証します。PiPとShorts遷移の調査記録は独立した結果として扱います。CIはNode22/24でsyntax・unit・package・lintを検証し、ブラウザQAはWindowsで別に行います。

Shortsの初回切替については、拡張ON・OFF・未導入でも初回だけ進まない場合がありました。今回の描画修正では解決したと扱いません。調査の11観測は成功チェック数に含めません。

## 既存テストで漏れた理由と限界

旧fixtureに巨大な透明wrapperがなく、通常Shortsの公開QAは主に動画の選択・遷移を確認していました。旧全画面QAの余白検査は外側の1点で、コンテナ内の広い白い余白まで測っていませんでした。今回のfixtureと左右band比較はその不足を補います。全画素保護では領域境界の部分画素を除き、完全に領域内に入る整数画素を比較します。

文字の行単位の小さな元背景は読みやすさのため残ります。CSS疑似要素がleaf矩形から大きく張り出す装飾、すべてのYouTube DOM実験、実広告／DRM／認証環境、旧Firefox／Chrome、長時間負荷は保証しません。native PiPの自動検出制限は [FIREFOX_PIP.ja.md](../FIREFOX_PIP.ja.md) のままです。新しい権限・Shorts削除・マージ・ストア公開・Mozilla署名提出は行いません。ZIPは未署名の一時読み込み用です。
