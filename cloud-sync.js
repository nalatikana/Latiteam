(() => {
  const config = window.LATITEAM_CLOUD_CONFIG || {};
  const endpointKey = 'latiteam-cloud-endpoint';
  const sessionKey = 'latiteam-session-token';
  const userKey = 'latiteam-session-user';
  let endpoint = config.endpoint || localStorage.getItem(endpointKey) || '';
  let sessionToken = localStorage.getItem(sessionKey) || '';
  let sessionUser = JSON.parse(localStorage.getItem(userKey) || 'null');
  let cloudUsers = [];
  let saveTimer = null;
  let syncing = false;
  let editingUserId = '';

  function installAuthUi() {
    document.body.classList.add('auth-locked');
    document.body.insertAdjacentHTML('beforeend', `
      <section class="login-screen" id="loginScreen">
        <div class="login-card">
          <div class="login-brand"><span>L</span><div><b>Latiteam</b><small>PROJECT TRACKING</small></div></div>
          <div><span class="eyebrow">SECURE ACCESS</span><h1>เข้าสู่ระบบ</h1><p>ใช้บัญชีที่ Admin สร้างให้เพื่อดูเฉพาะโครงการและข้อมูลที่ได้รับสิทธิ์</p></div>
          <form id="loginForm">
            <label>ชื่อผู้ใช้<input id="loginUsername" autocomplete="username" required placeholder="username"></label>
            <label>รหัสผ่าน<input id="loginPassword" type="password" autocomplete="current-password" required placeholder="อย่างน้อย 8 ตัวอักษร"></label>
            <div class="login-error" id="loginError"></div>
            <button class="primary login-submit" type="submit">เข้าสู่ระบบ</button>
          </form>
          <small class="login-security">รหัสผ่านถูกตรวจสอบด้วย Hash และจะไม่ถูกบันทึกไว้ใน Browser</small>
        </div>
      </section>
      <button id="cloudSyncBadge" class="cloud-user-badge" type="button" hidden></button>
      <button id="cloudLogoutButton" class="cloud-logout-button" type="button" hidden>ออกจากระบบ</button>
      <div id="systemClock" class="system-clock" hidden></div>
      <div id="systemLoading" class="system-loading" hidden><div class="loading-card"><span class="loading-spinner"></span><b id="loadingTitle">กำลังดำเนินการ</b><small id="loadingDetail"></small></div></div>
      <div id="notificationStack" class="notification-stack" aria-live="polite"></div>
      <div class="modal-backdrop" id="createUserModal"><div class="modal wide-modal"><div class="modal-head"><div><span class="eyebrow">ADMIN USER MANAGEMENT</span><h2>สร้างผู้ใช้งาน</h2></div><button type="button" class="close-create-user">×</button></div><form id="createUserForm"><div class="form-row"><label>ชื่อผู้ใช้<input id="newUsername" required pattern="[a-z0-9._-]{3,40}" placeholder="เช่น jmt_sak"></label><label>ชื่อที่แสดง<input id="newDisplayName" required placeholder="ชื่อผู้ใช้งาน"></label></div><div class="form-row"><label>รหัสผ่านชั่วคราว<input id="newPassword" type="password" minlength="8" required></label><label>Role<select id="newRole"><option value="team">ทีมงาน</option><option value="manager">ผู้จัดการโครงการ</option><option value="executive">ผู้บริหาร</option><option value="accounting">ฝ่ายบัญชี</option><option value="admin">ผู้ดูแลระบบ</option></select></label></div><div class="user-project-pickers"><fieldset><legend>โปรเจคที่มองเห็น</legend><div id="newAllowedProjects"></div></fieldset><fieldset><legend>โปรเจคที่เห็นข้อมูลเงิน</legend><div id="newFinanceProjects"></div></fieldset></div><label class="checkbox-line"><input id="newCanEdit" type="checkbox"> อนุญาตให้แก้ไขและอัปเดตงาน</label><div class="login-error" id="createUserError"></div><div class="modal-actions"><button type="button" class="secondary close-create-user">ยกเลิก</button><button class="primary" type="submit">สร้างผู้ใช้</button></div></form></div></div>
    `);
    document.querySelector('#loginForm').onsubmit = login;
    document.querySelector('#cloudSyncBadge').onclick = openSessionMenu;
    document.querySelector('#cloudLogoutButton').onclick = logout;
    document.querySelectorAll('.close-create-user').forEach(button => button.onclick = () => document.querySelector('#createUserModal').classList.remove('open'));
    document.querySelector('#createUserForm').onsubmit = createUser;
    updateClock();setInterval(updateClock,1000);
  }

  function timestamp(){return new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'medium',hour12:false}).format(new Date())}
  function updateClock(){const clock=document.querySelector('#systemClock');if(clock)clock.innerHTML=`<b>${new Intl.DateTimeFormat('th-TH',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date())} น.</b><small>${new Intl.DateTimeFormat('th-TH',{weekday:'short',day:'numeric',month:'short',year:'numeric'}).format(new Date())}</small>`}
  function showLoading(title,detail='กรุณารอสักครู่'){const layer=document.querySelector('#systemLoading');if(!layer)return;document.querySelector('#loadingTitle').textContent=title;document.querySelector('#loadingDetail').textContent=`${detail} · ${timestamp()}`;layer.hidden=false}
  function hideLoading(){const layer=document.querySelector('#systemLoading');if(layer)layer.hidden=true}
  function notify(message,type='success'){const root=document.querySelector('#notificationStack');if(!root)return;const item=document.createElement('div');item.className=`system-notification ${type}`;item.innerHTML=`<b>${type==='error'?'ไม่สำเร็จ':type==='info'?'กำลังดำเนินการ':'ดำเนินการสำเร็จ'}</b><span>${message}</span><small>${timestamp()}</small><button type="button">×</button>`;item.querySelector('button').onclick=()=>item.remove();root.prepend(item);setTimeout(()=>item.remove(),6000)}

  async function request(action, payload = {}, requiresSession = true) {
    if (!endpoint) throw new Error('ระบบยังไม่ได้ตั้งค่าลิงก์ Google Apps Script กรุณาแจ้ง Admin');
    const response = await fetch(endpoint, {method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({...payload,action,...(requiresSession?{sessionToken}:{})})});
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || 'ไม่สามารถเชื่อมต่อระบบได้');
    return result;
  }

  async function login(event) {
    event.preventDefault();
    const error = document.querySelector('#loginError'); error.textContent = '';
    const button = event.submitter; button.disabled = true; button.textContent = 'กำลังตรวจสอบ...';
    showLoading('กำลังเข้าสู่ระบบ','กำลังตรวจสอบบัญชีผู้ใช้และสิทธิ์การเข้าถึง');
    try {
      const result = await request('login',{username:document.querySelector('#loginUsername').value.trim(),password:document.querySelector('#loginPassword').value},false);
      sessionToken = result.sessionToken; sessionUser = result.user;
      localStorage.setItem(sessionKey,sessionToken);localStorage.setItem(userKey,JSON.stringify(sessionUser));
      if (sessionUser.mustChangePassword) { await forcePasswordChange(); return; }
      await enterApp();notify(`ยินดีต้อนรับ ${sessionUser.name}`);
    } catch (loginError) { error.textContent = loginError.message;notify(loginError.message,'error'); }
    finally { hideLoading();button.disabled = false; button.textContent = 'เข้าสู่ระบบ'; }
  }

  async function forcePasswordChange() {
    const currentPassword = document.querySelector('#loginPassword').value;
    const newPassword = prompt('เข้าสู่ระบบครั้งแรก กรุณาตั้งรหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร');
    if (!newPassword) throw new Error('ต้องเปลี่ยนรหัสผ่านก่อนเข้าใช้งาน');
    await request('changePassword',{currentPassword,newPassword});
    clearSession();showLogin();notify('เปลี่ยนรหัสผ่านแล้ว กรุณาเข้าสู่ระบบอีกครั้ง');
  }

  async function enterApp() {
    document.body.classList.remove('auth-locked');document.querySelector('#loginScreen').hidden = true;
    const badge=document.querySelector('#cloudSyncBadge');badge.hidden=false;badge.textContent=`${sessionUser.name} · ${roleName(sessionUser.role)}`;document.querySelector('#cloudLogoutButton').hidden=false;document.querySelector('#systemClock').hidden=false;
    currentRole=sessionUser.role;const roleSelect=document.querySelector('#roleSelect');if(roleSelect){roleSelect.value=currentRole;roleSelect.disabled=true;roleSelect.closest('label').querySelector('small').textContent='สิทธิ์จากบัญชีผู้ใช้';}
    document.querySelectorAll('.admin-only').forEach(element=>element.classList.toggle('hidden',currentRole!=='admin'));
    document.querySelectorAll('.manager-only').forEach(element=>element.classList.toggle('hidden',!['admin','manager'].includes(currentRole)));
    await pull();
  }

  function showLogin(message='') { document.body.classList.add('auth-locked');document.querySelector('#loginScreen').hidden=false;document.querySelector('#loginError').textContent=message;document.querySelector('#cloudSyncBadge').hidden=true;document.querySelector('#cloudLogoutButton').hidden=true;document.querySelector('#systemClock').hidden=true; }
  function clearSession(){sessionToken='';sessionUser=null;localStorage.removeItem(sessionKey);localStorage.removeItem(userKey)}
  async function logout(){showLoading('กำลังออกจากระบบ','กำลังปิด Session อย่างปลอดภัย');try{if(sessionToken)await request('logout')}catch(_){}clearSession();hideLoading();showLogin();notify('ออกจากระบบเรียบร้อยแล้ว')}

  function currentSnapshot(){return{schemaVersion:'latiteam-tracking-v3',projects,updates,standaloneEvents:typeof standaloneEvents==='undefined'?[]:standaloneEvents}}
  function safeDate(value,includeTime=false){if(value==null||value==='')return'';if(typeof value==='number'||/^\d{5}(?:\.\d+)?$/.test(String(value))){const serial=Number(value);const date=new Date(Date.UTC(1899,11,30)+serial*86400000);return includeTime?date.toISOString():date.toISOString().slice(0,10)}const date=new Date(value);if(Number.isNaN(date.getTime()))return'';return includeTime?date.toISOString():date.toISOString().slice(0,10)}
  function normalizeSnapshot(data){const copy=data||{};(copy.projects||[]).forEach(project=>{project.startDate=safeDate(project.startDate);project.deadline=safeDate(project.deadline);(project.workstreams||[]).forEach(stream=>{stream.start=safeDate(stream.start);stream.due=safeDate(stream.due);stream.followUp=safeDate(stream.followUp);(stream.items||[]).forEach(item=>{item.start=safeDate(item.start);item.due=safeDate(item.due);item.followUp=safeDate(item.followUp)})});(project.meetings||[]).forEach(item=>item.date=safeDate(item.date));(project.sourceDocuments||[]).forEach(item=>item.sourceDate=safeDate(item.sourceDate))});(copy.updates||[]).forEach(item=>item.date=safeDate(item.date,true));(copy.standaloneEvents||[]).forEach(item=>item.date=safeDate(item.date));return copy}
  async function pull(){syncing=true;try{const result=await request('bootstrap');const data=normalizeSnapshot(result.data);projects=data.projects||[];updates=data.updates||[];cloudUsers=data.users||[];if(typeof standaloneEvents!=='undefined')standaloneEvents=data.standaloneEvents||[];roleConfig.team.projects=projects.map(project=>project.id);localStorage.setItem('latiteam-projects',JSON.stringify(projects));localStorage.setItem('latiteam-updates',JSON.stringify(updates));projectOptions();renderAll();}catch(error){if(/Session/.test(error.message)){clearSession();showLogin(error.message)}else throw error}finally{syncing=false}}
  async function push(){if(!sessionUser?.canEdit&&sessionUser?.role!=='admin')return;syncing=true;try{await request('snapshot',{data:currentSnapshot()});notify('บันทึกข้อมูลลง Google Sheets แล้ว')}catch(error){notify(error.message,'error');throw error}finally{syncing=false}}
  function schedulePush(){if(!config.autoSave||syncing||!sessionToken||(!sessionUser?.canEdit&&sessionUser?.role!=='admin'))return;clearTimeout(saveTimer);saveTimer=setTimeout(()=>push().catch(error=>showToast(error.message)),1200)}

  function renderCloudUsers(){
    const root=document.querySelector('#userList');if(!root)return;
    if(sessionUser?.role!=='admin'){root.innerHTML='<div class="empty-state">เฉพาะ Admin เท่านั้นที่จัดการผู้ใช้ได้</div>';return}
    const badge=document.querySelector('#accessView .soft-badge');if(badge)badge.textContent=`${cloudUsers.length} คน`;
    root.innerHTML=`<div class="user-management-head"><p>แสดงเฉพาะบัญชีจริงจากชีต Users</p><button class="primary" id="openCreateUser">+ เพิ่มผู้ใช้</button></div>${cloudUsers.length?cloudUsers.map(user=>`<div class="user-row cloud-user-row"><div class="user-info"><span class="avatar">${user.name.slice(0,2)}</span><div><b>${user.name}</b><small>@${user.username} · ${roleName(user.role)}</small></div></div><span class="project-tags">${(user.allowedProjects||[]).join(', ')||'ยังไม่กำหนดโปรเจค'}</span><span class="status-badge ${user.active?'done':'risk'}">${user.active?'ใช้งาน':'ปิด'}</span><div class="user-actions"><button class="secondary edit-cloud-user" data-id="${user.id}">แก้ไข</button>${user.id!==sessionUser.id?`<button class="danger delete-cloud-user" data-id="${user.id}">ลบ</button>`:''}</div></div>`).join(''):'<div class="empty-state">ยังไม่มีผู้ใช้งาน</div>'}`;
    document.querySelector('#openCreateUser').onclick=()=>openUserEditor();
    document.querySelectorAll('.edit-cloud-user').forEach(button=>button.onclick=()=>openUserEditor(button.dataset.id));
    document.querySelectorAll('.delete-cloud-user').forEach(button=>button.onclick=()=>deleteUser(button.dataset.id));
  }
  function renderProjectChecks(targetId,selected=[]){document.querySelector(targetId).innerHTML=projects.map(project=>`<label><input type="checkbox" value="${project.id}" ${selected.includes(project.id)||selected.includes('all')?'checked':''}> ${project.name}</label>`).join('')}
  function openUserEditor(userId=''){
    editingUserId=userId;const user=cloudUsers.find(item=>item.id===userId);const form=document.querySelector('#createUserForm');form.reset();
    document.querySelector('#createUserModal h2').textContent=user?'แก้ไขผู้ใช้งาน':'สร้างผู้ใช้งาน';
    document.querySelector('#newUsername').disabled=Boolean(user);document.querySelector('#newUsername').value=user?.username||'';
    document.querySelector('#newDisplayName').value=user?.name||'';document.querySelector('#newRole').value=user?.role||'team';
    const password=document.querySelector('#newPassword');password.required=!user;password.closest('label').style.display=user?'none':'';
    document.querySelector('#newCanEdit').checked=Boolean(user?.canEdit);renderProjectChecks('#newAllowedProjects',user?.allowedProjects||[]);renderProjectChecks('#newFinanceProjects',user?.financeProjects||[]);
    document.querySelector('#createUserModal').classList.add('open');
  }
  async function createUser(event){
    event.preventDefault();const error=document.querySelector('#createUserError');error.textContent='';const checked=id=>[...document.querySelectorAll(`#${id} input:checked`)].map(input=>input.value);
    const payload={id:editingUserId,username:document.querySelector('#newUsername').value.trim(),name:document.querySelector('#newDisplayName').value.trim(),password:document.querySelector('#newPassword').value,role:document.querySelector('#newRole').value,allowed_projects:checked('newAllowedProjects'),finance_projects:checked('newFinanceProjects'),can_edit:document.querySelector('#newCanEdit').checked,active:editingUserId?(cloudUsers.find(user=>user.id===editingUserId)?.active!==false):true};
    try{const result=await request(editingUserId?'updateUser':'createUser',{user:payload});const index=cloudUsers.findIndex(user=>user.id===result.user.id);if(index>=0)cloudUsers[index]=result.user;else cloudUsers.push(result.user);document.querySelector('#createUserModal').classList.remove('open');editingUserId='';event.target.reset();renderCloudUsers();showToast(index>=0?'แก้ไขผู้ใช้แล้ว':'สร้างผู้ใช้แล้ว')}catch(createError){error.textContent=createError.message}
  }
  async function deleteUser(userId){const user=cloudUsers.find(item=>item.id===userId);if(!user||!confirm(`ลบบัญชี ${user.name} (@${user.username}) ใช่หรือไม่`))return;await request('deleteUser',{userId});cloudUsers=cloudUsers.filter(item=>item.id!==userId);renderCloudUsers();showToast('ลบผู้ใช้แล้ว')}
  function roleName(role){return({admin:'ผู้ดูแลระบบ',executive:'ผู้บริหาร',manager:'ผู้จัดการโครงการ',team:'ทีมงาน',accounting:'ฝ่ายบัญชี'})[role]||role}
  async function openSessionMenu(){const action=prompt(`${sessionUser.name}\nพิมพ์ “ดึง”, “ส่ง”, “ออก”, หรือ “เปลี่ยนรหัส”`,'ดึง');if(action==='ดึง')await pull();else if(action==='ส่ง')await push();else if(action==='ออก')await logout();else if(action==='เปลี่ยนรหัส'){const currentPassword=prompt('รหัสผ่านปัจจุบัน');const newPassword=prompt('รหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร');if(currentPassword&&newPassword){await request('changePassword',{currentPassword,newPassword});await logout()}}}

  const originalRenderUsers=renderUsers;
  renderUsers=()=>sessionUser?renderCloudUsers():originalRenderUsers();
  window.addEventListener('load',async()=>{installAuthUi();window.showToast=message=>notify(message);showToast=window.showToast;const localSave=save;save=function(){localSave();schedulePush()};if(endpoint&&sessionToken&&sessionUser){showLoading('กำลังเปิดระบบ','กำลังโหลดข้อมูลและสิทธิ์ล่าสุด');try{await enterApp();notify(`เข้าสู่ระบบในชื่อ ${sessionUser.name}`)}catch(error){clearSession();showLogin(error.message);notify(error.message,'error')}finally{hideLoading()}}else showLogin()});
  window.LatiteamCloud={pull,push,logout};
})();
