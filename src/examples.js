"use strict";
const LENGTH_UNITS=Object.freeze({
  mm:{name:"Millimetres",perMM:1},cm:{name:"Centimetres",perMM:.1},
  m:{name:"Metres",perMM:.001},in:{name:"Inches",perMM:1/25.4},ft:{name:"Feet",perMM:1/304.8}
});
function normalizedModel(input){
  return {...input,schemaVersion:4,cables:input.cables??[],constraints:input.constraints.map(c=>({...c,...((input.schemaVersion??2)<3&&["midpoint","coincident"].includes(c.type)?{physical:true}:{})})),inputMode:input.inputMode??(input.drive?"manual":"auto"),links:input.links.map(l=>({...l,lengthLocked:l.lengthLocked??true})),gears:input.gears??[],meshes:input.meshes??[],shafts:input.shafts??[]};
}
function modelCoordinates(m){
  return [...m.points.flatMap(p=>[p.x,p.y]),...(m.gears??[]).map(g=>g.angle??0)];
}
function intersectCircles(a,ra,b,rb,side=1){
  const x=b[0]-a[0],y=b[1]-a[1],d=Math.hypot(x,y);
  const u=(ra*ra-rb*rb+d*d)/(2*d),h=Math.sqrt(Math.max(0,ra*ra-u*u));
  return [a[0]+u*x/d-side*h*y/d,a[1]+u*y/d+side*h*x/d];
}
function linkageExample(title,positions,edges,fixed=[],rails={},angle=40){
  const points=positions.map(([x,y],i)=>({name:String.fromCharCode(65+i),x,y,...(fixed.includes(i)?{fixed:true}:{}),...(rails[i]?{rail:rails[i]}:{})}));
  const links=edges.map(([a,b],i)=>({name:i===0?"Crank":"Link "+(i+1),lengthLocked:true,pins:[a,b],length:Math.hypot(points[b].x-points[a].x,points[b].y-points[a].y)}));
  return normalizedModel({title,points,links,inputMode:"auto",constraints:[],drive:{type:"rotary",id:0,position:angle,speed:2,accel:0},displayUnits:"mm"});
}
function fourBarExample(){
  const angle=40*RAD,B=[35*Math.cos(angle),35*Math.sin(angle)];
  const C=intersectCircles(B,110,[120,0],80);
  return linkageExample("Four-bar crank rocker",[[0,0],B,C,[120,0]],[[0,1],[1,2],[3,2]],[0,3]);
}
function sliderExample(offset=0){
  const angle=45*RAD,B=[40*Math.cos(angle),40*Math.sin(angle)];
  const C=[B[0]+Math.sqrt(130*130-(offset-B[1])**2),offset];
  return linkageExample(offset?"Offset slider crank":"Slider crank",[[0,0],B,C],[[0,1],[1,2]],[0],{2:{x:0,y:offset,angle:0}},45);
}
function sixBarExample(){
  const m=fourBarExample(),C=[m.points[2].x,m.points[2].y],F=[200,0];
  const E=intersectCircles(C,110,F,90);
  m.title="Coupled six-bar";
  m.points.push({name:"E",x:E[0],y:E[1]},{name:"F",x:F[0],y:F[1],fixed:true});
  m.links.push({name:"Second coupler",pins:[2,4],length:110},{name:"Output rocker",pins:[5,4],length:90});
  return m;
}
function trammelExample(){
  const theta=35*RAD;
  return linkageExample("Elliptical trammel",[[0,-100*Math.sin(theta)],[100*Math.cos(theta),0]],[[0,1]],[],
    {0:{x:0,y:0,angle:90},1:{x:0,y:0,angle:0}},35);
}
function gearExample(compound=false){
  const gears=[
    {name:"G1",x:0,y:0,teeth:20,module:2,angle:0},
    {name:"G2",x:60,y:0,teeth:40,module:2,angle:0}
  ];
  const meshes=[{a:0,b:1,type:"external",phase:0}];
  if(compound){
    gears.push({name:"G3",x:60,y:0,teeth:16,module:2,angle:0},{name:"G4",x:124,y:0,teeth:48,module:2,angle:0});
    meshes.push({a:1,b:2,type:"shaft",phase:0},{a:2,b:3,type:"external",phase:0});
  }
  return normalizedModel({inputMode:"auto",title:compound?"Compound gear reduction":"Spur gear pair",points:[],links:[],constraints:[],gears,meshes,
    drive:{type:"gear",id:0,position:0,speed:3,accel:.5},displayUnits:"mm"});
}
function gearedSliderExample(){
  const m=sliderExample();m.title="Gear-driven slider crank";
  const base=m.points[0];
  m.gears=[{name:"Driver",x:-60,y:0,teeth:40,module:2,angle:0},{name:"Crank gear",x:0,y:0,teeth:20,module:2,angle:45*RAD}];
  m.meshes=[{a:0,b:1,type:"external",phase:20*45*RAD}];
  m.shafts=[{gear:1,link:0,offset:0}];
  m.drive={type:"gear",id:0,position:0,speed:1,accel:0};
  return m;
}
function internalGearExample(){
  const m=gearExample();
  m.title="Internal gear pair";
  m.gears[1].name="Ring";
  m.gears[1].x=20;
  m.meshes[0].type="internal";
  return m;
}
function planetaryCarrierExample(){
  const angle=35*RAD,R=60;
  const m=linkageExample('Planet on a rotating carrier',[[0,0],[R*Math.cos(angle),R*Math.sin(angle)]],[[0,1]],[0],{},35);
  m.inputMode='manual';m.links[0].name='Carrier';m.points[1].name='P';
  m.gears=[{name:'Sun',x:0,y:0,teeth:20,module:2,angle:0,rotationLocked:true},
    {name:'Planet',x:m.points[1].x,y:m.points[1].y,centerPoint:1,teeth:40,module:2,angle:0}];
  m.meshes=[{a:0,b:1,type:'external',carrierAware:true,phase:-60*angle}];
  return m;
}
const EXAMPLES=[
  {id:"fourbar",name:"Four-bar crank rocker",family:"Linkages",description:"A rotating crank and an oscillating rocker connected by a coupler.",build:fourBarExample},
  {id:"slider",name:"Slider crank",family:"Linkages",description:"Rotary motion converted into reciprocating translation.",build:()=>sliderExample()},
  {id:"offset",name:"Offset slider crank",family:"Linkages",description:"A guide offset from the crank centre creates unequal stroke timing.",build:()=>sliderExample(25)},
  {id:"sixbar",name:"Coupled six-bar",family:"Linkages",description:"Two four-bar loops with dimensions chosen for a complete input crank revolution.",build:sixBarExample},
  {id:"trammel",name:"Elliptical trammel",family:"Linkages",description:"A fixed-length bar connects perpendicular sliders.",build:trammelExample},
  {id:"gears",name:"Spur gear pair",family:"Gears",description:"Fixed-axis external gears with a 2:1 speed reduction.",build:()=>gearExample()},
  {id:"compound",name:"Compound gear reduction",family:"Gears",description:"Two external meshes and a common shaft give a 6:1 reduction.",build:()=>gearExample(true)},
  {id:"internal",name:"Internal gear pair",family:"Gears",description:"A pinion and ring rotate in the same direction at a 2:1 ratio.",build:internalGearExample},
  {id:"geared-slider",name:"Gear-driven slider crank",family:"Combined",description:"A spur pair drives the input crank through a common shaft.",build:gearedSliderExample},
  {id:"planet-carrier",name:"Planet on a rotating carrier",family:"Moving shafts",description:"A planet wheel follows the carrier joint and rolls around a fixed sun. Demonstrates carrier-relative gear analysis.",build:planetaryCarrierExample}
];

EXAMPLES.push({id:'belt-open',name:'Open belt drive',family:'Pulleys',description:'No-slip fixed-shaft belt transmission with rim vectors.',build:()=>beltExample(false)},{id:'belt-crossed',name:'Crossed belt drive',family:'Pulleys',description:'Opposite wheel rotation, normal and tangential acceleration.',build:()=>beltExample(true)},{id:'tackle',name:'Moving pulley and rope',family:'Pulleys',description:'Two supporting strands give half the endpoint speed. Includes a fixed idler and worked rope equations.',build:()=>tackleExample()});
