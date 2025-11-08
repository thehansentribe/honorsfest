const { db } = require('../config/db');

class Setting {
  static get(key) {
    const row = db.prepare('SELECT Value FROM Settings WHERE Key = ?').get(key);
    return row ? row.Value : null;
  }

  static set(key, value) {
    db.prepare(`
      INSERT INTO Settings (Key, Value)
      VALUES (?, ?)
      ON CONFLICT(Key) DO UPDATE SET Value = excluded.Value
    `).run(key, value);
  }

  static delete(key) {
    db.prepare('DELETE FROM Settings WHERE Key = ?').run(key);
  }

  static getMany(keys) {
    if (!Array.isArray(keys) || keys.length === 0) return {};
    const placeholders = keys.map(() => '?').join(',');
    const rows = db.prepare(`SELECT Key, Value FROM Settings WHERE Key IN (${placeholders})`).all(...keys);
    return rows.reduce((acc, row) => {
      acc[row.Key] = row.Value;
      return acc;
    }, {});
  }
}

module.exports = Setting;


