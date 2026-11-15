// 苦手ノート: 記録・進捗サマリー・弱点の詳細・学習のあゆみ・記憶の管理

const HISTORY_OPEN_KEY = 'notebook.historyOpen';

const setHistoryOpen = (open) => {
  $('history-panel-body').hidden = !open;
  $('history-toggle').setAttribute('aria-expanded', String(open));
  $('history-toggle').querySelector('.history-panel__chevron').textContent = open ? '▾' : '▸';
  localStorage.setItem(HISTORY_OPEN_KEY, open ? '1' : '0');
};

const renderNotebook = (state) => {
  const { problems, memory } = state;
  const cleared = new Set(memory.progress?.clearedIds || []);
  $('stat-cleared').textContent = `${cleared.size} / ${problems.length}`;
  $('stat-weak').textContent = `${Object.keys(memory.weaknesses).length}件`;
  $('stat-tries').textContent = `${memory.history.length}回`;

  const entries = Object.entries(memory.weaknesses).sort((a, b) => effectiveImportance(b[1]) - effectiveImportance(a[1]));
  const wrap = $('weak-cards');
  wrap.innerHTML = '';
  $('weak-empty').style.display = entries.length ? 'none' : 'block';
  entries.forEach(([tag, w]) => {
    const card = document.createElement('div');
    card.className = 'weak-card';
    const notes = (w.notes || []).map((n) => `<li>${n}</li>`).join('');
    card.innerHTML = [
      '<div class="weak-box">',
      `<span class="chip">${TAG_LABELS[tag] || tag} <span class="c-count">×${w.count}</span></span>`,
      notes ? `<ul class="weak-notes">${notes}</ul>` : '',
      '</div>',
      `<p class="weak-meta">最終確認: ${fmtDate(w.lastSeen)} ／ 今の重要度: ${effectiveImportance(w).toFixed(1)}</p>`,
      // 練習問題の実体は1つ（study.js の generateReviewProblem）。入口だけここと復習ノードの2系統
      '<div class="weak-card__cta-row"><a class="btn btn-sm btn-ghost weak-card__cta" href="study.html?review=1">練習する →</a></div>',
    ].join('');
    wrap.appendChild(card);
  });

  const hist = memory.history.slice().reverse();
  $('history-empty').style.display = hist.length ? 'none' : 'block';
  $('full-history').innerHTML = hist
    .map((h) => {
      const tags = (h.tags || []).map((t) => TAG_LABELS[t] || t).join('、');
      return `<span class="h-item"><span class="h-dot ${h.passed ? 'ok' : 'ng'}"></span>`
        + `${h.problemTitle}${tags ? `<span class="h-tags">（苦手: ${tags}）</span>` : ''}`
        + `<span class="h-date">${fmtDate(h.ts)}</span></span>`;
    })
    .join('');
};

// このページを初めて開いたときだけ出す案内
const NOTEBOOK_TOUR_SEEN_KEY = 'notebookTourSeen';

const NOTEBOOK_TOUR_STEPS = [
  {
    target: '#progress',
    text: 'ここが「記録・進捗」のページです。クリアした単元の数、いま覚えている苦手の数、挑戦した回数がひと目で分かります。',
  },
  {
    target: '#weak-section',
    text: 'AIが見つけた「いまのつまずき」がここに並びます。カードの「練習する →」から、その苦手だけを狙った復習問題に挑戦できます。',
  },
  {
    target: '#history',
    text: 'ここを開くと、いままで解いた問題を全部さかのぼって見られます。',
  },
  {
    // 「記憶をぜんぶリセットする」ボタンは誤タップで消してしまうと危ないので、
    // ここだけは対象を指さず文章だけで説明する（押させない）
    text: '苦手ノートの下には「記憶をぜんぶリセットする」ボタンもあります。使い方に迷ったとき以外は押さなくて大丈夫です。',
    buttonLabel: 'とじる',
  },
];

const maybeStartNotebookTour = () => {
  // 初めてこのページを開いたときだけ、自動で案内を始める
  let seen = false;
  try {
    seen = localStorage.getItem(NOTEBOOK_TOUR_SEEN_KEY) === '1';
    if (!seen) localStorage.setItem(NOTEBOOK_TOUR_SEEN_KEY, '1');
  } catch { /* localStorageが使えない環境では案内を出さないだけ */ }
  if (seen || typeof window.startSpotlightTour !== 'function') return;
  // 苦手カードの中身が埋まってから測りたい。先に出すと枠が内容量でずれる
  requestAnimationFrame(() => window.startSpotlightTour(NOTEBOOK_TOUR_STEPS));
};

const init = async () => {
  const state = await getState();
  renderNotebook(state);

  setHistoryOpen(localStorage.getItem(HISTORY_OPEN_KEY) === '1');
  $('history-toggle').addEventListener('click', () => {
    setHistoryOpen($('history-panel-body').hidden);
  });
  if (location.hash === '#history') setHistoryOpen(true);

  $('reset-btn').addEventListener('click', async () => {
    if (!confirm('苦手ノートと学習のあゆみをすべて消します。よろしいですか？')) return;
    const r = await postJson('/api/reset');
    renderNotebook({ problems: state.problems, memory: r.memory });
    $('reset-status').textContent = '記憶をリセットしました。';
  });

  maybeStartNotebookTour();
};

window.onAuthReady = () => {
  init().catch((e) => { $('reset-status').textContent = `エラー: ${e.message}`; });
};
