#!/usr/bin/env python3
"""Read-only Namecheap IMAP check for a reply to the TCON test message.

Python standard library only. Runs on the mailbox owner's computer.
No passwords saved, no messages modified, and no network service subscription.
"""
import getpass
import imaplib
import ssl
from email import policy
from email.parser import BytesParser
from email.header import decode_header, make_header

MAILBOX = "adam@trinitycontinuum.com"
HOST = "mail.privateemail.com"
PORT = 993
SUBJECT = "TCON Namecheap connection test"


def decode(value):
    try:
        return str(make_header(decode_header(value or "")))
    except (ValueError, UnicodeError):
        return ""


def main():
    print(f"Read-only reply check for {MAILBOX}")
    expected = input("Expected reply sender (email address): ").strip().lower()
    if not expected or "@" not in expected or any(c in expected for c in "\r\n"):
        raise SystemExit("Enter the email address of the person who replied.")
    password = getpass.getpass("Namecheap mailbox password (hidden, not saved): ")
    if not password:
        raise SystemExit("No password entered.")
    try:
        with imaplib.IMAP4_SSL(HOST, PORT, ssl_context=ssl.create_default_context(), timeout=20) as mail:
            mail.login(MAILBOX, password)
            status, _ = mail.select("INBOX", readonly=True)
            if status != "OK":
                raise RuntimeError("Cannot open inbox")
            status, data = mail.uid("SEARCH", None, "ALL")
            if status != "OK":
                raise RuntimeError("Cannot search inbox")
            ids = data[0].split()[-100:]
            found = False
            for uid in reversed(ids):
                status, parts = mail.uid("FETCH", uid, "(BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE IN-REPLY-TO)])")
                if status != "OK":
                    continue
                raw = next((p[1] for p in parts if isinstance(p, tuple) and isinstance(p[1], bytes)), None)
                if not raw:
                    continue
                msg = BytesParser(policy=policy.default).parsebytes(raw)
                sender = str(msg.get("From", "")).lower()
                subject = decode(msg.get("Subject"))
                if expected in sender and SUBJECT.lower() in subject.lower():
                    print("Matching reply located in the inbox.")
                    print("From:", decode(msg.get("From")))
                    print("Date:", decode(msg.get("Date")))
                    print("Subject:", subject)
                    found = True
                    break
            if not found:
                print("No matching reply found among the newest 100 inbox messages.")
                print("This does not prove a reply was never delivered.")
            mail.logout()
    except (imaplib.IMAP4.error, OSError, RuntimeError) as exc:
        raise SystemExit(f"IMAP check failed ({type(exc).__name__}). Verify mailbox access.") from None


if __name__ == "__main__":
    main()
