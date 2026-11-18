"use strict";

// Automatic input is a suggestion until the user explicitly chooses an input.
function inferInput(){
  if(model.inputMode==="manual")return;
  const q=coord(model),old=model.drive,candidates=[];
  const add=(type,id,position,score)=>{
    const same=old?.type===type&&old.id===id;
    const drive={type,id,position:same?old.position:position,speed:same?old.speed:type==="linear"?40:2,accel:same?old.accel:0};
    const trial=solveModel(model,q,drive);
    candidates.push({drive,score:score+(same?0.000001:0)+(trial.status==="solved"?1000:0)});
  };
  model.gears.forEach((g,i)=>{if(!g.rotationLocked)add('gear',i,q[model.points.length*2+i]/RAD,140-(model.meshes.some(m=>m.b===i)?10:0));});
  model.links.forEach((l,i)=>{
    const [a,b]=l.pins,[x,y]=vector(q,a,b);
    if(model.points[a].fixed&&model.points[b].fixed)return;
    add('rotary',i,wrapAngle(Math.atan2(y,x)/RAD),(model.points[a].fixed||model.points[b].fixed?100:10)-l.length*.001);
  });
  model.points.forEach((p,i)=>{
    if(p.rail){const {x,y,angle}=p.rail;add('linear',i,(q[2*i]-x)*Math.cos(angle*RAD)+(q[2*i+1]-y)*Math.sin(angle*RAD),70);}
  });
  candidates.sort((a,b)=>b.score-a.score);
  model.drive=candidates[0]?.drive??null;
}

function translatedGearAssembly(source,id,dx,dy){
  const next=clone(source),gears=new Set([id]),pins=new Set();
  let changed=true;
  while(changed){
    const before=gears.size+pins.size;
    next.gears.forEach((g,i)=>{if(gears.has(i)&&Number.isInteger(g.centerPoint))pins.add(g.centerPoint);if(pins.has(g.centerPoint))gears.add(i);});
    for(const m of next.meshes)if(gears.has(m.a)||gears.has(m.b)){gears.add(m.a);gears.add(m.b);}
    for(const shaft of next.shafts){
      const link=next.links[shaft.link];
      if(gears.has(shaft.gear)||link.pins.some(p=>pins.has(p))){gears.add(shaft.gear);link.pins.forEach(p=>pins.add(p));}
    }
    for(const link of next.links)if(link.pins.some(p=>pins.has(p)))link.pins.forEach(p=>pins.add(p));
    for(const c of next.constraints){
      const joined=(c.type==='angle'||c.type==='collinear'&&Number.isInteger(c.referenceLink))?[...next.links[c.link].pins,...(Number.isInteger(c.referenceLink)?next.links[c.referenceLink].pins:[])]:(c.type==='midpoint'||c.type==='collinear')?[c.p,...next.links[c.link].pins]:[c.p,c.b];
      if(joined.some(p=>pins.has(p)))joined.forEach(p=>pins.add(p));
    }
    changed=before!==gears.size+pins.size;
  }
  if([...pins].some(i=>next.points[i].fixed))return clone(source);
  for(const i of gears){next.gears[i].x+=dx;next.gears[i].y+=dy;}
  for(const i of pins){const p=next.points[i];p.x+=dx;p.y+=dy;if(p.rail){p.rail.x+=dx;p.rail.y+=dy;}}
  return next;
}
function gearRadius(g){return g.kind==='pulley'?g.radius:g.module*g.teeth/2;}
function mechanismBounds(source,q){
  const pts=source.points.map((_,i)=>q.slice(2*i,2*i+2));
  for(const g of source.gears??[]){
    const r=gearRadius(g)+g.module,[x,y]=gearCenter(source,q,g);
    pts.push([x-r,y-r],[x+r,y+r]);
  }
  if(!pts.length)pts.push([0,0]);
  return drawingBounds(pts);
}
function gearTracerData(source,solution){
  if(!solution?.v)return [];
  const base=2*source.points.length;
  return (source.gears??[]).map((g,i)=>{
    const angle=solution.q[base+i],w=solution.v[base+i],alpha=solution.a[base+i],r=gearRadius(g);
    const x=r*Math.cos(angle),y=r*Math.sin(angle);
    const center=gearCenter(source,solution.q,g),v=gearCenterRate(g,solution.v),a=gearCenterRate(g,solution.a);
    return {name:g.name+"·P",position:[center[0]+x,center[1]+y],velocity:[v[0]-y*w,v[1]+x*w],acceleration:[a[0]-alpha*y-w*w*x,a[1]+alpha*x-w*w*y],centerVelocity:v,centerAcceleration:a,r:[x,y],omega:w,alpha};
  });
}
function gearDrawing(source,q,map,scale,print=false){
  let out=beltAndRopeDrawing(source,q,map,scale);
  for(const [i,g] of (source.gears??[]).entries()){
    if(g.kind==='pulley'){out+=pulleyDrawing(source,q,i,map,scale,print);continue;}
    const center=map(...gearCenter(source,q,g)),r=gearRadius(g)*scale,angle=q[2*source.points.length+i]??g.angle;
    const colour=print?"#244867":"#416e9e",points=[];
    const internal=(source.meshes??[]).some(m=>m.type==="internal"&&(m.a===i||m.b===i)&&g.teeth>source.gears[m.a===i?m.b:m.a].teeth);
    // Schematic tooth outline, with a separate exact pitch circle.
    for(let tooth=0;tooth<g.teeth;tooth++){
      for(const [phase,factor] of [[0,.94],[.23,.94],[.27,1.045],[.73,1.045],[.77,.94]]){
        const a=(tooth+phase)*2*Math.PI/g.teeth+angle;
        const radius=internal?2-factor:factor;
        points.push([center[0]+r*radius*Math.cos(a),center[1]-r*radius*Math.sin(a)].join(","));
      }
    }
    if(!print&&objectSelected("gear",i))out+=circle(...center,r+6,'fill="none" stroke="#f0a128" stroke-width="5" opacity=".7" pointer-events="none"');
    out+='<g '+(!print?'data-gear="'+i+'" style="cursor:pointer"':"")+'>';
    out+='<polygon points="'+points.join(" ")+'" fill="'+(internal?"none":print?"#fff":"#f0f5fa")+'" stroke="'+colour+'" stroke-width="1.3"/>';
    if(internal)out+=circle(...center,r+g.module*3*scale,'fill="none" stroke="'+colour+'" stroke-width="2"');
    out+=circle(...center,r,'fill="none" stroke="#8ba0b7" stroke-width=".7" stroke-dasharray="4 4"');
    const tip=[center[0]+r*Math.cos(angle),center[1]-r*Math.sin(angle)];
    out+=line(center,tip,'stroke="'+colour+'" stroke-width="1.3"')+circle(...center,3,'fill="'+colour+'"');
    out+=txt(center[0],center[1]+15,g.name+" · "+g.teeth+"T",'text-anchor="middle" fill="#274560" font-size="11"');
    out+='</g>';
  }
  return out;
}
function validateGears(m){
  const gears=m.gears??[],meshes=m.meshes??[],shafts=m.shafts??[];
  const finite=x=>Number.isFinite(x)&&Math.abs(x)<=1e8;
  const idx=(x,n)=>Number.isInteger(x)&&x>=0&&x<n;
  if(!Array.isArray(gears)||gears.length>20||!Array.isArray(meshes)||meshes.length>40||!Array.isArray(shafts)||shafts.length>20)return false;
  if(!gears.every(g=>g&&typeof g.name==="string"&&g.name.length<=128&&[g.x,g.y,g.module,g.angle].every(finite)&&(g.kind==='pulley'?g.module>0:g.module>=.01&&g.module<=1000)&&Number.isInteger(g.teeth)&&g.teeth>=8&&g.teeth<=200))return false;
  for(const mesh of meshes){
    if(!mesh||!idx(mesh.a,gears.length)||!idx(mesh.b,gears.length)||mesh.a===mesh.b||!finite(mesh.phase)||!["external","internal","shaft","belt-open","belt-crossed"].includes(mesh.type))return false;
    const a=gears[mesh.a],b=gears[mesh.b];if([a,b].some(g=>g.centerPoint!==undefined&&!idx(g.centerPoint,m.points.length)))return false;
    const ca=gearCenter(m,modelCoordinates(m),a),cb=gearCenter(m,modelCoordinates(m),b),distance=Math.hypot(ca[0]-cb[0],ca[1]-cb[1]);
    if(isBelt(mesh)){
      if(a.kind!=='pulley'||b.kind!=='pulley'||distance<=gearRadius(a)+gearRadius(b)||[a,b].some(g=>Number.isInteger(g.centerPoint)&&!m.points[g.centerPoint]?.fixed))return false;
      continue;
    }
    if(mesh.type!=='shaft'&&(a.kind==='pulley'||b.kind==='pulley'))return false;
    const nominal=mesh.type==="shaft"?0:mesh.type==="external"?gearRadius(a)+gearRadius(b):Math.abs(gearRadius(a)-gearRadius(b));
    if(Math.abs(distance-nominal)>1e-5)return false;
    if(mesh.type!=="shaft"&&(Math.abs(a.module-b.module)>1e-8||(mesh.type==="internal"&&a.teeth===b.teeth)))return false;
  }
  if(!gears.every(g=>g.kind!=='pulley'||finite(g.radius)&&g.radius>=.01&&g.radius<=1e6))return false;
  if(!gears.every(g=>g.centerPoint===undefined||idx(g.centerPoint,m.points.length)))return false;
  return shafts.every(s=>s&&idx(s.gear,gears.length)&&idx(s.link,m.links.length)&&finite(s.offset)&&
    m.links[s.link].pins.includes(s.pivot??m.links[s.link].pins[0])&&
    (gears[s.gear].centerPoint===(s.pivot??m.links[s.link].pins[0])||m.points[s.pivot??m.links[s.link].pins[0]].fixed&&
      Math.hypot(m.points[s.pivot??m.links[s.link].pins[0]].x-gears[s.gear].x,m.points[s.pivot??m.links[s.link].pins[0]].y-gears[s.gear].y)<1e-5));
}
function buildGeneralPolygon(source,solution,accel,options={}){
  const showComponents=options.components??$("split").checked;
  const showGuides=options.guides??$("construction").checked;
  const tracers=gearTracerData(source,solution);
  const values=accel?solution.a:solution.v;
  const points=source.points.map((_,i)=>values.slice(2*i,2*i+2));
  const names=source.points.map(p=>p.name);
  const pinRoles=source.points.map(p=>p.fixed?"fixed":p.rail?"slider":"");
  for(const t of tracers){points.push(accel?t.acceleration:t.velocity);names.push(t.name);pinRoles.push("");}
  const edges=polygonEdges(),normalParts=[],guides=[];
  for(const [i,e] of edges.entries()){
    const link=source.links[e.id],motion=angular(link,solution),r=vector(solution.q,e.a,e.b),j=[-r[1],r[0]];
    const tip=[points[e.a][0]-motion.w**2*r[0],points[e.a][1]-motion.w**2*r[1]];
    if(accel&&showComponents)normalParts.push({...e,tip,label:"N"+(i+1)});
    if(showGuides)guides.push({edge:e,at:accel?tip:points[e.a],dir:j});
  }
  for(const [i,p] of source.points.entries()){
    if(p.rail&&showGuides){
      const a=p.rail.angle*RAD;
      guides.push({at:[0,0],dir:[Math.cos(a),Math.sin(a)],label:"Slider "+p.name+" guide",description:"The "+(accel?"acceleration":"velocity")+" of this pin is parallel to its fixed guide."});
    }
  }
  const first=source.points.length;
  for(const [i,t] of tracers.entries()){
    if(accel&&showComponents){
      normalParts.push({a:first+i,b:first+i,id:-1-i,from:t.centerAcceleration,tip:t.r.map((x,j)=>t.centerAcceleration[j]-t.omega*t.omega*x),label:"N"+names[first+i],gearPoint:t.name});
    }
    if(showGuides){
      guides.push({at:accel?t.r.map((x,j)=>t.centerAcceleration[j]-t.omega*t.omega*x):t.centerVelocity,dir:[-t.r[1],t.r[0]],label:t.name+" tangent",description:"The tangential component is perpendicular to the material point radius."});
    }
  }
  const extent=[[0,0],...points,...normalParts.flatMap(e=>[e.from??points[e.a],e.tip])];
  return {points,names,pinRoles,pole:[0,0],edges:accel?[]:edges,relativeEdges:edges,normalParts,guides,bounds:drawingBounds(extent)};
}
function equationsMarkup(){
  let out='<p>Let J(x, y) = (−y, x). Positive angular rates are counterclockwise. All rates are instantaneous.</p>';
  out+='<h3>Rigid links</h3><div class="reportMath">r = rB − rA<br>vB = vA + ω J r<br>aB = aA − ω²r + α J r<br>ω = (Δv · J r) / |r|²<br>α = (Δa · J r) / |r|²</div>';
  out+='<ol><li>Place stationary pins at pole O. Draw each known absolute velocity perpendicular to its rotating radius, or parallel to its fixed slider guide.</li><li>From a known velocity endpoint, extend a line perpendicular to the connecting rigid link. Intersect compatible directions to locate unknown endpoints.</li><li>Read the relative vector between two endpoints. Divide its magnitude by their separation to get angular speed, and assign the rotation sign.</li><li>For acceleration, lay off the normal term −ω²r from the known acceleration endpoint. Draw the tangent direction perpendicular to the link through that normal tip.</li><li>Intersect tangent directions or a slider guide direction to locate unknown acceleration endpoints. Divide each tangential component by its pin separation for angular acceleration.</li></ol>';
  out+='<p>A polygon label is a vector endpoint. Its drawn location gives components relative to the pole. Equal endpoints represent equal vectors. A slider on a stationary straight guide has no Coriolis term.</p>';
  if(model.gears.some(g=>g.kind!=="pulley")){
    out+='<h3>Gear and carrier relations</h3><div class="reportMath">Pitch radius r = module × teeth / 2<br>External: z₁(ω₁ − ωc) + z₂(ω₂ − ωc) = 0<br>Internal: z₁(ω₁ − ωc) − z₂(ω₂ − ωc) = 0<br>ωc is the angular speed of the line joining the centres.<br>Differentiate for α₁, α₂ and αc. For fixed shafts, ωc = αc = 0.<br>Common shaft: θ₁ − θ₂ = constant; ω₁ = ω₂; α₁ = α₂</div>';
    for(const mesh of model.meshes.filter(m=>!isBelt(m))){
      const a=model.gears[mesh.a],b=model.gears[mesh.b],ratio=mesh.type==="shaft"?1:(mesh.type==="external"?-1:1)*a.teeth/b.teeth;
      out+='<p>'+safe(a.name+" → "+b.name)+" · (ω₂ − ωc) / (ω₁ − ωc) = "+fmt(ratio,6)+" · (α₂ − αc) / (α₁ − αc) = "+fmt(ratio,6)+'</p>';
    }
    out+='<p>Gear polygon labels G·P are material points on each pitch circle. A wheel’s pitch-point velocity can match the mating wheel while their material-point normal accelerations differ. Moving shaft-centre velocity and acceleration are included in each material-point vector. Ideal kinematics are calculated from pitch circles. The tooth outline is schematic.</p>';
  }
  return out+pulleyEquations();
}
function renderEquations(){
  $("equations").innerHTML=analysisReady()?equationsMarkup():'<p>Solve a constrained mechanism to inspect its equations and graphical construction.</p>';
}
function deleteGear(id){
  const owned=model.gears[id].freePoint?model.gears[id].centerPoint:null;
  model.gears.splice(id,1);
  for(const c of model.cables){c.spins=(c.spins??[]).filter(s=>s.pulley!==id).map(s=>({...s,pulley:s.pulley>id?s.pulley-1:s.pulley}));if(c.layout==='tackle')delete c.layout;}

  model.meshes=model.meshes.filter(m=>m.a!==id&&m.b!==id).map(m=>({...m,a:m.a>id?m.a-1:m.a,b:m.b>id?m.b-1:m.b}));
  model.shafts=model.shafts.filter(s=>s.gear!==id).map(s=>({...s,gear:s.gear>id?s.gear-1:s.gear}));
  if(owned!==null&&!model.links.some(l=>l.pins.includes(owned))&&!model.gears.some(g=>g.centerPoint===owned))deletePoint(owned);
  if(model.drive?.type==="gear"){
    if(model.drive.id===id)model.drive=null;
    else if(model.drive.id>id)model.drive.id--;
  }
}
