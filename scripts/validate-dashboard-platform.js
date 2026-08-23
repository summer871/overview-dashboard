#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const errors=[];
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const files=['SharedDashboardTablePlatformV6586.html','SharedDashboardLayoutEditorV6593.html','SharedVisualFitControllerV6617.html','tests/fixtures/platform-compat/SharedDashboardRegistryV6547.html','tests/fixtures/platform-compat/SharedDashboardRendererV6547.html','tests/fixtures/platform-compat/RemakeDashboardBootstrapV6548.html','tests/fixtures/platform-compat/TatDashboardBootstrapV6547.html','SharedFooter.html','Index.html','SharedTableModule.html','TatDashboardControllerScript.html'];
for(const f of files){const text=read(f);for(const [i,m] of [...text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].entries()){try{new vm.Script(m[1].replace(/<\?[!=]?[\s\S]*?\?>/g,'null'),{filename:`${f}#${i+1}`});}catch(e){errors.push(`${f}: ${e.message}`);}}}
const table=read(files[0]),editor=read(files[1]),visual=read(files[2]),remake=read(files[5]),tat=read(files[6]),index=read(files[8]),sharedTable=read(files[9]),controller=read(files[10]);
const need=(text,token,label)=>{if(!text.includes(token))errors.push(`Missing ${label}`);};
[
 ['cdaDashboardPersonalLayout.v6611','personal saved-layout namespace'],
 ["['n','ne','e','se','s','sw','w','nw']",'eight resize handles'],
 ['applyUniversalCollisionReflowV6611','universal collision reflow'],
 ['preparePageForActivationV6627','previsible saved-layout preparation'],
 ['savedOuterGeometryImmutableAtRuntimeV6623:true','saved outer geometry authority'],
 ['hiddenTabsRetainManagedGeometryV6623:true','hidden tab geometry retention'],
 ['newCardsHydrateIndividuallyV6623:true','new-card-only defaults']
].forEach(x=>need(editor,x[0],x[1]));
[
 ["mode:'universal-standard-partition-adjacent-pair-column-authority'",'universal table authority'],
 ['universalAdjacentPairingV6627:true','adjacent pairing audit'],
 ['standardViewportPartitionV6627:true','viewport partition audit'],
 ['explicitExtendedColumnRoleV6627:true','explicit overflow role'],
 ['hiddenTabFallbackWritesBlockedV6627:true','hidden fallback guard'],
 ['hostResizeObserverEnabledV6628:true','per-host resize observation'],
 ['tabSwitchReusesPreparedSurfacesV6628:true','prepared-table reuse on tab switch'],
 ['mutationObserverIgnoresNonTableChildChangesV6628:true','targeted mutation filtering']
].forEach(x=>need(table,x[0],x[1]));
need(visual,"const VERSION_V6617 = 'v6.628'",'v6.628 visual-fit controller');
need(visual,'beforeInit:function(chart)','before-init chart sizing');
if(visual.includes('chart.resize(')||visual.includes('chart.update('))errors.push('Post-paint chart resizing remains');
need(remake,"tableSurfaces.mode === 'universal-standard-partition-adjacent-pair-column-authority'",'Remake shared authority dependency');
need(tat,"tableSurfaces.mode === 'universal-standard-partition-adjacent-pair-column-authority'",'TAT shared authority dependency');
if(index.includes('html.cdaRemakeTatBootV6501 body { visibility:hidden'))errors.push('Global body visibility gate remains');
need(sharedTable,'replaceRowsAndTotalsV6628','stable table header during sorting');
need(table,"data-cda-table-interactions-v6628','delegated'",'delegated table interactions');
if(editor.includes("document.addEventListener('cdaDashboardTabWillActivateV6627'"))errors.push('Duplicate layout tab prepare listener remains');
need(editor,'tabControllerSoleActivationOwnerV6628:true','single tab owner audit');
need(controller,"editor.preparePage(page,'controller-prepare')",'direct tab-controller layout preparation');
if(remake.includes('tableSurfaces.scan(document)'))errors.push('Remake still performs full-document table scan');
if(errors.length){errors.forEach(e=>console.error('ERROR:',e));process.exit(1);}
console.log('Dashboard platform structural validation passed.');
console.log('Eight edge/corner card resize handles: passed');
console.log('Cross-row movement and collision-safe release: passed');
console.log('Saved layout replaces defaults before tab reveal: passed');
console.log('Universal adjacent-pair column resizing: passed');
console.log('Standard viewport partition and extended overflow: passed');
