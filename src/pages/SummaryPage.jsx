import React, { useState, useEffect, useMemo } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { getUniqueValues, getSummaryBySchool } from '../services/db';
import { BarChart3, Calculator, Download } from 'lucide-react';

const SummaryPage = () => {
  const { db, isLoaded } = useDatabase();
  
  const [filters, setFilters] = useState({
    year: 'all',
    week: 'all' // On garde le filtre semaine, même si la synthèse est souvent annuelle
  });

  const [options, setOptions] = useState({ years: [], weeks: [] });
  const [data, setData] = useState([]);

  // Chargement des options
  useEffect(() => {
    if (db && isLoaded) {
      setOptions({
        years: getUniqueValues(db, 'school_year'),
        weeks: getUniqueValues(db, 'week_number'),
      });
      refreshData();
    }
  }, [db, isLoaded, filters]); // Se recharge si les filtres changent

  const refreshData = () => {
    if (!db) return;
    const results = getSummaryBySchool(db, filters);
    setData(results);
  };

  // Calcul des Totaux Globaux de la page
  const totals = useMemo(() => {
    return data.reduce((acc, row) => ({
      total: acc.total + row.grand_total,
      weeks: Math.max(acc.weeks, row.nb_weeks) // Max de semaines rencontrées
    }), { total: 0, weeks: 0 });
  }, [data]);

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  if (!isLoaded) return <div className="p-8">Base de données non chargée.</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 h-screen flex flex-col">
      
      {/* En-tête */}
      <div className="flex justify-between items-end">
        <div>
            <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <BarChart3 className="text-blue-600" /> Synthèse par École
            </h2>
            <p className="text-slate-500 mt-1">Cumul des commandes groupé par établissement</p>
        </div>
        
        {/* Résumé rapide en haut à droite */}
        <div className="text-right">
            <div className="text-3xl font-bold text-blue-600">{totals.total.toLocaleString()}</div>
            <div className="text-xs text-slate-500 uppercase font-bold">Repas cumulés</div>
        </div>
      </div>

      {/* Barre de Filtres */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex gap-4 items-center">
        <div className="flex-1 max-w-xs">
            <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Année Scolaire</label>
            <select 
              className="w-full p-2 border border-slate-300 rounded-lg text-sm"
              value={filters.year}
              onChange={(e) => updateFilter('year', e.target.value)}
            >
              <option value="all">Toutes les années</option>
              {options.years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
        </div>
        <div className="flex-1 max-w-xs">
            <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Période (Semaine)</label>
            <select 
              className="w-full p-2 border border-slate-300 rounded-lg text-sm"
              value={filters.week}
              onChange={(e) => updateFilter('week', e.target.value)}
            >
              <option value="all">Cumul complet (Toutes)</option>
              {options.weeks.map(w => <option key={w} value={w}>Semaine {w}</option>)}
            </select>
        </div>
      </div>

      {/* Tableau de Synthèse */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-6 py-3">École</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3 text-center">Nb Semaines</th>
                <th className="px-6 py-3 text-center">Lun (Cumul)</th>
                <th className="px-6 py-3 text-center">Mar (Cumul)</th>
                <th className="px-6 py-3 text-center">Jeu (Cumul)</th>
                <th className="px-6 py-3 text-center">Ven (Cumul)</th>
                <th className="px-6 py-3 text-center font-bold bg-blue-50 text-blue-800">TOTAL Période</th>
                <th className="px-6 py-3 text-center text-slate-400">Moyenne / jour*</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((row, index) => {
                // Calcul approximatif moyenne jour (Total / Nb semaines / 4 jours)
                // C'est ici qu'on affinera plus tard avec les jours de grève
                const avg = Math.round(row.grand_total / (row.nb_weeks || 1) / 4);
                
                return (
                  <tr key={index} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 font-medium text-slate-900">{row.base_school}</td>
                    <td className="px-6 py-3 text-xs text-slate-500">{row.school_type}</td>
                    <td className="px-6 py-3 text-center">
                        <span className="bg-slate-100 px-2 py-1 rounded text-xs">{row.nb_weeks}</span>
                    </td>
                    <td className="px-6 py-3 text-center text-slate-600">{row.total_mon}</td>
                    <td className="px-6 py-3 text-center text-slate-600">{row.total_tue}</td>
                    <td className="px-6 py-3 text-center text-slate-600">{row.total_thu}</td>
                    <td className="px-6 py-3 text-center text-slate-600">{row.total_fri}</td>
                    <td className="px-6 py-3 text-center font-bold text-blue-700 bg-blue-50/30">{row.grand_total}</td>
                    <td className="px-6 py-3 text-center text-slate-400 italic text-xs">~{avg}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center gap-2">
            <Calculator size={14} />
            * Moyenne indicative (Total divisé par le nombre de semaines et 4 jours ouvrés). Ne prend pas encore en compte les grèves.
        </div>
      </div>
    </div>
  );
};

export default SummaryPage;