import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../inquiry-preview.html',import.meta.url),'utf8');
const config=readFileSync(new URL('../assets/inquiry-config.js',import.meta.url),'utf8');
const script=readFileSync(new URL('../assets/inquiry-preview.js',import.meta.url),'utf8');

test('release configuration defaults to disabled',()=>{
 assert.match(config,/TRINITY_INTAKE_ENABLED\s*=\s*false/);
 assert.match(config,/TRINITY_INTAKE_API_URL\s*=\s*['"]['"]/);
});
test('submission button remains disabled in initial HTML',()=>{
 assert.match(html,/<button[^>]*id="submit-inquiry"[^>]*disabled/);
});
test('release requires HTTPS and explicit enablement',()=>{
 assert.match(script,/TRINITY_INTAKE_ENABLED===true/);
 assert.match(script,/https:/);
 assert.match(script,/if\(!releaseReady\)/);
});
test('release notice is updated only on enablement',()=>{
 assert.match(html,/id="release-notice"/);
 assert.match(script,/if\(releaseReady\)\{const notice=/);
});
