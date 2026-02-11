import React, { useState, useEffect, useMemo } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { getUniqueValues, searchDeliveries } from '../services/db';
import { TERRITORIES_MAPPING } from '../constants/territories';
import { Filter, Search, Utensils, School, Calendar, Map as MapIcon, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

const DataPage = () => {
  const { db, isLoaded } = useDatabase();
  
  const [filters, setFilters] = useState({
    year: 'all',
    week: 'all',
    school: 'all',
    type: 'all',
    territory: 'all'
  });

  const [options, setOptions] = useState({
    years: [],
    weeks: [],
    schools: [],
    territories: TERRITORIES_MAPPING.map(t => t.name)
  });

  // Données complètes (pour les calculs de totaux)
  const [data, setData] = useState([]);
  
  // --- PAGINATION ---
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50); // Par défaut 50 lignes

  useEffect(() => {
    if (db && isLoaded) {
      setOptions(prev => ({
        ...prev,
        years: getUniqueValues(db, 'school_year'),
        weeks: getUniqueValues(db, 'week_number'),
        schools: getUniqueValues(db, 'base_school'),
      }));
      handleSearch();
    }
  }, [db, isLoaded]);

  // Quand on change un filtre, on relance la recherche ET on revient page 1
  useEffect(() => {
    handleSearch();
    setCurrentPage(1); 
  }, [filters]);

  const handleSearch = () => {
    if (!db) return;
    // SQL.js est très rapide pour récupérer les données, c'est l'affichage qui est lent.
    // On récupère tout pour avoir les bons KPIs.
    const results = searchDeliveries(db, filters);
    setData(results);
  };

  // KPIs calculés sur la totalité des données (pas juste la page affichée)
  const kpi = useMemo(() => {
    const totalMeals = data.reduce((sum, row) => sum + (row.total || 0), 0);
    const uniqueSchools = new Set(data.map(r => r.base_school)).size;
    return { totalMeals, uniqueSchools, count: data.length };
  }, [data]);

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // --- LOGIQUE PAGINATION ---
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentData = data.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(data.length / itemsPerPage);

  const goToPage = (pageNumber) => {
    setCurrentPage(Math.max(1, Math.min(pageNumber, totalPages)));
  };

  if (!isLoaded) return <div className="p-8">Chargement de la base...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 h-screen flex flex-col overflow-hidden">
      
      {/* En-tête */}
      <div className="flex-none space-y-4">
        <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <Search className="text-blue-600" /> Données & Vérification
        </h2>

        {/* Barre de Filtres */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Année</label>
            <select className="w-full p-2 border border-slate-300 rounded-lg text-sm" value={filters.year} onChange={(e) => updateFilter('year', e.target.value)}>
              <option value="all">Toutes</option>
              {options.years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Territoire</label>
            <select className="w-full p-2 border border-slate-300 rounded-lg text-sm font-medium text-blue-700 bg-blue-50" value={filters.territory} onChange={(e) => updateFilter('territory', e.target.value)}>
              <option value="all">Tous les territoires</option>
              {options.territories.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">École</label>
            <select className="w-full p-2 border border-slate-300 rounded-lg text-sm" value={filters.school} onChange={(e) => updateFilter('school', e.target.value)}>
              <option value="all">Toutes</option>
              {options.schools.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Semaine</label>
            <select className="w-full p-2 border border-slate-300 rounded-lg text-sm" value={filters.week} onChange={(e) => updateFilter('week', e.target.value)}>
              <option value="all">Toutes</option>
              {options.weeks.map(w => <option key={w} value={w}>Semaine {w}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Type</label>
            <select className="w-full p-2 border border-slate-300 rounded-lg text-sm" value={filters.type} onChange={(e) => updateFilter('type', e.target.value)}>
              <option value="all">Tous</option>
              <option value="MATERNELLE">Mat.</option>
              <option value="ELEMENTAIRE">Elem.</option>
            </select>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-600 text-white p-4 rounded-xl shadow-lg flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Total Repas (Filtre actuel)</p>
              <p className="text-3xl font-bold">{kpi.totalMeals.toLocaleString()}</p>
            </div>
            <Utensils className="opacity-80" size={32} />
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-sm font-medium">Écoles concernées</p>
              <p className="text-3xl font-bold text-slate-800">{kpi.uniqueSchools}</p>
            </div>
            <School className="text-slate-400" size={32} />
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-sm font-medium">Lignes de données</p>
              <p className="text-3xl font-bold text-slate-800">{kpi.count}</p>
            </div>
            <Calendar className="text-slate-400" size={32} />
          </div>
        </div>
      </div>

      {/* Tableau avec Scroll et Pagination */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        
        {/* En-tête Tableau + Contrôles Pagination */}
        <div className="p-3 border-b border-slate-200 flex justify-between items-center bg-slate-50">
            <div className="text-xs text-slate-500">
                Affichage {indexOfFirstItem + 1} à {Math.min(indexOfLastItem, data.length)} sur {data.length}
            </div>
            <div className="flex items-center gap-4">
                <select 
                    className="p-1 border rounded text-xs"
                    value={itemsPerPage}
                    onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                >
                    <option value={50}>50 / page</option>
                    <option value={100}>100 / page</option>
                    <option value={500}>500 / page</option>
                </select>
                <div className="flex gap-1">
                    <button onClick={() => goToPage(1)} disabled={currentPage === 1} className="p-1 rounded hover:bg-slate-200 disabled:opacity-30"><ChevronsLeft size={16}/></button>
                    <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} className="p-1 rounded hover:bg-slate-200 disabled:opacity-30"><ChevronLeft size={16}/></button>
                    <span className="text-xs font-bold py-1 px-2">Page {currentPage} / {totalPages || 1}</span>
                    <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} className="p-1 rounded hover:bg-slate-200 disabled:opacity-30"><ChevronRight size={16}/></button>
                    <button onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages} className="p-1 rounded hover:bg-slate-200 disabled:opacity-30"><ChevronsRight size={16}/></button>
                </div>
            </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-6 py-3">École</th>
                <th className="px-6 py-3">Territoire</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Semaine</th>
                <th className="px-6 py-3">Régime</th>
                <th className="px-6 py-3 text-center">Lun</th>
                <th className="px-6 py-3 text-center">Mar</th>
                <th className="px-6 py-3 text-center">Jeu</th>
                <th className="px-6 py-3 text-center">Ven</th>
                <th className="px-6 py-3 text-center font-bold bg-slate-100">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentData.length === 0 ? (
                 <tr>
                    <td colSpan="10" className="px-6 py-12 text-center text-slate-400 italic">
                        Aucune donnée trouvée pour ces filtres.
                    </td>
                 </tr>
              ) : (
                currentData.map((row) => (
                  <tr key={row.id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-6 py-3 font-medium text-slate-900">{row.base_school}</td>
                    <td className="px-6 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                        {row.territory || 'Non assigné'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-xs text-slate-500">{row.school_type}</td>
                    <td className="px-6 py-3"><span className="bg-slate-100 px-2 py-1 rounded text-xs font-mono">S{row.week_number}</span></td>
                    <td className="px-6 py-3"><span className="text-xs font-semibold">{row.regime}</span></td>
                    <td className="px-6 py-3 text-center">{row.monday}</td>
                    <td className="px-6 py-3 text-center">{row.tuesday}</td>
                    <td className="px-6 py-3 text-center">{row.thursday}</td>
                    <td className="px-6 py-3 text-center">{row.friday}</td>
                    <td className="px-6 py-3 text-center font-bold bg-slate-50/50">{row.total}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DataPage;