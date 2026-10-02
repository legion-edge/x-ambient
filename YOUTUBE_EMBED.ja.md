# YouTube埋め込み動画

PC版Firefoxの https://www.youtube.com/embed/<動画ID> のフレーム内に対応します。URLと公開タイトルリンクの動画IDが一致する読み込み済みの本編だけを選び、動画の外側に4pxを超える余白があると描画します。動画・タイトル・操作UIを保護し、画面を埋める動画、広告表示、ID不一致、終了した動画では停止します。

効果はYouTubeフレーム内だけです。「投稿」設定でもフレーム全体を対象にします。親サイトへのDOMアクセスや描画は行いません。親のスクロールでフレームが見えなくなると停止します。CSS非表示ではブラウザが描画を休止するため、停止クラスが即座に変わるとは限りません。

既存のwww.youtube.comホストへのアクセスを使い、embedパスだけにall_framesの別content scriptを設定しました。通常エントリはembedを除外し、二重注入を防ぎます。新ホスト、API権限、about:blankへの注入は追加していません。youtube-nocookie.com、動画一覧形式、親サイトまで広がる効果は対象外です。実広告、DRM、ログイン環境は未検証です。

インストールは [FIREFOX.ja.md](FIREFOX.ja.md)、PiPは [FIREFOX_PIP.ja.md](FIREFOX_PIP.ja.md)。未署名ZIPは一時読み込み用です。

再現: npm ci → npm run package:firefox → npm run lint:firefox → npm run test:youtube:embed -- --live。専用一時Firefoxプロファイルと動的localhostポートを使い、既存プロファイルや認証データを読みません。fixture用権限と設定hookはテストコピーだけです。

上流mmngaのMIT LICENSEと帰属を維持しています。[検証記録](docs/YOUTUBE-EMBED-VALIDATION.md)、[Mozilla公式フレーム条件](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/content_scripts) を参照してください。
