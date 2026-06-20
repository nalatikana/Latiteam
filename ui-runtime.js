(() => {
  const icon = (path) => `<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
  const chevronLeft = icon('<path d="m15 18-6-6 6-6"/>');
  const chevronRight = icon('<path d="m9 18 6-6-6-6"/>');
  const calendarIcon = icon('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>');
  const plusIcon = icon('<path d="M12 5v14M5 12h14"/>');

  function setCalendarMonth(delta = 0, today = false) {
    const current = today ? new Date() : new Date(`${calendarMonthStart()}T00:00:00`);
    current.setDate(1);
    if (!today) current.setMonth(current.getMonth() + delta);
    const first = localYmd(current);
    const lastDate = new Date(current.getFullYear(), current.getMonth() + 1, 0);
    const last = localYmd(lastDate);
    uiFilters.agendaStart = first;
    uiFilters.agendaEnd = last;
    ['dashboardCalendarStart', 'agendaStartFilter'].forEach(id => { const field = document.querySelector(`#${id}`); if (field) field.value = first; });
    ['dashboardCalendarEnd', 'agendaEndFilter'].forEach(id => { const field = document.querySelector(`#${id}`); if (field) field.value = last; });
    renderAll();
  }

  function openCalendarEntry() {
    installStandaloneTools();
    const form = document.querySelector('#standaloneEventForm');
    form.reset();
    document.querySelector('#standaloneDate').value = planningToday;
    document.querySelector('#standaloneTime').value = '10:00';
    document.querySelector('#standaloneEventModal').classList.add('open');
  }

  renderMonthBoard = function(targetId) {
    const root = document.querySelector(`#${targetId}`);
    if (!root) return;
    const start = calendarMonthStart();
    const base = new Date(`${start}T00:00:00`);
    const year = base.getFullYear();
    const month = base.getMonth();
    const firstDay = new Date(year, month, 1);
    const gridStart = new Date(firstDay);
    gridStart.setDate(firstDay.getDate() - firstDay.getDay());
    const events = finalCalendarEvents();
    const weekdays = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
    root.innerHTML = `<div class="ios-calendar">
      <div class="ios-calendar-top">
        <div class="ios-calendar-title"><small>ภาพรวมงานประจำเดือน</small><b>${monthNameTH(start)}</b></div>
        <div class="calendar-nav" aria-label="ควบคุมปฏิทิน">
          <button class="calendar-icon-button" type="button" data-calendar-shift="-1" aria-label="เดือนก่อนหน้า">${chevronLeft}</button>
          <button class="calendar-today-button" type="button" data-calendar-today>${calendarIcon}<span>เดือนนี้</span></button>
          <button class="calendar-icon-button" type="button" data-calendar-shift="1" aria-label="เดือนถัดไป">${chevronRight}</button>
          <button class="calendar-add-button" type="button" data-calendar-add>${plusIcon}<span>เพิ่มนัดหมาย</span></button>
        </div>
      </div>
      <div class="ios-weekdays">${weekdays.map(day => `<div>${day}</div>`).join('')}</div>
      <div class="ios-month-grid">${Array.from({length: 42}, (_, index) => {
        const date = new Date(gridStart);
        date.setDate(gridStart.getDate() + index);
        const iso = localYmd(date);
        const dayEvents = events.filter(event => event.date === iso);
        const shown = dayEvents.slice(0, 5);
        return `<div class="ios-day ${date.getMonth() !== month ? 'is-muted' : ''} ${iso === planningToday ? 'is-today' : ''}">
          <div class="ios-date">${date.getDate()}</div>
          <div class="ios-events">${shown.map(event => `<button class="ios-event ${event.type}" type="button" style="--event-color:${calendarColor(event)}" data-event-id="${event.id || `${event.type}-${event.date}-${event.title}`}"><b>${event.time ? `${event.time} ` : ''}${event.title}</b><small>${event.project?.name || 'งานกลาง'} · ${event.owner || '-'}</small></button>`).join('')}${dayEvents.length > shown.length ? `<div class="ios-more">อีก ${dayEvents.length - shown.length} รายการ</div>` : ''}</div>
        </div>`;
      }).join('')}</div>
    </div>`;
    root.querySelectorAll('[data-event-id]').forEach(button => button.onclick = () => openEventPopup(button.dataset.eventId));
    root.querySelectorAll('[data-calendar-shift]').forEach(button => button.onclick = () => setCalendarMonth(Number(button.dataset.calendarShift)));
    root.querySelector('[data-calendar-today]').onclick = () => setCalendarMonth(0, true);
    root.querySelector('[data-calendar-add]').onclick = openCalendarEntry;
  };

  function financeLedgerReady() {
    return !window.LatiteamSupabase || window.LatiteamSupabase.isFinanceLedgerAvailable();
  }

  function renderFinanceMigrationNotice() {
    const view = document.querySelector('#financeView');
    if (!view) return;
    let notice = document.querySelector('#financeMigrationNotice');
    if (financeLedgerReady()) {
      notice?.remove();
      return;
    }
    if (!notice) {
      view.querySelector('.section-head')?.insertAdjacentHTML('afterend', `<div class="system-notice warning" id="financeMigrationNotice">${calendarIcon}<div><b>ต้องติดตั้งฐานข้อมูลรายการรับ–จ่าย</b><span>รันไฟล์ <code>006_finance_transactions_and_documents.sql</code> ใน Supabase SQL Editor หนึ่งครั้ง ส่วนอื่นของระบบยังใช้งานได้ตามปกติ</span></div></div>`);
      notice = document.querySelector('#financeMigrationNotice');
    }
    const button = document.querySelector('#openFinanceTransaction');
    if (button) button.onclick = () => showToast('กรุณารัน Migration 006 ก่อนบันทึกรายการรับ–จ่าย');
  }

  function polishButtons() {
    document.querySelectorAll('button').forEach(button => {
      if (!button.type && !button.closest('form')) button.type = 'button';
      button.classList.add('app-button-ready');
    });
    const meetingButton = document.querySelector('[data-add-project-meeting]');
    if (meetingButton && !meetingButton.querySelector('svg')) meetingButton.innerHTML = `${plusIcon}<span>เพิ่มประชุม / นัดหมาย</span>`;
  }

  function orderedProject(projectId) {
    return projects.find(project => project.id === projectId);
  }

  function normalizeWorkstreamOrder(project) {
    (project?.workstreams || []).forEach((workstream, index) => { workstream.order = index + 1; });
  }

  function ensurePlanOrderField() {
    const form = document.querySelector('#planningForm');
    if (!form || document.querySelector('#planOrderField')) return;
    form.querySelector('.form-row')?.insertAdjacentHTML('afterend', `<label id="planOrderField">ลำดับ<input id="planOrder" type="number" min="1" step="1" required><small>ระบุ 1, 2, 3, 4... ระบบจะแทรกงานและเลื่อนลำดับที่เหลือให้อัตโนมัติ</small></label>`);
  }

  function updatePlanOrderDefault() {
    ensurePlanOrderField();
    const project = orderedProject(document.querySelector('#planProject')?.value);
    const type = document.querySelector('#planType')?.value || 'workstream';
    const parent = project?.workstreams.find(workstream => workstream.id === document.querySelector('#planParent')?.value);
    const count = type === 'checklist' ? (parent?.items?.length || 0) : (project?.workstreams?.length || 0);
    const field = document.querySelector('#planOrder');
    if (field) {
      field.max = String(count + 1);
      field.value = String(count + 1);
    }
    const label = document.querySelector('#planOrderField');
    if (label?.firstChild) label.firstChild.textContent = type === 'checklist' ? 'ลำดับรายละเอียด ' : 'ลำดับงานหลัก ';
  }

  function openPlanningReliably(projectId, type = 'workstream', parentId = '') {
    openPlanning(projectId, type, parentId);
    updatePlanOrderDefault();
    setTimeout(() => document.querySelector('#planTitle')?.focus(), 0);
  }

  async function saveOrderedPlanning(event) {
    event.preventDefault();
    const button = event.submitter || event.target.querySelector('[type="submit"]');
    const project = orderedProject(document.querySelector('#planProject').value);
    const type = document.querySelector('#planType').value;
    const file = document.querySelector('#planFile')?.files[0];
    if (!project) return showToast('ไม่พบโปรเจกต์ที่เลือก');
    const record = {
      id: uid(type),
      title: document.querySelector('#planTitle').value.trim(),
      owner: document.querySelector('#planOwner').value.trim(),
      start: document.querySelector('#planStart').value,
      due: document.querySelector('#planDue').value,
      followUp: document.querySelector('#planFollowUp').value,
      priority: document.querySelector('#planPriority').value,
      note: document.querySelector('#planNote').value.trim(),
      progress: 0,
      link: document.querySelector('#planLink')?.value.trim() || '',
      fileName: '',
      storagePath: ''
    };
    button.disabled = true;
    try {
      if (file && window.LatiteamSupabase) {
        const attachment = await window.LatiteamSupabase.uploadFile(file, project.id);
        record.storagePath = attachment.storagePath;
        record.fileName = attachment.fileName;
        record.link = record.link || attachment.signedUrl;
      }
      if (type === 'workstream') {
        record.items = [];
        const target = Math.max(0, Math.min(project.workstreams.length, Number(document.querySelector('#planOrder').value || project.workstreams.length + 1) - 1));
        project.workstreams.splice(target, 0, record);
        normalizeWorkstreamOrder(project);
      } else {
        const workstream = project.workstreams.find(item => item.id === document.querySelector('#planParent').value);
        if (!workstream) throw new Error('กรุณาเลือกงานหลัก');
        const target = Math.max(0, Math.min(workstream.items.length, Number(document.querySelector('#planOrder').value || workstream.items.length + 1) - 1));
        workstream.items.splice(target, 0, record);
        workstream.items.forEach((item, index) => { item.order = index + 1; });
      }
      recalculateAll();
      save();
      closePlanning();
      event.target.reset();
      renderAll();
      showDetail(project.id);
      showToast(`เพิ่ม${type === 'workstream' ? 'งานหลัก' : 'รายละเอียด'}ลำดับ ${record.order || Number(document.querySelector('#planOrder')?.value || 1)} แล้ว`);
    } catch (error) {
      showToast(error.message);
    } finally {
      button.disabled = false;
    }
  }

  function moveWorkstream(projectId, workstreamId, targetPosition) {
    const project = orderedProject(projectId);
    const from = project?.workstreams.findIndex(workstream => workstream.id === workstreamId) ?? -1;
    if (!project || from < 0) return;
    const to = Math.max(0, Math.min(project.workstreams.length - 1, Number(targetPosition) - 1));
    if (from === to) return;
    const [workstream] = project.workstreams.splice(from, 1);
    project.workstreams.splice(to, 0, workstream);
    normalizeWorkstreamOrder(project);
    recalculateAll();
    save();
    showDetail(projectId);
    showToast(`ย้ายเป็นงานหลักลำดับ ${to + 1} แล้ว`);
  }

  function renderWorkstreamOrderControls(projectId) {
    const project = orderedProject(projectId);
    if (!project) return;
    normalizeWorkstreamOrder(project);
    document.querySelectorAll('#projectDetail .workstream').forEach((root, index) => {
      const workstream = project.workstreams[index];
      const number = root.querySelector('.work-number');
      if (number) number.textContent = String(index + 1).padStart(2, '0');
      const head = root.querySelector('.workstream-head');
      if (!head || head.querySelector('.work-order-editor')) return;
      head.querySelector('.work-title')?.insertAdjacentHTML('beforebegin', `<div class="work-order-editor" title="กำหนดลำดับงานหลัก"><button type="button" data-order-up aria-label="เลื่อนงานขึ้น">${chevronLeft}</button><input type="number" min="1" max="${project.workstreams.length}" value="${index + 1}" aria-label="ลำดับงานหลัก"><button type="button" data-order-down aria-label="เลื่อนงานลง">${chevronRight}</button></div>`);
      const editor = head.querySelector('.work-order-editor');
      editor.onclick = event => event.stopPropagation();
      editor.querySelector('input').onchange = event => moveWorkstream(projectId, workstream.id, event.target.value);
      editor.querySelector('[data-order-up]').onclick = () => moveWorkstream(projectId, workstream.id, index);
      editor.querySelector('[data-order-down]').onclick = () => moveWorkstream(projectId, workstream.id, index + 2);
    });
  }

  ensurePlanOrderField();
  const planningForm = document.querySelector('#planningForm');
  if (planningForm) planningForm.onsubmit = saveOrderedPlanning;
  const planType = document.querySelector('#planType');
  if (planType) {
    const previousTypeChange = planType.onchange;
    planType.onchange = event => { previousTypeChange?.(event); updatePlanOrderDefault(); };
  }
  const planProject = document.querySelector('#planProject');
  if (planProject) {
    const previousProjectChange = planProject.onchange;
    planProject.onchange = event => { previousProjectChange?.(event); updatePlanOrderDefault(); };
  }
  document.addEventListener('click', event => {
    const addMain = event.target.closest('[data-open-planning]');
    const addDetail = event.target.closest('[data-add-checklist]');
    if (!addMain && !addDetail) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (addDetail) openPlanningReliably(addDetail.dataset.projectId, 'checklist', addDetail.dataset.addChecklist);
    else openPlanningReliably(addMain.dataset.projectId, 'workstream');
  }, true);

  const previousRenderAll = renderAll;
  renderAll = function() {
    previousRenderAll();
    renderFinanceMigrationNotice();
    polishButtons();
  };

  const previousShowDetail = showDetail;
  showDetail = function(id) {
    previousShowDetail(id);
    renderWorkstreamOrderControls(id);
    polishButtons();
  };
  planningShowDetail = showDetail;

  const observer = new MutationObserver(() => polishButtons());
  observer.observe(document.body, {childList: true, subtree: true});
  polishButtons();
  renderFinanceMigrationNotice();
  if (document.querySelector(`#${dashboardCalendarRootId}`)) renderMonthBoard(dashboardCalendarRootId);
})();
