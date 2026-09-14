#!/usr/bin/env python3
import pathlib,re,sys,json

ROOT=pathlib.Path('.')
IGNORE={'.git','.vercel','node_modules','android'}
TEXT_EXT={'.html','.js','.mjs','.cjs','.json','.yml','.yaml','.md'}
VOLUNTARY={'inbox-v25.html','inbox-runtime.html','message-invite.html','seller-contact-v1.html','smartlink-call-bridge.js','smartlink-public-v2.html','smartlink-public-v3.html','smartlink-public-v4.html','smart-commerce.html','launch-shell.html'}
LEGACY_REDIRECTS={'/whatsafrica','/whatsafrica/','/public-message.html','/public-message','/inbox.html','/inbox-v2.html'}

def files():
    for p in ROOT.rglob('*'):
        if p.is_file() and p.suffix.lower() in TEXT_EXT and not any(x in IGNORE for x in p.parts):
            yield p

hits=[]
scanned=0
for p in files():
    scanned+=1
    try:s=p.read_text(encoding='utf-8')
    except UnicodeDecodeError:continue
    for i,line in enumerate(s.splitlines(),1):
        # Only classify executable redirects, not ordinary navigation links containing /inbox.
        m=re.search(r"(?:location\.(?:href|replace|assign)|window\.location\s*=|redirectTo\s*:)\s*['\"](/inbox(?:[?#][^'\"]*)?)['\"]",line,re.I)
        if m and p.name not in VOLUNTARY:
            target=m.group(1)
            if not ('auth?next=' in line or 'conversation' in target or 'business=' in target):
                hits.append((p,i,line.strip(),'direct Inbox redirect'))
        if p.name=='auth-v7.html' and 'auth-callback' in line:
            hits.append((p,i,line.strip(),'auth-v7 must not use fake callback'))

v=ROOT/'vercel.json'
if v.exists():
    data=json.loads(v.read_text(encoding='utf-8'))
    for r in data.get('redirects',[]):
        if r.get('destination')=='/inbox' and r.get('source') not in LEGACY_REDIRECTS:
            hits.append((v,1,str(r),'unapproved Vercel redirect to Inbox'))

a=ROOT/'auth-v7.html'
if a.exists():
    s=a.read_text(encoding='utf-8')
    required=[
        r"q=new URLSearchParams\(location\.search\)",
        "q.get('next')||'/inbox'",
        'u.origin===location.origin',
        'u.pathname+u.search+u.hash',
        'redirectTo:location.origin+next',
    ]
    for x in required:
        if not re.search(x,s):hits.append((a,1,x,'missing auth destination invariant'))

print('=== WASSAFRICA GLOBAL FALLBACK AUDIT ===')
print(f'Files scanned: {scanned}')
print(f'Dangerous findings: {len(hits)}')
for p,i,line,kind in hits:
    print(f'{p}:{i}: [{kind}] {line}')
if hits:sys.exit(1)
print('PASS: no unapproved Inbox fallback, fake auth callback, or broken auth destination invariant detected.')
