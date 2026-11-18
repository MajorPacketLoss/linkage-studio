"use strict";
function gearCenter(source,q,g){return Number.isInteger(g.centerPoint)?q.slice(2*g.centerPoint,2*g.centerPoint+2):[g.x,g.y];}
function gearCenterTerms(g,x,y){return Number.isInteger(g.centerPoint)?[[2*g.centerPoint,x],[2*g.centerPoint+1,y]]:[];}
function gearCenterRate(g,rate){return Number.isInteger(g.centerPoint)?rate.slice(2*g.centerPoint,2*g.centerPoint+2):[0,0];}
function gearMeshPhase(source,mesh,q){
  const a=source.gears[mesh.a],b=source.gears[mesh.b],base=2*source.points.length;
  if(isBelt(mesh))return gearRadius(a)*q[base+mesh.a]+(mesh.type==='belt-open'?-1:1)*gearRadius(b)*q[base+mesh.b];
  if(mesh.type==='shaft')return q[base+mesh.a]-q[base+mesh.b];
  const sign=mesh.type==='internal'?-1:1;
  const [ax,ay]=gearCenter(source,q,a),[bx,by]=gearCenter(source,q,b);
  return a.teeth*q[base+mesh.a]+sign*b.teeth*q[base+mesh.b]-(mesh.carrierAware?(a.teeth+sign*b.teeth)*Math.atan2(by-ay,bx-ax):0);
}
function refreshMovingMeshPhases(source){
  const q=modelCoordinates(source);
  for(const mesh of source.meshes){
    if(mesh.type!=='shaft'&&!isBelt(mesh))mesh.carrierAware=Number.isInteger(source.gears[mesh.a].centerPoint)||Number.isInteger(source.gears[mesh.b].centerPoint);
    mesh.phase=gearMeshPhase(source,mesh,q);
  }
}
function mountGear(id,kind,point){
  const g=model.gears[id],q=coord(model),center=gearCenter(model,q,g);
  const owned=g.freePoint?g.centerPoint:null;
  g.x=center[0];g.y=center[1];delete g.centerPoint;delete g.freePoint;
  // Remove only the private shaft point; ordinary user joints are retained.
  if(owned!==null&&(kind!=='joint'||owned!==point)&&!model.links.some(l=>l.pins.includes(owned))&&!model.gears.some((other,i)=>i!==id&&other.centerPoint===owned)){
    deletePoint(owned);if(point>owned)point--;
  }
  if(kind==='joint'){
    if(!model.points[point])throw Error('Choose a joint for the shaft.');
    g.centerPoint=point;g.x=model.points[point].x;g.y=model.points[point].y;
  }else if(kind==='free'){
    g.centerPoint=addPoint(...center);g.freePoint=true;model.points[g.centerPoint].name=g.name+' shaft';
  }
  const dx=g.x-center[0],dy=g.y-center[1],cluster=new Set([id]);
  let grew=true;while(grew){const n=cluster.size;for(const mesh of model.meshes)if(cluster.has(mesh.a)||cluster.has(mesh.b)){cluster.add(mesh.a);cluster.add(mesh.b);}grew=n!==cluster.size;}
  if(Math.hypot(dx,dy)>1e-7)for(const i of cluster)if(i!==id){
    const other=model.gears[i];
    if(Number.isInteger(other.centerPoint)||model.shafts.some(s=>s.gear===i)){
      if(cluster.size!==2)throw Error('Several shafts are attached. Align this train before changing its support.');
      const mesh=model.meshes.find(m=>m.a===id&&m.b===i||m.b===id&&m.a===i);
      if(!mesh||mesh.type==='shaft')throw Error('A common shaft must use the same joint.');
      const centers=modelCoordinates(model),ca=gearCenter(model,centers,g),cb=gearCenter(model,centers,other),distance=Math.hypot(cb[0]-ca[0],cb[1]-ca[1]);
      if(isBelt(mesh)){if(distance<=gearRadius(g)+gearRadius(other)||[g,other].some(w=>Number.isInteger(w.centerPoint)&&!model.points[w.centerPoint].fixed))throw Error('Belt drives require separated, stationary shafts.');break;}
      const module=2*distance/(mesh.type==='external'?g.teeth+other.teeth:Math.abs(g.teeth-other.teeth));
      if(!Number.isFinite(module)||module<.01||module>1000)throw Error('These shaft positions cannot accommodate the chosen gear pair.');
      if(g.sizeLocked||other.sizeLocked)throw Error('A fixed gear size prevents fitting this shaft location. Use compatible shaft spacing or unlock the pitch sizes.');
      g.module=module;other.module=module;break;
    }
    other.x+=dx;other.y+=dy;
  }
  if(model.meshes.some(m=>isBelt(m)&&(m.a===id||m.b===id))&&Number.isInteger(g.centerPoint)&&!model.points[g.centerPoint].fixed)throw Error('Remove the belt before mounting on a moving joint.');
  model.shafts=model.shafts.filter(s=>s.gear!==id);
  refreshMovingMeshPhases(model);
}
function attachGearToLink(gear,link,pivot){
  const g=model.gears[gear],l=model.links[link];
  if(!l.pins.includes(pivot))throw Error('The shaft joint must belong to the selected link.');
  if(model.shafts.some(s=>s.gear===gear||s.link===link))throw Error('Remove the existing rigid shaft attachment first.');
  mountGear(gear,'joint',pivot);
  const q=coord(model),[x,y]=vector(q,...l.pins.slice(0,2));
  model.shafts.push({gear,link,pivot:g.centerPoint,offset:Math.atan2(y,x)-g.angle});
}
function snappedGearConnection(source,a,b,type,policy='fit'){
  const next=clone(source),ga=next.gears[a],gb=next.gears[b];
  if(!ga||!gb||a===b)throw Error('Choose two different gears.');
  if(next.meshes.some(m=>(m.a===a&&m.b===b)||(m.a===b&&m.b===a)))throw Error('These gears are already connected.');
  if(type!=='shaft'&&(ga.kind==='pulley'||gb.kind==='pulley'))throw Error('Use an open or crossed belt to connect pulleys.');
  if(type!=='shaft'&&Math.abs(ga.module-gb.module)>1e-8){
    if(policy==='fit'&&!gb.sizeLocked&&!next.meshes.some(m=>m.a===b||m.b===b))gb.module=ga.module;
    else throw Error('Meshing gears need the same module. Choose automatic fit or set matching modules first.');
  }
  if(type==='internal'&&ga.teeth===gb.teeth)throw Error('An internal pair needs different tooth counts.');
  const q=coord(next),ca=gearCenter(next,q,ga),cb=gearCenter(next,q,gb),d=Math.hypot(cb[0]-ca[0],cb[1]-ca[1]);
  const required=type==='shaft'?0:type==='external'?gearRadius(ga)+gearRadius(gb):Math.abs(gearRadius(ga)-gearRadius(gb));
  if(Math.abs(d-required)>1e-6){
    if(policy==='keep')throw Error('The pitch circles do not meet. Choose automatic positioning or move the shafts first.');
    const ux=d?(cb[0]-ca[0])/d:1,uy=d?(cb[1]-ca[1])/d:0;
    const target=[ca[0]+required*ux,ca[1]+required*uy];let placed=false;
    if(Number.isInteger(gb.centerPoint)&&!next.points[gb.centerPoint].fixed){
      const grab=grabPoint(next,q,{type:'point',id:gb.centerPoint},cb);
      const pose=dragPose({...next,editLengths:true,constructionMode:true},q,grab,target,Math.max(12,d));
      if(pose){
        const ac=gearCenter(next,pose,ga),bc=gearCenter(next,pose,gb);
        if(Math.abs(Math.hypot(bc[0]-ac[0],bc[1]-ac[1])-required)<1e-5){storeConstructionPose(next,pose);placed=true;}
      }
    }else if(!Number.isInteger(gb.centerPoint)&&!next.meshes.some(m=>m.a===b||m.b===b)&&!next.shafts.some(s=>s.gear===b)){
      gb.x=target[0];gb.y=target[1];placed=true;
    }
    if(!placed){
      const canResize=policy==='fit'&&type!=='shaft'&&d>1e-6&&!next.meshes.some(m=>[a,b].includes(m.a)||[a,b].includes(m.b));
      if(!canResize)throw Error('The shaft cannot move without violating its construction or an existing connection. Choose automatic fit to resize independent gears to the shaft spacing.');
      const module=2*d/(type==='internal'?Math.abs(ga.teeth-gb.teeth):ga.teeth+gb.teeth);
      if(module<.01||module>1000)throw Error('This shaft spacing requires a module outside the supported range.');
      if(ga.sizeLocked||gb.sizeLocked){
        if(ga.sizeLocked&&gb.sizeLocked)throw Error('Both gear sizes are fixed; move their shafts to pitch contact.');
        const fixed=ga.sizeLocked?ga:gb,other=ga.sizeLocked?gb:ga;
        const teeth=type==='external'?2*d/fixed.module-fixed.teeth:fixed.teeth+(other.teeth>fixed.teeth?1:-1)*2*d/fixed.module;
        if(Math.abs(teeth-Math.round(teeth))>1e-7||teeth<8||teeth>200)throw Error('The fixed gear size requires an incompatible tooth count at this spacing.');
        other.teeth=Math.round(teeth);other.module=fixed.module;
      }else{ga.module=module;gb.module=module;}
    }
  }
  const mesh={a,b,type,carrierAware:Number.isInteger(ga.centerPoint)||Number.isInteger(gb.centerPoint)};
  mesh.phase=gearMeshPhase(next,mesh,coord(next));next.meshes.push(mesh);
  if(!validateGears(next))throw Error('This connection conflicts with existing shaft or pitch constraints.');
  return next;
}
