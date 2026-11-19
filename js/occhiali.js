// =====================================================================
// L'occhiale di Giulia Camasso
// Una sola scena 3D resta ferma dietro alla pagina: mentre scorri gli occhiali
// arrivano (apertura), si chiudono e si aprono (movimento), si separano nelle
// loro parti con le frecce (anatomia).
// =====================================================================

// È uno script "normale" (non un modulo) che carica Three.js con import():
// così funziona sia con Live Server sia aprendo index.html con doppio clic.
(async function () {

const THREE = await import('three');
const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');

const SFONDO = '#fbf7f4';   // uguale a --sfondo nel CSS
const movimentoRidotto = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ===== utilità =====
const limita = (v, a = 0, b = 1) => Math.min(Math.max(v, a), b);
const morbido = (t) => { t = limita(t); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const gradi = THREE.MathUtils.degToRad;

// =====================================================================
// la scena
// =====================================================================
const contenitoreScena = document.getElementById('scena');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.NeutralToneMapping;
contenitoreScena.appendChild(renderer.domElement);

const scena = new THREE.Scene();
scena.background = new THREE.Color(SFONDO);

const generatore = new THREE.PMREMGenerator(renderer);
scena.environment = generatore.fromScene(new RoomEnvironment(), 0.04).texture;
scena.environmentIntensity = 0.9;

scena.add(new THREE.HemisphereLight(0xffffff, 0xf3e4e8, 0.7));
const luceChiave = new THREE.DirectionalLight(0xffffff, 1.8);
luceChiave.position.set(3, 5, 6);
scena.add(luceChiave);
const luceRetro = new THREE.DirectionalLight(0xffe9ef, 1.0);
luceRetro.position.set(-4, 3, -5);
scena.add(luceRetro);

const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 100);

// la distanza della camera: su schermi stretti si allontana perché tutto entri
function sistemaCamera() {
    const aspetto = window.innerWidth / window.innerHeight;
    camera.aspect = aspetto;
    const larghezzaVoluta = 3.5;   // quanto deve stare in orizzontale (l'esploso è largo)
    const distanza = Math.max(6.2, larghezzaVoluta / (2 * Math.tan(gradi(15)) * aspetto));
    camera.position.set(0, 0, distanza);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
}
sistemaCamera();

// =====================================================================
// i materiali
// =====================================================================
// la lente: rosa chiaro, molto delicato, trasparente
const materialeLente = new THREE.MeshPhysicalMaterial({
    color: '#fff1f5',
    metalness: 0,
    roughness: 0.04,
    transmission: 1,
    thickness: 0.01,
    ior: 1.45,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    side: THREE.DoubleSide
});

// le aste: acetato color avorio latte (pieno, così si vede attraverso la lente)
const materialeAste = new THREE.MeshPhysicalMaterial({
    color: '#f3ece7',
    roughness: 0.35,
    sheen: 0.4,
    sheenColor: new THREE.Color('#fff6f8'),
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    side: THREE.DoubleSide
});

// le cerniere: metallo color champagne
const materialeMetallo = new THREE.MeshStandardMaterial({
    color: '#d8bc94',
    metalness: 1,
    roughness: 0.28,
    side: THREE.DoubleSide
});

// =====================================================================
// le parti dell'occhiale (gli indici sono i pezzi dentro giuliacamasso.glb)
// =====================================================================
//  0, 1   la lente avvolgente (fronte e retro)
//  5, 11  la cerniera fissata alla lente (destra, sinistra)
//  2      nocca superiore della cerniera sull'asta destra, 3 e 4 quella inferiore
//  10     nocca superiore sull'asta sinistra, 8 e 9 quella inferiore
//  6, 7   le aste (destra, sinistra)
const PARTI_ASTA_DESTRA = [2, 3, 4, 6];
const PARTI_ASTA_SINISTRA = [7, 8, 9, 10];

// i perni delle cerniere, misurati sul cilindro della vite (misure del file)
const PERNO_DESTRO = new THREE.Vector3(0.0776, 0, -0.0625);
const PERNO_SINISTRO = new THREE.Vector3(-0.0759, 0, -0.0612);

// dove va ogni pezzo nello spaccato (misure del file: x verso l'esterno, y in alto, z in avanti)
const SPOSTAMENTI = {
    0: [0, 0.004, 0.065],
    1: [0, 0.004, 0.065],
    5: [0.024, 0, 0.012],
    11: [-0.024, 0, 0.012],
    2: [0.044, 0.024, -0.014],
    3: [0.044, -0.024, -0.014],
    4: [0.044, -0.024, -0.014],
    10: [-0.044, 0.024, -0.014],
    8: [-0.044, -0.024, -0.014],
    9: [-0.044, -0.024, -0.014],
    6: [0.08, 0, -0.045],
    7: [-0.08, 0, -0.045]
};

// le frecce: a quale pezzo puntano, dove (misure del file) e da che parte sta la scritta
// (in pixel: "lato" sul computer, "telefono" sugli schermi stretti)
const ETICHETTE = [
    { pezzo: 0, punto: null, cerca: [-0.02, -0.066], nome: 'Lente avvolgente', desc: 'Un unico schermo rosa cipria', lato: [-170, -110], telefono: [-60, -80] },
    { pezzo: 0, punto: null, cerca: [0, -0.0905], nome: 'Ponte', desc: 'Si appoggia morbido sul naso', lato: [-120, 120], telefono: [-60, 70] },
    { pezzo: 5, punto: 'centro', nome: 'Cerniera', desc: 'Fissata alla lente', lato: [-40, -170], telefono: [-30, 90] },
    { pezzo: 2, punto: 'centro', nome: 'Snodo', desc: 'Lascia ruotare l’asta', lato: [90, -150], telefono: [-40, -100] },
    { pezzo: 6, punto: [0.0834, -0.085, -0.13], nome: 'Asta', desc: 'Corre lungo la tempia', lato: [140, -90], telefono: [20, -150] },
    { pezzo: 6, punto: [0.0834, -0.128, -0.208], nome: 'Terminale', desc: 'La curva che abbraccia l’orecchio', lato: [90, 100], telefono: [20, 110] }
];

// =====================================================================
// il modello
// =====================================================================
const gruppo = new THREE.Group();     // lo muovo e lo ruoto con lo scroll
const modello = new THREE.Group();    // le misure originali del file, centrato dentro "gruppo"
gruppo.add(modello);
scena.add(gruppo);

// l'occhiale di Giulia sta in un suo gruppo: gli altri tipi (costruiti col codice) prendono il suo posto
const radiceGiulia = new THREE.Group();
modello.add(radiceGiulia);

const perni = { destra: new THREE.Group(), sinistra: new THREE.Group() };
perni.destra.position.copy(PERNO_DESTRO);
perni.sinistra.position.copy(PERNO_SINISTRO);
radiceGiulia.add(perni.destra, perni.sinistra);

const pezzi = [];
let modelloPronto = false;

// un "set" è un tipo di occhiale: i suoi pezzi, i perni delle aste e le frecce dello spaccato
const setGiulia = { radice: radiceGiulia, pezzi: pezzi, perni: perni, etichette: ETICHETTE };
const TIPI = { giulia: setGiulia };   // gli altri si aggiungono quando il modello è pronto
let attivo = setGiulia;

// il punto della superficie anteriore di un pezzo più vicino a (x, y)
function puntoSuperficie(oggetto, x, y) {
    let migliore = null;
    let zMassima = -Infinity;
    oggetto.traverse(function (o) {
        if (!o.isMesh) return;
        const pos = o.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const dx = pos.getX(i) - x;
            const dy = pos.getY(i) - y;
            if (dx * dx + dy * dy < 0.006 * 0.006 && pos.getZ(i) > zMassima) {
                zMassima = pos.getZ(i);
                migliore = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
            }
        }
    });
    return migliore || new THREE.Vector3(x, y, 0);
}

// =====================================================================
// le varianti del modello: la stessa forma, rimodellata
// =====================================================================
// ogni variante sposta i punti del modello (misure del file):
// la lente va da y = -0.1094 (sotto) a y = -0.053 (sopra), il davanti guarda verso +z
const SOPRA = -0.053, SOTTO = -0.1094;
const VARIANTI = {
    // com'è stato disegnato
    originale: function (x, y, z) { return [x, y, z]; },
    // più bassa e affilata
    sottile: function (x, y, z) { return [x, SOPRA - (SOPRA - y) * 0.72, z]; },
    // più alta, a maschera
    maxi: function (x, y, z) { return [x, SOPRA - (SOPRA - y) * 1.3, z]; },
    // gli angoli esterni si alzano, come gli occhi di un gatto
    gatto: function (x, y, z) {
        const fuori = Math.max(0, Math.abs(x) - 0.03);
        const t = limita((y - SOTTO) / (SOPRA - SOTTO));
        return [x, y + 5 * fuori * fuori * (0.3 + 0.7 * t), z];
    },
    // più curva, abbraccia di più il viso
    avvolgente: function (x, y, z) { return [x * 0.97, y, z - 2.4 * x * x]; }
};

const geometrieOriginali = [];        // riempito quando il modello è caricato
const cambioVariante = { da: 'originale', a: 'originale', inizio: 0, durata: 900, attivo: false };

// la forma "a metà strada" tra due varianti (k da 0 a 1)
function deforma(x, y, z, da, a, k, uscita) {
    const p = VARIANTI[da](x, y, z), q = VARIANTI[a](x, y, z);
    uscita[0] = mix(p[0], q[0], k); uscita[1] = mix(p[1], q[1], k); uscita[2] = mix(p[2], q[2], k);
}

function applicaVariante(da, a, k) {
    const P = [0, 0, 0], X = [0, 0, 0], Y = [0, 0, 0], Z = [0, 0, 0];
    const h = 1e-4;
    geometrieOriginali.forEach(function (g) {
        const pos = g.geometria.attributes.position.array;
        const nor = g.normali ? g.geometria.attributes.normal.array : null;
        for (let i = 0; i < pos.length; i += 3) {
            const x = g.posizioni[i], y = g.posizioni[i + 1], z = g.posizioni[i + 2];
            deforma(x, y, z, da, a, k, P);
            pos[i] = P[0]; pos[i + 1] = P[1]; pos[i + 2] = P[2];
            if (!nor) continue;
            // le normali (servono per la luce) seguono la deformazione
            deforma(x + h, y, z, da, a, k, X); deforma(x, y + h, z, da, a, k, Y); deforma(x, y, z + h, da, a, k, Z);
            const ax = X[0] - P[0], ay = X[1] - P[1], az = X[2] - P[2];
            const bx = Y[0] - P[0], by = Y[1] - P[1], bz = Y[2] - P[2];
            const cx = Z[0] - P[0], cy = Z[1] - P[1], cz = Z[2] - P[2];
            const nx = g.normali[i], ny = g.normali[i + 1], nz = g.normali[i + 2];
            let rx = nx * (by * cz - bz * cy) + ny * (cy * az - cz * ay) + nz * (ay * bz - az * by);
            let ry = nx * (bz * cx - bx * cz) + ny * (cz * ax - cx * az) + nz * (az * bx - ax * bz);
            let rz = nx * (bx * cy - by * cx) + ny * (cx * ay - cy * ax) + nz * (ax * by - ay * bx);
            const l = Math.hypot(rx, ry, rz) || 1;
            nor[i] = rx / l; nor[i + 1] = ry / l; nor[i + 2] = rz / l;
        }
        g.geometria.attributes.position.needsUpdate = true;
        if (nor) g.geometria.attributes.normal.needsUpdate = true;
        g.geometria.computeBoundingSphere();
        g.geometria.computeBoundingBox();
    });

    // i perni delle cerniere seguono la forma (le aste restano attaccate)
    [['destra', PERNO_DESTRO], ['sinistra', PERNO_SINISTRO]].forEach(function (coppia) {
        deforma(coppia[1].x, -0.08, coppia[1].z, da, a, k, P);
        const perno = setGiulia.perni[coppia[0]];
        perno.position.set(P[0], 0, P[2]);
        perno.children.forEach(function (parte) {
            const pezzo = setGiulia.pezzi.find(function (pz) { return pz && pz.oggetto === parte; });
            if (pezzo) pezzo.partenza.set(-P[0], 0, -P[2]);
        });
    });

    // e anche i punti dove arrivano le frecce
    ETICHETTE.forEach(function (e) {
        const o = e.originale;
        deforma(o.x, o.y, o.z, da, a, k, P);
        e.locale.set(P[0], P[1], P[2]);
    });
}

function scegliVariante(nome) {
    if (!modelloPronto || nome === cambioVariante.a) return;
    // se un cambio è ancora in corso parto dalla forma di arrivo (abbastanza vicina)
    cambioVariante.da = cambioVariante.a;
    cambioVariante.a = nome;
    cambioVariante.inizio = performance.now();
    cambioVariante.attivo = true;
}

function aggiornaVariante(ora) {
    if (!cambioVariante.attivo) return;
    const k = movimentoRidotto ? 1 : morbido((ora - cambioVariante.inizio) / cambioVariante.durata);
    applicaVariante(cambioVariante.da, cambioVariante.a, k);
    if (k >= 1) cambioVariante.attivo = false;
}

// =====================================================================
// gli altri tipi di occhiale, costruiti con il codice
// =====================================================================
// stesse misure del modello di Giulia (in metri): larghi circa 15 cm, il davanti verso +z,
// le aste vanno indietro fino a z = -0.205. Ogni tipo ha gli stessi 8 pezzi:
//   0 montatura (o ponte) · 1 lenti · 2, 3 cerniere sul frontale · 4, 5 snodi sulle aste · 6, 7 aste
const Y0 = -0.081;   // altezza del centro delle lenti

// i punti del contorno di una lente (destra), da una funzione angolo → [x, y]
function contornoLente(cx, cy, forma) {
    const punti = [];
    for (let i = 0; i < 120; i++) {
        const p = forma(i / 120 * Math.PI * 2);
        punti.push(new THREE.Vector2(cx + p[0], cy + p[1]));
    }
    return punti;
}
// lo stesso contorno, spostato verso l'esterno di d (il bordo della montatura)
function allarga(punti, d, dSopra) {
    const n = punti.length;
    return punti.map(function (p, i) {
        const a = punti[(i - 1 + n) % n], b = punti[(i + 1) % n];
        let nx = b.y - a.y, ny = -(b.x - a.x);
        const l = Math.hypot(nx, ny) || 1;
        nx /= l; ny /= l;
        const dd = (dSopra !== undefined && ny > 0) ? mix(d, dSopra, ny) : d;
        return new THREE.Vector2(p.x + nx * dd, p.y + ny * dd);
    });
}
// come allarga, ma lo spessore dipende dalla direzione (nx, ny) del bordo
function allargaCon(punti, spessore) {
    const n = punti.length;
    return punti.map(function (p, i) {
        const a = punti[(i - 1 + n) % n], b = punti[(i + 1) % n];
        let nx = b.y - a.y, ny = -(b.x - a.x);
        const l = Math.hypot(nx, ny) || 1;
        nx /= l; ny /= l;
        const d = spessore(nx, ny);
        return new THREE.Vector2(p.x + nx * d, p.y + ny * d);
    });
}
// la lente sinistra è lo specchio della destra
function specchia(punti) {
    return punti.map(function (p) { return new THREE.Vector2(-p.x, p.y); }).reverse();
}
function forma(punti, buco) {
    const s = new THREE.Shape(punti);
    if (buco) s.holes.push(new THREE.Path(buco));
    return s;
}
// una forma piatta resa spessa: davanti a zDavanti, profonda "spessore" verso -z
function solido(shape, zDavanti, spessore, smusso) {
    const g = new THREE.ExtrudeGeometry(shape, {
        depth: spessore, curveSegments: 64, bevelEnabled: !!smusso,
        bevelThickness: smusso || 0, bevelSize: smusso || 0, bevelSegments: 3
    });
    g.translate(0, 0, zDavanti - spessore);
    return g;
}
function cubo(x, y, z, lx, ly, lz) {
    const g = new THREE.BoxGeometry(lx, ly, lz);
    g.translate(x, y, z);
    return g;
}
function tubo(punti, raggio) {
    const curva = new THREE.CatmullRomCurve3(punti.map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); }));
    return new THREE.TubeGeometry(curva, 64, raggio, 12, false);
}

// un'asta in acetato: una striscia vista di lato che va indietro e alla fine scende
// x = dove sta, y = altezza, zInizio = la cerniera, alta h all'inizio e h2 alla fine, spessa s
function astaPiena(x, y, zInizio, h, h2, s) {
    const fineDritta = 0.165, fine = 0.205, caduta = 0.03;
    const sopra = [], sotto = [];
    const N = 50;
    function centro(u) {
        return u < fineDritta ? y : y - caduta * Math.pow((u - fineDritta) / (fine - fineDritta), 2);
    }
    for (let i = 0; i <= N; i++) {
        const t = i / N;
        const u = mix(-zInizio, fine, t);
        const v = centro(u);
        const du = 0.001, dv = centro(u + du) - centro(u - du);
        let nx = -dv, ny = 2 * du;
        const l = Math.hypot(nx, ny);
        nx /= l; ny /= l;
        const meta = mix(h, h2, t) / 2;
        sopra.push(new THREE.Vector2(u + nx * meta, v + ny * meta));
        sotto.push(new THREE.Vector2(u - nx * meta, v - ny * meta));
    }
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(sopra.concat(sotto.reverse())), {
        depth: s, curveSegments: 12, bevelEnabled: true, bevelThickness: 0.0006, bevelSize: 0.0006, bevelSegments: 2
    });
    g.rotateY(Math.PI / 2);          // la forma laterale diventa: avanti/indietro lungo z, spessore lungo x
    g.translate(x - s / 2, 0, 0);
    return g;
}

function unisci(geometrie, materiale) {
    const gruppo = new THREE.Group();
    geometrie.forEach(function (g) { gruppo.add(new THREE.Mesh(g, materiale)); });
    return gruppo;
}

// mette insieme un tipo: pezzi, perni e frecce (le parti 4, 6 vanno sul perno destro, 5, 7 sul sinistro)
function montaTipo(parti, xPerno, zPerno, etichette) {
    const radice = new THREE.Group();
    const perniTipo = { destra: new THREE.Group(), sinistra: new THREE.Group() };
    perniTipo.destra.position.set(xPerno, 0, zPerno);
    perniTipo.sinistra.position.set(-xPerno, 0, zPerno);
    radice.add(perniTipo.destra, perniTipo.sinistra);
    const spostamenti = [
        [0, 0, 0], [0, 0, 0.05],
        [0.02, 0, 0.006], [-0.02, 0, 0.006],
        [0.036, 0.02, -0.01], [-0.036, 0.02, -0.01],
        [0.07, 0, -0.035], [-0.07, 0, -0.035]
    ];
    const pezziTipo = parti.map(function (parte, i) {
        let genitore = radice;
        if (i === 4 || i === 6) genitore = perniTipo.destra;
        if (i === 5 || i === 7) genitore = perniTipo.sinistra;
        genitore.add(parte);
        if (genitore !== radice) parte.position.sub(genitore.position);
        parte.traverse(function (o) { if (o.isMesh) o.renderOrder = (i === 1) ? 2 : 1; });
        return { oggetto: parte, partenza: parte.position.clone(), spostamento: new THREE.Vector3().fromArray(spostamenti[i]) };
    });
    // le frecce: stessi lati (in pixel) di quelle dell'occhiale di Giulia
    const lati = ETICHETTE.map(function (e) { return [e.lato, e.telefono]; });
    etichette.forEach(function (e, i) {
        e.locale = new THREE.Vector3().fromArray(e.punto);
        e.lato = lati[i][0];
        e.telefono = lati[i][1];
    });
    return { radice: radice, pezzi: pezziTipo, perni: perniTipo, etichette: etichette };
}

// ===== Classico: montatura squadrata in acetato pieno =====
function costruisciClassico() {
    const formaLente = function (a) {
        const c = Math.cos(a), s = Math.sin(a);
        // un quadrato morbido, più largo in alto
        let x = 0.026 * Math.sign(c) * Math.pow(Math.abs(c), 0.55);
        let y = 0.019 * Math.sign(s) * Math.pow(Math.abs(s), 0.55);
        x *= 1 + 0.1 * (y / 0.019);
        if (y > 0) y += 0.004 * Math.max(0, x / 0.026);   // l'angolo esterno sale un po'
        return [x, y];
    };
    const lenteD = contornoLente(0.034, Y0, formaLente);
    const lenteS = specchia(lenteD);
    const bordoD = allarga(lenteD, 0.0055, 0.009);
    const bordoS = specchia(bordoD);

    const montatura = unisci([
        solido(forma(bordoD, lenteD), -0.032, 0.006, 0.0008),
        solido(forma(bordoS, lenteS), -0.032, 0.006, 0.0008),
        cubo(0, Y0 + 0.012, -0.035, 0.016, 0.009, 0.006),            // il ponte
        cubo(0.066, Y0 + 0.011, -0.040, 0.012, 0.012, 0.010),        // i lati che portano alle cerniere
        cubo(-0.066, Y0 + 0.011, -0.040, 0.012, 0.012, 0.010)
    ], materialeAste);
    const lenti = unisci([
        solido(forma(allarga(lenteD, 0.0012)), -0.0345, 0.0018),
        solido(forma(allarga(lenteS, 0.0012)), -0.0345, 0.0018)
    ], materialeLente);
    const y = Y0 + 0.011;
    return montaTipo([
        montatura, lenti,
        unisci([cubo(0.0685, y, -0.0455, 0.005, 0.007, 0.004)], materialeMetallo),
        unisci([cubo(-0.0685, y, -0.0455, 0.005, 0.007, 0.004)], materialeMetallo),
        unisci([cubo(0.0685, y, -0.050, 0.005, 0.006, 0.006)], materialeMetallo),
        unisci([cubo(-0.0685, y, -0.050, 0.005, 0.006, 0.006)], materialeMetallo),
        unisci([astaPiena(0.0685, y, -0.046, 0.011, 0.006, 0.005)], materialeAste),
        unisci([astaPiena(-0.0685, y, -0.046, 0.011, 0.006, 0.005)], materialeAste)
    ], 0.0685, -0.046, [
        { pezzo: 1, punto: [-0.034, Y0 - 0.004, -0.034], nome: 'Lenti', desc: 'Squadrate, più larghe in alto' },
        { pezzo: 0, punto: [0, Y0 + 0.008, -0.032], nome: 'Ponte', desc: 'Pieno, in acetato' },
        { pezzo: 2, punto: [0.0685, y, -0.0455], nome: 'Cerniera', desc: 'Nascosta nel frontale' },
        { pezzo: 4, punto: [0.0685, y, -0.050], nome: 'Snodo', desc: 'Lascia ruotare l’asta' },
        { pezzo: 6, punto: [0.0715, y, -0.12], nome: 'Asta', desc: 'Larga, si assottiglia' },
        { pezzo: 6, punto: [0.0715, y - 0.024, -0.199], nome: 'Terminale', desc: 'La curva dietro l’orecchio' }
    ]);
}

// un piccolo cilindro di metallo (le cerniere): verticale, oppure lungo z se "lungoZ"
function cilindro(x, y, z, r, h, lungoZ) {
    const g = new THREE.CylinderGeometry(r, r, h, 20);
    if (lungoZ) g.rotateX(Math.PI / 2);
    g.translate(x, y, z);
    return g;
}

// ===== Farfalla: occhi di gatto in acetato, con l'ala che sale agli angoli =====
function costruisciFarfalla() {
    // il contorno esterno dell'occhio destro, disegnato con curve (misure rispetto al centro della lente):
    // il bordo in alto sale in diagonale fino alla punta esterna, sotto è morbido
    function contornoGatto(cx, cy) {
        const p = new THREE.Shape();
        p.moveTo(cx - 0.024, cy + 0.012);
        p.bezierCurveTo(cx - 0.005, cy + 0.016, cx + 0.018, cy + 0.0165, cx + 0.031, cy + 0.0215);   // sopra, fino alla punta
        p.bezierCurveTo(cx + 0.0335, cy + 0.0155, cx + 0.032, cy + 0.002, cx + 0.025, cy - 0.010);   // il lato esterno
        p.bezierCurveTo(cx + 0.018, cy - 0.0205, cx + 0.002, cy - 0.021, cx - 0.012, cy - 0.019);    // sotto
        p.bezierCurveTo(cx - 0.024, cy - 0.0165, cx - 0.0265, cy + 0.003, cx - 0.024, cy + 0.012);  // il lato del naso
        const punti = p.getSpacedPoints(220);
        punti.pop();
        return punti;
    }
    const cx = 0.035;
    const bordoD = contornoGatto(cx, Y0);
    // la lente: lo stesso disegno rimpicciolito verso il basso-interno, così il bordo è più spesso verso l'ala
    const lenteD = bordoD.map(function (q) {
        return new THREE.Vector2(cx - 0.0015 + (q.x - cx) * 0.87, Y0 - 0.0015 + (q.y - Y0) * 0.8);
    });
    const lenteS = specchia(lenteD);
    const bordoS = specchia(bordoD);
    const z = -0.032;
    const ponte = new THREE.Shape();
    ponte.moveTo(-0.0125, Y0 + 0.006);
    ponte.quadraticCurveTo(0, Y0 + 0.0115, 0.0125, Y0 + 0.006);
    ponte.lineTo(0.0125, Y0 + 0.0135);
    ponte.quadraticCurveTo(0, Y0 + 0.0155, -0.0125, Y0 + 0.0135);
    ponte.closePath();
    const y = Y0 + 0.012;
    const montatura = unisci([
        solido(forma(bordoD, lenteD), z, 0.0048, 0.0008),
        solido(forma(bordoS, lenteS), z, 0.0048, 0.0008),
        solido(ponte, z, 0.0048, 0.0008),
        cubo(0.0655, y, -0.039, 0.007, 0.010, 0.009),
        cubo(-0.0655, y, -0.039, 0.007, 0.010, 0.009)
    ], materialeAste);
    const lenti = unisci([
        solido(forma(allarga(lenteD, 0.001)), z - 0.0018, 0.0016),
        solido(forma(allarga(lenteS, 0.001)), z - 0.0018, 0.0016)
    ], materialeLente);
    return montaTipo([
        montatura, lenti,
        unisci([cilindro(0.0675, y, -0.0445, 0.0017, 0.007)], materialeMetallo),
        unisci([cilindro(-0.0675, y, -0.0445, 0.0017, 0.007)], materialeMetallo),
        unisci([cubo(0.0675, y, -0.050, 0.0025, 0.005, 0.007)], materialeMetallo),
        unisci([cubo(-0.0675, y, -0.050, 0.0025, 0.005, 0.007)], materialeMetallo),
        unisci([astaPiena(0.0675, y, -0.046, 0.0095, 0.0055, 0.0045)], materialeAste),
        unisci([astaPiena(-0.0675, y, -0.046, 0.0095, 0.0055, 0.0045)], materialeAste)
    ], 0.0675, -0.046, [
        { pezzo: 1, punto: [-0.035, Y0 - 0.003, z - 0.0018], nome: 'Lenti', desc: 'Ovali, salgono verso l’esterno' },
        { pezzo: 0, punto: [0, Y0 + 0.011, z], nome: 'Ponte', desc: 'Un arco pieno in acetato' },
        { pezzo: 2, punto: [0.0675, y, -0.0445], nome: 'Cerniera', desc: 'Un piccolo perno di metallo' },
        { pezzo: 4, punto: [0.0675, y, -0.050], nome: 'Snodo', desc: 'Lascia ruotare l’asta' },
        { pezzo: 6, punto: [0.07, y, -0.12], nome: 'Asta', desc: 'Si assottiglia verso l’orecchio' },
        { pezzo: 6, punto: [0.07, y - 0.024, -0.199], nome: 'Terminale', desc: 'La curva dietro l’orecchio' }
    ]);
}

// ===== Senza montatura: solo le lenti, unite da un filo di metallo =====
function costruisciSenzaMontatura() {
    // un rettangolo dagli angoli molto morbidi, appena più largo in alto
    const formaLente = function (a) {
        const c = Math.cos(a), s = Math.sin(a);
        let x = 0.026 * Math.sign(c) * Math.pow(Math.abs(c), 0.5);
        let y = 0.0175 * Math.sign(s) * Math.pow(Math.abs(s), 0.6);
        x *= 1 + 0.06 * (y / 0.0175);
        return [x, y];
    };
    const lenteD = contornoLente(0.036, Y0, formaLente);
    const lenteS = specchia(lenteD);
    const z = -0.033;
    const y = Y0 + 0.010;
    // le lenti sono più spesse, con il bordo lucido smussato: sono loro la forma dell'occhiale
    const lenti = unisci([
        solido(forma(lenteD), z, 0.0024, 0.0008),
        solido(forma(lenteS), z, 0.0024, 0.0008)
    ], materialeLente);
    // i naselli trasparenti
    [0.0125, -0.0125].forEach(function (x) {
        const g = new THREE.SphereGeometry(1, 16, 12);
        g.scale(0.0026, 0.0048, 0.0014);
        g.translate(x, Y0 - 0.006, z - 0.008);
        lenti.add(new THREE.Mesh(g, materialeLente));
    });
    const zm = z - 0.0035;   // il metallo sta appena dietro le lenti
    const montatura = unisci([
        // il ponte: un filo sottile ad arco
        tubo([[-0.0105, y, zm], [-0.005, y + 0.0035, zm], [0.005, y + 0.0035, zm], [0.0105, y, zm]], 0.0009),
        // le viti che tengono le lenti
        cilindro(0.0105, y, zm + 0.002, 0.0014, 0.004, true),
        cilindro(-0.0105, y, zm + 0.002, 0.0014, 0.004, true),
        cilindro(0.0605, y, zm + 0.002, 0.0014, 0.004, true),
        cilindro(-0.0605, y, zm + 0.002, 0.0014, 0.004, true),
        // i bracci dei naselli
        tubo([[0.0105, y, zm], [0.012, Y0 - 0.002, zm - 0.004], [0.0125, Y0 - 0.005, z - 0.008]], 0.0005),
        tubo([[-0.0105, y, zm], [-0.012, Y0 - 0.002, zm - 0.004], [-0.0125, Y0 - 0.005, z - 0.008]], 0.0005),
        // dal bordo della lente alla cerniera
        tubo([[0.0605, y, zm], [0.065, y, zm - 0.002], [0.067, y, -0.0425]], 0.0009),
        tubo([[-0.0605, y, zm], [-0.065, y, zm - 0.002], [-0.067, y, -0.0425]], 0.0009)
    ], materialeMetallo);
    function asta(x) {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(tubo([[x, y, -0.046], [x, y, -0.10], [x, y - 0.001, -0.152]], 0.0009), materialeMetallo));
        g.add(new THREE.Mesh(tubo([[x, y - 0.001, -0.150], [x, y - 0.003, -0.172], [x, y - 0.015, -0.192], [x, y - 0.029, -0.203]], 0.0019), materialeAste));
        return g;
    }
    return montaTipo([
        montatura, lenti,
        unisci([cilindro(0.067, y, -0.0435, 0.0015, 0.005)], materialeMetallo),
        unisci([cilindro(-0.067, y, -0.0435, 0.0015, 0.005)], materialeMetallo),
        unisci([cubo(0.067, y, -0.0475, 0.002, 0.0035, 0.004)], materialeMetallo),
        unisci([cubo(-0.067, y, -0.0475, 0.002, 0.0035, 0.004)], materialeMetallo),
        asta(0.067), asta(-0.067)
    ], 0.067, -0.045, [
        { pezzo: 1, punto: [-0.036, Y0 - 0.003, z], nome: 'Lenti libere', desc: 'Nessun bordo, solo il colore' },
        { pezzo: 0, punto: [0, y + 0.0035, zm], nome: 'Ponte', desc: 'Un filo di metallo' },
        { pezzo: 2, punto: [0.067, y, -0.0435], nome: 'Cerniera', desc: 'Un piccolo perno' },
        { pezzo: 4, punto: [0.067, y, -0.0475], nome: 'Snodo', desc: 'Lascia ruotare l’asta' },
        { pezzo: 6, punto: [0.067, y, -0.11], nome: 'Asta', desc: 'Sottile, in metallo' },
        { pezzo: 6, punto: [0.067, y - 0.016, -0.192], nome: 'Terminale', desc: 'In acetato, morbido sull’orecchio' }
    ]);
}

// carica il modello: dal file .glb se la pagina è su un server (Live Server),
// altrimenti (doppio clic, file://) dalla copia del modello dentro js/modello-occhiali.js
function caricaModello(seCaricato, seErrore) {
    const loader = new GLTFLoader();
    if (location.protocol !== 'file:') {
        loader.load('models/giuliacamasso.glb', seCaricato, undefined, seErrore);
        return;
    }
    const script = document.createElement('script');
    script.src = 'js/modello-occhiali.js';
    script.onload = function () {
        const binario = Uint8Array.from(atob(window.MODELLO_OCCHIALI), function (c) { return c.charCodeAt(0); });
        loader.parse(binario.buffer, '', seCaricato, seErrore);
    };
    script.onerror = seErrore;
    document.head.appendChild(script);
}

caricaModello(function (gltf) {
    const parti = gltf.scene.children.slice();

    parti.forEach(function (parte, i) {
        const materiale = i <= 1 ? materialeLente : (i === 6 || i === 7) ? materialeAste : materialeMetallo;
        parte.traverse(function (o) {
            if (o.isMesh) {
                o.material = materiale;
                o.renderOrder = i <= 1 ? 2 : 1;
            }
        });

        // le parti delle aste vengono "appese" al loro perno, così ruotano intorno alla cerniera
        let genitore = radiceGiulia;
        if (PARTI_ASTA_DESTRA.includes(i)) genitore = perni.destra;
        if (PARTI_ASTA_SINISTRA.includes(i)) genitore = perni.sinistra;
        genitore.add(parte);
        if (genitore !== radiceGiulia) parte.position.sub(genitore.position);

        pezzi[i] = {
            oggetto: parte,
            partenza: parte.position.clone(),
            spostamento: new THREE.Vector3().fromArray(SPOSTAMENTI[i] || [0, 0, 0])
        };
    });

    // centro il modello e lo porto a una larghezza di 2
    const scatola = new THREE.Box3().setFromObject(modello);
    const centro = scatola.getCenter(new THREE.Vector3());
    const dimensioni = scatola.getSize(new THREE.Vector3());
    modello.position.copy(centro).multiplyScalar(-1);
    gruppo.userData.scalaBase = 2 / dimensioni.x;

    // i punti dove arrivano le frecce
    ETICHETTE.forEach(function (e) {
        const oggetto = pezzi[e.pezzo].oggetto;
        if (e.punto === 'centro') {
            const s = new THREE.Box3();
            oggetto.traverse(function (o) {
                if (o.isMesh) { o.geometry.computeBoundingBox(); s.union(o.geometry.boundingBox); }
            });
            e.locale = s.getCenter(new THREE.Vector3());
        } else if (e.punto) {
            e.locale = new THREE.Vector3().fromArray(e.punto);
        } else {
            e.locale = puntoSuperficie(oggetto, e.cerca[0], e.cerca[1]);
        }
    });

    // per le varianti: tengo da parte la forma originale di ogni pezzo e dei punti delle frecce
    const giaViste = new Set();
    modello.traverse(function (o) {
        if (!o.isMesh || giaViste.has(o.geometry)) return;
        giaViste.add(o.geometry);
        geometrieOriginali.push({
            geometria: o.geometry,
            posizioni: o.geometry.attributes.position.array.slice(),
            normali: o.geometry.attributes.normal ? o.geometry.attributes.normal.array.slice() : null
        });
    });
    ETICHETTE.forEach(function (e) { e.originale = e.locale.clone(); });

    // gli altri tipi di occhiale, nelle stesse misure del modello di Giulia
    TIPI.classico = costruisciClassico();
    TIPI.farfalla = costruisciFarfalla();
    TIPI.senzamontatura = costruisciSenzaMontatura();
    ['classico', 'farfalla', 'senzamontatura'].forEach(function (nome) {
        TIPI[nome].radice.visible = false;
        modello.add(TIPI[nome].radice);
    });

    modelloPronto = true;
    // se il modello arriva dopo la fine dell'apertura, l'ingresso parte adesso
    if (aperturaFinita) inizioIngresso = performance.now();
    provaAFinireApertura();
}, function (errore) {
    // il modello non si carica: la pagina deve comunque funzionare e scorrere
    console.error('Non riesco a caricare gli occhiali:', errore);
    provaAFinireApertura(true);
});

// =====================================================================
// apertura: logo, poi gli occhiali arrivano girando e aprendo le aste
// =====================================================================
const apertura = document.getElementById('apertura');
const inizioPagina = performance.now();
const DURATA_LOGO = movimentoRidotto ? 300 : 2700;
let aperturaFinita = false;
let inizioIngresso = null;

const ATTESA_MASSIMA = 6000;   // oltre questo tempo l'apertura finisce anche se il modello non è pronto

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
// la pagina resta ferma solo durante il logo (lo blocca JavaScript, così se qualcosa
// non funziona lo scroll non resta mai bloccato)
document.body.classList.add('in-apertura');

function provaAFinireApertura(forza) {
    if (aperturaFinita) return;
    if (!modelloPronto && !forza) return;
    const attesa = DURATA_LOGO - (performance.now() - inizioPagina);
    if (attesa > 0) { setTimeout(function () { provaAFinireApertura(forza); }, attesa); return; }
    aperturaFinita = true;
    apertura.classList.add('via');
    document.body.classList.remove('in-apertura');
    inizioIngresso = performance.now() + 250;
    setTimeout(avviaFrasi, 1800);
}
setTimeout(provaAFinireApertura, DURATA_LOGO);
setTimeout(function () { provaAFinireApertura(true); }, ATTESA_MASSIMA);

// ===== le frasi =====
const FRASI = [
    'Una sola lente, avvolgente come uno sguardo.',
    'Rosa cipria, per guardare il mondo con più dolcezza.',
    'Leggeri come un pensiero, decisi come una firma.',
    'Si aprono, si chiudono, ti accompagnano.',
    'Disegnati da Giulia Camasso.'
];
const frase = document.getElementById('frase');
let indiceFrase = 0;
frase.classList.add('nascosta');

function avviaFrasi() {
    frase.classList.remove('nascosta');
    setInterval(function () {
        frase.classList.add('nascosta');
        setTimeout(function () {
            indiceFrase = (indiceFrase + 1) % FRASI.length;
            frase.textContent = FRASI[indiceFrase];
            frase.classList.remove('nascosta');
        }, 900);
    }, 4200);
}

// =====================================================================
// scroll: dove siamo nella pagina
// =====================================================================
const sezioneMovimento = document.getElementById('movimento');
const sezioneAnatomia = document.getElementById('anatomia');
const sezioneColori = document.getElementById('colori');

// la direzione dello scroll: +1 verso il basso, -1 verso l'alto (aggiornata a ogni fotogramma)
let direzione = 1;
let ultimoScroll = window.scrollY;
function aggiornaDirezione() {
    const y = window.scrollY;
    if (Math.abs(y - ultimoScroll) > 0.5) {
        direzione = y > ultimoScroll ? 1 : -1;
        ultimoScroll = y;
    }
}

// 0 → 1 mentre la sezione è "ferma" sullo schermo
function progressoSezione(sezione) {
    const corsa = sezione.offsetHeight - window.innerHeight;
    return limita((window.scrollY - sezione.offsetTop) / corsa);
}

// 0 → 1 nel tratto tra due punti di scroll
function tratto(da, a) {
    return morbido((window.scrollY - da) / (a - da));
}

// =====================================================================
// gli stati: posizione, rotazione, quanto sono chiuse le aste, quanto è esploso
// =====================================================================
function telefono() { return window.innerWidth < 760; }

function statoApertura(t) {
    return {
        x: 0, y: telefono() ? 0.3 : 0.15,
        rx: 0.28, ry: -0.55 + Math.sin(t * 0.0005) * 0.3,
        scala: telefono() ? 0.78 : 0.95,
        chiusura: 0, esploso: 0
    };
}

function statoMovimento(p) {
    return {
        // visti dall'alto, così si vede bene la piega delle aste
        x: telefono() ? 0 : 0.85, y: telefono() ? 0.75 : 0.05,
        rx: 1.05, ry: -0.35 + p * 0.2,
        scala: telefono() ? 0.95 : 0.85,
        chiusura: morbido((p - 0.08) / 0.8),
        esploso: 0
    };
}

function statoAnatomia(p) {
    return {
        x: telefono() ? 0 : -0.2, y: telefono() ? -0.1 : -0.15,
        rx: telefono() ? 0.75 : 0.42, ry: (telefono() ? -0.25 : -0.7) + morbido(p) * 0.15,
        scala: telefono() ? 0.62 : 0.78,
        chiusura: 0,
        esploso: morbido((p - 0.04) / 0.5)
    };
}

// i colori: gli occhiali a sinistra (sul telefono in alto), si girano trascinando
let giroUtente = 0;
function statoColori(t) {
    return {
        // sul telefono: in alto, sopra i bottoni dei modelli
        x: telefono() ? 0 : -0.95,
        y: telefono() ? camera.position.z * Math.tan(gradi(15)) * 0.62 : 0.0,
        rx: 0.24, ry: -0.55 + giroUtente + Math.sin(t * 0.0004) * 0.12,
        scala: telefono() ? 0.72 : 0.9,
        chiusura: 0, esploso: 0
    };
}

function mescola(a, b, t) {
    const r = {};
    for (const k in a) r[k] = mix(a[k], b[k], t);
    return r;
}

// lo stato voluto in questo momento dello scroll
function statoVoluto(ora) {
    const vh = window.innerHeight;
    const mTop = sezioneMovimento.offsetTop;
    const mFine = mTop + sezioneMovimento.offsetHeight - vh;
    const aTop = sezioneAnatomia.offsetTop;
    const aFine = aTop + sezioneAnatomia.offsetHeight - vh;
    const y = window.scrollY;

    if (y < mTop) return mescola(statoApertura(ora), statoMovimento(0), tratto(0, mTop));
    if (y < mFine) return statoMovimento(progressoSezione(sezioneMovimento));
    if (y < aTop) return mescola(statoMovimento(1), statoAnatomia(0), tratto(mFine, aTop));
    if (y < aFine) return statoAnatomia(progressoSezione(sezioneAnatomia));
    const cTop = sezioneColori.offsetTop;
    if (y < cTop) return mescola(statoAnatomia(1), statoColori(ora), tratto(aFine, cTop));
    return statoColori(ora);
}

// =====================================================================
// la sezione "movimento": scritte e misura
// =====================================================================
const statiTesto = document.querySelectorAll('.stato');
const angoloTesto = document.getElementById('angolo');
const condizioneTesto = document.getElementById('condizione');
const misuraRiempimento = document.getElementById('misura-riempimento');
let ultimoStatoTesto = '';

function aggiornaTestoMovimento(chiusura) {
    // scorri in giù → "si chiude", scorri in su → "si apre"
    const attivo = direzione > 0 ? 'chiude' : 'apre';
    if (attivo !== ultimoStatoTesto) {
        statiTesto.forEach(function (s) { s.classList.toggle('attivo', s.dataset.stato === attivo); });
        ultimoStatoTesto = attivo;
    }
    angoloTesto.textContent = Math.round(chiusura * 88) + '°';
    condizioneTesto.textContent = chiusura < 0.01 ? 'aperti' : chiusura > 0.99 ? 'chiusi' : (direzione > 0 ? 'si stanno chiudendo' : 'si stanno aprendo');
    misuraRiempimento.style.transform = 'scaleX(' + chiusura.toFixed(3) + ')';
}

// =====================================================================
// la sezione "colori": campioni e trascinamento
// =====================================================================
const materialiPerParte = { lente: materialeLente, aste: materialeAste, metallo: materialeMetallo };
// i colori verso cui i materiali sfumano piano
const coloriVoluti = {
    lente: materialeLente.color.clone(),
    aste: materialeAste.color.clone(),
    metallo: materialeMetallo.color.clone()
};

document.querySelectorAll('.gruppo').forEach(function (gruppo) {
    const parte = gruppo.dataset.parte;
    const valore = gruppo.querySelector('.gruppo-valore');
    const campioni = gruppo.querySelectorAll('.campione');
    campioni.forEach(function (campione) {
        const colore = campione.dataset.mostra || campione.dataset.colore;
        // il bottone mostra il colore (le cerniere con un riflesso metallico)
        campione.style.background = campione.classList.contains('campione-metallo')
            ? 'linear-gradient(135deg, #fff 0%, ' + colore + ' 45%, ' + colore + ' 70%, rgba(0,0,0,.25) 100%)'
            : colore;
        campione.setAttribute('aria-label', gruppo.querySelector('.gruppo-nome').textContent + ': ' + campione.dataset.nome);
        campione.title = campione.dataset.nome;
        campione.addEventListener('click', function () {
            coloriVoluti[parte].set(campione.dataset.colore);
            valore.textContent = campione.dataset.nome;
            campioni.forEach(function (c) { c.setAttribute('aria-pressed', c === campione ? 'true' : 'false'); });
        });
    });
});

// i bottoni dei modelli: le varianti dell'occhiale di Giulia e gli altri tipi
const bottoniModello = document.querySelectorAll('.modello');
bottoniModello.forEach(function (bottone) {
    bottone.addEventListener('click', function () {
        if (bottone.dataset.variante) {
            scegliTipo('giulia');
            scegliVariante(bottone.dataset.variante);
        } else {
            scegliTipo(bottone.dataset.tipo);
        }
        bottoniModello.forEach(function (b) { b.setAttribute('aria-pressed', b === bottone ? 'true' : 'false'); });
    });
});

// cambiare tipo di occhiale
const cambioTipo = { verso: 'giulia', inizio: 0, durata: 900, attivo: false };

function scegliTipo(nome) {
    if (!modelloPronto || !TIPI[nome]) return;
    if (nome === cambioTipo.verso && (cambioTipo.attivo || attivo === TIPI[nome])) return;
    cambioTipo.verso = nome;
    cambioTipo.inizio = performance.now();
    cambioTipo.attivo = true;
}

// mostra un tipo e nasconde gli altri; aggiorna i nomi delle frecce
function mostraTipo(nome) {
    attivo = TIPI[nome];
    for (const n in TIPI) TIPI[n].radice.visible = (TIPI[n] === attivo);
    ETICHETTE.forEach(function (casella, i) {
        casella.div.querySelector('.etichetta-nome').textContent = attivo.etichette[i].nome;
        casella.div.querySelector('.etichetta-desc').textContent = attivo.etichette[i].desc;
    });
}

// ripristina: clicco il primo campione di ogni gruppo (sono i colori originali)
document.getElementById('ripristina').addEventListener('click', function () {
    document.querySelectorAll('.gruppo').forEach(function (gruppo) {
        gruppo.querySelector('.campione').click();
    });
    giroUtente = 0;
    bottoniModello[0].click();
});

function aggiornaColori(k) {
    for (const parte in coloriVoluti) materialiPerParte[parte].color.lerp(coloriVoluti[parte], k);
    // sulle aste scure il velo rosato si spegne
    const l = coloriVoluti.aste.r * 0.3 + coloriVoluti.aste.g * 0.59 + coloriVoluti.aste.b * 0.11;
    materialeAste.sheen += ((l > 0.5 ? 0.4 : 0.08) - materialeAste.sheen) * k;
}

// trascinando in orizzontale sull'area degli occhiali, li giro
const areaGiro = document.getElementById('area-giro');
let trascinoDa = null;
areaGiro.addEventListener('pointerdown', function (e) {
    trascinoDa = e.clientX;
    areaGiro.setPointerCapture(e.pointerId);
    areaGiro.classList.add('trascino');
});
areaGiro.addEventListener('pointermove', function (e) {
    if (trascinoDa === null) return;
    giroUtente += (e.clientX - trascinoDa) * 0.01;
    trascinoDa = e.clientX;
});
function fineTrascino() { trascinoDa = null; areaGiro.classList.remove('trascino'); }
areaGiro.addEventListener('pointerup', fineTrascino);
areaGiro.addEventListener('pointercancel', fineTrascino);

// =====================================================================
// le frecce dello spaccato
// =====================================================================
const contenitoreEtichette = document.getElementById('etichette');
const svgLinee = document.getElementById('etichette-linee');
const SVG = 'http://www.w3.org/2000/svg';

ETICHETTE.forEach(function (e, i) {
    const g = document.createElementNS(SVG, 'g');
    g.setAttribute('class', 'freccia');
    g.style.transitionDelay = (i * 0.12) + 's';
    const linea = document.createElementNS(SVG, 'line');
    linea.setAttribute('pathLength', '1');
    linea.setAttribute('marker-end', 'url(#punta)');
    linea.style.transitionDelay = (i * 0.12) + 's';
    g.appendChild(linea);
    svgLinee.appendChild(g);

    const div = document.createElement('div');
    div.className = 'etichetta';
    div.style.transitionDelay = (0.25 + i * 0.12) + 's';
    div.innerHTML =
        '<span class="etichetta-num">0' + (i + 1) + '</span>' +
        '<span class="etichetta-nome">' + e.nome + '</span>' +
        '<span class="etichetta-desc">' + e.desc + '</span>';
    contenitoreEtichette.appendChild(div);

    e.gruppoSvg = g;
    e.linea = linea;
    e.div = div;
});

const vettore = new THREE.Vector3();
let etichetteVisibili = false;

function aggiornaEtichette(mostra) {
    if (mostra !== etichetteVisibili) {
        etichetteVisibili = mostra;
        ETICHETTE.forEach(function (e) {
            e.gruppoSvg.classList.toggle('mostra', mostra);
            e.div.classList.toggle('mostra', mostra);
        });
    }
    if (!mostra || !modelloPronto) return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    ETICHETTE.forEach(function (casella, i) {
        const e = attivo.etichette[i];
        vettore.copy(e.locale);
        attivo.pezzi[e.pezzo].oggetto.localToWorld(vettore);
        vettore.project(camera);
        const px = (vettore.x + 1) / 2 * w;
        const py = (1 - vettore.y) / 2 * h;

        const lato = telefono() ? e.telefono : e.lato;
        const sinistra = lato[0] < 0;
        // la scritta non deve uscire dallo schermo
        const larghezza = casella.div.offsetWidth + 10;
        let lx = px + lato[0];
        if (sinistra) lx = Math.max(lx, 16 + larghezza);
        else lx = Math.min(lx, w - 16 - larghezza);
        const ly = limita(py + lato[1], 70, h - 40);

        // la scritta: allineata a destra se sta a sinistra della freccia
        casella.div.style.transform = 'translate(' + lx + 'px,' + ly + 'px) translate(' +
            (sinistra ? 'calc(-100% - 10px)' : '10px') + ', -50%)';
        casella.div.style.textAlign = sinistra ? 'right' : 'left';

        // la freccia: dalla scritta al pezzo, fermandosi poco prima
        const dx = px - lx, dy = py - ly;
        const lunghezza = Math.hypot(dx, dy) || 1;
        casella.linea.setAttribute('x1', lx);
        casella.linea.setAttribute('y1', ly);
        casella.linea.setAttribute('x2', px - dx / lunghezza * 4);
        casella.linea.setAttribute('y2', py - dy / lunghezza * 4);
    });
}

// =====================================================================
// il ciclo di disegno
// =====================================================================
const attuale = statoApertura(0);   // lo stato mostrato, che insegue quello voluto con dolcezza
const testoSpaccato = document.getElementById('testo-spaccato');

let tempoPrecedente = performance.now();

renderer.setAnimationLoop(function () {
    // un solo orologio per tutto (lo stesso usato per l'apertura)
    const ora = performance.now();
    const trascorso = Math.min(ora - tempoPrecedente, 500);
    tempoPrecedente = ora;
    if (!modelloPronto) { renderer.render(scena, camera); return; }

    aggiornaDirezione();
    const voluto = statoVoluto(ora);
    // inseguimento morbido, uguale a qualsiasi frequenza dello schermo
    const inseguimento = movimentoRidotto ? 1 : 1 - Math.exp(-trascorso / 160);
    for (const k in attuale) attuale[k] += (voluto[k] - attuale[k]) * inseguimento;

    // l'ingresso dopo il logo: arrivano dal basso girando, con le aste che si aprono
    let ingresso = 1;
    if (inizioIngresso !== null && !movimentoRidotto) {
        ingresso = 1 - Math.pow(1 - limita((ora - inizioIngresso) / 2600), 3);
    } else if (inizioIngresso === null) {
        ingresso = 0;
    }

    // cambio di tipo: gli occhiali girano e si rimpiccioliscono, a metà giro cambiano modello
    let giroCambio = 0, scalaCambio = 1;
    if (cambioTipo.attivo) {
        const k = movimentoRidotto ? 1 : limita((ora - cambioTipo.inizio) / cambioTipo.durata);
        if (k >= 0.5 && attivo !== TIPI[cambioTipo.verso]) mostraTipo(cambioTipo.verso);
        giroCambio = morbido(k) * Math.PI * 2;
        scalaCambio = 1 - 0.8 * Math.sin(Math.PI * k);
        if (k >= 1) cambioTipo.attivo = false;
    }

    const scalaBase = gruppo.userData.scalaBase;
    gruppo.position.set(attuale.x, attuale.y - (1 - ingresso) * 0.9, 0);
    gruppo.rotation.set(attuale.rx + (1 - ingresso) * 0.5, attuale.ry - (1 - ingresso) * 3.2 + giroCambio, 0);
    gruppo.scale.setScalar(scalaBase * attuale.scala * (0.6 + 0.4 * ingresso) * scalaCambio);

    // le aste: la destra si chiude per prima, la sinistra si piega sopra
    const chiusura = Math.max(attuale.chiusura, 1 - ingresso);
    attivo.perni.destra.rotation.y = gradi(88) * morbido(chiusura / 0.6);
    attivo.perni.sinistra.rotation.y = gradi(-80) * morbido((chiusura - 0.4) / 0.6);

    // lo spaccato
    attivo.pezzi.forEach(function (pezzo) {
        pezzo.oggetto.position.copy(pezzo.partenza).addScaledVector(pezzo.spostamento, attuale.esploso);
    });

    aggiornaTestoMovimento(limita(voluto.chiusura));
    aggiornaColori(inseguimento);
    aggiornaVariante(ora);

    gruppo.updateMatrixWorld(true);
    const inAnatomia = window.scrollY > sezioneAnatomia.offsetTop - window.innerHeight * 0.3 &&
        window.scrollY < sezioneAnatomia.offsetTop + sezioneAnatomia.offsetHeight - window.innerHeight * 0.6;
    aggiornaEtichette(inAnatomia && attuale.esploso > 0.93);
    const nuovoTesto = attuale.esploso > 0.93
        ? 'Sei parti, un solo sguardo. Ogni freccia indica un pezzo dell’occhiale.'
        : 'Continua a scorrere: l’occhiale si apre in tutte le sue parti.';
    if (testoSpaccato.textContent !== nuovoTesto) testoSpaccato.textContent = nuovoTesto;

    renderer.render(scena, camera);
});

window.addEventListener('resize', function () {
    renderer.setSize(window.innerWidth, window.innerHeight);
    sistemaCamera();
});

})();
