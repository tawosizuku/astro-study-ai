// Astro学習支援ツール プロトタイプ — 依存ゼロのNodeサーバー
// 役割: 静的配信 / Googleログイン(P2) / 弱点メモリ(SQLite: data.db)の読み書き
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { readMemory, writeMemory, upsertUser, getUserById, getOrCreateLocalUser } = require('./db');

const PORT = Number(process.env.PORT) || 8787;

// ローカルモード: VS Code拡張が学習者のPC上で起動する運用。
// ログインを行わず、この端末の単一ユーザーとして扱う（2026-09-24決定）。
// 公開サーバーとして動かす場合はこの環境変数を付けない（従来どおりGoogleログインが必要）
// 既定でローカルモード（2026-10-27）。この道具は学習者が自分のPCにcloneして動かす前提なので、
// 「付け忘れると全ネットワーク面で待ち受けてしまう」向きの既定は危険だった。
// Googleログインを使う構成（卒研の報告書用に残している）で動かすときだけ LOCAL_MODE=0 を付ける。
const LOCAL_MODE = process.env.LOCAL_MODE !== '0';

// 展示ロック（2026-10-09）: 学園祭展示中は展示用の問題(study.html?unit=exhibit-1)と苦手ノートだけ見せる。
// ほかのページはすべて展示ページへ転送し、ナビも2つに絞る。展示が終わったら false に戻す
const EXHIBIT_LOCK = false;
const EXHIBIT_UNIT = 'exhibit-1';
const EXHIBIT_URL = `/study.html?unit=${EXHIBIT_UNIT}`;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const PROBLEMS_PATH = path.join(ROOT, 'problems.json');

// ---------- 学習者のプロジェクトの場所 ----------
// 以前は ROOT/workspace/my-portfolio 決め打ちだったが、2026-10-27 に
// 「どこに作るかは学習者が指定する」方式へ変更した。
// 保存先は機械ごとに1つ（デモ機はゲストが入れ替わるのでユーザー単位にしない）。
const WORKSPACE_CONF = path.join(ROOT, 'workspace-path.local');
// 作るときの元になる雛形と、依存パッケージのキャッシュ
const TEMPLATE_DIR = path.join(ROOT, 'workspace', '_initial');
const DEPS_CACHE = path.join(ROOT, 'workspace', '_deps', 'node_modules');

// こちらから起動した astro dev。二重起動を防ぎ、終了を検知するために持っておく
let previewProc = null;
let previewPort = null;

const getWorkspaceDir = () => {
  try {
    const { dir } = JSON.parse(fs.readFileSync(WORKSPACE_CONF, 'utf8'));
    return dir && fs.existsSync(dir) ? dir : null;
  } catch { return null; }
};
const setWorkspaceDir = (dir) => fs.writeFileSync(WORKSPACE_CONF, JSON.stringify({ dir }, null, 2));

// 作ってよい場所かを確かめる。任意のパスにフォルダを作る機能なので、
// 事故（/ や /System の直下に作る、既存のフォルダを上書きする）を止める
const SYSTEM_DIRS = ['/', '/System', '/Library', '/usr', '/bin', '/sbin', '/etc', '/var', '/private', '/Applications'];
const validateWorkspaceTarget = (dir) => {
  if (!dir || typeof dir !== 'string') return 'フォルダの場所を入力してください';
  if (!path.isAbsolute(dir)) return '絶対パスで指定してください（例: /Users/あなた/Desktop/my-portfolio）';
  const target = path.resolve(dir);
  if (SYSTEM_DIRS.includes(target)) return 'システムの重要なフォルダには作れません';
  const parent = path.dirname(target);
  if (!fs.existsSync(parent)) return `親フォルダがありません: ${parent}`;
  if (!fs.statSync(parent).isDirectory()) return `親がフォルダではありません: ${parent}`;
  if (fs.existsSync(target)) {
    if (!fs.statSync(target).isDirectory()) return 'そこは同じ名前のファイルがあります';
    const inside = fs.readdirSync(target).filter((f) => f !== '.DS_Store');
    if (inside.length) return 'そのフォルダには既に中身があります。空のフォルダか、まだ無い名前を指定してください';
  }
  return null;
};

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
if (!GOOGLE_CLIENT_ID && !LOCAL_MODE) {
  console.warn('[警告] 環境変数 GOOGLE_CLIENT_ID が設定されていません。ログインが機能しません（README参照）。');
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

// --- セッション管理（追加依存なし。署名付きCookieでuser_idを保持） ---
const SESSION_SECRET_PATH = path.join(ROOT, 'session-secret.local');
const loadOrCreateSessionSecret = () => {
  if (fs.existsSync(SESSION_SECRET_PATH)) return fs.readFileSync(SESSION_SECRET_PATH, 'utf8').trim();
  const secret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(SESSION_SECRET_PATH, secret, { mode: 0o600 });
  return secret;
};
const SESSION_SECRET = loadOrCreateSessionSecret();
const COOKIE_NAME = 'session';

const signSession = (userId) => {
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(String(userId)).digest('hex');
  return `${userId}.${sig}`;
};

const verifySessionCookie = (value) => {
  if (!value) return null;
  const [userId, sig] = value.split('.');
  if (!userId || !sig) return null;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(userId).digest('hex');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return Number(userId);
};

const parseCookies = (req) => {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  });
  return out;
};

const getSessionUserId = (req) =>
  (LOCAL_MODE ? getOrCreateLocalUser() : verifySessionCookie(parseCookies(req)[COOKIE_NAME]));

const setSessionCookie = (res, userId) => {
  const value = signSession(userId);
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(value)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000`);
};

const clearSessionCookie = (res) => {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
};

// GoogleのtokeninfoエンドポイントでIDトークンを検証する（google-auth-library等の追加依存を避け、
// プロトタイプの「依存パッケージなし」方針を維持。トークンの署名・有効期限はGoogle側で検証済み、
// ここでは自分のクライアントID向けに発行されたトークンかどうか(aud)を確認する）
const verifyGoogleIdToken = async (idToken) => {
  const upstream = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!upstream.ok) throw new Error('Googleのトークン検証に失敗しました');
  const payload = await upstream.json();
  if (!GOOGLE_CLIENT_ID || payload.aud !== GOOGLE_CLIENT_ID) throw new Error('このアプリ向けに発行されたトークンではありません');
  if (payload.email_verified !== 'true' && payload.email_verified !== true) throw new Error('メールアドレスが未確認のGoogleアカウントです');
  return { sub: payload.sub, email: payload.email, name: payload.name || payload.email };
};

// --- 弱点メモリ（ユーザーごと） ---
const emptyMemory = () => ({ weaknesses: {}, history: [], progress: { clearedIds: [] } });

const loadMemory = (userId) => {
  const memory = readMemory(userId);
  if (!memory.progress) memory.progress = { clearedIds: [] };
  return memory;
};

const saveMemory = (userId, memory) => {
  writeMemory(userId, memory);
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });

const sendJson = (res, status, obj) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
};

// 弱点を記録する: タグごとにカウント・最終確認日時・根拠メモ(最新5件)を蓄積
// 合格時は「克服」処理も行う: 問題が狙っていたタグのうち、今回弱点に挙がらなかったものはカウントを減らす
const recordResult = (memory, { problemId, problemTitle, passed, weaknesses, targetTags }) => {
  const now = new Date().toISOString();
  // カリキュラムの固定問題（base-/header-/... のフェーズ単元）だけをクリア記録する。
  // 生成した復習問題（gen-*）と展示用（exhibit-*）は進捗に数えない。
  // ※以前は 'seed-' 始まりだけを記録していたが、IDをフェーズ式に改名した際に取り残され、
  //   合格しても clearedIds に入らず「学習の道のり」で次の単元が開かなくなっていた（2026-10-19修正）。
  const isCurriculumUnit = problemId && !problemId.startsWith('gen-') && !problemId.startsWith('exhibit-');
  if (passed && isCurriculumUnit && !memory.progress.clearedIds.includes(problemId)) {
    memory.progress.clearedIds.push(problemId);
  }
  (weaknesses || []).forEach(({ tag, note }) => {
    if (!tag) return;
    const w = memory.weaknesses[tag] || { count: 0, lastSeen: null, notes: [] };
    w.count += 1;
    w.lastSeen = now;
    if (note) w.notes = [note, ...w.notes].slice(0, 5);
    memory.weaknesses[tag] = w;
  });
  const recovered = [];
  if (passed) {
    const flagged = new Set((weaknesses || []).map((w) => w.tag));
    (targetTags || []).forEach((tag) => {
      if (flagged.has(tag)) return;
      const w = memory.weaknesses[tag];
      if (!w) return;
      w.count -= 1;
      recovered.push(tag);
      if (w.count <= 0) delete memory.weaknesses[tag];
    });
  }
  memory.history.push({
    ts: now,
    problemTitle: problemTitle || '(無題)',
    passed: !!passed,
    tags: (weaknesses || []).map((w) => w.tag).filter(Boolean),
  });
  return { memory, recovered };
};

// VS Codeから届いた解答の一時置き場。
// 採点のためにブラウザ側へ渡すだけの短命なデータなので、DBには保存せずメモリに置く
// （プロセスを終了すれば消える。学習の記録として残るのは採点結果＝/api/record の方）
const answerBox = new Map();

// 展示用（exhibit-1）のワークスペースをスタート状態に戻す。
// 前の来場者の解答（answerBox）も一緒に消さないと、次の人の画面に「解答が届きました」が残る
// リセットの回数。VS Code拡張がこれを見て、前の人のつまずき記録と未保存の編集を捨てる
let exhibitRound = 0;

// 展示の来場者ログ（2026-10-09）: 何人が触ったかを scripts/exhibit-stats.js で数えるための記録。
// 1行1イベントのJSON。boot/reset が「人の区切り」、その間に touch（保存して書き始めた）か grade（採点した）があれば1人と数える
const EXHIBIT_LOG_PATH = path.join(ROOT, 'exhibit-log.jsonl');
let exhibitTouched = false; // この回でもう touch を記録したか（保存のたびに書かないように）
const logExhibit = (event, extra = {}) => {
  try {
    fs.appendFileSync(EXHIBIT_LOG_PATH, JSON.stringify({ ts: new Date().toISOString(), event, ...extra }) + '\n', 'utf8');
  } catch (e) {
    console.error('exhibit-log への書き込みに失敗:', e.message);
  }
};
logExhibit('boot');

const resetExhibit = (userId, reason = 'unknown') => {
  exhibitRound += 1;
  exhibitTouched = false;
  logExhibit('reset', { reason });
  // 展示デモは廃止。リセット時に workspace の完成版（Hero.astro / index.astro）を
  // 旧デモ課題で上書きしないよう、ファイルの書き戻しは無効化した。
  // ログとステートのリセットのみ行う。
  answerBox.delete(userId);
};

// 展示中はGeminiの無料枠（来場者が多いと上限に当たる）を使わず、このPCのClaude Codeで採点する。
// ツールは全部外し、ただ「システムプロンプト＋入力 → 文章」を返すだけの使い方にする。
// システムプロンプトは改行や引用符を含むので、コマンドライン引数ではなく一時ファイルで渡す
// 注意: callClaude はこの端末の claude CLI を spawn する。/api/claude をインターネットに
// 公開すると、第三者がサーバー上で CLI を実行できてしまう。ローカル開発・学習用途（localhost
// またはログイン必須の自分の環境）に限定し、公開サーバーでは /api/claude を無効化すること。
const CLAUDE_TIMEOUT_MS = 90 * 1000;
const callClaude = (system, user) => new Promise((resolve, reject) => {
  const { spawn } = require('child_process');
  const os = require('os');
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-claude-'));
  const sysFile = path.join(workDir, 'system.txt');
  fs.writeFileSync(sysFile, system, 'utf8');
  const cleanup = () => fs.rm(workDir, { recursive: true, force: true }, () => {});
  // cwdを一時フォルダにするのは、リポジトリのCLAUDE.mdを読み込ませないため。
  // Windowsでは claude が .cmd なので shell 経由で起動する（空文字の引数は "" と書かないと消える）
  const args = ['-p', '--system-prompt-file', `"${sysFile}"`, '--tools', '""', '--strict-mcp-config',
    '--no-session-persistence', '--disable-slash-commands', '--model', 'sonnet', '--output-format', 'json'];
  const child = spawn('claude', args, { cwd: workDir, shell: true, windowsHide: true });
  let out = '';
  let err = '';
  const timer = setTimeout(() => { child.kill(); }, CLAUDE_TIMEOUT_MS);
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { err += d; });
  child.on('error', (e) => { clearTimeout(timer); cleanup(); reject(e); });
  child.on('close', (code) => {
    clearTimeout(timer);
    cleanup();
    try {
      const data = JSON.parse(out);
      if (data.is_error || typeof data.result !== 'string') throw new Error(data.result || 'Claudeからの応答が空です');
      resolve(data.result);
    } catch (e) {
      reject(new Error(code === 0 ? e.message : `Claude Codeの実行に失敗しました（${(err || out).trim().slice(0, 200) || `終了コード ${code}`}）`));
    }
  });
  child.stdin.end(user, 'utf8');
});

// プレビュー（VS Codeで動いている astro dev）の場所。
// ポートは findFreePort で学習者の環境ごとに変わるため、拡張がここへ書き、画面がここから読む。
// 解答と同じく短命な状態なのでDBには入れない
const previewBox = new Map();
// 拡張は起動中ずっと一定間隔で知らせてくる。これより古い情報は「もう動いていない」とみなす
const PREVIEW_STALE_MS = 45 * 1000;

const handleApi = async (req, res, url) => {
  if (req.method === 'GET' && url.pathname === '/api/config') {
    sendJson(res, 200, { googleClientId: GOOGLE_CLIENT_ID || null, localMode: LOCAL_MODE });
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/me') {
    const userId = getSessionUserId(req);
    const user = userId ? getUserById(userId) : null;
    sendJson(res, 200, { user });
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/auth/google') {
    const { credential } = await readBody(req);
    if (!credential) { sendJson(res, 400, { error: 'credential is required' }); return; }
    try {
      const { sub, email, name } = await verifyGoogleIdToken(credential);
      const userId = upsertUser({ googleSub: sub, email, displayName: name });
      setSessionCookie(res, userId);
      sendJson(res, 200, { user: getUserById(userId) });
    } catch (e) {
      sendJson(res, 401, { error: e.message });
    }
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/auth/guest') {
    const body = await readBody(req);
    const displayName = ((body.displayName || '').trim() || 'ゲスト').slice(0, 50);
    const guestSub = `guest-${crypto.randomBytes(8).toString('hex')}`;
    const userId = upsertUser({ googleSub: guestSub, email: null, displayName });
    setSessionCookie(res, userId);
    sendJson(res, 200, { user: getUserById(userId) });
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
    clearSessionCookie(res);
    sendJson(res, 200, {});
    return;
  }

  // これ以降はログイン必須
  const userId = getSessionUserId(req);
  if (!userId) { sendJson(res, 401, { error: 'login required' }); return; }

  if (req.method === 'GET' && url.pathname === '/api/state') {
    const problems = JSON.parse(fs.readFileSync(PROBLEMS_PATH, 'utf8'));
    sendJson(res, 200, { problems, memory: loadMemory(userId) });
    return;
  }
  // --- VS Code拡張との連携（ローカルモード用） ---

  // 拡張が「今どのステップか」と、そのステップで新しく作るファイルの雛形を取りに来る
  if (req.method === 'GET' && url.pathname === '/api/step') {
    const problems = JSON.parse(fs.readFileSync(PROBLEMS_PATH, 'utf8'));
    const memory = loadMemory(userId);
    const cleared = new Set(memory.progress.clearedIds || []);
    // ?id= で固定できる（展示用ワークスペースは常に exhibit-1。進み具合に合わせて別の雛形を置かれると困る）
    const pinned = url.searchParams.get('id');
    const current = (pinned && problems.find((p) => p.id === pinned))
      || problems.find((p) => !cleared.has(p.id)) || problems[problems.length - 1];
    sendJson(res, 200, {
      step: {
        id: current.id,
        title: current.title,
        description: current.description,
        checkpoints: current.checkpoints || [],
        newFiles: (current.starter && current.starter.newFiles) || {},
      },
      clearedCount: cleared.size,
      totalCount: problems.length,
    });
    return;
  }

  // 拡張が書いた解答（VS Code上の実ファイル）と、つまずきサマリの受け渡し。
  // PUT=拡張から保存、GET=画面側が採点のために読む
  if (url.pathname === '/api/answer') {
    if (req.method === 'PUT') {
      const { stepId, files, struggle } = await readBody(req);
      answerBox.set(userId, { stepId, files: files || {}, struggle: struggle || null, savedAt: new Date().toISOString() });
      if (stepId === EXHIBIT_UNIT && !exhibitTouched) {
        exhibitTouched = true;
        logExhibit('touch');
      }
      sendJson(res, 200, { ok: true });
      return;
    }
    if (req.method === 'GET') {
      sendJson(res, 200, answerBox.get(userId) || null);
      return;
    }
  }

  // プレビューの場所の受け渡し。PUT=拡張が astro dev のURLを知らせる、GET=画面がiframeに出すために読む。
  // 画面側は running が false／url が無いときは何もしない（手入力のポートを保つ）約束になっている
  if (url.pathname === '/api/preview') {
    if (req.method === 'PUT') {
      const { url: previewUrl, running } = await readBody(req);
      previewBox.set(userId, { url: previewUrl || null, running: !!running, updatedAt: Date.now() });
      sendJson(res, 200, { ok: true });
      return;
    }
    if (req.method === 'GET') {
      const entry = previewBox.get(userId);
      // VS Codeごと落ちた場合は PUT が来なくなるだけなので、古さで判断する
      const alive = !!entry && entry.running && Date.now() - entry.updatedAt < PREVIEW_STALE_MS;
      sendJson(res, 200, { url: alive ? entry.url : null, running: alive });
      return;
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/workspace') {
    const dir = getWorkspaceDir();
    sendJson(res, 200, { portfolioDir: dir, ready: !!dir });
    return;
  }

  // 展示用リセット: ワークスペースをexhibit-1のスタート状態に戻してリダイレクト
  if (req.method === 'GET' && url.pathname === '/reset-exhibit') {
    resetExhibit(userId, 'url');
    res.writeHead(302, { Location: '/study.html?unit=exhibit-1' });
    res.end();
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/exhibit-round') {
    sendJson(res, 200, { round: exhibitRound });
    return;
  }
  // 画面の「次の人へ」ボタンと、放置時の自動リセットから呼ぶ
  if (req.method === 'POST' && url.pathname === '/api/reset-exhibit') {
    const { reason } = await readBody(req);
    resetExhibit(userId, ['next-button', 'idle'].includes(reason) ? reason : 'unknown');
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/claude') {
    const { system, user } = await readBody(req);
    try {
      sendJson(res, 200, { text: await callClaude(String(system || ''), String(user || '')) });
    } catch (e) {
      sendJson(res, 502, { error: e.message });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/check-editor') {
    const { execSync } = require('child_process');
    let running = false;
    try {
      if (process.platform === 'win32') {
        const out = execSync('tasklist /FO CSV /NH', { timeout: 3000 }).toString().toLowerCase();
        running = out.includes('code.exe') || out.includes('cursor.exe');
      } else {
        // macOS/Linux には tasklist が無い。ここが Windows 専用だったため、
        // エディターを開いていても毎回「どのエディターで開きますか？」が出ていた（2026-10-26修正）。
        // プロセス名は「パスの最後の部分」だけを完全一致で見る。部分一致にすると macOS の
        // CursorUIViewService（文字カーソルの系統サービス）を Cursor と誤判定してしまう
        const out = execSync('ps -Ao comm=', { timeout: 3000 }).toString();
        const names = new Set(
          out.split('\n').map((line) => line.trim().split('/').pop().toLowerCase()).filter(Boolean),
        );
        running = names.has('code') || names.has('cursor');
      }
    } catch { /* ignore */ }
    sendJson(res, 200, { running });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/open-editor') {
    const { editor } = await readBody(req);
    const workspacePath = getWorkspaceDir();
    if (!workspacePath) { sendJson(res, 400, { error: 'プロジェクトの場所がまだ決まっていません' }); return; }
    // 以前は `code <path>` を投げっぱなしにして常に成功を返していたが、
    // code/cursor コマンドはPATHに無いことが多く（VS Codeの "Shell Command: Install
    // 'code' command in PATH" を実行していない環境）、押しても何も起きなかった。
    // macOS はアプリ名で開けるのでそちらを優先し、失敗はきちんと伝える（2026-10-27）
    const isCursor = editor === 'cursor';
    const appName = isCursor ? 'Cursor' : 'Visual Studio Code';
    const cliName = isCursor ? 'cursor' : 'code';
    const attempts = process.platform === 'darwin'
      ? [{ cmd: 'open', args: ['-a', appName, workspacePath], shell: false },
         { cmd: cliName, args: [workspacePath], shell: true }]
      : [{ cmd: cliName, args: [workspacePath], shell: true }];

    const tryOpen = ({ cmd, args, shell }) => new Promise((resolve) => {
      let settled = false;
      const done = (ok, msg) => { if (!settled) { settled = true; resolve({ ok, msg }); } };
      try {
        const child = require('child_process').spawn(cmd, args, { shell, windowsHide: true });
        let err = '';
        if (child.stderr) child.stderr.on('data', (d) => { err += d.toString(); });
        child.on('error', (e) => done(false, e.message));
        child.on('exit', (code) => done(code === 0, err.trim() || `終了コード ${code}`));
        // 起動しっぱなしになる形（code コマンド等）は、すぐ落ちなければ成功とみなす
        setTimeout(() => done(true, ''), 1500);
      } catch (e) { done(false, e.message); }
    });

    let last = '';
    for (const a of attempts) {
      const r = await tryOpen(a);
      if (r.ok) { sendJson(res, 200, { ok: true, opened: a.cmd }); return; }
      last = r.msg;
    }
    sendJson(res, 500, {
      error: `${appName} を開けませんでした（${last}）。インストールされているか確認してください。`
             + `VS Codeの場合はコマンドパレットで「Shell Command: Install 'code' command in PATH」を実行すると確実です。`,
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/check-files') {
    const { paths } = await readBody(req);
    const workspaceDir = getWorkspaceDir();
    if (!workspaceDir) { sendJson(res, 400, { error: 'プロジェクトの場所がまだ決まっていません' }); return; }
    const result = {};
    (paths || []).forEach((p) => {
      const full = path.resolve(workspaceDir, p);
      result[p] = full.startsWith(workspaceDir + path.sep) && fs.existsSync(full);
    });
    sendJson(res, 200, result);
    return;
  }

  // ワークスペース上のファイルを直接読み込む。
  // VS Code拡張なしでも提出できるようにするために使う
  if (req.method === 'POST' && url.pathname === '/api/read-workspace') {
    const { paths } = await readBody(req);
    const workspaceDir = getWorkspaceDir();
    if (!workspaceDir) { sendJson(res, 400, { error: 'プロジェクトの場所がまだ決まっていません' }); return; }
    const result = {};
    (paths || []).forEach((p) => {
      const full = path.resolve(workspaceDir, p);
      if (!full.startsWith(workspaceDir + path.sep)) return;
      try {
        result[p] = fs.readFileSync(full, 'utf8');
      } catch { /* ファイルが存在しない場合は含めない */ }
    });
    sendJson(res, 200, result);
    return;
  }

  // 苦手の復習（生成問題）専用ページ src/pages/review.astro を用意する。
  // 復習問題はポートフォリオ本体を汚さず、/review という専用ルートで書く・プレビューする。
  if (req.method === 'POST' && url.pathname === '/api/seed-review') {
    const { content } = await readBody(req);
    const workspaceDir = getWorkspaceDir();
    if (!workspaceDir) { sendJson(res, 400, { error: 'プロジェクトの場所がまだ決まっていません' }); return; }
    const target = path.join(workspaceDir, 'src', 'pages', 'review.astro');
    try {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, String(content || ''), 'utf8');
      sendJson(res, 200, { ok: true, path: 'src/pages/review.astro' });
    } catch (e) {
      sendJson(res, 500, { error: e.message });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/record') {
    const body = await readBody(req);
    if (body.problemId === EXHIBIT_UNIT || body.exhibitReview) {
      logExhibit('grade', { passed: !!body.passed, review: !!body.exhibitReview });
    }
    const { memory, recovered } = recordResult(loadMemory(userId), body);
    saveMemory(userId, memory);
    sendJson(res, 200, { memory, recovered });
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/reset') {
    saveMemory(userId, emptyMemory());
    sendJson(res, 200, { memory: emptyMemory() });
    return;
  }
  // デモ用のワンボタンリセット。学習の記録と、ワークスペースの中身の両方を
  // workspace/_initial の状態に戻す（記録だけ消す /api/reset とは別物）。
  // node_modules・package.json・public・.vscode には触らない
  //（preact は island-1 のために同梱したままにしておく必要があるため）
  // プレビュー（astro dev）をこちらから起動する。止まっているとき、学習者が
  // ターミナルを開かずに動かせるようにするため（2026-10-27）。
  // 既に動いているものを二重に立てないよう、起動した子プロセスを覚えておく
  if (req.method === 'POST' && url.pathname === '/api/preview/start') {
    const workspaceDir = getWorkspaceDir();
    if (!workspaceDir) { sendJson(res, 400, { error: 'プロジェクトの場所がまだ決まっていません' }); return; }
    const port = Number((await readBody(req)).port) || 4321;
    if (previewProc && !previewProc.killed) { sendJson(res, 200, { ok: true, already: true, port: previewPort }); return; }

    const bin = path.join(workspaceDir, 'node_modules', '.bin', process.platform === 'win32' ? 'astro.cmd' : 'astro');
    if (!fs.existsSync(bin)) {
      sendJson(res, 500, { error: 'astro が見つかりません。プロジェクトを作り直してください。' });
      return;
    }
    try {
      const child = require('child_process').spawn(bin, ['dev', '--port', String(port)], {
        cwd: workspaceDir, shell: process.platform === 'win32', windowsHide: true,
      });
      let log = '';
      child.stdout.on('data', (d) => { log += d.toString(); });
      child.stderr.on('data', (d) => { log += d.toString(); });
      child.on('exit', () => { previewProc = null; });
      previewProc = child;
      previewPort = port;
      // 立ち上がるまで少し待ってから返す（すぐ落ちた場合はその理由を返したい）
      await new Promise((r) => setTimeout(r, 2500));
      if (!previewProc) { sendJson(res, 500, { error: `起動できませんでした: ${log.trim().slice(-300) || '原因不明'}` }); return; }
      sendJson(res, 200, { ok: true, port });
    } catch (e) {
      previewProc = null;
      sendJson(res, 500, { error: `起動できませんでした: ${e.message}` });
    }
    return;
  }

  // OS標準の「フォルダを選ぶ」ダイアログを出す。パスを手で打たせるのは分かりにくいため。
  // サーバーと同じ機械の画面にダイアログが出る前提（この道具はローカルで使うもの）。
  // ここで選ぶのは「どこに作るか」の親フォルダで、プロジェクトのフォルダはこの中に作る
  if (req.method === 'POST' && url.pathname === '/api/pick-folder') {
    const { spawn } = require('child_process');
    const prompt = 'ポートフォリオを作る場所を選んでください';
    let cmd; let args;
    if (process.platform === 'darwin') {
      // activate しないとダイアログがブラウザの裏に出て気づけない
      cmd = 'osascript';
      args = ['-e', 'tell application "System Events" to activate',
              '-e', `POSIX path of (choose folder with prompt "${prompt}")`];
    } else if (process.platform === 'win32') {
      cmd = 'powershell';
      args = ['-NoProfile', '-STA', '-Command',
        `Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.FolderBrowserDialog; $d.Description = '${prompt}'; if ($d.ShowDialog() -eq 'OK') { Write-Output $d.SelectedPath }`];
    } else {
      cmd = 'zenity';
      args = ['--file-selection', '--directory', `--title=${prompt}`];
    }

    const picked = await new Promise((resolve) => {
      let out = ''; let err = ''; let settled = false;
      const done = (v) => { if (!settled) { settled = true; resolve(v); } };
      let child;
      try { child = spawn(cmd, args); } catch (e) { done({ error: e.message }); return; }
      // 誰も触らないまま残り続けないよう上限を設ける
      const timer = setTimeout(() => { try { child.kill(); } catch { /* ignore */ } done({ canceled: true }); }, 120000);
      child.stdout.on('data', (d) => { out += d.toString(); });
      child.stderr.on('data', (d) => { err += d.toString(); });
      child.on('error', (e) => { clearTimeout(timer); done({ error: e.message }); });
      child.on('close', (code) => {
        clearTimeout(timer);
        const dir = out.trim().replace(/\/$/, '');
        if (dir) { done({ dir }); return; }
        // 「選ばずに閉じた」はエラーではない
        if (code !== 0 && /cancel/i.test(err)) { done({ canceled: true }); return; }
        done(code === 0 ? { canceled: true } : { error: err.trim() || `フォルダ選択を開けませんでした（終了コード ${code}）` });
      });
    });

    if (picked.error) { sendJson(res, 500, { error: picked.error }); return; }
    sendJson(res, 200, picked);
    return;
  }

  // 学習者のプロジェクトを、指定された場所に作る。
  // 依存パッケージは、同梱のキャッシュ（workspace/_deps/node_modules）があればコピーする。
  // 無ければ npm install にフォールバックする（2026-10-27追加）。
  // キャッシュは153MBあり gitignore 済みなので、リポジトリを clone した学習者の手元には存在しない。
  // 以前これが無いと deps='skipped' で「成功」を返し、node_modules の無いプロジェクトが
  // できてしまっていた（npm run dev が動かない）。
  if (req.method === 'POST' && url.pathname === '/api/workspace/create') {
    const body = await readBody(req);
    // ~ だけ先に展開し、絶対パスかどうかは resolve する前に見る
    //（先に resolve すると相対パスも絶対になってしまい、「絶対パスで」の案内が出せない）
    const expanded = body.dir ? String(body.dir).trim().replace(/^~(?=\/|$)/, os.homedir()) : '';
    const invalid = validateWorkspaceTarget(expanded);
    const target = invalid ? '' : path.resolve(expanded);
    if (invalid) { sendJson(res, 400, { error: invalid }); return; }
    try {
      fs.mkdirSync(target, { recursive: true });
      // 雛形（src・astro.config.mjs・package.json）を置く
      fs.readdirSync(TEMPLATE_DIR)
        .filter((name) => name !== 'README.md')
        .forEach((name) => fs.cpSync(path.join(TEMPLATE_DIR, name), path.join(target, name), { recursive: true }));
      // 依存パッケージ
      let deps;
      if (fs.existsSync(DEPS_CACHE)) {
        fs.cpSync(DEPS_CACHE, path.join(target, 'node_modules'), { recursive: true });
        deps = 'copied';
      } else {
        // clone してきた場合はここを通る。初回だけネット接続が必要
        const { execFileSync } = require('child_process');
        const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        try {
          execFileSync(npm, ['install', '--no-audit', '--no-fund'], {
            cwd: target, shell: process.platform === 'win32', windowsHide: true,
            timeout: 10 * 60 * 1000, stdio: 'pipe',
          });
          deps = 'installed';
        } catch (e) {
          const detail = (e.stderr || e.stdout || '').toString().trim().slice(-400);
          sendJson(res, 500, {
            error: `必要なパッケージを用意できませんでした。ネットにつながっているか確かめて、もう一度お試しください。\n${detail}`,
          });
          return;
        }
      }
      setWorkspaceDir(target);
      sendJson(res, 200, { portfolioDir: target, deps });
    } catch (e) {
      sendJson(res, 500, { error: `作成に失敗しました: ${e.message}` });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/reset-all') {
    const workspaceDir = getWorkspaceDir();
    if (!workspaceDir) {
      // 既に何も無い状態。記録だけ消して終わる
      saveMemory(userId, emptyMemory());
      answerBox.delete(userId);
      sendJson(res, 200, { memory: emptyMemory(), removed: null });
      return;
    }

    // 任意のパスを再帰削除するので、消してよい場所かを厳しく確かめる。
    // 「設定されている場所」かつ「この道具が作ったプロジェクトの形をしている」ときだけ消す
    const target = path.resolve(workspaceDir);
    const looksLikeOurProject = ['package.json', 'astro.config.mjs', 'src'].every(
      (name) => fs.existsSync(path.join(target, name)),
    );
    const unsafe = SYSTEM_DIRS.includes(target)
      || target === path.resolve(os.homedir())
      || target === path.resolve(ROOT)
      || target.split(path.sep).filter(Boolean).length < 2;
    if (unsafe) { sendJson(res, 500, { error: `この場所は消せません: ${target}` }); return; }
    if (!looksLikeOurProject) {
      sendJson(res, 500, {
        error: `${target} はこの道具が作ったプロジェクトの形をしていません（package.json / astro.config.mjs / src が揃っていない）。安全のため消しませんでした。`,
      });
      return;
    }

    // そのフォルダで動かしているプレビューを先に止める（消しながら動いていると面倒）
    if (previewProc && !previewProc.killed) {
      try { previewProc.kill(); } catch { /* ignore */ }
      previewProc = null;
      previewPort = null;
    }

    try {
      fs.rmSync(target, { recursive: true, force: true });
      fs.rmSync(WORKSPACE_CONF, { force: true });   // 場所の設定も消して、次は作る所から
    } catch (e) {
      sendJson(res, 500, { error: `フォルダを消せませんでした: ${e.message}` });
      return;
    }

    saveMemory(userId, emptyMemory());
    answerBox.delete(userId);
    sendJson(res, 200, { memory: emptyMemory(), removed: target });
    return;
  }

  sendJson(res, 404, { error: 'not found' });
};

const serveStatic = (res, pathname) => {
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.join(PUBLIC_DIR, rel);
  if (!filePath.startsWith(PUBLIC_DIR) || !fs.existsSync(filePath)) {
    res.writeHead(404); res.end('not found');
    return;
  }
  const headers = { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' };
  if (EXHIBIT_LOCK && path.extname(filePath) === '.html') {
    res.writeHead(200, headers);
    res.end(lockExhibitHtml(fs.readFileSync(filePath, 'utf8'), rel));
    return;
  }
  res.writeHead(200, headers);
  res.end(fs.readFileSync(filePath));
};

// ---------- 展示ロック ----------
// 見せてよいのは展示用の問題と苦手ノートだけ。study.html も展示用以外（?review=1 や別単元）は展示用へ寄せる
const exhibitRedirect = (url) => {
  const p = url.pathname;
  if (p === '/notebook.html') return null;
  if (p === '/study.html' && url.searchParams.get('unit') === EXHIBIT_UNIT && !url.searchParams.has('review')) return null;
  if (p === '/' || p.endsWith('.html')) return EXHIBIT_URL;
  return null; // CSS・JS・画像などはそのまま
};

// ナビを「展示の問題」「苦手ノート」の2つに差し替え、苦手ノートの「練習する」（復習問題へ飛ぶ）を隠す
const lockExhibitHtml = (html, rel) => {
  const link = (href, label, active) =>
    `<a href="${href}"${active ? ' class="active" aria-current="page"' : ''}>${label}</a>`;
  const nav = '<nav class="mainnav" aria-label="ページ切替">\n    '
    + link(EXHIBIT_URL, '展示の問題', rel === 'study.html') + '\n    '
    + link('notebook.html', '苦手ノート', rel === 'notebook.html') + '\n  </nav>';
  return html
    .replace(/<nav class="mainnav"[\s\S]*?<\/nav>/, nav)
    .replace('</head>', '<style>.weak-card__cta-row{display:none!important}</style>\n</head>');
};

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const lockedTo = EXHIBIT_LOCK && !url.pathname.startsWith('/api/') ? exhibitRedirect(url) : null;
    if (lockedTo) {
      res.writeHead(302, { Location: lockedTo });
      res.end();
    } else if (url.pathname.startsWith('/api/') || url.pathname === '/reset-exhibit') {
      // /reset-exhibit はブラウザで直接開ける手動リセット用（中身は handleApi 側）
      await handleApi(req, res, url);
    } else {
      serveStatic(res, url.pathname);
    }
  } catch (e) {
    sendJson(res, 500, { error: String(e) });
  }
}).listen(PORT, LOCAL_MODE ? '127.0.0.1' : undefined, () => {
  // ローカルモードでは 127.0.0.1 のみにバインドする（同一ネットワークの他人から見えないように）
  console.log(`astro-study-ai prototype: http://127.0.0.1:${PORT}`);
  if (LOCAL_MODE) console.log('ローカルモード: ログインなし・この端末の単一ユーザーで動作します');
  else console.warn('[警告] LOCAL_MODE=0 です。全ネットワーク面で待ち受けるため、同じネットワークの他人から見えます。');
});
