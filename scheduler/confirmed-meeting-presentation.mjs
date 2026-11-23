// Private confirmed-appointment presentation component. NOT a public route or authorization gate.
// Call only after verifying a short-lived, owner-scoped access grant for the specific booking.
// Do not place meeting credentials in static website assets or public search indexes.
const films = [
 {title:'Engineered to Endure',id:'4a280414b961425d12074fc7e20830cc'},
 {title:'Six Trailers. One Continuum.',id:'8feca7a3ab6dab53e7c475de4444b169'},
 {title:'Pure Water. Protected by Design.',id:'6256a17244fcf1f7ea5eb84b335dec47'},
 {title:'Built to Move. Designed to Last.',id:'73c9cdab30dc4e55f92fb2bc5b716711'}
];
const escapeHtml = v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const timezone = z=>{try{new Intl.DateTimeFormat('en-US',{timeZone:z}).format();return z}catch{throw Error('invalid_guest_timezone')}};
function datetime(start,z){
 return new Intl.DateTimeFormat('en-US',{timeZone:z,weekday:'long',month:'long',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(start));
}
function validate(m){
 if(!m||m.status!=='confirmation_sent')throw Error('meeting_not_confirmed');
 if(!m.guestName||!m.startUtc||Number.isNaN(Date.parse(m.startUtc)))throw Error('meeting_fields_missing');
 timezone(m.guestTimezone);
 if(!m.googleMeetUrl||!/^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}\/?$/.test(m.googleMeetUrl))throw Error('verified_google_meet_url_required');
 if(!m.privatePageUrl||!/^https:\/\/[^\s]+$/.test(m.privatePageUrl))throw Error('private_page_url_required');
}
export function meetingTimes(m){
 timezone(m.guestTimezone);
 return {trinity:datetime(m.startUtc,'America/Chicago'),guest:datetime(m.startUtc,m.guestTimezone)};
}
export function renderConfirmedMeetingPage(m){
 validate(m);
 const when=meetingTimes(m),same=m.guestTimezone==='America/Chicago';
 const filmCards=films.map((f,i)=>`<article class="film"><p class="eyebrow">VISION ${String(i+1).padStart(2,'0')}</p><h3>${escapeHtml(f.title)}</h3><button type="button" data-embed="${f.id}" data-title="${escapeHtml(f.title)}">Watch film here</button><div class="player"></div></article>`).join('');
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer"><title>Your Trinity Continuum meeting</title><style>
 :root{font:16px/1.5 system-ui;color:#f9f5ed;background:#081625}body{margin:0}main{max-width:1060px;margin:auto;padding:30px 18px 65px}.eyebrow{color:#e3bd79;font-size:.8rem;font-weight:700;letter-spacing:.12em}h1{font-size:clamp(2rem,5vw,3.5rem);line-height:1.1}h2{font-size:1.5rem}.panel{border:1px solid #52677d;border-radius:16px;background:#152c40;padding:24px;margin-top:26px}.label{color:#c4d7e5}.films{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.film{border:1px solid #405670;border-radius:12px;padding:20px;background:#102438}a.button,button{display:inline-block;background:#d9b977;color:#081625;border:0;border-radius:8px;padding:12px 17px;font-weight:750;text-decoration:none;cursor:pointer}.film button{margin-bottom:12px}iframe{width:100%;aspect-ratio:16/9;border:0}a{color:#f0d39c}.subtle{color:#c4d7e5}@media(max-width:700px){.films{grid-template-columns:1fr}}
 </style></head><body><main><div class="eyebrow">TRINITY CONTINUUM · PRIVATE EXECUTIVE MEETING</div><h1>Water. Power. Thermal.</h1><p>One integrated vision. Engineered for resilient infrastructure.</p><section class="panel"><p class="eyebrow">YOUR CONFIRMED VIDEO CONFERENCE</p><h2>Welcome, ${escapeHtml(m.guestName)}</h2><p>${escapeHtml(m.organization||'')} · ${escapeHtml(m.title||'Trinity Continuum meeting')}</p><p><strong>Trinity time (Central):</strong> ${escapeHtml(when.trinity)}</p><p><strong>Guest local time${same?' (also Central)':''}:</strong> ${escapeHtml(when.guest)}</p><p class="subtle">${escapeHtml(m.agenda||'Introductions, Trinity capabilities and next steps.')}</p><a class="button" href="${escapeHtml(m.googleMeetUrl)}" rel="noreferrer noopener">Join Your Video Meeting</a></section><section class="panel"><h2>Explore Trinity's Four Visions</h2><p>Watch the four presentations here before or after your meeting.</p><div class="films">${filmCards}</div><p class="subtle">These films are conceptual visual interpretations, not evidence of completed installations or independently tested performance.</p><a href="https://trinitycontinuum.com/film-presentations.html#four-visions" rel="noreferrer">Open presentation page if a video cannot load</a></section></main>
 <script>document.querySelectorAll('[data-embed]').forEach(button=>button.addEventListener('click',()=>{const frame=document.createElement('iframe');frame.src='https://app.heygen.com/embeds/'+button.dataset.embed;frame.title=button.dataset.title;frame.allow='fullscreen; encrypted-media';frame.allowFullscreen=true;frame.referrerPolicy='no-referrer';frame.loading='lazy';button.nextElementSibling.replaceChildren(frame);button.remove();}));</script></body></html>`;
}
export function buildMeetingConfirmation(m){
 validate(m);
 const when=meetingTimes(m);
 const subject='Your confirmed Trinity Continuum video meeting — '+m.title;
 const body=`Hello ${m.guestName},\n\nYour Trinity Continuum video meeting is confirmed.\n\nTrinity time (Central): ${when.trinity}\nYour local time: ${when.guest}\n\nYour private meeting page (with all four Vision films): ${m.privatePageUrl}\nDirect Google Meet link (backup): ${m.googleMeetUrl}\n\nAgenda: ${m.agenda||'Introductions, Trinity capabilities and next steps.'}\n\nTrinity Continuum\nhttps://trinitycontinuum.com`;
 return {subject,body};
}
