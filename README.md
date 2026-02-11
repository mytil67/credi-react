Documentation Technique - Application CREDI (v2.1)
1. Architecture Générale
L'application est une Single Page Application (SPA) React fonctionnant en local (Client-side). Elle utilise une base de données relationnelle SQL en mémoire vive (RAM) via WebAssembly.

Front-end : React 18 (Vite) + Tailwind CSS.

Base de Données : SQLite (via sql.js). La BDD est éphémère : elle vit dans la RAM du navigateur.

Persistance : Se fait uniquement par export/import manuel d'un fichier .db (binaire SQLite).

Traitement Fichiers :

PDF : Parsing via pdfjs-dist (extraction textuelle spatiale).

CSV : Parsing natif (gestion séparateurs dynamiques).

2. Structure des Fichiers Clés
Plaintext
src/
├── constants/
│   └── territories.js       # Référentiel CONSTANT (backup) des Lots et Écoles.
├── context/
│   └── DatabaseContext.jsx  # Context React : Initialise SQL.js et expose l'objet 'db'.
├── pages/
│   ├── UploadPage.jsx       # Import PDF (Batch) & Import CSV Référentiel (Encodage ISO).
│   ├── DataPage.jsx         # Grille de données avec Pagination (50 items) & Filtres.
│   ├── CheckPage.jsx        # Algorithme de contrôle qualité (Semaines manquantes).
│   └── TerritoriesPage.jsx  # Vue agrégée par Lot pour facturation.
├── services/
│   ├── db.js                # COEUR DU SYSTÈME : Schéma BDD, Insertions sécurisées, Import CSV.
│   └── pdfParser.js         # Moteur Regex pour transformer les PDF en JSON.
└── App.jsx                  # Routeur.
3. Schéma de Base de Données (SQLite)
La base contient désormais 4 tables.

A. Table deliveries (Données Commandes)
Stocke les lignes extraites des PDF.

SQL
CREATE TABLE deliveries (
    id INTEGER PRIMARY KEY,
    document_id TEXT,                -- ID unique (ex: doc_EM-KLEBER_45)
    base_school TEXT,                -- Clé étrangère logique vers 'cantines.school_name'
    school_type TEXT,                -- Type brut (ex: "ECOLE MATERNELLE KLEBER")
    week_number TEXT,                -- Semaine (ex: "45")
    regime TEXT,                     -- Ex: "SANS PORC", "STANDARD"
    monday INTEGER, tuesday INTEGER, -- Quantités journalières
    wednesday INTEGER, thursday INTEGER, friday INTEGER,
    total INTEGER,
    document_date TEXT,
    school_year TEXT                 -- Ex: "2025-2026"
);
-- Index pour performance recherche
CREATE INDEX idx_school_week ON deliveries(base_school, week_number);
B. Table cantines (Référentiel Écoles - NOUVEAU)
Importée depuis BASE_Cantine.csv. Sert de "Carte d'identité" pour l'analyse BI future.

SQL
CREATE TABLE cantines (
    school_name TEXT PRIMARY KEY,    -- Nom école (doit matcher base_school)
    provider TEXT,                   -- Prestataire (ex: API, SAR)
    territory TEXT,                  -- Territoire (ex: N2R, GCVK)
    production_mode TEXT,            -- Mode (ex: LF = Liaison Froide)
    ar TEXT,                         -- Mode AR (ex: Régie, Ext)
    inox TEXT                        -- Indicateur Inox (oui/non)
);
C. Tables Techniques
school_details : Table pivot historique pour le mapping Territoire (peuplée automatiquement via le CSV ou territories.js).

strike_days : Stocke les exceptions (jours de grève) pour exclure les repas du calcul.

4. Modules Fonctionnels & Algorithmes
A. Import Référentiel CSV (src/services/db.js)
La fonction importCantinesCSV est critique pour l'enrichissement des données.

Détection Séparateur : Analyse la première ligne pour décider entre , (Standard) et ; (Excel FR).

Encodage (src/pages/UploadPage.jsx) : Le fichier est lu en ISO-8859-1 (Windows-1252) pour garantir que les accents français (é, è, à) d'Excel ne soient pas corrompus.

Logique : INSERT OR REPLACE. Si une école existe déjà, ses infos (prestataire, inox...) sont mises à jour.

B. Protection Anti-Écrasement (src/services/db.js)
Fonction insertDelivery.

Avant d'insérer une ligne venant d'un PDF, on exécute :
SELECT 1 FROM deliveries WHERE base_school=? AND week_number=? AND school_type=?

Si un résultat est trouvé : On ignore l'insertion (return false).

Objectif : Si l'utilisateur a modifié manuellement une donnée ou supprimé une erreur dans l'app, le re-scan du PDF original n'écrasera pas son travail.

C. Algorithme de Contrôle Qualité (src/pages/CheckPage.jsx)
Détermine quelles semaines manquent pour chaque école.

Liste de Référence : Utilise EXPECTED_WEEKS_RAW (liste codée en dur excluant déjà les vacances scolaires Toussaint/Noël/Hiver/Printemps).

Filtre Temporel : Ne vérifie que les semaines passées (inférieures ou égales à la semaine actuelle système).

Exception "Couffignal" :

Si l'école contient "COUFFIGNAL", la vérification s'arrête strictement à la Semaine 44. Les semaines 45+ sont ignorées (car plus de service).

D. Optimisation Performances (Batching)
Pagination : La DataPage affiche par pages de 50 lignes pour ne pas figer le DOM.

Scan PDF : Traitement par paquets de 10 fichiers avec pause forcée (setTimeout 20ms) pour laisser respirer le navigateur.

5. Guide pour le Développeur
Comment ajouter une colonne au référentiel ?
Modifier le schéma CREATE TABLE cantines dans src/services/db.js.

Modifier la fonction importCantinesCSV pour mapper la nouvelle colonne (ex: cols[7]).

Ajouter la colonne dans le fichier Excel source.

Comment mettre à jour les vacances scolaires ?
Ouvrir src/pages/CheckPage.jsx.

Modifier la constante EXPECTED_WEEKS_RAW pour ajouter/retirer des numéros de semaines selon le calendrier officiel de la Zone B.

Commandes Build & Deploy
L'application est statique.

Bash
# Lancer en dev
npm run dev

# Compiler pour prod (génère le dossier /dist)
npm run build
Le dossier /dist peut être hébergé sur n'importe quel serveur web (Apache, Nginx, Vercel, Netlify) sans configuration PHP/Node.js.
