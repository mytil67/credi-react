import React, { useState, useCallback } from 'react';
import { Upload, FolderSearch, FileUp, AlertCircle, CheckCircle, Database, Download, FileWarning, AlertTriangle, Table } from 'lucide-react';
import { useDatabase } from '../context/DatabaseContext';
import { parsePDF } from '../services/pdfParser';
import { insertDelivery, importCantinesCSV } from '../services/db'; // Import de la nouvelle fonction

const UploadPage = () => {
  const { db, importDbFile, exportDbFile, updateStats } = useDatabase();
  
  const [isDragging, setIsDragging] = useState(false);
  const [logs, setLogs] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [failedFiles, setFailedFiles] = useState([]);

  const addLog = (message, type = 'info') => {
    setLogs(prev => {
        const newLogs = [...prev, { message, type, id: Date.now() + Math.random() }];
        if (newLogs.length > 200) return newLogs.slice(newLogs.length - 200);
        return newLogs;
    });
  };

  // --- Gestion Import CSV Cantines ---
  const handleCantineCsvImport = async (e) => {
      const file = e.target.files[0];
      if (!file || !db) return;

      addLog(`Lecture du référentiel "${file.name}"...`, 'info');
      
      const reader = new FileReader();
      reader.onload = async (event) => {
          const text = event.target.result;
          try {
              const count = await importCantinesCSV(db, text);
              addLog(`✅ Référentiel importé : ${count} écoles mises à jour dans la table 'cantines'.`, 'success');
              // On sauvegarde la DB pour inclure la nouvelle table
          } catch (err) {
              addLog(`❌ Erreur import CSV : ${err.message}`, 'error');
          }
      };
      reader.readAsText(file, 'ISO-8859-1');
  };

  // ... (Le reste des fonctions processFiles, handleDrop, etc. reste identique à la version précédente) ...
  // Je remets ici les fonctions essentielles pour que le copier-coller fonctionne :

  const processFiles = async (files) => {
    if (!db) { addLog("Erreur : La base de données n'est pas initialisée.", 'error'); return; }
    const pdfFiles = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));
    if (pdfFiles.length === 0) { addLog("Aucun fichier PDF trouvé.", 'warning'); return; }
    setIsProcessing(true); setFailedFiles([]); setLogs([]); 
    let processedCount = 0; let skippedCount = 0; let errorCount = 0;
    const total = pdfFiles.length; const BATCH_SIZE = 10; 
    addLog(`Analyse de ${total} fichier(s) en cours...`, 'info');
    for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = pdfFiles.slice(i, Math.min(i + BATCH_SIZE, total));
        db.exec("BEGIN TRANSACTION");
        for (const file of batch) {
            try {
                const dataRows = await parsePDF(file);
                let insertedRows = 0; let ignoredRows = 0;
                for (const row of dataRows) {
                    const success = insertDelivery(db, row);
                    if (success) insertedRows++; else ignoredRows++;
                }
                if (insertedRows > 0) { addLog(`✅ Ajouté : ${file.name} (${insertedRows} lignes)`, 'success'); processedCount++; }
                else if (ignoredRows > 0 && insertedRows === 0) { addLog(`⚠️ Ignoré (Déjà présent) : ${file.name}`, 'warning'); skippedCount++; }
            } catch (err) { console.error(err); setFailedFiles(prev => [...prev, { name: file.name, reason: err.message }]); errorCount++; }
        }
        db.exec("COMMIT");
        const currentProgress = Math.round(((i + batch.length) / total) * 100);
        setProgress(currentProgress);
        await new Promise(resolve => setTimeout(resolve, 20));
    }
    updateStats(db); setIsProcessing(false);
    addLog('------------------------------------------------', 'info');
    addLog(`Bilan : ${processedCount} ajoutés, ${skippedCount} ignorés, ${errorCount} erreurs.`, 'info');
  };

  const handleDrop = useCallback((e) => { e.preventDefault(); setIsDragging(false); const files = Array.from(e.dataTransfer.files); processFiles(files); }, [db]);
  const handleDbImport = async (e) => { const file = e.target.files[0]; if (!file) return; addLog(`Chargement de la base ${file.name}...`, 'info'); const success = await importDbFile(file); if (success) addLog("Base de données chargée avec succès !", 'success'); else addLog("Échec du chargement.", 'error'); };
  const handleFolderSelect = (e) => { const files = Array.from(e.target.files); if (files.length > 0) { addLog(`${files.length} fichiers détectés.`, 'info'); processFiles(files); } };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <h2 className="text-3xl font-bold text-slate-800">Chargement des données</h2>

      {/* Carte 1 : Gestion BDD */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-4">
          <Database className="text-blue-500" size={24} />
          <h3 className="text-lg font-semibold">1. Gestion de la Base de Données</h3>
        </div>
        <div className="flex flex-col md:flex-row gap-4 justify-between">
            <div>
                <p className="text-slate-500 text-sm mb-2">Importez une sauvegarde...</p>
                <input type="file" accept=".db" onChange={handleDbImport} className="hidden" id="db-upload" />
                <label htmlFor="db-upload" className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer border border-slate-300">
                    <FileUp size={18} /> Importer .db
                </label>
            </div>
            
            {/* NOUVEAU : Import Référentiel CSV */}
            <div className="border-l border-slate-200 pl-4">
                <p className="text-slate-500 text-sm mb-2">Ajouter infos écoles (CSV)...</p>
                <input type="file" accept=".csv,.txt" onChange={handleCantineCsvImport} className="hidden" id="csv-upload" />
                <label htmlFor="csv-upload" className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg cursor-pointer border border-indigo-200">
                    <Table size={18} /> Import BASE_Cantine.csv
                </label>
            </div>

            <div className="text-right border-l border-slate-200 pl-4">
                <p className="text-slate-500 text-sm mb-2">Sauvegarder tout (Inclus nouvelle table)</p>
                <button onClick={exportDbFile} className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium shadow-sm">
                    <Download size={18} /> Télécharger .db
                </button>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Carte 2 : Drag & Drop */}
        <div 
          className={`bg-white p-6 rounded-xl shadow-sm border-2 transition-all cursor-pointer relative ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-dashed border-slate-300'}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <Upload className={`mb-3 ${isDragging ? 'text-blue-600' : 'text-slate-400'}`} size={48} />
            <h3 className="font-semibold text-slate-700">Déposez vos PDF ici</h3>
            <input type="file" multiple accept=".pdf" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => processFiles(Array.from(e.target.files))} />
          </div>
        </div>

        {/* Carte 3 : Scan Dossier */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center items-center text-center">
          <div className="mb-4 bg-blue-100 p-3 rounded-full"><FolderSearch className="text-blue-600" size={32} /></div>
          <h3 className="font-semibold text-slate-700 mb-2">Scanner un dossier</h3>
          <input type="file" id="folder-upload" className="hidden" webkitdirectory="" directory="" multiple onChange={handleFolderSelect} />
          <label htmlFor="folder-upload" className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors cursor-pointer">
            Sélectionner un dossier
          </label>
        </div>
      </div>

      {/* Logs et Erreurs (Reste identique) */}
      {failedFiles.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
             {/* ... Affichage des erreurs ... */}
             <div className="text-red-700 font-bold mb-2 flex items-center gap-2"><FileWarning/> Fichiers non traités ({failedFiles.length})</div>
             <div className="max-h-40 overflow-y-auto text-sm text-red-600">{failedFiles.map((f, i) => <div key={i}>{f.name}: {f.reason}</div>)}</div>
        </div>
      )}

      {(isProcessing || logs.length > 0) && (
        <div className="bg-slate-900 rounded-xl p-4 shadow-lg text-slate-200 font-mono text-xs h-48 overflow-y-auto custom-scrollbar">
            {logs.map(log => <div key={log.id} className={log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-400' : log.type === 'warning' ? 'text-yellow-400' : 'text-slate-300'}>{log.message}</div>)}
        </div>
      )}
    </div>
  );
};

export default UploadPage;