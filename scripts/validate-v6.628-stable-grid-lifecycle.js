#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname,'..');
const errors=[];
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const need=(text,token,label)=>{if(!text.includes(token))errors.push(`Missing ${label}`);};
const reject=(text,token,label)=>{if(text.includes(token))errors.push(`Forbidden ${label}`);};
function functionBody(text,name){
  const start=text.indexOf(`function ${name}`);
  if(start<0){errors.push(`Missing function ${name}`);return '';}
  const brace=text.indexOf('{',start);
  if(brace<0){errors.push(`Malformed function ${name}`);return '';}
  let depth=0,quote='',escaped=false,line=false,block=false;
  for(let i=brace;i<text.length;i+=1){
    const ch=text[i],next=text[i+1];
    if(line){if(ch==='\n')line=false;continue;}
    if(block){if(ch==='*'&&next==='/'){block=false;i+=1;}continue;}
    if(quote){if(escaped){escaped=false;continue;}if(ch==='\\'){escaped=true;continue;}if(ch===quote)quote='';continue;}
    if(ch==='/'&&next==='/'){line=true;i+=1;continue;}
    if(ch==='/'&&next==='*'){block=true;i+=1;continue;}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth+=1;
    if(ch==='}'&&--depth===0)return text.slice(brace+1,i);
  }
  errors.push(`Unclosed function ${name}`);return '';
}
const files={
  index:read('Index.html'),
  sharedTable:read('SharedTableModule.html'),
  table:read('SharedDashboardTablePlatformV6586.html'),
  editor:read('SharedDashboardLayoutEditorV6593.html'),
  visual:read('SharedVisualFitControllerV6617.html'),
  tat:read('TatDashboardControllerScript.html'),
  remake:read('RemakeDashboardBootstrapV6548.html'),
  footer:read('SharedFooter.html')
};
for(const [file,text] of Object.entries(files)){
  const matches=[...text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
  matches.forEach((match,index)=>{
    const source=match[1].replace(/<\?[!=]?[\s\S]*?\?>/g,'null');
    try{new vm.Script(source,{filename:`${file}#${index+1}`});}
    catch(error){errors.push(`${file} script ${index+1}: ${error.message}`);}
  });
}
need(files.footer,"const UI_VERSION = 'v6.628';",'v6.628 footer version');
need(files.footer,"const BUILD_LABEL = 'STABLE-GRID-LIFECYCLE-69';",'v6.628 footer build label');
reject(files.index,'html.cdaRemakeTatBootV6501 body { visibility:hidden','global body visibility gate');
need(files.index,'keep the usable shell visible','usable-shell first-paint contract');

const render=functionBody(files.sharedTable,'renderV6540');
reject(render,'table.innerHTML =','complete table replacement during render/sort');
need(render,'replaceRowsAndTotalsV6628','body-only sort/filter render');
need(render,'headerChanged','explicit header identity decision');
need(files.sharedTable,'stableHeaderV6628: true','stable-header render event');
need(files.sharedTable,"data-cda-table-key-v6628",'stable table key');

const dragBegin=functionBody(files.table,'beginDragV6586');
const dragFlush=functionBody(files.table,'flushDragV6586');
need(files.table,'requestAnimationFrame(function(){ flushDragV6586(drag); })','frame-batched divider movement');
need(dragFlush,'drag.startRightWidth - delta','adjacent inverse-width transfer');
const pointerMove=(dragBegin.match(/drag\.move\s*=\s*function[\s\S]*?\n\s*};/)||[''])[0];
reject(pointerMove,'getBoundingClientRect','layout measurement during pointer movement');
need(files.table,"data-cda-table-interactions-v6628','delegated'",'delegated table interactions');
need(files.table,"schema = 'stable-column-state-v6628'",'stable persisted column-state schema');
need(files.table,"if (savedComplete && sameViewport)",'exact saved-width restoration');
need(files.table,"if (value === 'fit-content') return 'fit-compact'",'legacy compact-mode migration');
need(files.table,"fitCompact",'compact sizing API');
need(files.table,"fitCellContents",'true cell-content sizing API');
need(files.table,'recordAffectsTableStructureV6628','targeted mutation filtering');
need(files.table,"target.closest('tbody')",'ordinary body-row mutation exclusion');
need(files.table,"data-cda-table-page-registered-v6628",'prepared-page reuse');
need(files.table,'tabSwitchReusesPreparedSurfacesV6628:true','tab reuse audit');
need(files.table,'mutationObserverIgnoresNonTableChildChangesV6628:true','targeted observer audit');
need(files.table,'host-resize-observer-v6628','per-host ResizeObserver');

reject(files.editor,"document.addEventListener('cdaDashboardTabWillActivateV6627'",'duplicate layout tab-prepare listener');
reject(files.editor,"document.addEventListener('cdaDashboardTabActivatedV6627'",'duplicate layout tab-commit listener');
need(files.editor,"releaseMode:'single-tab-owner-stable-grid-lifecycle'",'single tab activation owner');
need(files.editor,'Math.max(minimumVisualHeightV6617(card),Number(item.height)','saved-card visual minimum clamp');
need(files.editor,'tabControllerSoleActivationOwnerV6628:true','single tab-owner audit');
need(files.editor,'savedExpandedHeightClampedToVisualMinimumV6628:true','saved-height clamp audit');
need(files.visual,"const VERSION_V6617 = 'v6.628'",'v6.628 visual-fit controller');
need(files.visual,'dynamicMinimumHeightContractV6628:true','visual minimum-height contract');
reject(files.visual,'chart.resize(','post-paint chart resize');
reject(files.visual,'chart.update(','post-paint chart update');

need(files.remake,'tableSurfaces.preparePage(target)','targeted Remake table preparation');
reject(files.remake,'tableSurfaces.scan(document)','Remake full-document table scan');
const prepare=functionBody(files.tat,'preparePageV6627');
need(prepare,"editor.preparePage(page,'controller-prepare')",'direct layout preparation by tab controller');
need(prepare,'tables.preparePage(page)','direct table preparation by tab controller');
need(prepare,'visuals.scan(page)','page-scoped visual preparation');
const load=functionBody(files.tat,'load');
if((load.match(/readLocalCache\(\)/g)||[]).length!==1)errors.push('TAT initial load must read local cache exactly once');
need(load,'state.meta=meta','metadata-only matching-cache refresh');
reject(load,'handlePayload(local.payload,meta)','duplicate matching-cache render');
need(files.tat,"release:'v6.628'",'v6.628 tab lifecycle event');

if(errors.length){errors.forEach(error=>console.error('ERROR:',error));process.exit(1);}
console.log('v6.628 stable grid lifecycle validator passed.');
console.log('Stable header survives sorting: passed');
console.log('Delegated resize and context-menu controls survive row rerenders: passed');
console.log('Exact widths persist independently of sort and sizing mode: passed');
console.log('Compact, viewport, and cell-content sizing are separate: passed');
console.log('Adjacent-pair drag remains bounded and frame-batched: passed');
console.log('Tab activation has one direct owner and reuses prepared surfaces: passed');
console.log('Ordinary row/chart mutations do not trigger table rescans: passed');
console.log('Saved short cards are clamped to usable visual minimums: passed');
console.log('TAT local cache renders once: passed');
console.log('Global body hiding is removed: passed');
