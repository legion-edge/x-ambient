# YouTube残件

通常／シアター／watch全画面はmainに導入済み。Shortsと初回「次へ」の比較記録はPR #7、Shorts全画面は追加PRでレビュー対象です。拡張未インストールでも初回移動失敗が再現したため、原因を断定せずクリック補正は追加していません。

標準PiP開始時の停止／終了時復帰はFirefox 157で確認済み。Firefox組み込みPiPの別ウィンドウへ描画する機構は通常content scriptから利用できません。検出も未保証のため利用時は拡張OFF。ブラウザ設定や特権APIは変更していません。

embedは現在対象外です。YouTubeフレーム内だけの対応と、親サイトまで光を広げる対応は必要なアクセス範囲が異なります。[Mozilla content_scripts資料](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/content_scripts) のall_framesは各フレームのURL一致に従います。親サイトへの広範な権限を無断で追加せず、目的と権限を決めてから扱います。

実広告・DRM・認証付き動画、旧Firefox、Chrome実行、長時間CPU評価、実字幕の全画面ピクセル比較は未検証です。未署名Firefox ZIPは一時読み込み用であり、ストア公開やMozilla署名提出は行っていません。
