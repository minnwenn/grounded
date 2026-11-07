/* Bean Again prototype: hash-routed single page app, state in localStorage. */
(function(){
"use strict";
var KEY="beanagain.v1";
var $=function(s){return document.querySelector(s);};
var app=$("#app"), nav=$("#nav");

/* ---------- state ---------- */
// Days are counted from the real local calendar date (rolls over at local midnight), plus the demo-clock offset S.day.
function localDay(){var t=new Date();return Math.floor(Date.UTC(t.getFullYear(),t.getMonth(),t.getDate())/864e5);}
function fresh(){return {role:null,day:0,evening:false,beans:15,streak:2,lastQuizDay:localDay()-1,quizPick:null,
  points:0,user:null,owned:[],equipped:{},progress:{},flagged:[],reviewed:{},extraMissions:[],tab:{},fails:{}};}
var S=load();
function load(){try{var s=JSON.parse(localStorage.getItem(KEY));if(s){s=Object.assign(fresh(),s);
  if(s.lastQuizDay<10000)s.lastQuizDay+=localDay(); // older saves counted days from 0 on the demo clock only
  return s;}}catch(e){}return fresh();}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}}

/* ---------- derived ---------- */
function today(){return localDay()+S.day;}
function gap(){return today()-S.lastQuizDay;}
function streakNow(){return gap()>=2?0:S.streak;}
function mood(){
  var g=gap();
  if(g===0)return [3,7,14,30].indexOf(S.streak)>-1?"celebrate":"happy";
  if(g===1)return S.evening?"sleepy":"happy";
  if(g===2)return "sad";
  return "mouldy";
}
var MOOD_TEXT={
  happy:"Hi! Ready when you are.",
  celebrate:"Streak party! You did it!",
  sleepy:"Getting sleepy... a quick quiz before bed?",
  sad:"I missed you yesterday. No worries, come back anytime.",
  mouldy:"I got a bit mouldy while we were apart. That is what damp grounds do! A quiz will freshen me up."
};
function lvl(){var L=DATA.levels,c=L[0];L.forEach(function(l){if(S.points>=l.at)c=l;});return c;}
function nextLvl(){var L=DATA.levels,c=lvl();return L[c.n]||null;}
function projById(id){return DATA.projects.filter(function(x){return x.id===id;})[0];}
function stepsDone(){return Object.keys(S.progress).reduce(function(a,k){return a+S.progress[k];},0);}
function projectsDone(){return DATA.projects.filter(function(p){return S.progress[p.id]>=5;}).length;}
/* Class missions are measured from the class roster (verified projects), so student and teacher views agree */
function classSummary(){
  var R=classRoster(),P=DASH.CONFIG.projectOrder,kg=0,verifiedProjects=0;
  P.forEach(function(p){var n=R.filter(function(r){return r.status[p]==="verified";}).length;verifiedProjects+=n;kg+=n*DASH.wetKgPerProject(p);});
  return {size:R.length,kg:kg,verifiedProjects:verifiedProjects,studentsVerified:R.filter(function(r){return P.some(function(p){return r.status[p]==="verified";});}).length};
}
function allMissions(){
  var c=classSummary();
  var m=DASH.classMissions().map(function(x){
    var goal=x.goal==null?c.size:x.goal;
    var cur=x.unit==="kg"?Math.round(c.kg*10)/10:c.studentsVerified;
    return {id:x.id,name:x.name,goal:goal,unit:x.unit,cur:cur};
  });
  S.extraMissions.forEach(function(x){m.push({id:x.id,name:x.name,goal:x.goal,unit:"projects verified",cur:Math.min(c.verifiedProjects,x.goal)});});
  return m.map(function(x){x.done=x.cur>=x.goal;return x;});
}
function missionsDone(){return allMissions().filter(function(m){return m.done;}).length;}
function unlocked(a){
  if(a.how==="buy")return S.owned.indexOf(a.id)>-1;
  if(a.how==="streak")return S.streak>=a.need||S.owned.indexOf(a.id)>-1;
  if(a.how==="project")return projectsDone()>=a.need;
  if(a.how==="mission")return missionsDone()>=a.need;
}
function stage(pid){var n=S.progress[pid];if(n===undefined)return -1;return n===0?0:n<=2?1:n<5?2:3;}
// Teacher queue: classmates' photos the AI couldn't verify (demo data) plus the live demo student's own
function allFlags(){return DASH.waitingPhotos(DASH.teacherClass().id).map(function(x){return Object.assign({roster:true},x);}).concat(S.flagged);}
function pending(){return allFlags().filter(function(f){return !S.reviewed[f.id];});}
function esc(t){return String(t).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}

/* ---------- ui helpers ---------- */
function toast(msg){var t=document.createElement("div");t.className="toast";t.setAttribute("role","status");t.textContent=msg;document.body.appendChild(t);setTimeout(function(){t.remove();},2600);}
function modal(html){closeModal();var m=document.createElement("div");m.className="modal";m.id="modal";
  m.innerHTML='<div class="card" role="dialog" aria-modal="true">'+html+'</div>';
  m.addEventListener("click",function(e){if(e.target===m)closeModal();});document.body.appendChild(m);return m;}
function closeModal(){var m=$("#modal");if(m)m.remove();}
function bar(p){return '<div class="bar" role="progressbar" aria-valuenow="'+Math.round(p)+'" aria-valuemin="0" aria-valuemax="100"><i style="width:'+Math.min(100,p)+'%"></i></div>';}
function tabs(key,list,cur){return '<div class="tabs" role="tablist">'+list.map(function(t){return '<button role="tab" class="'+(t[0]===cur?"on":"")+'" data-act="tab" data-key="'+key+'" data-v="'+t[0]+'">'+t[1]+'</button>';}).join("")+'</div>';}
function eqObj(){return S.equipped;}

/* ---------- routes ---------- */
var NAVS={
  student:[["#/student","Path"],["#/student/projects","Projects"],["#/student/buddy","Buddy"],["#/student/garden","Garden"]],
  school:[["#/school","Overview"],["#/school/photos","Photos"],["#/school/missions","Missions"]],
  coffeebot:[["#/coffeebot","Overview"],["#/coffeebot/journey","Grounds journey"],["#/coffeebot/schools","Schools"],["#/coffeebot/batches","Batches"],["#/coffeebot/carbon","Carbon"],["#/coffeebot/report","Sponsor report"]]
};
var ROUTES={
  "":landing,"login":loginPage,
  "student":stuPath,"student/project":stuProject,"student/buddy":stuBuddy,"student/projects":stuProjects,"student/garden":stuGarden,
  "school":schOverview,"school/photos":schPhotos,"school/missions":schMissions,
  "coffeebot":function(){CB.overview(app);},"coffeebot/journey":function(){CB.journey(app);},"coffeebot/schools":function(){CB.schools(app);},
  "coffeebot/batches":function(){CB.batches(app);},"coffeebot/carbon":function(){CB.carbon(app);},"coffeebot/report":function(){CB.report(app);}
};
function route(){
  var raw=location.hash.replace(/^#\/?/,"").split("?");
  var h=raw[0], query=raw[1]||"";
  var bm=h.match(/^batch\/(.+)$/);
  var role=h.split("/")[0];
  nav.innerHTML="";
  var RK={student:"student",school:"teacher",coffeebot:"coffeebot"};
  if(NAVS[role]&&(!S.user||S.user.role!==RK[role])){location.hash="#/login?role="+RK[role];return;}
  $("#switch").textContent=S.user?"Log out":"Log in";
  $("#switch").setAttribute("href",S.user?"#/logout":"#/login");
  if(h==="logout"){S.user=null;save();location.hash="#/";return;}
  if(NAVS[role]){
    if(S.role!==role){S.role=role;save();}
    nav.innerHTML=NAVS[role].map(function(n){return '<a href="'+n[0]+'"'+(("#/"+h)===n[0]?' class="on" aria-current="page"':'')+'>'+n[1]+'</a>';}).join("");
  }
  var fn=bm?function(){batchPage(decodeURIComponent(bm[1]));}:h==='login'?function(){loginPage(query);}:ROUTES[h];
  if(!fn){fn=landing;}
  fn();
  
  window.scrollTo(0,0);
}
window.addEventListener("hashchange",route);

/* ---------- login (simulated: no real accounts) ---------- */
var ROLES={student:{label:"Student",home:"#/student"},teacher:{label:"Teacher",home:"#/school"},coffeebot:{label:"CoffeeBot",home:"#/coffeebot"}};
function loginArt(){
  // a steaming coffee cup with a few beans, drawn as shapes then dotted with a halftone mask
  var beans=[[70,300,-30],[330,330,25],[300,95,-50],[95,120,40],[345,215,70]],bs="",cr="";
  beans.forEach(function(b){
    bs+='<ellipse cx="'+b[0]+'" cy="'+b[1]+'" rx="26" ry="38" transform="rotate('+b[2]+' '+b[0]+' '+b[1]+')"/>';
    cr+='<path d="M'+b[0]+' '+(b[1]-32)+' C'+(b[0]-14)+' '+(b[1]-12)+' '+(b[0]+14)+' '+(b[1]+12)+' '+b[0]+' '+(b[1]+32)+'" transform="rotate('+b[2]+' '+b[0]+' '+b[1]+')"/>';
  });
  var cup='<ellipse cx="200" cy="372" rx="150" ry="28" fill="url(#gs2)"/>'+
    '<path d="M300 232 C385 222 385 322 292 318" fill="none" stroke="url(#gc)" stroke-width="24" stroke-linecap="round"/>'+
    '<path d="M90 205 H310 C310 305 282 362 200 362 C118 362 90 305 90 205 Z" fill="url(#gc)"/>'+
    '<ellipse cx="200" cy="205" rx="110" ry="20" fill="#721F1F"/>';
  var steam='<g fill="none" stroke="url(#gst)" stroke-width="16" stroke-linecap="round">'+
    '<path d="M150 170 C128 140 172 120 150 88 C136 66 156 52 150 40"/><path d="M200 170 C178 138 222 116 200 82 C186 58 206 44 200 30"/><path d="M250 170 C228 142 272 122 250 90 C236 68 256 54 250 42"/></g>';
  return '<svg class="login-art" viewBox="0 0 420 440" aria-hidden="true">'+
  '<defs><linearGradient id="gc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F4CE5B"/><stop offset=".5" stop-color="#E69AAE"/><stop offset="1" stop-color="#BB758A"/></linearGradient>'+
  '<linearGradient id="gs2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#E7D487"/><stop offset="1" stop-color="#D6A36A"/></linearGradient>'+
  '<linearGradient id="gb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C98A5E"/><stop offset="1" stop-color="#8a4f2c"/></linearGradient>'+
  '<linearGradient id="gst" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#F4CE5B"/></linearGradient>'+
  '<pattern id="dots" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="4.5" cy="4.5" r="2.6" fill="#fff"/></pattern>'+
  '<mask id="halftone"><rect width="420" height="440" fill="url(#dots)"/></mask><filter id="soft"><feGaussianBlur stdDeviation="7"/></filter></defs>'+
  '<g filter="url(#soft)" opacity=".5"><g fill="url(#gb)">'+bs+'</g>'+cup+steam+'</g>'+
  '<g mask="url(#halftone)"><g fill="url(#gb)">'+bs+'</g>'+cup+steam+'</g>'+
  '<g fill="none" stroke="#721F1F" stroke-width="3" stroke-linecap="round" opacity=".55">'+cr+'</g>'+
  '<ellipse cx="170" cy="203" rx="40" ry="5" fill="#BB758A" opacity=".5"/></svg>';
}
function loginPage(query){
  var m=(query||"").match(/role=(\w+)/);
  var role=m&&ROLES[m[1]]?m[1]:(S.tab.loginRole||"student");
  S.tab.loginRole=role;
  var stu=role==="student";
  app.innerHTML='<section class="login">'+
  '<div class="login-copy"><div class="kicker">bean again</div><h1 class="login-title">log in</h1>'+
  '<p class="login-lead">a game that turns coffee grounds into things you can make, grow and share. pick who you are and jump back in.</p>'+
  '<div class="glass login-card"><div class="role-pills" role="tablist" aria-label="Log in as">'+Object.keys(ROLES).map(function(k){return '<button type="button" role="tab" aria-selected="'+(k===role)+'" class="'+(k===role?"on":"")+'" data-act="loginrole" data-v="'+k+'">'+ROLES[k].label+'</button>';}).join("")+'</div>'+
  '<form id="lform" novalidate>'+
  (stu?'<label for="l1">class code</label><input id="l1" value="'+DATA.classCode+'" autocomplete="off"><label for="l2">your name</label><input id="l2" value="Sam" maxlength="30">':
  '<label for="l1">email</label><input id="l1" type="email" value="'+(role==="teacher"?"teacher@maple.example":"team@coffeebot.example")+'"><label for="l2">password</label><input id="l2" type="password" value="demo">')+
  '<div id="lerr" class="chip bad" style="display:none" role="alert"></div>'+
  '<button class="btn-dark">log in as '+ROLES[role].label.toLowerCase()+'</button></form>'+
  '<p class="muted" style="margin:12px 0 0;font-size:.8rem">demo only: '+(stu?"use the class code "+DATA.classCode+" and any name.":"any email and password work.")+'</p></div></div>'+
  '<div class="login-visual">'+loginArt()+
  '<div class="glass float f1"><span class="pill-w">explore the forest</span><span>watch the class garden grow, one project at a time.</span></div>'+
  '<div class="glass float f2"><b>built for curious minds</b><span>reuse grounds, earn points, level up.</span></div>'+
  '<div class="glass float f3"><b>made to move faster</b><span>from the first scoop to the final photo, every step counts.</span></div></div></section>';
  $("#lform").addEventListener("submit",function(e){
    e.preventDefault();
    var a=$("#l1").value.trim(),b=$("#l2").value.trim(),err=$("#lerr");
    var bad=stu?(a.toUpperCase()!==DATA.classCode?"That class code was not found.":!b?"Please enter your name.":""):(!/.+@.+/.test(a)?"Enter a valid email.":!b?"Enter a password.":"");
    if(bad){err.textContent=bad;err.style.display="inline-block";return;}
    S.user={role:role,name:stu?b:(role==="teacher"?"Teacher":"CoffeeBot team")};save();
    location.hash=ROLES[role].home;
  });
}
document.addEventListener("click",function(e){var el=e.target.closest('[data-act="loginrole"]');if(el){S.tab.loginRole=el.dataset.v;location.hash="#/login?role="+el.dataset.v;route();}});

/* ---------- landing ---------- */
function landing(){
  app.innerHTML='<section class="hero"><div class="kicker">Coffee grounds · classrooms · growing things</div>'+
  '<h1>Give coffee grounds<br>a second life.</h1>'+
  '<p style="max-width:56ch">A pixel-sized game that walks students through reusing coffee grounds, helps teachers see progress, and gives CoffeeBot verified impact. Log in to explore the demo.</p></section>'+
  '<div class="grid g3">'+
  roleCard("olive","Students","Follow a winding path of project steps, care for your Bean Buddy and grow a class forest.","#/login?role=student","Log in as student")+
  roleCard("rose","Schools","Class code, participation, quizzes, flagged photos and class missions in one place.","#/login?role=teacher","Log in as teacher")+
  roleCard("gold","CoffeeBot","Verified kg by school, cohort and batch, plus a handprint estimate and sponsor report.","#/login?role=coffeebot","Log in as CoffeeBot")+
  '</div>';
}
function roleCard(c,t,d,href,cta){return '<a class="card role-card '+c+'" href="'+href+'"><h2>'+t+'</h2><p>'+d+'</p><span class="btn btn-'+(c==="gold"?"gold":"")+'">'+cta+'</span></a>';}

/* ---------- student: pathway ---------- */
function stuHeader(){
  return '<div class="row between" style="margin:8px 0 16px"><h1 style="font-size:1.8rem;margin:0">Hi, '+esc(S.user&&S.user.name||"Sam")+'</h1>'+
  '<div class="row"><span class="chip">Lv '+lvl().n+' '+lvl().name+' · '+S.points+' pts</span><span class="chip ok">'+streakNow()+' day streak</span><span class="chip">● '+S.beans+' beans</span></div></div>';
}
function weekDone(w){return w.projects.every(function(id){return S.progress[id]>=5;});}
function curWeek(){var W=DATA.weeks;for(var i=0;i<W.length;i++)if(!weekDone(W[i]))return i;return W.length;}
function stuPath(){
  var W=DATA.weeks,cw=curWeek(),done=cw;
  var html=stuHeader()+'<div class="grid g2"><div class="stack"><section class="card"><h2>Your 4-week journey</h2><p class="muted" style="margin-bottom:8px">'+
    (cw>=W.length?'All four weeks complete. Amazing work!':'You are on <b>week '+W[cw].n+' of 4: '+esc(W[cw].name)+'</b>')+'</p>'+bar(done/W.length*100)+
    '<div class="path">';
  W.forEach(function(w,i){
    var cls=i<cw?"done":i===cw?"cur":"lock",off=[0,30,0,30][i];
    html+='<div class="node-wrap" style="padding-left:'+off+'%"><div class="node '+cls+'" style="cursor:default" role="img" aria-label="Week '+w.n+' '+(cls==="done"?"done":cls==="cur"?"current":"upcoming")+'">'+(cls==="done"?"\u2713":w.n)+'</div>'+
    '<div class="node-label"><b>Week '+w.n+': '+esc(w.name)+'</b>'+esc(w.goal)+'</div></div>';
  });
  html+='</div></section>';
  if(cw<W.length){
    html+='<section class="card"><h3>This week</h3>'+W[cw].projects.map(function(id){
      var p=projById(id),n=S.progress[id],open=lvl().n>=p.level;
      var act=!open?'<span class="chip bad">Locked: reach level '+p.level+'</span>':n>=5?'<span class="chip ok">Done</span>':
        '<button class="btn small" data-act="begin" data-id="'+id+'">'+(n===undefined?"Start":"Continue ("+n+"/5)")+'</button>';
      return '<div class="row between" style="margin:8px 0"><div><b>'+esc(p.name)+'</b><br><span class="muted">Earn '+p.pts+' points</span></div>'+act+'</div>';}).join("")+
      '<p class="muted">Want to work on something else? <a href="#/student/projects">Browse all projects</a>.</p></section>';
  }
  html+='</div><aside class="stack"><section class="card gold"><div class="buddy-stage '+mood()+'">'+buddySVG(mood(),eqObj(),7)+'</div><div class="speech">'+MOOD_TEXT[mood()]+'</div><a class="btn" href="#/student/buddy">Daily quiz</a></section>'+missionCard()+'</aside></div>';
  app.innerHTML=html;
}
function stuProject(){
  var started=DATA.projects.filter(function(x){return S.progress[x.id]!==undefined;});
  if(!started.length){
    app.innerHTML=stuHeader()+'<section class="card"><h2>No project yet</h2><p>Pick a coffee ground project to get started.</p><a class="btn" href="#/student/projects">Choose a project</a></section>';
    return;
  }
  var cur=S.tab.proj;
  var p=started.filter(function(x){return x.id===cur;})[0]||started[0];
  var n=S.progress[p.id];
  var html=stuHeader()+tabs("proj",started.map(function(x){return [x.id,esc(x.name)];}),p.id)+'<p><a href="#/student">Back to my 4-week journey</a> · <a href="#/student/projects">Choose another project</a></p>';
  html+='<div class="grid g2"><section class="card"><h2>'+esc(p.name)+'</h2>';
  if(n===undefined){
    html+='<p>Beginning this project plants a new seed in your class garden for everyone to enjoy.</p><button class="btn" data-act="begin" data-id="'+p.id+'">Begin project</button>';
  }else{
    html+=bar(n/5*100)+'<p class="muted" style="margin-top:6px">'+n+' of 5 steps</p><div class="path">';
    p.steps.forEach(function(s,i){
      var cls=i<n?"done":i===n?"cur":"lock";
      var off=[0,22,44,22][i%4]; // winding offset in %
      html+='<div class="node-wrap" style="padding-left:'+off+'%">'+
      '<button class="node '+cls+'" '+(cls==="lock"?"disabled":"")+' data-act="step" data-id="'+p.id+'" data-i="'+i+'" aria-label="Step '+(i+1)+': '+esc(s[0])+' ('+(cls==="done"?"done":cls==="cur"?"current":"locked")+')">'+(cls==="done"?"\u2713":i===4?cameraIcon(4):i+1)+'</button>'+
      '<div class="node-label"><b>'+esc(s[0])+'</b>'+(cls==="cur"?esc(s[1]):"")+'</div></div>';
    });
    html+='</div>';
    if(n>=5)html+='<p><b>Project complete!</b> Your plant is fully grown.</p>';
    else html+='<p class="muted">Finish the photo step to earn <b>'+p.pts+' points</b>.</p>';
  }
  html+='</section><aside class="stack"><section class="card gold"><div class="buddy-stage '+mood()+'">'+buddySVG(mood(),eqObj(),7)+'</div><div class="speech">'+MOOD_TEXT[mood()]+'</div><a class="btn" href="#/student/buddy">Daily quiz</a></section>'+missionCard()+'</aside></div>';
  app.innerHTML=html;
}
function stuProjects(){
  var nx=nextLvl();
  var html=stuHeader()+'<h2>Choose a project</h2><p class="muted">Finish a project with a photo the checker approves to earn points. '+(nx?'You need <b>'+(nx.at-S.points)+' more points</b> for level '+nx.n+' ('+nx.name+').':'You are at the top level!')+'</p>'+
  (nx?bar((S.points-lvl().at)/(nx.at-lvl().at)*100):'')+'<div class="grid g2" style="margin-top:16px">';
  DATA.projects.slice().sort(function(a,b){return a.level-b.level;}).forEach(function(p){
    var open=lvl().n>=p.level,n=S.progress[p.id];
    var action=!open?'<span class="chip bad">Locked: reach level '+p.level+' ('+DATA.levels[p.level-1].name+')</span>':
      n===undefined?'<button class="btn" data-act="begin" data-id="'+p.id+'">Start</button>':
      n>=5?'<span class="chip ok">Completed</span>':'<button class="btn" data-act="begin" data-id="'+p.id+'">Continue ('+n+'/5)</button>';
    html+='<section class="card'+(open?'':' locked')+'" style="'+(open?'':'opacity:.7')+'"><div class="row between"><h3 style="margin:0">'+esc(p.name)+'</h3><span class="chip">Lv '+p.level+'</span></div><p style="margin:8px 0">'+esc(p.desc)+'</p><p class="muted">Earn '+p.pts+' points</p>'+action+'</section>';
  });
  app.innerHTML=html+'</div>';
}
function missionCard(){
  return '<section class="card"><h3>Class missions</h3>'+allMissions().map(function(m){
    return '<p style="margin:10px 0 2px"><b>'+esc(m.name)+'</b> '+(m.done?'<span class="chip ok">done</span>':'')+'</p>'+bar(m.cur/m.goal*100)+'<span class="muted">'+Math.min(m.cur,m.goal)+' / '+m.goal+' '+m.unit+'</span>';}).join("")+'</section>';
}

function openStep(pid,i){
  var p=DATA.projects.filter(function(x){return x.id===pid;})[0];
  var s=p.steps[i];
  if(i<4){
    modal('<h2>'+esc(s[0])+'</h2><p>'+esc(s[1])+'</p><div class="row"><button class="btn" data-act="finish" data-id="'+pid+'" data-i="'+i+'">I did it</button><button class="btn btn-ghost" data-act="close">Not yet</button></div>');
  }else{
    modal('<h2>'+esc(s[0])+'</h2><p>'+esc(s[1])+'</p>'+
    '<p class="muted">The photo checker looks for: <b>'+esc(p.photoPrompt)+'</b></p><label for="photo">Choose or take a photo</label><br><input id="photo" data-pid="'+pid+'" type="file" accept="image/*" capture="environment">'+
    '<div id="photoOut" class="muted" style="margin:10px 0">Show your finished project. Photos are compressed to under 400 kB and deleted after checking.</div>'+
    '<div class="row"><button id="submitPhoto" class="btn" disabled data-act="finish" data-id="'+pid+'" data-i="'+i+'">Submit</button><button class="btn btn-ghost" data-act="close">Cancel</button></div>');
    $("#photo").addEventListener("change",onPhoto);
    clipCheck.warm(); // start the one-time model download while the student reads the step
  }
}
var lastCheck=null;
/* Photo pipeline: local check (MobileCLIP, on the device) -> AI check (Claude, via the server) -> teacher.
 * - local "fail": not sent on, counts as a failed try
 * - otherwise the AI decides: pass counts right away, unsure goes to the teacher, fail counts as a failed try
 * - still failing after RETAKES retakes: goes to the teacher
 * - no AI available (no API key or offline): the local verdict stands, so a local pass counts */
var RETAKES=DASH.CONFIG.aiRetakeLimit;
function aiCheck(pid,b64){
  if(typeof fetch!=="function")return Promise.resolve(null);
  return fetch("api/check",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({projectId:pid,image:b64})})
    .then(function(r){return r.ok?r.json():null;})
    .then(function(j){return j&&j.verdict?j:null;})
    .catch(function(){return null;});
}
function photoPipeline(pid,data,onProgress){
  return clipCheck.check(projById(pid),data,onProgress).then(function(local){
    if(local.verdict==="fail")return Object.assign(local,{stage:"local"});
    return aiCheck(pid,data.split(",")[1]).then(function(ai){
      if(ai)return Object.assign(ai,{stage:"ai"});
      return Object.assign(local,{stage:"local-only"});
    });
  });
}
function onPhoto(e){
  var f=e.target.files&&e.target.files[0];if(!f)return;
  var pid=e.target.dataset.pid,out=$("#photoOut"),btn=$("#submitPhoto");
  btn.disabled=true;lastCheck=null;out.textContent="Checking your photo...";
  var url=URL.createObjectURL(f),img=new Image();
  img.onload=function(){
    var sc=Math.min(1,800/img.width),c=document.createElement("canvas");
    c.width=Math.round(img.width*sc);c.height=Math.round(img.height*sc);
    var ctx=c.getContext("2d");ctx.drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);
    var q=0.8,data=c.toDataURL("image/jpeg",q);
    while(data.length*0.75>400*1024&&q>0.3){q-=0.1;data=c.toDataURL("image/jpeg",q);}
    var kb=Math.round(data.length*0.75/1024);
    photoPipeline(pid,data,function(pc){out.textContent="Loading the photo checker (first time only)... "+pc+"%";}).then(function(r){
      r.kb=kb;
      var extra="";
      if(r.verdict==="fail"){
        S.fails[pid]=(S.fails[pid]||0)+1;save();
        var left=RETAKES+1-S.fails[pid];
        if(left<=0){r={verdict:"unsure",confidence:r.confidence,stage:r.stage,kb:kb,reason:"retakes",feedback:"Still not a match after "+S.fails[pid]+" tries. Send it and your teacher will check it."};}
        else extra=' <b>'+left+' '+(left===1?"try":"tries")+' left</b> before your teacher checks it.';
      }else if(r.verdict==="unsure")r.reason="ai-unsure";
      lastCheck=r;
      var by=r.stage==="ai"?"checked by AI":r.stage==="local"?"quick check":"quick check only (AI unavailable)";
      var chip=r.verdict==="pass"?'<span class="chip ok">Looks right!</span>':r.verdict==="unsure"?'<span class="chip">Teacher will check</span>':'<span class="chip bad">Try another photo</span>';
      out.innerHTML=chip+' <span class="muted">('+r.kb+' kB, '+by+')</span><p style="margin:8px 0 0">'+esc(r.feedback||"")+extra+'</p><p class="muted">Your photo is not kept after this check.</p>';
      btn.disabled=r.verdict==="fail";
    });
  };
  img.onerror=function(){out.textContent="Could not read that image. Try another.";};
  img.src=url;
}
function finishStep(pid,i){
  var n=S.progress[pid];if(n!==i)return;
  var p=projById(pid);
  if(i===4){
    if(!lastCheck||lastCheck.verdict==="fail")return;
    var before=lvl().n;
    S.progress[pid]=5;S.beans+=10;
    if(lastCheck.verdict==="unsure"){
      var why=lastCheck.reason==="retakes"?"Failed the photo check "+(S.fails[pid]||0)+" times":lastCheck.stage==="ai"?"AI unsure (confidence "+(+lastCheck.confidence||0).toFixed(2)+")":"Quick check unsure, AI unavailable";
      S.flagged.push({id:"u"+Date.now(),student:(S.user&&S.user.name||"Sam")+" (you)",project:p.name,pid:pid,pts:p.pts,note:why});
      toast("Sent to your teacher. Your "+p.pts+" points arrive once they approve.");
    }else{
      S.points+=p.pts;
      toast(lvl().n>before?"Level up! You are now "+lvl().name+"!":"Verified! +"+p.pts+" points");
    }
    S.fails[pid]=0;lastCheck=null;
  }else{
    S.progress[pid]=n+1;S.beans+=5;toast("Step done! +5 beans");
  }
  save();closeModal();route();
}

/* ---------- student: buddy, quiz, wardrobe ---------- */
function todaysQ(){var n=DATA.quiz.length;return DATA.quiz[((today()%n)+n)%n];} // a new question each local day
function stuBuddy(){
  var done=gap()===0,q=todaysQ();
  var html=stuHeader()+'<div class="grid g2"><section class="card gold"><div class="buddy-stage '+mood()+'">'+buddySVG(mood(),eqObj(),12)+'</div><div class="speech">'+MOOD_TEXT[mood()]+'</div>'+
  '<p class="muted">Moods: happy when done, sleepy in the evening if not, sad if a day is missed, celebrating at 3, 7, 14 and 30 days.</p></section>';
  html+='<section class="card"><h2>Daily quiz</h2>';
  if(done&&S.quizPick===null||done&&S.quizPick===undefined){html+='<p>All done for today. Come back tomorrow to keep your streak!</p>';}
  else if(done){html+=quizResult(q);}
  else{
    html+='<p><b>'+esc(q.q)+'</b></p>'+q.o.map(function(o,i){return '<button class="opt" data-act="answer" data-i="'+i+'">'+esc(o)+'</button>';}).join("");
  }
  html+='</section></div><section class="card" style="margin-top:16px"><h2>Wardrobe</h2><p class="muted">Beans buy accessories, never progress. Streaks, projects and class missions unlock special ones.</p><div class="grid g2">'+
  DATA.accessories.map(function(a){
    var have=a.how==="buy"?S.owned.indexOf(a.id)>-1:unlocked(a);
    var on=S.equipped[a.slot]===a.id;
    var btn=have?'<button class="btn small" data-act="equip" data-id="'+a.id+'">'+(on?"Take off":"Wear")+'</button>':
      a.how==="buy"?'<button class="btn small btn-gold" data-act="buy" data-id="'+a.id+'" '+(S.beans<a.cost?"disabled":"")+'>Buy · '+a.cost+' beans</button>':'<span class="muted">Locked: '+a.hint+'</span>';
    return '<div class="item'+(have?"":" locked")+'">'+accSVG(a.id,4)+'<div style="flex:1"><b>'+a.name+'</b><br>'+btn+'</div></div>';}).join("")+'</div></section>';
  app.innerHTML=html;
}
function quizResult(q){
  var pick=S.quizPick,refl=q.a<0;
  return '<p><b>'+esc(q.q)+'</b></p>'+q.o.map(function(o,i){return '<div class="opt '+(refl?(i===pick?"right":""):i===q.a?"right":i===pick?"wrong":"")+'">'+esc(o)+'</div>';}).join("")+
  '<p style="margin-top:12px">'+esc(q.why)+'</p>';
}
function answer(i){
  var q=todaysQ();
  if(gap()===0)return;
  S.streak=gap()===1?S.streak+1:1;
  S.lastQuizDay=today();S.quizPick=i;
  var good=q.a<0||i===q.a;
  S.beans+=good?5:1;
  save();route();
  toast(good?"Nice! Your buddy is happy. +5 beans":"Good try. Buddy still counts your streak. +1 bean");
}

/* ---------- student: garden ---------- */
function rnd(n){var x=Math.sin(n*9301+49297)*233280;return x-Math.floor(x);}
var FOREST_COLORS=["#BB758A","#F4CE5B","#721F1F","#FFE597"];
var KINDS=["flower","bush","tree"];
/* Isometric island: tiles on a grid, plants stand on tiles, drawn back to front. */
function forest(plants){
  var n=Math.max(4,Math.ceil(Math.sqrt(plants.length*1.35))),tw=64,th=32,depth=22,sc=tw/15;
  var tiles=[];for(var c=0;c<n;c++)for(var r=0;r<n;r++)tiles.push([c,r]);
  var mid=[Math.floor(n/2),Math.floor(n/2)],you=null;
  tiles=tiles.filter(function(t){return !(t[0]===mid[0]&&t[1]===mid[1]);});
  tiles.sort(function(a,b){return rnd(a[0]*31+a[1]*7+1)-rnd(b[0]*31+b[1]*7+1);});
  var placed=[],k=0;
  plants.forEach(function(p){var t=p.you?mid:tiles[k++];if(t)placed.push({p:p,c:t[0],r:t[1]});});
  placed.sort(function(a,b){return (a.c+a.r)-(b.c+b.r)||a.c-b.c;});
  var X=function(c,r){return (c-r)*tw/2;},Y=function(c,r){return (c+r)*th/2;};
  var W=n*tw,H=n*th+depth;
  var g='<polygon points="'+X(0,n)+','+Y(0,n)+' '+X(0,n)+','+(Y(0,n)+depth)+' '+X(n,0)*0+','+0+' " fill="none"/>';
  g='';
  // dirt sides (left and right faces)
  var L=[-W/2,n*th/2],B=[0,n*th],R=[W/2,n*th/2];
  g+='<polygon points="'+L[0]+','+L[1]+' '+B[0]+','+B[1]+' '+B[0]+','+(B[1]+depth)+' '+L[0]+','+(L[1]+depth)+'" fill="#8a6a3a" stroke="#721F1F" stroke-width="2"/>';
  g+='<polygon points="'+B[0]+','+B[1]+' '+R[0]+','+R[1]+' '+R[0]+','+(R[1]+depth)+' '+B[0]+','+(B[1]+depth)+'" fill="#6b4e2a" stroke="#721F1F" stroke-width="2"/>';
  // grass tiles in a checker
  for(var cc=0;cc<n;cc++)for(var rr=0;rr<n;rr++){
    var x=X(cc,rr),y=Y(cc,rr);
    g+='<polygon points="'+x+','+y+' '+(x+tw/2)+','+(y+th/2)+' '+x+','+(y+th)+' '+(x-tw/2)+','+(y+th/2)+'" fill="'+((cc+rr)%2?"#D9C97A":"#E3D391")+'"/>';
  }
  g+='<polygon points="0,0 '+R[0]+','+R[1]+' 0,'+n*th+' '+L[0]+','+L[1]+'" fill="none" stroke="#721F1F" stroke-width="2"/>';
  placed.forEach(function(o,i){
    var cx=X(o.c,o.r),cy=Y(o.c,o.r)+th/2+6;
    if(o.p.you)g+='<polygon points="'+cx+','+(cy-th/2-2)+' '+(cx+tw/2-4)+','+(cy-8)+' '+cx+','+(cy+th/2-14)+' '+(cx-tw/2+4)+','+(cy-8)+'" fill="#F4CE5B" stroke="#721F1F" stroke-width="1.5"/>';
    g+='<g transform="translate('+(cx-5*sc)+','+(cy-12*sc)+') scale('+sc+')"><title>'+esc(o.p.name)+'</title>'+forestInner(o.p.kind,o.p.stage,o.p.color)+'</g>';
    if(o.p.you)g+='<g transform="translate('+cx+','+(cy-forestHeight(o.p.kind,o.p.stage)*sc-14)+')"><rect x="-17" y="-13" width="34" height="15" fill="#721F1F" stroke="#F4CE5B" stroke-width="1.5"/><text x="0" y="-2" text-anchor="middle" font-size="11" font-weight="700" fill="#FFE597" font-family="sans-serif">You</text></g>';
  });
  return '<div class="forest"><svg class="px" viewBox="'+(-W/2-6)+' -64 '+(W+12)+' '+(H+64+8)+'" width="100%" role="img" aria-label="Forest island with '+plants.length+' plants" style="display:block;max-width:'+Math.round(W*2.3)+'px">'+g+'</svg></div>';
}
/* One plant per classmate who has begun a project; it grows with their progress (started 1, photo sent 2, verified 3 per project) */
function classPlants(){
  var rank={none:0,started:1,sent:2,verified:3},P=DASH.CONFIG.projectOrder;
  var list=classRoster().filter(function(r){return !r.you&&P.some(function(p){return r.status[p]!=="none";});}).map(function(r,i){
    var score=P.reduce(function(a,p){return a+rank[r.status[p]];},0);
    return {name:r.name,stage:Math.max(1,Math.min(3,Math.round(score/4))),kind:KINDS[i%3],color:FOREST_COLORS[(r.name.length+i)%FOREST_COLORS.length]};});
  list.push({name:"You",you:true,stage:Math.max(0,Math.min(3,Math.ceil(stepsDone()/4))),kind:"flower",color:"#BB758A"});
  return list;
}
function stuGarden(){
  var cur=S.tab.garden==="school"?"school":"class";
  var html=stuHeader()+tabs("garden",[["class","Class forest"],["school","School forest"]],cur);
  if(cur==="class"){
    var cp=classPlants();
    html+='<section class="card"><h2>'+DATA.className+' forest</h2><p class="muted">One forest, '+cp.length+' plants. Every student who begins a project adds a plant, so the whole class is rewarded, not just the fastest.</p>'+forest(cp)+'</section>';
  }else{
    var tc=DASH.teacherClass(),classes=DASH.classes(tc.school).map(function(c){return [c.name,c.started.p4];}); // plants = students who began week 1
    var all=[],mine=classPlants();
    classes.forEach(function(c,ci){
      if(c[0]===DATA.className){all=all.concat(mine);return;}
      for(var k=0;k<c[1];k++)all.push({name:c[0],stage:1+Math.floor(rnd(ci*50+k)*3),kind:KINDS[Math.floor(rnd(ci*90+k+4)*3)],color:FOREST_COLORS[Math.floor(rnd(ci*70+k+9)*4)]});
    });
    // mix the classes together so it reads as one forest
    all.sort(function(a,b){return rnd(all.indexOf(a)*7+1)-rnd(all.indexOf(b)*7+1);});
    html+='<section class="card"><h2>School forest</h2><p class="muted">Every class together: '+all.length+' plants.</p>'+forest(all)+
      '<p class="muted" style="margin-top:12px">'+classes.map(function(c){return esc(c[0])+': '+(c[0]===DATA.className?mine.length:c[1])+' plants';}).join(" · ")+'</p></section>';
  }
  app.innerHTML=html;
}

/* ---------- school ---------- */
/* Live status of the demo student (the last roster slot) per project */
function samStatus(pid){
  var n=S.progress[pid];if(n===undefined)return "none";if(n<5)return "started";
  var waiting=S.flagged.some(function(f){return f.pid===pid&&!S.reviewed[f.id];});
  return waiting?"sent":"verified";
}
/* Roster with teacher decisions applied, plus the live demo student */
function classRoster(){
  var flags=allFlags();
  var list=DASH.roster(DASH.teacherClass().id).map(function(r){
    var st=Object.assign({},r.status);
    flags.forEach(function(f){if(f.roster&&f.student===r.name&&S.reviewed[f.id])st[f.pid]=S.reviewed[f.id]==="ok"?"verified":"started";});
    return {name:r.name,status:st,streak:r.streak,lastDays:r.lastDays};
  });
  var me={name:(S.user&&S.user.role==="student"&&S.user.name||"Sam")+" (demo student)",you:true,status:{},streak:streakNow(),lastDays:Math.max(0,gap())};
  DASH.CONFIG.projectOrder.forEach(function(p){me.status[p]=samStatus(p);});
  return list.concat([me]);
}
var STAGE_RANK={none:0,started:1,sent:2,verified:3};
var PIP={none:"not started",started:"started",sent:"photo sent",verified:"verified"};
function teacherHead(title,sub){
  return '<div class="dash-head"><div><h1 class="dash-title">'+esc(title)+'</h1>'+(sub?'<p class="muted">'+sub+'</p>':'')+'</div><div class="row"><span class="chip">Class code: <b>'+DATA.classCode+'</b></span><span class="demo-tag">demo data</span></div></div>';
}
function schOverview(){
  var R=classRoster(),P=DASH.CONFIG.projectOrder,N=R.length,W=Math.max(280,Math.min(1040,app.clientWidth-72));
  var count=function(p,min){return R.filter(function(r){return STAGE_RANK[r.status[p]]>=min;}).length;};
  var proj=P.map(function(p,i){return {p:p,name:DASH.CONFIG.projectNames[p],week:i+1,started:count(p,1),sent:count(p,2),verified:count(p,3)};});
  var kg=proj.reduce(function(a,x){return a+x.verified*DASH.wetKgPerProject(x.p);},0);
  var starters=R.filter(function(r){return P.some(function(p){return r.status[p]!=="none";});}).length;
  var activeToday=R.filter(function(r){return r.lastDays<=1;}).length;
  var q=DASH.classQuiz(),qAvg=q.reduce(function(a,b){return a+b;},0)/q.length;
  var waiting=pending().length;

  var kpis='<div class="kpis">'+
    '<div class="card kpi"><div class="kpi-label">Verified grounds</div><div class="kpi-val">'+kg.toFixed(1)+' kg</div><div class="kpi-sub">verified (AI pass or your approval), wet-equivalent</div></div>'+
    '<div class="card kpi"><div class="kpi-label">Started a project</div><div class="kpi-val">'+starters+' of '+N+'</div><div class="kpi-sub">'+activeToday+' active in the last day</div></div>'+
    '<a class="card kpi kpi-link" href="#/school/photos"><div class="kpi-label">Photos to review</div><div class="kpi-val">'+waiting+'</div><div class="kpi-sub">'+(waiting?"the AI couldn't verify these →":"nothing waiting, all clear")+'</div></a>'+
    '<div class="card kpi"><div class="kpi-label">Quiz accuracy</div><div class="kpi-val">'+Math.round(qAvg)+'%</div>'+CH.spark(q,CH.SERIES[1])+'<div class="kpi-sub">average, last 7 days</div></div></div>';

  // where students stall: biggest gap between stages on any project
  var stalls=[];
  proj.forEach(function(x){
    if(x.started-x.sent>0)stalls.push({n:x.started-x.sent,p:x,what:"started but haven't sent a photo",names:R.filter(function(r){return r.status[x.p]==="started";}).map(function(r){return r.name;})});
    if(x.sent-x.verified>0)stalls.push({n:x.sent-x.verified,p:x,what:"sent a photo that isn't verified yet",names:R.filter(function(r){return r.status[x.p]==="sent";}).map(function(r){return r.name;})});
  });
  stalls.sort(function(a,b){return b.n-a.n;});
  var top=stalls[0];
  var stallHtml=top?'<p class="callout stall">⚑ Most students stall at <b>'+esc(top.p.name)+'</b> (week '+top.p.week+'): '+top.n+' '+top.what+'.</p>'+
    '<details class="tview" open><summary>Who needs a nudge</summary><ul class="nudge">'+stalls.slice(0,4).map(function(st){return '<li><b>'+esc(st.p.name)+'</b>, '+st.what+': <span class="keepcase">'+st.names.map(esc).join(", ")+'</span></li>';}).join("")+'</ul></details>':'<p class="callout">No one is stuck right now.</p>';
  var projects='<section class="card"><h2>Projects</h2><p class="muted">How many of your '+N+' students started each project, sent their final photo, and had it verified.</p>'+
    CH.groupedBars({width:W,label:"Project adoption in this class",total:N,series:["Started","Photo sent","Verified"],colors:["#E2B6A6","#C27D72","#8E2B2B"],
      groups:proj.map(function(x){return {label:x.name,sub:"Week "+x.week,values:[x.started,x.sent,x.verified]};})})+stallHtml+'</section>';

  var labels=q.map(function(_,i){return i===q.length-1?"today":(q.length-1-i)+"d ago";});
  var quiz='<section class="card"><h2>Daily quiz</h2><p class="muted">Average % correct over the last 7 days.</p>'+
    CH.lines({width:Math.min(W,520),height:220,label:"Quiz accuracy, last 7 days",labels:labels,xName:"Day",series:[{name:"% correct",values:q,color:CH.SERIES[1]}],fmt:function(v){return Math.round(v)+"%";}})+'</section>';
  var missions='<section class="card"><h2>Class missions</h2>'+allMissions().map(function(m){return '<p style="margin:10px 0 2px">'+esc(m.name)+' '+(m.done?'<span class="chip ok">done</span>':'')+'</p>'+bar(m.cur/m.goal*100)+'<span class="muted">'+Math.min(m.cur,m.goal)+' / '+m.goal+' '+m.unit+'</span>';}).join("")+'</section>';

  var pips=function(r){return P.map(function(p){var st=r.status[p];return '<span class="pip '+st+'" title="'+esc(DASH.CONFIG.projectNames[p]+": "+PIP[st])+'"></span>';}).join("");};
  var rows=R.map(function(r){var done=P.filter(function(p){return r.status[p]==="verified";}).length;
    return '<tr'+(r.you?' class="you"':'')+'><td class="keepcase">'+esc(r.name)+'</td><td><span class="pips">'+pips(r)+'</span> <span class="muted">'+done+'/4</span></td><td>'+r.streak+'</td><td>'+(r.lastDays===0?"today":r.lastDays===1?"yesterday":r.lastDays+" days ago")+'</td></tr>';}).join("");
  var students='<section class="card"><h2>Students</h2><div class="legend">'+["none","started","sent","verified"].map(function(k){return '<span><i class="pip '+k+'"></i>'+PIP[k]+'</span>';}).join("")+'</div>'+
    '<div class="scroll"><table class="tbl"><thead><tr><th>Name</th><th>Projects (weeks 1–4)</th><th>Quiz streak</th><th>Last active</th></tr></thead><tbody>'+rows+'</tbody></table></div></section>';

  app.innerHTML=teacherHead(DATA.className+" · "+DATA.schoolName,"How your class is doing with its four coffee-ground projects.")+kpis+
    '<div class="stack" style="margin-top:16px">'+projects+'<div class="grid g2">'+quiz+missions+'</div>'+students+'</div>';
}
function schPhotos(){
  var f=allFlags(),open=f.filter(function(x){return !S.reviewed[x.id];}),done=f.filter(function(x){return S.reviewed[x.id];});
  var card=function(x){var r=S.reviewed[x.id];
    return '<div class="card review-card"><div class="row between"><div><b class="keepcase">'+esc(x.student)+'</b> · '+esc(x.project)+'<br><span class="chip reason">'+esc(x.note)+'</span></div>'+
    (r?'<span class="chip '+(r==="ok"?"ok":"bad")+'">'+(r==="ok"?"✓ approved, counts as verified":"↺ sent back to redo")+'</span>':
    '<div class="row"><button class="btn small" data-act="review" data-id="'+x.id+'" data-v="ok">Approve</button><button class="btn small btn-ghost" data-act="review" data-id="'+x.id+'" data-v="redo">Ask to redo</button></div>')+'</div></div>';};
  app.innerHTML=teacherHead("Photos to review","Only photos the AI couldn't verify come here: ones it was unsure about, or that still failed after 3 retakes. Approving counts the project as verified. Redo sends the student back to the photo step.")+
  '<div class="stack">'+(open.length?open.map(card).join(""):'<section class="card"><p>Nothing waiting. The AI has verified every photo so far.</p></section>')+
  (done.length?'<h3 style="margin-top:20px">Reviewed</h3>'+done.map(card).join(""):'')+'</div>';
}
function schMissions(){
  app.innerHTML='<h1 style="font-size:1.8rem">Class missions</h1><div class="stack">'+allMissions().map(function(m){return '<div class="card"><b>'+esc(m.name)+'</b> '+(m.done?'<span class="chip ok">done</span>':'')+bar(m.cur/m.goal*100)+'<span class="muted">'+Math.min(m.cur,m.goal)+' / '+m.goal+' '+m.unit+'</span></div>';}).join("")+
  '<form class="card" id="mform"><h3>New mission</h3><div class="row"><div><label for="mn">Name</label><br><input id="mn" required maxlength="60" placeholder="Water every seedling"></div><div><label for="mg">Goal (projects verified)</label><br><input id="mg" type="number" min="1" max="500" value="80" required></div><button class="btn" style="align-self:flex-end">Add</button></div></form></div>';
  $("#mform").addEventListener("submit",function(e){e.preventDefault();S.extraMissions.push({id:"x"+Date.now(),name:$("#mn").value.trim(),goal:+$("#mg").value});save();toast("Mission added");route();});
}

/* ---------- batch page (opened from the CoffeeBot batches tab) ---------- */
function batchPage(id){CB.batchPage(app,id);}

/* ---------- demo clock (set from the terminal via demo.js, see README) ---------- */
function syncDemo(){
  if(typeof fetch!=="function")return;
  fetch("api/demo",{cache:"no-store"}).then(function(r){return r.ok?r.json():null;}).then(function(d){
    if(!d||typeof d.day!=="number")return;
    var changed=false;
    if(S.demoToken!==d.token){
      if(S.demoToken!==undefined){var u=S.user;S=fresh();S.user=u;} // terminal "reset"
      S.demoToken=d.token;changed=true;
    }
    if(S.day!==d.day){if(d.day>S.day)S.quizPick=null;S.day=d.day;changed=true;}
    if(S.evening!==d.evening){S.evening=d.evening;changed=true;}
    if(changed){save();if(!$("#modal"))route();}
  }).catch(function(){});
}
syncDemo();setInterval(syncDemo,4000);

/* ---------- events ---------- */
document.addEventListener("click",function(e){
  var el=e.target.closest("[data-act]");if(!el)return;
  var a=el.dataset.act,id=el.dataset.id,i=+el.dataset.i;
  if(a==="tab"){S.tab[el.dataset.key]=el.dataset.v;save();route();}
  else if(a==="begin"){var bp=projById(id);if(lvl().n<bp.level){toast("Reach level "+bp.level+" first");return;}if(S.progress[id]===undefined){S.progress[id]=0;toast("Seed planted in your class garden!");}S.tab.proj=id;save();if(location.hash==="#/student/project")route();else location.hash="#/student/project";}
  else if(a==="step")openStep(id,i);
  else if(a==="finish")finishStep(id,i);
  else if(a==="close")closeModal();
  else if(a==="answer")answer(i);
  else if(a==="buy"){var ac=DATA.accessories.filter(function(x){return x.id===id;})[0];if(S.beans>=ac.cost){S.beans-=ac.cost;S.owned.push(id);S.equipped[ac.slot]=id;save();route();}}
  else if(a==="equip"){var ac2=DATA.accessories.filter(function(x){return x.id===id;})[0];if(S.equipped[ac2.slot]===id)delete S.equipped[ac2.slot];else S.equipped[ac2.slot]=id;save();route();}
  else if(a==="review"){S.reviewed[id]=el.dataset.v;var fl=allFlags().filter(function(x){return x.id===id;})[0];if(fl&&fl.pid&&!fl.roster){if(el.dataset.v==="ok")S.points+=fl.pts;else{S.progress[fl.pid]=4;S.fails[fl.pid]=0;}}save();route();}
  else if(a==="print")window.print();
});
document.addEventListener("keydown",function(e){if(e.key==="Escape")closeModal();});

/* ---------- click sounds (synthesised, no audio files) ---------- */
var audio=null,soundOn=true;
try{soundOn=localStorage.getItem("beanagain.sound")!=="off";}catch(e){}
function paintSound(){var b=$("#snd");b.textContent="Sound: "+(soundOn?"on":"off");b.setAttribute("aria-pressed",String(soundOn));}
function tick(freq,when,len){
  var t=audio.currentTime+when,o=audio.createOscillator(),g=audio.createGain();
  o.type="triangle";o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(freq/2,t+len);
  g.gain.setValueAtTime(0.06,t);g.gain.exponentialRampToValueAtTime(0.0001,t+len);
  o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+len+0.01);
}
function clickSound(){
  if(!soundOn)return;
  try{
    var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    if(!audio)audio=new AC();
    if(audio.state==="suspended")audio.resume();
    tick(520,0,0.05);tick(390,0.08,0.05); // click-click
  }catch(e){}
}
document.addEventListener("click",function(e){
  var el=e.target.closest("button,a,.opt");
  if(!el||el.disabled||el.id==="snd")return;
  clickSound();
},true);
$("#snd").addEventListener("click",function(){
  soundOn=!soundOn;try{localStorage.setItem("beanagain.sound",soundOn?"on":"off");}catch(e){}
  paintSound();clickSound();
});
paintSound();

route();
})();
