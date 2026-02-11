import React, { useState, useEffect, useMemo } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { getUniqueValues } from '../services/db';
import { TERRITORIES_MAPPING } from '../constants/territories';
// CORRECTION ICI : Ajout de 'School' dans l'import
import { Map, Calculator, School } from 'lucide-react';

const TerritoriesPage = () => {
  const { db, isLoaded } = useDatabase();
  
  // On sélectionne le premier territoire par défaut s'il existe
  const defaultTerritory = TERRITORIES_MAPPING.length > 0 ? TERRITORIES_MAPPING[0].name : '';

  const [filters, setFilters] = useState({
    territory: defaultTerritory, 
    week: 'all',
    year: 'all'
  });

  const [options, setOptions] = useState({ weeks: [], years: [] });
  const [stats, setStats] = useState([]);

  useEffect(() => {
    if (db && isLoaded) {
      setOptions({
        weeks: getUniqueValues(db, 'week_number'),
        years: getUniqueValues(db, 'school_year')
      });
    }
  }, [db, isLoaded]);

  // Calcul des statistiques quand les filtres changent
  useEffect(() => {
    if (!db || !isLoaded || !filters.territory) return;
    calculateTerritoryStats();
  }, [db, isLoaded, filters]);

  const calculateTerritoryStats = () => {
    // 1. On récupère d'abord les écoles du territoire sélectionné
    const selectedTerritoryConfig = TERRITORIES_MAPPING.find(t => t.name === filters.territory);
    if (!selectedTerritoryConfig) return;

    // 2. On construit la requête d'agrégation
    // On filtre par écoles appartenant à ce territoire
    const schoolsPlaceholder = selectedTerritoryConfig.schools.map(() => '?').join(',');
    
    let query = `
      SELECT 
        regime,
        SUM(monday) as mon,
        SUM(tuesday) as tue,
        SUM(wednesday) as wed,
        SUM(thursday) as thu,
        SUM(friday) as fri,
        SUM(total) as total
      FROM deliveries
      WHERE base_school IN (${schoolsPlaceholder})
    `;

    const params = [...selectedTerritoryConfig.schools];

    if (filters.week !== 'all') {
      query += " AND week_number = ?";
      params.push(filters.week);
    }
    if (filters.year !== 'all') {
        query += " AND school_year = ?";
        params.push(filters.year);
    }

    query += " GROUP BY regime ORDER BY regime";

    try {
        const stmt = db.prepare(query);
        stmt.bind(params);
        const results = [];
        while (stmt.step()) {
            results.push(stmt.getAsObject());
        }
        stmt.free();
        setStats(results);
    } catch (e) {
        console.error("Erreur calcul territoire", e);
    }
  };

  const grandTotal = useMemo(() => {
    return stats.reduce((acc, row) => acc + row.total, 0);
  }, [stats]);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Map className="text-blue-600" /> Vue par Territoire
        </h2>
        <div className="text-right">
             <div className="text-3xl font-bold text-indigo-600">{grandTotal.toLocaleString()}</div>
             <div className="text-xs text-slate-500 uppercase font-bold">Total Repas du Lot</div>
        </div>
      </div>

      {/* Barre de Filtres */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Sélecteur Principal : Territoire */}
        <div>
            <label className="block text-xs font-bold text-indigo-600 mb-1 uppercase">Choisir le Territoire (Lot)</label>
            <select 
                className="w-full p-2 border-2 border-indigo-100 rounded-lg text-sm font-semibold text-indigo-900 bg-indigo-50 focus:border-indigo-500 outline-none"
                value={filters.territory}
                onChange={e => setFilters({...filters, territory: e.target.value})}
            >
                {TERRITORIES_MAPPING.map(t => (
                    <option key={t.name} value={t.name}>{t.name}</option>
                ))}
            </select>
        </div>

        {/* Filtres Secondaires */}
        <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Année</label>
            <select 
                className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                value={filters.year}
                onChange={e => setFilters({...filters, year: e.target.value})}
            >
                <option value="all">Toutes les années</option>
                {options.years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
        </div>
        <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Semaine</label>
            <select 
                className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                value={filters.week}
                onChange={e => setFilters({...filters, week: e.target.value})}
            >
                <option value="all">Toutes les semaines</option>
                {options.weeks.map(w => <option key={w} value={w}>Semaine {w}</option>)}
            </select>
        </div>
      </div>

      {/* Tableau des résultats */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h3 className="font-semibold text-slate-700">Détail des régimes pour : <span className="text-indigo-600">{filters.territory}</span></h3>
        </div>
        
        <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                <tr>
                    <th className="px-6 py-3">Régime</th>
                    <th className="px-6 py-3 text-center">Lundi</th>
                    <th className="px-6 py-3 text-center">Mardi</th>
                    <th className="px-6 py-3 text-center">Mercredi</th>
                    <th className="px-6 py-3 text-center">Jeudi</th>
                    <th className="px-6 py-3 text-center">Vendredi</th>
                    <th className="px-6 py-3 text-center font-bold bg-slate-100">Total</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {stats.length === 0 ? (
                    <tr><td colSpan="7" className="p-8 text-center text-slate-400 italic">Aucune donnée trouvée pour ce territoire et ces filtres.</td></tr>
                ) : (
                    stats.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-6 py-3 font-medium">
                                <span className={`
                                    px-2 py-1 rounded text-xs font-bold
                                    ${row.regime.includes('STANDARD') ? 'bg-blue-100 text-blue-800' : 
                                      row.regime.includes('SANS PORC') ? 'bg-amber-100 text-amber-800' :
                                      row.regime.includes('VEGE') ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}
                                `}>
                                    {row.regime}
                                </span>
                            </td>
                            <td className="px-6 py-3 text-center">{row.mon}</td>
                            <td className="px-6 py-3 text-center">{row.tue}</td>
                            <td className="px-6 py-3 text-center text-slate-300">-</td>
                            <td className="px-6 py-3 text-center">{row.thu}</td>
                            <td className="px-6 py-3 text-center">{row.fri}</td>
                            <td className="px-6 py-3 text-center font-bold bg-slate-50">{row.total}</td>
                        </tr>
                    ))
                )}
            </tbody>
            {stats.length > 0 && (
                <tfoot className="bg-indigo-50 font-bold text-indigo-900 border-t-2 border-indigo-100">
                    <tr>
                        <td className="px-6 py-3">TOTAL GÉNÉRAL</td>
                        <td className="px-6 py-3 text-center">{stats.reduce((a,b)=>a+b.mon,0)}</td>
                        <td className="px-6 py-3 text-center">{stats.reduce((a,b)=>a+b.tue,0)}</td>
                        <td className="px-6 py-3 text-center">0</td>
                        <td className="px-6 py-3 text-center">{stats.reduce((a,b)=>a+b.thu,0)}</td>
                        <td className="px-6 py-3 text-center">{stats.reduce((a,b)=>a+b.fri,0)}</td>
                        <td className="px-6 py-3 text-center text-lg">{grandTotal}</td>
                    </tr>
                </tfoot>
            )}
        </table>
      </div>
      
      {/* Liste des écoles du territoire (pense-bête) */}
      <div className="mt-8 pt-8 border-t border-slate-200">
        <h4 className="text-sm font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
            <School size={16}/> Écoles incluses dans ce lot
        </h4>
        <div className="flex flex-wrap gap-2">
            {TERRITORIES_MAPPING.find(t => t.name === filters.territory)?.schools.map(s => (
                <span key={s} className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs border border-slate-200">
                    {s}
                </span>
            ))}
        </div>
      </div>

    </div>
  );
};

export default TerritoriesPage;