// Trinity booking policy: pure logic for Cloudflare Worker integration.
// STAGING ONLY; importing does NOT activate automatic booking.
export const MEETING_FORMATS=Object.freeze(['open_group','private_group','one_on_one']);
export const CENTRAL_STARTS=Object.freeze(['13:30','14:00','14:30','15:00','15:30']);
export const DURATION_MINUTES=30;
export const MEET_CONNECTION_LIMIT=500; // includes host and any co-hosts
export function validCentralSlot(date,time){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!CENTRAL_STARTS.includes(time))return false;
 const [y,m,d]=date.split('-').map(Number);
 const dt=new Date(Date.UTC(y,m-1,d,12));
 return dt.getUTCFullYear()===y&&dt.getUTCMonth()+1===m&&dt.getUTCDate()===d&&dt.getUTCDay()!==0&&dt.getUTCDay()!==6;
}
export function canJoinSlot(slot,requestedFormat,confirmedCount,hostConnections=1){
 if(!MEETING_FORMATS.includes(requestedFormat))return false;
 if(!slot)return true;
 if(slot.status!=='confirmed'||slot.format!=='open_group'||requestedFormat!=='open_group')return false;
 return confirmedCount + Math.max(1,hostConnections)<MEET_CONNECTION_LIMIT;
}
export function slotKey(date,time){if(!validCentralSlot(date,time))throw Error('Outside Trinity scheduling window');return date+'T'+time+'[America/Chicago]';}
export function requiresDistinctMeet(format){return format!=='open_group';}
// Enforce one-row-per-slot with UNIQUE slot_key and a D1 transaction/conditional claim.
// Use a single Meet event for all open_group participants; reuse its actual Meet URL.
// Never add unrelated clients to private_group or one_on_one attendee lists.
// On provider failure, leave slot/attendee in partial state for reconciliation;
// never claim the appointment is confirmed until Google Calendar returns an event.
// This module does not handle OAuth credentials; those must be Worker secrets.
