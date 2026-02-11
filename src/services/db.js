import initSqlJs from 'sql.js';
import { TERRITORIES_MAPPING, findTerritoryForSchool } from '../constants/territories';

const SQL_WASM_URL = '/sql-wasm.wasm';

// --- INITIALISATION ---
export const initDB = async () => {
  try {
    const SQL = await initSqlJs({ locateFile: () => SQL_WASM_URL });
    return new SQL.Database();
  } catch (error) {
    console.error("Erreur init SQL:", error);
    throw error;
  }
};

// --- SYNC TERRITOIRES ---
export const syncSchoolTerritories = (db) => {
  try {
    const updateStmt = db.prepare("INSERT OR REPLACE INTO school_details (school_name, territory) VALUES (?, ?)");
    db.exec("BEGIN TRANSACTION");
    TERRITORIES_MAPPING.forEach(territory => {
        territory.schools.forEach(schoolName => {
            updateStmt.run([schoolName, territory.name]);
        });
    });
    
    // Rattrapage orphelins
    const orphanSchools = db.exec(`
        SELECT DISTINCT d.base_school 
        FROM deliveries d 
        LEFT JOIN school_details s ON d.base_school = s.school_name 
        WHERE s.school_name IS NULL
    `);
    
    if (orphanSchools.length > 0) {
        orphanSchools[0].values.flat().forEach(schoolName => {
            const territory = findTerritoryForSchool(schoolName);
            updateStmt.run([schoolName, territory]);
        });
    }
    
    db.exec("COMMIT");
    updateStmt.free();
  } catch (e) { console.error("Erreur sync territoires:", e); }
};

// --- TABLES ---
export const createTables = (db) => {
  try {
    // 1. Table des Livraisons
    db.run(`CREATE TABLE IF NOT EXISTS deliveries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id TEXT NOT NULL,
        base_school TEXT NOT NULL,
        school_type TEXT NOT NULL,
        week_number TEXT,
        regime TEXT NOT NULL,
        monday INTEGER DEFAULT 0, tuesday INTEGER DEFAULT 0, wednesday INTEGER DEFAULT 0, thursday INTEGER DEFAULT 0, friday INTEGER DEFAULT 0, total INTEGER DEFAULT 0,
        document_date TEXT, school_year TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_school_week ON deliveries(base_school, week_number);`);

    // 2. Table des Grèves
    db.run(`CREATE TABLE IF NOT EXISTS strike_days (
        id INTEGER PRIMARY KEY AUTOINCREMENT, school_year TEXT NOT NULL, week_number TEXT NOT NULL, day TEXT NOT NULL, strike_date TEXT,
        UNIQUE(school_year, week_number, day)
      );`);

    // 3. Table Détails Écoles (Territoires)
    db.run(`CREATE TABLE IF NOT EXISTS school_details ( school_name TEXT PRIMARY KEY, territory TEXT DEFAULT 'Non assigné' );`);
    
    // 4. Table CANTINES (Import CSV)
    db.run(`CREATE TABLE IF NOT EXISTS cantines (
        school_name TEXT PRIMARY KEY, 
        provider TEXT,
        territory TEXT,
        production_mode TEXT,
        ar TEXT,
        inox TEXT
      );`);

    console.log("✅ Tables synchronisées (vAvecCantines).");
    syncSchoolTerritories(db);
    
  } catch (error) { console.error("❌ Erreur tables:", error); throw error; }
};

// --- IMPORTATION DU CSV CANTINES (CORRIGÉ & ROBUSTE) ---
export const importCantinesCSV = async (db, fileContent) => {
    try {
        // 1. Normalisation des sauts de ligne (Windows/Mac/Unix)
        const normalizedContent = fileContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const lines = normalizedContent.split('\n');
        
        // 2. Filtrage lignes vides
        const nonEmptyLines = lines.filter(line => line.trim() !== '');
        
        if (nonEmptyLines.length < 2) return 0; // Pas de données (juste entête ou vide)

        // 3. Détection intelligente du séparateur (, ou ;) sur la première ligne
        const header = nonEmptyLines[0];
        const commaCount = (header.match(/,/g) || []).length;
        const semiCount = (header.match(/;/g) || []).length;
        const separator = semiCount > commaCount ? ';' : ','; // Si plus de ; que de , alors c'est un CSV Excel FR
        
        console.log(`Import CSV : Séparateur détecté = '${separator}'`);

        db.exec("BEGIN TRANSACTION");
        
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO cantines (school_name, provider, territory, production_mode, ar, inox)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        let count = 0;
        // On saute l'en-tête (ligne 0)
        const dataLines = nonEmptyLines.slice(1);

        for (const line of dataLines) {
            const cleanL = line.trim();
            if (!cleanL) continue;

            // Découpage avec le séparateur détecté
            const cols = cleanL.split(separator).map(c => c.trim().replace(/^"|"$/g, ''));
            
            // Mapping selon votre fichier : base_school, Prestataire, Territoire, Mode, AR, school_type, Inox
            // On vérifie qu'il y a assez de colonnes (au moins 7)
            if (cols.length >= 7) {
                const schoolName = cols[0];
                const provider = cols[1];
                const territory = cols[2];
                const prodMode = cols[3];
                const ar = cols[4];
                // col 5 = school_type (on saute)
                const inox = cols[6];

                stmt.run([schoolName, provider, territory, prodMode, ar, inox]);
                count++;
                
                // On en profite pour mettre à jour le territoire dans la table système
                if (territory) {
                    db.run("INSERT OR REPLACE INTO school_details (school_name, territory) VALUES (?, ?)", [schoolName, territory]);
                }
            }
        }
        
        stmt.free();
        db.exec("COMMIT");
        return count;
    } catch (e) {
        console.error("Erreur import CSV:", e);
        if (db) { try { db.exec("ROLLBACK"); } catch(e2) {} }
        throw e;
    }
};

// --- INSERTION (Avec protection anti-doublon) ---
export const insertDelivery = (db, data) => {
  try {
    const checkStmt = db.prepare(`SELECT 1 FROM deliveries WHERE base_school = ? AND week_number = ? AND school_type = ? AND school_year = ? LIMIT 1`);
    checkStmt.bind([data.base_school, data.week_number, data.school_type, data.school_year]);
    
    if (checkStmt.step()) { 
        checkStmt.free(); 
        return false; // Déjà existant
    }
    checkStmt.free();

    const stmt = db.prepare(`INSERT INTO deliveries (
        document_id, base_school, school_type, week_number, regime, 
        monday, tuesday, wednesday, thursday, friday, total, document_date, school_year
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    stmt.run([
      data.document_id, data.base_school, data.school_type, data.week_number, data.regime,
      data.monday, data.tuesday, data.wednesday, data.thursday, data.friday, data.total, data.document_date, data.school_year
    ]);
    stmt.free();

    const existsSchool = db.exec("SELECT 1 FROM school_details WHERE school_name = ?", [data.base_school]);
    if (existsSchool.length === 0) {
      const territory = findTerritoryForSchool(data.base_school);
      db.run("INSERT INTO school_details (school_name, territory) VALUES (?, ?)", [data.base_school, territory]);
    }
    
    return true;
  } catch (error) {
    console.error("Erreur insert:", error);
    throw error;
  }
};

// --- LECTURE & FILTRES ---
export const getUniqueValues = (db, column) => {
  try {
    if (column === 'territory') {
        const res = db.exec("SELECT DISTINCT territory FROM school_details WHERE territory IS NOT NULL AND territory != 'Non assigné' ORDER BY territory");
        return res.length ? res[0].values.flat() : [];
    }
    const res = db.exec(`SELECT DISTINCT ${column} FROM deliveries WHERE ${column} IS NOT NULL AND ${column} != '' ORDER BY ${column}`);
    return res.length ? res[0].values.flat() : [];
  } catch (error) { return []; }
};

export const searchDeliveries = (db, filters) => {
  try {
    let query = `
        SELECT d.*, s.territory 
        FROM deliveries d
        LEFT JOIN school_details s ON d.base_school = s.school_name
        WHERE 1=1
    `;
    const params = [];

    if (filters.year && filters.year !== 'all') { query += " AND d.school_year = ?"; params.push(filters.year); }
    if (filters.week && filters.week !== 'all') { query += " AND d.week_number = ?"; params.push(filters.week); }
    if (filters.school && filters.school !== 'all') { query += " AND d.base_school = ?"; params.push(filters.school); }
    if (filters.type && filters.type !== 'all') { query += " AND d.school_type LIKE ?"; params.push(`%${filters.type}%`); }
    
    if (filters.territory && filters.territory !== 'all') {
        query += " AND s.territory = ?";
        params.push(filters.territory);
    }

    query += " ORDER BY d.week_number, d.base_school, d.school_type";

    const stmt = db.prepare(query);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return results;
  } catch (error) { return []; }
};

// --- SYNTHÈSE ---
export const getSummaryBySchool = (db, filters) => {
  try {
    let query = `
      SELECT 
        d.base_school, d.school_type, s.territory,
        COUNT(DISTINCT d.week_number) as nb_weeks,
        SUM(CASE WHEN EXISTS (SELECT 1 FROM strike_days k WHERE k.school_year = d.school_year AND k.week_number = d.week_number AND k.day = 'monday') THEN 0 ELSE d.monday END) as total_mon,
        SUM(CASE WHEN EXISTS (SELECT 1 FROM strike_days k WHERE k.school_year = d.school_year AND k.week_number = d.week_number AND k.day = 'tuesday') THEN 0 ELSE d.tuesday END) as total_tue,
        SUM(0) as total_wed,
        SUM(CASE WHEN EXISTS (SELECT 1 FROM strike_days k WHERE k.school_year = d.school_year AND k.week_number = d.week_number AND k.day = 'thursday') THEN 0 ELSE d.thursday END) as total_thu,
        SUM(CASE WHEN EXISTS (SELECT 1 FROM strike_days k WHERE k.school_year = d.school_year AND k.week_number = d.week_number AND k.day = 'friday') THEN 0 ELSE d.friday END) as total_fri
      FROM deliveries d
      LEFT JOIN school_details s ON d.base_school = s.school_name
      WHERE 1=1
    `;
    
    const params = [];
    if (filters.year && filters.year !== 'all') { query += " AND d.school_year = ?"; params.push(filters.year); }
    if (filters.week && filters.week !== 'all') { query += " AND d.week_number = ?"; params.push(filters.week); }
    
    if (filters.territory && filters.territory !== 'all') {
        query += " AND s.territory = ?";
        params.push(filters.territory);
    }
    
    query += " GROUP BY d.base_school, d.school_type ORDER BY s.territory, d.base_school";

    const stmt = db.prepare(query);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      row.grand_total = row.total_mon + row.total_tue + row.total_thu + row.total_fri;
      results.push(row);
    }
    stmt.free();
    return results;
  } catch (error) { return []; }
};

// --- GESTION GREVES ---
export const addStrike = (db, strike) => {
  try {
    db.run(`INSERT OR IGNORE INTO strike_days (school_year, week_number, day, strike_date) VALUES (?, ?, ?, ?)`, [strike.year, strike.week, strike.day, strike.date]);
    const valid = ['monday','tuesday','wednesday','thursday','friday'];
    if(valid.includes(strike.day)) db.run(`UPDATE deliveries SET ${strike.day} = 0 WHERE school_year = ? AND week_number = ?`, [strike.year, strike.week]);
    return true;
  } catch (e) { return false; }
};
export const removeStrike = (db, id) => { try { db.run(`DELETE FROM strike_days WHERE id = ?`, [id]); return true; } catch (e) { return false; } };
export const getStrikes = (db) => { try { const res = db.exec(`SELECT * FROM strike_days ORDER BY school_year DESC, week_number DESC`); return res.length ? res[0].values.map((v,i)=>({id:v[0],year:v[1],week:v[2],day:v[3],date:v[4]})) : []; } catch (e) { return []; } };

// --- REFERENTIEL ECOLES ---
export const getSchoolsConfig = (db) => {
    try {
        const res = db.exec("SELECT * FROM school_details ORDER BY territory, school_name");
        return res.length ? res[0].values.map((row) => {
             const o = {}; res[0].columns.forEach((c, idx) => o[c] = row[idx]); return o;
        }) : [];
    } catch (e) { return []; }
};
export const updateSchoolTerritory = (db, schoolName, territory) => {
    try {
        db.run("UPDATE school_details SET territory = ? WHERE school_name = ?", [territory, schoolName]);
        return true;
    } catch (e) { return false; }
};