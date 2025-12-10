// Service Worker per cache persistente delle risorse
const CACHE_NAME = 'our-soundtrack-v1';
const CACHE_SIZE_LIMIT = 500 * 1024 * 1024; // 500MB limite cache

// Lista delle risorse da cachare
const resourcesToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json',
    '/images/Album cover front.jpg',
    '/images/Album cover retro.jpg',
    '/images/cover.jpg'
];

// Genera automaticamente la lista di tutte le canzoni, immagini e video
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

// Aggiungi tutte le canzoni
musicFiles.forEach(file => {
    resourcesToCache.push(`/music/${file}`);
});

// Aggiungi tutte le immagini di copertina (prova sia .jpg che .png)
musicFiles.forEach(file => {
    const nameWithoutExt = file.replace(/\.mp3$/i, '');
    resourcesToCache.push(`/images/cover/${nameWithoutExt}.jpg`);
    resourcesToCache.push(`/images/cover/${nameWithoutExt}.png`);
    resourcesToCache.push(`/images/${nameWithoutExt}.jpg`);
    resourcesToCache.push(`/images/${nameWithoutExt}.png`);
});

// Aggiungi tutti i video
const videoFiles = [
    "Bruno Mars - Just the Way you are.mp4",
    "Ed Sheeran - Perfect Symphony (ft. Andrea Bocelli).mp4",
    "Elvis Presley - Burning Love.mp4",
    "Harry James & His Orchestra - It's Been a Long, Long Time.mp4",
    "Il Volo - Capolavoro.mp4",
    "Imagine Dragons - Next To Me.mp4",
    "John Legend - All of Me.mp4",
    "Lady Gaga - Die With A Smile.mp4",
    "Laura Chiatti - Il mio nuovo sogno.mp4",
    "Luca Laurenti - La mia Evangeline.mp4",
    "Marvin Berry and the Starlighters - Earth Angel.mp4",
    "Sebastian Yatra - Dos Oruguitas.mp4",
    "Simone Iuè - In ogni parte del mio corazon.mp4",
    "Tom Odell - Grow Old with Me.mp4",
    "Zac Efron - Rewrite The Stars.mp4"
];

videoFiles.forEach(file => {
    resourcesToCache.push(`/videos/${file}`);
});

// INSTALL: Cachiamo tutte le risorse quando il service worker viene installato
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installazione in corso...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Cache aperta');
                // Cachiamo le risorse principali immediatamente
                // Usa addAll con catch per gestire errori su risorse che potrebbero non esistere
                const criticalResources = resourcesToCache.filter(url => {
                    return url.includes('index.html') || 
                           url.includes('style.css') || 
                           url.includes('script.js') ||
                           url.includes('manifest.json') ||
                           url.includes('music/') ||
                           url.includes('images/Album') ||
                           url.includes('images/cover.jpg');
                });
                
                return Promise.allSettled(
                    criticalResources.map(url => 
                        cache.add(url).catch(err => {
                            console.log(`[Service Worker] Impossibile cachare ${url}:`, err);
                        })
                    )
                ).then(() => {
                    console.log('[Service Worker] Caching iniziale completato');
                });
            })
    );
    // Forza l'attivazione immediata del nuovo service worker
    self.skipWaiting();
});

// ACTIVATE: Pulisce le vecchie cache quando il service worker viene attivato
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Attivazione in corso...');
    event.waitUntil(
        Promise.all([
            // Pulisci le vecchie cache
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('[Service Worker] Rimozione vecchia cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            // Prendi il controllo immediato di tutte le pagine
            self.clients.claim(),
            // Precarica tutte le risorse in background
            preloadAllResources()
        ])
    );
});

// Funzione per precaricare tutte le risorse in background
async function preloadAllResources() {
    console.log('[Service Worker] Inizio preload di tutte le risorse...');
    const cache = await caches.open(CACHE_NAME);
    
    // Precarica tutte le risorse una alla volta per evitare sovraccarico
    for (const resource of resourcesToCache) {
        try {
            // Controlla se è già in cache
            const cached = await cache.match(resource);
            if (!cached) {
                // Prova a caricare e cachare
                const response = await fetch(resource);
                if (response && response.status === 200) {
                    await cache.put(resource, response);
                    console.log(`[Service Worker] Cachata risorsa: ${resource}`);
                }
            }
        } catch (error) {
            // Ignora errori per risorse che potrebbero non esistere
            console.log(`[Service Worker] Impossibile cachare ${resource}:`, error.message);
        }
    }
    
    console.log('[Service Worker] Preload completato');
}

// FETCH: Intercetta le richieste e serve dalla cache quando possibile
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Ignora le richieste non-GET
    if (event.request.method !== 'GET') {
        return;
    }
    
    // Ignora le richieste a domini esterni (opzionale, per sicurezza)
    if (url.origin !== location.origin) {
        return;
    }
    
    // Strategia Cache First: controlla prima la cache, poi la rete
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // Se trovato in cache, restituisci dalla cache
                if (cachedResponse) {
                    // Aggiorna la cache in background (stale-while-revalidate)
                    fetch(event.request)
                        .then((response) => {
                            if (response && response.status === 200 && response.type === 'basic') {
                                const responseToCache = response.clone();
                                caches.open(CACHE_NAME).then((cache) => {
                                    cache.put(event.request, responseToCache);
                                });
                            }
                        })
                        .catch(() => {
                            // Ignora errori di aggiornamento in background
                        });
                    
                    return cachedResponse;
                }
                
                // Altrimenti, fai la richiesta alla rete
                return fetch(event.request)
                    .then((response) => {
                        // Verifica che la risposta sia valida
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        // Clona la risposta per cacharla
                        const responseToCache = response.clone();
                        
                        // Aggiungi alla cache
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                        
                        return response;
                    })
                    .catch(() => {
                        // Se la rete fallisce e non c'è in cache, restituisci una risposta di fallback
                        // Per le immagini, restituisci un'immagine placeholder
                        if (event.request.destination === 'image') {
                            return caches.match('/images/cover.jpg');
                        }
                        // Per altri tipi, restituisci una risposta vuota
                        return new Response('Risorsa non disponibile offline', {
                            status: 503,
                            statusText: 'Service Unavailable'
                        });
                    });
            })
    );
});

// Funzione per gestire la dimensione della cache (opzionale)
async function manageCacheSize() {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    
    // Se la cache è troppo grande, rimuovi le risorse più vecchie
    // (Implementazione semplificata - in produzione potresti voler tracciare le date)
    if (keys.length > 100) {
        // Rimuovi le prime 20 risorse (più vecchie)
        for (let i = 0; i < 20 && i < keys.length; i++) {
            await cache.delete(keys[i]);
        }
    }
}
