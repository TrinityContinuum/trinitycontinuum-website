import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";

const src=readFileSync(new URL("../cloudflare/appointment-queue/direct-booking.js",import.meta.url),"utf8");
const { _bookingPolicyTest: p }=await import("data:text/javascript;base64,"+Buffer.from(src).toString("base64"));
const weekdayWindows=[1,2,3,4,5].map(weekday=>({weekday,start:"13:30",end:"16:30"}));

test("Weekday appointment starts are 13:30 through 16:00 inclusive in America/Chicago",()=>{
 for(const day of ["2026-11-23","2026-11-24","2026-11-25","2026-11-30"]) {
  assert.equal(p.slotWithin(day,"13:30",weekdayWindows),true);
  assert.equal(p.slotWithin(day,"16:00",weekdayWindows),true);
  for(const time of ["12:30","13:00","16:30","17:00"]) assert.equal(p.slotWithin(day,time,weekdayWindows),false);
 }
 assert.equal(p.slotWithin("2026-11-21","13:30",weekdayWindows),false);
 assert.equal(p.slotWithin("2026-11-22","14:00",weekdayWindows),false);
});

test("Observed U.S. federal holiday calendar excludes Thanksgiving and all observed federal holidays",()=>{
 for(const d of ["2026-11-26","2026-12-25","2027-01-01","2027-06-18","2027-07-05",
   "2027-11-11","2027-11-25","2027-12-24","2027-12-31","2028-01-17"]) {
  assert.equal(p.isFederalHoliday(d),true,d);
  assert.equal(p.slotWithin(d,"14:00",weekdayWindows),false,d);
 }
 assert.equal(p.isFederalHoliday("2026-11-23"),false);
 assert.equal(p.isFederalHoliday("2027-03-15"),false);
});

test("Central time conversion changes UTC offset at 2027 DST transition",()=>{
 assert.equal(p.fromLocal("2027-03-12","13:30").toISOString(),"2027-03-12T19:30:00.000Z");
 assert.equal(p.fromLocal("2027-03-15","13:30").toISOString(),"2027-03-15T18:30:00.000Z");
});

test("Staged D1 policy defaults to management hours but automatic booking disabled",()=>{
 const db=new DatabaseSync(":memory:");
 try{
  db.exec(readFileSync(new URL("../cloudflare/appointment-queue/004_direct_booking.sql",import.meta.url),"utf8"));
  const row=db.prepare("SELECT enabled,windows_json,min_notice_hours,max_days FROM booking_policy WHERE id=1").get();
  assert.equal(row.enabled,0);
  assert.deepEqual(JSON.parse(row.windows_json),weekdayWindows);
  assert.equal(row.min_notice_hours,24);
  assert.equal(row.max_days,60);
 }finally{db.close();}
});

test("D1 serializes adjacent bookings with a 15-minute spacing buffer",()=>{
 const db=new DatabaseSync(":memory:");
 const sql=readFileSync(new URL("../cloudflare/appointment-queue/004_direct_booking.sql",import.meta.url),"utf8");
 try{
  db.exec(sql);
  const insert=db.prepare("INSERT INTO appointment_bookings (id,slot_start,slot_end,name,email,topic,state) VALUES (?,?,?,?,?,?,'processing')");
  const booking=(id,start,end)=>insert.run(id,start,end,"Test","test@example.invalid","Synthetic qualification");
  booking("a","2026-11-23T19:30:00.000Z","2026-11-23T20:00:00.000Z");
  assert.throws(()=>booking("b","2026-11-23T20:00:00.000Z","2026-11-23T20:30:00.000Z"),/15-minute buffer/);
  booking("c","2026-11-23T20:30:00.000Z","2026-11-23T21:00:00.000Z");
  const count=db.prepare("SELECT COUNT(*) AS n FROM appointment_bookings").get().n;
  assert.equal(count,2);
 }finally{db.close();}
});

test("D1 blocks a cancelled booking reactivation or overlapping reschedule",()=>{
 const db=new DatabaseSync(":memory:");
 try{
  db.exec(readFileSync(new URL("../cloudflare/appointment-queue/004_direct_booking.sql",import.meta.url),"utf8"));
  const insert=db.prepare("INSERT INTO appointment_bookings (id,slot_start,slot_end,name,email,topic,state) VALUES (?,?,?,?,?,?,?)");
  insert.run("one","2026-11-30T19:30:00.000Z","2026-11-30T20:00:00.000Z","Test","synthetic@example.invalid","Test","confirmed");
  insert.run("two","2026-11-30T20:00:00.000Z","2026-11-30T20:30:00.000Z","Test","synthetic@example.invalid","Test","cancelled");
  assert.throws(()=>db.prepare("UPDATE appointment_bookings SET state='processing' WHERE id='two'").run(),/15-minute buffer/);
  assert.throws(()=>db.prepare("UPDATE appointment_bookings SET slot_start='2026-11-30T19:45:00.000Z',slot_end='2026-11-30T20:15:00.000Z' WHERE id='one'").run(),/UNIQUE|overlap|buffer/);
  assert.equal(db.prepare("SELECT state FROM appointment_bookings WHERE id='two'").get().state,"cancelled");
 }finally{db.close()}
});
