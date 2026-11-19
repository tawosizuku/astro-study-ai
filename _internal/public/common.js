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

// 完成イメージ（public/reference/ = チュートリアルを最後までやったポートフォリオを build したもの）の中の、
// いま作っているページ。トップは index.html、作品一覧は works.html、作品の詳細ページは works/<名前>.html。
// それ以外（復習問題の /review など）は完成イメージに無いのでトップを出す。
// 作り直すときは scripts/build-reference.js（npm run build:reference）
const referenceUrl = (previewPath) => {
  const p = String(previewPath || '/');
  if (/^\/works\/?$/.test(p)) return 'reference/works.html'; // 作品一覧ページ
  const m = p.match(/^\/works\/([\w-]+)\/?$/);
  return m ? `reference/works/${m[1]}.html` : 'reference/index.html';
};

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
// 先に ** 太字 ** で分け、その中身を `コード` で分ける（逆順だと **太字`コード`太字** のように
// 太字の中にコードが入ったとき ** のペアがバッククォートで分断されてしまい、どちらの ** も
// 太字として認識されなくなる）
const appendInlineCode = (parent, text) => {
  String(text).split(/`([^`]+)`/g).forEach((seg, i) => {
    if (!seg) return;
    if (i % 2 === 1) {
      const code = document.createElement('code');
      code.className = 'inline-code';
      code.style.cssText = 'font-family: var(--font-code, monospace); background: var(--ground, #f1f0f8); padding: 1px 5px; border-radius: 5px; font-size: 0.92em;';
      code.textContent = seg;
      parent.appendChild(code);
    } else {
      parent.appendChild(document.createTextNode(seg));
    }
  });
};

const appendInlineMarkup = (parent, text) => {
  String(text).split(/\*\*([^*]+)\*\*/g).forEach((seg, i) => {
    if (!seg) return;
    if (i % 2 === 1) {
      const b = document.createElement('strong');
      appendInlineCode(b, seg);
      parent.appendChild(b);
    } else {
      appendInlineCode(parent, seg);
    }
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

// このPCのClaude Code CLIが採点に使えるかを調べる。モデルは呼ばず認証状態だけを見るので
// （server.jsの/api/claude/status）、何度呼んでも課金は発生しない
const fetchClaudeStatus = async () => {
  try {
    const res = await fetch('/api/claude/status');
    return await res.json();
  } catch {
    return { available: false, reason: 'not_installed' };
  }
};

const CLAUDE_STATUS_MESSAGES = {
  not_installed: 'Claude Codeがこのパソコンに入っていません。下のボタンから入れられます。',
  not_logged_in: 'Claude Codeは入っていますが、まだログインしていません。下のボタンからログインできます。',
  timeout: '確認がタイムアウトしました。Claude Code CLIの応答が遅いようです。',
};
const describeClaudeStatus = (status) => {
  if (status.available) {
    const who = status.email
      ? `（${status.email}${status.subscriptionType ? ` ・ ${status.subscriptionType}` : ''}）`
      : '';
    return { ok: true, text: `利用可能・ログイン中${who}` };
  }
  return { ok: false, text: CLAUDE_STATUS_MESSAGES[status.reason] || 'Claude Codeの状態を確認できませんでした。' };
};

// Claude Codeが未インストール・未ログインのとき、次にやることを1つだけ案内する。
// ボタンを押すとサーバーがターミナルを開いて公式のコマンドを走らせる（server.jsの/api/claude/open-terminal）。
// 終わったかどうかは本人に押してもらわず、数秒おきに状態を見て自動で次へ進める。
// container: 案内を描く要素 / onStatus: 状態が変わったときに呼ぶ（画面側でラジオやチェックの有効・無効を切り替える）
const CLAUDE_SETUP_POLL_MS = 3000;
const CLAUDE_SETUP_POLL_LIMIT_MS = 10 * 60 * 1000;
const isWindowsClient = () => /Windows/i.test(navigator.userAgent);
const CLAUDE_SETUP_GUIDES = {
  not_installed: {
    step: 'install',
    button: 'Claude Codeを入れる（ターミナルが開きます）',
    lead: 'ボタンを押すとターミナルが開き、公式のインストールコマンドが実行されます。終わるまで1〜2分ほどかかり、その間は何も表示されないことがあります。',
    command: () => (isWindowsClient() ? 'irm https://claude.ai/install.ps1 | iex' : 'curl -fsSL https://claude.ai/install.sh | bash'),
    waiting: 'インストールの完了を待っています…（終わると自動で次に進みます）',
  },
  not_logged_in: {
    step: 'login',
    button: 'Claudeにログイン（ターミナルとブラウザが開きます）',
    lead: 'ボタンを押すとターミナルが開き、続けてブラウザにログイン画面が出ます。Claudeのアプリと同じアカウントでログインしてください。',
    command: () => 'claude auth login --claudeai',
    waiting: 'ログインの完了を待っています…（終わると自動で切り替わります）',
  },
};

const mountClaudeSetupGuide = (container, initialStatus, onStatus) => {
  let pollTimer = null;
  const stopPolling = () => { if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; } };

  const render = (status) => {
    stopPolling();
    const guide = !status.available && CLAUDE_SETUP_GUIDES[status.reason];
    container.hidden = !guide;
    container.replaceChildren();
    if (!guide) return;

    const lead = document.createElement('p');
    lead.className = 'claude-setup-guide__lead';
    lead.textContent = guide.lead;

    const cmd = document.createElement('code');
    cmd.className = 'claude-setup-guide__cmd';
    cmd.textContent = guide.command();

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-primary btn-sm';
    btn.textContent = guide.button;

    const note = document.createElement('p');
    note.className = 'claude-setup-guide__note';
    note.textContent = 'Claude Codeを使うにはClaudeのPro以上のプランが必要です（無料プランでは使えません）。プランが無い場合はGemini（無料）を選んでください。';

    const msg = document.createElement('p');
    msg.className = 'claude-setup-guide__msg';
    msg.setAttribute('role', 'status');
    msg.hidden = true;

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      msg.hidden = false;
      msg.classList.remove('is-error');
      try {
        const res = await fetch('/api/claude/open-terminal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ step: guide.step }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      } catch (e) {
        msg.classList.add('is-error');
        msg.textContent = `ターミナルを開けませんでした（${e.message}）。上のコマンドをターミナルに貼り付けて実行してください。`;
        btn.disabled = false;
        return;
      }
      msg.textContent = guide.waiting;
      const startedAt = Date.now();
      const poll = async () => {
        const next = await fetchClaudeStatus();
        if (next.available || next.reason !== status.reason) {
          onStatus(next);
          render(next);
          return;
        }
        if (Date.now() - startedAt > CLAUDE_SETUP_POLL_LIMIT_MS) {
          msg.textContent = 'まだ完了を確認できません。ターミナルの表示を確認して、もう一度ボタンを押してください。';
          btn.disabled = false;
          return;
        }
        pollTimer = setTimeout(poll, CLAUDE_SETUP_POLL_MS);
      };
      pollTimer = setTimeout(poll, CLAUDE_SETUP_POLL_MS);
    });

    container.append(lead, cmd, btn, msg, note);
  };

  render(initialStatus);
  return { update: render };
};

const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
