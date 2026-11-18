"use strict";
function constraintAffectsMotion(c){
  return c.physical??(c.type==='collinear'||c.type==='midpoint'||c.type==='coincident'||c.type==='angle'&&Number.isInteger(c.referenceLink));
}
function gearCarrierLink(source,a,b){
  const pivot=g=>Number.isInteger(g.centerPoint)?g.centerPoint:source.points.findIndex(p=>p.fixed&&Math.hypot(p.x-g.x,p.y-g.y)<1e-6);
  const pa=pivot(a),pb=pivot(b);
  return source.links.find(l=>pa!==pb&&l.pins.slice(0,2).includes(pa)&&l.pins.slice(0,2).includes(pb));
}
function fitGearsToLinks(source){
  const pivot=g=>Number.isInteger(g.centerPoint)?g.centerPoint:source.points.findIndex(p=>p.fixed&&Math.hypot(p.x-g.x,p.y-g.y)<1e-6);
  for(const mesh of source.meshes){
    if(mesh.type==='shaft'||isBelt(mesh))continue;
    const a=source.gears[mesh.a],b=source.gears[mesh.b],pa=pivot(a),pb=pivot(b);
    const link=source.links.find(l=>l.pins.slice(0,2).includes(pa)&&l.pins.slice(0,2).includes(pb)&&pa!==pb);
    if(!link)continue;
    const L=link.length,actual=mesh.type==='external'?gearRadius(a)+gearRadius(b):Math.abs(gearRadius(a)-gearRadius(b));
    if(Math.abs(L-actual)<1e-7)continue;
    if(a.sizeLocked&&b.sizeLocked)throw Error('Both gear sizes are fixed. Unlock a gear size before changing this carrier length.');
    if(a.sizeLocked||b.sizeLocked){
      const fixed=a.sizeLocked?a:b,other=a.sizeLocked?b:a;
      const teeth=mesh.type==='external'?2*L/fixed.module-fixed.teeth:fixed.teeth+(other.teeth>fixed.teeth?1:-1)*2*L/fixed.module;
      if(Math.abs(teeth-Math.round(teeth))>1e-7||teeth<8||teeth>200)throw Error('This carrier length needs a fractional or unsupported tooth count while one gear size is fixed. Unlock both sizes or choose a compatible length.');
      other.module=fixed.module;other.teeth=Math.round(teeth);
    }else{
      const module=2*L/(mesh.type==='external'?a.teeth+b.teeth:Math.abs(a.teeth-b.teeth));
      if(module<.01||module>1000)throw Error('The resized carrier requires a gear module outside the supported range.');
      a.module=module;b.module=module;
    }
  }
}
function closeEditedDrawing(){
  syncTracerDimensions(model);
  fitGearsToLinks(model);
  const closed=closePosition({...model,constructionMode:true},coord(model));
  if(closed.error>1e-6)throw Error('The edit conflicts with a fixed joint, locked length or another constraint. The previous drawing was restored.');
  storeConstructionPose(model,closed.q);
  updateDrivePosition(closed.q);
  return closed.q;
}
function objectsInsideBox(a,b){
  const xlo=Math.min(a.x,b.x),xhi=Math.max(a.x,b.x),ylo=Math.min(a.y,b.y),yhi=Math.max(a.y,b.y),q=scene();
  const inside=p=>p[0]>=xlo&&p[0]<=xhi&&p[1]>=ylo&&p[1]<=yhi;
  const picked=[];
  model.points.forEach((p,i)=>{if(inside(project(q[2*i],q[2*i+1])))picked.push({type:'point',id:i});});
  model.links.forEach((l,i)=>{if(l.pins.every(p=>inside(project(q[2*p],q[2*p+1]))))picked.push({type:'link',id:i});});
  model.gears.forEach((g,i)=>{if(inside(project(...gearCenter(model,q,g))))picked.push({type:'gear',id:i});});
  return picked;
}
function objectSelected(type,id){return selection?.type===type&&selection.id===id||multiSelection.some(item=>item.type===type&&item.id===id);}
