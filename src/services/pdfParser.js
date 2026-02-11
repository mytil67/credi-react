import * as pdfjsLib from 'pdfjs-dist';

// Configuration du Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.js';

// --- Utilitaires ---
const norm = s => (s || '').replace(/\u00A0/g, ' ').replace(/\s{2,}/g, ' ').trim();
const asInt = v => Number.parseInt(v, 10) || 0;
const hasNumbers = s => /\d/.test(s);

export const baseSchoolOf = (location) => {
    let s = ' ' + String(location || '') + ' ';
    s = s.replace(/\s[-–—]\s*(MATERNELLE|ÉLÉMENTAIRE|ELEMENTAIRE)\b/gi, ' ');
    s = s.replace(/\b(MATERNELLE|ÉLÉMENTAIRE|ELEMENTAIRE)\b/gi, ' ');
    s = s.replace(/\(\s*(MATERNELLE|ÉLÉMENTAIRE|ELEMENTAIRE)\s*\)/gi, ' ');
    s = s.replace(/\s{2,}/g, ' ').trim();
    return s;
};

// --- Extraction des lignes ---
async function pdfToLines(pdf) {
    const allLines = [];
    
    for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        
        // Nettoyage immédiat de la page pour la mémoire
        page.cleanup(); 

        const tol = 2;
        const buckets = [];

        for (const item of content.items) {
            const { str, transform } = item;
            const y = transform[5]; 
            const x = transform[4];

            let bucket = buckets.find(b => Math.abs(b.y - y) <= tol);
            if (!bucket) {
                bucket = { y, items: [] };
                buckets.push(bucket);
            }
            bucket.items.push({ x, str });
        }

        buckets.sort((a, b) => b.y - a.y);

        buckets.forEach(bucket => {
            bucket.items.sort((a, b) => a.x - b.x);
            const line = norm(bucket.items.map(i => i.str).join(' '));
            if (line) allLines.push(line);
        });
    }
    return allLines;
}

// --- Analyse Logique ---
export async function parsePDF(file) {
    let pdf = null;
    try {
        const arrayBuffer = await file.arrayBuffer();
        
        // Chargement du document
        pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        const lines = await pdfToLines(pdf);
        const textContent = lines.join('\n');

        // ... (Logique Regex inchangée) ...
        let week = null;
        let schoolYear = null;
        let docDate = null;

        const weekMatch = textContent.match(/semaine\s*(\d+)/i);
        if (weekMatch) week = ('0' + weekMatch[1]).slice(-2);

        const dateMatch = textContent.match(/du\s(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
        if (dateMatch) {
            docDate = dateMatch[0].replace('du ', '');
            const month = parseInt(dateMatch[2], 10);
            const year = parseInt(dateMatch[3], 10);
            schoolYear = month >= 9 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
        }

        if (!week) throw new Error("Numéro de semaine introuvable.");

        const results = [];
        let headerDays = [];
        const stopPatterns = [/^Totaux tous lieux confondus/i, /^Edité le/i, /^\s*SOUS-TOTAL/i, /^\s*TOTAL( |$)/i];

        for (const line of lines) {
            if (/^Lieu de prise de repas/i.test(line)) {
                headerDays = [];
                if (/Lundi/i.test(line)) headerDays.push('monday');
                if (/Mardi/i.test(line)) headerDays.push('tuesday');
                if (/Mercr/i.test(line)) headerDays.push('wednesday');
                if (/Jeudi/i.test(line)) headerDays.push('thursday');
                if (/Vendr/i.test(line)) headerDays.push('friday');
                continue;
            }

            if (headerDays.length === 0 || !hasNumbers(line)) continue;
            if (stopPatterns.some(p => p.test(line))) { headerDays = []; continue; }

            const dataRegex = /^(.*?)\s+(ADULTE\s+)?(HALAL|SANS PORC|STANDARD|VEGETARIEN|VÉGÉTARIEN|VEGE SUPPLEMENTAIRE)\s+([\d\s]+)$/i;
            const match = line.match(dataRegex);

            if (match) {
                const fullLocation = norm(match[1]);
                const isAdult = !!match[2];
                const regimeCore = norm(match[3]).toUpperCase().replace('É', 'E');
                const numbers = norm(match[4]).split(/\s+/).map(asInt);

                if (!fullLocation) continue;

                const baseSchool = baseSchoolOf(fullLocation);
                const schoolType = fullLocation.toUpperCase();
                const regime = (isAdult ? 'ADULTE ' : '') + regimeCore;
                
                const row = {
                    document_id: `doc_${baseSchool.replace(/\s+/g, '-')}_${week}`,
                    base_school: baseSchool,
                    school_type: schoolType,
                    week_number: week,
                    regime: regime,
                    monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, total: 0,
                    document_date: docDate,
                    school_year: schoolYear
                };

                if (numbers.length >= headerDays.length) {
                    let calculatedTotal = 0;
                    headerDays.forEach((day, index) => {
                        if (day !== 'wednesday') {
                            const val = numbers[index];
                            row[day] = val;
                            calculatedTotal += val;
                        }
                    });
                    row.total = calculatedTotal;
                    results.push(row);
                }
            }
        }
        return results;

    } catch (error) {
        throw error;
    } finally {
        // --- OPTIMISATION CRITIQUE ---
        // On détruit le document PDF pour libérer la RAM immédiatement
        if (pdf) {
            pdf.destroy(); 
        }
    }
}