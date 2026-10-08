#!/usr/bin/env python3
import pathlib,re,sys,json
ROOT=pathlib.Path('.')
ACTIVE={'vercel.json','auth.html','inbox.html','smartlink-public.html','smartlink-free-v3.html','presentation.html','brand-normalizer.js','brand-observer.js','share.html','share-center.html','groups.html','community-v7.html','group-admin-v1.html','cockpit.html','offer-create.html','marche.html','product.html','library.html','library-manage.html','dashboard.html'}
VOLUNTARY={'launch-shell.html','brand-normalizer.js','brand-observer.js','message-invite.html'}
hits=[];scanned=0;redirects=0
for name in sorted(ACTIVE):
    p=ROOT/name
    if not p.exists(): hits.append((p,1,'','missing active asset')); continue
    scanned+=1
    try:s=p.read_text(encoding='utf-8')
    except UnicodeDecodeError: continue
    redirects+=len(re.findall(r'(?:location\.(?:href|replace|assign)|window\.location\s*=|redirectTo\s*:)',s,re.I))
    for i,line in enumerate(s.splitlines(),1):
        m=re.search(r"(?:location\.(?:href|replace|assign)|window\.location\s*=|redirectTo\s*:)\s*['\"](/inbox(?:[?#][^'\"]*)?)['\"]",line,re.I)
        if m and p.name not in VOLUNTARY:
            target=m.group(1)
            if not ('auth?next=' in line or 'conversation' in target or 'business=' in target or 'recipient=' in target):
                hits.append((p,i,line.strip(),'direct Inbox fallback'))
        if re.search(r'\bstorageKey\s*:',line,re.I):
            mkey=re.search(r"""storageKey\s*:\s*['"]([^'"]+)['"]""",line,re.I)
            if mkey:
                if mkey.group(1) != 'whatsafrica-auth':
                    hits.append((p,i,line.strip(),'non-canonical Supabase auth storage key'))
            elif 'storageKey:AUTH' in line:
                pass
            else:
                hits.append((p,i,line.strip(),'unverified Supabase auth storage key'))
v=ROOT/'vercel.json'
if v.exists():
    data=json.loads(v.read_text(encoding='utf-8'))
    allowed_redirects={
        '/wassafrica':'/',
        '/smartlink/:slug':'/:slug',
        '/marche/boutique/:slug':'/:slug',
        '/market':'/marche',
        '/marketplace':'/marche',
        '/digital-market':'/marche',
        '/commerce':'/marche',
        '/product':'/marche',
            }
    for r in data.get('redirects',[]):
        src,dst=r.get('source'),r.get('destination')
        if allowed_redirects.get(src) != dst:
            hits.append((v,1,str(r),'unexpected Vercel redirect'))
    for src,dst in allowed_redirects.items():
        actual=next((x.get('destination') for x in data.get('redirects',[]) if x.get('source')==src),None)
        if actual != dst:
            hits.append((v,1,f'{src} -> {actual}','missing canonical redirect'))
    # /vitrine is a canonical rewrite to the current editor surface, not a redirect.
    expected_vitrine='/business-vitrine-v3.html'
    actual_vitrine=next((x.get('destination') for x in data.get('rewrites',[]) if x.get('source')=='/vitrine'),None)
    if actual_vitrine != expected_vitrine:
        hits.append((v,1,f'/vitrine -> {actual_vitrine}','missing canonical vitrine rewrite'))
print('=== WASSAFRICA GLOBAL AUTH / FALLBACK AUDIT ===')
print(f'Active files scanned: {scanned}')
print(f'Redirect operations analyzed: {redirects}')
print(f'Dangerous findings: {len(hits)}')
for p,i,line,kind in hits: print(f'{p}:{i}: [{kind}] {line}')
if hits: sys.exit(1)
print('PASS: canonical surface has no unexpected redirects or non-canonical Supabase auth storage keys.')
