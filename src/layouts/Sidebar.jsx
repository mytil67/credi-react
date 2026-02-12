import React from 'react';
import { Database, Upload, BarChart3, LayoutDashboard, Ban, Map, CheckSquare, Edit3 } from 'lucide-react';
import { useDatabase } from '../context/DatabaseContext';

const Sidebar = ({ activeTab, setActiveTab }) => {
  const { isLoaded, stats } = useDatabase();

  const menuItems = [
    { id: 'upload', label: 'Charger Données', icon: Upload },
    { id: 'data', label: 'Données & Filtres', icon: Database },
	{ id: 'manual', label: 'Saisie Manuelle', icon: Edit3 },
    { id: 'territories', label: 'Vue par Territoire', icon: Map },
    { id: 'check', label: 'Contrôle & Qualité', icon: CheckSquare }, // <--- C'EST CETTE LIGNE QUI AJOUTE L'ONGLET
    { id: 'strikes', label: 'Jours Grèves / Fériés', icon: Ban },
    { id: 'summary', label: 'Synthèse Écoles', icon: BarChart3 },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-white h-screen flex flex-col fixed left-0 top-0 shadow-xl z-50">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <LayoutDashboard className="text-blue-500" />
          <span>CREDI <span className="text-blue-500">React</span></span>
        </h1>
        <p className="text-xs text-slate-400 mt-2">Refonte Moderne v2.0</p>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
              activeTab === item.id
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <item.icon size={20} className={activeTab === item.id ? 'text-white' : 'text-slate-400 group-hover:text-white'} />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800 bg-slate-950/50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={`w-3 h-3 rounded-full ${isLoaded ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 animate-pulse'}`}></div>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-300">
              {isLoaded ? 'Base connectée' : 'Connexion...'}
            </span>
            <span className="text-[10px] text-slate-500">
              {isLoaded ? `${stats.records} enregistrements` : 'Initialisation'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;