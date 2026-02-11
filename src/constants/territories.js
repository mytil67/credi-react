/**
 * Référentiel des Territoires (Lots)
 * Extrait de la fonction loadHardcodedTerritories du script original.
 */
export const TERRITORIES_MAPPING = [
  { 
    lot: 1,
    name: "HC : Hautepierre, Cronenbourg", 
    schools: [
      "BRIGITTE", "COLLEGE SOPHIE GERMAIN", "COLLEGE TRUFFAUT", "CROUS CRONENBOURG - CATHERINE", 
      "CROUS CRONENBOURG - HIRTZ", "CSC VICTOR SCHOELCHER", "DORE", "HIRTZ", "JACQUELINE"
    ]
  },
  { 
    lot: 2,
    name: "KPMVE : Koengishoffen, Poteries, Montagne Verte, Elsau", 
    schools: [
      "CAHN", "CLAUS", "ERCKMANN CHATRIAN", "GLIESBERG", "GUTENBERG", "HOHBERG", 
      "ROMAINS", "STOSKOPF", "VINCI", "MENTELIN"
    ]
  },
  { 
    lot: 3,
    name: "CGBK : Centre, Gare, Bourse, Krutenau", 
    schools: [
      "COMPAGNONS DU DEVOIR", "FINKWILLER", "FOYER ABRAPA DE LA KRUTENAU", "LOUVOIS", 
      "PASTEUR", "SAINT JEAN", "SAINT THOMAS", "SAINTE AURELIE", "SAINTE MADELEINE", 
      "SCHEPPLER", "SCHOEPFLIN"
    ]
  },
  { 
    lot: 4,
    name: "ESCRO : Esplanade, Conseil des XV, Robertsau", 
    schools: [
      "BRANLY", "COLLEGE JULES HOFFMANN", "CONSEIL DES XV DOUAI", "CONSEIL DES XV WALLONIE", 
      "LYCEE MARIE CURIE", "NIEDERAU", "ROBERTSAU", "SCHUMAN", "SCHWILGUE", "STURM", "VAUBAN"
    ]
  },
  { 
    lot: 5,
    name: "N2R : Neudorf, 2 Rives", 
    schools: [
      "AMPERE", "FERNEX", "LE GRAND", "LE GRAND (DELESTAGE LE GRAND )", "LYCEE COUFFIGNAL", 
      "MUSAU", "NEUFELD", "RHIN", "SCHLUTHFELD", "ZIEGELAU"
    ]
  },
  { 
    lot: 6,
    name: "MN : Meinau, Neuhof", 
    schools: [
      "AUBERGE DE JEUNESSE DES DEUX RIVES (REUSS)", "CANARDIERE", "ESAT GANZAU", "FISCHART", 
      "GUYNEMER", "KRIMMERI", "MAISON DE RETRAITE LE KACHELOFE", "MEINAU", "MOSNIER", 
      "SALLE DU MANÈGE", "STOCKFELD"
    ]
  }
];

/**
 * Trouve le territoire correspondant à une école.
 * Reproduit la logique "floue" (fuzzy match) du script original :
 * On cherche si le nom PDF contient le nom config OU si le nom config contient le nom PDF.
 */
export const findTerritoryForSchool = (schoolName) => {
  if (!schoolName) return "Non assigné";
  
  const cleanInput = schoolName.toUpperCase().trim();

  for (const t of TERRITORIES_MAPPING) {
    for (const configSchool of t.schools) {
      const cleanConfig = configSchool.toUpperCase();
      
      // 1. Correspondance exacte
      if (cleanInput === cleanConfig) return t.name;
      
      // 2. Le nom du PDF contient le nom de la config (ex: "ECOLE BRIGITTE" contient "BRIGITTE")
      if (cleanInput.includes(cleanConfig)) return t.name;
      
      // 3. Le nom de la config contient le nom du PDF (Cas inverses plus rares)
      if (cleanConfig.includes(cleanInput)) return t.name;
    }
  }
  
  return "Non assigné";
};