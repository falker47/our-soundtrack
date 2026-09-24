(() => {
  const OFFLINE_ESTIMATE_BYTES = 150 * 1024 * 1024;
  const OFFLINE_RING_LENGTH = 2 * Math.PI * 19;
  const INSTALL_NUDGE_STORAGE_KEY = "our-soundtrack-install-nudge-v1";

  let offlineBusy = false;
  let offlineComplete = false;
  let elements = null;
  let installElements = null;
  let deferredInstallPrompt = null;
  let installNudgeMode = "hidden";
  let installNudgeShown = false;
  let installListenersBound = false;
  let offlineDownloadRequested = false;

  function isIosLike(userAgent = "", platform = "", maxTouchPoints = 0) {
    const ua = String(userAgent);
    const currentPlatform = String(platform);

    return (
      /iPad|iPhone|iPod/.test(ua) ||
      (currentPlatform === "MacIntel" && Number(maxTouchPoints) > 1)
    );
  }

  function resolveInstallNudgeMode({
    standalone = false,
    ios = false,
    canPrompt = false,
    handled = false,
  } = {}) {
    if (standalone || handled) return "hidden";
    if (canPrompt) return "native";
    if (ios) return "ios";
    return "hidden";
  }

  function isStandaloneDisplay() {
    return Boolean(
      globalThis.matchMedia?.("(display-mode: standalone)")?.matches ||
        globalThis.navigator?.standalone === true
    );
  }

  function hasHandledInstallNudge() {
    try {
      return globalThis.localStorage?.getItem(INSTALL_NUDGE_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  }

  function markInstallNudgeHandled() {
    try {
      globalThis.localStorage?.setItem(INSTALL_NUDGE_STORAGE_KEY, "1");
    } catch {
      // Storage may be unavailable in private/restricted browsing contexts.
    }
  }

  function hideInstallNudge() {
    if (installElements?.installNudge) {
      installElements.installNudge.hidden = true;
    }
  }

  function currentInstallNudgeMode() {
    const navigatorRef = globalThis.navigator || {};
    return resolveInstallNudgeMode({
      standalone: isStandaloneDisplay(),
      ios: isIosLike(
        navigatorRef.userAgent,
        navigatorRef.platform,
        navigatorRef.maxTouchPoints
      ),
      canPrompt: Boolean(deferredInstallPrompt),
      handled: hasHandledInstallNudge(),
    });
  }

  function maybeShowInstallNudge() {
    if (!offlineDownloadRequested || installNudgeShown || !installElements) return;

    const mode = currentInstallNudgeMode();
    if (mode === "hidden") return;

    installNudgeMode = mode;
    installNudgeShown = true;
    markInstallNudgeHandled();

    if (mode === "native") {
      installElements.installNudgeText.textContent =
        "Il download è partito. Aggiungi Our Soundtrack alla schermata Home per aprirlo come un'app.";
      installElements.installNudgeAction.textContent = "Aggiungi";
    } else {
      installElements.installNudgeText.textContent =
        "Il download è partito. Su iPhone/iPad usa Condividi → Aggiungi alla schermata Home, poi aprilo come app web.";
      installElements.installNudgeAction.textContent = "Capito";
    }

    installElements.installNudge.hidden = false;
  }

  async function handleInstallNudgeAction() {
    if (installNudgeMode !== "native" || !deferredInstallPrompt) {
      hideInstallNudge();
      return;
    }

    const promptEvent = deferredInstallPrompt;
    deferredInstallPrompt = null;
    hideInstallNudge();

    try {
      await promptEvent.prompt();
      await promptEvent.userChoice;
    } catch {
      // The install choice remains entirely under browser/user control.
    }
  }

  function setupInstallNudge() {
    installElements = {
      installNudge: document.getElementById("installNudge"),
      installNudgeText: document.getElementById("installNudgeText"),
      installNudgeLater: document.getElementById("installNudgeLater"),
      installNudgeAction: document.getElementById("installNudgeAction"),
    };

    if (Object.values(installElements).some((element) => !element)) return;

    installElements.installNudgeLater.addEventListener("click", hideInstallNudge);
    installElements.installNudgeAction.addEventListener(
      "click",
      handleInstallNudgeAction
    );

    if (installListenersBound) return;
    installListenersBound = true;

    globalThis.addEventListener?.("beforeinstallprompt", (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      maybeShowInstallNudge();
    });

    globalThis.addEventListener?.("appinstalled", () => {
      deferredInstallPrompt = null;
      markInstallNudgeHandled();
      hideInstallNudge();
    });
  }

  function deriveOfflineState(status, fallbackTotalResources = 0) {
    const cachedResources = Number(status?.cachedResources) || 0;
    const totalResources =
      Number(status?.totalResources) || Number(fallbackTotalResources) || 0;
    const complete = Boolean(status?.complete);

    if (complete) {
      return Object.freeze({ mode: "ready", progress: 1, complete: true });
    }

    if (cachedResources > 0 && totalResources > 0) {
      return Object.freeze({
        mode: "partial",
        progress: Math.min(cachedResources / totalResources, 0.99),
        complete: false,
      });
    }

    return Object.freeze({ mode: "idle", progress: 0, complete: false });
  }

  function completionProgress(data) {
    if (Number(data?.totalResources) > 0) {
      return Math.min(
        (Number(data.cachedResources) || 0) / Number(data.totalResources),
        1
      );
    }

    if (Number(data?.totalTracks) > 0) {
      return Math.min(
        (Number(data.completeTracks) || 0) / Number(data.totalTracks),
        1
      );
    }

    return 0;
  }

  function setOfflineProgress(progress) {
    if (!elements?.offlineProgressRing || !elements?.offlinePercent) return;

    const normalized = Math.max(0, Math.min(1, progress));
    const percent = Math.round(normalized * 100);

    elements.offlineProgressRing.style.strokeDasharray = String(
      OFFLINE_RING_LENGTH
    );
    elements.offlineProgressRing.style.strokeDashoffset = String(
      OFFLINE_RING_LENGTH * (1 - normalized)
    );
    elements.offlinePercent.textContent = `${percent}%`;
  }

  function setOfflineControlState(mode, progress = 0) {
    const {
      offlineDownloadControl,
      offlineProgressRing,
      offlinePercent,
      offlineDownloadGlyph,
      offlineCheckGlyph,
    } = elements || {};

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
        `Download parziale ${Math.round(
          progress * 100
        )}%. Tocca per continuare.`
      );
      offlineDownloadControl.title =
        `Download parziale · ${Math.round(progress * 100)}%`;
      return;
    }

    if (mode === "preparing") {
      offlineProgressRing.style.strokeDasharray = "24 95.38";
      offlineProgressRing.style.strokeDashoffset = "0";
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
      offlineDownloadControl.title =
        "Download non riuscito · tocca per riprovare";
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
    const fallbackTotalResources =
      (globalThis.SOUNDTRACK_CATALOG?.length || 0) * 4;
    const state = deriveOfflineState(status, fallbackTotalResources);

    offlineComplete = state.complete;
    setOfflineControlState(state.mode, state.progress);
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
    } catch {
      setOfflineControlState("error");
      if (elements?.offlineDownloadControl) {
        elements.offlineDownloadControl.disabled = true;
        elements.offlineDownloadControl.title =
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

    const { offlineDownloadControl } = elements || {};
    if (!offlineDownloadControl) return;

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
      offlineDownloadRequested = true;
      offlineDownloadControl.disabled = true;
      setOfflineControlState("preparing", 0);

      if (navigator.storage?.persist) {
        navigator.storage.persist().catch(() => false);
      }

      await sendServiceWorkerMessage("CACHE_OFFLINE_LIBRARY");
    } catch {
      offlineBusy = false;
      offlineDownloadRequested = false;
      offlineDownloadControl.disabled = false;
      setOfflineControlState("error");
    }
  }

  async function removeOfflineDownload() {
    if (offlineBusy) return;

    const { offlineDownloadControl } = elements || {};
    if (!offlineDownloadControl) return;

    const confirmed = window.confirm(
      "Rimuovere da questo dispositivo la playlist scaricata per l'ascolto offline?"
    );
    if (!confirmed) return;

    offlineBusy = true;
    offlineDownloadControl.disabled = true;
    setOfflineControlState("preparing", 0);

    try {
      await sendServiceWorkerMessage("REMOVE_OFFLINE_LIBRARY");
    } catch {
      offlineBusy = false;
      offlineDownloadControl.disabled = false;
      setOfflineControlState("error");
    }
  }

  function handleServiceWorkerMessage(event) {
    const data = event.data || {};
    const { offlineDownloadControl } = elements || {};
    if (!offlineDownloadControl) return;

    if (data.type === "OFFLINE_STATUS") {
      renderOfflineStatus(data);
      return;
    }

    if (data.type === "OFFLINE_PROGRESS") {
      offlineBusy = true;
      maybeShowInstallNudge();
      const progress =
        data.totalTracks > 0 ? data.completedTracks / data.totalTracks : 0;
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
        setOfflineControlState(
          data.errors > 0 ? "error" : "partial",
          completionProgress(data)
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
  }

  function setupOfflineControls() {
    elements = {
      offlineDownloadControl: document.getElementById("offlineDownloadControl"),
      offlineProgressRing: document.getElementById("offlineProgressRing"),
      offlinePercent: document.getElementById("offlinePercent"),
      offlineDownloadGlyph: document.getElementById("offlineDownloadGlyph"),
      offlineCheckGlyph: document.getElementById("offlineCheckGlyph"),
    };

    if (Object.values(elements).some((element) => !element)) {
      return;
    }

    setOfflineControlState("idle", 0);

    if (!("serviceWorker" in navigator)) {
      setOfflineControlState("error");
      elements.offlineDownloadControl.disabled = true;
      elements.offlineDownloadControl.title =
        "Il download offline non è disponibile in questo browser";
      return;
    }

    elements.offlineDownloadControl.addEventListener("click", () => {
      if (offlineBusy) return;

      if (offlineComplete) {
        removeOfflineDownload();
      } else {
        startOfflineDownload();
      }
    });

    navigator.serviceWorker.addEventListener(
      "message",
      handleServiceWorkerMessage
    );

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
      console.error(
        "[Service Worker] Errore durante la registrazione:",
        error
      );
      return null;
    }
  }

  function init() {
    setupInstallNudge();
    return registerServiceWorker().finally(setupOfflineControls);
  }

  globalThis.SoundtrackOffline = Object.freeze({
    deriveOfflineState,
    completionProgress,
    isIosLike,
    resolveInstallNudgeMode,
    setupOfflineControls,
    registerServiceWorker,
    init,
  });
})();
