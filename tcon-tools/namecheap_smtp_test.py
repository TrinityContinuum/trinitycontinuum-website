#!/usr/bin/env python3
"""One-message Namecheap SMTP connectivity test. Uses only Python standard library.

Run locally on an authorized computer. Never commit or paste your password.
No emails are sent until the operator confirms recipient and message.
"""
import getpass
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import make_msgid

SENDER = "adam@trinitycontinuum.com"
HOST = "mail.privateemail.com"
PORT = 465


def main():
    recipient = input("Authorized test recipient email: ").strip()
    if not recipient or "@" not in recipient or "\n" in recipient or "\r" in recipient:
        raise SystemExit("Invalid recipient.")
    print(f"From: {SENDER}\nTo: {recipient}\nSubject: TCON Namecheap connection test")
    if input("Send exactly one test message? Type SEND: ").strip() != "SEND":
        raise SystemExit("Cancelled. No email sent.")
    password = getpass.getpass("Namecheap application password (hidden, not saved): ")
    if not password:
        raise SystemExit("No password entered.")
    message = EmailMessage()
    message["From"] = SENDER
    message["To"] = recipient
    message["Reply-To"] = SENDER
    message["Subject"] = "TCON Namecheap connection test"
    message["Message-ID"] = make_msgid(domain="trinitycontinuum.com")
    message.set_content(
        "This is a one-time, manually approved connection test from "
        "adam@trinitycontinuum.com. Please reply to confirm delivery.\n"
    )
    try:
        with smtplib.SMTP_SSL(HOST, PORT, context=ssl.create_default_context(), timeout=20) as smtp:
            smtp.login(SENDER, password)
            smtp.send_message(message)
        print("SMTP accepted the test message. Check delivery and reply separately.")
    except (smtplib.SMTPException, OSError) as exc:
        raise SystemExit(f"SMTP failed ({type(exc).__name__}). Check credentials and provider settings.") from None


if __name__ == "__main__":
    main()
