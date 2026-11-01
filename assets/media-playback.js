/* Trinity Continuum cross-browser media recovery, REV A */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('video').forEach((video) => {
    const wrapper = video.parentElement;
    if (!wrapper) return;
    const actions = document.createElement('div');
    actions.className = 'film-player-actions';
    const play = document.createElement('button');
    play.type = 'button';
    play.textContent = 'Play with Sound';
    play.setAttribute('aria-label','Play video with sound');
    const status = document.createElement('span');
    status.className = 'film-player-status';
    status.setAttribute('role','status');
    status.setAttribute('aria-live','polite');
    const source = video.querySelector('source');
    const url = source ? source.getAttribute('src') : video.getAttribute('src');
    const fallback = document.createElement('a');
    if (url) { fallback.href = url; fallback.textContent = 'Open video separately'; fallback.setAttribute('download',''); }
    else { fallback.hidden = true; }
    actions.append(play, status, fallback);
    wrapper.insertAdjacentElement('afterend', actions);
    const message = (text) => { status.textContent = text; };
    play.addEventListener('click', async () => {
      video.muted = false;
      video.volume = 1;
      video.controls = true;
      try {
        await video.play();
        message('Playing with sound. Check your device volume if you cannot hear audio.');
      } catch (error) {
        message('Your browser blocked playback. Try the video controls or open the video separately.');
      }
    });
    video.addEventListener('error', () => message('Video could not load. Open the video separately or try again.'));
    video.addEventListener('stalled', () => message('Video is waiting for data. Check your connection or try again.'));
    video.addEventListener('playing', () => message(video.muted ? 'Playing muted. Select Play with Sound to enable audio.' : 'Playing with sound.'));
    video.addEventListener('waiting', () => message('Buffering video…'));
    video.addEventListener('ended', () => message('Playback finished.'));
    video.addEventListener('volumechange', () => {
      if (video.muted || video.volume === 0) message('Sound is off. Select Play with Sound to enable audio.');
    });
  });
});
