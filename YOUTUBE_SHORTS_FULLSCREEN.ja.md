# YouTube Shorts 全画面

PC版YouTube Shortsの「その他の操作」→「全画面表示」に対応します。URLの動画IDと一致する表示中の動画だけを使い、動画の外側に4pxを超える余白がある場合に描画します。画面いっぱいの動画では描画を停止します。動画内に焼き込まれた黒帯は解析しません。

字幕・動画・操作ボタン・メニュー・コメント等の領域を保護します。広告、ID不一致、対象外の全画面では停止し、Escや終了ボタンでページ表示へ戻ります。全画面でも設定を変更できます。権限や外部通信は追加していません。

Firefoxでは `npm ci`、`npm run package:firefox`、`npm run lint:firefox`。一時インストールは [FIREFOX.ja.md](FIREFOX.ja.md) を参照してください。ZIPは未署名です。

再現テストは `npm run test:youtube:shorts:fullscreen -- --live`。専用の一時Firefoxプロファイルを使い、localhost fixtureと未ログインの公開Shortsを別プロファイルで検証します。結果は `output/shorts-fullscreen-qa/results.json`。診断hookはテスト用コピーだけに追加し、配布版には含めません。

標準Picture-in-Picture APIでの入退場はFirefox 157で検証し、開始時に描画停止、終了時に復帰しました。Firefox組み込みの別ウィンドウPiPは別機構で、検出と描画は未保証です。利用時は拡張をOFFにしてください。embed、実広告、DRM、認証環境、旧Firefox、Chrome実行は未検証です。サイトのDOM変更により判定やUI保護が変わる可能性があります。

上流mmngaのMIT LICENSEと帰属を保全しています。詳細は [検証記録](docs/YOUTUBE-SHORTS-FULLSCREEN-VALIDATION.md) を参照してください。
