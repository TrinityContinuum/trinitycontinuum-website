// Pure deterministic policies shared by staging UI and test suite.
export const DAILY_CEILING=300;
export const HOURLY_CEILING=100;
export function scheduleMinutes(category,detailWords=0){
 if(['Costs / commercial terms','Engineering specifications / validation','Procurement / availability','Site suitability / permitting'].includes(category))return null;
 const base=category==='General evaluation'?20:category==='Other'?40:45;
 return Math.min(90,base+(detailWords>80?15:detailWords>30?5:0));
}
export function mayQueue(contact,campaign,suppressed=false){
 return Boolean(contact?.eligibility_confirmed&&contact?.status==='eligible'&&!suppressed&&campaign?.enabled&&campaign?.approved_at&&campaign?.daily_limit>0&&campaign?.hourly_limit>0);
}
export function normalizedEmail(value){return typeof value==='string'?value.trim().toLowerCase():''}
export function campaignCode(value){return typeof value==='string'&&/^[a-zA-Z0-9_-]{2,64}$/.test(value)?value:null}
export function validateBatch(rows){return Array.isArray(rows)&&rows.length>0&&rows.length<=100}
