const {test}=require('node:test');
test('mechanism solver and editor integration',()=>{

const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict");
const root="src/",html=fs.readFileSync(root+"index.html","utf8");
const map=new Map(),docEvents={},browserEvents={},downloads=[];
class Element{
 constructor(id="",tag="div",attrs=""){
 this.id=id;this.tag=tag;this.attrs=attrs;this.dataset={};this.events={};this.checked=/\bchecked\b/.test(attrs);this.disabled=false;this.hidden=/\bhidden\b/.test(attrs);
 this.value=attrs.match(/\bvalue="([^"]*)"/)?.[1]??"";this._html="";this.children=[];
 const classes=new Set((attrs.match(/\bclass="([^"]*)"/)?.[1]??"").split(/\s+/).filter(Boolean));
 this.classList={add(...names){names.forEach(name=>classes.add(name));},remove(...names){names.forEach(name=>classes.delete(name));},contains(name){return classes.has(name);},toggle(name,force){const on=force??!classes.has(name);if(on)classes.add(name);else classes.delete(name);return on;}};this.style={setProperty(name,value){this[name]=value;}};
 for(const m of attrs.matchAll(/data-([\w-]+)="([^"]*)"/g))this.dataset[m[1].replace(/-([a-z])/g,(_,s)=>s.toUpperCase())]=m[2];
 }
 set innerHTML(x){this.revision=(this.revision??0)+1;for(const child of this.children){if(child.id&&map.get(child.id)===child)map.delete(child.id);}this._html=x;this.children=parse(x);if(this.tag==="select")this.value=this.options.find(o=>o.attrs.includes("selected"))?.value??this.options[0]?.value??"";}
 get innerHTML(){return this._html;}
 get options(){return this.children.filter(e=>e.tag==="option");}
 get valueAsNumber(){return this.value===""?NaN:Number(this.value);}
 set valueAsNumber(v){this.value=String(v);}
 querySelectorAll(selector){
 if(selector==="[data-style]")return this.children.filter(e=>e.dataset.style);
 if(selector==="[data-reset-style]")return this.children.filter(e=>e.attrs.includes("data-reset-style"));
 const data=selector.match(/^\[data-([\w-]+)\]$/)?.[1]?.replace(/-([a-z])/g,(_,s)=>s.toUpperCase());
 return data?this.children.filter(e=>data in e.dataset):[];
 }
 querySelector(selector){const dimension=selector.match(/^rect\[data-dimension="(\d+)"\]$/);if(dimension)return this.children.find(e=>e.tag==="rect"&&e.dataset.dimension===dimension[1]);if(selector==="select")return this.children.find(e=>e.tag==="select");
 if(selector===".polygonExplainContent")return this.children.find(e=>e.attrs.includes("polygonExplainContent"));
 return this.querySelectorAll(selector)[0]??null;}
 addEventListener(k,fn){this.listeners??={};(this.listeners[k]??=[]).push(fn);this.events[k]=event=>this.listeners[k].forEach(f=>f(event));}
 setAttribute(name,value){this[name]=value;}focus(){document.activeElement=this;}contains(el){return el===this;}
 select(){}
 getBoundingClientRect(){return {x:0,y:0,width:1360,height:700};}
 checkValidity(){if(!Number.isFinite(this.valueAsNumber)&&this.tag==="input")return false;
 const min=this.min??this.attrs.match(/min="([^"]*)"/)?.[1],max=this.attrs.match(/max="([^"]*)"/)?.[1];
 return !(min!==undefined&&this.valueAsNumber<Number(min)||max!==undefined&&this.valueAsNumber>Number(max));}
 reportValidity(){}showModal(){this.open=true;}close(){this.open=false;}click(){}setPointerCapture(){this.captures=(this.captures??0)+1;}
 getScreenCTM(){return{inverse(){return{};}};}
 createSVGPoint(){return{matrixTransform(){return{x:this.x,y:this.y};}};}
}
function parse(text){
 const out=[];
 for(const m of text.matchAll(/<(input|select|button|option|div|span|output|details|svg|dialog|section|h1|h2|p|label|form|style|aside|rect|text|g|line|path|circle)\b([^>]*)>/g)){
 const attrs=m[2],id=attrs.match(/\bid="([^"]*)"/)?.[1]??"";
 const el=new Element(id,m[1],attrs);out.push(el);if(id)map.set(id,el);
 if(["select"].includes(m[1])){
 const tail=text.slice(m.index+m[0].length),end=tail.indexOf("</select>");
 el.innerHTML=tail.slice(0,end);
 }
 }
 return out;
}
const initialElements=parse(html);
const $=id=>{const e=map.get(id);if(!e)throw Error("Missing DOM id "+id);return e;};
const document={documentElement:new Element('html'),body:new Element('body'),querySelector(selector){return initialElements.find(e=>e.attrs.includes(selector.slice(1)));},getElementById:id=>map.get(id)??null,querySelectorAll:selector=>{
 const data=selector.match(/^\[data-([\w-]+)\]$/)?.[1]?.replace(/-([a-z])/g,(_,s)=>s.toUpperCase());
 return data?initialElements.filter(e=>data in e.dataset):[];
},addEventListener(k,fn){const prior=docEvents[k];docEvents[k]=event=>{prior?.(event);fn(event);};},createElement(){return{click(){}};}};
const appearanceStorage=new Map(),themeMedia={matches:false,addEventListener(name,listener){this.listener=listener;}};
const localStorage={getItem(key){return appearanceStorage.get(key)??null;},setItem(key,value){appearanceStorage.set(key,value);}};
const c=vm.createContext({document,cancelAnimationFrame(){},requestAnimationFrame(){return 1;},setTimeout(){},Blob,URL:{createObjectURL(blob){downloads.push(blob);return "blob:test";},revokeObjectURL(){}},
 ResizeObserver:class{constructor(fn){this.fn=fn;}observe(){}},window:{localStorage,matchMedia(){return themeMedia;},innerWidth:1360,innerHeight:838,scrollTo(){},addEventListener(k,f){browserEvents[k]=f;},print(){browserEvents.beforeprint();}}});
const run=code=>vm.runInContext(code,c);
const scripts=["appearance","solver","examples","polygon-explain","polygon-steps","position-vectors","general-core","gear-mounts","construction","live-edit","machines","studio","print","general-ui","workspace-ui"];
for(const name of scripts){try{run(fs.readFileSync(root+name+".js","utf8"));}catch(e){console.error("Loading",name);throw e;}}
assert.equal($("status").textContent,"Solved");
assert.equal(run('drawerHeight'),42);
assert.equal($('gridSnap').checked,true);
assert.match($("title").textContent,/Four-bar/);
const saved=run("JSON.stringify(model)");
const appearanceSolution=run('JSON.stringify(result)'),appearanceRoot=document.documentElement;
run('renderPrint(printPlan(true))');const appearancePrint=$('printOutput').innerHTML;
$('appearanceOpen').onclick();assert.equal($('appearanceDialog').open,true);
$('appTheme').onchange({target:{value:'dark'}});
assert.equal(appearanceRoot['data-theme'],'dark');assert.equal(appearanceRoot.style['--canvas'],'#15202e');
$('appAccent').oninput({target:{value:'#ffff00'}});
assert.equal(appearanceRoot.style['--accent-text'],'#172438');
$('appCanvasAutomatic').onchange({target:{checked:false}});
$('appCanvas').oninput({target:{value:'#101010'}});
assert.equal(appearanceRoot.style['--canvas-ink'],'#e2ebf5');
const firstLink=document.querySelectorAll('[data-appearance-color]')[0];
firstLink.oninput({target:{value:'#ff55aa'}});
assert.equal(appearanceRoot.style['--link-1'],'#ff55aa');
assert.match($('sketch').innerHTML,/var\(--link-1/);
assert.equal(run('JSON.stringify(model)'),saved);assert.equal(run('JSON.stringify(result)'),appearanceSolution);
run('renderPrint(printPlan(true))');assert.equal($('printOutput').innerHTML,appearancePrint);
$('appAccent').oninput({target:{value:'not-a-color'}});
assert.equal(appearanceRoot.style['--accent'],'#ffff00');
run(fs.readFileSync(root+'appearance.js','utf8'));
assert.equal($('appTheme').value,'dark');assert.equal(firstLink.value,'#ff55aa');
$('appTheme').onchange({target:{value:'system'}});
themeMedia.matches=true;themeMedia.listener();assert.equal(appearanceRoot['data-theme'],'dark');
themeMedia.matches=false;themeMedia.listener();assert.equal(appearanceRoot['data-theme'],'light');
assert.equal(appearanceRoot.style['--canvas'],'#101010');
$('appearanceReset').onclick();assert.equal($('appCanvasAutomatic').checked,true);
assert.equal(appearanceRoot.style['--canvas'],'#fbfcfe');assert.equal(firstLink.value,'#2467ad');
const appearanceKey='linkage-studio-appearance';
appearanceStorage.set(appearanceKey,JSON.stringify({theme:'invalid',accent:'url(unsafe)',link1:'#123456',autoCanvas:'no'}));
run(fs.readFileSync(root+'appearance.js','utf8'));
assert.equal($('appTheme').value,'light');assert.equal(appearanceRoot.style['--accent'],'#235f99');
assert.equal(firstLink.value,'#123456');assert.equal($('appCanvasAutomatic').checked,true);
appearanceStorage.set(appearanceKey,'invalid json');run(fs.readFileSync(root+'appearance.js','utf8'));
assert.equal(firstLink.value,'#2467ad');
const storageGet=localStorage.getItem,storageSet=localStorage.setItem;
localStorage.getItem=localStorage.setItem=()=>{throw Error('Storage blocked');};
run(fs.readFileSync(root+'appearance.js','utf8'));
$('appTheme').onchange({target:{value:'dark'}});
assert.equal(appearanceRoot['data-theme'],'dark');assert.match($('appearanceStatus').textContent,/storage is unavailable/);
$('appearanceClose').onclick();assert.equal($('appearanceDialog').open,false);
localStorage.getItem=storageGet;localStorage.setItem=storageSet;$('appearanceReset').onclick();
const reset=run("reset"),examples=run("EXAMPLES");
for(const ex of examples){
 reset(ex.build());
 assert.equal($("status").textContent,"Solved",ex.id);
 assert.match($("velocity").innerHTML,/<line/);
 assert.equal(run("validate(model)"),true,ex.id);

}
reset(examples[0].build());
const stylePanel=$('editorPolygonStyle'),preset=stylePanel.querySelector('[data-preset-style]');
const originalSolution=run('JSON.stringify(result)');
for(const name of ['fine','bold','dashed','technical']){
 preset.onchange({target:{value:name}});
 assert.equal(preset.value,name);
 assert.equal(run('JSON.stringify(result)'),originalSolution);
 assert.match($('velocity').innerHTML,/data-arrowhead=/);
 assert.match($('acceleration').innerHTML,/data-arrowhead=/);
 if(name==='dashed')assert.match($('velocity').innerHTML,/stroke-dasharray="6 4"/);
 if(name==='technical')assert.match($('acceleration').innerHTML,/stroke-dasharray="7 3 2 3"/);
}
const lineWidth=stylePanel.querySelectorAll('[data-style]').find(el=>el.dataset.style==='lineWidth');
lineWidth.value='0.42';stylePanel.events.input({target:lineWidth});
assert.equal(preset.value,'custom');assert.equal(run('polygonStyle.lineWidth'),.42);
lineWidth.value='0';stylePanel.events.input({target:lineWidth});
assert.equal(run('polygonStyle.lineWidth'),.42);
stylePanel.querySelector('[data-reset-style]').onclick();
assert.equal(preset.value,'tracing');assert.doesNotMatch($('velocity').innerHTML,/data-arrowhead=/);

for(const id of ['velocity','acceleration']){
 const panel=$(id+'Steps');panel.open=true;panel.ontoggle();
 assert.match($(id+'StepText').innerHTML,/Set the pole and scale/);
 assert.ok($(id).querySelectorAll('[data-polygon-part]').some(el=>el.classList.contains('polygonPending')));
 $(id+'StepNext').onclick();
 assert.match($(id+'StepText').innerHTML,/motion input/);
 $(id+'StepProgress').oninput({target:{value:run('polygonConstructions.get("'+id+'").steps.findIndex(s=>s.value&&s.ids.some(key=>key.startsWith("'+(id==='acceleration'?'norm':'abs')+'-"))&&!s.coordinate)')}});
 assert.match($(id+'StepText').innerHTML,/x component/);
 const selectedStep=run('polygonConstructions.get("'+id+'").step');
 run('zoomPlot("'+id+'",1.2);');
 assert.equal(run('polygonConstructions.get("'+id+'").step'),selectedStep);
 $('lengthUnits').onchange({target:{value:'cm'}});
 assert.equal(run('polygonConstructions.get("'+id+'").step'),selectedStep);
 assert.match($(id+'StepText').innerHTML,/cm\/s/);
 $('lengthUnits').onchange({target:{value:'mm'}});
 $(id+'StepComplete').onclick();
 assert.equal($(id+'StepNext').disabled,true);
 assert.ok($(id).querySelectorAll('[data-polygon-part]').every(el=>!el.classList.contains('polygonPending')));
 $(id+'StepPrevious').onclick();
 panel.open=false;panel.ontoggle();
 assert.ok($(id).querySelectorAll('[data-polygon-part]').every(el=>!el.classList.contains('polygonPending')));
}
for(const ex of examples){
 reset(ex.build());
 for(const id of ['velocity','acceleration']){
  assert.equal(run('polygonConstructions.get("'+id+'").step'),0,ex.id);
  const coverage=run('JSON.stringify({parts:polygonExplanationState("'+id+'").parts.map(p=>p.id),covered:polygonConstructions.get("'+id+'").steps.flatMap(s=>s.ids)})');
  const {parts,covered}=JSON.parse(coverage);
  assert.ok(parts.every(part=>covered.includes(part)),ex.id+' '+id);
 }
}
const custom=examples[0].build();custom.title='Custom mechanism';custom.points[1].name='Custom <pin>';
reset(custom);
assert.ok(run('polygonConstructions.get("velocity").steps.some(s=>s.label.includes("Custom <pin>"))'));
const customIndex=run('polygonConstructions.get("velocity").steps.findIndex(s=>s.ids.includes("abs-1"))');
$('velocityStepProgress').oninput({target:{value:customIndex}});
assert.match($('velocityStepText').innerHTML,/Custom &lt;pin&gt;/);
$('new').onclick();
assert.equal($('velocityStepProgress').disabled,true);
assert.match($('accelerationStepText').innerHTML,/Solve the mechanism/);
reset(examples[0].build());
const geom=run("JSON.stringify(result.q)"),length=run("model.links[0].length");
for(const [u,k] of [["mm",1],["cm",.1],["m",.001],["in",1/25.4],["ft",1/304.8]]){
 $("lengthUnits").onchange({target:{value:u}});
 assert.ok(Math.abs(run("toDisplay(model.links[0].length)")-length*k)<1e-9);
 assert.equal(run("JSON.stringify(result.q)"),geom);
}
run('selection={type:"link",id:0};render();');
$("length").value=.12; $("length").events.change();
assert.ok(Math.abs(run("model.links[0].length")-36.576)<1e-8);
$("undo").onclick();assert.equal(run("model.links[0].length"),length);
reset(examples[0].build());
const propertiesDetails={open:false};
$("inspector").closest=()=>propertiesDetails;
const openDimension=()=>$("sketch").events.dblclick({target:{closest:()=>({dataset:{dimension:"0"}})},preventDefault(){}});
$("closeProperties").onclick();
$("lengthUnits").onchange({target:{value:"cm"}});
run('model.links[0].lengthLocked=false;');
openDimension();
assert.equal($("propertiesPanel").hidden,false);
assert.equal(propertiesDetails.open,true);
assert.equal(run('selection.type+"/"+selection.id'),'link/0');
assert.equal($("dimensionEdit").hidden,false);
assert.equal(document.activeElement,$("dimensionEdit"));
assert.equal(Number($("dimensionEdit").value),3.5);
const beforeDimension=run('JSON.stringify(model)'),dimensionHistory=run('history.length');
$("dimensionEdit").value="0";$("dimensionEdit").events.change();
assert.equal(run('JSON.stringify(model)'),beforeDimension);
assert.equal($("dimensionEdit").hidden,false);
$("dimensionEdit").value="4";
$("dimensionEdit").events.keydown({key:"Enter",preventDefault(){},stopPropagation(){}});
assert.equal(run('model.links[0].length'),40);
assert.equal(run('model.links[0].lengthLocked'),true);
assert.equal($("length").value,"4");
assert.equal($("dimensionEdit").hidden,true);
assert.equal(run('history.length'),dimensionHistory+1);
$("undo").onclick();assert.equal(run('JSON.stringify(model)'),beforeDimension);
openDimension();$("dimensionEdit").value="5";
$("dimensionEdit").events.keydown({key:"Escape",preventDefault(){},stopPropagation(){}});
assert.equal(run('JSON.stringify(model)'),beforeDimension);
openDimension();$("dimensionEdit").events.blur();
assert.equal(run('history.length'),dimensionHistory);
openDimension();$("dimensionEdit").value="4";$("dimensionEdit").events.blur();
assert.equal(run('model.links[0].length'),40);
$("undo").onclick();
openDimension();$("dimensionEdit").value="1000";$("dimensionEdit").events.change();
assert.equal(run('JSON.stringify(model)'),beforeDimension);
assert.match(run('notice'),/conflicts/);
reset(examples[5].build());
run('selection={type:"gear",id:1};render();');
assert.equal($("gearTeeth").disabled,true);
assert.ok(run("Math.abs(result.v[1]+1.5)")<1e-9);
assert.match($("results").innerHTML,/G1·P/);
$("printOpen").onclick();
assert.equal($("printSubmit").disabled,false);
$("printForm").onsubmit({preventDefault(){}});
assert.match($("printOutput").innerHTML,/<polygon points=/);
assert.match($("printOutput").innerHTML,/50 mm print check/);
browserEvents.afterprint();
reset(examples[0].build());
$("printOpen").onclick();
$("printGuides").checked=true;$("printComponents").checked=true;$("printLabels").checked=true;
$("printEquations").checked=true;
$('velocitySteps').open=true;$('velocitySteps').ontoggle();
assert.ok($('velocity').querySelectorAll('[data-polygon-part]').some(el=>el.classList.contains('polygonPending')));
$("printForm").onsubmit({preventDefault(){}});
const withGuides=$("printOutput").innerHTML;
assert.doesNotMatch(withGuides,/polygonPending|polygonStepCurrent/);
$('velocitySteps').open=false;$('velocitySteps').ontoggle();
assert.match(withGuides,/stroke-dasharray="4 3"/);
assert.match(withGuides,/Normal/);
assert.match(withGuides,/Equations and graphical/);
browserEvents.afterprint();
$("printGuides").checked=false;$("printComponents").checked=false;$("printLabels").checked=false;
$("printDimensions").checked=false;$("printEquations").checked=false;
$("printForm").onsubmit({preventDefault(){}});
const without=$("printOutput").innerHTML;
assert.doesNotMatch(without,/stroke-dasharray="4 3"|Normal ·|Normal tip/);
assert.ok(without.length<withGuides.length);
browserEvents.afterprint();
$("sweepPoint").value="2";$("sweepSpan").value="90";$("sweepSamples").value="30";$("sweepRun").onclick();
assert.match($("sweepResult").innerHTML,/31 poses calculated/);
assert.equal($("sweepCSV").disabled,false);
$("sweepCSV").onclick();
run('const prior=JSON.parse('+JSON.stringify(saved)+'); delete prior.gears;delete prior.meshes;delete prior.shafts;reset(prior);');
assert.equal($("status").textContent,"Solved");
const beforeGearPoints=run('model.points.length');
$("addGear").onclick();assert.equal(run("model.gears.length"),1);assert.equal(run("selection.type"),"gear");
assert.equal($('gearMount').value,'free');
assert.equal(run('model.gears[0].freePoint'),true);
assert.equal(run('model.points.length'),beforeGearPoints+1);
assert.equal(run('model.points[model.gears[0].centerPoint].fixed'),undefined);
$("undo").onclick();assert.equal(run("model.gears.length"),0);
assert.equal(run('model.points.length'),beforeGearPoints);

// Real viewport coordinates and panel interactions, without changing physical geometry.
assert.equal(run('canvasSize.width'),1360);
assert.equal(run('canvasSize.height'),700);
assert.equal($('sketch').viewBox,'0 0 1360 700');
assert.match($('sketch').innerHTML,/<rect width="1360" height="700"/);
assert.match($('tools').attrs,/Drawing tools/);
assert.match($('addGear').innerHTML,/<svg/);
assert.equal($('pane-results').hidden,true);
$('tab-results').onclick();assert.equal($('pane-results').hidden,false);assert.equal($('pane-polygons').hidden,true);
$('tab-equations').onclick();assert.equal(document.querySelector('.equationCard').open,true);
const pose=run('JSON.stringify(result.q)');
const oldArea=run('drawingArea().width');
$('closeProperties').onclick();assert.equal($('propertiesPanel').hidden,true);assert.ok(run('drawingArea().width')>oldArea);
$('propertiesToggle').onclick();assert.equal($('propertiesPanel').hidden,false);
$('closeAnalysis').onclick();assert.equal($('analysisPanel').hidden,true);
$('analysisToggle').onclick();assert.equal($('analysisPanel').hidden,false);
assert.equal(run('JSON.stringify(result.q)'),pose);
$('constraintsToggle').onclick();assert.equal($('constraintPopover').hidden,false);
$('constraintTool').events.change();assert.equal($('constraintPopover').hidden,true);
$('drawerResize').events.keydown({key:'ArrowUp',preventDefault(){}});
assert.ok(Number($('drawerResize')['aria-valuenow'])>320);
run('window.innerWidth=500;window.innerHeight=700;');
assert.ok(run('drawingArea().width')>0);

const midpointTool=document.querySelectorAll('[data-constraint]').find(e=>e.dataset.constraint==='midpoint');
midpointTool.onclick();assert.equal(run('tool'),'midpoint');assert.equal($('constraintPopover').hidden,true);

// History branches, keyboard shortcuts and selection survive undo/redo.
reset(examples[0].build());
const originalTitle=run('model.title');
run('edit(()=>model.title="Changed",true)');
const keyEvent=(key,shift=false)=>({key,ctrlKey:true,shiftKey:shift,preventDefault(){},target:{closest(){return null;}}});
docEvents.keydown(keyEvent('z'));assert.equal(run('model.title'),originalTitle);
docEvents.keydown(keyEvent('z',true));assert.equal(run('model.title'),'Changed');
docEvents.keydown(keyEvent('z'));run('edit(()=>model.title="Branched",true)');assert.equal(run('redoHistory.length'),0);
// An explicit input wins over automatic suggestions, including after edits.
reset(examples[0].build());
$('input').onchange({currentTarget:{value:'rotary/2'}});
assert.equal(run('model.inputMode'),'manual');
run('edit(()=>model.title="Manual",true)');assert.equal(run('model.drive.id'),2);
$('autoInput').checked=true;$('autoInput').onchange();assert.equal(run('model.drive.id'),0);
$('inputPos').value=90;$('inputPos').events.change();assert.equal(run('model.drive.position'),90);
// New links are editable in length; entering a dimension locks them.
run('reset({title:"Length editing",points:[{name:"O",x:0,y:0,fixed:true},{name:"A",x:100,y:0}],links:[{name:"Arm",pins:[0,1],length:100,lengthLocked:false}],constraints:[],drive:{type:"rotary",id:0,position:0,speed:2,accel:0}})');
const eventFor=(target,x,y,extra={})=>({target,clientX:x,clientY:y,pointerId:1,button:0,buttons:1,preventDefault(){},...extra});
const pointTarget={closest(){return {dataset:{point:'1'}};}};
let origin=run('project(...scene().slice(2,4))');
$('sketch').events.pointerdown(eventFor(pointTarget,...origin));
$('sketch').events.pointermove(eventFor(pointTarget,origin[0]+60,origin[1]-20));
$('sketch').events.pointerup();
assert.ok(run('model.links[0].length')>110);
run('selection={type:"link",id:0};render()');
$('length').value=120;$('length').events.change();assert.equal(run('model.links[0].lengthLocked'),true);
const q=run('result.q.slice()');
const fixedLengthPose=run('dragPose({...model,editLengths:true},result.q,grabPoint(model,result.q,{type:"point",id:1},result.q.slice(2,4)),[170,20])');
assert.ok(Math.abs(Math.hypot(fixedLengthPose[2],fixedLengthPose[3])-120)<1e-6);
// Grounded assemblies cannot be translated by dragging a gear.
reset(examples.find(e=>e.id==='geared-slider').build());
const beforeGroundDrag=run('JSON.stringify(model)'),oldX=run('model.points[0].x');
origin=run('project(model.gears[0].x,model.gears[0].y)');
const gearTarget={closest(){return {dataset:{gear:'0'}};}};
$('sketch').events.pointerdown(eventFor(gearTarget,...origin));
$('sketch').events.pointermove(eventFor(gearTarget,origin[0]+50,origin[1]+20));$('sketch').events.pointerup();
assert.equal(run('model.points[0].x'),oldX);assert.equal(run('JSON.stringify(model)'),beforeGroundDrag);
// Shaft support, not wheel type, controls translation during dragging.
for(const kind of ['gear','pulley']){
  run(`reset({title:'Shaft dragging',points:[],links:[],constraints:[],gears:[{name:'Wheel',kind:'${kind}',x:0,y:0,module:2,teeth:20,radius:20,angle:0}],drive:{type:'gear',id:0,position:0,speed:2,accel:0}})`);
  const stationary=run('JSON.stringify(model)');origin=run('project(10,0)');
  $('sketch').events.pointerdown(eventFor(gearTarget,...origin));
  $('sketch').events.pointermove(eventFor(gearTarget,origin[0]+20,origin[1]-15));$('sketch').events.pointerup();
  assert.equal(run('JSON.stringify(model)'),stationary);
  run('mountGear(0,"free");result=solveModel(model,coord(model));render()');
  origin=run('project(10,0)');
  const requested=run('[(20/view.scale),(15/view.scale)]');
  $('sketch').events.pointerdown(eventFor(gearTarget,...origin));
  $('sketch').events.pointermove(eventFor(gearTarget,origin[0]+20,origin[1]-15));$('sketch').events.pointerup();
  const center=run('gearCenter(model,coord(model),model.gears[0])');
  assert.ok(Math.abs(center[0]-requested[0])<1e-6);
  assert.ok(Math.abs(center[1]-requested[1])<1e-6);
  $('undo').onclick();assert.ok(Math.abs(run('gearCenter(model,coord(model),model.gears[0])[0]'))<1e-6);
}
reset(examples[0].build());
const snapScale=run('view.scale');run('view.scale=1;gridSpacing=25');
assert.equal($('gridSnap').checked,true);
assert.deepEqual(Array.from(run('snapGridPosition([24,28])')),[25,28]);
$('gridSnap').checked=false;$('gridSnap').onchange();
assert.deepEqual(Array.from(run('snapGridPosition([24,28])')),[24,28]);
$('gridSnap').checked=true;$('gridSnap').onchange();
assert.deepEqual(Array.from(run('snapGridPosition([24,28])')),[25,28]);
assert.deepEqual(Array.from(run('snapGridPosition([21,29])')),[21,29]);
run('view.scale=10');assert.deepEqual(Array.from(run('snapGridPosition([24,28])')),[24,28]);
$('gridSnap').checked=false;$('gridSnap').onchange();run('view.scale='+snapScale);
// The analysis drawer can expand and retract after earlier interactions.
run('updateDrawerHeight(42);');
$('retractAnalysis').onclick();assert.ok(run('drawerHeight')>70);
$('retractAnalysis').onclick();assert.equal(run('drawerHeight'),42);
$('retractAnalysis').onclick();assert.ok(run('drawerHeight')>70);
assert.equal((html.match(/<details class="card side/g)||[]).length,3);

// Saved sketches retain manual input and explicit length-lock preferences.
run('model.inputMode="manual";model.links[0].lengthLocked=false;const roundTrip=JSON.parse(JSON.stringify(model));reset(roundTrip)');
assert.equal(run('model.inputMode'),'manual');assert.equal(run('model.links[0].lengthLocked'),false);
// Shaft-linked crank lengths can also change in editing mode without losing alignment.
run('model.links[0].lengthLocked=false');
const shaftLength=run('model.links[0].length');
const shaftPose=run('dragPose({...model,editLengths:true},result.q,grabPoint(model,result.q,{type:"point",id:1},result.q.slice(2,4)),[result.q[0]+1.3*(result.q[2]-result.q[0]),result.q[1]+1.3*(result.q[3]-result.q[1])])');
assert.ok(Math.abs(Math.hypot(shaftPose[2]-shaftPose[0],shaftPose[3]-shaftPose[1])-shaftLength)>1);

// A new connection moves an independent second wheel into exact pitch contact.
reset(examples.find(e=>e.id==='gears').build());
run('edit(()=>{model.meshes=[];model.gears[1].x=180;},true)');
$('meshA').value='0';$('meshB').value='1';$('meshKind').value='external';$('meshPlacement').value='move';$('connectGears').onclick();
assert.equal(run('model.gears[1].x'),60);assert.equal(run('model.meshes.length'),1);assert.equal(run('result.status'),'solved');
$('undo').onclick();assert.equal(run('model.gears[1].x'),180);assert.equal(run('model.meshes.length'),0);
$('meshPlacement').value='keep';$('connectGears').onclick();assert.equal(run('model.meshes.length'),0);assert.match($('gearMessage').textContent,/pitch circles/);
// Mount a wheel to a joint, release it, and ground it again without orphan DOFs.
reset(examples.find(e=>e.id==='fourbar').build());$('addGear').onclick();
run('selection={type:"gear",id:0};render()');
$('gearMount').value='joint';$('gearMountPoint').value='1';$('applyGearMount').onclick();assert.equal(run('model.gears[0].centerPoint'),1);
$('gearMount').value='free';$('applyGearMount').onclick();assert.equal(run('model.gears[0].freePoint'),true);assert.equal(run('model.points.length'),5);
$('gearMount').value='ground';$('applyGearMount').onclick();assert.equal(run('model.gears[0].centerPoint'),undefined);assert.equal(run('model.points.length'),4);
// Rigid shaft coupling works at either endpoint, including an ungrounded joint.
run('attachGearToLink(0,0,1);result=solveModel(model,coord(model));dirty=false;render()');
assert.equal(run('model.shafts[0].pivot'),1);assert.equal(run('result.status'),'solved');
assert.ok(Math.abs(run('result.v[2*model.points.length]')-2)<1e-8);
// Moving-axis gears: analytical carrier ratio, acceleration and no-slip contact.
reset(examples.find(e=>e.id==='planet-carrier').build());
assert.equal(run('result.status'),'solved');assert.ok(Math.abs(run('result.v[5]')-3)<1e-8);
run('model.drive.accel=.5;result=solveModel(model,result.q)');
assert.ok(Math.abs(run('result.a[5]')-.75)<1e-8);
const contact=run('(()=>{const phi=model.drive.position*RAD;return [result.v[2]+40*result.v[5]*Math.sin(phi),result.v[3]-40*result.v[5]*Math.cos(phi)];})()');
assert.ok(Math.hypot(...contact)<1e-8);
const material=run('gearTracerData(model,result)[1]');
assert.ok(Math.abs(material.velocity[1]-(run('result.v[3]')+120))<1e-8);
let continuation=run('result.q');
for(let angle=35;angle<=395;angle+=2){c.poseSeed=continuation;c.poseAngle=angle;const step=run('solveModel(model,poseSeed,{...model.drive,position:poseAngle})');assert.equal(step.status,'solved');continuation=step.q;}
run('result=solveModel(model,result.q);dirty=false;render()');
$('printDimensions').checked=true;$('printOpen').onclick();$('printFit').onclick();$('printForm').onsubmit({preventDefault(){}});assert.match($('printOutput').innerHTML,/Planet/);browserEvents.afterprint();
// Single-letter tools ignore editable fields and preserve browser text editing.
docEvents.keydown({key:'l',preventDefault(){},target:{closest(){return null;}}});assert.equal(run('tool'),'bar');
docEvents.keydown({key:'j',preventDefault(){},target:{closest(){return {};}}});assert.equal(run('tool'),'bar');
docEvents.keydown({key:'v',preventDefault(){},target:{closest(){return null;}}});assert.equal(run('tool'),'select');
const symbol=run('window.workspaceIcon("gear")');assert.doesNotMatch(symbol,/<polygon[^>]*stroke-width/);

// An internal moving-axis pair has the carrier-relative sign and ratio as well.
run('(()=>{const m=planetaryCarrierExample(),a=35*RAD;m.links[0].length=40;m.points[1].x=40*Math.cos(a);m.points[1].y=40*Math.sin(a);m.gears[0].teeth=60;m.gears[1].teeth=20;m.gears[1].x=m.points[1].x;m.gears[1].y=m.points[1].y;m.meshes[0]={a:0,b:1,type:"internal",carrierAware:true,phase:-40*a};m.drive.accel=.5;reset(m);})()');
assert.equal(run('result.status'),'solved');assert.ok(Math.abs(run('result.v[5]')+4)<1e-8);assert.ok(Math.abs(run('result.a[5]')+1)<1e-8);

// Construction angles close the initial sketch but do not freeze simulation.
run('reset({title:"Construction test",points:[{name:"O",x:0,y:0,fixed:true},{name:"A",x:100,y:0}],links:[{name:"Arm",pins:[0,1],length:100,lengthLocked:true}],constraints:[],drive:{type:"rotary",id:0,position:0,speed:2,accel:0}})');
assert.equal(run('addConstructionConstraint({type:"angle",link:0,angle:90})'),true);
assert.ok(Math.abs(run('Math.atan2(result.q[3],result.q[2])/RAD')-90)<1e-6);
assert.equal(run('result.status'),'solved');assert.equal(run('result.dof'),1);
assert.equal(run('seek(180)'),true);assert.ok(Math.abs(run('result.q[2]')+100)<1e-6);
assert.equal(run('model.constraints[0].angle'),90);
run('render();selection={type:"link",id:0};openAngleConstraint(0)');
$('angleReference').value='';$('angleValue').value=45;$('angleApply').onclick();
assert.equal($('angleDialog').open,false);assert.ok(Math.abs(run('model.drive.position')-45)<1e-6);
assert.equal(run('model.constraints.length'),1);assert.equal(run('validate(model)'),true);
// Horizontal and vertical can act directly on the selected link.
run('model.constraints=[];selection={type:"link",id:0};render()');
document.querySelectorAll('[data-constraint]').find(e=>e.dataset.constraint==='horizontal').onclick();
assert.ok(Math.abs(run('result.q[3]'))<1e-6);assert.equal(run('seek(90)'),true);
// A relative angle is measured between two directed links.
run('reset({title:"Relative angle",points:[{name:"O",x:0,y:0,fixed:true},{name:"A",x:50,y:0},{name:"Q",x:100,y:0,fixed:true},{name:"B",x:150,y:0}],links:[{name:"One",pins:[0,1],length:50,lengthLocked:true},{name:"Two",pins:[2,3],length:50,lengthLocked:true}],constraints:[],drive:null})');
assert.equal(run('addConstructionConstraint({type:"angle",link:1,referenceLink:0,angle:30})'),true);
assert.ok(Math.abs(run('(()=>{const q=coord(model),a=vector(q,0,1),b=vector(q,2,3);return (Math.atan2(b[1],b[0])-Math.atan2(a[1],a[0]))/RAD;})()')-30)<1e-5);
// Locked carrier: automatic fit resizes the gears without stretching the link.
run('reset({title:"Gear fitting",inputMode:"manual",points:[{name:"O",x:0,y:0,fixed:true},{name:"P",x:100,y:0}],links:[{name:"Carrier",pins:[0,1],length:100,lengthLocked:true}],constraints:[],gears:[{name:"Sun",x:0,y:0,centerPoint:0,teeth:20,module:2,angle:0,rotationLocked:true},{name:"Planet",x:100,y:0,centerPoint:1,teeth:40,module:2,angle:0}],meshes:[],shafts:[],drive:{type:"rotary",id:0,position:0,speed:2,accel:0}})');
run('edit(()=>model=snappedGearConnection(model,0,1,"external","fit"),true)');
assert.equal(run('model.links[0].length'),100);assert.ok(Math.abs(run('model.gears[0].module')-10/3)<1e-8);assert.equal(run('result.status'),'solved');
// Unlocked carrier: preserve the gear module and reposition its shaft instead.
run('model.meshes=[];model.gears.forEach(g=>g.module=2);model.links[0].lengthLocked=false;model=snappedGearConnection(model,0,1,"external","fit");result=solveModel(model,coord(model));dirty=false;render()');
assert.ok(Math.abs(run('model.links[0].length')-60)<1e-6);assert.equal(run('model.gears[0].module'),2);assert.equal(run('result.status'),'solved');
// Re-mounting an already meshed pair onto a locked carrier also fits to contact.
run('model.meshes=[];model.points[1].x=100;model.links[0].length=100;model.links[0].lengthLocked=true;delete model.gears[1].centerPoint;model.gears[1].x=60;model.gears[1].y=0;refreshMovingMeshPhases(model);model=snappedGearConnection(model,0,1,"external","fit");mountGear(1,"joint",1)');
assert.equal(run('validateGears(model)'),true);assert.ok(Math.abs(run('model.gears[0].module')-10/3)<1e-8);
assert.doesNotMatch(html,/carrierBuilder|carrierDialog/);
// Failed construction is reversible and does not replace a valid pose.
run('reset({title:"Conflict",points:[{name:"O",x:0,y:0,fixed:true},{name:"A",x:100,y:0,fixed:true}],links:[{name:"Ground span",pins:[0,1],length:100,lengthLocked:true}],constraints:[],drive:null})');
const beforeConflict=run('JSON.stringify(model)');
assert.equal(run('addConstructionConstraint({type:"angle",link:0,angle:90})'),false);
assert.equal(run('JSON.stringify(model)'),beforeConflict);

// Midpoint snaps immediately and follows both position and rates through motion.
run('reset({title:"Midpoint",points:[{name:"O",x:0,y:0,fixed:true},{name:"A",x:100,y:0},{name:"M",x:20,y:40}],links:[{name:"Arm",pins:[0,1],length:100,lengthLocked:true}],constraints:[],drive:{type:"rotary",id:0,position:0,speed:2,accel:.5}})');
assert.equal(run('addConstructionConstraint({type:"midpoint",p:2,link:0})'),true);
assert.ok(Math.abs(run('result.q[4]')-50)<1e-7);assert.ok(Math.abs(run('result.q[5]'))<1e-7);
assert.equal(run('result.status'),'solved');assert.equal(run('constraintAffectsMotion(model.constraints[0])'),true);
assert.equal(run('seek(90)'),true);
for(const key of ['q','v','a'])assert.ok(run('Math.hypot(result.'+key+'[4]-(result.'+key+'[0]+result.'+key+'[2])/2,result.'+key+'[5]-(result.'+key+'[1]+result.'+key+'[3])/2)')<1e-7);
// Ordinary edits are solved without another click on Solve.
run('selection={type:"link",id:0};render()');$('length').value=120;$('length').events.change();
assert.equal(run('dirty'),false);assert.equal(run('result.status'),'solved');assert.ok(Math.abs(run('Math.hypot(result.q[2],result.q[3])')-120)<1e-6);
// Coincident relations snap and connect separate joints dynamically.
run('model.constraints=[];model.points[2].x=5;model.points[2].y=80;result=solveModel(model,coord(model))');
assert.equal(run('addConstructionConstraint({type:"coincident",p:2,b:1})'),true);assert.equal(run('seek(45)'),true);
assert.ok(run('Math.hypot(result.q[4]-result.q[2],result.q[5]-result.q[3])')<1e-6);
// Resizing a carrier updates pitch size while retaining tooth counts.
reset(examples.find(e=>e.id==='planet-carrier').build());run('selection={type:"link",id:0};render()');
$('length').value=90;$('length').events.change();
assert.equal(run('model.links[0].length'),90);assert.equal(run('model.gears[0].module'),3);assert.equal(run('model.gears[1].module'),3);assert.equal(run('result.status'),'solved');
assert.ok(Math.abs(run('Math.hypot(result.q[2],result.q[3])')-90)<1e-6);
// Fixed sizes prevent incompatible carrier edits, with rollback.
run('model.gears.forEach(g=>g.sizeLocked=true);selection={type:"link",id:0};render()');
$('length').value=120;$('length').events.change();assert.equal(run('model.links[0].length'),90);assert.match(run('notice'),/Both gear sizes/);
// One fixed gear keeps its diameter while an integer-tooth mate accommodates the length.
reset(examples.find(e=>e.id==='planet-carrier').build());run('model.gears[0].sizeLocked=true;selection={type:"link",id:0};render()');
$('length').value=100;$('length').events.change();assert.equal(run('model.gears[0].module'),2);assert.equal(run('model.gears[0].teeth'),20);assert.equal(run('model.gears[1].teeth'),80);assert.equal(run('result.status'),'solved');
// Dragging a mounted planet follows available motion without translating ground.
reset(examples.find(e=>e.id==='planet-carrier').build());
origin=run('project(...gearCenter(model,result.q,model.gears[1]))');
const planetTarget={closest(){return {dataset:{gear:'1'}};}};
$('sketch').events.pointerdown(eventFor(planetTarget,...origin));$('sketch').events.pointermove(eventFor(planetTarget,origin[0]+15,origin[1]-25));$('sketch').events.pointerup();
assert.equal(run('model.points[0].x'),0);assert.equal(run('model.points[0].y'),0);assert.equal(run('result.status'),'solved');
// Right drag pans in every tool; left drag selects without moving the viewport.
const background={closest(){return null;}};
run('engage("pin")');const countBefore=run('model.points.length'),panBefore=run('view.x');
$('sketch').events.pointerdown(eventFor(background,100,100,{button:2,buttons:2}));$('sketch').events.pointermove(eventFor(background,140,120,{button:2,buttons:2}));$('sketch').events.pointerup();
assert.equal(run('view.x'),panBefore+40);assert.equal(run('model.points.length'),countBefore);
let menuPrevented=false;$('sketch').events.contextmenu({preventDefault(){menuPrevented=true;}});assert.equal(menuPrevented,true);
const boxView=run('view.x');
$('sketch').events.pointerdown(eventFor(background,0,0));$('sketch').events.pointermove(eventFor(background,1360,700));
assert.match($('sketch').innerHTML,/data-selection-box/);$('sketch').events.pointerup();
assert.equal(run('view.x'),boxView);assert.ok(run('multiSelection.length')>1);
docEvents.keydown({key:'Escape',preventDefault(){},target:background});assert.equal(run('selection'),null);assert.equal(run('multiSelection.length'),0);assert.equal(run('tool'),'select');
// Screen legend has dedicated coordinates clear of the upper-left toolbar.
$('sketchVelocityVectors').checked=true;$('sketchAccelerationVectors').checked=true;run('renderSketch()');
assert.match($('sketch').innerHTML,/x1="110" y1="132"/);

// Drag-resizing an editable carrier also refits its pitch circles continuously.
reset(examples.find(e=>e.id==='planet-carrier').build());run('model.links[0].lengthLocked=false;render()');
origin=run('project(result.q[2],result.q[3])');
$('sketch').events.pointerdown(eventFor(planetTarget,...origin));$('sketch').events.pointermove(eventFor(planetTarget,origin[0]+40,origin[1]));$('sketch').events.pointerup();
assert.equal(run('result.status'),'solved');assert.ok(Math.abs(run('model.links[0].length')-60)>1);
assert.ok(Math.abs(run('gearRadius(model.gears[0])+gearRadius(model.gears[1])-model.links[0].length'))<1e-6);
assert.equal(run('model.points[0].x'),0);assert.equal(run('model.points[0].y'),0);
// Midpoint constraints migrate correctly from schema 2 to schema 3.
run('const legacyMid={title:"Legacy",schemaVersion:2,points:[{name:"O",x:0,y:0,fixed:true},{name:"A",x:100,y:0},{name:"M",x:50,y:0}],links:[{name:"Arm",pins:[0,1],length:100}],constraints:[{type:"midpoint",p:2,link:0,physical:false,construction:true}],drive:{type:"rotary",id:0,position:0,speed:2,accel:0}};reset(legacyMid)');
assert.equal(run('model.constraints[0].physical'),true);assert.equal(run('model.schemaVersion'),4);assert.equal(run('result.status'),'solved');
// Area-selected objects can be deleted and restored together.
run('multiSelection=[{type:"point",id:2}];selection=multiSelection[0]');run('deleteSelection()');assert.equal(run('model.points.length'),2);$('undo').onclick();assert.equal(run('model.points.length'),3);

// Model the browser losing click delivery if mouse-up replaces the clicked SVG node.
run('reset({title:"Placement",points:[],links:[],constraints:[],drive:null});engage("pin")');
const gridTarget={closest(){return null;}};
function placementClick(target,x,y){
  const revision=$('sketch').revision,captures=$('sketch').captures??0;
  const event=eventFor(target,x,y);
  $('sketch').events.pointerdown(event);$('sketch').events.pointerup(event);
  assert.equal($('sketch').revision,revision,'simple mouse-up must preserve the click target');
  assert.equal($('sketch').captures??0,captures,'simple clicks must not capture the pointer');
  $('sketch').events.click(event);
}
placementClick(gridTarget,200,200);assert.equal(run('model.points.length'),1);
placementClick(gridTarget,350,230);assert.equal(run('model.points.length'),2);
run('engage("bar")');
const point0={closest(){return {dataset:{point:'0'}};}},point1={closest(){return {dataset:{point:'1'}};}};
placementClick(point0,200,200);assert.equal(run('staged.id'),0);
placementClick(point1,350,230);assert.equal(run('model.links.length'),1);assert.equal(run('staged'),null);
// Empty-space link drawing creates and retains the first endpoint, then connects it.
placementClick(gridTarget,500,200);assert.equal(run('model.points.length'),3);assert.equal(run('staged.id'),2);
placementClick(gridTarget,600,250);assert.equal(run('model.points.length'),4);assert.equal(run('model.links.length'),2);
assert.equal(run('dirty'),false);assert.equal(run('validate(model)'),true);
// A small hand movement below the drag threshold still places a joint.
run('engage("pin")');
const jitter=eventFor(gridTarget,700,250),revision=$('sketch').revision;
$('sketch').events.pointerdown(jitter);$('sketch').events.pointermove(eventFor(gridTarget,701,251));$('sketch').events.pointerup(jitter);
assert.equal($('sketch').revision,revision);$('sketch').events.click(jitter);assert.equal(run('model.points.length'),5);
// An actual empty-grid drag selects and must not place a joint.
const beforeSelection=run('model.points.length');
$('sketch').events.pointerdown(eventFor(gridTarget,100,100));$('sketch').events.pointermove(eventFor(gridTarget,800,500));$('sketch').events.pointerup();$('sketch').events.click(eventFor(gridTarget,800,500));
assert.equal(run('model.points.length'),beforeSelection);assert.ok(run('multiSelection.length')>0);


// Belt speed and angular acceleration are radius-weighted; crossed belts reverse direction.
for(const crossed of [false,true]){
 reset(run('beltExample('+crossed+')'));
 assert.ok(Math.abs(run('result.v[1]')-(crossed?-2:2))<1e-8);
 assert.ok(Math.abs(run('result.a[1]')-(crossed?-1:1))<1e-8);
 assert.equal(run('seek(270)'),true);assert.equal(run('validate(model)'),true);
 assert.match(run('equationsMarkup()'),/Pulleys and belts/);
 $('printDimensions').checked=true;$('printOpen').onclick();$('printFit').onclick();$('printForm').onsubmit({preventDefault(){}});
 assert.match($('printOutput').innerHTML,/R 30/);browserEvents.afterprint();
}
reset(run('tackleExample()'));
for(const [index,value] of [[1,20],[3,-40],[4,1],[5,-2]])assert.ok(Math.abs(run('result.v['+index+']')-value)<1e-8);
for(const [index,value] of [[1,5],[3,-10],[4,.25],[5,-.5]])assert.ok(Math.abs(run('result.a['+index+']')-value)<1e-8);
assert.equal(run('seek(-180)'),true);assert.equal(run('validate(model)'),true);
assert.ok(Math.abs(run('2*sliderTravel(model,result.q,0)+sliderTravel(model,result.q,1)+340'))<1e-7);
assert.match(run('equationsMarkup()'),/Inextensible rope/);
assert.equal(run('validate({...model,cables:[{...model.cables[0],terms:[{point:99,weight:2}]}]})'),false);
// The two-click belt connection is live and undoable.
reset(run('beltExample()'));run('model.meshes=[];render()');
run('edit(()=>connectBelt(0,1,"belt-crossed"),true)');assert.ok(Math.abs(run('result.v[1]')+2)<1e-8);
$('undo').onclick();assert.equal(run('model.meshes.length'),0);
// Pulley creation, support controls, safe sizing, and the rope dialog are usable.
reset(run('beltExample()'));$('addPulley').onclick();assert.equal(run('model.gears[2].kind'),'pulley');
assert.ok($('pulleyRadius'));assert.ok($('pulleySupport'));
assert.equal($('pulleySupport').value,'free');
assert.equal(run('model.gears[2].freePoint'),true);
assert.equal(run('model.points.length'),1);
$('undo').onclick();assert.equal(run('model.points.length'),0);assert.equal(run('model.gears.length'),2);
$('redo').onclick();assert.equal(run('model.points.length'),1);assert.equal($('pulleySupport').value,'free');
$('pulleySupport').value='free';$('applyPulleySupport').onclick();assert.equal(run('model.gears[2].freePoint'),true);
$('pulleySupport').value='ground';$('applyPulleySupport').onclick();assert.equal(run('model.gears[2].centerPoint'),undefined);
reset(run('beltExample()'));run('selection={type:"gear",id:0};render()');
$('pulleyRadius').value='200';$('pulleyRadius').events.change();assert.equal(run('model.gears[0].radius'),30);
$('pulleyRadius').value='40';$('pulleyRadius').events.change();assert.equal(run('model.gears[0].radius'),40);assert.equal(run('validate(model)'),true);
reset(run('tackleExample()'));run('model.cables=[];model.gears=[];render()');$('ropeOpen').onclick();
$('ropeWeightA').value='2';$('ropeWeightB').value='1';$('ropeApply').onclick();
assert.equal($('ropeDialog').open,false);assert.equal(run('model.cables.length'),1);
assert.ok(Math.abs(run('result.v[1]')-20)<1e-7);assert.equal(run('validate(model)'),true);
$('undo').onclick();assert.equal(run('model.cables.length'),0);
// Collinear links snap without collapsing a perpendicular second member.
run('reset({title:"Straight links",points:[{name:"O",x:0,y:0,fixed:true},{name:"A",x:100,y:0},{name:"B",x:100,y:50}],links:[{name:"OA",pins:[0,1],length:100,lengthLocked:true},{name:"AB",pins:[1,2],length:50,lengthLocked:true}],constraints:[],drive:{type:"rotary",id:0,position:0,speed:2,accel:.5}})');
assert.equal(run('addConstructionConstraint({type:"collinear",link:0,referenceLink:1})'),true);
assert.ok(Math.abs(run('result.q[4]')-150)<1e-6);assert.equal(run('validate(model)'),true);
for(const angle of [45,90,180,270]){
 assert.equal(run('seek('+angle+')'),true);
 for(const key of ['q','v','a'])for(const axis of [0,1])assert.ok(Math.abs(run('result.'+key+'['+(4+axis)+']-1.5*result.'+key+'['+(2+axis)+']'))<1e-6);
}
// A joint can slide along an extended link while maintaining the line relation.
run('reset({title:"Point on line",points:[{name:"O",x:0,y:0,fixed:true},{name:"A",x:100,y:0},{name:"P",x:150,y:20,rail:{x:150,y:0,angle:90}}],links:[{name:"OA",pins:[0,1],length:100,lengthLocked:true}],constraints:[],drive:{type:"rotary",id:0,position:0,speed:2,accel:.5}})');
assert.equal(run('addConstructionConstraint({type:"collinear",link:0,p:2})'),true);
assert.ok(Math.abs(run('result.q[5]'))<1e-6);assert.equal(run('seek(30)'),true);
assert.ok(Math.abs(run('result.q[5]')-150/Math.sqrt(3))<1e-6);
assert.ok(Math.abs(run('result.v[5]')-400)<1e-6);
assert.ok(Math.abs(run('result.a[5]')-(100+1600/Math.sqrt(3)))<1e-5);
// Tracer dimensions use absolute offsets and keep them during base-link resizing.
run('reset({title:"Tracer dimensions",points:[{name:"O",x:0,y:0,fixed:true},{name:"A",x:100,y:0},{name:"T",x:50,y:20}],links:[{name:"Arm",pins:[0,1,2],length:100,lengthLocked:false,attach:[[.5,.2]]}],constraints:[],drive:{type:"rotary",id:0,position:0,speed:2,accel:.5}});selection={type:"link",id:0};render()');
$('tracerAlong0').value='60';$('tracerAlong0').events.change();
$('tracerNormal0').value='30';$('tracerNormal0').events.change();
assert.ok(Math.abs(run('result.q[4]')-60)<1e-6);assert.ok(Math.abs(run('result.q[5]')-30)<1e-6);
run('edit(()=>{model.points[1].x=200;model.links[0].length=200;},true)');
assert.ok(Math.abs(run('result.q[4]')-60)<1e-6);assert.ok(Math.abs(run('result.q[5]')-30)<1e-6);
$('tracerRadius0').value='80';$('tracerRadius0').events.change();$('tracerAngle0').value='90';$('tracerAngle0').events.change();
assert.ok(Math.abs(run('result.q[4]'))<1e-6);assert.ok(Math.abs(run('result.q[5]')-80)<1e-6);
assert.equal(run('seek(90)'),true);assert.ok(Math.abs(run('result.q[4]')+80)<1e-6);
assert.ok(Math.abs(run('result.v[5]')+160)<1e-6);assert.equal(run('validate(JSON.parse(JSON.stringify(model)))'),true);
assert.match($('sketch').innerHTML,/80 mm/);
$('printDimensions').checked=true;$('printOpen').onclick();$('printFit').onclick();$('printForm').onsubmit({preventDefault(){}});assert.match($('printOutput').innerHTML,/80 mm/);browserEvents.afterprint();

// Dragging the unlocked supporting link preserves the absolute tracer radius.
origin=run('project(result.q[2],result.q[3])');
const tracerBaseTarget={closest(){return {dataset:{point:'1'}};}};
run('engage("select")');
$('sketch').events.pointerdown(eventFor(tracerBaseTarget,...origin));
$('sketch').events.pointermove(eventFor(tracerBaseTarget,origin[0],origin[1]-70));$('sketch').events.pointerup();
assert.ok(Math.abs(run('Math.hypot(...vector(result.q,0,2))')-80)<1e-5);
assert.ok(Math.abs(run('model.links[0].length')-200)>1);
// Malformed rope metadata is rejected without executing imported content.
reset(run('tackleExample()'));
assert.equal(run('validate({...model,cables:[{...model.cables[0],spins:{}}]})'),false);
assert.equal(run('validate({...model,cables:[{...model.cables[0],terms:[null,null]}]})'),false);
assert.equal(run('validate({...model,gears:model.gears.map((g,i)=>i?g:{...g,centerPoint:999})})'),false);

// Imported labels must remain text in generated markup.
reset(examples[0].build());
run('model.points[1].name="<img src=x onerror=alert(1)>";model.links[0].name="<script>alert(1)</script>";render()');
assert.match($("sketch").innerHTML,/&lt;img/);
assert.doesNotMatch($("sketch").innerHTML,/<img\b|<script\b/);
assert.doesNotMatch($("drive").innerHTML,/<script\b/);
assert.equal(run('validate({...model,links:[{name:"Invalid",pins:[0,9999],length:10}]})'),false);

assert.equal(run('csvCell("=1+1")'),"\"'=1+1\"");
assert.equal(run('csvCell(-12.5)'),"\"-12.5\"");
assert.equal(run('validate({...model,title:"x".repeat(201)})'),false);
const crypto=require('node:crypto');
const published=fs.readFileSync('index.html','utf8');
const scriptBody=published.match(/<script>([\s\S]*?)<\/script>/)[1];
assert.equal(scriptBody.includes('\r'),false,'inline scripts must use browser-normalized line endings');
const hash=crypto.createHash('sha256').update(scriptBody).digest('base64');
assert.ok(published.includes("script-src 'sha256-"+hash+"'"));
assert.ok(published.includes("connect-src 'none'"));

assert.equal(run('validate({...model,displayUnits:"constructor"})'),false);
assert.equal(run('validate({...model,displayUnits:"__proto__"})'),false);

});
