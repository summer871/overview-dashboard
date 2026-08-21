'use strict';

const fs = require('fs');
const crypto = require('crypto');
const postcss = require('postcss');

const sourcePath = 'Index.html';
const reportPath = 'docs/INDEX-SUPERSEDED-CSS-CLEANUP-2026-08-21.json';
const expectedSha256 = '8973e2241075ea49318d33b1a57a94e6f462452dbe0798428f60f680b06d31fa';

const unsafeProperties = new Set([
  'all','animation','animation-name','background','border','border-block','border-inline','border-top','border-right','border-bottom','border-left',
  'font','flex','flex-flow','grid','grid-area','grid-column','grid-row','grid-template','inset','list-style','margin','padding','place-content','place-items',
  'place-self','transition','outline','columns','column-rule','mask','text-decoration'
]);

function fail(message){ throw new Error(message); }
function sha256(value){ return crypto.createHash('sha256').update(value,'utf8').digest('hex'); }
function lineAt(value,index){ return value.slice(0,index).split('\n').length; }

function contextKey(rule){
  const parts=[];
  let node=rule.parent;
  while(node && node.type!=='root'){
    if(node.type==='atrule') parts.unshift('@'+node.name+' '+String(node.params||'').trim());
    else return null;
    node=node.parent;
  }
  return parts.join(' > ');
}

function declarationMap(rule){
  const map=new Map();
  let safe=true;
  rule.nodes.forEach(node=>{
    if(node.type!=='decl'){ if(node.type!=='comment') safe=false; return; }
    const prop=String(node.prop||'').toLowerCase();
    if(!prop || prop.startsWith('--') || unsafeProperties.has(prop)) safe=false;
    if(map.has(prop)) safe=false;
    map.set(prop,{important:!!node.important,value:String(node.value||'')});
  });
  return safe && map.size ? map : null;
}

const original=fs.readFileSync(sourcePath,'utf8');
if(sha256(original)!==expectedSha256) fail(`Unexpected ${sourcePath} baseline. Refusing CSS cleanup.`);

const blocks=[];
const styleRe=/<style\b([^>]*)>([\s\S]*?)<\/style>/gi;
let match;
while((match=styleRe.exec(original))){
  const fullStart=match.index;
  const openLength=match[0].indexOf('>')+1;
  const contentStart=fullStart+openLength;
  const content=match[2];
  let root;
  try { root=postcss.parse(content,{from:undefined}); }
  catch(error){ continue; }
  blocks.push({fullStart,contentStart,content,root});
}
if(!blocks.length) fail('No parseable style blocks found.');

const ordered=[];
blocks.forEach((block,blockIndex)=>{
  block.root.walkRules(rule=>{
    const context=contextKey(rule);
    const decls=declarationMap(rule);
    if(context===null || !decls) return;
    const selector=String(rule.selector||'').trim();
    if(!selector || selector.includes(',')) return;
    if(/:has\(|:is\(|:where\(/.test(selector)) return;
    ordered.push({blockIndex,rule,selector,context,decls,sourceLine:lineAt(original,block.contentStart+(rule.source&&rule.source.start&&Number.isFinite(rule.source.start.offset)?rule.source.start.offset:0))});
  });
});

const groups=new Map();
ordered.forEach(item=>{
  const key=item.context+'\u0000'+item.selector;
  if(!groups.has(key)) groups.set(key,[]);
  groups.get(key).push(item);
});

const removals=[];
for(const items of groups.values()){
  if(items.length<2) continue;
  for(let i=0;i<items.length-1;i++){
    const earlier=items[i];
    let fullyCovered=false;
    for(let j=i+1;j<items.length;j++){
      const later=items[j];
      let covers=true;
      for(const [prop,meta] of earlier.decls){
        const next=later.decls.get(prop);
        if(!next){ covers=false; break; }
        if(meta.important && !next.important){ covers=false; break; }
      }
      if(covers){ fullyCovered=true; break; }
    }
    if(fullyCovered) removals.push(earlier);
  }
}

if(!removals.length) fail('No conservative fully-superseded CSS rules found.');
if(removals.length>250) fail(`Refusing unexpectedly broad CSS cleanup: ${removals.length} rules.`);

const byBlock=new Map();
removals.forEach(item=>{
  if(!byBlock.has(item.blockIndex)) byBlock.set(item.blockIndex,[]);
  byBlock.get(item.blockIndex).push(item);
});
byBlock.forEach(items=>items.forEach(item=>item.rule.remove()));

let next=original;
const replacements=[];
blocks.forEach((block,blockIndex)=>{
  if(!byBlock.has(blockIndex)) return;
  replacements.push({start:block.contentStart,end:block.contentStart+block.content.length,text:block.root.toString()});
});
replacements.sort((a,b)=>b.start-a.start).forEach(rep=>{ next=next.slice(0,rep.start)+rep.text+next.slice(rep.end); });
if(next===original) fail('CSS cleanup produced no source change.');

// Parse every resulting style block to ensure structural validity.
let parsedCount=0;
styleRe.lastIndex=0;
while((match=styleRe.exec(next))){
  try { postcss.parse(match[2],{from:undefined}); parsedCount+=1; }
  catch(error){ fail(`Resulting style block failed to parse near line ${lineAt(next,match.index)}: ${error.message}`); }
}
if(parsedCount!==blocks.length) fail(`Style block count changed unexpectedly: ${blocks.length} -> ${parsedCount}`);

fs.writeFileSync(sourcePath,next,'utf8');
const report={
  generatedAt:new Date().toISOString(),
  source:sourcePath,
  sourceSha256Before:expectedSha256,
  sourceSha256After:sha256(next),
  sourceBytesBefore:Buffer.byteLength(original,'utf8'),
  sourceBytesAfter:Buffer.byteLength(next,'utf8'),
  removedBytes:Buffer.byteLength(original,'utf8')-Buffer.byteLength(next,'utf8'),
  removedRules:removals.length,
  styleBlocksParsed:blocks.length,
  behaviorChangeIntended:false,
  parser:'postcss',
  criterion:'Single-selector static CSS rule, same selector and at-rule context repeated later, every earlier exact longhand property redeclared later with equal-or-stronger !important precedence; shorthand/custom-property/complex selector candidates excluded.',
  removed:removals.map(item=>({selector:item.selector,context:item.context||'root',line:item.sourceLine,properties:Array.from(item.decls.keys())}))
};
fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({removedRules:report.removedRules,removedBytes:report.removedBytes},null,2));
