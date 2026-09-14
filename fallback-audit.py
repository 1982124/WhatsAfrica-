#!/usr/bin/env python3
import pathlib,re,sys,json
ROOT=pathlib.Path('.')
ACTIVE={
 'vercel.json','auth-v7.html','inbox-v25.html','calls-v2.html','wa-calls-v2.js','wa-voice.js','wa-media-p2p.js',
 'wa-message-invite.js','e2ee.js','share.html','share-center.html','group-manager.html','invite.html','admin-cockpit.html',
 'offer-create-v4.html','market-shell.html','business-vitrine-v2.html','smartlink-free-v2.html','brand-normalizer.js','wa-inbox-call-bridge.js'
}
VOLUNTARY={'inbox-v25.html','inbox-runtime.html','message-invite.html','seller-contact-v1.html','smartlink-call-bridge.js','smartlink-public-v2.html','smartlink-public-v3.html','smartlink-public-v4.html','smart-commerce.html','launch-shell.html','brand-normalizer.js'}

hits=[];scanned=0;redirects=0
for name in sorted(ACTIVE):
    p=ROOT/name
    if not p.exists():
        hits.append((p,1,'','missing active asset'))
        continue
    scanned+=1
    try:s=p.read_text(encoding='utf-8')
    except UnicodeDecodeError:continue
    redirects+=len(re.findall(r'(?:location\.(?:href|replace|assign)|window\.location\s*=|redirectTo\s*:)',s,re.I))
    for i,line in enumerate(s.splitlines(),1):
        m=re.search(r"(?:location\.(?:href|replace|assign)|window\.location\s*=|redirectTo\s*:)\s*['\"](/inbox(?:[?#][^'\"]*)?)['\"]",line,re.I)
        if m and p.name not in VOLUNTARY:
            target=m.group(1)
            if not ('auth?next=' in line or 'conversation' in target or 'business=' in target):
                hits.append((p,i,line.strip(),'direct Inbox fallback'))
        if p.name=='auth-v7.html' and 'auth-callback' in line:
            hits.append((p,i,line.strip(),'auth-v7 must not use fake callback'))
        if re.search(r'\bstorageKey\s*:',line,re.I):
            hits.append((p,i,line.strip(),'custom Supabase auth storage key breaks single shared session'))

v=ROOT/'vercel.json'
if v.exists():
    data=json.loads(v.read_text(encoding='utf-8'))
    for r in data.get('redirects',[]):
        hits.append((v,1,str(r),'Vercel redirects are forbidden: routes must never silently fall back'))

a=ROOT/'auth-v7.html'
if a.exists():
    s=a.read_text(encoding='utf-8')
    required=[
      r"q\s*=\s*new URLSearchParams\(location\.search\)",r"q\.get\('next'\)",r"document\.referrer",
      r"u\.origin\s*===\s*location\.origin",r"u\.pathname\s*\+\s*u\.search\s*\+\s*u\.hash",
      r"db=supabase\.createClient\(URL,KEY,",r"persistSession\s*:\s*true",r"redirectTo\s*:\s*location\.origin\s*\+\s*next"
    ]
    for x in required:
        if not re.search(x,s):hits.append((a,1,x,'missing single-session/auth destination invariant'))

print('=== WASSAFRICA GLOBAL AUTH / FALLBACK AUDIT ===')
print(f'Active files scanned: {scanned}')
print(f'Redirect operations analyzed: {redirects}')
print(f'Dangerous findings: {len(hits)}')
for p,i,line,kind in hits: print(f'{p}:{i}: [{kind}] {line}')
if hits:sys.exit(1)
print('PASS: active WASSAFRICA surface uses one shared Supabase session, has no automatic Inbox fallback, no Vercel redirects, and no fake auth callback.')
