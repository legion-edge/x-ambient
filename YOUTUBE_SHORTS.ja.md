# YouTube Shorts 対応

PC版 `https://www.youtube.com/shorts/<動画ID>` に対応します。URLとプレーヤーの動画IDが一致し、実映像の半分以上が表示されている一本だけに追従します。縦スクロールや次・前への移動中、ID不一致・非表示・広告・未読込みの動画では描画を停止します。先読み動画を選びません。

Shorts表示中は範囲設定にかかわらずページ背景へ描画し、動画の実映像・字幕・説明・操作ボタン・コメント欄・サイトナビゲーションをマスクします。映像のサイズ、再生、音量を変更しません。戻る・進む、通常watchとのSPA移動、停止中seek、resizeに追従します。設定OFF・対象外ページでは標準アンビエントの表示を復元します。YouTubeの設定や認証情報は変更しません。

Firefox: `npm ci` → `npm run package:firefox` → `npm run lint:firefox`。一時インストールは [FIREFOX.ja.md](FIREFOX.ja.md) を参照してください。配布ZIPは未署名です。Chrome向けパッケージは `npm run package`。

検証: `npm run check`、`npm test`、`npm run test:firefox`、`npm run test:youtube -- --live`、`npm run test:youtube:fullscreen -- --live`、`npm run test:youtube:shorts -- --live`。最後のテストは専用一時Firefoxプロファイルとlocalhost fixtureを使い、`--live` 時には未ログインの公開Shortsも操作します。結果は `output/youtube-shorts-qa/results.json`。localhost権限や診断hookは配布版に含まれません。

Shorts全画面は [全画面手順](YOUTUBE_SHORTS_FULLSCREEN.ja.md) を参照してください。embedは対応範囲外です。標準PiP開始時の停止・終了時の復帰はFirefox 157で検証済みです。Firefox固有PiPの検出は保証できないため使用時は拡張OFFにしてください。実広告・DRM・ログイン環境・モバイル・旧Firefox・Chromeでの実行は未検証です。サイトDOMの変更でプレーヤー識別やUI保護が変わる場合があります。一般的なUIを矩形で保護するため、周囲の背景も一部光らない場合があります。CPU使用率の端末横断ベンチマークは行っていません。

上流mmngaのMIT LICENSEと帰属を保全しています。Shorts追加で権限・外部データ送信・バックグラウンド処理は追加していません。
