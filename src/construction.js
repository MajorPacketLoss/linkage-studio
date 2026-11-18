"use strict";
function storeConstructionPose(source,q){
  source.points.forEach((p,i)=>{if(!p.fixed){p.x=q[2*i];p.y=q[2*i+1];}});
  source.links.forEach(l=>{if(l.lengthLocked===false)l.length=Math.max(.001,magnitude(...vector(q,...l.pins.slice(0,2))));});
  syncTracerDimensions(source);
  source.gears.forEach((g,i)=>g.angle=q[2*source.points.length+i]);
}
function addConstructionConstraint(constraint){
  seedCurrent();const candidate=clone(model);
  // Replacing a link's angle is more useful than stacking conflicting dimensions.
  if(constraint.type==='angle')candidate.constraints=candidate.constraints.filter(c=>c.type!=='angle'||c.link!==constraint.link||c.referenceLink!==constraint.referenceLink);
  candidate.constraints.push({...constraint,physical:constraintAffectsMotion(constraint),construction:true});
  if(constraint.type==='collinear'){
    const [a,b]=candidate.links[constraint.link].pins,A=candidate.points[a],B=candidate.points[b],dx=B.x-A.x,dy=B.y-A.y,L=Math.hypot(dx,dy),ux=dx/L,uy=dy/L;
    if(Number.isInteger(constraint.referenceLink)){
      const l=candidate.links[constraint.referenceLink],[c,d]=l.pins,C=candidate.points[c],D=candidate.points[d];
      const sign=(D.x-C.x)*ux+(D.y-C.y)*uy<0?-1:1,length=Math.hypot(D.x-C.x,D.y-C.y);
      if(!D.fixed){if(!C.fixed){const t=(C.x-A.x)*ux+(C.y-A.y)*uy;C.x=A.x+t*ux;C.y=A.y+t*uy;}D.x=C.x+sign*length*ux;D.y=C.y+sign*length*uy;}
      else if(!C.fixed){C.x=D.x-sign*length*ux;C.y=D.y-sign*length*uy;}
    }else{
      const p=candidate.points[constraint.p];if(!p.fixed){const t=(p.x-A.x)*ux+(p.y-A.y)*uy;p.x=A.x+t*ux;p.y=A.y+t*uy;}
    }
  }
  let closed={q:coord(candidate),error:0};
  const entry=candidate.constraints.at(-1),target=constraint.angle;
  let start=0,delta=0,steps=1;
  if(constraint.type==='angle'){
    const direction=id=>{const [x,y]=vector(closed.q,...candidate.links[id].pins.slice(0,2));return Math.atan2(y,x)/RAD;};
    start=direction(constraint.link)-(Number.isInteger(constraint.referenceLink)?direction(constraint.referenceLink):0);
    delta=Math.atan2(Math.sin((target-start)*RAD),Math.cos((target-start)*RAD))/RAD;
    steps=Math.max(1,Math.ceil(Math.abs(delta)/8));
  }
  for(let i=1;i<=steps;i++){
    if(constraint.type==='angle')entry.angle=start+delta*i/steps;
    closed=closePosition({...candidate,editLengths:true,constructionMode:true},closed.q);
    if(closed.error>1e-6)break;
  }
  if(constraint.type==='angle')entry.angle=target;
  if(closed.error>1e-6){notice='Construction conflicts with locked lengths, ground pivots or another construction relation. Unlock a length or remove the conflicting relation.';renderDrive();return false;}
  storeConstructionPose(candidate,closed.q);
  return edit(()=>{model=candidate;updateDrivePosition(closed.q);staged=null;tool='select';},true);
}
function openAngleConstraint(link=selection?.type==='link'?selection.id:0){
  if(!model.links.length){notice='Draw a link before setting an angle.';renderDrive();return;}
  $('angleLink').innerHTML=model.links.map((l,i)=>'<option value="'+i+'">'+safe(l.name+' · '+labelFor(model,l))+'</option>').join('');
  $('angleReference').innerHTML='<option value="">Horizontal +X axis</option>'+model.links.map((l,i)=>'<option value="'+i+'">'+safe(l.name)+'</option>').join('');
  $('angleLink').value=String(link??0);$('angleReference').value='';$('anglePhysical').checked=false;
  $('angleReference').onchange=()=>{$('anglePhysical').checked=$('angleReference').value!=='';};
  const [x,y]=vector(scene(),...model.links[Number($('angleLink').value)].pins.slice(0,2));
  $('angleValue').value=fmt(Math.atan2(y,x)/RAD,3);$('angleMessage').textContent='';$('angleDialog').showModal();
}
