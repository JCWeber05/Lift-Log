const APP_VERSION="1.5";
const $=id=>document.getElementById(id);
const KEY="liftlog:v1",BAK="liftlog:v1:bak",TKEY="liftlog:timer",UKEY="liftlog:unit",EKEY="liftlog:ended",BKEY="liftlog:lastbackup",DAMAGED="liftlog:damaged:";
let storageOK=true,notice="";
function load(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}}
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){storageOK=false;return false}}
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
  if(!ok)showBanner("Couldn’t save to this device (storage is full or blocked). Your latest changes could be lost if you close the app. Export a backup, or end the workout to save to your sheet.",true);
  else if($("banner").classList.contains("err"))$("banner").hidden=true;
  return ok;
}
function showBanner(text,isErr){const b=$("banner");$("bannertext").textContent=text;b.classList.toggle("err",!!isErr);b.hidden=false}
let raw=readEntries();
// each entry is one set; older entries logged as "N sets" are split into single sets
let entries=raw.filter(e=>e&&typeof e==="object").flatMap(e=>{
  const n=e.sets>1?e.sets:1;
  return Array.from({length:n},(_,i)=>({id:n>1?e.id+"-"+i:e.id,date:e.date,name:e.name,reps:e.reps,weight:e.weight,unit:e.unit||"lb",ts:(e.ts||0)+i,...(e.bw===true?{bw:true}:{})}));
});
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
// Bodyweight sets show "BW"; any weight entered is extra weight added on top (vest, belt, dumbbell).
const wTxt=e=>e.bw?(e.weight>0?"BW + "+wfmt(e.weight)+" "+e.unit:"BW"):wfmt(e.weight||0)+" "+e.unit;
const setTxt=e=>(e.reps||0)+" × "+wTxt(e);
// Volume label: bodyweight work with no added weight has no volume, so show total reps instead.
const volLabel=items=>{const v=sum(items,unit);return v===0&&items.some(e=>e.bw)?items.reduce((a,e)=>a+(e.reps||0),0)+" reps":fmt(v)+" "+unit};

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
  save(TKEY,timer);drawTimer();render();
};
$("end").onclick=()=>{
  if(timer.start){timer.acc+=Date.now()-timer.start;timer.start=null}
  ended={date:todayKey(),ms:timer.acc};
  save(TKEY,timer);save(EKEY,ended);drawTimer();render();window.scrollTo(0,0);
  syncSheet();
};
$("neww").onclick=()=>{timer={acc:0,start:null};ended=null;save(TKEY,timer);save(EKEY,null);drawTimer();render()};
setInterval(drawTimer,250);

/* Unit + tabs */
function drawUnit(){$("u-lb").setAttribute("aria-pressed",unit==="lb");$("u-kg").setAttribute("aria-pressed",unit==="kg")}
function setUnit(u){unit=u;save(UKEY,u);drawUnit();render()}
$("u-lb").onclick=()=>setUnit("lb");
$("u-kg").onclick=()=>setUnit("kg");
function showTab(t){
  const h=t==="hist";
  $("v-today").hidden=h;$("v-hist").hidden=!h;
  $("t-today").setAttribute("aria-selected",!h);$("t-hist").setAttribute("aria-selected",h);
}
$("t-today").onclick=()=>showTab("today");
$("t-hist").onclick=()=>{render();showTab("hist")};

/* Form */
function addSet(name,src){
  const last=src||entries.filter(e=>e.name.toLowerCase()===name.toLowerCase()).sort((a,b)=>b.ts-a.ts)[0];
  entries.push({id:Date.now()+Math.random().toString(36).slice(2,6),date:todayKey(),name,
    reps:last?last.reps:null,weight:last?last.weight:null,unit:last?last.unit:unit,ts:Date.now(),...(last&&last.bw?{bw:true}:{})});
  if(isEnded()){ended=null;save(EKEY,null)}
  saveEntries();render();askPersist();
}
$("f").addEventListener("submit",ev=>{
  ev.preventDefault();
  const n=$("name").value.trim();if(!n)return;
  addSet(n);$("name").value="";
});
function remove(id){entries=entries.filter(e=>e.id!==id);saveEntries(true);render()}
function numInput(e,field,mode,label){
  const i=document.createElement("input");
  i.type="number";i.inputMode=mode;i.min="0";i.step=field==="reps"?"1":"any";
  i.value=e[field]==null?"":e[field];i.placeholder="0";i.setAttribute("aria-label",label);
  i.oninput=()=>{const v=parseFloat(i.value);e[field]=isNaN(v)?null:(field==="reps"?Math.round(v):v);saveEntries()};
  return i;
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
    gs.forEach(g=>{const r=el("div","line");r.appendChild(el("span","",g.name+" ("+g.items.length+(g.items.length===1?" set)":" sets)")));r.appendChild(el("span","vol",volLabel(g.items)));sx.appendChild(r)});
  }

  drawSync();
  // today: one block per exercise, one row per set (Set / Reps / Weight)
  $("thead").textContent="Today’s sets"+(td.length?" ("+td.length+")":"");
  const box=$("today");box.textContent="";
  if(!td.length)box.appendChild(el("p","empty","No exercises yet. Add one above."));
  gs.forEach(g=>{
    const isBW=g.items.every(e=>e.bw);
    const w=el("div","grp");
    const gh=el("div","ghd");gh.appendChild(el("h3","",g.name));
    const bt=el("button","bwt","Bodyweight");bt.type="button";bt.setAttribute("aria-pressed",isBW);
    bt.setAttribute("aria-label","Bodyweight exercise: "+g.name);
    bt.onclick=()=>{g.items.forEach(e=>{if(isBW)delete e.bw;else e.bw=true});saveEntries();render()};
    gh.appendChild(bt);w.appendChild(gh);
    const lt=lastTime(g.name);if(lt)w.appendChild(el("p","last","Last time ("+shortDate(lt.date)+"): "+setsLine(lt.sets,8)));
    const hd=el("div","cols");["Set","Reps",isBW?"Added":"Weight",""].forEach(t=>hd.appendChild(el("span","",t)));w.appendChild(hd);
    g.items.forEach((e,i)=>{
      const r=el("div","srow");r.appendChild(el("span","n",String(i+1)));
      r.appendChild(numInput(e,"reps","numeric","Reps, set "+(i+1)));
      const wc=el("div","wcell");wc.appendChild(numInput(e,"weight","decimal",(isBW?"Added weight, set ":"Weight, set ")+(i+1)));wc.appendChild(el("span","u",e.unit));r.appendChild(wc);
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
      if(showVol)hd.appendChild(el("span","vol",volLabel(g.items)));
      ex.appendChild(hd);
      g.items.forEach((e,i)=>{const s=el("div","s");s.appendChild(el("span","","Set "+(i+1)));s.appendChild(el("b","",setTxt(e)));ex.appendChild(s)});
    });
    const nSets=list.length,unsynced=list.filter(e=>!synced.has(e.id)&&e.reps>0).length;
    ex.appendChild(confirmBtn("Delete this day","Tap again to delete "+nSets+(nSets===1?" set":" sets")+(unsynced?" ("+unsynced+" not in your sheet yet)":""),()=>deleteEntries(e=>e.date===k,label)));
    det.appendChild(ex);h.appendChild(det);
  });
  const total=entries.length,unsyncedAll=entries.filter(e=>!synced.has(e.id)&&e.reps>0).length;
  const ca=el("div","clearall");
  ca.appendChild(confirmBtn("Delete all history on this device","Tap again to delete all "+total+" sets"+(unsyncedAll?" ("+unsyncedAll+" not in your sheet yet)":""),()=>deleteEntries(()=>true,"all history")));
  h.appendChild(ca);
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
  entries=entries.filter(e=>!match(e));
  saveEntries(true);
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
    if(!o.quiet)syncMsg="Saved "+saved+(saved===1?" set":" sets")+" to your Lift log sheet."+(skipped?" "+skipped+(skipped===1?" set was":" sets were")+" skipped because of invalid values (check reps and weight).":"");
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

/* Personalization and first-run setup guide */
const SCRIPT_TEMPLATE="// Lift log: receives workouts from the app and adds them to the \"Log\" tab of this spreadsheet.\n// Each workout gets its own banner row (date, workout number, exercises, sets, total volume, minutes)\n// with a blank row between workouts. Set rows stay one per set, so you can still filter and sort.\n//\n// Setup: the secret token below was made for you by the app. Deploy this as a web app (the app's guide shows how).\n// Keep the token private: anyone who has it and your web app URL can add rows to this sheet.\n// Tidy up existing rows: run reformatLog() once from the Apps Script editor.\n\nconst TOKEN = \"CHANGE-THIS-TO-A-LONG-RANDOM-STRING\";\nconst TAB = \"Log\";\n// Columns A-H are the readable ones. I (Set ID) is used to skip duplicates and is hidden. J labels the workout.\nconst HEADER = [\"Date\", \"Exercise\", \"Set\", \"Reps\", \"Weight\", \"Unit\", \"Volume\", \"Workout minutes\", \"Set ID\", \"Workout\"];\nconst COLS = HEADER.length;\nconst BANNER_BG = \"#2B4BD8\";\nconst BANNER_FG = \"#FFFFFF\";\nconst MAX_BODY = 100000; // bytes of request body\nconst MAX_ROWS = 500;    // sets per request\n\nfunction doGet() {\n  return reply({ ok: false, error: \"post_only\" });\n}\n\nfunction doPost(e) {\n  const lock = LockService.getScriptLock();\n  try {\n    if (TOKEN === \"CHANGE-THIS-TO-A-LONG-RANDOM-STRING\" || String(TOKEN).length < 24) {\n      return reply({ ok: false, error: \"token_not_set\" });\n    }\n    const raw = e && e.postData && e.postData.contents;\n    if (typeof raw !== \"string\" || raw.length > MAX_BODY) return reply({ ok: false, error: \"bad_request\" });\n    let data;\n    try { data = JSON.parse(raw); } catch (_) { return reply({ ok: false, error: \"bad_request\" }); }\n    if (!data || typeof data !== \"object\" || !safeEqual(data.token, TOKEN)) {\n      return reply({ ok: false, error: \"bad_token\" });\n    }\n    // Read-only: lets the app restore its history from this sheet (same token required).\n    if (data.action === \"export\") return reply(exportRows(data.offset, data.limit));\n    if (data.rows !== undefined && !Array.isArray(data.rows)) return reply({ ok: false, error: \"bad_request\" });\n    const input = data.rows || [];\n    if (input.length > MAX_ROWS) return reply({ ok: false, error: \"too_many_rows\" });\n\n    // Keep only well-formed sets; count the rest so the app can tell you.\n    const rows = [];\n    let rejected = 0;\n    input.forEach(r => {\n      const clean = cleanRow(r);\n      if (clean) rows.push(clean); else rejected++;\n    });\n\n    lock.waitLock(20000);\n    const ss = SpreadsheetApp.getActiveSpreadsheet();\n    const sheet = ss.getSheetByName(TAB) || ss.insertSheet(TAB);\n    ensureHeader(sheet);\n    if (!rows.length) return reply({ ok: true, added: 0, rejected, sheetUrl: ss.getUrl() });\n\n    // Skip sets that are already in the sheet, so retrying never creates duplicates.\n    const last = sheet.getLastRow();\n    const have = new Set(last > 1 ? sheet.getRange(2, 9, last - 1, 1).getValues().map(r => String(r[0])) : []);\n    const fresh = rows.filter(r => !have.has(String(r[8])));\n\n    if (fresh.length) {\n      const tz = ss.getSpreadsheetTimeZone();\n      const counts = workoutsPerDate(sheet, tz);\n      const byDate = {};\n      const dates = [];\n      fresh.forEach(r => {\n        const d = r[0];\n        if (!byDate[d]) { byDate[d] = []; dates.push(d); }\n        byDate[d].push(r);\n      });\n      const hasRows = last > 1;\n      const blocks = dates.map((d, i) => {\n        counts[d] = (counts[d] || 0) + 1;\n        return makeBlock(d, counts[d], byDate[d], hasRows || i > 0, tz);\n      });\n      writeBlocks(sheet, blocks);\n    }\n    return reply({ ok: true, added: fresh.length, rejected, sheetUrl: ss.getUrl() });\n  } catch (err) {\n    console.error(err); // details stay in the script's execution log, not in the response\n    return reply({ ok: false, error: \"server_error\" });\n  } finally {\n    try { lock.releaseLock(); } catch (_) {}\n  }\n}\n\n// Returns saved sets (rows that have a Set ID) in pages, for the app's \"Restore from sheet\" button.\nfunction exportRows(offset, limit) {\n  const ss = SpreadsheetApp.getActiveSpreadsheet();\n  const sheet = ss.getSheetByName(TAB);\n  const start = intIn(offset, 0, 10000000) || 0;\n  const size = intIn(limit, 1, 2000) || 2000;\n  if (!sheet || sheet.getLastRow() < 2) return { ok: true, total: 0, rows: [] };\n  const tz = ss.getSpreadsheetTimeZone();\n  const vals = sheet.getRange(2, 1, sheet.getLastRow() - 1, 9).getValues();\n  const data = vals\n    .filter(r => String(r[1]).trim() !== \"\" && String(r[8]).trim() !== \"\")\n    .map(r => [dateText(r[0], tz), String(r[1]), r[2], r[3], r[4], String(r[5]), r[6], r[7], String(r[8])]);\n  return { ok: true, total: data.length, rows: data.slice(start, start + size) };\n}\n\n// Run this once from the editor to give existing rows the banner layout.\n// It keeps a copy of the old tab (\"Log backup ...\") that you can delete when you're happy.\nfunction reformatLog() {\n  const ss = SpreadsheetApp.getActiveSpreadsheet();\n  const sheet = ss.getSheetByName(TAB);\n  if (!sheet) throw new Error('No \"' + TAB + '\" tab found.');\n  const tz = ss.getSpreadsheetTimeZone();\n  ensureHeader(sheet);\n  const last = sheet.getLastRow();\n  if (last < 2) return;\n\n  const values = sheet.getRange(2, 1, last - 1, COLS).getValues();\n  const data = [];\n  values.forEach((r, i) => {\n    if (String(r[1]).trim() === \"\") return; // banner and blank rows have no exercise name\n    const row = r.slice();\n    row[0] = dateText(row[0], tz);\n    data.push({ row, i });\n  });\n  data.sort((a, b) => (a.row[0] < b.row[0] ? -1 : a.row[0] > b.row[0] ? 1 : a.i - b.i));\n\n  const groups = [];\n  const perDate = {};\n  let cur = null;\n  data.forEach(({ row }) => {\n    const key = row[9] ? String(row[9]) : row[0];\n    if (!cur || cur.key !== key) {\n      perDate[row[0]] = (perDate[row[0]] || 0) + 1;\n      cur = { key, d: row[0], n: perDate[row[0]], rows: [] };\n      groups.push(cur);\n    }\n    cur.rows.push(row);\n  });\n  const blocks = groups.map((g, i) => makeBlock(g.d, g.n, g.rows, i > 0, tz));\n\n  sheet.copyTo(ss).setName(\"Log backup \" + Utilities.formatDate(new Date(), tz, \"yyyy-MM-dd HH-mm\"));\n  sheet.getRange(2, 1, Math.max(sheet.getMaxRows() - 1, 1), COLS).clear();\n  writeBlocks(sheet, blocks);\n}\n\n// ---- validation and safety ----\n\n// Compares two strings without stopping at the first difference.\nfunction safeEqual(a, b) {\n  const x = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(a));\n  const y = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(b));\n  let diff = x.length ^ y.length;\n  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];\n  return diff === 0;\n}\n\n// Returns a cleaned 9-value row, or null if anything is off.\nfunction cleanRow(r) {\n  if (!Array.isArray(r) || r.length < 9 || r.length > 12) return null;\n  const date = String(r[0]);\n  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date) || isNaN(Date.parse(date))) return null;\n  const name = cleanText(r[1], 60);\n  const set = intIn(r[2], 1, 100);\n  const reps = intIn(r[3], 1, 1000);\n  const weight = r[4] === \"\" || r[4] === null ? \"\" : numIn(r[4], 0, 5000);\n  const unit = String(r[5]);\n  const volume = numIn(r[6], 0, 5000000);\n  const mins = r[7] === \"\" || r[7] === null || r[7] === undefined ? \"\" : numIn(r[7], 0, 1440);\n  const id = String(r[8]);\n  if (!name || set === null || reps === null || weight === null || volume === null || mins === null) return null;\n  if (unit !== \"lb\" && unit !== \"kg\") return null;\n  if (!/^[A-Za-z0-9._-]{1,64}$/.test(id)) return null;\n  return [date, name, set, reps, weight, unit, volume, mins, id];\n}\n\nfunction cleanText(v, max) {\n  const t = String(v).replace(/[\\u0000-\\u001f\\u007f]/g, \"\").trim();\n  return t && t.length <= max ? t : null;\n}\n\nfunction numIn(v, lo, hi) {\n  const n = typeof v === \"number\" ? v : (typeof v === \"string\" && v.trim() !== \"\" ? Number(v) : NaN);\n  return isFinite(n) && n >= lo && n <= hi ? n : null;\n}\n\nfunction intIn(v, lo, hi) {\n  const n = numIn(v, lo, hi);\n  return n !== null && Math.floor(n) === n ? n : null;\n}\n\n// ---- helpers ----\n\nfunction makeBlock(d, n, setRows, withSpacer, tz) {\n  const label = d + \" #\" + n;\n  const rows = [];\n  if (withSpacer) rows.push(new Array(COLS).fill(\"\"));\n  const bannerIdx = rows.length;\n  const banner = new Array(COLS).fill(\"\");\n  banner[0] = bannerText(d, n, setRows, tz);\n  rows.push(banner);\n  setRows.forEach(r => {\n    const out = [];\n    for (let i = 0; i < 9; i++) out.push(r[i] === undefined || r[i] === null ? \"\" : r[i]);\n    out[0] = d;\n    out.push(label);\n    rows.push(out);\n  });\n  return { rows, bannerIdx };\n}\n\nfunction writeBlocks(sheet, blocks) {\n  const start = Math.max(sheet.getLastRow(), 1) + 1;\n  const values = [];\n  const bannerRows = [];\n  blocks.forEach(b => {\n    bannerRows.push(start + values.length + b.bannerIdx);\n    b.rows.forEach(r => values.push(r));\n  });\n  const area = sheet.getRange(start, 1, values.length, COLS);\n  area.setBackground(null).setFontColor(null).setFontWeight(\"normal\");\n  // Plain-text format on the text columns, so a value like \"=1+1\" is stored as text and never runs as a formula.\n  [1, 2, 6, 9, 10].forEach(c => sheet.getRange(start, c, values.length, 1).setNumberFormat(\"@\"));\n  area.setValues(values);\n  bannerRows.forEach(r => {\n    sheet.getRange(r, 1, 1, COLS).setBackground(BANNER_BG).setFontColor(BANNER_FG).setFontWeight(\"bold\");\n  });\n}\n\nfunction bannerText(d, n, setRows, tz) {\n  const [y, m, day] = d.split(\"-\").map(Number);\n  const pretty = Utilities.formatDate(new Date(y, m - 1, day, 12), tz, \"EEE, MMM d, yyyy\");\n  const names = {};\n  const totals = {};\n  let mins = \"\";\n  setRows.forEach(r => {\n    names[String(r[1]).toLowerCase()] = true;\n    const unit = r[5] || \"\";\n    totals[unit] = (totals[unit] || 0) + (Number(r[6]) || 0);\n    if (mins === \"\" && r[7] !== \"\" && r[7] !== undefined && r[7] !== null) mins = Number(r[7]);\n  });\n  const ex = Object.keys(names).length;\n  const vol = Object.keys(totals).map(u => commas(Math.round(totals[u])) + \" \" + u).join(\" + \");\n  const parts = [pretty, \"Workout \" + n, ex + (ex === 1 ? \" exercise\" : \" exercises\"), setRows.length + (setRows.length === 1 ? \" set\" : \" sets\"), vol];\n  if (mins !== \"\" && !isNaN(mins)) parts.push(mins + \" min\");\n  return parts.join(\"  \u00b7  \");\n}\n\nfunction workoutsPerDate(sheet, tz) {\n  const last = sheet.getLastRow();\n  const counts = {};\n  if (last < 2) return counts;\n  const vals = sheet.getRange(2, 1, last - 1, COLS).getValues();\n  const seen = {};\n  vals.forEach(r => {\n    if (String(r[1]).trim() === \"\") return;\n    const d = dateText(r[0], tz);\n    const key = d + \"|\" + (r[9] ? String(r[9]) : \"older\");\n    if (!seen[key]) { seen[key] = true; counts[d] = (counts[d] || 0) + 1; }\n  });\n  return counts;\n}\n\nfunction dateText(v, tz) {\n  if (Object.prototype.toString.call(v) === \"[object Date]\") return Utilities.formatDate(v, tz, \"yyyy-MM-dd\");\n  return String(v);\n}\n\nfunction commas(n) {\n  return String(n).replace(/\\B(?=(\\d{3})+(?!\\d))/g, \",\");\n}\n\nfunction ensureHeader(sheet) {\n  const current = sheet.getRange(1, 1, 1, COLS).getValues()[0];\n  if (current.join(\"|\") !== HEADER.join(\"|\")) {\n    sheet.getRange(1, 1, 1, COLS).setValues([HEADER]).setFontWeight(\"bold\");\n    sheet.setFrozenRows(1);\n  }\n  if (!sheet.isColumnHiddenByUser(9)) sheet.hideColumns(9);\n}\n\nfunction reply(obj) {\n  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);\n}\n";
const SETKEY="liftlog:setup";
const ACCENTS={blue:["#2B4BD8","Blue"],green:["#1B7F4B","Green"],orange:["#B85400","Orange"],purple:["#7B3FD1","Purple"],red:["#C2263A","Red"]};
let setup=load(SETKEY,null);if(!setup||typeof setup!=="object")setup={};
setup={status:setup.status==="skipped"||setup.status==="done"?setup.status:"",
  name:typeof setup.name==="string"?setup.name.replace(/[\u0000-\u001f\u007f]/g,"").slice(0,30):"",
  accent:Object.prototype.hasOwnProperty.call(ACCENTS,setup.accent)?setup.accent:"blue",
  token:/^[A-Za-z0-9]{24,64}$/.test(setup.token||"")?setup.token:""};
const saveSetup=()=>save(SETKEY,setup);
function makeToken(){ // 40 random letters and digits from the browser's secure random source
  const a="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",buf=new Uint8Array(64);let t="";
  while(t.length<40){crypto.getRandomValues(buf);for(const b of buf){if(b<248&&t.length<40)t+=a[b%62]}}
  return t;
}
function scriptText(){
  if(!setup.token){setup.token=makeToken();saveSetup()} // kept until connected, so re-copying always matches
  return SCRIPT_TEMPLATE.replace('const TOKEN = "CHANGE-THIS-TO-A-LONG-RANDOM-STRING";',()=>'const TOKEN = "'+setup.token+'";');
}
function drawPersonal(){
  document.documentElement.dataset.accent=setup.accent;
  const hr=new Date().getHours(),g=hr<12?"Good morning":hr<18?"Good afternoon":"Good evening",hi=$("hello");
  hi.hidden=!setup.name;hi.textContent=setup.name?g+", "+setup.name:"";
  $("persstat").textContent=(setup.name||"No name set")+" · "+ACCENTS[setup.accent][1];
  if($("pname").value!==setup.name&&document.activeElement!==$("pname"))$("pname").value=setup.name;
}
function setName(v){setup.name=v.replace(/[\u0000-\u001f\u007f]/g,"").trim().slice(0,30);saveSetup();drawPersonal()}
function swatches(box){
  box.textContent="";
  Object.keys(ACCENTS).forEach(k=>{
    const b=el("button","");b.type="button";b.style.background=ACCENTS[k][0];
    b.setAttribute("aria-label",ACCENTS[k][1]);b.setAttribute("aria-pressed",k===setup.accent);
    b.onclick=()=>{setup.accent=k;saveSetup();drawPersonal();swatches(box)};
    box.appendChild(b);
  });
}
$("pname").addEventListener("input",()=>{setup.name=$("pname").value.replace(/[\u0000-\u001f\u007f]/g,"").slice(0,30);saveSetup();
  const hi=$("hello");hi.hidden=!setup.name.trim();hi.textContent=setup.name.trim()?"Hello, "+setup.name.trim():""});
$("pname").addEventListener("change",()=>setName($("pname").value));
swatches($("psw"));

const wiz=$("wiz"),wbody=$("wbody");let wstep=0;
function openWizard(n){wstep=n;wiz.hidden=false;document.body.style.overflow="hidden";drawWizard()}
function closeWizard(status){
  if(status){setup.status=status;saveSetup()}
  wiz.hidden=true;document.body.style.overflow="";drawPersonal();swatches($("psw"));drawCfg();drawSync();render();window.scrollTo(0,0);
}
function wbtn(text,cls,fn){const b=el("button","btn"+(cls?" "+cls:""),text);b.type="button";b.onclick=fn;return b}
function wlist(tag,items){const l=el(tag,"");items.forEach(t=>{const li=el("li","");if(Array.isArray(t)){t.forEach((p,i)=>{if(i%2)li.appendChild(el("b","",p));else if(p)li.appendChild(document.createTextNode(p))})}else li.textContent=t;l.appendChild(li)});return l}
function drawWizard(){
  wbody.textContent="";
  const head=(title,no)=>{if(no)wbody.appendChild(el("p","stepno","Step "+no+" of 5"));const h2=el("h2","",title);h2.id="wh";h2.tabIndex=-1;wbody.appendChild(h2);return h2};
  const acts=el("div","acts");
  const back=n=>acts.appendChild(wbtn("Back","",()=>{wstep=n;drawWizard()}));
  const skip=()=>{const b=wbtn("Skip for now","link",()=>closeWizard("skipped"));acts.appendChild(b)};
  let first;
  if(wstep===0){
    first=head("Welcome to Lift log");
    wbody.appendChild(el("p","","Log your sets, time your workout and see your total volume. Everything stays on your phone."));
    const lab=el("label","","What should we call you? (optional)");lab.htmlFor="wname";wbody.appendChild(lab);
    const inp=el("input","");inp.type="text";inp.id="wname";inp.maxLength=30;inp.autocomplete="given-name";inp.value=setup.name;
    inp.oninput=()=>{setup.name=inp.value.replace(/[\u0000-\u001f\u007f]/g,"").slice(0,30);saveSetup()};
    wbody.appendChild(inp);
    wbody.appendChild(el("p","sub","Pick a color"));const sw=el("div","sw");sw.setAttribute("role","group");sw.setAttribute("aria-label","Accent color");wbody.appendChild(sw);swatches(sw);
    const sec=el("div","warn");sec.appendChild(el("b","","Private by design. "));sec.appendChild(document.createTextNode("No account, no tracking, no server of ours. Your workouts live on this device, and optionally in a Google Sheet in your own Google account."));wbody.appendChild(sec);
    acts.appendChild(wbtn("Next: save to Google Sheets (optional)","primary",()=>{setName(inp.value);wstep=1;drawWizard()}));
    acts.appendChild(wbtn("Skip, just start lifting","",()=>{setName(inp.value);closeWizard("skipped")}));
  }else if(wstep===1){
    first=head("Make a Google Sheet",1);
    wbody.appendChild(el("p","","Your workouts will be saved into a sheet you own. It takes about five minutes, once."));
    const a=el("a","btn primary","Open a new Google Sheet");a.href="https://sheets.new";a.target="_blank";a.rel="noopener";
    wbody.appendChild(a);
    wbody.appendChild(el("p","","Name it anything you like, for example “Lift log”. Leave it empty, the app fills it in."));
    wbody.appendChild(el("p","sub","Tip: Google’s script editor is easiest on a computer, or in your phone browser with “Request desktop site” turned on."));
    acts.appendChild(wbtn("Next","primary",()=>{wstep=2;drawWizard()}));back(0);skip();
  }else if(wstep===2){
    first=head("Open the script editor",2);
    wbody.appendChild(wlist("ol",[["In your new sheet, open the ","Extensions"," menu, then tap ","Apps Script"],"A code editor opens. Select everything in it and delete it so it’s empty."]));
    acts.appendChild(wbtn("Next","primary",()=>{wstep=3;drawWizard()}));back(1);skip();
  }else if(wstep===3){
    first=head("Copy and paste the script",3);
    wbody.appendChild(el("p","","Tap the button, then paste into the empty editor and press Save (the disk icon). Your own secret token is already inside the script."));
    const msg=el("p","ok","");msg.setAttribute("aria-live","polite");
    const copy=wbtn("Copy script","primary",async()=>{
      const txt=scriptText();
      try{await navigator.clipboard.writeText(txt);msg.textContent="Copied. Paste it into the editor.";ta.hidden=true}
      catch(e){msg.textContent="Couldn’t copy automatically. Press and hold in the box below, choose Select all, then Copy.";ta.hidden=false;ta.value=txt;ta.focus();ta.select()}
    });
    wbody.appendChild(copy);wbody.appendChild(msg);
    const ta=el("textarea","");ta.readOnly=true;ta.hidden=true;ta.setAttribute("aria-label","Script text");wbody.appendChild(ta);
    acts.appendChild(wbtn("Next","primary",()=>{wstep=4;drawWizard()}));back(2);skip();
  }else if(wstep===4){
    first=head("Deploy it",4);
    wbody.appendChild(wlist("ol",[
      ["Tap ","Deploy"," (top right), then ","New deployment","."],
      ["Tap the gear next to “Select type” and choose ","Web app","."],
      ["Set “Execute as” to ","Me"," and “Who has access” to ","Anyone","."],
      ["Tap ","Deploy",", then ","Authorize access"," and pick your Google account."],
      ["Copy the ","Web app URL","."]]));
    const w=el("div","warn");w.appendChild(el("b","","Google will say “hasn’t verified this app”. "));
    w.appendChild(document.createTextNode("That’s normal: the script is your own, running in your own account. Tap Advanced, then “Go to (your project name)”, then Allow."));wbody.appendChild(w);
    wbody.appendChild(el("p","sub","“Anyone” only means the address works from your phone. Nothing is saved unless the request has your secret token."));
    acts.appendChild(wbtn("I have the URL","primary",()=>{wstep=5;drawWizard()}));back(3);skip();
  }else{
    first=head("Connect",5);
    wbody.appendChild(el("p","","Paste the Web app URL you copied. It ends in /exec."));
    const inp=el("input","");inp.type="text";inp.setAttribute("inputmode","url");inp.autocapitalize="off";inp.autocomplete="off";inp.spellcheck=false;inp.placeholder="https://script.google.com/macros/s/…/exec";inp.setAttribute("aria-label","Web app URL");
    wbody.appendChild(inp);
    const msg=el("p","","");msg.setAttribute("aria-live","polite");wbody.appendChild(msg);
    const go=wbtn("Test and connect","primary",async()=>{
      const url=inp.value.trim();
      if(!/^https:\/\/script\.google\.com\/.+\/exec/.test(url)){msg.textContent="That doesn’t look like the Web app URL. It starts with https://script.google.com and ends with /exec.";return}
      if(!setup.token){msg.textContent="Go back to “Copy and paste the script” first, so the script and the app share a secret.";return}
      const prev={...cfg};cfg.url=url;cfg.token=setup.token;go.disabled=true;msg.className="";msg.textContent="Testing…";
      try{
        await post([]);save(CKEY,cfg);setup.token="";setup.status="done";saveSetup();drawCfg();drawSync();drawHealth();
        msg.className="ok";msg.textContent="Connected. Your sets will save to your sheet when you tap End workout.";
        acts.textContent="";acts.appendChild(wbtn("Start lifting","primary",()=>closeWizard("done")));
      }catch(err){
        cfg=prev;go.disabled=false;msg.className="";
        const c=err&&err.code;
        msg.textContent=c==="bad_token"?"The script is reachable, but its secret doesn’t match this app. Go back one step, copy the script again, replace everything in the editor, save, then Deploy → Manage deployments → pencil → Version: New version → Deploy."
          :c==="bad_response"?"That address didn’t answer like your script. Check that you copied the Web app URL (ends in /exec) and that “Who has access” is Anyone."
          :c==="script_error"?describe(err)
          :"Couldn’t reach it. Check your connection, and that “Who has access” is set to Anyone.";
      }
    });
    acts.appendChild(go);back(4);skip();
  }
  wbody.appendChild(acts);
  if(first)first.focus({preventScroll:true});wiz.scrollTop=0;
}
$("cfgwiz").onclick=()=>openWizard(1);
document.addEventListener("keydown",ev=>{if(ev.key==="Escape"&&!wiz.hidden)closeWizard("skipped")});
function maybeWizard(){if(!setup.status&&!(cfg.url&&cfg.token)&&!entries.length)openWizard(0)}

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
  $("hdetail").textContent="Persistent storage: "+(persisted===true?"on":persisted===false?"off (the browser may clear this data if space runs low or the app goes unused for a long time)":"unknown")+". App version: "+APP_VERSION+". Last backup file: "+(lastBackup?new Date(lastBackup).toLocaleDateString():"never")+". Backups contain your workouts only, never your token.";
  $("brest").hidden=!linked;
}
function backupJSON(){
  return JSON.stringify({app:"liftlog",version:1,exported:new Date().toISOString(),entries:entries.map(e=>({id:e.id,date:e.date,name:e.name,reps:e.reps,weight:e.weight,unit:e.unit,ts:e.ts,...(e.bw?{bw:true}:{})}))},null,1);
}
async function deliver(file){
  try{
    if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:"Lift log backup"});return "Shared. Keep it somewhere safe, like Files, Drive or an email to yourself."}
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
  const id=String(o.id==null?"":o.id),date=String(o.date==null?"":o.date);
  if(!/^[A-Za-z0-9._-]{1,64}$/.test(id)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||isNaN(Date.parse(date)))return null;
  const name=String(o.name==null?"":o.name).replace(/[\u0000-\u001f\u007f]/g,"").trim();
  if(!name||name.length>60)return null;
  const num=(v,lo,hi)=>{if(v===null||v===undefined||v==="")return null;const n=typeof v==="number"?v:Number(v);return isFinite(n)&&n>=lo&&n<=hi?n:undefined};
  const reps=num(o.reps,0,1000),weight=num(o.weight,0,5000);
  if(reps===undefined||weight===undefined)return null;
  const unit=o.unit==="kg"?"kg":o.unit==="lb"?"lb":null;if(!unit)return null;
  return {id,date,name,reps:reps===null?null:Math.round(reps),weight,unit,ts:isFinite(o.ts)?Number(o.ts):0,...(o.bw===true?{bw:true}:{})};
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
  const r=mergeEntries(data.entries);saveEntries();render();
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
        return {id:x[8],date:d,name:x[1],reps:x[3],weight:x[4],bw:x[4]===""||x[4]===null,unit:x[5],ts:new Date(p[0],(p[1]||1)-1,p[2]||1,12).getTime()+offset+i};
      });
      const m=mergeEntries(list);r.added+=m.added;r.dupes+=m.dupes;r.bad+=m.bad;
      list.forEach(o=>{if(/^[A-Za-z0-9._-]{1,64}$/.test(String(o.id)))synced.add(String(o.id))}); // these are in the sheet by definition
      if(!rows.length)break;offset+=2000;
    }
    save(SKEY,[...synced]);saveEntries();render();
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
  const anyBW=items.some(e=>e.bw);
  const parts=items.slice(0,cap).map(e=>anyBW?e.reps+" × "+wTxt(e):e.reps+" × "+wfmt(e.weight||0)+(units.length>1?" "+e.unit:""));
  let t=parts.join(", ")+(units.length===1&&!anyBW?" "+units[0]:"");
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
  const W=1080,P=72,INK="#151A22",MUTED="#5F6B7A",ACC=(ACCENTS[setup.accent]||ACCENTS.blue)[0];
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
  const hadSW=!!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange",()=>{if(hadSW)showBanner("App updated. Close and reopen it to use the new version.")});
  window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
}

drawPersonal();drawUnit();drawTimer();drawCfg();render();maybeWizard();
if(notice)showBanner(notice,false);
askPersist();
if(cfg.url&&cfg.token)syncSheet({pastOnly:true,quiet:true});
window.addEventListener("online",()=>syncSheet({pastOnly:true,quiet:true}));
