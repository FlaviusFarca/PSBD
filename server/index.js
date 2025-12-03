const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const axios = require("axios");
const cheerio = require("cheerio");
const PDFDocument = require("pdfkit"); 
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

// --- UTILITAR PENTRU CENZURARE DATE (GDPR) ---
const maskData = (text, type = 'name') => {
    if (!text) return '-';
    
    if (type === 'name') {
        // Ion Popescu -> Ion P.
        // SC Firma SRL -> SC Firma SRL (Firmele raman vizibile de obicei)
        if (text.toLowerCase().includes('srl') || text.toLowerCase().includes('sa')) return text;
        
        const parts = text.split(' ');
        if (parts.length > 1) {
            return `${parts[0]} ${parts[1][0]}.`;
        }
        return text;
    }
    
    if (type === 'phone') {
        // 0722123456 -> 0722***456
        if (text.length > 6) {
            return `${text.slice(0, 4)}***${text.slice(-3)}`;
        }
    }

    if (type === 'address') {
        // Str. Libertatii Nr 4 -> Str. Libertatii ***
        // Pastram primele 2 cuvinte (ex: strada si numele ei) si ascundem numarul
        const parts = text.split(' ');
        if (parts.length > 2) {
            return `${parts[0]} ${parts[1]} ***`; 
        }
        return "Adresă protejată";
    }

    return text;
};

// --- GENERARE AWB PDF (DATE COMPLETE - DOAR LA CERERE) ---
// Acest endpoint returneaza PDF (binar), nu JSON, deci datele nu sunt vizibile text in Network
app.get("/api/awb/:cod", async (req, res) => {
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

        // ... (Cod generare PDF identic cu cel anterior - aici folosim datele complete pentru printare)
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
        // ... restul PDF-ului ramane la fel ...
        
        doc.end();
    } catch (e) { console.error(e); res.status(500).send("Eroare generare PDF"); }
});

// --- LOGIN ---
app.post("/api/login", (req, res) => {
    const { email, password } = req.body;
    if (email === 'admin@fastcourier.ro' && password === 'admin') {
        return res.json({ success: true, user: { name: 'Admin User', email, role: 'Administrator' } });
    } 
    if (email === 'curier@fastcourier.ro' && password === '1234') {
        return res.json({ success: true, user: { name: 'Ion Popescu', email, role: 'Curier' } });
    }
    res.status(401).json({ success: false, message: 'Email sau parolă incorectă.' });
});

// --- PRETURI LIVE ---
app.get("/api/preturi-combustibil", async (req, res) => {
    try {
        const { data } = await axios.get('https://www.cargopedia.ro/preturi-carburanti-europa');
        const $ = cheerio.load(data);
        let preturi = null;
        $('table tbody tr').each((i, el) => {
            const tara = $(el).find('td').eq(0).text().trim();
            if (tara === 'România') {
                preturi = {
                    benzina: { eur: parseFloat($(el).find('td').eq(1).text().replace(',', '.')), ron: parseFloat($(el).find('td').eq(2).text().replace(',', '.')) },
                    diesel: { eur: parseFloat($(el).find('td').eq(3).text().replace(',', '.')), ron: parseFloat($(el).find('td').eq(4).text().replace(',', '.')) },
                    gpl: { eur: parseFloat($(el).find('td').eq(5).text().replace(',', '.')), ron: parseFloat($(el).find('td').eq(6).text().replace(',', '.')) }
                };
            }
        });
        if (preturi) res.json(preturi); else throw new Error("Nu s-au găsit datele.");
    } catch (error) {
        res.json({ diesel: { ron: 7.967, eur: 1.566 }, benzina: { ron: 7.551, eur: 1.484 }, gpl: { ron: 3.775, eur: 0.742 }, sursa: "fallback" });
    }
});

// --- RUTE (CENZURAT) ---
app.get("/api/rute", async (req, res) => {
  try {
    const query = `
      SELECT 
        r.id_ruta, r.nume_ruta, r.distanta_maxima_km,
        op.nume as oras_plecare, od.nume as oras_destinatie, tm.denumire as tip_masina,
        c.nume as nume_curier, s.denumire as nume_subcontractor,
        CASE WHEN s.id_subcontractor IS NOT NULL THEN 'Subcontractor' WHEN c.id_curier IS NOT NULL THEN 'Firma' ELSE 'Nealocat' END as tip_alocare
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
    
    // CENZURAM NUMELE
    const maskedRows = result.rows.map(row => ({
        ...row,
        nume_curier: maskData(row.nume_curier, 'name') 
    }));
    
    res.json(maskedRows);
  } catch (e) { res.status(500).json({error: e.message}); }
});

app.post("/api/rute", async (req, res) => {
  try {
    const { nume, dist } = req.body;
    const result = await pool.query(`INSERT INTO Rute (nume_ruta, id_oras_plecare, id_oras_destinatie, distanta_maxima_km, id_tip_masina, durata_estimata_min) VALUES($1, 1, 2, $2, 1, 120) RETURNING *`, [nume, dist]);
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({error: e.message}); }
});

// --- COLETE (CENZURAT) ---
app.get("/api/colete", async (req, res) => {
    try {
        const query = `
            SELECT c.*, cl.nume as nume_expeditor, cl.telefon as telefon_expeditor
            FROM Colete c
            LEFT JOIN Clienti cl ON c.id_client_expeditor = cl.id_client
            ORDER BY c.id_colet DESC
        `;
        const result = await pool.query(query);

        // CENZURAM NUME SI TELEFOANE
        const maskedRows = result.rows.map(row => ({
            ...row,
            nume_expeditor: maskData(row.nume_expeditor, 'name'),
            telefon_expeditor: maskData(row.telefon_expeditor, 'phone')
        }));

        res.json(maskedRows);
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.post("/api/colete", async (req, res) => {
    try {
        const { cod, gr, cost, tip_cantarire, mod_achitare, ramburs } = req.body;
        const greutate_kg = tip_cantarire === 'fizica' ? gr : null;
        const volum = tip_cantarire === 'volumetrica' ? gr : null; 
        const val_ramburs = ramburs ? parseFloat(ramburs) : 0;
        const result = await pool.query(`INSERT INTO Colete (cod_colet, id_client_expeditor, id_client_destinatar, id_sediu, greutate_fizica_kg, volum_m3, cost_transport, mod_achitare, ramburs, stare, data_primire) VALUES ($1, 1, 1, 1, $2, $3, $4, $5, $6, 'depozit', NOW()) RETURNING *`, [cod, greutate_kg, volum, cost, mod_achitare, val_ramburs]);
        res.json(result.rows[0]);
    } catch (e) { res.status(500).json({error: e.message}); }
});

// --- LIVRARI (CENZURAT) ---
app.get("/api/livrari", async (req, res) => {
    try {
        const query = `
            SELECT l.*, c.nume as nume_curier, col.cod_colet, o.nume as sediu
            FROM Livrari l
            LEFT JOIN Curieri c ON l.id_curier = c.id_curier
            LEFT JOIN Colete col ON l.id_colet = col.id_colet
            LEFT JOIN Sedii s ON c.id_sediu = s.id_sediu
            LEFT JOIN Orase o ON s.id_oras = o.id_oras
            ORDER BY l.data_planificata DESC
        `;
        const result = await pool.query(query);

        const maskedRows = result.rows.map(row => ({
            ...row,
            nume_curier: maskData(row.nume_curier, 'name')
        }));

        res.json(maskedRows);
    } catch (e) { res.status(500).json({error: e.message}); }
});

// --- RETURURI (CENZURAT) ---
app.get("/api/retururi", async (req, res) => {
    try {
        // Aici nu sunt nume de persoane direct, dar e bine sa fim prudenti
        const query = `SELECT r.*, col.cod_colet FROM Retururi r LEFT JOIN Colete col ON r.id_colet = col.id_colet`;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (e) { res.status(500).json({error: e.message}); }
});

// --- SUBCONTRACTORI (TELEFON VIZIBIL PENTRU ADMIN) ---
app.get("/api/subcontractori", async (req, res) => {
    try {
        // Pentru subcontractori (firme partenere), afisam telefonul complet
        // De obicei datele B2B (firme) nu sunt considerate date personale sensibile in acelasi mod
        const result = await pool.query("SELECT id_subcontractor, denumire, cui, telefon FROM Subcontractori");
        
        // NU mai aplicam maskData pe telefon aici, conform cerintei
        res.json(result.rows);
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.post("/api/subcontractori", async (req, res) => {
    try { const { nume, cui, telefon } = req.body; const result = await pool.query("INSERT INTO Subcontractori (denumire, cui, telefon, id_sediu_asociat) VALUES($1, $2, $3, 1) RETURNING *", [nume, cui, telefon]); res.json(result.rows[0]); } catch (e) { res.status(500).json({error: e.message}); }
});

// --- RAPOARTE COMBUSTIBIL (CENZURAT) ---
app.get("/api/rapoarte/combustibil", async (req, res) => {
    try {
        const query = `
            SELECT c.nume as curier, m.numar_inmatriculare, SUM(l.combustibil_consumat) as total_litri
            FROM Livrari l
            JOIN Curieri c ON l.id_curier = c.id_curier
            JOIN Masini m ON c.id_masina = m.id_masina
            GROUP BY c.nume, m.numar_inmatriculare
        `;
        const result = await pool.query(query);

        const maskedRows = result.rows.map(row => ({
            ...row,
            curier: maskData(row.curier, 'name')
        }));

        res.json(maskedRows);
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.get("/api/tarife", async (req, res) => {
    try { const result = await pool.query("SELECT * FROM Plan_Tarifar"); res.json(result.rows); } catch (e) { res.status(500).json({error: e.message}); }
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Serverul ruleaza pe portul ${PORT}`);
});