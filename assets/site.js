// Consent-gated analytics: no Google request before explicit acceptance.
(function(){
 const id=String(window.TRINITY_GA4_MEASUREMENT_ID||'').trim();
 if(!/^G-[A-Z0-9]+$/.test(id))return;
 const key='trinity_analytics_consent_v1';
 let choice=null,loaded=false;
 try{const v=localStorage.getItem(key);if(v==='accepted'||v==='declined')choice=v;}catch(e){}
 function enable(){
  if(loaded)return;
  loaded=true;
  window.dataLayer=window.dataLayer||[];
  window.gtag=function(){window.dataLayer.push(arguments);};
  window.gtag('js',new Date());
  window.gtag('config',id,{send_page_view:true});
  const script=document.createElement('script');script.async=true;
  script.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(id);
  document.head.appendChild(script);
 }
 function update(value){
  if(value!=='accepted'&&value!=='declined')return;
  choice=value;
  try{localStorage.setItem(key,value);}catch(e){}
  if(value==='accepted')enable();
  if(value==='declined'){
   // Clear first-party GA cookies for this host and common parent-domain scope.
   const names=document.cookie.split(';').map(x=>x.trim().split('=')[0]).filter(n=>/^_ga(?:_|$)|^_gid$|^_gat(?:_|$)/.test(n));
   const host=location.hostname;const domains=['',host,'.'+host];
   const pieces=host.split('.');if(pieces.length>2)domains.push('.'+pieces.slice(-2).join('.'));
   for(const name of names)for(const domain of domains)for(const path of ['/']){
    document.cookie=name+'=; Max-Age=0; path='+path+'; SameSite=Lax'+(domain?'; domain='+domain:'');
   }
   if(loaded){location.reload();return;}
  }
  render();
 }
 function render(){
  document.getElementById('trinity-consent-banner')?.remove();
  document.getElementById('trinity-privacy-settings')?.remove();
  const settings=document.createElement('button');settings.id='trinity-privacy-settings';settings.type='button';settings.className='trinity-privacy-settings';settings.textContent='Privacy choices';
  settings.addEventListener('click',()=>{choice=null;render();});
  document.body.append(settings);
  if(choice!==null)return;
  const panel=document.createElement('section');panel.id='trinity-consent-banner';panel.className='trinity-consent-banner';panel.setAttribute('aria-label','Analytics privacy choices');
  const p=document.createElement('p');p.textContent='May we use optional Google Analytics to understand website visits? Declining keeps analytics off. ';
  const a=document.createElement('a');a.href='privacy.html';a.textContent='Privacy notice';p.append(a);
  const actions=document.createElement('div');actions.className='trinity-consent-actions';
  for(const [label,value] of [['Decline','declined'],['Accept analytics','accepted']]){
   const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',()=>update(value));actions.append(b);
  }
  panel.append(p,actions);document.body.append(panel);
 }
 window.TRINITY_SET_ANALYTICS_CONSENT=update;
 if(choice==='accepted')enable();
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render);else render();
})();

document.addEventListener('DOMContentLoaded',()=>{const b=document.querySelector('.menu'),n=document.querySelector('.links');if(b&&n){if(!n.id)n.id='primary-navigation';b.setAttribute('aria-controls',n.id);b.setAttribute('aria-expanded',String(n.classList.contains('open')))}b?.addEventListener('click',()=>{if(!n)return;const open=n.classList.toggle('open');b.setAttribute('aria-expanded',String(open))});n?.addEventListener('click',e=>{if(e.target.closest('a')&&n.classList.contains('open')){n.classList.remove('open');b?.setAttribute('aria-expanded','false')}});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&n?.classList.contains('open')){n.classList.remove('open');b?.setAttribute('aria-expanded','false');b?.focus()}});const form=document.getElementById('inquiry');if(form)form.addEventListener('submit',e=>{e.preventDefault();const d=new FormData(form),email=(window.TRINITY_CONTACT_EMAIL||'').trim();if(!email){document.getElementById('form-feedback').textContent='Contact email is not configured yet. Please use the published contact information when available.';return;}const lines=['Name: '+d.get('name'),'Organization: '+d.get('organization'),'Reply email: '+d.get('email'),'Interest: '+d.get('interest'),'Preferred meeting times / time zone: '+d.get('times'),'Message: '+d.get('message')];location.href='mailto:'+encodeURIComponent(email)+'?subject='+encodeURIComponent('Trinity Continuum inquiry: '+d.get('interest'))+'&body='+encodeURIComponent(lines.join('\n'));document.getElementById('form-feedback').textContent='Your email application should open with a prepared message. Please send it from there.';});const copyInquiry=document.getElementById('copy-inquiry');if(copyInquiry&&form)copyInquiry.addEventListener('click',async()=>{if(!form.reportValidity())return;const d=new FormData(form);const email=(window.TRINITY_CONTACT_EMAIL||'jack@trinitycontinuum.com').trim();const body=['To: '+email,'Subject: Trinity Continuum inquiry: '+d.get('interest'),'','Name: '+d.get('name'),'Organization: '+d.get('organization'),'Reply email: '+d.get('email'),'Interest: '+d.get('interest'),'Preferred meeting times / time zone: '+d.get('times'),'Message: '+d.get('message')].join('\n');const feedback=document.getElementById('form-feedback');try{await navigator.clipboard.writeText(body);feedback.textContent='Inquiry copied. Paste into your email and send it to '+email+'. No message has been sent automatically.'}catch{const t=document.createElement('textarea');t.value=body;t.readOnly=true;t.style.width='100%';t.rows=9;feedback.replaceChildren(document.createTextNode('Copy this inquiry into an email to '+email+':'),t);t.focus();t.select()}});const booking=document.querySelector('[data-booking]');if(booking&&window.TRINITY_BOOKING_URL){booking.href=window.TRINITY_BOOKING_URL;booking.hidden=false;}});

// Public-facing architecture descriptions supplied in Trinity's Phase 3 brief.
const trinityModules={
  '1':['Thermal systems','Controlled combustion, thermal-energy transfer, and associated primary equipment.'],
  '2':['Power and energy recovery','Electrical generation, energy recovery, and coordinated power-system functions.'],
  '3':['Vacuum distillation','Water purification through the integrated vacuum-distillation process.'],
  '4':['Water polishing and storage','Final water treatment, polishing, quality monitoring, and product-water handling.'],
  '5':['Control and auxiliary systems','Supporting controls, auxiliary equipment, system integration, and operating infrastructure. Final equipment allocation pending approved documentation.'],
  '6':['Control and auxiliary systems','Supporting controls, auxiliary equipment, system integration, and operating infrastructure. Final equipment allocation pending approved documentation.']
};
document.addEventListener('DOMContentLoaded',()=>{
 const detail=document.getElementById('module-detail');
 document.querySelectorAll('[data-module]').forEach(button=>button.addEventListener('click',()=>{
   const id=button.dataset.module;const item=trinityModules[id];if(!item||!detail)return;
   document.querySelectorAll('[data-module]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
   detail.replaceChildren();const h=document.createElement('h3');h.textContent=`Trailer ${id.padStart(2,'0')} · ${item[0]}`;const p=document.createElement('p');p.textContent=item[1];detail.append(h,p);
 }));
 const b=document.querySelector('[data-booking]');
 if(b&&!window.TRINITY_BOOKING_URL){b.hidden=true;}
});

document.addEventListener('DOMContentLoaded',()=>{
 const params=new URLSearchParams(location.search);
 const interest=params.get('interest');
 const sel=document.querySelector('select[name="interest"]');
 if(sel && interest && [...sel.options].some(o=>o.value===interest)) sel.value=interest;
});

// Give skip-link users keyboard focus at the main content.
document.addEventListener('DOMContentLoaded',()=>{
  const main=document.getElementById('main');
  const skip=document.querySelector('a.skip[href="#main"]');
  if(main&&skip){
    if(!main.hasAttribute('tabindex')) main.setAttribute('tabindex','-1');
    skip.addEventListener('click',()=>main.focus());
  }
});
