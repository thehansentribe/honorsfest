const { db } = require('../config/db');

class Honor {
  static getAll(filters = {}) {
    let query = 'SELECT * FROM Honors WHERE 1=1';
    const params = [];

    if (filters.category) {
      query += ' AND Category = ?';
      params.push(filters.category);
    }

    if (filters.search) {
      query += ' AND Name LIKE ?';
      params.push(`%${filters.search}%`);
    }

    query += ' ORDER BY Category, Name';

    return db.prepare(query).all(...params);
  }

  static findById(id) {
    return db.prepare('SELECT * FROM Honors WHERE ID = ?').get(id);
  }

  static getCategories() {
    return db.prepare('SELECT DISTINCT Category FROM Honors ORDER BY Category').all();
  }
}

module.exports = Honor;


