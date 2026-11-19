// script.js – tutto il JavaScript della pagina
// (si carica con type="module" perché usa import per Three.js)

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ===== menu mobile =====
document.addEventListener('DOMContentLoaded', function() {
    const btnMenu = document.querySelector('.btn-menu');
    const btnClose = document.querySelector('.btn-close');
    const mobileNavWrapper = document.querySelector('.mobile-nav-wrapper');
    const navLinks = document.querySelectorAll('.mobile-nav-wrapper .nav-link');
    
    // Assicurati che il display sia flex prima di aggiungere show
    btnMenu.addEventListener('click', function() {
        mobileNavWrapper.style.display = 'flex';
        // Piccolo delay per permettere al display di attivarsi
        setTimeout(() => {
            mobileNavWrapper.classList.add('show');
        }, 10);
    });
    
    // Chiude il menu mobile
    function closeMenu() {
        mobileNavWrapper.classList.remove('show');
        // Rimuovi display dopo l'animazione
        setTimeout(() => {
            if (!mobileNavWrapper.classList.contains('show')) {
                mobileNavWrapper.style.display = 'none';
            }
        }, 300); // Stesso tempo della transizione CSS
    }
    
    btnClose.addEventListener('click', closeMenu);
    
    mobileNavWrapper.addEventListener('click', function(e) {
        let isLink = false;
        navLinks.forEach(function(link) {
            if (link.contains(e.target)) {
                isLink = true;
            }
        });
        
        if (!isLink) {
            closeMenu();
        }
    });
});

// ===== visualizzatore 3D =====

const visore = document.getElementById('visore');

// tolgo la scritta "qui andrà il 3D"
const segnaposto = visore.querySelector('.visore-segnaposto');
if (segnaposto) segnaposto.remove();

// la scena: il "palcoscenico" dove mettiamo gli oggetti
const scena = new THREE.Scene();
scena.background = new THREE.Color('#f3efe8');

// la camera: il punto di vista da cui guardiamo la scena
const camera = new THREE.PerspectiveCamera(45, visore.clientWidth / visore.clientHeight, 0.1, 100);
camera.position.set(3.5, 2.8, 4.5);

// il renderer: disegna la scena dentro un <canvas> che mettiamo nel visore
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(visore.clientWidth, visore.clientHeight);
renderer.shadowMap.enabled = true;                  // accendo le ombre
renderer.shadowMap.type = THREE.PCFSoftShadowMap;   // ombre con i bordi morbidi
renderer.localClippingEnabled = true;               // permette di "tagliare" il modello (vista Sezione)
visore.appendChild(renderer.domElement);

// ===== le luci =====
// la luce principale segue il tuo punto di vista (vedi la funzione anima):
// quando giri intorno all'oggetto, l'ombra a terra gira insieme a te

// 1. luce "cielo-pavimento": dall'alto arriva una luce chiara, dal basso una calda
//    che rimbalza dal pavimento. Così le parti in ombra non diventano mai nere
const luceAmbiente = new THREE.HemisphereLight(0xffffff, 0xe8dccb, 0.8);
scena.add(luceAmbiente);

// 2. luce principale: sta sempre in alto a destra rispetto a chi guarda,
//    è l'unica che proietta l'ombra
const lucePrincipale = new THREE.DirectionalLight(0xffffff, 2.2);
// dove sta la luce rispetto alla camera: 3 a destra, 4 in alto, 0 avanti/indietro
const posizioneLuce = new THREE.Vector3(3, 4, 0);
lucePrincipale.castShadow = true;
lucePrincipale.shadow.mapSize.set(2048, 2048);   // ombra più definita
lucePrincipale.shadow.camera.left = -4;          // la zona in cui si calcola l'ombra
lucePrincipale.shadow.camera.right = 4;
lucePrincipale.shadow.camera.top = 4;
lucePrincipale.shadow.camera.bottom = -4;
lucePrincipale.shadow.bias = -0.0005;            // evita strisce strane sulla superficie
lucePrincipale.shadow.normalBias = 0.02;
scena.add(lucePrincipale);

// 3. luce di riempimento: dal lato opposto, più debole, ammorbidisce il lato scuro
const luceRiempimento = new THREE.DirectionalLight(0xfff4e8, 0.6);
luceRiempimento.position.set(-5, 3, -2);
scena.add(luceRiempimento);

// 4. luce di contorno: da dietro, disegna un filo di luce sul bordo dell'oggetto
const luceContorno = new THREE.DirectionalLight(0xffffff, 0.8);
luceContorno.position.set(0, 4, -6);
scena.add(luceContorno);

// 5. l'ambiente riflesso: una "stanza" finta che l'oggetto riflette.
//    Serve soprattutto alla finitura lucida, che senza qualcosa da riflettere sembrerebbe opaca
const generatoreAmbiente = new THREE.PMREMGenerator(renderer);
scena.environment = generatoreAmbiente.fromScene(new RoomEnvironment(), 0.04).texture;
scena.environmentIntensity = 0.5;   // riflessi presenti ma non troppo forti

// il pavimento: invisibile, mostra soltanto l'ombra dell'oggetto
const pavimento = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.ShadowMaterial({ opacity: 0.18 })
);
pavimento.rotation.x = -Math.PI / 2;   // lo stendo in orizzontale
pavimento.receiveShadow = true;
scena.add(pavimento);

// i materiali: uno per ogni gruppo di parti, così ognuno ha il suo colore.
// MeshPhysicalMaterial è come Standard ma ha in più la "vernice trasparente" (clearcoat)
// che serve per la finitura lucida. Si parte opaco
function creaMateriale(colore) {
    return new THREE.MeshPhysicalMaterial({
        color: colore,
        roughness: 0.85,   // superficie ruvida: la luce si sparge, niente riflessi
        metalness: 0,
        clearcoat: 0,
        // per la finitura trasparente (all'inizio spenta):
        transparent: true,       // permette al materiale di essere trasparente
        opacity: 1,              // 1 = pieno, 0 = invisibile
        side: THREE.DoubleSide   // disegna anche le facce dietro: da trasparente si vede il retro
    });
}

// le 4 parti (i nomi corrispondono a data-parte nell'HTML)
const materiali = {
    grande:    creaMateriale('#E8DCC8'),   // paralume grande + attacco
    superiore: creaMateriale('#C6B39A'),   // paralume superiore
    inferiori: creaMateriale('#5C402F'),   // paralume medio + paralume inferiore
    anello:    creaMateriale('#A1947F'),   // anello riflettore
    bracci:    creaMateriale('#B08D57')    // bracci
};

// quale materiale va su quale pezzo del modello (nomi dentro ph5.glb)
const partiDelModello = {
    paralume_grande:    'grande',
    attacco:            'grande',
    paralume_superiore: 'superiore',
    paralume_medio:     'inferiori',
    paralume_inferiore: 'inferiori',
    anello_riflettore:  'anello',
    bracci:             'bracci'
};

// il modello: un contenitore vuoto in cui metto la lampada appena è caricata
const modello = new THREE.Group();
scena.add(modello);

// la grandezza "normale" del modello in scena: a 50 cm la parte più larga misura 1.8
const GRANDEZZA_BASE = 1.8;

// il taglio della vista Sezione: un piano verticale che passa per il centro
// e nasconde la metà della lampada verso chi guarda (z > 0).
// La lista parte vuota (niente taglio): la vista Sezione ci aggiunge il piano
const pianoTaglio = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
const pianiSezione = [];

// ===== la lampada PH5 (file models/ph5.glb) =====
const loader = new GLTFLoader();
loader.load('models/ph5.glb', function (gltf) {
    const lampada = gltf.scene;

    lampada.traverse(function (parte) {
        if (parte.isMesh) {
            parte.castShadow = true;      // proietta l'ombra sul pavimento
            parte.receiveShadow = true;   // riceve le ombre dalle altre parti
            // ogni parte prende il materiale del suo gruppo,
            // le altre (cavo, diffusore) restano come nel file
            const gruppo = partiDelModello[parte.name];
            if (gruppo) {
                parte.material = materiali[gruppo];
            }
            // tutte le parti si possono tagliare per la vista Sezione
            parte.material.clippingPlanes = pianiSezione;
            parte.material.side = THREE.DoubleSide;   // nel taglio si vede anche l'interno
        }
    });

    // la porto al centro e la ridimensiono alla grandezza base
    const scatola = new THREE.Box3().setFromObject(lampada);
    const dimensioni = scatola.getSize(new THREE.Vector3());
    const centro = scatola.getCenter(new THREE.Vector3());
    const fattore = GRANDEZZA_BASE / Math.max(dimensioni.x, dimensioni.z);
    lampada.position.sub(centro).multiplyScalar(fattore);
    lampada.scale.setScalar(fattore);

    modello.add(lampada);
    appoggiaAlPavimento();

    // la camera guarda il centro della lampada
    const altezza = new THREE.Box3().setFromObject(modello).getSize(new THREE.Vector3()).y;
    controlli.target.set(0, altezza / 2, 0);
});

// appoggia il modello sul pavimento: con misure diverse cambia l'altezza,
// quindi ogni volta calcolo dove sta il punto più basso e lo porto a y = 0
function appoggiaAlPavimento() {
    modello.position.y = 0;
    const scatola = new THREE.Box3().setFromObject(modello);
    if (scatola.isEmpty()) return;   // la lampada non è ancora caricata
    modello.position.y = -scatola.min.y;
}

// i controlli: trascinando col mouse giri intorno al modello, con la rotellina zoomi
const controlli = new OrbitControls(camera, renderer.domElement);
controlli.target.set(0, 0.8, 0);  // la camera guarda il centro dell'oggetto, non il pavimento
controlli.enableDamping = true;   // il movimento rallenta dolcemente quando lasci il mouse
controlli.enablePan = false;      // il modello resta sempre al centro
controlli.minDistance = 3;        // quanto ci si può avvicinare
controlli.maxDistance = 10;       // quanto ci si può allontanare
controlli.minPolarAngle = 0;         // si può guardare la lampada da sopra...
controlli.maxPolarAngle = Math.PI;   // ...e anche da sotto, girandole intorno del tutto

// ===== bottoni delle viste =====
// dove si mette la camera per ogni vista, rispetto al centro della lampada
// (lo 0.001 evita che la camera stia esattamente sopra/sotto, cosa che i controlli non gestiscono bene)
const posizioniViste = {
    prospettiva: new THREE.Vector3(3.5, 2, 4.5),
    frontale:    new THREE.Vector3(0, 0, 6),
    // leggermente obliqua e un po' da sotto, più vicina: si vedono i paralumi uno dentro l'altro,
    // l'interno, il diffusore, l'anello e i bracci
    dettaglio:   new THREE.Vector3(2.4, -1.1, 3.0),
    alto:        new THREE.Vector3(0, 6, 0.001),
    sotto:       new THREE.Vector3(0, -6, 0.001),
    sezione:     new THREE.Vector3(1.2, 0.6, 5.5)   // quasi di fronte, per vedere bene il taglio
};

// dove deve arrivare la camera (null = ferma, la muovi tu col mouse)
let destinazioneCamera = null;

// ===== la camera ortogonale (vista "Ortogonale obliqua") =====
// a differenza di quella prospettica non rimpicciolisce le cose lontane:
// le linee parallele restano parallele, come in un disegno tecnico (assonometria)
const MEZZA_ALTEZZA_ORTO = 1.6;   // metà dell'altezza inquadrata (la lampada a 70 cm ci sta)
const cameraOrto = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);

// adatta l'inquadratura ortogonale alla forma del visore
function aggiornaCameraOrto() {
    const proporzione = visore.clientWidth / visore.clientHeight;
    cameraOrto.left = -MEZZA_ALTEZZA_ORTO * proporzione;
    cameraOrto.right = MEZZA_ALTEZZA_ORTO * proporzione;
    cameraOrto.top = MEZZA_ALTEZZA_ORTO;
    cameraOrto.bottom = -MEZZA_ALTEZZA_ORTO;
    cameraOrto.updateProjectionMatrix();
}
aggiornaCameraOrto();

// la camera con cui si sta guardando adesso (all'inizio quella prospettica)
let cameraAttiva = camera;

// con la camera ortogonale la rotellina cambia lo zoom: questi sono i limiti
controlli.minZoom = 0.6;
controlli.maxZoom = 4;

// una luce morbida da sotto, accesa solo nelle viste da sotto:
// senza, la parte inferiore dei paralumi resterebbe in ombra
const luceSotto = new THREE.DirectionalLight(0xffffff, 1.2);
luceSotto.position.set(0, -6, 0);
luceSotto.visible = false;
scena.add(luceSotto);

const viste = document.querySelectorAll('#visore .vista');   // solo quelli della lampada

// ===== animazione: la camera gira in cerchio tra sopra e sotto =====
// il cerchio è verticale: sopra -> davanti -> sotto -> dietro -> sopra...
// a ogni passaggio sopra e sotto si ferma 3 secondi, poi continua nello stesso verso,
// quindi se scende da un lato risale dall'altro
const RAGGIO_GIRO = 6;           // distanza della camera dal centro della lampada
// i tempi si scelgono con i due slider sotto il 3D (Pausa e Movimento)
let durataMovimento = 5000;      // millisecondi per andare da una vista all'altra (sopra -> sotto o sotto -> sopra)
let durataPausa = 3000;          // millisecondi di pausa su ogni vista
// il cerchio non passa esattamente davanti ma un po' di lato (35°), così si vede la lampada di tre quarti
const direzioneGiro = new THREE.Vector3(Math.sin(THREE.MathUtils.degToRad(35)), 0, Math.cos(THREE.MathUtils.degToRad(35)));
const ASSE_Y = new THREE.Vector3(0, 1, 0);

const animazione = {
    attiva: false,
    fase: 'arrivo',      // 'arrivo' (va sopra), 'pausa' (ferma), 'giro' (si muove)
    inizioFase: 0,       // quando è cominciata la fase
    durataGiro: 5000,    // la durata del movimento in corso (fissata quando parte)
    angoloPartenza: 0    // 0 = sopra, PI = sotto
};

// la posizione sul cerchio per un certo angolo (0 = sopra, PI/2 = davanti, PI = sotto)
function puntoSulCerchio(angolo) {
    return controlli.target.clone()
        .addScaledVector(ASSE_Y, Math.cos(angolo) * RAGGIO_GIRO)
        .addScaledVector(direzioneGiro, Math.sin(angolo) * RAGGIO_GIRO + 0.001);
}

// mette la camera sul cerchio: il "sopra" dell'immagine segue il giro,
// così la camera passa sopra e sotto la lampada senza scatti
function cameraSulCerchio(angolo) {
    camera.position.copy(puntoSulCerchio(angolo));
    camera.up.copy(ASSE_Y).multiplyScalar(Math.sin(angolo))
        .addScaledVector(direzioneGiro, -Math.cos(angolo));
    camera.lookAt(controlli.target);
    // la luce da sotto si accende quando la camera è sotto la lampada
    luceSotto.visible = Math.cos(angolo) < 0;
}

function avviaAnimazione() {
    cameraAttiva = camera;
    controlli.object = camera;
    controlli.enabled = false;     // durante il giro il mouse non muove la camera
    destinazioneCamera = null;
    animazione.attiva = true;
    animazione.fase = 'arrivo';
    animazione.angoloPartenza = 0;
}

function fermaAnimazione() {
    if (!animazione.attiva) return;
    animazione.attiva = false;
    camera.up.set(0, 1, 0);        // la camera torna dritta
    controlli.enabled = true;
}

// a ogni fotogramma fa avanzare l'animazione
function aggiornaAnimazione(ora) {
    if (animazione.fase === 'arrivo') {
        // prima la camera scivola fino al punto più alto del cerchio
        const sopra = puntoSulCerchio(0);
        camera.position.lerp(sopra, 0.08);
        camera.lookAt(controlli.target);
        if (camera.position.distanceTo(sopra) < 0.02) {
            cameraSulCerchio(0);
            animazione.fase = 'pausa';
            animazione.inizioFase = ora;
        }
    } else if (animazione.fase === 'pausa') {
        // ferma per 3 secondi, poi riparte
        cameraSulCerchio(animazione.angoloPartenza);
        if (ora - animazione.inizioFase > durataPausa) {
            animazione.fase = 'giro';
            animazione.inizioFase = ora;
            // la durata si fissa ora: se la cambi a metà movimento, vale dal prossimo
            animazione.durataGiro = durataMovimento;
        }
    } else {
        // mezzo giro: parte piano, accelera e rallenta prima di fermarsi
        const t = Math.min((ora - animazione.inizioFase) / animazione.durataGiro, 1);
        const morbido = t * t * (3 - 2 * t);
        cameraSulCerchio(animazione.angoloPartenza + Math.PI * morbido);
        if (t === 1) {
            // arrivata (sotto o sopra): la prossima metà riparte da qui
            animazione.angoloPartenza = (animazione.angoloPartenza + Math.PI) % (Math.PI * 2);
            animazione.fase = 'pausa';
            animazione.inizioFase = ora;
        }
    }
}

viste.forEach(function (vista) {
    vista.addEventListener('click', function () {
        const tipo = vista.dataset.vista;

        // l'animazione si avvia col suo bottone e si ferma scegliendo qualsiasi altra vista
        if (tipo === 'animazione') {
            pianiSezione.length = 0;   // niente taglio durante il giro
            avviaAnimazione();
            viste.forEach(function (v) {
                v.classList.remove('selected');
            });
            vista.classList.add('selected');
            return;
        }
        fermaAnimazione();

        // 1. la nuova posizione della camera
        if (tipo === 'ortogonale') {
            // passo alla camera ortogonale e la metto in obliquo, di tre quarti e da sotto
            // (stessa distanza sui tre assi: come un'assonometria isometrica vista dal basso)
            cameraAttiva = cameraOrto;
            cameraOrto.position.copy(controlli.target).add(new THREE.Vector3(3.5, -3.5, 3.5));
            cameraOrto.zoom = 1;
            cameraOrto.updateProjectionMatrix();
            destinazioneCamera = null;
        } else {
            // torno (se serve) alla camera prospettica, che scivola fino alla vista scelta:
            // il centro della lampada + lo spostamento della vista
            cameraAttiva = camera;
            destinazioneCamera = controlli.target.clone().add(posizioniViste[tipo]);
        }
        controlli.object = cameraAttiva;   // i controlli muovono la camera attiva

        // la luce da sotto si accende solo quando si guarda da sotto
        luceSotto.visible = (tipo === 'sotto' || tipo === 'ortogonale');

        // 2. il taglio si accende solo nella vista Sezione
        pianiSezione.length = 0;                       // svuoto la lista
        if (tipo === 'sezione') pianiSezione.push(pianoTaglio);

        // 3. sposto la classe "selected" sul bottone cliccato
        viste.forEach(function (v) {
            v.classList.remove('selected');
        });
        vista.classList.add('selected');
    });
});

// se inizi a trascinare mentre la camera si sta spostando, il controllo torna a te
controlli.addEventListener('start', function () {
    destinazioneCamera = null;
});

// l'animazione: a ogni fotogramma aggiorno i controlli, sposto la luce e ridisegno la scena
function anima(ora) {
    if (animazione.attiva) {
        // durante l'animazione è lei a muovere la camera, non i controlli
        aggiornaAnimazione(ora);
    } else {
        // se è stata scelta una vista, la camera ci scivola un po' per volta
        if (destinazioneCamera) {
            cameraAttiva.position.lerp(destinazioneCamera, 0.12);
            if (cameraAttiva.position.distanceTo(destinazioneCamera) < 0.01) {
                destinazioneCamera = null;   // arrivata
            }
        }

        controlli.update();
    }

    // la luce principale segue la camera: prendo la sua posizione "in alto a destra"
    // della camera, la giro come è girata la camera e la sposto dove sta la camera
    lucePrincipale.position.copy(posizioneLuce)
        .applyQuaternion(cameraAttiva.quaternion)
        .add(cameraAttiva.position);
    // la tengo sempre abbastanza in alto, così l'ombra resta corta e morbida
    lucePrincipale.position.y = Math.max(lucePrincipale.position.y, 6);

    renderer.render(scena, cameraAttiva);
}
renderer.setAnimationLoop(anima);

// se la finestra cambia dimensione, il canvas si adatta al visore
window.addEventListener('resize', function () {
    camera.aspect = visore.clientWidth / visore.clientHeight;
    camera.updateProjectionMatrix();
    aggiornaCameraOrto();
    renderer.setSize(visore.clientWidth, visore.clientHeight);
});

// ===== bottoni del colore (uno per ognuna delle 4 parti) =====
document.querySelectorAll('.opzione-colore').forEach(function (opzione) {
    // il materiale che questo gruppo di bottoni colora (data-parte nell'HTML)
    const materiale = materiali[opzione.dataset.parte];
    const campioni = opzione.querySelectorAll('.campione');
    // lo span con il nome del colore scelto per questa parte
    const valoreColore = opzione.querySelector('.opzione-valore');

    campioni.forEach(function (campione) {
        campione.addEventListener('click', function () {
            // 1. cambio il colore della parte
            materiale.color.set(campione.dataset.color);

            // 2. scrivo il nome del colore accanto al titolo
            valoreColore.textContent = campione.dataset.nome;

            // 3. sposto la classe "selected" solo tra i bottoni di questa parte
            campioni.forEach(function (c) {
                c.classList.remove('selected');
            });
            campione.classList.add('selected');

            // 4. un colore scelto a mano non è più un abbinamento pronto
            abbinamenti.forEach(function (a) {
                a.classList.remove('selected');
            });
            valoreAbbinamento.textContent = 'Personalizzato';
        });
    });
});

// ===== bottoni degli abbinamenti (Roma, Parigi, Madrid) =====
const abbinamenti = document.querySelectorAll('.abbinamento');
const valoreAbbinamento = document.getElementById('valore-abbinamento');
// i 4 gruppi di colori, nello stesso ordine di data-colori
const opzioniColore = document.querySelectorAll('.opzione-colore');

abbinamenti.forEach(function (abbinamento) {
    abbinamento.addEventListener('click', function () {
        // 1. leggo i 5 colori (grande, superiore, inferiori, anello, bracci)
        const colori = abbinamento.dataset.colori.split(',');

        // 2. per ogni parte "clicco" il campione con quel colore:
        //    così cambiano insieme il modello, il nome e il campione selezionato
        opzioniColore.forEach(function (opzione, i) {
            const campione = opzione.querySelector('.campione[data-color="' + colori[i] + '"]');
            if (campione) campione.click();
        });

        // 3. scrivo il nome dell'abbinamento e lo seleziono
        //    (dopo i click, che altrimenti lo deselezionerebbero)
        valoreAbbinamento.textContent = abbinamento.dataset.nome;
        abbinamenti.forEach(function (a) {
            a.classList.remove('selected');
        });
        abbinamento.classList.add('selected');
    });
});

// ===== slider della misura =====
const sliderMisura = document.getElementById('slider-misura');
// lo span con la misura scelta (quello dentro il titolo "Misura")
const valoreMisura = sliderMisura.closest('.opzione').querySelector('.opzione-valore');

// la misura di riferimento: 50 cm = modello alla sua grandezza normale
const MISURA_BASE = 50;

// "input" scatta di continuo mentre trascini, così il modello cambia in tempo reale
sliderMisura.addEventListener('input', function () {
    // 1. leggo il valore dello slider (da 10 a 70) e lo trasformo in numero
    const cm = Number(sliderMisura.value);

    // 2. ingrandisco o rimpicciolisco il modello in proporzione
    //    (10 cm = 0.2, 50 cm = 1, 70 cm = 1.4)
    const scala = cm / MISURA_BASE;
    modello.scale.set(scala, scala, scala);
    appoggiaAlPavimento();

    // 3. scrivo la misura accanto al titolo
    valoreMisura.textContent = '⌀ ' + cm + ' cm';
});

// ===== bottoni della finitura =====
// (solo quelli del pannello della lampada: gli occhiali hanno i loro)
const finiture = document.querySelectorAll('#pannello-lampada .finitura');
// lo span con il nome della finitura scelta (quello dentro il titolo "Finitura")
const valoreFinitura = finiture[0].closest('.opzione').querySelector('.opzione-valore');

// le impostazioni del materiale per ogni finitura
const impostazioniFinitura = {
    // opaco: superficie ruvida, nessuna vernice sopra
    opaco:       { roughness: 0.85, clearcoat: 0, clearcoatRoughness: 0,    opacity: 1 },
    // lucido: superficie liscia + uno strato di vernice lucida che riflette l'ambiente
    lucido:      { roughness: 0.2,  clearcoat: 1, clearcoatRoughness: 0.05, opacity: 1 },
    // trasparente: come un vetro colorato, si vede attraverso ma resta del colore scelto
    trasparente: { roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05, opacity: 0.3 }
};

finiture.forEach(function (finitura) {
    finitura.addEventListener('click', function () {
        // 1. leggo le etichette data-finitura e data-nome del bottone cliccato
        const tipo = finitura.dataset.finitura;
        const nome = finitura.dataset.nome;

        // 2. cambio la superficie del materiale:
        //    colore e misura restano quelli scelti
        //    la finitura vale per tutte le parti
        const imp = impostazioniFinitura[tipo];
        Object.values(materiali).forEach(function (materiale) {
            materiale.roughness = imp.roughness;
            materiale.clearcoat = imp.clearcoat;
            materiale.clearcoatRoughness = imp.clearcoatRoughness;
            materiale.opacity = imp.opacity;
            // da trasparente non scrive la profondità, così il retro si vede attraverso il davanti
            materiale.depthWrite = imp.opacity === 1;
        });
        // l'ombra a terra si alleggerisce insieme all'oggetto
        pavimento.material.opacity = 0.18 * (imp.opacity === 1 ? 1 : 0.4);

        // 3. scrivo il nome della finitura accanto al titolo
        valoreFinitura.textContent = nome;

        // 4. sposto la classe "selected" (il rettangolo nero) sul bottone cliccato
        finiture.forEach(function (f) {
            f.classList.remove('selected');
        });
        finitura.classList.add('selected');
    });
});

// ===== slider dei tempi dell'animazione (sotto il 3D) =====
// collega uno slider (pausa o movimento): mentre lo trascini salva i secondi scelti
function collegaSliderTempo(idSlider, idValore, salva) {
    const slider = document.getElementById(idSlider);
    const valore = document.getElementById(idValore);

    slider.addEventListener('input', function () {
        // 1. leggo i secondi (da 1 a 7) e li passo all'animazione in millisecondi
        const secondi = Number(slider.value);
        salva(secondi * 1000);

        // 2. scrivo i secondi accanto al titolo
        valore.textContent = secondi + ' s';
    });
}

collegaSliderTempo('slider-pausa', 'valore-pausa', function (ms) { durataPausa = ms; });
collegaSliderTempo('slider-movimento', 'valore-movimento', function (ms) { durataMovimento = ms; });


// =====================================================================
// ===== secondo visualizzatore: gli occhiali (models/giuliacamasso.glb)
// =====================================================================
// è costruito come quello della lampada, ma con un materiale più realistico:
// acetato trasparente (la luce passa davvero attraverso, come in un render)
// e una resa dei colori più fedele (tone mapping)

const visoreOcchiali = document.getElementById('visore-occhiali');

const scenaOcchiali = new THREE.Scene();
scenaOcchiali.background = new THREE.Color('#f3efe8');

const cameraOcchiali = new THREE.PerspectiveCamera(35, visoreOcchiali.clientWidth / visoreOcchiali.clientHeight, 0.1, 100);
cameraOcchiali.position.set(2.6, 1.6, 3.6);

const rendererOcchiali = new THREE.WebGLRenderer({ antialias: true });
rendererOcchiali.setPixelRatio(window.devicePixelRatio);
rendererOcchiali.setSize(visoreOcchiali.clientWidth, visoreOcchiali.clientHeight);
rendererOcchiali.shadowMap.enabled = true;
rendererOcchiali.shadowMap.type = THREE.PCFSoftShadowMap;
// tone mapping: luci e riflessi forti non "bruciano" e i colori restano naturali, come in un render
rendererOcchiali.toneMapping = THREE.NeutralToneMapping;
rendererOcchiali.toneMappingExposure = 1;
visoreOcchiali.appendChild(rendererOcchiali.domElement);

// le luci: le stesse della lampada (cielo-pavimento, principale che segue la camera, riempimento, contorno)
scenaOcchiali.add(new THREE.HemisphereLight(0xffffff, 0xe8dccb, 0.6));

const lucePrincipaleOcchiali = new THREE.DirectionalLight(0xffffff, 2.4);
lucePrincipaleOcchiali.castShadow = true;
lucePrincipaleOcchiali.shadow.mapSize.set(2048, 2048);
lucePrincipaleOcchiali.shadow.camera.left = -3;
lucePrincipaleOcchiali.shadow.camera.right = 3;
lucePrincipaleOcchiali.shadow.camera.top = 3;
lucePrincipaleOcchiali.shadow.camera.bottom = -3;
lucePrincipaleOcchiali.shadow.radius = 6;          // ombra più morbida
lucePrincipaleOcchiali.shadow.bias = -0.0005;
lucePrincipaleOcchiali.shadow.normalBias = 0.02;
scenaOcchiali.add(lucePrincipaleOcchiali);

const riempimentoOcchiali = new THREE.DirectionalLight(0xfff4e8, 0.6);
riempimentoOcchiali.position.set(-5, 3, -2);
scenaOcchiali.add(riempimentoOcchiali);

const contornoOcchiali = new THREE.DirectionalLight(0xffffff, 1.2);
contornoOcchiali.position.set(0, 4, -6);
scenaOcchiali.add(contornoOcchiali);

// l'ambiente riflesso: sull'acetato lucido si vedono i riflessi della "stanza"
const generatoreAmbienteOcchiali = new THREE.PMREMGenerator(rendererOcchiali);
scenaOcchiali.environment = generatoreAmbienteOcchiali.fromScene(new RoomEnvironment(), 0.04).texture;
scenaOcchiali.environmentIntensity = 1;

// il pavimento invisibile che mostra solo l'ombra
const pavimentoOcchiali = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.ShadowMaterial({ opacity: 0.12 })   // leggera: la plastica trasparente fa passare la luce
);
pavimentoOcchiali.rotation.x = -Math.PI / 2;
pavimentoOcchiali.receiveShadow = true;
scenaOcchiali.add(pavimentoOcchiali);

// ===== il materiale degli occhiali: acetato trasparente =====
// "transmission" fa passare la luce attraverso la plastica: dietro si vede lo sfondo,
// leggermente deformato dallo spessore (rifrazione), con i riflessi sulla superficie
function creaMaterialeOcchiali() {
    return new THREE.MeshPhysicalMaterial({
        color: '#FFFFFF',          // il colore della luce che attraversa (bianco = cristallo incolore)
        metalness: 0,
        roughness: 0,              // perfettamente levigato: trasparenza nitida, non lattiginosa
        transmission: 1,           // 1 = completamente trasparente
        thickness: 0.06,           // lo spessore della plastica: quanto deforma ciò che sta dietro
        ior: 1.49,                 // l'indice di rifrazione dell'acetato
        attenuationColor: new THREE.Color('#FFFFFF'),   // il colore che prende attraversando lo spessore
        attenuationDistance: 10,   // quanto ci mette a prendere quel colore (grande = quasi niente)
        clearcoat: 1,              // lo strato lucido sopra, per i riflessi
        clearcoatRoughness: 0,
        specularIntensity: 1,
        side: THREE.DoubleSide
    });
}

const materialiOcchiali = {
    montatura: creaMaterialeOcchiali(),   // il frontale
    aste:      creaMaterialeOcchiali()    // le aste con le cerniere
};

// i controlli col mouse
const controlliOcchiali = new OrbitControls(cameraOcchiali, rendererOcchiali.domElement);
controlliOcchiali.target.set(0, 0.4, 0);
controlliOcchiali.enableDamping = true;
controlliOcchiali.enablePan = false;
controlliOcchiali.minDistance = 2;
controlliOcchiali.maxDistance = 10;

// ===== stanghette: apri e chiudi =====
// i due perni (uno per lato) vengono creati quando il modello è caricato
const perniStanghette = { destra: null, sinistra: null };

// quanto ruota ogni stanghetta da chiusa: la destra si chiude per prima e resta più vicina al frontale,
// la sinistra si piega sopra di lei con un angolo un po' più piccolo (come negli occhiali veri)
const ANGOLO_CHIUSA_DESTRA = THREE.MathUtils.degToRad(88);
const ANGOLO_CHIUSA_SINISTRA = THREE.MathUtils.degToRad(-80);
const DURATA_STANGHETTE = 1600;   // millisecondi per chiudere (o aprire) tutte e due

const stanghette = {
    progresso: 0,          // 0 = aperte, 1 = chiuse
    direzione: 0,          // +1 si stanno chiudendo, -1 si stanno aprendo, 0 ferme
    ultimoTempo: null
};

// la curva del movimento: parte piano, accelera e rallenta alla fine
function morbido(t) {
    t = Math.min(Math.max(t, 0), 1);
    return t * t * (3 - 2 * t);
}

function aggiornaStanghette(ora) {
    if (stanghette.ultimoTempo === null) stanghette.ultimoTempo = ora;
    const trascorso = ora - stanghette.ultimoTempo;
    stanghette.ultimoTempo = ora;

    if (stanghette.direzione !== 0) {
        stanghette.progresso += stanghette.direzione * trascorso / DURATA_STANGHETTE;
        if (stanghette.progresso >= 1 || stanghette.progresso <= 0) {
            stanghette.progresso = Math.min(Math.max(stanghette.progresso, 0), 1);
            stanghette.direzione = 0;
            finitoMovimentoStanghette();
        }
    }

    if (!perniStanghette.destra) return;   // il modello non è ancora caricato
    // la destra si muove nella prima parte del tempo, la sinistra nella seconda:
    // chiudendo prima la destra poi la sinistra, aprendo il contrario
    perniStanghette.destra.rotation.y = ANGOLO_CHIUSA_DESTRA * morbido(stanghette.progresso / 0.6);
    perniStanghette.sinistra.rotation.y = ANGOLO_CHIUSA_SINISTRA * morbido((stanghette.progresso - 0.4) / 0.6);
}

const btnStanghette = document.getElementById('btn-stanghette');
const valoreStanghette = document.getElementById('valore-stanghette');

btnStanghette.addEventListener('click', function () {
    // se sono aperte (o si stanno aprendo) le chiudo, altrimenti le apro
    stanghette.direzione = stanghette.progresso < 0.5 ? 1 : -1;
    btnStanghette.disabled = true;   // finché si muovono il bottone aspetta
    valoreStanghette.textContent = stanghette.direzione === 1 ? 'Si chiudono…' : 'Si aprono…';
});

function finitoMovimentoStanghette() {
    const chiuse = stanghette.progresso === 1;
    valoreStanghette.textContent = chiuse ? 'Chiuse' : 'Aperte';
    btnStanghette.textContent = chiuse ? 'Apri le stanghette' : 'Chiudi le stanghette';
    btnStanghette.disabled = false;
}

// il modello: nel file il frontale usa il materiale "Plastica (2)",
// le aste e le cerniere "Plastica (3)": li sostituisco con i nostri
const loaderOcchiali = new GLTFLoader();
loaderOcchiali.load('models/giuliacamasso.glb', function (gltf) {
    const occhiali = gltf.scene;

    // le parti delle stanghette (aste + cerniere), divise tra lato destro e sinistro
    const partiStanghette = { destra: [], sinistra: [] };

    occhiali.traverse(function (parte) {
        if (parte.isMesh) {
            parte.castShadow = true;
            parte.receiveShadow = true;
            if (parte.material.name === 'Plastica (2)') {
                parte.material = materialiOcchiali.montatura;
            } else {
                parte.material = materialiOcchiali.aste;
                // da che lato sta? lo dice il centro del pezzo (x positiva = destra)
                parte.geometry.computeBoundingBox();
                const centroParte = parte.geometry.boundingBox.getCenter(new THREE.Vector3());
                partiStanghette[centroParte.x > 0 ? 'destra' : 'sinistra'].push(parte);
            }
        }
    });

    // per ogni lato creo un "perno" nel punto della cerniera e ci aggancio le parti:
    // girando il perno, la stanghetta ruota intorno alla cerniera come negli occhiali veri
    ['destra', 'sinistra'].forEach(function (lato) {
        const scatolaLato = new THREE.Box3();
        partiStanghette[lato].forEach(function (parte) {
            scatolaLato.union(parte.geometry.boundingBox);
        });
        // la cerniera: al centro della stanghetta in larghezza, all'estremità vicina al frontale
        const puntoCerniera = new THREE.Vector3(
            (scatolaLato.min.x + scatolaLato.max.x) / 2,
            0,
            scatolaLato.max.z
        );
        const perno = new THREE.Group();
        perno.position.copy(puntoCerniera);
        partiStanghette[lato].forEach(function (parte) {
            parte.position.sub(puntoCerniera);   // la parte resta dov'era, ma ora "appesa" al perno
            perno.add(parte);
        });
        occhiali.add(perno);
        perniStanghette[lato] = perno;
    });

    // al centro, grandi come la lampada (la parte più larga misura 1.8), appoggiati al pavimento
    const scatola = new THREE.Box3().setFromObject(occhiali);
    const dimensioni = scatola.getSize(new THREE.Vector3());
    const centro = scatola.getCenter(new THREE.Vector3());
    const fattore = GRANDEZZA_BASE / Math.max(dimensioni.x, dimensioni.z);
    occhiali.position.sub(centro).multiplyScalar(fattore);
    occhiali.scale.setScalar(fattore);
    occhiali.position.y += (dimensioni.y * fattore) / 2;   // il punto più basso a y = 0

    scenaOcchiali.add(occhiali);
    controlliOcchiali.target.set(0, (dimensioni.y * fattore) / 2, 0);
});

// l'animazione: come per la lampada, la luce principale segue la camera
rendererOcchiali.setAnimationLoop(function (ora) {
    aggiornaStanghette(ora);

    controlliOcchiali.update();
    lucePrincipaleOcchiali.position.copy(posizioneLuce)
        .applyQuaternion(cameraOcchiali.quaternion)
        .add(cameraOcchiali.position);
    lucePrincipaleOcchiali.position.y = Math.max(lucePrincipaleOcchiali.position.y, 6);
    rendererOcchiali.render(scenaOcchiali, cameraOcchiali);
});

window.addEventListener('resize', function () {
    cameraOcchiali.aspect = visoreOcchiali.clientWidth / visoreOcchiali.clientHeight;
    cameraOcchiali.updateProjectionMatrix();
    rendererOcchiali.setSize(visoreOcchiali.clientWidth, visoreOcchiali.clientHeight);
});

// i colori di montatura e aste
document.querySelectorAll('.opzione-occhiali').forEach(function (opzione) {
    const materiale = materialiOcchiali[opzione.dataset.parte];
    const campioni = opzione.querySelectorAll('.campione');
    const valore = opzione.querySelector('.opzione-valore');

    campioni.forEach(function (campione) {
        campione.addEventListener('click', function () {
            // 1. la luce che attraversa la plastica prende la tinta scelta,
            //    e si scurisce di più o di meno a seconda della densità (il nero è un fumé scuro)
            materiale.color.set(campione.dataset.tinta);
            materiale.attenuationColor.set(campione.dataset.tinta);
            materiale.attenuationDistance = Number(campione.dataset.densita);
            // i render delle tre viste sono immagini ferme: li rifaccio col nuovo colore
            aggiornaRenderOcchiali();
            // 2. nome e bottone selezionato
            valore.textContent = campione.dataset.nome;
            campioni.forEach(function (c) {
                c.classList.remove('selected');
            });
            campione.classList.add('selected');
        });
    });
});

// la finitura degli occhiali: c'è solo Trasparente, già impostata nel materiale,
// quindi il bottone serve solo a indicarla


// =====================================================================
// ===== l'esploso degli occhiali e i render delle tre viste
// =====================================================================
// stesso "studio fotografico" del visualizzatore degli occhiali (luci, riflessi, ombra),
// e stessi materiali: se cambi colore nel pannello, cambia anche qui

// crea una scena con sfondo, luci, ambiente riflesso e pavimento per l'ombra
function creaStudioOcchiali(renderer) {
    const scena = new THREE.Scene();
    scena.background = new THREE.Color('#f3efe8');
    scena.add(new THREE.HemisphereLight(0xffffff, 0xe8dccb, 0.6));

    const lucePrincipale = new THREE.DirectionalLight(0xffffff, 2.4);
    lucePrincipale.castShadow = true;
    lucePrincipale.shadow.mapSize.set(2048, 2048);
    lucePrincipale.shadow.camera.left = -3;
    lucePrincipale.shadow.camera.right = 3;
    lucePrincipale.shadow.camera.top = 3;
    lucePrincipale.shadow.camera.bottom = -3;
    lucePrincipale.shadow.radius = 6;
    lucePrincipale.shadow.bias = -0.0005;
    lucePrincipale.shadow.normalBias = 0.02;
    scena.add(lucePrincipale);

    const riempimento = new THREE.DirectionalLight(0xfff4e8, 0.6);
    riempimento.position.set(-5, 3, -2);
    scena.add(riempimento);

    const contorno = new THREE.DirectionalLight(0xffffff, 1.2);
    contorno.position.set(0, 4, -6);
    scena.add(contorno);

    const generatoreAmbiente = new THREE.PMREMGenerator(renderer);
    scena.environment = generatoreAmbiente.fromScene(new RoomEnvironment(), 0.04).texture;

    const pavimento = new THREE.Mesh(
        new THREE.PlaneGeometry(20, 20),
        new THREE.ShadowMaterial({ opacity: 0.12 })
    );
    pavimento.rotation.x = -Math.PI / 2;
    pavimento.receiveShadow = true;
    scena.add(pavimento);

    return { scena: scena, lucePrincipale: lucePrincipale };
}

function creaRendererOcchiali() {
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1;
    return renderer;
}

// come nel visualizzatore: la luce principale sta in alto a destra rispetto alla camera
function luceDallaCamera(luce, camera) {
    luce.position.copy(posizioneLuce)
        .applyQuaternion(camera.quaternion)
        .add(camera.position);
    luce.position.y = Math.max(luce.position.y, 6);
}

// prepara una copia del modello: materiali nostri, ombre, grandezza e posizione
// come nel visualizzatore (al centro, appoggiata al pavimento). Restituisce il gruppo e la sua altezza
function preparaOcchiali(modello) {
    modello.traverse(function (parte) {
        if (parte.isMesh) {
            parte.castShadow = true;
            parte.receiveShadow = true;
            parte.material = parte.material.name === 'Plastica (2)'
                ? materialiOcchiali.montatura
                : materialiOcchiali.aste;
        }
    });
    const scatola = new THREE.Box3().setFromObject(modello);
    const dimensioni = scatola.getSize(new THREE.Vector3());
    const centro = scatola.getCenter(new THREE.Vector3());
    const fattore = GRANDEZZA_BASE / Math.max(dimensioni.x, dimensioni.z);
    modello.position.sub(centro).multiplyScalar(fattore);
    modello.scale.setScalar(fattore);
    modello.position.y += (dimensioni.y * fattore) / 2;
    return dimensioni.y * fattore;
}

// ===== a sinistra: l'animazione dell'esploso =====
const visoreEsploso = document.getElementById('visore-esploso');
const rendererEsploso = creaRendererOcchiali();
rendererEsploso.setPixelRatio(window.devicePixelRatio);
rendererEsploso.setSize(visoreEsploso.clientWidth, visoreEsploso.clientHeight);
visoreEsploso.appendChild(rendererEsploso.domElement);

const studioEsploso = creaStudioOcchiali(rendererEsploso);
const cameraEsploso = new THREE.PerspectiveCamera(35, visoreEsploso.clientWidth / visoreEsploso.clientHeight, 0.1, 100);
const centroEsploso = new THREE.Vector3(0, 0.4, 0);

// i pezzi che si muovono: per ognuno la posizione di partenza e lo spostamento da esploso
const pezziEsploso = [];

// i tempi del ciclo, in millisecondi (poi ricomincia da capo, come un video in loop)
const TEMPI_ESPLOSO = {
    unito: 1500,        // fermo, tutto unito
    apertura: 2500,     // i pezzi si separano
    esploso: 2500,      // fermo, esploso
    chiusura: 2500,     // i pezzi tornano al loro posto
    finale: 1000        // fermo, di nuovo unito
};
const DURATA_ESPLOSO = Object.values(TEMPI_ESPLOSO).reduce(function (a, b) { return a + b; }, 0);

// quanto è aperto l'esploso in un certo momento del ciclo: 0 = unito, 1 = esploso
function aperturaEsploso(t) {
    t = t % DURATA_ESPLOSO;
    if (t < TEMPI_ESPLOSO.unito) return 0;
    t -= TEMPI_ESPLOSO.unito;
    if (t < TEMPI_ESPLOSO.apertura) return morbido(t / TEMPI_ESPLOSO.apertura);
    t -= TEMPI_ESPLOSO.apertura;
    if (t < TEMPI_ESPLOSO.esploso) return 1;
    t -= TEMPI_ESPLOSO.esploso;
    if (t < TEMPI_ESPLOSO.chiusura) return 1 - morbido(t / TEMPI_ESPLOSO.chiusura);
    return 0;
}

// in che direzione va ogni pezzo (misure del file, prima di ingrandirlo):
// x = verso l'esterno, y = in alto, z = in avanti (il frontale guarda verso +z)
function spostamentoPezzo(pezzo) {
    const scatola = new THREE.Box3().setFromObject(pezzo);
    const centro = scatola.getCenter(new THREE.Vector3());
    const dimensioni = scatola.getSize(new THREE.Vector3());
    const lato = Math.sign(centro.x);   // +1 destra, -1 sinistra
    let materiale = null;
    pezzo.traverse(function (p) { if (p.isMesh && !materiale) materiale = p.material.name; });

    if (materiale === 'Plastica (2)') {
        // il frontale: in avanti
        return new THREE.Vector3(0, 0, 0.06);
    }
    if (dimensioni.z > 0.1) {
        // la stanghetta: verso l'esterno e indietro
        return new THREE.Vector3(lato * 0.075, 0, -0.045);
    }
    if (centro.z > -0.068) {
        // il pezzo di cerniera fissato al frontale: un po' in fuori
        return new THREE.Vector3(lato * 0.022, 0, 0.01);
    }
    // i pezzi di cerniera sulla stanghetta: a metà strada, e si aprono in alto e in basso
    const altoBasso = centro.y > -0.085 ? 1 : -1;
    return new THREE.Vector3(lato * 0.048, altoBasso * 0.012, -0.018);
}

// ===== a destra: i render delle tre viste =====
// un renderer che non sta nella pagina: disegna le immagini, poi le mettiamo nei tag <img>
const rendererRender = creaRendererOcchiali();
rendererRender.setPixelRatio(1);
rendererRender.setSize(1200, 900);   // 4:3 come i riquadri
const studioRender = creaStudioOcchiali(rendererRender);
const cameraRender = new THREE.PerspectiveCamera(30, 1200 / 900, 0.1, 100);
const centroRender = new THREE.Vector3(0, 0.4, 0);

// dove si mette la camera per ogni render, rispetto al centro degli occhiali
const visteRender = [
    { img: document.getElementById('render-frontale'),   posizione: new THREE.Vector3(0, 0.25, 4.8) },
    { img: document.getElementById('render-tre-quarti'), posizione: new THREE.Vector3(3.0, 1.5, 3.6) },
    { img: document.getElementById('render-posteriore'), posizione: new THREE.Vector3(0, 0.6, -4.8) }
];

let modelloRenderPronto = false;

function aggiornaRenderOcchiali() {
    if (!modelloRenderPronto) return;
    visteRender.forEach(function (vista) {
        cameraRender.position.copy(centroRender).add(vista.posizione);
        cameraRender.lookAt(centroRender);
        luceDallaCamera(studioRender.lucePrincipale, cameraRender);
        rendererRender.render(studioRender.scena, cameraRender);
        // subito dopo aver disegnato, copio l'immagine nel tag <img>
        vista.img.src = rendererRender.domElement.toDataURL('image/jpeg', 0.92);
    });
}

// ===== il modello: lo carico una volta e ne faccio due copie =====
new GLTFLoader().load('models/giuliacamasso.glb', function (gltf) {
    // la copia per i render resta tutta unita
    const copiaRender = gltf.scene.clone(true);
    const altezza = preparaOcchiali(copiaRender);
    studioRender.scena.add(copiaRender);
    centroRender.set(0, altezza / 2, 0);
    modelloRenderPronto = true;
    aggiornaRenderOcchiali();

    // la copia per l'esploso: ogni figlio della scena del file è un pezzo
    const copiaEsploso = gltf.scene;
    copiaEsploso.children.slice().forEach(function (pezzo) {
        pezziEsploso.push({
            oggetto: pezzo,
            partenza: pezzo.position.clone(),
            spostamento: spostamentoPezzo(pezzo)
        });
    });
    const altezzaEsploso = preparaOcchiali(copiaEsploso);
    studioEsploso.scena.add(copiaEsploso);
    centroEsploso.set(0, altezzaEsploso / 2, 0);
});

// l'animazione: i pezzi si separano e si ricompongono, mentre la camera gira piano intorno
let esplosoVisibile = true;
new IntersectionObserver(function (voci) {
    esplosoVisibile = voci[0].isIntersecting;   // se non si vede, non lo disegno (risparmio la scheda video)
}).observe(visoreEsploso);

rendererEsploso.setAnimationLoop(function (ora) {
    if (!esplosoVisibile) return;

    const apertura = aperturaEsploso(ora);
    pezziEsploso.forEach(function (pezzo) {
        pezzo.oggetto.position.copy(pezzo.partenza).addScaledVector(pezzo.spostamento, apertura);
    });

    // la camera: un giro lento a tre quarti, un po' dall'alto
    const angolo = 0.6 + Math.sin(ora * 0.00025) * 0.5;
    cameraEsploso.position.set(
        centroEsploso.x + Math.sin(angolo) * 5.4,
        centroEsploso.y + 1.9,
        centroEsploso.z + Math.cos(angolo) * 5.4
    );
    cameraEsploso.lookAt(centroEsploso);
    luceDallaCamera(studioEsploso.lucePrincipale, cameraEsploso);
    rendererEsploso.render(studioEsploso.scena, cameraEsploso);
});

window.addEventListener('resize', function () {
    cameraEsploso.aspect = visoreEsploso.clientWidth / visoreEsploso.clientHeight;
    cameraEsploso.updateProjectionMatrix();
    rendererEsploso.setSize(visoreEsploso.clientWidth, visoreEsploso.clientHeight);
});
