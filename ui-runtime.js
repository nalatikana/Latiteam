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
    const projectEditForm = document.querySelector('#projectEditForm');
    if (projectEditForm) projectEditForm.onsubmit = saveProjectEditReliably;
    const standaloneForm = document.querySelector('#standaloneEventForm');
    if (standaloneForm) standaloneForm.onsubmit = saveEventReliably;
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
    if (typeof populateOwnerSelect === 'function') populateOwnerSelect(document.querySelector('#planOwner'), projectId);
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
    const previousWorkstreams = structuredClone(project.workstreams || []);
    const originalButtonText = button.textContent;
    const record = {
      id: uid(type),
      title: document.querySelector('#planTitle').value.trim(),
      owner: document.querySelector('#planOwner').value || 'ยังไม่ระบุ',
      ownerUserId: document.querySelector('#planOwner').selectedOptions?.[0]?.dataset.userId || '',
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
    button.textContent = 'กำลังบันทึก...';
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
      if (!window.LatiteamSupabase?.saveProject) throw new Error('ยังไม่พบตัวเชื่อมต่อ Supabase กรุณารีเฟรชหน้าแล้วลองใหม่');
      await window.LatiteamSupabase.saveProject(project);
      closePlanning();
      event.target.reset();
      renderAll();
      showDetail(project.id);
      showToast(`เพิ่ม${type === 'workstream' ? 'งานหลัก' : 'รายละเอียด'}ลำดับ ${record.order || Number(document.querySelector('#planOrder')?.value || 1)} แล้ว`);
    } catch (error) {
      project.workstreams = previousWorkstreams;
      recalculateAll();
      save();
      showToast(error.message);
    } finally {
      button.disabled = false;
      button.textContent = originalButtonText;
    }
  }

  async function moveWorkstream(projectId, workstreamId, targetPosition) {
    const project = orderedProject(projectId);
    const from = project?.workstreams.findIndex(workstream => workstream.id === workstreamId) ?? -1;
    if (!project || from < 0) return;
    const to = Math.max(0, Math.min(project.workstreams.length - 1, Number(targetPosition) - 1));
    if (from === to) return;
    const previousWorkstreams = structuredClone(project.workstreams);
    const [workstream] = project.workstreams.splice(from, 1);
    project.workstreams.splice(to, 0, workstream);
    normalizeWorkstreamOrder(project);
    recalculateAll();
    save();
    showDetail(projectId);
    try {
      if (!window.LatiteamSupabase?.saveProject) throw new Error('ยังไม่พบตัวเชื่อมต่อ Supabase');
      await window.LatiteamSupabase.saveProject(project);
      showToast(`ย้ายเป็นงานหลักลำดับ ${to + 1} และบันทึกแล้ว`);
    } catch (error) {
      project.workstreams = previousWorkstreams;
      normalizeWorkstreamOrder(project);
      recalculateAll();
      save();
      showDetail(projectId);
      showToast(`บันทึกลำดับไม่สำเร็จ: ${error.message}`);
    }
  }

  async function saveProjectEditReliably(event) {
    event.preventDefault();
    const button = event.submitter || event.target.querySelector('[type="submit"]');
    const project = orderedProject(document.querySelector('#editProjectId').value);
    if (!project) return;
    const snapshot = structuredClone({name:project.name,desc:project.desc,company:project.company,client:project.client,manager:project.manager,team:project.team,startDate:project.startDate,deadline:project.deadline,status:project.status});
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'กำลังบันทึก...';
    try {
      project.name = document.querySelector('#editProjectName').value.trim();
      project.desc = document.querySelector('#editProjectDesc').value.trim();
      project.company = document.querySelector('#editProjectCompany').value.trim();
      project.client = document.querySelector('#editProjectClient').value.trim();
      project.manager = document.querySelector('#editProjectManager').value.trim();
      project.team = document.querySelector('#editProjectTeam').value.split(',').map(item => item.trim()).filter(Boolean);
      project.startDate = document.querySelector('#editProjectStart').value;
      project.deadline = document.querySelector('#editProjectDeadline').value;
      project.status = document.querySelector('#editProjectStatus').value;
      save();
      await window.LatiteamSupabase.saveProject(project);
      document.querySelector('#projectEditModal').classList.remove('open');
      projectOptions();
      renderAll();
      showDetail(project.id);
      showToast('บันทึกข้อมูลโปรเจกต์ลง Supabase แล้ว');
    } catch (error) {
      Object.assign(project, snapshot);
      save();
      showToast(`บันทึกไม่สำเร็จ: ${error.message}`);
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  async function saveTaskReliably(event) {
    event.preventDefault();
    const button = event.submitter || event.target.querySelector('[type="submit"]');
    const project = orderedProject(document.querySelector('#editProjectId').value);
    const stream = project?.workstreams.find(item => item.id === document.querySelector('#editStreamId').value);
    const item = stream?.items.find(record => record.id === document.querySelector('#editItemId').value);
    if (!item) return;
    const snapshot = structuredClone(project.workstreams);
    const originalText = button.textContent;
    let updateRecord = null;
    let projectSaved = false;
    button.disabled = true;
    button.textContent = 'กำลังบันทึก...';
    try {
      const file = document.querySelector('#editTaskFile')?.files[0];
      if (file) {
        const attachment = await window.LatiteamSupabase.uploadFile(file, project.id);
        item.storagePath = attachment.storagePath;
        item.fileName = attachment.fileName;
        item.link = attachment.signedUrl;
      } else if (document.querySelector('#editTaskLink')) item.link = document.querySelector('#editTaskLink').value.trim();
      const from = Number(item.progress || 0);
      delete stream.reportedProgress;
      item.title = document.querySelector('#editTaskTitle').value.trim();
      item.note = document.querySelector('#editTaskNote').value.trim();
      item.owner = document.querySelector('#editTaskOwner').value;
      item.ownerUserId = document.querySelector('#editTaskOwner').selectedOptions?.[0]?.dataset.userId || '';
      item.due = document.querySelector('#editTaskDue').value;
      item.followUp = document.querySelector('#editTaskFollow').value;
      item.progress = Math.max(0, Math.min(100, Number(document.querySelector('#editTaskProgress').value)));
      item.priority = document.querySelector('#editTaskPriority').value;
      updateRecord = {date:new Date().toISOString(),project:project.id,task:item.title,from,to:item.progress,note:'แก้ไขรายละเอียดงานและผู้รับผิดชอบ',user:document.querySelector('#cloudUserLabel')?.textContent || 'ผู้ใช้งาน'};
      updates.unshift(updateRecord);
      recalculateAll();
      save();
      await window.LatiteamSupabase.saveProject(project);
      projectSaved = true;
      await window.LatiteamSupabase.saveUpdate(updateRecord);
      document.querySelector('#editTaskModal').classList.remove('open');
      renderAll();
      showDetail(project.id);
      showToast('บันทึกงานลง Supabase แล้ว');
    } catch (error) {
      if (!projectSaved) {
        project.workstreams = snapshot;
        if (updateRecord) updates = updates.filter(record => record !== updateRecord);
        recalculateAll();
        save();
        showToast(`บันทึกไม่สำเร็จ: ${error.message}`);
      } else {
        document.querySelector('#editTaskModal').classList.remove('open');
        renderAll();
        showDetail(project.id);
        showToast(`บันทึกงานแล้ว แต่บันทึกประวัติไม่สำเร็จ: ${error.message}`);
      }
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  async function saveProgressReliably(event) {
    event.preventDefault();
    const button = event.submitter || event.target.querySelector('[type="submit"]');
    const project = orderedProject(document.querySelector('#updateProject').value);
    if (!project) return;
    const snapshot = structuredClone({tasks:project.tasks,progress:project.progress,status:project.status});
    const originalText = button.textContent;
    let updateRecord = null;
    let projectSaved = false;
    button.disabled = true;
    button.textContent = 'กำลังบันทึก...';
    try {
      const task = document.querySelector('#updateTask').value.trim();
      const to = Number(document.querySelector('#updateProgress').value);
      const existing = project.tasks.find(item => item[0] === task);
      const from = existing ? existing[1] : project.progress;
      const file = document.querySelector('#updateFile')?.files[0];
      const attachment = file ? await window.LatiteamSupabase.uploadFile(file, project.id) : {};
      if (existing) existing[1] = to; else project.tasks.push([task, to, document.querySelector('#cloudUserLabel')?.textContent || 'ผู้ใช้งาน']);
      project.progress = Math.round(project.tasks.reduce((sum, item) => sum + item[1], 0) / (project.tasks.length || 1));
      project.status = document.querySelector('#updateStatus').value;
      updateRecord = {date:new Date().toISOString(),project:project.id,task,from,to,note:document.querySelector('#updateNote').value.trim(),user:document.querySelector('#cloudUserLabel')?.textContent || 'ผู้ใช้งาน',link:document.querySelector('#updateLink')?.value.trim() || attachment.signedUrl || '',fileName:attachment.fileName || '',storagePath:attachment.storagePath || ''};
      updates.unshift(updateRecord);
      save();
      await window.LatiteamSupabase.saveProject(project);
      projectSaved = true;
      await window.LatiteamSupabase.saveUpdate(updateRecord);
      renderAll();
      closeUpdate();
      event.target.reset();
      showToast('บันทึกความคืบหน้าลง Supabase แล้ว');
    } catch (error) {
      if (!projectSaved) {
        Object.assign(project, snapshot);
        if (updateRecord) updates = updates.filter(record => record !== updateRecord);
        save();
        showToast(`บันทึกไม่สำเร็จ: ${error.message}`);
      } else {
        renderAll();
        closeUpdate();
        showToast(`บันทึก Progress แล้ว แต่บันทึกประวัติไม่สำเร็จ: ${error.message}`);
      }
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  async function saveEventReliably(event) {
    event.preventDefault();
    const button = event.submitter || event.target.querySelector('[type="submit"]');
    const originalText = button.textContent;
    let record = null;
    button.disabled = true;
    button.textContent = 'กำลังบันทึก...';
    try {
      const projectId = document.querySelector('#standaloneProject').value;
      const file = document.querySelector('#standaloneFile').files[0];
      const attachment = file ? await window.LatiteamSupabase.uploadFile(file, projectId || 'general') : {};
      record = {id:uid('event'),title:document.querySelector('#standaloneTitle').value.trim(),date:document.querySelector('#standaloneDate').value,time:document.querySelector('#standaloneTime').value,owner:document.querySelector('#standaloneOwner').value||'ยังไม่ระบุ',ownerUserId:document.querySelector('#standaloneOwner').selectedOptions?.[0]?.dataset.userId||'',type:projectId?document.querySelector('#standaloneType').value:'general',projectId,note:document.querySelector('#standaloneNote').value.trim(),link:document.querySelector('#standaloneLink').value.trim() || attachment.signedUrl || '',fileName:attachment.fileName || '',storagePath:attachment.storagePath || ''};
      standaloneEvents.push(record);
      saveStandaloneEvents();
      await window.LatiteamSupabase.saveEvent(record);
      document.querySelector('#standaloneEventModal').classList.remove('open');
      event.target.reset();
      document.querySelector('#standaloneDate').value = planningToday;
      renderAll();
      showToast('บันทึกนัดหมายลง Supabase แล้ว');
    } catch (error) {
      if (record) standaloneEvents = standaloneEvents.filter(item => item !== record);
      saveStandaloneEvents();
      showToast(`บันทึกไม่สำเร็จ: ${error.message}`);
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  async function persistInlineProgress(target, toggle = false) {
    const project = orderedProject(target.dataset.projectId);
    const stream = project?.workstreams.find(item => item.id === target.dataset.streamId);
    const itemId = toggle ? target.dataset.toggleItem : target.dataset.progressItem;
    const item = stream?.items.find(record => record.id === itemId);
    if (!item) return;
    const snapshot = structuredClone(project.workstreams);
    try {
      delete stream.reportedProgress;
      item.progress = toggle ? (item.progress === 100 ? 0 : 100) : Math.max(0, Math.min(100, Number(target.value)));
      recalculateAll();
      save();
      showDetail(project.id);
      await window.LatiteamSupabase.saveProject(project);
      showToast('บันทึก Progress ลง Supabase แล้ว');
    } catch (error) {
      project.workstreams = snapshot;
      recalculateAll();
      save();
      showDetail(project.id);
      showToast(`บันทึกไม่สำเร็จ: ${error.message}`);
    }
  }

  async function createProjectReliably(event) {
    event.preventDefault();
    const button = event.submitter || event.target.querySelector('[type="submit"]');
    const name = document.querySelector('#newProjectName').value.trim();
    const projectId = slugifyProject(name);
    if (projects.some(project => project.id === projectId)) return showToast('มีโปรเจกต์ชื่อนี้แล้ว กรุณาใช้ชื่ออื่น');
    const templateKey = document.querySelector('#newProjectTemplate').value;
    const start = document.querySelector('#newProjectStart').value;
    const manager = document.querySelector('#newProjectManager').value.trim();
    const project = {id:projectId,name,company:document.querySelector('#newProjectCompany').value.trim(),client:document.querySelector('#newProjectClient').value.trim(),desc:document.querySelector('#newProjectDesc').value.trim() || projectTemplateCatalog[templateKey].desc,progress:0,status:'active',deadline:document.querySelector('#newProjectDeadline').value,value:Number(document.querySelector('#newProjectValue').value || 0),cost:Number(document.querySelector('#newProjectCost').value || 0),wht:Number(document.querySelector('#newProjectWht').value || 3),paid:'รอบันทึกสถานะชำระเงิน',color:['#315bea','#19a8b8','#8a5cf6','#38c58b','#ff9f43'][projects.length % 5],manager,team:[manager.slice(0,2) || 'PM'],tasks:[],permissions:{view:['admin','executive','manager','accounting'],finance:['admin','accounting'],edit:['admin','manager']}};
    project.workstreams = makeTemplateWorkstreams(templateKey, start, manager);
    project.meetings = makeTemplateMeetings(project, start);
    normalizeWorkstreamOrder(project);
    const originalText = button.textContent;
    let projectSaved = false;
    button.disabled = true;
    button.textContent = 'กำลังสร้างโปรเจกต์...';
    projects.push(project);
    recalculateAll();
    save();
    try {
      await window.LatiteamSupabase.saveProject(project);
      projectSaved = true;
      await window.LatiteamSupabase.saveFinance(project);
      closeTemplateModal();
      event.target.reset();
      document.querySelector('#newProjectStart').value = planningToday;
      document.querySelector('#newProjectDeadline').value = addDays(planningToday, 30);
      projectOptions();
      renderAll();
      showDetail(project.id);
      showToast('สร้างโปรเจกต์และบันทึกลง Supabase แล้ว');
    } catch (error) {
      if (!projectSaved) projects = projects.filter(item => item !== project);
      save();
      renderAll();
      showToast(`${projectSaved ? 'สร้างโปรเจกต์แล้ว แต่ข้อมูลการเงินยังไม่สำเร็จ' : 'สร้างโปรเจกต์ไม่สำเร็จ'}: ${error.message}`);
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
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
  createProjectFromTemplate = createProjectReliably;
  const templateForm = document.querySelector('#projectTemplateForm');
  if (templateForm) templateForm.onsubmit = createProjectReliably;
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
  saveProjectEdit = saveProjectEditReliably;
  saveEditedTaskWithAttachment = saveTaskReliably;
  saveStandaloneEvent = saveEventReliably;
  const updateForm = document.querySelector('#updateForm');
  if (updateForm) updateForm.onsubmit = saveProgressReliably;
  const existingProjectEditForm = document.querySelector('#projectEditForm');
  if (existingProjectEditForm) existingProjectEditForm.onsubmit = saveProjectEditReliably;
  const existingStandaloneForm = document.querySelector('#standaloneEventForm');
  if (existingStandaloneForm) existingStandaloneForm.onsubmit = saveEventReliably;
  document.addEventListener('click', event => {
    const toggle = event.target.closest('[data-toggle-item]');
    if (!toggle) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    persistInlineProgress(toggle, true);
  }, true);
  document.addEventListener('change', event => {
    const progress = event.target.closest('[data-progress-item]');
    if (!progress) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    persistInlineProgress(progress, false);
  }, true);
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
