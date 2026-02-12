import React, { useState, useEffect } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { getAllSchoolsList, saveManualEntry } from '../services/db';
import { Edit3, Save, Plus, CheckCircle, AlertCircle, School } from 'lucide-react';

// Liste complète des régimes par défaut basée sur vos PDF
const DEFAULT_REGIMES = [
    'HALAL',
    'SANS PORC',
    'STANDARD',
    'VEGETARIEN',
    'ADULTE HALAL',
    'ADULTE SANS',
    'ADULTE STANDARD',
    'ADULTE VEGETARIEN',
    'VEGE SUPPLEMENTAIRE'
];

const getCurrentSchoolYear = () => {
    const d = new Date();
    const m = d.getMonth();
    const y = d.getFullYear();
    return m < 8 ? `${y - 1}-${y}` : `${y}-${y + 1}`;
};

const ManualEntryPage = () => {
  const { db, isLoaded, updateStats } = useDatabase();
  const [schools, setSchools] = useState([]);
  
  // États du formulaire Méta
  const [meta, setMeta] = useState({
      school: '',
      type: 'ELEMENTAIRE',
      week: '',
      year: getCurrentSchoolYear(),
      date: new Date().toISOString().split('T')[0]
  });

  // États du tableau de saisie
  const [meals, setMeals] = useState(
      DEFAULT_REGIMES.map(regime => ({ regime, mon: 0, tue: 0, thu: 0, fri: 0, isPredefined: true }))
  );

  const [status, setStatus] = useState({ message: '', type: '' });

  useEffect(() => {
    if (db && isLoaded) {
        setSchools(getAllSchoolsList(db));
    }
  }, [db, isLoaded]);

  const handleMetaChange = (e) => {
      setMeta({ ...meta, [e.target.name]: e.target.value });
      setStatus({ message: '', type: '' });
  };

  const handleMealChange = (index, field, value) => {
      const newMeals = [...meals];
      const val = parseInt(value, 10) || 0;
      newMeals[index][field] = val;
      setMeals(newMeals);
  };

  const addCustomRegime = () => {
      setMeals([...meals, { regime: 'NOUVEAU REGIME', mon: 0, tue: 0, thu: 0, fri: 0, isPredefined: false }]);
  };

  const handleRegimeNameChange = (index, value) => {
      const newMeals = [...meals];
      newMeals[index].regime = value;
      setMeals(newMeals);
  };

  const handleSubmit = (e) => {
      e.preventDefault();
      if (!db) return;

      if (!meta.school || !meta.week || !meta.year) {
          setStatus({ message: 'Veuillez remplir l\'école, la semaine et l\'année.', type: 'error' });
          return;
      }

      const weekFormatted = meta.week.padStart(2, '0');
      const docId = `MANUAL_${meta.school.replace(/\s+/g, '-')}_${weekFormatted}_${Date.now()}`;
      const schoolTypeFull = `${meta.school} ${meta.type}`.trim();

      let inserted = 0;

      for (const meal of meals) {
          const total = meal.mon + meal.tue + meal.thu + meal.fri;
          if (total > 0) { // On n'enregistre que les lignes avec des repas
              const success = saveManualEntry(db, {
                  document_id: docId,
                  base_school: meta.school,
                  school_type: schoolTypeFull,
                  week_number: weekFormatted,
                  school_year: meta.year,
                  document_date: new Date(meta.date).toLocaleDateString('fr-FR'),
                  regime: meal.regime,
                  monday: meal.mon,
                  tuesday: meal.tue,
                  thursday: meal.thu,
                  friday: meal.fri,
                  total: total
              });
              if (success) inserted++;
          }
      }

      if (inserted > 0) {
          updateStats(db);
          setStatus({ message: `Succès : ${inserted} régimes enregistrés pour la semaine ${weekFormatted}.`, type: 'success' });
          // Optionnel: Réinitialiser les repas après succès
          setMeals(DEFAULT_REGIMES.map(regime => ({ regime, mon: 0, tue: 0, thu: 0, fri: 0, isPredefined: true })));
      } else {
          setStatus({ message: 'Aucune donnée n\'a été enregistrée (tous les totaux sont à 0).', type: 'warning' });
      }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Edit3 className="text-blue-600" /> Saisie Manuelle
        </h2>
        <p className="text-sm text-slate-500">Ajout ou correction d'une commande</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
          {/* Carte 1 : Méta-données */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-700 mb-4 border-b pb-2 flex items-center gap-2">
                  <School size={20} className="text-slate-400" /> Identification de la commande
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-500 mb-1">ÉCOLE *</label>
                      <input 
                          type="text" 
                          list="school-list"
                          name="school"
                          value={meta.school}
                          onChange={handleMetaChange}
                          className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 uppercase"
                          placeholder="Ex: KLEBER"
                          required
                      />
                      <datalist id="school-list">
                          {schools.map(s => <option key={s} value={s} />)}
                      </datalist>
                  </div>
                  
                  <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">TYPE *</label>
                      <select name="type" value={meta.type} onChange={handleMetaChange} className="w-full p-2 border border-slate-300 rounded-lg">
                          <option value="ELEMENTAIRE">Élémentaire</option>
                          <option value="MATERNELLE">Maternelle</option>
                          <option value="">Autre (Lycée/Lieu)</option>
                      </select>
                  </div>

                  <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">SEMAINE *</label>
                      <input type="number" name="week" value={meta.week} onChange={handleMetaChange} min="1" max="53" className="w-full p-2 border border-slate-300 rounded-lg font-mono" placeholder="Ex: 45" required />
                  </div>

                  <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">ANNÉE SCOLAIRE *</label>
                      <input type="text" name="year" value={meta.year} onChange={handleMetaChange} className="w-full p-2 border border-slate-300 rounded-lg" placeholder="2023-2024" required />
                  </div>
              </div>
          </div>

          {/* Carte 2 : Saisie des repas */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                  <h3 className="font-bold text-slate-700">Quantités par Régime</h3>
                  <div className="text-xs text-slate-500 bg-white px-2 py-1 rounded border shadow-sm">Date de création : <input type="date" name="date" value={meta.date} onChange={handleMetaChange} className="border-none bg-transparent outline-none ml-2 text-blue-600 font-bold"/></div>
              </div>
              
              <table className="w-full text-sm text-left">
                  <thead className="bg-slate-100 text-slate-500 uppercase text-xs">
                      <tr>
                          <th className="px-6 py-3 w-1/3">Régime</th>
                          <th className="px-4 py-3 text-center">Lundi</th>
                          <th className="px-4 py-3 text-center">Mardi</th>
                          <th className="px-4 py-3 text-center">Jeudi</th>
                          <th className="px-4 py-3 text-center">Vendredi</th>
                          <th className="px-6 py-3 text-center font-bold">Total</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {meals.map((meal, index) => {
                          const total = meal.mon + meal.tue + meal.thu + meal.fri;
                          return (
                              <tr key={index} className="hover:bg-blue-50/30 transition-colors">
                                  <td className="px-6 py-2">
                                      {meal.isPredefined ? (
                                          <div className="w-full p-1.5 font-semibold text-slate-700 uppercase select-none">
                                              {meal.regime}
                                          </div>
                                      ) : (
                                          <input type="text" value={meal.regime} onChange={(e) => handleRegimeNameChange(index, e.target.value)} className="w-full p-1.5 border border-slate-300 focus:border-blue-400 rounded outline-none font-semibold text-slate-700 uppercase bg-white" placeholder="Nom du régime" />
                                      )}
                                  </td>
                                  <td className="px-4 py-2 text-center"><input type="number" min="0" value={meal.mon || ''} onChange={(e) => handleMealChange(index, 'mon', e.target.value)} className="w-16 p-1.5 text-center border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 outline-none" placeholder="0" /></td>
                                  <td className="px-4 py-2 text-center"><input type="number" min="0" value={meal.tue || ''} onChange={(e) => handleMealChange(index, 'tue', e.target.value)} className="w-16 p-1.5 text-center border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 outline-none" placeholder="0" /></td>
                                  <td className="px-4 py-2 text-center"><input type="number" min="0" value={meal.thu || ''} onChange={(e) => handleMealChange(index, 'thu', e.target.value)} className="w-16 p-1.5 text-center border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 outline-none" placeholder="0" /></td>
                                  <td className="px-4 py-2 text-center"><input type="number" min="0" value={meal.fri || ''} onChange={(e) => handleMealChange(index, 'fri', e.target.value)} className="w-16 p-1.5 text-center border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 outline-none" placeholder="0" /></td>
                                  <td className="px-6 py-2 text-center font-bold text-lg bg-slate-50">{total > 0 ? total : '-'}</td>
                              </tr>
                          );
                      })}
                  </tbody>
              </table>
              
              <div className="p-4 bg-slate-50 border-t border-slate-200 text-center">
                  <button type="button" onClick={addCustomRegime} className="text-sm text-blue-600 font-semibold flex items-center justify-center gap-1 mx-auto hover:text-blue-800">
                      <Plus size={16} /> Ajouter une ligne de régime
                  </button>
              </div>
          </div>

          {/* Alertes & Bouton Soumettre */}
          <div className="flex items-center justify-between">
              <div className="flex-1">
                  {status.message && (
                      <div className={`flex items-center gap-2 p-3 rounded-lg text-sm font-medium ${status.type === 'success' ? 'bg-green-100 text-green-800' : status.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {status.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                          {status.message}
                      </div>
                  )}
              </div>
              <button type="submit" className="ml-4 flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                  <Save size={20} /> Enregistrer la commande
              </button>
          </div>
      </form>
    </div>
  );
};

export default ManualEntryPage;