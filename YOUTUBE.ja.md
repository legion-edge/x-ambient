# YouTube通常動画・シアターモード

PC版の `https://www.youtube.com/watch?v=...` の本編プレイヤーに自動追従します。標準サイズとシアターモード、停止中・seek後のフレーム、動画切替、homeからの遷移、戻る・進む、スクロールとresizeに対応します。広告表示中・プレイヤー切替中・動画が読み込めない間・画面外では停止します。

YouTube本編の全画面では、映像を覆わず黒帯の余白だけに光を描きます。画面いっぱいの映像では描画を停止します。[全画面の詳細](YOUTUBE_FULLSCREEN.ja.md) を参照してください。[Shortsにも対応](YOUTUBE_SHORTS.ja.md)しています。ミニプレイヤー、PiPは対応範囲外です。標準PiP APIが使えるブラウザでは停止しますが、Firefox固有PiPの検出・描画は保証しません。PiP利用時は拡張をOFFにしてください。

拡張の描画が有効な間だけ、現在のwatch要素の `#cinematics`（YouTube標準アンビエントの視覚レイヤー）をCSSで隠します。拡張をOFF、広告、画面外、対象外ページにすると解除します。YouTubeのアンビエント設定・Cookie・ログイン・localStorageは変更しません。標準機能の内部処理を止めるものではありません。

追加したサイト権限は `https://www.youtube.com/*` のcontent scriptのみです。homeからwatchへのSPA遷移を検出するためホスト内全パスで読み込みますが、描画はwatch本編とShortsのアクティブ動画に限定します。新規API権限、バックグラウンド処理、外部データ送信、動画ダウンロード処理を追加しません。既存Canvas rendererを共用します。YouTubeのDOM構造変更、DRMなどCanvas描画不可の動画は対象外です。

Firefox: `npm ci` → `npm run package:firefox` → `npm run lint:firefox`。一時インストールは [FIREFOX.ja.md](FIREFOX.ja.md) を参照。Chrome: `npm run package`。

検証: `npm run check`、`npm test`、`npm run test:firefox`、`npm run test:youtube`。最後のテストは専用一時Firefox profileとlocalhost fixtureを使います。配布物にlocalhost権限・fixtureルーティングは含めません。`npm run test:youtube -- --live` は同じ専用profileで未ログインの公開YouTube動画への接続も試みます。実サイト検証とfixture結果は `output/youtube-qa/results.json` で区別します。広告・テーマ・地域制限は実サイトで追加確認が必要です。

上流のMIT LICENSEとmmngaへの帰属を保持しています。Firefox対応PRを土台にした追加変更です。

埋め込みフレーム内対応は [YOUTUBE_EMBED.ja.md](YOUTUBE_EMBED.ja.md)、組み込みPiPの手順は [FIREFOX_PIP.ja.md](FIREFOX_PIP.ja.md) を参照してください。
