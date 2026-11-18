
"use strict";

const polygonExplanations=new Map();
function polygonExplanationState(id){
  if(!polygonExplanations.has(id))polygonExplanations.set(id,{open:false,key:"pole",parts:[],signature:""});
  return polygonExplanations.get(id);
}
function explanationText(part,format,unit){
  const value=part.value;
  const values=value?'<dl class="polygonValues">'+
    '<div><dt>x component</dt><dd>'+safe(format(value[0])+" "+unit)+'</dd></div>'+
    '<div><dt>y component</dt><dd>'+safe(format(value[1])+" "+unit)+'</dd></div>'+
    '<div><dt>'+(part.coordinate?"Distance from O":"Magnitude")+'</dt><dd>'+safe(format(magnitude(...value))+" "+unit)+'</dd></div></dl>':"";
  return '<p><strong>'+safe(part.label)+'</strong></p><p>'+safe(part.text)+'</p>'+
    (part.equation?'<p class="polygonEquation">'+safe(part.equation)+'</p>':"")+values+
    (value&&!part.coordinate&&magnitude(...value)<=1e-9?'<p>Zero vector. Its two ends coincide at this pose.</p>':"");
}
function updatePolygonExplanation(id,parts,format,unit){
  const panel=$(id+"Explanation"),svg=$(id),state=polygonExplanationState(id);
  if(!panel||!svg)return;
  if(state.panel!==panel){
    state.panel=panel;
    state.signature="";
    panel.innerHTML='<summary>Explain polygon parts</summary>'+
      '<div class="polygonExplanationBody"><label>Part <select aria-label="Polygon part"></select></label>'+
      '<p class="polygonExplainHint">Select a line or point in the polygon, or choose a part here.</p>'+
      '<div class="polygonExplainContent" role="status"></div></div>';
    panel.open=state.open;
    panel.ontoggle=()=>{
      state.open=panel.open;
      if(state.panel===panel&&$(id))drawPolygonExplanation(id);
    };
    panel.querySelector("select").onchange=event=>selectPolygonPart(id,event.target.value);
  }
  state.parts=parts;
  state.format=format;
  state.unit=unit;
  if(!parts.some(part=>part.id===state.key))state.key="pole";
  const signature=JSON.stringify(parts.map(p=>[p.id,p.category,p.label]));
  const field=panel.querySelector("select");
  if(signature!==state.signature){
    state.signature=signature;
    const categories=new Map();
    for(const p of parts){
      if(!categories.has(p.category))categories.set(p.category,[]);
      categories.get(p.category).push('<option value="'+safe(p.id)+'">'+safe(p.label)+'</option>');
    }
    field.innerHTML=Array.from(categories,([category,options])=>'<optgroup label="'+safe(category)+'">'+options.join("")+'</optgroup>').join("");
    field.disabled=!parts.length;
  }
  drawPolygonExplanation(id);
}
function selectPolygonPart(id,key){
  if(!key)return;
  const state=polygonExplanationState(id);
  if(!state.parts.some(part=>part.id===key))return;
  state.open=true;
  state.key=key;
  state.panel.open=true;
  drawPolygonExplanation(id);
}
function drawPolygonExplanation(id){
  const {panel,key,parts,format,unit}=polygonExplanationState(id);
  const field=panel.querySelector("select"), box=panel.querySelector(".polygonExplainContent");
  const part=parts.find(p=>p.id===key);
  field.value=key;
  const content=part?explanationText(part,format,unit):"<p>Solve the mechanism to inspect its polygon.</p>";
  if(box.dataset.content!==content){box.innerHTML=content;box.dataset.content=content;}
  $(id).querySelectorAll("[data-polygon-part]").forEach(node=>{
    const matches=node.dataset.polygonPart===key||node.dataset.polygonMembers?.split(" ").includes(key);
    node.classList.toggle("polygonPicked",panel.open&&Boolean(matches));
  });
}
function polygonPartAt(target){
  return target?.closest?.("[data-polygon-part]")?.dataset.polygonPart;
}

function explainVector(id,kind,a,b,value,accel,role){
  const q=accel?"a":"v", quantity=accel?"acceleration":"velocity";
  const path=a+" → "+b, name=a+b;
  switch(kind){
    case "abs": {
      let text="From pole O to "+b+". Its vector gives the "+quantity+" of pin "+b+" relative to the fixed frame.";
      if(role==="fixed")text+=" This grounded pin stays at the pole.";
      if(role==="slider")text+=" The guide constrains its motion to the guide direction.";
      if(role==="crank")text+=accel?" For the driven crank it is the sum of the inward normal and tangential components.":" For the driven crank it is perpendicular to the crank, with sense set by the signed angular speed.";
      const equation=role==="fixed"?q+"("+b+") = (0, 0)":role==="crank"
        ?(accel?"a("+b+") = α J r − ω²r":"v("+b+") = ω J r"):q+"("+b+") − "+q+"(O) = "+q+"("+b+")";
      return {id,category:"Absolute vectors",label:b+" · Absolute "+quantity,text,equation,value};
    }
    case "rel":
      return {id,category:"Relative vectors",label:path+" · Relative "+quantity,value,
        text:"Subtract the "+quantity+" of "+a+" from that of "+b+". "+(accel?
          "This is the sum of the normal and tangential components for the directed link "+name+".":
          "Both pins lie on the same rigid link, so the relative velocity is perpendicular to "+name+"."),
        equation:accel?"a("+b+") − a("+a+") = α J r("+name+") − ω² r("+name+")":
          "v("+b+") − v("+a+") = ω J r("+name+")"};
    case "norm":
      return {id,category:"Acceleration components",label:path+" · Normal",value,
        text:"Start at the absolute acceleration of "+a+". The normal component points along "+name+" from "+b+" toward "+a+". Its magnitude is ω² times the pin separation.",
        equation:"aₙ("+b+"/"+a+") = −ω² r("+name+")"};
    case "tan":
      return {id,category:"Acceleration components",label:path+" · Tangential",value,
        text:"Start at the tip of the normal component and finish at the absolute acceleration of "+b+". The segment is perpendicular to "+name+" and its sense follows the sign of α.",
        equation:"aₜ("+b+"/"+a+") = α J r("+name+")"};
  }
}

