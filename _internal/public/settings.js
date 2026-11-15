// 設定ページ: Gemini APIキーの確認・削除、Claude Code連携の自動検知・再チェック
// どちらも学習画面(study.js)と同じlocalStorageキー（geminiKey / useClaude）を見ているので、
// ここで変えると次に学習画面を開いたときにそのまま反映される

const renderGeminiKey = () => {
  const saved = localStorage.getItem('geminiKey') || '';
  $('settings-gemini-key').value = saved;
  $('gemini-key-status').textContent = saved ? '保存済みのキーがあります。' : 'まだキーが保存されていません。';
};

const setupGeminiSection = () => {
  renderGeminiKey();
  $('settings-gemini-key').addEventListener('change', () => {
    localStorage.setItem('geminiKey', $('settings-gemini-key').value);
    $('gemini-key-status').textContent = '保存しました。';
  });
  $('gemini-key-toggle').addEventListener('click', () => {
    const input = $('settings-gemini-key');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    $('gemini-key-toggle').textContent = show ? '隠す' : '表示';
  });
  $('gemini-key-clear').addEventListener('click', () => {
    localStorage.removeItem('geminiKey');
    renderGeminiKey();
    $('gemini-key-status').textContent = '削除しました。';
  });
};

const renderClaudeStatus = (status) => {
  const info = describeClaudeStatus(status);
  const box = $('claude-status');
  box.className = `claude-status claude-status--${info.ok ? 'ok' : 'err'}`;
  $('claude-status-text').textContent = info.text;

  const toggle = $('settings-use-claude');
  toggle.disabled = !info.ok;
  if (!info.ok) toggle.checked = false;
};

const setupClaudeSection = async () => {
  try { $('settings-use-claude').checked = localStorage.getItem('useClaude') === '1'; } catch { /* ignore */ }
  $('settings-use-claude').addEventListener('change', () => {
    localStorage.setItem('useClaude', $('settings-use-claude').checked ? '1' : '');
  });

  let guide = null;
  const check = async () => {
    $('claude-status').className = 'claude-status claude-status--pending';
    $('claude-status-text').textContent = '確認中…';
    const status = await fetchClaudeStatus();
    renderClaudeStatus(status);
    if (guide) guide.update(status);
    else guide = mountClaudeSetupGuide($('claude-setup-guide'), status, renderClaudeStatus);
  };
  $('claude-recheck-btn').addEventListener('click', check);
  await check();
};

window.onAuthReady = () => {
  setupGeminiSection();
  setupClaudeSection();
};
