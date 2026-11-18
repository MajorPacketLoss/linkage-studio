"use strict";
const isBelt=mesh=>mesh.type==='belt-open'||mesh.type==='belt-crossed';
function syncTracerDimensions(source){
  for(const l of source.links)for(const [k,d] of (l.tracerDimensions??[]).entries())if(d)l.attach[k]=[d.along/l.length,d.normal/l.length];
}
function tracerFields(link){
  return link.pins.slice(2).map((p,k)=>{
    const [u,v]=link.attach[k],along=u*link.length,normal=v*link.length;
    return '<details class="sideDetails" open><summary>Tracer '+safe(model.points[p].name)+'</summary><div class="fields">'+numericDistance('Along link','tracerAlong'+k,along)+numericDistance('Normal offset','tracerNormal'+k,normal)+numericDistance('Radius from first joint','tracerRadius'+k,Math.hypot(along,normal),'required min="'+toDisplay(.001)+'"')+numeric('Offset angle (°)','tracerAngle'+k,Math.atan2(normal,along)/RAD)+'</div><p class="description">Entering an offset fixes its dimensions independently of the base-link length.</p></details>';
  }).join('');
}
function bindTracerFields(link){
  for(const [k,p] of link.pins.slice(2).entries()){
    const set=(kind,value)=>{
      const [u,v]=link.attach[k],d={along:u*link.length,normal:v*link.length};
      if(kind==='along'||kind==='normal')d[kind]=value;
      else{const angle=kind==='angle'?value*RAD:Math.atan2(d.normal,d.along),radius=kind==='radius'?value:Math.hypot(d.along,d.normal);d.along=radius*Math.cos(angle);d.normal=radius*Math.sin(angle);}
      (link.tracerDimensions??=Array(link.pins.length-2).fill(null))[k]=d;syncTracerDimensions(model);
    };
    onNumber('tracerAlong'+k,x=>set('along',x),true,fromDisplay);onNumber('tracerNormal'+k,x=>set('normal',x),true,fromDisplay);
    onNumber('tracerRadius'+k,x=>set('radius',x),true,fromDisplay);onNumber('tracerAngle'+k,x=>set('angle',x),true);
  }
}
function renderPulleyInspector(id){
  const g=model.gears[id],center=gearCenter(model,scene(),g);
  $('inspector').innerHTML='<h3>'+safe(g.name)+' · Pulley</h3><div class="fields">'+numericDistance('Radius','pulleyRadius',g.radius,'required min="'+toDisplay(.01)+'"')+numericDistance('Centre X','pulleyX',center[0])+numericDistance('Centre Y','pulleyY',center[1])+'</div><label>Shaft support<select id="pulleySupport"><option value="ground">Ground / reference</option><option value="free">Free centre</option></select></label><button id="applyPulleySupport">Apply shaft support</button><p class="description">Connect fixed shafts with an open or crossed belt. Moving pulleys use rope-length constraints. Radius is the ideal pitch radius.</p><button id="pulleyMountPick">Pick shaft joint…</button><button id="removePulley" class="remove">Delete pulley</button>';
  const linked=model.meshes.some(m=>m.a===id||m.b===id);
  $('pulleyX').disabled=$('pulleyY').disabled=linked||Number.isInteger(g.centerPoint);
  onNumber('pulleyRadius',x=>{g.radius=x;g.module=x/10;if(!validateGears(model))throw Error('This radius overlaps a connected pulley. Separate the shafts or use a smaller radius.');refreshBeltPhases();},true,fromDisplay);
  onNumber('pulleyX',x=>g.x=x,true,fromDisplay);onNumber('pulleyY',y=>g.y=y,true,fromDisplay);
  $('pulleySupport').value=g.freePoint?'free':'ground';
  $('applyPulleySupport').onclick=()=>performGearChange(()=>mountGear(id,$('pulleySupport').value));
  $('pulleyMountPick').onclick=()=>{engage('mount');staged={type:'gear',id};render();};
  $('removePulley').onclick=()=>{selection={type:'gear',id};deleteSelection();};
}
function refreshBeltPhases(){
  const q=coord(model),base=2*model.points.length;
  for(const m of model.meshes.filter(isBelt))m.phase=gearRadius(model.gears[m.a])*q[base+m.a]+(m.type==='belt-open'?-1:1)*gearRadius(model.gears[m.b])*q[base+m.b];
  for(const c of model.cables)for(const spin of c.spins??[])spin.phase=gearRadius(model.gears[spin.pulley])*q[base+spin.pulley]-spin.sign*sliderTravel(model,q,spin.point);
}
function ropeConnectionsUI(){
  $('ropeConnections').innerHTML=model.cables.map((c,i)=>'<div class="connectionRow"><span>'+safe(c.name)+'</span><button data-remove-rope="'+i+'" aria-label="Remove rope constraint">×</button></div>').join('');
  $('ropeConnections').querySelectorAll('[data-remove-rope]').forEach(b=>b.onclick=()=>edit(()=>model.cables.splice(Number(b.dataset.removeRope),1),true));
}
function bindMachineTools(){
  $('addPulley').onclick=addPulley;$('addPulley').title+=' (U)';$('addPulley').setAttribute('aria-keyshortcuts','U');
  $('ropeOpen').onclick=()=>{
    const sliders=model.points.map((p,i)=>p.rail?'<option value="'+i+'">'+safe(p.name)+'</option>':'').join('');
    if(model.points.filter(p=>p.rail).length<2){notice='Add two slider joints before defining a rope-length constraint.';renderDrive();return;}
    $('ropeA').innerHTML=$('ropeB').innerHTML=sliders;$('ropeB').value=String(model.points.map((p,i)=>p.rail?i:-1).filter(i=>i>=0)[1]);
    $('ropeWheel').innerHTML='<option value="">None</option>'+model.gears.map((g,i)=>g.kind==='pulley'&&Number.isInteger(g.centerPoint)?'<option value="'+i+'">'+safe(g.name)+'</option>':'').join('');
    $('ropeMessage').textContent='';$('ropeDialog').showModal();
  };
  $('ropeClose').onclick=()=>$('ropeDialog').close();
  $('ropeApply').onclick=()=>{
    const a=Number($('ropeA').value),b=Number($('ropeB').value),wa=$('ropeWeightA').valueAsNumber,wb=$('ropeWeightB').valueAsNumber,wheel=$('ropeWheel').value;
    if(a===b||![wa,wb].every(x=>Number.isFinite(x)&&Math.abs(x)>0&&Math.abs(x)<=20)){$('ropeMessage').textContent='Choose distinct sliders and nonzero coefficients from −20 to 20.';return;}
    seedCurrent();const q=coord(model),c={name:'Rope '+(model.cables.length+1),terms:[{point:a,weight:wa},{point:b,weight:wb}],constant:wa*sliderTravel(model,q,a)+wb*sliderTravel(model,q,b)};
    if(wheel!==''){
      const g=model.gears[Number(wheel)],point=g.centerPoint;
      if(![a,b].includes(point)||model.cables.some(c=>(c.spins??[]).some(s=>s.pulley===Number(wheel)))){$('ropeMessage').textContent='The moving wheel must follow one of these sliders and have no existing rope spin constraint.';return;}
      c.spins=[{pulley:Number(wheel),point,sign:1,phase:gearRadius(g)*q[2*model.points.length+Number(wheel)]-sliderTravel(model,q,point)}];
    }
    if(edit(()=>model.cables.push(c),true))$('ropeDialog').close();
  };
}
function addPulley(){
  edit(()=>{
    const n=model.gears.length+1;
    const g={name:'P'+n,kind:'pulley',radius:30,x:0,y:0,teeth:20,module:3,angle:0};
    const last=model.gears.at(-1);if(last){g.x=last.x+gearRadius(last)+g.radius+40;g.y=last.y;}
    selection={type:'gear',id:model.gears.push(g)-1};
  });
}
function connectBelt(a,b,type){
  if(a===b)throw Error('Choose two different pulleys.');
  const first=model.gears[a],second=model.gears[b];
  if(first?.kind!=='pulley'||second?.kind!=='pulley')throw Error('Belt connections need two pulleys.');
  const stationary=g=>!Number.isInteger(g.centerPoint)||model.points[g.centerPoint].fixed;
  if(!stationary(first)||!stationary(second))throw Error('Belt drives currently require fixed shafts. Use a rope constraint for a translating pulley.');
  if(model.meshes.some(m=>m.a===a&&m.b===b||m.a===b&&m.b===a))throw Error('These wheels already have a connection.');
  const q=coord(model),ca=gearCenter(model,q,first),cb=gearCenter(model,q,second),dx=cb[0]-ca[0],dy=cb[1]-ca[1],d=Math.hypot(dx,dy),minimum=gearRadius(first)+gearRadius(second);
  if(d<=minimum+1e-6){
    if(Number.isInteger(second.centerPoint)||model.meshes.some(m=>m.a===b||m.b===b))throw Error('Separate the attached shafts so the pulleys do not overlap.');
    second.x=ca[0]+(d?dx/d:1)*(minimum+40);second.y=ca[1]+(d?dy/d:0)*(minimum+40);
  }
  const base=2*model.points.length,sign=type==='belt-open'?-1:1;
  model.meshes.push({a,b,type,phase:gearRadius(first)*q[base+a]+sign*gearRadius(second)*q[base+b]});
}
function pulleyDrawing(source,q,i,map,scale,print){
  const g=source.gears[i],center=map(...gearCenter(source,q,g)),r=gearRadius(g)*scale,angle=q[2*source.points.length+i];
  const color=print?'#244867':'#476e9d';let out='';
  if(!print&&objectSelected('gear',i))out+=circle(...center,r+6,'fill="none" stroke="#f0a128" stroke-width="5" opacity=".7"');
  out+='<g '+(!print?'data-gear="'+i+'" style="cursor:pointer"':'')+'>';
  out+=circle(...center,r,'fill="white" stroke="'+color+'" stroke-width="1.65"')+circle(...center,r*.9,'fill="none" stroke="'+color+'" stroke-width="1"');
  for(let k=0;k<3;k++){const a=angle+k*2*Math.PI/3;out+=line(center,[center[0]+r*.85*Math.cos(a),center[1]-r*.85*Math.sin(a)],'stroke="'+color+'" stroke-width="1.65"');}
  out+=circle(...center,3,'fill="white" stroke="'+color+'"')+txt(center[0],center[1]+15,g.name+' · R '+fmt(g.radius*LENGTH_UNITS[source.displayUnits??'mm'].perMM,3)+' '+(source.displayUnits??'mm'),'text-anchor="middle" font-size="11" fill="'+color+'"');
  return out+'</g>';
}
function beltAndRopeDrawing(source,q,map,scale){
  let out='';
  for(const m of source.meshes.filter(isBelt)){
    const a=source.gears[m.a],b=source.gears[m.b],A=gearCenter(source,q,a),B=gearCenter(source,q,b),dx=B[0]-A[0],dy=B[1]-A[1],d=Math.hypot(dx,dy),u=[dx/d,dy/d],v=[-u[1],u[0]],ra=gearRadius(a),rb=gearRadius(b),crossed=m.type==='belt-crossed';
    const k=(ra+(crossed?rb:-rb))/d,h=Math.sqrt(Math.max(0,1-k*k));
    for(const sign of [-1,1]){
      const n=[k*u[0]+sign*h*v[0],k*u[1]+sign*h*v[1]];
      const p=[A[0]+ra*n[0],A[1]+ra*n[1]],t=[B[0]+(crossed?-1:1)*rb*n[0],B[1]+(crossed?-1:1)*rb*n[1]];
      out+=line(map(...p),map(...t),'stroke="#665649" stroke-width="2"');
    }
  }
  for(const c of source.cables??[]){
    const moving=c.spins?.[0]&&source.gears[c.spins[0].pulley],idler=c.spins?.[1]&&source.gears[c.spins[1].pulley];
    const routed=c.layout==='tackle'&&moving&&idler&&Math.abs(moving.radius-idler.radius)<1e-6&&Math.abs(q[2*c.loadPoint]-q[2*c.movingPoint]-3*moving.radius)<1e-6&&Math.abs(idler.x-q[2*c.movingPoint]-2*moving.radius)<1e-6&&Math.abs(idler.y)<1e-6&&q[2*c.movingPoint+1]<-moving.radius&&q[2*c.loadPoint+1]<0;
    if(routed){
      const C=q.slice(2*c.movingPoint,2*c.movingPoint+2),E=q.slice(2*c.loadPoint,2*c.loadPoint+2),r=source.gears[c.spins[0].pulley].radius;
      const A=map(C[0]-r,0),B=map(C[0]-r,C[1]),D=map(C[0]+r,C[1]),F=map(C[0]+r,0),G=map(E[0],0),H=map(...E);
      out+='<path d="M '+A.join(' ')+' L '+B.join(' ')+' A '+r*scale+' '+r*scale+' 0 0 0 '+D.join(' ')+' L '+F.join(' ')+' A '+r*scale+' '+r*scale+' 0 0 1 '+G.join(' ')+' L '+H.join(' ')+'" fill="none" stroke="#665649" stroke-width="2"/>';
      out+=line(map(C[0]-r-8,0),map(C[0]-r+8,0),'stroke="#465c73" stroke-width="3"');
    }else{
      const p=c.terms.map(t=>map(...q.slice(2*t.point,2*t.point+2)));
      for(let i=1;i<p.length;i++)out+=line(p[i-1],p[i],'stroke="#8c7054" stroke-width="1.2" stroke-dasharray="4 4"');
    }
  }
  return out;
}
function validateCables(m){
  const cables=m.cables??[],finite=x=>Number.isFinite(x)&&Math.abs(x)<=1e8;
  if(!Array.isArray(cables)||cables.length>40)return false;
  return cables.every(c=>c&&typeof c.name==='string'&&c.name.length<=128&&finite(c.constant)&&Array.isArray(c.terms)&&c.terms.length>=2&&c.terms.length<=20&&new Set(c.terms.map(t=>t?.point)).size===c.terms.length&&
    c.terms.every(t=>t&&Number.isInteger(t.point)&&!!m.points[t.point]?.rail&&finite(t.weight)&&Math.abs(t.weight)>1e-8&&Math.abs(t.weight)<=20)&&
    Array.isArray(c.spins??[])&&(c.spins??[]).every(s=>s&&Number.isInteger(s.pulley)&&m.gears[s.pulley]?.kind==='pulley'&&Number.isInteger(s.point)&&!!m.points[s.point]?.rail&&[1,-1].includes(s.sign)&&finite(s.phase))&&
    (c.layout===undefined||c.layout==='tackle'&&Number.isInteger(c.movingPoint)&&!!m.points[c.movingPoint]&&Number.isInteger(c.loadPoint)&&!!m.points[c.loadPoint]&&c.spins?.length===2&&m.gears[c.spins[0].pulley].centerPoint===c.movingPoint));
}
function sliderTravel(source,q,id){const p=source.points[id],a=p.rail.angle*RAD;return (q[2*id]-p.rail.x)*Math.cos(a)+(q[2*id+1]-p.rail.y)*Math.sin(a);}
function pulleyEquations(){
  let out='';
  if(model.gears.some(g=>g.kind==='pulley'))out+='<h3>Pulleys and belts</h3><div class="reportMath">v = Rω; a_t = Rα; a_n = Rω²<br>Open belt: R₁ω₁ − R₂ω₂ = 0<br>Crossed belt: R₁ω₁ + R₂ω₂ = 0<br>Differentiate for angular acceleration.</div><ol><li>Mark the shaft centres and radius to each rim point.</li><li>For fixed shafts, draw the known rim velocity tangent to its circle. Equal belt speed determines the other wheel’s angular speed; open belts keep the rotation direction and crossed belts reverse it.</li><li>Draw inward normal acceleration Rω² and perpendicular tangential acceleration Rα. For a translating wheel, start from the centre velocity or acceleration endpoint.</li></ol><p>The belt law constrains tangential speed. Material-point accelerations around a curved rim include a normal term and must not be equated to the acceleration of a straight belt segment.</p>';
  for(const c of model.cables??[]){
    const terms=c.terms.map(t=>fmt(t.weight)+' s('+safe(model.points[t.point].name)+')').join(' + ');
    out+='<h3>'+safe(c.name)+'</h3><div class="reportMath">'+terms+' = '+distanceText(c.constant)+' '+displayUnits+'<br>Σ nᵢ vᵢ = 0<br>Σ nᵢ aᵢ = 0</div><ol><li>Choose a positive direction on each slider guide; s is measured from its guide origin.</li><li>Count changing straight rope segments. A translating pulley contributes twice when two parallel segments change length together. Give a negative coefficient to a segment that shortens with positive travel.</li><li>Differentiate constant total rope length once for velocity and twice for acceleration.</li><li>Use these signed scalar relations with the known guide directions to construct the vectors. Add the pulley-centre motion before rim normal and tangential terms.</li></ol>';
  }
  return out;
}
function beltExample(crossed=false){
  const m=normalizedModel({title:crossed?'Crossed belt drive':'Open belt drive',points:[],links:[],constraints:[],gears:[{name:'P1',kind:'pulley',radius:30,x:0,y:0,teeth:20,module:3,angle:0},{name:'P2',kind:'pulley',radius:60,x:150,y:0,teeth:20,module:6,angle:0}],meshes:[{a:0,b:1,type:crossed?'belt-crossed':'belt-open',phase:0}],shafts:[],drive:{type:'gear',id:0,position:0,speed:4,accel:2},displayUnits:'mm',inputMode:'manual'});return m;
}
function tackleExample(){
  return normalizedModel({title:'Moving pulley — two supporting strands',points:[{name:'C',x:60,y:-100,rail:{x:60,y:0,angle:90}},{name:'E',x:120,y:-140,rail:{x:120,y:0,angle:90}}],links:[],constraints:[],gears:[{name:'Moving pulley',kind:'pulley',radius:20,x:60,y:-100,centerPoint:0,teeth:20,module:2,angle:0},{name:'Fixed idler',kind:'pulley',radius:20,x:100,y:0,teeth:20,module:2,angle:0}],meshes:[],shafts:[],cables:[{name:'Inextensible rope',terms:[{point:0,weight:2},{point:1,weight:1}],constant:-340,spins:[{pulley:0,point:0,sign:1,phase:100},{pulley:1,point:1,sign:1,phase:140}],layout:'tackle',movingPoint:0,loadPoint:1}],drive:{type:'linear',id:1,position:-140,speed:-40,accel:-10},displayUnits:'mm',inputMode:'manual'});
}
