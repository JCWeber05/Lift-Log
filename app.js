const $=id=>document.getElementById(id);
const KEY="liftlog:v1",BAK="liftlog:v1:bak",TKEY="liftlog:timer",UKEY="liftlog:unit",EKEY="liftlog:ended",BKEY="liftlog:lastbackup",DAMAGED="liftlog:damaged:",DRAFT_KEY="liftlog:draft:v1",UNDO_KEY="liftlog:undo:v1";
let storageOK=true,notice="";
let undoStack=load(UNDO_KEY,[]);
function load(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}}
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){storageOK=false;return false}}
function safeArray(v){return Array.isArray(v)?v:[]}
function stateSnapshot(){return {entries:entries.map(e=>({...e})),timer:{...timer},ended:ended?{...ended}:null,unit}} 
function persistDraftState(){
  const payload={entries:entries.map(e=>({...e})),timer:{...timer},ended:ended?{...ended}:null,unit,updatedAt:Date.now()};
  save(DRAFT_KEY,payload);
}
function rememberUndo(label){
  const snapshot={label,ts:Date.now(),state:stateSnapshot()};
  undoStack.push(snapshot);
  if(undoStack.length>12)undoStack.shift();
  save(UNDO_KEY,undoStack);
}
function restoreDraftState(){
  const draft=load(DRAFT_KEY,null);
  if(!draft||!draft.entries||!draft.entries.length)return false;
  const list=safeArray(draft.entries).filter(e=>e&&typeof e=="object").map(e=>({
    id:String(e.id||""),date:String(e.date||todayKey()),name:String(e.name||"").trim(),reps:Number(e.reps),weight:Number(e.weight),unit:e.unit==="kg"?"kg":"lb",ts:Number(e.ts)||Date.now()}
  )).filter(e=>e.id&&e.name&&e.date&&Number.isFinite(e.reps)?e.reps>0:true && Number.isFinite(e.weight)?e.weight>0:true);
  if(!list.length)return false;
  const hasActive=!!(draft.ended||draft.timer&&((draft.timer.acc&&draft.timer.acc>0)||draft.timer.start));
  if(!hasActive&&!list.some(e=>e.date===todayKey()))return false;
  entries=list;
  timer=draft.timer&&typeof draft.timer=="object"?{acc:Number(draft.timer.acc)||0,start:draft.timer.start||null}:{acc:0,start:null};
  ended=draft.ended&&typeof draft.ended=="object"?{date:String(draft.ended.date||todayKey()),ms:Number(draft.ended.ms)||0}:null;
  unit=(draft.unit==="kg")?"kg":"lb";
  saveEntries(true);save(TKEY,timer);save(EKEY,ended);save(UKEY,unit);persistDraftState();
  return true;
}
// Reads saved history. Damaged data is never overwritten: it is set aside, and the previous copy is used instead.
function readEntries(){
  const tryKey=k=>{
    let s;try{s=localStorage.getItem(k)}catch(e){return {blocked:true}}
    if(s===null)return {empty:true};
    try{const v=JSON.parse(s);return Array.isArray(v)?{val:v}:{bad:s}}catch(e){return {bad:s}}
  };
  const a=tryKey(KEY);
  if(a.blocked){storageOK=false;notice="This browser is blocking storage, so nothing will be kept on this device. Export a backup often.";return []}
  if(a.val)return a.val;
  if(a.bad){
    try{localStorage.setItem(DAMAGED+Date.now(),a.bad)}catch(e){}
    const b=tryKey(BAK);
    if(b.val){notice="Your saved history was damaged. Restored the previous copy ("+b.val.length+" sets).";return b.val}
    notice="Your saved history was damaged and couldn’t be restored here. A copy was set aside. Restore from your sheet or a backup file in History → Data and backup.";
    return [];
  }
  const b=tryKey(BAK);
  if(b.val&&b.val.length){notice="Your history was missing. Restored the backup copy ("+b.val.length+" sets).";return b.val}
  return [];
}
// Writes history, checks it was really stored, and keeps the previous version as a backup copy.
// mirror=true (after deletes) makes the backup copy match, so deleted data isn't kept around.
function saveEntries(mirror){
  let ok=true;
  try{
    const prev=localStorage.getItem(KEY),next=JSON.stringify(entries);
    localStorage.setItem(KEY,next);
    if(localStorage.getItem(KEY)!==next)ok=false;
    try{if(mirror)localStorage.setItem(BAK,next);else if(prev&&prev!==next)localStorage.setItem(BAK,prev)}catch(e){}
  }catch(e){ok=false}
  storageOK=ok;
  if(!ok)showBanner("Couldn’t save to this device (storage is full or blocked). Your latest changes could be lost if you close the app. Export a backup, or end the workout to save to your sheet.",true)
  else if($("banner").classList.contains("err"))$("banner").hidden=true;
  return ok;
}
function showBanner(text,isErr){const b=$("banner");$("bannertext").textContent=text;b.classList.toggle("err",!!isErr);b.hidden=false}
let raw=readEntries();
// each entry is one set; older entries logged as "N sets" are split into single sets
let entries=raw.filter(e=>e&&typeof e=="object").flatMap(e=>{
  const n=e.sets>1?e.sets:1;
  return Array.from({length:n},(_,i)=>({id:n>1?e.id+"-"+i:e.id,date:e.date,name:e.name,reps:e.reps,weight:e.weight,unit:e.unit||"lb",ts:(e.ts||0)+i}));
});
const normalizeText=(s)=>String(s||"").trim();
function validPositiveNumber(value,field){
  const n=Number(value);
  if(!Number.isFinite(n)||n<=0)return false;
  if(field==="reps")return Number.isInteger(n)&&n<=1000;
  return n<=5000;
}
function isValidSetEntry(e){
  return !!(e&&e.name&&e.date&&e.unit&&String(e.unit)==="lb"||String(e.unit)==="kg")&&
    (e.reps==null || (Number.isFinite(Number(e.reps))&&Number(e.reps)>0&&Number(e.reps)<=1000))&&
    (e.weight==null || (Number.isFinite(Number(e.weight))&&Number(e.weight)>0&&Number(e.weight)<=5000));
}
if(restoreDraftState())notice="Restored your last in-progress workout. You can keep editing it or save it again.";
saveEntries();
let unit=load(UKEY,"lb"),timer=load(TKEY,{acc:0,start:null}),ended=load(EKEY,null);
if(unit!=="lb"&&unit!=="kg")unit="lb";
const pad=n=>String(n).padStart(2,"0");
const todayKey=()=>{const d=new Date();return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())};
const isEnded=()=>!!ended&&ended.date===todayKey();
const fmt=n=>Math.round(n).toLocaleString();
const wfmt=n=>String(+Number(n).toFixed(1));
const conv=(e,u)=>e.unit===u?e.weight:(u==="kg"?e.weight*0.45359237:e.weight/0.45359237);
const vol=(e,u)=>e.reps*conv(e,u);
const sum=(l,u)=>l.reduce((a,e)=>a+vol(e,u),0);
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n}
function groups(list){const g={};list.forEach(e=>{const k=e.name.toLowerCase();(g[k]=g[k]||{name:e.name,items:[]}).items.push(e)});return Object.values(g)}
const setTxt=e=>(e.reps||0)+" × "+wfmt(e.weight||0)+" "+e.unit;

/* Timer */
const dur=ms=>{const s=Math.floor(ms/1000),h=Math.floor(s/3600),m=Math.floor(s%3600/60);return (h?h+":"+pad(m):pad(m))+":"+pad(s%60)};
const elapsed=()=>timer.acc+(timer.start?Date.now()-timer.start:0);
function drawTimer(){
  $("clock").textContent=dur(elapsed());
  $("clock").classList.toggle("idle",!timer.start);
  $("tgl").textContent=timer.start?"Pause":(timer.acc?"Resume":"Start workout");
  $("end").disabled=isEnded();
}
$("tgl").onclick=()=>{
  if(timer.start){timer.acc+=Date.now()-timer.start;timer.start=null}
  else{timer.start=Date.now();ended=null;save(EKEY,null)}
  save(TKEY,timer);persistDraftState();drawTimer();render();
};
$("end").onclick=()=>{
  if(timer.start){timer.acc+=Date.now()-timer.start;timer.start=null}
  ended={date:todayKey(),ms:timer.acc};
  save(TKEY,timer);save(EKEY,ended);persistDraftState();drawTimer();render();window.scrollTo(0,0);
  syncSheet();
};
$("neww").onclick=()=>{timer={acc:0,start:null};ended=null;save(TKEY,timer);save(EKEY,null);persistDraftState();drawTimer();render();};
setInterval(drawTimer,250);

/* Unit + tabs */
function drawUnit(){$("u-lb").setAttribute("aria-pressed",unit==="lb");$("u-kg").setAttribute("aria-pressed",unit==="kg")}
function setUnit(u){if(unit===u)return;unit=u;rememberUndo("unit change");save(UKEY,u);drawUnit();persistDraftState();render()}
$("u-lb").onclick=()=>setUnit("lb");
$("u-kg").onclick=()=>setUnit("kg");
function showTab(t){
  const h=t==="hist";
  $("v-today").hidden=h;$("v-hist").hidden=!h;
  $("t-today").setAttribute("aria-selected",!h);$("t-hist").setAttribute("aria-selected",h);
}
$("t-today").onclick=()=>showTab("today");
$("t-hist").onclick=()=>showTab("hist");

/* Form */
function addSet(name,src){
  const trimmed=normalizeText(name);
  if(!trimmed){showBanner("Enter an exercise name before adding a set.",true);return}
  const last=src||entries.filter(e=>e.name.toLowerCase()===trimmed.toLowerCase()).sort((a,b)=>b.ts-a.ts)[0];
  const next={id:Date.now()+Math.random().toString(36).slice(2,6),date:todayKey(),name:trimmed,reps:last&&Number(last.reps)>0?last.reps:null,weight:last&&Number(last.weight)>0?last.weight:null,unit:last?last.unit:unit,ts:Date.now()};
  if(!isValidSetEntry(next)){
    next.reps=null;next.weight=null;
  }
  rememberUndo("add set");
  entries.push(next);
  if(isEnded()){ended=null;save(EKEY,null)}
  saveEntries();persistDraftState();render();askPersist();
}
$("f").addEventListener("submit",ev=>{
  ev.preventDefault();
  const n=$("name").value.trim();if(!n){showBanner("Exercise name is required.",true);return}
  addSet(n);$("name").value="";
});
function remove(id){rememberUndo("remove set");entries=entries.filter(e=>e.id!==id);saveEntries(true);persistDraftState();render()}
function numInput(e,field,mode,label){
  const i=document.createElement("input");
  i.type="number";i.inputMode=mode;i.min="0";i.step=field==="reps"?"1":"any";
  i.value=e[field]==null?"":e[field];i.placeholder="0";i.setAttribute("aria-label",label);
  i.oninput=()=>{
    const raw=i.value;
    const value=raw===""?null:Number(raw);
    if(raw!==""&&!Number.isFinite(value)){
      showBanner(field==="reps"?"Reps must be a positive number.":"Weight must be a positive number.",true);
      return;
    }
    if(raw!==""&&value<=0){
      showBanner(field==="reps"?"Reps must be greater than 0.":"Weight must be greater than 0.",true);
      i.value="";
      e[field]=null;saveEntries();persistDraftState();return;
    }
    const next=raw===""?null:(field==="reps"?Math.round(value):Number(value.toFixed(2)));
    if(next!==e[field]){rememberUndo("edit set");e[field]=next;saveEntries();persistDraftState();}
  };
  i.onchange=()=>{
    const raw=i.value;
    if(raw!==""&&(!Number.isFinite(Number(raw))||Number(raw)<=0)){
      i.value=e[field]==null?"":e[field];
      showBanner(field==="reps"?"Reps must be greater than 0.":"Weight must be greater than 0.",true);
    }
  };
  return i;
}

function undoLastAction(){
  const snapshot=undoStack.pop();
  if(!snapshot){showBanner("Nothing to undo yet.",false);return}
  save(UNDO_KEY,undoStack);
  const last=snapshot.state;
  if(last){
    entries=safeArray(last.entries).filter(e=>e&&typeof e=="object").map(e=>({
      ...e,
      name:String(e.name||"").trim(),
      unit:e.unit==="kg"?"kg":"lb",
      reps:Number(e.reps),
      weight:Number(e.weight)
    })).filter(e=>e.name&&e.date&&((Number(e.reps)>0&&Number(e.weight)>0)||e.reps==null||e.weight==null));
    timer=last.timer&&typeof last.timer=="object"?{acc:Number(last.timer.acc)||0,start:last.timer.start||null}:{acc:0,start:null};
    ended=last.ended&&typeof last.ended=="object"?{date:String(last.ended.date||todayKey()),ms:Number(last.ended.ms)||0}:null;
    unit=last.unit==="kg"?"kg":"lb";
  }
  saveEntries(true);save(TKEY,timer);save(EKEY,ended);save(UKEY,unit);persistDraftState();drawUnit();drawTimer();render();showBanner("Undid the last change.",false);
}

/* Render */
function render(){
  drawHealth();
  const dl=$("names");dl.textContent="";
  [...new Set(entries.map(e=>e.name))].sort().forEach(n=>{const o=document.createElement("option");o.value=n;dl.appendChild(o)});

  const td=entries.filter(e=>e.date===todayKey()).sort((a,b)=>a.ts-b.ts);
  const gs=groups(td);

  // summary (only once the workout is ended)
  const sm=$("summary");sm.hidden=!isEnded();
  if(isEnded()){
    $("sv").textContent=fmt(sum(td,unit))+" "+unit;
    const st=$("sstats");st.textContent="";
    [[dur(ended.ms),"Time"],[td.length,"Sets"],[gs.length,"Exercises"]].forEach(([v,l])=>{
      const d=el("div","stat");d.appendChild(el("b","",v));d.appendChild(el("span","",l));st.appendChild(d);
    });
    const sx=$("sex");sx.textContent="";
    gs.forEach(g=>{const r=el("div","line");r.appendChild(el("span","",g.name+" ("+g.items.length+(g.items.length===1?" set)":" sets)")));r.appendChild(el("span","vol",fmt(sum(g.items,unit))+" "+unit));sx.appendChild(r);});
  }

  drawSync();
  // today: one block per exercise, one row per set (Set / Reps / Weight)
  $("thead").textContent="Today’s sets"+(td.length?" ("+td.length+")":"");
  const box=$("today");box.textContent="";
  if(!td.length)box.appendChild(el("p","empty","No exercises yet. Add one above."));
  gs.forEach(g=>{
    const w=el("div","grp");w.appendChild(el("h3","",g.name));
    const lt=lastTime(g.name);if(lt)w.appendChild(el("p","last","Last time ("+shortDate(lt.date)+"): "+setsLine(lt.sets,8)));
    const hd=el("div","cols");["Set","Reps","Weight",""].forEach(t=>hd.appendChild(el("span","",t)));w.appendChild(hd);
    g.items.forEach((e,i)=>{
      const r=el("div","srow");r.appendChild(el("span","n",String(i+1)));
      r.appendChild(numInput(e,"reps","numeric","Reps, set "+(i+1)));
      const wc=el("div","wcell");wc.appendChild(numInput(e,"weight","decimal","Weight, set "+(i+1)));wc.appendChild(el("span","u",e.unit));r.appendChild(wc);
      const b=el("button","del","×");b.type="button";b.setAttribute("aria-label","Delete "+g.name+" set "+(i+1));b.onclick=()=>remove(e.id);
      r.appendChild(b);w.appendChild(r);
    });
    const p=el("button","plus","+");p.type="button";p.setAttribute("aria-label","Add set to "+g.name);
    p.onclick=()=>addSet(g.name,g.items[g.items.length-1]);
    w.appendChild(p);box.appendChild(w);
  });

  // history
  const h=$("hist");h.textContent="";
  const days={};entries.forEach(e=>(days[e.date]=days[e.date]||[]).push(e));
  const keys=Object.keys(days).sort().reverse();
  if(!keys.length){h.appendChild(el("p","empty","No history yet. Days you log show up here."));return}
  keys.forEach(k=>{
    const list=days[k].sort((a,b)=>a.ts-b.ts),[y,mo,d]=k.split("-").map(Number);
    const showVol=k!==todayKey()||isEnded();
    const label=new Date(y,mo-1,d).toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric",year:"numeric"});
    const g2=groups(list);
    const det=document.createElement("details"),sm2=document.createElement("summary"),m=el("div","main");
    m.appendChild(el("strong","",label));
    m.appendChild(el("small","",g2.length+(g2.length===1?" exercise, ":" exercises, ")+list.length+(list.length===1?" set":" sets")));
    sm2.appendChild(m);
    if(showVol)sm2.appendChild(el("span","vol",fmt(sum(list,unit))+" "+unit));
    det.appendChild(sm2);
    const ex=el("div","ex");
    g2.forEach(g=>{
      const hd=el("div","hd");hd.appendChild(el("span","",g.name));
      if(showVol)hd.appendChild(el("span","vol",fmt(sum(g.items,unit))+" "+unit));
      ex.appendChild(hd);
      g.items.forEach((e,i)=>{const s=el("div","s");s.appendChild(el("span","","Set "+(i+1)));s.appendChild(el("b","",setTxt(e)));ex.appendChild(s)});
    });
    const nSets=list.length,unsynced=list.filter(e=>!synced.has(e.id)&&e.reps>0).length;
    ex.appendChild(confirmBtn("Delete this day","Tap again to delete "+nSets+(nSets===1?" set":" sets")+(unsynced?" ("+unsynced+" not in your sheet yet)":""),()=>deleteEntries(e=>e.date===k,label,()=>{})));
    det.appendChild(ex);h.appendChild(det);
  });
  const total=entries.length,unsyncedAll=entries.filter(e=>!synced.has(e.id)&&e.reps>0).length;
  const ca=el("div","clearall");
  ca.appendChild(confirmBtn("Delete all history on this device","Tap again to delete all "+total+" sets"+(unsyncedAll?" ("+unsyncedAll+" not in your sheet yet)":""),()=>deleteEntries(()=>true,"all history")));
  h.appendChild(ca);
  const undoBtn=$("undo");if(undoBtn){undoBtn.hidden=undoStack.length===0;undoBtn.disabled=undoStack.length===0;}
}

/* Delete history (this device only; the Google Sheet is not touched) */
function confirmBtn(label,armedLabel,onConfirm){
  const b=el("button","btn danger",label);b.type="button";let t=null;
  b.onclick=()=>{
    if(t){clearTimeout(t);t=null;onConfirm();return}
    b.textContent=armedLabel;t=setTimeout(()=>{t=null;b.textContent=label},4000);
  };
  return b;
}
function deleteEntries(match,what){
  const before=entries.length;
  const todayGone=entries.some(e=>e.date===todayKey()&&match(e));
  rememberUndo("delete day");
  entries=entries.filter(e=>!match(e));
  saveEntries(true);persistDraftState();
  if(what==="all history"){try{Object.keys(localStorage).filter(k=>k.startsWith(DAMAGED)).forEach(k=>localStorage.removeItem(k))}catch(e){}}
  if(todayGone&&!entries.some(e=>e.date===todayKey())){ended=null;save(EKEY,null)}
  const n=before-entries.length;
  $("histmsg").textContent="Deleted "+n+(n===1?" set":" sets")+" ("+what+") from this device. Your Google Sheet wasn’t changed.";
  drawTimer();render();
}

/* Google Sheets sync: posts new sets to your Apps Script web app when a workout ends */
const SKEY="liftlog:synced",CKEY="liftlog:cfg";
let synced=new Set(load(SKEY,[])),cfg=load(CKEY,{url:"",token:"",sheetUrl:""}),syncing=false,syncMsg="",syncRetry=false,rerun=false;
if(!cfg||typeof cfg!=="object")cfg={url:"",token:"",sheetUrl:""};
function drawSync(){
  $("syncmsg").textContent=syncMsg;
  $("retry").hidden=!syncRetry||syncing;
  const a=$("sheetlink");a.hidden=!(cfg.sheetUrl&&isEnded());if(cfg.sheetUrl)a.href=cfg.sheetUrl;
}
function drawCfg(){
  $("cfgstat").textContent=cfg.url&&cfg.token?"Connected to your sheet":"Not set up yet";
  $("cfgurl").value=cfg.url||"";$("cfgtok").value=cfg.token||"";
}
async function post(rows){return call({rows})}
async function call(payload){
  const res=await fetch(cfg.url,{method:"POST",redirect:"follow",body:JSON.stringify(Object.assign({token:cfg.token},payload))});
  let j;try{j=await res.json()}catch(e){throw {code:"bad_response"}}
  if(!j||!j.ok)throw {code:j&&j.error==="bad_token"?"bad_token":"script_error",msg:j&&j.error};
  if(j.sheetUrl&&j.sheetUrl!==cfg.sheetUrl){cfg.sheetUrl=j.sheetUrl;save(CKEY,cfg)}
  return j;
}
function describe(err){
  const c=err&&err.code;
  if(c==="bad_token")return "The secret token doesn’t match the script. Check it in History → Google Sheets sync.";
  if(c==="bad_response")return "The web app URL didn’t answer like your script. Check the URL and that access is set to Anyone.";
  if(err&&err.msg==="token_not_set")return "Your script still has the placeholder token. Set your own secret in the script and redeploy.";
  if(err&&err.msg==="server_error")return "The script hit an error. Open Apps Script → Executions to see why.";
  if(c==="script_error")return "The script reported an error"+(err.msg?": "+err.msg:".");
  return "Couldn’t reach Google Sheets. Check your connection, then tap Retry.";
}
async function syncSheet(opts){
  const o=opts||{}; // pastOnly + quiet: silent retry of earlier days' unsaved sets
  if(syncing){if(!o.quiet)rerun=true;return}
  if(!o.quiet)syncRetry=false;
  if(!cfg.url||!cfg.token){if(!o.quiet){syncMsg="Sheet sync isn’t set up. Add your script URL in History → Google Sheets sync.";drawSync()}return}
  const all=entries.slice().sort((a,b)=>a.date===b.date?a.ts-b.ts:(a.date<b.date?-1:1));
  const no={},cnt={};
  all.forEach(e=>{const k=e.date+"|"+e.name.toLowerCase();cnt[k]=(cnt[k]||0)+1;no[e.id]=cnt[k]});
  const todo=all.filter(e=>!synced.has(e.id)&&e.reps>0&&(!o.pastOnly||e.date<todayKey()));
  if(!todo.length){if(!o.quiet){syncMsg=entries.length?"Everything is already saved to your sheet.":"";drawSync()}return}
  const mins=ended?Math.round(ended.ms/60000):"";
  const rows=todo.map(e=>[e.date,e.name,no[e.id],e.reps,e.weight==null?"":e.weight,e.unit,+(e.reps*(e.weight||0)).toFixed(2),e.date===todayKey()?mins:"",e.id]);
  syncing=true;if(!o.quiet){syncMsg="Saving "+todo.length+(todo.length===1?" set":" sets")+" to Google Sheets…";drawSync()}
  let skipped=0,saved=0;
  try{
    for(let i=0;i<rows.length;i+=200){ // small batches keep each request well under the script's limits
      const j=await post(rows.slice(i,i+200));
      todo.slice(i,i+200).forEach(e=>synced.add(e.id));save(SKEY,[...synced]);
      skipped+=j.rejected||0;saved+=Math.min(200,rows.length-i);
    }
    saved-=skipped;
    if(!o.quiet)syncMsg="Saved "+saved+(saved===1?" set":" sets")+" to your Lift log sheet."+(skipped?" "+skipped+(skipped===1?" set was":" sets were")+" skipped because of invalid values (check the sheet or your entries).":"");
  }catch(err){if(!o.quiet){syncRetry=true;syncMsg=describe(err)+" Retrying is safe: sets already in the sheet are skipped."}}
  syncing=false;drawSync();drawHealth();
  if(rerun){rerun=false;syncSheet()}
}
$("retry").onclick=()=>syncSheet();
$("cfgsave").onclick=async()=>{
  cfg.url=$("cfgurl").value.trim();cfg.token=$("cfgtok").value.trim();
  if(!/^https:\/\/script\.google\.com\/.+\/exec/.test(cfg.url)){$("cfgmsg").textContent="That doesn’t look like a web app URL. It should start with https://script.google.com and end with /exec.";return}
  if(!cfg.token){$("cfgmsg").textContent="Enter the secret token from your script.";return}
  $("cfgmsg").textContent="Testing…";
  try{await post([]);save(CKEY,cfg);$("cfgmsg").textContent="Connected. Sets will save when you tap End workout.";drawCfg();drawSync()}
  catch(err){$("cfgmsg").textContent=describe(err)}
};

/* Data health, backup, import and restore */
let persisted=null,lastBackup=load(BKEY,0);
async function askPersist(){
  try{
    if(navigator.storage&&navigator.storage.persisted){
      persisted=await navigator.storage.persisted();
      if(!persisted&&navigator.storage.persist)persisted=await navigator.storage.persist();
    }
  }catch(e){}
  drawHealth();
}
function drawHealth(){
  const total=entries.length,pending=entries.filter(e=>e.reps>0&&!synced.has(e.id)).length,linked=!!(cfg.url&&cfg.token);
  $("hstat").textContent=total+(total===1?" set":" sets")+(linked?(pending?" · "+pending+" not in sheet yet":" · all in sheet"):" · sheet not connected");
  $("hdetail").textContent="Persistent storage: "+(persisted===true?"on":persisted===false?"off (the browser may clear this data if space runs low or the app goes unused for a long time)":"unknown")+" · Last backup: "+(lastBackup?new Date(lastBackup).toLocaleString():"never");
  $("brest").hidden=!linked;
}
function backupJSON(){
  return JSON.stringify({app:"liftlog",version:1,exported:new Date().toISOString(),entries:entries.map(e=>({id:e.id,date:e.date,name:e.name,reps:e.reps,weight:e.weight,unit:e.unit,ts:e.ts}))},null,2);
}
async function deliver(file){
  try{
    if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:"Lift log backup"});return "Shared. Keep it somewhere safe, like Files, Drive or an email thread."}
  }catch(e){if(e&&e.name==="AbortError")return ""}
  const a=document.createElement("a");a.href=URL.createObjectURL(file);a.download=file.name;document.body.appendChild(a);a.click();a.remove();
  return "Saved to your downloads.";
}
$("bexp").onclick=async()=>{
  if(!entries.length){$("hmsg").textContent="Nothing to back up yet.";return}
  const file=new File([backupJSON()],"lift-log-backup-"+todayKey()+".json",{type:"application/json"});
  const m=await deliver(file);
  if(m){lastBackup=Date.now();save(BKEY,lastBackup);drawHealth()}
  $("hmsg").textContent=m;
};
// Only known fields are accepted, with strict types and ranges, so a bad file can't put anything odd in your history.
function cleanEntry(o){
  if(!o||typeof o!=="object")return null;
  const id=String(o.id==null?"":"+o.id),date=String(o.date==null?"":o.date);
  if(!/^[A-Za-z0-9._-]{1,64}$/.test(id)||!/^?/.test(date))return null;
  const name=String(o.name==null?"":o.name).replace(/[\u0000-\u001f\u007f]/g,"").trim();
  if(!name||name.length>60)return null;
  const num=(v,lo,hi)=>{if(v===null||v===undefined||v==="")return null;const n=typeof v==="number"?v:Number(v);return isFinite(n)&&n>=lo&&n<=hi?n:undefined};
  const reps=num(o.reps,0,1000),weight=num(o.weight,0,5000);
  if(reps===undefined||weight===undefined)return null;
  const unit=o.unit==="kg"?"kg":o.unit==="lb"?"lb":null;if(!unit)return null;
  return {id,date,name,reps:reps===null?null:Math.round(reps),weight,unit,ts:isFinite(o.ts)?Number(o.ts):0};
}
function mergeEntries(list){
  const have=new Set(entries.map(e=>e.id));let added=0,dupes=0,bad=0;
  list.forEach(o=>{const e=cleanEntry(o);if(!e){bad++;return}if(have.has(e.id)){dupes++;return}have.add(e.id);entries.push(e);added++});
  return {added,dupes,bad};
}
$("bimp").onclick=()=>$("impfile").click();
$("impfile").onchange=async ev=>{
  const f=ev.target.files&&ev.target.files[0];ev.target.value="";if(!f)return;
  const msg=$("hmsg");
  if(f.size>5e6){msg.textContent="That file is too large to be a Lift log backup.";return}
  let data;try{data=JSON.parse(await f.text())}catch(e){msg.textContent="That file isn’t a Lift log backup.";return}
  if(!data||data.app!=="liftlog"||!Array.isArray(data.entries)||data.entries.length>100000){msg.textContent="That file isn’t a Lift log backup.";return}
  const r=mergeEntries(data.entries);saveEntries();persistDraftState();render();
  msg.textContent="Imported "+r.added+(r.added===1?" set":" sets")+". "+r.dupes+" already on this device"+(r.bad?", "+r.bad+" skipped as invalid":"")+".";
};
$("brest").onclick=async()=>{
  const msg=$("hmsg");msg.textContent="Reading your sheet…";
  try{
    let offset=0,total=Infinity;const r={added:0,dupes:0,bad:0};
    while(offset<total){
      const j=await call({action:"export",offset,limit:2000});
      const rows=Array.isArray(j.rows)?j.rows:[];total=Number(j.total)||0;
      const list=rows.map((x,i)=>{
        const d=String(x[0]),p=d.split("-").map(Number);
        return {id:x[8],date:d,name:x[1],reps:x[3],weight:x[4],unit:x[5],ts:new Date(p[0],(p[1]||1)-1,p[2]||1,12).getTime()+offset+i};
      });
      const m=mergeEntries(list);r.added+=m.added;r.dupes+=m.dupes;r.bad+=m.bad;
      list.forEach(o=>{if(/^[A-Za-z0-9._-]{1,64}$/.test(String(o.id)))synced.add(String(o.id))}); // these are in the sheet by definition
      if(!rows.length)break;offset+=2000;
    }
    save(SKEY,[...synced]);saveEntries();persistDraftState();render();
    msg.textContent="Restored "+r.added+(r.added===1?" set":" sets")+" from your sheet. "+r.dupes+" were already on this device"+(r.bad?", "+r.bad+" skipped":"")+".";
  }catch(err){msg.textContent=describe(err)}
};
$("bannerx").onclick=()=>{$("banner").hidden=true};
$("cfgsave").parentNode.appendChild(confirmBtn("Forget this connection","Tap again to remove the URL and token from this device",()=>{
  cfg={url:"",token:"",sheetUrl:""};save(CKEY,cfg);drawCfg();drawSync();drawHealth();
  $("cfgmsg").textContent="Removed from this device. Your sheet and script are untouched.";
}));

/* Spreadsheet export (CSV opens in Google Sheets, Excel, Numbers) */
/* Last time + share */
function shortDate(d){const [y,m,day]=d.split("-").map(Number);return new Date(y,m-1,day).toLocaleDateString(undefined,{month:"short",day:"numeric"})}
function setsLine(items,max){
  const units=[...new Set(items.map(e=>e.unit))],cap=max||8;
  const parts=items.slice(0,cap).map(e=>e.reps+" × "+wfmt(e.weight||0)+(units.length>1?" "+e.unit:""));
  let t=parts.join(", ")+(units.length===1?" "+units[0]:"");
  if(items.length>cap)t+=" +"+(items.length-cap)+" more";
  return t;
}
function lastTime(name){
  const n=name.toLowerCase(),t=todayKey();
  const prior=entries.filter(e=>e.date<t&&e.name.toLowerCase()===n&&e.reps>0);
  if(!prior.length)return null;
  const d=prior.reduce((m,e)=>e.date>m?e.date:m,"");
  return {date:d,sets:prior.filter(e=>e.date===d).sort((a,b)=>a.ts-b.ts)};
}
function todaySets(){return entries.filter(e=>e.date===todayKey()&&e.reps>0).sort((a,b)=>a.ts-b.ts)}
function workoutText(){
  const td=todaySets(),gs=groups(td),[y,m,d]=todayKey().split("-").map(Number);
  const lines=["Workout · "+new Date(y,m-1,d).toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"}),
    dur(ended?ended.ms:0)+" · "+td.length+" sets · "+fmt(sum(td,unit))+" "+unit,""];
  gs.forEach(g=>lines.push(g.name+": "+setsLine(g.items,99)));
  return lines.join("\n");
}
function drawCard(){
  const td=todaySets(),gs=groups(td),[y,m,d]=todayKey().split("-").map(Number);
  const W=1080,P=72,INK="#151A22",MUTED="#5F6B7A",ACC="#2B4BD8";
  const cond=(w,s)=>w+" "+s+"px 'Barlow Condensed','Arial Narrow',sans-serif";
  const body=(w,s)=>w+" "+s+"px Barlow,system-ui,-apple-system,'Segoe UI',sans-serif";
  const c=document.createElement("canvas"),x=c.getContext("2d");
  const wrap=(text,f,maxW)=>{x.font=f;const out=[];let line="";text.split(" ").forEach(w=>{const t=line?line+" "+w:w;if(x.measureText(t).width>maxW&&line){out.push(line);line=w}else line=t});if(line)out.push(line);return out};
  const blocks=gs.map(g=>({name:g.name,vol:fmt(sum(g.items,unit))+" "+unit,lines:wrap(setsLine(g.items,99),body("500",34),W-2*P-20)}));
  let H=700;blocks.forEach(b=>{H+=70+b.lines.length*46+34});H+=110;
  c.width=W;c.height=H;
  x.fillStyle="#fff";x.fillRect(0,0,W,H);x.fillStyle=ACC;x.fillRect(0,0,20,H);
  x.textBaseline="alphabetic";x.textAlign="left";
  x.fillStyle=INK;x.font=cond("700",64);x.fillText("Workout done",P,130);
  x.fillStyle=MUTED;x.font=body("500",34);
  x.fillText(new Date(y,m-1,d).toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric",year:"numeric"}),P,186);
  x.fillStyle=INK;x.font=cond("700",190);x.fillText(fmt(sum(td,unit))+" "+unit,P,380);
  x.fillStyle=MUTED;x.font=body("500",34);x.fillText("Total volume lifted",P,450);
  [[dur(ended?ended.ms:0),"Time"],[td.length,"Sets"],[gs.length,"Exercises"]].forEach(([v,l],i)=>{
    const cx=P+i*320;x.fillStyle=INK;x.font=cond("700",84);x.fillText(String(v),cx,550);
    x.fillStyle=MUTED;x.font=body("500",30);x.fillText(l,cx,594);
  });
  x.fillStyle="#D3D8DF";x.fillRect(P,640,W-2*P,3);
  let yy=700;
  blocks.forEach(b=>{
    x.fillStyle=INK;x.font=cond("700",48);x.textAlign="left";x.fillText(b.name,P,yy+40);
    x.textAlign="right";x.font=cond("600",42);x.fillText(b.vol,W-P,yy+40);x.textAlign="left";
    x.fillStyle=MUTED;x.font=body("500",34);
    b.lines.forEach((ln,i)=>x.fillText(ln,P,yy+92+i*46));
    yy+=70+b.lines.length*46+34;
  });
  x.fillStyle=MUTED;x.font=body("500",28);x.fillText("Lift log",P,H-44);
  return c;
}
async function shareWorkout(){
  const msg=$("sharemsg");msg.textContent="";
  const text=workoutText();let file=null;
  try{
    const blob=await new Promise(r=>drawCard().toBlob(r,"image/png"));
    if(blob)file=new File([blob],"workout-"+todayKey()+".png",{type:"image/png"});
  }catch(e){}
  try{
    if(file&&navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],text});msg.textContent="Shared.";return}
    if(navigator.share){await navigator.share({text});msg.textContent="Shared the text summary.";return}
  }catch(e){if(e&&e.name==="AbortError")return}
  try{await navigator.clipboard.writeText(text);msg.textContent="Copied the summary. Paste it anywhere."}
  catch(e){
    if(file){const a=document.createElement("a");a.href=URL.createObjectURL(file);a.download=file.name;document.body.appendChild(a);a.click();a.remove();msg.textContent="Saved the image."}
    else msg.textContent="Sharing isn’t available here."
  }
}
$("sharebtn").onclick=shareWorkout;

function csv(){
  const q=v=>{v=String(v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
  const rows=[["Date","Exercise","Set","Reps","Weight","Unit","Volume"]],cnt={};
  entries.slice().sort((a,b)=>a.date===b.date?a.ts-b.ts:(a.date<b.date?-1:1)).forEach(e=>{
    const k=e.date+"|"+e.name.toLowerCase();cnt[k]=(cnt[k]||0)+1;
    rows.push([e.date,e.name,cnt[k],e.reps??"",e.weight??"",e.unit,+((e.reps||0)*(e.weight||0)).toFixed(2)]);
  });
  return rows.map(r=>r.map(q).join(",")).join("\n");
}
$("exp").onclick=async()=>{
  if(!entries.length){$("expmsg").textContent="Log a set first, then export.";return}
  const name="lift-log-"+todayKey()+".csv",file=new File([csv()],name,{type:"text/csv"});
  try{
    if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:"Lift log"});$("expmsg").textContent="Shared.";return}
    const a=document.createElement("a");a.href=URL.createObjectURL(file);a.download=name;document.body.appendChild(a);a.click();a.remove();
    $("expmsg").textContent="Saved to your downloads.";
  }catch(e){if(e&&e.name!=="AbortError")$("expmsg").textContent="Export didn’t work here."}
};

/* Offline support */
if("serviceWorker" in navigator&&location.protocol.startsWith("http")){
  window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
}

drawUnit();drawTimer();drawCfg();render();
if(notice)showBanner(notice,false);
askPersist();
if(cfg.url&&cfg.token)syncSheet({pastOnly:true,quiet:true});
window.addEventListener("online",()=>syncSheet({pastOnly:true,quiet:true}));
$("undo").onclick=undoLastAction;

persistDraftState();
