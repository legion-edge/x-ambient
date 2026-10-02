# YouTube埋め込み動画

PC版Firefoxの https://www.youtube.com/embed/<動画ID> と https://www.youtube-nocookie.com/embed/<動画ID> のフレーム内に対応します。URLと公開タイトルリンクの動画IDが一致する読み込み済みの本編だけを選び、動画の外側に4pxを超える余白があると描画します。動画・タイトル・操作UIを保護し、画面を埋める動画、広告表示、ID不一致、終了した動画では停止します。

効果はYouTubeフレーム内だけです。「投稿」設定でもフレーム全体を対象にします。親サイトへのDOMアクセスや描画は行いません。親のスクロールでフレームが見えなくなると停止します。CSS非表示ではブラウザが描画を休止するため、停止クラスが即座に変わるとは限りません。

既存のwww.youtube.comホストへのアクセスを使い、embedパスだけにall_framesの別content scriptを設定しました。通常エントリはembedを除外し、二重注入を防ぎます。承認された新ホストwww.youtube-nocookie.comは/embed/*だけ追加しました。通常ページ・任意の親サイト・他サブドメインへのアクセス、API権限、about:blankへの注入は追加していません。動画一覧形式と親サイトまで広がる効果は対象外です。実広告、DRM、ログイン環境は未検証です。

インストールは [FIREFOX.ja.md](FIREFOX.ja.md)、PiPは [FIREFOX_PIP.ja.md](FIREFOX_PIP.ja.md)。未署名ZIPは一時読み込み用です。

再現: npm ci → npm run package:firefox → npm run lint:firefox → npm run test:youtube:embed -- --live。専用一時Firefoxプロファイルと動的localhostポートを使い、既存プロファイルや認証データを読みません。fixture用権限と設定hookはテストコピーだけです。

上流mmngaのMIT LICENSEと帰属を維持しています。[検証記録](docs/YOUTUBE-EMBED-VALIDATION.md)、[Mozilla公式フレーム条件](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/content_scripts) を参照してください。

プライバシー強化版も同じ公開タイトルDOMと表示済み動画をローカル描画に使います。Cookie・サイトstorage・認証情報は読まず、動画やposterを再取得せず、追跡用通信や追加API呼出を行いません。YouTube側の通信やプライバシー仕様そのものは拡張で変更しません。[YouTube公式説明](https://support.google.com/youtube/answer/171780?hl=ja) を参照してください。

プライバシー強化版の再現は npm run test:youtube:embed -- --live --nocookie。通常版と別の結果をoutput/youtube-nocookie-qaへ保存します。[追加検証](docs/YOUTUBE-NOCOOKIE-VALIDATION.md)。
