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

var BEAN = [
  "....oooo....","..ooBBBBoo..",".oBhBBBBBBo.",".oBhBBcBBBo.","oBBBBBcBBBBo","oBBBBBcBBBBo","oBBBBBBcBBBo","oBBBBBcBBBBo","oBBBBBcBBBBo",".oBBBBBBBBo.",".oBBBBBBBBo.","..ooBBBBoo..","....oooo...."
];
var FACES = {
  happy:[[3,5,"k"],[8,5,"k"],[4,7,"k"],[7,7,"k"],[5,8,"k"],[6,8,"k"]],
  sleepy:[[2,5,"k"],[3,5,"k"],[3,6,"k"],[8,5,"k"],[9,5,"k"],[8,6,"k"],[5,8,"k"],[6,8,"k"],[10,1,"w"],[11,0,"w"]],
  sad:[[3,5,"k"],[3,6,"k"],[8,5,"k"],[8,6,"k"],[4,8,"k"],[5,7,"k"],[6,7,"k"],[7,8,"k"]],
  celebrate:[[2,6,"k"],[3,5,"k"],[4,6,"k"],[7,6,"k"],[8,5,"k"],[9,6,"k"],[5,7,"k"],[6,7,"k"],[5,8,"o"],[6,8,"o"],
             [0,1,"g"],[11,2,"r"],[1,0,"v"],[10,0,"g"]],
  mouldy:[[3,5,"k"],[3,6,"k"],[8,5,"k"],[8,6,"k"],[4,8,"k"],[5,7,"k"],[6,7,"k"],[7,8,"k"],
          [2,3,"m"],[3,3,"m"],[8,8,"m"],[9,8,"m"],[9,4,"m"],[3,9,"m"]]
};
var ACC = {
  cap:[[3,0,"r"],[4,0,"r"],[5,0,"r"],[6,0,"r"],[7,0,"r"],[8,0,"r"],[2,1,"r"],[3,1,"r"],[4,1,"r"],[5,1,"r"],[6,1,"r"],[7,1,"r"],[8,1,"r"],[9,1,"r"],[9,2,"r"],[10,2,"r"],[11,2,"r"]],
  crown:[[3,0,"g"],[5,0,"g"],[7,0,"g"],[9,0,"g"],[3,1,"g"],[4,1,"g"],[5,1,"g"],[6,1,"g"],[7,1,"g"],[8,1,"g"],[9,1,"g"]],
  sproutHat:[[5,-1,"v"],[6,-2,"v"],[7,-2,"v"],[6,-1,"v"],[6,0,"v"],[4,1,"w"],[5,1,"w"],[6,1,"w"],[7,1,"w"]],
  glasses:[[2,4,"k"],[3,4,"k"],[4,4,"k"],[5,4,"k"],[6,4,"k"],[7,4,"k"],[8,4,"k"],[9,4,"k"],[2,5,"k"],[4,5,"k"],[7,5,"k"],[9,5,"k"],[2,6,"k"],[3,6,"k"],[4,6,"k"],[7,6,"k"],[8,6,"k"],[9,6,"k"]],
  scarf:[[1,10,"r"],[2,10,"r"],[3,10,"r"],[4,10,"r"],[5,10,"r"],[6,10,"r"],[7,10,"r"],[8,10,"r"],[9,10,"r"],[10,10,"r"],[2,11,"w"],[3,11,"r"],[4,11,"r"],[5,11,"w"],[6,11,"r"],[7,11,"r"],[8,11,"w"],[9,11,"r"]],
  medal:[[5,10,"g"],[6,10,"g"],[5,11,"g"],[6,11,"g"],[5,9,"r"],[6,9,"r"]]
};

function buddySVG(mood, equipped, px){
  var inner=grid(BEAN,0,3);
  var face=FACES[mood]||FACES.happy;
  inner+=rects(face,0,3);
  ["head","face","neck"].forEach(function(slot){
    var id=equipped&&equipped[slot];
    if(id&&ACC[id])inner+=rects(ACC[id],0,3);
  });
  return svg(12,16,inner,px||10,"Bean Buddy feeling "+mood);
}
function accSVG(id,px){
  // small preview: bean outline faded plus accessory
  return svg(12,16,grid(BEAN,0,3).replace(/fill="/g,'opacity=".35" fill="')+rects(ACC[id]||[],0,3),px||4,id);
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
