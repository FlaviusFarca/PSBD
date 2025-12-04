const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const axios = require("axios");
const cheerio = require("cheerio");
const PDFDocument = require("pdfkit");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const ExcelJS = require('exceljs');
const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "1234",
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || "firma_curierat",
});

// --- JWT SECRET ---
const JWT_SECRET = process.env.JWT_SECRET || "fastcourier_secret_key_2024";

// --- MIDDLEWARE PENTRU VERIFICARE JWT ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false,
      error: 'Token lipsă. Vă rugăm să vă autentificați.' 
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ 
        success: false,
        error: 'Token invalid sau expirat.' 
      });
    }
    req.user = user;
    next();
  });
};

// --- MIDDLEWARE PENTRU VERIFICARE ROLURI ---
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false,
        error: 'Acces interzis. Nu aveți permisiunea necesară.' 
      });
    }
    next();
  };
};

// --- UTILITAR PENTRU CENZURARE DATE (GDPR) ---
const maskData = (text, type = 'name') => {
    if (!text) return '-';
   
    if (type === 'name') {
        if (text.toLowerCase().includes('srl') || text.toLowerCase().includes('sa')) return text;
       
        const parts = text.split(' ');
        if (parts.length > 1) {
            return `${parts[0]} ${parts[1][0]}.`;
        }
        return text;
    }
   
    if (type === 'phone') {
        if (text.length > 6) {
            return `${text.slice(0, 4)}***${text.slice(-3)}`;
        }
    }

    if (type === 'address') {
        const parts = text.split(' ');
        if (parts.length > 2) {
            return `${parts[0]} ${parts[1]} ***`;
        }
        return "Adresă protejată";
    }

    return text;
};

// --- FUNCȚII AJUTĂTOARE PENTRU EXPORT ---
const generateExcel = async (data, columns, sheetName) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName || 'Date');

    // Adăugăm antetul
    worksheet.columns = columns;

    // Formatare antet
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
    };

    // Adăugăm datele
    data.forEach(item => {
        const row = worksheet.addRow(item);
        
        // Formatare pentru numere
        columns.forEach((col, index) => {
            const cell = row.getCell(index + 1);
            if (typeof item[col.key] === 'number') {
                cell.numFmt = '#,##0.00';
            }
        });
    });

    // Auto-size columns
    worksheet.columns.forEach(column => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, cell => {
            const cellLength = cell.value ? cell.value.toString().length : 10;
            if (cellLength > maxLength) {
                maxLength = cellLength;
            }
        });
        column.width = maxLength < 10 ? 10 : maxLength + 2;
    });

    return workbook;
};

const generateCSV = (data) => {
    if (data.length === 0) return '';
    const fields = Object.keys(data[0]);
    const parser = new Parser({ fields, delimiter: ',' });
    return parser.parse(data);
};

// --- SETUP INITIAL BAZA DE DATE ---
async function setupDatabase() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        console.log("Începere configurare baza de date...");
        
        // 1. Creare tabel Roluri
        await client.query(`
            CREATE TABLE IF NOT EXISTS Roluri (
                id_rol SERIAL PRIMARY KEY,
                nume_rol VARCHAR(50) NOT NULL UNIQUE,
                descriere TEXT
            )
        `);
        console.log("✓ Tabela Roluri verificată");
        
        // 2. Inserare roluri de bază
        await client.query(`
            INSERT INTO Roluri (nume_rol, descriere) 
            VALUES 
                ('Administrator', 'Acces complet la sistem'),
                ('Manager', 'Acces la gestionare operațională'),
                ('Operator', 'Operator introducere date'),
                ('Curier', 'Curier - acces limitat la livrări')
            ON CONFLICT (nume_rol) DO NOTHING
        `);
        console.log("✓ Roluri configurate");
        
        // 3. Creare tabel Utilizatori_Sistem
        await client.query(`
            CREATE TABLE IF NOT EXISTS Utilizatori_Sistem (
                id_utilizator SERIAL PRIMARY KEY,
                nume VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                parola VARCHAR(100) NOT NULL,
                id_rol INTEGER REFERENCES Roluri(id_rol),
                id_curier INTEGER REFERENCES Curieri(id_curier),
                id_subcontractor INTEGER REFERENCES Subcontractori(id_subcontractor),
                data_creare TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log("✓ Tabela Utilizatori_Sistem verificată");
        
        // 4. Adaugă date demo în tabelele de bază dacă sunt goale
        // Sedii
        const sediiCount = await client.query("SELECT COUNT(*) FROM Sedii");
        if (parseInt(sediiCount.rows[0].count) === 0) {
            await client.query(`
                INSERT INTO Sedii (adresa, telefon) 
                VALUES 
                    ('Str. Libertății nr. 10, București', '0211234567'),
                    ('B-dul Decembrie 1989 nr. 15, Cluj-Napoca', '0264123456')
            `);
            console.log("✓ Sedii demo create");
        }
        
        // Masini
        const masiniCount = await client.query("SELECT COUNT(*) FROM Masini");
        if (parseInt(masiniCount.rows[0].count) === 0) {
            await client.query(`
                INSERT INTO Masini (numar_inmatriculare, consum_mediu, model) 
                VALUES 
                    ('B-01-ABC', 8.5, 'Dacia Logan'),
                    ('CJ-02-DEF', 7.2, 'Renault Kangoo'),
                    ('B-03-GHI', 9.0, 'Ford Transit')
            `);
            console.log("✓ Mașini demo create");
        }
        
        // Curieri
        const curieriCount = await client.query("SELECT COUNT(*) FROM Curieri");
        if (parseInt(curieriCount.rows[0].count) === 0) {
            const sedii = await client.query("SELECT id_sediu FROM Sedii LIMIT 2");
            const masini = await client.query("SELECT id_masina FROM Masini LIMIT 2");
            
            if (sedii.rows.length >= 2 && masini.rows.length >= 2) {
                await client.query(`
                    INSERT INTO Curieri (nume, telefon, id_sediu, id_masina) 
                    VALUES 
                        ('Ion Popescu', '0722111222', $1, $2),
                        ('Maria Ionescu', '0722333444', $3, $4)
                `, [sedii.rows[0].id_sediu, masini.rows[0].id_masina, 
                    sedii.rows[1].id_sediu, masini.rows[1].id_masina]);
                console.log("✓ Curieri demo creați");
            }
        }
        
        // 5. Creare utilizatori demo
        const usersCount = await client.query("SELECT COUNT(*) FROM Utilizatori_Sistem");
        if (parseInt(usersCount.rows[0].count) === 0) {
            // Obține ID-urile rolurilor
            const roles = await client.query("SELECT id_rol, nume_rol FROM Roluri");
            const roleMap = {};
            roles.rows.forEach(r => roleMap[r.nume_rol] = r.id_rol);
            
            // Obține ID curier pentru asociere
            const curier = await client.query("SELECT id_curier FROM Curieri WHERE nume = 'Ion Popescu'");
            const id_curier = curier.rows.length > 0 ? curier.rows[0].id_curier : null;
            
            // Creare utilizatori demo (parole hash-uite)
            const users = [
                ['Admin User', 'admin@fastcourier.ro', await bcrypt.hash('admin', 10), roleMap['Administrator'], null],
                ['Ion Popescu', 'curier@fastcourier.ro', await bcrypt.hash('1234', 10), roleMap['Curier'], id_curier],
                ['Manager Test', 'manager@fastcourier.ro', await bcrypt.hash('manager', 10), roleMap['Manager'], null],
                ['Operator Test', 'operator@fastcourier.ro', await bcrypt.hash('operator', 10), roleMap['Operator'], null]
            ];
            
            for (const [nume, email, parola, id_rol, id_curier] of users) {
                await client.query(`
                    INSERT INTO Utilizatori_Sistem (nume, email, parola, id_rol, id_curier) 
                    VALUES ($1, $2, $3, $4, $5)
                `, [nume, email, parola, id_rol, id_curier]);
            }
            console.log("✓ Utilizatori demo creați");
        }
        
        await client.query('COMMIT');
        console.log("✓ Baza de date configurată cu succes!");
        
        // Afișează informații pentru debugging
        const users = await pool.query(`
            SELECT u.nume, u.email, r.nume_rol 
            FROM Utilizatori_Sistem u 
            JOIN Roluri r ON u.id_rol = r.id_rol
            ORDER BY u.id_utilizator
        `);
        console.log("\nUtilizatori disponibili pentru login:");
        console.log("========================================");
        users.rows.forEach(user => {
            let parola = '';
            switch(user.email) {
                case 'admin@fastcourier.ro': parola = 'admin'; break;
                case 'curier@fastcourier.ro': parola = '1234'; break;
                case 'manager@fastcourier.ro': parola = 'manager'; break;
                case 'operator@fastcourier.ro': parola = 'operator'; break;
            }
            console.log(`${user.email} / ${parola} (${user.nume_rol})`);
        });
        console.log("========================================\n");
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("✗ Eroare la configurarea bazei de date:", error.message);
    } finally {
        client.release();
    }
}

// --- LOGIN ---
app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email și parolă sunt obligatorii.' 
            });
        }
        
        // Căutăm utilizatorul
        const userQuery = `
            SELECT u.*, r.nume_rol 
            FROM Utilizatori_Sistem u 
            JOIN Roluri r ON u.id_rol = r.id_rol 
            WHERE u.email = $1
        `;
        const userResult = await pool.query(userQuery, [email]);
        
        if (userResult.rows.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: 'Email sau parolă incorectă.' 
            });
        }

        const user = userResult.rows[0];
        
        // Verificăm parola cu bcrypt
        const validPassword = await bcrypt.compare(password, user.parola);
        
        if (!validPassword) {
            // Fallback pentru demo: verifică parola în clar (doar pentru demo)
            if (password === 'admin' && email === 'admin@fastcourier.ro') {
                // Acceptă pentru demo
            } else if (password === '1234' && email === 'curier@fastcourier.ro') {
                // Acceptă pentru demo
            } else if (password === 'manager' && email === 'manager@fastcourier.ro') {
                // Acceptă pentru demo
            } else if (password === 'operator' && email === 'operator@fastcourier.ro') {
                // Acceptă pentru demo
            } else {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Email sau parolă incorectă.' 
                });
            }
        }

        // Creăm token JWT
        const token = jwt.sign(
            { 
                id: user.id_utilizator, 
                email: user.email, 
                role: user.nume_rol,
                name: user.nume
            }, 
            JWT_SECRET, 
            { expiresIn: '8h' }
        );

        res.json({ 
            success: true, 
            token,
            user: { 
                id: user.id_utilizator,
                name: user.nume, 
                email: user.email, 
                role: user.nume_rol 
            } 
        });

    } catch (error) {
        console.error("Eroare login:", error);
        res.status(500).json({ 
            success: false, 
            message: 'Eroare server la autentificare.' 
        });
    }
});

// --- VERIFICARE TOKEN ---
app.get("/api/verify-token", authenticateToken, (req, res) => {
    res.json({ 
        success: true, 
        valid: true, 
        user: req.user 
    });
});

// --- GENERARE AWB PDF ---
app.get("/api/awb/:cod", authenticateToken, async (req, res) => {
    const { cod } = req.params;
    try {
        const query = `
            SELECT c.*,
                   ce.nume as exp_nume, ce.telefon as exp_tel, ce.adresa as exp_adresa,
                   cd.nume as dest_nume, cd.telefon as dest_tel, cd.adresa as dest_adresa,
                   s.adresa as sediu_preluare
            FROM Colete c
            LEFT JOIN Clienti ce ON c.id_client_expeditor = ce.id_client
            LEFT JOIN Clienti cd ON c.id_client_destinatar = cd.id_client
            LEFT JOIN Sedii s ON c.id_sediu = s.id_sediu
            WHERE c.cod_colet = $1
        `;
       
        const result = await pool.query(query, [cod]);
        if (result.rows.length === 0) return res.status(404).send("Coletul nu a fost găsit.");
        const colet = result.rows[0];

        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename=AWB-${cod}.pdf`);
        doc.pipe(res);

        doc.fontSize(24).font('Helvetica-Bold').text('FAST COURIER', { align: 'center' });
        doc.fontSize(10).font('Helvetica').text('Document de Transport (AWB)', { align: 'center' });
        doc.moveDown();
        doc.moveTo(50, 100).lineTo(550, 100).stroke();
        doc.rect(150, 120, 300, 40).stroke();
        doc.fontSize(16).text(cod, 150, 133, { width: 300, align: 'center' });
        doc.moveDown(4);
       
        const yStart = 200;
        doc.fontSize(12).font('Helvetica-Bold').text('EXPEDITOR:', 50, yStart);
        doc.fontSize(10).font('Helvetica')
           .text(colet.exp_nume || '-', 50, yStart + 20)
           .text(colet.exp_tel || '-', 50, yStart + 35)
           .text(colet.exp_adresa || '-', 50, yStart + 50, { width: 200 });

        doc.fontSize(12).font('Helvetica-Bold').text('DESTINATAR:', 300, yStart);
        doc.font('Helvetica').fontSize(10)
           .text(colet.dest_nume || '-', 300, yStart + 20)
           .text(colet.dest_tel || '-', 300, yStart + 35)
           .text(colet.dest_adresa || '-', 300, yStart + 50, { width: 200 });

        doc.moveDown(4);
        doc.end();
    } catch (e) { 
        console.error(e); 
        res.status(500).send("Eroare generare PDF"); 
    }
});

// --- PRETURI LIVE COMBUSTIBIL ---
app.get("/api/preturi-combustibil", authenticateToken, async (req, res) => {
    try {
        const { data } = await axios.get('https://www.cargopedia.ro/preturi-carburanti-europa', {
            timeout: 5000
        });
        const $ = cheerio.load(data);
        let preturi = null;
        $('table tbody tr').each((i, el) => {
            const tara = $(el).find('td').eq(0).text().trim();
            if (tara === 'România') {
                preturi = {
                    benzina: { 
                        eur: parseFloat($(el).find('td').eq(1).text().replace(',', '.')) || 1.484, 
                        ron: parseFloat($(el).find('td').eq(2).text().replace(',', '.')) || 7.551 
                    },
                    diesel: { 
                        eur: parseFloat($(el).find('td').eq(3).text().replace(',', '.')) || 1.566, 
                        ron: parseFloat($(el).find('td').eq(4).text().replace(',', '.')) || 7.967 
                    },
                    gpl: { 
                        eur: parseFloat($(el).find('td').eq(5).text().replace(',', '.')) || 0.742, 
                        ron: parseFloat($(el).find('td').eq(6).text().replace(',', '.')) || 3.775 
                    },
                    sursa: 'Cargopedia'
                };
            }
        });
        
        if (preturi) {
            res.json(preturi);
        } else {
            throw new Error("Nu s-au găsit datele.");
        }
    } catch (error) {
        console.log("Folosind date backup pentru combustibil:", error.message);
        res.json({ 
            diesel: { ron: 7.967, eur: 1.566 }, 
            benzina: { ron: 7.551, eur: 1.484 }, 
            gpl: { ron: 3.775, eur: 0.742 }, 
            sursa: "backup" 
        });
    }
});

// --- RUTE CU PAGINARE ---
app.get("/api/rute", authenticateToken, async (req, res) => {
  try {
    // Parametri paginare
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    // Query pentru numărare totală
    const countQuery = `
      SELECT COUNT(*) as total
      FROM Rute r
      LEFT JOIN Orase op ON r.id_oras_plecare = op.id_oras
      LEFT JOIN Orase od ON r.id_oras_destinatie = od.id_oras
      LEFT JOIN Tipuri_Masina tm ON r.id_tip_masina = tm.id_tip_masina
      LEFT JOIN Alocari_Rute ar ON r.id_ruta = ar.id_ruta AND ar.activa = TRUE
      LEFT JOIN Curieri c ON ar.id_curier = c.id_curier
      LEFT JOIN Subcontractori s ON ar.id_subcontractor = s.id_subcontractor
    `;
    
    const countResult = await pool.query(countQuery);
    const total = parseInt(countResult.rows[0].total) || 0;

    const query = `
      SELECT
        r.id_ruta, r.nume_ruta, r.distanta_maxima_km,
        op.nume as oras_plecare, od.nume as oras_destinatie, tm.denumire as tip_masina,
        c.nume as nume_curier, s.denumire as nume_subcontractor,
        CASE WHEN s.id_subcontractor IS NOT NULL THEN 'Subcontractor' 
             WHEN c.id_curier IS NOT NULL THEN 'Firma' 
             ELSE 'Nealocat' END as tip_alocare
      FROM Rute r
      LEFT JOIN Orase op ON r.id_oras_plecare = op.id_oras
      LEFT JOIN Orase od ON r.id_oras_destinatie = od.id_oras
      LEFT JOIN Tipuri_Masina tm ON r.id_tip_masina = tm.id_tip_masina
      LEFT JOIN Alocari_Rute ar ON r.id_ruta = ar.id_ruta AND ar.activa = TRUE
      LEFT JOIN Curieri c ON ar.id_curier = c.id_curier
      LEFT JOIN Subcontractori s ON ar.id_subcontractor = s.id_subcontractor
      ORDER BY r.id_ruta DESC
      LIMIT $1 OFFSET $2
    `;
    const result = await pool.query(query, [limit, offset]);
   
    // Cenzurare date
    const maskedRows = result.rows.map(row => ({
        ...row,
        nume_curier: maskData(row.nume_curier, 'name')
    }));
   
    res.json({
      success: true,
      data: maskedRows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1
      }
    });
  } catch (e) { 
    console.error("Eroare API rute:", e);
    res.status(500).json({
      success: false,
      error: e.message 
    });
  }
});

app.post("/api/rute", authenticateToken, authorizeRoles('Administrator', 'Manager'), async (req, res) => {
  try {
    const { nume_ruta, id_oras_plecare, id_oras_destinatie, distanta_maxima_km } = req.body;
    
    const result = await pool.query(
      `INSERT INTO Rute (nume_ruta, id_oras_plecare, id_oras_destinatie, distanta_maxima_km, id_tip_masina, durata_estimata_min) 
       VALUES($1, $2, $3, $4, 1, 120) RETURNING *`, 
      [nume_ruta, id_oras_plecare || 1, id_oras_destinatie || 2, distanta_maxima_km]
    );
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (e) { 
    res.status(500).json({
      success: false,
      error: e.message 
    });
  }
});

// --- COLETE CU PAGINARE SI FILTRE SERVER-SIDE ---
app.get("/api/colete", authenticateToken, async (req, res) => {
    try {
        // Parametri paginare
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        
        // Parametri filtrare
        const { filterType, filterValue, filterSediu } = req.query;
        
        // Construim condițiile WHERE dinamic
        let whereConditions = [];
        let queryParams = [];
        let paramCounter = 1;
        
        // Filtru după tip (zi, luna, an)
        if (filterType && filterValue) {
            if (filterType === 'zi') {
                whereConditions.push(`DATE(c.data_primire) = $${paramCounter}`);
                queryParams.push(filterValue);
                paramCounter++;
            } else if (filterType === 'luna') {
                whereConditions.push(`TO_CHAR(c.data_primire, 'YYYY-MM') = $${paramCounter}`);
                queryParams.push(filterValue);
                paramCounter++;
            } else if (filterType === 'an') {
                whereConditions.push(`EXTRACT(YEAR FROM c.data_primire) = $${paramCounter}`);
                queryParams.push(filterValue);
                paramCounter++;
            }
        }
        
        // Filtru după sediu
        if (filterSediu && filterSediu !== 'Toate') {
            whereConditions.push(`s.id_sediu = $${paramCounter}`);
            queryParams.push(parseInt(filterSediu));
            paramCounter++;
        }
        
        const whereClause = whereConditions.length > 0 
            ? `WHERE ${whereConditions.join(' AND ')}` 
            : '';
        
        // Query pentru numărare totală CU FILTRE
        const countQuery = `
            SELECT COUNT(*) as total
            FROM Colete c
            LEFT JOIN Clienti cl ON c.id_client_expeditor = cl.id_client
            LEFT JOIN Sedii s ON c.id_sediu = s.id_sediu
            ${whereClause}
        `;
        
        const countResult = await pool.query(countQuery, queryParams);
        const total = parseInt(countResult.rows[0].total) || 0;

        // Query pentru date CU FILTRE
        const query = `
            SELECT c.*, cl.nume as nume_expeditor, cl.telefon as telefon_expeditor,
                   s.adresa as sediu_adresa, s.id_sediu
            FROM Colete c
            LEFT JOIN Clienti cl ON c.id_client_expeditor = cl.id_client
            LEFT JOIN Sedii s ON c.id_sediu = s.id_sediu
            ${whereClause}
            ORDER BY c.data_primire DESC
            LIMIT $${paramCounter} OFFSET $${paramCounter + 1}
        `;
        
        // Adăugăm limit și offset la parametri
        queryParams.push(limit, offset);
        
        const result = await pool.query(query, queryParams);

        // Cenzurare date
        const maskedRows = result.rows.map(row => ({
            ...row,
            nume_expeditor: maskData(row.nume_expeditor, 'name'),
            telefon_expeditor: maskData(row.telefon_expeditor, 'phone'),
            sediu: row.sediu_adresa ? row.sediu_adresa.split(',')[0] : 'Necunoscut'
        }));

        res.json({
            success: true,
            data: maskedRows,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit) || 1
            }
        });
    } catch (e) { 
        console.error("Eroare API colete:", e);
        res.status(500).json({
            success: false,
            error: e.message 
        });
    }
});

// --- ENDPOINT PENTRU LISTA DE SEDII PENTRU FILTRE ---
app.get("/api/sedii", authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT s.id_sediu, s.adresa, s.telefon
            FROM Sedii s
            ORDER BY s.id_sediu
        `);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (e) {
        console.error("Eroare API sedii:", e);
        res.status(500).json({
            success: false,
            error: e.message
        });
    }
});

app.post("/api/colete", authenticateToken, authorizeRoles('Administrator', 'Operator', 'Manager'), async (req, res) => {
    try {
        const { cod_colet, greutate_fizica_kg, volum_m3, cost_transport, mod_achitare, ramburs } = req.body;
        
        const val_ramburs = ramburs ? parseFloat(ramburs) : 0;
        const result = await pool.query(
            `INSERT INTO Colete (cod_colet, id_client_expeditor, id_client_destinatar, id_sediu, 
             greutate_fizica_kg, volum_m3, cost_transport, mod_achitare, ramburs, stare, data_primire) 
             VALUES ($1, 1, 1, 1, $2, $3, $4, $5, $6, 'depozit', NOW()) RETURNING *`, 
            [cod_colet, greutate_fizica_kg, volum_m3, cost_transport, mod_achitare, val_ramburs]
        );
        
        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (e) { 
        res.status(500).json({
            success: false,
            error: e.message 
        });
    }
});

// --- LIVRARI CU PAGINARE SI FILTRE SERVER-SIDE ---
app.get("/api/livrari", authenticateToken, async (req, res) => {
    try {
        // Parametri paginare
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        
        // Parametri filtrare
        const { filterDate, filterSediu, showRambursOnly } = req.query;
        
        // Construim condițiile WHERE dinamic
        let whereConditions = [];
        let queryParams = [];
        let paramCounter = 1;
        
        // Filtru după dată
        if (filterDate) {
            whereConditions.push(`DATE(l.data_planificata) = $${paramCounter}`);
            queryParams.push(filterDate);
            paramCounter++;
        }
        
        // Filtru după sediu
        if (filterSediu && filterSediu !== 'Toate') {
            whereConditions.push(`s.id_sediu = $${paramCounter}`);
            queryParams.push(filterSediu);
            paramCounter++;
        }
        
        // Filtru doar cu ramburs
        if (showRambursOnly === 'true') {
            whereConditions.push(`l.ramburs_colectat > 0`);
        }
        
        const whereClause = whereConditions.length > 0 
            ? `WHERE ${whereConditions.join(' AND ')}` 
            : '';
        
        // Query pentru numărare totală CU FILTRE
        const countQuery = `
            SELECT COUNT(*) as total
            FROM Livrari l
            LEFT JOIN Curieri c ON l.id_curier = c.id_curier
            LEFT JOIN Colete col ON l.id_colet = col.id_colet
            LEFT JOIN Sedii s ON c.id_sediu = s.id_sediu
            ${whereClause}
        `;
        
        const countResult = await pool.query(countQuery, queryParams);
        const total = parseInt(countResult.rows[0].total) || 0;

        // Query pentru date CU FILTRE
        const query = `
            SELECT l.*, c.nume as nume_curier, col.cod_colet, 
                   s.adresa as sediu_adresa, s.id_sediu
            FROM Livrari l
            LEFT JOIN Curieri c ON l.id_curier = c.id_curier
            LEFT JOIN Colete col ON l.id_colet = col.id_colet
            LEFT JOIN Sedii s ON c.id_sediu = s.id_sediu
            ${whereClause}
            ORDER BY l.data_planificata DESC
            LIMIT $${paramCounter} OFFSET $${paramCounter + 1}
        `;
        
        // Adăugăm limit și offset la parametri
        queryParams.push(limit, offset);
        
        const result = await pool.query(query, queryParams);

        const maskedRows = result.rows.map(row => ({
            ...row,
            nume_curier: maskData(row.nume_curier, 'name'),
            sediu: row.sediu_adresa ? row.sediu_adresa.split(',')[0] || 'Sediu ' + row.id_sediu : 'Necunoscut'
        }));

        res.json({
            success: true,
            data: maskedRows,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit) || 1
            }
        });
    } catch (e) { 
        console.error("Eroare API livrari:", e);
        res.status(500).json({
            success: false,
            error: e.message 
        });
    }
});

// --- RETURURI CU PAGINARE SI FILTRE SERVER-SIDE ---
app.get("/api/retururi", authenticateToken, async (req, res) => {
    try {
        // Parametri paginare
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        
        // Parametri filtrare
        const { filterType, filterValue, filterSediu } = req.query;
        
        let whereConditions = [];
        let queryParams = [];
        let paramCounter = 1;
        
        // Filtru după tip (zi, luna, an) și valoare
        if (filterType && filterValue) {
            if (filterType === 'zi') {
                whereConditions.push(`DATE(r.data_retur) = $${paramCounter}`);
                queryParams.push(filterValue);
                paramCounter++;
            } else if (filterType === 'luna') {
                whereConditions.push(`TO_CHAR(r.data_retur, 'YYYY-MM') = $${paramCounter}`);
                queryParams.push(filterValue);
                paramCounter++;
            }
        }
        
        const whereClause = whereConditions.length > 0 
            ? `WHERE ${whereConditions.join(' AND ')}` 
            : '';
        
        // Query pentru numărare totală
        const countQuery = `
            SELECT COUNT(*) as total 
            FROM Retururi r 
            LEFT JOIN Colete col ON r.id_colet = col.id_colet
            ${whereClause}
        `;
        
        const countResult = await pool.query(countQuery, queryParams);
        const total = parseInt(countResult.rows[0].total) || 0;

        const query = `
            SELECT r.*, col.cod_colet 
            FROM Retururi r 
            LEFT JOIN Colete col ON r.id_colet = col.id_colet
            ${whereClause}
            ORDER BY r.data_retur DESC
            LIMIT $${paramCounter} OFFSET $${paramCounter + 1}
        `;
        
        queryParams.push(limit, offset);
        
        const result = await pool.query(query, queryParams);
        
        res.json({
            success: true,
            data: result.rows,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit) || 1
            }
        });
    } catch (e) { 
        console.error("Eroare API retururi:", e);
        res.status(500).json({
            success: false,
            error: e.message 
        });
    }
});

// --- SUBCONTRACTORI CU PAGINARE SI FILTRE SERVER-SIDE ---
app.get("/api/subcontractori", authenticateToken, async (req, res) => {
    try {
        // Parametri paginare
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        
        // Parametri filtrare
        const { filterDate } = req.query;
        
        let whereConditions = [];
        let queryParams = [];
        let paramCounter = 1;
        
        // Filtru după dată (dacă este specificat)
        if (filterDate) {
            // Aceasta este o implementare simplă - poate fi adaptată la nevoie
            whereConditions.push(`EXISTS (
                SELECT 1 FROM Livrari l 
                WHERE l.id_subcontractor = s.id_subcontractor 
                AND DATE(l.data_planificata) = $${paramCounter}
            )`);
            queryParams.push(filterDate);
            paramCounter++;
        }
        
        const whereClause = whereConditions.length > 0 
            ? `WHERE ${whereConditions.join(' AND ')}` 
            : '';
        
        // Query pentru numărare totală
        const countQuery = `SELECT COUNT(*) as total FROM Subcontractori s ${whereClause}`;
        const countResult = await pool.query(countQuery, queryParams);
        const total = parseInt(countResult.rows[0].total) || 0;

        const query = `
            SELECT s.id_subcontractor, s.denumire, s.cui, s.telefon 
            FROM Subcontractori s
            ${whereClause}
            ORDER BY s.id_subcontractor DESC
            LIMIT $${paramCounter} OFFSET $${paramCounter + 1}
        `;
        
        queryParams.push(limit, offset);
        
        const result = await pool.query(query, queryParams);
       
        res.json({
            success: true,
            data: result.rows,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit) || 1
            }
        });
    } catch (e) { 
        console.error("Eroare API subcontractori:", e);
        res.status(500).json({
            success: false,
            error: e.message 
        });
    }
});

app.post("/api/subcontractori", authenticateToken, authorizeRoles('Administrator', 'Manager'), async (req, res) => {
    try {
        const { denumire, cui, telefon } = req.body;
        
        const result = await pool.query(
            `INSERT INTO Subcontractori (denumire, cui, telefon) 
             VALUES ($1, $2, $3) RETURNING *`, 
            [denumire, cui, telefon]
        );
        
        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (e) { 
        res.status(500).json({
            success: false,
            error: e.message 
        });
    }
});

// --- RAPOARTE COMBUSTIBIL ---
app.get("/api/rapoarte/combustibil", authenticateToken, async (req, res) => {
    try {
        const query = `
            SELECT c.nume as curier, m.numar_inmatriculare, SUM(l.combustibil_consumat) as total_litri
            FROM Livrari l
            JOIN Curieri c ON l.id_curier = c.id_curier
            JOIN Masini m ON c.id_masina = m.id_masina
            GROUP BY c.nume, m.numar_inmatriculare
            ORDER BY total_litri DESC
        `;
        const result = await pool.query(query);

        const maskedRows = result.rows.map(row => ({
            ...row,
            curier: maskData(row.curier, 'name')
        }));

        res.json({
            success: true,
            data: maskedRows
        });
    } catch (e) { 
        console.error("Eroare API combustibil:", e);
        res.status(500).json({
            success: false,
            error: e.message 
        });
    }
});

// --- TARIFE ---
app.get("/api/tarife", authenticateToken, async (req, res) => {
    try { 
        const result = await pool.query("SELECT * FROM Plan_Tarifar ORDER BY id_tarif"); 
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (e) { 
        console.error("Eroare API tarife:", e);
        res.status(500).json({
            success: false,
            error: e.message 
        });
    }
});

// --- ENDPOINT PENTRU CURIERI (acces limitat) ---
app.get("/api/curier/colete", authenticateToken, authorizeRoles('Curier'), async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Găsim id_curier asociat utilizatorului
        const userQuery = await pool.query(
            "SELECT id_curier FROM Utilizatori_Sistem WHERE id_utilizator = $1",
            [userId]
        );
        
        if (userQuery.rows.length === 0 || !userQuery.rows[0].id_curier) {
            return res.json({
                success: true,
                data: [],
                message: 'Nu aveți curier asociat.'
            });
        }
        
        const curierId = userQuery.rows[0].id_curier;
        
        const query = `
            SELECT c.*, cl.nume as nume_expeditor, cl.telefon as telefon_expeditor
            FROM Colete c
            LEFT JOIN Livrari l ON c.id_colet = l.id_colet
            LEFT JOIN Clienti cl ON c.id_client_expeditor = cl.id_client
            WHERE l.id_curier = $1 AND DATE(l.data_planificata) = CURRENT_DATE
            ORDER BY c.id_colet DESC
        `;
        const result = await pool.query(query, [curierId]);
        
        // Cenzurare date
        const maskedRows = result.rows.map(row => ({
            ...row,
            nume_expeditor: maskData(row.nume_expeditor, 'name'),
            telefon_expeditor: maskData(row.telefon_expeditor, 'phone')
        }));
        
        res.json({
            success: true,
            data: maskedRows
        });
    } catch (e) { 
        console.error("Eroare API curier colete:", e);
        res.status(500).json({
            success: false,
            error: e.message 
        });
    }
});

app.get("/api/curier/informatii", authenticateToken, authorizeRoles('Curier'), async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Găsim id_curier asociat utilizatorului
        const userQuery = await pool.query(
            "SELECT id_curier FROM Utilizatori_Sistem WHERE id_utilizator = $1",
            [userId]
        );
        
        if (userQuery.rows.length === 0 || !userQuery.rows[0].id_curier) {
            return res.status(404).json({ 
                success: false,
                error: 'Nu aveți curier asociat.' 
            });
        }
        
        const curierId = userQuery.rows[0].id_curier;
        
        const query = `
            SELECT c.*, m.numar_inmatriculare, m.model, m.consum_mediu, s.adresa as sediu
            FROM Curieri c
            LEFT JOIN Masini m ON c.id_masina = m.id_masina
            LEFT JOIN Sedii s ON c.id_sediu = s.id_sediu
            WHERE c.id_curier = $1
        `;
        const result = await pool.query(query, [curierId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ 
                success: false,
                error: 'Curierul nu a fost găsit.' 
            });
        }
        
        // Cenzurare date sensibile
        const curierInfo = result.rows[0];
        curierInfo.nume = maskData(curierInfo.nume, 'name');
        curierInfo.telefon = maskData(curierInfo.telefon, 'phone');
        
        res.json({
            success: true,
            data: curierInfo
        });
    } catch (e) { 
        console.error("Eroare API curier informatii:", e);
        res.status(500).json({
            success: false,
            error: e.message 
        });
    }
});

// --- DASHBOARD STATISTICI ---
app.get("/api/dashboard/stats", authenticateToken, async (req, res) => {
    try {
        // Colete azi
        const coleteAziQuery = await pool.query(`
            SELECT COUNT(*) as total
            FROM Colete 
            WHERE DATE(data_primire) = CURRENT_DATE
        `);
        
        // Livrări azi
        const livrariAziQuery = await pool.query(`
            SELECT COUNT(*) as total
            FROM Livrari 
            WHERE DATE(data_planificata) = CURRENT_DATE AND stare = 'livrat'
        `);
        
        // Ramburs total azi
        const rambursAziQuery = await pool.query(`
            SELECT COALESCE(SUM(ramburs_colectat), 0) as total
            FROM Livrari 
            WHERE DATE(data_planificata) = CURRENT_DATE
        `);
        
        // Retururi azi
        const retururiAziQuery = await pool.query(`
            SELECT COUNT(*) as total
            FROM Retururi 
            WHERE DATE(data_retur) = CURRENT_DATE
        `);
        
        res.json({
            success: true,
            data: {
                coleteAzi: parseInt(coleteAziQuery.rows[0].total) || 0,
                livrariAzi: parseInt(livrariAziQuery.rows[0].total) || 0,
                rambursAzi: parseFloat(rambursAziQuery.rows[0].total) || 0,
                retururiAzi: parseInt(retururiAziQuery.rows[0].total) || 0
            }
        });
    } catch (e) {
        console.error("Eroare API dashboard:", e);
        res.status(500).json({
            success: false,
            error: e.message
        });
    }
});

// --- EXPORT DATE ---

// --- EXPORT LIVRĂRI ---
app.get("/api/export/livrari/:format", authenticateToken, async (req, res) => {
    try {
        const { format } = req.params;
        const { filterDate, filterSediu, showRambursOnly } = req.query;
        
        let whereConditions = [];
        let queryParams = [];
        let paramCounter = 1;
        
        if (filterDate) {
            whereConditions.push(`DATE(l.data_planificata) = $${paramCounter}`);
            queryParams.push(filterDate);
            paramCounter++;
        }
        
        if (filterSediu && filterSediu !== 'Toate') {
            whereConditions.push(`s.id_sediu = $${paramCounter}`);
            queryParams.push(filterSediu);
            paramCounter++;
        }
        
        if (showRambursOnly === 'true') {
            whereConditions.push(`l.ramburs_colectat > 0`);
        }
        
        const whereClause = whereConditions.length > 0 
            ? `WHERE ${whereConditions.join(' AND ')}` 
            : '';

        // AM SCOS data_actualizare DIN QUERY
        const query = `
            SELECT 
                l.id_livrare as "ID",
                col.cod_colet as "Cod Colet",
                c.nume as "Nume Curier",
                s.adresa as "Sediu",
                TO_CHAR(l.data_planificata, 'DD-MM-YYYY HH24:MI') as "Data Planificată",
                l.stare as "Stare",
                l.ramburs_colectat as "Ramburs Colectat (RON)",
                l.combustibil_consumat as "Combustibil Consumat (L)"
            FROM Livrari l
            LEFT JOIN Curieri c ON l.id_curier = c.id_curier
            LEFT JOIN Colete col ON l.id_colet = col.id_colet
            LEFT JOIN Sedii s ON c.id_sediu = s.id_sediu
            ${whereClause}
            ORDER BY l.data_planificata DESC
        `;
        
        const result = await pool.query(query, queryParams);
        
        const data = result.rows.map(row => ({
            ...row,
            "Nume Curier": maskData(row["Nume Curier"], 'name')
        }));
        
        if (format === 'excel') {
            const columns = [
                { header: 'ID', key: 'ID', width: 10 },
                { header: 'Cod Colet', key: 'Cod Colet', width: 20 },
                { header: 'Nume Curier', key: 'Nume Curier', width: 25 },
                { header: 'Sediu', key: 'Sediu', width: 30 },
                { header: 'Data Planificată', key: 'Data Planificată', width: 20 },
                { header: 'Stare', key: 'Stare', width: 15 },
                { header: 'Ramburs Colectat (RON)', key: 'Ramburs Colectat (RON)', width: 20 },
                { header: 'Combustibil Consumat (L)', key: 'Combustibil Consumat (L)', width: 25 }
            ];
            
            const workbook = await generateExcel(data, columns, 'Livrări');
            
            // Sumar
            const summarySheet = workbook.addWorksheet('Sumar');
            summarySheet.columns = [{ header: 'Metrică', key: 'metric', width: 30 }, { header: 'Valoare', key: 'value', width: 20 }];
            
            const totalLivrari = data.length;
            const totalRamburs = data.reduce((sum, row) => sum + (parseFloat(row['Ramburs Colectat (RON)']) || 0), 0);
            
            summarySheet.addRow({ metric: 'Total Livrări', value: totalLivrari });
            summarySheet.addRow({ metric: 'Total Ramburs (RON)', value: totalRamburs.toFixed(2) });
            summarySheet.addRow({ metric: 'Data export', value: new Date().toLocaleDateString('ro-RO') });
            
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=livrari_${new Date().toISOString().slice(0,10)}.xlsx`);
            
            await workbook.xlsx.write(res);
            res.end();
            
        } else if (format === 'csv') {
            const csv = generateCSV(data);
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename=livrari_${new Date().toISOString().slice(0,10)}.csv`);
            res.send(csv);
        } else {
            res.status(400).json({ success: false, error: 'Format necunoscut.' });
        }
        
    } catch (error) {
        console.error("Eroare export livrări:", error);
        res.status(500).json({ success: false, error: 'Eroare la generarea exportului: ' + error.message });
    }
});

// --- EXPORT COLETE ---
app.get("/api/export/colete/:format", authenticateToken, async (req, res) => {
    try {
        const { format } = req.params;
        const { filterType, filterValue, filterSediu } = req.query;
        
        // Construim condițiile WHERE
        let whereConditions = [];
        let queryParams = [];
        let paramCounter = 1;
        
        if (filterType && filterValue) {
            if (filterType === 'zi') {
                whereConditions.push(`DATE(c.data_primire) = $${paramCounter}`);
                queryParams.push(filterValue);
                paramCounter++;
            } else if (filterType === 'luna') {
                whereConditions.push(`TO_CHAR(c.data_primire, 'YYYY-MM') = $${paramCounter}`);
                queryParams.push(filterValue);
                paramCounter++;
            } else if (filterType === 'an') {
                whereConditions.push(`EXTRACT(YEAR FROM c.data_primire) = $${paramCounter}`);
                queryParams.push(filterValue);
                paramCounter++;
            }
        }
        
        if (filterSediu && filterSediu !== 'Toate') {
            whereConditions.push(`s.id_sediu = $${paramCounter}`);
            queryParams.push(parseInt(filterSediu));
            paramCounter++;
        }
        
        const whereClause = whereConditions.length > 0 
            ? `WHERE ${whereConditions.join(' AND ')}` 
            : '';

        const query = `
            SELECT 
                c.id_colet as "ID",
                c.cod_colet as "Cod Colet",
                cl.nume as "Expeditor",
                cl.telefon as "Telefon Expeditor",
                s.adresa as "Sediu",
                TO_CHAR(c.data_primire, 'DD-MM-YYYY HH24:MI') as "Data Primire",
                c.greutate_fizica_kg as "Greutate (kg)",
                c.volum_m3 as "Volum (m³)",
                c.cost_transport as "Cost Transport (RON)",
                c.mod_achitare as "Mod Achitare",
                c.ramburs as "Ramburs (RON)",
                c.stare as "Stare"
            FROM Colete c
            LEFT JOIN Clienti cl ON c.id_client_expeditor = cl.id_client
            LEFT JOIN Sedii s ON c.id_sediu = s.id_sediu
            ${whereClause}
            ORDER BY c.data_primire DESC
        `;
        
        const result = await pool.query(query, queryParams);
        
        // Cenzurare date
        const data = result.rows.map(row => ({
            ...row,
            "Expeditor": maskData(row["Expeditor"], 'name'),
            "Telefon Expeditor": maskData(row["Telefon Expeditor"], 'phone')
        }));
        
        if (format === 'excel') {
            const columns = [
                { header: 'ID', key: 'ID', width: 10 },
                { header: 'Cod Colet', key: 'Cod Colet', width: 20 },
                { header: 'Expeditor', key: 'Expeditor', width: 25 },
                { header: 'Telefon Expeditor', key: 'Telefon Expeditor', width: 20 },
                { header: 'Sediu', key: 'Sediu', width: 30 },
                { header: 'Data Primire', key: 'Data Primire', width: 20 },
                { header: 'Greutate (kg)', key: 'Greutate (kg)', width: 15 },
                { header: 'Volum (m³)', key: 'Volum (m³)', width: 15 },
                { header: 'Cost Transport (RON)', key: 'Cost Transport (RON)', width: 20 },
                { header: 'Mod Achitare', key: 'Mod Achitare', width: 15 },
                { header: 'Ramburs (RON)', key: 'Ramburs (RON)', width: 15 },
                { header: 'Stare', key: 'Stare', width: 15 },
                { header: 'Observații', key: 'Observații', width: 30 }
            ];
            
            const workbook = await generateExcel(data, columns, 'Colete');
            
            // Adăugăm sumar
            const summarySheet = workbook.addWorksheet('Sumar');
            summarySheet.columns = [
                { header: 'Metrică', key: 'metric', width: 30 },
                { header: 'Valoare', key: 'value', width: 20 }
            ];
            
            const totalColete = data.length;
            const totalRamburs = data.reduce((sum, row) => sum + (parseFloat(row['Ramburs (RON)']) || 0), 0);
            const totalTransport = data.reduce((sum, row) => sum + (parseFloat(row['Cost Transport (RON)']) || 0), 0);
            const coleteLivrate = data.filter(row => row['Stare'] === 'livrat').length;
            
            summarySheet.addRow({ metric: 'Total Colete', value: totalColete });
            summarySheet.addRow({ metric: 'Colete Livrate', value: coleteLivrate });
            summarySheet.addRow({ metric: 'Total Ramburs (RON)', value: totalRamburs.toFixed(2) });
            summarySheet.addRow({ metric: 'Total Transport (RON)', value: totalTransport.toFixed(2) });
            summarySheet.addRow({ metric: 'Data export', value: new Date().toLocaleDateString('ro-RO') });
            
            summarySheet.getRow(1).font = { bold: true };
            summarySheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0F0E0' }
            };
            
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=colete_${new Date().toISOString().slice(0,10)}.xlsx`);
            
            await workbook.xlsx.write(res);
            res.end();
            
        } else if (format === 'csv') {
            const csv = generateCSV(data);
            
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename=colete_${new Date().toISOString().slice(0,10)}.csv`);
            res.send(csv);
            
        } else {
            res.status(400).json({
                success: false,
                error: 'Format necunoscut.'
            });
        }
        
    } catch (error) {
        console.error("Eroare export colete:", error);
        res.status(500).json({
            success: false,
            error: 'Eroare la generarea exportului: ' + error.message
        });
    }
});

// --- EXPORT RETURURI ---
app.get("/api/export/retururi/:format", authenticateToken, async (req, res) => {
    try {
        const { format } = req.params;
        const { filterType, filterValue } = req.query;
        
        let whereConditions = [];
        let queryParams = [];
        let paramCounter = 1;
        
        if (filterType && filterValue) {
            if (filterType === 'zi') {
                whereConditions.push(`DATE(r.data_retur) = $${paramCounter}`);
                queryParams.push(filterValue);
                paramCounter++;
            } else if (filterType === 'luna') {
                whereConditions.push(`TO_CHAR(r.data_retur, 'YYYY-MM') = $${paramCounter}`);
                queryParams.push(filterValue);
                paramCounter++;
            }
        }
        
        const whereClause = whereConditions.length > 0 
            ? `WHERE ${whereConditions.join(' AND ')}` 
            : '';

        // MODIFICARE AICI: Am schimbat 'r.stare' cu 'col.stare'
        const query = `
            SELECT 
                r.id_retur as "ID",
                col.cod_colet as "Cod Colet",
                TO_CHAR(r.data_retur, 'DD-MM-YYYY HH24:MI') as "Data Retur",
                r.motiv as "Motiv",
                r.cost_retur as "Cost Retur (RON)",
                col.stare as "Stare"
            FROM Retururi r
            LEFT JOIN Colete col ON r.id_colet = col.id_colet
            ${whereClause}
            ORDER BY r.data_retur DESC
        `;
        
        const result = await pool.query(query, queryParams);
        const data = result.rows;
        
        if (format === 'excel') {
            const columns = [
                { header: 'ID', key: 'ID', width: 10 },
                { header: 'Cod Colet', key: 'Cod Colet', width: 20 },
                { header: 'Data Retur', key: 'Data Retur', width: 20 },
                { header: 'Motiv', key: 'Motiv', width: 25 },
                { header: 'Cost Retur (RON)', key: 'Cost Retur (RON)', width: 20 },
                { header: 'Stare', key: 'Stare', width: 15 }
            ];
            
            const workbook = await generateExcel(data, columns, 'Retururi');
            
            // Sumar
            const summarySheet = workbook.addWorksheet('Sumar');
            summarySheet.columns = [{ header: 'Metrică', key: 'metric', width: 30 }, { header: 'Valoare', key: 'value', width: 20 }];
            
            const totalRetururi = data.length;
            const totalCost = data.reduce((sum, row) => sum + (parseFloat(row['Cost Retur (RON)']) || 0), 0);
            
            summarySheet.addRow({ metric: 'Total Retururi', value: totalRetururi });
            summarySheet.addRow({ metric: 'Total Cost Retur (RON)', value: totalCost.toFixed(2) });
            summarySheet.addRow({ metric: 'Data export', value: new Date().toLocaleDateString('ro-RO') });
            
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=retururi_${new Date().toISOString().slice(0,10)}.xlsx`);
            
            await workbook.xlsx.write(res);
            res.end();
            
        } else if (format === 'csv') {
            const csv = generateCSV(data);
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename=retururi_${new Date().toISOString().slice(0,10)}.csv`);
            res.send(csv);
        } else {
            res.status(400).json({ success: false, error: 'Format necunoscut.' });
        }
        
    } catch (error) {
        console.error("Eroare export retururi:", error);
        res.status(500).json({ success: false, error: 'Eroare la generarea exportului: ' + error.message });
    }
});

// --- EXPORT RUTE ---
app.get("/api/export/rute/:format", authenticateToken, async (req, res) => {
    try {
        const { format } = req.params;
        
        const query = `
            SELECT
                r.id_ruta as "ID",
                r.nume_ruta as "Nume Rută",
                op.nume as "Oraș Plecare",
                od.nume as "Oraș Destinație",
                r.distanta_maxima_km as "Distanță (km)",
                tm.denumire as "Tip Mașină",
                CASE WHEN s.id_subcontractor IS NOT NULL THEN 'Subcontractor' 
                     WHEN c.id_curier IS NOT NULL THEN 'Firma' 
                     ELSE 'Nealocat' END as "Tip Alocare",
                COALESCE(c.nume, s.denumire, '-') as "Responsabil"
            FROM Rute r
            LEFT JOIN Orase op ON r.id_oras_plecare = op.id_oras
            LEFT JOIN Orase od ON r.id_oras_destinatie = od.id_oras
            LEFT JOIN Tipuri_Masina tm ON r.id_tip_masina = tm.id_tip_masina
            LEFT JOIN Alocari_Rute ar ON r.id_ruta = ar.id_ruta AND ar.activa = TRUE
            LEFT JOIN Curieri c ON ar.id_curier = c.id_curier
            LEFT JOIN Subcontractori s ON ar.id_subcontractor = s.id_subcontractor
            ORDER BY r.id_ruta DESC
        `;
        
        const result = await pool.query(query);
        
        // Cenzurare date
        const data = result.rows.map(row => ({
            ...row,
            "Responsabil": maskData(row["Responsabil"], 'name')
        }));
        
        if (format === 'excel') {
            const columns = [
                { header: 'ID', key: 'ID', width: 10 },
                { header: 'Nume Rută', key: 'Nume Rută', width: 20 },
                { header: 'Oraș Plecare', key: 'Oraș Plecare', width: 20 },
                { header: 'Oraș Destinație', key: 'Oraș Destinație', width: 20 },
                { header: 'Distanță (km)', key: 'Distanță (km)', width: 15 },
                { header: 'Tip Mașină', key: 'Tip Mașină', width: 20 },
                { header: 'Tip Alocare', key: 'Tip Alocare', width: 15 },
                { header: 'Responsabil', key: 'Responsabil', width: 25 }
            ];
            
            const workbook = await generateExcel(data, columns, 'Rute');
            
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=rute_${new Date().toISOString().slice(0,10)}.xlsx`);
            
            await workbook.xlsx.write(res);
            res.end();
            
        } else if (format === 'csv') {
            const csv = generateCSV(data);
            
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename=rute_${new Date().toISOString().slice(0,10)}.csv`);
            res.send(csv);
            
        } else {
            res.status(400).json({
                success: false,
                error: 'Format necunoscut.'
            });
        }
        
    } catch (error) {
        console.error("Eroare export rute:", error);
        res.status(500).json({
            success: false,
            error: 'Eroare la generarea exportului: ' + error.message
        });
    }
});

// --- HEALTH CHECK ---
app.get("/api/health", (req, res) => {
    res.json({ 
        status: "OK", 
        timestamp: new Date().toISOString(),
        service: "FastCourier API",
        version: "1.0.0"
    });
});

// --- INITIALIZARE APLICATIE ---
async function initializeApp() {
    console.log("========================================");
    console.log("FAST COURIER - Management System");
    console.log("========================================");
    
    // Verificare conexiune baza de date
    try {
        await pool.query("SELECT 1");
        console.log("✓ Conectat la baza de date");
    } catch (error) {
        console.error("✗ Eroare conexiune baza de date:", error.message);
        process.exit(1);
    }
    
    // Configurare baza de date
    await setupDatabase();
    
    // Pornire server
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`\n✓ Serverul rulează pe portul ${PORT}`);
        console.log(`✓ Accesați aplicația la: http://localhost:${PORT}`);
        console.log("✓ Endpoint-uri export disponibile:");
        console.log("  - /api/export/livrari/:format (excel/csv)");
        console.log("  - /api/export/colete/:format (excel/csv)");
        console.log("  - /api/export/retururi/:format (excel/csv)");
        console.log("  - /api/export/rute/:format (excel/csv)");
        console.log("========================================\n");
    });
}

// Pornește aplicația
initializeApp().catch(console.error);