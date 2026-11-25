/* Public overview notice: informational only. No acknowledgment or access gate. */
document.addEventListener('DOMContentLoaded', () => {
  if (!['investors', 'texas', 'india'].includes(document.body.dataset.page)) return;
  const main = document.querySelector('main');
  if (!main || document.getElementById('trinity-overview-notice')) return;
  const notice = document.createElement('aside');
  notice.id = 'trinity-overview-notice';
  notice.className = 'notice';
  notice.setAttribute('aria-label', 'Engineering and investment disclosure');
  notice.innerHTML = '<strong>Engineering &amp; investment disclosure</strong><p>Established Gold engineering is distinguished from Mumbai CAD completion, first-article turbocharger development and integrated performance qualification. Planning output and financial figures are not guarantees. No securities are offered or sold through this website.</p>';
  main.append(notice);
});
