(() => {
  const config = window.LATITEAM_CLOUD_CONFIG || {};
  const endpointKey = 'latiteam-cloud-endpoint';
  const sessionKey = 'latiteam-session-token';
  const userKey = 'latiteam-session-user';
  let endpoint = localStorage.getItem(endpointKey) || config.endpoint || '';
  let sessionToken = localStorage.getItem(sessionKey) || '';
  let sessionUser = JSON.parse(localStorage.getItem(userKey) || 'null');
  let cloudUsers = [];
  let saveTimer = null;
  let syncing = false;

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
            <label class="endpoint-field">Google Apps Script Web App URL<input id="loginEndpoint" type="url" value="${endpoint}" placeholder="https://script.google.com/macros/s/.../exec" required></label>
            <div class="login-error" id="loginError"></div>
            <button class="primary login-submit" type="submit">เข้าสู่ระบบ</button>
          </form>
          <small class="login-security">รหัสผ่านถูกตรวจสอบด้วย Hash และจะไม่ถูกบันทึกไว้ใน Browser</small>
        </div>
      </section>
      <button id="cloudSyncBadge" class="cloud-user-badge" type="button" hidden></button>
      <div class="modal-backdrop" id="createUserModal"><div class="modal wide-modal"><div class="modal-head"><div><span class="eyebrow">ADMIN USER MANAGEMENT</span><h2>สร้างผู้ใช้งาน</h2></div><button type="button" class="close-create-user">×</button></div><form id="createUserForm"><div class="form-row"><label>ชื่อผู้ใช้<input id="newUsername" required pattern="[a-z0-9._-]{3,40}" placeholder="เช่น jmt_sak"></label><label>ชื่อที่แสดง<input id="newDisplayName" required placeholder="ชื่อผู้ใช้งาน"></label></div><div class="form-row"><label>รหัสผ่านชั่วคราว<input id="newPassword" type="password" minlength="8" required></label><label>Role<select id="newRole"><option value="team">ทีมงาน</option><option value="manager">ผู้จัดการโครงการ</option><option value="executive">ผู้บริหาร</option><option value="accounting">ฝ่ายบัญชี</option><option value="admin">ผู้ดูแลระบบ</option></select></label></div><div class="user-project-pickers"><fieldset><legend>โปรเจคที่มองเห็น</legend><div id="newAllowedProjects"></div></fieldset><fieldset><legend>โปรเจคที่เห็นข้อมูลเงิน</legend><div id="newFinanceProjects"></div></fieldset></div><label class="checkbox-line"><input id="newCanEdit" type="checkbox"> อนุญาตให้แก้ไขและอัปเดตงาน</label><div class="login-error" id="createUserError"></div><div class="modal-actions"><button type="button" class="secondary close-create-user">ยกเลิก</button><button class="primary" type="submit">สร้างผู้ใช้</button></div></form></div></div>
    `);
    document.querySelector('#loginForm').onsubmit = login;
    document.querySelector('#cloudSyncBadge').onclick = openSessionMenu;
    document.querySelectorAll('.close-create-user').forEach(button => button.onclick = () => document.querySelector('#createUserModal').classList.remove('open'));
    document.querySelector('#createUserForm').onsubmit = createUser;
  }

  async function request(action, payload = {}, requiresSession = true) {
    if (!endpoint) throw new Error('กรุณาระบุ Google Apps Script Web App URL');
    const response = await fetch(endpoint, {method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({...payload,action,...(requiresSession?{sessionToken}:{})})});
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || 'ไม่สามารถเชื่อมต่อระบบได้');
    return result;
  }

  async function login(event) {
    event.preventDefault();
    const error = document.querySelector('#loginError'); error.textContent = '';
    endpoint = document.querySelector('#loginEndpoint').value.trim();
    localStorage.setItem(endpointKey, endpoint);
    const button = event.submitter; button.disabled = true; button.textContent = 'กำลังตรวจสอบ...';
    try {
      const result = await request('login',{username:document.querySelector('#loginUsername').value.trim(),password:document.querySelector('#loginPassword').value},false);
      sessionToken = result.sessionToken; sessionUser = result.user;
      localStorage.setItem(sessionKey,sessionToken);localStorage.setItem(userKey,JSON.stringify(sessionUser));
      if (sessionUser.mustChangePassword) { await forcePasswordChange(); return; }
      await enterApp();
    } catch (loginError) { error.textContent = loginError.message; }
    finally { button.disabled = false; button.textContent = 'เข้าสู่ระบบ'; }
  }

  async function forcePasswordChange() {
    const currentPassword = document.querySelector('#loginPassword').value;
    const newPassword = prompt('เข้าสู่ระบบครั้งแรก กรุณาตั้งรหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร');
    if (!newPassword) throw new Error('ต้องเปลี่ยนรหัสผ่านก่อนเข้าใช้งาน');
    await request('changePassword',{currentPassword,newPassword});
    clearSession();alert('เปลี่ยนรหัสผ่านแล้ว กรุณาเข้าสู่ระบบอีกครั้ง');showLogin();
  }

  async function enterApp() {
    document.body.classList.remove('auth-locked');document.querySelector('#loginScreen').hidden = true;
    const badge=document.querySelector('#cloudSyncBadge');badge.hidden=false;badge.textContent=`${sessionUser.name} · ${roleName(sessionUser.role)}`;
    currentRole=sessionUser.role;const roleSelect=document.querySelector('#roleSelect');if(roleSelect){roleSelect.value=currentRole;roleSelect.disabled=true;roleSelect.closest('label').querySelector('small').textContent='สิทธิ์จากบัญชีผู้ใช้';}
    document.querySelectorAll('.admin-only').forEach(element=>element.classList.toggle('hidden',currentRole!=='admin'));
    document.querySelectorAll('.manager-only').forEach(element=>element.classList.toggle('hidden',!['admin','manager'].includes(currentRole)));
    await pull();
  }

  function showLogin(message='') { document.body.classList.add('auth-locked');document.querySelector('#loginScreen').hidden=false;document.querySelector('#loginError').textContent=message;document.querySelector('#cloudSyncBadge').hidden=true; }
  function clearSession(){sessionToken='';sessionUser=null;localStorage.removeItem(sessionKey);localStorage.removeItem(userKey)}
  async function logout(){try{if(sessionToken)await request('logout')}catch(_){}clearSession();location.reload()}

  function currentSnapshot(){return{schemaVersion:'latiteam-tracking-v3',projects,updates,standaloneEvents:typeof standaloneEvents==='undefined'?[]:standaloneEvents}}
  async function pull(){syncing=true;try{const result=await request('bootstrap');projects=result.data.projects;updates=result.data.updates||[];cloudUsers=result.data.users||[];if(typeof standaloneEvents!=='undefined')standaloneEvents=result.data.standaloneEvents||[];roleConfig.team.projects=projects.map(project=>project.id);localStorage.setItem('latiteam-projects',JSON.stringify(projects));localStorage.setItem('latiteam-updates',JSON.stringify(updates));projectOptions();renderAll();}catch(error){if(/Session/.test(error.message)){clearSession();showLogin(error.message)}else throw error}finally{syncing=false}}
  async function push(){if(!sessionUser?.canEdit&&sessionUser?.role!=='admin')return;syncing=true;try{await request('snapshot',{data:currentSnapshot()});}finally{syncing=false}}
  function schedulePush(){if(!config.autoSave||syncing||!sessionToken||(!sessionUser?.canEdit&&sessionUser?.role!=='admin'))return;clearTimeout(saveTimer);saveTimer=setTimeout(()=>push().catch(error=>showToast(error.message)),1200)}

  function renderCloudUsers(){const root=document.querySelector('#userList');if(!root)return;if(sessionUser?.role!=='admin'){root.innerHTML='<div class="empty-state">เฉพาะ Admin เท่านั้นที่จัดการผู้ใช้ได้</div>';return}const badge=document.querySelector('#accessView .soft-badge');if(badge)badge.textContent=`${cloudUsers.length} คน`;root.innerHTML=`<div class="user-management-head"><p>รหัสผ่านจัดเก็บแบบ Hash พร้อม Salt และผู้ใช้ใหม่ต้องเปลี่ยนรหัสครั้งแรก</p><button class="primary" id="openCreateUser">+ สร้างผู้ใช้</button></div>${cloudUsers.map(user=>`<div class="user-row"><div class="user-info"><span class="avatar">${user.name.slice(0,2)}</span><div><b>${user.name}</b><small>@${user.username} · ${roleName(user.role)}</small></div></div><span class="project-tags">${(user.allowedProjects||[]).join(', ')||'ยังไม่กำหนดโปรเจค'}</span><span class="status-badge ${user.active?'done':'risk'}">${user.active?'ใช้งาน':'ปิด'}</span></div>`).join('')}`;document.querySelector('#openCreateUser').onclick=openCreateUser}
  function openCreateUser(){const projectOptions=projects.map(project=>`<label><input type="checkbox" value="${project.id}"> ${project.name}</label>`).join('');document.querySelector('#newAllowedProjects').innerHTML=projectOptions;document.querySelector('#newFinanceProjects').innerHTML=projectOptions;document.querySelector('#createUserModal').classList.add('open')}
  async function createUser(event){event.preventDefault();const error=document.querySelector('#createUserError');error.textContent='';const checked=id=>[...document.querySelectorAll(`#${id} input:checked`)].map(input=>input.value);try{const result=await request('createUser',{user:{username:document.querySelector('#newUsername').value.trim(),name:document.querySelector('#newDisplayName').value.trim(),password:document.querySelector('#newPassword').value,role:document.querySelector('#newRole').value,allowed_projects:checked('newAllowedProjects'),finance_projects:checked('newFinanceProjects'),can_edit:document.querySelector('#newCanEdit').checked}});cloudUsers.push(result.user);document.querySelector('#createUserModal').classList.remove('open');event.target.reset();renderCloudUsers();showToast('สร้างผู้ใช้แล้ว')}catch(createError){error.textContent=createError.message}}
  function roleName(role){return({admin:'ผู้ดูแลระบบ',executive:'ผู้บริหาร',manager:'ผู้จัดการโครงการ',team:'ทีมงาน',accounting:'ฝ่ายบัญชี'})[role]||role}
  async function openSessionMenu(){const action=prompt(`${sessionUser.name}\nพิมพ์ “ดึง”, “ส่ง”, “ออก”, หรือ “เปลี่ยนรหัส”`,'ดึง');if(action==='ดึง')await pull();else if(action==='ส่ง')await push();else if(action==='ออก')await logout();else if(action==='เปลี่ยนรหัส'){const currentPassword=prompt('รหัสผ่านปัจจุบัน');const newPassword=prompt('รหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร');if(currentPassword&&newPassword){await request('changePassword',{currentPassword,newPassword});await logout()}}}

  window.addEventListener('load',async()=>{installAuthUi();const originalRenderUsers=renderUsers;renderUsers=()=>sessionUser?renderCloudUsers():originalRenderUsers();const localSave=save;save=function(){localSave();schedulePush()};if(endpoint&&sessionToken&&sessionUser){try{await enterApp()}catch(error){clearSession();showLogin(error.message)}}else showLogin()});
  window.LatiteamCloud={pull,push,logout};
})();
