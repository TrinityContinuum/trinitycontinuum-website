# Trinity Continuum — Film, Accessibility and External-Reviewer Acceptance Checklist
**Controlled website PR #51 — November 23, 2026**

**Status: OPEN FOR HUMAN ACCEPTANCE.** This checklist is a management review instrument, **not evidence that a human has listened to the films**. The automated branch run at code commit `a4366a55ad2f231d645fcd018f61d04dd9b18c4e` has **84/84 Playwright tests PASS**, with browser smoke and analytics consent PASS. An automated audio-track probe is not a narration or synchronization certification.

## Film links and preservation
Open the canonical branch's `film-presentations.html` locally in the approved test preview, and check the currently published site independently without pushing draft content to production. Each original HeyGen embed URL must remain unchanged.

| Film | Original public embed | Audience/technical qualifier | Human listen + caption sync |
|---|---|---|---|
| 01 — Engineered to Endure | https://app.heygen.com/embeds/4a280414b961425d12074fc7e20830cc | Vision/concept presentation; not tested engineering performance | NOT TESTED |
| 02 — Six Trailers. One Continuum. | https://app.heygen.com/embeds/8feca7a3ab6dab53e7c475de4444b169 | **Historical original title; six utility-core trailers, not eight-trailer complete Texas package** | NOT TESTED |
| 03 — Pure Water. Protected by Design. | https://app.heygen.com/embeds/6256a17244fcf1f7ea5eb84b335dec47 | W3 ultrapure is not automatically certified potable | NOT TESTED |
| 04 — Built to Move. Designed to Last. | https://app.heygen.com/embeds/73c9cdab30dc4e55f92fb2bc5b716711 | Conceptual modular deployment, no unsupported field-certification claim | NOT TESTED |

## Repeatable acceptance sequence (complete on desktop AND phone)
1. Begin via homepage, use Skip Intro, confirm the Four Films page. Repeat via the normal opening intro and its automatic/Skip navigation. Check **visible keyboard focus** on Skip Intro, Escape, Shift+Tab and Tab; no hidden page elements should be reachable while introduction modal is active.
2. For each film, use actual Play, speaker/unmute and captions controls. Record player URL, device/browser, observation date and reviewer.
3. Listen to the **opening, middle and ending** of every full presentation, checking continuous intelligible narration, audio level, silence and clipping. Measure duration from the actual source, not recalled estimates. Use headphones and device speakers if relevant.
4. Compare audible narration and any captions to the original approved storyboard/text in sequence. Record each mismatch at exact elapsed time. Do not invent narration to match an illustration.
5. Verify seeking, pausing, captions if supported by the provider, keyboard focus, and return to the full site. Test portrait 390px and a desktop viewport. If provider captions are absent, document as a concrete accessibility gap instead of certifying the film.
6. Preserve and retain original video IDs and approved assets. Only publish a proposed replacement if reviewer identifies a specific defect and management approves a source-backed correction.

## Accessible browser review (human or assistive-technology operator)
- Run a screen reader on Windows (NVDA) or macOS (VoiceOver) through the home → Contact → Meetings journey. Verify landmarks, skip links, form field announcements, accessible names and warnings. No live visitor form submission is authorized by this checklist.
- Inspect keyboard-only Tab/Shift+Tab/Escape for all entry and supporting pages; the intro modal should keep focus inside until exit.
- Check visible focus ring and meaningful non-text contrast, plus contrast of body labels and text over images at desktop/mobile, including error messages and consent banner.
- Verify zoom to 200% and 400% where practical, forced/large-text settings, no layout overlap or content loss.
- Confirm film iframes read **distinct descriptive titles**; original film URLs stay untouched.
- Record findings against WCAG success criterion where possible, severity, screenshot and responsible owner. Do not call the automated subset a complete WCAG audit.

## Controlled document audience gate
- Jack's personal Drive account owns the linked Texas IPO, India IPO and Volume 39 index. **12/12 internal recipient checks passed** after Jack authorized restricted Viewer grants to Adam, Mirael, Jack corporate and BrotherChat.
- Existing Golden Library source links are intentionally access-controlled. A publicly visible hyperlink does **not** imply public download rights.
- Before outside investor access: management must approve the exact recipient, package/version and security classification; owner grants only the approved file-level Viewer access. Verify from that recipient's account. Do not blanket-share the 46-volume Library, manufacturing trade secrets or original CAD.
- Source-version and link-currency review is distinct from permission review.

## Management and release signoff (separate website gate)
- [ ] Jack approves Texas eight-trailer terminology (six-core + BFS + data-center trailer), current versus historical visuals and modeling qualifications.
- [ ] Reviewer signs off all four films' audible narration, storyboard/caption synchronization and desktop/mobile playback with evidence.
- [ ] Reviewer signs off keyboard/screen-reader/color contrast and records any known exceptions.
- [ ] Jack authorizes specific external reviewer document access (or expressly accepts that these gateways remain restricted).
- [ ] PR #51 exact new head has successful browser, site and analytics CI after any further edits.
- [ ] Jack authorizes website editorial release and a distinct post-release public website + rollback verification.

**The booking release is independent.** Mirael's PR #43 remains isolated, customer direct-booking disabled, and automatic customer booking requires separate Access/MFA, Worker-owned OAuth, Turnstile Siteverify, live Calendar/Meet/D1/notification/dedup/cancellation acceptance and management authorization.

**No film files, restricted file permissions, booking systems, prospect records, DNS, or production deployment are changed by this checklist.**
