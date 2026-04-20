import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

// Create connection pool (recommended for production)
const db = mysql.createPool({
  host: process.env.DB_HOST || "sql12.freesqldatabase.com",
  user: process.env.DB_USER || "sql12823343",
  password: process.env.DB_PASSWORD || "rljeFc7CCv",
  database: process.env.DB_NAME || "sql12823343",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export default db;