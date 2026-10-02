# YouTube残件

通常視聴・シアター・watch全画面はmainに統合済み。Shortsと最初の「次へ」の比較記録はPR #7、Shorts全画面はPR #9でレビュー中で、どちらも未マージです。追加の自動クリックや権限で次へ問題を回避していません。

既存www.youtube.com/embed/*のフレーム内描画を追加しました。[利用方法](../YOUTUBE_EMBED.ja.md) と [検証記録](YOUTUBE-EMBED-VALIDATION.md) を参照してください。親DOMアクセスや描画は追加していません。

https://www.youtube-nocookie.com/embed/*はユーザーの明示承認を受け、限定追加しました。必要な読み取りは対象フレーム内の公開動画ID・タイトルDOM・mediaだけで、ローカル描画に使います。親DOM、Cookie、認証情報へのアクセスは不要です。親ページまで広がる効果には親サイトへの別の許可が必要です。

標準PiPの停止・復帰を検証済み。Firefox組み込みPiPの実際の開閉も確認しましたが標準ページAPIに状態が出ないため自動停止は保証できません。[OFF→PiP→閉じる→ON](../FIREFOX_PIP.ja.md)を使ってください。内部APIや設定を変更していません。

実広告・DRM・認証付き動画、旧Firefox、Chrome実行、長時間CPU評価は未検証です。未署名ZIPは一時読み込み用で、ストア公開やMozilla署名提出はしていません。

[プライバシー強化版の検証](YOUTUBE-NOCOOKIE-VALIDATION.md) を参照してください。PR #7 → #9 → #11 → nocookie追加PRの順に積み、いずれも未マージを維持しています。
