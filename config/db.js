const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8',
  typeCast: function (field, next) {
    // Tự động convert Buffer -> string cho tất cả các trường TEXT/VARCHAR
    if (field.type === 'VAR_STRING' || field.type === 'STRING' || field.type === 'BLOB') {
      const val = field.buffer();
      return val !== null ? val.toString('utf8') : null;
    }
    return next();
  }
});

module.exports = pool;

