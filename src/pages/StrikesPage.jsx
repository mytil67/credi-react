import React, { useState, useEffect } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { getUniqueValues, addStrike, getStrikes, removeStrike } from '../services/db';
import { Ban, Trash2, PlusCircle, AlertTriangle } from 'lucide-react';

const StrikesPage = () => {
  const { db, isLoaded } = useDatabase();
  const [strikes, setStrikes] = useState([]);
  const [form, setForm] = useState({ year: '', week: '', day: 'monday', date: '' });
  const [options, setOptions] = useState({ years: [], weeks: [] });

  useEffect(() => {
    if (db && isLoaded) {
      loadData();
      setOptions({
        years: getUniqueValues(db, 'school_year'),
        weeks: getUniqueValues(db, 'week_number'),
      });
    }
  }, [db, isLoaded]);

  const loadData = () => {
    setStrikes(getStrikes(db));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.year || !form.week) return;
    
    const success = addStrike(db, form);
    if (success) {
      loadData();
      // Reset partiel
      setForm(prev => ({ ...prev, day: 'monday', date: '' }));
    }
  };

  const handleDelete = (id) => {
    if (confirm('Supprimer ce jour de grève ?')) {
      removeStrike(db, id);
      loadData();
    }
  };

  const dayMapping = {
    monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi', thursday: 'Jeudi', friday: 'Vendredi'
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
        <Ban className="text-red-600" /> Gestion des Grèves & Fériés
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Formulaire d'ajout */}
        <div className="md:col-span-1">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 sticky top-8">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <PlusCircle size={20} className="text-blue-600"/> Déclarer
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Année</label>
                <select 
                  className="w-full p-2 border rounded"
                  value={form.year}
                  onChange={e => setForm({...form, year: e.target.value})}
                  required
                >
                  <option value="">Choisir...</option>
                  {options.years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Semaine</label>
                <select 
                  className="w-full p-2 border rounded"
                  value={form.week}
                  onChange={e => setForm({...form, week: e.target.value})}
                  required
                >
                  <option value="">Choisir...</option>
                  {options.weeks.map(w => <option key={w} value={w}>Semaine {w}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Jour</label>
                <select 
                  className="w-full p-2 border rounded"
                  value={form.day}
                  onChange={e => setForm({...form, day: e.target.value})}
                >
                  <option value="monday">Lundi</option>
                  <option value="tuesday">Mardi</option>
                  <option value="thursday">Jeudi</option>
                  <option value="friday">Vendredi</option>
                </select>
              </div>

              <button type="submit" className="w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 font-medium transition-colors">
                Bloquer ce jour
              </button>
            </form>
          </div>
        </div>

        {/* Liste des grèves */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-blue-50 text-blue-800 p-4 rounded-lg flex items-start gap-3 text-sm">
            <AlertTriangle className="shrink-0 mt-0.5" size={16} />
            <p>
              Les repas saisis pour les jours listés ci-dessous seront <strong>automatiquement ignorés (comptés à 0)</strong> dans la Synthèse, même s'ils apparaissent dans les fichiers PDF d'origine.
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                <tr>
                  <th className="px-6 py-3">Année</th>
                  <th className="px-6 py-3">Semaine</th>
                  <th className="px-6 py-3">Jour Bloqué</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {strikes.length === 0 ? (
                  <tr><td colSpan="4" className="p-6 text-center text-slate-400 italic">Aucune grève déclarée.</td></tr>
                ) : (
                  strikes.map(s => (
                    <tr key={s.id} className="hover:bg-red-50 transition-colors">
                      <td className="px-6 py-3">{s.year}</td>
                      <td className="px-6 py-3 font-mono bg-slate-50 w-24 text-center">S{s.week}</td>
                      <td className="px-6 py-3 font-semibold text-red-600">{dayMapping[s.day]}</td>
                      <td className="px-6 py-3 text-right">
                        <button 
                          onClick={() => handleDelete(s.id)}
                          className="text-slate-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StrikesPage;