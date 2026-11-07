document.addEventListener('DOMContentLoaded', () => {
  const form=document.getElementById('project-interest-form');
  const feedback=document.getElementById('project-interest-feedback');
  if(!form || !feedback)return;
  const assemble=()=>{
    const d=new FormData(form);
    const applications=d.getAll('applications').join(', ') || 'Not specified';
    const fields=[['Name','name'],['Organization','organization'],['Reply email','email'],['Reason','reason'],['How they heard of Trinity','source'],['Industry','industry'],['Primary question category','question_category'],['City / region','city'],['State / province','state'],['Country','country'],['Project description','project'],['Questions','questions'],['Timeline','timeline'],['Preferred response method','reply_method']];
    return 'Applications: '+applications+'\n'+fields.map(([label,key])=>label+': '+(d.get(key)||'')).join('\n\n');
  };
  const destination=()=>window.TRINITY_CONTACT_EMAIL || 'jack@trinitycontinuum.com';
  const subject=()=> 'Trinity Continuum | Project interest | '+(new FormData(form).get('organization')||'New inquiry');
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    if(!form.reportValidity())return;
    const endpoint=(window.TRINITY_INQUIRY_ENDPOINT||'').trim();
    if(endpoint){
      const d=new FormData(form);
      const payload=Object.fromEntries(d.entries());
      payload.applications=d.getAll('applications');
      payload.campaign=new URLSearchParams(location.search).get('campaign')||'';
      const submit=form.querySelector('[type="submit"]');
      submit.disabled=true;
      feedback.textContent='Submitting your inquiry securely...';
      try{
        const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
        if(!response.ok)throw new Error('Submission unavailable');
        form.reset();
        feedback.textContent='Your inquiry was received. Trinity will follow up by email; AI-assisted responses are subject to availability and review.';
      }catch{
        feedback.textContent='Automatic submission is unavailable. Please use Copy inquiry to email Trinity directly.';
      }finally{submit.disabled=false;}
      return;
    }
    window.location.href='mailto:'+encodeURIComponent(destination())+'?subject='+encodeURIComponent(subject())+'&body='+encodeURIComponent(assemble());
    feedback.textContent='A prepared email should open. Please press Send in your email application. Nothing has been submitted by the website.';
  });
  document.getElementById('project-interest-copy')?.addEventListener('click',async()=>{
    if(!form.reportValidity())return;
    const message='To: '+destination()+'\nSubject: '+subject()+'\n\n'+assemble();
    try{await navigator.clipboard.writeText(message);feedback.textContent='Inquiry copied. Paste it into an email and send to '+destination()+'.';}
    catch{const box=document.createElement('textarea');box.value=message;box.rows=10;box.readOnly=true;box.style.width='100%';feedback.replaceChildren(document.createTextNode('Copy and email this inquiry:'),box);box.focus();box.select();}
  });
});