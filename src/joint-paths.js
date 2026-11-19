"use strict";
const jointPathStates=new WeakMap();
let calculatedJointPaths=null;
function jointPathState(point) {
  if(!jointPathStates.has(point))jointPathStates.set(point,{calculated:false,trail:false,positions:[]});
  return jointPathStates.get(point);
}
function recordJointTrails(q) {
  model.points.forEach((point,i)=>{
    const state=jointPathStates.get(point);
    if(!state?.trail)return;
    const position=q?.slice(2*i,2*i+2),last=state.positions.at(-1);
    if(position?.length!==2||!position.every(Number.isFinite)){
      if(last)state.positions.push(null);
    }else if(!last||magnitude(position[0]-last[0],position[1]-last[1])>1e-7){
      state.positions.push(position);
    }
    if(state.positions.length>1000)state.positions.splice(0,state.positions.length-1000);
  });
}
function jointTrailSnapshot() {
  return model.points.filter(point=>jointPathStates.get(point)?.trail)
    .map(point=>[point,jointPathState(point).positions.slice()]);
}
function restoreJointTrails(snapshot) {
  for(const [point,positions] of snapshot??[])jointPathState(point).positions=positions;
}
function clearJointTrails() {
  for(const point of model.points){
    const state=jointPathStates.get(point);
    if(state)state.positions=[];
  }
  renderSketch();
}
function calculateJointPaths() {
  if(!model.points.some(point=>jointPathStates.get(point)?.calculated))return null;
  if(drag?.pose)return calculatedJointPaths;
  if(!analysisReady())return {positions:[],message:"Solve a mechanism with an input to calculate paths."};
  const samples=$("sweepSamples").valueAsNumber,raw=$("sweepSpan").valueAsNumber;
  const span=model.drive.type==="linear"?fromDisplay(raw):raw;
  if(!Number.isInteger(samples)||samples<12||samples>360||!Number.isFinite(span)||Math.abs(span)>1e5){
    return {positions:[],message:"Set 12–360 samples and a finite span within ±100000 in Motion study."};
  }
  const signature=JSON.stringify([model.points,model.links,model.constraints,model.gears,model.meshes,model.shafts,model.cables,model.drive.type,model.drive.id,span,samples]);
  if(calculatedJointPaths?.source===model&&calculatedJointPaths.signature===signature)return calculatedJointPaths;
  const source=clone(model),drive={...source.drive,speed:0,accel:0},start=drive.position;
  const positions=[result.q.slice()];
  let last=result.q.slice(),previous=start,stopped=false,steps=0;
  for(let i=1;i<=samples;i++){
    const target=start+span*i/samples;
    const parts=Math.max(1,Math.ceil(Math.abs(target-previous)/(drive.type==="linear"?Math.max(1,Math.abs(span)/200):2)));
    if(steps+parts>2000){stopped=true;break;}
    for(let k=1;k<=parts;k++){
      const next=solveModel(source,last,{...drive,position:previous+(target-previous)*k/parts});
      steps++;
      if(next.status!=="solved"){stopped=true;break;}
      last=next.q;
    }
    if(stopped)break;
    positions.push(last.slice());previous=target;
  }
  calculatedJointPaths={source:model,signature,positions,message:positions.length+" poses calculated over "+fmt(span)+" "+(drive.type==="linear"?"mm":"°")+"."+(stopped?" Stopped at the last solvable pose or calculation limit; reduce the span if needed.":"")};
  return calculatedJointPaths;
}
function jointPathMarkup() {
  const calculated=calculateJointPaths();
  let markup="";
  model.points.forEach((point,i)=>{
    const state=jointPathStates.get(point);
    if(!state)return;
    const color=colors[i%colors.length];
    for(const [kind,positions] of [["calculated",state.calculated?calculated?.positions.map(p=>p.slice(2*i,2*i+2)):null],["trail",state.trail?state.positions:null]]){
      if(!positions?.length)continue;
      let d="",previous=null;
      for(const position of positions){
        if(!position){previous=null;continue;}
        if(previous&&magnitude(position[0]-previous[0],position[1]-previous[1])<1e-7)continue;
        const [x,y]=project(...position);
        d+=(previous?"L":"M")+x+" "+y+" ";previous=position;
      }
      if(d.includes("L"))markup+='<path data-joint-path="'+i+'" data-path-kind="'+kind+'" d="'+d+'" fill="none" stroke="'+color+'" stroke-width="2" opacity="'+(kind==="trail"?'.85':'.5')+'"'+(kind==="trail"?' stroke-dasharray="4 3"':'')+' pointer-events="none"/>';
    }
  });
  $("clearJointTrails").disabled=!model.points.some(point=>jointPathStates.get(point)?.positions.length);
  $("clearJointTrails").hidden=$("clearJointTrails").disabled;
  const selectedClear=$("clearJointTrail");
  if(selectedClear){
    selectedClear.disabled=selection?.type!=="point"||!jointPathStates.get(model.points[selection.id])?.positions.length;
    selectedClear.hidden=selectedClear.disabled;
  }
  return markup;
}
function jointPathFields(point) {
  const state=jointPathState(point);
  return '<fieldset class="jointPathFields"><legend>Motion paths</legend>'+
    '<label class="inline"><input id="jointCalculatedPath" type="checkbox" '+(state.calculated?'checked':'')+'> Calculated path</label>'+
    '<label class="inline"><input id="jointLiveTrail" type="checkbox" '+(state.trail?'checked':'')+'> Live trail</label>'+
    '<button id="clearJointTrail" type="button" '+(state.positions.length?'':'disabled hidden')+'>Clear this joint’s trail</button>'+
    '<p class="description">Solid: calculated using the Motion study span and samples. Dashed: latest 1,000 positions during playback, scrubbing or dragging.</p>'+
    '<p id="jointPathStatus" class="description" role="status">'+(state.calculated?safe(calculateJointPaths()?.message??""):"")+'</p></fieldset>';
}
function bindJointPathFields(point) {
  $("clearJointTrail").onclick=()=>{
    jointPathState(point).positions=[];
    renderSketch();
  };
  $("jointCalculatedPath").onchange=event=>{
    jointPathState(point).calculated=event.target.checked;
    renderSketch();
    $("jointPathStatus").textContent=event.target.checked?calculateJointPaths()?.message??"":"";
  };
  $("jointLiveTrail").onchange=event=>{
    jointPathState(point).trail=event.target.checked;
    if(event.target.checked)recordJointTrails(scene());
    renderSketch();
  };
}
