(function(){
  // ضمان وجود الكائن العام
  const CupApp = window.CupApp = window.CupApp || {};

  function qs(id){ return document.getElementById(id); }

  function showError(msg){
    const el = qs("loadError");
    if(!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
  }

  function hideError(){
    const el = qs("loadError");
    if(!el) return;
    el.textContent = "";
    el.classList.add("hidden");
  }

  function fillGroupTable(groupCode, rows){
    const card = qs("grp_"+groupCode);
    if(!card) return;
    const tbody = card.querySelector("tbody");
    if(!tbody) return;
    tbody.innerHTML = "";

    // عدّاد أعلى البطاقة
    const badge = card.querySelector(".badge");
    if(badge) badge.textContent = String(rows.length || 0);

    rows.forEach(r=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.rank ?? ""}</td>
        <td>${r.team ?? ""}</td>
        <td>${r.played ?? 0}</td>
        <td>${r.win ?? 0}</td>
        <td>${r.draw ?? 0}</td>
        <td>${r.loss ?? 0}</td>
        <td>${r.gf ?? 0}</td>
        <td>${r.ga ?? 0}</td>
        <td>${r.gd ?? 0}</td>
        <td>${r.pts ?? 0}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // CSV parser يدعم الفواصل والاقتباسات
  function parseCSV(text){
    const rows = [];
    let row = [];
    let cur = "";
    let inQuotes = false;

    for(let i=0;i<text.length;i++){
      const ch = text[i];

      if(inQuotes){
        if(ch === '"'){
          // "" داخل النص = اقتباس واحد
          if(text[i+1] === '"'){
            cur += '"';
            i++;
          }else{
            inQuotes = false;
          }
        }else{
          cur += ch;
        }
      }else{
        if(ch === '"'){
          inQuotes = true;
        }else if(ch === ","){
          row.push(cur);
          cur = "";
        }else if(ch === "\n"){
          row.push(cur);
          cur = "";
          // تجاهل السطر الفاضي تماما
          const allEmpty = row.every(c => String(c).trim() === "");
          if(!allEmpty) rows.push(row);
          row = [];
        }else if(ch === "\r"){
          // تجاهل
        }else{
          cur += ch;
        }
      }
    }
    // آخر خلية
    row.push(cur);
    const allEmpty = row.every(c => String(c).trim() === "");
    if(!allEmpty) rows.push(row);

    return rows;
  }

  function toInt(x){
    const n = parseInt(String(x ?? "").trim(), 10);
    return Number.isFinite(n) ? n : null;
  }

  function normalizeHeader(h){
    return String(h || "").trim().toLowerCase();
  }

  function buildHeaderIndex(headerRow){
    const idx = {};
    headerRow.forEach((h, i)=>{
      idx[normalizeHeader(h)] = i;
    });
    return idx;
  }

  function getCell(row, idx, key){
    const i = idx[key];
    if(i === undefined) return "";
    return row[i];
  }

  function computeStandingsFromMatches(matchesRows){
    // نبحث عن الهيدر ثم البيانات
    const header = matchesRows[0] || [];
    const idx = buildHeaderIndex(header);

    // أسماء الأعمدة المتوقعة في matches.csv (حسب مشروعك)
    // match_code, group, round, date, time, team1, team2, score1, score2, ...
    // لو عندك اختلاف بسيط بالاسم، أضفت بدائل تحت
    const col = {
      group: idx["group"] !== undefined ? "group" : (idx["المجموعة"] !== undefined ? "المجموعة" : null),
      team1: idx["team1"] !== undefined ? "team1" : (idx["الفريق 1"] !== undefined ? "الفريق 1" : null),
      team2: idx["team2"] !== undefined ? "team2" : (idx["الفريق 2"] !== undefined ? "الفريق 2" : null),
      score1: idx["score1"] !== undefined ? "score1" : (idx["النتيجة 1"] !== undefined ? "النتيجة 1" : null),
      score2: idx["score2"] !== undefined ? "score2" : (idx["النتيجة 2"] !== undefined ? "النتيجة 2" : null),
      round: idx["round"] !== undefined ? "round" : (idx["الدور"] !== undefined ? "الدور" : null)
    };

    if(!col.group || !col.team1 || !col.team2 || !col.score1 || !col.score2){
      throw new Error("أعمدة matches.csv غير مطابقة (group/team1/team2/score1/score2).");
    }

    const groups = {A:new Map(), B:new Map(), C:new Map(), D:new Map()};

    function ensureTeam(g, team){
      if(!groups[g].has(team)){
        groups[g].set(team, {team, played:0, win:0, draw:0, loss:0, gf:0, ga:0, gd:0, pts:0});
      }
      return groups[g].get(team);
    }

    // نمر على كل الصفوف بعد الهيدر
    for(let r=1; r<matchesRows.length; r++){
      const row = matchesRows[r];
      const gRaw = String(getCell(row, idx, col.group) ?? "").trim();
      const g = gRaw.toUpperCase();

      // فقط المجموعات A-D
      if(!["A","B","C","D"].includes(g)) continue;

      // (اختياري) نحسب فقط دور المجموعات: لو round فيه "الجولة" أو 1/2/3...
      // لو ما تحب هذا الشرط، اتركه كما هو (حاليا لن يمنع شيء)
      const roundVal = String(col.round ? getCell(row, idx, col.round) : "").trim();
      // لا فلترة صارمة هنا حتى لا نكسر بياناتك

      const t1 = String(getCell(row, idx, col.team1) ?? "").trim();
      const t2 = String(getCell(row, idx, col.team2) ?? "").trim();
      if(!t1 || !t2) continue;

      const s1 = toInt(getCell(row, idx, col.score1));
      const s2 = toInt(getCell(row, idx, col.score2));

      // إذا النتيجة غير مُدخلة (فارغة) نتجاهل المباراة
      if(s1 === null || s2 === null) continue;

      const a = ensureTeam(g, t1);
      const b = ensureTeam(g, t2);

      a.played += 1;
      b.played += 1;

      a.gf += s1; a.ga += s2;
      b.gf += s2; b.ga += s1;

      if(s1 > s2){
        a.win += 1; b.loss += 1;
        a.pts += 3;
      }else if(s1 < s2){
        b.win += 1; a.loss += 1;
        b.pts += 3;
      }else{
        a.draw += 1; b.draw += 1;
        a.pts += 1; b.pts += 1;
      }
    }

    // تحويل Map -> Array مع ترتيب + Rank
    const out = {};
    ["A","B","C","D"].forEach(g=>{
      const arr = Array.from(groups[g].values()).map(x=>{
        x.gd = x.gf - x.ga;
        return x;
      });

      arr.sort((x,y)=>{
        if(y.pts !== x.pts) return y.pts - x.pts;
        if(y.gd !== x.gd) return y.gd - x.gd;
        if(y.gf !== x.gf) return y.gf - x.gf;
        return String(x.team).localeCompare(String(y.team), "ar");
      });

      arr.forEach((x, i)=> x.rank = i+1);
      out[g] = arr;
    });

    return out;
  }

  async function loadStandingsFromMatchesCSV(){
    const res = await fetch("data/matches.csv", {cache:"no-store"});
    if(!res.ok) throw new Error("تعذر تحميل data/matches.csv");
    const text = await res.text();
    const rows = parseCSV(text);
    if(!rows.length) throw new Error("ملف matches.csv فارغ.");
    return computeStandingsFromMatches(rows);
  }

  async function loadStandingsFromJSONFallback(){
    const res = await fetch("data/standings.json", {cache:"no-store"});
    if(!res.ok) throw new Error("تعذر تحميل data/standings.json");
    const data = await res.json();
    return (data && data.groups) ? data.groups : {A:[],B:[],C:[],D:[]};
  }

  CupApp.initGroupsAll = async function(){
    hideError();
    try{
      // 1) الأساس: احسب من matches.csv (الذي تعدله من الأدمن)
      const groups = await loadStandingsFromMatchesCSV();

      ["A","B","C","D"].forEach(g=>{
        fillGroupTable(g, groups[g] || []);
      });

    }catch(e1){
      console.warn("فشل الحساب من matches.csv، سيتم استخدام standings.json كاحتياط:", e1);
      try{
        // 2) احتياط: standings.json (لا نحذفه)
        const groups = await loadStandingsFromJSONFallback();
        ["A","B","C","D"].forEach(g=>{
          fillGroupTable(g, groups[g] || []);
        });
      }catch(e2){
        console.error(e2);
        showError("حدث خطأ أثناء تحميل ترتيب المجموعات. تأكد من وجود data/matches.csv أو data/standings.json داخل المستودع.");
      }
    }
  };

  document.addEventListener("DOMContentLoaded", ()=>CupApp.initGroupsAll());
})();
