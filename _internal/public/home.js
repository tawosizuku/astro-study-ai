// ホーム: 入口カード3枚（学習の道のり／苦手ノート／さいきんの学習）

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
      // フォルダごと最初からやり直すので、各ページの「初めて開いたときの案内」も
      // もう一度出せるようにする（出し終わった扱いのままだと、新しい作業フォルダで
      // 迷っても案内が出ない）
      try {
        localStorage.removeItem('roadmapTourSeen');
        localStorage.removeItem('notebookTourSeen');
      } catch { /* 使えなくても困らない */ }
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
      // 作り終えた直後に目印を立て、読み込み直したあとのホームで一度だけ案内を出す。
      // 作成中の画面でそのまま出すと、カードがまだ隠れていて指す先が無い
      try { localStorage.setItem(TOUR_PENDING_KEY, '1'); } catch { /* 使えなくても困らない */ }
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

// 作業フォルダを登録した直後の一度だけ出す画面案内。
// ハイライトした場所を実際に押してもらう形にしているので、説明と操作が一致する。
// 「初期状態に戻す」はあえて入れない。押させる対象にすると、削除の確認画面を
// 開くところまでを案内の一部にしてしまい、事故のもとになる
const TOUR_PENDING_KEY = 'homeTourPending';

// このホームの案内は、ホーム画面の中身だけを紹介する（カードの先のページまでは入らない）。
// 各カードの先のページ（学習の道のり・苦手ノート）には、それぞれ初めて開いたときに
// 自動で始まる専用の案内を別に用意している（roadmap.js・notebook.js）
const TOUR_STEPS = [
  {
    text: '準備ができました！この画面の使い方を、かんたんに案内します。',
    buttonLabel: 'はじめる',
  },
  {
    target: '.hub-card[data-target="roadmap"]',
    blockDefault: true,
    text: 'ここが学習の入口です。全部で何問あって、いま自分がどこにいるのかが分かります。問題を解くときはここから入ります。開くと、ページの中身もくわしく案内します。',
  },
  {
    target: '.hub-card[data-target="progress"]',
    blockDefault: true,
    text: 'クリアした数と、いまの苦手の数が出ます。間違えた内容はここに記録されていきます。開くと、ページの中身もくわしく案内します。',
  },
  {
    target: '.hub-card[data-target="history"]',
    blockDefault: true,
    text: '直前に解いた問題が出ます。前回の続きから始めたいときの目印になります。ひとつ前の「苦手ノート」と同じページにつながっています。',
  },
  {
    target: '.mainnav a[href="glossary.html"]',
    blockDefault: true,
    text: '知らない言葉が出てきたら用語集を見てください。Astroの用語をやさしい言葉で説明しています。',
  },
  {
    target: '#home-where',
    blockDefault: true,
    text: 'ここが、いまあなたのファイルが置いてある場所です。コードはこのフォルダの中に、VS Codeで書いていきます。',
  },
  {
    target: '#home-open-editor',
    text: 'この「エディターで開く」を押すと、そのフォルダがVS Codeで開きます。押してみましょう。',
  },
  {
    text: '案内はここまでです。「学習の道のり」から、さっそく1問目を始めてみましょう！',
    buttonLabel: 'とじる',
  },
];

const maybeStartTour = () => {
  let pending = false;
  try {
    pending = localStorage.getItem(TOUR_PENDING_KEY) === '1';
    if (pending) localStorage.removeItem(TOUR_PENDING_KEY);
  } catch { /* localStorageが使えない環境では案内を出さないだけ */ }
  if (!pending || typeof window.startSpotlightTour !== 'function') return;
  // カードの中身が埋まってから測りたい。先に出すと枠が文言の長さで動いてしまう
  requestAnimationFrame(() => window.startSpotlightTour(TOUR_STEPS));
};

// 初回だけ出す「採点に使うAIを選ぶ」バナー。workspaceの場所決めとは違い、他の画面は
// これを選ばなくても使えるので、hub-cardsは隠さない（スキップもできる）
const AI_CHOICE_MADE_KEY = 'aiChoiceMade';

const setupAiChoice = async () => {
  const section = $('home-ai-setup');
  if (!section) return;
  try {
    if (localStorage.getItem(AI_CHOICE_MADE_KEY) === '1') return;
  } catch { return; }

  const geminiRadio = $('ai-setup-gemini-radio');
  const claudeRadio = $('ai-setup-claude-radio');
  const geminiKeyInput = $('ai-setup-gemini-key');
  const status = $('ai-setup-status');

  try { geminiKeyInput.value = localStorage.getItem('geminiKey') || ''; } catch { /* ignore */ }

  section.hidden = false;
  geminiRadio.checked = true; // claudeの検出が終わるまでの既定

  // 検出が終わる前にユーザーが自分でどちらかを選んでいたら、その選択を上書きしない
  let userPicked = false;
  geminiRadio.addEventListener('change', () => { userPicked = true; });
  claudeRadio.addEventListener('change', () => { userPicked = true; });

  const applyClaudeStatus = (claudeStatus, { autoSelect }) => {
    const info = describeClaudeStatus(claudeStatus);
    $('ai-setup-claude-status').textContent = info.text;
    claudeRadio.disabled = !info.ok;
    if (info.ok && autoSelect) claudeRadio.checked = true;
  };
  fetchClaudeStatus().then((claudeStatus) => {
    applyClaudeStatus(claudeStatus, { autoSelect: !userPicked }); // 使えるならキー入力が要らないClaudeを既定にする
    // 案内からインストール・ログインを済ませた場合は、本人がClaudeを使うために進めたので選択状態にする
    mountClaudeSetupGuide($('ai-setup-claude-guide'), claudeStatus, (next) => applyClaudeStatus(next, { autoSelect: true }));
  });

  const finish = (useClaude, geminiKey) => {
    try {
      localStorage.setItem('useClaude', useClaude ? '1' : '');
      if (geminiKey !== null) localStorage.setItem('geminiKey', geminiKey);
      localStorage.setItem(AI_CHOICE_MADE_KEY, '1');
    } catch { /* ignore */ }
    section.hidden = true;
  };

  $('ai-setup-save-btn').addEventListener('click', () => {
    const useClaude = claudeRadio.checked;
    if (!useClaude && !geminiKeyInput.value.trim()) {
      status.hidden = false;
      status.className = 'home-setup__status is-error';
      status.textContent = 'Gemini APIキーを入力してください（あとで設定ページからでも入力できます）';
      return;
    }
    finish(useClaude, useClaude ? null : geminiKeyInput.value.trim());
  });

  $('ai-setup-skip-btn').addEventListener('click', () => finish(false, null));
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
  setupAiChoice();
  setupReset();
  getState()
    .then(() => { maybeStartTour(); })
    .catch((e) => { $('home-greeting').textContent = `エラー: ${e.message}`; });
};
