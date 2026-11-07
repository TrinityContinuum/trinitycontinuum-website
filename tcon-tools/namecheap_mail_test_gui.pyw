"""TCON one-message Namecheap SMTP test with a graphical window.

No command line, external Python packages, subscriptions, or saved credentials.
The operator must explicitly click Send Test. Runs locally on Windows with Tkinter.
"""
import smtplib
import ssl
import threading
import tkinter as tk
from email.message import EmailMessage
from tkinter import messagebox, ttk

SENDER = "adam@trinitycontinuum.com"


def main():
    root = tk.Tk()
    root.title("TCON | Trinity mailbox connection test")
    root.geometry("540x315")
    root.resizable(False, False)
    frame = ttk.Frame(root, padding=20)
    frame.pack(fill="both", expand=True)
    ttk.Label(frame, text="Trinity mailbox connection test", font=("Segoe UI", 15, "bold")).pack(anchor="w")
    ttk.Label(frame, text=f"From: {SENDER}").pack(anchor="w", pady=(8, 15))
    ttk.Label(frame, text="Test recipient (an email account you control)").pack(anchor="w")
    recipient = ttk.Entry(frame, width=65)
    recipient.pack(anchor="w", pady=(3, 10))
    ttk.Label(frame, text="Namecheap mailbox password (never stored)").pack(anchor="w")
    password = ttk.Entry(frame, width=65, show="*")
    password.pack(anchor="w", pady=(3, 12))
    status = tk.StringVar(value="No email has been sent.")
    ttk.Label(frame, textvariable=status, wraplength=490).pack(anchor="w", pady=(8, 8))

    def send():
        to = recipient.get().strip()
        secret = password.get()
        if (not to or "@" not in to or any(c in to for c in "\r\n,;<> ")
                or not secret):
            messagebox.showerror("Missing information", "Enter one valid recipient and your mailbox password.")
            return
        if not messagebox.askyesno("Confirm one test", f"Send one test email from {SENDER} to {to}?"):
            return
        button.config(state="disabled")
        status.set("Connecting to Namecheap SMTP securely...")
        def worker():
            try:
                msg = EmailMessage()
                msg["From"] = SENDER
                msg["To"] = to
                msg["Reply-To"] = SENDER
                msg["Subject"] = "TCON Namecheap connection test"
                msg.set_content("One-time approved test. Please reply to confirm delivery.\n")
                with smtplib.SMTP_SSL("mail.privateemail.com", 465,
                                      context=ssl.create_default_context(), timeout=20) as smtp:
                    smtp.login(SENDER, secret)
                    smtp.send_message(msg)
                root.after(0, lambda: status.set("SMTP accepted the test. Check recipient inbox and reply."))
                root.after(0, lambda: messagebox.showinfo("Test accepted", "SMTP accepted the test message. Delivery and reply are not yet verified."))
            except (smtplib.SMTPException, OSError) as exc:
                kind = type(exc).__name__
                root.after(0, lambda: status.set(f"Connection failed ({kind}). No automatic retry."))
                root.after(0, lambda: messagebox.showerror("Connection failed", f"{kind}. Check the mailbox credentials and settings."))
            finally:
                root.after(0, lambda: password.delete(0, tk.END))
                root.after(0, lambda: button.config(state="normal"))
        threading.Thread(target=worker, daemon=True).start()

    button = ttk.Button(frame, text="Send one test email", command=send)
    button.pack(anchor="w", pady=(4, 0))
    root.mainloop()


if __name__ == "__main__":
    main()
