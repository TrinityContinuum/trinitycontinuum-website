# Trinity Appointment Approval — Working Reply Helper

**Current release:** manual, browser-based reply-composition helper. It is NOT an authenticated approval dashboard and does NOT automatically send, book, or generate a Google Meet invitation.

## How Jack uses it
1. Open the helper page at `https://trinitycontinuum.com/tools/appointment-approval.html` or download the HTML and open it locally. For private request information, prefer the locally downloaded copy; the public website hosts the page but does not collect or store form inputs from this helper.
2. Open an incoming Web3Forms appointment email in Namecheap Private Email.
3. Transfer the visitor's name, email, two proposed dates/times, and time zone to the helper.
4. Choose **Accept first**, **Accept second**, **Propose another**, or **Decline**.
5. Review the generated response. If a private Google Meet invitation already exists, optionally paste its link.
6. Click **Copy Reply for Namecheap**, use Namecheap **Compose** to send the prepared response to the *visitor's* address. Alternatively, use **Open Email to Visitor** if a default mail application is configured.
7. Jack must press **Send**. The helper does not log or confirm delivery.

## Security boundary
The HTML page contains no access tokens, does not write localStorage, has no API calls, and does not persist visitor details. The GitHub Pages version is not password-protected, so **this is NOT a private authenticated dashboard**. Do not use shared/public computers for confidential appointment information.

## Next gates for a true one-click private approval system
- Create a secure record bridge between currently live Web3Forms submissions and a private queue (free-tier Web3Forms webhooks/autoresponse are unavailable, so a new intake path or supported API is needed).
- Deploy an identity-protected staff dashboard (e.g. Cloudflare Access) with server-side authorization and audit trail.
- Connect a verified outgoing email provider for corporate sender identity (Cloudflare Email Sending paid on this account; do not change Namecheap MX records).
- Integrate Google Calendar/Meet and verify authorization and calendar conflict checking.
- Test visitor submission -> queued request -> Jack approval -> email delivered -> calendar invitation accepted before representing the system as automated.

Existing public Web3Forms intake remains unchanged and continues to work. Existing Trinity email gateway remains untouched.

## REV 02: Paste-to-autofill (November 14, 2026)
- Jack no longer has to retype each field: copy the Web3Forms notification body from Namecheap, paste it into the helper, then click **Fill Request Automatically**.
- The parser reads **Name, Email, Date1, Time1, Date2, Time2, Timezone** from the verified Web3Forms notification layout.
- Tested against the prior Trinity test-notification format; parsed Adam's two November 16/17 dates, times, visitor email, and Central time zone correctly. JavaScript syntax compilation passed.
- Review the imported details before any reply; the helper still does not identify Jack, query Namecheap, send email, or book a calendar event.
- Year/date checks and the 11:30 AM–1:00 PM Central lunch restriction remain in place.
- If the email is formatted differently, the parser reports missing fields and keeps the original manual entry fallback.
- Web3Forms' **free** tier does not provide active webhooks or Submissions API integration. True server-side automatic sync will require a different supported intake flow or a paid feature; do not claim it is active.
- Do not paste confidential data into an untrusted site's lookalike. Use the known official Trinity website URL or download the helper locally.
