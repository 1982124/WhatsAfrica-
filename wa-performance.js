/* WhatsAfrica — lightweight performance hooks. */
(function(){
'use strict';
const marks={};
function mark(name){if(!performance?.mark)return;marks[name]=performance.now();try{performance.mark('wa:'+name)}catch(e){}}
function measure(name,start){const d=marks[start]!=null?performance.now()-marks[start]:null;if(d!=null&&d>2000)console.warn('[WhatsAfrica performance]',name,Math.round(d)+'ms');return d}
function observe(){if(!window.PerformanceObserver)return;try{new PerformanceObserver(list=>{for(const e of list.getEntries()){if(e.entryType==='largest-contentful-paint')window.WA_PERF?.onMetric('LCP',e.startTime);if(e.entryType==='layout-shift'&&!e.hadRecentInput)window.WA_PERF?.onMetric('CLS',e.value)}}).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(list=>{for(const e of list.getEntries())if(e.entryType==='layout-shift'&&!e.hadRecentInput)window.WA_PERF?.onMetric('CLS',e.value)}).observe({type:'layout-shift',buffered:true})}catch(e){}}
window.WA_PERF={mark,measure,observe,onMetric:(name,value)=>{if(value>0)console.debug('[WhatsAfrica]',name,value)}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe,{once:true});else observe();
})();
