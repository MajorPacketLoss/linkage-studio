"use strict";
function performGearChange(action){
  seedCurrent();
  const previous=model;let candidate;
  try{
    model=clone(previous);action();
    if(!validateGears(model))throw Error('The shaft locations conflict with a mesh or rigid attachment.');
    const trial=solveModel(model,coord(model));
    if(trial.status==='inconsistent')throw Error('This attachment conflicts with the existing sketch constraints.');
    candidate=model;
  }catch(error){model=previous;notice=error.message;renderDrive();if($('gearMessage'))$('gearMessage').textContent=error.message;return false;}
  const modules=[...new Set(candidate.gears.filter((g,i)=>previous.gears[i]&&Math.abs(g.module-previous.gears[i].module)>1e-9).map(g=>fmt(g.module,5)))];
  model=previous;if(!edit(()=>model=candidate,true))return false;
  if(modules.length&&$('gearMessage'))$('gearMessage').textContent='Connected at pitch contact. Gear module fitted to '+modules.join(', ')+' mm.';
  return true;
}
function renderGearInspector(id){
  if(model.gears[id].kind==='pulley'){renderPulleyInspector(id);return;}
  const g=model.gears[id],connected=model.meshes.some(m=>m.a===id||m.b===id)||model.shafts.some(s=>s.gear===id);
  const center=gearCenter(model,scene(),g),kind=g.freePoint?'free':Number.isInteger(g.centerPoint)?'joint':'ground';
  $('inspector').innerHTML='<h3>'+safe(g.name)+'</h3><div class="fields">'+
    numericDistance('Centre X','gearX',center[0])+numericDistance('Centre Y','gearY',center[1])+
    numeric('Teeth','gearTeeth',g.teeth,'required min="8" max="200" step="1"')+
    numericDistance('Module','gearModule',g.module,'required min="'+toDisplay(.01)+'" max="'+toDisplay(1000)+'"')+'</div>'+
    '<label class="inline"><input id="gearSizeLocked" type="checkbox" '+(g.sizeLocked?"checked":"")+'> Fix gear pitch size</label>'+
    '<label class="inline"><input id="gearRotationLocked" type="checkbox" '+(g.rotationLocked?"checked":"")+'> Lock wheel rotation to ground</label>'+
    '<label>Shaft support<select id="gearMount"><option value="ground">Ground / reference</option><option value="joint">Follow a joint</option><option value="free">Free centre</option></select></label>'+
    '<label>Joint<select id="gearMountPoint">'+model.points.map((p,i)=>'<option value="'+i+'">'+safe(p.name)+'</option>').join('')+'</select></label><button id="applyGearMount">Apply shaft support</button><button id="mountGearPick">Pick joint on drawing…</button>'+
    '<p class="description">Support locates the shaft; it allows the wheel to rotate. To rotate rigidly with a link, use Attach shaft to link below. A free centre needs enough additional constraints or inputs to determine its motion.</p>'+
    '<p class="description">Pitch diameter '+distanceText(gearRadius(g)*2)+' '+displayUnits+'. Dragging respects grounded joints. Carrier length edits resize gears unless Fix gear pitch size is enabled.</p>'+
    '<button id="removeGear" class="remove">Delete gear and connections</button>';
  $('gearSizeLocked').onchange=()=>edit(()=>g.sizeLocked=$('gearSizeLocked').checked,true);
  $('gearRotationLocked').onchange=()=>edit(()=>g.rotationLocked=$('gearRotationLocked').checked,true);
  $('gearMount').value=kind;
  if(Number.isInteger(g.centerPoint))$('gearMountPoint').value=String(g.centerPoint);
  const sync=()=>{$('gearMountPoint').disabled=$('gearMount').value!=='joint';};sync();$('gearMount').onchange=sync;
  $('mountGearPick').onclick=()=>{engage('mount');staged={type:'gear',id};render();};
  $('applyGearMount').onclick=()=>{const mode=$('gearMount').value,point=Number($('gearMountPoint').value);performGearChange(()=>mountGear(id,mode,point));};
  for(const key of ['gearX','gearY'])$(key).disabled=connected||Number.isInteger(g.centerPoint);
  for(const key of ['gearTeeth','gearModule'])$(key).disabled=connected;
  onNumber('gearX',x=>g.x=x,true,fromDisplay);onNumber('gearY',y=>g.y=y,true,fromDisplay);
  onNumber('gearTeeth',z=>{if(Number.isInteger(z))g.teeth=z;},true);onNumber('gearModule',m=>g.module=m,true,fromDisplay);
  $('removeGear').onclick=()=>{selection={type:'gear',id};deleteSelection();};
}
function gearConnectionsUI(){
  const container=$('gearConnections');
  const rows=model.meshes.map((m,i)=>'<div class="connectionRow"><span>'+safe(model.gears[m.a].name+' / '+model.gears[m.b].name+' · '+m.type)+'</span><button data-remove-mesh="'+i+'" aria-label="Remove gear connection">×</button></div>');
  rows.push(...model.shafts.map((s,i)=>'<div class="connectionRow"><span>'+safe(model.gears[s.gear].name+' / '+model.links[s.link].name+' · rigid shaft')+'</span><button data-remove-shaft="'+i+'" aria-label="Remove rigid shaft">×</button></div>'));
  const opts=model.gears.map((g,i)=>'<option value="'+i+'">'+safe(g.name)+'</option>').join('');
  container.innerHTML=rows.join('')+(model.gears.length>=2?
    '<div class="fields"><label>First wheel<select id="meshA">'+opts+'</select></label><label>Second wheel<select id="meshB">'+opts+'</select></label></div>'+
    '<label>Connection<select id="meshKind"><option value="external">External mesh</option><option value="internal">Internal mesh</option><option value="shaft">Common shaft</option><option value="belt-open">Open belt (pulleys)</option><option value="belt-crossed">Crossed belt (pulleys)</option></select></label>'+
    '<label>Placement<select id="meshPlacement"><option value="fit">Fit automatically: move or resize</option><option value="move">Move shaft; keep gear sizes</option><option value="keep">Keep positions; fail if incompatible</option></select></label><button id="connectGears">Connect wheels</button>':'')+
    (model.gears.length&&model.links.length?'<details class="sideDetails"><summary>Attach shaft to link</summary><label>Wheel<select id="shaftGear">'+opts+'</select></label><label>Link<select id="shaftLink">'+model.links.map((l,i)=>'<option value="'+i+'">'+safe(l.name)+'</option>').join('')+'</select></label><label>Shaft joint<select id="shaftPivot"></select></label><button id="connectShaft">Attach shaft to link</button><p class="description">The gear centre follows this joint, and the wheel rotates with the link. A wheel can turn independently on the joint using its support setting instead.</p></details>':'')+
    '<p id="gearMessage" class="description" role="status"></p>';
  if($('meshB')){$('meshB').value='1';if(model.gears.slice(0,2).every(g=>g.kind==='pulley'))$('meshKind').value='belt-open';}
  container.querySelectorAll('[data-remove-mesh]').forEach(b=>b.onclick=()=>edit(()=>model.meshes.splice(Number(b.dataset.removeMesh),1),true));
  container.querySelectorAll('[data-remove-shaft]').forEach(b=>b.onclick=()=>edit(()=>model.shafts.splice(Number(b.dataset.removeShaft),1),true));
  if($('connectGears'))$('connectGears').onclick=()=>{
    const a=Number($('meshA').value),b=Number($('meshB').value),type=$('meshKind').value,policy=$('meshPlacement').value;
    performGearChange(()=>{if(type.startsWith('belt-'))connectBelt(a,b,type);else model=snappedGearConnection(model,a,b,type,policy);});
  };
  if($('connectShaft')){
    const pivots=()=>{const link=model.links[Number($('shaftLink').value)];$('shaftPivot').innerHTML=link.pins.map(i=>'<option value="'+i+'">'+safe(model.points[i].name)+'</option>').join('');};
    pivots();$('shaftLink').onchange=pivots;
    $('connectShaft').onclick=()=>{const gear=Number($('shaftGear').value),link=Number($('shaftLink').value),pivot=Number($('shaftPivot').value);performGearChange(()=>attachGearToLink(gear,link,pivot));};
  }
}

function runStudy(){
  stop();renderMotion();
  if(!analysisReady()){notice="Solve a mechanism before running a study.";renderDrive();return;}
  const samples=$("sweepSamples").valueAsNumber;
  const raw=$("sweepSpan").valueAsNumber,span=model.drive.type==="linear"?fromDisplay(raw):raw;
  if(!Number.isInteger(samples)||samples<12||samples>360||!Number.isFinite(span)||Math.abs(span)>1e5){
    $("sweepResult").innerHTML='<p class="notice">Use 12–360 samples and a finite input span within ±100000.</p>';return;
  }
  const tracked=Number($("sweepPoint").value),rows=[];
  if(!Number.isInteger(tracked)||tracked<0||tracked>=model.points.length+model.gears.length){
    $("sweepResult").innerHTML='<p class="description">Add a point or gear to track.</p>';return;
  }
  let last=result.q,prev=model.drive.position;
  const start=model.drive.position;
  let stopped=false;
  for(let i=0;i<=samples;i++){
    const target=start+span*i/samples;
    const parts=Math.max(1,Math.ceil(Math.abs(target-prev)/(model.drive.type==="linear"?Math.max(1,Math.abs(span)/200):2)));
    let next;
    for(let k=1;k<=parts;k++){
      next=solveModel(model,last,{...model.drive,position:prev+(target-prev)*k/parts});
      if(next.status!=="solved"){stopped=true;break;}
      last=next.q;
    }
    if(stopped)break;
    prev=target;
    let position,v,a;
    if(tracked<model.points.length){
      position=next.q.slice(2*tracked,2*tracked+2);v=next.v.slice(2*tracked,2*tracked+2);a=next.a.slice(2*tracked,2*tracked+2);
    }else{
      const tracer=gearTracerData(model,next)[tracked-model.points.length];
      ({position,velocity:v,acceleration:a}=tracer);
    }
    rows.push([model.drive.type==="linear"?toDisplay(target):target,...position.map(toDisplay),...v.map(toDisplay),...a.map(toDisplay)]);
  }
  studyRows=rows;studyUnits=displayUnits;studyDriveType=model.drive.type;
  $("sweepCSV").disabled=!rows.length;
  if(!rows.length){$("sweepResult").innerHTML='<p class="notice">The study could not close its initial pose.</p>';return;}
  $("sweepResult").innerHTML='<p class="description">'+rows.length+' poses calculated'+(stopped?". Stopped at the last solvable pose.":".")+
    ' Input rates are held at their current instantaneous values throughout this configuration sweep.</p>'+
    studyChart(rows,4,"Vertical velocity",vectorUnit(false),"#176f69")+studyChart(rows,6,"Vertical acceleration",vectorUnit(true),"#ad6329");
}
function studyChart(rows,column,title,unit,colour){
  const xs=rows.map(r=>r[0]), ys=rows.map(r=>r[column]);
  const lo=Math.min(...ys),hi=Math.max(...ys),dx=xs.at(-1)-xs[0]||1,dy=hi-lo||1;
  const pts=rows.map(r=>[55+(r[0]-xs[0])/dx*650,145-(r[column]-lo)/dy*100]);
  return '<svg class="studyPlot" viewBox="0 0 760 190" aria-label="'+safe(title)+'">'+
    txt(55,20,title+" ("+unit+")",'font-size="13" fill="#243e59"')+
    line([55,145],[705,145],'stroke="#99adbf"')+line([55,45],[55,145],'stroke="#99adbf"')+
    txt(45,49,fmt(hi,4),'text-anchor="end" font-size="10" fill="#526981"')+txt(45,147,fmt(lo,4),'text-anchor="end" font-size="10" fill="#526981"')+
    '<polyline points="'+pts.map(p=>p.join(",")).join(" ")+'" fill="none" stroke="'+colour+'" stroke-width="1.4"/>'+
    txt(55,166,fmt(xs[0],3),'font-size="11" fill="#526981"')+txt(705,166,fmt(xs.at(-1),3),'text-anchor="end" font-size="11" fill="#526981"')+
    txt(380,183,"Input "+(model.drive.type==="linear"?"("+displayUnits+")":"angle (°)"),'text-anchor="middle" font-size="11" fill="#526981"')+'</svg>';
}
let studyRows=[],studyUnits="",studyDriveType="";
window.hasStudy=()=>studyRows.length>1;
function studyPrintMarkup(paper){
  const unit=studyUnits,xUnit=studyDriveType==="linear"?unit:"deg";
  const xScale=paper.width/760*650/Math.abs(studyRows.at(-1)[0]-studyRows[0][0]);
  const plots=[{column:4,title:"Vertical velocity",rate:"/s",colour:"#176f69"},
    {column:6,title:"Vertical acceleration",rate:"/s²",colour:"#ad6329"}];
  let content='<section class="printSheet"><h1>Motion study</h1><p>'+safe(model.title)+'</p>';
  for(const p of plots){
    const values=studyRows.map(row=>row[p.column]),range=Math.max(...values)-Math.min(...values);
    const yScale=range?paper.width/760*100/range:0;
    const chart=studyChart(studyRows,p.column,p.title,unit+p.rate,p.colour)
      .replace('class="studyPlot"','class="printDrawing" width="'+paper.width+'mm" height="'+(paper.width*190/760)+'mm"');
    content+=chart+'<p>Horizontal '+fmt(xScale,5)+' mm per '+xUnit+
      (yScale?' · Vertical '+fmt(yScale,5)+' mm per '+unit+p.rate:' · Constant value')+'</p>';
  }
  return content+rulerMarkup()+'</section>';
}
window.refreshGeneral=()=>{
  gearConnectionsUI();ropeConnectionsUI();
  const prior=$("sweepPoint").value;
  $("sweepPoint").innerHTML=model.points.map((p,i)=>'<option value="'+i+'">'+safe(p.name)+'</option>').join("")+
    model.gears.map((g,i)=>'<option value="'+(i+model.points.length)+'">'+safe(g.name+"·P")+'</option>').join("");
  if([...$("sweepPoint").options].some(o=>o.value===prior))$("sweepPoint").value=prior;
  // Changing a model invalidates exported sweep data.
  studyRows=[];$("sweepCSV").disabled=true;$("sweepResult").innerHTML="";
};
$("lengthUnits").innerHTML=Object.entries(LENGTH_UNITS).map(([key,u])=>'<option value="'+key+'">'+u.name+" ("+key+')</option>').join("");
$("exampleList").innerHTML=EXAMPLES.map(e=>'<button class="exampleTile" data-example="'+e.id+'"><span class="exampleFamily">'+e.family+
  '</span><strong>'+e.name+'</strong><span>'+e.description+'</span></button>').join("");
$("exampleList").querySelectorAll("[data-example]").forEach(button=>button.onclick=()=>{
  reset(EXAMPLES.find(e=>e.id===button.dataset.example).build());
  $("exampleDialog").close();
});
$("examplesOpen").onclick=()=>$("exampleDialog").showModal();
$("examplesClose").onclick=()=>$("exampleDialog").close();
$("helpOpen").onclick=()=>$("helpDialog").showModal();
$("helpClose").onclick=()=>$("helpDialog").close();
$("addGear").onclick=()=>edit(()=>{
  const end=model.gears.at(-1);
  const g={name:"G"+(model.gears.length+1),x:end?end.x+gearRadius(end)+20:0,y:end?.y??0,teeth:20,module:2,angle:0};
  selection={type:"gear",id:model.gears.push(g)-1};
});
$("construction").onchange=renderAnalysis;
$("sweepRun").onclick=runStudy;
$("sweepCSV").onclick=()=>{
  if(!studyRows.length)return;
  const input=studyDriveType==="linear"?"Input ("+studyUnits+")":"Input angle (deg)";
  const headers=[input,"x ("+studyUnits+")","y ("+studyUnits+")","vx ("+studyUnits+"/s)","vy ("+studyUnits+"/s)","ax ("+studyUnits+"/s²)","ay ("+studyUnits+"/s²)"];
  download("motion-study.csv","text/csv;charset=utf-8",[headers,...studyRows].map(r=>r.join(",")).join("\r\n"));
};
const polygonStylePanels=[$("editorPolygonStyle")];
for(const panel of polygonStylePanels){
  panel.innerHTML='<summary>Polygon appearance</summary><div class="polygonStyleFields">'+
    '<label>Line (mm on paper)<input data-style="lineWidth" type="number" min="0.05" max="1.5" step="any"></label>'+
    '<label>Arrowheads<select data-style="arrow"><option value="none">Off</option><option value="open">Open chevron</option><option value="outline">Outlined triangle</option><option value="filled">Filled triangle</option></select></label>'+
    '<label>Head length (mm)<input data-style="headSize" type="number" min="0.6" max="8" step="any"></label>'+
    '<label>Head stroke (mm)<input data-style="headStroke" type="number" min="0.05" max="1.5" step="any"></label>'+
    '<button type="button" data-reset-style>Reset for tracing</button></div>';
  panel.addEventListener("input",event=>{
    const field=event.target,key=field.dataset.style;
    if(key==="arrow")polygonStyle.arrow=field.value;
    else if(key&&field.checkValidity()&&Number.isFinite(field.valueAsNumber))polygonStyle[key]=field.valueAsNumber;
    else return;
    refreshPolygonStyle(field);
  });
  panel.addEventListener("change",()=>syncPolygonStyle());
  panel.querySelector("[data-reset-style]").onclick=()=>{Object.assign(polygonStyle,defaultPolygonStyle);refreshPolygonStyle();};
}
function syncPolygonStyle(activeField){
  for(const panel of polygonStylePanels)for(const field of panel.querySelectorAll("[data-style]")){
    const key=field.dataset.style;
    if(field!==activeField)field.value=polygonStyle[key];
    field.disabled=polygonStyle.arrow==="none"&&(key==="headSize"||key==="headStroke");
  }
}
function refreshPolygonStyle(activeField){syncPolygonStyle(activeField);renderAnalysis();}
syncPolygonStyle();
refresh(true);
