// ============================================
// CONFIGURAZIONE TRACCE
// ============================================
// Le canzoni vengono caricate automaticamente dalla cartella /music
// Formato nome file: "Artista - Titolo canzone.mp3"
// 
// IMMAGINI DI COPERTINA:
// - Cerca automaticamente in /images con lo stesso nome del file MP3
// - Prova prima .jpg, poi .png, poi usa /images/cover.jpg come fallback
// - Esempio: "Aerosmith - I Don't Want to Miss a Thing.mp3" 
//   cerca "Aerosmith - I Don't Want to Miss a Thing.jpg" o ".png"
//
// VIDEO CANVAS:
// - Cerca automaticamente in /videos con lo stesso nome del file MP3 ma con estensione .mp4
// - Esempio: "Aerosmith - I Don't Want to Miss a Thing.mp3"
//   cerca "Aerosmith - I Don't Want to Miss a Thing.mp4"

// Lista dei file MP3 nella cartella music
const musicFiles = [
    "Lady Gaga - Die With A Smile.mp3",
    "Alex Warren - Eternity.mp3",
    "Tom Odell - Grow Old with Me.mp3",
    "Aerosmith - I Don't Want to Miss a Thing.mp3",
    "Bill Medley & Jennifer Warnes - (I've had) The Time Of My Life.mp3",
    "Bruno Mars - Just the Way you are.mp3",
    "Ed Sheeran - Perfect Symphony (ft. Andrea Bocelli).mp3",
    "Elvis Presley - Burning Love.mp3",
    "Giorgia - È l'amore che conta.mp3",
    "Harry James & His Orchestra - It's Been a Long, Long Time.mp3",
    "Il Volo - Capolavoro.mp3",
    "Imagine Dragons - Next To Me.mp3",
    "John Legend - All of Me.mp3",
    "Jovanotti - Come Musica.mp3",
    "Laura Chiatti - Il mio nuovo sogno.mp3",
    "Luca Laurenti - La mia Evangeline.mp3",
    "Marvin Berry and the Starlighters - Earth Angel.mp3",
    "Queen - Love of My Life.mp3",
    "Sebastian Yatra - Dos Oruguitas.mp3",
    "Simone Iuè - In ogni parte del mio corazon.mp3",
    "Ultimo - Poesia senza veli.mp3",
    "Zac Efron - Rewrite The Stars.mp3"
];

// Funzione per parsare il nome del file e estrarre artista e titolo
function parseFileName(fileName) {
    // Rimuove l'estensione .mp3
    const nameWithoutExt = fileName.replace(/\.mp3$/i, '');
    // Divide per " - " (spazio, trattino, spazio)
    const parts = nameWithoutExt.split(' - ');
    
    if (parts.length >= 2) {
        return {
            artist: parts[0].trim(),
            title: parts.slice(1).join(' - ').trim() // Usa slice per gestire titoli con " - " nel nome
        };
    } else {
        // Se non c'è il formato corretto, usa tutto come titolo
        return {
            artist: '',
            title: nameWithoutExt.trim()
        };
    }
}

// Genera automaticamente l'array tracks
const tracks = musicFiles.map((fileName, index) => {
    const parsed = parseFileName(fileName);
    const trackTitle = parsed.artist && parsed.title 
        ? `${parsed.artist} - ${parsed.title}` 
        : parsed.title || fileName;
    
    // Cerca un video corrispondente nella cartella videos
    // Il video dovrebbe avere lo stesso nome del file MP3 ma con estensione .mp4
    const videoFileName = fileName.replace(/\.mp3$/i, '.mp4');
    const videoPath = `videos/${videoFileName}`;
    
    // Cerca un'immagine di copertina corrispondente nella cartella images
    // L'immagine dovrebbe avere lo stesso nome del file MP3 ma con estensione .jpg o .png
    const imageNameWithoutExt = fileName.replace(/\.mp3$/i, '');
    const coverPathJpg = `images/${imageNameWithoutExt}.jpg`;
    const coverPathPng = `images/${imageNameWithoutExt}.png`;
    // Usa .jpg come default, ma verrà verificato se esiste
    const coverPath = coverPathJpg;
    
    return {
        title: trackTitle,
        artist: parsed.artist || '', // Nome dell'artista
        songTitle: parsed.title || fileName, // Solo il titolo della canzone
        file: `music/${fileName}`,
        cover: coverPath, // L'immagine verrà verificata quando viene caricata
        canvas: videoPath // Il video verrà verificato quando viene caricato
    };
});

// ============================================
// VARIABILI GLOBALI
// ============================================
let currentTrackIndex = 0;
let isPlaying = false;
let isShuffleActive = false;
let isRepeatActive = false;
let audioContext = null;

// Cache per le risorse pre-caricate
const imageCache = new Map(); // Cache delle immagini
const audioCache = new Map(); // Cache degli audio (per metadata)

// Elementi DOM
const audioPlayer = document.getElementById('audioPlayer');
const trackList = document.getElementById('trackList');
const albumCover = document.getElementById('albumCover');
const canvasVideo = document.getElementById('canvasVideo');
const trackTitle = document.getElementById('trackTitle');
const trackArtist = document.getElementById('trackArtist');
const playPauseBtn = document.getElementById('playPauseBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const repeatBtn = document.getElementById('repeatBtn');
const progressBar = document.getElementById('progressBar');
const progressFill = document.getElementById('progressFill');
const currentTimeEl = document.getElementById('currentTime');
const totalTimeEl = document.getElementById('totalTime');
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.querySelector('.sidebar');

// ============================================
// INIZIALIZZAZIONE
// ============================================
async function init() {
    // Genera la lista delle tracce
    renderTrackList();
    
    // Setup event listeners
    setupEventListeners();
    
    // Avvia il preload delle risorse in background
    preloadAllResources().then(() => {
        console.log('Tutte le risorse sono state pre-caricate');
    });
    
    // Carica il primo brano (senza riprodurlo)
    if (tracks.length > 0) {
        await loadTrack(0);
    }
}

// ============================================
// RENDERING TRACKLIST
// ============================================
function renderTrackList() {
    trackList.innerHTML = '';
    
    tracks.forEach((track, index) => {
        const li = document.createElement('li');
        li.className = 'track-item';
        if (index === currentTrackIndex) {
            li.classList.add('active');
        }
        
        li.innerHTML = `
            <span class="track-number">${String(index + 1).padStart(2, '0')}</span>
            <span class="track-title-item">${track.songTitle}</span>
        `;
        
        li.addEventListener('click', async () => {
            await loadTrack(index);
            playTrack();
        });
        
        trackList.appendChild(li);
    });
}

// ============================================
// PRELOAD RISORSE
// ============================================
function preloadImage(src) {
    return new Promise((resolve, reject) => {
        // Controlla se l'immagine è già in cache
        if (imageCache.has(src)) {
            resolve(imageCache.get(src));
            return;
        }
        
        const img = new Image();
        img.onload = () => {
            imageCache.set(src, img);
            resolve(img);
        };
        img.onerror = () => {
            reject(new Error(`Failed to load image: ${src}`));
        };
        img.src = src;
    });
}

function preloadAudio(src) {
    return new Promise((resolve, reject) => {
        // Controlla se l'audio è già in cache
        if (audioCache.has(src)) {
            resolve(audioCache.get(src));
            return;
        }
        
        const audio = new Audio();
        audio.preload = 'metadata';
        
        audio.addEventListener('loadedmetadata', () => {
            audioCache.set(src, audio);
            resolve(audio);
        }, { once: true });
        
        audio.addEventListener('error', () => {
            reject(new Error(`Failed to load audio: ${src}`));
        }, { once: true });
        
        audio.src = src;
    });
}

async function preloadImageFromPaths(paths) {
    // Prova a caricare la prima immagine disponibile dalla lista di percorsi
    for (const path of paths) {
        try {
            await preloadImage(path);
            return path; // Restituisce il percorso dell'immagine caricata
        } catch (error) {
            // Continua con il prossimo percorso
            continue;
        }
    }
    // Se nessuna immagine è stata trovata, prova il fallback
    try {
        await preloadImage('images/cover.jpg');
        return 'images/cover.jpg';
    } catch (error) {
        throw new Error('Nessuna immagine disponibile');
    }
}

async function preloadAllResources() {
    console.log('Inizio preload delle risorse...');
    const preloadPromises = [];
    
    tracks.forEach((track, index) => {
        // Preload immagini
        const imageNameWithoutExt = track.file.replace(/^music\//, '').replace(/\.mp3$/i, '');
        const possibleImagePaths = [
            `images/cover/${imageNameWithoutExt}.jpg`,
            `images/cover/${imageNameWithoutExt}.png`,
            `images/${imageNameWithoutExt}.jpg`,
            `images/${imageNameWithoutExt}.png`
        ];
        
        // Prova a preloadare la prima immagine disponibile
        preloadPromises.push(
            preloadImageFromPaths(possibleImagePaths).catch(() => {
                // Ignora errori, useremo il fallback quando necessario
                console.warn(`Impossibile preloadare immagine per traccia ${index + 1}`);
            })
        );
        
        // Preload audio metadata
        preloadPromises.push(
            preloadAudio(track.file).catch(() => {
                console.warn(`Impossibile preloadare audio per traccia ${index + 1}`);
            })
        );
    });
    
    // Attendi che tutte le risorse siano caricate (o fallite)
    await Promise.allSettled(preloadPromises);
    console.log('Preload completato');
}

// ============================================
// CARICAMENTO IMMAGINI DI COPERTINA
// ============================================
async function loadCoverImage(musicFilePath) {
    // Estrae il nome del file senza estensione
    const imageNameWithoutExt = musicFilePath.replace(/^music\//, '').replace(/\.mp3$/i, '');
    
    // Lista di possibili percorsi da provare (in ordine di priorità)
    const possiblePaths = [
        `images/cover/${imageNameWithoutExt}.jpg`,  // Prima prova nella cartella cover
        `images/cover/${imageNameWithoutExt}.png`,
        `images/${imageNameWithoutExt}.jpg`,         // Poi prova direttamente in images
        `images/${imageNameWithoutExt}.png`
    ];
    
    // Funzione helper per impostare l'immagine e attendere il caricamento
    const setImageAndWait = (src) => {
        return new Promise((resolve) => {
            // Rimuovi tutti gli handler precedenti
            albumCover.onload = null;
            albumCover.onerror = null;
            
            // Se l'immagine è già caricata, risolvi immediatamente
            if (albumCover.src === src && albumCover.complete) {
                resolve();
                return;
            }
            
            // Imposta i nuovi handler
            const onLoad = () => {
                albumCover.onload = null;
                albumCover.onerror = null;
                resolve();
            };
            
            const onError = () => {
                albumCover.onload = null;
                albumCover.onerror = null;
                resolve(); // Continua anche in caso di errore
            };
            
            albumCover.onload = onLoad;
            albumCover.onerror = onError;
            
            // Imposta il src (questo triggera il caricamento)
            albumCover.src = src;
            
            // Se l'immagine è già in cache del browser, potrebbe essere immediata
            if (albumCover.complete) {
                onLoad();
            }
        });
    };
    
    // Prova a caricare l'immagine dalla cache o dal percorso
    for (const path of possiblePaths) {
        if (imageCache.has(path)) {
            // Usa l'immagine dalla cache
            await setImageAndWait(path);
            return;
        }
        
        try {
            await preloadImage(path);
            await setImageAndWait(path);
            return;
        } catch (error) {
            // Continua con il prossimo percorso
            continue;
        }
    }
    
    // Se nessuna immagine è stata trovata, usa il fallback
    try {
        const fallbackPath = 'images/cover.jpg';
        if (!imageCache.has(fallbackPath)) {
            await preloadImage(fallbackPath);
        }
        await setImageAndWait(fallbackPath);
    } catch (error) {
        console.warn('Nessuna immagine di copertina disponibile');
        // Continua comunque senza bloccare
    }
}

// ============================================
// CARICAMENTO TRACCE
// ============================================
async function loadTrack(index) {
    if (index < 0 || index >= tracks.length) return;
    
    currentTrackIndex = index;
    const track = tracks[index];
    
    // Aggiorna artista e titolo immediatamente
    if (track.artist) {
        trackArtist.textContent = track.artist;
        trackTitle.textContent = track.songTitle;
    } else {
        trackArtist.textContent = '';
        trackTitle.textContent = track.songTitle || 'Seleziona una traccia';
    }
    
    // Aggiorna lista tracce (evidenzia quella attiva)
    updateActiveTrack();
    
    // Reset progress bar
    progressFill.style.width = '0%';
    currentTimeEl.textContent = '0:00';
    
    // Carica audio e immagine in parallelo
    await Promise.allSettled([
        (async () => {
            try {
                // Se l'audio è in cache, usa quello, altrimenti carica normalmente
                if (audioCache.has(track.file)) {
                    const cachedAudio = audioCache.get(track.file);
                    audioPlayer.src = track.file;
                    audioPlayer.load();
                    // La durata dovrebbe essere già disponibile
                    if (cachedAudio.duration && !isNaN(cachedAudio.duration)) {
                        totalTimeEl.textContent = formatTime(cachedAudio.duration);
                    } else {
                        // Se la durata non è disponibile, aspetta i metadata
                        await new Promise((resolve) => {
                            const timeout = setTimeout(() => {
                                totalTimeEl.textContent = '0:00';
                                resolve();
                            }, 3000);
                            
                            audioPlayer.addEventListener('loadedmetadata', () => {
                                clearTimeout(timeout);
                                totalTimeEl.textContent = formatTime(audioPlayer.duration);
                                resolve();
                            }, { once: true });
                        });
                    }
                } else {
                    audioPlayer.src = track.file;
                    audioPlayer.load();
                    // Attendi che i metadata siano caricati
                    await new Promise((resolve) => {
                        const timeout = setTimeout(() => {
                            // Timeout: continua comunque senza bloccare
                            totalTimeEl.textContent = '0:00';
                            resolve();
                        }, 10000); // Timeout più lungo per connessioni lente
                        
                        audioPlayer.addEventListener('loadedmetadata', () => {
                            clearTimeout(timeout);
                            totalTimeEl.textContent = formatTime(audioPlayer.duration);
                            resolve();
                        }, { once: true });
                        
                        audioPlayer.addEventListener('error', () => {
                            clearTimeout(timeout);
                            totalTimeEl.textContent = '0:00';
                            resolve(); // Continua anche in caso di errore
                        }, { once: true });
                    });
                }
            } catch (error) {
                console.warn('Errore nel caricamento audio:', error);
                totalTimeEl.textContent = '0:00';
            }
        })(),
        loadCoverImage(track.file)
    ]);
    
    // L'immagine è già stata caricata in parallelo con l'audio sopra
    
    // Aggiorna canvas video (come background del player-panel)
    if (track.canvas) {
        canvasVideo.src = track.canvas;
        canvasVideo.load();
        // Verifica se il video può essere caricato
        canvasVideo.addEventListener('loadeddata', () => {
            canvasVideo.classList.add('active');
        }, { once: true });
        canvasVideo.addEventListener('error', () => {
            // Se il video non esiste, rimuovi la classe active
            canvasVideo.classList.remove('active');
            canvasVideo.src = '';
        }, { once: true });
    } else {
        canvasVideo.classList.remove('active');
        canvasVideo.src = '';
    }
}

// ============================================
// CONTROLLI RIPRODUZIONE
// ============================================
function playTrack() {
    audioPlayer.play()
        .then(() => {
            isPlaying = true;
            updatePlayPauseButton();
            if (canvasVideo.classList.contains('active')) {
                canvasVideo.play();
            }
        })
        .catch(error => {
            console.error('Errore nella riproduzione:', error);
        });
}

function pauseTrack() {
    audioPlayer.pause();
    isPlaying = false;
    updatePlayPauseButton();
    if (canvasVideo.classList.contains('active')) {
        canvasVideo.pause();
    }
}

function togglePlayPause() {
    if (isPlaying) {
        pauseTrack();
    } else {
        playTrack();
    }
}

function updatePlayPauseButton() {
    const playIcon = document.getElementById('playIcon');
    const pauseIcon = document.getElementById('pauseIcon');
    
    if (isPlaying) {
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
    } else {
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
    }
}

// ============================================
// NAVIGAZIONE TRACCE
// ============================================
async function playNext() {
    if (isShuffleActive) {
        await playRandomTrack();
    } else {
        const nextIndex = (currentTrackIndex + 1) % tracks.length;
        await loadTrack(nextIndex);
        playTrack();
    }
}

async function playPrev() {
    if (audioPlayer.currentTime > 3) {
        // Se siamo oltre i 3 secondi, torna all'inizio
        audioPlayer.currentTime = 0;
    } else {
        // Altrimenti vai alla traccia precedente
        if (isShuffleActive) {
            await playRandomTrack();
        } else {
            const prevIndex = (currentTrackIndex - 1 + tracks.length) % tracks.length;
            await loadTrack(prevIndex);
            playTrack();
        }
    }
}

async function playRandomTrack() {
    let randomIndex;
    do {
        randomIndex = Math.floor(Math.random() * tracks.length);
    } while (randomIndex === currentTrackIndex && tracks.length > 1);
    
    await loadTrack(randomIndex);
    playTrack();
}

// ============================================
// SHUFFLE E REPEAT
// ============================================
function toggleShuffle() {
    isShuffleActive = !isShuffleActive;
    shuffleBtn.classList.toggle('active', isShuffleActive);
}

function toggleRepeat() {
    isRepeatActive = !isRepeatActive;
    repeatBtn.classList.toggle('active', isRepeatActive);
}

// ============================================
// BARRA DI AVANZAMENTO
// ============================================
function updateProgress() {
    if (audioPlayer.duration) {
        const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        progressFill.style.width = progress + '%';
        currentTimeEl.textContent = formatTime(audioPlayer.currentTime);
    }
}

function seekTo(event) {
    const progressBarWrapper = event.currentTarget;
    const rect = progressBarWrapper.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percentage = x / rect.width;
    
    if (audioPlayer.duration) {
        audioPlayer.currentTime = percentage * audioPlayer.duration;
    }
}

// ============================================
// UTILITY
// ============================================
function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function updateActiveTrack() {
    const trackItems = document.querySelectorAll('.track-item');
    trackItems.forEach((item, index) => {
        if (index === currentTrackIndex) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

// ============================================
// EVENT LISTENERS
// ============================================
function setupEventListeners() {
    // Play/Pause
    playPauseBtn.addEventListener('click', togglePlayPause);
    
    // Navigazione
    nextBtn.addEventListener('click', playNext);
    prevBtn.addEventListener('click', playPrev);
    
    // Shuffle e Repeat
    shuffleBtn.addEventListener('click', toggleShuffle);
    repeatBtn.addEventListener('click', toggleRepeat);
    
    // Barra di avanzamento
    const progressBarWrapper = document.querySelector('.progress-bar-wrapper');
    progressBarWrapper.addEventListener('click', seekTo);
    
    // Aggiornamento progresso
    audioPlayer.addEventListener('timeupdate', updateProgress);
    
    // Fine traccia
    audioPlayer.addEventListener('ended', () => {
        if (isRepeatActive) {
            // Riproduci la stessa traccia
            audioPlayer.currentTime = 0;
            playTrack();
        } else if (isShuffleActive) {
            // Riproduci traccia casuale
            playRandomTrack();
        } else {
            // Passa alla successiva
            playNext();
        }
    });
    
    // Menu mobile
    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        menuToggle.classList.toggle('active');
    });
    
    // Chiudi menu quando si clicca fuori (mobile)
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                sidebar.classList.remove('open');
                menuToggle.classList.remove('active');
            }
        }
    });
}

// ============================================
// SERVICE WORKER REGISTRATION
// ============================================
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/service-worker.js', {
                scope: '/'
            });
            console.log('[Service Worker] Registrato con successo:', registration.scope);
            
            // Controlla lo stato del service worker
            if (registration.installing) {
                console.log('[Service Worker] Installazione in corso...');
            } else if (registration.waiting) {
                console.log('[Service Worker] In attesa di attivazione...');
            } else if (registration.active) {
                console.log('[Service Worker] Attivo e funzionante');
            }
            
            // Controlla se c'è un aggiornamento disponibile
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                console.log('[Service Worker] Trovato aggiornamento');
                
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log('[Service Worker] Nuova versione disponibile');
                        // Potresti mostrare un messaggio all'utente per aggiornare
                    } else if (newWorker.state === 'activated') {
                        console.log('[Service Worker] Nuova versione attivata');
                    }
                });
            });
            
            // Verifica periodicamente gli aggiornamenti
            setInterval(() => {
                registration.update();
            }, 60000); // Controlla ogni minuto
            
        } catch (error) {
            console.error('[Service Worker] Errore durante la registrazione:', error);
        }
    } else {
        console.warn('[Service Worker] Non supportato in questo browser');
    }
}

// Registra il service worker all'avvio
registerServiceWorker();

// ============================================
// HERO SECTION
// ============================================
const heroSection = document.getElementById('heroSection');
const mainContainer = document.getElementById('mainContainer');
const startPlayerBtn = document.getElementById('startPlayerBtn');

async function showPlayer() {
    heroSection.classList.add('hidden');
    setTimeout(async () => {
        mainContainer.style.display = 'flex';
        // Inizializza il player dopo che la hero è nascosta
        if (!window.playerInitialized) {
            await init();
            window.playerInitialized = true;
        }
    }, 300);
}

startPlayerBtn.addEventListener('click', showPlayer);

// ============================================
// AVVIO
// ============================================
// Non inizializzare automaticamente, aspetta il click sulla hero
// init();

