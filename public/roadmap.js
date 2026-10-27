// 学習の道のり: 10ステップのくねくね道（Figmaデザインに準拠したジグザグパス）
// ロックは見た目のみ。現状どおり、どのステップも study.html?unit=<id> に直接遷移できる
//
// レイアウトは仮想キャンバス幅1000・高さ可変(単位: デザイン単位)で組み立て、
// #story-path 側で container-type:inline-size を使い cqw/cqh で実際の画面幅にスケールする。
// ノード間の縦の間隔は Y_STEP、横位置は左右交互（最初と最後だけ中央）。接続線はノード中心を
// つなぐ3次ベジェ曲線をFigmaの描画式（制御点=両端の中点の高さ）でそのまま再現している。

const Y_START = 110;
const Y_STEP = 190;
const Y_PAD_BOTTOM = 220; // 最後のノードのラベルが下で切れないための余白（吹き出しは廃止済み）
const COL_X = { left: 220, center: 400, right: 580 };

const ICONS = {
  check: 'assets/icons/icon-check.svg',
  star: 'assets/icons/icon-star.svg',
  lock: 'assets/icons/icon-lock.svg',
};

const columnFor = (index, total) => {
  if (index === 0 || index === total - 1) return 'center';
  return index % 2 === 1 ? 'left' : 'right';
};

const buildEntries = (problems, memory) => {
  const cleared = new Set(memory.progress?.clearedIds || []);
  const firstUnclearedIndex = problems.findIndex((p) => !cleared.has(p.id));

  const entries = [];
  problems.forEach((p, i) => {
    const isCleared = cleared.has(p.id);
    const isCurrent = !isCleared && i === firstUnclearedIndex;
    const isStandalone = !!p.standalone;
    entries.push({
      kind: isCleared ? 'done' : (isCurrent || isStandalone) ? 'current' : 'locked',
      id: p.id,
      title: p.title,
      href: `study.html?unit=${encodeURIComponent(p.id)}`,
    });
  });

  return entries;
};

const buildConnectorPath = (points) => {
  if (points.length < 2) return '';
  let d = `M${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const midY = (a.y + b.y) / 2;
    d += `C${a.x} ${midY} ${b.x} ${midY} ${b.x} ${b.y}`;
  }
  return d;
};

const nodeDot = (state) => {
  if (state === 'done') return { bg: null, icon: ICONS.check };
  if (state === 'current') return { bg: null, icon: ICONS.star };
  if (state === 'review') return { bg: null, icon: null, glyph: '◆' };
  return { bg: null, icon: ICONS.lock };
};

const renderRoadmap = (state) => {
  const { problems, memory } = state;
  const entries = buildEntries(problems, memory);
  const total = entries.length;
  const totalUnits = Y_START + Math.max(0, total - 1) * Y_STEP + Y_PAD_BOTTOM;

  const path = $('story-path');
  // --units は .story-path-wrap の aspect-ratio が読む。CSSカスタムプロパティは下へしか
  // 継承しないので、子の #story-path に挿しても親は見えずフォールバック(1420)のままになる。
  // そのせいでキャンバスが必要な高さの36%に潰れ、ノードの縦間隔がドット径より狭くなって
  // ラベルが下のノードに隠れていた（2026-10-26修正）。親に挿せば子にも継承される
  (path.closest('.story-path-wrap') || path).style.setProperty('--units', String(totalUnits));
  path.innerHTML = '';

  // 接続線（ノード中心をつなぐ点線カーブ）
  const centers = entries.map((_, i) => {
    const col = columnFor(i, total);
    return { x: COL_X[col], y: Y_START + i * Y_STEP };
  });
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('class', 'story-path__connector');
  svg.setAttribute('viewBox', `0 0 1000 ${totalUnits}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  const svgPath = document.createElementNS(svgNs, 'path');
  svgPath.setAttribute('d', buildConnectorPath(centers));
  svgPath.setAttribute('fill', 'none');
  svgPath.setAttribute('stroke', '#c7cbdb');
  svgPath.setAttribute('stroke-width', '5');
  svgPath.setAttribute('stroke-linecap', 'round');
  svgPath.setAttribute('stroke-dasharray', '2 16');
  svg.appendChild(svgPath);
  path.appendChild(svg);

  entries.forEach((entry, i) => {
    const { x, y } = centers[i];
    const state = entry.kind;

    const li = document.createElement('li');
    li.className = 'story-path__node';
    li.dataset.state = state;
    li.style.left = `${x / 10}cqw`;
    li.style.top = `${(y / totalUnits) * 100}cqh`;

    const dotInfo = nodeDot(state);
    const dotInner = dotInfo.icon
      ? `<img src="${dotInfo.icon}" alt="" />`
      : dotInfo.glyph
        ? `<span aria-hidden="true" style="color:#fff;font-size:12px;">${dotInfo.glyph}</span>`
        : '';

    const isInteractive = state !== 'locked';

    li.innerHTML = [
      `<span class="story-path__node-dot">${dotInner}</span>`,
      `<span class="story-path__node-label">${entry.title}</span>`,
    ].join('');

    if (isInteractive) {
      li.addEventListener('click', () => { location.href = entry.href; });
      li.style.cursor = 'pointer';
    }

    path.appendChild(li);
  });
};

let _state = null;
let _activePhase = '';

const renderRoadmapFiltered = () => {
  if (!_state) return;
  const filtered = _activePhase
    ? { ..._state, problems: _state.problems.filter((p) => p.phase === _activePhase) }
    : _state;
  renderRoadmap(filtered);
};

window.onAuthReady = () => {
  getState().then((state) => {
    _state = state;
    renderRoadmapFiltered();
  });

  document.getElementById('section-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.section-tab');
    if (!btn) return;
    document.querySelectorAll('.section-tab').forEach((b) => {
      b.classList.toggle('is-active', b === btn);
      b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
    });
    _activePhase = btn.dataset.phase;
    renderRoadmapFiltered();
  });
};
