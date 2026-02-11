import React, { useState, useEffect } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { CheckSquare, AlertTriangle, CheckCircle, Search, Calendar, ShieldAlert } from 'lucide-react';

// --- CONFIGURATION STRICTE ---
const EXPECTED_WEEKS_RAW = [
    '02', '03', '04', '05', '06', '09', '10', '11', '12', '13', '14', 
    '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', 
    '36', '37', '38', '39', '40', '41', '42', '45', '46', '47', '48', '49', '50', '51'
];

const SORTED_EXPECTED_WEEKS = [...EXPECTED_WEEKS_RAW].sort((a, b) => {
    const wa = parseInt(a, 10);
    const wb = parseInt(b, 10);
    const weightA = wa < 30 ? wa + 52 : wa;
    const weightB = wb < 30 ? wb + 52 : wb;
    return weightA - weightB;
});

const getCurrentWeekNumber = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    return String(weekNum).padStart(2, '0');
};

const CheckPage = () => {
  const { db, isLoaded } = useDatabase();
  const [report, setReport] = useState([]);
  const [filter, setFilter] = useState('');
  
  const [currentWeek, setCurrentWeek] = useState(getCurrentWeekNumber());
  const [weeksDue, setWeeksDue] = useState([]);

  useEffect(() => {
    const nowWeek = getCurrentWeekNumber();
    setCurrentWeek(nowWeek);
    
    let cutoffIndex = -1;
    cutoffIndex = SORTED_EXPECTED_WEEKS.indexOf(nowWeek);
    
    if (cutoffIndex === -1) {
        const nowWeight = parseInt(nowWeek) < 30 ? parseInt(nowWeek) + 52 : parseInt(nowWeek);
        for (let i = 0; i < SORTED_EXPECTED_WEEKS.length; i++) {
            const w = SORTED_EXPECTED_WEEKS[i];
            const wWeight = parseInt(w) < 30 ? parseInt(w) + 52 : parseInt(w);
            if (wWeight > nowWeight) {
                cutoffIndex = i - 1;
                break;
            }
            if (i === SORTED_EXPECTED_WEEKS.length - 1) cutoffIndex = i;
        }
    }

    if (cutoffIndex !== -1) {
        setWeeksDue(SORTED_EXPECTED_WEEKS.slice(0, cutoffIndex + 1));
    } else {
        setWeeksDue([]);
    }
  }, []);

  useEffect(() => {
    if (db && isLoaded && weeksDue.length > 0) {
      generateReport();
    }
  }, [db, isLoaded, weeksDue]);

  const generateReport = () => {
    const query = `
        SELECT base_school, GROUP_CONCAT(DISTINCT week_number) as weeks
        FROM deliveries
        GROUP BY base_school
        ORDER BY base_school
    `;
    
    try {
        const res = db.exec(query);
        if (res.length > 0 && res[0].values) {
            const data = res[0].values.map(row => {
                const schoolName = row[0];
                const presentWeeksRaw = row[1] ? row[1].split(',') : [];
                const presentWeeks = new Set(presentWeeksRaw);
                
                // --- GESTION DES EXCEPTIONS ---
                let specificWeeksDue = [...weeksDue];

                // Exception Lycée Couffignal : Arrêt à la semaine 45 (incluse ou exclue selon besoin, ici < 45)
                if (schoolName.toUpperCase().includes('COUFFIGNAL')) {
                    specificWeeksDue = specificWeeksDue.filter(w => {
                        // On garde les semaines si elles sont AVANT la semaine 45
                        // (Attention à la logique S36 > S45 mathématiquement faux mais chronologiquement vrai)
                        // Ici on fait simple : on exclut 45, 46, 47...
                        const num = parseInt(w, 10);
                        // On retire tout ce qui est >= 45 (donc fin d'année civile)
                        return num < 45 && num > 30; // Garde S36 à S44
                        // Note : Si Couffignal reprend en janvier (S01), il faudra adapter.
                        // Si c'est arrêt définitif, ça marche.
                    });
                }

                // Calcul des manquants basé sur la liste spécifique
                const missingWeeks = specificWeeksDue.filter(expected => !presentWeeks.has(expected));
                
                const expectedCount = specificWeeksDue.length;
                const validPresentCount = specificWeeksDue.filter(w => presentWeeks.has(w)).length;
                
                // Eviter la division par zéro si expectedCount est 0 (cas Couffignal après S45)
                const percentage = expectedCount > 0 
                    ? Math.round((validPresentCount / expectedCount) * 100) 
                    : 100;

                return {
                    schoolName,
                    missingWeeks, 
                    validCount: validPresentCount,
                    expectedCount,
                    percentage,
                    isException: schoolName.toUpperCase().includes('COUFFIGNAL')
                };
            });
            setReport(data);
        } else {
            setReport([]);
        }
    } catch (e) {
        console.error("Erreur rapport:", e);
    }
  };

  const filteredReport = report.filter(r => 
    r.schoolName.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      
      <div className="flex justify-between items-start">
        <div>
            <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                <CheckSquare className="text-blue-600" /> Contrôle & Qualité
            </h2>
            <div className="flex flex-col gap-1 mt-2">
                <p className="text-sm text-slate-500 flex items-center gap-2">
                    <Calendar size={14} />
                    Contrôle : <span className="font-bold text-slate-700">Rentrée ➔ Semaine {currentWeek}</span>
                </p>
            </div>
        </div>

        <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
            <input 
                type="text" 
                placeholder="Filtrer école..." 
                className="pl-10 pr-4 py-2 border rounded-lg text-sm w-64 focus:ring-2 focus:ring-blue-500 outline-none"
                value={filter}
                onChange={e => setFilter(e.target.value)}
            />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                    <tr>
                        <th className="px-6 py-3 w-1/4">École</th>
                        <th className="px-6 py-3 text-center w-40">Taux de présence</th>
                        <th className="px-6 py-3">Données manquantes</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredReport.length === 0 ? (
                        <tr><td colSpan="3" className="p-12 text-center text-slate-400 italic">
                            {db ? "Chargement des données..." : "Base de données non initialisée."}
                        </td></tr>
                    ) : (
                        filteredReport.map((row) => (
                            <tr key={row.schoolName} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-900 text-base">{row.schoolName}</span>
                                        {row.isException && (
                                            <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200" title="Règles spécifiques appliquées (ex: arrêt S45)">
                                                Exception
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-slate-400 mt-1">
                                        {row.validCount} / {row.expectedCount} semaines attendues
                                    </div>
                                </td>
                                
                                <td className="px-6 py-4 text-center align-middle">
                                    <div className="flex flex-col items-center gap-1">
                                        <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full transition-all duration-500 ${
                                                    row.percentage === 100 ? 'bg-green-500' : 
                                                    row.percentage > 80 ? 'bg-blue-500' : 
                                                    row.percentage > 50 ? 'bg-yellow-500' : 'bg-red-500'
                                                }`} 
                                                style={{ width: `${row.percentage}%` }}
                                            ></div>
                                        </div>
                                        <span className="text-xs font-bold text-slate-600">{row.percentage}%</span>
                                    </div>
                                </td>

                                <td className="px-6 py-4">
                                    {row.missingWeeks.length === 0 ? (
                                        <div className="flex items-center gap-2 text-green-700 bg-green-50 px-3 py-2 rounded-lg border border-green-100 w-fit">
                                            <CheckCircle size={18} />
                                            <span className="font-medium">Dossier complet</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-2 text-red-700 mb-1">
                                                <AlertTriangle size={16} />
                                                <span className="font-bold text-xs uppercase tracking-wide">Semaines manquantes :</span>
                                            </div>
                                            
                                            <div className="flex flex-wrap gap-1.5">
                                                {row.missingWeeks.map(w => (
                                                    <span 
                                                        key={w} 
                                                        className="px-2 py-1 rounded text-xs font-mono font-bold bg-red-100 text-red-700 border border-red-200 shadow-sm"
                                                    >
                                                        S{w}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </td>
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

export default CheckPage;