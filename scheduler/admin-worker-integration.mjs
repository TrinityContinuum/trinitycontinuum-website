// Integration entrypoint for the existing private appointment-admin Worker.
// DEPLOY ONLY after the original admin worker is committed as ./legacy-admin-worker.mjs,
// D1 migration 003 is applied, and the staging auth/CSRF tests pass.
// The legacy worker is the authoritative authentication gate for every route.
import legacyAdmin from './legacy-admin-worker.mjs';
import {bookingAdminApi} from './booking-admin-api.mjs';
import {openSlotsApi} from './open-slots-api.mjs';
import {settingsApi} from './settings-api.mjs';
import {opportunityApi} from './opportunities-api.mjs';
import {ADMIN_DESK_HTML} from './admin-desk-page.mjs';
const reply=(body,status=200,headers={})=>new Response(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer',...headers}});
export default {
  async fetch(req,env,ctx){
    const url=new URL(req.url);
    const enhanced=url.pathname==='/api/scheduler/bookings'||url.pathname.startsWith('/api/scheduler/bookings/')||url.pathname==='/api/scheduler/settings'||url.pathname==='/api/scheduler/open-slots'||url.pathname.startsWith('/api/scheduler/open-slots/')||url.pathname==='/desk'||url.pathname==='/api/opportunities'||url.pathname.startsWith('/api/opportunities/');
    if(!enhanced)return legacyAdmin.fetch(req,env,ctx);
    if(!['GET','POST','PATCH','PUT','DELETE'].includes(req.method))return reply('Method not allowed',405,{'allow':'GET, POST, PATCH, PUT, DELETE'});
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
      const nonce=crypto.randomUUID().replaceAll('-','');
      const page=ADMIN_DESK_HTML.replaceAll('trinity-desk-v1',nonce);
      return reply(page,200,{'content-type':'text/html; charset=utf-8',
        'content-security-policy':`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`});
    }
    if(url.pathname==='/desk')return reply('Method not allowed',405);
    if(url.pathname==='/api/scheduler/bookings'||url.pathname.startsWith('/api/scheduler/bookings/')){
      // The legacy gate authenticates access, but may not bind the Basic username
      // to the credential. Never record a client-controlled username as audit actor.
      // For a single-admin deployment configure a server-side verified identity.
      // Multi-admin deployments must replace this with an identity returned by
      // the trusted authentication provider, not the request Authorization header.
      const actor=env.ADMIN_AUDIT_IDENTITY;
      if(typeof actor!=='string'||!/^[A-Za-z0-9._@-]{1,120}$/.test(actor)){
        return reply('Trusted administrator audit identity not configured',503);
      }
      return bookingAdminApi(req,env,actor);
    }
    if(url.pathname==='/api/scheduler/settings')return settingsApi(req,env);
    if(url.pathname==='/api/scheduler/open-slots'||url.pathname.startsWith('/api/scheduler/open-slots/'))return openSlotsApi(req,env);
    return opportunityApi(req,env);
  }
};
