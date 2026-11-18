
"use strict";
const $ = id => document.getElementById(id);
const sketch = $("sketch");
const canvasSize={width:800,height:440};
function drawingArea(){
  if(typeof window.workspaceArea==="function")return window.workspaceArea();
  return {x:70,y:45,width:canvasSize.width-140,height:canvasSize.height-90};
}
const colors = ["var(--link-1,#2467ad)","var(--link-2,#16776d)","var(--link-3,#75518f)","var(--link-4,#a16830)","var(--link-5,#a34a62)","var(--link-6,#657c28)"];
const unitsPerPaperMillimetre=2.5;
const defaultPolygonStyle=Object.freeze({lineWidth:.288,linePattern:"solid",arrow:"none",headSize:2.6,headStroke:.22});
const polygonStylePresets={
  tracing:{label:"Tracing · plain",style:{...defaultPolygonStyle}},
  fine:{label:"Fine · open arrows",style:{...defaultPolygonStyle,lineWidth:.16,arrow:"open",headStroke:.14}},
  bold:{label:"Bold · filled arrows",style:{...defaultPolygonStyle,lineWidth:.5,arrow:"filled",headStroke:.3}},
  dashed:{label:"Dashed · outlined arrows",style:{...defaultPolygonStyle,lineWidth:.3,linePattern:"dashed",arrow:"outline"}},
  technical:{label:"Technical · differentiated",style:{...defaultPolygonStyle,lineWidth:.35,linePattern:"differentiated",arrow:"open"}}
};
const polygonStyle={...defaultPolygonStyle};
const toolHints = {
  mount:"Click the joint that should carry this wheel shaft.",
  select:"Drag a pin or link to move the constrained sketch. Select an item and press Delete to remove it.",
  pin:"Click the drawing to place a pin.",
  bar:"Select two pins, or click empty space to place link endpoints.",
  rail:"Select a pin to add a fixed guide or remove its slider.",
  fix:"Select a pin to toggle a fixed ground pivot.",
  attach:"Select a link, then a pin to attach rigidly to it.",
  midpoint:"Select a pin, then the link whose midpoint it should follow.",
  coincident:"Select two pins to keep them coincident.",
  horizontal:"Select a link, or select two joints, to align it horizontally during construction.",
  vertical:"Select a link, or select two joints, to align it vertically during construction.",
  collinear:"Select a link and another link or joint. A joint stays on the link’s extended line; two links share one straight line.",
  angle:"Select a link to set its construction angle to +X or another link."
};
const statusText = {
  solved:["Solved",""], empty:["Empty","Place pins and links to start the mechanism."],
  "no-drive":["Set input","Select a link or slider as the input, then solve."],
  inconsistent:["No closure","The position could not close. Check dimensions, input position and constraints, or drag pins to seed a different assembly."],
  indeterminate:["Nonunique","The input leaves free motion, or the mechanism is at a singular configuration."],
  incompatible:["Incompatible rates","The prescribed input rates cannot satisfy all constraints in this pose."]
};
const clone = x => JSON.parse(JSON.stringify(x));
const fmt = (x,n=2) => Number.isFinite(x) ? Number(x.toFixed(n)).toString() : "—";
const safe = x => String(x).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const coord = modelCoordinates;
function wrapAngle(angle) {
  const remainder=angle%360;
  const wrapped=remainder<0?remainder+360:remainder;
  return wrapped===360?0:wrapped||0;
}
const angleReadout=(angle,digits)=>wrapAngle(Number(angle.toFixed(digits)));
const labelFor = (model,link) => link.pins.map(p=>model.points[p].name).join("–");
let model = fourBarExample(), result = solveModel(model,coord(model)), view;
let displayUnits=model.displayUnits;
const unitFactor=()=>LENGTH_UNITS[displayUnits].perMM;
const toDisplay=value=>value*unitFactor();
const fromDisplay=value=>value/unitFactor();
const distanceText=(value,mmDecimals=2)=>fmt(toDisplay(value),Math.max(6,mmDecimals));
const vectorUnit=accel=>displayUnits+(accel?"/s²":"/s");
const plotViews={velocity:{zoom:1,x:0,y:0},acceleration:{zoom:1,x:0,y:0}};
let expandedPlot=null;
let gridSpacing=25,snapToGrid=true;
function snapGridPosition(position){
  if(!snapToGrid||!(gridSpacing>0)||!(view?.scale>0))return position;
  const tolerance=Math.min(gridSpacing*.08,4/view.scale);
  return position.map(value=>{
    const nearest=Math.round(value/gridSpacing)*gridSpacing;
    return Math.abs(nearest-value)<=tolerance?nearest:value;
  });
}
let history = [], redoHistory=[], selection = null, staged = null, tool = "select", dirty = false;
let constraintListOpen=true;
let multiSelection=[];
let drag = null, playing = false, frame = 0, timer = 0, notice = "", detailsOpen = false;

function snapshot(){return {model:clone(model),result,dirty,displayUnits,selection:clone(selection)};}
function remember() {
  history.push(snapshot());redoHistory=[];
  if(history.length>60)history.shift();
}
function restoreSnapshot(state){
  stop();({model,result,dirty,displayUnits,selection}=state);
  staged=null;multiSelection=[];notice="";render();
}
function undoEdit(){if(!history.length)return;finishDrag(false);redoHistory.push(snapshot());restoreSnapshot(history.pop());}
function redoEdit(){if(!redoHistory.length)return;finishDrag(false);history.push(snapshot());restoreSnapshot(redoHistory.pop());}
function refresh(refit = false) {
  if(refit) fit();
  render();
}
function stop() {
  playing=false;
  cancelAnimationFrame(frame);
}
function edit(change, run = true) {
  stop();const previous=snapshot();seedCurrent();
  const geometry=()=>JSON.stringify([model.points,model.links,model.constraints,model.gears,model.meshes,model.shafts,model.cables]);
  const beforeGeometry=geometry();
  try{
    change();
    const requestedDrive=model.drive&&previous.model.drive&&model.drive.type===previous.model.drive.type&&model.drive.id===previous.model.drive.id&&model.drive.position!==previous.model.drive.position?model.drive.position:null;
    if(geometry()!==beforeGeometry)closeEditedDrawing();
    if(requestedDrive!==null)model.drive.position=requestedDrive;
    inferInput();
    history.push(previous);redoHistory=[];if(history.length>60)history.shift();
    dirty=false;notice='';result=solveModel(model,coord(model));render();return true;
  }catch(error){
    ({model,result,dirty,displayUnits,selection}=previous);notice=error.message;render();return false;
  }
}
function solve() {
  stop();
  inferInput();
  const seed = dirty ? coord(model) : result.q;
  result=solveModel(model,seed);
  dirty=false;
  notice="";
  render();
}
function reset(next) {
  stop();
  remember();
  model=normalizedModel(next);
  if(model.drive?.type==="rotary")model.drive.position=wrapAngle(model.drive.position);
  displayUnits=next.displayUnits??displayUnits;
  for(const id of Object.keys(plotViews))resetPlotView(id);
  selection=null;multiSelection=[];
  staged=null;
  tool="select";
  dirty=true;
  result=solveModel(model,coord(model));
  dirty=false;
  notice="";
  refresh(true);
}
function scene() { return drag?.pose ?? (dirty ? coord(model) : result.q); }
function project(x,y){return [view.x+x*view.scale,view.y-y*view.scale];}
function fit() {
  const q=scene();
  if(!q.length){view={x:180,y:330,scale:1.8,reference:1.8};return;}
  const bounds=mechanismBounds(model,q);
  const xs=[bounds.xmin,bounds.xmax],ys=[bounds.ymin,bounds.ymax];
  const xlo=Math.min(...xs), xhi=Math.max(...xs), ylo=Math.min(...ys), yhi=Math.max(...ys);
  const area=drawingArea();
  const scale=Math.min(3.3,area.width/Math.max(1,xhi-xlo),area.height/Math.max(1,yhi-ylo));
  view={x:area.x+area.width/2-(xhi+xlo)*scale/2,y:area.y+area.height/2+(yhi+ylo)*scale/2,scale,reference:scale};
}
function renderViewControls() {
  const percentage=100*view.scale/view.reference;
  $("viewScale").value=Math.round(percentage);
  $("zoomIn").disabled=percentage>=1599.999;
  $("zoomOut").disabled=percentage<=10.001;
}
function zoomTo(scale, x=drawingArea().x+drawingArea().width/2, y=drawingArea().y+drawingArea().height/2) {
  scale=Math.max(view.reference*.1,Math.min(view.reference*16,scale));
  const ratio=scale/view.scale;
  view.x=x+(view.x-x)*ratio;
  view.y=y+(view.y-y)*ratio;
  view.scale=scale;
  renderSketch();
  renderViewControls();
}
function boardPosition(event,svg=sketch) {
  const pt=svg.createSVGPoint();
  pt.x=event.clientX;
  pt.y=event.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}
function modelPosition(event) {
  const pt=boardPosition(event);
  return [(pt.x-view.x)/view.scale,(view.y-pt.y)/view.scale];
}
const line = (a,b,attrs="") => '<line x1="'+a[0]+'" y1="'+a[1]+'" x2="'+b[0]+'" y2="'+b[1]+'" '+attrs+'/>';
const txt = (x,y,value,attrs="") => '<text x="'+x+'" y="'+y+'" '+attrs+'>'+safe(value)+'</text>';
function circle(x,y,r,attrs=""){return '<circle cx="'+x+'" cy="'+y+'" r="'+r+'" '+attrs+'/>';}

function renderSketch() {
  const {width,height}=canvasSize;
  const q=scene();
  const pos = model.points.map((_,i)=>project(q[2*i],q[2*i+1]));
  const nominal=gridSpacing*view.scale;
  const step=nominal*Math.max(1,Math.ceil(9/nominal));
  const gX=((view.x%step)+step)%step,gY=((view.y%step)+step)%step;
  let svg='<defs><pattern id="grid" x="'+gX+'" y="'+gY+'" width="'+step+'" height="'+step+'" patternUnits="userSpaceOnUse"><path d="M '+step+' 0 H 0 V '+step+'" fill="none" stroke="#e3e9ef" stroke-width="1"/></pattern></defs><rect width="'+width+'" height="'+height+'" fill="url(#grid)"/>';
  svg+=line([0,view.y],[width,view.y],'stroke="#b3c2d2"')+line([view.x,0],[view.x,height],'stroke="#b3c2d2"');
  const grounded = model.points.map((p,i)=>p.fixed?pos[i]:null).filter(Boolean);
  if(grounded.length===2) svg+=line(...grounded,'stroke="#627f9d" stroke-width="2" stroke-dasharray="5 6"');
  for(const [i,p] of model.points.entries()){
    if(!p.rail) continue;
    const a=p.rail.angle*RAD, base=project(p.rail.x,p.rail.y);
    const tangent=[Math.cos(a),-Math.sin(a)], n=[-tangent[1]*7,tangent[0]*7];
    for (const sign of [-1,1]) {
      const point = k=>base.map((x,j)=>x+k*tangent[j]+sign*n[j]);
      svg+=line(point(-1500),point(1500),'stroke="#5b7797" stroke-width="1.4" stroke-dasharray="7 5"');
    }
  }
  svg+=gearDrawing(drag?.previewModel??model,q,(x,y)=>project(x,y),view.scale);
  for(const [i,l] of model.links.entries()){
    const [a,b,...rest]=l.pins;
    const color=colors[i%colors.length];
    const active=objectSelected("link",i) || staged?.type==="link"&&staged.id===i;
    const attrs='stroke="'+color+'" stroke-linecap="round" stroke-width="'+(active?9:6)+'"';
    const hit='data-link="'+i+'" style="cursor:pointer"';
    if(active)svg+=line(pos[a],pos[b],'stroke="#f5ac35" stroke-width="17" stroke-linecap="round" opacity=".55"');
    svg+=line(pos[a],pos[b],attrs);
    svg+=line(pos[a],pos[b],hit+' stroke="transparent" stroke-width="22"');
    for(const p of rest) {
      svg+=line(pos[a],pos[p],attrs);
      svg+=line(pos[a],pos[p],hit+' stroke="transparent" stroke-width="18"');
      const mid=[(pos[a][0]+pos[p][0])/2,(pos[a][1]+pos[p][1])/2];
      svg+=txt(mid[0]+10,mid[1]-10,distanceText(magnitude(...vector(q,a,p)))+' '+displayUnits,'fill="'+color+'" font-size="11" paint-order="stroke" stroke="white" stroke-width="4" '+hit);

    }
    const [x,y]=pos[a], [u,v]=pos[b], d=Math.hypot(u-x,v-y)||1;
    const dx=(v-y)/d*25,dy=(x-u)/d*25;
    const p1=[x+dx,y+dy],p2=[u+dx,v+dy];
    svg+=line(pos[a],p1,'stroke="'+color+'" opacity=".45"')+line(pos[b],p2,'stroke="'+color+'" opacity=".45"');
    svg+=line(p1,p2,'stroke="'+color+'" opacity=".65"');
    svg+=line(p1.map((t,j)=>t-(j?dy:dx)*.15),p1.map((t,j)=>t+(j?dy:dx)*.15),'stroke="'+color+'"');
    svg+=line(p2.map((t,j)=>t-(j?dy:dx)*.15),p2.map((t,j)=>t+(j?dy:dx)*.15),'stroke="'+color+'"');
    const mx=(p1[0]+p2[0])/2,my=(p1[1]+p2[1])/2;
    const display=distanceText(drag?.pose&&l.lengthLocked===false?magnitude(...vector(q,a,b)):l.length)+" "+displayUnits, width=display.length*7+10;
    svg+='<rect x="'+(mx-width/2)+'" y="'+(my-9)+'" width="'+width+'" height="18" rx="4" fill="#ffffff" data-dimension="'+i+'" '+hit+'/>';
    if(l.lengthLocked!==false)svg+='<g transform="translate('+(mx-width/2-12)+' '+(my-5)+')" fill="none" stroke="'+color+'" stroke-width="1.3" pointer-events="none"><rect x="0" y="4" width="8" height="7" rx="1"/><path d="M2 4V2a2 2 0 0 1 4 0v2"/></g>';
    svg+=txt(mx,my+4,display,'text-anchor="middle" fill="'+color+'" font-size="12" data-dimension="'+i+'" '+hit);
  }
  for(const [i,p] of model.points.entries()){
    const [x,y]=pos[i], active=objectSelected("point",i)||(staged?.type==="point"&&staged.id===i);
    const drive = model.drive;
    const isInput = drive?.type==="linear"?drive.id===i:drive?.type==="rotary" && model.links[drive.id]?.pins[0]===i;
    const midpoint = model.constraints.some(c=>c.type==="midpoint"&&c.p===i);
    if (p.fixed) svg+='<path d="M '+(x-10)+' '+(y+15)+' L '+x+' '+(y+2)+' L '+(x+10)+' '+(y+15)+' Z" stroke="#7fa8d1" fill="#284560"/>';
    if (p.rail) svg+='<rect x="'+(x-12)+'" y="'+(y-8)+'" width="24" height="16" rx="2" fill="#f1a653" transform="rotate('+(-p.rail.angle)+' '+x+' '+y+')"/>';
    if (active || isInput) svg+=circle(x,y,active?12:15,'fill="none" stroke="'+(active?"#e28b12":"#67a6ff")+'" stroke-width="2.8" stroke-dasharray="'+(active?"0":"3 3")+'"');
    svg+=circle(x,y,midpoint?4.5:6.2,'fill="'+(p.fixed?"#a6beda":"#ffffff")+'" stroke="#3e5d7d" stroke-width="2"');
    svg+=txt(x+10,y-10,p.name,'fill="#1c2d42" font-weight="700" font-size="14" paint-order="stroke" stroke="#f9fbfd" stroke-width="3"');
    svg+=circle(x,y,13,'fill="transparent" data-point="'+i+'" style="cursor:pointer"');
  }
  const enabled=Object.fromEntries(positionVectorTypes.map(type=>[type.key,$("sketch"+type.id).checked]));
  const showing=Object.values(enabled).some(Boolean), ready=analysisReady()&&!drag?.pose;
  $("sketchVectorStatus").textContent=showing?(ready?"Solid v · dashed a · separate scales":"Solve the current pose to show vectors."):"";
  if(showing&&ready){
    const tracers=gearTracerData(model,result);
    const values={
      v:pos.map((_,i)=>result.v.slice(2*i,2*i+2)),
      a:pos.map((_,i)=>result.a.slice(2*i,2*i+2))
    };
    values.v.push(...tracers.map(t=>t.velocity));
    values.a.push(...tracers.map(t=>t.acceleration));
    const locations=[...pos,...tracers.map(t=>project(...t.position))];
    svg+=positionVectorMarkup(locations,{values,enabled,names:[...model.points.map(p=>p.name),...tracers.map(t=>t.name)],conversion:unitFactor(),unit:displayUnits,width,height,light:true,legendX:Math.min(110,width*.25),legendY:Math.min(132,height*.3)});
  }
  const area=drawingArea(),rulerX=area.x+area.width,rulerY=area.y+area.height+16;
  // Coordinate directions use actual arrow geometry rather than font glyphs.
  svg+=line([78,46],[102,46],'stroke="#788c9e"')+line([78,46],[78,22],'stroke="#788c9e"');
  svg+='<path d="m98 42 4 4-4 4m-24-24 4-4 4 4" fill="none" stroke="#788c9e"/>';
  svg+=txt(108,50,"x",'fill="#788c9e" font-size="11"')+txt(74,16,"y",'fill="#788c9e" font-size="11"');
  const lengthAtScale=75/view.scale;
  const power=10**Math.floor(Math.log10(lengthAtScale));
  const normalized=lengthAtScale/power;
  const tick=(normalized>=5?5:normalized>=2?2:1)*power;
  svg+=line([rulerX-tick*view.scale,rulerY],[rulerX,rulerY],'stroke="#596f87" stroke-width="2"');
  svg+=txt(rulerX,rulerY+17,Number(toDisplay(tick).toPrecision(2))+" "+displayUnits,'text-anchor="end" fill="#596f87" font-size="11"');
  if(drag?.mode==='box'){
    const a=drag.start,b=drag.end;
    svg+='<rect data-selection-box="true" x="'+Math.min(a.x,b.x)+'" y="'+Math.min(a.y,b.y)+'" width="'+Math.abs(a.x-b.x)+'" height="'+Math.abs(a.y-b.y)+'" fill="#387fbc" fill-opacity=".10" stroke="#387fbc" stroke-width="1" stroke-dasharray="4 3" pointer-events="none"/>';
  }
  sketch.innerHTML='<g font-family="ui-monospace,monospace">'+svg+'</g>';
}


const modes = [
  ["midpoint","Midpoint"],["coincident","Coincident"],["horizontal","Horizontal"],["vertical","Vertical"],["angle","Angle"],["collinear","Collinear"]
];
function numeric(label,id,value,attrs="",digits=5) {
  return '<label>'+label+'<input type="number" id="'+id+'" value="'+fmt(value,digits)+'" step="any" '+attrs+'></label>';
}
function numericDistance(label,id,value,attrs="required",units=displayUnits) {
  return numeric(label+" ("+units+")",id,toDisplay(value),attrs,9);
}
function onNumber(id,change,run=false,convert=x=>x) {
  const input=$(id);
  if(!input) return;
  input.addEventListener("change",()=>{
    if(!input.checkValidity()||!Number.isFinite(input.valueAsNumber)){input.reportValidity();render();return;}
    edit(()=>change(convert(input.valueAsNumber)),run);
  });
}
function renderDrive() {
  const d=model.drive;
  const choice=(key,label)=>'<option value="'+key+'" '+(d&&d.type+"/"+d.id===key?"selected":"")+'>'+safe(label)+'</option>';
  const options=model.gears.map((g,i)=>choice("gear/"+i,g.name+(g.kind==='pulley'?" · pulley":" · gear"))).join("")+model.links.map((l,i)=>choice("rotary/"+i,l.name+" · "+labelFor(model,l))).join("")+
    model.points.map((p,i)=>p.rail?choice("linear/"+i,"Slider "+p.name):"").join("");
  const note=notice||(!dirty?statusText[result.status][1]:"Geometry changed. Solve to update the analysis.");
  const driveFields=!d?"":d.type!=="linear"
    ? numeric("Angle (°)","inputPos",angleReadout(d.position,5),"required")+numeric("ω (rad/s)","inputSpeed",d.speed,"required")+numeric("α (rad/s²)","inputAccel",d.accel,"required")
    : numericDistance("Travel","inputPos",d.position)+numericDistance("v","inputSpeed",d.speed,"required",vectorUnit(false))+numericDistance("a","inputAccel",d.accel,"required",vectorUnit(true));
  $("drive").innerHTML='<label>Input<select id="input"><option value="">Select an input</option>'+options+'</select></label>'+
    (d?'<div class="fields three">'+driveFields+'</div>':"")+
    '<label class="inline"><input id="autoInput" type="checkbox" '+(model.inputMode!=="manual"?"checked":"")+'> Choose input automatically</label>'+
    (note?'<p class="notice">'+safe(note)+'</p>':"");
  $("input").onchange=event=>{
    const [type,key]=event.currentTarget.value.split("/");
    const id=Number(key), q=scene();
    edit(()=>{
      model.inputMode="manual";
      if(!type){model.drive=null;return;}
      let position;
      if(type==="gear"){position=q[2*model.points.length+id]/RAD;}else if(type==="rotary"){
        const [x,y]=vector(q,...model.links[id].pins.slice(0,2));
        position=wrapAngle(Math.atan2(y,x)/RAD);
      }else{
        const {x,y,angle}=model.points[id].rail;
        position=(q[2*id]-x)*Math.cos(angle*RAD)+(q[2*id+1]-y)*Math.sin(angle*RAD);
      }
      model.drive={type,id,position,speed:type==="linear"?40:2,accel:0};
    },true);
  };
  $("autoInput").onchange=()=>edit(()=>model.inputMode=$("autoInput").checked?"auto":"manual",true);
  const convert=d?.type==="linear"?fromDisplay:undefined;
  const gearInput=x=>model.drive.position-wrapAngle(model.drive.position)+wrapAngle(x);
  onNumber("inputPos",x=>model.drive.position=x,true,d?.type==="rotary"?wrapAngle:d?.type==="gear"?gearInput:convert);
  onNumber("inputSpeed",x=>model.drive.speed=x,true,convert);
  onNumber("inputAccel",x=>model.drive.accel=x,true,convert);
  const good=!dirty&&result.status==="solved";
  $("status").className="badge"+(good?" good":"");
  $("status").textContent=dirty?"Edited":statusText[result.status][0];
}
function deleteLink(id) {
  model.shafts=model.shafts.filter(s=>s.link!==id);
  for(const s of model.shafts)if(s.link>id)s.link--;
  model.links.splice(id,1);
  model.constraints=model.constraints.filter(c=>c.link!==id&&c.referenceLink!==id);
  for(const c of model.constraints){if(c.link>id)c.link--;if(c.referenceLink>id)c.referenceLink--;}
  if(model.drive?.type==="rotary"){
    if(model.drive.id===id)model.drive=null;
    else if(model.drive.id>id)model.drive.id--;
  }
}
function deletePoint(id) {
  for(const g of model.gears){
    if(g.centerPoint===id){g.x=model.points[id].x;g.y=model.points[id].y;delete g.centerPoint;delete g.freePoint;}
    else if(g.centerPoint>id)g.centerPoint--;
  }
  model.shafts=model.shafts.filter(s=>s.pivot!==id);
  for(const s of model.shafts)if(s.pivot>id)s.pivot--;

  model.cables=model.cables.filter(c=>!c.terms.some(t=>t.point===id)&&!(c.spins??[]).some(s=>s.point===id));
  for(const c of model.cables){for(const t of c.terms)if(t.point>id)t.point--;for(const s of c.spins??[])if(s.point>id)s.point--;if(c.movingPoint>id)c.movingPoint--;if(c.loadPoint>id)c.loadPoint--;}
  for(let i=model.links.length-1;i>=0;i--) {
    if(model.links[i].pins.includes(id))deleteLink(i);
  }
  model.points.splice(id,1);
  for(const l of model.links) l.pins=l.pins.map(p=>p>id?p-1:p);
  model.constraints=model.constraints.filter(c=>c.p!==id&&c.b!==id);
  for(const c of model.constraints) {
    if(c.p>id)c.p--;
    if(c.b>id)c.b--;
  }
  if(model.drive?.type==="linear"){
    if(model.drive.id===id)model.drive=null;
    else if(model.drive.id>id)model.drive.id--;
  }
}
function deleteSelection() {
  const picked=multiSelection.length?multiSelection:selection?[selection]:[];
  if(!picked.length)return;
  const objects=picked.map(item=>({...item,object:(item.type==='gear'?model.gears:item.type==='link'?model.links:model.points)[item.id]}));
  edit(()=>{
    for(const type of ['gear','link','point'])for(const item of objects.filter(item=>item.type===type)){
      const list=type==='gear'?model.gears:type==='link'?model.links:model.points,id=list.indexOf(item.object);
      if(id<0)continue;if(type==='gear')deleteGear(id);else if(type==='link')deleteLink(id);else deletePoint(id);
    }
    selection=null;multiSelection=[];staged=null;
  });
}
function renderInspector() {
  const q=scene(), id=selection?.id;
  const p=selection?.type==="point"&&model.points[id];
  const l=selection?.type==="link"&&model.links[id];
  let panel='<p class="description">Select a pin, link or dimension in the sketch. Use the constraint menu to add geometric relations.</p>';
  if(p){
    panel='<h3>'+safe(p.name)+' · '+(p.fixed?"Ground pin":p.rail?"Slider":"Pin")+'</h3>'+
      '<div class="fields">'+numericDistance("X","pointX",q[2*id])+numericDistance("Y","pointY",q[2*id+1])+'</div>'+
      '<label class="inline"><input id="fixed" type="checkbox" '+(p.fixed?"checked":"")+'> Fixed ground pin</label>'+
      '<label class="inline"><input id="railToggle" type="checkbox" '+(p.rail?"checked":"")+'> Slider on fixed guide</label>'+
      (p.rail?'<div class="fields three">'+numericDistance("Guide X","railX",p.rail.x)+numericDistance("Guide Y","railY",p.rail.y)+numeric("Guide angle (°)","railAngle",p.rail.angle,"required")+'</div>':"")+
      '<button id="removeSelection" class="remove">Delete pin and its links</button>';
  }else if(l){
    panel='<h3>'+safe(l.name)+' · '+safe(labelFor(model,l))+'</h3>'+
      '<div class="fields">'+numericDistance("Length","length",l.length,'required min="'+toDisplay(0.001)+'"')+'</div>'+
      '<label class="inline"><input id="lengthLocked" type="checkbox" '+(l.lengthLocked!==false?"checked":"")+'> Lock length while editing</label>'+
      '<p class="description">Length is measured between '+safe(model.points[l.pins[0]].name)+' and '+safe(model.points[l.pins[1]].name)+'.</p>'+
      tracerFields(l)+'<button id="removeSelection" class="remove">Delete link</button>';
  }
  const rows = model.points.map((item,i)=>'<button data-pick="point/'+i+'"><b>'+safe(item.name)+'</b><span>'+(item.fixed?"Ground":item.rail?"Slider":"Pin")+'</span></button>')
    .concat(model.links.map((item,i)=>'<button data-pick="link/'+i+'"><b>'+safe(item.name)+'</b><span>'+safe(labelFor(model,item))+'</span></button>'))
    .concat(model.gears.map((item,i)=>'<button data-pick="gear/'+i+'"><b>'+safe(item.name)+'</b><span>'+(item.kind==='pulley'?'Pulley R '+distanceText(item.radius)+' '+displayUnits:item.teeth+'T gear')+'</span></button>'));
  const relations=model.constraints.map((c,i)=>{
    const label=c.type==='collinear'?model.links[c.link].name+' / '+(Number.isInteger(c.referenceLink)?model.links[c.referenceLink].name:model.points[c.p].name):c.type==='angle'?model.links[c.link].name+' / '+(Number.isInteger(c.referenceLink)?model.links[c.referenceLink].name:'+X')+' = '+fmt(c.angle,3)+'°':
      model.points[c.p].name+' / '+(c.type==='midpoint'?labelFor(model,model.links[c.link]):model.points[c.b].name);
    return '<div class="constraintRow"><label class="inline"><input type="checkbox" data-constraint-physical="'+i+'" '+(constraintAffectsMotion(c)?'checked':'')+'> During simulation</label><button data-remove="'+i+'" title="Remove constraint"><b>'+safe(new Map(modes).get(c.type))+'</b><span>'+safe(label)+' ×</span></button></div>';
  });
  $("inspector").innerHTML=panel+(relations.length?'<details id="constraintList" class="sideDetails" '+(constraintListOpen?"open":"")+'><summary>Constraints</summary><div class="list">'+relations.join("")+'</div></details>':"")+
    '<details id="objects" class="sideDetails" '+(detailsOpen?"open":"")+'><summary>Sketch objects ('+rows.length+')</summary><div class="list">'+rows.join("")+'</div></details>';
  $("inspector").querySelectorAll("[data-pick]").forEach(node=>node.setAttribute("aria-pressed",String(node.dataset.pick===selection?.type+"/"+selection?.id)));
  if($("constraintList"))$("constraintList").ontoggle=event=>constraintListOpen=event.target.open;
  $("objects").ontoggle=event=>detailsOpen=event.target.open;
  $("inspector").querySelectorAll("[data-pick]").forEach(node=>node.onclick=()=>{
    const [type,key]=node.dataset.pick.split("/");
    pick({type,id:Number(key)},null);
  });
  $("inspector").querySelectorAll("[data-remove]").forEach(node=>node.onclick=()=>edit(()=>model.constraints.splice(Number(node.dataset.remove),1)));
  $("inspector").querySelectorAll("[data-constraint-physical]").forEach(node=>node.onchange=()=>edit(()=>model.constraints[Number(node.dataset.constraintPhysical)].physical=node.checked,true));
  if(p) {
    onNumber("pointX",x=>p.x=x,false,fromDisplay);
    onNumber("pointY",y=>p.y=y,false,fromDisplay);
    $("fixed").onchange=()=>toggleFixed(id);
    $("railToggle").onchange=()=>toggleRail(id);
    onNumber("railX",x=>p.rail.x=x,false,fromDisplay);
    onNumber("railY",y=>p.rail.y=y,false,fromDisplay);
    onNumber("railAngle",x=>p.rail.angle=x);
  }
  if(l){
    bindTracerFields(l);
    onNumber("length",x=>{l.length=x;l.lengthLocked=true;},true,fromDisplay);
    $("lengthLocked").onchange=()=>edit(()=>l.lengthLocked=$("lengthLocked").checked,true);
  }
  if($("removeSelection")) $("removeSelection").onclick=deleteSelection;
}

function polygonEdges() {
  const edges=[];
  for(const [id,l] of model.links.entries()) {
    for(const b of l.pins.slice(1)) edges.push({a:l.pins[0],b,id});
  }
  for(const c of model.constraints) if(constraintAffectsMotion(c)&&c.type==="midpoint") edges.push({a:model.links[c.link].pins[0],b:c.p,id:c.link});
  return edges;
}
function resetPlotView(id) {
  Object.assign(plotViews[id],{zoom:1,x:0,y:0});
}
function analysisReady() {
  return !dirty&&result.status==="solved";
}
function redrawPlot(id) {
  const accel=id==="acceleration";
  polygon(id,analysisReady()?(accel?result.a:result.v):null,accel);
}
function zoomPlot(id,factor,x=240,y=128) {
  const view=plotViews[id];
  const zoom=Math.max(.25,Math.min(32,view.zoom*factor));
  const ratio=zoom/view.zoom;
  view.x=x-240+(view.x-x+240)*ratio;
  view.y=y-128+(view.y-y+128)*ratio;
  view.zoom=zoom;
  redrawPlot(id);
}
function renderPlotLayout() {
  $("plots").classList.toggle("expanded",Boolean(expandedPlot));
  for(const id of Object.keys(plotViews)){
    $(id+"Card").hidden=Boolean(expandedPlot&&expandedPlot!==id);
    $(id+"Expand").textContent=expandedPlot===id?"Side by side":"Expand";
    $(id+"Expand").setAttribute("aria-pressed",String(expandedPlot===id));
  }
}
function polygonLabels(groups,areaWidth,areaHeight,interaction=()=> "") {
  const placed=[];
  return groups.map(group=>{
    const {screen:[x,y],names}=group;
    if(x<0||x>areaWidth||y<0||y>areaHeight)return "";
    const label=names.join(" / ");
    const width=label.length*7.25, height=15;
    const overlap=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
    const candidates=[[8,-19],[8,5],[-width-8,-19],[-width-8,5],[8,-36],[8,22],[-width-8,-36],[-width-8,22]];
    const boxes=candidates.map(([dx,dy])=>({
      x:Math.max(3,Math.min(areaWidth-3-width,x+dx)),y:Math.max(3,Math.min(areaHeight-22,y+dy)),width,height
    }));
    const box=boxes.find(b=>placed.every(a=>!overlap(a,b))&&groups.every(g=>{
      const [u,v]=g.screen;
      return !overlap(b,{x:u-4,y:v-4,width:8,height:8});
    }))??boxes.find(b=>placed.every(a=>!overlap(a,b)))??boxes[0];
    placed.push(box);
    const endpoint=[Math.max(box.x,Math.min(box.x+width,x)),Math.max(box.y,Math.min(box.y+height,y))];
    const attrs=interaction(group);
    return '<g'+attrs+'>'+line([x,y],endpoint,'stroke="#96a9bf"')+
      (attrs?circle(x,y,6,'fill="transparent"'):"")+
      circle(x,y,1.6,'fill="#1e364f"')+
      txt(box.x,box.y+11,label,'font-size="12" font-weight="700" fill="#253c58" stroke="#f7faff" stroke-width="3" paint-order="stroke"')+'</g>';
  }).join("");
}
function polygon(id, values, accel=false) {
  const svg=$(id);
  const view=plotViews[id];
  $(id+"Unit").textContent=vectorUnit(accel);
  $(id+"Zoom").textContent=Math.round(view.zoom*100)+"%";
  $(id+"In").disabled=!values||view.zoom>=32;
  $(id+"Out").disabled=!values||view.zoom<=.25;
  $(id+"Fit").disabled=!values;
  if(!values) {
    svg.innerHTML=txt(240,139,"Solve the mechanism to draw this polygon.",'text-anchor="middle" fill="#536981" font-size="13"');
    updatePolygonExplanation(id,[],n=>distanceText(n,4),vectorUnit(accel));
    updatePolygonConstruction(id,[],n=>distanceText(n,4),vectorUnit(accel));
    return;
  }
  const parts=[];
  svg.innerHTML=polygonMarkup(id,polygonGeometry(values,accel),accel,{...view,parts});
  updatePolygonExplanation(id,parts,n=>distanceText(n,4),vectorUnit(accel));
  updatePolygonConstruction(id,parts,n=>distanceText(n,4),vectorUnit(accel));
}
function drawingBounds(extent) {
  const xs=extent.map(p=>p[0]),ys=extent.map(p=>p[1]);
  const xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
  return {xmin,xmax,ymin,ymax,width:xmax-xmin,height:ymax-ymin};
}
function polygonGeometry(values,accel) {
  return buildGeneralPolygon(model,result,accel);
}
function polygonSegment(start,end,colour,absolute,style,kind="rel") {
  const stroke=style.lineWidth*unitsPerPaperMillimetre*(absolute?2/3:1);
  const dash=style.linePattern==="dashed"?"6 4":style.linePattern==="differentiated"?(absolute?"2 3":kind==="norm"?"7 3":kind==="tan"?"7 3 2 3":""):"";
  const shaft='stroke="'+colour+'" stroke-width="'+stroke+'"'+(dash?' stroke-dasharray="'+dash+'"':"");
  if(style.arrow==="none")return line(start,end,shaft);
  const dx=end[0]-start[0], dy=end[1]-start[1], span=magnitude(dx,dy);
  const size=Math.min(style.headSize*unitsPerPaperMillimetre,span*.48);
  const outline=Math.min(style.headStroke*unitsPerPaperMillimetre,size*.44);
  if(size<.45)return line(start,end,shaft);
  const ux=dx/span,uy=dy/span;
  const base=[end[0]-ux*size,end[1]-uy*size];
  const spread=size*.42;
  const left=[base[0]-uy*spread,base[1]+ux*spread];
  const right=[base[0]+uy*spread,base[1]-ux*spread];
  const open=style.arrow==="open";
  const fill=style.arrow==="filled"?colour:"none";
  return line(start,open?end:base,shaft)+
    '<path data-arrowhead="'+style.arrow+'" d="M '+left.join(" ")+' L '+end.join(" ")+' L '+right.join(" ")+(open?"":" Z")+
    '" fill="'+fill+'" stroke="'+colour+'" stroke-width="'+outline+'" stroke-linejoin="round"/>';
}

function polygonMarkup(id,geometry,accel,view) {
  const {points,pole,edges,normalParts,bounds,names=model.points.map(p=>p.name),guides=[],pinRoles=[],relativeEdges=edges,verticalGuide=false}=geometry;
  const {xmin,xmax,ymin,ymax,width,height}=bounds;
  const {width:areaWidth=480,height:areaHeight=270,x=0,y=0,zoom=1,paper=false}=view;
  const format=view.format??(n=>distanceText(n,4)), unit=view.unit??vectorUnit(accel);
  const unitFactorForPlot=view.unitFactor??unitFactor();
  const style=view.style??polygonStyle;
  const span=Math.max(width,height);
  const scale=view.scale??zoom*Math.min(345/Math.max(width,1e-12),164/Math.max(height,1e-12));
  const map=([u,v])=>[areaWidth/2+x+(u-(xmin+xmax)/2)*scale,areaHeight/2-7+y-(v-(ymin+ymax)/2)*scale];
  const origin=map(pole);
  const parts=view.parts;
  const register=part=>{
    if(!parts)return "";
    if(!parts.some(p=>p.id===part.id))parts.push(part);
    return ' data-polygon-part="'+safe(part.id)+'"';
  };
  const hit=' class="polygonHit" stroke="transparent" stroke-width="13"';
  const group=(attrs,markup)=>attrs?'<g'+attrs+'>'+markup+'</g>':markup;
  const axisParts=[
    {id:"axis-x",label:"Horizontal axis",text:"Positive x points right. A point on this axis has zero vertical component."},
    {id:"axis-y",label:"Vertical axis",text:"Positive y points up. A point on this axis has zero horizontal component."+
      (verticalGuide?" This axis also acts as the construction line for E because its guide is vertical.":"")}
  ];
  register({id:"pole",category:"Reading the drawing",label:"Pole O",text:"The common tail of the absolute vectors. Pins with zero "+
    (accel?"acceleration":"velocity")+" at this instant plot at O.",value:pole,coordinate:true});
  if(!paper)register({id:"grid",category:"Reading the drawing",label:"Background grid",text:"Use the grid to compare alignment and direction. The scale bar gives the length-to-value conversion."});
  const palette={abs:"#8d9bb3",rel:"#2462c0",norm:"#c27526",tan:"#167d6e"};
  let content='<defs><pattern id="'+id+'-grid" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0V22" fill="none" stroke="#e4edf8"/></pattern>';
  content+='</defs>';
  if(!paper)content+='<rect width="'+areaWidth+'" height="'+areaHeight+'" fill="url(#'+id+'-grid)"/>';
  const guideStroke=style.lineWidth*unitsPerPaperMillimetre*.9;
  const axis='stroke="#cbd9eb" stroke-width="'+guideStroke+'"';
  const ends=[[[18,origin[1]],[areaWidth-18,origin[1]]],[[origin[0],15],[origin[0],areaHeight-30]]];
  for(const [i,end] of ends.entries()){
    const a=register({...axisParts[i],category:"Reading the drawing"});
    content+=group(a,(a?line(...end,hit):"")+line(...end,axis));
  }
  for(const [i,{at,dir,edge,label:guideLabel,description}] of (view.showGuides===false?[]:guides).entries()){
    const [u,v]=map(at);
    const k=Math.hypot(areaWidth,areaHeight)/(magnitude(...dir)||1);
    const link=edge?names[edge.a]+names[edge.b]:"the link";
    const a=register({id:"guide-"+i,category:"Construction lines",label:guideLabel??"Dashed guide · "+link,
      text:description??(accel?"Extend the tangent direction through the normal tip. This line is perpendicular to "+link+". Its intersection locates the endpoint.":
        "Extend the direction perpendicular to "+link+". Its intersection with the other construction line locates the endpoint."),
      equation:edge?"Construction direction ∥ J r("+link+")":undefined});
    const end=[[u-k*dir[0],v+k*dir[1]],[u+k*dir[0],v-k*dir[1]]];
    content+=group(a,(a?line(...end,hit):"")+line(...end,'stroke="#7c8a99" stroke-width="'+guideStroke+'" stroke-dasharray="4 3"'));
  }
  const segment=(a,b,k,label,part)=>{
    const attrs=part?register(part):"";
    const p=map(a),q=map(b);
    if(magnitude(q[0]-p[0],q[1]-p[1])<.02)return "";
    const components=format(b[0]-a[0])+", "+format(b[1]-a[1]);
    return '<g'+attrs+'><title>'+safe(label+" ("+components+") "+unit)+'</title>'+
      (attrs?line(p,q,hit):"")+
      polygonSegment(p,q,palette[k],k==="abs",style,k)+'</g>';
  };
  const explain=(id,type,a,b,from,to,role)=>parts?explainVector(id,type,a,b,[to[0]-from[0],to[1]-from[1]],accel,role):null;
  points.forEach((p,i)=>content+=segment(pole,p,"abs","Pole → "+names[i],explain("abs-"+i,"abs","O",names[i],pole,p,pinRoles[i])));
  const edgeLabel=e=>names[e.a]+" → "+names[e.b];
  const edgePart=(prefix,e,from,to)=>{
    if(parts&&e.gearPoint)return {
      id:prefix+"-"+e.id+"-"+e.a+"-"+e.b,category:"Acceleration components",
      label:e.gearPoint+" · "+(prefix==="norm"?"Normal":"Tangential"),
      text:prefix==="norm"?"This pitch-circle material point has inward normal acceleration relative to its wheel centre. Start this component at the centre acceleration.":"The tangent from the normal tip to the material point acceleration follows the wheel angular acceleration.",
      equation:prefix==="norm"?"aₙ = −ω²r (r from wheel centre to material point)":"aₜ = α J r",
      value:[to[0]-from[0],to[1]-from[1]]
    };
    return explain(prefix+"-"+e.id+"-"+e.a+"-"+e.b,prefix,names[e.a],names[e.b],from,to);
  };
  if(parts)relativeEdges.forEach(e=>register(edgePart("rel",e,points[e.a],points[e.b])));
  edges.forEach(e=>content+=segment(points[e.a],points[e.b],"rel",edgeLabel(e),edgePart("rel",e,points[e.a],points[e.b])));
  for(const e of (view.showComponents===false?[]:normalParts)) {
    content+=segment(e.from??points[e.a],e.tip,"norm","Normal "+edgeLabel(e),edgePart("norm",e,e.from??points[e.a],e.tip))+
      segment(e.tip,points[e.b],"tan","Tangential "+edgeLabel(e),edgePart("tan",e,e.tip,points[e.b]));
    const [x,y]=map(e.tip);
    const attrs=register({id:"tip-"+e.id+"-"+e.a+"-"+e.b,category:"Construction points",label:(e.label??"Normal tip")+" · "+edgeLabel(e),
      text:"This is the end of the normal component and the start of the tangential component. It is a construction point in the acceleration diagram.",
      equation:e.gearPoint?"Normal tip = a(centre) − ω²r": "Normal tip = a("+names[e.a]+") − ω² r("+names[e.a]+names[e.b]+")",value:e.tip,coordinate:true});
    if(magnitude(x-map(points[e.a])[0],y-map(points[e.a])[1])>4)
      content+=group(attrs,(attrs?circle(x,y,6,'fill="transparent"'):"")+circle(x,y,1.4,'fill="#c27526"'));
  }
  const groups=[{point:pole,screen:origin,names:["Pole"],ids:["pole"]}];
  const coincideTolerance=Math.max(1e-9,span*1e-10);
  const markers=[...points.map((point,i)=>({point,name:names[i],id:"abs-"+i})),
    ...(view.showComponents===false?[]:normalParts).filter(e=>e.label).map(e=>({point:e.tip,name:e.label,id:"tip-"+e.id+"-"+e.a+"-"+e.b}))];
  markers.forEach(({point:p,name,id})=>{
    const xy=map(p);
    const group=groups.find(g=>magnitude(g.point[0]-p[0],g.point[1]-p[1])<coincideTolerance);
    if(group){group.names.push(name);group.ids.push(id);}
    else groups.push({point:p,screen:xy,names:[name],ids:[id]});
  });
  if(view.showLabels!==false)content+=polygonLabels(groups,areaWidth,areaHeight,g=>{
    if(!parts)return "";
    if(g.ids.length===1)return ' data-polygon-part="'+safe(g.ids[0])+'"';
    return register({id:"coincident-"+g.ids.join("-"),category:"Construction points",label:g.names.join(" / "),
      text:"These labels share the same vector endpoint in this pose. Choose an individual label in the menu to see its role.",value:g.point,coordinate:true})+
      ' data-polygon-members="'+safe(g.ids.join(" "))+'"';
  });
  const suggested=65/scale*unitFactorForPlot;
  const power=10**Math.floor(Math.log10(suggested));
  const tick=(suggested/power>=5?5:suggested/power>=2?2:1)*power;
  if(span>1e-9&&view.showLabels!==false){
    const end=areaWidth-29, start=end-scale*tick/unitFactorForPlot;
    const scaleLabel=Number(tick.toPrecision(2))+" "+unit;
    const a=register({id:"scale",category:"Reading the drawing",label:"Scale bar · "+scaleLabel,
      text:"A segment the same length as this bar represents "+scaleLabel+". Use this ratio to turn drawn lengths into vector magnitudes."});
    const endPoints=[[start,areaHeight-22],[end,areaHeight-22]];
    content+=group(a,(a?line(...endPoints,hit):"")+line(...endPoints,'stroke="#4e6987" stroke-width="2"')+
      txt(end,areaHeight-8,scaleLabel,'text-anchor="end" font-size="11" fill="#425b76"'));
  }
  return '<g font-family="ui-monospace,monospace">'+content+'</g>';
}
function dataRows() {
  const joints=model.points.map((p,i)=>{
    const {q,v,a}=result,k=2*i;
    return [p.name,...[q[k],q[k+1],v[k],v[k+1],magnitude(v[k],v[k+1]),a[k],a[k+1],magnitude(a[k],a[k+1])].map(toDisplay)];
  });
  const links=model.links.map(l=>{
    const r=angular(l,result);
    return [l.name+" ("+labelFor(model,l)+")",toDisplay(l.length),r.angle,r.w,r.alpha];
  });
  if(model.points.some(p=>p.fixed||p.rail)) links.unshift(["Ground",null,0,0,0]);
  for(const p of model.points) if(p.rail)links.push(["Slider block "+p.name,null,p.rail.angle,0,0]);
  const offset=2*model.points.length;
  for(const [i,g] of model.gears.entries())links.push([g.name+(g.kind==='pulley'?" · pulley":" · gear"),toDisplay(gearRadius(g)*2),result.q[offset+i]/RAD,result.v[offset+i],result.a[offset+i]]);
  for(const t of gearTracerData(model,result)){
    joints.push([t.name,...t.position.map(toDisplay),...t.velocity.map(toDisplay),toDisplay(magnitude(...t.velocity)),...t.acceleration.map(toDisplay),toDisplay(magnitude(...t.acceleration))]);
  }
  return {joints,links};
}
function resultHeaders() {
  const v=vectorUnit(false), a=vectorUnit(true);
  return {
    jointHead:["Pin","X ("+displayUnits+")","Y ("+displayUnits+")","vₓ ("+v+")","vᵧ ("+v+")","|v| ("+v+")","aₓ ("+a+")","aᵧ ("+a+")","|a| ("+a+")"],
    linkHead:["Link","Length ("+displayUnits+")","Angle (°)","ω (rad/s)","α (rad/s²)"]
  };
}
function table(head,rows) {
  const row=(values,tag)=>'<tr>'+values.map(value=>'<'+tag+'>'+safe(typeof value==="number"?fmt(value,6):value??"—")+'</'+tag+'>').join("")+'</tr>';
  return '<div class="tableScroll"><table><thead>'+row(head,"th")+'</thead><tbody>'+rows.map(r=>row(r,"td")).join("")+'</tbody></table></div>';
}
function renderAnalysis() {
  const ready=analysisReady();
  for(const id of Object.keys(plotViews))redrawPlot(id);
  renderEquations();
  $("csv").disabled=!ready;
  if(ready){
    const {joints,links}=dataRows();
    const {jointHead,linkHead}=resultHeaders();
    $("results").innerHTML='<h3>Pin motion</h3>'+table(jointHead,joints)+'<h3>Link motion</h3>'+table(linkHead,links);
  } else $("results").innerHTML='<p class="description">Results appear after a unique position, velocity and acceleration solution.</p>';
}
function renderMotion() {
  const d=model.drive, scrub=$("scrub"), enabled=!!d&&!dirty&&result.status==="solved";
  $("scrubLabel").textContent=d?.type==="linear"?"Input travel":"Input angle";
  $("play").disabled=!enabled;
  if(window.workspaceIcon)$("play").innerHTML=window.workspaceIcon(playing?"pause":"play");
  else $("play").textContent=playing?"Pause":"Play";
  $("play").setAttribute("aria-label",playing?"Pause mechanism":"Play mechanism");
  $("play").setAttribute("aria-label",playing?"Pause mechanism":"Play mechanism");
  scrub.disabled=!enabled;
  const current=d?.type==="gear"?wrapAngle(d.position):d?.position??0;
  scrub.min=d?.type==="linear"?String(Math.min(-350,Math.floor(current))):"0";
  scrub.max=d?.type==="linear"?String(Math.max(350,Math.ceil(current))):"360";
  scrub.step="0.1";
  scrub.value=current;
  const positionText=d?(d.type==="linear"?distanceText(current,1)+" "+displayUnits:angleReadout(current,3)+"°"):"—";
  $("position").textContent=positionText;
  scrub.setAttribute("aria-valuetext",positionText);
}
function render(preserveSketch = false) {
  cancelDimensionEdit();
  $("title").textContent=model.title;
  if(window.refreshGeneral)window.refreshGeneral();
  $("lengthUnits").value=displayUnits;
  $("sketchUnit").textContent="X / Y · "+displayUnits;
  $("gridLabel").textContent="Grid ("+displayUnits+")";
  $("gridSpacing").min=toDisplay(0.001);
  $("gridSpacing").max=toDisplay(1000000);
  $("gridSpacing").value=distanceText(gridSpacing,3);
  $("gridSnap").checked=snapToGrid;
  const blocks=model.points.filter(p=>p.rail).length;
  const ground=(model.points.some(p=>p.fixed||p.rail)||model.gears.length)?1:0;
  $("summary").textContent=(model.links.length+model.gears.length+blocks+ground)+" links · "+model.points.length+" pins · "+
    (!dirty&&result.q.length&&["solved","no-drive","indeterminate","incompatible"].includes(result.status)?result.dof+" DOF before input":"Planar sketch");
  $("hint").textContent=toolHints[tool]+(staged?" First selection: "+(staged.type==="point"?model.points[staged.id].name:(staged.type==="gear"?model.gears[staged.id].name:model.links[staged.id].name))+". Select the next object.":"");
  $("undo").disabled=history.length===0;
  $("redo").disabled=redoHistory.length===0;
  document.querySelectorAll("[data-tool]").forEach(b=>{b.classList.toggle("active",b.dataset.tool===tool);b.setAttribute("aria-pressed",b.dataset.tool===tool);});
  $("constraintTool").value=modes.some(([key])=>key===tool)?tool:"";
  $("constraintsToggle").classList.toggle("active",modes.some(([key])=>key===tool));
  if(!preserveSketch)renderSketch();
  renderViewControls();
  renderDrive();
  renderInspector();
  if(selection?.type==="gear")renderGearInspector(selection.id);
  renderMotion();
  renderPlotLayout();
  renderAnalysis();
}


function seedCurrent() {
  if(dirty || result.q.length!==model.points.length*2+model.gears.length) return;
  model.points.forEach((p,i)=>{
    if(!p.fixed){p.x=result.q[2*i];p.y=result.q[2*i+1];}
  });
  const base=2*model.points.length;
  model.gears.forEach((g,i)=>g.angle=result.q[base+i]);
}
function toggleFixed(id) {
  edit(()=>{
    const p=model.points[id];
    p.fixed=!p.fixed;
    if(p.fixed&&p.rail) {
      delete p.rail;
      if(model.drive?.type==="linear"&&model.drive.id===id)model.drive=null;
    }
  });
}
function toggleRail(id) {
  edit(()=>{
    const p=model.points[id];
    if(p.rail) {
      delete p.rail;
      if(model.drive?.type==="linear"&&model.drive.id===id)model.drive=null;
    } else {
      p.rail={x:p.x,y:p.y,angle:0};
      p.fixed=false;
    }
  });
}
function addPoint(x,y) {
  let n=0,name;
  do {
    name=String.fromCharCode(65+n%26)+(n<26?"":String(Math.floor(n/26)));
    n++;
  } while(model.points.some(p=>p.name===name));
  return model.points.push({name,x,y})-1;
}
function addBar(a,b) {
  const q=coord(model), length=magnitude(...vector(q,a,b));
  if(length<0.001){
    notice="The two endpoints must be separated to create a link.";
    return;
  }
  let n=1;
  while(model.links.some(l=>l.name==="Link "+n))n++;
  selection={type:"link",id:model.links.push({pins:[a,b],name:"Link "+n,length,lengthLocked:false})-1};
  staged=null;
}
function engage(next) {
  stop();
  staged=null;
  tool=next;
  render();
}
function pick(target,xy,preserveSketch = false) {
  if(xy)xy=snapGridPosition(xy);
  const point=target?.type==="point" ? target.id:null;
  const link=target?.type==="link" ? target.id:null;
  if(tool==="select"){selection=target;multiSelection=[];render(preserveSketch);return;}
  if(tool==='collinear'){
    if(!staged&&(link!==null||point!==null)){staged=target;render();return;}
    if(staged?.type==='link'&&link!==null&&link!==staged.id){addConstructionConstraint({type:'collinear',link:staged.id,referenceLink:link});return;}
    if(staged?.type==='link'&&point!==null){addConstructionConstraint({type:'collinear',link:staged.id,p:point});return;}
    if(staged?.type==='point'&&link!==null){addConstructionConstraint({type:'collinear',link,p:staged.id});return;}
    return;
  }
  if(tool==='mount'&&point!==null&&staged?.type==='gear'){const gear=staged.id;performGearChange(()=>{mountGear(gear,'joint',point);staged=null;tool='select';});return;}
  if(tool==='angle'&&link!==null){openAngleConstraint(link);return;}
  if(['horizontal','vertical'].includes(tool)&&link!==null){
    const [p,b]=model.links[link].pins;addConstructionConstraint({type:tool,p,b});return;
  }
  if(target?.type==="gear")return;
  if(tool==="pin"&&xy&&point===null&&link===null) {
    edit(()=>selection={type:"point",id:addPoint(...xy)});
    return;
  }
  if(tool==="rail"&&point!==null){selection=target;toggleRail(point);return;}
  if(tool==="fix"&&point!==null){selection=target;toggleFixed(point);return;}
  if(tool==="bar") {
    if(point===null&&!xy)return;
    if(point===null&&link!==null)return;
    if(staged&&staged.id===point)return;
    if(point!==null&&!staged){staged=target;render();return;}
    edit(()=>{
      const id=point??addPoint(...xy);
      if(staged)addBar(staged.id,id);
      else staged={type:"point",id};
    });
    return;
  }
  if(tool==="attach"){
    if(!staged&&link!==null){staged=target;render();return;}
    if(!staged||point===null)return;
    const l=model.links[staged.id];
    if(l.pins.includes(point))return;
    edit(()=>{
      const q=coord(model),[a,b]=l.pins;
      const [x,y]=vector(q,a,b),[u,v]=vector(q,a,point),L2=x*x+y*y;
      if(L2<1e-6){notice="Separate the link endpoints before attaching a pin.";return;}
      (l.attach??=[]).push([(x*u+y*v)/L2,cross(x,y,u,v)/L2]);
      if(l.tracerDimensions)l.tracerDimensions.push(null);
      l.pins.push(point);
      selection=staged;
      staged=null;
    });
    return;
  }
  if(tool==="midpoint"){
    if(!staged&&point!==null){staged=target;render();return;}
    if(!staged||link===null||model.links[link].pins.slice(0,2).includes(staged.id))return;
    if(model.constraints.some(c=>c.type===tool&&c.p===staged.id&&c.link===link))return;
    addConstructionConstraint({type:tool,p:staged.id,link});
    return;
  }
  if(["coincident","horizontal","vertical"].includes(tool)&&point!==null){
    if(!staged){staged=target;render();return;}
    if(staged.id===point)return;
    const a=staged.id;
    if(model.constraints.some(c=>c.type===tool&&((c.p===a&&c.b===point)||(c.b===a&&c.p===point))))return;
    addConstructionConstraint({type:tool,p:a,b:point});
  }
}
function targetFrom(event) {
  const node=event.target.closest("[data-point],[data-link],[data-gear]");
  if(!node)return null;
  if(node.dataset.gear!==undefined)return {type:"gear",id:Number(node.dataset.gear)};
  return node.dataset.point===undefined ?
    {type:"link",id:Number(node.dataset.link)} : {type:"point",id:Number(node.dataset.point)};
}
let moved=false;
sketch.addEventListener("pointerdown",event=>{
  moved=false;
  if(event.button===2||event.button===1){
    event.preventDefault();const pt=boardPosition(event);
    drag={mode:'pan',pointer:event.pointerId,px:pt.x,py:pt.y,x:view.x,y:view.y};
    sketch.setPointerCapture(event.pointerId);sketch.classList.add('panning');return;
  }
  if(event.button===0&&!targetFrom(event)){
    const pt=boardPosition(event);drag={mode:'box',pointer:event.pointerId,start:pt,end:pt,x:event.clientX,y:event.clientY};
    return;
  }
  if(tool!=="select"||event.button!==0)return;
  const target=targetFrom(event);
  if(!target)return;
  let grabbed=target;
  if(target.type==="gear"){
    const g=model.gears[target.id];
    if(!Number.isInteger(g.centerPoint)||model.points[g.centerPoint].fixed)return;
    grabbed={type:"point",id:g.centerPoint};
  }
  if(playing){stop();renderMotion();}
  const cursor=modelPosition(event), pose=scene();
  const grab=grabPoint(model,pose,grabbed,cursor);
  if(!grab)return;
  const offset=grab.map((row,i)=>dot(row,pose)-cursor[i]);
  drag={mode:"geometry",target,grab,offset,seed:pose,pointer:event.pointerId,x:event.clientX,y:event.clientY};
});
sketch.addEventListener("pointermove",event=>{
  if(!drag||drag.pointer!==event.pointerId||!event.buttons)return;
  if(drag.mode==="pan"){
    const pt=boardPosition(event);
    view.x=drag.x+pt.x-drag.px;
    view.y=drag.y+pt.y-drag.py;
    moved=true;
    renderSketch();
    return;
  }
  if(!moved&&magnitude(event.clientX-drag.x,event.clientY-drag.y)<4)return;
  if(drag.mode==='box'){
    if(!moved)sketch.setPointerCapture(event.pointerId);
    moved=true;drag.end=boardPosition(event);renderSketch();return;
  }
  if(!moved){
    moved=true;multiSelection=[];
    selection=drag.target;
    sketch.setPointerCapture(event.pointerId);
  }
  const destination=snapGridPosition(modelPosition(event).map((x,i)=>x+drag.offset[i]));
  const next=dragPose({...model,editLengths:true,constructionMode:true},drag.pose??drag.seed,drag.grab,destination,Math.max(12,6/view.scale));
  drag.failed=!next;
  if(next){
    drag.pose=next;drag.previewModel=clone(model);storeConstructionPose(drag.previewModel,next);fitGearsToLinks(drag.previewModel);
  }
  renderSketch();
});
function updateDrivePosition(q) {
  const d=model.drive;
  if(!d)return;
  if(d.type!=="linear"){
    if(d.type==="gear"){d.position=q[2*model.points.length+d.id]/RAD;return;}
    const [x,y]=vector(q,...model.links[d.id].pins.slice(0,2));
    d.position=wrapAngle(Math.atan2(y,x)/RAD);
  }else{
    const {x,y,angle}=model.points[d.id].rail;
    d.position=(q[2*d.id]-x)*Math.cos(angle*RAD)+(q[2*d.id+1]-y)*Math.sin(angle*RAD);
  }
}
function finishDrag(commit) {
  if(!drag)return;
  const {mode,pose,seed,failed,before,start,end}=drag;
  drag=null;
  sketch.classList.remove("panning");
  if(mode==='box'){
    if(commit&&moved){multiSelection=objectsInsideBox(start,end);selection=multiSelection[0]??null;render();}
    else if(moved)renderSketch();return;
  }
  if(mode==="pan")return;
  if(commit&&moved&&pose?.some((x,i)=>Math.abs(x-seed[i])>1e-7)){
    remember();
    storeConstructionPose(model,pose);
    fitGearsToLinks(model);
    updateDrivePosition(pose);
    result=solveModel(model,pose);
    dirty=false;
    notice="";
  }else if(commit&&moved&&failed){
    notice="Dragging requires a pose that satisfies the dimensions and sketch constraints.";
  }
  if(moved)render();
}
sketch.addEventListener("contextmenu",event=>event.preventDefault());
sketch.addEventListener("pointerup",()=>finishDrag(true));
sketch.addEventListener("pointercancel",()=>finishDrag(false));
sketch.addEventListener("lostpointercapture",()=>finishDrag(false));
sketch.addEventListener("pointerleave",()=>{if(!moved)finishDrag(false);});
let dimensionLink=null;
function cancelDimensionEdit(){
  dimensionLink=null;
  $("dimensionEdit").hidden=true;
}
function commitDimensionEdit(){
  if(dimensionLink===null)return;
  const input=$("dimensionEdit");
  if(!input.checkValidity()||!Number.isFinite(input.valueAsNumber)){input.reportValidity();return;}
  const id=dimensionLink,value=fromDisplay(input.valueAsNumber);
  cancelDimensionEdit();
  if(input.valueAsNumber===Number(distanceText(model.links[id].length,9))){renderSketch();return;}
  edit(()=>{model.links[id].length=value;model.links[id].lengthLocked=true;});
}
$("dimensionEdit").addEventListener("change",commitDimensionEdit);
$("dimensionEdit").addEventListener("blur",commitDimensionEdit);
$("dimensionEdit").addEventListener("keydown",event=>{
  if(event.key!=="Enter"&&event.key!=="Escape")return;
  event.preventDefault();event.stopPropagation();
  if(event.key==="Enter")commitDimensionEdit();
  else{cancelDimensionEdit();renderSketch();}
});
sketch.addEventListener("click",event=>{
  if(moved||event.shiftKey){moved=false;return;}
  // Keep dimension labels mounted so the browser can dispatch a double click.
  const dimension=event.target.closest("[data-dimension]"),target=targetFrom(event);
  pick(target,modelPosition(event),Boolean(dimension));
  if(dimension)setTimeout(()=>{
    if(dimensionLink===null&&selection?.type===target?.type&&selection?.id===target?.id)renderSketch();
  },600);
});
sketch.addEventListener("dblclick",event=>{
  const label=event.target.closest("[data-dimension]");
  if(!label||moved||event.shiftKey)return;
  event.preventDefault();
  stop();tool="select";staged=null;multiSelection=[];
  selection={type:"link",id:Number(label.dataset.dimension)};
  setPanel($("propertiesPanel"),true);
  $("inspector").closest("details").open=true;
  render();
  const rect=sketch.querySelector('rect[data-dimension="'+selection.id+'"]').getBoundingClientRect();
  const board=$("board").getBoundingClientRect(),input=$("dimensionEdit");
  dimensionLink=selection.id;
  input.min=toDisplay(.001);input.value=distanceText(model.links[dimensionLink].length,9);
  input.setAttribute("aria-label",model.links[dimensionLink].name+" length ("+displayUnits+")");
  input.style.left=(rect.x-board.x)+"px";input.style.top=(rect.y-board.y-5)+"px";
  input.style.width=Math.max(100,rect.width)+"px";
  input.hidden=false;input.focus();input.select();
});
sketch.addEventListener("wheel",event=>{
  event.preventDefault();
  if(drag)return;
  const pt=boardPosition(event);
  const pixels=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?440:1);
  zoomTo(view.scale*Math.exp(-Math.max(-160,Math.min(160,pixels))*.0025),pt.x,pt.y);
},{passive:false});

function seek(position,speed=model.drive.speed) {
  if(model.drive.type==="rotary")position=wrapAngle(position);
  const nextDrive={...model.drive,position,speed};
  const next=solveModel(model,result.q,nextDrive);
  if(next.status!=="solved")return false;
  model.drive=nextDrive;
  result=next;
  return true;
}
function animate(time) {
  if(!playing)return;
  if(!timer)timer=time;
  if(time-timer>=24){
    const dt=Math.min(.06,(time-timer)/1000), d=model.drive;
    timer=time;
    const factor=d.type!=="linear"?1/RAD:1;
    const position=d.position+factor*(d.speed*dt+0.5*d.accel*dt*dt);
    if(!seek(position,d.speed+d.accel*dt)){
      stop();
      notice="Playback stopped at the last solvable pose.";
    }
    render();
  }
  if(playing)frame=requestAnimationFrame(animate);
}
$("play").onclick=()=>{
  if(playing){stop();render();return;}
  remember();
  notice="";
  playing=true;
  timer=0;
  renderMotion();
  frame=requestAnimationFrame(animate);
};
let scrubPosition=null, scrubGearBase=0;
$("scrub").addEventListener("pointerdown",()=>{scrubPosition=null;});
$("scrub").oninput=event=>{
  stop();
  if(scrubPosition===null){
    remember();
    scrubPosition=model.drive.type==="gear"?wrapAngle(model.drive.position):model.drive.position;
    scrubGearBase=model.drive.type==="gear"?model.drive.position-scrubPosition:0;
  }
  const target=event.target.valueAsNumber;
  const maxStep=model.drive.type!=="linear"?5:12;
  notice="";
  for(let i=0; i<150; i++){
    const delta=target-scrubPosition;
    if(Math.abs(delta)<1e-9)break;
    const candidate=Math.abs(delta)<=maxStep?target:scrubPosition+Math.sign(delta)*maxStep;
    if(!seek(candidate+scrubGearBase)){
      notice="The scrubber reached a limit of the current assembly.";
      break;
    }
    scrubPosition=candidate;
  }
  render();
};
$("scrub").onchange=()=>{scrubPosition=null;};
$("split").onchange=renderAnalysis;
for(const type of positionVectorTypes)$("sketch"+type.id).onchange=renderSketch;
for(const id of Object.keys(plotViews)){
  const canvas=$(id), view=plotViews[id];
  let pan=null;
  $(id+"In").onclick=()=>zoomPlot(id,1.35);
  $(id+"Out").onclick=()=>zoomPlot(id,1/1.35);
  $(id+"Fit").onclick=()=>{resetPlotView(id);redrawPlot(id);};
  $(id+"Expand").onclick=()=>{
    expandedPlot=expandedPlot===id?null:id;
    renderPlotLayout();
  };
  canvas.addEventListener("wheel",event=>{
    if(!analysisReady())return;
    event.preventDefault();
    if(pan)return;
    const pt=boardPosition(event,canvas);
    const pixels=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?270:1);
    zoomPlot(id,Math.exp(-Math.max(-160,Math.min(160,pixels))*.0025),pt.x,pt.y);
  },{passive:false});
  canvas.addEventListener("pointerdown",event=>{
    if(event.button!==0||!analysisReady())return;
    const pt=boardPosition(event,canvas);
    pan={id:event.pointerId,px:pt.x,py:pt.y,x:view.x,y:view.y,part:polygonPartAt(event.target),moved:false};
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add("panning");
  });
  canvas.addEventListener("pointermove",event=>{
    if(pan?.id!==event.pointerId)return;
    const pt=boardPosition(event,canvas);
    if(!pan.moved&&magnitude(pt.x-pan.px,pt.y-pan.py)<3)return;
    pan.moved=true;
    view.x=pan.x+pt.x-pan.px;
    view.y=pan.y+pt.y-pan.py;
    redrawPlot(id);
  });
  for(const name of ["pointerup","pointercancel","lostpointercapture"]){
    canvas.addEventListener(name,event=>{
      if(pan?.id!==event.pointerId)return;
      if(name==="pointerup"&&!pan.moved)selectPolygonPart(id,pan.part);
      pan=null;
      canvas.classList.remove("panning");
    });
  }
}
$("tools").querySelectorAll("[data-tool]").forEach(b=>b.onclick=()=>engage(b.dataset.tool));
$("constraintTool").onchange=event=>engage(event.target.value||"select");
$("fit").onclick=()=>refresh(true);
$("lengthUnits").onchange=event=>{
  stop();
  displayUnits=event.target.value;
  render();
};
$("zoomIn").onclick=()=>zoomTo(view.scale*1.25);
$("zoomOut").onclick=()=>zoomTo(view.scale/1.25);
$("viewScale").onchange=event=>{
  const value=event.target.valueAsNumber;
  if(Number.isFinite(value)) zoomTo(view.reference*value/100);
  else renderViewControls();
};
$("gridSnap").onchange=()=>snapToGrid=$("gridSnap").checked;
$("gridSpacing").onchange=event=>{
  const field=event.target;
  if(field.checkValidity()&&Number.isFinite(field.valueAsNumber))gridSpacing=fromDisplay(field.valueAsNumber);
  field.value=distanceText(gridSpacing,3);
  renderSketch();
};
$("solve").onclick=solve;
$("undo").onclick=undoEdit;
$("redo").onclick=redoEdit;

$("new").onclick=()=>reset({title:"Untitled mechanism",points:[],links:[],constraints:[],drive:null});
$("rename").onclick=()=>{
  const name=window.prompt("Project name",model.title)?.trim();
  if(name)edit(()=>model.title=name.slice(0,100),true);
};
document.addEventListener("focusin",event=>{
  if(playing&&event.target.closest(".sidebar")){stop();renderMotion();}
});
document.addEventListener("keydown",event=>{
  if((event.ctrlKey||event.metaKey)&&!event.target.closest("input,textarea,select,[contenteditable]")){
    const key=event.key.toLowerCase();
    if(key==="z"||key==="y"){
      event.preventDefault();if(key==="y"||event.shiftKey)redoEdit();else undoEdit();return;
    }
  }
  if(event.key==="Escape"){
    finishDrag(false);selection=null;multiSelection=[];
    engage("select");
  }
  if(event.key==="Delete"&&selection&&!drag&&!event.target.closest("input,textarea,select,[contenteditable]")){
    event.preventDefault();
    deleteSelection();
  }
});
function download(name,type,content) {
  const url=URL.createObjectURL(new Blob([content],{type}));
  const a=document.createElement("a");
  a.href=url;
  a.download=name;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$("save").onclick=()=>{
  const file=clone(model), q=scene();
  file.displayUnits=displayUnits;
  file.schemaVersion=4;
  file.gears.forEach((g,i)=>g.angle=q[2*model.points.length+i]);
  file.points.forEach((p,i)=>{if(!p.fixed){p.x=q[2*i];p.y=q[2*i+1];}});
  download("mechanism.json","application/json",JSON.stringify(file,null,2));
};
$("load").onclick=()=>$("file").click();
function validate(m){
  const finite=(...a)=>a.every(x=>Number.isFinite(x)&&Math.abs(x)<=1e8);
  const key=(x,items)=>Number.isInteger(x)&&x>=0&&x<items.length;
  if(!m||typeof m.title!=="string"||m.title.length>200||![m.points,m.links,m.constraints].every(Array.isArray)||
    m.points.length>100||m.links.length>150||m.constraints.length>200) return false;
  if(m.displayUnits!==undefined&&!Object.hasOwn(LENGTH_UNITS,m.displayUnits))return false;
  if(!m.points.every(p=>p&&typeof p.name==="string"&&p.name.length<=128&&finite(p.x,p.y)&&
    (!p.rail||(finite(p.rail.x,p.rail.y,p.rail.angle)&&!p.fixed)))) return false;
  if(!m.links.every(l=>l&&typeof l.name==="string"&&l.name.length<=128&&finite(l.length)&&l.length>=.001&&Array.isArray(l.pins)&&
    l.pins.length>=2&&new Set(l.pins).size===l.pins.length&&l.pins.every(i=>key(i,m.points))&&
    (l.pins.length===2||(Array.isArray(l.attach)&&l.attach.length===l.pins.length-2&&
      l.attach.every(pair=>Array.isArray(pair)&&pair.length===2&&finite(...pair))))&&(l.tracerDimensions===undefined||Array.isArray(l.tracerDimensions)&&l.tracerDimensions.length===l.pins.length-2&&l.tracerDimensions.every(d=>d===null||d&&finite(d.along,d.normal)))))return false;
  if(!m.constraints.every(c=>c&&(c.type==='collinear'?key(c.link,m.links)&&(Number.isInteger(c.referenceLink)?key(c.referenceLink,m.links)&&c.referenceLink!==c.link:key(c.p,m.points)):c.type==='angle'?key(c.link,m.links)&&finite(c.angle)&&(c.referenceLink===undefined||key(c.referenceLink,m.links)&&c.referenceLink!==c.link):
    key(c.p,m.points)&&(c.type==='midpoint'?key(c.link,m.links)&&!m.links[c.link].pins.slice(0,2).includes(c.p):
    ['coincident','horizontal','vertical'].includes(c.type)&&key(c.b,m.points)&&c.b!==c.p))))return false;
  if(!validateGears(m)||!validateCables(m))return false;
  return m.drive===null||!!m.drive&&finite(m.drive.position,m.drive.speed,m.drive.accel)&&
    (m.drive.type==="gear"?key(m.drive.id,m.gears??[]):m.drive.type==="rotary"?key(m.drive.id,m.links):
      m.drive.type==="linear"&&key(m.drive.id,m.points)&&!!m.points[m.drive.id].rail);
}
$("file").onchange=async event=>{
  const input=event.target;
  const file=input.files[0];
  input.value="";
  if(!file)return;
  try{
    if(file.size>2*1024*1024)throw new Error("Mechanism file exceeds 2 MiB");
    const next=JSON.parse(await file.text());
    if(!validate(next))throw new Error("Invalid sketch");
    reset(next);
  }catch{
    stop();
    notice="This file is not a valid Linkage Studio sketch.";
    render();
  }
};
function csvCell(value){
  const text=typeof value==='string'&&/^[\s]*[=+\-@]/.test(value)?"'"+value:String(value??'');
  return '"'+text.replaceAll('"','""')+'"';
}
$("csv").onclick=()=>{
  const {joints,links}=dataRows();
  const {jointHead,linkHead}=resultHeaders();
  const rows=[jointHead,...joints,[],linkHead,...links];
  const csv=rows.map(row=>row.map(csvCell).join(",")).join("\r\n");
  download("kinematics.csv","text/csv;charset=utf-8","\ufeff"+csv);
};
refresh(true);




