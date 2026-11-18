"use strict";

const polygonConstructions=new Map();
function polygonConstructionSteps(source,solution,parts,accel){
  if(!parts.length)return [];
  const quantity=accel?'acceleration':'velocity';
  const base=['pole','axis-x','axis-y','grid','scale',...parts.filter(p=>p.id.startsWith('abs-')&&p.value&&magnitude(...p.value)<1e-9).map(p=>p.id)];
  const steps=[{label:'Set the pole and scale',text:'Place O at zero '+quantity+'. Grounded pins and any other zero vectors coincide with O. Use the scale bar for the current drawing.',ids:base}];
  const drive=source.drive;
  if(drive){
    const name=drive.type==='linear'?source.points[drive.id].name:drive.type==='gear'?source.gears[drive.id].name:source.links[drive.id].name;
    steps.push({label:'Start with the motion input · '+name,text:'Use the prescribed '+(drive.type==='linear'?'slider speed and acceleration':'angular speed and angular acceleration')+' at this pose. The guide and rigid-link, shaft, gear and rope constraints determine the remaining rates. Coupled loops are solved together before tracing their vectors.',ids:[]});
  }
  for(const mesh of source.meshes){
    const a=source.gears[mesh.a].name,b=source.gears[mesh.b].name;
    const relation=mesh.type==='shaft'?'Both wheels share angular rates.':mesh.type.startsWith('belt-')?'Use equal signed belt speed Rω and tangential acceleration Rα. '+(mesh.type==='belt-open'?'The wheels rotate in the same sense.':'The wheels rotate in opposite senses.'):'Use the tooth-count ratio relative to the line joining the shaft centres; include carrier motion for moving shafts.';
    steps.push({label:'Transfer motion · '+a+' / '+b,text:relation+' Material-point vectors also include shaft-centre motion.',ids:[]});
  }
  for(const cable of source.cables??[]){
    steps.push({label:'Resolve rope motion · '+cable.name,text:'Differentiate '+cable.terms.map(t=>t.weight+' s('+source.points[t.point].name+')').join(' + ')+' = constant. The same signed coefficients relate slider speeds and accelerations; draw each vector along its guide.',ids:[]});
  }
  const covered=new Set(base);
  const add=(part,extra=[])=>{
    steps.push({label:part.label,text:part.text,equation:part.equation,value:part.value,ids:[part.id,...extra],coordinate:part.coordinate});
    covered.add(part.id);extra.forEach(id=>covered.add(id));
  };
  for(const part of parts.filter(p=>p.category==='Construction lines'))add(part);
  if(accel){
    for(const part of parts.filter(p=>p.id.startsWith('norm-'))){
      const suffix=part.id.slice(5),tip='tip-'+suffix,tangent=parts.find(p=>p.id==='tan-'+suffix);
      add(part,[tip]);
      if(tangent)add(tangent);
    }
  }
  for(const part of parts.filter(p=>p.id.startsWith('abs-')&&!covered.has(p.id)))add(part);
  for(const part of parts.filter(p=>p.id.startsWith('rel-')))add(part);
  steps.push({label:'Check the complete polygon',text:'Check the vector components, loop closure and scale. Relative velocities are perpendicular to rigid links. Acceleration components sum to each endpoint; a pulley or gear material point includes centre motion plus inward normal and tangential terms.',ids:parts.map(p=>p.id),complete:true});
  return steps;
}
function updatePolygonConstruction(id,parts,format,unit){
  const panel=$(id+'Steps');
  if(!panel)return;
  let state=polygonConstructions.get(id);
  if(!state){state={open:false,step:0,signature:''};polygonConstructions.set(id,state);}
  state.steps=polygonConstructionSteps(model,result,parts,id==='acceleration');
  state.format=format;state.unit=unit;
  const signature=JSON.stringify(state.steps.map(s=>s.ids));
  if(signature!==state.signature||state.source!==model){state.step=0;state.signature=signature;state.source=model;}
  state.step=Math.min(state.step,Math.max(0,state.steps.length-1));
  if(state.panel!==panel){
    state.panel=panel;
    panel.innerHTML='<summary>Step-by-step polygon drawing</summary><div class="polygonStepBody"><p>Trace the solved current mechanism, including custom links, sliders, gears and pulleys.</p><div class="polygonStepControls"><button id="'+id+'StepPrevious" type="button" aria-label="Previous construction step">Previous</button><output id="'+id+'StepCount"></output><button id="'+id+'StepNext" type="button" aria-label="Next construction step">Next</button><button id="'+id+'StepComplete" type="button">Show complete</button></div><label>Drawing progress<input id="'+id+'StepProgress" aria-label="'+(id==='acceleration'?'Acceleration':'Velocity')+' drawing progress" type="range" min="0" step="1"></label><div id="'+id+'StepText" role="status"></div></div>';
    panel.open=state.open;
    panel.ontoggle=()=>{state.open=panel.open;drawPolygonConstruction(id);};
    $(id+'StepPrevious').onclick=()=>{state.step=Math.max(0,state.step-1);drawPolygonConstruction(id);};
    $(id+'StepNext').onclick=()=>{state.step=Math.min(state.steps.length-1,state.step+1);drawPolygonConstruction(id);};
    $(id+'StepProgress').oninput=event=>{state.step=Number(event.target.value);drawPolygonConstruction(id);};
    $(id+'StepComplete').onclick=()=>{state.step=Math.max(0,state.steps.length-1);drawPolygonConstruction(id);};
  }
  drawPolygonConstruction(id);
}
function drawPolygonConstruction(id){
  const state=polygonConstructions.get(id);
  if(!state)return;
  const {steps,step,format,unit}=state,part=steps[step];
  $(id+'StepPrevious').disabled=!part||step===0;
  $(id+'StepNext').disabled=!part||step===steps.length-1;
  $(id+'StepProgress').disabled=!part;
  $(id+'StepComplete').disabled=!part||Boolean(part.complete);
  $(id+'StepProgress').max=Math.max(0,steps.length-1);$(id+'StepProgress').value=step;
  $(id+'StepCount').textContent=part?(step+1)+' / '+steps.length:'No solved polygon';
  $(id+'StepText').innerHTML=part?explanationText(part,format,unit):'<p>Solve the mechanism to generate its drawing steps.</p>';
  const revealed=new Set(steps.slice(0,step+1).flatMap(s=>s.ids));
  for(const node of $(id).querySelectorAll('[data-polygon-part]')){
    const ids=node.dataset.polygonMembers?.split(' ')??[node.dataset.polygonPart];
    const pending=state.open&&!part?.complete&&!ids.some(key=>revealed.has(key));
    node.classList.toggle('polygonPending',pending);
    node.classList.toggle('polygonStepCurrent',state.open&&!pending&&Boolean(part?.ids.some(key=>ids.includes(key))));
  }
}
