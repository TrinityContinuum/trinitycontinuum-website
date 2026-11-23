# Trinity public media and link acceptance — visitor-first release gate
**Date:** November 23, 2026 | **PR:** #60 | **Status:** draft, pending exact-head CI and Jack approval

## Management rule
Everything deliberately shown as open public media must open from an ordinary logged-out visitor browser without requesting Drive, ChatGPT, or owner-account permissions. We are not trying to hide Trinity's story. A protected source is *not* a public deliverable until its content is reviewed and a safe public copy is deliberately released. Never cure an access problem by granting blanket view access to original CAD, patent, financial or corporate archive materials.

## Rejected approach
[PR #59](https://github.com/TrinityContinuum/trinitycontinuum-website/pull/59) is CLOSED/UNMERGED. It replaced all 99 website source links with inert labels and did not provide meaningful visitor-facing replacements. Management rejected that as overrestrictive. **Do not revive #59.**

## Draft #60 — actual content delivery
- **7 public SVG concept illustrations** in `public-visuals.html`, with full-size image anchors hosted by Trinity itself.
- **5 presentation visual-card links** now open their corresponding local illustration instead of requiring permission to see original private Drive images; the existing sixth Media Library link remains.
- All **4 original HeyGen film iframe URLs** preserved exactly; a media link/iframe assertion does NOT certify public playback, sound, caption synchronization or provider permissions.
- **984 searchable archive index entries** retained as searchable titles and metadata. Previously **947 private personal ChatGPT Library links + 37 Google Drive links** were distributed in the public `media-catalog.json`. Their 984 outbound source URLs and 9 extra video URLs are removed from published JSON; the private originals remain in their own accounts and have **not** been deleted. The index does not pretend an unapproved source is viewable, and public gallery/films are separately linked.
- **29 direct public-page media-source anchors** replaced with working public film/illustration destinations or a proper professional request route for controlled Volume 38.
- **65 direct protected investor/engineering/Golden Library/source anchors** replaced with functional source-review request routes and existing available public summaries. Site keeps descriptions of its professional materials; no Drive sharing permissions changed.
- Protected Golden Library workspace no longer presented as unrestricted public entry; accessible general `documents.html` stays available.
- Public illustrations page is in sitemap; full Playwright and WCAG tests now include explicit anonymous local asset retrieval and public-link policy checks.

## Manual visitor test — record date, device, and evidence
- [ ] Anonymous Chrome/Edge desktop opens `/public-visuals.html` and all 7 full-size illustrations. Check visible image, not merely HTTP 200.
- [ ] Anonymous Safari/iOS and Chrome/Android open all images at phone width without content clipping, keyboard issues or download permission errors.
- [ ] On `/film-presentations.html`, play each original film 01–04 in a fresh private/incognito browser. Confirm video image, seek, **audible** English narration, controls, captions/accuracy where offered, no HeyGen login prompt or video-unavailable overlay; report exact problem timestamps.
- [ ] Test Film → Full Site → Media → Public Illustrations → public Overview → Contact and return. No repeated modal trapping, broken fragment URLs or popup blockers.
- [ ] Open every intentionally public external research and provider link as a guest. Record HTTP failures vs permission failures vs anti-bot rejection. A CI iframe markup test cannot settle these cases.
- [ ] Check public media catalog search and page navigation; archived titles must not display links to personal `chatgpt.com/library` or private `drive.google.com`.
- [ ] Open the investor/engineering source-review form without authentication; test the contact-delivery path separately using an owner-authorized synthetic submission. Do not send real prospect data.
- [ ] Confirm protected Drive originals (including Texas/India IPO and Volume 39) remain Restricted. No `anyone` grant on raw source files.

## Public-release approval queue (not authorized by mere existence of a source link)
1. **Four original storyboard contact sheets** (film media review): owner/technical content review of each panel, sensitive layouts/IP, third-party material, names, and claims; then produce a distinct sanitized export or viewer-safe copy on approved public hosting. Do not release the full originals automatically.
2. **Manufacturing source visuals / native CAD**: supply a concept drawing or sanitized export with verified claims, not unrestricted fabrication drawings, physical security details or vendor confidential sheets.
3. **Investor and IPO packages**: public summary pages may be open; exact Gold diligence packages, legal/capitalization and financial models retain professional source-review permissions until a separately approved publication version exists.
4. **Film source archives and original media inventories**: maintain protected backup, and publish only expressly accepted film deliverables and artwork.
5. **All external links and original HeyGen embeds**: anonymous visitor verification and owner authorization before claiming complete public media acceptance.

## Promotion and distribution
Public indexable pages should emphasize real viewable content (films, concepts, open overview, contact). Avoid sending visitors to empty placeholders or using labels like “OPEN SOURCE” for private records. Do not claim full public access until a verified external visitor test demonstrates it. No mass mail, changed domain/DNS, video deletion, billing, booking or production deployment is authorized by this checklist.

## Signoff
- [ ] Automated release CI passed on the exact final PR head
- [ ] Mirael/Adam independent external visitor playback and broken-link check with date/browser evidence
- [ ] Jack approves which original media can become unrestricted public copies
- [ ] Jack approves deployment of reconciled exact PR head, with live readback and rollback
