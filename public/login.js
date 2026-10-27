// ログイン専用ページ（Cross-Origin-Opener-Policyを付けていないページ）。
// study.html等、COOPが付いているページから ?return=元のパス で飛んでくる。
// ログイン確認・成功後は return 先へ移動するだけで、このページ自体には中身が無い

const params = new URLSearchParams(location.search);
const returnTo = params.get('return') || '/index.html';

(async () => {
  const [configRes, meRes] = await Promise.all([fetch('/api/config'), fetch('/api/me')]);
  const config = await configRes.json();
  const me = await meRes.json();
  if (me.user) {
    location.href = returnTo;
    return;
  }
  await showGate(config.googleClientId, () => {
    location.href = returnTo;
  });
})();
