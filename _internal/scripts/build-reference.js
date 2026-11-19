// 完成イメージ（public/reference/）を作り直す。
// チュートリアルを最後までやった学習者の手元にできるポートフォリオを problems.json の模範解答から組み立て、
// astro build して、アプリの中の /reference/ で見られる形にして置く。
// 教材（problems.json）を変えたら、これを実行して完成イメージを合わせること。
//
//   cd _internal
//   npm run build:reference
//
// 依存パッケージは workspace/_deps/node_modules（開発機にだけある同梱キャッシュ）を使う。
// 学習者が clone した手元には無いので、これは開発者だけが実行するもの。
//
// index.astro は island-1 の模範解答（ファイル丸ごと。「その他」のセクションと <style> も入っている）を使う。
// 2026-11-19 までは content-2・island-1 の模範解答がそれらを省いていたので、ここで組み立て直していた。
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DEPS = path.join(ROOT, 'workspace', '_deps', 'node_modules');
const OUT = path.join(ROOT, 'public', 'reference');
const BASE = '/reference';

if (!fs.existsSync(DEPS)) {
  console.error(`依存パッケージのキャッシュがありません: ${DEPS}`);
  process.exit(1);
}

const arr = JSON.parse(fs.readFileSync(path.join(ROOT, 'problems.json'), 'utf8'));
const unit = (id) => {
  const p = arr.find((x) => x.id === id);
  if (!p) throw new Error(`単元がありません: ${id}`);
  return p;
};

// 模範解答の中の「// <パス>（注記）」で始まるブロックを取り出す
const block = (id, file) => {
  const lines = unit(id).answer.split('\n');
  const start = lines.findIndex((l) => l.startsWith(`// ${file}`));
  if (start < 0) throw new Error(`${id} の模範解答に ${file} がありません`);
  const body = [];
  for (const l of lines.slice(start + 1)) {
    if (/^\/\/ (src\/|astro\.config)/.test(l)) break;
    body.push(l);
  }
  return body.join('\n').replace(/^\n+/, '').replace(/\n+$/, '') + '\n';
};

const files = {};
// global.css は base-2 で作り、works-2 で「どのページでも使うセクションと並べ方の形」を最後に書き足す
files['src/styles/global.css'] = block('base-2', 'src/styles/global.css') + '\n' + block('works-2', 'src/styles/global.css');
// BaseLayout は header-1 で Header、rest-3 で Footer を入れた形（rest-3 の模範解答）
files['src/layouts/BaseLayout.astro'] = block('rest-3', 'src/layouts/BaseLayout.astro');
files['src/components/Header.astro'] = block('header-3', 'src/components/Header.astro');
files['src/components/Btn.astro'] = block('button-1', 'src/components/Btn.astro');
files['src/components/Hero.astro'] = block('button-1', 'src/components/Hero.astro');
files['src/components/Card.astro'] = block('works-3', 'src/components/Card.astro');
files['src/components/Footer.astro'] = block('rest-3', 'src/components/Footer.astro');
for (const f of ['src/content/config.ts', 'src/content/works/project-01.md', 'src/content/works/project-02.md', 'src/content/works/project-03.md']) {
  files[f] = block('content-1', f);
}
files['src/pages/works/[slug].astro'] = block('routing-1', 'src/pages/works/[slug].astro');
files['src/pages/works/index.astro'] = block('routing-2', 'src/pages/works/index.astro');
files['astro.config.mjs'] = block('island-1', 'astro.config.mjs');
files['src/components/WorksFilter.jsx'] = block('island-1', 'src/components/WorksFilter.jsx');
// WorksFilter.css は island-1 の問題文に「そのまま貼ってください」と載せている CSS
const css = unit('island-1').concept.match(/```\n(\.wf-tags[\s\S]*?)```/);
if (!css) throw new Error('island-1 の問題文に WorksFilter.css が見つかりません');
files['src/components/WorksFilter.css'] = css[1];

// ---- index.astro: island-1 の模範解答（ファイル丸ごと）----
files['src/pages/index.astro'] = block('island-1', 'src/pages/index.astro');
// 省略された模範解答に戻っていないか（戻ると完成イメージから About などのセクションが消える）
for (const must of ['id="about"', 'id="history"', '<style>', 'client:load']) {
  if (!files['src/pages/index.astro'].includes(must)) throw new Error(`island-1 の模範解答の index.astro に ${must} がありません（ファイル丸ごとにしてください）`);
}

// ---- 組み立てて build する ----
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-study-reference-'));
try {
  fs.cpSync(path.join(ROOT, 'workspace', '_initial'), work, { recursive: true, filter: (src) => !src.endsWith('README.md') });
  for (const [f, c] of Object.entries(files)) {
    const full = path.join(work, f);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, c);
  }
  fs.symlinkSync(DEPS, path.join(work, 'node_modules'), 'dir');
  // 学習者の astro.config.mjs に、/reference/ に置くための設定だけを足す。
  // ページは works/project-01.html のようにファイルで出す（アプリの静的配信はフォルダの index.html を探さないため）
  fs.writeFileSync(path.join(work, 'astro.config.reference.mjs'), [
    "import config from './astro.config.mjs';",
    `export default { ...config, base: '${BASE}', build: { format: 'file' }, outDir: './dist' };`,
    '',
  ].join('\n'));
  execFileSync(process.execPath, [path.join(DEPS, 'astro', 'astro.js'), 'build', '--config', 'astro.config.reference.mjs'], { cwd: work, stdio: 'inherit' });

  // 学習者のコードは「/#works」「/works/project-01」のように / から書いているので、/reference/ の中を指すように直す
  const dist = path.join(work, 'dist');
  const rewrite = (html) => html
    .replace(/href="\/(#[^"]*)?"/g, (_, hash) => `href="${BASE}/index.html${hash || ''}"`)
    .replace(/href="\/works\/?"/g, `href="${BASE}/works.html"`) // 作品一覧ページ（src/pages/works/index.astro）
    .replace(/(?<![\w/.])\/works\/([\w-]+)(?![\w./])/g, `${BASE}/works/$1.html`); // 島に渡す props の中の href も含む
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  for (const f of walk(dist).filter((f) => f.endsWith('.html'))) fs.writeFileSync(f, rewrite(fs.readFileSync(f, 'utf8')));

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.cpSync(dist, OUT, { recursive: true });
  console.log(`\n完成イメージを置きました: ${path.relative(ROOT, OUT)}/`);
  walk(OUT).forEach((f) => console.log('  ' + path.relative(OUT, f)));
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
