import imaplib
import email
import json
from bs4 import BeautifulSoup
from email.header import decode_header

def decode_mime_header(header_str):
    if not header_str: return ""
    decoded_fragments = decode_header(header_str)
    result = []
    for fragment, encoding in decoded_fragments:
        if isinstance(fragment, bytes):
            result.append(fragment.decode(encoding or 'utf-8', errors='replace'))
        else:
            result.append(str(fragment))
    return "".join(result)

cfg = json.load(open('banksalad_config.json', encoding='utf-8'))
m = imaplib.IMAP4_SSL('imap.gmail.com')
m.login(cfg['gmail_user'], cfg['gmail_app_password'])
m.select('INBOX')
status, data = m.search(None, 'ALL')
msg_ids = data[0].split()

for mid in reversed(msg_ids[-10:]):
    status, msg_data = m.fetch(mid, '(RFC822)')
    if not msg_data: continue
    msg = email.message_from_bytes(msg_data[0][1])
    subj = decode_mime_header(msg.get('Subject', ''))
    if '뱅크샐러드' in subj:
        for part in msg.walk():
            if part.get_content_type() == 'text/html':
                html = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                soup = BeautifulSoup(html, 'html.parser')
                print(soup.get_text())
                break
        break
m.logout()
