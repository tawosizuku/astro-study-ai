# workspace/_deps — 依存パッケージのキャッシュ

`POST /api/workspace/create` が、学習者の指定した場所へ `node_modules` をコピーするための置き場。

`npm install` を使わないのは、ローカルの npm キャッシュが壊れていて失敗することを
実測したため（`No matching version found for unist-util-visit-parents`）。
コピーなら約4秒・295パッケージで、ネットが無くても確実に揃う。

**ここは編集する場所ではない。** 以前は `workspace/my-portfolio` に
`src/` ごと残していたが、学習者が「採点が読む場所」と取り違えて
そちらを編集してしまう事故が起きたため、node_modules だけに分離した（2026-10-27）。

雛形（src・astro.config.mjs・package.json）は `workspace/_initial/` にある。
