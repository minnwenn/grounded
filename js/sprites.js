/* Pixel sprites drawn as SVG rects (no images, tiny, crisp on any screen). */
var COL = {o:"#721F1F", B:"#A4643C", c:"#8a4f2c", h:"#C98A5E", w:"#FFE597", r:"#BB758A", g:"#F4CE5B", v:"#9A922B", k:"#3a1010", s:"#8a6a3a", m:"#6d7020"};

function rects(list, ox, oy){
  return list.map(function(p){return '<rect x="'+(p[0]+ox)+'" y="'+(p[1]+oy)+'" width="1" height="1" fill="'+(COL[p[2]]||p[2])+'"/>';}).join("");
}
function grid(rows, ox, oy){
  var out=[];
  rows.forEach(function(row,y){for(var x=0;x<row.length;x++){var ch=row[x];if(ch!=="."&&COL[ch])out.push([x,y,ch]);}});
  return rects(out,ox||0,oy||0);
}
function svg(w,h,inner,px,label){
  return '<svg class="px" role="img" aria-label="'+(label||"")+'" width="'+w*px+'" height="'+h*px+'" viewBox="0 0 '+w+' '+h+'">'+inner+'</svg>';
}

/* ---------- Bean Buddy: a sticker-style coffee bean with a sprout that grows as the student finishes steps ----------
 * The bean is generated from an ellipse (shading, outline, white sticker border) so it is easy to retune.
 * Everything is drawn as merged SVG rects on a BW x BH pixel grid. */
var BW=30,BH=49,CXI=15,CYI=34;
var BC={ring:"#FFFFFF",ink:"#4a2410",b1:"#B56F3E",b2:"#98582D",b3:"#7A4322",hi:"#D69A62",spec:"#F0C896",crease:"#6a3718",face:"#2a1008",
  blush:"#E58B8B",tear:"#8EC5E8",mould:"#6d7020",gold:"#F4CE5B",gold2:"#D9A92E",rose:"#BB758A",roseL:"#E3A0B2",wine:"#721F1F",white:"#FFFFFF",
  leafL:"#A9CC3E",leafM:"#6FA52F",leafD:"#2f4a14",stem:"#4F8024",green:"#7FA33A",
  wL:"#CDBB52",wM:"#A39534",wD:"#4a3f14",wS:"#7A6B26"};   // w* = wilted greens
function blank(){var g=[];for(var y=0;y<BH;y++)g.push(new Array(BW));return g;}
function put(g,x,y,c){x=Math.round(x);y=Math.round(y);if(x>=0&&x<BW&&y>=0&&y<BH)g[y][x]=c;}
function clone(g){return g.map(function(r){return r.slice();});}
/* merge horizontal runs of the same colour into single rects */
function emit(g,opacity){
  var out=[];
  for(var y=0;y<BH;y++){var x=0;while(x<BW){var c=g[y][x];if(!c){x++;continue;}var x2=x;while(x2+1<BW&&g[y][x2+1]===c)x2++;
    out.push('<rect x="'+x+'" y="'+y+'" width="'+(x2-x+1)+'" height="1" fill="'+c+'"/>');x=x2+1;}}
  return '<g'+(opacity?' opacity="'+opacity+'"':'')+'>'+out.join("")+'</g>';
}
/* add a 1px outline around every filled pixel of a layer that is still empty */
function outline(g,col,only){
  var add=[];
  for(var y=0;y<BH;y++)for(var x=0;x<BW;x++){
    if(g[y][x])continue;
    if([[1,0],[-1,0],[0,1],[0,-1]].some(function(d){var c=(g[y+d[1]]||[])[x+d[0]];return c&&(!only||only.indexOf(c)>-1);}))add.push([x,y]);
  }
  add.forEach(function(p){g[p[1]][p[0]]=col;});
}

var BODY=(function(){
  var RX=9.6,RY=12.2,TH=-0.28,co=Math.cos(TH),si=Math.sin(TH),g=blank(),mask=blank(),topY=BH;
  for(var y=0;y<BH;y++)for(var x=0;x<BW;x++){
    var dx=x+.5-CXI,dy=y+.5-CYI,u=dx*co+dy*si,v=-dx*si+dy*co,d=Math.sqrt(u*u/(RX*RX)+v*v/(RY*RY));
    if(d>1){if(d<=1.2)g[y][x]=BC.ring;continue;}
    mask[y][x]=1;if(y<topY)topY=y;
    var col;
    if(d>0.885)col=BC.ink;
    else{
      var t=(dx*-0.55+dy*-0.83)/10;                          // > 0 towards the light, upper left
      col=BC.b1;
      if(t<-0.30)col=BC.b2;
      if(t<-0.58)col=BC.b3;
      if(t>0.42&&d<0.80)col=BC.hi;
      if(t>0.62&&d<0.66)col=BC.spec;
      var cu=6.1+1.1*Math.sin(v/RY*Math.PI*1.15);            // an S-shaped crease down the right side, clear of the face
      if(Math.abs(u-cu)<0.8&&Math.abs(v)<0.86*RY)col=BC.crease;
    }
    g[y][x]=col;
  }
  var xs=[];for(var x2=0;x2<BW;x2++)if(mask[topY][x2])xs.push(x2);
  return {g:g,mask:mask,topY:topY,topX:Math.round((xs[0]+xs[xs.length-1])/2)};
})();

/* ----- faces: pixels relative to the middle of the bean ----- */
function F(list,col){return list.map(function(p){return [CXI+p[0],CYI+p[1],col||BC.face];});}
var FACES={
  happy:F([[-5,-7],[-4,-7],[-5,-6],[-4,-6],[-5,-5],[-4,-5],[2,-7],[3,-7],[2,-6],[3,-6],[2,-5],[3,-5],[-3,-2],[-2,-1],[-1,-1],[0,-1],[1,-1],[2,-2]]).concat(F([[-5,-7],[2,-7]],BC.white),F([[-8,-3],[-7,-3],[5,-3],[6,-3]],BC.blush)),
  celebrate:F([[-6,-5],[-5,-6],[-4,-6],[-3,-5],[2,-5],[3,-6],[4,-6],[5,-5],[-3,-3],[-2,-3],[-1,-3],[0,-3],[1,-3],[2,-3],[-2,-2],[-1,-2],[0,-2],[1,-2]]).concat(F([[-1,-1],[0,-1]],BC.blush),F([[-8,-3],[-7,-3],[5,-3],[6,-3]],BC.blush)),
  sleepy:F([[-6,-6],[-5,-5],[-4,-5],[-3,-6],[2,-6],[3,-5],[4,-5],[5,-6],[-2,-2],[-1,-2],[0,-2]]).concat(F([[-8,-3],[-7,-3],[5,-3],[6,-3]],BC.blush)),
  sad:F([[-5,-6],[-4,-6],[-5,-5],[-4,-5],[2,-6],[3,-6],[2,-5],[3,-5],[-6,-8],[-5,-8],[-4,-9],[4,-9],[3,-8],[2,-8],[-3,-1],[-2,-2],[-1,-2],[0,-2],[1,-2],[2,-1]]).concat(F([[-6,-4],[-6,-3],[-6,-2]],BC.tear)),
  mouldy:F([[-6,-7],[-3,-7],[-5,-6],[-4,-6],[-6,-5],[-3,-5],[1,-7],[4,-7],[2,-6],[3,-6],[1,-5],[4,-5],[-3,-1],[-2,-2],[-1,-1],[0,-2],[1,-1],[2,-2]])
};
var MOULD=[[-7,-3],[-6,-3],[-6,-2],[6,2],[7,2],[7,1],[3,8],[4,8],[-3,6],[-2,6],[-3,7],[5,-4],[6,-5]];

/* ----- accessories ----- */
function dome(g,topX,y0,half,fill,band){        // y0 = bottom row; half = half-widths from the bottom row up
  half.forEach(function(w,i){for(var x=-w;x<=w;x++)put(g,topX+x,y0-i,(i===0&&band)?band:fill);});
}
var HEAD={   // each returns how many rows it lifts the sprout
  cap:function(g,tx,ty){var y0=ty+2;dome(g,tx,y0,[7,7,6,4,2],BC.rose);for(var x=-12;x<=-6;x++){put(g,tx+x,y0,BC.rose);put(g,tx+x,y0+1,BC.wine);}put(g,tx-3,y0-3,BC.roseL);put(g,tx-4,y0-2,BC.roseL);return 5;},
  crown:function(g,tx,ty){var y0=ty+2;for(var x=-6;x<=6;x++){put(g,tx+x,y0,BC.gold2);put(g,tx+x,y0-1,BC.gold);put(g,tx+x,y0-2,BC.gold);}[-6,-3,0,3,6].forEach(function(x){for(var k=3;k<=(x===0?6:5);k++)put(g,tx+x,y0-k,BC.gold);put(g,tx+x,y0-(x===0?7:6),BC.rose);});put(g,tx-4,y0-1,BC.white);put(g,tx,y0-1,BC.rose);return 7;},
  sproutHat:function(g,tx,ty){var y0=ty+2;dome(g,tx,y0,[6,6,5,3],BC.green,BC.white);put(g,tx-3,y0-2,BC.leafL);put(g,tx-4,y0-1,BC.leafL);return 4;}
};
var FACEACC={
  glasses:function(g){var y=CYI-8;for(var x=-7;x<=6;x++)put(g,CXI+x,y,BC.face);[[-7,-6],[1,-6]].forEach(function(l){for(var yy=y+1;yy<=y+3;yy++)for(var x=l[0];x<l[0]+6;x++)put(g,CXI+x+0,yy,BC.face);});
    put(g,CXI-6,y+1,BC.white);put(g,CXI+2,y+1,BC.white);put(g,CXI-5,y+2,"#6b6b6b");put(g,CXI+3,y+2,"#6b6b6b");}
};
var NECK={
  scarf:function(g,mask){for(var y=CYI+4;y<=CYI+5;y++)for(var x=0;x<BW;x++)if(mask[y][x])g[y][x]=(y===CYI+5&&x%4===0)?BC.white:BC.rose;
    for(var y2=CYI+6;y2<=CYI+9;y2++)for(var x2=CXI+3;x2<=CXI+5;x2++)if(mask[y2][x2])g[y2][x2]=(y2===CYI+8)?BC.white:BC.rose;},
  medal:function(g){var cx=CXI,cy=CYI+7;put(g,cx-3,cy-4,BC.rose);put(g,cx-2,cy-3,BC.rose);put(g,cx-1,cy-2,BC.rose);put(g,cx+3,cy-4,BC.rose);put(g,cx+2,cy-3,BC.rose);put(g,cx+1,cy-2,BC.rose);
    for(var y=-2;y<=2;y++)for(var x=-2;x<=2;x++)if(x*x+y*y<=5)put(g,cx+x,cy+y,(x*x+y*y>=4)?BC.gold2:BC.gold);put(g,cx-1,cy-1,BC.white);}
};

/* ----- the sprout: grows with the student's steps (stage 0 to 6) ----- */
var SPROUT=[            // pairs: [height of the leaf's base above the head, leaf size]
  {stem:2,pairs:[[2,2]],tip:null},
  {stem:3,pairs:[[3,3]],tip:null},
  {stem:4,pairs:[[4,4]],tip:null},
  {stem:6,pairs:[[3,3],[6,4]],tip:null},
  {stem:8,pairs:[[2,3],[5,4],[8,4]],tip:null},
  {stem:9,pairs:[[2,3],[5,4],[8,3]],tip:"rosebud"},
  {stem:9,pairs:[[2,3],[5,4],[8,3]],tip:"flower"}
];
function sproutSVG(stage,ax,ay,wilt){
  var def=SPROUT[Math.max(0,Math.min(SPROUT.length-1,stage))];
  var L=wilt?BC.wL:BC.leafL,M=wilt?BC.wM:BC.leafM,D=wilt?BC.wD:BC.leafD,S=wilt?BC.wS:BC.stem;
  var leaf=blank(),stem=blank(),bloom=blank();
  for(var h=0;h<=def.stem;h++)put(stem,ax,ay-h,S);
  def.pairs.forEach(function(p){
    var y0=ay-p[0];
    [-1,1].forEach(function(side){
      for(var k=1;k<=p[1];k++){
        put(leaf,ax+side*k,y0-(k-1),k===p[1]?L:M);                 // the leaf's spine climbs at 45 degrees
        if(k>=2)put(leaf,ax+side*(k-1),y0-(k-1),L);                // a lighter upper half
      }
    });
  });
  outline(leaf,D);
  var top=ay-def.stem;
  if(def.tip==="rosebud"){[[0,-3],[-1,-2],[0,-2],[1,-2],[-1,-1],[0,-1],[1,-1]].forEach(function(p){put(bloom,ax+p[0],top+p[1],BC.rose);});put(bloom,ax,top-3,BC.roseL);put(bloom,ax-1,top-2,BC.roseL);}
  if(def.tip==="flower"){
    for(var y=-2;y<=2;y++)for(var x=-2;x<=2;x++){var d=Math.abs(x)+Math.abs(y);if(d<=2||(Math.abs(x)===1&&Math.abs(y)===1))put(bloom,ax+x,top-4+y,(x===0&&y===0)?BC.gold:(x<=0&&y<=0?BC.roseL:BC.rose));}
  }
  outline(bloom,BC.wine);
  return emit(stem)+emit(leaf)+emit(bloom);    // stem first, so the leaf and bloom outlines stay clean
}

function sparkle(g,cx,cy){   // white star with an amber edge, so it shows on both the pale page and the gold card
  [[0,-3],[0,-2],[0,-1],[0,1],[0,2],[0,3],[-3,0],[-2,0],[-1,0],[1,0],[2,0],[3,0],[0,0],[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(p){put(g,cx+p[0],cy+p[1],BC.white);});
  outline(g,"#C98A1B");
}

/* mood: happy|celebrate|sleepy|sad|mouldy. grow: sprout stage 0-6 (the student's progress). */
function buddySVG(mood, equipped, px, grow){
  mood=FACES[mood]?mood:"happy";
  var g=clone(BODY.g),wilt=mood==="sad"||mood==="mouldy",tx=BODY.topX,ty=BODY.topY,lift=0;
  if(mood==="mouldy")MOULD.forEach(function(p){put(g,CXI+p[0],CYI+p[1],BC.mould);});
  var eq=equipped||{};
  if(eq.neck&&NECK[eq.neck])NECK[eq.neck](g,BODY.mask);
  FACES[mood].forEach(function(p){put(g,p[0],p[1],p[2]);});
  if(eq.face&&FACEACC[eq.face])FACEACC[eq.face](g);
  if(eq.head&&HEAD[eq.head])lift=HEAD[eq.head](g,tx,ty);
  var sp=blank();
  var anchorY=ty+1-lift;
  var droop=mood==="mouldy"?26:mood==="sad"?14:mood==="sleepy"?8:0;
  var inner=emit(g);
  inner+='<g transform="rotate('+droop+' '+tx+' '+anchorY+')"><g class="sprout-sway">'+sproutSVG(grow||0,tx,anchorY,wilt)+'</g></g>';
  if(mood==="happy"||mood==="celebrate"){
    var s1=blank(),s2=blank();sparkle(s1,4,15);sparkle(s2,26,21);
    inner+='<g class="sparkle">'+emit(s1)+'</g><g class="sparkle" style="animation-delay:.9s">'+emit(s2)+'</g>';
    if(mood==="celebrate"){var s3=blank();sparkle(s3,3,43);sparkle(s3,26,44);inner+='<g class="sparkle" style="animation-delay:.45s">'+emit(s3)+'</g>';}
  }
  if(mood==="sleepy"){var z=blank();[[0,0],[1,0],[2,0],[1,1],[0,2],[1,2],[2,2]].forEach(function(p){put(z,24+p[0],22+p[1],BC.white);});put(z,26,19,BC.white);put(z,27,19,BC.white);put(z,27,20,BC.white);put(z,26,21,BC.white);put(z,27,21,BC.white);inner+=emit(z);}
  var scale=Math.max(2,Math.round((px||10)*0.58));
  return svg(BW,BH,inner,scale,"Bean Buddy feeling "+mood+", sprout stage "+(grow||0));
}
function accSVG(id,px){
  // small preview: the bean faded, with the accessory in full colour
  var g=blank(),tx=BODY.topX,ty=BODY.topY,base=clone(BODY.g),inner;
  if(HEAD[id])HEAD[id](g,tx,ty);else if(FACEACC[id])FACEACC[id](g);else if(NECK[id])NECK[id](g,BODY.mask);
  inner=emit(base,0.3)+emit(g);
  return svg(BW,BH,inner,Math.max(2,Math.round((px||4)*0.58)),id);
}

/* Plants: stage 0 seed mound, 1 sprout, 2 leafy, 3 full */
function plantSVG(kind,stage,color,px){
  COL.p=color||"#BB758A";
  var soil=[[1,9,"s"],[2,9,"s"],[3,9,"s"],[4,9,"s"],[5,9,"s"],[6,9,"s"],[7,9,"s"],[8,9,"s"],[2,8,"s"],[3,8,"s"],[4,8,"s"],[5,8,"s"],[6,8,"s"],[7,8,"s"]];
  var st=[
    [],
    [[4,7,"v"],[4,6,"v"],[3,6,"v"],[5,5,"v"]],
    [[4,7,"v"],[4,6,"v"],[4,5,"v"],[3,5,"v"],[2,4,"v"],[5,4,"v"],[6,3,"v"],[3,4,"v"],[5,5,"v"]],
    [[4,7,"v"],[4,6,"v"],[4,5,"v"],[4,4,"v"],[3,5,"v"],[2,4,"v"],[5,5,"v"],[6,4,"v"],
     [3,1,"p"],[4,1,"p"],[5,1,"p"],[3,2,"p"],[4,2,"g"],[5,2,"p"],[3,3,"p"],[4,3,"p"],[5,3,"p"]]
  ][Math.max(0,Math.min(3,stage))];
  return svg(10,10,rects(soil.concat(st),0,0),px||5,kind+" growth stage "+stage);
}


/* ---------- forest plants: 10 wide x 12 tall, base on the bottom row ---------- */
COL.m="#6d7020";
var FOREST_SPRITES={
  tree:[
    [],
    ["....v.....","...vvv....","....s....."],
    ["....mm....","...mvvm...","..mvvvvm..",".mvvvvvvm.","....ss...."],
    ["....mm....","...mvvm...","...mvvm...","..mvvvvm..","..mvvvvm..",".mvvvvvvm.",".mvvvvvvm.","mvvvvvvvvm","....ss....","....ss...."]
  ],
  bush:[
    [],
    ["..........","...vvvv...","..vvvvvv.."],
    ["..........",".mvvvvvm..","mvvpvvvvm.","mvvvvvpvvm"],
    ["...vvvv...",".mvvvpvvm.","mvvpvvvvvm","mvvvvvpvvm","mvpvvvvvvm"]
  ],
  flower:[
    [],
    ["..........","....v.....","...vv....."],
    ["....p.....","....v.....","..v.v.v...","...vvv....","....v....."],
    ["...ppp....","...pgp....","...ppp....","....v.....","..v.v.v...","...vvv....","....v....."]
  ]
};
/* returns SVG rect markup in a 10x12 box. Stage 0 is a bare soil mound. */
function forestInner(kind,stage,color){
  COL.p=color||"#BB758A";
  var st=Math.max(0,Math.min(3,stage)),rows=st===0?["..........","...ssss...","..ssssss.."]:(FOREST_SPRITES[kind]||FOREST_SPRITES.flower)[st];
  var out=[];
  rows.forEach(function(row,i){
    var y=12-rows.length+i;
    for(var x=0;x<row.length;x++){var ch=row[x];if(ch!=="."&&COL[ch])out.push('<rect x="'+x+'" y="'+y+'" width="1" height="1" fill="'+COL[ch]+'"/>');}
  });
  return out.join("");
}

function forestHeight(kind,stage){
  var st=Math.max(0,Math.min(3,stage));
  return st===0?3:((FOREST_SPRITES[kind]||FOREST_SPRITES.flower)[st]||[]).length;
}

/* pixel camera icon for the photo step; takes its colour from the surrounding text */
function cameraIcon(px){
  var rows=["....cccc....","cccccccccccc","ccccc..ccccc","cccc.cc.cccc","cccc.cc.cccc","ccccc..ccccc","cccccccccccc"],out="";
  rows.forEach(function(r,y){for(var x=0;x<r.length;x++)if(r[x]==="c")out+='<rect x="'+x+'" y="'+y+'" width="1" height="1" fill="currentColor"/>';});
  return '<svg class="px" width="'+12*px+'" height="'+7*px+'" viewBox="0 0 12 7" aria-hidden="true">'+out+'</svg>';
}
