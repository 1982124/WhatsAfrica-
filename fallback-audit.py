#!/usr/bin/env python3
import pathlib,re,sys,json
ROOT=pathlib.Path('.')
ACTIVE={
 'vercel.json','auth-v8.html','inbox-redteam-shell-v1.html','inbox-production-media.html',
 'wa-messaging-key-recovery-v1.js','wa-messaging-finalizer-v1.js','smartlink-public-v7.html',
 'smartlink-free-v3.html','presentation.html','brand-normalizer.js','brand-observer.js',
 'share.html','share-center.html','groups-v5.html','community-v7.html','group-admin-v1.html',
 'admin-cockpit-v2.html','offer-create-free-v3.html','market-shell.html','business-vitrine-v3.html'
}
VOLUNTARY={'launch-shell.html','brand-normalizer.js','brand-observer.js','message-invite.html'}
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
            if not ('auth?next=' in line or 'conversation' in target or 'business=' in target or 'recipient=' in target):
                hits.append((p,i,line.strip(),'direct Inbox fallback'))
        if p.name=='auth-v8.html' and 'auth-callback' in line:
            hits.append((p,i,line.strip(),'auth-v8 must not use fake callback'))
        if re.search(r'\bstorageKey\s*:',line,re.I):
            hits.append((p,i,line.strip(),'custom Supabase auth storage key breaks single shared session'))

v=ROOT/'vercel.json'
if v.exists():
    data=json.loads(v.read_text(encoding='utf-8'))
    for r in data.get('redirects',[]):
        hits.append((v,1,str(r),'Vercel redirects are forbidden: routes must never silently fall back'))

a=ROOT/'auth-v8.html'
if a.exists():
    s=a.read_text(encoding='utf-8')
    required=[
      r"new URLSearchParams\(location\.search\)",r"q\.get\('next'\)",
      r"u\.origin\s*===\s*location\.origin",r"u\.pathname\s*\+\s*u\.search\s*\+\s*u\.hash",
      r"db=supabase\.createClient\(URL,KEY,",r"persistSession\s*:\s*true",r"redirectTo:location\.origin\+'/auth\?next='"
    ]
    for x in required:
        if not re.search(x,s):hits.append((a,1,x,'missing shared-session/auth destination invariant'))

print('=== WASSAFRICA GLOBAL AUTH / FALLBACK AUDIT ===')
print(f'Active files scanned: {scanned}')
print(f'Redirect operations analyzed: {redirects}')
print(f'Dangerous findings: {len(hits)}')
for p,i,line,kind in hits: print(f'{p}:{i}: [{kind}] {line}')
if hits:sys.exit(1)
print('PASS: canonical WASSAFRICA surface uses one shared Supabase session, has no automatic Inbox fallback, no Vercel redirects, and no fake auth callback.')
