# workspace/_initial — リセット用の初期状態

2つの用途で使う。

1. `POST /api/workspace/create` … 学習者が指定した場所にプロジェクトを新規作成するときの元。
   依存パッケージは `workspace/my-portfolio/node_modules` からコピーする（npm install はしない）。
2. `POST /api/reset-all` … 作成済みのプロジェクトを初期状態へ戻すとき。

- `src/` … まるごと置き換える。学習者が作った
  `components/` `layout/` `styles/` `content/` `pages/works/` などは消える。
- `astro.config.mjs` … island-1 で Preact 統合を書き足すので、元に戻す。

`node_modules/` `package.json` `public/` `.vscode/` には触らない
（preact は同梱したままにしておく必要がある）。

問題の starter を変えたときは、ここも合わせて更新すること。

## 意図的に入れていないもの

- `.vscode/settings.json` … `astroManabi.serverPath` がWindowsの決め打ちだったため。
  必要になったら、機械に依存しない形で足すこと。
- `.astro-manabi.json` … VS Code拡張の状態ファイル。拡張側の作りを確認してから。
- `package-lock.json` … `node_modules` を `workspace/_deps/` からコピーするので不要。
