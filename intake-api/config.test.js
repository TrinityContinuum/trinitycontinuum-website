import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

function runServer(envOverrides={}){
 const env={...process.env,DATABASE_URL:'',ADMIN_TOKEN:'',...envOverrides};
 return spawnSync(process.execPath,['server.js'],{cwd:process.cwd(),env,encoding:'utf8',timeout:12000});
}
test('API refuses to start without database configuration',()=>{
 const r=runServer({DATABASE_URL:'',ADMIN_TOKEN:'a'.repeat(40)});
 assert.notEqual(r.status,0);
 assert.match(r.stderr,/Missing required configuration: DATABASE_URL/);
});
test('API refuses to start without administrator token',()=>{
 const r=runServer({DATABASE_URL:'postgresql://localhost:5432/trinity',ADMIN_TOKEN:''});
 assert.notEqual(r.status,0);
 assert.match(r.stderr,/Missing required configuration: ADMIN_TOKEN/);
});
test('API refuses weak administrator token',()=>{
 const r=runServer({DATABASE_URL:'postgresql://localhost:5432/trinity',ADMIN_TOKEN:'short'});
 assert.notEqual(r.status,0);
 assert.match(r.stderr,/ADMIN_TOKEN must contain at least 32 characters/);
});
