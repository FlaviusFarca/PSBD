const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

async function verificaConexiunea() {
  console.log("------------------------------------------------");
  console.log("INCERC SA MA CONECTEZ LA BAZA DE DATE...");
  console.log(`User: ${process.env.DB_USER}`);
  console.log(`Baza: ${process.env.DB_NAME}`);
  console.log(`Port: ${process.env.DB_PORT}`);
  console.log("------------------------------------------------");

  try {
    const res = await pool.query('SELECT NOW()');
    console.log("✅ SUCCES! Te-ai conectat.");
    console.log("Ora serverului SQL este:", res.rows[0].now);
  } catch (err) {
    console.log("❌ EROARE CONEXIUNE!");
    console.log("Mesaj eroare:", err.message);
    
    if (err.message.includes("password")) {
      console.log("SFAT: Parola din fisierul .env nu e buna.");
    } else if (err.message.includes("does not exist")) {
      console.log("SFAT: Baza de date 'firma_curierat' nu exista.");
    } else if (err.message.includes("refused")) {
      console.log("SFAT: Portul e gresit. Incearca sa schimbi 5432 cu 8080 in .env");
    }
  }
  process.exit();
}

verificaConexiunea();