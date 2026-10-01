# Firefox PC版（142以降）

この公開forkは [mmnga/x-ambient](https://github.com/mmnga/x-ambient) のコミット `6977a59c26b731c4909970fdf814dc282c29093b` を基にしています。上流のMIT著作権・許諾表示はLICENSEに保持しています。

## 作成・一時インストール

Node.js 22以降で `npm ci`、`npm run check`、`npm test`、`npm run package:firefox`、`npm run lint:firefox` を実行します。

Firefoxで `about:debugging#/runtime/this-firefox` を開き「一時的なアドオンを読み込む」から `output/x-ambient-firefox/manifest.json` を選択してください。対応サイトを再読み込みします。設定はFirefoxの拡張アイコンから変更できます。Chrome版は従来の `npm run package` で作成します。

`output/x-ambient-firefox.zip` は未署名です。通常版Firefoxへの恒久インストールにはMozilla署名が必要です。この作業ではAMO提出・ストア公開・署名検証の無効化を行いません。一時アドオンはブラウザ終了時に削除されます。

## 権限・データ

追加権限はありません。storageと上流の対応サイトに限定したcontent scriptsのみです。サイトに既に表示された画像・動画をCanvasへ描画し、設定をstorage.localへ保存します。翻訳のfetchは拡張に同梱されたJSONのみです。解析・テレメトリ・外部へのデータ送信処理はありません。動画posterの既存URLをImageとして読み込む場合があり、メディアサーバーへの取得・キャッシュ再検証が発生し得ます。このソース調査に基づきFirefox用manifestで `data_collection_permissions.required: ["none"]` を宣言しています。サイト自身の通信はこの宣言の対象ではありません。

Firefox用の固定IDは `x-ambient@legion-edge`、最低バージョンは142です。Androidは対象外です。chrome名前空間はFirefoxが提供する互換APIを使用し、Canvas、CSS/SVGマスク、Shadow DOM、動画フレームコールバック（非対応時はrequestAnimationFrame）を共用します。

## 検証

`npm run test:firefox` はインストール済みPC版Firefoxをheadlessで起動し、WebDriverが作る専用の使い捨てプロファイルを使います。通常のFirefoxプロファイル、ログイン情報には触れません。fixture用にlocalhostのmatchを追加したテスト専用コピーをoutputに作り、実際の拡張popupとローカル画像・動画を検証します。配布物にはlocalhost権限を追加しません。スクリーンショットと結果を `output/firefox-qa/` に保存します。テストには初回geckodriver取得のネットワーク接続が必要な場合があります。

fixture検証は実サイト検証とは異なります。X/Instagram/Twitch/Kickのログイン済み実サイト、DRM動画、各サービスの最新DOMは手動検証が必要です。専用プロファイルで画像・動画、スクロール、SPA遷移、popup保存、オン/オフ・強度・scopeの繰返し、両テーマ、ウィンドウサイズ変更を確認してください。認証済みプロファイルや保存ページをコミットしないでください。

公式資料: [Gecko設定](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings)、[Firefoxデータ収集宣言](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/)、[一時インストール](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/)。
