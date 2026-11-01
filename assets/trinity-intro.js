/* Trinity Continuum homepage film introduction, REV B */
(() => {
  'use strict';

  const startIntro = () => {
    // Only run on the homepage.
    if (document.body.dataset.page !== 'index') return;

    const root = document.createElement('div');
    root.id = 'trinity-film-intro';
    root.setAttribute('role', 'dialog');
    root.setAttribute(
      'aria-label',
      'Trinity Continuum introduction film'
    );

    root.innerHTML = `
      <video
        id="trinity-intro-video"
        playsinline
        preload="auto"
        aria-label="Trinity Continuum introduction"
        src="assets/trinity-intro-captioned.mp4"
      ></video>

      <div class="trinity-intro-actions">
        <button
          id="trinity-intro-sound"
          type="button"
          hidden
        >Restart with Sound</button>

        <button
          id="trinity-intro-skip"
          type="button"
        >Skip Intro ✕</button>
      </div>
    `;

    const style = document.createElement('style');

    style.textContent = `
      #trinity-film-intro {
        position: fixed;
        inset: 0;
        z-index: 2147483640;
        background: #000;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      #trinity-intro-video {
        width: 100%;
        height: 100%;
        object-fit: contain;
        background: #000;
      }

      .trinity-intro-actions {
        position: absolute;
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
        color: white;
        padding: 12px 16px;
        font: 600 15px system-ui, sans-serif;
        cursor: pointer;
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
    const skip = root.querySelector('#trinity-intro-skip');

    let closed = false;

    const close = () => {
      if (closed) return;
      closed = true;
      video.pause();
      root.remove();
      style.remove();
    };

    skip.addEventListener('click', close);
    video.addEventListener('ended', close);

    video.addEventListener('error', () => {
      if (closed) return;
      sound.hidden = false;
      sound.textContent = 'Video unavailable: Skip Intro';
      sound.onclick = close;
    });

    sound.addEventListener('click', async () => {
      if (closed) return;

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
