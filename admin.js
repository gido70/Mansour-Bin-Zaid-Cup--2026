/* MBZ Cup 2026 - Admin Panel (static, generates matches.csv for upload) */
(() => {
  "use strict";

  const ADMIN_PIN = "2026";

  const qs = (s) => document.querySelector(s);
  const escapeCSV = (v) => {
    const s = String(v ?? "");
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  function parseCSV(text){
    const rows = [];
    let row = [];
    let cur = "";
    let inQuotes = false;
    for(let i=0;i<text.length;i++){
      const ch = text[i];
      const next = text[i+1];
      if(inQuotes){
        if(ch === '"' && next === '"'){ cur += '"'; i++; continue; }
        if(ch === '"'){ inQuotes = false; continue; }
        cur += ch;
      }else{
        if(ch === '"'){ inQuotes = true; continue; }
        if(ch === ','){ row.push(cur); cur=""; continue; }
        if(ch === '\n'){ row.push(cur); rows.push(row); row=[]; cur=""; continue; }
        if(ch === '\r'){ continue; }
        cur += ch;
      }
    }
    row.push(cur); rows.push(row);
    if(rows.length && rows[rows.length-1].length===1 && rows[rows.length-1][0].trim()===""){ rows.pop(); }
    const headers = (rows.shift() || []).map(h => h.trim());
    return rows.map(r => {
      const o = {};
      headers.forEach((h, idx) => o[h] = (r[idx] ?? "").trim());
      return o;
    });
  }

  async function fetchText(url){
    const res = await fetch(url + (url.includes("?") ? "&" : "?") + "v=" + Date.now(), { cache:"no-store" });
    if(!res.ok) throw new Error("فشل تحميل: " + url);
    return await res.text();
  }

  function uniq(arr){
    return Array.from(new Set(arr.map(x => String(x||"").trim()).filter(Boolean)));
  }

  function optionExists(sel, value){
    if(!sel) return false;
    const v = String(value||"").trim();
    return Array.from(sel.options||[]).some(o => String(o.value||"").trim() === v);
  }

  function setSelectOrManual(selectSel, manualSel, value){
    const sel = qs(selectSel);
    const man = qs(manualSel);
    if(!sel || !man) return;
    const v = String(value||"").trim();
    if(!v){ sel.value = ""; man.value = ""; return; }
    if(optionExists(sel, v)){
      sel.value = v;
      man.value = "";
    }else{
      sel.value = "";
      man.value = v;
    }
  }

  function getSelectOrManual(selectSel, manualSel){
    const man = qs(manualSel);
    const sel = qs(selectSel);
    const mv = man ? man.value.trim() : "";
    if(mv) return mv;
    return sel ? sel.value.trim() : "";
  }

  function formatListFromMap(map){
    const items = Object.entries(map)
      .filter(([n,c]) => n && c>0)
      .sort((a,b)=> a[0].localeCompare(b[0],'ar'));
    if(!items.length) return "";
    return items.map(([n,c]) => c===1 ? `${n} (1)` : `${n} (${c})`).join("، ");
  }

  function parseListToMap(text){
    const s = String(text||"").trim();
    const map = {};
    if(!s) return map;
    const parts = s.split(/[,;|\n،]+/).map(x=>x.trim()).filter(Boolean);
    for(const p of parts){
      const m = p.match(/^(.+?)\s*\((\d+)\)\s*$/);
      if(m){
        const name = m[1].trim();
        const c = parseInt(m[2],10);
        if(name) map[name] = (map[name]||0) + (isNaN(c)?1:c);
      }else{
        map[p] = (map[p]||0) + 1;
      }
    }
    return map;
  }

  let roster = {};
  let matches = [];
  let awards = null;
  let headers = [];
  let current = null;
  let originalSnapshot = "";

  let goalsMap1 = {}, goalsMap2 = {};
  let yellowMap1 = {}, redMap1 = {}, yellowMap2 = {}, redMap2 = {};
  let history = [];

  const QF25_SPECIAL_PLAYERS = {
    "مدارس الامارات الوطنية": [
      { number: "1", name: "ابراهيم الجرايحي كشك" },
      { number: "10", name: "احمد سمير علي" },
      { number: "24", name: "ابراهيم رجب احمد" },
      { number: "11", name: "محروس إبراهيم الجندي" },
      { number: "6", name: "محمد عبدالرحمن قوره" },
      { number: "19", name: "سعد سامي صالح" },
      { number: "20", name: "ناش . أمواه" },
      { number: "8", name: "ماهر احمد حسن" },
      { number: "44", name: "شادي تامر علوي" },
      { number: "18", name: "احمد علاء الدين عبدالوهاب" },
      { number: "17", name: "حسام صلاح رمضان" },
      { number: "4", name: "وليد احمد رجب" },
      { number: "9", name: "يوسف اكيوض" }
    ],
    "مدارس الإمارات الوطنية": [
      { number: "1", name: "ابراهيم الجرايحي كشك" },
      { number: "10", name: "احمد سمير علي" },
      { number: "24", name: "ابراهيم رجب احمد" },
      { number: "11", name: "محروس إبراهيم الجندي" },
      { number: "6", name: "محمد عبدالرحمن قوره" },
      { number: "19", name: "سعد سامي صالح" },
      { number: "20", name: "ناش . أمواه" },
      { number: "8", name: "ماهر احمد حسن" },
      { number: "44", name: "شادي تامر علوي" },
      { number: "18", name: "احمد علاء الدين عبدالوهاب" },
      { number: "17", name: "حسام صلاح رمضان" },
      { number: "4", name: "وليد احمد رجب" },
      { number: "9", name: "يوسف اكيوض" }
    ],
    "مكتب الشؤون التنموية واسر الشهداء": [
      { number: "1", name: "قويليرمي روتشا بيرالدو" },
      { number: "5", name: "ايفرتون باولو اراوجو" },
      { number: "9", name: "فلافيو دي ليما" },
      { number: "25", name: "علي عبدالله حسن" },
      { number: "28", name: "روان سانتوس دي الميديا" },
      { number: "88", name: "التون لوكاس دا سيلفا" },
      { number: "15", name: "بيدرو هنريكي ايفان" },
      { number: "19", name: "كيفن بايرس دوس سانتوس" },
      { number: "8", name: "باولو قوستافو دي اوليفيرا" },
      { number: "20", name: "ثياقو قريبي ." },
      { number: "2", name: "قيلمرسون دوس سانتوس موتا" },
      { number: "11", name: "ميسياس ايلاريو دا سيلفا" },
      { number: "33", name: "مارسيو لويز بيو فينانسيو" }
    ],
    "مكتب الشؤون التنموية وأسر الشهداء": [
      { number: "1", name: "قويليرمي روتشا بيرالدو" },
      { number: "5", name: "ايفرتون باولو اراوجو" },
      { number: "9", name: "فلافيو دي ليما" },
      { number: "25", name: "علي عبدالله حسن" },
      { number: "28", name: "روان سانتوس دي الميديا" },
      { number: "88", name: "التون لوكاس دا سيلفا" },
      { number: "15", name: "بيدرو هنريكي ايفان" },
      { number: "19", name: "كيفن بايرس دوس سانتوس" },
      { number: "8", name: "باولو قوستافو دي اوليفيرا" },
      { number: "20", name: "ثياقو قريبي ." },
      { number: "2", name: "قيلمرسون دوس سانتوس موتا" },
      { number: "11", name: "ميسياس ايلاريو دا سيلفا" },
      { number: "33", name: "مارسيو لويز بيو فينانسيو" }
    ]
  };

  function getVarRowEls(i){
    return {
      team: qs(`#var${i}_team`),
      type: qs(`#var${i}_type`),
      result: qs(`#var${i}_result`)
    };
  }

  function clearVAREventsUI(){
    for(let i=1;i<=4;i++){
      const r = getVarRowEls(i);
      if(r.team) r.team.value = "";
      if(r.type) r.type.value = "";
      if(r.result) r.result.value = "";
    }
  }

  function loadVAREventsFromMatch(m){
    clearVAREventsUI();

    const hasNew = (m.var1_team!=null || m.var1_type!=null || m.var1_result!=null);
    if(hasNew){
      for(let i=1;i<=4;i++){
        const r = getVarRowEls(i);
        if(!r.team) continue;
        r.team.value = (m[`var${i}_team`] ?? "");
        r.type.value = (m[`var${i}_type`] ?? "");
        r.result.value = (m[`var${i}_result`] ?? "");
      }
      return;
    }

    if(String(m.var_used||"0")==="1"){
      const r = getVarRowEls(1);
      if(r.team) r.team.value = (m.var_for ?? "");
      if(r.type) r.type.value = (m.var_type ?? "");
      if(r.result) r.result.value = (m.var_result ?? "");
    }
  }

  function applyVAREventsToMatch(){
    if(!current) return;

    const ev = [];
    for(let i=1;i<=4;i++){
      const r = getVarRowEls(i);
      if(!r.team || !r.type || !r.result) continue;
      const team = String(r.team.value||"").trim();
      const type = String(r.type.value||"").trim();
      const result = String(r.result.value||"").trim();
      if(team && type && result) ev.push({team, type, result});
    }

    for(let i=1;i<=4;i++){
      current[`var${i}_team`] = ev[i-1]?.team || "";
      current[`var${i}_type`] = ev[i-1]?.type || "";
      current[`var${i}_result`] = ev[i-1]?.result || "";
    }

    const c1 = ev.filter(x=>x.team==="team1").length;
    const c2 = ev.filter(x=>x.team==="team2").length;
    current.var_team1 = String(c1);
    current.var_team2 = String(c2);

    if(ev.length){
      current.var_used = "1";
      current.var_for = ev[0].team;
      current.var_type = ev[0].type;
      current.var_result = ev[0].result;
    }else{
      current.var_used = "0";
      current.var_for = "";
      current.var_type = "";
      current.var_result = "";
    }
  }

  function setMsg(id, text, isError=false){
    const el = qs(id);
    if(!el) return;
    el.textContent = text;
    el.classList.remove("hidden");
    if(isError) el.style.background = "rgba(255,0,0,.15)";
  }

  function hideMsg(id){
    const el = qs(id);
    if(el) el.classList.add("hidden");
  }

  function fillSelect(el, items, placeholder) {
    if (typeof el === "string") el = qs(el);
    if (!el) return;
    el.innerHTML = '';
    const o0 = document.createElement('option');
    o0.value = '';
    o0.textContent = placeholder || '—';
    el.appendChild(o0);

    (items || []).forEach(it => {
      const o = document.createElement('option');
      if (typeof it === 'string') {
        o.value = it;
        o.textContent = it;
      } else {
        o.value = (it && it.value != null) ? String(it.value) : '';
        o.textContent = (it && it.label != null) ? String(it.label) : String(it.value || '');
      }
      el.appendChild(o);
    });
  }

  function setStatus(text){
    const el = qs("#dataStatus");
    if(el) el.textContent = text;
  }

  function updatePreview(){
    qs("#goalsPreview1").textContent = formatListFromMap(goalsMap1) || "—";
    qs("#goalsPreview2").textContent = formatListFromMap(goalsMap2) || "—";
    const c1 = [];
    const y1 = formatListFromMap(yellowMap1);
    const r1 = formatListFromMap(redMap1);
    if(y1) c1.push("🟨 " + y1);
    if(r1) c1.push("🟥 " + r1);
    qs("#cardsPreview1").textContent = c1.length ? c1.join(" | ") : "—";

    const c2 = [];
    const y2 = formatListFromMap(yellowMap2);
    const r2 = formatListFromMap(redMap2);
    if(y2) c2.push("🟨 " + y2);
    if(r2) c2.push("🟥 " + r2);
    qs("#cardsPreview2").textContent = c2.length ? c2.join(" | ") : "—";
  }

  function buildCSV(){
    const required = [
      "match_code","group","round","date","time","team1","team2","score1","score2",
      "referee1","referee2","commentator","player_of_match",
      "goals_team1","goals_team2","var_team1","var_team2","var_used","var_for","var_type","var_result",
      "yellow_team1","red_team1","yellow_team2","red_team2"
    ];
    required.forEach(h => { if(!headers.includes(h)) headers.push(h); });

    const lines = [];
    lines.push(headers.join(","));
    for(const m of matches){
      const row = headers.map(h => escapeCSV(m[h] ?? ""));
      lines.push(row.join(","));
    }
    return lines.join("\n");
  }

  function refreshCSVOut(){
    const out = buildCSV();
    qs("#csvOut").value = out;
  }

  function setupMatchDropdown(){
    const list = matches
      .map(m => ({
        id: m.match_code || "",
        label: `${m.match_code || ""} — ${m.group || ""} — ${(m.team1||"")} × ${(m.team2||"")}`
      }))
      .filter(x => x.id);
    const sel = qs("#matchSelect");
    sel.innerHTML = "";
    list.forEach(x => {
      const o = document.createElement("option");
      o.value = x.id;
      o.textContent = x.label;
      sel.appendChild(o);
    });
  }

  function rosterPlayers(team){
    const special = QF25_SPECIAL_PLAYERS[String(team || "").trim()];
    if (special) {
      return special.map(p => ({
        value: p.name,
        label: p.number ? (p.number + " — " + p.name) : p.name
      }));
    }

    function norm(s){
      return String(s||"")
        .trim()
        .replace(/[ً-ٰٟ]/g, "")
        .replace(/[أإآٱ]/g, "ا")
        .replace(/ى/g, "ي")
        .replace(/ة/g, "ه")
        .replace(/ؤ/g, "و")
        .replace(/ئ/g, "ي")
        .replace(/\s+/g, " ");
    }

    const aliases = {
      "مدارس الامارات الوطنية": "مدارس الإمارات الوطنية",
      "مدارس الإمارات الوطنية": "مدارس الإمارات الوطنية",
      "مكتب الشؤون التنموية وأسر الشهداء": "مكتب الشؤون التنموية واسر الشهداء",
      "مكتب الشؤون التنموية واسر الشهداء": "مكتب الشؤون التنموية واسر الشهداء"
    };

    team = aliases[team] || team;

    let t = roster[team];
    if(!t){
      const wanted = norm(team);
      const key = Object.keys(roster || {}).find(k => norm(k) === wanted);
      if(key) t = roster[key];
    }

    if(!t) return [];
    const arr = Array.isArray(t) ? t : (t.players || []);
    return arr
      .filter(p => p && p.name)
      .map(p => ({
        value: p.name,
        label: (p.number ? (p.number + " — " + p.name) : p.name)
      }));
  }

  function makeSelectSearchable(inputSel, selectSel){
    const inp = (typeof inputSel==="string") ? qs(inputSel) : inputSel;
    const sel = (typeof selectSel==="string") ? qs(selectSel) : selectSel;
    if(!inp || !sel) return;

    let snapshot = [];
    function takeSnapshot(){
      snapshot = Array.from(sel.options).map(o => ({value:o.value, text:o.textContent}));
    }
    function restore(){
      sel.innerHTML = "";
      snapshot.forEach((o)=>{
        const opt = document.createElement("option");
        opt.value = o.value;
        opt.textContent = o.text;
        sel.appendChild(opt);
      });
    }

    takeSnapshot();

    inp.addEventListener("input", ()=>{
      const q = String(inp.value||"").trim().toLowerCase();
      restore();
      if(q.length < 2) return;

      const opts = Array.from(sel.options);
      const keep0 = opts.shift();
      const filtered = opts.filter(o => o.textContent.toLowerCase().includes(q));
      sel.innerHTML = "";
      if(keep0) sel.appendChild(keep0);
      filtered.forEach(o=>sel.appendChild(o));
    });

    sel.addEventListener("mbz:refill", ()=>{ takeSnapshot(); });
  }

  function setupPlayerDropdowns(){
    if(!current) return;
    const team1 = current.team1 || "";
    const team2 = current.team2 || "";
    const p1 = rosterPlayers(team1);
    const p2 = rosterPlayers(team2);

    fillSelect("#player", p1.concat(p2), "اختر لاعب");
    qs("#player")?.dispatchEvent(new Event("mbz:refill"));
    fillSelect("#pom", p1.concat(p2), "أفضل لاعب");
    qs("#pom")?.dispatchEvent(new Event("mbz:refill"));

    fillSelect("#cardPlayer", p1.concat(p2), "اختر لاعب");
    qs("#cardPlayer")?.dispatchEvent(new Event("mbz:refill"));

    fillSelect("#side", [`الفريق 1 — ${team1}`, `الفريق 2 — ${team2}`], "اختر الفريق");
    fillSelect("#cardSide", [`الفريق 1 — ${team1}`, `الفريق 2 — ${team2}`], "اختر الفريق");
  }

  function setupStaffDropdowns(){
    const refs = uniq(matches.flatMap(m => [m.referee1, m.referee2]));
    const comms = uniq(matches.map(m => m.commentator));
    fillSelect("#ref1", refs, "حكم 1");
    fillSelect("#ref2", refs, "حكم 2");
    fillSelect("#commentator", comms, "معلق");
  }

  function loadMatchById(id){
    const m = matches.find(x => (x.match_code||"") === id);
    if(!m) { setMsg("#panelMsg", "لم أجد هذه المباراة.", true); return; }
    current = m;
    hideMsg("#panelMsg");

    originalSnapshot = JSON.stringify(m);

    qs("#score1").value = (m.score1 ?? "");
    qs("#score2").value = (m.score2 ?? "");
    loadVAREventsFromMatch(m);

    setupStaffDropdowns();

    setSelectOrManual("#ref1", "#ref1_manual", (m.referee1 ?? ""));
    setSelectOrManual("#ref2", "#ref2_manual", (m.referee2 ?? ""));
    setSelectOrManual("#commentator", "#commentator_manual", (m.commentator ?? ""));

    setupPlayerDropdowns();
    setSelectOrManual("#pom", "#pom_manual", (m.player_of_match ?? ""));

    goalsMap1 = parseListToMap(m.goals_team1 || "");
    goalsMap2 = parseListToMap(m.goals_team2 || "");
    yellowMap1 = parseListToMap(m.yellow_team1 || "");
    redMap1 = parseListToMap(m.red_team1 || "");
    yellowMap2 = parseListToMap(m.yellow_team2 || "");
    redMap2 = parseListToMap(m.red_team2 || "");
    history = [];
    updatePreview();

    const meta = `${m.group || ""} • الجولة: ${m.round || ""} • ${m.date || ""} • ${m.time || ""}<br>${m.team1 || ""} × ${m.team2 || ""}`;
    qs("#matchMeta").innerHTML = meta;

    setStatus("جاهز");
  }

  function applyMapsToCurrent(){
    if(!current) return;
    applyVAREventsToMatch();
    current.goals_team1 = formatListFromMap(goalsMap1);
    current.goals_team2 = formatListFromMap(goalsMap2);
    current.yellow_team1 = formatListFromMap(yellowMap1);
    current.red_team1 = formatListFromMap(redMap1);
    current.yellow_team2 = formatListFromMap(yellowMap2);
    current.red_team2 = formatListFromMap(redMap2);
  }

  function saveRow(){
    if(!current) return;
    current.score1 = qs("#score1").value.trim();
    current.score2 = qs("#score2").value.trim();

    current.var_team1 = (current.var_used === "1" && current.var_for === "team1") ? "1" : "0";
    current.var_team2 = (current.var_used === "1" && current.var_for === "team2") ? "1" : "0";
    current.referee1 = getSelectOrManual("#ref1", "#ref1_manual");
    current.referee2 = getSelectOrManual("#ref2", "#ref2_manual");
    current.commentator = getSelectOrManual("#commentator", "#commentator_manual");
    current.player_of_match = qs("#pom").value.trim() || qs("#pom_manual")?.value.trim();

    applyMapsToCurrent();
    refreshCSVOut();
    setMsg("#panelMsg", "تم حفظ التعديلات داخل اللوحة. الآن نزّل matches.csv وارفعه إلى GitHub.", false);
  }

  function resetRow(){
    if(!current) return;
    const snap = JSON.parse(originalSnapshot || "{}");
    Object.keys(snap).forEach(k => current[k] = snap[k]);
    loadMatchById(current.match_code);
    refreshCSVOut();
    hideMsg("#panelMsg");
  }

  function sideToIndex(sideText){
    if(!sideText) return null;
    return sideText.startsWith("الفريق 2") ? 2 : 1;
  }

  function addGoal(){
    if(!current) return;
    const side = qs("#side").value;
    const name =
      qs("#player").value.trim() ||
      qs("#player_manual")?.value.trim() ||
      qs("#playerSearch").value.trim();
    if(!side || !name) return;
    const idx = sideToIndex(side);
    const map = idx===1 ? goalsMap1 : goalsMap2;
    map[name] = (map[name]||0) + 1;
    history.push({type:"goal", idx, name});
    updatePreview();
  }

  function undoGoal(){
    for(let i=history.length-1;i>=0;i--){
      const h = history[i];
      if(h.type==="goal"){
        const map = h.idx===1 ? goalsMap1 : goalsMap2;
        map[h.name] = Math.max(0, (map[h.name]||0)-1);
        if(map[h.name]===0) delete map[h.name];
        history.splice(i,1);
        break;
      }
    }
    updatePreview();
  }

  function clearGoals(){
    goalsMap1 = {}; goalsMap2 = {};
    history = history.filter(h => h.type!=="goal");
    updatePreview();
  }

  function addCard(cardType){
    if(!current) return;
    const side = qs("#cardSide").value;
    const name =
      qs("#cardPlayer").value.trim() ||
      qs("#cardPlayer_manual")?.value.trim() ||
      qs("#cardSearch").value.trim();
    if(!side || !name) return;
    const idx = sideToIndex(side);
    const isYellow = cardType==="yellow";
    const map = idx===1 ? (isYellow?yellowMap1:redMap1) : (isYellow?yellowMap2:redMap2);
    map[name] = (map[name]||0) + 1;
    history.push({type:"card", idx, name, cardType});
    updatePreview();
  }

  function undoCard(){
    for(let i=history.length-1;i>=0;i--){
      const h = history[i];
      if(h.type==="card"){
        const isYellow = h.cardType==="yellow";
        const map = h.idx===1 ? (isYellow?yellowMap1:redMap1) : (isYellow?yellowMap2:redMap2);
        map[h.name] = Math.max(0, (map[h.name]||0)-1);
        if(map[h.name]===0) delete map[h.name];
        history.splice(i,1);
        break;
      }
    }
    updatePreview();
  }

  function clearCards(){
    yellowMap1 = {}; redMap1 = {}; yellowMap2 = {}; redMap2 = {};
    history = history.filter(h => h.type!=="card");
    updatePreview();
  }

  function downloadCSV(){
    const text = qs("#csvOut").value || buildCSV();
    const blob = new Blob([text], { type:"text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "matches.csv";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 250);
  }

  async function copyCSV(){
    const text = qs("#csvOut").value || buildCSV();
    try{
      await navigator.clipboard.writeText(text);
      setMsg("#panelMsg","تم نسخ CSV. الآن افتح GitHub والصقه داخل data/matches.csv ثم Commit.", false);
    }catch{
      setMsg("#panelMsg","لم أستطع النسخ تلقائيًا. استخدم مربع النص وانسخ يدويًا.", true);
    }
  }

  async function init(){
    qs("#btnLogin").addEventListener("click", () => {
      const pin = qs("#pin").value.trim();
      if(pin === ADMIN_PIN){
        qs("#gate").classList.add("hidden");
        qs("#panel").classList.remove("hidden");
        startPanel().catch(err => setMsg("#panelMsg", String(err), true));
      }else{
        setMsg("#gateMsg", "PIN غير صحيح.", true);
      }
    });

    qs("#pin").addEventListener("keydown", (e) => {
      if(e.key === "Enter") qs("#btnLogin").click();
    });
  }

  async function startPanel(){
    setStatus("تحميل…");
    const rosterText = await fetchText("data/roster.json");
    roster = JSON.parse(rosterText);

    const csvText = await fetchText("data/matches.csv");
    const rows = parseCSV(csvText);

    headers = Object.keys(rows[0] || {});
    const must = ["var_used","var_for","var_type","var_result","var_team1","var_team2",
      "var1_team","var1_type","var1_result","var2_team","var2_type","var2_result","var3_team","var3_type","var3_result","var4_team","var4_type","var4_result"];
    must.forEach(h=>{ if(!headers.includes(h)) headers.push(h); });
    matches = rows;

    matches = matches.filter(m => (m.match_code||"").trim() !== "");

    setupMatchDropdown();
    makeSelectSearchable("#playerSearch", "#player");
    makeSelectSearchable("#pomSearch", "#pom");
    makeSelectSearchable("#cardSearch", "#cardPlayer");
    refreshCSVOut();
    setStatus("جاهز");

    const firstId = qs("#matchSelect").value;
    if(firstId) loadMatchById(firstId);

    const clearOnSelect = (sel, man) => {
      const s = qs(sel), m = qs(man);
      if(!s || !m) return;
      s.addEventListener("change", ()=>{ m.value = ""; });
    };
    const clearOnManual = (man, sel) => {
      const m = qs(man), s = qs(sel);
      if(!m || !s) return;
      m.addEventListener("input", ()=>{
        if(m.value.trim()) s.value = "";
      });
    };
    clearOnSelect("#ref1", "#ref1_manual");
    clearOnSelect("#ref2", "#ref2_manual");
    clearOnSelect("#commentator", "#commentator_manual");
    clearOnManual("#ref1_manual", "#ref1");
    clearOnManual("#ref2_manual", "#ref2");
    clearOnManual("#commentator_manual", "#commentator");

    qs("#btnLoadMatch").addEventListener("click", () => loadMatchById(qs("#matchSelect").value));
    qs("#btnSaveRow").addEventListener("click", saveRow);
    qs("#btnResetRow").addEventListener("click", resetRow);

    qs("#btnGoal").addEventListener("click", addGoal);
    qs("#btnUndoGoal").addEventListener("click", undoGoal);
    qs("#btnClearGoals").addEventListener("click", clearGoals);

    qs("#btnYellow").addEventListener("click", () => addCard("yellow"));
    qs("#btnRed").addEventListener("click", () => addCard("red"));
    qs("#btnUndoCard").addEventListener("click", undoCard);
    qs("#btnClearCards").addEventListener("click", clearCards);

    qs("#btnDownload").addEventListener("click", downloadCSV);
    qs("#btnCopy").addEventListener("click", copyCSV);
  }

  document.addEventListener("DOMContentLoaded", ()=>{ init(); });
})();
