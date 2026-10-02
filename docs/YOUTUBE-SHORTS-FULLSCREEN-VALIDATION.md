# Shorts全画面検証（2026-10-02）

Issue #8。PR #7 head `4e36ed4a9f4ca250eb7fca097b7794e7356680c9` をベースにした追加変更。上流固定commitは `6977a59c26b731c4909970fdf814dc282c29093b`。MIT表示を保全し、追加権限・ネットワーク送信・認証情報の読み取りはありません。

Firefox 157.0、WebDriver専用一時プロファイル、localhostは動的ポート。個人プロファイルを使いません。fixtureと公開サイトは別プロファイルで、終了時にブラウザを閉じます。`npm run test:youtube:shorts:fullscreen -- --live` の最終実行はexit 0、13チェック成功。保存先は `output/shorts-fullscreen-qa/results.json`。

fixtureでは縦動画・横動画のCanvas更新、動画／字幕／metadata／操作部のOFF/ONピクセル一致、停止中seek、top layer外のclip無視、dialog追加削除、menu visibility/role変更、広告状態とID不一致による停止／復帰、画面いっぱい動画の描画停止、Esc／ボタン退出の繰り返し、単一renderer、標準PiP開始／終了、HTML全画面の白／黒テーマと余白ON/OFFピクセル差を確認しました。テストhookは配布後のテスト用コピーだけに挿入しています。

公開 `https://www.youtube.com/shorts/O3CxEgqYd0A` では実「その他の操作」メニュー→全画面項目→余白のON/OFFピクセル差→Esc復帰、コメントボタン→実コメントパネル表示（読込中のパネルまで、コメント本文読込は検証対象外）を確認しました。全画面要素はHTML、動画360×480、viewport1280×1024。メニュー操作は必要時一回再試行するため、初回クリックの成功を保証する検証ではありません。fixtureの全ピクセル比較や広告模擬を、実サイトでの字幕・実広告検証と同一視しません。

既存Xの画像／動画／popup保存、YouTube通常／シアター／watch全画面／Shorts移動の回帰も成功。最終observer属性追加後の詳細全画面テストは成功しました。watch全画面は合成修正後にも成功。X・通常／シアター・Shorts移動は直前の同じrenderer変更で実行し、最後のvisibility/aria-expanded/open監視とShorts HTML全画面テーマ修正前です。

独立レビューは既読実装に阻害問題なし。標準PiPはAPIから実際に開始して停止／復帰を確認済みですが、Firefox組み込みPiPは未検証です。実広告、認証、DRM、旧Firefox、Chrome実行、長時間CPU評価は未実施です。

参考: [MozillaのPiP設計](https://firefox-source-docs.mozilla.org/toolkit/components/pictureinpicture/pictureinpicture/index.html)、[Firefox HTMLVideoElement WebIDL](https://searchfox.org/firefox-main/source/dom/webidl/HTMLVideoElement.webidl)、[MDN Picture-in-Picture API](https://developer.mozilla.org/en-US/docs/Web/API/Picture-in-Picture_API)。ブラウザ専用のvisual cloneは通常content scriptで利用できません。標準APIの実装有無だけで組み込みPiP検出を保証しません。

画像確認で白いHTML全画面にscreen合成を強制すると光が見えない問題を発見。ShortsのHTML全画面だけ背景の明暗に応じたmultiply/screenへ修正し、公開サイトの余白ON/OFFピクセル差で確認しました。watch全画面の合成方式は維持しています。
