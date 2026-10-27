// ─────────────────────────────────────────────────────────────────────────────
// FILM — the transformation video (rendered by scripts/render-film.mjs), playing
// muted on a continuous loop like a background film. Nothing is downloaded until
// the section is close; it pauses while scrolled away to save battery.
// Reduced motion: no autoplay, a Play button instead. The Play button also
// appears if a browser refuses to autoplay.
// ─────────────────────────────────────────────────────────────────────────────

export function initFilm(root, { autoplay = true } = {}) {
  const video = root.querySelector('[data-film-video]');
  const playBtn = root.querySelector('[data-film-play]');
  let loaded = false;

  if (!autoplay) video.removeAttribute('autoplay');
  const load = () => {
    if (loaded) return;
    loaded = true;
    video.src = innerWidth < 760 ? video.dataset.srcSmall : video.dataset.src;
    video.preload = 'auto';
  };
  const play = () => {
    load();
    playBtn.hidden = true;
    video.play().catch((err) => {
      if (err.name !== 'AbortError') playBtn.hidden = false; // autoplay blocked
    });
  };

  new IntersectionObserver(([e]) => e.isIntersecting && load(), { rootMargin: '600px 0px' }).observe(root);
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && autoplay) play();
    else if (!e.isIntersecting) video.pause();
  }, { threshold: 0.25 }).observe(video);

  if (!autoplay) playBtn.hidden = false;
  playBtn.addEventListener('click', play);
  video.addEventListener('error', () => {
    playBtn.hidden = true;
    console.error('[film] video failed to load:', video.currentSrc || video.dataset.src);
  });
}
