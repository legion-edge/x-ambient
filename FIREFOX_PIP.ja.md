# FirefoxのPicture-in-Picture

Firefox組み込みPiPとページの標準PiP APIは別の経路です。標準APIでは拡張の描画停止・復帰を確認済みです。組み込みPiPは標準ページイベントやdocument.pictureInPictureElementに現れず、自動停止は保証できません。PiPの別ウィンドウへの周囲光描画もありません。

組み込みPiPでは「拡張OFF → PiPを開く → PiPを閉じる → 拡張ON」で利用してください。Firefox 157の実際の動画右クリックメニューで開閉し、OFFで描画停止、閉じてONで単一rendererへの復帰を確認しました。内部API呼出やPiP設定変更はしていません。

再現: npm run package:firefox → npm run test:firefox:native-pip。独立した一時プロファイルと自作動画を使います。ブラウザUIを操作・確認するテストコードは配布拡張に入りません。公開YouTubeでの組み込みPiP、DRM、認証環境はこのテストの対象外です。

[Mozilla利用方法](https://support.mozilla.org/en-US/kb/about-picture-picture-firefox)、[Firefox PiP設計](https://firefox-source-docs.mozilla.org/toolkit/components/pictureinpicture/pictureinpicture/index.html)、[標準PiP API](https://developer.mozilla.org/en-US/docs/Web/API/Picture-in-Picture_API)、[検証記録](docs/YOUTUBE-EMBED-VALIDATION.md)。
