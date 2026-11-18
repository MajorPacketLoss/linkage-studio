"use strict";

const RAD = Math.PI / 180;
const magnitude = (x, y) => Math.hypot(x, y);
const cross = (x, y, u, v) => x * v - y * u;
const vector = (q, a, b) => [q[2 * b] - q[2 * a], q[2 * b + 1] - q[2 * a + 1]];

function layoutRows(model, q, drive, velocity) {
  const rows = [];
  const add = (terms, target = 0, speed = 0, accel = 0) => {
    const j = Array(q.length).fill(0);
    for (const [i, weight] of terms) j[i] += weight;
    rows.push({j, error:dot(j,q)-target, speed, accel});
  };
  const delta = (a,b,x,y) => [[2*a,-x],[2*a+1,-y],[2*b,x],[2*b+1,y]];
  const {points, links, constraints} = model;
  for (let i=0; i<points.length; i++) {
    const p = points[i];
    if (p.fixed) {
      add([[2*i,1]],p.x);
      add([[2*i+1,1]],p.y);
    }
    if (p.rail) {
      const {x,y,angle} = p.rail;
      const c=Math.cos(angle*RAD), s=Math.sin(angle*RAD);
      add([[2*i,-s],[2*i+1,c]], -s*x+c*y);
      if (drive?.type==="linear" && drive.id===i) {
        add([[2*i,c],[2*i+1,s]], c*x+s*y+drive.position, drive.speed, drive.accel);
      }
    }
  }
  for (const [i, link] of links.entries()) {
    const [a,b,...rest] = link.pins;
    const L = link.length;
    if (drive?.type==="rotary" && drive.id===i) {
      const c=Math.cos(drive.position*RAD), s=Math.sin(drive.position*RAD);
      const w=drive.speed, alpha=drive.accel;
      add(delta(a,b,1,0), L*c, -L*s*w, -L*(c*w*w+s*alpha));
      add(delta(a,b,0,1), L*s, L*c*w, L*(c*alpha-s*w*w));
    } else if(!model.editLengths||link.lengthLocked!==false) {
      const [x,y] = vector(q,a,b);
      const j = Array(q.length).fill(0);
      for (const [index,weight] of delta(a,b,x/L,y/L)) j[index] += weight;
      const [u,v] = velocity ? vector(velocity,a,b) : [0,0];
      rows.push({j,error:(x*x+y*y-L*L)/(2*L),speed:0,accel:-(u*u+v*v)/L});
    }
    for (const [k,p] of rest.entries()) {
      const dimension=link.tracerDimensions?.[k];
      if(model.editLengths&&dimension){
        const [x,y]=vector(q,a,b),len=Math.hypot(x,y),nx=x/len,ny=y/len,u=dimension.along/len,v=dimension.normal/len;
        const M=[[u,-v],[v,u]],P=[[1-nx*nx,-nx*ny],[-nx*ny,1-ny*ny]],K=M.map(row=>[row[0]*P[0][0]+row[1]*P[1][0],row[0]*P[0][1]+row[1]*P[1][1]]);
        for(let axis=0;axis<2;axis++){
          const j=Array(q.length).fill(0);j[2*p+axis]=1;
          for(let t=0;t<2;t++){j[2*a+t]+=K[axis][t]-(t===axis?1:0);j[2*b+t]-=K[axis][t];}
          rows.push({j,error:q[2*p+axis]-q[2*a+axis]-M[axis][0]*x-M[axis][1]*y,speed:0,accel:0});
        }continue;
      }
      const [u,v] = link.attach[k];
      add([...delta(a,p,1,0),...delta(a,b,-u,v)]);
      add([...delta(a,p,0,1),...delta(a,b,-v,-u)]);
    }
  }
  for (const constraint of constraints) {
    if(!model.constructionMode&&!constraintAffectsMotion(constraint))continue;
    const {type,p,b} = constraint;
    if(type==='collinear'){
      const [a,b]=links[constraint.link].pins,[x,y]=vector(q,a,b),L=links[constraint.link].length;
      const targets=Number.isInteger(constraint.referenceLink)?links[constraint.referenceLink].pins.slice(0,2):[constraint.p];
      for(const point of targets){
        if(point===a||point===b)continue;
        const [u,v]=vector(q,a,point),j=Array(q.length).fill(0);
        for(const [i,w] of [[2*a,y-v],[2*a+1,u-x],[2*b,v],[2*b+1,-u],[2*point,-y],[2*point+1,x]])j[i]+=w/L;
        const vr=velocity?vector(velocity,a,b):[0,0],vp=velocity?vector(velocity,a,point):[0,0];
        rows.push({j,error:(x*v-y*u)/L,speed:0,accel:-2*cross(...vr,...vp)/L});
      }
    }else     if(type==='angle'){
      const j=Array(q.length).fill(0);
      const orientation=(link,sign)=>{
        const [a,b]=links[link].pins,[x,y]=vector(q,a,b),d2=x*x+y*y;
        if(d2<1e-12)return 0;
        for(const [i,w] of delta(a,b,-y/d2*sign,x/d2*sign))j[i]+=w;
        return Math.atan2(y,x);
      };
      const angle=orientation(constraint.link,1)-(Number.isInteger(constraint.referenceLink)?orientation(constraint.referenceLink,-1):0);
      const error=Math.atan2(Math.sin(angle-constraint.angle*RAD),Math.cos(angle-constraint.angle*RAD));
      rows.push({j,error,speed:0,accel:0});
    }else if (type==="midpoint") {
      const [u,v] = links[constraint.link].pins;
      for (let k=0;k<2;k++) add([[2*p+k,1],[2*u+k,-0.5],[2*v+k,-0.5]]);
    } else {
      if (type==="coincident" || type==="vertical") add(delta(p,b,1,0));
      if (type==="coincident" || type==="horizontal") add(delta(p,b,0,1));
    }
  }
  const gearOffset=2*points.length;
  for(const [i,gear] of (model.gears??[]).entries()){
    if(gear.rotationLocked)add([[gearOffset+i,1]],gear.angle,0,0);
    if(drive?.type==="gear"&&drive.id===i)add([[gearOffset+i,1]],drive.position*RAD,drive.speed,drive.accel);
  }
  for(const mesh of model.meshes??[]){
    const a=model.gears[mesh.a],b=model.gears[mesh.b];
    if(isBelt(mesh)){
      const ra=gearRadius(a),rb=gearRadius(b),sign=mesh.type==='belt-open'?-1:1,scale=Math.max(ra,rb);
      add([[gearOffset+mesh.a,ra/scale],[gearOffset+mesh.b,sign*rb/scale]],mesh.phase/scale);continue;
    }
    const weights=mesh.type==="shaft"?[1,-1]:[a.teeth,(mesh.type==="internal"?-1:1)*b.teeth];
    const scale=Math.max(...weights.map(Math.abs));
    const ca=gearCenter(model,q,a),cb=gearCenter(model,q,b),x=cb[0]-ca[0],y=cb[1]-ca[1],d2=x*x+y*y;
    const moving=Number.isInteger(a.centerPoint)||Number.isInteger(b.centerPoint);
    const relativeTerms=(u,v)=>[...gearCenterTerms(a,-u,-v),...gearCenterTerms(b,u,v)];
    const editableCarrier=model.editLengths&&!a.sizeLocked&&!b.sizeLocked&&gearCarrierLink(model,a,b)?.lengthLocked===false;
    if(moving){
      if(mesh.type==="shaft"){
        for(const [u,v,error] of [[1,0,x],[0,1,y]]){
          const j=Array(q.length).fill(0);for(const [i,w] of relativeTerms(u,v))j[i]+=w;
          rows.push({j,error,speed:0,accel:0});
        }
      }else if(!editableCarrier){
        const L=(mesh.type==="external"?a.module*a.teeth+b.module*b.teeth:Math.abs(a.module*a.teeth-b.module*b.teeth))/2;
        const j=Array(q.length).fill(0);for(const [i,w] of relativeTerms(x/L,y/L))j[i]+=w;
        const va=velocity?gearCenterRate(a,velocity):[0,0],vb=velocity?gearCenterRate(b,velocity):[0,0];
        rows.push({j,error:(d2-L*L)/(2*L),speed:0,accel:-((vb[0]-va[0])**2+(vb[1]-va[1])**2)/L});
      }
    }
    if(mesh.carrierAware&&mesh.type!=="shaft"&&d2>1e-12){
      const K=weights[0]+weights[1],j=Array(q.length).fill(0);
      j[gearOffset+mesh.a]=weights[0]/scale;j[gearOffset+mesh.b]=weights[1]/scale;
      for(const [i,w] of relativeTerms(K*y/d2/scale,-K*x/d2/scale))j[i]+=w;
      let phi=Math.atan2(y,x);
      if(K){const expected=(weights[0]*q[gearOffset+mesh.a]+weights[1]*q[gearOffset+mesh.b]-mesh.phase)/K;phi+=2*Math.PI*Math.round((expected-phi)/(2*Math.PI));}
      const va=velocity?gearCenterRate(a,velocity):[0,0],vb=velocity?gearCenterRate(b,velocity):[0,0],vx=vb[0]-va[0],vy=vb[1]-va[1];
      rows.push({j,error:(weights[0]*q[gearOffset+mesh.a]+weights[1]*q[gearOffset+mesh.b]-K*phi-mesh.phase)/scale,speed:0,accel:K*(-2*(x*vx+y*vy)*(x*vy-y*vx)/(d2*d2))/scale});
    }else add([[gearOffset+mesh.a,weights[0]/scale],[gearOffset+mesh.b,weights[1]/scale]],mesh.phase/scale);
  }
  for(const shaft of model.shafts??[]){
    const [a,b]=links[shaft.link].pins;
    const theta=q[gearOffset+shaft.gear]+shaft.offset;
    const L=links[shaft.link].length,c=Math.cos(theta),s=Math.sin(theta);
    if(model.editLengths&&links[shaft.link].lengthLocked===false){
      const [x,y]=vector(q,a,b),j=Array(q.length).fill(0);
      j[2*a]=s;j[2*a+1]=-c;j[2*b]=-s;j[2*b+1]=c;
      j[gearOffset+shaft.gear]=-c*x-s*y;
      rows.push({j,error:-s*x+c*y,speed:0,accel:0});
      continue;
    }
    const w=velocity?.[gearOffset+shaft.gear]??0;
    const make=(k,target,derivative,accel)=>{
      const j=Array(q.length).fill(0);
      j[2*b+k]=1;j[2*a+k]=-1;j[gearOffset+shaft.gear]=derivative;
      rows.push({j,error:q[2*b+k]-q[2*a+k]-target,speed:0,accel});
    };
    make(0,L*c,L*s,-L*c*w*w);
    make(1,L*s,-L*c,-L*s*w*w);
  }
  for(const cable of model.cables??[]){
    const terms=[],origin= cable.terms.reduce((sum,t)=>{const p=points[t.point],a=p.rail.angle*RAD;terms.push([2*t.point,t.weight*Math.cos(a)],[2*t.point+1,t.weight*Math.sin(a)]);return sum+t.weight*(p.rail.x*Math.cos(a)+p.rail.y*Math.sin(a));},0);
    add(terms,cable.constant+origin);
    for(const spin of cable.spins??[]){const p=points[spin.point],a=p.rail.angle*RAD,R=gearRadius(model.gears[spin.pulley]);add([[gearOffset+spin.pulley,R],[2*spin.point,-spin.sign*Math.cos(a)],[2*spin.point+1,-spin.sign*Math.sin(a)]],spin.phase-spin.sign*(p.rail.x*Math.cos(a)+p.rail.y*Math.sin(a)));}
  }
  return rows;
}

function dot(a,b) {
  return a.reduce((sum,x,i) => sum+x*b[i], 0);
}

// Pivoted QR by modified Gram-Schmidt. Free columns receive zero correction.
function leastSquares(matrix, rhs, n) {
  const columns = Array.from({length:n},(_,i)=>matrix.map(row=>row[i]));
  const order = columns.map((_,i)=>i);
  const R = Array.from({length:n},()=>Array(n).fill(0));
  const reduced = [];
  let rank = 0;
  let scale = 1;
  for (let k=0;k<n;k++) {
    let best = k, norm = -1;
    for (let j=k;j<n;j++) {
      const candidate = dot(columns[j],columns[j]);
      if (candidate>norm) { best=j; norm=candidate; }
    }
    const diagonal = Math.sqrt(Math.max(norm,0));
    if (k===0) scale=Math.max(diagonal,1);
    if (diagonal<1e-9*scale) break;
    [columns[k],columns[best]]=[columns[best],columns[k]];
    [order[k],order[best]]=[order[best],order[k]];
    for (let i=0;i<k;i++) [R[i][k],R[i][best]]=[R[i][best],R[i][k]];
    R[k][k] = diagonal;
    const basis = columns[k].map(x=>x/diagonal);
    reduced[k] = dot(basis,rhs);
    for (let j=k+1;j<n;j++) {
      const factor = dot(basis,columns[j]);
      R[k][j]=factor;
      columns[j]=columns[j].map((x,i)=>x-factor*basis[i]);
    }
    rank++;
  }
  const x=Array(n).fill(0);
  const pivoted=Array(n).fill(0);
  for (let k=rank-1;k>=0;k--) {
    pivoted[k]=(reduced[k]-dot(R[k],pivoted))/R[k][k];
    x[order[k]]=pivoted[k];
  }
  const error = Math.max(0,...matrix.map((row,i)=>Math.abs(dot(row,x)-rhs[i])));
  return {x,rank,error};
}

function closePosition(model, seed, drive = null) {
  let q = seed.slice();
  const rows = () => layoutRows(model,q,drive);
  const residual = rs => Math.max(0,...rs.map(r=>Math.abs(r.error)));
  for (let i=0;i<50;i++) {
    const rs = rows();
    if (residual(rs)<2e-8) break;
    const step=leastSquares(rs.map(r=>r.j),rs.map(r=>-r.error),q.length).x;
    const old=q;
    const oldNorm=dot(rs.map(r=>r.error),rs.map(r=>r.error));
    for (let f=1;f>=1/2048;f/=2) {
      q=old.map((x,k)=>x+f*step[k]);
      const errors=rows().map(r=>r.error);
      if (dot(errors,errors)<oldNorm) break;
      q=old;
    }
    if (q===old) break;
  }
  return {q,error:residual(rows())};
}

function solveModel(model, seed, drive = model.drive) {
  const {q,error}=closePosition(model,seed,drive);
  const rows = v=>layoutRows(model,q,drive,v);
  const rs=rows();
  const matrix=rs.map(r=>r.j);
  const before=layoutRows(model,q,null).map(r=>r.j);
  const dof=q.length-leastSquares(before,before.map(()=>0),q.length).rank;
  if (!q.length) return {q,dof,error,status:"empty"};
  if (!(error<1e-6)) return {q,dof,error,status:"inconsistent"};
  if (!drive) return {q,dof,error,status:"no-drive"};
  const v=leastSquares(matrix,rs.map(r=>r.speed),q.length);
  if (v.rank<q.length) return {q,dof,error,status:"indeterminate"};
  const accelRows=rows(v.x);
  const a=leastSquares(matrix,accelRows.map(r=>r.accel),q.length);
  if (v.error>1e-6*Math.max(1,...rs.map(r=>Math.abs(r.speed))) ||
      a.error>1e-6*Math.max(1,...accelRows.map(r=>Math.abs(r.accel)))) {
    return {q,dof,error,status:"incompatible"};
  }
  return {q,v:v.x,a:a.x,dof,error,status:"solved"};
}

function grabPoint(model, q, item, cursor) {
  const makeRow=()=>Array(q.length).fill(0);
  const horizontal=makeRow(), vertical=makeRow();
  if (item.type==="point") {
    horizontal[2*item.id]=1;
    vertical[2*item.id+1]=1;
  } else {
    const [a,b]=model.links[item.id].pins;
    const [x,y]=vector(q,a,b);
    const u=cursor[0]-q[2*a], v=cursor[1]-q[2*a+1], length2=x*x+y*y;
    if (length2<1e-12) return null;
    const along=(x*u+y*v)/length2, offset=cross(x,y,u,v)/length2;
    horizontal[2*a]=1-along;
    horizontal[2*a+1]=offset;
    horizontal[2*b]=along;
    horizontal[2*b+1]=-offset;
    vertical[2*a]=-offset;
    vertical[2*a+1]=1-along;
    vertical[2*b]=offset;
    vertical[2*b+1]=along;
  }
  return [horizontal,vertical];
}

// Project a cursor step onto the constraint tangent, then restore exact closure.
// Only accept closed configurations that bring the grabbed point closer.
function dragPose(model, seed, grab, destination, stepLimit = 12) {
  let {q,error}=closePosition(model,seed);
  if (!(error<1e-6)) return null;
  const difference=pose=>destination.map((value,i)=>value-dot(grab[i],pose));
  for (let iteration=0;iteration<8;iteration++) {
    const remaining=difference(q);
    const distance=magnitude(...remaining);
    if (distance<1e-8) break;
    const remove=(row,from)=>{
      const component=dot(row,from);
      return from.map((x,i)=>x-component*row[i]);
    };
    const basis=[];
    for (const {j} of layoutRows(model,q,null)) {
      const perpendicular=basis.reduce((row,axis)=>remove(axis,row),j);
      const norm=Math.sqrt(dot(perpendicular,perpendicular));
      if (norm>1e-9*Math.max(1,Math.sqrt(dot(j,j)))) {
        basis.push(perpendicular.map(x=>x/norm));
      }
    }
    const [x,y]=grab.map(row=>basis.reduce((value,axis)=>remove(axis,value),row));
    const xx=dot(x,x)+1e-7, xy=dot(x,y), yy=dot(y,y)+1e-7;
    const determinant=xx*yy-xy*xy;
    const [dx,dy]=remaining;
    const wx=(yy*dx-xy*dy)/determinant, wy=(xx*dy-xy*dx)/determinant;
    const step=x.map((value,i)=>value*wx+y[i]*wy);
    const size=Math.sqrt(dot(step,step));
    if (size<1e-8) break;
    let accepted=false;
    for (let fraction=Math.min(1,stepLimit/size);fraction>1e-5;fraction/=2) {
      const candidate=closePosition(model,q.map((value,i)=>value+fraction*step[i]));
      if (candidate.error<1e-6 && magnitude(...difference(candidate.q))<distance-1e-8) {
        q=candidate.q;
        accepted=true;
        break;
      }
    }
    if (!accepted) break;
  }
  return q;
}

function angular(link, result) {
  const [a,b]=link.pins;
  const [x,y]=vector(result.q,a,b);
  const [vx,vy]=vector(result.v,a,b);
  const [ax,ay]=vector(result.a,a,b);
  const L2=x*x+y*y;
  return {angle:Math.atan2(y,x)/RAD,w:cross(x,y,vx,vy)/L2,alpha:cross(x,y,ax,ay)/L2};
}
if (typeof module!=="undefined") module.exports={solveModel,angular,vector,grabPoint,dragPose,layoutRows};
