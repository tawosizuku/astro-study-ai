// 全ページ共通: タグ辞書・API呼び出し・小物

const TAG_LABELS = {
  'frontmatter': '--- の中に書くJS（frontmatter）',
  'template-expression': '{ } で変数を表示',
  'props': '部品に値を渡す（props）',
  'component-import': '部品の読み込み（import）',
  'client-directive': '動きのある部品（client:）',
  'layout-slot': 'レイアウト・slot',
  'content-collections': '記事データの管理',
  'html-structure': 'HTMLの組み立て',
  'css': 'CSS',
  'js-basics': 'JavaScriptの基本',
  'astro-syntax-other': 'その他のAstroの書き方',
};

const $ = (id) => document.getElementById(id);

// 弱点の「今の重要度」を、記録回数(count)から時間経過で減衰させて計算する。
// 半減期30日: 30日間ノーミスだと重要度は半分になる。直近の弱点ほど復習で優先されやすくする
const WEAKNESS_HALF_LIFE_DAYS = 30;
const effectiveImportance = (w) => {
  if (!w.lastSeen) return w.count;
  const daysSince = (Date.now() - new Date(w.lastSeen).getTime()) / (1000 * 60 * 60 * 24);
  return w.count * Math.pow(0.5, Math.max(0, daysSince) / WEAKNESS_HALF_LIFE_DAYS);
};

const getState = async () => {
  const res = await fetch('/api/state');
  if (!res.ok) throw new Error(`サーバーに接続できません（${res.status}）`);
  return res.json();
};

const postJson = async (path, body) => {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) {
    // サーバーは { error: "..." } の形で理由を返すので、それをそのまま見せる。
    // 以前はステータスコードだけを投げていて、画面に「失敗しました（400）」としか
    // 出ず、何が悪かったのか分からなかった（2026-10-27修正）
    let reason = '';
    try { reason = (await res.json()).error || ''; } catch { /* JSONでないことがある */ }
    throw new Error(reason || `${path} に失敗しました（${res.status}）`);
  }
  return res.json();
};

// 文中の `コード` を <code>、**太字** を <strong> に整形して追加する。
// これをやらないと ` や ** が文字のまま画面に出て、機械っぽく読みにくくなる。
const appendInlineMarkup = (parent, text) => {
  String(text).split(/`([^`]+)`/g).forEach((seg, i) => {
    if (i % 2 === 1) {
      const code = document.createElement('code');
      code.className = 'inline-code';
      code.style.cssText = 'font-family: var(--font-code, monospace); background: var(--ground, #f1f0f8); padding: 1px 5px; border-radius: 5px; font-size: 0.92em;';
      code.textContent = seg;
      parent.appendChild(code);
      return;
    }
    seg.split(/\*\*([^*]+)\*\*/g).forEach((s, j) => {
      if (!s) return;
      if (j % 2 === 1) {
        const b = document.createElement('strong');
        b.textContent = s;
        parent.appendChild(b);
      } else {
        parent.appendChild(document.createTextNode(s));
      }
    });
  });
};

// 問題文・AIの発言中の ```コード``` は整形されたコード欄に、文中の `コード`・**太字** は
// <code>・<strong> に整形して表示する（Markdownの簡易対応）。
const renderTextWithCode = (el, text) => {
  el.textContent = '';
  String(text ?? '').split(/```([\s\S]*?)```/g).forEach((part, i) => {
    if (i % 2 === 1) {
      const pre = document.createElement('pre');
      pre.className = 'desc-code';
      pre.textContent = part.replace(/^\n/, '').replace(/\n$/, '');
      el.appendChild(pre);
    } else if (part) {
      appendInlineMarkup(el, part);
    }
  });
};

// iframeで開いたときに日本語が文字化けしないよう、<meta charset>が無ければ補う
// （Astroのfrontmatterフェンスの直後に差し込む。frontmatterが無ければ先頭に差し込む）
const ensureCharset = (source) => {
  if (/<meta\s+charset/i.test(source)) return source;
  const fm = source.match(/^---\n[\s\S]*?\n---\n?/);
  if (fm) {
    const idx = fm[0].length;
    return `${source.slice(0, idx)}<meta charset="UTF-8">\n${source.slice(idx)}`;
  }
  return `<meta charset="UTF-8">\n${source}`;
};

// 1枚のテキストを `// --- 名前 ---` の区切りでファイル単位に分解する（旧形式の解答欄・AI生成問題のstarter用）。
// 区切りが無ければ単一ファイル（src/pages/index.astro）として扱う。
// 名前に "/" が含まれていればそのパスのまま、含まれていなければ src/pages/ 直下に置く
const parseFilesFromCode = (code) => {
  const markerRe = /^\/\/\s*---\s*(.+?)\s*---\s*$/gm;
  const matches = [...code.matchAll(markerRe)];
  if (!matches.length) {
    return { 'src/pages/index.astro': ensureCharset(code) };
  }
  const files = {};
  matches.forEach((m, i) => {
    const name = m[1].trim();
    const start = m.index + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : code.length;
    let content = code.slice(start, end).trim();
    const filePath = name.includes('/') ? name : `src/pages/${name}`;
    if (filePath.startsWith('src/pages/') && filePath.endsWith('.astro')) {
      content = ensureCharset(content);
    }
    files[filePath] = `${content}\n`;
  });
  return files;
};

const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
