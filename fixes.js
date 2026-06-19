(function(){
  const today = '2026-06-19';
  const $q = s => document.querySelector(s);
  const $qa = s => Array.from(document.querySelectorAll(s));
  let observerQueued = false;
  const fmt = d => {
    try { return new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short',year:'2-digit'}).format(new Date(d+'T00:00:00')); }
    catch { return d || '-'; }
  };
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const money = n => new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB',maximumFractionDigits:0}).format(Number(n||0));

  function listProjects(){
    try { return projects || []; } catch { return []; }
  }

  function saveProjects(){
    try {
      localStorage.setItem('latiteam-projects', JSON.stringify(projects));
      localStorage.setItem('latiteam-updates', JSON.stringify(updates || []));
    } catch {}
  }

  function recomputeProject(p){
    if(!p || !Array.isArray(p.workstreams)) return;
    p.workstreams.forEach(ws => {
      ws.progress = ws.items && ws.items.length
        ? Math.round(ws.items.reduce((sum,i)=>sum+Number(i.progress||0),0)/ws.items.length)
        : Number(ws.progress||0);
    });
    p.progress = p.workstreams.length
      ? Math.round(p.workstreams.reduce((sum,w)=>sum+Number(w.progress||0),0)/p.workstreams.length)
      : Number(p.progress||0);
    p.status = p.progress >= 100 ? 'done' : 'active';
  }

  function eventList(projectId){
    const rows = [];
    listProjects().forEach(p => {
      if(projectId && p.id !== projectId) return;
      (p.workstreams || []).forEach(ws => {
        rows.push({ id:`ws-${p.id}-${ws.id}`, date:ws.followUp || ws.due || p.deadline, title:ws.title, project:p, owner:ws.owner, type:'work', note:ws.note || '' });
        rows.push({ id:`due-${p.id}-${ws.id}`, date:ws.due || p.deadline, title:`Deadline: ${ws.title}`, project:p, owner:ws.owner, type:'deadline', note:ws.note || '' });
        (ws.items || []).forEach(item => {
          if(Number(item.progress||0) < 100) rows.push({ id:`item-${p.id}-${ws.id}-${item.id}`, date:item.followUp || item.due, title:item.title, project:p, owner:item.owner, type:'follow', note:item.note || '' });
        });
      });
      (p.meetings || []).forEach(m => rows.push({ ...m, id:m.id || `meeting-${p.id}-${m.date}-${m.title}`, project:p, type:m.type || 'meeting' }));
    });
    try {
      (standaloneEvents || []).forEach(e => {
        const p = e.projectId ? listProjects().find(x=>x.id===e.projectId) : null;
        if(projectId && (!p || p.id !== projectId)) return;
        rows.push({ ...e, id:e.id || `event-${e.date}-${e.title}`, project:p, type:p ? (e.type || 'meeting') : 'general' });
      });
    } catch {}
    return rows.filter(e => e.date).sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));
  }

  function calendarColor(type){
    return {follow:'#3f9f77',meeting:'#8a5cf6',deadline:'#f59f34',work:'#35a9c8',general:'#6b7280'}[type] || '#315bea';
  }

  function renderMonth(root, events){
    if(!root) return;
    const start = '2026-06-01';
    const base = new Date(start+'T00:00:00');
    const first = new Date(base.getFullYear(), base.getMonth(), 1);
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - first.getDay());
    const weekdays = ['อา','จ','อ','พ','พฤ','ศ','ส'];
    root.innerHTML = `<div class="ios-calendar forced-calendar">
      <div class="ios-calendar-top"><div class="ios-calendar-title"><small>Monthly work overview</small><b>มิถุนายน 2569</b></div><div class="ios-calendar-actions"><span>Calendar</span></div></div>
      <div class="ios-weekdays">${weekdays.map(d=>`<div>${d}</div>`).join('')}</div>
      <div class="ios-month-grid">${Array.from({length:42},(_,i)=>{
        const d = new Date(gridStart); d.setDate(gridStart.getDate()+i);
        const iso = ymd(d);
        const dayEvents = events.filter(e=>e.date===iso).slice(0,5);
        return `<div class="ios-day ${d.getMonth()!==5?'is-muted':''} ${iso===today?'is-today':''}">
          <div class="ios-date">${d.getDate()}</div>
          <div class="ios-events">${dayEvents.map(e=>`<div class="ios-event ${e.type}" style="--event-color:${calendarColor(e.type)}" data-force-event="${e.id}"><b>${e.time?e.time+' ':''}${e.title}</b><small>${e.project?.name || 'งานกลาง'} · ${e.owner || '-'}</small></div>`).join('')}</div>
        </div>`;
      }).join('')}</div>
    </div>`;
    $qa('[data-force-event]').forEach(el => el.onclick = () => showEvent(el.dataset.forceEvent));
  }

  function ensureDashboardCalendar(){
    const dash = $q('#dashboardView');
    if(!dash) return;
    let panel = $q('#dashboardMonthOverviewForce');
    if(!panel){
      const anchor = dash.querySelector('.dashboard-grid');
      if(!anchor) return;
      anchor.insertAdjacentHTML('afterend', `<article class="panel month-overview-panel force-panel"><div class="month-overview-head"><div><span class="eyebrow">MONTHLY CALENDAR OVERVIEW</span><h3>ภาพรวมงานแบบปฏิทิน</h3></div><div class="calendar-legend"><span><i style="background:#3f9f77"></i>Follow-up</span><span><i style="background:#8a5cf6"></i>Meeting</span><span><i style="background:#f59f34"></i>Deadline</span><span><i style="background:#35a9c8"></i>Workstream</span></div></div><div id="dashboardMonthOverviewForce"></div></article>`);
      panel = $q('#dashboardMonthOverviewForce');
    }
    const events = eventList();
    const signature = events.map(e=>[e.id,e.date,e.time,e.title,e.owner].join('|')).join('||');
    if(panel.dataset.renderSignature === signature) return;
    panel.dataset.renderSignature = signature;
    renderMonth(panel, events);
  }

  function ensureEventModal(){
    if($q('#forceEventModal')) return;
    document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop" id="forceEventModal" aria-hidden="true"><div class="modal"><div class="modal-head"><div><span class="eyebrow">EVENT DETAIL</span><h2>รายละเอียดรายการ</h2></div><button class="close-force-event">×</button></div><div id="forceEventBody"></div></div></div>`);
    $qa('.close-force-event').forEach(b=>b.onclick=()=> $q('#forceEventModal').classList.remove('open'));
    $q('#forceEventModal').onclick = e => { if(e.target === $q('#forceEventModal')) $q('#forceEventModal').classList.remove('open'); };
  }

  function ensureVersionBadge(){
    if($q('#forceVersionBadge')) return;
    document.body.insertAdjacentHTML('beforeend', `<div id="forceVersionBadge" style="position:fixed;right:16px;bottom:14px;z-index:9999;background:#132a63;color:#fff;border-radius:999px;padding:8px 12px;font:600 12px Kanit,sans-serif;box-shadow:0 10px 25px rgba(15,35,75,.18)">ระบบอัปเดตแล้ว v20260619-7</div>`);
  }

  function showEvent(id){
    ensureEventModal();
    const e = eventList().find(x=>x.id===id);
    if(!e) return;
    $q('#forceEventBody').innerHTML = `<div class="event-popup-body">
      <div class="permission-row"><b>หัวข้อ</b><span>${e.title}</span></div>
      <div class="permission-row"><b>วันที่ / เวลา</b><span>${fmt(e.date)} ${e.time || ''}</span></div>
      <div class="permission-row"><b>โครงการ</b><span>${e.project?.name || 'งานกลาง ไม่คิด Progress'}</span></div>
      <div class="permission-row"><b>ผู้ดูแล</b><span>${e.owner || '-'}</span></div>
      <div class="permission-row"><b>รายละเอียด</b><span>${e.note || '-'}</span></div>
    </div>`;
    $q('#forceEventModal').classList.add('open');
  }

  function peopleForProject(p){
    return [...new Set([p?.manager, ...(p?.team || []), ...((p?.workstreams || []).flatMap(ws => [ws.owner, ...((ws.items || []).map(i=>i.owner))]))])].filter(Boolean);
  }

  function ensureEditModal(){
    if($q('#forceEditTaskModal')) return;
    document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop" id="forceEditTaskModal" aria-hidden="true"><div class="modal wide-modal"><div class="modal-head"><div><span class="eyebrow">EDIT TASK</span><h2>แก้ไขรายละเอียดงาน</h2></div><button class="close-force-edit">×</button></div><form id="forceEditTaskForm"><input type="hidden" id="forceProjectId"><input type="hidden" id="forceStreamId"><input type="hidden" id="forceItemId"><label>ชื่องาน<input id="forceTaskTitle" required></label><label>รายละเอียด<textarea id="forceTaskNote" rows="3"></textarea></label><div class="form-row three"><label>ผู้รับผิดชอบ<select id="forceTaskOwner"></select></label><label>กำหนดส่ง<input id="forceTaskDue" type="date" required></label><label>ติดตามครั้งถัดไป<input id="forceTaskFollow" type="date" required></label></div><div class="form-row"><label>Progress (%)<input id="forceTaskProgress" type="number" min="0" max="100" required></label><label>ความสำคัญ<select id="forceTaskPriority"><option value="high">สูง</option><option value="medium">กลาง</option><option value="low">ต่ำ</option></select></label></div><div class="modal-actions"><button type="button" class="secondary close-force-edit">ยกเลิก</button><button type="submit" class="primary">บันทึก</button></div></form></div></div>`);
    $qa('.close-force-edit').forEach(b=>b.onclick=()=> $q('#forceEditTaskModal').classList.remove('open'));
    $q('#forceEditTaskModal').onclick = e => { if(e.target === $q('#forceEditTaskModal')) $q('#forceEditTaskModal').classList.remove('open'); };
    $q('#forceEditTaskForm').onsubmit = saveEdit;
  }

  function openEdit(projectId, streamId, itemId){
    ensureEditModal();
    const p = listProjects().find(x=>x.id===projectId);
    const ws = p?.workstreams?.find(x=>x.id===streamId);
    const item = ws?.items?.find(x=>x.id===itemId);
    if(!item) return;
    $q('#forceProjectId').value = projectId;
    $q('#forceStreamId').value = streamId;
    $q('#forceItemId').value = itemId;
    $q('#forceTaskTitle').value = item.title || '';
    $q('#forceTaskNote').value = item.note || '';
    $q('#forceTaskOwner').innerHTML = peopleForProject(p).map(o=>`<option value="${o}" ${o===item.owner?'selected':''}>${o}</option>`).join('');
    $q('#forceTaskDue').value = item.due || today;
    $q('#forceTaskFollow').value = item.followUp || item.due || today;
    $q('#forceTaskProgress').value = item.progress || 0;
    $q('#forceTaskPriority').value = item.priority || 'medium';
    $q('#forceEditTaskModal').classList.add('open');
  }

  function saveEdit(e){
    e.preventDefault();
    const p = listProjects().find(x=>x.id===$q('#forceProjectId').value);
    const ws = p?.workstreams?.find(x=>x.id===$q('#forceStreamId').value);
    const item = ws?.items?.find(x=>x.id===$q('#forceItemId').value);
    if(!item) return;
    const from = Number(item.progress||0);
    item.title = $q('#forceTaskTitle').value.trim();
    item.note = $q('#forceTaskNote').value.trim();
    item.owner = $q('#forceTaskOwner').value;
    item.due = $q('#forceTaskDue').value;
    item.followUp = $q('#forceTaskFollow').value;
    delete ws.reportedProgress;
    item.progress = Math.max(0, Math.min(100, Number($q('#forceTaskProgress').value)));
    item.priority = $q('#forceTaskPriority').value;
    try { if(!updates) updates = []; updates.unshift({date:new Date().toISOString(),project:p.id,task:item.title,from,to:item.progress,note:'แก้ไขรายละเอียดงาน',user:'ผู้ดูแลระบบ'}); } catch {}
    recomputeProject(p);
    saveProjects();
    $q('#forceEditTaskModal').classList.remove('open');
    if(typeof showDetail === 'function') showDetail(p.id);
    setTimeout(enhanceDetail, 80);
  }

  function enhanceDetail(){
    const title = $q('.detail-title h2');
    if(!title) return;
    const name = title.textContent.trim();
    const p = listProjects().find(x=>x.name===name || name.includes(x.name));
    if(!p) return;

    const stack = $q('#projectDetail .detail-side-stack');
    if(stack && !$q('#projectMiniCalendarForce')){
      stack.insertAdjacentHTML('afterbegin', `<div class="panel force-project-calendar"><div class="panel-head"><div><span class="eyebrow">PROJECT CALENDAR</span><h3>ปฏิทินโครงการนี้</h3></div></div><div id="projectMiniCalendarForce" class="project-mini-calendar"></div></div><div class="panel"><span class="eyebrow">EXECUTIVE PERFORMANCE</span><h3>Performance แยกผู้ดูแล</h3><div id="projectPerformanceForce" class="project-performance"></div></div>`);
    }
    const cal = $q('#projectMiniCalendarForce');
    if(cal){
      const evs = eventList(p.id).slice(0,8);
      const signature = evs.map(e=>[e.id,e.date,e.time,e.title,e.owner].join('|')).join('||');
      if(cal.dataset.renderSignature !== signature){
        cal.dataset.renderSignature = signature;
        cal.innerHTML = evs.length ? evs.map(e=>`<div class="mini-cal-event ${e.type}" data-force-event="${e.id}"><b>${e.title}</b><small>${fmt(e.date)} ${e.time || ''} · ${e.owner || '-'}</small></div>`).join('') : '<div class="empty-state">ยังไม่มีรายการในปฏิทิน</div>';
        $qa('[data-force-event]').forEach(el => el.onclick = () => showEvent(el.dataset.forceEvent));
      }
    }

    const perf = $q('#projectPerformanceForce');
    if(perf){
      const owners = {};
      (p.workstreams || []).forEach(ws => {
        owners[ws.owner] = owners[ws.owner] || [];
        owners[ws.owner].push(Number(ws.progress||0));
        (ws.items || []).forEach(i => {
          owners[i.owner] = owners[i.owner] || [];
          owners[i.owner].push(Number(i.progress||0));
        });
      });
      const signature = JSON.stringify(owners);
      if(perf.dataset.renderSignature !== signature){
        perf.dataset.renderSignature = signature;
        perf.innerHTML = Object.entries(owners).map(([owner,vals]) => {
          const avg = Math.round(vals.reduce((a,b)=>a+b,0)/vals.length);
          return `<div class="performance-row"><div><b>${owner}</b><small>${vals.length} งาน</small></div><div class="mini-progress"><span style="width:${avg}%;background:${p.color||'#315bea'}"></span></div><b>${avg}%</b></div>`;
        }).join('');
      }
    }

    $qa('.check-row').forEach(row => {
      if(row.querySelector('[data-force-edit]')) return;
      const input = row.querySelector('[data-progress-item]');
      if(!input) return;
      row.insertAdjacentHTML('beforeend', `<button class="text-button edit-task-button" data-force-edit="${input.dataset.progressItem}" data-stream-id="${input.dataset.streamId}" data-project-id="${input.dataset.projectId}">แก้ไข</button>`);
    });
    $qa('[data-force-edit]').forEach(btn => btn.onclick = () => openEdit(btn.dataset.projectId, btn.dataset.streamId, btn.dataset.forceEdit));
  }

  function hookDetail(){
    if(typeof showDetail !== 'function' || showDetail.__forceHooked) return;
    const old = showDetail;
    showDetail = function(id){
      old(id);
      setTimeout(enhanceDetail, 80);
    };
    showDetail.__forceHooked = true;
  }

  function boot(){
    ensureDashboardCalendar();
    ensureVersionBadge();
    ensureEditModal();
    ensureEventModal();
    hookDetail();
    enhanceDetail();
    const observer = new MutationObserver(() => {
      if(observerQueued) return;
      observerQueued = true;
      requestAnimationFrame(() => {
        observerQueued = false;
        ensureDashboardCalendar();
        enhanceDetail();
      });
    });
    observer.observe(document.body, { childList:true, subtree:true });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
