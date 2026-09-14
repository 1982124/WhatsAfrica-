(()=>{'use strict';
/* WASSAFRICA Smart Link Brand Engine v1
   Deterministic design intelligence: métier + couleur souhaitée -> palette, contraste,
   surface, accent et typographic direction. No DB/schema changes. */
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const hex=v=>/^#[0-9a-f]{6}$/i.test(String(v||''))?String(v):null;
const rgb=h=>{h=h.slice(1);return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]};
const hx=n=>Math.round(clamp(n,0,255)).toString(16).padStart(2,'0');
const toHex=(r,g,b)=>'#'+hx(r)+hx(g)+hx(b);
const lum=h=>{const [r,g,b]=rgb(h).map(x=>x/255).map(x=>x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4));return .2126*r+.7152*g+.0722*b};
const contrast=(a,b)=>{const A=lum(a),B=lum(b);return(Math.max(A,B)+.05)/(Math.min(A,B)+.05)};
const mix=(a,b,p)=>{const A=rgb(a),B=rgb(b);return toHex(A[0]*(1-p)+B[0]*p,A[1]*(1-p)+B[1]*p,A[2]*(1-p)+B[2]*p)};
const darken=(h,p)=>mix(h,'#000000',p),lighten=(h,p)=>mix(h,'#ffffff',p);
const normalize=x=>String(x||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const families=[
 {keys:['mode','couture','fashion','vetement','bijou','joailler','luxe'],name:'Mode & luxe',bg:'#f7f2eb',surface:'#fffdfa',ink:'#211c19',accent:'#8b3f4b',font:'editorial'},
 {keys:['restaurant','traiteur','cuisine','food','cafe','hotel','hebergement','hospitalite'],name:'Hospitalité & gastronomie',bg:'#f5eee6',surface:'#fffaf5',ink:'#241b17',accent:'#b45f36',font:'editorial'},
 {keys:['immobilier','architecture','construction','batiment','cabinet'],name:'Immobilier & construction',bg:'#f3f0ea',surface:'#ffffff',ink:'#172231',accent:'#49657c',font:'corporate'},
 {keys:['finance','banque','assurance','comptabilite','investissement','microfinance'],name:'Finance',bg:'#f3f5f7',surface:'#ffffff',ink:'#142033',accent:'#244f73',font:'corporate'},
 {keys:['beaute','coiffure','esthetique','spa','cosmetique','wellness'],name:'Beauté & bien-être',bg:'#f7f1ef',surface:'#fffdfb',ink:'#281d21',accent:'#a56b78',font:'soft'},
 {keys:['tech','technologie','informatique','logiciel','digital','startup','ia','internet'],name:'Tech & digital',bg:'#f2f4f8',surface:'#ffffff',ink:'#131b2a',accent:'#4d5bd5',font:'tech'},
 {keys:['agriculture','agri','ferme','elevage','maraichage','agro'],name:'Agriculture',bg:'#f4f1e7',surface:'#fffdf8',ink:'#253026',accent:'#657b42',font:'human'},
 {keys:['artisan','artisanat','menuiserie','poterie','textile','cuir','atelier'],name:'Artisanat & atelier',bg:'#f5eee5',surface:'#fffaf3',ink:'#2b211a',accent:'#9a6037',font:'human'},
 {keys:['coach','formation','conseil','consultant','education','ecole'],name:'Conseil & formation',bg:'#f1f5f5',surface:'#ffffff',ink:'#182629',accent:'#397b78',font:'human'}
];
function family(input){const s=normalize([input?.category,input?.business_type,input?.activity,input?.name,input?.description].filter(Boolean).join(' '));return families.find(f=>f.keys.some(k=>s.includes(k)))||{name:'Activité',bg:'#f7f6f2',surface:'#ffffff',ink:'#1d211e',accent:'#8a6a32',font:'human'};}
function validAccent(preferred,base){const p=hex(preferred)||base;const onWhite=contrast(p,'#ffffff');const onInk=contrast(p,'#171717');if(onWhite>=3.2)return p;if(onInk>=3.2)return p;return contrast(darken(p,.22),'#ffffff')>=3.2?darken(p,.22):lighten(p,.22)}
function build(input={}){const f=family(input),a=validAccent(input.accent_color,f.accent),dark=lum(a)<.45;const ink=dark?lighten(a,.78):darken(a,.72);const soft=dark?mix(a,'#ffffff',.84):mix(a,'#ffffff',.88);const line=mix(f.ink,'#ffffff',.84);const heroInk=contrast(f.ink,'#ffffff')>=4.5?'#ffffff':'#171717';return {family:f.name,accent:a,accentSoft:soft,bg:f.bg,surface:f.surface,ink:f.ink,muted:mix(f.ink,'#ffffff',.48),line,heroInk,hero:dark?`linear-gradient(135deg,${darken(a,.34)},#171717 72%)`:`linear-gradient(135deg,${darken(a,.08)},${darken(f.ink,.05)} 72%)`,font:f.font,contrastOnWhite:contrast(a,'#ffffff'),contrastOnInk:contrast(a,'#171717')};}
function apply(input){const p=build(input),r=document.documentElement.style;const vars={'--ink':p.ink,'--muted':p.muted,'--paper':p.bg,'--card':p.surface,'--line':p.line,'--accent':p.accent,'--accent-soft':p.accentSoft,'--dark':darken(p.ink,.03),'--brand-hero':p.hero};Object.entries(vars).forEach(([k,v])=>r.setProperty(k,v));document.documentElement.dataset.waBrandFamily=p.family;document.documentElement.dataset.waBrandFont=p.font;return p;}
window.WASSAFRICA_BRAND_ENGINE={build,apply,contrast};
})();