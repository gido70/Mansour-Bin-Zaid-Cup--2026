
(function(){
  function qs(id){ return document.getElementById(id); }
  function makeOpt(val, label){
    const o=document.createElement("option");
    o.value=val; o.textContent=label;
    return o;
  }

  async function loadJson(path){
    const r = await fetch(path, {cache:"no-store"});
    if(!r.ok) throw new Error("تعذر تحميل "+path);
    return await r.json();
  }

  function splitVal(v){
    // "name||team"
    const parts = (v||"").split("||");
    return {name: parts[0]||"", team: parts[1]||""};
  }

  function downloadText(filename, text){
    const blob = new Blob([text], {type:"application/json;charset=utf-8"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  async function initAwardsAdmin(){
    const bestTeam=qs("award_bestTeam");
    const topScorer=qs("award_topScorer");
    const bestPlayer=qs("award_bestPlayer");
    const bestGK=qs("award_bestGK");
    const bestAdmin=qs("award_bestAdmin");
    const saveBtn=qs("award_save");
    const dlBtn=qs("award_download");
    const out=qs("award_json");
    if(!bestTeam||!topScorer||!bestPlayer||!bestGK||!bestAdmin||!saveBtn||!dlBtn||!out) return;

    const roster = await loadJson("data/roster.json"); // {team:[{number,name,...}]}
    const staff  = await loadJson("data/staff.json");  // [{team, role, name, phone?},...]

    // teams
    Object.keys(roster).forEach(t=> bestTeam.appendChild(makeOpt(t, t)));

    // players list
    const playerOpts=[];
    Object.keys(roster).forEach(team=>{
      roster[team].forEach(p=>{
        const num = (p.number!==undefined && p.number!==null) ? String(p.number) : "";
        const name = p.name || "";
        const label = (num? (num+" — ") : "") + name + " — " + team;
        const val = name + "||" + team;
        if(name) playerOpts.push({val,label});
      });
    });
    playerOpts.sort((a,b)=>a.label.localeCompare(b.label,'ar'));
    playerOpts.forEach(o=>{
      topScorer.appendChild(makeOpt(o.val, o.label));
      bestPlayer.appendChild(makeOpt(o.val, o.label));
      bestGK.appendChild(makeOpt(o.val, o.label));
    });

    // admins list (role contains إداري)
    const adminOpts = staff
      .filter(s => (s.role||"").includes("إداري") && s.name)
      .map(s => ({val: s.name+"||"+(s.team||""), label: s.name+" — "+(s.team||"")}));
    adminOpts.sort((a,b)=>a.label.localeCompare(b.label,'ar'));
    adminOpts.forEach(o=> bestAdmin.appendChild(makeOpt(o.val,o.label)));

    async function loadExisting(){
      try{
        const a = await loadJson("data/awards.json");
        if(a.bestTeam) bestTeam.value = a.bestTeam;
        if(a.topScorer) topScorer.value = a.topScorer+"||"+(a.topScorerTeam||"");
        if(a.bestPlayer) bestPlayer.value = a.bestPlayer+"||"+(a.bestPlayerTeam||"");
        if(a.bestGK) bestGK.value = a.bestGK+"||"+(a.bestGKTeam||"");
        if(a.bestAdmin) bestAdmin.value = a.bestAdmin+"||"+(a.bestAdminTeam||"");
      }catch(_){}
    }
    await loadExisting();

    function buildJson(){
      const ts=splitVal(topScorer.value);
      const bp=splitVal(bestPlayer.value);
      const gk=splitVal(bestGK.value);
      const ba=splitVal(bestAdmin.value);
      const obj={
        bestTeam: bestTeam.value || "",
        topScorer: ts.name, topScorerTeam: ts.team,
        bestPlayer: bp.name, bestPlayerTeam: bp.team,
        bestGK: gk.name, bestGKTeam: gk.team,
        bestAdmin: ba.name, bestAdminTeam: ba.team
      };
      const text = JSON.stringify(obj, null, 2);
      out.value = text;
      return text;
    }

    saveBtn.addEventListener("click", ()=> buildJson());
    dlBtn.addEventListener("click", ()=>{
      const text = buildJson();
      downloadText("awards.json", text);
    });
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    initAwardsAdmin().catch(console.error);
  });
})();
