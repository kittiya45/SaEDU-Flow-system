/* ─── บัญชีของฉัน ───
   เมนูผู้ใช้มุมล่างซ้าย (โปรไฟล์ / ตั้งค่า / ออกจากระบบ — ลายเซ็นอยู่ที่เมนูข้างแล้ว ไม่ซ้ำในนี้)
   หน้า "โปรไฟล์" (view 'acct') — รูปโปรไฟล์ + อีเมลรับแจ้งเตือน + เบอร์โทร (supabase/58_user_profile_fields.sql)
   หน้า "ตั้งค่าบัญชี" (view 'set') — เปลี่ยนรหัสผ่าน, ยืนยันตัวตนสองขั้นตอน (TOTP ของ Supabase Auth), ออกจากระบบทุกอุปกรณ์
   _mfaGate() ถูกเรียกจาก _enterAppAsUser (auth.js) ทั้งตอน login และตอน restore session

   หมายเหตุ 2FA: เป็นด่านฝั่ง UI — RLS ยังไม่บังคับ aal2 ผู้ที่มีรหัสผ่านและเรียก REST ตรงยังผ่านได้
   ถ้าจะบังคับจริงต้องเพิ่ม (auth.jwt()->>'aal') ใน policy สำหรับผู้ใช้ที่มี factor แล้ว */

/* ── รูปโปรไฟล์ ── */
var _PERSON_SVG='<svg width="18" height="18" viewBox="0 0 16 16" fill="none">'+
  '<circle cx="8" cy="5.5" r="2.8" fill="rgba(255,255,255,0.95)"/>'+
  '<path d="M2.5 15c0-3.04 2.46-5.5 5.5-5.5s5.5 2.46 5.5 5.5" fill="rgba(255,255,255,0.85)" stroke="none"/>'+
  '</svg>';

/* path รูปอยู่ใน bucket ส่วนตัว user-signatures (โฟลเดอร์ของเราเอง) — ต้องขอ signed URL
   resolveUserSigPath แคช URL ต่อ path ให้แล้ว และ path เปลี่ยนทุกครั้งที่อัปโหลดใหม่ จึงไม่ติดรูปเก่า */
async function _myAvatarUrl(){
  if(!CU||!CU.avatar_path) return null;
  try{return await resolveUserSigPath(CU.avatar_path,3600)}catch(e){return null}
}
function _avatarImg(url){
  return '<img src="'+esc(url)+'" alt="" class="av-img">';
}
/* เติมรูปลงทุกช่อง [data-avatar-slot] หลัง render — ไม่มีรูปก็ปล่อย fallback เดิมไว้ */
async function _hydrateAvatars(){
  var slots=document.querySelectorAll('[data-avatar-slot]');
  if(!slots.length) return;
  var url=await _myAvatarUrl();
  slots.forEach(function(s){
    if(url) s.innerHTML=_avatarImg(url);
    else if(s.dataset.avatarSlot==='side') s.innerHTML=_PERSON_SVG;
  });
}

/* ย่อ + crop กลางเป็นสี่เหลี่ยมจัตุรัส JPEG — รูปจากมือถือ 4–8 MB เหลือ ~20 kB */
async function _avatarSquare(file,size){
  var src;
  if(typeof createImageBitmap==='function'){
    src=await createImageBitmap(file);
  } else {
    var dataUrl=await new Promise(function(res,rej){var fr=new FileReader();fr.onload=function(){res(fr.result)};fr.onerror=rej;fr.readAsDataURL(file)});
    src=await new Promise(function(res,rej){var im=new Image();im.onload=function(){res(im)};im.onerror=function(){rej(new Error('อ่านรูปไม่ได้'))};im.src=dataUrl});
  }
  var w=src.width,h=src.height,s=Math.min(w,h);
  if(!s) throw new Error('อ่านรูปไม่ได้');
  var c=document.createElement('canvas');c.width=size;c.height=size;
  var ctx=c.getContext('2d');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,size,size); // PNG โปร่งใส → พื้นขาว (JPEG ไม่มี alpha)
  ctx.drawImage(src,(w-s)/2,(h-s)/2,s,s,0,0,size,size);
  if(src.close) try{src.close()}catch(e){}
  return await new Promise(function(res,rej){c.toBlob(function(b){b?res(b):rej(new Error('แปลงรูปไม่สำเร็จ'))},'image/jpeg',0.86)});
}

/* ── เมนูผู้ใช้ (popover เหนือการ์ดชื่อมุมล่างซ้าย) ──
   sidebar มี overflow-y:auto จึงใช้ position:fixed คำนวณจากตำแหน่งการ์ด (แบบเดียวกับ toggleAM ใน admin.js) */
function toggleUserMenu(){
  if($e('umenu')){_closeUserMenu();return}
  var foot=document.querySelector('.app-foot');if(!foot) return;
  var r=foot.getBoundingClientRect();
  var m=document.createElement('div');
  m.id='umenu';m.className='umenu';m.setAttribute('role','menu');
  var it=function(view,ico,label){
    return '<button type="button" class="umenu-it'+(CV===view?' on':'')+'" role="menuitem" data-action="nav" data-view="'+view+'">'+svg(ico,16)+'<span>'+label+'</span></button>';
  };
  m.innerHTML=
    '<div class="umenu-who"><div class="umenu-name">'+esc(CU.full_name||'')+'</div><div class="umenu-mail">'+esc(CU.email||'')+'</div></div>'+
    it('acct','user','โปรไฟล์')+
    it('set','gear','ตั้งค่าบัญชี')+
    '<div class="umenu-sep"></div>'+
    '<button type="button" class="umenu-it umenu-out" role="menuitem" data-action="logout">'+svg('out',16)+'<span>ออกจากระบบ</span></button>';
  document.body.appendChild(m);
  var w=Math.max(232,Math.min(r.width-16,280));
  m.style.width=w+'px';
  m.style.left=Math.max(8,Math.min(r.left+8,window.innerWidth-w-8))+'px';
  m.style.bottom=(window.innerHeight-r.top+6)+'px';
  foot.setAttribute('aria-expanded','true');
  // คลิกรายการ → ปิดเมนูหลังตัว delegated handler ใน events.js ทำงานแล้ว
  m.addEventListener('click',function(ev){if(ev.target.closest('[data-action]'))setTimeout(_closeUserMenu,0)});
  setTimeout(function(){
    document.addEventListener('click',_umenuOutside,true);
    document.addEventListener('keydown',_umenuKey,true);
  },0);
  var first=m.querySelector('.umenu-it');if(first)first.focus();
}
function _umenuOutside(e){
  var m=$e('umenu'),f=document.querySelector('.app-foot');
  if(m&&!m.contains(e.target)&&!(f&&f.contains(e.target))) _closeUserMenu();
}
function _umenuKey(e){
  if(e.key==='Escape'){_closeUserMenu();var f=document.querySelector('.app-foot');if(f)f.focus();return}
  if(e.key!=='ArrowDown'&&e.key!=='ArrowUp') return;
  var its=[].slice.call(document.querySelectorAll('#umenu .umenu-it'));if(!its.length) return;
  e.preventDefault();
  var i=its.indexOf(document.activeElement);
  its[(i+(e.key==='ArrowDown'?1:-1)+its.length)%its.length].focus();
}
function _closeUserMenu(){
  var m=$e('umenu');if(m)m.remove();
  var f=document.querySelector('.app-foot');if(f)f.setAttribute('aria-expanded','false');
  document.removeEventListener('click',_umenuOutside,true);
  document.removeEventListener('keydown',_umenuKey,true);
}

/* ═══════════ หน้าโปรไฟล์ ═══════════ */
var _acctEditing=false;

function _acctRow(k,v,cls){
  return '<div class="kv-row"><div class="kv-k">'+k+'</div><div class="kv-v'+(cls?' '+cls:'')+'">'+v+'</div></div>';
}
function _acctDash(){return '<span class="kv-empty">—</span>'}

function _rAcctInfo(){
  var u=CU||{};
  var phoneV,mailV;
  if(_acctEditing){
    mailV='<input id="acct-cemail" class="fi kv-input" type="email" autocomplete="email" value="'+esc(u.contact_email||'')+'" placeholder="เว้นว่าง = ใช้อีเมลเข้าสู่ระบบ">';
    phoneV='<input id="acct-phone" class="fi kv-input" type="tel" autocomplete="tel" inputmode="tel" maxlength="20" value="'+esc(u.phone||'')+'" placeholder="เช่น 081-234-5678">';
  } else {
    mailV=u.contact_email?esc(u.contact_email):'<span class="kv-empty">ใช้อีเมลเข้าสู่ระบบ</span>';
    phoneV=u.phone?esc(u.phone):_acctDash();
  }
  var g1=
    _acctRow('ชื่อ-นามสกุล',esc(u.full_name||'')||_acctDash())+
    _acctRow('อีเมลเข้าสู่ระบบ',esc(u.email||'')||_acctDash())+
    _acctRow('อีเมลรับแจ้งเตือน',mailV)+
    _acctRow('เบอร์โทร',phoneV);

  var exp='';
  if(u.expires_at){
    var _d=new Date(u.expires_at);
    exp=_d.toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'});
  }
  var line=u.line_user_id
    ?'<span class="kv-ok">เชื่อมต่อแล้ว</span> <button type="button" class="kv-link" data-action="showLineLink">จัดการ</button>'
    :'<span class="kv-empty">ยังไม่เชื่อมต่อ</span> <button type="button" class="kv-link" data-action="showLineLink">เชื่อมต่อ LINE</button>';
  var g2=
    _acctRow('บทบาท',esc(RTH[u.role_code]||u.role_code||'')||_acctDash())+
    (u.position_code?_acctRow('ตำแหน่ง',esc((typeof PTH!=='undefined'&&PTH[u.position_code])||u.position_code)):'')+
    _acctRow('หน่วยงาน / ชมรม',esc(u.department||'')||_acctDash())+
    (u.student_id?_acctRow('รหัสนิสิต',esc(u.student_id)):'')+
    (exp?_acctRow('บัญชีใช้ได้ถึง',esc(exp)):'')+
    _acctRow('แจ้งเตือนทาง LINE',line);

  var foot=_acctEditing
    ?'<div class="acct-actions"><button type="button" class="btn btn-soft" data-action="acctEdit" data-act="cancel">ยกเลิก</button>'+
      '<button type="button" class="btn btn-primary" data-action="acctSave" id="acct-save">'+svg('save',14)+' บันทึก</button></div>'
    :'';
  return '<div id="acct-alert"></div>'+
    '<div class="kv-list">'+g1+'</div>'+foot+
    '<div class="kv-title">ข้อมูลในระบบ</div>'+
    '<div class="kv-list">'+g2+'</div>'+
    '<p class="acct-note">ชื่อ บทบาท ตำแหน่ง และหน่วยงาน แก้ไขได้โดยเจ้าหน้าที่หรือผู้ดูแลระบบเท่านั้น</p>';
}

function _rAcctPhoto(url){
  var u=CU||{};
  var grad=(typeof _ROLE_GRAD!=='undefined'&&_ROLE_GRAD[u.role_code])||'linear-gradient(135deg,#5C534A,#6B6157)';
  return '<div class="kv-title" style="margin-top:0">รูปโปรไฟล์</div>'+
    '<div class="acct-photo-row">'+
      '<div class="acct-av" style="background:'+grad+'">'+(url?_avatarImg(url):'<span class="acct-av-ini">'+esc(_initials(u.full_name))+'</span>')+'</div>'+
      '<div style="min-width:0">'+
        '<div class="acct-av-name">'+esc(u.full_name||'')+'</div>'+
        '<div class="acct-av-role">'+esc(RTH[u.role_code]||'')+'</div>'+
      '</div>'+
    '</div>'+
    '<div class="acct-photo-btns">'+
      '<label class="btn btn-soft sm" for="acct-av-file">'+svg('up',13)+' '+(url?'เปลี่ยนรูป':'อัปโหลดรูป')+'</label>'+
      (u.avatar_path?'<button type="button" class="btn btn-soft sm" data-action="acctAvatarDel">'+svg('trash',13)+' ลบรูป</button>':'')+
    '</div>'+
    '<input type="file" id="acct-av-file" accept="image/png,image/jpeg,image/webp" class="hidden" onchange="acctPickAvatar(this)">'+
    '<p class="acct-hint">JPG, PNG หรือ WebP ไม่เกิน 5 MB · ระบบครอปตรงกลางเป็นสี่เหลี่ยมจัตุรัสให้อัตโนมัติ</p>'+
    '<div id="acct-av-alert"></div>';
}
function _initials(name){
  var p=String(name||'').trim().split(/\s+/).filter(Boolean);
  if(!p.length) return '?';
  return (p[0].charAt(0)+(p[1]?p[1].charAt(0):'')).toUpperCase();
}

async function vAcct(){
  _acctEditing=false;
  var url=await _myAvatarUrl();
  var warn='';
  // @gnk.student = อีเมลตัวยึดของบัญชี กนค. ที่ไม่มีอีเมลจริง — ส่งอีเมลไม่ถึง (เกณฑ์เดียวกับ _okEmail ใน notif.js)
  var _em=CU.contact_email||CU.email||'';
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(_em)||/@gnk\.student$/i.test(_em)){
    warn='<div class="al al-wa" style="margin-bottom:16px"><span class="al-icon">'+svg('warn',13)+'</span><span>ยังไม่มีอีเมลที่ใช้รับแจ้งเตือนได้ — กด <strong>แก้ไข</strong> แล้วใส่ <strong>อีเมลรับแจ้งเตือน</strong> เพื่อไม่ให้พลาดเอกสารที่ถึงคิวคุณ</span></div>';
  }
  return warn+
    '<div class="card">'+
      '<div class="card-head acct-head">'+
        '<div class="acct-head-ic">'+svg('user',16)+'</div>'+
        '<div style="flex:1;min-width:0"><div class="card-head-title">ข้อมูลส่วนตัว</div><div class="acct-head-sub">ข้อมูลติดต่อและช่องทางรับแจ้งเตือนของคุณ</div></div>'+
        '<button type="button" class="btn btn-soft sm" id="acct-edit-btn" data-action="acctEdit">'+svg('edit',13)+' แก้ไข</button>'+
      '</div>'+
      '<div class="card-body acct-grid">'+
        '<div class="acct-photo" id="acct-photo">'+_rAcctPhoto(url)+'</div>'+
        '<div id="acct-info">'+_rAcctInfo()+'</div>'+
      '</div>'+
    '</div>';
}

function acctEdit(mode){
  _acctEditing=mode!=='cancel';
  var box=$e('acct-info');if(box)box.innerHTML=_rAcctInfo();
  var b=$e('acct-edit-btn');if(b)b.style.visibility=_acctEditing?'hidden':'';
  if(_acctEditing){var f=$e('acct-cemail');if(f)f.focus()}
}

async function acctSave(){
  var em=(gv('acct-cemail')||'').trim(), ph=(gv('acct-phone')||'').trim();
  var al=$e('acct-alert');
  if(em&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)){if(al)al.innerHTML=alrtH('er','รูปแบบอีเมลไม่ถูกต้อง');return}
  if(ph&&!/^[0-9+\-\s().]{6,20}$/.test(ph)){if(al)al.innerHTML=alrtH('er','เบอร์โทรใช้ได้เฉพาะตัวเลข เว้นวรรค และเครื่องหมาย + - ( )');return}
  var btn=$e('acct-save');if(btn){btn.disabled=true;btn.innerHTML='<span class="sp"></span> กำลังบันทึก…'}
  try{
    await dpa('users',CU.id,{contact_email:em||null,phone:ph||null});
    CU.contact_email=em||null;CU.phone=ph||null;
    _acctEditing=false;
    var box=$e('acct-info');if(box)box.innerHTML=_rAcctInfo();
    var b=$e('acct-edit-btn');if(b)b.style.visibility='';
    var al2=$e('acct-alert');if(al2)al2.innerHTML=alrtH('ok','บันทึกแล้ว');
  }catch(e){
    var msg=String(e&&e.message||e);
    if(/phone/.test(msg)&&/column|schema/i.test(msg)) msg='ฐานข้อมูลยังไม่มีคอลัมน์เบอร์โทร — ให้ผู้ดูแลรัน supabase/58_user_profile_fields.sql';
    if(al)al.innerHTML=alrtH('er','บันทึกไม่สำเร็จ: '+msg);
    if(btn){btn.disabled=false;btn.innerHTML=svg('save',14)+' บันทึก'}
  }
}

async function acctPickAvatar(inp){
  var f=inp&&inp.files&&inp.files[0];
  if(inp) inp.value='';
  if(!f) return;
  var al=$e('acct-av-alert');
  if(!/^image\/(png|jpe?g|webp)$/i.test(f.type)){if(al)al.innerHTML=alrtH('er','รองรับเฉพาะไฟล์ JPG, PNG หรือ WebP');return}
  if(f.size>5*1024*1024){if(al)al.innerHTML=alrtH('er','ไฟล์ใหญ่เกิน 5 MB');return}
  if(al)al.innerHTML='<div class="al al-busy"><span class="sp sp-dark"></span><span>กำลังอัปโหลดรูป…</span></div>';
  var newPath=null,uploaded=false;
  try{
    var blob=await _avatarSquare(f,256);
    // path ใหม่ทุกครั้ง — ห้ามเขียนทับ path เดิม (signed URL ที่แคชไว้จะคืนรูปเก่าเป็นชั่วโมง)
    newPath=CU.id+'/avatar-'+Date.now()+'.jpg';
    var enc=newPath.split('/').map(encodeURIComponent).join('/');
    var r=await fetch(SU+'/storage/v1/object/'+USER_SIG_BUCKET+'/'+enc,{
      method:'POST',
      headers:{apikey:SK,Authorization:H.Authorization,'cache-control':'no-store','Content-Type':'image/jpeg'},
      body:blob
    });
    if(!r.ok){var j=await r.json().catch(function(){return{}});throw new Error((j&&j.message)||('อัปโหลดไม่สำเร็จ ('+r.status+')'))}
    uploaded=true;
    var old=CU.avatar_path;
    await dpa('users',CU.id,{avatar_path:newPath});
    CU.avatar_path=newPath;
    if(old&&old!==newPath) deleteUserSigStorage(old);
    var url=await _myAvatarUrl();
    var ph=$e('acct-photo');if(ph)ph.innerHTML=_rAcctPhoto(url);
    var al2=$e('acct-av-alert');if(al2)al2.innerHTML=alrtH('ok','อัปเดตรูปโปรไฟล์แล้ว');
    _hydrateAvatars();
  }catch(e){
    if(uploaded&&newPath&&CU.avatar_path!==newPath) deleteUserSigStorage(newPath); // อัปขึ้นแล้วแต่บันทึกลง users ไม่ได้ — อย่าทิ้งไฟล์กำพร้า
    var msg=String(e&&e.message||e);
    if(/avatar_path/.test(msg)) msg='ฐานข้อมูลยังไม่มีคอลัมน์รูปโปรไฟล์ — ให้ผู้ดูแลรัน supabase/58_user_profile_fields.sql';
    var al3=$e('acct-av-alert');if(al3)al3.innerHTML=alrtH('er','อัปเดตรูปไม่สำเร็จ: '+msg);
  }
}

function acctAvatarDel(){
  showConfirm('ลบรูปโปรไฟล์','ลบรูปโปรไฟล์ของคุณ? ระบบจะกลับไปแสดงไอคอนเริ่มต้น',async function(){
    var old=CU.avatar_path;
    try{
      await dpa('users',CU.id,{avatar_path:null});
      CU.avatar_path=null;
      if(old) deleteUserSigStorage(old);
      nav('acct');
    }catch(e){showAlert('ลบรูปไม่สำเร็จ: '+String(e&&e.message||e),'er')}
  },{confirmLabel:'ลบรูป'});
}

/* ═══════════ หน้าตั้งค่าบัญชี ═══════════ */
async function vSet(){
  return ''+
  '<div class="card">'+
    '<div class="card-head acct-head">'+
      '<div class="acct-head-ic">'+svg('shield',16)+'</div>'+
      '<div style="flex:1;min-width:0"><div class="card-head-title">ความปลอดภัย</div><div class="acct-head-sub">รหัสผ่าน การยืนยันตัวตน และอุปกรณ์ที่เข้าสู่ระบบ</div></div>'+
    '</div>'+
    '<div class="card-body">'+
      /* รหัสผ่าน */
      '<section class="set-sec">'+
        '<div class="set-sec-hd">'+svg('key',15)+'<span>เปลี่ยนรหัสผ่าน</span></div>'+
        '<p class="set-sec-sub">ต้องกรอกรหัสผ่านปัจจุบันเพื่อยืนยันว่าเป็นคุณ · รหัสผ่านใหม่อย่างน้อย 6 ตัวอักษร</p>'+
        '<div id="set-pw-alert"></div>'+
        '<div class="kv-list set-pw">'+
          '<label class="kv-row"><span class="kv-k">รหัสผ่านปัจจุบัน</span><span class="kv-v"><input id="set-pw-old" type="password" class="fi kv-input" autocomplete="current-password" oninput="_setPwCheck()"></span></label>'+
          '<label class="kv-row"><span class="kv-k">รหัสผ่านใหม่</span><span class="kv-v"><input id="set-pw-new" type="password" class="fi kv-input" autocomplete="new-password" oninput="_setPwCheck()"></span></label>'+
          '<label class="kv-row"><span class="kv-k">ยืนยันรหัสผ่านใหม่</span><span class="kv-v"><input id="set-pw-new2" type="password" class="fi kv-input" autocomplete="new-password" oninput="_setPwCheck()"></span></label>'+
        '</div>'+
        '<button type="button" class="btn btn-primary" id="set-pw-btn" data-action="setChangePw" disabled>อัปเดตรหัสผ่าน</button>'+
      '</section>'+
      /* 2FA */
      '<section class="set-sec">'+
        '<div class="set-row">'+
          '<div style="flex:1;min-width:0">'+
            '<div class="set-sec-hd">'+svg('lock',15)+'<span>ยืนยันตัวตนสองขั้นตอน (2FA)</span> <span id="set-mfa-badge"></span></div>'+
            '<p class="set-sec-sub">หลังใส่รหัสผ่าน ต้องกรอกรหัส 6 หลักจากแอป Authenticator ในมือถือ (Google Authenticator, Microsoft Authenticator ฯลฯ) — ถึงรหัสผ่านหลุด คนอื่นก็เข้าบัญชีไม่ได้</p>'+
          '</div>'+
          '<div id="set-mfa-act"><span class="sp sp-dark"></span></div>'+
        '</div>'+
        '<div id="set-mfa-alert"></div>'+
      '</section>'+
      /* อุปกรณ์ */
      '<section class="set-sec">'+
        '<div class="set-row">'+
          '<div style="flex:1;min-width:0">'+
            '<div class="set-sec-hd">'+svg('out',15)+'<span>ออกจากระบบทุกอุปกรณ์</span></div>'+
            '<p class="set-sec-sub">ใช้เมื่อเคยเข้าระบบบนเครื่องสาธารณะหรือเครื่องคนอื่นแล้วลืมออก — ทุกเครื่องรวมเครื่องนี้ต้องเข้าสู่ระบบใหม่</p>'+
          '</div>'+
          '<button type="button" class="btn btn-soft sm" data-action="setSignOutAll">ออกจากทุกอุปกรณ์</button>'+
        '</div>'+
      '</section>'+
    '</div>'+
  '</div>';
}

function _setPwCheck(){
  var b=$e('set-pw-btn');if(!b) return;
  b.disabled=!(gv('set-pw-old')&&gv('set-pw-new')&&gv('set-pw-new2'));
}

async function setChangePw(){
  var old=gv('set-pw-old'),nw=gv('set-pw-new'),nw2=gv('set-pw-new2');
  var al=$e('set-pw-alert'),b=$e('set-pw-btn');if(!al) return;
  if(!old||!nw||!nw2){al.innerHTML=alrtH('er','กรุณากรอกให้ครบทุกช่อง');return}
  if(nw.length<6){al.innerHTML=alrtH('er','รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');return}
  if(nw!==nw2){al.innerHTML=alrtH('er','รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน');return}
  if(nw===old){al.innerHTML=alrtH('er','รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม');return}
  var _reset=function(){if(b){b.disabled=false;b.textContent='อัปเดตรหัสผ่าน'}};
  if(b){b.disabled=true;b.innerHTML='<span class="sp"></span> กำลังตรวจสอบ…'}
  al.innerHTML='';
  try{
    // ตรวจรหัสเดิมด้วยการ sign in จริง (ไม่มี primitive ตรวจรหัสแยก) — ได้ session ใหม่ระดับ aal1
    var si=await sb.auth.signInWithPassword({email:CU.email,password:old});
    if(si.error){al.innerHTML=alrtH('er','รหัสผ่านปัจจุบันไม่ถูกต้อง');_reset();return}
    // เปิด 2FA ไว้ → Supabase ไม่ยอมเปลี่ยนรหัสด้วย session aal1 ต้องยืนยันรหัสจากแอปก่อน
    if(!await _mfaGate({title:'ยืนยันก่อนเปลี่ยนรหัสผ่าน'})){al.innerHTML=alrtH('wa','ยกเลิกแล้ว — ต้องยืนยันรหัสจากแอป Authenticator ก่อนเปลี่ยนรหัสผ่าน');_reset();return}
    var up=await sb.auth.updateUser({password:nw});
    if(up.error){
      var c=String(up.error.code||up.error.message||'');
      var m=/same_password|different from the old/i.test(c)?'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม'
        :/weak_password|at least/i.test(c)?'รหัสผ่านใหม่ง่ายเกินไป ลองใช้ตัวอักษรผสมตัวเลขและยาวขึ้น'
        :up.error.message;
      al.innerHTML=alrtH('er',m);_reset();return;
    }
    ['set-pw-old','set-pw-new','set-pw-new2'].forEach(function(id){var e=$e(id);if(e)e.value=''});
    al.innerHTML=alrtH('ok','เปลี่ยนรหัสผ่านแล้ว — ครั้งหน้าใช้รหัสผ่านใหม่เข้าสู่ระบบ');
    if(b){b.textContent='อัปเดตรหัสผ่าน';b.disabled=true}
    try{await dp('document_history',{action:'password_change',performed_by:CU.id,note:'เปลี่ยนรหัสผ่าน'})}catch(e){}
  }catch(e){
    console.error('setChangePw:',e);
    al.innerHTML=alrtH('er','เกิดข้อผิดพลาด กรุณาลองใหม่');_reset();
  }
}

function setSignOutAll(){
  showConfirm('ออกจากระบบทุกอุปกรณ์','ทุกเครื่องที่เข้าบัญชีนี้อยู่ รวมถึงเครื่องนี้ จะต้องเข้าสู่ระบบใหม่',async function(){
    try{await dp('document_history',{action:'logout',performed_by:CU.id,note:'ออกจากระบบทุกอุปกรณ์'})}catch(e){}
    try{await sb.auth.signOut({scope:'global'})}catch(e){}
    location.reload();
  },{confirmLabel:'ออกจากทุกอุปกรณ์'});
}

/* ── 2FA (TOTP) ── */
async function _mfaVerifiedTotp(){
  var r=await sb.auth.mfa.listFactors();
  if(r.error) throw r.error;
  return ((r.data&&r.data.totp)||[]).filter(function(f){return f.status==='verified'});
}

async function _setInitMfa(){
  var act=$e('set-mfa-act'),badge=$e('set-mfa-badge');if(!act) return;
  if(!sb.auth.mfa){act.innerHTML='';badge.innerHTML='';return}
  try{
    var fs=await _mfaVerifiedTotp();
    if(fs.length){
      badge.innerHTML='<span class="badge set-badge-on">เปิดอยู่</span>';
      act.innerHTML='<button type="button" class="btn btn-soft sm" data-action="mfaDisable" data-id="'+esc(fs[0].id)+'">ปิด 2FA</button>';
    } else {
      badge.innerHTML='<span class="badge set-badge-off">ปิดอยู่</span>';
      act.innerHTML='<button type="button" class="btn btn-soft sm" data-action="mfaEnroll">เปิดใช้งาน</button>';
    }
  }catch(e){
    act.innerHTML='';
    var al=$e('set-mfa-alert');if(al)al.innerHTML=alrtH('er','โหลดสถานะ 2FA ไม่สำเร็จ: '+String(e&&e.message||e));
  }
}

async function mfaEnroll(){
  var al=$e('set-mfa-alert');if(al)al.innerHTML='';
  try{
    // enroll ที่เปิดค้างไว้แล้วไม่ได้ยืนยัน (ปิดหน้าต่างกลางทาง) ยังเป็น factor สถานะ unverified อยู่ — ล้างก่อน
    var lf=await sb.auth.mfa.listFactors();
    var stale=((lf.data&&lf.data.all)||[]).filter(function(f){return f.factor_type==='totp'&&f.status!=='verified'});
    for(var i=0;i<stale.length;i++){try{await sb.auth.mfa.unenroll({factorId:stale[i].id})}catch(e){}}
    var r=await sb.auth.mfa.enroll({factorType:'totp',issuer:'SAEDU Flow',friendlyName:'Authenticator '+new Date().toISOString().slice(0,10)});
    if(r.error) throw r.error;
    var d=r.data;
    var mw=$e('mwrap');if(!mw) return;
    mw.innerHTML='<div class="mo"><div class="modal" style="max-width:460px">'+
      '<div class="modal-head"><span class="modal-title">เปิดใช้การยืนยันตัวตนสองขั้นตอน</span>'+
      '<button class="btn btn-soft xs btn-icon" data-action="mfaEnrollCancel" data-id="'+esc(d.id)+'">'+svg('x',14)+'</button></div>'+
      '<div class="modal-body">'+
        '<ol class="mfa-steps">'+
          '<li>ติดตั้งแอป <strong>Google Authenticator</strong> หรือ <strong>Microsoft Authenticator</strong> บนมือถือ</li>'+
          '<li>ในแอป กดเพิ่มบัญชี แล้วสแกน QR นี้'+
            '<div class="mfa-qr"><img src="'+esc(d.totp.qr_code)+'" alt="QR code สำหรับแอป Authenticator" width="180" height="180"></div>'+
            '<div class="mfa-secret-lb">สแกนไม่ได้? พิมพ์รหัสนี้ในแอปแทน</div>'+
            '<code class="mfa-secret" id="mfa-secret">'+esc(d.totp.secret)+'</code>'+
          '</li>'+
          '<li>กรอกรหัส 6 หลักที่แอปแสดง'+
            '<input id="mfa-code" class="fi mfa-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000">'+
          '</li>'+
        '</ol>'+
        '<div id="mfa-enroll-alert"></div>'+
      '</div>'+
      '<div class="modal-foot">'+
        '<button class="btn btn-soft" data-action="mfaEnrollCancel" data-id="'+esc(d.id)+'">ยกเลิก</button>'+
        '<button class="btn btn-primary" id="mfa-enroll-ok" data-action="mfaEnrollConfirm" data-id="'+esc(d.id)+'">ยืนยันและเปิดใช้งาน</button>'+
      '</div></div></div>';
    var ci=$e('mfa-code');
    if(ci){
      ci.focus();
      ci.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();mfaEnrollConfirm(d.id)}});
    }
  }catch(e){
    var msg=String(e&&e.message||e);
    if(/disabled|not enabled/i.test(msg)) msg='โปรเจกต์ Supabase ยังไม่ได้เปิด MFA แบบ TOTP (Authentication → Multi-Factor)';
    if(al)al.innerHTML=alrtH('er','เริ่มตั้งค่า 2FA ไม่สำเร็จ: '+msg);
  }
}

async function mfaEnrollConfirm(factorId){
  var code=(gv('mfa-code')||'').replace(/\D/g,'');
  var al=$e('mfa-enroll-alert'),b=$e('mfa-enroll-ok');
  if(code.length!==6){if(al)al.innerHTML=alrtH('er','กรอกรหัส 6 หลักจากแอป');return}
  if(b){b.disabled=true;b.innerHTML='<span class="sp"></span> กำลังตรวจสอบ…'}
  var r=await sb.auth.mfa.challengeAndVerify({factorId:factorId,code:code});
  if(r.error){
    if(al)al.innerHTML=alrtH('er','รหัสไม่ถูกต้องหรือหมดเวลาแล้ว — ใช้รหัสล่าสุดที่แอปแสดง');
    if(b){b.disabled=false;b.textContent='ยืนยันและเปิดใช้งาน'}
    return;
  }
  try{await dp('document_history',{action:'mfa_enable',performed_by:CU.id,note:'เปิดการยืนยันตัวตนสองขั้นตอน'})}catch(e){}
  $e('mwrap').innerHTML='';
  var sa=$e('set-mfa-alert');if(sa)sa.innerHTML=alrtH('ok','เปิด 2FA แล้ว — ครั้งหน้าที่เข้าสู่ระบบจะถามรหัสจากแอป');
  _setInitMfa();
}

async function mfaEnrollCancel(factorId){
  $e('mwrap').innerHTML='';
  if(factorId) try{await sb.auth.mfa.unenroll({factorId:factorId})}catch(e){}
}

function mfaDisable(factorId){
  var mw=$e('mwrap');if(!mw) return;
  mw.innerHTML='<div class="mo"><div class="modal" style="max-width:420px">'+
    '<div class="modal-head"><span class="modal-title">ปิดการยืนยันตัวตนสองขั้นตอน</span>'+
    '<button class="btn btn-soft xs btn-icon" data-action="closeModal">'+svg('x',14)+'</button></div>'+
    '<div class="modal-body">'+
      '<p style="font-size:13px;color:var(--text-2);line-height:1.75;margin:0 0 12px">กรอกรหัส 6 หลักจากแอป Authenticator เพื่อยืนยัน · หลังปิด เข้าสู่ระบบได้ด้วยรหัสผ่านอย่างเดียว</p>'+
      '<input id="mfa-off-code" class="fi mfa-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000">'+
      '<div id="mfa-off-alert" style="margin-top:10px"></div>'+
    '</div>'+
    '<div class="modal-foot">'+
      '<button class="btn btn-soft" data-action="closeModal">ยกเลิก</button>'+
      '<button class="btn btn-danger" id="mfa-off-ok" data-action="mfaDisableConfirm" data-id="'+esc(factorId)+'">ปิด 2FA</button>'+
    '</div></div></div>';
  var ci=$e('mfa-off-code');
  if(ci){ci.focus();ci.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();mfaDisableConfirm(factorId)}})}
}

async function mfaDisableConfirm(factorId){
  var code=(gv('mfa-off-code')||'').replace(/\D/g,'');
  var al=$e('mfa-off-alert'),b=$e('mfa-off-ok');
  if(code.length!==6){if(al)al.innerHTML=alrtH('er','กรอกรหัส 6 หลักจากแอป');return}
  if(b){b.disabled=true;b.innerHTML='<span class="sp"></span> กำลังปิด…'}
  // ถอด factor ที่ยืนยันแล้วต้องใช้ session ระดับ aal2 — verify ก่อนเสมอ (ยังเป็นการยืนยันว่าเป็นเจ้าของจริงด้วย)
  var v=await sb.auth.mfa.challengeAndVerify({factorId:factorId,code:code});
  if(v.error){
    if(al)al.innerHTML=alrtH('er','รหัสไม่ถูกต้องหรือหมดเวลาแล้ว');
    if(b){b.disabled=false;b.textContent='ปิด 2FA'}
    return;
  }
  var u=await sb.auth.mfa.unenroll({factorId:factorId});
  if(u.error){
    if(al)al.innerHTML=alrtH('er','ปิดไม่สำเร็จ: '+u.error.message);
    if(b){b.disabled=false;b.textContent='ปิด 2FA'}
    return;
  }
  try{await sb.auth.refreshSession()}catch(e){}
  try{await dp('document_history',{action:'mfa_disable',performed_by:CU.id,note:'ปิดการยืนยันตัวตนสองขั้นตอน'})}catch(e){}
  $e('mwrap').innerHTML='';
  var sa=$e('set-mfa-alert');if(sa)sa.innerHTML=alrtH('in','ปิด 2FA แล้ว');
  _setInitMfa();
}

/* ── ด่านตอนเข้าสู่ระบบ ──
   คืน true ถ้าไม่ต้องยืนยัน หรือยืนยันสำเร็จ / false ถ้าผู้ใช้กดยกเลิก
   fail-open เมื่ออ่านระดับ session ไม่ได้: getAuthenticatorAssuranceLevel อ่านจาก JWT ในเครื่อง
   ถ้ามันพัง การปิดประตูจะล็อกทุกคนออกจากระบบ ทั้งที่คนส่วนใหญ่ไม่ได้เปิด 2FA */
async function _mfaGate(opts){
  opts=opts||{};
  try{
    if(!sb.auth.mfa) return true;
    var r=await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if(r.error||!r.data) return true;
    if(r.data.nextLevel!=='aal2'||r.data.currentLevel==='aal2') return true;
    var fs=await _mfaVerifiedTotp();
    if(!fs.length) return true;
    return await _mfaPrompt(fs[0].id,opts);
  }catch(e){
    console.warn('_mfaGate:',e);
    return true;
  }
}

function _mfaPrompt(factorId,opts){
  return new Promise(function(resolve){
    var hadBusy=!!$e('login-busy');
    if(hadBusy&&typeof _hideLoginBusyPopup==='function') _hideLoginBusyPopup();
    var el=document.createElement('div');
    el.id='mfa-gate';el.className='cpopup-overlay';el.style.zIndex='900';
    el.innerHTML='<div class="cpopup-box" style="max-width:380px" role="dialog" aria-modal="true" aria-labelledby="mfa-gate-t">'+
      '<div class="cpopup-body" style="padding:26px 24px 22px">'+
        '<div class="mfa-gate-ic">'+svg('shield',22)+'</div>'+
        '<div id="mfa-gate-t" class="mfa-gate-title">'+esc(opts.title||'ยืนยันตัวตนสองขั้นตอน')+'</div>'+
        '<p class="mfa-gate-sub">เปิดแอป Authenticator ในมือถือ แล้วกรอกรหัส 6 หลักของ SAEDU Flow</p>'+
        '<input id="mfa-gate-code" class="fi mfa-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000">'+
        '<div id="mfa-gate-alert" style="margin-top:10px"></div>'+
        '<button type="button" class="btn btn-primary" id="mfa-gate-ok" style="width:100%;margin-top:6px">ยืนยัน</button>'+
        '<button type="button" class="btn btn-soft" id="mfa-gate-cancel" style="width:100%;margin-top:8px">ยกเลิก</button>'+
      '</div></div>';
    document.body.appendChild(el);
    var inp=$e('mfa-gate-code'),ok=$e('mfa-gate-ok'),cc=$e('mfa-gate-cancel'),al=$e('mfa-gate-alert');
    var tries=0,busy=false;
    var done=function(v){el.remove();if(v&&hadBusy&&typeof _showLoginBusyPopup==='function')_showLoginBusyPopup();resolve(v)};
    var go=async function(){
      if(busy) return;
      var code=(inp.value||'').replace(/\D/g,'');
      if(code.length!==6){al.innerHTML=alrtH('er','กรอกรหัส 6 หลัก');inp.focus();return}
      busy=true;ok.disabled=true;ok.innerHTML='<span class="sp"></span> กำลังตรวจสอบ…';
      var r=await sb.auth.mfa.challengeAndVerify({factorId:factorId,code:code});
      busy=false;ok.disabled=false;ok.textContent='ยืนยัน';
      if(!r.error){done(true);return}
      tries++;
      if(tries>=5){al.innerHTML=alrtH('er','กรอกผิดหลายครั้งเกินไป');setTimeout(function(){done(false)},1200);return}
      al.innerHTML=alrtH('er','รหัสไม่ถูกต้องหรือหมดเวลาแล้ว — ใช้รหัสล่าสุดที่แอปแสดง');
      inp.value='';inp.focus();
    };
    ok.addEventListener('click',go);
    cc.addEventListener('click',function(){done(false)});
    inp.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();go()}});
    inp.addEventListener('input',function(){if(inp.value.replace(/\D/g,'').length===6)go()});
    setTimeout(function(){inp.focus()},30);
  });
}
