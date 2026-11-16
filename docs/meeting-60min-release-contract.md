# Trinity Continuum: 60-minute video booking release contract

Status: IMPLEMENTATION REQUIRED / NOT LIVE. Owner: Jack Coates. Preserve existing appointment-request intake and all deployed functionality.

## Acceptance gates
1. Contact/information page presents a clear **Schedule a 60-minute video meeting** CTA. Until end-to-end testing passes, link only to the existing working appointment-request flow, labeled **Request a video meeting**; do not publish an instant-booking promise or unverified booking URL.
2. Admin chooses Manual / Automatic. Default Manual. Manual requests require approval; Automatic offers only genuine available 60-minute slots with calendar free/busy, timezone conversion (America/Chicago display plus visitor local zone), conflict prevention, and configurable buffers. Use atomic reservation/idempotency so concurrent visitors cannot double-book.
3. Schedule owner has authorized Google Calendar / Teams / Zoom event-creation access. On confirmation, create a fresh provider video meeting and persist its real join URL. Send confirmation and correct timezone to visitor and Trinity owner. Failed event creation or email notification must not report confirmed; retain recoverable state.
4. Test as visitor: open published contact page, submit booking, verify slot and no conflicts, verify both confirmations, verify join link opens a real meeting, verify cancellation/reschedule, verify mobile and keyboard navigation. Record actual published URL, provider IDs, test evidence and owner approval in the shared ledger.
5. Retain existing manual appointment-request functionality, protect personal information, validate email, rate-limit spam, and avoid exposing internal calendars or credentials.
6. Prospect email: 'Visit https://www.trinitycontinuum.com to learn about our integrated water, power, thermal and data-center platform. We welcome a 60-minute video discussion.' Add exact booking URL only after verified publication and authorized corporate sender gates.
7. Existing Brad Cooksey / Brent Kisling meeting: continue existing email thread for their Teams link; do not create a second invitation or fabricate a link.

## Release checklist
- [ ] Schedule owner permissions and approved meeting provider verified
- [ ] Manual / Automatic state and availability API tested
- [ ] Real video link created and both confirmations delivered in test
- [ ] Public page CTA integrated and deployed
- [ ] Live URL and complete visitor-to-confirmed-meeting test evidenced
- [ ] Jack approves release and external email template

No fabrication, technical performance or pharmaceutical claims are authorized by this scheduling workstream.
