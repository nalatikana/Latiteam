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

  const previousRenderAll = renderAll;
  renderAll = function() {
    previousRenderAll();
    renderFinanceMigrationNotice();
    polishButtons();
  };

  const previousShowDetail = showDetail;
  showDetail = function(id) {
    previousShowDetail(id);
    polishButtons();
  };
  planningShowDetail = showDetail;

  const observer = new MutationObserver(() => polishButtons());
  observer.observe(document.body, {childList: true, subtree: true});
  polishButtons();
  renderFinanceMigrationNotice();
  if (document.querySelector(`#${dashboardCalendarRootId}`)) renderMonthBoard(dashboardCalendarRootId);
})();
