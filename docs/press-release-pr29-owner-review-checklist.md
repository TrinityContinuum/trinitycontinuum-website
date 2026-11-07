# PR #29 Press Releases | Owner-review workstream
**2026-11-06 | INTERNAL REVIEW | Separate from factory PR #28 | DO NOT MERGE OR PUBLISH**

Source: Jack Coates, email subject **ACTION REQUIRED — Trinity Press Releases Website PR #29 | Review, Reconcile & Publish After Approval**, November 6, 2026, 8:21 PM. Draft: https://github.com/TrinityContinuum/trinitycontinuum-website/pull/29

## Inspection of PR #29 changes
GitHub PR file list shows:
- `press-releases.html` added: press center, company announcement, qualified six-trailer planning figures, existing six-trailer conceptual illustration, media contact.
- `assets/trinity-gold-texas-press-logo.svg` added: new green/gold Texas emblem, original in-repo SVG, proposed for owner review.
- `index.html` modified: Press Releases navigation route added.
- The requested **approved Niagara-scale ten-platform / 60-trailer illustration is not in the PR file list**. The page explicitly calls the existing six-trailer image temporary and not a verified 60-trailer deployment.

## Action checklist and evidence status
| Check | Current status | Evidence/next action |
| --- | --- | --- |
| Confirm PR #29 is a separate, unpublished draft | LOCATED, NOT RELEASED | GitHub PR #29; no merge authorization |
| Reconcile press copy against Gold Master and engineering caveats | OPEN | Validate planning figures, water quality, generation, commercialization, and historical claims against controlling source pages |
| Find approved ten-platform / 60-trailer artwork | NOT YET VERIFIED | Search existing approved asset/media library and source links before classifying missing |
| Produce Trinity-only branding; remove Niagara/third-party marks unless licensed | OPEN | Requires inspection of original artwork and approved permitted transformation; current PR does not include it |
| Review green-and-gold Texas emblem | OWNER REVIEW | New `assets/trinity-gold-texas-press-logo.svg`; no final brand approval |
| Mobile navigation and accessibility | TEST REQUIRED | Check narrow viewport, keyboard/skip link, current-page nav, accessible alt text, heading order |
| Link and media-sharing checks | TEST REQUIRED | Check `press-releases.html` internal links, social preview, canonical/OG metadata, share preview image |
| Public/private boundary | OPEN | Do not expose Gold drawings, internal economics, CAD or restricted Drive links |
| Jack approves final wording and imagery | HOLD | Written management authorization required |
| Publish PR #29 | HOLD | Separate approval; independent of PR #28 factory release |

## Technical observations from PR diff
- New press page declares Open Graph title, description, type and URL but **no `og:image`** in the added head; media-sharing preview should be tested and likely enhanced with an approved public asset.
- The featured illustration is `assets/six-trailer-concept.svg?v=3` and clearly captioned as temporary. **Do not present it as Niagara-scale or 60-trailer imagery.**
- Draft text uses planning-only qualifiers for 30M GPY at 8,000 hours and 1-MW-class / below-1-MW best-case; verify with source and avoid treating as certified.
- The draft labels itself owner-review and contains no authorization to release.

## Separate release decisions
- PR #28: manufacturing facility controlled source gateways, engineering and confidentiality release gates.
- PR #29: public press language, approved artwork, mobile/accessibility, media-sharing and owner approval.
- Neither PR is authorized to merge or publish merely because automated browser tests pass.

**Next meaningful task:** identify and inspect the original ten-platform artwork from existing controlled media/source library, reconcile public claims to source, and return a PR #29-specific correction and publication-readiness report to Jack. No automatic publication.
