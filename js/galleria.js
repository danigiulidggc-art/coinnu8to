// galleria.js – la galleria di tutti gli occhiali della cartella models
// ogni quadrato ha due opzioni:
//   "Guarda"          apre la finestra in sovrapposizione con l'occhiale in 3D da girare
//   "Provali adesso"  apre la fotocamera (o una foto) e mette l'occhiale sul viso
// (si carica con type="module" come script.js e usa la stessa importmap)

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';


// ===== l'elenco degli occhiali =====
// il browser non può leggere da solo cosa c'è in una cartella, quindi i file li scrivo qui.
// Se aggiungi un .glb in models, aggiungi una riga.
// (non ci sono: ph5.glb che è la lampada, i doppioni dei progetti di gruppo
//  e "niccolòcasanova.glb" che in realtà è un file di Rhino rinominato e non si può aprire)
const OCCHIALI = [
    { file: 'alessandromorri.glb',     nome: 'Alessandro Morri' },
    { file: 'AnnaPorcellini.glb',      nome: 'Anna Porcellini' },
    { file: 'camilasaraviaruiz.glb',   nome: 'Camila Saravia Ruiz' },
    { file: 'davidesebastianelli.glb', nome: 'Davide Sebastianelli' },
    { file: 'fabbri_Edoardo.glb',      nome: 'Edoardo Fabbri' },
    { file: 'giacomocerioni.glb',      nome: 'Giacomo Cerioni' },
    { file: 'giuliacamasso.glb',       nome: 'Giulia Camasso' },
    { file: 'lucagiorgetti.glb',       nome: 'Luca Giorgetti' },
    { file: 'SofiaBezzicheri.glb',     nome: 'Sofia Bezzicheri' },
    { file: 'valentinavicinanza.glb',  nome: 'Valentina Vicinanza' }
];

// i file sono stati esportati da persone diverse e non tutti sono girati allo stesso modo:
// qui scrivo la rotazione (in gradi, attorno a x, y, z) che serve per raddrizzare quelli storti.
// Dopo la correzione ogni occhiale ha: larghezza lungo x, l'alto verso +y, il davanti verso +z
// (controllati uno per uno: Giacomo ha il davanti girato all'indietro, Edoardo è a testa in giù)
const CORREZIONI = {
    'giacomocerioni.glb':    [0, 180, 0],
    'fabbri_Edoardo.glb':    [0, 0, 180]
};

// pezzi dentro i file che non fanno parte dell'occhiale e vanno tolti (per nome)
const PARTI_DA_TOGLIERE = {
    'camilasaraviaruiz.glb': ['lente_esterna']   // la parete azzurra davanti agli occhiali
};

const COLORE_SFONDO = '#f3efe8';


// ===== caricare e raddrizzare un occhiale =====
const loader = new GLTFLoader();
const modelliCaricati = {};   // ogni file si carica una volta sola

function caricaOcchiale(file) {
    if (!modelliCaricati[file]) {
        modelliCaricati[file] = loader.loadAsync('models/' + encodeURIComponent(file)).then(function (gltf) {
            return raddrizzaOcchiale(gltf.scene, file);
        });
    }
    return modelliCaricati[file];
}

// restituisce un gruppo con l'occhiale dritto, largo 1, centrato in x e y,
// con il davanti a z = 0 e le stanghette verso -z
function raddrizzaOcchiale(scena, file) {
    // tolgo quello che non è l'occhiale: la testa (in alcuni file c'è) e le linee di costruzione
    const daTogliere = [];
    const nomiDaTogliere = PARTI_DA_TOGLIERE[file] || [];
    scena.traverse(function (parte) {
        if (/^testa/i.test(parte.name) || parte.isLine || parte.isPoints || nomiDaTogliere.includes(parte.name)) {
            daTogliere.push(parte);
        }
        if (parte.isMesh) {
            parte.castShadow = true;
            parte.receiveShadow = true;
        }
    });
    daTogliere.forEach(function (parte) {
        if (parte.parent) parte.parent.remove(parte);
    });

    const ruotato = new THREE.Group();
    ruotato.add(scena);
    const gradi = CORREZIONI[file] || [0, 0, 0];
    ruotato.rotation.set(
        THREE.MathUtils.degToRad(gradi[0]),
        THREE.MathUtils.degToRad(gradi[1]),
        THREE.MathUtils.degToRad(gradi[2])
    );
    ruotato.updateMatrixWorld(true);

    const scatola = new THREE.Box3().setFromObject(ruotato, true);
    const dimensioni = scatola.getSize(new THREE.Vector3());
    const fattore = 1 / dimensioni.x;
    // il punto che va nell'origine: in mezzo in larghezza e altezza, sul davanti in profondità
    const ancora = new THREE.Vector3(
        (scatola.min.x + scatola.max.x) / 2,
        (scatola.min.y + scatola.max.y) / 2,
        scatola.max.z
    );
    ruotato.scale.setScalar(fattore);
    ruotato.position.copy(ancora).multiplyScalar(-fattore);

    const occhiale = new THREE.Group();
    occhiale.add(ruotato);
    occhiale.userData.altezza = dimensioni.y * fattore;
    occhiale.userData.profondita = dimensioni.z * fattore;
    return occhiale;
}


// ===== uno "studio fotografico": sfondo, luci, riflessi e ombra =====
function creaStudio(renderer, conSfondo) {
    const scena = new THREE.Scene();
    if (conSfondo) scena.background = new THREE.Color(COLORE_SFONDO);
    scena.add(new THREE.HemisphereLight(0xffffff, 0xe8dccb, 0.6));

    const luce = new THREE.DirectionalLight(0xffffff, 2.2);
    luce.position.set(1.5, 3, 2.5);
    luce.castShadow = true;
    luce.shadow.mapSize.set(1024, 1024);
    luce.shadow.camera.left = -1.5;
    luce.shadow.camera.right = 1.5;
    luce.shadow.camera.top = 1.5;
    luce.shadow.camera.bottom = -1.5;
    luce.shadow.radius = 6;
    luce.shadow.bias = -0.0005;
    scena.add(luce);

    const riempimento = new THREE.DirectionalLight(0xfff4e8, 0.6);
    riempimento.position.set(-3, 1.5, 1);
    scena.add(riempimento);

    const generatore = new THREE.PMREMGenerator(renderer);
    scena.environment = generatore.fromScene(new RoomEnvironment(), 0.04).texture;

    // il pavimento invisibile che mostra solo l'ombra
    const pavimento = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 10),
        new THREE.ShadowMaterial({ opacity: 0.12 })
    );
    pavimento.rotation.x = -Math.PI / 2;
    pavimento.receiveShadow = true;
    scena.add(pavimento);

    return { scena: scena, pavimento: pavimento };
}

function creaRenderer(trasparente) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: trasparente, preserveDrawingBuffer: trasparente });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    return renderer;
}

// mette l'occhiale nello studio (appoggiato al pavimento) e inquadra la camera di tre quarti
function inquadra(occhiale, studio, camera) {
    const altezza = occhiale.userData.altezza;
    const profondita = occhiale.userData.profondita;
    occhiale.position.set(0, altezza / 2, 0);
    studio.pavimento.position.y = 0;

    const centro = new THREE.Vector3(0, altezza / 2, -profondita / 2);
    const direzione = new THREE.Vector3(0.75, 0.42, 1).normalize();

    // allontano la camera finché l'occhiale entra tutto nell'inquadratura
    const scatola = new THREE.Box3().setFromObject(occhiale, true);
    const angoli = [];
    for (let i = 0; i < 8; i++) {
        angoli.push(new THREE.Vector3(
            i & 1 ? scatola.max.x : scatola.min.x,
            i & 2 ? scatola.max.y : scatola.min.y,
            i & 4 ? scatola.max.z : scatola.min.z
        ));
    }
    let distanza = 3;
    for (let giro = 0; giro < 4; giro++) {
        camera.position.copy(centro).addScaledVector(direzione, distanza);
        camera.lookAt(centro);
        camera.updateMatrixWorld();
        let massimo = 0;
        angoli.forEach(function (angolo) {
            const p = angolo.clone().project(camera);
            massimo = Math.max(massimo, Math.abs(p.x) / 0.9, Math.abs(p.y) / 0.85);
        });
        distanza *= massimo;
    }
    return centro;
}


// ===== i quadrati della galleria =====
const galleria = document.getElementById('galleria');
const voci = [];

OCCHIALI.forEach(function (occhiale, indice) {
    const colonna = document.createElement('div');
    colonna.className = 'col-6 col-md-4 galleria-voce';   // su schermo grande: 5 per riga (vedi galleria.css)
    colonna.innerHTML =
        '<div class="galleria-quadrato">' +
            '<div class="galleria-immagine">' +
                '<img alt="Gli occhiali di ' + occhiale.nome + '" hidden>' +
                '<span class="galleria-caricamento">Caricamento…</span>' +
            '</div>' +
            '<div class="galleria-azioni">' +
                '<button type="button" class="btn-guarda">Guarda</button>' +
                '<button type="button" class="btn-prova">Provali adesso</button>' +
            '</div>' +
        '</div>' +
        '<p class="galleria-nome">' + occhiale.nome + '</p>';
    galleria.appendChild(colonna);

    colonna.querySelector('.btn-guarda').addEventListener('click', function () {
        apriSovrapposizione(indice, 'guarda');
    });
    colonna.querySelector('.btn-prova').addEventListener('click', function () {
        apriSovrapposizione(indice, 'prova');
    });

    voci.push({
        immagine: colonna.querySelector('img'),
        caricamento: colonna.querySelector('.galleria-caricamento'),
        bottoni: colonna.querySelectorAll('button')
    });
});

// le immagini dei quadrati: un solo renderer fa una "foto" di ogni occhiale, uno alla volta
async function creaAnteprime() {
    const renderer = creaRenderer(true);
    renderer.setPixelRatio(1);
    renderer.setSize(600, 300);
    renderer.setClearColor(0x000000, 0);
    const studio = creaStudio(renderer, false);
    const camera = new THREE.PerspectiveCamera(30, 2, 0.01, 50);

    for (let i = 0; i < OCCHIALI.length; i++) {
        const voce = voci[i];
        try {
            // una copia, così l'originale resta libero per la finestra in sovrapposizione
            const occhiale = (await caricaOcchiale(OCCHIALI[i].file)).clone();
            studio.scena.add(occhiale);
            inquadra(occhiale, studio, camera);
            renderer.render(studio.scena, camera);
            voce.immagine.src = renderer.domElement.toDataURL('image/png');
            voce.immagine.hidden = false;
            voce.caricamento.remove();
            studio.scena.remove(occhiale);
        } catch (errore) {
            console.error('Non riesco a caricare ' + OCCHIALI[i].file, errore);
            voce.caricamento.textContent = 'File non disponibile';
            voce.bottoni.forEach(function (b) { b.disabled = true; });
        }
    }
    renderer.dispose();
}

// le anteprime partono solo quando la galleria si sta avvicinando (così non rallentano il resto della pagina)
const osservatoreGalleria = new IntersectionObserver(function (voci) {
    if (voci[0].isIntersecting) {
        osservatoreGalleria.disconnect();
        creaAnteprime();
    }
}, { rootMargin: '800px' });
osservatoreGalleria.observe(galleria);


// =====================================================================
// ===== la finestra in sovrapposizione
// =====================================================================
const sovrapposizione = document.getElementById('sovrapposizione');
const titolo = document.getElementById('sovrapposizione-titolo');
const bottoniModo = sovrapposizione.querySelectorAll('[data-modo]');
const palcoGuarda = document.getElementById('palco-guarda');
const palcoProva = document.getElementById('palco-prova');

// un solo renderer per la finestra: si sposta tra "Guarda" e "Provali adesso"
const rendererFinestra = creaRenderer(true);
const studioGuarda = creaStudio(rendererFinestra, true);
const cameraGuarda = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
const controlli = new OrbitControls(cameraGuarda, rendererFinestra.domElement);
controlli.enableDamping = true;
controlli.enablePan = false;
controlli.autoRotate = true;
controlli.autoRotateSpeed = 1.5;
controlli.addEventListener('start', function () {
    controlli.autoRotate = false;   // se lo giri tu, smette di girare da solo
});

let indiceAperto = -1;
let modoAperto = null;
let occhialeAperto = null;

async function apriSovrapposizione(indice, modo) {
    indiceAperto = indice;
    titolo.textContent = OCCHIALI[indice].nome;
    sovrapposizione.hidden = false;
    document.body.style.overflow = 'hidden';
    sovrapposizione.querySelector('.btn-chiudi-sovrapposizione').focus();

    occhialeAperto = null;
    let occhiale;
    try {
        occhiale = await caricaOcchiale(OCCHIALI[indice].file);
    } catch (errore) {
        titolo.textContent = OCCHIALI[indice].nome + ' – file non disponibile';
        return;
    }
    if (indiceAperto !== indice) return;   // nel frattempo è stato scelto un altro occhiale
    occhialeAperto = occhiale;
    cambiaModo(modo);
}

function chiudiSovrapposizione() {
    fermaProva();
    if (occhialeAperto && occhialeAperto.parent) occhialeAperto.parent.remove(occhialeAperto);
    rendererFinestra.setAnimationLoop(null);
    sovrapposizione.hidden = true;
    document.body.style.overflow = '';
    indiceAperto = -1;
    modoAperto = null;
}

sovrapposizione.querySelectorAll('[data-chiudi]').forEach(function (el) {
    el.addEventListener('click', chiudiSovrapposizione);
});
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !sovrapposizione.hidden) chiudiSovrapposizione();
});

bottoniModo.forEach(function (bottone) {
    bottone.addEventListener('click', function () {
        if (occhialeAperto) cambiaModo(bottone.dataset.modo);
    });
});

function cambiaModo(modo) {
    modoAperto = modo;
    bottoniModo.forEach(function (b) {
        b.classList.toggle('selected', b.dataset.modo === modo);
    });
    palcoGuarda.hidden = modo !== 'guarda';
    palcoProva.hidden = modo !== 'prova';

    if (modo === 'guarda') {
        fermaProva();
        apriGuarda();
    } else {
        apriProva();
    }
}


// ===== Guarda: l'occhiale in 3D da girare =====
function apriGuarda() {
    palcoGuarda.appendChild(rendererFinestra.domElement);
    rendererFinestra.setClearColor(0x000000, 1);
    occhialeAperto.scale.setScalar(1);
    occhialeAperto.quaternion.identity();
    studioGuarda.scena.add(occhialeAperto);
    ridimensionaGuarda();

    controlli.target.copy(inquadra(occhialeAperto, studioGuarda, cameraGuarda));
    // un po' più lontano, così girandolo non esce dall'inquadratura
    cameraGuarda.position.sub(controlli.target).multiplyScalar(1.15).add(controlli.target);
    controlli.minDistance = 0.6;
    controlli.maxDistance = 6;
    controlli.autoRotate = true;
    controlli.update();

    rendererFinestra.setAnimationLoop(function () {
        controlli.update();
        rendererFinestra.render(studioGuarda.scena, cameraGuarda);
    });
}

function ridimensionaGuarda() {
    const larghezza = palcoGuarda.clientWidth;
    const altezza = palcoGuarda.clientHeight;
    rendererFinestra.setSize(larghezza, altezza);
    cameraGuarda.aspect = larghezza / altezza;
    cameraGuarda.updateProjectionMatrix();
}


// =====================================================================
// ===== Provali adesso: l'occhiale sul viso
// =====================================================================
// MediaPipe trova i punti del viso (occhi, naso, fronte, mento) in ogni fotogramma;
// da quei punti calcolo dove mettere l'occhiale, quanto girarlo e quanto ingrandirlo

const specchio = document.getElementById('specchio');
const video = document.getElementById('video-prova');
const foto = document.getElementById('foto-prova');
const messaggio = document.getElementById('prova-messaggio');
const btnFotocamera = document.getElementById('btn-fotocamera');
const inputFoto = document.getElementById('input-foto');
const sliderMisuraProva = document.getElementById('slider-misura-prova');
const valoreMisuraProva = document.getElementById('valore-misura-prova');

const VERSIONE_MEDIAPIPE = '0.10.14';
const URL_MEDIAPIPE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + VERSIONE_MEDIAPIPE;
const URL_MODELLO_VISO = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// i punti del viso che uso (numerazione di MediaPipe)
const PUNTO = {
    occhioDestro: 33,     // angolo esterno dell'occhio destro
    occhioSinistro: 263,  // angolo esterno dell'occhio sinistro
    radiceNaso: 168,      // la radice del naso, dove appoggia il ponte
    fronte: 10,
    mento: 152
};

// quanto è largo l'occhiale rispetto alla distanza tra gli angoli esterni degli occhi
const LARGHEZZA_SU_OCCHI = 1.55;

let rilevatore = null;           // il FaceLandmarker, si crea alla prima prova
let rilevatorePromessa = null;
let modoRilevatore = 'VIDEO';
let flussoFotocamera = null;
let sorgente = null;             // 'fotocamera' o 'foto'
let ultimoTempoVideo = -1;
let misuraProva = 1;

// la scena della prova: camera ortografica in pixel dell'immagine, sfondo trasparente
const scenaProva = new THREE.Scene();
scenaProva.add(new THREE.HemisphereLight(0xffffff, 0x8a7f72, 1.2));
const luceProva = new THREE.DirectionalLight(0xffffff, 1.8);
luceProva.position.set(0.3, 0.6, 1);
scenaProva.add(luceProva);
scenaProva.environment = new THREE.PMREMGenerator(rendererFinestra).fromScene(new RoomEnvironment(), 0.04).texture;
const cameraProva = new THREE.OrthographicCamera(-1, 1, 1, -1, -5000, 5000);

// quanti visi al massimo riconosce insieme: ogni viso ha i suoi occhiali
const MAX_VOLTI = 5;

// ogni "testa" segue un viso; dentro ci sono una copia dell'occhiale e una testa invisibile
// che nasconde la stanghetta che finisce dietro la testa quando la giri
const geometriaTesta = new THREE.SphereGeometry(1, 32, 24);
const materialeTesta = new THREE.MeshBasicMaterial({ colorWrite: false });
const teste = [];
for (let i = 0; i < MAX_VOLTI; i++) {
    const gruppo = new THREE.Group();
    gruppo.matrixAutoUpdate = false;
    gruppo.visible = false;
    scenaProva.add(gruppo);

    const testaInvisibile = new THREE.Mesh(geometriaTesta, materialeTesta);
    testaInvisibile.position.set(0, -0.25, -1.0);
    testaInvisibile.scale.set(0.72, 1.15, 0.95);
    testaInvisibile.renderOrder = -1;   // si disegna per prima, così "copre" quello che c'è dietro
    gruppo.add(testaInvisibile);

    teste.push({
        gruppo: gruppo,
        occhiale: null,
        lisciato: false,                 // false = la prossima posizione si prende senza ammorbidire
        posizione: new THREE.Vector3(),
        rotazione: new THREE.Quaternion(),
        scala: 1
    });
}

function nascondiTeste() {
    teste.forEach(function (t) {
        t.gruppo.visible = false;
        t.lisciato = false;
    });
}

sliderMisuraProva.addEventListener('input', function () {
    misuraProva = sliderMisuraProva.value / 100;
    valoreMisuraProva.textContent = sliderMisuraProva.value + '%';
    if (sorgente === 'foto') disegnaFoto();
});

function scriviMessaggio(testo) {
    messaggio.textContent = testo;
}

function preparaRilevatore() {
    if (!rilevatorePromessa) {
        rilevatorePromessa = (async function () {
            const vision = await import(URL_MEDIAPIPE + '/vision_bundle.mjs');
            const fileset = await vision.FilesetResolver.forVisionTasks(URL_MEDIAPIPE + '/wasm');
            rilevatore = await vision.FaceLandmarker.createFromOptions(fileset, {
                baseOptions: { modelAssetPath: URL_MODELLO_VISO, delegate: 'GPU' },
                runningMode: 'VIDEO',
                numFaces: MAX_VOLTI
            });
            modoRilevatore = 'VIDEO';
            return rilevatore;
        })();
        rilevatorePromessa.catch(function () {
            rilevatorePromessa = null;   // si potrà riprovare
        });
    }
    return rilevatorePromessa;
}

async function usaModo(modo) {
    if (modoRilevatore !== modo) {
        await rilevatore.setOptions({ runningMode: modo });
        modoRilevatore = modo;
    }
}

function apriProva() {
    rendererFinestra.setAnimationLoop(null);
    specchio.appendChild(rendererFinestra.domElement);
    // qui la grandezza del canvas la decide il CSS (riempie lo specchio)
    rendererFinestra.domElement.style.width = '';
    rendererFinestra.domElement.style.height = '';
    rendererFinestra.setClearColor(0x000000, 0);
    // una copia dell'occhiale scelto per ogni testa (le copie condividono forme e materiali)
    teste.forEach(function (t) {
        if (t.occhiale) t.gruppo.remove(t.occhiale);
        t.occhiale = occhialeAperto.clone();
        t.occhiale.position.set(0, 0, 0);
        t.occhiale.quaternion.identity();
        t.gruppo.add(t.occhiale);
    });
    nascondiTeste();

    if (sorgente === 'foto' && foto.naturalWidth) {
        disegnaFoto();
    } else {
        avviaFotocamera();
    }
}

async function avviaFotocamera() {
    sorgente = 'fotocamera';
    foto.hidden = true;
    video.hidden = false;
    specchio.classList.add('specchiato');
    btnFotocamera.classList.add('selected');
    scriviMessaggio('Accendo la fotocamera…');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        scriviMessaggio('Questo browser non può usare la fotocamera: carica una foto del tuo viso.');
        return;
    }
    try {
        if (!flussoFotocamera) {
            flussoFotocamera = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false
            });
        }
        if (modoAperto !== 'prova' || sorgente !== 'fotocamera') return fermaFotocamera();
        video.srcObject = flussoFotocamera;
        await video.play();
        adattaSpecchio(video.videoWidth, video.videoHeight);

        scriviMessaggio('Preparo il riconoscimento del viso…');
        await preparaRilevatore();
        await usaModo('VIDEO');
        if (modoAperto !== 'prova' || sorgente !== 'fotocamera') return;
        scriviMessaggio('Guarda verso la fotocamera.');
        ultimoTempoVideo = -1;
        rendererFinestra.setAnimationLoop(fotogrammaFotocamera);
    } catch (errore) {
        console.error(errore);
        if (errore && (errore.name === 'NotAllowedError' || errore.name === 'NotFoundError' || errore.name === 'NotReadableError')) {
            scriviMessaggio('Non riesco ad accedere alla fotocamera: puoi caricare una foto del tuo viso.');
        } else {
            scriviMessaggio('Il riconoscimento del viso non si è caricato (serve la connessione a internet). Riprova.');
        }
    }
}

function fotogrammaFotocamera() {
    if (video.readyState < 2) return;
    if (video.currentTime !== ultimoTempoVideo) {
        ultimoTempoVideo = video.currentTime;
        const risultato = rilevatore.detectForVideo(video, performance.now());
        const trovati = posizionaOcchiali(risultato, video.videoWidth, video.videoHeight, true);
        scriviMessaggio(trovati > 1 ? 'Vedo ' + trovati + ' visi: occhiali per tutti!'
            : trovati === 1 ? 'Muovi la testa per vederli da più lati.'
            : 'Non vedo il viso: mettiti davanti alla fotocamera.');
    }
    rendererFinestra.render(scenaProva, cameraProva);
}

function fermaFotocamera() {
    if (flussoFotocamera) {
        flussoFotocamera.getTracks().forEach(function (traccia) { traccia.stop(); });
        flussoFotocamera = null;
    }
    video.pause();
    video.srcObject = null;
}

function fermaProva() {
    rendererFinestra.setAnimationLoop(null);
    fermaFotocamera();
    btnFotocamera.classList.remove('selected');
}

btnFotocamera.addEventListener('click', function () {
    rendererFinestra.setAnimationLoop(null);
    avviaFotocamera();
});

// ===== la foto caricata =====
inputFoto.addEventListener('change', function () {
    const file = inputFoto.files[0];
    if (!file) return;
    fermaProva();
    sorgente = 'foto';
    if (foto.src) URL.revokeObjectURL(foto.src);
    foto.src = URL.createObjectURL(file);
    foto.onload = function () {
        if (modoAperto === 'prova') disegnaFoto();
    };
    inputFoto.value = '';
});

async function disegnaFoto() {
    video.hidden = true;
    foto.hidden = false;
    specchio.classList.remove('specchiato');
    adattaSpecchio(foto.naturalWidth, foto.naturalHeight);
    scriviMessaggio('Cerco il viso nella foto…');
    try {
        await preparaRilevatore();
        await usaModo('IMAGE');
    } catch (errore) {
        console.error(errore);
        scriviMessaggio('Il riconoscimento del viso non si è caricato (serve la connessione a internet). Riprova.');
        return;
    }
    if (sorgente !== 'foto' || modoAperto !== 'prova') return;
    const risultato = rilevatore.detect(foto);
    const trovati = posizionaOcchiali(risultato, foto.naturalWidth, foto.naturalHeight, false);
    scriviMessaggio(trovati > 1 ? 'Ecco come vi stanno.'
        : trovati === 1 ? 'Ecco come ti stanno.'
        : 'Non trovo un viso in questa foto: provane un\'altra, ben illuminata e di fronte.');
    rendererFinestra.render(scenaProva, cameraProva);
}

// lo specchio prende le proporzioni dell'immagine (senza superare l'altezza dello schermo)
function adattaSpecchio(larghezza, altezza) {
    const proporzione = larghezza / altezza;
    specchio.style.aspectRatio = larghezza + ' / ' + altezza;
    specchio.style.width = 'min(100%, ' + (60 * proporzione).toFixed(2) + 'vh)';
    rendererFinestra.setSize(specchio.clientWidth, specchio.clientHeight, false);
    // la camera lavora nei pixel dell'immagine: così i punti del viso combaciano con il 3D
    cameraProva.left = -larghezza / 2;
    cameraProva.right = larghezza / 2;
    cameraProva.top = altezza / 2;
    cameraProva.bottom = -altezza / 2;
    cameraProva.updateProjectionMatrix();
}

// ===== da punti del viso a posizione degli occhiali =====
const asseX = new THREE.Vector3();
const asseY = new THREE.Vector3();
const asseZ = new THREE.Vector3();
const matriceViso = new THREE.Matrix4();
const scalaViso = new THREE.Vector3();

// un punto di MediaPipe (x e y da 0 a 1, z nella stessa scala di x) in pixel, con y verso l'alto
function puntoInPixel(punti, indice, larghezza, altezza) {
    const p = punti[indice];
    return new THREE.Vector3((p.x - 0.5) * larghezza, (0.5 - p.y) * altezza, -p.z * larghezza);
}

// da i punti di un viso calcolo dove va l'occhiale, come è girato e quanto è grande
function posaDelViso(punti, larghezza, altezza) {
    const occhioD = puntoInPixel(punti, PUNTO.occhioDestro, larghezza, altezza);
    const occhioS = puntoInPixel(punti, PUNTO.occhioSinistro, larghezza, altezza);
    const naso = puntoInPixel(punti, PUNTO.radiceNaso, larghezza, altezza);
    const fronte = puntoInPixel(punti, PUNTO.fronte, larghezza, altezza);
    const mento = puntoInPixel(punti, PUNTO.mento, larghezza, altezza);

    // gli assi del viso: x da un occhio all'altro, y dal mento alla fronte, z fuori dal viso
    asseX.subVectors(occhioS, occhioD);
    const distanzaOcchi = asseX.length();
    asseX.normalize();
    asseY.subVectors(fronte, mento);
    asseY.addScaledVector(asseX, -asseY.dot(asseX)).normalize();
    asseZ.crossVectors(asseX, asseY).normalize();

    // la posizione: in mezzo agli occhi, all'altezza della radice del naso in profondità
    const posizione = new THREE.Vector3().addVectors(occhioD, occhioS).multiplyScalar(0.5);
    const avanti = naso.clone().sub(posizione).dot(asseZ);
    posizione.addScaledVector(asseZ, avanti + distanzaOcchi * 0.04);

    matriceViso.makeBasis(asseX, asseY, asseZ);
    return {
        posizione: posizione,
        rotazione: new THREE.Quaternion().setFromRotationMatrix(matriceViso),
        scala: distanzaOcchi
    };
}

// mette un paio di occhiali su ogni viso trovato; restituisce quanti visi ha trovato
function posizionaOcchiali(risultato, larghezza, altezza, lisciare) {
    const visi = (risultato.faceLandmarks || []).slice(0, MAX_VOLTI).map(function (punti) {
        return posaDelViso(punti, larghezza, altezza);
    });

    // ogni viso va alla testa che era più vicina nel fotogramma prima,
    // così ognuno tiene i suoi occhiali e il movimento resta morbido anche con più persone
    const libere = teste.slice();
    const assegnate = visi.map(function (viso) {
        let migliore = -1;
        let distanzaMigliore = Infinity;
        libere.forEach(function (t, i) {
            if (!t.lisciato) return;
            const d = t.posizione.distanceTo(viso.posizione);
            if (d < distanzaMigliore && d < viso.scala * 1.5) {
                distanzaMigliore = d;
                migliore = i;
            }
        });
        return migliore >= 0 ? libere.splice(migliore, 1)[0] : null;
    });
    // i visi nuovi prendono una testa libera (prima quelle che non stavano seguendo nessuno)
    libere.sort(function (a, b) { return a.lisciato - b.lisciato; });
    visi.forEach(function (viso, i) {
        if (!assegnate[i]) {
            assegnate[i] = libere.shift();
            assegnate[i].lisciato = false;
        }
    });
    // le teste rimaste senza viso si nascondono
    libere.forEach(function (t) {
        t.gruppo.visible = false;
        t.lisciato = false;
    });

    visi.forEach(function (viso, i) {
        const t = assegnate[i];
        // movimento ammorbidito: gli occhiali non tremano
        if (lisciare && t.lisciato) {
            t.posizione.lerp(viso.posizione, 0.55);
            t.rotazione.slerp(viso.rotazione, 0.55);
            t.scala += (viso.scala - t.scala) * 0.4;
        } else {
            t.posizione.copy(viso.posizione);
            t.rotazione.copy(viso.rotazione);
            t.scala = viso.scala;
            t.lisciato = lisciare;
        }
        // dentro la testa l'unità di misura è la distanza tra gli occhi
        scalaViso.setScalar(t.scala);
        t.gruppo.matrix.compose(t.posizione, t.rotazione, scalaViso);
        t.gruppo.matrixWorldNeedsUpdate = true;
        t.occhiale.scale.setScalar(LARGHEZZA_SU_OCCHI * misuraProva);
        t.gruppo.visible = true;
    });

    return visi.length;
}

// ===== scattare una foto =====
// unisco in un'unica immagine quello che si vede nello specchio:
// sotto la fotocamera (o la foto caricata), sopra il 3D degli occhiali
const btnScatta = document.getElementById('btn-scatta');
const scatti = document.getElementById('scatti');
const scattiFila = document.getElementById('scatti-fila');
let numeroScatto = 0;

btnScatta.addEventListener('click', function () {
    let immagine, larghezza, altezza;
    if (sorgente === 'fotocamera' && video.readyState >= 2) {
        immagine = video;
        larghezza = video.videoWidth;
        altezza = video.videoHeight;
    } else if (sorgente === 'foto' && foto.naturalWidth) {
        immagine = foto;
        larghezza = foto.naturalWidth;
        altezza = foto.naturalHeight;
    } else {
        scriviMessaggio('Prima accendi la fotocamera o carica una foto.');
        return;
    }

    const tela = document.createElement('canvas');
    tela.width = larghezza;
    tela.height = altezza;
    const ctx = tela.getContext('2d');

    // con la fotocamera la foto viene "a specchio", come la si vede sullo schermo
    if (specchio.classList.contains('specchiato')) {
        ctx.translate(larghezza, 0);
        ctx.scale(-1, 1);
    }
    ctx.drawImage(immagine, 0, 0, larghezza, altezza);
    rendererFinestra.render(scenaProva, cameraProva);   // ridisegno subito gli occhiali, così sono di sicuro aggiornati
    ctx.drawImage(rendererFinestra.domElement, 0, 0, larghezza, altezza);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // in basso a sinistra il nome di chi ha progettato gli occhiali
    const nome = OCCHIALI[indiceAperto].nome;
    const grandezzaTesto = Math.round(altezza * 0.035);
    ctx.font = 'bold ' + grandezzaTesto + 'px Roboto, Helvetica, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = grandezzaTesto * 0.3;
    ctx.fillText('Visiting · occhiali di ' + nome, grandezzaTesto, altezza - grandezzaTesto);

    // il lampo bianco
    specchio.classList.remove('lampo');
    void specchio.offsetWidth;   // fa ripartire l'animazione anche se si scatta di nuovo subito
    specchio.classList.add('lampo');

    tela.toBlob(function (blob) {
        numeroScatto++;
        const nomeFile = 'occhiali-' + nome.toLowerCase().replace(/\s+/g, '-') + '-' + numeroScatto + '.png';
        const fileFoto = new File([blob], nomeFile, { type: 'image/png' });
        const indirizzo = URL.createObjectURL(blob);

        // ogni foto: la miniatura (cliccandola si scarica) e il bottone per condividerla
        const scatto = document.createElement('div');
        scatto.className = 'scatto';

        const link = document.createElement('a');
        link.href = indirizzo;
        link.download = nomeFile;
        link.title = 'Scarica la foto';
        const miniatura = document.createElement('img');
        miniatura.src = indirizzo;
        miniatura.alt = 'Foto ' + numeroScatto + ' con gli occhiali di ' + nome;
        link.appendChild(miniatura);

        const btnWhatsapp = document.createElement('button');
        btnWhatsapp.type = 'button';
        btnWhatsapp.className = 'btn-whatsapp';
        btnWhatsapp.textContent = 'Condividi su WhatsApp';
        btnWhatsapp.addEventListener('click', function () {
            condividiFoto(fileFoto, link);
        });

        scatto.appendChild(link);
        scatto.appendChild(btnWhatsapp);
        scattiFila.prepend(scatto);   // l'ultima foto per prima
        scatti.hidden = false;
    }, 'image/png');
});

// condivido SOLO la foto, senza testo né link: si apre il menu "Condividi"
// del telefono (o del computer) e lì si sceglie WhatsApp.
// (un link a WhatsApp può mandare solo testo, non immagini: per questo uso la condivisione del sistema)
async function condividiFoto(fileFoto, link) {
    if (navigator.canShare && navigator.canShare({ files: [fileFoto] })) {
        try {
            await navigator.share({ files: [fileFoto] });
        } catch (errore) {
            // se la persona chiude il menu senza condividere non è un errore da segnalare
            if (errore.name !== 'AbortError') {
                console.error(errore);
                scriviMessaggio('Non sono riuscito a condividere la foto: scaricala e mandala da WhatsApp.');
            }
        }
    } else {
        // questo browser non sa condividere i file: scarico la foto, così si può allegare in WhatsApp
        link.click();
        scriviMessaggio('Da qui non si può condividere direttamente: ho scaricato la foto, allegala in una chat di WhatsApp.');
    }
}

window.addEventListener('resize', function () {
    if (sovrapposizione.hidden) return;
    if (modoAperto === 'guarda') ridimensionaGuarda();
    if (modoAperto === 'prova') {
        rendererFinestra.setSize(specchio.clientWidth, specchio.clientHeight, false);
        if (sorgente === 'foto') rendererFinestra.render(scenaProva, cameraProva);
    }
});
