
"use strict";

const positionVectorTypes=[
  {key:"v",badge:"v",name:"Velocity",id:"VelocityVectors",unit:"/s",dark:"#55ecf1",light:"#006b78",dashed:false},
  {key:"a",badge:"a",name:"Acceleration",id:"AccelerationVectors",unit:"/s²",dark:"#ffae6e",light:"#a14315",dashed:true}
];
function overlayScale(vectors,maxLength,conversion){
  const largest=Math.max(0,...vectors.map(v=>magnitude(...v)));
  const target=largest*conversion*.37;
  if(target<=1e-12)return null;
  const power=10**Math.floor(Math.log10(target)), factor=target/power;
  const reference=(factor>=5?5:factor>=2?2:1)*power;
  return {reference,scale:maxLength/largest};
}
function positionArrow(base,tip,colour,dashed){
  const dx=tip[0]-base[0],dy=tip[1]-base[1],length=magnitude(dx,dy);
  if(length<.45)return "";
  const size=Math.min(8,length*.43), ux=dx/length,uy=dy/length;
  const tail=[tip[0]-ux*size,tip[1]-uy*size];
  const left=[tail[0]-uy*size*.45,tail[1]+ux*size*.45],right=[tail[0]+uy*size*.45,tail[1]-ux*size*.45];
  return line(base,tip,'stroke="'+colour+'" stroke-width="'+(dashed?3:2.1)+'"'+(dashed?' stroke-dasharray="5 3"':""))+
    '<path d="M '+left.join(" ")+' L '+tip.join(" ")+' L '+right.join(" ")+'" fill="none" stroke="'+colour+'" stroke-width="1.4" stroke-linejoin="round"/>';
}
function positionVectorMarkup(screen,motion){
  const {values,names,enabled,conversion,unit,width,height,light=false}=motion;
  const maxLength=Math.min(width,height)*.18;
  const backdrop=light?"white":"#101e32";
  let markup="", row=0;
  for(const type of positionVectorTypes){
    if(!enabled[type.key])continue;
    const vectors=values[type.key], scale=overlayScale(vectors,maxLength,conversion);
    const colour=light?type.light:type.dark, key=type.key;
    markup+='<g data-position-vector-kind="'+key+'">';
    const grouped=[];
    for(const [i,start] of screen.entries()){
      const value=vectors[i];
      if(!scale||magnitude(...value)<=1e-11)continue;
      const pair=grouped.find(p=>magnitude(start[0]-p.start[0],start[1]-p.start[1])<.001&&
        magnitude(value[0]-p.value[0],value[1]-p.value[1])<1e-8);
      if(pair)pair.names.push(names[i]);
      else grouped.push({start,value,names:[names[i]]});
    }
    for(const group of grouped){
      const {start,value,names:pinNames}=group,length=magnitude(...value);
      const tip=[start[0]+scale.scale*value[0],start[1]-scale.scale*value[1]];
      markup+=positionArrow(start,tip,colour,type.dashed);
      const side=type.dashed?-1:1;
      const x=Math.max(5,Math.min(width-5,tip[0]+side*9*value[1]/length));
      const y=Math.max(12,Math.min(height-5,tip[1]+side*9*value[0]/length));
      const label=key+(pinNames.length===1?pinNames[0]:"("+pinNames.join("/")+")");
      markup+=txt(x,y,label,'fill="'+colour+'" font-size="11" font-weight="700" text-anchor="'+(x>width-55?"end":"start")+
        '" paint-order="stroke" stroke="'+backdrop+'" stroke-width="3"');
    }
    const legendX=motion.legendX??15,y=(motion.legendY??21)+row++*22;
    const physical=unit+type.unit;
    if(scale){
      const extent=scale.reference/conversion*scale.scale;
      markup+=line([legendX,y],[legendX+extent,y],'stroke="'+colour+'" stroke-width="2"'+(type.dashed?' stroke-dasharray="4 2"':""))+
        txt(legendX+6+extent,y+3,Number(scale.reference.toPrecision(3))+" "+physical,'fill="'+colour+'" font-size="10" paint-order="stroke" stroke="'+backdrop+'" stroke-width="3"');
    }else{
      markup+=txt(legendX,y,type.name+" = 0 at all pins",'fill="'+colour+'" font-size="10" paint-order="stroke" stroke="'+backdrop+'" stroke-width="3"');
    }
    markup+="</g>";
  }
  return '<g pointer-events="none" aria-hidden="true">'+markup+'</g>';
}

