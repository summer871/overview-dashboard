'use strict';

const fs = require('fs');

const topPath = 'SharedTopParityStyles.html';
const footerPath = 'SharedFooter.html';

let top = fs.readFileSync(topPath, 'utf8');
let footer = fs.readFileSync(footerPath, 'utf8');

const startMarker = '<script id="cdaRemakeCascadingFiltersControllerV6631">';
const startIndex = top.indexOf(startMarker);
if (startIndex < 0) throw new Error('Cascading filter owner start marker was not found.');
const endIndex = top.indexOf('</script>', startIndex);
if (endIndex < 0) throw new Error('Cascading filter owner closing script marker was not found.');
if (top.indexOf(startMarker, startIndex + 1) >= 0) throw new Error('Multiple cascading filter owner blocks were found.');

const controller = String.raw`<script id="cdaRemakeCascadingFiltersControllerV6635">
(function installCdaRemakeCascadingFiltersV6635(){
  'use strict';
  if(window.__cdaRemakeCascadingFiltersV6635)return;

  const VERSION='v6.635';
  const KINDS=['year','department','product','productGroup','customer','reason'];

  function ready(){
    return typeof populateFiltersV6230==='function'&&
      typeof rowsForFiltersV6230==='function'&&
      typeof fillSelectV6230==='function'&&
      typeof filterValuesV6245==='function'&&
      typeof excludedFilterValuesV6389==='function'&&
      typeof renderDashboardV6230==='function'&&
      typeof normalizedRowsV6230==='function';
  }

  function install(){
    if(window.__cdaRemakeCascadingFiltersV6635||!ready())return false;
    window.__cdaRemakeCascadingFiltersV6635=true;
    window.CDA_REMAKE_CASCADING_FILTERS_VERSION=VERSION;

    const originalRenderDropdownButtonV6635=renderDropdownButtonV6245;
    const originalRenderDashboardV6635=renderDashboardV6230;
    let lastRowsV6635=null;
    let lastSignatureV6635='';
    let rebuildingV6635=false;
    let rebuildCountV6635=0;

    function hardFilterSignatureV6635(){
      return KINDS.map(function(kind){
        return kind+':'+JSON.stringify(filterValuesV6245(kind))+'!'+JSON.stringify(excludedFilterValuesV6389(kind));
      }).join('|');
    }

    function rowsForFacetV6635(rows,kind){
      const hardKey='hard'+kind.charAt(0).toUpperCase()+kind.slice(1);
      const options={months:false,crossFilters:false};
      options[hardKey]=false;
      return rowsForFiltersV6230(rows,options);
    }

    function optionsForFacetV6635(rows,kind){
      const scoped=rowsForFacetV6635(rows,kind);
      if(kind==='year'){
        return normalizeOptionsV6245(Array.from(new Set(scoped.map(function(row){return row.year;}).filter(Boolean)))
          .sort(function(left,right){return Number(right)-Number(left);})
          .map(function(year){return{value:String(year),label:String(year)};}));
      }
      if(kind==='department'){
        return normalizeOptionsV6245(Array.from(new Set(scoped.map(function(row){return row.department;}).filter(Boolean)))
          .map(function(value){return{value:value,label:value};}));
      }
      if(kind==='product'){
        return normalizeOptionsV6245(groupV6230(scoped,function(row){return row.productKey;},function(row){return row.productName;})
          .map(function(row){return{value:row.key,label:row.label};}));
      }
      if(kind==='productGroup'){
        return normalizeOptionsV6245(groupV6230(scoped,function(row){return row.productGroup||'Unassigned';},function(row){return row.productGroup||'Unassigned';})
          .map(function(row){return{value:row.key,label:row.label};}));
      }
      if(kind==='customer'){
        return normalizeOptionsV6245(groupV6230(scoped,function(row){return row.customerKey;},function(row){return customerLabelV6246(row);},function(group,row){
          group.customerId=row.customerId||row.customerKey;
          group.customerName=row.customerName||row.customerKey;
          group.practiceName=row.practiceName||'';
          group.customerDisplayLabel=customerLabelV6246(row);
          if(row.customerActive===false)group.active=false;
        }).map(function(row){return{value:row.key,label:row.label,active:row.active!==false};}));
      }
      return normalizeOptionsV6245(Array.from(new Set(scoped.filter(isRemakeV6230).map(function(row){return row.remakeReason||'Not specified';})))
        .map(function(value){return{value:value,label:value};}));
    }

    function buildInventoryV6635(rows){
      const inventory={};
      KINDS.forEach(function(kind){inventory[kind]=optionsForFacetV6635(rows,kind);});
      return inventory;
    }

    function reconcileKindV6635(kind,options){
      const available=new Set((options||[]).map(function(option){return String(option.value);}));
      const selected=filterValuesV6245(kind).map(String);
      const noneSelected=selected.length===1&&selected[0]===REMAKE_NONE_FILTER_VALUE_V6308;
      let changed=false;

      if(!noneSelected&&selected.length){
        const nextSelected=selected.filter(function(value){return available.has(value);});
        if(nextSelected.length!==selected.length){
          setFilterValuesV6245(kind,nextSelected);
          changed=true;
        }
      }

      if(!filterValuesV6245(kind).length){
        const excluded=excludedFilterValuesV6389(kind).map(String);
        if(excluded.length){
          const nextExcluded=excluded.filter(function(value){return available.has(value);});
          if(nextExcluded.length!==excluded.length){
            setFilterExclusionsV6389(kind,nextExcluded);
            changed=true;
          }
        }
      }
      return changed;
    }

    function applyInventoryV6635(inventory){
      fillSelectV6230('remakeYearFilter','All years',inventory.year,uiV6230.filters.year);
      fillSelectV6230('remakeDepartmentFilter','All departments',inventory.department,uiV6230.filters.department);
      fillSelectV6230('remakeProductFilter','All products',inventory.product,uiV6230.filters.product);
      uiV6230.filterOptionsV6245.productGroup=inventory.productGroup.slice();
      renderDropdownButtonV6245('productGroup');
      fillSelectV6230('remakeCustomerFilter','All customers',inventory.customer,uiV6230.filters.customer);
      fillSelectV6230('remakeReasonFilter','All reasons',inventory.reason,uiV6230.filters.reason);
    }

    function renderDropdownButtonV6635(kind){
      originalRenderDropdownButtonV6635(kind);
      const meta=filterMetaV6245[kind];
      if(!meta)return;
      const count=idV6230(meta.countId);
      if(!count)return;
      const available=allOptionValuesForDropdownV6245(kind);
      const availableSet=new Set(available);
      const selected=Array.from(effectiveSelectionSetV6250(kind)).filter(function(value){return availableSet.has(String(value));});
      const excluded=excludedFilterValuesV6389(kind).filter(function(value){return availableSet.has(String(value));});
      const none=filterIsNoneV6308(kind);
      if(none)count.textContent='None selected · '+available.length+' available';
      else if(excluded.length)count.textContent=selected.length+' selected · '+excluded.length+' excluded · '+available.length+' available';
      else if(filterValuesV6245(kind).length)count.textContent=selected.length+' selected · '+available.length+' available';
      else count.textContent='All selected · '+available.length+' available';
      count.title=count.textContent;
    }

    function populateFiltersV6635(rows,force){
      const sourceRows=Array.isArray(rows)?rows:[];
      const incomingSignature=hardFilterSignatureV6635();
      if(!force&&lastRowsV6635===sourceRows&&lastSignatureV6635===incomingSignature&&uiV6230.filterOptionsV6245){
        syncFilterControlsV6230();
        return false;
      }
      if(rebuildingV6635)return false;

      rebuildingV6635=true;
      try{
        let inventory=null;
        let changed=false;
        for(let pass=0;pass<4;pass+=1){
          inventory=buildInventoryV6635(sourceRows);
          changed=false;
          KINDS.forEach(function(kind){if(reconcileKindV6635(kind,inventory[kind]))changed=true;});
          if(!changed)break;
        }
        inventory=buildInventoryV6635(sourceRows);
        applyInventoryV6635(inventory);
        uiV6230.filterOptionRowsV6300=sourceRows;
        uiV6230.filterFacetSignatureV6631=hardFilterSignatureV6635();
        lastRowsV6635=sourceRows;
        lastSignatureV6635=hardFilterSignatureV6635();
        rebuildCountV6635+=1;
        syncFilterControlsV6230();
        writeLocalJsonV6230(FILTERS_KEY_V6230,uiV6230.filters);
        writeLocalJsonV6230(FILTER_EXCLUSIONS_KEY_V6389,uiV6230.filterExclusionsV6389);
        return true;
      }finally{
        rebuildingV6635=false;
      }
    }

    function refreshBeforeRenderV6635(){
      if(rebuildingV6635)return false;
      let rows=[];
      try{rows=normalizedRowsV6230();}catch(error){return false;}
      return populateFiltersV6635(rows,false);
    }

    function renderDashboardV6635(){
      refreshBeforeRenderV6635();
      return originalRenderDashboardV6635.apply(this,arguments);
    }
    renderDashboardV6635.__cdaCascadingInventoryV6635=true;
    renderDashboardV6635.__cdaPreviousV6635=originalRenderDashboardV6635;

    renderDropdownButtonV6245=renderDropdownButtonV6635;
    populateFiltersV6230=populateFiltersV6635;
    renderDashboardV6230=renderDashboardV6635;
    try{window.renderDropdownButtonV6245=renderDropdownButtonV6635;}catch(error){}
    try{window.populateFiltersV6230=populateFiltersV6635;}catch(error){}
    try{window.renderDashboardV6230=renderDashboardV6635;}catch(error){}

    function polishHeaderV6635(root){
      (root||document).querySelectorAll('.remakeDropdownHeaderV6245').forEach(function(header){
        const allButton=header.querySelector('button[onclick*="clearRemakeMultiFilterV6245"]');
        const noneButton=header.querySelector('button[onclick*="selectNoneRemakeOptionsV6308"]');
        const visibleLabel=header.querySelector('.remakeVisibleToggleV6502 span');
        if(allButton){allButton.textContent='All';allButton.title='Select every available option in the current focus';}
        if(noneButton)noneButton.title='Select no options';
        if(visibleLabel)visibleLabel.textContent='Visible';
      });
    }

    polishHeaderV6635(document);
    if(window.MutationObserver){
      const observer=new MutationObserver(function(mutations){
        mutations.forEach(function(mutation){
          Array.from(mutation.addedNodes||[]).forEach(function(node){
            if(node&&node.nodeType===1)polishHeaderV6635(node);
          });
        });
      });
      const host=document.querySelector('#remakeFactorPage,#remakeTabFilterHostV6337');
      if(host)observer.observe(host,{childList:true,subtree:true});
      window.__cdaRemakeCascadingFilterObserverV6635=observer;
    }

    window.cdaRemakeCascadingFiltersV6635=Object.freeze({
      version:VERSION,
      refresh:function(){return populateFiltersV6635(normalizedRowsV6230(),true);},
      audit:function(){
        const rows=normalizedRowsV6230();
        const expected=buildInventoryV6635(rows);
        const actual=uiV6230.filterOptionsV6245||{};
        const counts={};
        let ok=true;
        KINDS.forEach(function(kind){
          const expectedCount=(expected[kind]||[]).length;
          const actualCount=(actual[kind]||[]).length;
          counts[kind]={expected:expectedCount,actual:actualCount,synced:expectedCount===actualCount};
          if(expectedCount!==actualCount)ok=false;
        });
        return{
          version:VERSION,
          hardSignature:hardFilterSignatureV6635(),
          rebuildCount:rebuildCountV6635,
          counts:counts,
          softFiltersIgnored:true,
          renderWrapped:!!(renderDashboardV6230&&renderDashboardV6230.__cdaCascadingInventoryV6635),
          ok:ok
        };
      }
    });

    try{populateFiltersV6635(normalizedRowsV6230(),true);}catch(error){}
    return true;
  }

  if(!install()){
    const timer=window.setInterval(function(){if(install())window.clearInterval(timer);},250);
    window.setTimeout(function(){window.clearInterval(timer);},12000);
  }
})();
</script>`;

top = top.slice(0, startIndex) + controller + top.slice(endIndex + '</script>'.length);
top = top.replace('Version: v6.634', 'Version: v6.635');

if (!footer.includes("const UI_VERSION = 'v6.634';")) throw new Error('Shared footer is not at the expected v6.634 baseline.');
if (!footer.includes("const BUILD_LABEL = 'REMAKE-HARD-FOCUS-73';")) throw new Error('Shared footer build marker is not at the expected baseline.');
footer = footer.replace(/v6\.634/g, 'v6.635');
footer = footer.replace('REMAKE-HARD-FOCUS-73', 'REMAKE-CASCADING-SYNC-74');

if (!top.includes('renderDashboardV6635.__cdaCascadingInventoryV6635=true')) throw new Error('Render lifecycle hook is missing.');
if (!top.includes('crossFilters:false')) throw new Error('Soft filters are not excluded from option inventories.');
if (!top.includes('reconcileKindV6635')) throw new Error('Scoped selection reconciliation is missing.');
if (!top.includes("All selected · '+available.length+' available")) throw new Error('Scoped All count label is missing.');
if (!footer.includes("const UI_VERSION = 'v6.635';")) throw new Error('Footer UI version was not updated.');
if (!footer.includes("const BUILD_LABEL = 'REMAKE-CASCADING-SYNC-74';")) throw new Error('Footer build label was not updated.');

fs.writeFileSync(topPath, top, 'utf8');
fs.writeFileSync(footerPath, footer, 'utf8');

console.log(JSON.stringify({
  ok:true,
  version:'v6.635',
  build:'REMAKE-CASCADING-SYNC-74',
  files:[topPath,footerPath]
},null,2));
