import React, { createContext, useContext, useState, useEffect } from 'react';
import initSqlJs from 'sql.js';
// On importe la nouvelle fonction de synchro
import { createTables, syncSchoolTerritories } from '../services/db';

const DatabaseContext = createContext(null);

export const DatabaseProvider = ({ children }) => {
  const [db, setDb] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ records: 0, schools: 0 });

  useEffect(() => {
    const loadSQL = async () => {
      try {
        const SQL = await initSqlJs({
          locateFile: () => `/sql-wasm.wasm`
        });
        
        const newDb = new SQL.Database();
        createTables(newDb); // createTables appelle maintenant syncSchoolTerritories automatiquement
        setDb(newDb);
        setIsLoaded(true);
        updateStats(newDb);
        console.log("Base de données initialisée.");
      } catch (err) {
        setError(err.message);
        console.error("Erreur init contexte BDD:", err);
      }
    };
    loadSQL();
  }, []);

  const updateStats = (database) => {
    if (!database) return;
    try {
      const res = database.exec("SELECT COUNT(*) as total, COUNT(DISTINCT base_school) as schools FROM deliveries");
      if (res.length > 0) {
        setStats({
          records: res[0].values[0][0],
          schools: res[0].values[0][1]
        });
      }
    } catch (e) {}
  };

  const importDbFile = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const uInt8Array = new Uint8Array(arrayBuffer);
      
      const SQL = await initSqlJs({
        locateFile: () => `/sql-wasm.wasm`
      });
      
      const newDb = new SQL.Database(uInt8Array);
      
      // IMPORTANT : On recrée/vérifie les tables et on FORCE la synchro des territoires
      createTables(newDb); 
      syncSchoolTerritories(newDb); // <--- Le secret est ici

      setDb(newDb);
      setIsLoaded(true);
      updateStats(newDb);
      return true;
    } catch (err) {
      console.error("Erreur import DB:", err);
      setError("Impossible de lire le fichier .db");
      return false;
    }
  };

  const exportDbFile = () => {
    if (!db) return;
    try {
      const data = db.export();
      const blob = new Blob([data], { type: 'application/x-sqlite3' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sauvegarde_credi_${new Date().toISOString().slice(0, 10)}.db`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Erreur export DB:", err);
    }
  };

  return (
    <DatabaseContext.Provider value={{ db, isLoaded, error, stats, importDbFile, exportDbFile, updateStats }}>
      {children}
    </DatabaseContext.Provider>
  );
};

export const useDatabase = () => useContext(DatabaseContext);