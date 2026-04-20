import app from "./app.js";
import db from "./config/db.js";
import { startFabricListener } from './fabric.js'; // ✅ import the right function

const PORT = 3000;

(async () => {
  try {
    await db.getConnection();
    console.log("✅ MySQL Connected");
  } catch (err) {
    console.error("❌ DB Connection Failed:", err.message);
  }

  try {
    await startFabricListener(); // ✅ actually called now
  } catch (err) {
    console.error("❌ Fabric Listener Failed:", err.message);
  }

  app.listen(PORT,'0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
})();