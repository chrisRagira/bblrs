import db from "./src/config/db.js";

const test = async () => {
  try {
    const [rows] = await db.execute("SELECT user_id, full_name, national_id, role FROM users WHERE national_id='33061096'");
    console.log("Database connected:", rows);
  } catch (err) {
    console.error("DB Error:", err.message);
  }
};

test();