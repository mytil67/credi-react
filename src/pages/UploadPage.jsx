import React, { useState, useCallback } from 'react';
import { Upload, FolderSearch, FileUp, AlertCircle, CheckCircle, Database, Download, FileWarning, AlertTriangle } from 'lucide-react';
import { useDatabase } from '../context/DatabaseContext';
import { parsePDF } from '../services/pdfParser';
import { insertDelivery } from '../services/db';

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
        // On garde un historique raisonnable pour ne pas surcharger la mémoire
        if (newLogs.length > 200) return newLogs.slice(newLogs.length - 200);
        return newLogs;
    });
  };

  const processFiles = async (files) => {
    if (!db) {
      addLog("Erreur : La base de données n'est pas initialisée.", 'error');
      return;
    }

    const pdfFiles = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));
    if (pdfFiles.length === 0) {
      addLog("Aucun fichier PDF trouvé.", 'warning');
      return;
    }

    setIsProcessing(true);
    setFailedFiles([]);
    setLogs([]); 
    
    let processedCount = 0; // Fichiers avec au moins 1 ajout
    let skippedCount = 0;   // Fichiers 100% ignorés
    let errorCount = 0;
    const total = pdfFiles.length;
    const BATCH_SIZE = 10; 

    addLog(`Analyse de ${total} fichier(s) en cours...`, 'info');

    for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = pdfFiles.slice(i, Math.min(i + BATCH_SIZE, total));
        
        db.exec("BEGIN TRANSACTION");
        
        for (const file of batch) {
            try {
                const dataRows = await parsePDF(file);
                
                // Compteurs pour ce fichier spécifique
                let insertedRows = 0;
                let ignoredRows = 0;

                for (const row of dataRows) {
                    // insertDelivery renvoie TRUE si inséré, FALSE si ignoré (existe déjà)
                    const success = insertDelivery(db, row);
                    if (success) insertedRows++;
                    else ignoredRows++;
                }
                
                // Logique d'affichage intelligente
                if (insertedRows > 0) {
                    addLog(`✅ Ajouté : ${file.name} (${insertedRows} lignes)`, 'success');
                    processedCount++;
                } else if (ignoredRows > 0 && insertedRows === 0) {
                    // Si tout a été ignoré, c'est un doublon
                    addLog(`⚠️ Ignoré (Déjà présent) : ${file.name}`, 'warning');
                    skippedCount++;
                } else {
                    // Cas rare : PDF vide ou sans données utiles
                    addLog(`ℹ️ Aucune donnée : ${file.name}`, 'info');
                }

            } catch (err) {
                console.error(err);
                setFailedFiles(prev => [...prev, { name: file.name, reason: err.message }]);
                errorCount++;
            }
        }
        
        db.exec("COMMIT");

        const currentProgress = Math.round(((i + batch.length) / total) * 100);
        setProgress(currentProgress);
        
        // Petite pause pour laisser l'interface se mettre à jour
        await new Promise(resolve => setTimeout(resolve, 20));
    }

    updateStats(db);
    setIsProcessing(false);
    
    // Résumé final détaillé
    addLog('------------------------------------------------', 'info');
    addLog(`Bilan du traitement :`, 'info');
    addLog(`✅ ${processedCount} fichiers importés (nouvelles données)`, 'success');
    if (skippedCount > 0) addLog(`⚠️ ${skippedCount} fichiers ignorés (déjà en base)`, 'warning');
    if (errorCount > 0) addLog(`❌ ${errorCount} erreurs`, 'error');
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  }, [db]);

  const handleDbImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    addLog(`Chargement de la base ${file.name}...`, 'info');
    const success = await importDbFile(file);
    if (success) addLog("Base de données chargée avec succès !", 'success');
    else addLog("Échec du chargement de la base.", 'error');
  };

  const handleFolderSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      addLog(`${files.length} fichiers détectés. Lancement...`, 'info');
      processFiles(files);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <h2 className="text-3xl font-bold text-slate-800">Chargement des données</h2>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-4">
          <Database className="text-blue-500" size={24} />
          <h3 className="text-lg font-semibold">1. Gestion de la Base de Données</h3>
        </div>
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div>
                <p className="text-slate-500 text-sm mb-2">Importez une sauvegarde précédente...</p>
                <div className="relative">
                <input type="file" accept=".db" onChange={handleDbImport} className="hidden" id="db-upload" />
                <label htmlFor="db-upload" className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer transition-colors font-medium border border-slate-300">
                    <FileUp size={18} /> Importer un fichier .db
                </label>
                </div>
            </div>
            <div className="hidden md:block w-px h-12 bg-slate-200 mx-4"></div>
            <div className="text-right">
                <p className="text-slate-500 text-sm mb-2">...ou sauvegardez votre travail actuel.</p>
                <button onClick={exportDbFile} className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium shadow-sm">
                    <Download size={18} /> Télécharger la base (.db)
                </button>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div 
          className={`bg-white p-6 rounded-xl shadow-sm border-2 transition-all cursor-pointer relative
            ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-dashed border-slate-300'}
          `}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <Upload className={`mb-3 ${isDragging ? 'text-blue-600' : 'text-slate-400'}`} size={48} />
            <h3 className="font-semibold text-slate-700">Déposez vos PDF de commandes ici</h3>
            <p className="text-sm text-slate-500 mt-1">ou cliquez pour sélectionner</p>
            <input type="file" multiple accept=".pdf" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => processFiles(Array.from(e.target.files))} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center items-center text-center">
          <div className="mb-4 bg-blue-100 p-3 rounded-full">
            <FolderSearch className="text-blue-600" size={32} />
          </div>
          <h3 className="font-semibold text-slate-700 mb-2">Scanner un dossier complet</h3>
          <p className="text-sm text-slate-500 mb-4">Sélectionnez un dossier racine, nous trouverons tous les PDF à l'intérieur.</p>
          <input type="file" id="folder-upload" className="hidden" webkitdirectory="" directory="" multiple onChange={handleFolderSelect} />
          <label htmlFor="folder-upload" className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors cursor-pointer">
            Sélectionner un dossier
          </label>
        </div>
      </div>

      {/* RAPPORT D'ERREURS */}
      {failedFiles.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4 text-red-700">
                <FileWarning size={24} />
                <h3 className="font-bold text-lg">Fichiers non traités ({failedFiles.length})</h3>
            </div>
            <div className="max-h-60 overflow-y-auto custom-scrollbar">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-red-500 uppercase bg-red-100">
                        <tr>
                            <th className="px-4 py-2">Nom du fichier</th>
                            <th className="px-4 py-2">Raison de l'échec</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-red-200">
                        {failedFiles.map((file, idx) => (
                            <tr key={idx} className="bg-white">
                                <td className="px-4 py-2 font-medium text-slate-700">{file.name}</td>
                                <td className="px-4 py-2 text-red-600">{file.reason}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      {/* Zone de Logs */}
      {(isProcessing || logs.length > 0) && (
        <div className="bg-slate-900 rounded-xl p-4 shadow-lg text-slate-200">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-mono text-sm font-semibold uppercase tracking-wider text-slate-400">Console de traitement</h4>
            {isProcessing && <span className="text-xs bg-blue-600 px-2 py-1 rounded animate-pulse">En cours {progress}%</span>}
          </div>
          
          {isProcessing && (
            <div className="w-full bg-slate-700 h-1.5 rounded-full mb-4 overflow-hidden">
              <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
            </div>
          )}

          <div className="h-48 overflow-y-auto font-mono text-xs space-y-1 custom-scrollbar">
            {logs.length === 0 && <p className="text-slate-600 italic">En attente d'actions...</p>}
            {logs.map((log) => (
              <div key={log.id} className={`flex items-start gap-2 ${
                log.type === 'error' ? 'text-red-400' : 
                log.type === 'success' ? 'text-green-400' : 
                log.type === 'warning' ? 'text-yellow-400' : 
                'text-slate-300'
              }`}>
                {log.type === 'error' ? <AlertCircle size={14} className="mt-0.5 shrink-0" /> : 
                 log.type === 'success' ? <CheckCircle size={14} className="mt-0.5 shrink-0" /> : 
                 log.type === 'warning' ? <AlertTriangle size={14} className="mt-0.5 shrink-0" /> :
                 <span className="w-3.5 shrink-0" />}
                <span>{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadPage;