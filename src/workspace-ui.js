"use strict";
// Engineering tool symbols share a 24-unit canvas and stay crisp at any scale.
const workspaceSymbols={
  select:'<path d="m5 3 14 10-7 1-3 7z"/>',
  box:'<rect x="3" y="3" width="18" height="18" rx="1" stroke-dasharray="3 3"/>',
  pin:'<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/>',
  bar:'<path d="M6 8h12a4 4 0 0 1 0 8H6a4 4 0 0 1 0-8z"/><circle cx="6" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/>',
  rail:'<path d="M2 6h20M2 18h20M4 3 2 6m7-3L7 6m7-3-2 3m7-3-2 3M4 21l-2-3m7 3-2-3m7 3-2-3m7 3-2-3" stroke-width="1.2"/><rect x="7" y="8" width="10" height="8" rx="1"/><circle cx="12" cy="12" r="2"/>',
  fix:'<circle cx="12" cy="5" r="2.5"/><path d="m10.5 7-6 10h15l-6-10M3 18h18M6 18l-3 4m8-4-3 4m8-4-3 4m8-4-3 4"/>',
  attach:'<path d="m4 18 10-13 6 13z" stroke-width="1.4"/><circle cx="4" cy="18" r="2.2" fill="white"/><circle cx="20" cy="18" r="2.2" fill="white"/><circle cx="14" cy="5" r="3" fill="#dcebf8" stroke-width="2"/><circle cx="14" cy="5" r=".6" fill="currentColor"/>',
  gear:'<path d="m10 3 4 0 .6 3 2 .9 2.6-1.5 2 3.4-2.3 2v2.4l2.3 2-2 3.4-2.6-1.5-2 .9-.6 3h-4l-.6-3-2-.9-2.6 1.5-2-3.4 2.3-2v-2.4l-2.3-2 2-3.4 2.6 1.5 2-.9z"/><circle cx="12" cy="12" r="3"/>',
  constraints:'<path d="M3 12h18M3 8v8m18-8v8"/><path d="m12 8 4 4-4 4-4-4z"/>',
  angle:'<path d="M3 19h18M3 19 19 4M11 19a8 8 0 0 0-2.3-5.7"/>',
  collinear:'<path d="M2 17 22 7" stroke-dasharray="3 3"/><path d="m4 16 6-3m5-3 5-2"/><circle cx="12" cy="12" r="2"/>',
  pulley:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M3 12v9m18-9v9"/>',
  midpoint:'<path d="M3 13h18M3 9v8m18-8v8m-9-9 4 7H8z"/>',
  coincident:'<circle cx="10" cy="12" r="6"/><circle cx="14" cy="12" r="6"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  horizontal:'<path d="M3 13h18M3 10v6m18-6v6"/>',
  vertical:'<path d="M12 3v18M9 3h6M9 21h6"/>',
  undo:'<path d="m8 4-5 5 5 5M3 9h10a7 7 0 0 1 0 14"/>',
  redo:'<path d="m16 4 5 5-5 5m5-5H11a7 7 0 0 0 0 14"/>',
  plus:'<path d="M5 12h14M12 5v14"/>',minus:'<path d="M5 12h14"/>',
  fit:'<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6M8 12h8m-4-4v8"/>',
  expand:'<path d="M14 3h7v7m0-7-7 7M10 21H3v-7m0 7 7-7"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  properties:'<path d="M4 6h16M4 12h16M4 18h16"/><rect x="7" y="4" width="3" height="4" fill="currentColor"/><rect x="14" y="10" width="3" height="4" fill="currentColor"/><rect x="9" y="16" width="3" height="4" fill="currentColor"/>',
  analysis:'<path d="M3 3v18h18M6 16l5-9 4 6 6-9"/><circle cx="11" cy="7" r="1.5"/>',
  play:'<path d="m8 4 12 8-12 8z" fill="currentColor" stroke="none"/>',pause:'<path d="M8 5v14M16 5v14" stroke-width="4"/>',
  new:'<path d="M14 3H5v18h14V8l-5-5v5h5M8 14h8m-4-4v8"/>',
  open:'<path d="M3 19V5h7l3 3h8v3M3 19l3-8h16l-3 8z"/>',
  save:'<path d="M3 3h15l3 3v15H3zM7 3v6h10V3M7 21v-8h10v8"/>',
  print:'<path d="M6 8V3h12v5M6 17H3V8h18v9h-3M6 14h12v7H6zM17 11h1"/>',
  appearance:'<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9 8a3 3 0 0 1 6 1c0 2-3 2-3 5m0 3v.1"/>',
  library:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="m17 13 5 8H12z"/>',
  solve:'<path d="m4 12 5 5L20 6"/>',
  brand:'<path d="m4 17 5-11 11 9-16 2"/><circle cx="4" cy="17" r="2"/><circle cx="9" cy="6" r="2"/><circle cx="20" cy="15" r="2"/>'
};
// A machined spur-wheel silhouette, with narrow teeth and three lightening holes.
{
 const points=[];
 for(let tooth=0;tooth<14;tooth++)for(const [phase,r] of [[0,8.5],[.22,8.5],[.3,10.7],[.7,10.7],[.78,8.5]]){
   const a=(tooth+phase)*Math.PI*2/14;points.push((12+r*Math.cos(a)).toFixed(2)+','+(12+r*Math.sin(a)).toFixed(2));
 }
 workspaceSymbols.gear='<polygon points="'+points.join(' ')+'" stroke-width="1.1"/><circle cx="12" cy="12" r="1.8"/>';
 for(let i=0;i<3;i++){const a=i*Math.PI*2/3-Math.PI/2;workspaceSymbols.gear+='<circle cx="'+(12+5*Math.cos(a))+'" cy="'+(12+5*Math.sin(a))+'" r="1.6" stroke-width="1.1"/>';}
}
window.workspaceIcon=name=>'<svg class="toolIcon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">'+(workspaceSymbols[name]||workspaceSymbols.pin).replace(/\s+stroke-width="[^"]*"/g,'')+'</svg>';
function iconButton(button,name,label,visible=false){
  if(!button)return;
  button.innerHTML=window.workspaceIcon(name)+(visible?'<span class="buttonText">'+safe(label)+'</span>':'');
  button.title=label;button.setAttribute('aria-label',label);
}
for(const button of document.querySelectorAll('[data-tool]'))iconButton(button,button.dataset.tool,({select:'Select / drag',box:'Box select',pin:'Pin joint',bar:'Rigid link',rail:'Slider joint',fix:'Ground pivot',attach:'Attach tracer pin'})[button.dataset.tool]);
for(const [id,name,label] of [
 ['addGear','gear','Add gear'],['addPulley','pulley','Add pulley (U)'],['constraintsToggle','constraints','Geometric constraints'],['undo','undo','Undo (Ctrl+Z)'],['redo','redo','Redo (Ctrl+Shift+Z / Ctrl+Y)'],
 ['zoomOut','minus','Zoom out'],['zoomIn','plus','Zoom in'],['fit','fit','Fit mechanism'],['play','play','Play mechanism'],
 ['closeProperties','close','Close properties'],['closeAnalysis','close','Close analysis'],['retractAnalysis','minus','Retract / expand analysis'],
 ['appearanceOpen','appearance','Appearance'],['helpOpen','help','Help'],['propertiesToggle','properties','Properties'],['analysisToggle','analysis','Analysis']
])iconButton($(id),name,label);
for(const [id,name,label] of [['new','new','New'],['load','open','Open'],['save','save','Save'],['printOpen','print','Print'],['examplesOpen','library','Examples'],['solve','solve','Solve']])iconButton($(id),name,label,true);
for(const kind of ['velocity','acceleration'])for(const [suffix,name,label] of [['Out','minus','Zoom out'],['In','plus','Zoom in'],['Fit','fit','Fit polygon']])iconButton($(kind+suffix),name,label);
document.querySelector('.logo').innerHTML=window.workspaceIcon('brand');

let drawerHeight=Math.max(180,Math.min(320,window.innerHeight*.39));
let expandedDrawerHeight=drawerHeight;
let activeAnalysisTab='polygons';
const propertiesPanel=$('propertiesPanel'),analysisPanel=$('analysisPanel');
function setPanel(panel,visible){
  panel.hidden=!visible;
  const properties=panel===propertiesPanel;
  document.body.classList.toggle(properties?'properties-hidden':'analysis-hidden',!visible);
  $(properties?'propertiesToggle':'analysisToggle').setAttribute('aria-expanded',String(visible));
  if(!visible&&panel.contains(document.activeElement))$(properties?'propertiesToggle':'analysisToggle').focus();
}
function panelToggle(panel){
  const before=drawingArea();setPanel(panel,panel.hidden);
  const after=drawingArea();
  view.x+=(after.x+after.width/2)-(before.x+before.width/2);
  view.y+=(after.y+after.height/2)-(before.y+before.height/2);
  renderSketch();
}
$('propertiesToggle').onclick=()=>panelToggle(propertiesPanel);
$('analysisToggle').onclick=()=>panelToggle(analysisPanel);
$('closeProperties').onclick=()=>panelToggle(propertiesPanel);
$('closeAnalysis').onclick=()=>panelToggle(analysisPanel);
const analysisTabs=[...document.querySelectorAll('[data-panel-tab]')];
function selectAnalysisTab(key){
  if(drawerHeight<=70)updateDrawerHeight(expandedDrawerHeight);
  activeAnalysisTab=key;
  for(const button of analysisTabs){
    const selected=button.dataset.panelTab===key;
    button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;
    $('pane-'+button.dataset.panelTab).hidden=!selected;
  }
  if(key==='equations')document.querySelector('.equationCard').open=true;
}
for(const [i,button] of analysisTabs.entries()){
  button.onclick=()=>selectAnalysisTab(button.dataset.panelTab);
  button.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();
    const next=event.key==='Home'?0:event.key==='End'?analysisTabs.length-1:(i+(event.key==='ArrowRight'?1:-1)+analysisTabs.length)%analysisTabs.length;
    selectAnalysisTab(analysisTabs[next].dataset.panelTab);analysisTabs[next].focus();
  });
}
selectAnalysisTab('polygons');
$('constraintsToggle').onclick=()=>{
  const popover=$('constraintPopover');popover.hidden=!popover.hidden;
  $('constraintsToggle').setAttribute('aria-expanded',String(!popover.hidden));
  if(!popover.hidden)document.querySelectorAll('[data-constraint]')[0]?.focus();
};
for(const button of document.querySelectorAll('[data-constraint]')){
  const key=button.dataset.constraint;
  iconButton(button,key,key[0].toUpperCase()+key.slice(1),true);
  button.onclick=()=>{
    if(key==='angle'&&selection?.type==='link')openAngleConstraint(selection.id);
    else if(['horizontal','vertical'].includes(key)&&selection?.type==='link'){
      const [p,b]=model.links[selection.id].pins;addConstructionConstraint({type:key,p,b});
    }else{
      const first=selection?.type==='point'?selection:null;engage(key);
      if(first&&['midpoint','coincident','horizontal','vertical','collinear'].includes(key)){staged=first;render();}
    }
    $('constraintPopover').hidden=true;
    $('constraintsToggle').setAttribute('aria-expanded','false');
  };
}
$('constraintTool').addEventListener('change',()=>{
  $('constraintPopover').hidden=true;$('constraintsToggle').setAttribute('aria-expanded','false');
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){$('constraintPopover').hidden=true;$('constraintsToggle').setAttribute('aria-expanded','false');}
});
function updateDrawerHeight(height){
  drawerHeight=Math.max(42,Math.min(Math.max(160,window.innerHeight-150),height));
  if(drawerHeight>70)expandedDrawerHeight=drawerHeight;
  analysisPanel.classList.toggle('collapsed',drawerHeight<=70);
  document.body.style.setProperty('--drawer-height',drawerHeight+'px');
  $('drawerResize').setAttribute('aria-valuemin','42');
  $('drawerResize').setAttribute('aria-valuemax',String(Math.max(160,window.innerHeight-150)));
  $('drawerResize').setAttribute('aria-valuenow',String(Math.round(drawerHeight)));
}
$('retractAnalysis').onclick=()=>updateDrawerHeight(drawerHeight<=70?expandedDrawerHeight:42);
let drawerDrag=null;
$('drawerResize').addEventListener('pointerdown',event=>{
  if(event.button!==0)return;
  drawerDrag={y:event.clientY,height:drawerHeight};event.preventDefault();
  $('drawerResize').setPointerCapture(event.pointerId);
});
$('drawerResize').addEventListener('pointermove',event=>{
  if(drawerDrag)updateDrawerHeight(drawerDrag.height+drawerDrag.y-event.clientY);
});
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('drawerResize').addEventListener(type,()=>{drawerDrag=null;});
$('drawerResize').addEventListener('keydown',event=>{
  if(event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();updateDrawerHeight(drawerHeight+(event.key==='ArrowUp'?24:-24));}
});
window.workspaceArea=()=>{
  const right=propertiesPanel.hidden?30:Math.min(306,canvasSize.width-104);
  const bottom=analysisPanel.hidden?85:drawerHeight+78;
  return {x:100,y:70,width:Math.max(90,canvasSize.width-right-130),height:Math.max(90,canvasSize.height-bottom-95)};
};
if(window.innerWidth<900)setPanel(propertiesPanel,false);
updateDrawerHeight(42);
let canvasReady=false;
function resizeWorkspace(){
  const before=drawingArea();
  const bounds=$('board').getBoundingClientRect();
  canvasSize.width=Math.max(200,bounds.width);canvasSize.height=Math.max(180,bounds.height);
  sketch.setAttribute('viewBox','0 0 '+canvasSize.width+' '+canvasSize.height);
  updateDrawerHeight(drawerHeight);
  if(!canvasReady){fit();canvasReady=true;}
  else {const after=drawingArea();view.x+=after.x+after.width/2-before.x-before.width/2;view.y+=after.y+after.height/2-before.y-before.height/2;}
  renderSketch();renderViewControls();
}
new ResizeObserver(resizeWorkspace).observe($('board'));
resizeWorkspace();
const drawingHotkeys={v:'select',j:'pin',l:'bar',s:'rail',f:'fix',t:'attach',m:'midpoint',c:'coincident',h:'horizontal',i:'vertical',k:'collinear'};
for(const button of document.querySelectorAll('[data-tool]')){
  const key=Object.keys(drawingHotkeys).find(k=>drawingHotkeys[k]===button.dataset.tool);
  if(key){button.title+=' ('+key.toUpperCase()+')';button.setAttribute('aria-keyshortcuts',key.toUpperCase());}
}
$('addGear').title+=' (G)';$('addGear').setAttribute('aria-keyshortcuts','G');
document.addEventListener('keydown',event=>{
  if(event.defaultPrevented||document.querySelector('dialog[open]')||event.target.closest('input,textarea,select,[contenteditable]'))return;
  const key=event.key.toLowerCase();
  if(event.ctrlKey||event.metaKey){
    const action={s:'save',o:'load',n:'new'}[key];if(action){event.preventDefault();$(action).onclick();}return;
  }
  if(event.altKey)return;
  if(drawingHotkeys[key]){event.preventDefault();engage(drawingHotkeys[key]);return;}
  const actions={u:()=>addPulley(),g:()=>{$('addGear').onclick();engage('select');},p:()=>$('propertiesToggle').onclick(),a:()=>$('analysisToggle').onclick(),home:()=>refresh(true),'+':()=>zoomTo(view.scale*1.25),'=':()=>zoomTo(view.scale*1.25),'-':()=>zoomTo(view.scale/1.25),'?':()=>$('helpOpen').onclick()};
  if(key===' '&&!event.target.closest('button,summary')){event.preventDefault();if(!$('play').disabled)$('play').onclick();return;}
  if(actions[key]){event.preventDefault();actions[key]();}
});

$('angleClose').onclick=()=>$('angleDialog').close();
$('angleApply').onclick=()=>{
  const link=Number($('angleLink').value),ref=$('angleReference').value,angle=$('angleValue').valueAsNumber;
  if(!Number.isFinite(angle)||ref!==''&&Number(ref)===link){$('angleMessage').textContent='Enter a finite angle and a different reference link.';return;}
  if(addConstructionConstraint({type:'angle',link,angle,physical:$('anglePhysical').checked,...(ref!==''?{referenceLink:Number(ref)}:{})}))$('angleDialog').close();
  else $('angleMessage').textContent=notice;
};

bindMachineTools();
