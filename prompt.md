Genera una webapp statica (HTML + CSS + JavaScript) che funzioni come un mini-player musicale stile Spotify Desktop, da regalare alla mia ragazza Francesca.

💛 TITOLO E DEDICA
Titolo principale (hero): **Our Soundtrack**
Sottotitolo: **Every note is a piece of us**

🎨 MOOD
- Minimal, romantico ma elegante.
- Palette scura: nero/antracite come base, testo bianco/avorio.
- Font moderno e pulito (system-ui).
- Transizioni morbide, nessun effetto kitsch.
- Layout ispirato a Spotify desktop: sidebar sinistra con la playlist, pannello centrale/hero a destra.

📌 STRUTTURA DELLA PAGINA
La pagina deve essere divisa in due colonne:

1) **SIDEBAR SINISTRA – PLAYLIST**
   - Una lista dinamica dei brani (array `tracks` in JS).
   - Ogni brano mostra:
     - numero traccia
     - titolo
   - Quando un brano viene cliccato:
     - diventa attivo (stile evidenziato, come Spotify)
     - carica quel brano nel player
     - avvia la riproduzione
     - aggiorna immagine album e video canvas collegati

   - La sidebar deve essere sempre visibile e scrollabile.
   - In alto nella sidebar: logo testo “Our Soundtrack”.

2) **PANNELLO DESTRO – PLAYER**
   - In alto, l’immagine della copertina dell’album (immagine unica che inserirò io, NON slideshow).
   - Sotto, il “canvas video” tipo Spotify: un video verticale (loop) o gif da mostrare dietro o al posto dell’immagine.
   - Sotto ancora, titolo della canzone attiva.
   - Sotto ancora, i controlli:
     - Prev
     - Play / Pause
     - Next
     - Shuffle (riproduzione casuale)
     - Repeat (riproduzione continua)
   - Barra di avanzamento con:
     - tempo corrente
     - barra cliccabile
     - durata totale

🖼️ IMMAGINI E VIDEO
- L’immagine dell’album (hero) deve essere caricabile come semplice file `cover.jpg`.
- Ogni brano può avere un “canvas video” opzionale, quindi l'array tracks deve permettere:

tracks = [
  {
    title: "Titolo brano",
    file: "music/01.mp3",
    cover: "images/cover.jpg", 
    canvas: "videos/canvas1.mp4"  // opzionale
  },
  ...
];

Se `canvas` esiste:
  - il pannello player mostra quel video in loop automatico, mute, autoplay, loop.
Se non esiste:
  - mostra solo la cover.

🎵 FUNZIONAMENTO DEL PLAYER
- All’avvio: caricare il primo brano, ma NON riprodurlo automaticamente.
- Click sulla tracklist:
  - cambia brano
  - aggiorna cover (sempre la stessa, ma flessibile per il futuro)
  - aggiorna canvas video se presente
  - aggiorna stato “active”
- Pulsante Shuffle:
  - attiva/disattiva shuffle (toggle visibile)
  - se attivo e finisce un brano → sceglie casualmente il prossimo
- Pulsante Repeat:
  - modalità repeat (toggle)
  - se attivo e finisce un brano → riparte dallo stesso brano
- Se non è attivo né shuffle né repeat:
  - fine brano → passa alla traccia successiva
  - se era l’ultima → torna alla prima

🎧 BARRA DI AVANZAMENTO
- cliccabile e trascinabile
- aggiorna il tempo durante la riproduzione

📱 RESPONSIVE
- Su desktop:
   - sidebar sinistra 25–30% larghezza
   - player destra 70–75%
- Su mobile:
   - sidebar sopra (collassabile con un pulsante hamburger)
   - player sotto

📂 STRUTTURA FILE RICHIESTA
- index.html
- style.css
- script.js
- folder /music per gli mp3 (non includere file veri, solo path)
- folder /images per cover
- folder /videos per canvas video

📌 OUTPUT CHE DEVI FORNIRE
→ Il codice completo di:
  1. index.html
  2. style.css
  3. script.js

→ Il codice deve essere completamente funzionante e pronto per upload su GitHub Pages.

→ Aggiungi commenti nel punto in cui devo:
   - sostituire i titoli dei brani
   - inserire gli mp3
   - inserire i video canvas
   - cambiare la cover

Stile generale: pulito, elegante, sobrio, molto vicino a Spotify Desktop.
