// ホーム画面のミニツアー（汎用パーツ）。
//
// 方式: 対象要素の四辺を4枚の暗幕パネルで囲み、対象だけを光らせる「スポットライト」型。
// よくある「対象のz-indexを上げて暗幕の上に出す」方式は採らない。.hub-card は z-index:1 を持ち
// ::before に filter:blur() があるため重ね合わせ文脈（stacking context）が生まれており、
// z-index を上げても body 直下の暗幕より前に出られない恐れがあるため。
// この方式なら対象の上に何も重ねないので、クリックがそのまま本来の要素へ届く。
(() => {
  const PAD = 10; // 光らせる枠の、対象要素からの余白

  let state = null; // { steps, index, cleanupTarget }

  const onReflow = () => { if (state) renderStep(); };

  const clearOverlay = () => {
    document.querySelectorAll('.tour-panel, .tour-ring, .tour-caption').forEach((el) => el.remove());
  };

  const nudge = () => {
    const ring = document.querySelector('.tour-ring');
    if (!ring) return;
    ring.classList.remove('is-nudge');
    // クラスを外した直後に付け直さないとアニメーションが再生されない
    void ring.offsetWidth;
    ring.classList.add('is-nudge');
  };

  // 画面に出ていて、面積があるか。hidden や display:none の要素を対象にすると
  // getBoundingClientRect() が全部ゼロになり、暗幕が画面全体を覆って操作不能になる
  const isVisible = (el) => {
    if (!el || el.hidden) return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
  };

  // 対象の四辺を覆う4枚。上下は全幅、左右は対象の高さぶんだけ。
  // これで四隅まで隙間なく覆え、対象の矩形だけがくり抜かれる
  const panelsFor = (rect) => {
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const top = rect.top - PAD;
    const bottom = rect.bottom + PAD;
    return [
      { top: 0, left: 0, width: vw, height: Math.max(0, top) },
      { top: Math.max(0, bottom), left: 0, width: vw, height: Math.max(0, vh - bottom) },
      { top: Math.max(0, top), left: 0, width: Math.max(0, rect.left - PAD), height: Math.max(0, bottom - top) },
      { top: Math.max(0, top), left: rect.right + PAD, width: Math.max(0, vw - rect.right - PAD), height: Math.max(0, bottom - top) },
    ];
  };

  const placeCaption = (caption, rect) => {
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const cw = caption.offsetWidth;
    const ch = caption.offsetHeight;
    let top;
    let left;
    if (rect) {
      // 下に入りきるなら下、無理なら上。どちらも無理なら画面内に収める
      const below = rect.bottom + PAD + 14;
      top = below + ch <= vh - 14 ? below : rect.top - PAD - 14 - ch;
      top = Math.min(Math.max(14, top), Math.max(14, vh - ch - 14));
      left = Math.min(Math.max(14, rect.left), Math.max(14, vw - cw - 14));
    } else {
      top = Math.max(14, (vh - ch) / 2);
      left = Math.max(14, (vw - cw) / 2);
    }
    caption.style.top = `${top}px`;
    caption.style.left = `${left}px`;
  };

  const advance = () => {
    if (!state) return;
    if (state.cleanupTarget) { state.cleanupTarget(); state.cleanupTarget = null; }
    state.index += 1;
    renderStep();
  };

  function renderStep() {
    if (!state) return;
    if (state.cleanupTarget) { state.cleanupTarget(); state.cleanupTarget = null; }

    // 対象が無い・見えないステップは飛ばす。画面の出し分けで消えている要素を
    // 指したまま進むと、何も見えない暗転だけが残ってしまう
    while (state.index < state.steps.length) {
      const s = state.steps[state.index];
      if (!s.target || isVisible(document.querySelector(s.target))) break;
      state.index += 1;
    }
    if (state.index >= state.steps.length) { finish(); return; }

    clearOverlay();
    const step = state.steps[state.index];
    const targetEl = step.target ? document.querySelector(step.target) : null;
    let rect = targetEl ? targetEl.getBoundingClientRect() : null;

    // 画面の外にあるなら、先に見える位置へ運んでから測り直す
    if (rect && (rect.top < PAD || rect.bottom > document.documentElement.clientHeight - PAD)) {
      targetEl.scrollIntoView({ block: 'center', behavior: 'instant' });
      rect = targetEl.getBoundingClientRect();
    }

    if (rect) {
      panelsFor(rect).forEach((p) => {
        if (p.width <= 0 || p.height <= 0) return;
        const panel = document.createElement('div');
        panel.className = 'tour-panel';
        Object.assign(panel.style, {
          top: `${p.top}px`, left: `${p.left}px`, width: `${p.width}px`, height: `${p.height}px`,
        });
        panel.addEventListener('click', nudge);
        document.body.appendChild(panel);
      });
      const ring = document.createElement('div');
      ring.className = 'tour-ring';
      Object.assign(ring.style, {
        top: `${rect.top - PAD}px`, left: `${rect.left - PAD}px`,
        width: `${rect.width + PAD * 2}px`, height: `${rect.height + PAD * 2}px`,
      });
      document.body.appendChild(ring);
    } else {
      const panel = document.createElement('div');
      panel.className = 'tour-panel';
      Object.assign(panel.style, { top: '0', left: '0', width: '100%', height: '100%' });
      document.body.appendChild(panel);
    }

    const caption = document.createElement('div');
    caption.className = 'tour-caption';

    const head = document.createElement('p');
    head.className = 'tour-caption__step';
    head.textContent = `${state.index + 1} / ${state.steps.length}`;
    caption.appendChild(head);

    const text = document.createElement('p');
    text.className = 'tour-caption__text';
    text.textContent = step.text;
    caption.appendChild(text);

    if (targetEl) {
      const hint = document.createElement('p');
      hint.className = 'tour-caption__hint';
      hint.textContent = '光っているところをクリックすると、つぎへ進みます';
      caption.appendChild(hint);
      // blockDefault: リンクなど、押すと別ページへ飛ぶ要素。ツアー中は飛ばさず進むだけにする。
      // 付けない場合は本来の動作（例: エディターを開く）もそのまま起きる
      const handler = (e) => {
        if (step.blockDefault) { e.preventDefault(); e.stopPropagation(); }
        advance();
      };
      targetEl.addEventListener('click', handler, { once: true });
      state.cleanupTarget = () => targetEl.removeEventListener('click', handler);
    } else {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-primary tour-caption__btn';
      btn.textContent = step.buttonLabel || 'つぎへ';
      btn.addEventListener('click', advance);
      caption.appendChild(btn);
    }

    // 強制クリックの仕様上「つぎへ」は置かないが、詰まったときに出られないのは危ないので
    // 小さく逃げ道を用意する
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'tour-caption__skip';
    skip.textContent = 'ツアーをとばす';
    skip.addEventListener('click', finish);
    caption.appendChild(skip);

    document.body.appendChild(caption);
    placeCaption(caption, rect);
  }

  function finish() {
    clearOverlay();
    if (state && state.cleanupTarget) state.cleanupTarget();
    window.removeEventListener('resize', onReflow);
    window.removeEventListener('scroll', onReflow, true);
    document.removeEventListener('keydown', onKey);
    state = null;
  }

  function onKey(e) {
    if (e.key === 'Escape') finish();
  }

  window.startSpotlightTour = (steps) => {
    if (!steps || !steps.length) return;
    finish();
    state = { steps, index: 0, cleanupTarget: null };
    renderStep();
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    document.addEventListener('keydown', onKey);
  };
})();
