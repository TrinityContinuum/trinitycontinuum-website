/* Trinity Continuum cinematic homepage introduction, REV C */
(() => {
  'use strict';

  const startIntro = () => {
    if (document.body.dataset.page !== 'index') return;
    if (document.getElementById('trinity-film-intro')) return;

    const root = document.createElement('div');
    root.id = 'trinity-film-intro';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Trinity Continuum introduction film');

    root.innerHTML = `
      <video
        id="trinity-intro-video"
        playsinline
        preload="auto"
        aria-label="Trinity Continuum introduction"
        src="assets/trinity-intro-captioned.mp4"
      ></video>

      <div class="trinity-intro-actions">
        <button id="trinity-intro-sound" type="button" hidden>
          Restart with Sound
        </button>
        <button id="trinity-intro-fullscreen" type="button">
          Enter Fullscreen
        </button>
        <button id="trinity-intro-skip" type="button">
          Skip Intro ✕
        </button>
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      #trinity-film-intro {
        position: fixed;
        inset: 0;
        width: 100%;
        height: 100vh;
        height: 100dvh;
        z-index: 2147483640;
        background: #000;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      #trinity-film-intro:fullscreen {
        width: 100%;
        height: 100%;
      }

      #trinity-intro-video {
        width: 100%;
        height: 100%;
        object-fit: contain;
        background: #000;
      }

      .trinity-intro-actions {
        position: absolute;
        z-index: 2;
        top: max(18px, env(safe-area-inset-top));
        right: max(18px, env(safe-area-inset-right));
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .trinity-intro-actions button {
        border: 1px solid #ffffff99;
        border-radius: 8px;
        background: #07111edb;
        color: #fff;
        padding: 12px 16px;
        font: 600 15px system-ui, sans-serif;
        cursor: pointer;
      }

      .trinity-intro-actions button:hover {
        background: #18334e;
      }

      .trinity-intro-actions button:focus-visible {
        outline: 3px solid #fff;
        outline-offset: 3px;
      }

      .trinity-intro-actions button[hidden] {
        display: none;
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(root);

    const video = root.querySelector('#trinity-intro-video');
    const sound = root.querySelector('#trinity-intro-sound');
    const fullscreen = root.querySelector('#trinity-intro-fullscreen');
    const skip = root.querySelector('#trinity-intro-skip');

    let closed = false;

    const close = () => {
      if (closed) return;
      closed = true;
      video.pause();

      if (document.fullscreenElement === root) {
        document.exitFullscreen().catch(() => {});
      }

      root.remove();
      style.remove();
    };

    skip.addEventListener('click', close);
    video.addEventListener('ended', close);

    fullscreen.addEventListener('click', async () => {
      try {
        if (document.fullscreenElement === root) {
          await document.exitFullscreen();
        } else if (root.requestFullscreen) {
          await root.requestFullscreen();
        } else if (video.webkitEnterFullscreen) {
          video.webkitEnterFullscreen();
        }
      } catch (error) {
        fullscreen.textContent = 'Fullscreen unavailable';
      }
    });

    document.addEventListener('fullscreenchange', () => {
      if (closed) return;
      fullscreen.textContent =
        document.fullscreenElement === root
          ? 'Exit Fullscreen'
          : 'Enter Fullscreen';
    });

    video.addEventListener('error', () => {
      if (closed) return;
      sound.hidden = false;
      sound.textContent = 'Video unavailable: Skip Intro';
      sound.onclick = close;
    });

    sound.addEventListener('click', async () => {
      if (closed || video.error) return;

      video.pause();
      video.currentTime = 0;
      video.muted = false;

      try {
        await video.play();
        sound.hidden = true;
      } catch (error) {
        sound.textContent = 'Play with Sound';
        sound.hidden = false;
      }
    });

    const start = async () => {
      video.muted = false;

      try {
        await video.play();
      } catch (error) {
        if (closed || video.error) return;

        video.muted = true;
        sound.hidden = false;

        try {
          await video.play();
        } catch (mutedError) {
          if (closed || video.error) return;
          sound.textContent = 'Play with Sound';
        }
      }
    };

    start();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startIntro, {
      once: true
    });
  } else {
    startIntro();
  }
})();
