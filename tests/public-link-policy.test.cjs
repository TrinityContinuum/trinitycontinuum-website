// Public-site source confidentiality and film-preservation guard.
// Run: node tests/public-link-policy.test.cjs
// This checks link policy in published HTML/JS, not anonymous streaming playback.
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const pages=fs.readdirSync(root).filter(f=>f.endsWith('.html')&&fs.statSync(path.join(root,f)).isFile());
const assetsDir=path.join(root,'assets');
const runtime=fs.existsSync(assetsDir)?fs.readdirSync(assetsDir).filter(f=>f.endsWith('.js')).map(f=>'assets/'+f):[];
const forbidden=[
  /(?:drive|docs)\.google\.com\//i,
  /trinity-continuum-golden-library\.jackspurewater\.chatgpt\.site/i
];
const failures=[];
for(const file of [...pages,...runtime]){
  const src=fs.readFileSync(path.join(root,file),'utf8');
  for(const rx of forbidden){
    if(rx.test(src))failures.push(file+' contains restricted-source destination '+rx);
  }
}
const film=fs.readFileSync(path.join(root,'film-presentations.html'),'utf8');
const ids=[
  '4a280414b961425d12074fc7e20830cc',
  '8feca7a3ab6dab53e7c475de4444b169',
  '6256a17244fcf1f7ea5eb84b335dec47',
  '73c9cdab30dc4e55f92fb2bc5b716711'
];
for(const id of ids){
  const url='https://app.heygen.com/embeds/'+id;
  if(!film.includes(url))failures.push('original public film embed absent: '+id);
}
if(!fs.existsSync(path.join(root,'gold-request.html')))failures.push('public controlled-review request page missing');
if(failures.length){
  console.error('PUBLIC LINK POLICY FAIL:',failures.join('\n'));
  process.exitCode=1;
}else{
  console.log('PASS public-source link policy: '+pages.length+' HTML pages and '+runtime.length+' runtime JS files; no direct controlled Drive/Docs/workspace destinations.');
  console.log('PASS four unchanged film embed identifiers present (playback access requires separate anonymous browser check).');
}
