// ============================================
// CONFIGURAZIONE TRACCE
// ============================================
// La playlist e i relativi asset sono definiti in soundtrack-catalog.js.
// Audio, cover, video e lyrics usano percorsi espliciti: nessuna derivazione
// da vecchie versioni della playlist e nessun preload globale implicito.

// Catalogo canonico condiviso con il Service Worker.
const catalogAssets = globalThis.SOUNDTRACK_CATALOG;
if (!Array.isArray(catalogAssets) || catalogAssets.length === 0) {
  throw new Error("Soundtrack catalog non disponibile.");
}

// Funzione per parsare il nome del file e estrarre artista e titolo
function parseFileName(fileName) {
  const nameWithoutExt = fileName.replace(/\.mp3$/i, "");
  const parts = nameWithoutExt.split(" - ");

  if (parts.length >= 2) {
    return {
      artist: parts[0].trim(),
      title: parts.slice(1).join(" - ").trim(),
    };
  }

  return {
    artist: "",
    title: nameWithoutExt.trim(),
  };
}

// Genera l'array player dalla stessa fonte di verità usata dal PWA.
const tracks = catalogAssets.map((asset) => {
  const parsed = parseFileName(asset.file);
  const trackTitle =
    parsed.artist && parsed.title
      ? `${parsed.artist} - ${parsed.title}`
      : parsed.title || asset.file;

  return {
    title: trackTitle,
    artist: parsed.artist || "",
    songTitle: parsed.title || asset.file,
    file: asset.audio,
    cover: asset.cover,
    canvas: asset.video,
    lyrics: asset.lyrics,
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
let isDragging = false; // Stato per il trascinamento della barra

// Cache per le risorse pre-caricate
const imageCache = new Map(); // Cache delle immagini

// Elementi DOM
const audioPlayer = document.getElementById("audioPlayer");
const trackList = document.getElementById("trackList");
const albumCover = document.getElementById("albumCover");
const canvasVideo = document.getElementById("canvasVideo");
const trackTitle = document.getElementById("trackTitle");
const trackArtist = document.getElementById("trackArtist");
const preloadScreen = document.getElementById("preloadScreen");
const playPauseBtn = document.getElementById("playPauseBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const shuffleBtn = document.getElementById("shuffleBtn");
const repeatBtn = document.getElementById("repeatBtn");
const progressBar = document.getElementById("progressBar");
const progressFill = document.getElementById("progressFill");
const currentTimeEl = document.getElementById("currentTime");
const totalTimeEl = document.getElementById("totalTime");
const menuToggle = document.getElementById("menuToggle");
const sidebar = document.querySelector(".sidebar");
const seekTooltip = document.getElementById("seekTooltip");
const lyricsText = document.getElementById("lyricsText");
const lyricsToggle = document.getElementById("lyricsToggle");
const lyricsContent = document.getElementById("lyricsContent");
const offlineDownloadControl = document.getElementById("offlineDownloadControl");
const offlineProgressRing = document.getElementById("offlineProgressRing");
const offlinePercent = document.getElementById("offlinePercent");
const offlineDownloadGlyph = document.getElementById("offlineDownloadGlyph");
const offlineCheckGlyph = document.getElementById("offlineCheckGlyph");

// ============================================
// INIZIALIZZAZIONE
// ============================================
async function init() {
  // Genera la lista delle tracce
  renderTrackList();

  // Setup event listeners
  setupEventListeners();

  // Nessun preload globale: i media vengono caricati solo quando servono.
  // Carica il primo brano (senza riprodurlo e senza mostrare preload)
  if (tracks.length > 0) {
    await loadTrack(0, true);
  }
}

// ============================================
// RENDERING TRACKLIST
// ============================================
function renderTrackList() {
  trackList.innerHTML = "";

  tracks.forEach((track, index) => {
    const li = document.createElement("li");
    li.className = "track-item";
    if (index === currentTrackIndex) {
      li.classList.add("active");
    }

    li.innerHTML = `
            <span class="track-number">${String(index + 1).padStart(
              2,
              "0"
            )}</span>
            <span class="track-title-item">${track.songTitle}</span>
        `;

    li.addEventListener("click", async () => {
      // MODIFICA: Chiudi il menu mobile se aperto
      if (window.innerWidth <= 768) {
        sidebar.classList.remove("open");
        menuToggle.classList.remove("active");
      }

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

// ============================================
// CARICAMENTO IMMAGINI DI COPERTINA
// ============================================
async function loadCoverImage(coverPath) {
  const fallbackPath = "images/Album cover front.jpg";

  const setImageAndWait = (src) =>
    new Promise((resolve) => {
      albumCover.onload = () => resolve();
      albumCover.onerror = () => resolve();
      albumCover.src = src;
      if (albumCover.complete) resolve();
    });

  try {
    if (!imageCache.has(coverPath)) {
      await preloadImage(coverPath);
    }
    await setImageAndWait(coverPath);
  } catch (error) {
    console.warn("Cover non disponibile, uso fallback:", coverPath);
    try {
      if (!imageCache.has(fallbackPath)) {
        await preloadImage(fallbackPath);
      }
      await setImageAndWait(fallbackPath);
    } catch {
      console.warn("Fallback cover non disponibile");
    }
  }
}

// ============================================
// CARICAMENTO TRACCE
// ============================================
async function loadTrack(index, showPreload = true) {
  if (index < 0 || index >= tracks.length) return;

  currentTrackIndex = index;
  const track = tracks[index];

  // Gestione Preload con Debounce
  // Mostra la schermata di preload solo se il caricamento impiega più di 100ms
  let preloadTimer = null;

  if (showPreload) {
    preloadTimer = setTimeout(() => {
      preloadScreen.classList.add("active");
    }, 100);
  }

  // Aggiorna artista e titolo immediatamente
  if (track.artist) {
    trackArtist.textContent = track.artist;
    trackTitle.textContent = track.songTitle;
  } else {
    trackArtist.textContent = "";
    trackTitle.textContent = track.songTitle || "Seleziona una traccia";
  }

  // Aggiorna lista tracce (evidenzia quella attiva)
  updateActiveTrack();

  // Carica i testi della canzone
  loadLyrics(track.lyrics);

  // Reset progress bar
  progressFill.style.width = "0%";
  currentTimeEl.textContent = "0:00";

  // Promesse per tracciare il caricamento di tutte le risorse
  const loadPromises = [];

  // Carica solo l'audio della traccia selezionata.
  const audioPromise = (async () => {
    try {
      audioPlayer.src = track.file;
      audioPlayer.load();

      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          totalTimeEl.textContent = "0:00";
          resolve();
        }, 10000);

        audioPlayer.addEventListener(
          "loadedmetadata",
          () => {
            clearTimeout(timeout);
            totalTimeEl.textContent = formatTime(audioPlayer.duration);
            resolve();
          },
          { once: true }
        );

        audioPlayer.addEventListener(
          "error",
          () => {
            clearTimeout(timeout);
            totalTimeEl.textContent = "0:00";
            resolve();
          },
          { once: true }
        );
      });
    } catch (error) {
      console.warn("Errore nel caricamento audio:", error);
      totalTimeEl.textContent = "0:00";
    }
  })();
  loadPromises.push(audioPromise);

  // Carica immagine
  const imagePromise = loadCoverImage(track.cover);
  loadPromises.push(imagePromise);

  // Carica video (se presente)
  const videoPromise = new Promise((resolve) => {
    if (track.canvas) {
      canvasVideo.src = track.canvas;
      canvasVideo.load();

      let videoLoaded = false;
      let videoErrored = false;

      const onLoaded = () => {
        if (!videoLoaded && !videoErrored) {
          videoLoaded = true;
          canvasVideo.classList.add("active");
          resolve();
        }
      };

      const onError = () => {
        if (!videoLoaded && !videoErrored) {
          videoErrored = true;
          canvasVideo.classList.remove("active");
          canvasVideo.src = "";
          resolve(); // Risolvi comunque per non bloccare
        }
      };

      canvasVideo.addEventListener("loadeddata", onLoaded, { once: true });
      canvasVideo.addEventListener("canplay", onLoaded, { once: true });
      canvasVideo.addEventListener("error", onError, { once: true });

      // Timeout per il video
      setTimeout(() => {
        if (!videoLoaded && !videoErrored) {
          videoErrored = true;
          canvasVideo.classList.remove("active");
          canvasVideo.src = "";
          resolve();
        }
      }, 5000);
    } else {
      canvasVideo.classList.remove("active");
      canvasVideo.src = "";
      resolve();
    }
  });
  loadPromises.push(videoPromise);

  // Attendi che tutte le risorse siano pronte
  await Promise.allSettled(loadPromises);

  // Pulisci il timer del preload (se il caricamento è stato veloce, il preload non apparirà mai)
  if (preloadTimer) {
    clearTimeout(preloadTimer);
  }

  // Nascondi la schermata di preload (se era visibile)
  preloadScreen.classList.remove("active");
}

// ============================================
// CONTROLLI RIPRODUZIONE
// ============================================
function playTrack() {
  audioPlayer
    .play()
    .then(() => {
      isPlaying = true;
      updatePlayPauseButton();
      if (canvasVideo.classList.contains("active")) {
        canvasVideo.play();
      }
    })
    .catch((error) => {
      console.error("Errore nella riproduzione:", error);
    });
}

function pauseTrack() {
  audioPlayer.pause();
  isPlaying = false;
  updatePlayPauseButton();
  if (canvasVideo.classList.contains("active")) {
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
  const playIcon = document.getElementById("playIcon");
  const pauseIcon = document.getElementById("pauseIcon");

  if (isPlaying) {
    playIcon.style.display = "none";
    pauseIcon.style.display = "block";
  } else {
    playIcon.style.display = "block";
    pauseIcon.style.display = "none";
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
  shuffleBtn.classList.toggle("active", isShuffleActive);

  // Se attiviamo shuffle, disattiviamo repeat
  if (isShuffleActive && isRepeatActive) {
    isRepeatActive = false;
    repeatBtn.classList.remove("active");
  }

  // Aggiungi un feedback visivo quando si attiva/disattiva
  if (isShuffleActive) {
    shuffleBtn.style.transform = "scale(1.2)";
    setTimeout(() => {
      shuffleBtn.style.transform = "";
    }, 200);
  }
}

function toggleRepeat() {
  isRepeatActive = !isRepeatActive;
  repeatBtn.classList.toggle("active", isRepeatActive);

  // Se attiviamo repeat, disattiviamo shuffle
  if (isRepeatActive && isShuffleActive) {
    isShuffleActive = false;
    shuffleBtn.classList.remove("active");
  }
}

// ============================================
// BARRA DI AVANZAMENTO
// ============================================
function updateProgress() {
  // Aggiorna solo se NON stiamo trascinando
  if (audioPlayer.duration && !isDragging) {
    const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    progressFill.style.width = progress + "%";
    currentTimeEl.textContent = formatTime(audioPlayer.currentTime);
  }
}

// Funzione unificata per calcolare la percentuale e aggiornare UI
function updateProgressBarVisuals(event) {
  const progressBarWrapper = document.querySelector(".progress-bar-wrapper"); // Usa il selettore corretto o la variabile globale se definita
  const rect = progressBarWrapper.getBoundingClientRect();
  let x = event.clientX - rect.left;

  // Clamp values between 0 and width
  if (x < 0) x = 0;
  if (x > rect.width) x = rect.width;

  const percentage = x / rect.width;

  // Aggiorna visivamente la progress bar
  progressFill.style.width = percentage * 100 + "%";

  // Calcola tempo stimato e aggiorna UI principale e Tooltip
  if (audioPlayer.duration) {
    const estimatedTime = percentage * audioPlayer.duration;
    const formattedTime = formatTime(estimatedTime);

    // Aggiorna tempo principale solo se non stiamo trascinando (per evitare flicker se fosse usato altrove, ma qui è isDragging)
    // In realtà durante il drag vogliamo vedere il tempo cambiare anche nel timer principale?
    // La richiesta dice "Add drag-to-seek preview timestamp", ma spesso si aggiorna anche il principale.
    // Per ora aggiorniamo il tooltip e il principale.
    currentTimeEl.textContent = formattedTime;

    // Aggiorna Tooltip
    seekTooltip.textContent = formattedTime;
    seekTooltip.style.left = percentage * 100 + "%";
    seekTooltip.classList.add("visible");
  }

  return percentage;
}

function startDrag(event) {
  isDragging = true;
  const progressBarWrapper = event.currentTarget;
  progressBarWrapper.setPointerCapture(event.pointerId); // Cattura il puntatore
  updateProgressBarVisuals(event);
}

function doDrag(event) {
  if (!isDragging) return;
  updateProgressBarVisuals(event);
}

function endDrag(event) {
  if (!isDragging) return;
  isDragging = false;

  const percentage = updateProgressBarVisuals(event);

  // Nascondi tooltip
  seekTooltip.classList.remove("visible");

  if (audioPlayer.duration) {
    audioPlayer.currentTime = percentage * audioPlayer.duration;
  }
}

// ============================================
// UTILITY
// ============================================
function formatTime(seconds) {
  if (isNaN(seconds)) return "0:00";

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function updateActiveTrack() {
  const trackItems = document.querySelectorAll(".track-item");
  trackItems.forEach((item, index) => {
    if (index === currentTrackIndex) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });
}

// ============================================
// LYRICS
// ============================================
async function loadLyrics(lyricsPath) {
  try {
    const response = await fetch(lyricsPath);
    if (!response.ok) {
      throw new Error('Lyrics file not found');
    }
    const lyrics = await response.text();
    lyricsText.textContent = lyrics.trim() || 'Lyrics not available';
  } catch (error) {
    lyricsText.textContent = 'Lyrics not available';
  }
}

function toggleLyrics() {
  lyricsToggle.classList.toggle('expanded');
  lyricsContent.classList.toggle('expanded');
}

// ============================================
// EVENT LISTENERS
// ============================================
function setupEventListeners() {
  // Play/Pause
  playPauseBtn.addEventListener("click", togglePlayPause);

  // Navigazione
  nextBtn.addEventListener("click", playNext);
  prevBtn.addEventListener("click", playPrev);

  // Shuffle e Repeat
  shuffleBtn.addEventListener("click", toggleShuffle);
  repeatBtn.addEventListener("click", toggleRepeat);

  // Lyrics toggle
  lyricsToggle.addEventListener("click", toggleLyrics);

  // Barra di avanzamento (Pointer Events per Drag-to-Seek)
  const progressBarWrapper = document.querySelector(".progress-bar-wrapper");
  progressBarWrapper.addEventListener("pointerdown", startDrag);
  progressBarWrapper.addEventListener("pointermove", doDrag);
  progressBarWrapper.addEventListener("pointerup", endDrag);
  progressBarWrapper.addEventListener("pointercancel", endDrag); // Gestisce interruzioni

  // Rimuovi il vecchio click listener se presente (o lascialo se non confligge, ma pointerdown copre il click)
  // progressBarWrapper.addEventListener('click', seekTo);

  // Aggiornamento progresso
  audioPlayer.addEventListener("timeupdate", updateProgress);

  // Fine traccia
  audioPlayer.addEventListener("ended", () => {
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
  menuToggle.addEventListener("click", () => {
    sidebar.classList.toggle("open");
    menuToggle.classList.toggle("active");
  });

  // Chiudi menu quando si clicca fuori (mobile)
  document.addEventListener("click", (e) => {
    if (window.innerWidth <= 768) {
      if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
        sidebar.classList.remove("open");
        menuToggle.classList.remove("active");
      }
    }
  });
}

// ============================================
// SERVICE WORKER REGISTRATION
// ============================================
const OFFLINE_ESTIMATE_BYTES = 150 * 1024 * 1024;
const OFFLINE_RING_LENGTH = 2 * Math.PI * 19;
let offlineBusy = false;
let offlineComplete = false;

function setOfflineProgress(progress) {
  if (!offlineProgressRing || !offlinePercent) return;

  const normalized = Math.max(0, Math.min(1, progress));
  const percent = Math.round(normalized * 100);

  offlineProgressRing.style.strokeDasharray = String(OFFLINE_RING_LENGTH);
  offlineProgressRing.style.strokeDashoffset = String(
    OFFLINE_RING_LENGTH * (1 - normalized)
  );
  offlinePercent.textContent = `${percent}%`;
}

function setOfflineControlState(mode, progress = 0) {
  if (!offlineDownloadControl) return;

  offlineDownloadControl.classList.remove(
    "idle",
    "partial",
    "preparing",
    "downloading",
    "ready",
    "error"
  );
  offlineDownloadControl.classList.add(mode);

  offlineDownloadGlyph?.classList.toggle("hidden", mode === "ready");
  offlineCheckGlyph?.classList.toggle("hidden", mode !== "ready");

  const showPercent =
    mode === "partial" || mode === "preparing" || mode === "downloading";
  offlinePercent?.classList.toggle("hidden", !showPercent);

  if (mode === "ready") {
    setOfflineProgress(1);
    offlineDownloadControl.setAttribute(
      "aria-label",
      "Playlist disponibile offline. Tocca per rimuovere il download."
    );
    offlineDownloadControl.title =
      "Disponibile offline · tocca per rimuovere";
    return;
  }

  if (mode === "partial") {
    setOfflineProgress(progress);
    offlineDownloadControl.setAttribute(
      "aria-label",
      `Download parziale ${Math.round(progress * 100)}%. Tocca per continuare.`
    );
    offlineDownloadControl.title =
      `Download parziale · ${Math.round(progress * 100)}%`;
    return;
  }

  if (mode === "preparing") {
    offlinePercent.textContent = "0%";
    offlineDownloadControl.setAttribute(
      "aria-label",
      "Preparazione del download offline"
    );
    offlineDownloadControl.title = "Preparazione download…";
    return;
  }

  if (mode === "downloading") {
    setOfflineProgress(progress);
    offlineDownloadControl.setAttribute(
      "aria-label",
      `Download in corso ${Math.round(progress * 100)}%`
    );
    offlineDownloadControl.title =
      `Download in corso · ${Math.round(progress * 100)}%`;
    return;
  }

  if (mode === "error") {
    setOfflineProgress(0);
    offlineDownloadControl.setAttribute(
      "aria-label",
      "Download offline non riuscito. Tocca per riprovare."
    );
    offlineDownloadControl.title = "Download non riuscito · tocca per riprovare";
    return;
  }

  setOfflineProgress(0);
  offlineDownloadControl.setAttribute(
    "aria-label",
    "Scarica la playlist per ascoltarla senza Internet"
  );
  offlineDownloadControl.title = "Scarica per ascoltare offline";
}

function renderOfflineStatus(status) {
  const {
    cachedResources = 0,
    totalResources = tracks.length * 4,
    complete = false,
  } = status || {};

  offlineComplete = Boolean(complete);

  if (complete) {
    setOfflineControlState("ready", 1);
    return;
  }

  if (cachedResources > 0 && totalResources > 0) {
    setOfflineControlState(
      "partial",
      Math.min(cachedResources / totalResources, 0.99)
    );
    return;
  }

  setOfflineControlState("idle", 0);
}

async function getServiceWorkerTarget() {
  if (!("serviceWorker" in navigator)) return null;
  const registration = await navigator.serviceWorker.ready;
  return navigator.serviceWorker.controller || registration.active;
}

async function sendServiceWorkerMessage(type) {
  const worker = await getServiceWorkerTarget();
  if (!worker) throw new Error("Download offline non disponibile.");
  worker.postMessage({ type });
}

async function requestOfflineStatus() {
  try {
    await sendServiceWorkerMessage("GET_OFFLINE_STATUS");
  } catch (error) {
    setOfflineControlState("error");
    if (offlineDownloadControl) {
      offlineDownloadControl.disabled = true;
      offlineDownloadControl.title =
        "Il download offline non è disponibile in questo browser";
    }
  }
}

async function hasEnoughOfflineStorage() {
  if (!navigator.storage?.estimate) return true;

  const estimate = await navigator.storage.estimate();
  if (!Number.isFinite(estimate.quota) || !Number.isFinite(estimate.usage)) {
    return true;
  }

  return estimate.quota - estimate.usage >= OFFLINE_ESTIMATE_BYTES;
}

async function startOfflineDownload() {
  if (offlineBusy) return;

  try {
    const enoughStorage = await hasEnoughOfflineStorage();
    if (!enoughStorage) {
      setOfflineControlState("error");
      window.alert(
        "Spazio insufficiente: servono circa 125 MB liberi, più un piccolo margine per il browser."
      );
      return;
    }

    offlineBusy = true;
    offlineDownloadControl.disabled = true;
    setOfflineControlState("preparing", 0);

    if (navigator.storage?.persist) {
      navigator.storage.persist().catch(() => false);
    }

    await sendServiceWorkerMessage("CACHE_OFFLINE_LIBRARY");
  } catch (error) {
    offlineBusy = false;
    offlineDownloadControl.disabled = false;
    setOfflineControlState("error");
  }
}

async function removeOfflineDownload() {
  if (offlineBusy) return;

  const confirmed = window.confirm(
    "Rimuovere da questo dispositivo la playlist scaricata per l'ascolto offline?"
  );
  if (!confirmed) return;

  offlineBusy = true;
  offlineDownloadControl.disabled = true;
  setOfflineControlState("preparing", 0);

  try {
    await sendServiceWorkerMessage("REMOVE_OFFLINE_LIBRARY");
  } catch (error) {
    offlineBusy = false;
    offlineDownloadControl.disabled = false;
    setOfflineControlState("error");
  }
}

function setupOfflineControls() {
  if (
    !offlineDownloadControl ||
    !offlineProgressRing ||
    !offlinePercent ||
    !offlineDownloadGlyph ||
    !offlineCheckGlyph
  ) {
    return;
  }

  setOfflineControlState("idle", 0);

  if (!("serviceWorker" in navigator)) {
    setOfflineControlState("error");
    offlineDownloadControl.disabled = true;
    offlineDownloadControl.title =
      "Il download offline non è disponibile in questo browser";
    return;
  }

  offlineDownloadControl.addEventListener("click", () => {
    if (offlineBusy) return;

    if (offlineComplete) {
      removeOfflineDownload();
    } else {
      startOfflineDownload();
    }
  });

  navigator.serviceWorker.addEventListener("message", (event) => {
    const data = event.data || {};

    if (data.type === "OFFLINE_STATUS") {
      renderOfflineStatus(data);
      return;
    }

    if (data.type === "OFFLINE_PROGRESS") {
      offlineBusy = true;
      const progress =
        data.totalTracks > 0
          ? data.completedTracks / data.totalTracks
          : 0;
      setOfflineControlState("downloading", progress);
      return;
    }

    if (data.type === "OFFLINE_COMPLETE") {
      offlineBusy = false;
      offlineDownloadControl.disabled = false;

      if (data.complete) {
        offlineComplete = true;
        setOfflineControlState("ready", 1);
      } else {
        offlineComplete = false;
        const progress =
          data.totalResources > 0
            ? data.cachedResources / data.totalResources
            : data.totalTracks > 0
              ? data.completeTracks / data.totalTracks
              : 0;
        setOfflineControlState(
          data.errors > 0 ? "error" : "partial",
          progress
        );
      }
      return;
    }

    if (data.type === "OFFLINE_REMOVED") {
      offlineBusy = false;
      offlineComplete = false;
      offlineDownloadControl.disabled = false;
      setOfflineControlState("idle", 0);
    }
  });

  requestOfflineStatus();
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    console.warn("[Service Worker] Non supportato in questo browser");
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register(
      "./service-worker.js",
      { scope: "./" }
    );

    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener("statechange", () => {
        if (
          newWorker.state === "installed" &&
          navigator.serviceWorker.controller
        ) {
          console.log("[Service Worker] Nuova versione disponibile");
        }
      });
    });

    setInterval(() => registration.update(), 60000);
    return registration;
  } catch (error) {
    console.error("[Service Worker] Errore durante la registrazione:", error);
    return null;
  }
}

registerServiceWorker().finally(setupOfflineControls);

// ============================================
// HERO SECTION
// ============================================
const heroSection = document.getElementById("heroSection");
const mainContainer = document.getElementById("mainContainer");
const startPlayerBtn = document.getElementById("startPlayerBtn");

async function showPlayer() {
  heroSection.classList.add("hidden");
  setTimeout(async () => {
    mainContainer.style.display = "flex";
    // Inizializza il player dopo che la hero è nascosta
    if (!window.playerInitialized) {
      await init();
      window.playerInitialized = true;
    }
  }, 300);
}

startPlayerBtn.addEventListener("click", showPlayer);

// ============================================
// AVVIO
// ============================================
// Non inizializzare automaticamente, aspetta il click sulla hero
// init();
