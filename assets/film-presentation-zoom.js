/* Trinity Continuum film presentation controls.
   Enhances the four existing public HeyGen embeds in place; never replaces their
   iframe URL, controls playback, or reads cross-origin video content. */
(() => {
  'use strict';

  function initFilmPresentationZoom() {
    const frames = [...document.querySelectorAll('#four-visions .brief-verified-embed > iframe')];
    if (!frames.length) return;
    let activeViewer = null;

    frames.forEach((frame, index) => {
      const parent = frame.parentElement;
      const title = frame.getAttribute('title') || 'Film ' + (index + 1);
      const original = {
        width: frame.style.width,
        height: frame.style.height,
        aspectRatio: frame.style.aspectRatio,
        maxWidth: frame.style.maxWidth,
        flexShrink: frame.style.flexShrink
      };
      let zoom = 1;
      let previousOverflow = '';
      let fullscreenRequested = false;

      const viewer = document.createElement('div');
      viewer.className = 'film-presentation-viewer';
      viewer.setAttribute('aria-label', title + ' presentation player');

      const viewport = document.createElement('div');
      viewport.className = 'film-presentation-viewport';
      viewport.tabIndex = 0;
      viewport.setAttribute('aria-label', title + '. When enlarged, scroll here to pan the zoomed film.');

      const toolbar = document.createElement('div');
      toolbar.className = 'film-presentation-toolbar';
      toolbar.setAttribute('role', 'group');
      toolbar.setAttribute('aria-label', title + ' viewing controls');

      const btn = (className, caption, accessibleName) => {
        const element = document.createElement('button');
        element.type = 'button';
        element.className = 'film-presentation-button ' + className;
        element.textContent = caption;
        element.setAttribute('aria-label', accessibleName);
        return element;
      };

      const enter = btn('film-presentation-enter', '⛶ Full page', 'Expand ' + title + ' to full page');
      const zoomGroup = document.createElement('span');
      zoomGroup.className = 'film-presentation-zoom-group';
      const minus = btn('film-presentation-minus', '−', 'Zoom out ' + title);
      const percent = document.createElement('output');
      percent.className = 'film-presentation-percent';
      percent.setAttribute('aria-live', 'polite');
      percent.setAttribute('aria-label', 'Film zoom level');
      const plus = btn('film-presentation-plus', '+', 'Zoom in ' + title);
      const fit = btn('film-presentation-fit', 'Fit', 'Fit ' + title + ' to screen');
      const close = btn('film-presentation-exit', '✕ Exit full page', 'Exit full-page view of ' + title);
      zoomGroup.append(minus, percent, plus, fit);
      toolbar.append(enter, zoomGroup, close);

      parent.insertBefore(viewer, frame);
      viewer.append(viewport, toolbar);
      viewport.appendChild(frame);

      function isExpanded() {
        return viewer.classList.contains('film-presentation-expanded');
      }

      function renderZoom() {
        percent.value = String(Math.round(zoom * 100)) + '%';
        percent.textContent = percent.value;
        minus.disabled = zoom <= 1;
        plus.disabled = zoom >= 2;
        if (!isExpanded()) return;
        const availableWidth = viewport.clientWidth;
        const availableHeight = viewport.clientHeight;
        if (!availableWidth || !availableHeight) return;
        const fitWidth = Math.min(availableWidth, availableHeight * 16 / 9);
        const width = Math.round(fitWidth * zoom);
        frame.style.width = width + 'px';
        frame.style.height = Math.round(width * 9 / 16) + 'px';
        frame.style.aspectRatio = '16 / 9';
        frame.style.maxWidth = 'none';
        frame.style.flexShrink = '0';
        // Keep magnified imagery centered; the viewport remains scrollable.
        viewport.scrollLeft = Math.max(0, (frame.offsetWidth - availableWidth) / 2);
        viewport.scrollTop = Math.max(0, (frame.offsetHeight - availableHeight) / 2);
      }

      function activate() {
        if (isExpanded()) return;
        if (activeViewer && activeViewer !== viewer) return;
        activeViewer = viewer;
        previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        viewer.classList.add('film-presentation-expanded');
        close.focus();
        renderZoom();
      }

      function deactivate() {
        if (!isExpanded() && !viewer.classList.contains('film-presentation-fallback')) return;
        viewer.classList.remove('film-presentation-expanded', 'film-presentation-fallback');
        viewer.removeAttribute('role');
        viewer.removeAttribute('aria-modal');
        document.body.style.overflow = previousOverflow;
        frame.style.width = original.width;
        frame.style.height = original.height;
        frame.style.aspectRatio = original.aspectRatio;
        frame.style.maxWidth = original.maxWidth;
        frame.style.flexShrink = original.flexShrink;
        zoom = 1;
        renderZoom();
        viewport.scrollTop = 0;
        viewport.scrollLeft = 0;
        if (activeViewer === viewer) activeViewer = null;
        enter.focus();
      }

      function fallback() {
        if (document.fullscreenElement === viewer) return;
        viewer.classList.add('film-presentation-fallback');
        viewer.setAttribute('role', 'dialog');
        viewer.setAttribute('aria-modal', 'true');
        activate();
      }

      enter.addEventListener('click', () => {
        if (activeViewer && activeViewer !== viewer) return;
        if (typeof viewer.requestFullscreen === 'function') {
          fullscreenRequested = true;
          try {
            Promise.resolve(viewer.requestFullscreen())
              .then(() => {
                if (document.fullscreenElement === viewer) activate();
                else fallback();
              })
              .catch(fallback);
          } catch (_) {
            fallback();
          }
        } else {
          fallback();
        }
      });

      close.addEventListener('click', () => {
        if (document.fullscreenElement === viewer && typeof document.exitFullscreen === 'function') {
          Promise.resolve(document.exitFullscreen()).catch(deactivate);
        } else {
          deactivate();
        }
      });

      minus.addEventListener('click', () => {
        zoom = Math.max(1, Math.round((zoom - 0.25) * 100) / 100);
        renderZoom();
      });
      plus.addEventListener('click', () => {
        zoom = Math.min(2, Math.round((zoom + 0.25) * 100) / 100);
        renderZoom();
      });
      fit.addEventListener('click', () => {
        zoom = 1;
        renderZoom();
      });

      document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement === viewer) activate();
        else if (fullscreenRequested && isExpanded() && !viewer.classList.contains('film-presentation-fallback')) {
          fullscreenRequested = false;
          deactivate();
        }
      });

      document.addEventListener('keydown', event => {
        if (!viewer.classList.contains('film-presentation-fallback')) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          deactivate();
          return;
        }
        if (event.key !== 'Tab') return;
        const focusable = [close, minus, plus, fit, viewport].filter(el => !el.disabled);
        const current = focusable.indexOf(document.activeElement);
        if (event.shiftKey && current <= 0) {
          event.preventDefault();
          focusable[focusable.length - 1].focus();
        } else if (!event.shiftKey && (current === -1 || current === focusable.length - 1)) {
          event.preventDefault();
          focusable[0].focus();
        }
      });

      window.addEventListener('resize', () => {
        if (isExpanded()) renderZoom();
      });

      renderZoom();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFilmPresentationZoom, {once:true});
  } else {
    initFilmPresentationZoom();
  }
})();
