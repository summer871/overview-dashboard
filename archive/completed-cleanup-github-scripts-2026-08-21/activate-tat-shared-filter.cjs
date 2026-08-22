'use strict';

const fs = require('fs');
const crypto = require('crypto');

const indexPath = 'Index.html';
const controllerPath = 'TatDashboardControllerScript.html';
const adapterPath = 'TatSharedFilterAdapterV6646.html';
const reportPath = 'docs/TAT-SHARED-FILTER-ACTIVATION-v6.646.json';
const expectedIndexSha256 = 'c73e8cc04afbbe75e499c8a7ae3e87ce7149bf8a38c245b71a9d63144d296fa7';
const adapterInclude = "<?!= includeDashboardFile('TatSharedFilterAdapterV6646') ?>";
const bridgeMarker = '  function csvEscape(value)';
const bridgeName = 'window.cdaTatFilterBridgeV6646';

function fail(message){ throw new Error(message); }
function sha256(value){ return crypto.createHash('sha256').update(value,'utf8').digest('hex'); }
function count(value,needle){ return value.split(needle).length-1; }

const originalIndex = fs.readFileSync(indexPath,'utf8');
const originalController = fs.readFileSync(controllerPath,'utf8');
if (sha256(originalIndex) !== expectedIndexSha256) fail(`Unexpected ${indexPath} baseline. Refusing TAT activation.`);
if (!fs.existsSync(adapterPath)) fail(`Missing ${adapterPath}.`);
if (originalIndex.includes(adapterInclude)) fail('TAT shared filter adapter is already included.');
if (originalController.includes(bridgeName)) fail('TAT filter bridge is already installed.');
if (count(originalController,bridgeMarker) !== 1) fail('Expected exactly one TAT bridge insertion marker.');

const bridge = `
  // v6.646: expose the existing TAT filter state through a narrow adapter
  // contract so SharedFilterBar can own presentation without creating a
  // second filter data model.
  let tatSharedFilterRenderQueuedV6646=false;
  function scheduleTatSharedFilterRenderV6646(){
    if(tatSharedFilterRenderQueuedV6646)return;
    tatSharedFilterRenderQueuedV6646=true;
    queueMicrotask(function(){tatSharedFilterRenderQueuedV6646=false;renderAll();});
  }
  function tatSharedPopulationKeysV6646(targetType){
    const keys=new Set();
    (state.rows||[]).forEach(function(row){
      const year=Number(row.year);if(year!==2025&&year!==2026)return;
      const matchesOthers=FILTER_TYPES.every(function(type){return type===targetType||isSelected(type,filterKey(type,row));});
      if(!matchesOthers)return;
      const key=filterKey(targetType,row);if(key)keys.add(String(key));
    });
    return keys;
  }
  window.cdaTatFilterBridgeV6646=Object.freeze({
    version:'v6.646',
    types:FILTER_TYPES.slice(),
    labels:Object.assign({},LABELS),
    allLabels:Object.assign({},ALL_LABELS),
    getOptions:function(type){return optionList(type).map(function(option){return {key:String(option.key),label:String(option.label)};});},
    getMode:function(type){return mode(type);},
    getSelected:function(type){return new Set(Array.from(selectedSet(type)).map(String));},
    getSearch:function(type){return state.searches[type]||'';},
    setSearch:function(type,value){state.searches[type]=String(value||'');},
    applySelection:function(type,nextSet,nextMode){
      if(FILTER_TYPES.indexOf(type)<0)return;
      const set=selectedSet(type);set.clear();
      if(nextMode==='ALL')setMode(type,'ALL');
      else{
        Array.from(nextSet||[]).map(String).forEach(function(value){set.add(value);});
        setMode(type,'CUSTOM');normalizeMode(type);
      }
      scheduleTatSharedFilterRenderV6646();
    },
    getPopulationKeys:function(type){return tatSharedPopulationKeysV6646(type);}
  });

`;

const nextController = originalController.replace(bridgeMarker, bridge + bridgeMarker);
if (count(nextController,bridgeName) !== 1) fail('TAT filter bridge insertion failed.');

const marker = "includeDashboardFile('TatDashboardControllerScript')";
if (count(originalIndex,marker) !== 1) fail('Expected exactly one TatDashboardControllerScript include.');
const markerIndex = originalIndex.indexOf(marker);
const tagStart = originalIndex.lastIndexOf('<?',markerIndex);
const tagEnd = originalIndex.indexOf('?>',markerIndex);
if (tagStart < 0 || tagEnd < 0) fail('Could not isolate TAT controller template include.');
const insertion = tagEnd + 2;
const nextIndex = originalIndex.slice(0,insertion) + '\n' + adapterInclude + originalIndex.slice(insertion);
if (count(nextIndex,adapterInclude) !== 1) fail('TAT adapter include insertion failed.');
if (nextIndex.indexOf(adapterInclude) <= nextIndex.indexOf(marker)) fail('TAT adapter must load after TAT controller.');

fs.writeFileSync(controllerPath,nextController,'utf8');
fs.writeFileSync(indexPath,nextIndex,'utf8');
const report={
  generatedAt:new Date().toISOString(),
  version:'v6.646',
  indexSha256Before:expectedIndexSha256,
  indexSha256After:sha256(nextIndex),
  controllerSha256Before:sha256(originalController),
  controllerSha256After:sha256(nextController),
  adapter:adapterPath,
  adapterSha256:sha256(fs.readFileSync(adapterPath,'utf8')),
  bridgeInstalled:true,
  adapterLoadsAfterController:true,
  legacyFilterDeleted:false,
  compactLegacyControlsRetained:true,
  desktopLegacyFilterHiddenOnlyAfterSharedMount:true,
  behaviorIntent:'Preserve TAT filter state and rendering while moving desktop dropdown/header presentation and interaction ownership to SharedFilterBar.',
  productionDeployment:false
};
fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify(report,null,2));
