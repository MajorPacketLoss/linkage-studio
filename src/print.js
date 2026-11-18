
"use strict";

const drawingSections=[
  {id:"mechanism", check:"printMechanism", scale:"mechanismRatio", name:"Mechanism"},
  {id:"velocity", check:"printVelocity", scale:"velocityRatio", name:"Velocity polygon"},
  {id:"acceleration", check:"printAcceleration", scale:"accelerationRatio", name:"Acceleration polygon"}
];
const pageMargin=13;
const printColours=["#174572","#176451","#503b8b","#89551c","#983345","#4c6028"];
let printPrepared=false;
let previousPrintUnit=null;

function paperLayout(paper=$("printPaper").value,orientation=$("printOrientation").value) {
  const a4=paper==="a4", landscape=orientation==="landscape";
  const size=a4?[210,297]:[215.9,279.4];
  const width=size[landscape?1:0]-2*pageMargin;
  const height=size[landscape?0:1]-2*pageMargin-58;
  return {width,height,css:(a4?"A4":"letter")+" "+(landscape?"landscape":"portrait")};
}

function printableGeometry() {
  const sections={};
  if(model.points.length||model.gears.length){
    const q=scene();
    const points=model.points.map((_,i)=>q.slice(2*i,2*i+2));
    sections.mechanism={q,points,bounds:mechanismBounds(model,q)};
  }
  if(analysisReady()){
    const options={guides:$("printGuides").checked,components:$("printComponents").checked};
    sections.velocity=buildGeneralPolygon(model,result,false,options);
    sections.acceleration=buildGeneralPolygon(model,result,true,options);
  }
  return sections;
}

function maximumScale(bounds,paper) {
  const padding=14;
  return Math.min((paper.width-2*padding)/Math.max(bounds.width,1e-12),
    (paper.height-2*padding)/Math.max(bounds.height,1e-12));
}
function steppedSize(value,up) {
  const power=10**Math.floor(Math.log10(value));
  const choices=[1,2,2.5,5,10];
  const normalized=value/power;
  const selected=up?choices.find(x=>x>=normalized):choices.filter(x=>x<=normalized).at(-1);
  return Number((power*(selected??(up?10:1))).toPrecision(4));
}
function fittedScales(sections,paper) {
  return Object.fromEntries(drawingSections.flatMap(({id})=>{
    const geometry=sections[id];
    if(!geometry)return [];
    const span=Math.max(geometry.bounds.width,geometry.bounds.height);
    const largest=maximumScale(geometry.bounds,paper);
    const value=span<1e-9?1:id==="mechanism"?steppedSize(1/largest,true):steppedSize(largest/unitFactor(),false);
    return [[id,value]];
  }));
}
function setFitScales() {
  const fit=fittedScales(printableGeometry(),paperLayout());
  for(const {id,scale} of drawingSections)if(fit[id])$(scale).value=fit[id];
}
function printPlan(useDefaults=false) {
  const paper=paperLayout(), sections=printableGeometry(), errors=[], drawings=[];
  const defaults=useDefaults?fittedScales(sections,paper):null;
  for(const {id,check,scale,name} of drawingSections){
    const geometry=sections[id];
    if(!geometry||(!useDefaults&&!$(check).checked))continue;
    const value=useDefaults?defaults[id]:$(scale).valueAsNumber;
    if(!(value>0&&Number.isFinite(value))){
      errors.push(name+" needs a positive scale.");
      continue;
    }
    const paperPerModel=id==="mechanism"?1/value:value*unitFactor();
    if(!Number.isFinite(paperPerModel)||paperPerModel<=0||paperPerModel>maximumScale(geometry.bounds,paper)*(1+1e-9)){
      errors.push(name+" is too large for this page. Choose Fit scales to paper or use a smaller drawing scale.");
      continue;
    }
    drawings.push({id,name,geometry,value,paperPerModel});
  }
  const results=analysisReady()&&(useDefaults||$("printResults").checked);
  const study=$("printStudy").checked&&window.hasStudy?.();
  if(!drawings.length&&!results&&!study&&!errors.length)errors.push("Select at least one available sheet.");
  return {paper,drawings,results,study,errors};
}
function updatePrintForm() {
  const sections=printableGeometry();
  for(const {id,check,scale} of drawingSections){
    $(check).disabled=!sections[id];
    $(scale).disabled=!sections[id]||!$(check).checked;
  }
  $("printResults").disabled=!analysisReady();
  $("printStudy").disabled=!window.hasStudy?.();
  $("printVelocityUnit").textContent="mm per "+vectorUnit(false);
  $("printAccelerationUnit").textContent="mm per "+vectorUnit(true);
  const {errors}=printPlan();
  $("printMessage").textContent=errors[0]??(analysisReady()?"":"Solve the mechanism to include polygons and numerical results.");
  $("printSubmit").disabled=errors.length>0;
}

function mechanismPaper(geometry,width,height,scale,source=model,units=displayUnits,motion=null) {
  const {q,points,bounds}=geometry;
  const center=[(bounds.xmin+bounds.xmax)/2,(bounds.ymin+bounds.ymax)/2];
  const map=([x,y])=>[width/2+(x-center[0])*scale,height/2-(y-center[1])*scale];
  const screen=points.map(map);
  let drawing=gearDrawing(source,q,(x,y)=>map([x,y]),scale,true);
  const grounded=source.points.map((p,i)=>p.fixed?screen[i]:null).filter(Boolean);
  if(grounded.length===2&&$("printGuides").checked)drawing+=line(...grounded,'stroke="#536276" stroke-width="1.5" stroke-dasharray="5 5"');
  for(const [i,p] of source.points.entries()){
    if(!p.rail)continue;
    const [x,y]=screen[i], angle=p.rail.angle*RAD, span=Math.hypot(width,height);
    const dx=Math.cos(angle),dy=-Math.sin(angle), nx=-dy*6,ny=dx*6;
    for(const side of [-1,1]){
      drawing+=line([x-span*dx+side*nx,y-span*dy+side*ny],[x+span*dx+side*nx,y+span*dy+side*ny],
        'stroke="#738198" stroke-width="1" stroke-dasharray="6 5"');
    }
  }
  source.links.forEach((link,i)=>{
    const [a,b,...rest]=link.pins, colour=printColours[i%printColours.length];
    for(const j of [b,...rest])drawing+=line(screen[a],screen[j],'stroke="'+colour+'" stroke-width="3.5" stroke-linecap="round"');
    if(!$("printDimensions").checked)return;
    for(const p of rest){const mid=[(screen[a][0]+screen[p][0])/2,(screen[a][1]+screen[p][1])/2];drawing+=txt(mid[0]+8,mid[1]-8,fmt(magnitude(...vector(q,a,p))*LENGTH_UNITS[units].perMM,6)+' '+units,'font-size="11" fill="'+colour+'" stroke="white" stroke-width="4" paint-order="stroke"');}

    const [x,y]=screen[a], [u,v]=screen[b], d=magnitude(u-x,v-y);
    if(d<1e-9)return;
    const nx=(v-y)*16/d, ny=(x-u)*16/d;
    const first=[x+nx,y+ny], second=[u+nx,v+ny];
    for(const [endpoint,offset] of [[screen[a],first],[screen[b],second]]){
      drawing+=line(endpoint,offset,'stroke="'+colour+'" stroke-width=".8"');
      drawing+=line([offset[0]-nx*.2,offset[1]-ny*.2],[offset[0]+nx*.2,offset[1]+ny*.2],'stroke="'+colour+'"');
    }
    drawing+=line(first,second,'stroke="'+colour+'" stroke-width=".8"');
    const length=magnitude(...vector(q,a,b));
    drawing+=txt((first[0]+second[0])/2,(first[1]+second[1])/2-3,
      fmt(length*LENGTH_UNITS[units].perMM,6)+" "+units,'text-anchor="middle" fill="'+colour+'" font-size="11" stroke="white" stroke-width="4" paint-order="stroke"');
  });
  const groups=[];
  source.points.forEach((p,i)=>{
    const [x,y]=screen[i];
    if(p.fixed)drawing+='<path d="M '+(x-8)+' '+(y+12)+' L '+x+' '+y+' L '+(x+8)+' '+(y+12)+' Z" stroke="#26384e" fill="none"/>';
    if(p.rail)drawing+='<rect x="'+(x-9)+'" y="'+(y-5)+'" width="18" height="10" rx="1" transform="rotate('+(-p.rail.angle)+' '+x+' '+y+')" fill="white" stroke="#89551c" stroke-width="1.4"/>';
    const group=groups.find(g=>magnitude(g.world[0]-points[i][0],g.world[1]-points[i][1])<1e-7);
    if(group)group.names.push(p.name);
    else groups.push({screen:screen[i],world:points[i],names:[p.name]});
  });
  if($("printLabels").checked)drawing+=polygonLabels(groups,width,height);
  if(motion)drawing+=positionVectorMarkup(screen,{...motion,width,height,light:true});
  drawing+=txt(width-12,19,"Y ↑   X →",'text-anchor="end" fill="#26384e" font-size="11"');
  return '<g font-family="ui-monospace,monospace">'+drawing+'</g>';
}

function rulerMarkup(){
  return '<div class="printRuler"><svg width="50mm" height="4mm" viewBox="0 0 50 4" aria-label="50 millimetre check line"><path d="M0 2H50 M.15 0V4 M49.85 0V4" fill="none" stroke="#172438" stroke-width=".3"/></svg><span>50 mm print check</span></div>';
}
function printPose() {
  const d=model.drive;
  if(!d)return "Input unavailable";
  if(d.type!=="linear")return "Input angle "+angleReadout(d.position,5)+"° · "+fmt(d.speed,5)+" rad/s · "+fmt(d.accel,5)+" rad/s²";
  return "Input travel "+distanceText(d.position)+" "+displayUnits+" · "+distanceText(d.speed)+" "+vectorUnit(false)+" · "+distanceText(d.accel)+" "+vectorUnit(true);
}
function drawingSheet(drawing,paper) {
  const {id,name,geometry,value,paperPerModel}=drawing;
  const width=paper.width*unitsPerPaperMillimetre, height=paper.height*unitsPerPaperMillimetre;
  const scale=paperPerModel*unitsPerPaperMillimetre;
  const isMechanism=id==="mechanism", isAcceleration=id==="acceleration";
  const caption=isMechanism?"Scale 1 : "+value:value+" mm on paper = 1 "+vectorUnit(isAcceleration);
  const markup=isMechanism
    ? mechanismPaper(geometry,width,height,scale,model,displayUnits,
      $("printVectors").checked&&analysisReady()?{
        values:{v:model.points.map((_,i)=>result.v.slice(2*i,2*i+2)),a:model.points.map((_,i)=>result.a.slice(2*i,2*i+2))},
        enabled:{v:true,a:true},names:model.points.map(p=>p.name),conversion:unitFactor(),unit:displayUnits
      }:null)
    : polygonMarkup("print-"+id,geometry,isAcceleration,{width,height,scale,paper:true,
      showGuides:$("printGuides").checked,showComponents:$("printComponents").checked,showLabels:$("printLabels").checked});
  const border='<rect x=".5" y=".5" width="'+(width-1)+'" height="'+(height-1)+'" fill="none" stroke="#a5b4c7"/>';
  const svg='<svg class="printDrawing" width="'+paper.width+'mm" height="'+paper.height+'mm" viewBox="0 0 '+width+' '+height+'" aria-label="'+safe(name)+'">'+border+markup+'</svg>';
  const legend=isMechanism?(dirty?'<p>Sketch pose. Dimensions show measured distances in this pose.</p>':"")
    : '<div class="printLegend"><span style="color:#536276">Grey · Absolute from pole</span><span style="color:#2462c0">Blue · Relative along link</span>'+
      (geometry.normalParts.length?'<span style="color:#89551c">Orange · Normal</span><span style="color:#167d6e">Green · Tangential</span>':"")+'</div>';
  return '<section class="printSheet"><h1>'+safe(name)+'</h1><p>'+safe(model.title)+'</p><p>'+safe(caption)+" · "+safe(printPose())+'</p>'+svg+legend+rulerMarkup()+'</section>';
}
function renderPrint(plan) {
  $("printPageStyle").textContent="@page { size: "+plan.paper.css+"; margin:"+pageMargin+"mm; }";
  let output=plan.drawings.map(drawing=>drawingSheet(drawing,plan.paper)).join("");
  if(plan.results){
    const {joints,links}=dataRows(), {jointHead,linkHead}=resultHeaders();
    output+='<section class="printSheet"><h1>Numerical results</h1><p>'+safe(model.title)+'</p><p>'+safe(printPose())+
      '</p><p>Positive rotation is counterclockwise.</p><h2>Pin motion</h2>'+table(jointHead,joints)+
      '<h2>Link motion</h2>'+table(linkHead,links)+'</section>';
  }
  if(plan.study)output+=studyPrintMarkup(plan.paper);
  if($("printEquations").checked&&analysisReady())output+='<section class="printSheet"><h1>Equations and graphical construction</h1>'+equationsMarkup()+'</section>';
  $("printOutput").innerHTML=output||'<p>Place a pin or load a mechanism before printing.</p>';
}

$("printOpen").onclick=()=>{
  stop();
  renderMotion();
  if(!previousPrintUnit){
    setFitScales();
  }else if(previousPrintUnit!==displayUnits){
    const previousFactor=LENGTH_UNITS[previousPrintUnit].perMM;
    for(const id of ["velocityRatio","accelerationRatio"]){
      const input=$(id);
      if(input.valueAsNumber>0)input.value=Number((input.valueAsNumber*previousFactor/unitFactor()).toPrecision(10));
    }
  }
  const fit=fittedScales(printableGeometry(),paperLayout());
  for(const {id,scale} of drawingSections)if(fit[id]&&!$(scale).value)$(scale).value=fit[id];
  previousPrintUnit=displayUnits;
  updatePrintForm();
  $("printDialog").showModal();
};
$("printForm").addEventListener("input",updatePrintForm);
$("printFit").onclick=()=>{setFitScales();updatePrintForm();};
$("printCancel").onclick=()=>$("printDialog").close();
function startPreparedPrint(dialog) {
  printPrepared=true;
  dialog.close();
  window.print();
}
$("printForm").onsubmit=event=>{
  event.preventDefault();
  const plan=printPlan();
  if(plan.errors.length){updatePrintForm();return;}
  renderPrint(plan);
  startPreparedPrint($("printDialog"));
};
window.addEventListener("beforeprint",()=>{
  if(printPrepared)return;
  stop();
  renderMotion();

  renderPrint(printPlan(true));
});
window.addEventListener("afterprint",()=>{
  printPrepared=false;
  $("printOutput").innerHTML="";
});

