// 用語集（解説ページ）: これまで教材に出てきた言葉を、いつでも見返せるようにまとめたもの。
// ここは静的なデータだけで動く（ログイン不要・サーバー通信なし）。
// 新しい要素を教材に足したら、ここにも 1 項目追加する運用。

// やさしいインライン記法だけ対応: **太字** と `コード`。それ以外はそのままの文字。
const mdInline = (text) => {
  const frag = document.createDocumentFragment();
  // まず `code` で分割、その各断片の中で **bold** を処理する
  String(text ?? '').split(/`([^`]+)`/g).forEach((part, i) => {
    if (i % 2 === 1) {
      const code = document.createElement('code');
      code.textContent = part;
      frag.appendChild(code);
      return;
    }
    part.split(/\*\*([^*]+)\*\*/g).forEach((seg, j) => {
      if (!seg) return;
      if (j % 2 === 1) {
        const b = document.createElement('strong');
        b.textContent = seg;
        frag.appendChild(b);
      } else {
        frag.appendChild(document.createTextNode(seg));
      }
    });
  });
  return frag;
};

// phase: 教材のどのフェーズで初めて出てくるか（道のりの色分けと対応）
const GLOSSARY = [
  {
    phase: 'きほん', tag: 'base',
    items: [
      {
        term: '.astro ファイル', en: '.astro',
        summary: 'Astro のページや部品を作るファイル。中身は**普通のHTMLとほぼ同じ**で、拡張子が `.astro` に変わっただけです。そこに「フロントマター（準備のJS）」「`{変数}`」「部品の `import`」といったAstroならではの書き方を少しずつ足せます。`src/pages/` に置いた `.astro` は、**そのままページのURL**になります（例: `src/pages/index.astro` → トップページ）。',
        example: '// src/pages/index.astro → サイトのトップページになる\n---\n// ここはフロントマター（準備を書く・画面には出ない）\n---\n<h1>ようこそ</h1>',
      },
      {
        term: 'HTMLの骨組み', en: '<!DOCTYPE> / head / body',
        summary: 'Webページの土台になる決まった形。先頭の `<!DOCTYPE html>` は「これはHTMLですよ」の宣言、`<head>` は設定（文字コードやタイトル）、`<body>` が実際に見える中身です。`<header>`・`<main>`・`<footer>` で中身を大きく3つに分けます。',
        example: '<!DOCTYPE html>\n<html lang="ja">\n  <head>\n    <meta charset="utf-8" />\n    <title>わたしのサイト</title>\n  </head>\n  <body>\n    <header>…</header>\n    <main>…</main>\n    <footer>…</footer>\n  </body>\n</html>',
      },
      {
        term: 'CSS変数', en: ':root / --名前',
        summary: '色やフォントに「名前」を付けて1か所にまとめるしくみ。`:root { --accent: #6c5ce7; }` と定義し、使う所で `color: var(--accent);` と呼び出します。あとで1か所変えるだけでサイト全体の色を一括で変えられます。',
        example: ':root {\n  --accent: #6c5ce7;\n  --text: #1f1d1b;\n}\n\na:hover { color: var(--accent); }',
      },
      {
        term: 'フロントマター', en: '--- --- ',
        summary: '`.astro` ファイルの**一番上**を `---` の行と `---` の行ではさんだ場所のこと。ここにはページを組み立てるときの準備（JavaScript）を書きます。**ここに書いた内容そのものはページには表示されません**（準備専用の部屋）。`import` や変数の定義をここに書きます。',
        example: '---\n// ここがフロントマター（準備を書く所・画面には出ない）\nimport \'../styles/global.css\';\nconst name = \'太郎\';\n---\n<h1>{name}</h1>  ← ここから下が画面に出るHTML',
      },
      {
        term: 'import（読み込み）', en: 'import',
        summary: 'ほかのファイル（CSSや部品）を**このページにつなぐ**1行。`import \'../styles/global.css\';` と書くと、そのCSSがページに効くようになります。先頭の `../` は「**1つ上のフォルダ**」の意味。`src/pages/index.astro` から見て1つ上＝`src/` の中の `styles/global.css` を指します。',
        example: '---\nimport \'../styles/global.css\';        // CSSを読み込む\nimport Hero from \'../components/Hero.astro\';  // 部品を読み込む\n---',
      },
      {
        term: 'テンプレート式', en: '{ }',
        summary: 'HTMLの中で `{ }` を書くと、その中のJavaScript（変数など）の**結果が埋め込まれます**。フロントマターで作った変数を画面に出すときに使います。',
        example: '---\nconst siteName = \'わたしのポートフォリオ\';\n---\n<title>{siteName}</title>\n<h1>{siteName}</h1>',
      },
    ],
  },
  {
    phase: 'コンポーネント', tag: 'header',
    items: [
      {
        term: 'コンポーネント（部品）', en: '.astro / import',
        summary: 'よく使うまとまりを別の `.astro` ファイルに切り出したもの＝**部品**。使い方は2ステップ。① フロントマターで `import Header from \'../components/Header.astro\';` と読み込む。② 置きたい場所に `<Header />` と書く。すると Header.astro の中身がまるごとそこに入ります。同じ部品を何ページでも使い回せ、直すときも1か所で済みます。\n\n書き方のルール: 名前は**大文字で始める**（`<Header />`。小文字の `<header>` はただのHTMLタグで別物）。中身を挟まない部品は `<Header />` と**末尾に `/`** を付けて閉じる（自己完結タグ）。中身を挟むときは `<BaseLayout>…</BaseLayout>` のように開始・終了タグに分ける。',
        example: '---\nimport Header from \'../components/Header.astro\';\n---\n<Header />                 ← 中身なし。末尾に / を付けて閉じる\n\n<BaseLayout title="...">   ← 中身ありはタグで挟む\n  <p>ここが slot に入る</p>\n</BaseLayout>',
      },
      {
        term: 'props（プロップス）', en: 'Astro.props',
        summary: '部品に**外から値を渡す**しくみ。同じ部品を、渡す値を変えて何度でも使い回せます。たとえるなら、部品は「クッキーの型」、props は「どんな生地を入れるか」。型が同じでも中身を変えれば違うクッキーになります。\n\n① 呼ぶ側は属性で渡す → `<Hero name="太郎" />`\n② 受け取る側はフロントマターで `const { name } = Astro.props;`\n③ `{name}` と書けば画面に出る',
        example: '// 呼ぶ側（index.astro）\n<Hero name="太郎" tagline="ようこそ！" />\n\n// 受け取る側（Hero.astro）\n---\nconst { name, tagline } = Astro.props;\n---\n<h1>{name}</h1>\n<p>{tagline}</p>',
      },
      {
        term: 'スコープ付き <style>', en: '<style>',
        summary: '`.astro` ファイルの中に書いた `<style>` は、**そのファイルの中だけ**に効きます（他の部品に漏れません）。だから部品ごとに気軽にクラス名を付けられます。サイト全体で使う土台だけ `global.css` に置き、部品ごとの見た目は各ファイルの `<style>` に書くのが基本です。',
        example: '<nav class="main-nav">…</nav>\n\n<style>\n  /* この .main-nav は、この部品の中だけに効く */\n  .main-nav { display: flex; gap: 32px; }\n</style>',
      },
      {
        term: '配列 + map()', en: '.map()',
        summary: '同じ形のものを**くり返し並べる**書き方。データを配列（リスト）にしておき、`配列.map((項目) => …)` で1つずつHTMLに変換します。ナビのリンクや作品カードのように「数が増えても同じ形」を作るのに使います。',
        example: '---\nconst links = [\n  { label: \'Home\', href: \'/\' },\n  { label: \'Works\', href: \'/#works\' },\n];\n---\n<nav>\n  {links.map((link) => <a href={link.href}>{link.label}</a>)}\n</nav>',
      },
    ],
  },
  {
    phase: 'レイアウト', tag: 'base',
    items: [
      {
        term: 'slot（スロット）', en: '<slot />',
        summary: '部品の中に「**ここに呼び出し元の中身を入れる**」という空き枠を作るしくみ。`<slot />` と書いた場所へ、その部品で囲んだHTMLがそのまま入ります。\n\nprops が「名前や短い値」を渡すのに対して、slot は「**HTMLのかたまり（中身まるごと）**」を渡せるのが違いです。ページ共通の枠（BaseLayout）を作り、中身だけ差し替える、という使い方をします。',
        example: '// 枠を用意する側（BaseLayout.astro）\n---\nconst { title } = Astro.props;\n---\n<html>\n  <head><title>{title}</title></head>\n  <body>\n    <slot />   ← ここに下の中身が入る\n  </body>\n</html>\n\n// 中身を渡す側（index.astro）\n<BaseLayout title="ポートフォリオ">\n  <h1>ようこそ</h1>   ← これが <slot /> の位置へ\n  <p>私のサイトです</p>\n</BaseLayout>',
      },
    ],
  },
  {
    phase: '動き', tag: 'interact',
    items: [
      {
        term: '<script>（ブラウザで動くJS / islands）', en: '<script>',
        summary: '`.astro` に `<script>` を書くと、その中のJavaScriptが**ブラウザで動きます**（ボタンを押したら開く、など）。Astro は必要な所だけJSを動かす考え方で、これを「島（islands）」と呼びます。React などの枠組みを島として動かす `client:` もありますが、ボタンの開閉くらいなら素の `<script>` で十分です。',
        example: '<button class="nav-toggle">☰</button>\n<nav class="main-nav">…</nav>\n\n<script>\n  const toggle = document.querySelector(\'.nav-toggle\');\n  toggle.addEventListener(\'click\', () => {\n    document.querySelector(\'.site-header\').classList.toggle(\'is-open\');\n  });\n</script>',
      },
    ],
  },
  {
    phase: 'コンテンツ', tag: 'content',
    items: [
      {
        term: 'コンテンツコレクション', en: 'content collections',
        summary: '記事や作品などの**データをまとめて管理**するAstroのしくみ。`src/content/config.ts` で「どんな項目を持つか（タイトル・説明・タグなど）」を決め、中身はMarkdown（`.md`）ファイルで書きます。`getCollection(\'works\')` で全部まとめて取り出し、`map()` で一覧に並べられます。',
        example: '// src/content/config.ts（形を決める）\nimport { defineCollection, z } from \'astro:content\';\nexport const collections = {\n  works: defineCollection({\n    type: \'content\',\n    schema: z.object({ title: z.string(), tags: z.array(z.string()) }),\n  }),\n};',
      },
      {
        term: 'getCollection', en: 'getCollection()',
        summary: 'コレクションの中身を**ぜんぶ取り出す**関数。取り出した1件ずつは `entry.data`（タイトル等）と `entry.slug`（URL用の名前）を持ちます。`map()` と組み合わせて一覧を作ります。',
        example: '---\nimport { getCollection } from \'astro:content\';\nconst works = await getCollection(\'works\');\n---\n{works.map((w) => (\n  <a href={`/works/${w.slug}`}>{w.data.title}</a>\n))}',
      },
    ],
  },
  {
    phase: 'ルーティング', tag: 'routing',
    items: [
      {
        term: '動的ルート', en: '[slug].astro / getStaticPaths',
        summary: 'ファイル名を `[slug].astro` のように `[ ]` で囲むと、**1つのファイルから複数ページ**を作れます。`getStaticPaths()` で「どのURLを作るか」を一覧で返し、各ページに渡すデータ（props）も指定します。作品が増えても、詳細ページのファイルは1つで済みます。',
        example: '// src/pages/works/[slug].astro\n---\nimport { getCollection } from \'astro:content\';\nexport async function getStaticPaths() {\n  const works = await getCollection(\'works\');\n  return works.map((entry) => ({\n    params: { slug: entry.slug },\n    props: { entry },\n  }));\n}\nconst { entry } = Astro.props;\nconst { Content } = await entry.render();\n---\n<h1>{entry.data.title}</h1>\n<Content />',
      },
    ],
  },
  {
    phase: '画面遷移', tag: 'transition',
    items: [
      {
        term: 'View Transitions', en: '<ViewTransitions />',
        summary: '`BaseLayout` の `<head>` に `<ViewTransitions />` を1行置くと、**ページを移動しても全部を読み直さず、変わったところだけを差し替えます**。画面が白く点滅しなくなり、ヘッダーは置いたまま中身だけが入れ替わります。Astro本体に入っているので追加のインストールは不要です。対応していないブラウザでは、今までどおりの普通のページ移動になるだけで壊れません。',
        example: '---\nimport { ViewTransitions } from \'astro:transitions\';\n---\n<html lang="ja">\n  <head>\n    <title>{title}</title>\n    <ViewTransitions />   \u2190 1行置くだけ\n  </head>\n  <body><slot /></body>\n</html>',
      },
    ],
  },
  {
    phase: 'アイランド', tag: 'island',
    items: [
      {
        term: 'アイランド（島）', en: 'client:load / client:visible',
        summary: 'ページのほとんどはJavaScriptを積まない静的なHTMLのままにして、**動きが要る部品だけ**にJavaScriptを届ける考え方です。島にできるのは `.jsx` などUIフレームワークの部品だけ（`.astro` はサーバーでHTMLにしてしまうので島にできません）。そして **`client:` を付けて初めて島になります**。付けないとただのHTMLになり、JavaScriptは1バイトも届きません。`client:load`（すぐ動かす）／`client:visible`（画面に入ったら）／`client:idle`（手が空いたら）を使い分けます。',
        example: '<WorksFilter works={works} client:load />     \u2190 島になる\n<WorksFilter works={works} />                 \u2190 ただのHTML。押しても動かない\n\n// 島に渡せるのは「素の値」だけ。JSONに変換して送るので、\n// 関数が混じった getCollection の結果はそのまま渡せない\nconst works = entries.map((w) => ({ title: w.data.title, tags: w.data.tags }));',
      },
    ],
  },
];

const renderGlossary = () => {
  const root = $('glossary-root');
  root.innerHTML = '';
  GLOSSARY.forEach((group) => {
    const section = document.createElement('section');
    section.className = 'gl-group';

    const head = document.createElement('div');
    head.className = 'gl-group-head';
    head.innerHTML = `<span class="gl-phase gl-phase--${group.tag}">${group.phase}</span>`;
    section.appendChild(head);

    group.items.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'gl-card';

      const h = document.createElement('h3');
      h.className = 'gl-term';
      h.appendChild(document.createTextNode(item.term));
      if (item.en) {
        const en = document.createElement('span');
        en.className = 'gl-en';
        en.textContent = item.en;
        h.appendChild(en);
      }
      card.appendChild(h);

      // 説明（段落ごとに分け、やさしいインライン記法を適用）
      String(item.summary).split('\n\n').forEach((para) => {
        const p = document.createElement('p');
        p.className = 'gl-summary';
        p.appendChild(mdInline(para));
        card.appendChild(p);
      });

      if (item.example) {
        const pre = document.createElement('pre');
        pre.className = 'gl-example';
        pre.textContent = item.example;
        card.appendChild(pre);
      }

      section.appendChild(card);
    });

    root.appendChild(section);
  });
};

// 絞り込み（入力した言葉で項目をしぼる）
const setupSearch = () => {
  const input = $('gl-search');
  if (!input) return;
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    document.querySelectorAll('.gl-card').forEach((card) => {
      const hit = !q || card.textContent.toLowerCase().includes(q);
      card.style.display = hit ? '' : 'none';
    });
    // 中身が全部消えたグループの見出しも隠す
    document.querySelectorAll('.gl-group').forEach((group) => {
      const anyVisible = [...group.querySelectorAll('.gl-card')].some((c) => c.style.display !== 'none');
      group.style.display = anyVisible ? '' : 'none';
    });
  });
};

renderGlossary();
setupSearch();
