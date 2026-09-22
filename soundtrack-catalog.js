(() => {
  const tracks = [
    { file: "Mauri e Rita - Die With A Smile (cover).mp3", coverExt: "jpg" },
    { file: "Mauri - Eternity (cover).mp3", coverExt: "png" },
    { file: "Mauri - Grow Old with Me (cover).mp3", coverExt: "png" },
    { file: "Bill Medley & Jennifer Warnes - (I've had) The Time Of My Life.mp3", coverExt: "jpg" },
    { file: "Bruno Mars - Just the Way you are.mp3", coverExt: "jpg" },
    { file: "Ed Sheeran - Perfect Symphony (ft. Andrea Bocelli).mp3", coverExt: "jpg" },
    { file: "Elvis Presley - Burning Love.mp3", coverExt: "jpg" },
    { file: "Giorgia - È l'amore che conta.mp3", coverExt: "jpg" },
    { file: "Harry James & His Orchestra - It's Been a Long, Long Time.mp3", coverExt: "jpg" },
    { file: "Il Volo - Capolavoro.mp3", coverExt: "jpg" },
    { file: "Imagine Dragons - Next To Me.mp3", coverExt: "jpg" },
    { file: "John Legend - All of Me.mp3", coverExt: "jpg" },
    { file: "Jovanotti - Come Musica.mp3", coverExt: "jpg" },
    { file: "Laura Chiatti - Il mio nuovo sogno.mp3", coverExt: "jpg" },
    { file: "Luca Laurenti - La mia Evangeline.mp3", coverExt: "jpg" },
    { file: "Marvin Berry and the Starlighters - Earth Angel.mp3", coverExt: "jpg" },
    { file: "Sebastian Yatra - Dos Oruguitas.mp3", coverExt: "jpg" },
    { file: "Simone Iuè - In ogni parte del mio corazon.mp3", coverExt: "jpg" },
    { file: "Ultimo - Poesia senza veli.mp3", coverExt: "jpg" },
    { file: "Zac Efron - Rewrite The Stars.mp3", coverExt: "jpg" },
  ].map(({ file, coverExt }) => {
    const stem = file.replace(/\.mp3$/i, "");
    return Object.freeze({
      file,
      audio: `music/${file}`,
      cover: `images/cover/${stem}.${coverExt}`,
      video: `videos/${stem}.mp4`,
      lyrics: `lyrics/${stem}.txt`,
    });
  });

  globalThis.SOUNDTRACK_CATALOG = Object.freeze(tracks);
})();
