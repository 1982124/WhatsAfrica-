(function(){'use strict';
const THEMES={
  'afro-digital':{label:'Afro Digital',emoji:'🌍',bg:'#071b14',panel:'#0d2a20',card:'#12392b',line:'#245842',text:'#f8f3e8',muted:'#a8c2b5',accent:'#e8aa39',hero:'radial-gradient(circle at 85% 0,#28734f,#071b14 52%)',radius:'22px',shadow:'0 18px 50px #0007'},
  premium:{label:'Premium',emoji:'✨',bg:'#0b0b0d',panel:'#171719',card:'#202023',line:'#3b3b40',text:'#faf7f0',muted:'#b8b3aa',accent:'#d6a94a',hero:'radial-gradient(circle at 85% 0,#463719,#0b0b0d 52%)',radius:'20px',shadow:'0 18px 55px #0009'},
  market:{label:'Marketplace',emoji:'🛍️',bg:'#07131d',panel:'#0d2030',card:'#112a3d',line:'#214761',text:'#f4f8fb',muted:'#a9bfce',accent:'#20b486',hero:'radial-gradient(circle at 85% 0,#16516a,#07131d 52%)',radius:'16px',shadow:'0 14px 40px #0007'},
  minimal:{label:'Minimal',emoji:'◻️',bg:'#f5f3ee',panel:'#ffffff',card:'#ffffff',line:'#dedbd3',text:'#172018',muted:'#687066',accent:'#177245',hero:'linear-gradient(135deg,#f5f3ee,#e9efe9)',radius:'14px',shadow:'0 10px 30px #00000014'},
  business:{label:'Business',emoji:'💼',bg:'#101722',panel:'#182333',card:'#1c2a3c',line:'#33475f',text:'#f5f7fa',muted:'#aeb9c6',accent:'#4da3ff',hero:'linear-gradient(135deg,#172a43,#101722)',radius:'12px',shadow:'0 14px 38px #0008'},
  boutique:{label:'Boutique',emoji:'👜',bg:'#1b0d18',panel:'#291326',card:'#34172e',line:'#5a2d4d',text:'#fff5fb',muted:'#d0afc2',accent:'#e08ab5',hero:'radial-gradient(circle at 85% 0,#683b59,#1b0d18 55%)',radius:'24px',shadow:'0 18px 50px #0009'}
};
function cleanColor(v,fallback){return /^#[0-9a-f]{6}$/i.test(String(v||''))?String(v):fallback}
function apply(template,accent){const t=THEMES[template]||THEMES.business,a=cleanColor(accent,t.accent),r=document.documentElement.style;Object.entries({ '--wa-bg':t.bg,'--wa-panel':t.panel,'--wa-card':t.card,'--wa-line':t.line,'--wa-text':t.text,'--wa-muted':t.muted,'--wa-accent':a,'--wa-hero':t.hero,'--wa-radius':t.radius,'--wa-shadow':t.shadow}).forEach(([k,v])=>r.setProperty(k,v));document.body?.setAttribute('data-wa-template',template||'business');return t}
window.WA_THEMES=THEMES;window.applyWhatsAfricaTheme=apply;window.sanitizeWhatsAfricaAccent=(v,f)=>cleanColor(v,f||'#E8A83C');
})();