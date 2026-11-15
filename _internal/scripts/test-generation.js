#!/usr/bin/env node
// 類題生成AIの回帰テスト。
// いくつかの「弱点履歴」パターンについて実際にAIに類題を生成させ、
// スキーマ・targetTagsの妥当性・answerPatternsの有無を機械的にチェックする。
// CIではなく、ローカルで `npm run test:generation` として都度実行する運用を想定
// （サーバー常時稼働を前提にしない。プロトタイプREADME参照）。
//
// 使い方: 環境変数 GEMINI_API_KEY を設定して
//     GEMINI_API_KEY=xxxx npm run test:generation

const { generateWithRetry } = require('../public/prompts.js');

const GEMINI_MODEL = process.env.TEST_GEN_GEMINI_MODEL || 'gemini-3.6-flash';

// study.js の onNext と同じ形式で「弱点履歴」の user プロンプトを組み立てる
const buildUser = (fixture) => {
  const summary = fixture.weaknesses
    .map((w) => `- ${w.tag}（重要度${w.importance.toFixed(1)}、記録${w.count}回、最終確認${w.seenAgo}）: ${w.note}`)
    .join('\n');
  return `# 学習者の弱点履歴（回数の多い順）\n${summary}\n\n# 直近の学習履歴\n（履歴なし）`;
};

const FIXTURES = [
  {
    name: '単一タグ（css）',
    weakTags: ['css'],
    weaknesses: [{ tag: 'css', importance: 3.0, count: 3, seenAgo: '今日', note: 'セレクタの書き方を間違えていた' }],
  },
  {
    name: '複数タグ（frontmatter + template-expression）',
    weakTags: ['frontmatter', 'template-expression'],
    weaknesses: [
      { tag: 'frontmatter', importance: 2.5, count: 3, seenAgo: '1日前', note: '---を書き忘れていた' },
      { tag: 'template-expression', importance: 2.0, count: 2, seenAgo: '2日前', note: '波かっこを使えていなかった' },
    ],
  },
  {
    name: '珍しいタグ（content-collections）',
    weakTags: ['content-collections'],
    weaknesses: [{ tag: 'content-collections', importance: 1.0, count: 1, seenAgo: '5日前', note: 'getCollectionの使い方を間違えていた' }],
  },
];

const parseJsonLoose = (text) => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('AIの出力からJSONを読み取れませんでした: ' + text.slice(0, 200));
  return JSON.parse(text.slice(start, end + 1));
};

const callGemini = async (system, user) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('環境変数 GEMINI_API_KEY が設定されていません');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gemini APIエラー: ${res.status} ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Geminiから回答を取得できませんでした（安全フィルタ等の可能性）');
  return parseJsonLoose(text);
};

const main = async () => {
  console.log(`[test:generation] provider=gemini model=${GEMINI_MODEL}`);
  let failCount = 0;
  for (const fixture of FIXTURES) {
    process.stdout.write(`- ${fixture.name} ... `);
    // 本番（study.jsのonNext）と同じ generateWithRetry を使う（1回だけ自動リトライする）
    const { generated, errors } = await generateWithRetry(callGemini, buildUser(fixture), fixture.weakTags);
    if (errors.length) {
      failCount += 1;
      console.log('FAIL');
      errors.forEach((e) => console.log(`    - ${e}`));
      if (generated) console.log(`    生成結果: ${JSON.stringify(generated).slice(0, 300)}`);
    } else {
      console.log(`OK（targetTags: ${generated.targetTags.join(', ')} / answerPatterns: ${generated.answerPatterns.length}件）`);
    }
  }
  console.log(`\n${FIXTURES.length - failCount}/${FIXTURES.length} 件パス`);
  process.exit(failCount ? 1 : 0);
};

if (require.main === module) {
  main();
}

module.exports = { FIXTURES, buildUser };
