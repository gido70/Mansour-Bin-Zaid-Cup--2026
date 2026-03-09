/* MBZ Cup 2026 - Stats page */
const CupStats = (() => {

  const qs = (s, el=document)=>el.querySelector(s);

  function showError(msg){
    const box = qs('#loadError');
    if(!box) return;
    box.textContent = msg;
    box.classList.remove('hidden');
  }

  function parseCSV(text){
    // minimal CSV parser supporting quotes
    const rows = [];
    let row = [];
    let cur = '';
    let inQ = false;
    for(let i=0;i<text.length;i++){
      const ch = text[i];
      const next = text[i+1];
      if(inQ){
        if(ch === '"' && next === '"'){ cur += '"'; i++; continue; }
        if(ch === '"'){ inQ = false; continue; }
        cur += ch; continue;
      }else{
        if(ch === '"'){ inQ = true; continue; }
        if(ch === ','){ row.push(cur); cur=''; continue; }
        if(ch === '\n'){ row.push(cur); rows.push(row); row=[]; cur=''; continue; }
        if(ch === '\r'){ continue; }
        cur += ch;
      }
    }
    row.push(cur);
    rows.push(row);

    const header = rows.shift().map(x=>x.trim());
    return rows.filter(r=>r.length && r.some(x=>String(x).trim()!==""))
      .map(r=>{
        const o={};
        header.forEach((h,idx)=> o[h]= (r[idx] ?? '').trim());
        return o;
      });
  }

  async function loadMatches(){
    const res = await fetch('data/matches.csv', {cache:'no-store'});
    if(!res.ok) throw new Error('تعذر تحميل ملف المباريات (matches.csv)');
    const txt = await res.text();
    return parseCSV(txt);
  }

  function pickScorersField(m, side){ // side: 1 or 2
    const s = (m[`scorers_team${side}`] || '').trim();
    if(s) return s;
    return (m[`goals_team${side}`] || '').trim(); // fallback (كثير من الإدخالات هنا)
  }

  function parseList(s){
    // Supported formats:
    // 1) "Name|2;Name2|1"
    // 2) "Name (2);Name2 (1)"  (Arabic-friendly display)
    // 3) "Name;Name2"  (defaults to 1)
    // Also supports separators: ;  ،  ,  newlines
    s = String(s||'').trim();
    if(!s) return [];

    // unify separators
    const parts = s.split(/[;\n،,]+/).map(x=>x.trim()).filter(Boolean);

    return parts.map(item=>{
      // try pipe format
      const pipe = item.split('|').map(p=>p.trim());
      if(pipe.length>=2 && /^\d+$/.test(pipe[1])) return {name:pipe[0], n:parseInt(pipe[1],10)};

      // try parentheses count: "Name (2)" or "Name(2)"
      const m = item.match(/^(.*?)[\s]*\((\d+)\)\s*$/);
      if(m && m[1] && m[2]) return {name:m[1].trim(), n:parseInt(m[2],10)};

      return {name:item, n:1};
    });
  }

  function addCount(map, key, team, n=1){
    if(!key) return;
    const k = String(key).trim();
    if(!k) return;
    if(!map[k]) map[k] = {name:k, team:team||'', n:0};
    map[k].n += n;
    if(team && !map[k].team) map[k].team = team;
  }

  function sortMapToArr(map){
    return Object.values(map).sort((a,b)=> b.n - a.n || a.name.localeCompare(b.name,'ar'));
  }

  function renderRankTable(tblId, arr, cols){
    const tb = qs(`#${tblId} tbody`);
    if(!tb) return;
    tb.innerHTML = '';
    arr.forEach((it, idx)=>{
      const tr = document.createElement('tr');
      const cells = cols.map(fn => fn(it, idx));
      tr.innerHTML = cells.map(c=>`<td>${c}</td>`).join('');
      tb.appendChild(tr);
    });
  }

  function varEventsFromMatch(m){
    const ev=[];
    for(let i=1;i<=4;i++){
      const team = (m[`var${i}_team`]||'').trim();
      const type = (m[`var${i}_type`]||'').trim();
      const result = (m[`var${i}_result`]||'').trim();
      if(team && type && result) ev.push({team,type,result});
    }
    // fallback old single
    if(!ev.length && String(m.var_used||'0')==='1'){
      ev.push({team:(m.var_for||''), type:(m.var_type||''), result:(m.var_result||'')});
    }
    return ev;
  }

  // ✅ NEW: safer MOM team resolver (prevents wrong team attribution)
  function resolvePomTeam(m){
    const raw = String(m.pom_team || '').trim().toLowerCase();
    if(!raw) return ''; // unknown -> show as '—' later

    // normalize common inputs
    if(raw === 'team1' || raw === '1' || raw === 'team 1' || raw === 't1' || raw === 'home') return 'team1';
    if(raw === 'team2' || raw === '2' || raw === 'team 2' || raw === 't2' || raw === 'away') return 'team2';

    return ''; // anything else -> unknown
  }

  async function init(){
    try{
      const matches = await loadMatches();
      const badge = qs('#statsBadge');
      if(badge) badge.textContent = `${matches.length} مباراة`;

      const scorers = {};
      const yc = {};
      const rc = {};
      const momRows = [];
      const varByTeam = {}; // team name -> {used, good, bad}

      matches.forEach(m=>{
        // scorers (scorers_teamX or fallback goals_teamX)
        parseList(pickScorersField(m,1)).forEach(x=>addCount(scorers, x.name, m.team1, x.n));
        parseList(pickScorersField(m,2)).forEach(x=>addCount(scorers, x.name, m.team2, x.n));

        // cards
        parseList(m.yellow_team1).forEach(x=>addCount(yc, x.name, m.team1, x.n));
        parseList(m.yellow_team2).forEach(x=>addCount(yc, x.name, m.team2, x.n));
        parseList(m.red_team1).forEach(x=>addCount(rc, x.name, m.team1, x.n));
        parseList(m.red_team2).forEach(x=>addCount(rc, x.name, m.team2, x.n));

        // MOM list  ✅ FIXED: only assign team if pom_team is explicit
        if((m.player_of_match||'').trim()){
          const side = resolvePomTeam(m); // 'team1' | 'team2' | ''
          const team = side === 'team2' ? m.team2 : side === 'team1' ? m.team1 : ''; // unknown => blank
          momRows.push({
            match: m.match_id||m.code||m.match_code||'',
            code:  m.code||m.match_code||'',
            player: m.player_of_match,
            team
          });
        }

        // VAR per team
        const ev = varEventsFromMatch(m);
        if(ev.length){
          ev.forEach(e=>{
            const teamName = (e.team==='team2') ? m.team2 : (e.team==='team1') ? m.team1 : '';
            if(!teamName) return;
            if(!varByTeam[teamName]) varByTeam[teamName]={team:teamName, used:0, good:0, bad:0};
            varByTeam[teamName].used += 1;
            // benefit heuristic: awarded/cancelled/reversed = good, confirmed = bad
            if(e.result==='confirmed') varByTeam[teamName].bad += 1;
            else varByTeam[teamName].good += 1;
          });
        }else{
          // fallback counts if present
          const c1 = parseInt(m.var_team1||'0',10)||0;
          const c2 = parseInt(m.var_team2||'0',10)||0;
          if(c1){
            const t=m.team1; varByTeam[t]=varByTeam[t]||{team:t,used:0,good:0,bad:0};
            varByTeam[t].used+=c1;
          }
          if(c2){
            const t=m.team2; varByTeam[t]=varByTeam[t]||{team:t,used:0,good:0,bad:0};
            varByTeam[t].used+=c2;
          }
        }
      });

      renderRankTable('tblScorers', sortMapToArr(scorers), [
        (it,idx)=> String(idx+1),
        it=> `${it.name} (${it.n})`,
        it=> it.team || '—',
        it=> String(it.n)
      ]);

      renderRankTable('tblYC', sortMapToArr(yc), [
        (it,idx)=> String(idx+1),
        it=> `${it.name} (${it.n})`,
        it=> it.team || '—',
        it=> String(it.n)
      ]);

      renderRankTable('tblRC', sortMapToArr(rc), [
        (it,idx)=> String(idx+1),
        it=> `${it.name} (${it.n})`,
        it=> it.team || '—',
        it=> String(it.n)
      ]);

      const varArr = Object.values(varByTeam).sort((a,b)=> (b.used-a.used) || a.team.localeCompare(b.team,'ar'));
      renderRankTable('tblVAR', varArr, [
        (it,idx)=> String(idx+1),
        it=> it.team,
        it=> String(it.used),
        it=> String(it.good||0),
        it=> String(it.bad||0),
      ]);

      // MOM table
      const tb = qs('#tblMOM tbody');
      if(tb){
        tb.innerHTML = '';
        momRows.forEach(r=>{
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${r.match||'—'}</td><td>${r.code||'—'}</td><td>${r.player||'—'}</td><td>${r.team||'—'}</td>`;
          tb.appendChild(tr);
        });
      }

    }catch(err){
      showError(err?.message || 'حدث خطأ غير متوقع');
      console.error(err);
    }
  }

  return { init };
})();
