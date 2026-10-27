// ホーム: 入口カード3枚（学習の道のり／記録・進捗／さいきんの学習）のプレビューを埋める

const renderHome = (state) => {
  const { problems, memory } = state;
  const cleared = new Set(memory.progress?.clearedIds || []);
  const weakCount = Object.keys(memory.weaknesses).length;

  const firstUncleared = problems.find((p) => !cleared.has(p.id));
  if (firstUncleared) {
    $('hub-roadmap-preview').textContent = `現在地: ${firstUncleared.title} ／ ${cleared.size}/${problems.length} ここまで進んでいます`;
  } else {
    $('hub-roadmap-preview').textContent = `全${problems.length}ステップ クリアしました！`;
  }

  $('hub-progress-preview').textContent = `クリア${cleared.size}/${problems.length}・苦手${weakCount}件`;

  const last = memory.history[memory.history.length - 1];
  $('hub-history-preview').textContent = last
    ? `直近: ${last.problemTitle} ${last.passed ? 'クリア' : '挑戦'}（${fmtDate(last.ts)}）`
    : 'まだ記録がありません。学習の道のりから始めましょう！';
};

// デモ用のワンボタンリセット。確認は画面内で2段構えにする（ブラウザのconfirmは使わない）
const setupReset = () => {
  const btn = $('reset-all-btn');
  const box = $('reset-all-confirm');
  const status = $('reset-all-status');
  if (!btn || !box) return;

  btn.addEventListener('click', () => {
    box.hidden = false;
    btn.hidden = true;
    // 何が消えるのかを名指しで見せる。パスを見ずに押せてしまうと事故になる
    const t = $('reset-target-path');
    if (t) t.textContent = $('home-where-path').textContent || '（まだありません）';
  });
  $('reset-all-no').addEventListener('click', () => { box.hidden = true; btn.hidden = false; });

  $('reset-all-yes').addEventListener('click', async () => {
    const yes = $('reset-all-yes');
    yes.disabled = true;
    status.hidden = false;
    status.className = 'home-reset__status';
    status.textContent = '戻しています…';
    try {
      const data = await postJson('/api/reset-all', {});
      status.textContent = data.removed
        ? `${data.removed} を削除しました。読み込み直します…`
        : '記録を消しました。読み込み直します…';
      setTimeout(() => location.reload(), 900);
    } catch (e) {
      status.className = 'home-reset__status is-error';
      status.textContent = `戻せませんでした: ${e.message}`;
      yes.disabled = false;
    }
  });
};

// プロジェクトの置き場所。決まっていなければ指定画面を出し、決まっていれば場所を見せる。
// 決め打ちの workspace/my-portfolio をやめたので、最初にここを通らないと何も始まらない
const setupWorkspace = async () => {
  const setup = $('home-setup');
  const where = $('home-where');
  const cards = document.querySelector('.hub-cards');
  const input = $('setup-dir');
  const status = $('setup-status');

  const showReady = (dir) => {
    setup.hidden = true;
    where.hidden = false;
    cards.hidden = false;
    $('home-where-path').textContent = dir;
  };

  const showSetup = () => {
    setup.hidden = false;
    where.hidden = true;
    cards.hidden = true;   // 場所が決まるまで先に進ませない
    if (!input.value) input.value = '~/Desktop/my-portfolio';
  };

  let state = { ready: false, portfolioDir: null };
  try { state = await fetch('/api/workspace').then((r) => r.json()); } catch { /* ignore */ }
  if (state.ready) { showReady(state.portfolioDir); return state; }

  showSetup();

  // OS標準のフォルダ選択を開く。選ばれるのは「どこに作るか」の親フォルダなので、
  // その中に作るプロジェクト名を足して入力欄に入れる（名前は手で直せる）
  $('setup-pick-btn').addEventListener('click', async () => {
    const pick = $('setup-pick-btn');
    pick.disabled = true;
    const original = pick.textContent;
    pick.textContent = '選択中…';
    try {
      const data = await postJson('/api/pick-folder', {});
      status.hidden = false;
      status.className = 'home-setup__status';
      if (data.dir) {
        const name = (input.value.split('/').pop() || 'my-portfolio').trim() || 'my-portfolio';
        input.value = `${data.dir.replace(/\/$/, '')}/${name}`;
        status.textContent = 'ここでよければ「ここに作る」を押してください。';
      } else {
        status.textContent = '選ばずに閉じました。';
      }
    } catch (e) {
      status.hidden = false;   // ここを忘れると、失敗の理由を書いても見えないまま終わる
      status.className = 'home-setup__status is-error';
      status.textContent = `${e.message}（うまくいかないときは、下の欄にパスを直接書いても作れます）`;
    }
    pick.textContent = original;
    pick.disabled = false;
  });

  $('setup-create-btn').addEventListener('click', async () => {
    const btn = $('setup-create-btn');
    btn.disabled = true;
    status.hidden = false;
    status.className = 'home-setup__status';
    status.textContent = '作っています…（必要なファイルをそろえるので少し待ってください）';
    try {
      const data = await postJson('/api/workspace/create', { dir: input.value.trim() });
      status.textContent = `${data.portfolioDir} に作りました。読み込み直します…`;
      setTimeout(() => location.reload(), 900);
    } catch (e) {
      status.className = 'home-setup__status is-error';
      status.textContent = e.message;
      btn.disabled = false;
    }
  });
  return state;
};

const setupOpenEditor = () => {
  const btn = $('home-open-editor');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = '開いています…';
    try {
      await postJson('/api/open-editor', { editor: 'vscode' });
      btn.textContent = '開きました';
    } catch (e) {
      btn.textContent = '開けませんでした';
      const where = $('home-where');
      let msg = where.querySelector('.home-where__error');
      if (!msg) {
        msg = document.createElement('p');
        msg.className = 'home-where__error';
        where.appendChild(msg);
      }
      msg.textContent = e.message;
    }
    setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 2500);
  });
};

window.onAuthReady = () => {
  setupOpenEditor();
  setupWorkspace().then((state) => { if (!state.ready) return; });
  setupReset();
  getState()
    .then(renderHome)
    .catch((e) => { $('home-greeting').textContent = `エラー: ${e.message}`; });
};
