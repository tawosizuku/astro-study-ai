// 出題AI（類題生成）のシステムプロンプト。
// ブラウザ（study.js）と、Node側の回帰テスト（scripts/test-generation.js）の両方から
// 同じ内容を共有して使う（プロンプトがずれると回帰テストの意味がなくなるため）

const GEN_SYSTEM = [
  'あなたはAstro（Webフレームワーク）の学習問題を作る出題AIです。',
  '渡される「学習者の弱点履歴」のうち、特に「重要度」が高い弱点を1〜2個狙った、新しいコーディング問題を1問だけ作ります。',
  '重要度は、記録回数が多いほど・最終確認が最近であるほど高くなる数値です（しばらく間違えていない弱点は自然に下がります）。単純な記録回数（回数）だけで選ばず、重要度が高い順を優先してください。',
  '学習者はHTMLとCSSしか知らない初心者です。問題文はやさしい日本語で書き、専門用語にはかならず（かんたんな説明）を添えます。',
  '難易度は初級。やることを番号付きで具体的に書き、最後にヒントを1つ添えます。',
  '制約1: 問題は必ずAstroの .astro ファイルを書く問題にします。HTML/CSSだけで完結する問題は作ってはいけません（学習者はHTML/CSSはすでに書けます）。',
  '制約2: targetTags には、渡された「弱点履歴」に出てきたタグだけを入れます。履歴にないタグを入れてはいけません。',
  '制約3: answerPatterns には、正しい解答コードに現れるはずの特徴的な一部分を、JavaScriptの正規表現（文字列）として2〜4個入れます。この問題の正解を見た人が「これは正解の一部を隠すためのパターンだ」とわかる粒度にしてください（例: 変数宣言の一部、特定のプロパティアクセスなど）。ヒント文の答え隠しに使うので、必ず生成してください。',
  '制約4: starter（雛形）は、1つのファイル src/pages/review.astro にそのまま貼れる、単体で表示できる小さなAstroページにします（必要なら先頭の `---`〜`---` フロントマターも含める）。別ファイルやコンポーネント分割は前提にせず、この1ファイルだけで完結させてください。',
  '必ず次のJSONだけを出力してください:',
  '{"title": "問題タイトル", "description": "問題文（やることを番号付きで）", "starter": "解答欄の雛形コード",',
  ' "checkpoints": ["評価の観点を2〜4個"], "targetTags": ["狙った弱点タグ"], "answerPatterns": ["正解の一部を隠すための正規表現（文字列）"]}',
  'tagは必ず次の中から選ぶ: frontmatter, template-expression, props, component-import, client-directive, layout-slot, content-collections, html-structure, css, js-basics, astro-syntax-other',
].join('\n');

const ALLOWED_TAGS = [
  'frontmatter', 'template-expression', 'props', 'component-import', 'client-directive',
  'layout-slot', 'content-collections', 'html-structure', 'css', 'js-basics', 'astro-syntax-other',
];

// 中国語混入の簡易検知: 自然な日本語の説明文には助詞・活用語尾のひらがな（またはカタカナ）が必ず混ざる。
// 漢字がまとまった量あるのにかな文字が一切無い場合は、中国語の文章が紛れ込んでいる可能性が高いと判定する
// （軽量モデルでまれに発生することが実測で分かっているため、決定的な層で検知してリトライに回す）
const looksChineseContaminated = (text) => {
  const s = text || '';
  const kanjiCount = (s.match(/[一-鿿㐀-䶿]/g) || []).length;
  const hasKana = /[぀-ヿ]/.test(s);
  return kanjiCount >= 8 && !hasKana;
};

// 生成結果のスキーマ・妥当性チェック（回帰テストと本番の両方で使う決定的ガード）
const validateGenerated = (generated, weakTags) => {
  const errors = [];
  if (typeof generated?.title !== 'string' || !generated.title.trim()) errors.push('title が文字列でない、または空');
  else if (looksChineseContaminated(generated.title)) errors.push('title に中国語混入の疑い（ひらがな無しの長い漢字列）');
  if (typeof generated?.description !== 'string' || !generated.description.trim()) errors.push('description が文字列でない、または空');
  else if (looksChineseContaminated(generated.description)) errors.push('description に中国語混入の疑い（ひらがな無しの長い漢字列）');
  if (typeof generated?.starter !== 'string') errors.push('starter が文字列でない');
  if (!Array.isArray(generated?.checkpoints) || generated.checkpoints.length === 0) {
    errors.push('checkpoints が空、または配列でない');
  } else {
    generated.checkpoints.forEach((c, i) => {
      if (typeof c === 'string' && looksChineseContaminated(c)) errors.push(`checkpoints[${i}] に中国語混入の疑い`);
    });
  }
  if (!Array.isArray(generated?.targetTags) || generated.targetTags.length === 0) {
    errors.push('targetTags が空、または配列でない');
  } else {
    const invalidTags = generated.targetTags.filter((t) => !ALLOWED_TAGS.includes(t));
    if (invalidTags.length) errors.push(`targetTags に許可外のタグが含まれる: ${invalidTags.join(', ')}`);
    if (!generated.targetTags.some((t) => weakTags.includes(t))) {
      errors.push(`targetTags（${generated.targetTags.join(', ')}）が要求した弱点タグ（${weakTags.join(', ')}）と一致しない`);
    }
  }
  if (!Array.isArray(generated?.answerPatterns) || generated.answerPatterns.length === 0) {
    errors.push('answerPatterns が空、または配列でない（ヒントの答えマスクが効かない）');
  } else {
    generated.answerPatterns.forEach((p, i) => {
      if (typeof p !== 'string') { errors.push(`answerPatterns[${i}] が文字列でない`); return; }
      try { new RegExp(p); } catch { errors.push(`answerPatterns[${i}] が不正な正規表現: ${p}`); }
    });
  }
  return errors;
};

// 注入対策の第2段検証: 採点AIが「合格」と判定した場合でも、学習者コードの中に
// AIへの指示を装う文言が含まれていないかを機械的に再チェックする（決定的ガード）。
// プロンプトの指示だけでは軽量モデルが従ってしまうことがあるため、二重に守る。
const INJECTION_PATTERNS = [
  /合格(に)?(して|にして|とみなして|判定)/,
  /passed\s*[:=]\s*true/i,
  /score\s*[:=]\s*100/i,
  /これ(は|が)模範解答/,
  /(システム|AI|先生|採点者)(から|への)?の?指示/,
  /ignore\s+(all\s+)?(the\s+)?(previous|above)\s+instructions/i,
  /you are (now\s+)?an?\s+(ai|assistant)/i,
  /上記(の)?(指示|プロンプト)(を)?無視/,
];

const detectInjectionAttempt = (code) => INJECTION_PATTERNS.some((re) => re.test(code || ''));

// 類題生成の呼び出し＋検証＋1回だけのリトライをまとめたもの。
// AIの出力がJSONとして壊れている場合（callLLMが例外を投げる場合）も、
// スキーマ不正のときと同じ扱いでリトライする。本番（study.js）と回帰テスト（scripts/test-generation.js）で共有し、
// 「本番はリトライする・テストはしない」のようなズレが起きないようにする。
// callLLM(system, user) は呼び出し側（ブラウザ/Node）が用意する
const generateWithRetry = async (callLLM, user, weakTags) => {
  const attempt = async (promptUser) => {
    try {
      const generated = await callLLM(GEN_SYSTEM, promptUser);
      return { generated, errors: validateGenerated(generated, weakTags) };
    } catch (e) {
      return { generated: null, errors: [`AIの出力の読み取りに失敗しました: ${e.message}`] };
    }
  };
  let result = await attempt(user);
  if (result.errors.length) {
    result = await attempt(
      `${user}\n\n# 注意（前回の生成の問題点）\n${result.errors.join('\n')}\ntargetTags には必ず上の弱点履歴にあるタグ（${weakTags.join(', ')}）だけを入れ、answerPatterns も忘れずに入れて、問題を作り直してください。`
    );
  }
  return result;
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GEN_SYSTEM, ALLOWED_TAGS, validateGenerated, detectInjectionAttempt, INJECTION_PATTERNS, generateWithRetry, looksChineseContaminated };
}
