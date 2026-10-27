// エディターをどれで開くかのダイアログ。
//
// 自動で出すのは「エディターが1つも起動していないとき」だけ。ただし判定できるのは
// プロセスが動いているかまでで、*どのフォルダを開いているかは分からない*
// （macOSのVS Codeはプロセス引数にフォルダのパスを持たない）。別のプロジェクトを
// 開いていても「起動済み」になってしまう。開き直したいときはホーム画面の
// 「エディターで開く」から（あちらは /api/open-editor を直接叩く）。
(() => {
  const dialog = document.getElementById('editor-dialog');
  const vsBtn = document.getElementById('editor-vscode-btn');
  const cursorBtn = document.getElementById('editor-cursor-btn');
  if (!dialog || !vsBtn || !cursorBtn) return;

  const closeDialog = () => {
    dialog.classList.add('is-hidden');
    setTimeout(() => { dialog.hidden = true; dialog.classList.remove('is-hidden'); }, 300);
  };

  const openEditor = async (editor) => {
    closeDialog();
    try {
      await fetch('/api/open-editor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editor }),
      });
    } catch { /* ignore */ }
  };

  vsBtn.addEventListener('click', () => openEditor('vscode'));
  cursorBtn.addEventListener('click', () => openEditor('cursor'));

  const show = () => {
    dialog.hidden = false;
    requestAnimationFrame(() => dialog.classList.add('is-visible'));
  };

  fetch('/api/check-editor')
    .then((r) => r.json())
    .then(({ running }) => { if (!running) show(); })
    .catch(() => {});
})();
