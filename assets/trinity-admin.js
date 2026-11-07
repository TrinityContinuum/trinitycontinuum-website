// Browser-side management UI. Credentials remain in memory only.
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.95.0';
const el=id=>document.getElementById(id);
let client=null,session=null,endpoint='';
const output=(id,data)=>{el(id).textContent=typeof data==='string'?data:JSON.stringify(data,null,2)};
const call=async(action,payload={})=>{
 if(!session||!endpoint)throw Error('Sign in first.');
 const res=await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({action,...payload})});
 const body=await res.json();if(!res.ok)throw Error(body.error||'Request failed');return body;
};
const run=async(id,action,payload={})=>{try{output(id,await call(action,payload))}catch(e){output(id,e.message)}};
el('login').onclick=async()=>{
 try{
  const url=el('url').value.trim().replace(/\/$/,'');
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url))throw Error('Enter the dedicated Trinity Supabase project URL.');
  const key=el('key').value.trim();if(!key)throw Error('Enter the publishable key.');
  client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const {data,error}=await client.auth.signInWithPassword({email:el('email').value.trim(),password:el('password').value});
  el('password').value='';
  if(error)throw error;
  session=data.session;endpoint=url+'/functions/v1/trinity-admin';
  el('authstate').textContent='Signed in. Server must separately authorize this account.';
 }catch(e){session=null;el('authstate').textContent=e.message}
};
el('logout').onclick=async()=>{if(client)await client.auth.signOut();session=null;client=null;endpoint='';el('authstate').textContent='Signed out.'};
for(const button of document.querySelectorAll('[data-action]'))button.onclick=()=>run(button.dataset.action,button.dataset.action);
el('createcampaign').onclick=()=>run('campaigns','create_campaign',{code:el('campaigncode').value,title:el('campaigntitle').value});
el('approvecontact').onclick=()=>run('eligibilityresult','eligibility',{id:el('contactid').value,approved:true});
el('rejectcontact').onclick=()=>run('eligibilityresult','eligibility',{id:el('contactid').value,approved:false});
el('suppress').onclick=()=>run('suppressresult','suppress',{email:el('suppressemail').value,reason:el('suppressreason').value});
el('savedraft').onclick=()=>run('draftresult','draft',{contact_id:el('draftcontact').value,campaign_id:el('draftcampaign').value,subject:el('draftsubject').value,body:el('draftbody').value});
el('approvedraft').onclick=()=>run('reviewresult','review_draft',{id:el('draftid').value,approved:true});
el('canceldraft').onclick=()=>run('reviewresult','review_draft',{id:el('draftid').value,approved:false});
// Minimal RFC4180 CSV parser: quoted commas, escaped quotes and newlines.
function csvRows(s){
 let rows=[],row=[],cell='',quoted=false;
 for(let i=0;i<s.length;i++){
  const ch=s[i];
  if(ch==='"'){if(quoted&&s[i+1]==='"'){cell+='"';i++}else quoted=!quoted}
  else if(ch===','&&!quoted){row.push(cell);cell=''}
  else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&s[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell=''}
  else cell+=ch;
 }
 if(quoted)throw Error('Unclosed quoted CSV field');
 row.push(cell);if(row.some(x=>x.trim()))rows.push(row);return rows;
}
el('import').onclick=async()=>{
 try{
  const file=el('csv').files[0];if(!file)throw Error('Select a CSV file');
  if(file.size>100000)throw Error('Use CSV batches under 100 KB');
  const rows=csvRows(await file.text());if(rows.length<2)throw Error('CSV has no records');
  const headers=rows.shift().map(x=>x.trim().toLowerCase().replace(/^\ufeff/,''));
  if(!headers.includes('email'))throw Error('CSV needs an email column');
  const allowed=['email','name','organization','industry','region','source','source_details'];
  const records=rows.map(row=>Object.fromEntries(allowed.map(k=>[k,(row[headers.indexOf(k)]||'').trim()])));
  if(records.length>100)throw Error('Maximum 100 records per import');
  output('importresult',await call('import',{contacts:records}));
 }catch(e){output('importresult',e.message)}
};