
(function(){
  var CupApp = window.CupApp = window.CupApp || {};
  function setText(id, val){
    const el=document.getElementById(id);
    if(el) el.textContent = (val && String(val).trim()) ? val : "—";
  }

  CupApp.initAwards = async function(){
    const errEl = document.getElementById("loadError");
    try{
      const res = await fetch("data/awards.json", {cache:"no-store"});
      if(!res.ok) throw new Error("تعذر تحميل data/awards.json");
      const a = await res.json();
      setText("bestTeam", a.bestTeam);
      setText("topScorer", a.topScorer);
      setText("topScorerTeam", a.topScorerTeam);
      setText("bestPlayer", a.bestPlayer);
      setText("bestPlayerTeam", a.bestPlayerTeam);
      setText("bestGK", a.bestGK);
      setText("bestGKTeam", a.bestGKTeam);
      setText("bestAdmin", a.bestAdmin);
      setText("bestAdminTeam", a.bestAdminTeam);
    }catch(e){
      if(errEl){
        errEl.classList.remove("hidden");
        errEl.textContent = "خطأ: " + (e && e.message ? e.message : e);
      }
      console.error(e);
    }
  };
})();
