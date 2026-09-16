import Papa from 'papaparse';

const GOOGLE_SHEETS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS_FSc2mEYZgHXsTskSerRAs7TKIqydjuroEw3WQJd2NdX2FtGW7rFY-HKyRhRxqw/pub?gid=1474611999&single=true&output=csv';

let products = [];
let _dataReady = false;     // true cuando el fetch de Sheets termina (éxito o error)
let _pendingApplyFilters = false; // true si el usuario saltó al catálogo antes de que cargara la data

function parseGoogleSheetsCSV(csvText) {
    const results = Papa.parse(csvText, { skipEmptyLines: true });
    const rows = results.data;
    if (!rows || rows.length === 0) return [];

    const parsed = [];
    let currentCategory = 'Cauchos';
    let currentRim = 13;
    let currentSubBrand = '';
    let idCounter = 1;

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const col0 = (row[0] || '').trim();
        const col1 = (row[1] || '').trim();
        const col2 = (row[2] || '').trim();
        const col3 = (row[3] || '').trim();
        const col4 = (row[4] || '').trim();
        const col5 = (row[5] || '').trim();
        const col6 = (row[6] || '').trim();

        const fullRowStr = (col0 + ' ' + col1 + ' ' + col2 + ' ' + col3 + ' ' + col4 + ' ' + col5 + ' ' + col6).toUpperCase();

        // Ignorar metadatos y encabezados de columnas
        if (fullRowStr.includes('TASA') || fullRowStr.includes('BCV') || fullRowStr.includes('TOTAL') || fullRowStr.includes('CODIGO') || fullRowStr.includes('DESCRIPCION')) continue;

        // Detectar cambio de categoría
        if (fullRowStr.includes('CAUCHOS') && !col0.includes('/')) { currentCategory = 'Cauchos'; currentSubBrand = ''; continue; }
        if (fullRowStr.includes('RINES RUSTICOS') || fullRowStr.includes('RINES DE LUJO') || (fullRowStr.includes('RINES') && !col0)) { currentCategory = 'Rines'; currentSubBrand = ''; continue; }
        if (fullRowStr.includes('BATERIAS') && !col0) { currentCategory = 'Baterías'; currentSubBrand = ''; continue; }
        if (fullRowStr.includes('FORRO DE ASIENTO') && !col0) { currentCategory = 'Forros'; currentSubBrand = ''; continue; }
        if ((fullRowStr.includes('TRIPAS') || fullRowStr.includes('PROTECTORES')) && !col0) { currentCategory = 'Tripas/Protectores'; currentSubBrand = ''; continue; }
        if (fullRowStr.includes('LUBRICANTES') && !col0) { currentCategory = 'Lubricantes'; currentSubBrand = ''; continue; }
        if (fullRowStr.includes('REFRIGERANTES') && !col0) { currentCategory = 'Refrigerantes'; currentSubBrand = ''; continue; }
        if ((fullRowStr.includes('PASTILLAS DE FRENOS') || fullRowStr.includes('PASTILLAS')) && !col0) {
            currentCategory = 'Pastillas';
            if (col2) currentSubBrand = col2;
            else if (col1 && !col1.includes('PASTILLAS')) currentSubBrand = col1;
            continue;
        }

        // Detectar encabezados de Rin (R13, R14, R15, R16, R17, R18)
        if (!col0 && (col1.toUpperCase().startsWith('R1') || col1.toUpperCase().startsWith('R2'))) {
            const rimMatch = col1.match(/R(\d+)/i);
            if (rimMatch) {
                currentRim = parseInt(rimMatch[1], 10);
            }
            continue;
        }

        // Extraer Precio Ref. BCV (col3) y Precio Divisas (col4)
        let priceBcvStr = col3;
        let priceDivisaStr = col4;

        let priceBcv = parseFloat((priceBcvStr || '').replace(/[^0-9.]/g, ''));
        let priceDivisa = parseFloat((priceDivisaStr || '').replace(/[^0-9.]/g, ''));

        if (isNaN(priceBcv) || priceBcv <= 0) {
            priceBcv = priceDivisa || parseFloat((col5 || '').replace(/[^0-9.]/g, '')) || 0;
        }
        if (isNaN(priceDivisa) || priceDivisa <= 0) {
            priceDivisa = priceBcv;
        }

        if (isNaN(priceBcv) || priceBcv <= 0) continue;

        let qty = parseInt(col2, 10);
        if (isNaN(qty)) qty = 0;

        let cost = parseFloat((col5 || '').replace(/[^0-9.]/g, '')) || 0;

        if (currentCategory === 'Cauchos') {
            if (!col0 || !col1) continue;

            let width = 0, profile = 0, rim = currentRim;
            // Regex robusto: captura perfiles decimales (ej: 31X10.50R15)
            const sizeMatch =
                col0.match(/(\d+)\/(\d+(?:[.,]\d+)?)\s*[\/\\]?\s*[rR](\d+)/i) ||
                col0.match(/(\d+)[xX](\d+(?:[.,]\d+)?)\s*[rR](\d+)/i) ||
                col0.match(/(\d+)\/(\d+(?:[.,]\d+)?)/i) ||
                col0.match(/(\d+)[xX](\d+(?:[.,]\d+)?)/i);
            if (sizeMatch) {
                width = parseInt(sizeMatch[1], 10);
                profile = parseFloat((sizeMatch[2] || '0').replace(',', '.'));
                if (sizeMatch[3]) rim = parseInt(sizeMatch[3], 10);
            } else {
                continue;
            }

            // Corrección de error tipográfico del Excel: 175/70R15 ubicado en la sección R13 es realmente R13
            let rawCol = col0;
            if (currentRim === 13 && width === 175 && profile === 70 && rim === 15) {
                rim = 13;
                rawCol = rawCol.replace(/R15/i, 'R13');
            }

            const parts = col1.split(' ');
            const brand = parts[0] || '';
            const model = parts.slice(1).join(' ') || '';

            let terrain = 'HT';
            if (fullRowStr.includes('AT')) terrain = 'AT';
            if (fullRowStr.includes('MT')) terrain = 'MT';

            let image = '';
            for (let c = 0; c < row.length; c++) {
                const val = (row[c] || '').trim();
                if (val.startsWith('http://') || val.startsWith('https://') || val.endsWith('.jpg') || val.endsWith('.png') || val.endsWith('.webp')) {
                    image = val;
                    break;
                }
            }

            parsed.push({
                id: idCounter++,
                category: 'Cauchos',
                brand: brand,
                model: model,
                width: width,
                profile: profile,
                rim: rim,
                terrain: terrain,
                qty: qty,
                cost: cost,
                price: priceBcv,
                priceDivisa: priceDivisa,
                image: image,
                rawCol0: rawCol
            });
        } else {
            if (!col0 && !col1) continue;

            let brand = col0 || col1;
            let model = col0 && col1 ? col1 : '';

            if (currentCategory === 'Pastillas' && currentSubBrand) {
                brand = `${currentSubBrand} — ${col0}`;
                model = col1;
            }

            let rim = 0;
            if (currentCategory === 'Tripas/Protectores' || currentCategory === 'Tripas') {
                const str = (col0 + ' ' + col1).toUpperCase();
                const mSlash = str.match(/\/(\d{2})(?:\s+[A-Z]+)?$/i);
                if (mSlash) {
                    rim = parseInt(mSlash[1], 10);
                } else {
                    const mLetter = str.match(/^[A-Z](\d{2})/i);
                    if (mLetter) {
                        rim = parseInt(mLetter[1], 10);
                    } else {
                        const mAll = str.match(/\b\d{2}\b/g);
                        if (mAll && mAll.length > 0) {
                            const validRims = mAll.map(Number).filter(n => n >= 10 && n <= 30 && n !== 50 && n !== 70 && n !== 75 && n !== 80 && n !== 85);
                            if (validRims.length > 0) rim = validRims[validRims.length - 1];
                        }
                    }
                }
            } else if (currentCategory === 'Rines') {
                const rimMatch = (col0 + ' ' + col1).match(/(\d+)X/i) || (col0 + ' ' + col1).match(/R(\d+)/i);
                if (rimMatch) rim = parseInt(rimMatch[1], 10);
                else rim = 0;
            } else {
                rim = 0;
            }

            let image = '';
            for (let c = 0; c < row.length; c++) {
                const val = (row[c] || '').trim();
                if (val.startsWith('http://') || val.startsWith('https://') || val.endsWith('.jpg') || val.endsWith('.png') || val.endsWith('.webp')) {
                    image = val;
                    break;
                }
            }

            parsed.push({
                id: idCounter++,
                category: currentCategory,
                brand: brand,
                model: model,
                width: 0,
                profile: 0,
                rim: rim,
                terrain: '',
                qty: qty,
                cost: cost,
                price: priceBcv,
                priceDivisa: priceDivisa,
                image: image,
                rawCol0: col0
            });
        }
    }

    return parsed;
}

function removeAccents(str) {
    return str ? str.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';
}

// ─── REGLA UNIVERSAL DE IMÁGENES ────────────────────────────────────────────
// Las fotos reales se guardan en public/cauchos/r{rin}/
// Nombre de archivo: {ancho}.{perfil}r{rin}{marca}.jpg  (ej: 195.60r15aplus.jpg)
// Offroad: {ancho}x{perfil}r{rin}{marca}.jpg            (ej: 31x10.50r15aplus.jpg)
// Ruta en código: /cauchos/r{rin}/{archivo}
// ────────────────────────────────────────────────────────────────────────────
const CUSTOM_IMAGE_MAP = [

    // ── R13 ── (específicos PRIMERO, genéricos al final) ─────────────────────
    // 165/65 R13
    { key: 'duringo',   width: 165, profile: 65, rim: 13, img: '/cauchos/r13/165.65r13duringon.jpg' },
    { key: 'duringon',  width: 165, profile: 65, rim: 13, img: '/cauchos/r13/165.65r13duringon.jpg' },
    { key: 'compasal',  width: 165, profile: 65, rim: 13, img: '/cauchos/r13/165.65r13compasal.jpg' },
    // 165/70 R13
    { key: 'compasal',  width: 165, profile: 70, rim: 13, img: '/cauchos/r13/165.70r13compasal.jpg' },
    { key: 'aplus',     width: 165, profile: 70, rim: 13, img: '/cauchos/r13/165.70r13aplus.jpg' },
    { key: 'crossmaxx', width: 165, profile: 70, rim: 13, img: '/cauchos/r13/165.70r13crossmaxx.jpg' },
    { key: 'crossmax',  width: 165, profile: 70, rim: 13, img: '/cauchos/r13/165.70r13crossmaxx.jpg' },
    { key: 'cromaxx',   width: 165, profile: 70, rim: 13, img: '/cauchos/r13/165.70r13crossmaxx.jpg' },
    // 175/70 R13
    { key: 'compasal',  width: 175, profile: 70, rim: 13, img: '/cauchos/r13/175.70r13compasal.jpg' },
    { key: 'crossmaxx', width: 175, profile: 70, rim: 13, img: '/cauchos/r13/175.70r13crossmaxx.jpg' },
    { key: 'crossmax',  width: 175, profile: 70, rim: 13, img: '/cauchos/r13/175.70r13crossmaxx.jpg' },
    { key: 'cromaxx',   width: 175, profile: 70, rim: 13, img: '/cauchos/r13/175.70r13crossmaxx.jpg' },
    { key: 'mazinni',   width: 175, profile: 70, rim: 13, img: '/cauchos/r13/175.70r13mazzini.jpg' },
    { key: 'mazzini',   width: 175, profile: 70, rim: 13, img: '/cauchos/r13/175.70r13mazzini.jpg' },
    { key: 'mazini',    width: 175, profile: 70, rim: 13, img: '/cauchos/r13/175.70r13mazzini.jpg' },
    { key: 'royalblack',width: 175, profile: 70, rim: 13, img: '/cauchos/r13/175.70r13royal.jpg' },
    { key: 'royal',     width: 175, profile: 70, rim: 13, img: '/cauchos/r13/175.70r13royal.jpg' },
    { key: 'sportrak',  width: 175, profile: 70, rim: 13, img: '/cauchos/r13/175.70r13sportrak.jpg' },
    // Genéricos R13 (solo si no hay foto específica)
    { key: 'duringo',                            rim: 13, img: '/cauchos/r13/165.65r13duringon.jpg' },
    { key: 'duringon',                           rim: 13, img: '/cauchos/r13/165.65r13duringon.jpg' },
    { key: 'compasal',                           rim: 13, img: '/cauchos/r13/165.70r13compasal.jpg' },
    { key: 'aplus',                              rim: 13, img: '/cauchos/r13/165.70r13aplus.jpg' },
    { key: 'crossmaxx',                          rim: 13, img: '/cauchos/r13/175.70r13crossmaxx.jpg' },
    { key: 'crossmax',                           rim: 13, img: '/cauchos/r13/175.70r13crossmaxx.jpg' },
    { key: 'cromaxx',                            rim: 13, img: '/cauchos/r13/175.70r13crossmaxx.jpg' },
    { key: 'mazinni',                            rim: 13, img: '/cauchos/r13/175.70r13mazzini.jpg' },
    { key: 'mazzini',                            rim: 13, img: '/cauchos/r13/175.70r13mazzini.jpg' },
    { key: 'mazini',                             rim: 13, img: '/cauchos/r13/175.70r13mazzini.jpg' },
    { key: 'royalblack',                         rim: 13, img: '/cauchos/r13/175.70r13royal.jpg' },
    { key: 'royal',                              rim: 13, img: '/cauchos/r13/175.70r13royal.jpg' },
    { key: 'sportrak',                           rim: 13, img: '/cauchos/r13/175.70r13sportrak.jpg' },

    // ── R14 ── (específicos PRIMERO, genéricos al final) ─────────────────────
    // 175/65 R14
    { key: 'anaite',    width: 175, profile: 65, rim: 14, img: '/cauchos/r14/175.65r14anaitte.jpg' },
    { key: 'anaitte',   width: 175, profile: 65, rim: 14, img: '/cauchos/r14/175.65r14anaitte.jpg' },
    { key: 'annaite',   width: 175, profile: 65, rim: 14, img: '/cauchos/r14/175.65r14anaitte.jpg' },
    { key: 'bridgestone',width: 175, profile: 65, rim: 14, img: '/cauchos/r14/175.65r14bridgestone.jpg' },
    { key: 'brigestone', width: 175, profile: 65, rim: 14, img: '/cauchos/r14/175.65r14bridgestone.jpg' },
    // 185/60 R14
    { key: 'aplus',      width: 185, profile: 60, rim: 14, img: '/cauchos/r14/185.60r14aplus.jpg' },
    { key: 'mazinni',    width: 185, profile: 60, rim: 14, img: '/cauchos/r14/185.60r14mazzini.jpg' },
    { key: 'mazzini',    width: 185, profile: 60, rim: 14, img: '/cauchos/r14/185.60r14mazzini.jpg' },
    { key: 'mazini',     width: 185, profile: 60, rim: 14, img: '/cauchos/r14/185.60r14mazzini.jpg' },
    { key: 'royalblack', width: 185, profile: 60, rim: 14, img: '/cauchos/r14/185.60r14royalblack.jpg' },
    { key: 'royal',      width: 185, profile: 60, rim: 14, img: '/cauchos/r14/185.60r14royalblack.jpg' },
    { key: 'sunwide',    width: 185, profile: 60, rim: 14, img: '/cauchos/r14/185.60r14sunwide.jpg' },
    // 185/65 R14
    { key: 'firestone',  width: 185, profile: 65, rim: 14, img: '/cauchos/r14/185.65r14firestone.jpg' },
    { key: 'qualid',     width: 185, profile: 65, rim: 14, img: '/cauchos/r14/185.65r14qualid.jpg' },
    { key: 'pneus',      width: 185, profile: 65, rim: 14, img: '/cauchos/r14/185.65r14pneus.jpg' },
    { key: 'sportrak',   width: 185, profile: 65, rim: 14, img: '/cauchos/r14/185.65r14sportrak.jpg' },
    { key: 'crossmaxx',  width: 185, profile: 65, rim: 14, img: '/cauchos/r14/185.65r14crossmaxx.jpg' },
    { key: 'crossmax',   width: 185, profile: 65, rim: 14, img: '/cauchos/r14/185.65r14crossmaxx.jpg' },
    { key: 'cromaxx',    width: 185, profile: 65, rim: 14, img: '/cauchos/r14/185.65r14crossmaxx.jpg' },
    // 195/60 R14
    { key: 'antares',    width: 195, profile: 60, rim: 14, img: '/cauchos/r14/195.60r14antares.jpg' },
    // 195/70 R14
    { key: 'annaite',    width: 195, profile: 70, rim: 14, img: '/cauchos/r14/195.70r14anaitte.jpg' },
    { key: 'anaitte',    width: 195, profile: 70, rim: 14, img: '/cauchos/r14/195.70r14anaitte.jpg' },
    // 195/75 R14
    { key: 'pneus',      width: 195, profile: 75, rim: 14, img: '/cauchos/r14/195.75r14pneus.jpg' },
    // Genéricos R14 (solo si no hay foto específica)
    { key: 'anaite',                              rim: 14, img: '/cauchos/r14/175.65r14anaitte.jpg' },
    { key: 'anaitte',                             rim: 14, img: '/cauchos/r14/175.65r14anaitte.jpg' },
    { key: 'annaite',                             rim: 14, img: '/cauchos/r14/195.70r14anaitte.jpg' },
    { key: 'bridgestone',                         rim: 14, img: '/cauchos/r14/175.65r14bridgestone.jpg' },
    { key: 'brigestone',                          rim: 14, img: '/cauchos/r14/175.65r14bridgestone.jpg' },
    { key: 'aplus',                               rim: 14, img: '/cauchos/r14/185.60r14aplus.jpg' },
    { key: 'mazinni',                             rim: 14, img: '/cauchos/r14/185.60r14mazzini.jpg' },
    { key: 'mazzini',                             rim: 14, img: '/cauchos/r14/185.60r14mazzini.jpg' },
    { key: 'mazini',                              rim: 14, img: '/cauchos/r14/185.60r14mazzini.jpg' },
    { key: 'royalblack',                          rim: 14, img: '/cauchos/r14/185.60r14royalblack.jpg' },
    { key: 'royal',                               rim: 14, img: '/cauchos/r14/185.60r14royalblack.jpg' },
    { key: 'sunwide',                             rim: 14, img: '/cauchos/r14/185.60r14sunwide.jpg' },
    { key: 'firestone',                           rim: 14, img: '/cauchos/r14/185.65r14firestone.jpg' },
    { key: 'qualid',                              rim: 14, img: '/cauchos/r14/185.65r14qualid.jpg' },
    { key: 'pneus',                               rim: 14, img: '/cauchos/r14/185.65r14pneus.jpg' },
    { key: 'sportrak',                            rim: 14, img: '/cauchos/r14/185.65r14sportrak.jpg' },
    { key: 'crossmaxx',                           rim: 14, img: '/cauchos/r14/185.65r14crossmaxx.jpg' },
    { key: 'crossmax',                            rim: 14, img: '/cauchos/r14/185.65r14crossmaxx.jpg' },
    { key: 'cromaxx',                             rim: 14, img: '/cauchos/r14/185.65r14crossmaxx.jpg' },
    { key: 'antares',                             rim: 14, img: '/cauchos/r14/195.60r14antares.jpg' },

    // ── R15 ── (específicos PRIMERO, genéricos al final) ─────────────────────
    // 195/55 R15
    { key: 'aplus',     width: 195, profile: 55,  rim: 15, img: '/cauchos/r15/195.55r15aplus.jpg' },
    // 195/60 R15
    { key: 'rapid',     width: 195, profile: 60,  rim: 15, img: '/cauchos/r15/195.60r15rapid.jpg' },
    { key: 'aplus',     width: 195, profile: 60,  rim: 15, img: '/cauchos/r15/195.60r15aplus.jpg' },
    { key: 'mazinni',   width: 195, profile: 60,  rim: 15, img: '/cauchos/r15/195.60r15mazzini.jpg' },
    { key: 'mazzini',   width: 195, profile: 60,  rim: 15, img: '/cauchos/r15/195.60r15mazzini.jpg' },
    { key: 'mazini',    width: 195, profile: 60,  rim: 15, img: '/cauchos/r15/195.60r15mazzini.jpg' },
    { key: 'qualid',    width: 195, profile: 60,  rim: 15, img: '/cauchos/r15/195.60r15qualid.jpg' },
    { key: 'wideway',   width: 195, profile: 60,  rim: 15, img: '/cauchos/r15/195.60r15wideway.jpg' },
    // 205/65 R15
    { key: 'crossmax',  width: 205, profile: 65,  rim: 15, img: '/cauchos/r15/205.65r15crossmax.jpg' },
    { key: 'crossmaxx', width: 205, profile: 65,  rim: 15, img: '/cauchos/r15/205.65r15crossmax.jpg' },
    { key: 'cromaxx',   width: 205, profile: 65,  rim: 15, img: '/cauchos/r15/205.65r15crossmax.jpg' },
    // 205/70 R15
    { key: 'ilink',     width: 205, profile: 70,  rim: 15, img: '/cauchos/r15/205.70r15ilink.jpg' },
    { key: 'path ranger',width:205, profile: 70,  rim: 15, img: '/cauchos/r15/205.70r15pathranger.jpg' },
    { key: 'pathranger',width: 205, profile: 70,  rim: 15, img: '/cauchos/r15/205.70r15pathranger.jpg' },
    { key: 'pathrangger',width:205, profile: 70,  rim: 15, img: '/cauchos/r15/205.70r15pathranger.jpg' },
    { key: 'path',      width: 205, profile: 70,  rim: 15, img: '/cauchos/r15/205.70r15pathranger.jpg' },
    // 235/75 R15
    { key: 'zwarthz',   width: 235, profile: 75,  rim: 15, img: '/cauchos/r15/235.75r15ZWARTHZ.jpg' },
    { key: 'zwartz',    width: 235, profile: 75,  rim: 15, img: '/cauchos/r15/235.75r15ZWARTHZ.jpg' },
    // 295/50 R15
    { key: 'mazzini',   width: 295, profile: 50,  rim: 15, img: '/cauchos/r15/295.50r15mazzini.jpg' },
    { key: 'mazinni',   width: 295, profile: 50,  rim: 15, img: '/cauchos/r15/295.50r15mazzini.jpg' },
    { key: 'mazini',    width: 295, profile: 50,  rim: 15, img: '/cauchos/r15/295.50r15mazzini.jpg' },
    // 31x10.50 R15 offroad
    { key: 'aplus',     width: 31,  profile: 10.5, rim: 15, img: '/cauchos/r15/31x10.50r15aplus.jpg' },
    { key: 'wideway',   width: 31,  profile: 10.5, rim: 15, img: '/cauchos/r15/31x10.50r15wideway.jpg' },
    { key: 'duraturn',  width: 31,  profile: 10.5, rim: 15, img: '/cauchos/r15/31x10.50r15duraturn.jpg' },
    { key: 'everland',  width: 31,  profile: 10.5, rim: 15, img: '/cauchos/r15/31x10.50r15everland.jpg' },
    // 32x11.50 R15 offroad
    { key: 'nereus',    width: 32,  profile: 11.5, rim: 15, img: '/cauchos/r15/32x11.50r15nereus.jpg' },
    // 33x12.50 R15 offroad
    { key: 'duringo',   width: 33,  profile: 12.5, rim: 15, img: '/cauchos/r15/33x12.50r15duringon.jpg' },
    { key: 'duringon',  width: 33,  profile: 12.5, rim: 15, img: '/cauchos/r15/33x12.50r15duringon.jpg' },
    { key: 'crossmaxx', width: 33,  profile: 12.5, rim: 15, img: '/cauchos/r15/33x12.50r15duringon.jpg' },
    { key: 'crossmax',  width: 33,  profile: 12.5, rim: 15, img: '/cauchos/r15/33x12.50r15duringon.jpg' },
    { key: 'cromaxx',   width: 33,  profile: 12.5, rim: 15, img: '/cauchos/r15/33x12.50r15duringon.jpg' },
    // Genéricos R15 (solo si no hay foto específica)
    { key: 'rapid',                               rim: 15, img: '/cauchos/r15/195.60r15rapid.jpg' },
    { key: 'aplus',                              rim: 15, img: '/cauchos/r15/195.60r15aplus.jpg' },
    { key: 'mazzini',                            rim: 15, img: '/cauchos/r15/195.60r15mazzini.jpg' },
    { key: 'mazinni',                            rim: 15, img: '/cauchos/r15/195.60r15mazzini.jpg' },
    { key: 'mazini',                             rim: 15, img: '/cauchos/r15/195.60r15mazzini.jpg' },
    { key: 'qualid',                             rim: 15, img: '/cauchos/r15/195.60r15qualid.jpg' },
    { key: 'wideway',                            rim: 15, img: '/cauchos/r15/195.60r15wideway.jpg' },
    { key: 'crossmax',                           rim: 15, img: '/cauchos/r15/205.65r15crossmax.jpg' },
    { key: 'crossmaxx',                          rim: 15, img: '/cauchos/r15/205.65r15crossmax.jpg' },
    { key: 'cromaxx',                            rim: 15, img: '/cauchos/r15/205.65r15crossmax.jpg' },
    { key: 'ilink',                              rim: 15, img: '/cauchos/r15/205.70r15ilink.jpg' },
    { key: 'path ranger',                        rim: 15, img: '/cauchos/r15/205.70r15pathranger.jpg' },
    { key: 'pathranger',                         rim: 15, img: '/cauchos/r15/205.70r15pathranger.jpg' },
    { key: 'path',                               rim: 15, img: '/cauchos/r15/205.70r15pathranger.jpg' },
    { key: 'zwarthz',                            rim: 15, img: '/cauchos/r15/235.75r15ZWARTHZ.jpg' },
    { key: 'zwartz',                             rim: 15, img: '/cauchos/r15/235.75r15ZWARTHZ.jpg' },
    { key: 'duraturn',                           rim: 15, img: '/cauchos/r15/31x10.50r15duraturn.jpg' },
    { key: 'everland',                           rim: 15, img: '/cauchos/r15/31x10.50r15everland.jpg' },
    { key: 'nereus',                             rim: 15, img: '/cauchos/r15/32x11.50r15nereus.jpg' },
    { key: 'duringo',                            rim: 15, img: '/cauchos/r15/33x12.50r15duringon.jpg' },
    { key: 'duringon',                           rim: 15, img: '/cauchos/r15/33x12.50r15duringon.jpg' },

    // ── R16 ── (específicos PRIMERO, genéricos al final) ─────────────────────
    // 205/55 R16
    { key: 'royalblack', width: 205, profile: 55, rim: 16, img: '/cauchos/r16/205.55r16royalblack.jpg' },
    { key: 'royal',      width: 205, profile: 55, rim: 16, img: '/cauchos/r16/205.55r16royalblack.jpg' },
    { key: 'pneus',      width: 205, profile: 55, rim: 16, img: '/cauchos/r16/205.55r16pneus.jpg' },
    // 215/65 R16
    { key: 'antares',    width: 215, profile: 65, rim: 16, img: '/cauchos/r16/215.65r16antares.jpg' },
    { key: 'wideway',    width: 215, profile: 65, rim: 16, img: '/cauchos/r16/215.65r16wideway.jpg' },
    { key: 'maxtrek',    width: 215, profile: 65, rim: 16, img: '/cauchos/r16/215.65r16maxtrek.jpg' },
    { key: 'chengshan',  width: 215, profile: 65, rim: 16, img: '/cauchos/r16/215.65r16chensang.jpg' },
    { key: 'chensang',   width: 215, profile: 65, rim: 16, img: '/cauchos/r16/215.65r16chensang.jpg' },
    { key: 'chengsang',  width: 215, profile: 65, rim: 16, img: '/cauchos/r16/215.65r16chensang.jpg' },
    // 215/75 R16
    { key: 'mazzini',    width: 215, profile: 75, rim: 16, img: '/cauchos/r16/215.75r16cmazzini.jpg' },
    { key: 'mazinni',    width: 215, profile: 75, rim: 16, img: '/cauchos/r16/215.75r16cmazzini.jpg' },
    { key: 'mazini',     width: 215, profile: 75, rim: 16, img: '/cauchos/r16/215.75r16cmazzini.jpg' },
    // 225/70 R16
    { key: 'fujisaki',   width: 225, profile: 70, rim: 16, img: '/cauchos/r16/225.70r16fujisaki.jpg' },
    // 235/60 R16
    { key: 'alfamotor',  width: 235, profile: 60, rim: 16, img: '/cauchos/r16/235.60r16alfamotors.jpg' },
    { key: 'alfamotors', width: 235, profile: 60, rim: 16, img: '/cauchos/r16/235.60r16alfamotors.jpg' },
    { key: 'vantage',    width: 235, profile: 60, rim: 16, img: '/cauchos/r16/235.60r16pneus.jpg' },
    { key: 'pneus',      width: 235, profile: 60, rim: 16, img: '/cauchos/r16/235.60r16pneus.jpg' },
    // 245/70 R16
    { key: 'duraturn',   width: 245, profile: 70, rim: 16, img: '/cauchos/r16/245.70r16duraturn.jpg' },
    // 255/70 R16
    { key: 'tourador',   width: 255, profile: 70, rim: 16, img: '/cauchos/r16/255.70r16tourador.jpg' },
    { key: 'wideway',    width: 255, profile: 70, rim: 16, img: '/cauchos/r16/255.70r16wideway.jpg' },
    { key: 'crossmaxx',  width: 255, profile: 70, rim: 16, img: '/cauchos/r16/255.70r16crossmaxx.jpg' },
    { key: 'crossmax',   width: 255, profile: 70, rim: 16, img: '/cauchos/r16/255.70r16crossmaxx.jpg' },
    { key: 'cromaxx',    width: 255, profile: 70, rim: 16, img: '/cauchos/r16/255.70r16crossmaxx.jpg' },
    // 265/70 & 265/75 R16
    { key: 'duraturn',   width: 265, profile: 70, rim: 16, img: '/cauchos/r16/265.70r16duraturn.jpg' },
    { key: 'duraturn',   width: 265, profile: 75, rim: 16, img: '/cauchos/r16/265.70r16duraturn.jpg' },
    { key: 'dovroad',    width: 265, profile: 75, rim: 16, img: '/cauchos/r16/265.75r16dovroad.jpg' },
    // 285/75 R16
    { key: 'rapid contender', width: 285, profile: 75, rim: 16, img: '/cauchos/r16/285.75r16rapidcontender.jpg' },
    { key: 'contender',       width: 285, profile: 75, rim: 16, img: '/cauchos/r16/285.75r16rapidcontender.jpg' },
    { key: 'rapid',           width: 285, profile: 75, rim: 16, img: '/cauchos/r16/285.75r16rapid.jpg' },
    // 7.50-16 (7/50/16)
    { key: 'fujisaki',        width: 7,   profile: 50, rim: 16, img: '/cauchos/r16/7.50r16fujisaki.jpg' },
    { key: 'fujisaki',        width: 7.5,              rim: 16, img: '/cauchos/r16/7.50r16fujisaki.jpg' },
    { key: 'lionlike',        width: 7,   profile: 50, rim: 16, img: '/cauchos/r16/7.50r16lionlike.jpg' },
    { key: 'lionlike',        width: 7.5,              rim: 16, img: '/cauchos/r16/7.50r16lionlike.jpg' },
    { key: 'lion',            width: 7,   profile: 50, rim: 16, img: '/cauchos/r16/7.50r16lionlike.jpg' },
    { key: 'arduza',          width: 7,   profile: 50, rim: 16, img: '/cauchos/r16/7.50r16arduza.jpg' },
    { key: 'crossmaxx',       width: 7,   profile: 50, rim: 16, img: '/cauchos/r16/7.50r16crossmaxx.jpg' },
    { key: 'crossmaxx',       width: 7.5,              rim: 16, img: '/cauchos/r16/7.50r16crossmaxx.jpg' },
    { key: 'crossmax',        width: 7,   profile: 50, rim: 16, img: '/cauchos/r16/7.50r16crossmaxx.jpg' },
    { key: 'crossmax',        width: 7.5,              rim: 16, img: '/cauchos/r16/7.50r16crossmaxx.jpg' },
    { key: 'cromaxx',         width: 7,   profile: 50, rim: 16, img: '/cauchos/r16/7.50r16crossmaxx.jpg' },
    { key: 'cromaxx',         width: 7.5,              rim: 16, img: '/cauchos/r16/7.50r16crossmaxx.jpg' },
    // Genéricos R16 (solo si no hay foto específica)
    { key: 'royalblack',                          rim: 16, img: '/cauchos/r16/205.55r16royalblack.jpg' },
    { key: 'royal',                               rim: 16, img: '/cauchos/r16/205.55r16royalblack.jpg' },
    { key: 'pneus',                               rim: 16, img: '/cauchos/r16/205.55r16pneus.jpg' },
    { key: 'antares',                             rim: 16, img: '/cauchos/r16/215.65r16antares.jpg' },
    { key: 'wideway',                             rim: 16, img: '/cauchos/r16/255.70r16wideway.jpg' },
    { key: 'crossmaxx',                           rim: 16, img: '/cauchos/r16/255.70r16crossmaxx.jpg' },
    { key: 'crossmax',                            rim: 16, img: '/cauchos/r16/255.70r16crossmaxx.jpg' },
    { key: 'cromaxx',                             rim: 16, img: '/cauchos/r16/255.70r16crossmaxx.jpg' },
    { key: 'maxtrek',                             rim: 16, img: '/cauchos/r16/215.65r16maxtrek.jpg' },
    { key: 'chengshan',                           rim: 16, img: '/cauchos/r16/215.65r16chensang.jpg' },
    { key: 'chensang',                            rim: 16, img: '/cauchos/r16/215.65r16chensang.jpg' },
    { key: 'chengsang',                           rim: 16, img: '/cauchos/r16/215.65r16chensang.jpg' },
    { key: 'mazzini',                             rim: 16, img: '/cauchos/r16/215.75r16cmazzini.jpg' },
    { key: 'mazinni',                             rim: 16, img: '/cauchos/r16/215.75r16cmazzini.jpg' },
    { key: 'mazini',                              rim: 16, img: '/cauchos/r16/215.75r16cmazzini.jpg' },
    { key: 'fujisaki',                            rim: 16, img: '/cauchos/r16/225.70r16fujisaki.jpg' },
    { key: 'alfamotor',                           rim: 16, img: '/cauchos/r16/235.60r16alfamotors.jpg' },
    { key: 'alfamotors',                          rim: 16, img: '/cauchos/r16/235.60r16alfamotors.jpg' },
    { key: 'vantage',                             rim: 16, img: '/cauchos/r16/235.60r16pneus.jpg' },
    { key: 'duraturn',                            rim: 16, img: '/cauchos/r16/245.70r16duraturn.jpg' },
    { key: 'tourador',                            rim: 16, img: '/cauchos/r16/255.70r16tourador.jpg' },
    { key: 'dovroad',                             rim: 16, img: '/cauchos/r16/265.75r16dovroad.jpg' },
    { key: 'rapid',                               rim: 16, img: '/cauchos/r16/285.75r16rapid.jpg' },
    { key: 'lionlike',                            rim: 16, img: '/cauchos/r16/7.50r16lionlike.jpg' },
    { key: 'arduza',                              rim: 16, img: '/cauchos/r16/7.50r16arduza.jpg' },
    { key: 'crossmaxx',                           rim: 16, img: '/cauchos/r16/255.70r16crossmaxx.jpg' },
    { key: 'crossmax',                            rim: 16, img: '/cauchos/r16/255.70r16crossmaxx.jpg' },
    { key: 'cromaxx',                             rim: 16, img: '/cauchos/r16/255.70r16crossmaxx.jpg' },

    // ── R17 ── (específicos PRIMERO, genéricos al final) ─────────────────────
    // 215/60 R17
    { key: 'qualid',     width: 215, profile: 60, rim: 17, img: '/cauchos/r17/215.60r17qualid.jpg' },
    // 225/50 R17
    { key: 'rapid',      width: 225, profile: 50, rim: 17, img: '/cauchos/r17/225.50r17rapid.jpg' },
    { key: 'ilink',      width: 225, profile: 50, rim: 17, img: '/cauchos/r17/225.50r17ilink.jpg' },
    // 235/75 R17.5
    { key: 'sportrak',   width: 235, profile: 75, rim: 17, img: '/cauchos/r17/235.75r17.5sportrak.jpg' },
    // 245/65 R17
    { key: 'crossmaxx',  width: 245, profile: 65, rim: 17, img: '/cauchos/r17/245.65r17crossmaxx.jpg' },
    { key: 'crossmax',   width: 245, profile: 65, rim: 17, img: '/cauchos/r17/245.65r17crossmaxx.jpg' },
    { key: 'cromaxx',    width: 245, profile: 65, rim: 17, img: '/cauchos/r17/245.65r17crossmaxx.jpg' },
    // 265/70 R17
    { key: 'saferich',   width: 265, profile: 70, rim: 17, img: '/cauchos/r17/265.70r17saferich.jpg' },
    // 285/70 R17
    { key: 'mirage',     width: 285, profile: 70, rim: 17, img: '/cauchos/r17/285.70r17mirage.jpg' },
    { key: 'goodride',   width: 285, profile: 70, rim: 17, img: '/cauchos/r17/285.70r17goodride.jpg' },
    // Genéricos R17 (solo si no hay foto específica)
    { key: 'qualid',                              rim: 17, img: '/cauchos/r17/215.60r17qualid.jpg' },
    { key: 'rapid',                               rim: 17, img: '/cauchos/r17/225.50r17rapid.jpg' },
    { key: 'ilink',                               rim: 17, img: '/cauchos/r17/225.50r17ilink.jpg' },
    { key: 'sportrak',                            rim: 17, img: '/cauchos/r17/235.75r17.5sportrak.jpg' },
    { key: 'crossmaxx',                           rim: 17, img: '/cauchos/r17/245.65r17crossmaxx.jpg' },
    { key: 'crossmax',                            rim: 17, img: '/cauchos/r17/245.65r17crossmaxx.jpg' },
    { key: 'cromaxx',                             rim: 17, img: '/cauchos/r17/245.65r17crossmaxx.jpg' },
    { key: 'saferich',                            rim: 17, img: '/cauchos/r17/265.70r17saferich.jpg' },
    { key: 'mirage',                              rim: 17, img: '/cauchos/r17/285.70r17mirage.jpg' },
    { key: 'goodride',                            rim: 17, img: '/cauchos/r17/285.70r17goodride.jpg' },

    // ── R18 ── (específicos PRIMERO, genéricos al final) ─────────────────────
    // 265/60 R18
    { key: 'gremax',     width: 265, profile: 60, rim: 18, img: '/cauchos/r18/265.60r18greemax.jpg' },
    { key: 'greemax',    width: 265, profile: 60, rim: 18, img: '/cauchos/r18/265.60r18greemax.jpg' },
    // Genéricos R18 (solo si no hay foto específica)
    { key: 'gremax',                              rim: 18, img: '/cauchos/r18/265.60r18greemax.jpg' },
    { key: 'greemax',                             rim: 18, img: '/cauchos/r18/265.60r18greemax.jpg' },
];

const BRAND_LOGO_MAP = [
    // ── Marcas con SVG propio ──────────────────────────────────────────────────
    { key: 'compasal',    logo: '/brands/compasal.svg' },
    { key: 'crossmaxx',   logo: '/brands/crossmaxx.svg' },
    { key: 'crossmax',    logo: '/brands/crossmaxx.svg' },
    { key: 'cromaxx',     logo: '/brands/crossmaxx.svg' },
    { key: 'aplus',       logo: '/brands/aplus.svg' },
    { key: 'rydanz',      logo: '/brands/rydanz.svg' },
    { key: 'royal',       logo: '/brands/royal.svg' },
    { key: 'longway',     logo: '/brands/longway.svg' },
    { key: 'lomgway',     logo: '/brands/longway.svg' },
    { key: 'hilo',        logo: '/brands/hilo.svg' },
    { key: 'mazini',      logo: '/brands/mazzini.svg' },
    { key: 'mazzini',     logo: '/brands/mazzini.svg' },
    { key: 'mazinni',     logo: '/brands/mazzini.svg' },
    { key: 'firestone',   logo: '/brands/firestone.svg' },
    { key: 'annaite',     logo: '/brands/annaite.svg' },
    { key: 'bridgestone', logo: '/brands/bridgestone.svg' },
    { key: 'doubleking',  logo: '/brands/doubleking.svg' },
    { key: 'durun',       logo: '/brands/durun.svg' },
    { key: 'maxwind',     logo: '/brands/maxwind.svg' },
    // ── Nuevas marcas con SVG ─────────────────────────────────────────────────
    { key: 'alix',        logo: '/brands/alix.svg' },
    { key: 'habilead',    logo: '/brands/habilead.svg' },
    { key: 'kumho',       logo: '/brands/kumho.svg' },
    { key: 'multihawk',   logo: '/brands/multihawk.svg' },
    { key: 'rockblade',   logo: '/brands/rockblade.svg' },
    { key: 'pneus',       logo: '/brands/pneus.svg' },
    { key: 'antares',     logo: '/brands/antares.svg' },
    { key: 'roadcruza',   logo: '/brands/roadcruza.svg' },
    { key: 'toyo',        logo: '/brands/toyo.svg' },
    { key: 'windforce',   logo: '/brands/windforce.svg' },
    { key: 'fujisaki',    logo: '/brands/fujisaki.svg' },
    { key: 'zextour',     logo: '/brands/zextour.svg' },
    { key: 'sportrak',    logo: '/brands/sportrak.svg' },
    { key: 'rapid',       logo: '/brands/rapid.svg' },
    { key: 'ilink',       logo: '/brands/ilink.svg' },
    { key: 'maxtrek',     logo: '/brands/maxtrek.svg' },
    { key: 'tourador',    logo: '/brands/tourador.svg' },
    { key: 'wideway',     logo: '/brands/wideway.svg' },
    { key: 'pathranger',  logo: '/brands/pathranger.svg' },
    { key: 'pathrangger', logo: '/brands/pathranger.svg' },
    { key: 'path ranger', logo: '/brands/pathranger.svg' },
    { key: 'duraturn',    logo: '/brands/duraturn.svg' },
];

// ─── DESCRIPCIONES DE MARCA ──────────────────────────────────────────────────
// Las entradas con minRim/maxRim se aplican solo a ese rango.
// Las entradas sin rango son el fallback genérico.
// IMPORTANTE: poner las entradas ESPECÍFICAS (con rango) ANTES que las genéricas.
const BRAND_DESCRIPTIONS = [
    // ── Amberstone / Ambertone ────────────────────────────────────────────────
    { key: 'ambertone',   desc: 'Fabricación robusta de alta resistencia al desgaste y óptima capacidad de carga continua.' },
    { key: 'amberstone',  desc: 'Fabricación robusta de alta resistencia al desgaste y óptima capacidad de carga continua.' },

    // ── Bridgestone / Firestone ───────────────────────────────────────────────
    { key: 'bridgestone', desc: 'Líder mundial japonés. Tecnología de punta, máxima durabilidad y agarre.' },
    { key: 'brigestone',  desc: 'Líder mundial japonés. Tecnología de punta, máxima durabilidad y agarre.' },
    { key: 'firestone',   desc: 'Marca americana con más de 100 años. Excelente confort y larga vida útil.' },
    { key: 'goodride',    desc: 'Grupo Zhongce (China). Alta durabilidad y distribución global comprobada.' },

    // ── Rapid ─────────────────────────────────────────────────────────────────
    { key: 'rapid', minRim: 17, desc: 'Caucho deportivo de alto perfil con respuesta precisa en curvas.' },
    { key: 'rapid', maxRim: 16, desc: 'Buen agarre en seco y mojado con bajo nivel de ruido para turismo.' },

    // ── Mazzini ───────────────────────────────────────────────────────────────
    { key: 'mazzini', desc: 'Perfil deportivo. Buena tracción en seco y mojado con bajo nivel de ruido.' },
    { key: 'mazinni', desc: 'Perfil deportivo. Buena tracción en seco y mojado con bajo nivel de ruido.' },
    { key: 'mazini',  desc: 'Perfil deportivo. Buena tracción en seco y mojado con bajo nivel de ruido.' },

    // ── Antares ───────────────────────────────────────────────────────────────
    { key: 'antares', maxRim: 14, desc: 'Buen desempeño urbano para autos compactos. Bajo ruido y larga vida.' },
    { key: 'antares', desc: 'Tracción confiable para sedanes y SUV. Diseño optimizado para autopista.' },

    // ── ILink ─────────────────────────────────────────────────────────────────
    { key: 'ilink', maxRim: 15, desc: 'Buen agarre en carretera para vehículos medianos y SUV pequeños.' },
    { key: 'ilink', minRim: 17, desc: 'Alto rendimiento deportivo con excelente estabilidad a alta velocidad.' },
    { key: 'ilink', desc: 'Especializado en SUV. Buen equilibrio entre confort y rendimiento.' },

    // ── Maxtrek ───────────────────────────────────────────────────────────────
    { key: 'maxtrek', desc: 'Tracción optimizada para SUV y crossovers con gran vida útil.' },

    // ── Saferich ──────────────────────────────────────────────────────────────
    { key: 'saferich', desc: 'Tecnología FRD. Buen equilibrio entre confort de manejo y rendimiento.' },

    // ── Greemax ───────────────────────────────────────────────────────────────
    { key: 'greemax', desc: 'Alto rendimiento para SUV y crossovers. Agarre superior en mojado.' },
    { key: 'gremax',  desc: 'Alto rendimiento para SUV y crossovers. Agarre superior en mojado.' },

    // ── Tourador ──────────────────────────────────────────────────────────────
    { key: 'tourador', desc: 'Tecnología de tracción mejorada. Ideal para autopista con bajo consumo.' },

    // ── Vantage ───────────────────────────────────────────────────────────────
    { key: 'vantage', desc: 'Buena estabilidad en mojado y manejo preciso en carretera.' },

    // ── Mirage ────────────────────────────────────────────────────────────────
    { key: 'mirage', desc: 'Caucho económico de rendimiento comprobado para uso urbano y carretera.' },

    // ── Qualid ────────────────────────────────────────────────────────────────
    { key: 'qualid', desc: 'Buena relación costo-rendimiento para uso diario en ciudad y autopista.' },

    // ── Crossmaxx ─────────────────────────────────────────────────────────────
    { key: 'crossmaxx', maxRim: 14, desc: 'Gran relación calidad-precio para autos compactos. Muy popular en Venezuela.' },
    { key: 'crossmaxx', minRim: 15, maxRim: 16, desc: 'Gran relación calidad-precio. Buen desempeño en ciudad y autopista.' },
    { key: 'crossmaxx', minRim: 17, desc: 'Excelente relación calidad-precio para SUV y camionetas.' },
    { key: 'crossmax',  maxRim: 14, desc: 'Gran relación calidad-precio para autos compactos. Muy popular en Venezuela.' },
    { key: 'crossmax',  minRim: 15, maxRim: 16, desc: 'Gran relación calidad-precio. Buen desempeño en ciudad y autopista.' },
    { key: 'crossmax',  minRim: 17, desc: 'Excelente relación calidad-precio para SUV y camionetas.' },
    { key: 'cromaxx',   maxRim: 14, desc: 'Gran relación calidad-precio para autos compactos. Muy popular en Venezuela.' },
    { key: 'cromaxx',   minRim: 15, maxRim: 16, desc: 'Gran relación calidad-precio. Buen desempeño en ciudad y autopista.' },
    { key: 'cromaxx',   minRim: 17, desc: 'Excelente relación calidad-precio para SUV y camionetas.' },

    // ── Aplus ─────────────────────────────────────────────────────────────────
    { key: 'aplus', maxRim: 14, desc: 'Tecnología de bajo ruido para autos compactos. Larga vida y precio accesible.' },
    { key: 'aplus', desc: 'Tecnología de bajo ruido y larga vida. Ideal para ciudad y autopista.' },

    // ── Compasal ──────────────────────────────────────────────────────────────
    { key: 'compasal', desc: 'Fabricación certificada. Buen desempeño urbano a precio muy accesible.' },

    // ── Royal ─────────────────────────────────────────────────────────────────
    { key: 'royalblack', desc: 'Buen desempeño urbano con bajo coeficiente de rodadura y precio competitivo.' },
    { key: 'royal',      desc: 'Buen desempeño urbano con bajo coeficiente de rodadura y precio competitivo.' },

    // ── Annaite ───────────────────────────────────────────────────────────────
    { key: 'anaite',  desc: 'Alta estabilidad en autopista. Patrón simétrico para un manejo seguro.' },
    { key: 'anaitte', desc: 'Alta estabilidad en autopista. Patrón simétrico para un manejo seguro.' },
    { key: 'annaite', desc: 'Alta estabilidad en autopista. Patrón simétrico para un manejo seguro.' },

    // ── Sunwide ───────────────────────────────────────────────────────────────
    { key: 'sunwide', desc: 'Caucho de bajo perfil con buena respuesta en asfalto y bajo nivel de ruido.' },

    // ── Wideway ───────────────────────────────────────────────────────────────
    { key: 'wideway', maxRim: 15, desc: 'Buen agarre en seco y mojado para turismo. Bajo ruido y durabilidad comprobada.' },
    { key: 'wideway', minRim: 16, desc: 'Caucho reforzado para SUV y camionetas. Resistente a todo tipo de camino.' },

    // ── Pneus ─────────────────────────────────────────────────────────────────
    { key: 'pneus', maxRim: 14, desc: 'Caucho de larga vida para autos compactos con buena resistencia al desgaste.' },
    { key: 'pneus', desc: 'Opción de rendimiento probado para uso diario con excelente resistencia al desgaste.' },

    // ── Alfamotors ────────────────────────────────────────────────────────────
    { key: 'alfamotor',  desc: 'Caucho regional de amplia distribución con buena resistencia y precio justo.' },
    { key: 'alfamotors', desc: 'Caucho regional de amplia distribución con buena resistencia y precio justo.' },

    // ── Chengshan ─────────────────────────────────────────────────────────────
    { key: 'chengshan', desc: 'Fabricante chino con amplia trayectoria industrial y exportación global.' },
    { key: 'chensang',  desc: 'Fabricante chino con amplia trayectoria industrial y exportación global.' },
    { key: 'chengsang', desc: 'Fabricante chino con amplia trayectoria industrial y exportación global.' },

    // ── Otras marcas turismo ──────────────────────────────────────────────────
    { key: 'rydanz',     desc: 'Caucho de alto rendimiento con tecnología de última generación.' },
    { key: 'hilo',       desc: 'Fabricante consolidado con buena durabilidad en uso urbano y mixto.' },
    { key: 'longway',    desc: 'Caucho económico con buen comportamiento en ciudad y carretera.' },
    { key: 'lomgway',    desc: 'Caucho económico con buen comportamiento en ciudad y carretera.' },
    { key: 'doubleking', desc: 'Caucho de carga y uso mixto, robusto y resistente a impactos.' },
    { key: 'durun',      desc: 'Amplia gama para turismo y SUV, buena tracción y larga duración.' },
    { key: 'maxwind',    desc: 'Especialidad en cauchos de alto rendimiento para turismo deportivo.' },

    // ── Sportrak ──────────────────────────────────────────────────────────────
    { key: 'sportrak', maxRim: 15, desc: 'Durabilidad comprobada para turismo. Buen desempeño en ciudad y carretera.' },
    { key: 'sportrak', minRim: 16, desc: 'Versátil para carretera y off-road ligero. Muy popular en camionetas.' },

    // ── Pathranger ────────────────────────────────────────────────────────────
    { key: 'pathranger',  desc: 'Diseñado para terreno mixto. Ideal para caminos rurales y destapados.' },
    { key: 'pathrangger', desc: 'Diseñado para terreno mixto. Ideal para caminos rurales y destapados.' },
    { key: 'path ranger', desc: 'Diseñado para terreno mixto. Ideal para caminos rurales y destapados.' },
    { key: 'path',        desc: 'Diseñado para terreno mixto. Ideal para caminos rurales y destapados.' },

    // ── Marcas off-road puras ─────────────────────────────────────────────────
    { key: 'zwarthz',   desc: 'Patrón agresivo todo terreno. Tracción superior en barro y grava.' },
    { key: 'zwartz',    desc: 'Patrón agresivo todo terreno. Tracción superior en barro y grava.' },
    { key: 'duraturn',  desc: 'Grupo Sailun. Excelente vida útil y bajo desgaste en uso mixto y off-road.' },
    { key: 'nereus',    desc: 'Construcción robusta para off-road. Gran resistencia a perforaciones.' },
    { key: 'duringo',   maxRim: 14, desc: 'Caucho de construcción robusta con buena durabilidad en uso diario.' },
    { key: 'duringo',   minRim: 15, desc: 'MT agresivo para 4x4 extremo. Carcasa reforzada y patrón antiderrape.' },
    { key: 'duringon',  maxRim: 14, desc: 'Caucho de construcción robusta con buena durabilidad en uso diario.' },
    { key: 'duringon',  minRim: 15, desc: 'MT agresivo para 4x4 extremo. Carcasa reforzada y patrón antiderrape.' },
    { key: 'dovroad',   desc: 'Off-road con carcasa reforzada. Ideal para terreno difícil y uso comercial.' },
    { key: 'everland',  desc: 'Tracción off-road con buen agarre en barro, piedra y tierra suelta.' },
    { key: 'lionlike',  desc: 'Neumático comercial de alta resistencia a impacto para 4x4 y carga.' },
    { key: 'arduza',    desc: 'Neumático de carga con perfil de uso mixto y alta durabilidad.' },
    { key: 'fujisaki',  desc: 'Caucho reforzado para carga liviana y uso comercial en todo terreno.' },
    { key: 'contender', desc: 'Construcción reforzada para camionetas 4x4 con uso intensivo.' },
];

// Recibe el item completo para poder filtrar por rin y categoría
function getBrandDescription(item) {
    if (!item) return null;
    const rim = item.rim || 0;
    if (item.brand) {
        const hay = removeAccents(item.brand).toLowerCase();
        for (const entry of BRAND_DESCRIPTIONS) {
            if (!hay.includes(entry.key)) continue;
            if (entry.minRim && rim < entry.minRim) continue;
            if (entry.maxRim && rim > entry.maxRim) continue;
            return entry.desc;
        }
    }
    // Fallback inteligente según categoría y terreno si no hay descripción específica
    if (item.category === 'Cauchos') {
        if (item.terrain === 'MT') return 'Patrón agresivo Mud-Terrain diseñado para máxima tracción en fango, piedra y terreno rústico.';
        if (item.terrain === 'AT') return 'Diseño All-Terrain balanceado para excelente desempeño tanto en asfalto como en caminos de tierra.';
        if (rim >= 17) return 'Neumático de alto rendimiento para SUV y camionetas con marcha estable y agarre superior.';
        return 'Excelente opción para uso urbano y carretera con bajo nivel de ruido, confort de manejo y desgaste parejo.';
    }
    if (item.category === 'Baterías') {
        return 'Batería de alta fiabilidad y arranque seguro para garantizar óptimo rendimiento en todo clima.';
    }
    if (item.category === 'Rines') {
        return 'Rin de aleación reforzada con acabado premium para mejorar la estabilidad y presencia de tu vehículo.';
    }
    if (item.category === 'Forros') {
        return 'Confección a la medida con materiales de alta durabilidad para proteger y renovar la tapicería de tu vehículo.';
    }
    return null;
}

const FORROS_IMAGE_MAP = [
    { key: 'arauca', img: '/forrosdeasiento/arauca.jpg' },
    { key: 'aveo', img: '/forrosdeasiento/aveo.jpg' },
    { key: 'corolla', img: '/forrosdeasiento/corollanewsensation.jpg' },
    { key: 'sensation', img: '/forrosdeasiento/corollanewsensation.jpg' },
    { key: 'corsa', img: '/forrosdeasiento/corsa.jpg' },
    { key: 'cruze', img: '/forrosdeasiento/cruze.jpg' },
    { key: 'eco sport', img: '/forrosdeasiento/ecosport.jpg' },
    { key: 'ecosport', img: '/forrosdeasiento/ecosport.jpg' },
    { key: 'palio', img: '/forrosdeasiento/fiatpalio.jpg' },
    { key: 'fiat', img: '/forrosdeasiento/fiatpalio.jpg' },
    { key: 'ford ka', img: '/forrosdeasiento/fordka.jpg' },
    { key: 'ka', img: '/forrosdeasiento/fordka.jpg' },
    { key: 'gran vitara', img: '/forrosdeasiento/grandvitara.jpg' },
    { key: 'grand vitara', img: '/forrosdeasiento/grandvitara.jpg' },
    { key: 'vitara', img: '/forrosdeasiento/grandvitara.jpg' },
    { key: 'hilux', img: '/forrosdeasiento/hilux.jpg' },
    { key: 'hyunday', img: '/forrosdeasiento/hyundai.jpg' },
    { key: 'hyundai', img: '/forrosdeasiento/hyundai.jpg' },
    { key: 'logan', img: '/forrosdeasiento/logan.jpg' },
    { key: 'luv-dmax', img: '/forrosdeasiento/luvdmax.jpg' },
    { key: 'luv dmax', img: '/forrosdeasiento/luvdmax.jpg' },
    { key: 'dmax', img: '/forrosdeasiento/luvdmax.jpg' },
    { key: 'd-max', img: '/forrosdeasiento/luvdmax.jpg' },
    { key: 'luv', img: '/forrosdeasiento/luvdmax.jpg' },
    { key: 'mazda', img: '/forrosdeasiento/mazda.jpg' },
    { key: 'spark', img: '/forrosdeasiento/spark.jpg' },
    { key: '4 runner', img: '/forrosdeasiento/runner.jpg' },
    { key: '4runner', img: '/forrosdeasiento/runner.jpg' },
    { key: 'runner', img: '/forrosdeasiento/runner.jpg' },
    { key: 'yaris 3', img: '/forrosdeasiento/yaris3puertas.jpg' },
    { key: 'yaris 4', img: '/forrosdeasiento/yaris4puertas.jpg' },
    { key: 'yaris', img: '/forrosdeasiento/yaris4puertas.jpg' },
];

const BATERIAS_IMAGE_MAP = [
    { key: '310fd',  img: '/baterias/310fd.jpg' },
    { key: '310 fd', img: '/baterias/310fd.jpg' },
    { key: '380jd',  img: '/baterias/80jd.jpg' },
    { key: '380 jd', img: '/baterias/80jd.jpg' },
    { key: '80jd',   img: '/baterias/80jd.jpg' },
    { key: '570gi',  img: '/baterias/70gi.jpg' },
    { key: '570 gi', img: '/baterias/70gi.jpg' },
    { key: '70gi',   img: '/baterias/70gi.jpg' },
    { key: '570ad',  img: '/baterias/70ad.jpg' },
    { key: '570 ad', img: '/baterias/70ad.jpg' },
    { key: '70ad',   img: '/baterias/70ad.jpg' },
    { key: '640ki',  img: '/baterias/40ki.jpg' },
    { key: '640 ki', img: '/baterias/40ki.jpg' },
    { key: '40ki',   img: '/baterias/40ki.jpg' },
];

const LUBRICANTES_IMAGE_MAP = [
    // ── Shell ──────────────────────────────────────────────────────────────────
    // Específicos primero (galon antes que el quart genérico)
    { brand: 'shell', visc: '20w50', tipo: 'galon',       img: '/lubricantes/20w50shellgalon.jpg' },
    { brand: 'shell', visc: '10w30',                      img: '/lubricantes/10w30shell.jpg' },
    { brand: 'shell', visc: '10w40',                      img: '/lubricantes/10w40shell.jpg' },
    { brand: 'shell', visc: '15w40',                      img: '/lubricantes/15w40shell.jpg' },
    { brand: 'shell', visc: '20w50',                      img: '/lubricantes/20w50shell.jpg' },
    { brand: 'shell', visc: '5w20',                       img: '/lubricantes/5w20shell.jpg' },
    // ── Castrol ────────────────────────────────────────────────────────────────
    // Específicos primero: D3 diesel, galón, semisintetico, mineral, 10W40 sintetico
    { brand: 'castrol', tipo: 'd3',                        img: '/lubricantes/castrold3.jpg' },
    { brand: 'castrol', tipo: 'diesel',                    img: '/lubricantes/castrold3.jpg' },
    { brand: 'castrol', visc: '20w50', tipo: 'galon',     img: '/lubricantes/20w50castrolgalon.jpg' },
    { brand: 'castrol', visc: '20w50', tipo: 'semisintetico', img: '/lubricantes/20w50castrolsemisintetico.jpg' },
    { brand: 'castrol', visc: '20w50', tipo: 'semisint',  img: '/lubricantes/20w50castrolsemisintetico.jpg' },
    { brand: 'castrol', visc: '20w50', tipo: 'mineral',   img: '/lubricantes/20w50castrolmineral.jpg' },
    { brand: 'castrol', visc: '10w40', tipo: 'sintetico', img: '/lubricantes/10w40castrolsintetico.jpg' },
    { brand: 'castrol', visc: '10w40', tipo: 'sint',      img: '/lubricantes/10w40castrolsintetico.jpg' },
    { brand: 'castrol', visc: '20w50',                    img: '/lubricantes/20w50castrolmineral.jpg' },
    { brand: 'castrol', visc: '10w40',                    img: '/lubricantes/10w40castrolsintetico.jpg' },
    { brand: 'castrol', visc: '5w30',                     img: '/lubricantes/5w30castrol.jpg' },
    { brand: 'castrol', visc: '5w20',                     img: '/lubricantes/5w20castrol.jpg' },
    // ── OilVen ─────────────────────────────────────────────────────────────────
    { brand: 'oilven',  visc: '85w140',                   img: '/lubricantes/85w140oilven.jpg' },
    { brand: 'oil ven', visc: '85w140',                   img: '/lubricantes/85w140oilven.jpg' },
    { brand: 'oilven',  visc: '15w40',                    img: '/lubricantes/15w40oilvenmineral.jpg' },
    { brand: 'oil ven', visc: '15w40',                    img: '/lubricantes/15w40oilvenmineral.jpg' },
    { brand: 'oilven',  visc: '20w50',                    img: '/lubricantes/20w50semisinteticooilven.jpg' },
    { brand: 'oil ven', visc: '20w50',                    img: '/lubricantes/20w50semisinteticooilven.jpg' },
    // ── PDV ────────────────────────────────────────────────────────────────────
    { brand: 'pdv', visc: '20w50',                        img: '/lubricantes/20w50mineralpdv.jpg' },
    // ── Gonher ─────────────────────────────────────────────────────────────────
    { brand: 'gonher', visc: '20w50',                     img: '/lubricantes/20w50gonhermineral.jpg' },
    // ── Inca ───────────────────────────────────────────────────────────────────
    // Específicos: la foto mineral es diferente a la semisintética
    { brand: 'inca', visc: '20w50', tipo: 'mineral',      img: '/lubricantes/inca20w50mineral.jpg' },
    { brand: 'inca', visc: '15w40', tipo: 'mineral',      img: '/lubricantes/15w40incamineral.jpg' },
    { brand: 'inca', visc: '15w40', tipo: 'semisintetico',img: '/lubricantes/inca15w40semisintetico.jpg' },
    { brand: 'inca', visc: '15w40', tipo: 'semisint',     img: '/lubricantes/inca15w40semisintetico.jpg' },
    { brand: 'inca', visc: '20w50',                       img: '/lubricantes/inca20w50mineral.jpg' },
    { brand: 'inca', visc: '15w40',                       img: '/lubricantes/inca15w40semisintetico.jpg' },
    { brand: 'inca', visc: '5w30',                        img: '/lubricantes/inca5w30.jpg' },
];

function getBrandLogo(brandName) {
    if (!brandName) return null;
    const itemHaystack = removeAccents(brandName).toLowerCase();
    for (const entry of BRAND_LOGO_MAP) {
        if (itemHaystack.includes(entry.key)) {
            return entry.logo;
        }
    }
    return null;
}

function getProductImage(item) {
    if (item.image) return item.image;

    if (item.category === 'Baterías') {
        const batHaystack = removeAccents(`${item.brand} ${item.model}`).toLowerCase();
        const batHaystackNoSpace = batHaystack.replace(/\s+/g, '');
        for (const entry of BATERIAS_IMAGE_MAP) {
            const entryKeyNoSpace = entry.key.replace(/\s+/g, '');
            if (batHaystack.includes(entry.key) || batHaystackNoSpace.includes(entryKeyNoSpace)) {
                return entry.img;
            }
        }
        return '/categories/battery.png';
    }

    if (item.category === 'Forros') {
        const forroHaystack = removeAccents(`${item.brand} ${item.model}`).toLowerCase();

        // Sin imagen para fiesta y pick up
        if (forroHaystack.includes('pick up') || forroHaystack.includes('fiesta')) {
            return null;
        }

        for (const entry of FORROS_IMAGE_MAP) {
            if (forroHaystack.includes(entry.key)) {
                return entry.img;
            }
        }
        return null;
    }

    const itemHaystack = removeAccents(`${item.brand} ${item.model}`).toLowerCase();
    for (const entry of CUSTOM_IMAGE_MAP) {
        if (itemHaystack.includes(entry.key) && item.rim === entry.rim) {
            if (entry.width && item.width && entry.width !== item.width) continue;
            if (entry.profile && item.profile && entry.profile !== item.profile) continue;
            return entry.img;
        }
    }

    if (item.category === 'Tripas/Protectores' || item.category === 'Tripas') {
        return null;
    }

    if (item.category === 'Cauchos') {
        if (item.terrain === 'AT') return '/categories/tire_at.png';
        if (item.terrain === 'MT') return '/categories/tire_mt.png';
        return '/categories/tire_ht.png';
    }
    if (item.category === 'Rines') return '/categories/wheels_rims.png';
    if (item.category === 'Baterías') return '/categories/battery.png';
    if (item.category === 'Lubricantes') {
        const lubHaystack = removeAccents(`${item.brand} ${item.model}`).toLowerCase().replace(/[-\s]+/g, '');

        // Prioridad 1: marca + viscosidad + tipo (más específico)
        for (const entry of LUBRICANTES_IMAGE_MAP) {
            if (!entry.tipo) continue;
            const entryBrand = entry.brand.replace(/\s+/g, '');
            const entryTipo  = entry.tipo.replace(/\s+/g, '');
            const matchBrand = lubHaystack.includes(entryBrand);
            const matchTipo  = lubHaystack.includes(entryTipo);
            const matchVisc  = entry.visc ? lubHaystack.includes(entry.visc.replace(/\s+/g, '')) : true;
            if (matchBrand && matchTipo && matchVisc) return entry.img;
        }

        // Prioridad 2: marca + viscosidad (sin tipo)
        for (const entry of LUBRICANTES_IMAGE_MAP) {
            if (!entry.visc || entry.tipo) continue;
            const entryBrand = entry.brand.replace(/\s+/g, '');
            const entryVisc  = entry.visc.replace(/\s+/g, '');
            if (lubHaystack.includes(entryBrand) && lubHaystack.includes(entryVisc)) return entry.img;
        }

        // Prioridad 3: solo marca
        for (const entry of LUBRICANTES_IMAGE_MAP) {
            const entryBrand = entry.brand.replace(/\s+/g, '');
            if (lubHaystack.includes(entryBrand)) return entry.img;
        }

        return '/categories/lubricants.png';
    }
    if (item.category === 'Pastillas') return '/categories/brakes.png';
    return null;
}

async function fetchProductsFromGoogleSheets(attempt = 1) {
    const MAX_ATTEMPTS = 3;
    try {
        // Timeout de 12 segundos para evitar cuelgues silenciosos
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        const response = await fetch(GOOGLE_SHEETS_CSV_URL, { signal: controller.signal });
        clearTimeout(timeoutId);

        console.log(`[Sheets] Intento ${attempt} — HTTP ${response.status} ${response.ok ? 'OK' : 'ERROR'}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const csvText = await response.text();
        console.log(`[Sheets] CSV recibido: ${csvText.length} bytes.`);

        const liveProducts = parseGoogleSheetsCSV(csvText);
        console.log(`[Sheets] Productos parseados: ${liveProducts.length}`);

        if (liveProducts && liveProducts.length > 0) {
            products = liveProducts;
            console.log(`✅ Cargados ${products.length} productos desde Google Sheets`);
        } else {
            console.warn('⚠️ El CSV se descargó pero no se parsearon productos. Revisa el formato de la hoja.');
        }
    } catch (err) {
        const isTimeout = err.name === 'AbortError';
        console.error(isTimeout
            ? `⏱️ Intento ${attempt}: Timeout (12s) al conectar con Google Sheets.`
            : `❌ Intento ${attempt}: Error al conectar con Google Sheets: ${err.message}`);

        // Reintentar automáticamente si quedan intentos
        if (attempt < MAX_ATTEMPTS) {
            console.log(`🔄 Reintentando en 2 segundos... (intento ${attempt + 1}/${MAX_ATTEMPTS})`);
            await new Promise(r => setTimeout(r, 2000));
            return fetchProductsFromGoogleSheets(attempt + 1);
        }
    } finally {
        if (attempt === 1 || products.length > 0) {
            // Solo marcar como listo si es el primer intento fallido o ya tenemos datos
            // (los reintentos no tocan _dataReady hasta terminar)
        }
        if (attempt >= MAX_ATTEMPTS || products.length > 0) {
            _dataReady = true;
        }
    }
}



const VEHICLE_DATABASE = {
    "Chevrolet": [
        { model: "Aveo", sizes: ["185/60 R14", "175/65 R14"], rim: 14 },
        { model: "Spark", sizes: ["165/65 R13", "155/70 R13"], rim: 13 },
        { model: "Corsa", sizes: ["175/70 R13", "185/60 R14"], rim: 13 },
        { model: "Optra", sizes: ["195/55 R15"], rim: 15 },
        { model: "Cruze", sizes: ["215/50 R17", "205/60 R16"], rim: 17 },
        { model: "Meriva", sizes: ["185/60 R15"], rim: 15 },
        { model: "Astra", sizes: ["195/60 R15"], rim: 15 },
        { model: "Luv D-Max", sizes: ["245/70 R16", "215/70 R16"], rim: 16 },
        { model: "Silverado", sizes: ["265/70 R17"], rim: 17 },
        { model: "Tahoe", sizes: ["275/55 R20", "265/70 R17"], rim: 17 },
        { model: "Trailblazer", sizes: ["245/65 R17"], rim: 17 },
        { model: "Captiva", sizes: ["235/60 R17"], rim: 17 },
        { model: "Montana", sizes: ["175/70 R14"], rim: 14 },
        { model: "Orlando", sizes: ["225/50 R17"], rim: 17 }
    ],
    "Toyota": [
        { model: "Yaris / Yaris Belta", sizes: ["175/65 R14", "185/60 R15"], rim: 14 },
        { model: "Corolla (Baby Camry / Sky)", sizes: ["175/70 R13", "185/65 R14"], rim: 13 },
        { model: "Corolla GLi / XLi", sizes: ["195/65 R15", "205/55 R16"], rim: 15 },
        { model: "Corolla Sensación", sizes: ["205/55 R16"], rim: 16 },
        { model: "Terios / Terios Bego", sizes: ["205/70 R15", "215/65 R16"], rim: 15 },
        { model: "Merú", sizes: ["265/70 R16"], rim: 16 },
        { model: "Machito / Land Cruiser 70", sizes: ["7.50 R16", "265/75 R16"], rim: 16 },
        { model: "Hilux Kavak / 4x4", sizes: ["265/70 R16", "265/65 R17"], rim: 16 },
        { model: "Hilux 4x2", sizes: ["205/70 R15"], rim: 15 },
        { model: "Fortuner / 4Runner", sizes: ["265/65 R17", "265/70 R17"], rim: 17 },
        { model: "FJ Cruiser", sizes: ["265/70 R17"], rim: 17 },
        { model: "Avanza", sizes: ["185/65 R15"], rim: 15 },
        { model: "Starlet", sizes: ["165/70 R13"], rim: 13 }
    ],
    "Ford": [
        { model: "Fiesta (Power / Max / Move)", sizes: ["175/65 R14", "185/60 R14"], rim: 14 },
        { model: "Fiesta Titanium", sizes: ["195/50 R16"], rim: 16 },
        { model: "Ka", sizes: ["165/70 R13", "175/65 R14"], rim: 13 },
        { model: "Focus", sizes: ["195/65 R15", "205/55 R16"], rim: 15 },
        { model: "EcoSport", sizes: ["205/65 R15", "205/60 R16"], rim: 15 },
        { model: "Escape", sizes: ["215/70 R16", "235/60 R16"], rim: 16 },
        { model: "Explorer Eddie Bauer", sizes: ["245/65 R17", "235/70 R16"], rim: 17 },
        { model: "Explorer Limited / XLT", sizes: ["245/60 R18", "255/50 R20"], rim: 18 },
        { model: "F-150 / FX4 / Tritón", sizes: ["265/70 R17", "275/70 R18"], rim: 17 },
        { model: "Super Duty / F-350", sizes: ["235/85 R16", "275/70 R18"], rim: 16 },
        { model: "Fusion", sizes: ["225/50 R17"], rim: 17 },
        { model: "Ranger", sizes: ["235/75 R15", "265/70 R16"], rim: 15 }
    ],
    "Hyundai": [
        { model: "Accent / Brisa", sizes: ["175/70 R13"], rim: 13 },
        { model: "Getz", sizes: ["175/65 R14", "185/60 R14"], rim: 14 },
        { model: "Elantra", sizes: ["185/65 R15", "195/65 R15"], rim: 15 },
        { model: "Tucson", sizes: ["215/65 R16", "235/60 R16"], rim: 16 },
        { model: "Santa Fe", sizes: ["235/65 R17"], rim: 17 },
        { model: "Atos", sizes: ["155/70 R13"], rim: 13 },
        { model: "Tiburon", sizes: ["205/55 R16"], rim: 16 }
    ],
    "Kia": [
        { model: "Rio", sizes: ["175/70 R13", "185/65 R14"], rim: 13 },
        { model: "Picanto", sizes: ["165/60 R14", "155/70 R13"], rim: 14 },
        { model: "Cerato / Cerato Forte", sizes: ["195/65 R15", "205/55 R16"], rim: 15 },
        { model: "Sportage", sizes: ["215/65 R16", "235/60 R16"], rim: 16 },
        { model: "Sorento", sizes: ["235/65 R17"], rim: 17 },
        { model: "Carens", sizes: ["195/65 R15"], rim: 15 }
    ],
    "Chery": [
        { model: "Arauca", sizes: ["175/60 R14", "175/65 R14"], rim: 14 },
        { model: "Orinoco", sizes: ["195/65 R15"], rim: 15 },
        { model: "Tiggo", sizes: ["215/65 R16", "235/60 R16"], rim: 16 },
        { model: "X1", sizes: ["185/65 R15"], rim: 15 },
        { model: "QQ", sizes: ["155/65 R13"], rim: 13 }
    ],
    "Fiat": [
        { model: "Uno / Premio", sizes: ["165/70 R13", "175/70 R13"], rim: 13 },
        { model: "Palio / Siena", sizes: ["175/70 R13", "185/60 R14"], rim: 13 },
        { model: "Idea / Punto", sizes: ["195/60 R15", "185/65 R15"], rim: 15 },
        { model: "Palio Adventure", sizes: ["185/70 R14", "205/70 R15"], rim: 14 }
    ],
    "Nissan": [
        { model: "Sentra B13 / B14", sizes: ["175/70 R13"], rim: 13 },
        { model: "Sentra B15 / B16", sizes: ["185/65 R14", "205/55 R16"], rim: 14 },
        { model: "Tiida", sizes: ["185/65 R15"], rim: 15 },
        { model: "Pathfinder / Frontier", sizes: ["255/65 R16", "265/70 R16"], rim: 16 },
        { model: "Murano", sizes: ["235/65 R18"], rim: 18 }
    ],
    "Mitsubishi": [
        { model: "Lancer (Signo / CK)", sizes: ["175/70 R13", "185/65 R14"], rim: 13 },
        { model: "Lancer Touring", sizes: ["195/55 R15", "205/60 R15"], rim: 15 },
        { model: "Montero Dakar", sizes: ["265/70 R16", "31X10 R15"], rim: 16 },
        { model: "Montero Sport", sizes: ["265/70 R16"], rim: 16 },
        { model: "Outlander", sizes: ["215/65 R16"], rim: 16 }
    ],
    "Jeep": [
        { model: "Cherokee XJ / Liberty KK", sizes: ["225/75 R15", "235/70 R16"], rim: 15 },
        { model: "Grand Cherokee Laredo / Limited", sizes: ["245/70 R16", "245/65 R17"], rim: 16 },
        { model: "Wrangler TJ / JK", sizes: ["225/75 R15", "255/75 R17"], rim: 15 },
        { model: "Compass / Patriot", sizes: ["215/60 R17", "215/65 R16"], rim: 17 }
    ],
    "Renault": [
        { model: "Twingo", sizes: ["165/70 R13", "155/70 R13"], rim: 13 },
        { model: "Logan / Symbol / Sandero", sizes: ["185/65 R15"], rim: 15 },
        { model: "Megane / Scenic", sizes: ["185/65 R15", "195/65 R15"], rim: 15 },
        { model: "Duster", sizes: ["215/65 R16"], rim: 16 }
    ],
    "Mazda": [
        { model: "Mazda 3", sizes: ["195/65 R15", "205/55 R16"], rim: 15 },
        { model: "Mazda 6", sizes: ["215/50 R17"], rim: 17 },
        { model: "BT-50 / B2600", sizes: ["265/70 R16", "235/75 R15"], rim: 16 }
    ],
    "Volkswagen": [
        { model: "Gol / Parati", sizes: ["175/70 R13", "185/60 R14"], rim: 13 },
        { model: "Fox / Spacefox", sizes: ["195/55 R15", "185/60 R15"], rim: 15 },
        { model: "Jetta / Bora", sizes: ["195/65 R15", "205/55 R16"], rim: 15 },
        { model: "Amarok", sizes: ["245/70 R16"], rim: 16 }
    ],
    "Dongfeng / Chana / JAC / Saipa": [
        { model: "ZNA Rich", sizes: ["245/70 R16"], rim: 16 },
        { model: "Chana Benni", sizes: ["165/70 R13"], rim: 13 },
        { model: "JAC S3", sizes: ["205/55 R16"], rim: 16 },
        { model: "Turpial / Saipa 141", sizes: ["165/70 R13"], rim: 13 }
    ]
};

const FORROS_VEHICLES = {
    "Chevrolet": [
        { model: "Aveo (3 y 4 Puertas)", keywords: ["aveo"] },
        { model: "Corsa", keywords: ["corsa"] },
        { model: "Cruze", keywords: ["cruze"] },
        { model: "Luv D-Max", keywords: ["luv", "dmax", "d-max"] },
        { model: "Spark", keywords: ["spark"] }
    ],
    "Toyota": [
        { model: "Corolla (1.6 / New Sensation)", keywords: ["corolla", "sensation"] },
        { model: "4Runner", keywords: ["runner", "4 runner", "4runner"] },
        { model: "Hilux", keywords: ["hilux"] },
        { model: "Yaris (3 y 4 Puertas)", keywords: ["yaris"] }
    ],
    "Ford": [
        { model: "EcoSport", keywords: ["ecosport", "eco sport"] },
        { model: "Fiesta", keywords: ["fiesta"] },
        { model: "Ka", keywords: ["ka", "ford ka"] }
    ],
    "Chery": [
        { model: "Arauca", keywords: ["arauca"] }
    ],
    "Fiat": [
        { model: "Palio", keywords: ["palio"] }
    ],
    "Renault": [
        { model: "Logan", keywords: ["logan"] }
    ],
    "Suzuki / Chevrolet": [
        { model: "Gran Vitara", keywords: ["vitara", "grand vitara", "gran vitara"] }
    ],
    "Hyundai": [
        { model: "Hyundai (Varios)", keywords: ["hyundai", "hyunday"] }
    ],
    "Mazda": [
        { model: "Mazda (Varios)", keywords: ["mazda"] }
    ],
    "Universal": [
        { model: "Camioneta Pick Up", keywords: ["pick up"] }
    ]
};

document.addEventListener('DOMContentLoaded', () => {

    // ── State ──────────────────────────────────────────────
    const state = { 
        category: '', 
        categories: ['Cauchos'],
        rim: '', 
        width: '', 
        profile: '', 
        terrain: '', 
        search: '',
        vehicleMeasure: '',   // Medida sugerida por wizard (ordena, no filtra)
        forrosBrand: '',
        forrosModel: '',
        forrosKeywords: []
    };

    // ── Elements ───────────────────────────────────────────
    const catalogEl = document.getElementById('catalog-container');
    const noResultsEl = document.getElementById('no-results');
    const resetBtn = document.getElementById('reset-btn');
    const resetNoRes = document.getElementById('reset-no-results-btn');
    const searchInput = document.getElementById('search');
    const resultCount = document.getElementById('result-count');

    const categoryList = document.getElementById('category-list');
    const rimList = document.getElementById('rim-list');
    const terrainList = document.getElementById('terrain-list');

    // ── Mobile Filter Bar ──────────────────────────────────
    const mfbCatRow = document.getElementById('mfb-cat-row');
    const mfbRimRow = document.getElementById('mfb-rim-row');
    const mfbTerrainRow = document.getElementById('mfb-terrain-row');

    function syncMobileFilterBar() {
        if (!mfbCatRow) return;

        // Sync category chips
        mfbCatRow.querySelectorAll('.mfb-chip').forEach(chip => {
            chip.classList.toggle('active', chip.dataset.value === (state.category || ''));
        });

        // Show/hide rim row
        const showRim = state.category === '' || state.category === 'Cauchos' || state.category === 'Rines';
        if (mfbRimRow) mfbRimRow.classList.toggle('hidden', !showRim);

        // Sync rim chips
        if (mfbRimRow) {
            mfbRimRow.querySelectorAll('.mfb-chip').forEach(chip => {
                chip.classList.toggle('active', chip.dataset.value === (state.rim || ''));
            });
        }

        // Show/hide terrain row
        const showTerrain = (state.category === '' || state.category === 'Cauchos')
            && ['15','16','17','18'].includes(state.rim);
        if (mfbTerrainRow) mfbTerrainRow.classList.toggle('hidden', !showTerrain);

        // Sync terrain chips
        if (mfbTerrainRow) {
            mfbTerrainRow.querySelectorAll('.mfb-chip').forEach(chip => {
                chip.classList.toggle('active', chip.dataset.value === (state.terrain || ''));
            });
        }
    }

    // Chip click handler
    document.querySelectorAll('.mfb-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const filter = chip.dataset.filter;
            const value = chip.dataset.value;

            if (filter === 'category') {
                state.category = value;
                state.categories = value ? [value] : [];
                state.rim = '';
                state.terrain = '';
                // Sync desktop sidebar lists
                if (categoryList) categoryList.querySelectorAll('.filter-item').forEach(item =>
                    item.classList.toggle('active', (item.dataset.value || '') === value));
                if (rimList) rimList.querySelectorAll('.filter-item').forEach((item, i) =>
                    item.classList.toggle('active', i === 0));
                if (terrainList) terrainList.querySelectorAll('.filter-item').forEach((item, i) =>
                    item.classList.toggle('active', i === 0));
            } else if (filter === 'rim') {
                state.rim = value;
                state.terrain = '';
                if (rimList) rimList.querySelectorAll('.filter-item').forEach(item =>
                    item.classList.toggle('active', (item.dataset.value || '') === value));
                if (terrainList) terrainList.querySelectorAll('.filter-item').forEach((item, i) =>
                    item.classList.toggle('active', i === 0));
            } else if (filter === 'terrain') {
                state.terrain = value;
                if (terrainList) terrainList.querySelectorAll('.filter-item').forEach(item =>
                    item.classList.toggle('active', (item.dataset.value || '') === value));
            }

            syncMobileFilterBar();
            applyFilters();
        });
    });

    // ── Helpers ────────────────────────────────────────────

    const TIRE_SVG = `
        <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="40" cy="40" r="34" stroke="currentColor" stroke-width="5"/>
            <circle cx="40" cy="40" r="20" stroke="currentColor" stroke-width="4"/>
            <circle cx="40" cy="40" r="9" fill="currentColor" opacity="0.3"/>
            <line x1="40" y1="6" x2="40" y2="20" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
            <line x1="40" y1="60" x2="40" y2="74" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
            <line x1="6" y1="40" x2="20" y2="40" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
            <line x1="60" y1="40" x2="74" y2="40" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
        </svg>`;

    const GENERIC_SVG = `
        <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="10" y="20" width="60" height="40" rx="6" stroke="currentColor" stroke-width="4"/>
            <line x1="10" y1="35" x2="70" y2="35" stroke="currentColor" stroke-width="3"/>
            <circle cx="25" cy="55" r="4" fill="currentColor" opacity="0.4"/>
            <circle cx="55" cy="55" r="4" fill="currentColor" opacity="0.4"/>
        </svg>`;

    // ── Render ─────────────────────────────────────────────
    function renderCatalog(items, matchedCount) {
        catalogEl.innerHTML = '';

        // Update count
        resultCount.textContent = `${items.length} ${items.length === 1 ? 'producto' : 'productos'}`;

        // Show/hide reset btn
        const hasFilter = state.category || state.rim || state.terrain || state.search || state.vehicleMeasure;
        resetBtn.style.display = hasFilter ? 'block' : 'none';

        if (items.length === 0) {
            catalogEl.style.display = 'none';
            // Si el catálogo completo está vacío = fallo de carga (no es un filtro vacío)
            if (products.length === 0 && _dataReady) {
                noResultsEl.innerHTML = `
                    <div class="no-results-icon">⚠️</div>
                    <p class="no-results-msg" style="color:var(--slate-300);">No se pudo cargar el catálogo.</p>
                    <p style="color:var(--slate-400);font-size:.85rem;margin-top:-6px;">Verifica tu conexión a internet.</p>
                    <button class="btn-reset-inline" id="btn-retry-load" style="border-color:var(--blue-accent);color:var(--blue-accent);">
                        ↻ Reintentar
                    </button>`;
                const retryBtn = document.getElementById('btn-retry-load');
                if (retryBtn) {
                    retryBtn.addEventListener('click', async () => {
                        _dataReady = false;
                        retryBtn.textContent = '⟳ Cargando...';
                        retryBtn.disabled = true;
                        await fetchProductsFromGoogleSheets();
                        populateSizeSelects();
                        populateForrosSelects();
                        if (typeof populateTripasSelects === 'function') populateTripasSelects();
                        applyFilters();
                    });
                }
            } else {
                noResultsEl.innerHTML = `
                    <div class="no-results-icon">🔍</div>
                    <p class="no-results-msg">No hay stock para esta búsqueda.</p>
                    <button class="btn-reset-inline" id="reset-no-results-btn">Eliminar Filtros</button>`;
                const rnrBtn = document.getElementById('reset-no-results-btn');
                if (rnrBtn) rnrBtn.addEventListener('click', () => resetBtn.click());
            }
            noResultsEl.classList.remove('hidden');
            return;
        }

        catalogEl.style.display = 'grid';
        noResultsEl.classList.add('hidden');

        // Si hay modo vehicleMeasure, insertar separadores entre match y el resto
        const hasSections = state.vehicleMeasure && typeof matchedCount === 'number' && matchedCount >= 0;

        items.forEach((item, index) => {
            // Insertar banner de sección antes del primer match y antes de los "otros"
            if (hasSections) {
                if (index === 0 && matchedCount > 0) {
                    const banner = document.createElement('div');
                    banner.className = 'catalog-section-banner matched';
                    banner.innerHTML = `
                        <span class="csb-icon">★</span>
                        <span class="csb-label">Tu Medida: <strong>${state.vehicleMeasure}</strong></span>
                        <span class="csb-count">${matchedCount} disponible${matchedCount !== 1 ? 's' : ''}</span>
                    `;
                    catalogEl.appendChild(banner);
                }
                if (index === matchedCount && matchedCount < items.length) {
                    const banner = document.createElement('div');
                    banner.className = 'catalog-section-banner other';
                    banner.innerHTML = `
                        <span class="csb-icon">🔍</span>
                        <span class="csb-label">Más Opciones en Stock</span>
                        <span class="csb-count">${items.length - matchedCount} producto${(items.length - matchedCount) !== 1 ? 's' : ''}</span>
                    `;
                    catalogEl.appendChild(banner);
                }
            }

            const stockClass = item.qty === 0 ? 'no-stock' : item.qty <= 3 ? 'low-stock' : 'in-stock';
            const stockLabel = item.qty === 0 ? 'AGOTADO' : item.qty <= 3 ? `ÚLTIMAS ${item.qty} UDS` : `DISPONIBLE: ${item.qty} UDS`;

            let sizeDisplay = '';
            let msgText = '';
            const isTire = item.category === 'Cauchos';
            const showDesc = item.category === 'Cauchos' || item.category === 'Rines' || item.category === 'Baterías';
            const brandDesc = showDesc ? getBrandDescription(item) : null;

            if (isTire) {
                // Mostrar la medida exactamente como viene del Excel
                sizeDisplay = item.rawCol0 || (item.profile > 0
                    ? `${item.width}/${item.profile} R${item.rim}`
                    : `${item.width}/R${item.rim}`);
                msgText = `el caucho ${item.brand} ${item.model} medida ${sizeDisplay}`;
            } else if (item.category === 'Rines') {
                sizeDisplay = item.rim ? `Rin ${item.rim}"` : item.model;
                msgText = `el rin ${item.brand} ${item.model}`;
            } else if (item.category === 'Forros') {
                // Mostrar el nombre del vehículo como título principal
                const vehicleName = [item.brand, item.model].filter(Boolean).join(' — ');
                sizeDisplay = vehicleName || 'Juego de Forros';
                msgText = `los forros de asiento para ${vehicleName || item.brand}`;
            } else if (item.category === 'Tripas/Protectores' || item.category === 'Tripas') {
                sizeDisplay = item.rim > 0 ? `Rin ${item.rim}"` : 'Tripas y Protectores';
                msgText = `la tripa/protector ${item.brand} ${item.model} ${item.rim > 0 ? 'Rin ' + item.rim : ''}`.trim();
            } else {
                sizeDisplay = item.category;
                msgText = `el producto ${item.brand} ${item.model}`;
            }

            const bcvPriceText = `$${item.price.toFixed(2)}`;
            const hasDivisa = item.priceDivisa && item.priceDivisa > 0 && Math.abs(item.priceDivisa - item.price) > 0.01;
            const divisaPriceText = hasDivisa ? `$${item.priceDivisa.toFixed(2)}` : '';

            const priceMsg = hasDivisa 
                ? `${bcvPriceText} (Ref. BCV) / ${divisaPriceText} (Divisas)` 
                : bcvPriceText;
            const wa = encodeURIComponent(`Hola LAMO C.A., quiero apartar ${msgText} por ${priceMsg}.`);
            const tclass = item.terrain === 'AT' ? 'at' : item.terrain === 'MT' ? 'mt' : '';

            const itemImg = getProductImage(item);
            // Para forros siempre mostramos el logo Zega (todos los forros son Zega)
            const brandLogo = item.category === 'Forros' ? '/brands/zega.svg' : getBrandLogo(item.brand);

            const card = document.createElement('div');
            card.className = 'product-card';
            // Resaltar las tarjetas que coinciden con la medida del vehículo
            if (hasSections && index < matchedCount) {
                card.classList.add('vehicle-match');
            }
            card.style.cursor = itemImg ? 'pointer' : 'default';
            card.innerHTML = `
                <div class="card-img-wrap">
                    ${itemImg 
                        ? `<img src="${itemImg}" alt="${item.brand} ${item.model}" class="product-img" loading="lazy" />`
                        : `<div class="card-img-placeholder">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="44" height="44">
                                    <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                                </svg>
                                <span>Foto no disponible</span>
                           </div>`
                    }
                    ${item.category === 'Cauchos' && item.terrain
                    ? `<span class="card-terrain-badge ${tclass}">${item.terrain}</span>`
                    : ''}
                </div>
                	<div class="card-body">
                    ${brandLogo 
                        ? `<div class="card-brand-logo-wrap"><img src="${brandLogo}" alt="${item.category === 'Forros' ? 'Zega' : item.brand}" class="card-brand-logo" /></div>` 
                        : (item.brand ? `<span class="card-brand">${item.brand}</span>` : '')}
                    ${item.category === 'Forros'
                        ? `<span class="card-brand">${item.brand}</span>${item.model ? `<span class="card-model">${item.model}</span>` : ''}`
                        : (item.model && item.model.trim().toLowerCase() !== item.brand.trim().toLowerCase() ? `<span class="card-model">${item.model}</span>` : '')}
                    ${sizeDisplay && item.category !== 'Forros' ? `<span class="card-size">${sizeDisplay}</span>` : ''}
                    <span class="card-stock ${stockClass}">${stockLabel}</span>
                    <div class="card-footer">
                        <div class="card-pricing">
                            <span class="card-price-label">Ref. BCV</span>
                            <div class="card-price-main">${bcvPriceText}</div>
                            ${hasDivisa ? `<div class="card-price-sub">Divisas: ${divisaPriceText}</div>` : ''}
                        </div>
                        <a href="https://wa.me/58424000000?text=${wa}" target="_blank" class="btn-apartar">Apartar</a>
                    </div>
                </div>`;

            card.style.cursor = 'pointer';
            card.addEventListener('click', (e) => {
                if (e.target.closest('.btn-apartar')) return;
                openZoomModal({
                    image: itemImg || getProductImage(item),
                    category: item.category,
                    brand: item.brand,
                    model: item.model,
                    size: sizeDisplay,
                    desc: brandDesc,
                    stockClass: stockClass,
                    stockLabel: stockLabel,
                    bcvPrice: bcvPriceText,
                    divisaPrice: divisaPriceText,
                    hasDivisa: hasDivisa,
                    waUrl: `https://wa.me/58424000000?text=${wa}`
                });
            });

            catalogEl.appendChild(card);
        });
    }

    // ── Zoom Modal Controller (Amazon Style) ───────────────
    const zoomModal = document.getElementById('image-zoom-modal');
    const zoomBackdrop = document.getElementById('zoom-modal-backdrop');
    const zoomCloseBtn = document.getElementById('zoom-modal-close');
    const zoomContainer = document.getElementById('zoom-img-container');
    const zoomImg = document.getElementById('zoom-target-img');
    const zoomBrand = document.getElementById('zoom-modal-brand');
    const zoomTitle = document.getElementById('zoom-modal-title');
    const zoomSize = document.getElementById('zoom-modal-size');
    const zoomStock = document.getElementById('zoom-modal-stock');
    const zoomDescBox = document.getElementById('zoom-modal-desc-box');
    const zoomDescText = document.getElementById('zoom-modal-desc');
    const zoomPrice = document.getElementById('zoom-modal-price');
    const zoomWaBtn = document.getElementById('zoom-modal-wa-btn');

    function openZoomModal(data) {
        if (!zoomModal) return;
        const modalBody = zoomModal.querySelector('.zoom-modal-body');
        if (modalBody) modalBody.scrollTop = 0;

        zoomImg.src = data.image || '';

        const isTire = data.category === 'Cauchos';
        const hasImg = Boolean(data.image);
        if (zoomContainer) {
            zoomContainer.dataset.zoomEnabled = (isTire && hasImg) ? 'true' : 'false';
            zoomContainer.style.cursor = (isTire && hasImg) ? 'zoom-in' : 'default';
            const hint = zoomContainer.querySelector('.zoom-hint');
            if (hint) {
                hint.style.display = (isTire && hasImg) ? 'block' : 'none';
            }
        }

        if (data.category === 'Forros') {
            zoomBrand.textContent = 'FORROS DE ASIENTO';
            zoomTitle.textContent = data.brand || 'Juego de Forros';
            zoomSize.textContent = data.size || '';
        } else {
            const brandStr = (data.brand || '').trim().toUpperCase();
            zoomBrand.textContent = brandStr;
            const modelIsBrand = !data.model || (data.model.trim().toLowerCase() === brandStr.toLowerCase());
            zoomTitle.textContent = modelIsBrand ? (data.size || brandStr || 'Producto') : (data.model || brandStr || 'Producto');
            zoomSize.textContent = (data.size && data.size !== zoomTitle.textContent) ? data.size : '';
        }

        zoomStock.className = `zoom-stock card-stock ${data.stockClass}`;
        zoomStock.textContent = data.stockLabel;

        if (zoomDescBox && zoomDescText) {
            if (data.desc) {
                zoomDescText.textContent = data.desc;
                zoomDescBox.classList.remove('hidden');
            } else {
                zoomDescBox.classList.add('hidden');
            }
        }

        if (data.hasDivisa) {
            zoomPrice.innerHTML = `<span class="zoom-price-label">Ref. BCV</span><span class="zoom-price-main">${data.bcvPrice}</span> <span class="zoom-price-sub">• Divisas: ${data.divisaPrice}</span>`;
        } else {
            zoomPrice.innerHTML = `<span class="zoom-price-label">Ref. BCV</span><span class="zoom-price-main">${data.bcvPrice}</span>`;
        }

        zoomWaBtn.href = data.waUrl;

        zoomContainer.classList.remove('is-zoomed');
        zoomImg.style.transformOrigin = 'center center';
        zoomModal.classList.remove('hidden');
    }

    function closeZoomModal() {
        if (!zoomModal) return;
        zoomModal.classList.add('hidden');
        zoomContainer.classList.remove('is-zoomed');
    }

    if (zoomCloseBtn) zoomCloseBtn.addEventListener('click', closeZoomModal);
    if (zoomBackdrop) zoomBackdrop.addEventListener('click', closeZoomModal);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeZoomModal();
    });

    if (zoomContainer) {
        zoomContainer.addEventListener('mousemove', (e) => {
            if (zoomContainer.dataset.zoomEnabled === 'false') return;
            const rect = zoomContainer.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            zoomImg.style.transformOrigin = `${x}% ${y}%`;
            zoomContainer.classList.add('is-zoomed');
        });

        zoomContainer.addEventListener('mouseleave', () => {
            zoomContainer.classList.remove('is-zoomed');
            zoomImg.style.transformOrigin = 'center center';
        });

        zoomContainer.addEventListener('click', () => {
            if (zoomContainer.dataset.zoomEnabled === 'false') return;
            zoomContainer.classList.toggle('is-zoomed');
        });
    }

    function normTireString(str) {
        if (!str) return '';
        return removeAccents(str)
            .toLowerCase()
            .replace(/[\.\/\-\_\,]/g, ' ')
            .replace(/(\d+)([a-zA-Z]+)/g, '$1 $2')
            .replace(/([a-zA-Z]+)(\d+)/g, '$1 $2')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // ── Filter ─────────────────────────────────────────────
    function applyFilters() {
        const searchTermRaw = state.search || '';
        const searchNorm = normTireString(searchTermRaw);
        const searchTokens = searchNorm.split(/\s+/).filter(Boolean);

        // Modo prioridad de medida (vehicleMeasure): muestra todos los Cauchos
        // pero los que coinciden con la medida van primero.
        const vmRaw = state.vehicleMeasure || '';
        const vmNorm = normTireString(vmRaw);
        const vmTokens = vmNorm.split(/\s+/).filter(Boolean);
        const vehicleMeasureActive = vmTokens.length > 0;

        // Categorías donde la medida/rin del vehículo tiene sentido como filtro estricto
        const isTireLikeCategory = !state.category
            || state.category === 'Cauchos'
            || state.category === 'Rines';

        const filtered = products.filter(p => {
            // Ocultar productos agotados
            if (p.qty <= 0) return false;

            if (state.category && p.category !== state.category) return false;
            if (!state.category && state.categories && state.categories.length > 0) {
                if (!state.categories.includes(p.category)) return false;
            }

            // Filtros de medida/rin: solo aplican en Cauchos y Rines
            if (isTireLikeCategory) {
                // Al filtrar por Rin, solo mostrar cauchos y rines de ese rin
                if (state.rim) {
                    if (p.category !== 'Cauchos' && p.category !== 'Rines') return false;
                    if (p.rim.toString() !== state.rim) return false;
                }
                if (state.width && p.width.toString() !== state.width) return false;
                if (state.profile && p.profile.toString() !== state.profile) return false;
            }

            if (state.terrain && p.terrain !== state.terrain) return false;

            if (state.category === 'Forros' && state.forrosKeywords && state.forrosKeywords.length > 0) {
                const forroHaystack = normTireString(`${p.brand} ${p.model} ${p.rawCol0 || ''}`);
                const matches = state.forrosKeywords.some(kw => forroHaystack.includes(kw));
                if (!matches) return false;
            }

            // Búsqueda por texto: en categorías no-Cauchos/Rines, la medida del vehículo
            // se ignora como filtro estricto — se muestra todo el stock de esa categoría.
            // En modo vehicleMeasure NO filtramos por search (sólo ordenamos).
            if (!vehicleMeasureActive && searchTokens.length > 0 && isTireLikeCategory) {
                const itemHaystack = normTireString(
                    `${p.rawCol0 || ''} ${p.brand} ${p.model} ${p.width} ${p.profile} ${p.rim} ${p.category} ${p.terrain} ${p.width}/${p.profile} R${p.rim}`
                );
                const allTokensMatch = searchTokens.every(tok => itemHaystack.includes(tok));
                if (!allTokensMatch) return false;
            } else if (!vehicleMeasureActive && searchTokens.length > 0 && !isTireLikeCategory) {
                const looksLikeTireMeasure = /\d{3}[\/.]\d{2,3}/.test(searchTermRaw) || /r\d{2}/i.test(searchTermRaw);
                if (!looksLikeTireMeasure) {
                    const itemHaystack = normTireString(
                        `${p.rawCol0 || ''} ${p.brand} ${p.model} ${p.category}`
                    );
                    const allTokensMatch = searchTokens.every(tok => itemHaystack.includes(tok));
                    if (!allTokensMatch) return false;
                }
            }

            return true;
        });

        // Ordenar cuando vehicleMeasure está activo:
        // primero los que coinciden con la medida, luego el resto
        let matchedCount = undefined;
        if (vehicleMeasureActive) {
            const matched = [];
            const others = [];
            filtered.forEach(p => {
                const hay = normTireString(
                    `${p.rawCol0 || ''} ${p.width} ${p.profile} ${p.rim} ${p.width}/${p.profile} R${p.rim}`
                );
                const isMatch = vmTokens.every(tok => hay.includes(tok));
                if (isMatch) matched.push(p);
                else others.push(p);
            });
            matchedCount = matched.length;
            // Reemplazar filtered con el array ordenado
            filtered.length = 0;
            matched.forEach(p => filtered.push(p));
            others.forEach(p => filtered.push(p));
        }

        // Toggle sidebar filters visibility
        const isForros = state.category === 'Forros';
        const isTripas = state.category === 'Tripas/Protectores' || state.category === 'Tripas';
        const showSidebarFilters = (state.category === '' || state.category === 'Cauchos' || state.category === 'Rines' || isTripas);
        const showTerrainFilter = (state.category === '' || state.category === 'Cauchos') && ['15', '16', '17', '18'].includes(state.rim);

        const tireFiltersEl = document.getElementById('tire-filters');
        const terrainFilterEl = document.getElementById('terrain-filter-section');
        const forrosSidebarEl = document.getElementById('forros-sidebar-section');
        const forrosBannerEl = document.getElementById('forros-finder-banner');
        const tripasBannerEl = document.getElementById('tripas-finder-banner');

        if (tireFiltersEl) tireFiltersEl.style.display = showSidebarFilters ? 'block' : 'none';
        if (forrosSidebarEl) forrosSidebarEl.style.display = isForros ? 'block' : 'none';
        if (forrosBannerEl) forrosBannerEl.style.display = isForros ? 'flex' : 'none';
        if (tripasBannerEl) tripasBannerEl.style.display = isTripas ? 'flex' : 'none';

        const tripasRimSelect = document.getElementById('tripas-rim-select');
        const tripasResetBtn = document.getElementById('tripas-reset-btn');
        if (tripasRimSelect) tripasRimSelect.value = state.rim || '';
        if (tripasResetBtn) tripasResetBtn.style.display = (isTripas && state.rim) ? 'inline-block' : 'none';

        if (terrainFilterEl) {
            terrainFilterEl.style.display = showTerrainFilter ? 'block' : 'none';
            if (!showTerrainFilter && state.terrain) {
                state.terrain = '';
                const terrainListEl = document.getElementById('terrain-list');
                if (terrainListEl) {
                    terrainListEl.querySelectorAll('.filter-item').forEach((item, idx) => {
                        item.classList.toggle('active', idx === 0);
                    });
                }
            }
        }

        renderCatalog(filtered, matchedCount);
    }

    // ══════════════════════════════════════════
    // ASISTENTE INTERACTIVO MÓVIL (WIZARD 3 PASOS)
    // ══════════════════════════════════════════

    const wizardStep1 = document.getElementById('wizard-step-1');
    const wizardStep2 = document.getElementById('wizard-step-2');
    const wizardStep3 = document.getElementById('wizard-step-3');

    const stepNode1 = document.getElementById('step-node-1');
    const stepNode2 = document.getElementById('step-node-2');
    const stepNode3 = document.getElementById('step-node-3');
    const stepLine1 = document.getElementById('step-line-1');
    const stepLine2 = document.getElementById('step-line-2');

    const catSelectionGrid = document.getElementById('cat-selection-grid');
    const catCounter = document.getElementById('cat-counter');
    const btnWizardToStep2 = document.getElementById('btn-wizard-to-step2');

    const btnBackToStep1 = document.getElementById('btn-back-to-step1');
    const btnBackToStep2 = document.getElementById('btn-back-to-step2');

    const wizardBrandSelect = document.getElementById('wizard-brand-select');
    const wizardModelSelect = document.getElementById('wizard-model-select');
    const vQuickBrands = document.getElementById('v-quick-brands');
    const btnManualSizeToggle = document.getElementById('btn-manual-size-toggle');
    const manualSizeDrawer = document.getElementById('manual-size-drawer');
    const manualRimChips = document.getElementById('manual-rim-chips');

    const step3VehicleTitle = document.getElementById('step3-vehicle-title');
    const recommendedSizesGrid = document.getElementById('recommended-sizes-grid');

    const activeVehicleBar = document.getElementById('active-vehicle-bar');
    const activeVTitle = document.getElementById('active-v-title');
    const activeVSub = document.getElementById('active-v-sub');
    const btnChangeVehicle = document.getElementById('btn-change-vehicle');

    let selectedCategory = 'Cauchos'; // Selección única — ya no se usa array
    let currentWizardBrand = '';
    let currentWizardModelData = null;

    function updateStepper(step) {
        if (step === 1) {
            stepNode1?.classList.add('active');
            stepNode1?.classList.remove('completed');
            stepLine1?.classList.remove('active');
            stepNode2?.classList.remove('active', 'completed');
            stepLine2?.classList.remove('active');
            stepNode3?.classList.remove('active', 'completed');

            wizardStep1?.classList.add('active');
            wizardStep2?.classList.remove('active');
            wizardStep3?.classList.remove('active');
        } else if (step === 2) {
            stepNode1?.classList.remove('active');
            stepNode1?.classList.add('completed');
            stepLine1?.classList.add('active');
            stepNode2?.classList.add('active');
            stepNode2?.classList.remove('completed');
            stepLine2?.classList.remove('active');
            stepNode3?.classList.remove('active', 'completed');

            wizardStep1?.classList.remove('active');
            wizardStep2?.classList.add('active');
            wizardStep3?.classList.remove('active');
        } else if (step === 3) {
            stepNode1?.classList.remove('active');
            stepNode1?.classList.add('completed');
            stepLine1?.classList.add('active');
            stepNode2?.classList.remove('active');
            stepNode2?.classList.add('completed');
            stepLine2?.classList.add('active');
            stepNode3?.classList.add('active');
            stepNode3?.classList.remove('completed');

            wizardStep1?.classList.remove('active');
            wizardStep2?.classList.remove('active');
            wizardStep3?.classList.add('active');
        }
    }

    // ── Paso 1: Selección de Categoría (selección única) ───
    if (catSelectionGrid) {
        catSelectionGrid.querySelectorAll('.cat-card').forEach(card => {
            card.addEventListener('click', () => {
                const cat = card.dataset.cat;
                if (!cat) return;

                // Deseleccionar todas y activar solo la tocada
                catSelectionGrid.querySelectorAll('.cat-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                selectedCategory = cat;

                const hasTiresOrRims = cat === 'Cauchos' || cat === 'Rines';
                if (btnWizardToStep2) {
                    const spanEl = btnWizardToStep2.querySelector('span');
                    if (spanEl) {
                        spanEl.textContent = hasTiresOrRims ? 'Siguiente: Elegir Vehículo' : 'Ver Catálogo Filtrado';
                    }
                }
            });
        });
    }

    // ── Modos de la App: Asistente vs Catálogo ─────────────
    function enterCatalogMode() {
        document.body.classList.remove('app-wizard-mode');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Centraliza la transición al catálogo con protección de race condition.
    // Si los datos aún no cargaron muestra un spinner; cuando lleguen,
    // el .then() del init llama applyFilters() y actualiza la vista.
    function launchCatalog() {
        enterCatalogMode();
        if (_dataReady) {
            applyFilters();
        } else {
            _pendingApplyFilters = true;
            if (catalogEl) {
                catalogEl.style.display = 'grid';
                catalogEl.innerHTML = `
                    <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--slate-400);">
                        <div style="font-size:2rem;margin-bottom:12px;animation:spin 1s linear infinite;display:inline-block;">⟳</div>
                        <p style="font-size:1rem;font-weight:600;">Cargando catálogo...</p>
                    </div>`;
            }
            if (noResultsEl) noResultsEl.classList.add('hidden');
        }
    }

    function enterWizardMode(step = 1) {
        document.body.classList.add('app-wizard-mode');
        updateStepper(step);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const btnSkipWizard = document.getElementById('btn-skip-wizard');
    if (btnSkipWizard) {
        btnSkipWizard.addEventListener('click', () => {
            state.category = '';
            state.categories = [];
            state.rim = '';
            state.search = '';
            launchCatalog();
        });
    }

    if (btnWizardToStep2) {
        btnWizardToStep2.addEventListener('click', () => {
            const hasTiresOrRims = selectedCategory === 'Cauchos' || selectedCategory === 'Rines';
            if (hasTiresOrRims) {
                updateStepper(2);
            } else {
                // Categoría sin paso de vehículo → ir directo al catálogo
                state.category = selectedCategory;
                state.categories = [selectedCategory];
                state.rim = '';
                state.search = '';
                enterCatalogMode();
                applyFilters();
            }
        });
    }

    if (btnBackToStep1) {
        btnBackToStep1.addEventListener('click', () => {
            updateStepper(1);
        });
    }

    if (btnBackToStep2) {
        btnBackToStep2.addEventListener('click', () => {
            updateStepper(2);
        });
    }

    // ── Paso 2: Tu Vehículo ────────────────────────────────
    function populateWizardBrands() {
        if (!wizardBrandSelect) return;
        wizardBrandSelect.innerHTML = '<option value="">Selecciona Marca...</option>';
        Object.keys(VEHICLE_DATABASE).sort().forEach(brand => {
            const opt = document.createElement('option');
            opt.value = brand;
            opt.textContent = brand;
            wizardBrandSelect.appendChild(opt);
        });
    }
    populateWizardBrands();

    function populateWizardModels(brand) {
        if (!wizardModelSelect) return;
        wizardModelSelect.innerHTML = '<option value="">Selecciona Modelo...</option>';
        if (!brand || !VEHICLE_DATABASE[brand]) {
            wizardModelSelect.disabled = true;
            return;
        }

        wizardModelSelect.disabled = false;
        VEHICLE_DATABASE[brand].forEach((item, index) => {
            const opt = document.createElement('option');
            opt.value = index;
            opt.textContent = item.model;
            wizardModelSelect.appendChild(opt);
        });
    }

    function selectBrand(brand) {
        currentWizardBrand = brand;
        if (wizardBrandSelect) wizardBrandSelect.value = brand;
        populateWizardModels(brand);

        if (vQuickBrands) {
            vQuickBrands.querySelectorAll('.brand-pill-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.brand === brand);
            });
        }
    }

    if (vQuickBrands) {
        vQuickBrands.querySelectorAll('.brand-pill-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                selectBrand(btn.dataset.brand);
            });
        });
    }

    if (wizardBrandSelect) {
        wizardBrandSelect.addEventListener('change', () => {
            selectBrand(wizardBrandSelect.value);
        });
    }

    if (wizardModelSelect) {
        wizardModelSelect.addEventListener('change', () => {
            const modelIndex = wizardModelSelect.value;
            if (modelIndex === '' || !currentWizardBrand || !VEHICLE_DATABASE[currentWizardBrand]) return;

            const vehicleData = VEHICLE_DATABASE[currentWizardBrand][modelIndex];
            currentWizardModelData = vehicleData;
            renderRecommendedSizes(currentWizardBrand, vehicleData);
            updateStepper(3);
        });
    }

    // "Buscar directo por medida o Rin" → lanza catálogo y da foco al buscador
    if (btnManualSizeToggle) {
        btnManualSizeToggle.addEventListener('click', () => {
            state.category = 'Cauchos';
            state.search = '';
            state.rim = '';
            state.width = '';
            state.profile = '';
            state.terrain = '';
            launchCatalog();
            // Pequeño delay para que el DOM del catálogo ya esté visible antes de hacer foco
            setTimeout(() => {
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select();
                    searchInput.placeholder = 'Escribe tu medida, ej: 185/65 R14...';
                }
            }, 150);
        });
    }

    if (manualRimChips) {
        manualRimChips.querySelectorAll('.rim-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const rimVal = chip.dataset.rim;
                manualRimChips.querySelectorAll('.rim-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');

                state.category = 'Cauchos';
                state.rim = rimVal;
                state.search = '';

                showActiveVehicleBar('Búsqueda por Rin', `Rin ${rimVal}"`);
                launchCatalog();
            });
        });
    }


    // ── Paso 3: Medidas Recomendadas ──────────────────────
    function renderRecommendedSizes(brand, vehicleData) {
        if (!recommendedSizesGrid) return;
        recommendedSizesGrid.innerHTML = '';

        if (step3VehicleTitle) {
            step3VehicleTitle.textContent = `Medidas para ${brand} ${vehicleData.model}`;
        }

        const sizes = vehicleData.sizes || [];
        if (sizes.length === 0) {
            recommendedSizesGrid.innerHTML = '<div class="rec-empty-note">No hay medidas registradas para este modelo. Puedes seleccionar tu rin en el paso anterior.</div>';
            return;
        }

        sizes.forEach((sizeStr, idx) => {
            const card = document.createElement('div');
            card.className = 'rec-size-card';
            card.innerHTML = `
                <span class="rec-badge-tag">${idx === 0 ? '★ Medida de Fábrica' : 'Medida Alternativa'}</span>
                <div class="rec-size-measure">${sizeStr}</div>
                <div class="rec-size-action">
                    <span>Ver cauchos disponibles</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16">
                        <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                    </svg>
                </div>
            `;

            card.addEventListener('click', () => {
                selectVehicleMeasure(brand, vehicleData, sizeStr);
            });

            recommendedSizesGrid.appendChild(card);
        });
    }

    function selectVehicleMeasure(brand, vehicleData, sizeStr) {
        state.category = 'Cauchos';
        state.vehicleMeasure = sizeStr;  // Modo prioridad: ordena, no filtra
        state.search = '';               // Limpiar search para no interferir
        state.terrain = '';
        state.rim = '';
        state.width = '';
        state.profile = '';

        if (searchInput) searchInput.value = '';

        showActiveVehicleBar(`${brand} ${vehicleData.model}`, `Medida: ${sizeStr}`);
        launchCatalog();
    }

    function showActiveVehicleBar(title, sub) {
        if (!activeVehicleBar) return;
        if (activeVTitle) activeVTitle.textContent = title;
        if (activeVSub) activeVSub.textContent = sub;
        activeVehicleBar.classList.remove('hidden');
    }

    if (btnChangeVehicle) {
        btnChangeVehicle.addEventListener('click', () => {
            enterWizardMode(2);
        });
    }

    // Size Selects
    const sWidthSelect = document.getElementById('size-width-select');
    const sProfileSelect = document.getElementById('size-profile-select');
    const sRimSelect = document.getElementById('size-rim-select');
    const btnSearchSize = document.getElementById('btn-search-size');

    function populateSizeSelects() {
        if (!sWidthSelect || !sProfileSelect || !sRimSelect) return;
        sWidthSelect.innerHTML = '<option value="">Todos</option>';
        sProfileSelect.innerHTML = '<option value="">Todos</option>';
        sRimSelect.innerHTML = '<option value="">Todos</option>';

        const widths = new Set();
        const profiles = new Set();
        const rims = new Set();

        products.forEach(p => {
            if (p.category === 'Cauchos') {
                if (p.width > 0) widths.add(p.width);
                if (p.profile > 0) profiles.add(p.profile);
                if (p.rim > 0) rims.add(p.rim);
            }
        });

        Array.from(widths).sort((a, b) => a - b).forEach(w => {
            const opt = document.createElement('option');
            opt.value = w;
            opt.textContent = `${w} mm`;
            sWidthSelect.appendChild(opt);
        });

        Array.from(profiles).sort((a, b) => a - b).forEach(pr => {
            const opt = document.createElement('option');
            opt.value = pr;
            opt.textContent = `${pr}%`;
            sProfileSelect.appendChild(opt);
        });

        Array.from(rims).sort((a, b) => a - b).forEach(r => {
            const opt = document.createElement('option');
            opt.value = r;
            opt.textContent = `Rin ${r}`;
            sRimSelect.appendChild(opt);
        });
    }

    if (btnSearchSize) {
        btnSearchSize.addEventListener('click', () => {
            state.category = 'Cauchos';
            state.width = sWidthSelect ? sWidthSelect.value : '';
            state.profile = sProfileSelect ? sProfileSelect.value : '';
            state.rim = sRimSelect ? sRimSelect.value : '';
            applyFilters();
        });
    }

    function setupListFilter(listEl, stateKey) {
        if (!listEl) return;
        listEl.querySelectorAll('.filter-item').forEach(item => {
            item.addEventListener('click', () => {
                listEl.querySelectorAll('.filter-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                state[stateKey] = item.dataset.value;

                // Auto-reset rim/terrain/forros if category changes
                if (stateKey === 'category') {
                    if (state.category !== '' && state.category !== 'Cauchos' && state.category !== 'Rines' && state.category !== 'Tripas/Protectores' && state.category !== 'Tripas') {
                        state.rim = '';
                        state.terrain = '';
                        [rimList, terrainList].forEach(list => {
                            if (list) {
                                list.querySelectorAll('.filter-item').forEach((i, idx) => i.classList.toggle('active', idx === 0));
                            }
                        });
                    }
                    if (state.category !== 'Forros') {
                        state.forrosBrand = '';
                        state.forrosModel = '';
                        state.forrosKeywords = [];
                        const fBrand = document.getElementById('forros-brand-select');
                        const fModel = document.getElementById('forros-model-select');
                        const fReset = document.getElementById('forros-reset-btn');
                        const fSideBrand = document.getElementById('forros-side-brand');
                        const fSideModel = document.getElementById('forros-side-model');
                        if (fBrand) fBrand.value = '';
                        if (fSideBrand) fSideBrand.value = '';
                        if (fModel) { fModel.innerHTML = '<option value="">Todos los Modelos</option>'; fModel.disabled = true; }
                        if (fSideModel) { fSideModel.innerHTML = '<option value="">Todos los Modelos</option>'; fSideModel.disabled = true; }
                        if (fReset) fReset.style.display = 'none';
                    }
                }

                applyFilters();
            });
        });
    }

    setupListFilter(categoryList, 'category');
    setupListFilter(rimList, 'rim');
    setupListFilter(terrainList, 'terrain');

    // ── Forros Finder Controller ───────────────────────────
    const forrosBrandSelect = document.getElementById('forros-brand-select');
    const forrosModelSelect = document.getElementById('forros-model-select');
    const forrosResetBtn = document.getElementById('forros-reset-btn');
    const forrosSideBrand = document.getElementById('forros-side-brand');
    const forrosSideModel = document.getElementById('forros-side-model');

    function populateForrosSelects() {
        const brandSelects = [forrosBrandSelect, forrosSideBrand].filter(Boolean);
        const modelSelects = [forrosModelSelect, forrosSideModel].filter(Boolean);

        brandSelects.forEach(sel => {
            sel.innerHTML = '<option value="">Todas las Marcas</option>';
            Object.keys(FORROS_VEHICLES).forEach(brand => {
                const opt = document.createElement('option');
                opt.value = brand;
                opt.textContent = brand;
                sel.appendChild(opt);
            });
        });

        function updateModels(selectedBrand) {
            modelSelects.forEach(sel => {
                sel.innerHTML = '<option value="">Todos los Modelos</option>';
                if (!selectedBrand || !FORROS_VEHICLES[selectedBrand]) {
                    sel.disabled = true;
                } else {
                    sel.disabled = false;
                    FORROS_VEHICLES[selectedBrand].forEach((v, idx) => {
                        const opt = document.createElement('option');
                        opt.value = idx;
                        opt.textContent = v.model;
                        sel.appendChild(opt);
                    });
                }
            });
        }

        function handleBrandChange(brandVal) {
            state.forrosBrand = brandVal;
            state.forrosModel = '';

            brandSelects.forEach(s => s.value = brandVal);
            updateModels(brandVal);
            modelSelects.forEach(s => s.value = '');

            if (brandVal && FORROS_VEHICLES[brandVal]) {
                const allKws = [];
                FORROS_VEHICLES[brandVal].forEach(m => allKws.push(...m.keywords));
                allKws.push(brandVal.toLowerCase());
                state.forrosKeywords = allKws;
            } else {
                state.forrosKeywords = [];
            }

            if (forrosResetBtn) {
                forrosResetBtn.style.display = brandVal ? 'inline-block' : 'none';
            }

            applyFilters();
        }

        function handleModelChange(modelIdx) {
            state.forrosModel = modelIdx;
            modelSelects.forEach(s => s.value = modelIdx);

            if (modelIdx !== '' && state.forrosBrand && FORROS_VEHICLES[state.forrosBrand]) {
                const vehicle = FORROS_VEHICLES[state.forrosBrand][modelIdx];
                state.forrosKeywords = vehicle ? vehicle.keywords : [];
            } else if (state.forrosBrand && FORROS_VEHICLES[state.forrosBrand]) {
                const allKws = [];
                FORROS_VEHICLES[state.forrosBrand].forEach(m => allKws.push(...m.keywords));
                allKws.push(state.forrosBrand.toLowerCase());
                state.forrosKeywords = allKws;
            } else {
                state.forrosKeywords = [];
            }

            if (forrosResetBtn) {
                forrosResetBtn.style.display = (state.forrosBrand || modelIdx !== '') ? 'inline-block' : 'none';
            }

            applyFilters();
        }

        if (forrosBrandSelect) forrosBrandSelect.addEventListener('change', () => handleBrandChange(forrosBrandSelect.value));
        if (forrosSideBrand) forrosSideBrand.addEventListener('change', () => handleBrandChange(forrosSideBrand.value));

        if (forrosModelSelect) forrosModelSelect.addEventListener('change', () => handleModelChange(forrosModelSelect.value));
        if (forrosSideModel) forrosSideModel.addEventListener('change', () => handleModelChange(forrosSideModel.value));

        if (forrosResetBtn) {
            forrosResetBtn.addEventListener('click', () => {
                handleBrandChange('');
            });
        }
    }

    // ── Tripas Finder Controller ───────────────────────────
    const tripasRimSelect = document.getElementById('tripas-rim-select');
    const tripasResetBtn = document.getElementById('tripas-reset-btn');

    function populateTripasSelects() {
        if (!tripasRimSelect) return;
        const tripasRims = new Set();
        products.forEach(p => {
            if ((p.category === 'Tripas/Protectores' || p.category === 'Tripas') && p.rim > 0) {
                tripasRims.add(p.rim);
            }
        });

        tripasRimSelect.innerHTML = '<option value="">Todos los Rines</option>';
        Array.from(tripasRims).sort((a, b) => a - b).forEach(r => {
            const opt = document.createElement('option');
            opt.value = r;
            opt.textContent = `Rin ${r}"`;
            tripasRimSelect.appendChild(opt);
        });

        tripasRimSelect.addEventListener('change', () => {
            state.rim = tripasRimSelect.value;
            const rimListEl = document.getElementById('rim-list');
            if (rimListEl) {
                rimListEl.querySelectorAll('.filter-item').forEach(item => {
                    item.classList.toggle('active', item.dataset.value === state.rim);
                });
            }
            if (tripasResetBtn) {
                tripasResetBtn.style.display = state.rim ? 'inline-block' : 'none';
            }
            applyFilters();
        });

        if (tripasResetBtn) {
            tripasResetBtn.addEventListener('click', () => {
                state.rim = '';
                tripasRimSelect.value = '';
                tripasResetBtn.style.display = 'none';
                const rimListEl = document.getElementById('rim-list');
                if (rimListEl) {
                    rimListEl.querySelectorAll('.filter-item').forEach((item, idx) => {
                        item.classList.toggle('active', idx === 0);
                    });
                }
                applyFilters();
            });
        }
    }

    // ── Search ─────────────────────────────────────────────
    searchInput.addEventListener('input', () => {
        state.search = searchInput.value.trim();
        applyFilters();
    });

    // ── Reset ──────────────────────────────────────────────
    function resetAll() {
        state.category = '';
        state.categories = ['Cauchos'];
        state.rim = '';
        state.width = '';
        state.profile = '';
        state.terrain = '';
        state.search = '';
        state.vehicleMeasure = '';
        state.forrosBrand = '';
        state.forrosModel = '';
        state.forrosKeywords = [];

        selectedCategory = 'Cauchos';
        currentWizardBrand = '';
        currentWizardModelData = null;

        if (catSelectionGrid) {
            catSelectionGrid.querySelectorAll('.cat-card').forEach(c => {
                c.classList.toggle('active', c.dataset.cat === 'Cauchos');
            });
        }
        if (btnWizardToStep2) {
            const spanEl = btnWizardToStep2.querySelector('span');
            if (spanEl) spanEl.textContent = 'Siguiente: Elegir Vehículo';
        }
        if (wizardBrandSelect) wizardBrandSelect.value = '';
        if (wizardModelSelect) {
            wizardModelSelect.innerHTML = '<option value="">Primero elige Marca...</option>';
            wizardModelSelect.disabled = true;
        }
        if (vQuickBrands) {
            vQuickBrands.querySelectorAll('.brand-pill-btn').forEach(b => b.classList.remove('active'));
        }
        if (manualSizeDrawer) manualSizeDrawer.classList.add('hidden');
        if (manualRimChips) {
            manualRimChips.querySelectorAll('.rim-chip').forEach(c => c.classList.remove('active'));
        }
        if (activeVehicleBar) activeVehicleBar.classList.add('hidden');
        enterWizardMode(1);

        if (searchInput) searchInput.value = '';

        if (forrosBrandSelect) forrosBrandSelect.value = '';
        if (forrosSideBrand) forrosSideBrand.value = '';
        if (forrosModelSelect) { forrosModelSelect.innerHTML = '<option value="">Todos los Modelos</option>'; forrosModelSelect.disabled = true; }
        if (forrosSideModel) { forrosSideModel.innerHTML = '<option value="">Todos los Modelos</option>'; forrosSideModel.disabled = true; }
        if (forrosResetBtn) forrosResetBtn.style.display = 'none';

        if (tripasRimSelect) tripasRimSelect.value = '';
        if (tripasResetBtn) tripasResetBtn.style.display = 'none';

        [categoryList, rimList, terrainList].forEach(list => {
            if (list) {
                list.querySelectorAll('.filter-item').forEach((item, i) => {
                    item.classList.toggle('active', i === 0);
                });
            }
        });
        syncMobileFilterBar();
        applyFilters();
    }

    resetBtn.addEventListener('click', resetAll);
    resetNoRes.addEventListener('click', resetAll);

    // ── Mobile Nav ─────────────────────────────────────────
    const mobHome = document.getElementById('mob-nav-home');
    const mobSearch = document.getElementById('mob-nav-search');
    const mobCats = document.getElementById('mob-nav-cats');
    const mobFilters = document.getElementById('mob-nav-filters');

    if (mobHome) {
        mobHome.addEventListener('click', (e) => {
            e.preventDefault();
            // Limpiar todos los filtros y mostrar catálogo completo
            state.category = '';
            state.categories = [];
            state.rim = '';
            state.width = '';
            state.profile = '';
            state.terrain = '';
            state.search = '';
            if (searchInput) searchInput.value = '';
            [categoryList, rimList, terrainList].forEach(list => {
                if (list) list.querySelectorAll('.filter-item').forEach((item, i) => item.classList.toggle('active', i === 0));
            });
            syncMobileFilterBar();
            launchCatalog();
        });
    }

    if (mobSearch) {
        mobSearch.addEventListener('click', (e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setTimeout(() => searchInput.focus(), 300);
        });
    }

    if (mobCats) {
        mobCats.addEventListener('click', (e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // ── Init ───────────────────────────────────────────────
    fetchProductsFromGoogleSheets().then(() => {
        populateSizeSelects();
        populateForrosSelects();
        populateTripasSelects();
        syncMobileFilterBar();
        // Siempre actualizar el catálogo cuando lleguen los datos,
        // tanto si el wizard sigue activo como si el usuario ya saltó al catálogo
        applyFilters();
        // Si el usuario saltó al catálogo antes de que cargaran los datos,
        // el pending ya fue resuelto por el applyFilters() de arriba
        _pendingApplyFilters = false;
    });
});

