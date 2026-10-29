/* Samen Thuis v16.0
   SMART HOUSEHOLD + SCROLL PRESERVATION
   - Geen vaste weekdagen meer voor huishoudtaken.
   - Planning wordt berekend vanaf de echte laatste uitvoering.
   - 2×/3× per week werkt met flexibele tussenpozen en cyclusstatus.
   - completedDates blijft de bronhistorie.
   - Wijzigen/afvinken houdt de scrollpositie vast.
*/
console.info('Samen Thuis update 16.0 geladen');

(() => {
  'use strict';
  if (window.__SAMEN_THUIS_V160__) return;
  window.__SAMEN_THUIS_V160__ = true;

  const baseRender16 = render;
  const baseOccursOn16 = typeof occursOn === 'function' ? occursOn : null;
  const baseToggle16 = typeof toggleChoreOccurrence === 'function' ? toggleChoreOccurrence : null;

  const pad16 = n => String(n).padStart(2,'0');
  const iso16 = d => `${d.getFullYear()}-${pad16(d.getMonth()+1)}-${pad16(d.getDate())}`;
  const parse16 = s => new Date(`${s}T12:00:00`);
  const today16 = () => iso16(new Date());

  const esc16 = (v='') => String(v).replace(/[&<>'"]/g, c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[c]));

  const norm16 = (v='') => String(v).toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9×]+/g,' ').trim();

  function addDays16(dateISO, amount) {
    const d=parse16(dateISO);
    d.setDate(d.getDate()+amount);
    return iso16(d);
  }

  function addMonths16(dateISO, amount) {
    const original=parse16(dateISO);
    const day=original.getDate();
    const d=new Date(original.getFullYear(), original.getMonth()+amount, 1, 12);
    const last=new Date(d.getFullYear(), d.getMonth()+1, 0, 12).getDate();
    d.setDate(Math.min(day,last));
    return iso16(d);
  }

  function daysBetween16(a,b) {
    return Math.round((parse16(b)-parse16(a))/86400000);
  }

  function fmt16(date) {
    if(!date) return '';
    return new Intl.DateTimeFormat('nl-NL',{day:'numeric',month:'short'}).format(parse16(date));
  }

  function uniqueSortedDates16(chore) {
    return [...new Set((Array.isArray(chore.completedDates)?chore.completedDates:[])
      .filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)))]
      .sort();
  }

  function lastDone16(chore) {
    const dates=uniqueSortedDates16(chore);
    return chore.lastDoneDate || dates.at(-1) || '';
  }

  function frequency16(chore) {
    const r=norm16(chore.repeat);
    if(r==='dagelijks') return {kind:'interval', target:1, days:1, lead:0};
    if(r==='om de dag') return {kind:'interval', target:1, days:2, lead:1};
    if(r==='2× per week' || r==='2x per week' || r==='2 per week') return {kind:'multi',target:2,days:4,lead:2,cycleDays:7};
    if(r==='3× per week' || r==='3x per week' || r==='3 per week') return {kind:'multi',target:3,days:3,lead:1,cycleDays:7};
    if(r==='wekelijks') return {kind:'interval',target:1,days:7,lead:3};
    if(r==='elke 2 weken' || r==='om de week') return {kind:'interval',target:1,days:14,lead:4};
    if(r==='elke 4 weken') return {kind:'interval',target:1,days:28,lead:7};
    if(r==='maandelijks') return {kind:'month',target:1,months:1,lead:7};
    if(r==='elke 2 maanden') return {kind:'month',target:1,months:2,lead:10};
    if(r==='elke 3 maanden') return {kind:'month',target:1,months:3,lead:14};
    if(r==='elke 6 maanden' || r==='halfjaarlijks') return {kind:'month',target:1,months:6,lead:21};
    if(r==='jaarlijks') return {kind:'month',target:1,months:12,lead:30};
    if(r==='eenmalig') return {kind:'once',target:1,lead:3};
    if(r==='na elke was' || r==='wanneer nodig') return {kind:'manual',target:0,lead:0};
    return {kind:'interval',target:1,days:7,lead:3};
  }

  function cycleCount16(chore, cfg) {
    if(cfg.kind!=='multi') return 0;
    const persisted=Number(chore.smartCycleCount);
    if(Number.isFinite(persisted) && persisted>=0 && persisted<=cfg.target) return persisted;

    const dates=uniqueSortedDates16(chore);
    if(!dates.length) return 0;

    // Reconstruct a current flexible cycle from the most recent completions.
    const recent=[];
    for(let i=dates.length-1;i>=0;i--) {
      if(!recent.length || daysBetween16(dates[i],recent.at(-1))<=cfg.days) {
        recent.unshift(dates[i]);
        if(recent.length>=cfg.target) break;
      } else break;
    }
    return Math.min(cfg.target,recent.length);
  }

  function nextDue16(chore) {
    const cfg=frequency16(chore);
    const last=lastDone16(chore);

    if(cfg.kind==='manual') return '';
    if(cfg.kind==='once') {
      if(last) return '';
      return chore.due || today16();
    }

    // First ever run: due is only an initial hint, never a fixed recurring weekday.
    if(!last) return chore.due || today16();

    if(cfg.kind==='month') return addMonths16(last,cfg.months);
    return addDays16(last,cfg.days);
  }

  function smartStatus16(chore, date=today16()) {
    const cfg=frequency16(chore);
    const last=lastDone16(chore);
    const due=nextDue16(chore);

    if(cfg.kind==='manual') {
      return {
        due:'', last, count:0, target:0, level:'green',
        text:last?`Laatst gedaan ${fmt16(last)} · wanneer nodig`:'Wanneer nodig'
      };
    }

    if(cfg.kind==='once' && last) {
      return {due:'',last,count:1,target:1,level:'green',text:`Afgerond ${fmt16(last)}`};
    }

    const delta=due ? daysBetween16(date,due) : 999;
    let level='green';
    if(delta<0) level='red';
    else if(delta<=Math.min(2,cfg.lead||0)) level='orange';

    if(cfg.kind==='multi') {
      const count=cycleCount16(chore,cfg);
      if(count>=cfg.target) {
        const text = delta>0
          ? `${cfg.target}/${cfg.target} gedaan · nieuwe cyclus over ${delta} ${delta===1?'dag':'dagen'}`
          : delta===0
            ? `${cfg.target}/${cfg.target} gedaan · nieuwe cyclus kan vandaag starten`
            : `Nieuwe cyclus is ${Math.abs(delta)} ${Math.abs(delta)===1?'dag':'dagen'} aan de beurt`;
        return {due,last,count,target:cfg.target,level,text};
      }

      const remaining=cfg.target-count;
      const prefix=`${count}/${cfg.target} gedaan`;
      const text=delta>0
        ? `${prefix} · nog ${remaining}× · volgende binnen ${delta} ${delta===1?'dag':'dagen'}`
        : delta===0
          ? `${prefix} · nog ${remaining}× · volgende vandaag`
          : `${prefix} · nog ${remaining}× · ${Math.abs(delta)} ${Math.abs(delta)===1?'dag':'dagen'} te laat`;
      return {due,last,count,target:cfg.target,level,text};
    }

    const text = delta>0
      ? `Binnen ${delta} ${delta===1?'dag':'dagen'} weer doen`
      : delta===0
        ? 'Vandaag weer doen'
        : `${Math.abs(delta)} ${Math.abs(delta)===1?'dag':'dagen'} te laat`;

    return {due,last,count:last?1:0,target:1,level,text};
  }

  function shouldShowSoon16(chore,date=today16()) {
    const cfg=frequency16(chore);
    const st=smartStatus16(chore,date);
    if(cfg.kind==='manual') return false;
    if(cfg.kind==='once' && st.last) return false;
    if(!st.due) return false;
    const d=daysBetween16(date,st.due);
    return d<=Math.max(0,cfg.lead||0);
  }

  // Replace fixed-weekday scheduling. The calendar occurrence is now the calculated
  // next deadline only; "soon" tasks are surfaced separately in Today/Household.
  if(baseOccursOn16) {
    occursOn = function occursOnV16(chore,date) {
      const due=nextDue16(chore);
      return Boolean(due && date===due);
    };
  }

  // Completion is always an actual completion moment, not a recurring weekday.
  if(baseToggle16) {
    toggleChoreOccurrence = function toggleChoreOccurrenceV16(choreId,date) {
      const chore=(data.chores||[]).find(x=>x.id===choreId);
      if(!chore) return;

      const doneDate = (date && date<=today16()) ? date : today16();
      chore.completedDates ||= [];

      // Clicking an already-recorded date undoes that exact completion.
      if(chore.completedDates.includes(doneDate)) {
        chore.completedDates=chore.completedDates.filter(x=>x!==doneDate);
        const dates=uniqueSortedDates16(chore);
        chore.lastDoneDate=dates.at(-1)||'';
        delete chore.smartCycleCount;
        delete chore.smartCycleStart;
      } else {
        const cfg=frequency16(chore);
        const previousLast=lastDone16(chore);
        chore.completedDates=[...new Set([...chore.completedDates,doneDate])].sort();
        chore.lastDoneDate=doneDate;

        if(cfg.kind==='multi') {
          let current=cycleCount16(chore,cfg);
          if(current>=cfg.target || !previousLast || daysBetween16(previousLast,doneDate)>cfg.cycleDays) {
            current=1;
            chore.smartCycleStart=doneDate;
          } else {
            current=Math.min(cfg.target,current+1);
            chore.smartCycleStart ||= previousLast;
          }
          chore.smartCycleCount=current;
        } else {
          chore.smartCycleCount=1;
          chore.smartCycleStart=doneDate;
        }
      }

      save();
      render();
    };
  }

  function migrateSmartChores16() {
    (data.chores||[]).forEach(chore=>{
      chore.completedDates ||= [];
      if(!chore.lastDoneDate) {
        const dates=uniqueSortedDates16(chore);
        chore.lastDoneDate=dates.at(-1)||'';
      }
      // Old second weekday is intentionally ignored from v16 onward.
      chore.secondWeekday='';
      chore.smartSchedule=true;
    });
    save({touch:false});
  }

  function statusColor16(level) {
    if(level==='red') return '#b84f58';
    if(level==='orange') return '#b2762c';
    return '#2e7d67';
  }

  function smartTaskCard16(chore) {
    const s=smartStatus16(chore);
    const last=s.last?`Laatst: ${fmt16(s.last)}`:'Nog niet uitgevoerd';
    return `<article class="v16-smart-task" data-v16-chore="${esc16(chore.id)}"
      style="border:1px solid rgba(49,95,134,.18);border-left:5px solid ${statusColor16(s.level)};border-radius:16px;padding:14px;margin:10px 0;background:rgba(255,255,255,.7)">
      <div style="display:flex;gap:12px;justify-content:space-between;align-items:flex-start">
        <div>
          <strong>${esc16(chore.title)}</strong>
          <div class="muted" style="margin-top:4px">${esc16(chore.person||'Samen')} · ${esc16(chore.repeat||'')}</div>
        </div>
        <button class="primary" data-v16-done="${esc16(chore.id)}" style="white-space:nowrap">✓ Gedaan</button>
      </div>
      <div style="margin-top:10px;font-weight:700;color:${statusColor16(s.level)}">${esc16(s.text)}</div>
      <small class="muted">${esc16(last)}${s.due?` · uiterlijk ${esc16(fmt16(s.due))}`:''}</small>
    </article>`;
  }

  function injectSmartHousehold16() {
    if(current!=='chores') return;
    const view=document.querySelector('#view');
    if(!view || view.querySelector('[data-v16-smart-household]')) return;

    const chores=[...(data.chores||[])].sort((a,b)=>{
      const sa=smartStatus16(a), sb=smartStatus16(b);
      if(!sa.due&&!sb.due) return 0;
      if(!sa.due) return 1;
      if(!sb.due) return -1;
      return sa.due.localeCompare(sb.due);
    });

    const dueSoon=chores.filter(x=>shouldShowSoon16(x));
    const later=chores.filter(x=>!shouldShowSoon16(x));

    const html=`<section class="card" data-v16-smart-household>
      <div class="card-head">
        <div><p class="eyebrow">SLIMME PLANNING</p><h2>Wanneer moet wat weer?</h2></div>
        <span class="tag green">Geen vaste weekdagen</span>
      </div>
      <p class="muted">Na iedere afronding wordt de volgende termijn opnieuw berekend vanaf die echte datum.</p>
      ${dueSoon.length?`
        <h3 style="margin-top:18px">Nu / binnenkort</h3>
        ${dueSoon.map(smartTaskCard16).join('')}
      `:`<p class="muted">Er hoeft op dit moment niets binnenkort gedaan te worden.</p>`}
      ${later.length?`
        <details style="margin-top:14px">
          <summary>Later (${later.length})</summary>
          <div style="margin-top:10px">${later.map(smartTaskCard16).join('')}</div>
        </details>`:''}
    </section>`;

    const distribution=view.querySelector('[data-v15-household]');
    if(distribution) distribution.insertAdjacentHTML('afterend',html);
    else view.insertAdjacentHTML('afterbegin',html);
  }

  function injectTodaySoon16() {
    if(current!=='today') return;
    const view=document.querySelector('#view');
    if(!view || view.querySelector('[data-v16-today-chores]')) return;

    const soon=(data.chores||[])
      .filter(x=>shouldShowSoon16(x))
      .sort((a,b)=>(nextDue16(a)||'9999').localeCompare(nextDue16(b)||'9999'));

    if(!soon.length) return;

    const html=`<section class="card" data-v16-today-chores>
      <div class="card-head">
        <div><p class="eyebrow">HUISHOUDEN · BINNENKORT</p><h2>${soon.length} ${soon.length===1?'taak':'taken'} in beeld</h2></div>
        <span class="tag">Flexibel</span>
      </div>
      ${soon.slice(0,6).map(smartTaskCard16).join('')}
    </section>`;

    view.insertAdjacentHTML('beforeend',html);
  }

  // ---- SCROLL PRESERVATION ----
  let lastRenderedPage16=null;
  let savedPage16=null;
  let savedY16=0;
  let restoreToken16=0;

  function captureScroll16() {
    savedPage16=current;
    savedY16=window.scrollY || document.documentElement.scrollTop || 0;
  }

  function restoreScroll16(page,y) {
    const token=++restoreToken16;
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        if(token!==restoreToken16 || current!==page) return;
        window.scrollTo({top:y,left:0,behavior:'auto'});
      });
    });
  }

  render = function renderV160() {
    const samePage = lastRenderedPage16===current;
    const y = samePage ? (window.scrollY || document.documentElement.scrollTop || 0) : 0;
    const page=current;

    baseRender16();
    injectSmartHousehold16();
    injectTodaySoon16();

    lastRenderedPage16=page;
    if(samePage && y>0) restoreScroll16(page,y);
  };

  // Capture before interactions that commonly re-render the same page:
  // edit/delete/complete/import/save/bulk controls.
  document.addEventListener('pointerdown',e=>{
    const actionable=e.target.closest(
      'button, input[type="checkbox"], select, [data-edit], [data-delete], [data-action], [data-v13-card], [data-v14-card], [data-v15-distribute], [data-v15-price-commit], [data-v16-done]'
    );
    if(actionable) captureScroll16();
  },true);

  document.addEventListener('click',e=>{
    const done=e.target.closest('[data-v16-done]');
    if(done) {
      e.preventDefault();
      e.stopImmediatePropagation();
      captureScroll16();
      toggleChoreOccurrence(done.dataset.v16Done,today16());
      return;
    }
  },true);

  migrateSmartChores16();

  // One initial render is needed so existing screens immediately use the new logic.
  render();
  toast('Samen Thuis v16 geladen');
})();
