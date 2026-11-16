// Integration entrypoint for the existing private appointment-admin Worker.
// DEPLOY ONLY after the original admin worker is committed as ./legacy-admin-worker.mjs,
// D1 migration 003 is applied, and the staging auth/CSRF tests pass.
// The legacy worker is the authoritative authentication gate for every route.
import legacyAdmin from './legacy-admin-worker.mjs';
import {opportunityApi} from './opportunities-api.mjs';
import {ADMIN_DESK_HTML} from './admin-desk-page.mjs';
const reply=(body,status=200,headers={})=>new Response(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer',...headers}});
export default {
  async fetch(req,env,ctx){
    const url=new URL(req.url);
    const enhanced=url.pathname==='/desk'||url.pathname==='/api/opportunities'||url.pathname.startsWith('/api/opportunities/');
    if(!enhanced)return legacyAdmin.fetch(req,env,ctx);
    if(!['GET','POST','PATCH'].includes(req.method))return reply('Method not allowed',405,{'allow':'GET, POST, PATCH'});
    // Authenticate with the existing private admin Worker. It checks the
    // administrator password and approved account before returning requests.
    const gate=await legacyAdmin.fetch(new Request(new URL('/api/requests',url),{
      method:'GET',headers:{Authorization:req.headers.get('Authorization')||''}
    }),env,ctx);
    if(gate.status!==200)return reply('Unauthorized',401,{'www-authenticate':'Basic realm="Trinity Private Appointments", charset="UTF-8"'});
    if(req.method!=='GET'){
      // Require browser Origin to match the private worker host.
      // This is defense-in-depth alongside the private auth gate.
      const origin=req.headers.get('Origin');
      if(!origin||origin!==url.origin)return reply('Forbidden',403);
      if(req.headers.get('Sec-Fetch-Site')==='cross-site')return reply('Forbidden',403);
    }
    if(url.pathname==='/desk'&&req.method==='GET'){
      return reply(ADMIN_DESK_HTML,200,{'content-type':'text/html; charset=utf-8',
        'content-security-policy':"default-src 'none'; script-src 'nonce-trinity-desk-v1'; style-src 'nonce-trinity-desk-v1'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"});
    }
    if(url.pathname==='/desk')return reply('Method not allowed',405);
    return opportunityApi(req,env);
  }
};
