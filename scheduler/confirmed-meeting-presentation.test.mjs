import test from 'node:test';
import assert from 'node:assert/strict';
import {meetingTimes,renderConfirmedMeetingPage,buildMeetingConfirmation} from './confirmed-meeting-presentation.mjs';
const meeting={status:'confirmation_sent',guestName:'Sondra Guffey',organization:'DeSoto County',title:'Introductory discussion',startUtc:'2026-11-16T20:30:00Z',guestTimezone:'America/New_York',googleMeetUrl:'https://meet.google.com/pvu-avat-tfb',privatePageUrl:'https://trinitycontinuum.com/private-meeting/example-token',agenda:'Six-trailer utility platform'};
test('Trinity Central is displayed before guest Eastern',()=>{
 const {trinity,guest}=meetingTimes(meeting);
 assert.match(trinity,/2:30 PM CST/);
 assert.match(guest,/3:30 PM EST/);
 const page=renderConfirmedMeetingPage(meeting);
 assert.ok(page.indexOf('Trinity time (Central)')<page.indexOf('Guest local time'));
 assert.ok(page.indexOf('2:30 PM CST')<page.indexOf('3:30 PM EST'));
});
test('four existing film embeds are included without autoplay or external page navigation',()=>{
 const page=renderConfirmedMeetingPage(meeting);
 assert.equal((page.match(/class="film"/g)||[]).length,4);
 assert.equal((page.match(/data-embed=/g)||[]).length,4); // one button per film
 assert.match(page,/film-presentations.html#four-visions/);
 assert.doesNotMatch(page,/autoplay=1/);
});
test('private data is escaped; never rendered as HTML markup',()=>{
 const page=renderConfirmedMeetingPage({...meeting,guestName:'<img src=x onerror=alert(1)>'});
 assert.match(page,/&lt;img/);
 assert.doesNotMatch(page,/<img src=x onerror=/);
});
test('unconfirmed meetings and unexpected join URLs are blocked',()=>{
 assert.throws(()=>renderConfirmedMeetingPage({...meeting,status:'approval_pending'}),/meeting_not_confirmed/);
 assert.throws(()=>buildMeetingConfirmation({...meeting,googleMeetUrl:'https://evil.example/join'}),/verified_google_meet_url_required/);
});
test('confirmation email states Central first, guest second and direct Meet fallback',()=>{
 const {body}=buildMeetingConfirmation(meeting);
 assert.ok(body.indexOf('Trinity time (Central)')<body.indexOf('Your local time'));
 assert.match(body,/https:\/\/meet.google.com\/pvu-avat-tfb/);
 assert.match(body,/private-meeting\/example-token/);
});
test('same-zone guest is explicitly labelled',()=>{
 const page=renderConfirmedMeetingPage({...meeting,guestTimezone:'America/Chicago'});
 assert.match(page,/Guest local time \(also Central\)/);
});
