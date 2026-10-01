# YouTube全画面の黒帯アンビエント

PC版YouTubeの通常watch本編で、プレイヤーの全画面ボタンによるFullscreen API表示に対応します。Esc・全画面解除ボタンで元の通常/シアター表示に戻ります。他サイトの全画面は従来どおり拡張描画を停止します。権限は追加していません。

## 映像とUIの保護

全画面プレイヤーはページより上のtop layerに置かれます。その内部に拡張の描画レイヤーを移し、解除時はページに戻します。映像の実表示領域と字幕・操作ボタン・メニューをSVGマスクで保護し、黒帯だけに色を広げます。映像の拡大・トリミング・色変更・再エンコードは行いません。レイヤーはpointer-events:noneでクリックを遮りません。

余白は動画のintrinsic寸法とCSSの表示領域から求めます。画面いっぱいの16:9映像など、余白が4px以下の場合はCanvas更新を停止します。映像に焼き込まれた黒帯は解析しないため、その部分は演出対象になりません。全画面ではpopupのscope選択にかかわらず黒帯のみに描画します。

広告、動画ID切替、表示不可、拡張OFFでは停止し、YouTubeの標準アンビエント視覚レイヤーの抑制を解除します。YouTubeの保存設定・ログイン・Cookieは変更しません。Shorts、embed、PiP、video要素単体のブラウザ全画面は対象外です。Firefox固有PiP利用時は拡張をOFFにしてください。

## 検証と導入

Node.js 22以降で `npm ci`、`npm run check`、`npm test`、`npm run package:firefox`、`npm run lint:firefox`、`npm run test:youtube:fullscreen -- --live` を実行します。全画面テストは専用の使い捨てFirefox profileと1280×1024のheadless画面を用い、localhost fixtureと未ログイン公開YouTubeを区別して検証します。profileや画面サイズの指定はテストプロセスに限定し、個人環境を変更しません。

通常/シアター回帰は `npm run test:youtube -- --live`、既存サイト回帰は `npm run test:firefox` です。Chrome用は `npm run package`。カスタム出力先は `X_AMBIENT_OUTPUT_DIR` を指定できます。配布物にlocalhost権限やテストbridgeは含めません。

Firefox ZIPは未署名です。[一時インストール手順](FIREFOX.ja.md) を使用してください。マージ、署名提出、ストア公開はこの変更に含みません。MITとmmngaへの上流帰属を保持しています。

公式資料: [Fullscreen API](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API/Guide)、[top layer](https://developer.mozilla.org/en-US/docs/Glossary/Top_layer)。
