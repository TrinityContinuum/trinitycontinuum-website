const {test, expect}=require('@playwright/test');
const axePath=require.resolve('axe-core/axe.min.js');
const BASE='http://127.0.0.1:8765';
const routes=[
  'index.html?view=site',
  'contact.html',
  'meetings.html',
  'privacy.html',
  'film-presentations.html',
  'gold-request.html',
  'project-interest.html',
  'golden-library.html'
];
// Automated WCAG 2.x diagnostics are a necessary subset, not a human WCAG audit.
// Report violations in CI; require remediation for serious or critical findings.
// The opening film uses a separate ARIA modal and is tested in the regular suite.
for (const [device, viewport] of Object.entries({
  desktop:{width:1440,height:900},
  mobile:{width:390,height:844}
})) {
  test.describe('WCAG automated '+device,()=>{
    test.use({viewport});
    for(const route of routes){
      test(route,async({page})=>{
        await page.goto(BASE+'/'+route,{waitUntil:'domcontentloaded'});
        await page.addScriptTag({path:axePath});
        const issues=await page.evaluate(async()=> {
          const result=await window.axe.run(document,{runOnly:{
            type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']
          }});
          return result.violations.map(v=>({
            id:v.id,impact:v.impact,description:v.description,
            nodes:v.nodes.slice(0,5).map(n=>({target:n.target,summary:n.failureSummary}))
          }));
        });
        const blockers=issues.filter(v=>['serious','critical'].includes(v.impact));
        if (issues.length) console.log('AXE_DIAGNOSTICS '+device+' '+route+' '+JSON.stringify(issues));
        expect(blockers,device+' '+route+' serious/critical WCAG violations').toEqual([]);
      });
    }
  });
}
