// SQLite永続化層（Node組み込みの node:sqlite を使用。追加依存なし）
// P2でユーザーごとのデータ分離に対応: weaknesses/history/progress は
// すべて user_id で紐づく（Googleアカウント単位）
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const ROOT = __dirname;
const DB_PATH = path.join(ROOT, 'data.db');
const LEGACY_MEMORY_PATH = path.join(ROOT, 'memory.json');
const LEGACY_LOCAL_GOOGLE_SUB = 'legacy-local-user';

const db = new DatabaseSync(DB_PATH);

const hasUserIdColumn = (table) => {
  const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(table);
  if (!exists) return true; // テーブルが無ければこれから新スキーマで作るので問題なし
  return db.prepare(`PRAGMA table_info(${table})`).all().some((col) => col.name === 'user_id');
};

// P1時代（ユーザー区別なし）のweaknesses/history/progressが残っていれば、
// 「ローカルの記録」という1人分のユーザーとして引き継ぐ（データを黙って消さない）
const migrateSingleUserSchemaIfNeeded = () => {
  const needsMigration = !hasUserIdColumn('weaknesses') || !hasUserIdColumn('history') || !hasUserIdColumn('progress');
  if (!needsMigration) return;

  db.exec('BEGIN');
  try {
    const oldWeaknesses = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='weaknesses'").get()
      ? db.prepare('SELECT * FROM weaknesses').all() : [];
    const oldHistory = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='history'").get()
      ? db.prepare('SELECT * FROM history').all() : [];
    const oldProgress = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='progress'").get()
      ? db.prepare('SELECT * FROM progress').all() : [];
    const hasLegacyData = oldWeaknesses.length || oldHistory.length || oldProgress.length;

    db.exec('DROP TABLE IF EXISTS weaknesses; DROP TABLE IF EXISTS history; DROP TABLE IF EXISTS progress;');
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        google_sub TEXT UNIQUE NOT NULL,
        email TEXT,
        display_name TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE weaknesses (
        user_id INTEGER NOT NULL,
        tag TEXT NOT NULL,
        count INTEGER NOT NULL,
        last_seen TEXT,
        notes_json TEXT NOT NULL DEFAULT '[]',
        PRIMARY KEY (user_id, tag)
      );
      CREATE TABLE history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        ts TEXT NOT NULL,
        problem_title TEXT,
        passed INTEGER NOT NULL,
        tags_json TEXT NOT NULL DEFAULT '[]'
      );
      CREATE TABLE progress (
        user_id INTEGER NOT NULL,
        problem_id TEXT NOT NULL,
        cleared_at TEXT NOT NULL,
        PRIMARY KEY (user_id, problem_id)
      );
    `);

    if (hasLegacyData) {
      db.prepare('INSERT INTO users (google_sub, email, display_name, created_at) VALUES (?, ?, ?, ?)')
        .run(LEGACY_LOCAL_GOOGLE_SUB, null, '(ログイン導入前の記録)', new Date().toISOString());
      const legacyUserId = db.prepare('SELECT id FROM users WHERE google_sub = ?').get(LEGACY_LOCAL_GOOGLE_SUB).id;
      const insertW = db.prepare('INSERT INTO weaknesses (user_id, tag, count, last_seen, notes_json) VALUES (?, ?, ?, ?, ?)');
      oldWeaknesses.forEach((w) => insertW.run(legacyUserId, w.tag, w.count, w.last_seen, w.notes_json));
      const insertH = db.prepare('INSERT INTO history (user_id, ts, problem_title, passed, tags_json) VALUES (?, ?, ?, ?, ?)');
      oldHistory.forEach((h) => insertH.run(legacyUserId, h.ts, h.problem_title, h.passed, h.tags_json));
      const insertP = db.prepare('INSERT INTO progress (user_id, problem_id, cleared_at) VALUES (?, ?, ?)');
      oldProgress.forEach((p) => insertP.run(legacyUserId, p.problem_id, p.cleared_at));
      console.log(`ログイン導入前のデータ（弱点${oldWeaknesses.length}件・履歴${oldHistory.length}件・クリア${oldProgress.length}件）を「ログイン導入前の記録」ユーザーへ引き継ぎました`);
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
};

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_sub TEXT UNIQUE NOT NULL,
    email TEXT,
    display_name TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS weaknesses (
    user_id INTEGER NOT NULL,
    tag TEXT NOT NULL,
    count INTEGER NOT NULL,
    last_seen TEXT,
    notes_json TEXT NOT NULL DEFAULT '[]',
    PRIMARY KEY (user_id, tag)
  );
  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ts TEXT NOT NULL,
    problem_title TEXT,
    passed INTEGER NOT NULL,
    tags_json TEXT NOT NULL DEFAULT '[]'
  );
  CREATE TABLE IF NOT EXISTS progress (
    user_id INTEGER NOT NULL,
    problem_id TEXT NOT NULL,
    cleared_at TEXT NOT NULL,
    PRIMARY KEY (user_id, problem_id)
  );
`);

migrateSingleUserSchemaIfNeeded();

// 初回起動時のみ: data.db がまっさらで、旧 memory.json が残っていれば
// 「ログイン導入前の記録」ユーザーとして一度だけ取り込む
const migrateLegacyMemoryIfNeeded = () => {
  const isEmpty = db.prepare('SELECT COUNT(*) AS n FROM history').get().n === 0
    && db.prepare('SELECT COUNT(*) AS n FROM weaknesses').get().n === 0
    && db.prepare('SELECT COUNT(*) AS n FROM progress').get().n === 0
    && db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0;
  if (!isEmpty || !fs.existsSync(LEGACY_MEMORY_PATH)) return;
  try {
    const legacy = JSON.parse(fs.readFileSync(LEGACY_MEMORY_PATH, 'utf8'));
    const userId = upsertUser({ googleSub: LEGACY_LOCAL_GOOGLE_SUB, email: null, displayName: '(ログイン導入前の記録)' });
    writeMemory(userId, legacy);
    console.log('memory.json を「ログイン導入前の記録」ユーザーへ移行しました（元ファイルはそのまま残しています）');
  } catch (e) {
    console.error('memory.json の移行に失敗しました:', e);
  }
};

// Googleアカウントでのログイン成功時に呼ぶ。無ければ作成、あれば最新のemail/表示名で更新して user.id を返す
const upsertUser = ({ googleSub, email, displayName }) => {
  const existing = db.prepare('SELECT id FROM users WHERE google_sub = ?').get(googleSub);
  if (existing) {
    db.prepare('UPDATE users SET email = ?, display_name = ? WHERE id = ?').run(email || null, displayName || null, existing.id);
    return existing.id;
  }
  db.prepare('INSERT INTO users (google_sub, email, display_name, created_at) VALUES (?, ?, ?, ?)')
    .run(googleSub, email || null, displayName || null, new Date().toISOString());
  return db.prepare('SELECT id FROM users WHERE google_sub = ?').get(googleSub).id;
};

const getUserById = (userId) => db.prepare('SELECT id, email, display_name AS displayName FROM users WHERE id = ?').get(userId) || null;

const readMemory = (userId) => {
  const weaknesses = {};
  for (const row of db.prepare('SELECT * FROM weaknesses WHERE user_id = ?').all(userId)) {
    weaknesses[row.tag] = {
      count: row.count,
      lastSeen: row.last_seen,
      notes: JSON.parse(row.notes_json),
    };
  }
  const history = db.prepare('SELECT * FROM history WHERE user_id = ? ORDER BY id ASC').all(userId).map((row) => ({
    ts: row.ts,
    problemTitle: row.problem_title,
    passed: !!row.passed,
    tags: JSON.parse(row.tags_json),
  }));
  const clearedIds = db.prepare('SELECT problem_id FROM progress WHERE user_id = ?').all(userId).map((row) => row.problem_id);
  return { weaknesses, history, progress: { clearedIds } };
};

// memory.json 時代と同じく「まるごと書き換え」方式で永続化する（ロジックの互換性を優先）。対象は指定したuser_idの行だけ
const writeMemory = (userId, memory) => {
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM weaknesses WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM history WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM progress WHERE user_id = ?').run(userId);
    const insertWeakness = db.prepare(
      'INSERT INTO weaknesses (user_id, tag, count, last_seen, notes_json) VALUES (?, ?, ?, ?, ?)'
    );
    Object.entries(memory.weaknesses || {}).forEach(([tag, w]) => {
      insertWeakness.run(userId, tag, w.count, w.lastSeen || null, JSON.stringify(w.notes || []));
    });
    const insertHistory = db.prepare(
      'INSERT INTO history (user_id, ts, problem_title, passed, tags_json) VALUES (?, ?, ?, ?, ?)'
    );
    (memory.history || []).forEach((h) => {
      insertHistory.run(userId, h.ts, h.problemTitle || null, h.passed ? 1 : 0, JSON.stringify(h.tags || []));
    });
    const insertProgress = db.prepare('INSERT INTO progress (user_id, problem_id, cleared_at) VALUES (?, ?, ?)');
    (memory.progress?.clearedIds || []).forEach((id) => {
      insertProgress.run(userId, id, new Date().toISOString());
    });
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
};

migrateLegacyMemoryIfNeeded();

// ローカルモード（拡張から起動する単一ユーザー運用）で使うユーザー。
// ログイン導入前の記録がある場合はそれをそのまま引き継ぐ（同じgoogle_subを使う）
const getOrCreateLocalUser = () =>
  upsertUser({ googleSub: LEGACY_LOCAL_GOOGLE_SUB, email: null, displayName: 'この端末の学習者' });

module.exports = { readMemory, writeMemory, upsertUser, getUserById, getOrCreateLocalUser };
