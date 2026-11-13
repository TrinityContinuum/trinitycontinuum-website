const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const code=fs.readFileSync('assets/site.js','utf8');
function run(saved){
 const requests=[], cookies=[], handlers={}, elements=new Map();
 const storage=new Map(saved?[['trinity_analytics_consent_v1',saved]]:[]);
 function element(tag){
  return {tagName:tag,children:[],style:{},classList:{contains:()=>false},setAttribute(){},append(...items){for(const item of items){item.parent=this;this.children.push(item)}},appendChild(child){child.parent=this;this.children.push(child);if(child.src)requests.push(child.src)},remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this)},addEventListener(name,fn){this['on'+name]=fn},set textContent(v){this.text=v},get textContent(){return this.text}};
 }
 const document={readyState:'loading',cookie:'',head:element('head'),body:element('body'),createElement:element,getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(name,fn){handlers[name]=fn}};
 const window={TRINITY_GA4_MEASUREMENT_ID:'G-Z94YQ4TYGZ'};
 const context={window,document,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},location:{hostname:'trinitycontinuum.com',reload(){requests.push('reload')},search:''},URLSearchParams,console};
 vm.runInNewContext(code,context);
 handlers.DOMContentLoaded();
 return {requests,storage,document,window};
}
test('no Google request before visitor consent',()=>{const s=run();assert.equal(s.requests.length,0);assert.ok(s.document.body.children.some(x=>x.id==='trinity-consent-banner'));});
test('declining keeps GA disabled',()=>{const s=run();s.window.TRINITY_SET_ANALYTICS_CONSENT('declined');assert.equal(s.requests.length,0);assert.equal(s.storage.get('trinity_analytics_consent_v1'),'declined');});
test('acceptance enables GA exactly once',()=>{const s=run();s.window.TRINITY_SET_ANALYTICS_CONSENT('accepted');s.window.TRINITY_SET_ANALYTICS_CONSENT('accepted');assert.equal(s.requests.filter(x=>x.includes('/gtag/js')).length,1);});
test('stored decline remains disabled on return visit',()=>{const s=run('declined');assert.equal(s.requests.length,0);});
test('stored acceptance loads GA on return visit',()=>{const s=run('accepted');assert.equal(s.requests.filter(x=>x.includes('/gtag/js')).length,1);});
test('withdrawal reloads after prior activation',()=>{const s=run('accepted');s.window.TRINITY_SET_ANALYTICS_CONSENT('declined');assert.equal(s.storage.get('trinity_analytics_consent_v1'),'declined');assert.ok(s.requests.includes('reload'));});
