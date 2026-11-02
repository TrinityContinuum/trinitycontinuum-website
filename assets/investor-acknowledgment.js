/* Trinity Continuum public investor-page acknowledgment. No authentication or access control. */
document.addEventListener('DOMContentLoaded', () => {
  if (!['investors', 'texas', 'india'].includes(document.body.dataset.page)) return;
  try { if (sessionStorage.getItem('trinity-acknowledged') === 'yes') return; } catch (_) {}
  const shade = document.createElement('div');
  shade.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(4,12,24,.96);display:grid;place-items:center;padding:20px;overflow:auto';
  shade.innerHTML = `<section role="dialog" aria-modal="true" aria-labelledby="ack-title" style="background:#13243a;color:white;border:1px solid #bba77d;border-radius:16px;padding:clamp(24px,5vw,48px);max-width:580px;font:16px/1.6 system-ui,sans-serif;box-shadow:0 24px 80px #0009">
    <small style="color:#e0c995;letter-spacing:2px">TRINITY CONTINUUM</small>
    <h1 id="ack-title" style="font-size:clamp(26px,4vw,34px);line-height:1.2">Engineering &amp; Investment Overview</h1>
    <p>You are entering Trinity Continuum's public engineering and investment overview, with gateways to the current American and Indian review packages.</p>
    <p>Established Gold engineering is distinguished from Mumbai CAD completion, first-article turbocharger development and integrated performance qualification. Planning output and financial figures are not guarantees. No securities are offered or sold through this website.</p>
    <p style="color:#cbd5e1;font-size:14px">By continuing, you acknowledge this notice. No account or approval is required.</p>
    <button id="ack-continue" type="button" style="background:#d7bc83;color:#12243b;border:0;border-radius:8px;padding:12px 20px;font-weight:bold;cursor:pointer">I Understand · Continue</button>
    <a href="index.html" style="color:white;margin-left:16px;display:inline-block;padding:12px 0">Return Home</a>
  </section>`;
  document.body.append(shade);
  const prior = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  const button = shade.querySelector('button');
  const home = shade.querySelector('a');
  button.focus();
  const handleKey = e => {
    if (e.key === 'Escape') window.location.href = 'index.html';
    if (e.key === 'Tab') {
      const active = document.activeElement;
      if (e.shiftKey && active === button) { e.preventDefault(); home.focus(); }
      if (!e.shiftKey && active === home) { e.preventDefault(); button.focus(); }
    }
  };
  document.addEventListener('keydown', handleKey);
  button.addEventListener('click', () => {
    try { sessionStorage.setItem('trinity-acknowledged', 'yes'); } catch (_) {}
    document.body.style.overflow = prior;
    document.removeEventListener('keydown', handleKey);
    shade.remove();
  });
});
