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
