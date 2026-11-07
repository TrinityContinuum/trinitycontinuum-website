(()=>{'use strict';
const el=id=>document.getElementById(id);
const safeCampaign=s=>(s||'general').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,64)||'general';
const build=()=>{
 const company=el('company').value.trim()||'your organization';
 const industry=el('industry').value;
 const campaign=safeCampaign(el('campaign').value);
 const url='https://trinitycontinuum.com/project-interest.html?campaign='+encodeURIComponent(campaign);
 return 'Subject: Exploring Water + Power + Thermal infrastructure for '+industry+'\n\n'+
 'Hello,\n\nWe are reaching out to introduce Trinity Continuum and explore whether our developing modular Water + Power + Thermal infrastructure platform may be relevant to '+company+'.\n\n'+
 'The platform combines UltraPure vacuum-distilled water, electrical generation and useful thermal recovery. Engineering specifications, availability, pricing and suitability require confirmation by Trinity management.\n\n'+
 'Trinity Continuum: https://trinitycontinuum.com/\n'+
 'Project inquiries and questions: '+url+'\n\n'+
 'You may also reply directly to this message.\n\n'+
 'Regards,\n'+(el('sender').value.trim()||'Trinity Continuum AI Correspondent')+
 '\nAI correspondence representative for Trinity Continuum\n\n'+
 '[Approved business mailing address and unsubscribe instructions required before real outreach]';
};
el('preview').addEventListener('click',()=>{el('sample').textContent=build()});
el('copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(build());el('copy').textContent='Copied';}catch{el('copy').textContent='Copy unavailable';}});
el('triage').addEventListener('click',()=>{
 const category=el('category').value,words=el('detail').value.trim().split(/\s+/).filter(Boolean).length;
 const hold=category==='commercial',base=category==='general'?20:category==='project'?40:category==='technical'?75:0;
 el('decision').textContent=hold?'Human review required. No automatic send.':
 'Proposed delay: '+Math.min(90,base+(words>80?15:words>30?5:0))+' minutes after receipt. Draft generated promptly. Actual timing depends on backend scheduler.';
});
el('preview').click();el('triage').click();
})();