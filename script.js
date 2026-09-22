// ============================================
// CATALOGO E CORE DEL PLAYER
// ============================================
// Il catalogo canonico vive in soundtrack-catalog.js.
// Le decisioni di playback pure vivono in player-core.js; questo file orchestra
// soltanto media element, DOM e caricamento delle risorse della traccia corrente.

const catalogAssets = globalThis.SOUNDTRACK_CATALOG;
const playerCore = globalThis.SoundtrackPlayerCore;

if (!Array.isArray(catalogAssets) || catalogAssets.length === 0) {
  throw new Error("Soundtrack catalog non disponibile.");
}

if (!playerCore) {
  throw new Error("Soundtrack player core non disponibile.");
}

const {
  createTracks,
  resolveNextIndex,
  resolvePreviousAction,
  toggleExclusiveMode,
  resolveEndedAction,
  formatTime,
  createLoadGuard,
} = playerCore;

const tracks = createTracks(catalogAssets);
const loadGuard = createLoadGuard();

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
async function loadCoverImage(coverPath, loadToken) {
  const fallbackPath = "images/Album cover front.jpg";

  const setImageAndWait = (src) =>
    new Promise((resolve) => {
      if (!loadGuard.isCurrent(loadToken)) {
        resolve();
        return;
      }

      albumCover.onload = () => resolve();
      albumCover.onerror = () => resolve();
      albumCover.src = src;
      if (albumCover.complete) resolve();
    });

  try {
    if (!imageCache.has(coverPath)) {
      await preloadImage(coverPath);
    }
    if (!loadGuard.isCurrent(loadToken)) return;
    await setImageAndWait(coverPath);
  } catch {
    if (!loadGuard.isCurrent(loadToken)) return;
    console.warn("Cover non disponibile, uso fallback:", coverPath);
    try {
      if (!imageCache.has(fallbackPath)) {
        await preloadImage(fallbackPath);
      }
      if (!loadGuard.isCurrent(loadToken)) return;
      await setImageAndWait(fallbackPath);
    } catch {
      if (loadGuard.isCurrent(loadToken)) {
        console.warn("Fallback cover non disponibile");
      }
    }
  }
}

// ============================================
// CARICAMENTO TRACCE
// ============================================
async function loadTrack(index, showPreload = true) {
  if (index < 0 || index >= tracks.length) return;

  const loadToken = loadGuard.next();
  currentTrackIndex = index;
  const track = tracks[index];

  let preloadTimer = null;

  if (showPreload) {
    preloadTimer = setTimeout(() => {
      if (loadGuard.isCurrent(loadToken)) {
        preloadScreen.classList.add("active");
      }
    }, 100);
  }

  if (track.artist) {
    trackArtist.textContent = track.artist;
    trackTitle.textContent = track.songTitle;
  } else {
    trackArtist.textContent = "";
    trackTitle.textContent = track.songTitle || "Seleziona una traccia";
  }

  updateActiveTrack();
  loadLyrics(track.lyrics, loadToken);

  progressFill.style.width = "0%";
  currentTimeEl.textContent = "0:00";

  const loadPromises = [];

  const audioPromise = (async () => {
    try {
      audioPlayer.src = track.file;
      audioPlayer.load();

      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          if (loadGuard.isCurrent(loadToken)) {
            totalTimeEl.textContent = "0:00";
          }
          resolve();
        }, 10000);

        audioPlayer.addEventListener(
          "loadedmetadata",
          () => {
            clearTimeout(timeout);
            if (loadGuard.isCurrent(loadToken)) {
              totalTimeEl.textContent = formatTime(audioPlayer.duration);
            }
            resolve();
          },
          { once: true }
        );

        audioPlayer.addEventListener(
          "error",
          () => {
            clearTimeout(timeout);
            if (loadGuard.isCurrent(loadToken)) {
              totalTimeEl.textContent = "0:00";
            }
            resolve();
          },
          { once: true }
        );
      });
    } catch (error) {
      if (loadGuard.isCurrent(loadToken)) {
        console.warn("Errore nel caricamento audio:", error);
        totalTimeEl.textContent = "0:00";
      }
    }
  })();
  loadPromises.push(audioPromise);

  loadPromises.push(loadCoverImage(track.cover, loadToken));

  const videoPromise = new Promise((resolve) => {
    if (!track.canvas) {
      if (loadGuard.isCurrent(loadToken)) {
        canvasVideo.classList.remove("active");
        canvasVideo.src = "";
      }
      resolve();
      return;
    }

    canvasVideo.src = track.canvas;
    canvasVideo.load();

    let settled = false;

    const finish = (available) => {
      if (settled) return;
      settled = true;

      if (loadGuard.isCurrent(loadToken)) {
        canvasVideo.classList.toggle("active", available);
        if (!available) {
          canvasVideo.src = "";
        }
      }
      resolve();
    };

    canvasVideo.addEventListener("loadeddata", () => finish(true), {
      once: true,
    });
    canvasVideo.addEventListener("canplay", () => finish(true), {
      once: true,
    });
    canvasVideo.addEventListener("error", () => finish(false), {
      once: true,
    });

    setTimeout(() => finish(false), 5000);
  });
  loadPromises.push(videoPromise);

  await Promise.allSettled(loadPromises);

  if (preloadTimer) {
    clearTimeout(preloadTimer);
  }

  if (!loadGuard.isCurrent(loadToken)) return;
  preloadScreen.classList.remove("active");
}

// ============================================
// CONTROLLI RIPRODUZIONE
// ============================================
function playTrack() {
  audioPlayer.play().catch((error) => {
    console.error("Errore nella riproduzione:", error);
  });
}

function pauseTrack() {
  audioPlayer.pause();
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
  const nextIndex = resolveNextIndex({
    currentIndex: currentTrackIndex,
    totalTracks: tracks.length,
    shuffle: isShuffleActive,
  });

  await loadTrack(nextIndex);
  playTrack();
}

async function playPrev() {
  const action = resolvePreviousAction({
    currentIndex: currentTrackIndex,
    currentTime: audioPlayer.currentTime,
    totalTracks: tracks.length,
    shuffle: isShuffleActive,
  });

  if (action.type === "restart") {
    audioPlayer.currentTime = 0;
    return;
  }

  await loadTrack(action.index);
  playTrack();
}

// ============================================
// SHUFFLE E REPEAT
// ============================================
function applyPlaybackModeState(state) {
  isShuffleActive = state.shuffle;
  isRepeatActive = state.repeat;
  shuffleBtn.classList.toggle("active", isShuffleActive);
  repeatBtn.classList.toggle("active", isRepeatActive);
}

function toggleShuffle() {
  const nextState = toggleExclusiveMode(
    { shuffle: isShuffleActive, repeat: isRepeatActive },
    "shuffle"
  );
  applyPlaybackModeState(nextState);

  if (isShuffleActive) {
    shuffleBtn.style.transform = "scale(1.2)";
    setTimeout(() => {
      shuffleBtn.style.transform = "";
    }, 200);
  }
}

function toggleRepeat() {
  applyPlaybackModeState(
    toggleExclusiveMode(
      { shuffle: isShuffleActive, repeat: isRepeatActive },
      "repeat"
    )
  );
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
function updateActiveTrack() {
  const trackItems = document.querySelectorAll(".track-item");
  trackItems.forEach((item, index) => {
    item.classList.toggle("active", index === currentTrackIndex);
  });
}

// ============================================
// LYRICS
// ============================================
async function loadLyrics(lyricsPath, loadToken) {
  try {
    const response = await fetch(lyricsPath);
    if (!response.ok) {
      throw new Error("Lyrics file not found");
    }
    const lyrics = await response.text();
    if (loadGuard.isCurrent(loadToken)) {
      lyricsText.textContent = lyrics.trim() || "Lyrics not available";
    }
  } catch {
    if (loadGuard.isCurrent(loadToken)) {
      lyricsText.textContent = "Lyrics not available";
    }
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
  playPauseBtn.addEventListener("click", togglePlayPause);

  nextBtn.addEventListener("click", playNext);
  prevBtn.addEventListener("click", playPrev);

  shuffleBtn.addEventListener("click", toggleShuffle);
  repeatBtn.addEventListener("click", toggleRepeat);

  lyricsToggle.addEventListener("click", toggleLyrics);

  const progressBarWrapper = document.querySelector(".progress-bar-wrapper");
  progressBarWrapper.addEventListener("pointerdown", startDrag);
  progressBarWrapper.addEventListener("pointermove", doDrag);
  progressBarWrapper.addEventListener("pointerup", endDrag);
  progressBarWrapper.addEventListener("pointercancel", endDrag);

  audioPlayer.addEventListener("timeupdate", updateProgress);

  audioPlayer.addEventListener("play", () => {
    isPlaying = true;
    updatePlayPauseButton();

    if (canvasVideo.classList.contains("active")) {
      canvasVideo.play().catch(() => undefined);
    }
  });

  audioPlayer.addEventListener("pause", () => {
    isPlaying = false;
    updatePlayPauseButton();

    if (canvasVideo.classList.contains("active")) {
      canvasVideo.pause();
    }
  });

  audioPlayer.addEventListener("ended", async () => {
    const action = resolveEndedAction({
      currentIndex: currentTrackIndex,
      totalTracks: tracks.length,
      shuffle: isShuffleActive,
      repeat: isRepeatActive,
    });

    if (action.type === "restart") {
      audioPlayer.currentTime = 0;
      playTrack();
      return;
    }

    await loadTrack(action.index);
    playTrack();
  });

  menuToggle.addEventListener("click", () => {
    sidebar.classList.toggle("open");
    menuToggle.classList.toggle("active");
  });

  document.addEventListener("click", (event) => {
    if (
      window.innerWidth <= 768 &&
      !sidebar.contains(event.target) &&
      !menuToggle.contains(event.target)
    ) {
      sidebar.classList.remove("open");
      menuToggle.classList.remove("active");
    }
  });
}

// ============================================
// OFFLINE / SERVICE WORKER
// ============================================
if (!globalThis.SoundtrackOffline) {
  throw new Error("Soundtrack offline client non disponibile.");
}

globalThis.SoundtrackOffline.init();

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
