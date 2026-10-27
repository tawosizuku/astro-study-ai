// 展示の来場者数チェッカー（2026-10-09）
// server.js が書く exhibit-log.jsonl を読んで「何人が触ったか」を数える。
//   node scripts/exhibit-stats.js          … 今の集計を1回表示
//   node scripts/exhibit-stats.js --watch  … 1分ごとに読み直し、人が増えたら1行知らせる（裏で動かしっぱなし用）
// 数え方: boot/reset で区切った1回分に touch（VS Codeで保存した）か grade（採点した）があれば1人。
// 見ただけで何も保存しなかった人は数えられない
const fs = require('fs');
const path = require('path');

const LOG_PATH = path.join(__dirname, '..', 'exhibit-log.jsonl');

const readEvents = () => {
  if (!fs.existsSync(LOG_PATH)) return [];
  return fs.readFileSync(LOG_PATH, 'utf8').split('\n').filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
};

const summarize = (events) => {
  const visitors = [];
  let cur = null;
  const close = (endReason) => {
    if (cur && (cur.touched || cur.grades.length || cur.reviewGrades.length)) visitors.push({ ...cur, endReason });
    cur = null;
  };
  for (const e of events) {
    if (e.event === 'boot' || e.event === 'reset') { close(e.event === 'boot' ? 'server-restart' : e.reason); continue; }
    if (!cur) cur = { start: e.ts, touched: false, grades: [], reviewGrades: [] };
    if (e.event === 'touch') cur.touched = true;
    // 苦手問題（review）の採点は、展示の問題の合否とは分けて数える
    if (e.event === 'grade') (e.review ? cur.reviewGrades : cur.grades).push(!!e.passed);
  }
  const inProgress = cur && (cur.touched || cur.grades.length || cur.reviewGrades.length) ? cur : null;
  const all = inProgress ? [...visitors, { ...inProgress, endReason: 'in-progress' }] : visitors;

  const graded = all.filter((v) => v.grades.length);
  const reviewed = all.filter((v) => v.reviewGrades.length);
  const reviewPassed = all.filter((v) => v.reviewGrades.includes(true));
  const passed = all.filter((v) => v.grades.includes(true));
  const byHour = {};
  for (const v of all) {
    const d = new Date(v.start);
    const h = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}時台`;
    byHour[h] = (byHour[h] || 0) + 1;
  }
  const ends = {};
  for (const v of visitors) ends[v.endReason] = (ends[v.endReason] || 0) + 1;
  return {
    visitors: all.length,
    inProgress: !!inProgress,
    graded: graded.length,
    passed: passed.length,
    reviewed: reviewed.length,
    reviewPassed: reviewPassed.length,
    submissions: all.reduce((n, v) => n + v.grades.length + v.reviewGrades.length, 0),
    byHour,
    ends,
    lastActivity: events.filter((e) => e.event === 'touch' || e.event === 'grade').at(-1)?.ts || null,
  };
};

const fmt = (s) => {
  const t = (iso) => (iso ? new Date(iso).toLocaleTimeString('ja-JP') : '—');
  const pct = s.graded ? Math.round((s.passed / s.graded) * 100) : 0;
  const endLabel = { 'next-button': '次の人へ', idle: '放置リセット', url: 'URLリセット', 'server-restart': 'サーバー再起動', unknown: '不明' };
  return [
    `=== 展示チェッカー ${new Date().toLocaleString('ja-JP')} ===`,
    `触った人: ${s.visitors}人${s.inProgress ? '（うち1人は今さわっている途中）' : ''}`,
    `採点まで行った人: ${s.graded}人 / 合格した人: ${s.passed}人（${pct}%）/ 採点の合計: ${s.submissions}回`,
    `苦手問題に挑戦した人: ${s.reviewed}人 / そのうち合格: ${s.reviewPassed}人`,
    `終わり方: ${Object.entries(s.ends).map(([k, n]) => `${endLabel[k] || k} ${n}`).join('・') || '—'}`,
    `時間帯別: ${Object.entries(s.byHour).map(([h, n]) => `${h} ${n}人`).join('・') || '—'}`,
    `最後の操作: ${t(s.lastActivity)}`,
  ].join('\n');
};

if (process.argv.includes('--watch')) {
  let prev = null;
  const tick = () => {
    const s = summarize(readEvents());
    if (!prev) console.log(fmt(s));
    else if (s.visitors !== prev.visitors || s.submissions !== prev.submissions) {
      console.log(`[${new Date().toLocaleTimeString('ja-JP')}] 触った人 ${s.visitors}人・採点 ${s.graded}人・合格 ${s.passed}人・苦手問題 ${s.reviewed}人`);
    }
    prev = s;
  };
  tick();
  setInterval(tick, 60 * 1000);
} else {
  console.log(fmt(summarize(readEvents())));
}
