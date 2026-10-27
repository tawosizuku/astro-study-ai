// 全ページ共通: Googleログインのゲート・ヘッダーのユーザー表示・ログアウト。
// ページ側は window.onAuthReady にコールバックを登録しておくと、ログイン確認後に呼ばれる
// （common.js の次、ページ固有スクリプトの前に読み込む）
//
// 注意: Cross-Origin-Opener-Policy: same-origin が付いているページでGoogleログインの
// ポップアップを開くと、ポップアップがopener側と通信できず画面が真っ白になる不具合が実機で
// 確認された。そのため下の start() は window.crossOriginIsolated を見て、COOPが付いている
// ページでは login.html に一度移動してログインさせてから元のページへ戻す。
// ※ 2026-10-27に実行プレビュー(WebContainer)を廃止したため、現在COOPを付けているページは
//   無く、この分岐は実質使われない。将来また必要になったときのために残してある。

const injectGsiScript = () => new Promise((resolve, reject) => {
  if (window.google && window.google.accounts) { resolve(); return; }
  const s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client';
  s.async = true;
  s.defer = true;
  s.onload = () => resolve();
  s.onerror = () => reject(new Error('Googleログインの読み込みに失敗しました'));
  document.head.appendChild(s);
});

const buildGate = () => {
  const gate = document.createElement('div');
  gate.id = 'auth-gate';
  gate.className = 'auth-gate';
  gate.innerHTML = [
    '<div class="auth-gate-card">',
    '<span class="brand-mark" aria-hidden="true"></span>',
    '<h1>Astro学習支援AI</h1>',
    '<p>学習の記録はGoogleアカウントごとに保存されます。ログインして始めましょう。</p>',
    '<p class="auth-gate-note">はじめての方も同じボタンから始められます（アカウントは自動で作成されます）。</p>',
    '<div class="auth-gate-btn" id="google-signin-button"></div>',
    '<div class="auth-gate-divider" id="auth-gate-divider"><span>または</span></div>',
    '<div class="auth-gate-guest">',
    '<input class="auth-gate-name-input" id="guest-name-input" type="text" placeholder="名前（省略可）" maxlength="50" autocomplete="off" />',
    '<button class="btn btn-ghost auth-gate-guest-btn" id="guest-start-btn">このまま始める</button>',
    '</div>',
    '<div class="auth-gate-error" id="auth-gate-error"></div>',
    '</div>',
  ].join('');
  document.body.appendChild(gate);
  return gate;
};

const buildAuthArea = (user) => {
  const topbar = document.querySelector('.topbar');
  if (!topbar || topbar.querySelector('.auth-area')) return;
  const area = document.createElement('div');
  area.className = 'auth-area';
  const label = user.email || user.displayName || 'ログイン中';
  area.innerHTML = `<span class="auth-user">${label}</span><button class="btn-quiet" id="logout-btn">ログアウト</button>`;
  topbar.appendChild(area);
  area.querySelector('#logout-btn').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    location.reload();
  });
};

// ログインゲートを表示し、Googleログインボタンを描画する。成功したら onSuccess(user) を呼ぶ
// （通常ページでは中身を表示するのに使い、login.html では元のページへのリダイレクトに使う）
const showGate = async (googleClientId, onSuccess) => {
  buildGate();
  const errEl = document.getElementById('auth-gate-error');

  const dismissGate = (user) => {
    const gate = document.getElementById('auth-gate');
    if (gate) gate.remove();
    onSuccess(user);
  };

  // ゲスト（名前入力）ログイン
  const guestBtn = document.getElementById('guest-start-btn');
  const nameInput = document.getElementById('guest-name-input');
  if (guestBtn) {
    const startGuest = async () => {
      guestBtn.disabled = true;
      try {
        const displayName = (nameInput?.value || '').trim();
        const res = await fetch('/api/auth/guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayName }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `ログインに失敗しました（${res.status}）`);
        dismissGate(data.user);
      } catch (e) {
        if (errEl) errEl.textContent = e.message;
        guestBtn.disabled = false;
      }
    };
    guestBtn.addEventListener('click', startGuest);
    nameInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') startGuest(); });
  }

  // Google ログイン
  if (!googleClientId) {
    // GOOGLE_CLIENT_ID 未設定時は Google ボタンと区切りを非表示にする
    const btn = document.getElementById('google-signin-button');
    const divider = document.getElementById('auth-gate-divider');
    const note = document.querySelector('.auth-gate-note');
    if (btn) btn.style.display = 'none';
    if (divider) divider.style.display = 'none';
    if (note) note.style.display = 'none';
    return;
  }
  const onCredential = async (response) => {
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `ログインに失敗しました（${res.status}）`);
      dismissGate(data.user);
    } catch (e) {
      if (errEl) errEl.textContent = `ログインに失敗しました: ${e.message}`;
    }
  };
  try {
    await injectGsiScript();
    // use_fedcm_for_button: ブラウザ標準のアカウント選択UI（FedCM）を使わせる。
    // 従来のポップアップ方式だと、ログイン成功後もウィンドウが自動で閉じずに残ることがあったため
    window.google.accounts.id.initialize({ client_id: googleClientId, callback: onCredential, use_fedcm_for_button: true });
    window.google.accounts.id.renderButton(document.getElementById('google-signin-button'), {
      theme: 'outline', size: 'large', text: 'signin_with', locale: 'ja',
    });
  } catch (e) {
    if (errEl) errEl.textContent = e.message;
  }
};

// login.html は自分自身の起動スクリプト（login.js）を持つので、ここでは自動起動しない
if (location.pathname !== '/login.html') {
  (async () => {
    const [configRes, meRes] = await Promise.all([fetch('/api/config'), fetch('/api/me')]);
    const config = await configRes.json();
    const me = await meRes.json();
    if (me.user) {
      buildAuthArea(me.user);
      if (window.onAuthReady) window.onAuthReady();
      return;
    }
    if (window.crossOriginIsolated) {
      // COOPが付いているページ（study.html）はポップアップと相性が悪いので、
      // COOPの無い login.html でログインさせてから戻ってくる
      location.href = `/login.html?return=${encodeURIComponent(location.pathname + location.search)}`;
      return;
    }
    await showGate(config.googleClientId, (user) => {
      buildAuthArea(user);
      if (window.onAuthReady) window.onAuthReady();
    });
  })();
}
