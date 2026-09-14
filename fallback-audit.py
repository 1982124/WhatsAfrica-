#!/usr/bin/env python3
import pathlib,re,sys

ROOT=pathlib.Path('.')
IGNORE={'.git','.vercel','node_modules','android'}
TEXT_EXT={'.html','.js','.mjs','.cjs','.json','.yml','.yaml','.md'}
LEGACY_REDIRECTS={'/whatsafrica','/whatsafrica/','/public-message.html','/public-message','/inbox.html','/inbox-v2.html'}

def files():
    for p in ROOT.rglob('*'):
        if p.is_file() and p.suffix.lower() in TEXT_EXT and not any(x in IGNORE for x in p.parts):
            yield p

hits=[]
for p in files():
    try:s=p.read_text(encoding='utf-8')
    except UnicodeDecodeError:continue
    for i,line in enumerate(s.splitlines(),1):
        if re.search(r"(?:location\.(?:href|replace|assign)|window\.location\s*=|redirectTo\s*:)\s*[^;\n]*['\"]/?inbox(?:['\"/?])",line,re.I):
            if p.name not in {'auth-v7.html','inbox-v25.html','crm.html','calls-v2.html'}:
                hits.append((p,i,line.strip(),'direct inbox redirect'))
        if 'auth-callback' in line and 'auth-v7.html' in p.name:
            hits.append((p,i,line.strip(),'auth-v7 must not use fake callback'))

# Vercel redirects to Inbox are allowed only for explicit legacy/message aliases.
v=ROOT/'vercel.json'
if v.exists():
    import json
    data=json.loads(v.read_text(encoding='utf-8'))
    for r in data.get('redirects',[]):
        if r.get('destination')=='/inbox' and r.get('source') not in LEGACY_REDIRECTS:
            hits.append((v,1,str(r),'unapproved Vercel redirect to Inbox'))

# Canonical auth invariants: requested destinations must survive OAuth.
a=ROOT/'auth-v7.html'
if a.exists():
    s=a.read_text(encoding='utf-8')
    required=[
        'const q=new URLSearchParams(location.search)',
        "q.get('next')||'/inbox'",
        'u.origin===location.origin',
        'u.pathname+u.search+u.hash',
        'redirectTo:location.origin+next',
    ]
    for x in required:
        if x not in s:hits.append((a,1,x,'missing auth destination invariant'))

print('=== WASSAFRICA GLOBAL FALLBACK AUDIT ===')
print(f'Files scanned: {sum(1 for _ in files())}')
print(f'Dangerous findings: {len(hits)}')
for p,i,line,kind in hits:
    print(f'{p}:{i}: [{kind}] {line}')
if hits:
    sys.exit(1)
print('PASS: no unapproved direct Inbox fallback, fake auth callback, or broken auth destination invariant detected.')
