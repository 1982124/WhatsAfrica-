/* WASSAFRICA — responsive received media v1
 * Mobile-first: received photos/videos/audio use the available chat width;
 * on phones visual media may occupy the full viewport width without overflow.
 */
(()=>{
'use strict';
if(window.__WA_RESPONSIVE_MEDIA_V1__)return;
window.__WA_RESPONSIVE_MEDIA_V1__=true;
const STYLE_ID='wa-responsive-media-v1';
function install(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
    #msgs{overflow-x:hidden}
    #msgs .bubble:has(.media),#msgs .bubble:has(img),#msgs .bubble:has(video),#msgs .bubble:has(audio),#msgs .bubble[data-media-id]{
      max-width:min(92%,900px);
    }
    #msgs .media,#msgs img.media,#msgs video.media,#msgs audio.media,
    #msgs .bubble[data-media-id] img,#msgs .bubble[data-media-id] video,#msgs .bubble[data-media-id] audio{
      display:block;box-sizing:border-box;width:100%;max-width:100%;height:auto;object-fit:contain;
    }
    #msgs video.media,#msgs .bubble[data-media-id] video{max-height:none;background:#000}
    #msgs audio.media,#msgs .bubble[data-media-id] audio{min-height:44px}
    @media(max-width:820px){
      #msgs{padding-left:0;padding-right:0}
      #msgs .bubble:has(.media),#msgs .bubble:has(img),#msgs .bubble:has(video),#msgs .bubble:has(audio),#msgs .bubble[data-media-id]{
        width:100%;max-width:100%;border-radius:0;padding:8px 8px;
      }
      #msgs .bubble:has(.media) .meta,#msgs .bubble:has(img) .meta,#msgs .bubble:has(video) .meta,#msgs .bubble:has(audio) .meta,#msgs .bubble[data-media-id] .meta{padding-right:4px}
      #msgs .media,#msgs .bubble[data-media-id] img,#msgs .bubble[data-media-id] video{width:100vw;max-width:100vw;margin-left:-8px;border-radius:0}
    }
    @media(min-width:821px){
      #msgs .media,#msgs .bubble[data-media-id] img,#msgs .bubble[data-media-id] video{max-width:900px}
    }
  `;
  document.head.appendChild(s);
}
function apply(){
  install();
  document.querySelectorAll('#msgs .media,#msgs .bubble[data-media-id] img,#msgs .bubble[data-media-id] video,#msgs .bubble[data-media-id] audio').forEach(el=>{
    el.style.maxWidth='100%';
    if(el.tagName==='IMG'||el.tagName==='VIDEO')el.style.height='auto';
  });
}
function boot(){apply();const box=document.getElementById('msgs');if(box&&!box.dataset.responsiveMediaObserver){box.dataset.responsiveMediaObserver='1';new MutationObserver(apply).observe(box,{childList:true,subtree:true});}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
setTimeout(boot,500);setTimeout(boot,1500);
})();
