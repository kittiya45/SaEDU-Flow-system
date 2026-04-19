/* ─── AUTH ─── */
function showAuth(){
  var loginB = [
    '<div id="lal"></div>',
    '<div class="fg"><label class="fl">ชื่อผู้ใช้ / รหัสนิสิต / อีเมล</label>',
    '<input id="lu" class="fi" placeholder="กนค.: รหัสนิสิต | อ./จนท.: อีเมล "></div>',
    '<div class="fg"><label class="fl">รหัสผ่าน</label>',
    '<div style="position:relative">',
    '<input id="lp" class="fi" type="password" placeholder="••••••••" style="padding-right:44px">',
    '<button type="button" id="lp-eye" onclick="_togglePwVis()" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;padding:4px;cursor:pointer;color:#a89e99;display:flex;align-items:center;line-height:1;border-radius:6px" title="แสดง/ซ่อนรหัสผ่าน">'+svg('eye',16)+'</button>',
    '</div>',
    '<div style="text-align:right;margin-top:6px">',
    '<button type="button" style="font-size:12px;background:transparent;color:#E83A00;border:none;padding:0;cursor:pointer;font-weight:600" data-action="showChangePwPopup">ลืมรหัสผ่าน?</button>',
    '</div></div>',
    '<button class="btn btn-primary fw py-[13px] mt-1" data-action="login">เข้าสู่ระบบ</button>',
    '<div class="divider">ยังไม่มีบัญชี?</div>',
    '<div class="grid grid-cols-2 gap-[9px]">',
    '<button class="btn btn-ghost fw" data-action="showRegGnkPopup">สมัคร กนค.</button>',
    '<button class="btn btn-ghost fw" data-action="showRegStaffPopup">สมัคร อ./จนท.</button></div>',

  ].join('');

  rdr([
    '<div class="auth-root">',
    '<div class="ab1"></div><div class="ab2"></div><div class="ab3"></div><div class="ab4"></div>',
    '<div class="auth-card">',
    '<div class="auth-header">',
    '<div class="auth-orb"></div>',
    '<div class="auth-logo-ring">',
    '<div class="auth-logo-wrap"><img src="img/logo.png" alt="Logo กนค." class="auth-logo" onerror="this.style.display=\'none\';this.nextSibling.style.display=\'flex\'"><div class="auth-badge hidden">กนค</div></div>',
    '</div>',
    '<div class="auth-title">SAEDU Flow</div>',
    '<div class="auth-sub">ระบบเสนอเอกสาร คณะกรรมการนิสิต</div>',
    '</div>',
    '<div class="auth-body">',
    loginB,
    '</div></div>',
    '<p class="text-[11px] text-[#a89e99] mt-5">SAEDUFLOW © 2569</p>',
    '</div>'
  ].join(''));

  // Bind enter key
  setTimeout(function(){
    var lu=$e('lu'), lp=$e('lp');
    if(lu) lu.addEventListener('keydown',function(e){if(e.key==='Enter')doLogin()});
    if(lp) lp.addEventListener('keydown',function(e){if(e.key==='Enter')doLogin()});
  },50);
}

function chkSid(){
  var v=gv('gsid'), h=$e('sidh'); if(!h)return;
  if(!v){h.className='hint muted';h.textContent='รหัสนิสิต 10 หลัก — 2 ตัวสุดท้ายต้องเป็น 27';return}
  if(!/^\d{10}$/.test(v)){h.className='hint er';h.innerHTML=svg('x',12)+' ต้องเป็นตัวเลข 10 หลัก';return}
  if(v.slice(-2)!=='27'){h.className='hint er';h.innerHTML=svg('x',12)+' 2 ตัวสุดท้ายต้องเป็น 27';return}
  h.className='hint ok';h.innerHTML=svg('ok',12)+' รหัสนิสิตถูกต้อง'
}

async function doLogin(){
  var u=gv('lu').trim(), p=gv('lp'), a=$e('lal'); if(!a)return;
  if(!u||!p){a.innerHTML=alrtH('er','กรุณากรอกข้อมูลให้ครบ');return}
  a.innerHTML='<div class="al al-in"><span class="sp sp-dark"></span><span> กำลังตรวจสอบ...</span></div>';
  try{
    var row=null;
    if(u==='admin'){
      var r=await dg('users','?email=eq.admin&approval_status=eq.approved');
      if(r&&r.length) row=r[0];
    } else {
      var r1=await dg('users','?student_id=eq.'+encodeURIComponent(u)+'&approval_status=eq.approved');
      var r2=await dg('users','?email=eq.'+encodeURIComponent(u)+'&approval_status=eq.approved');
      var rows=[].concat(r1||[]).concat(r2||[]);
      if(rows.length) row=rows[0];
      if(!row){
        var p1=await dg('users','?student_id=eq.'+encodeURIComponent(u)+'&approval_status=eq.pending');
        var p2=await dg('users','?email=eq.'+encodeURIComponent(u)+'&approval_status=eq.pending');
        if((p1&&p1.length)||(p2&&p2.length)){showPend();return}
      }
    }
    if(row&&await checkPw(p,row.password_hash)){
      // Auto-upgrade password to PBKDF2 if still SHA-256 or plaintext
      if(!row.password_hash||!row.password_hash.startsWith('pbkdf2$')){
        var _upgraded=await hashPw(p);
        await dpa('users',row.id,{password_hash:_upgraded});
        row.password_hash=_upgraded;
      }
      CU=row;
      // Audit log: login
      try{await dp('document_history',{action:'login',performed_by:CU.id,note:'เข้าสู่ระบบ'});}catch(e){}
      // Session timeout: 30 minutes of inactivity
      _lastAct=Date.now();
      document.addEventListener('click',function(){_lastAct=Date.now();},true);
      document.addEventListener('keydown',function(){_lastAct=Date.now();},true);
      if(_sesTmr) clearInterval(_sesTmr);
      _sesTmr=setInterval(function(){
        if(CU&&Date.now()-_lastAct>30*60*1000){
          clearInterval(_sesTmr);_sesTmr=null;
          try{dp('document_history',{action:'session_timeout',performed_by:CU.id,note:'Session หมดอายุอัตโนมัติ'});}catch(e){}
          CU=null; showAuth();
          alert('Session หมดอายุ กรุณาเข้าสู่ระบบใหม่');
        }
      },60000);
      await nav('dash');
      sendOverdueNotifs(); return
    }
    a.innerHTML=alrtH('er','ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
  } catch(e){a.innerHTML=alrtH('er','เกิดข้อผิดพลาด กรุณาลองใหม่')}
}

function showPend(){
  rdr('<div class="pending-page"><div class="text-[64px] mb-4">⏳</div><div class="t1 mb-2.5">รอการอนุมัติ</div><p class="text-[#6b6560] max-w-[320px] leading-[1.8] mb-6">บัญชีของคุณอยู่ระหว่างการตรวจสอบ<br>กรุณารอผู้ดูแลระบบอนุมัติก่อนเข้าใช้งาน</p><button class="btn btn-ghost" data-action="auth" data-tab="login">← กลับหน้าเข้าสู่ระบบ</button></div>')
}

async function doRegG(){
  var fn=gv('gfn'),ln=gv('gln'),sid=gv('gsid'),pos=gv('gpos'),pw=gv('gpw'),pw2=gv('gpw2'),gemail=gv('gemail').trim();
  var a=$e('lal'); if(!a)return;
  if(!fn||!ln||!sid||!pos||!pw||!gemail){a.innerHTML=alrtH('er','กรุณากรอกข้อมูลให้ครบทุกช่อง');return}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gemail)){a.innerHTML=alrtH('er','รูปแบบอีเมลไม่ถูกต้อง');return}
  if(!/^\d{10}$/.test(sid)||sid.slice(-2)!=='27'){a.innerHTML=alrtH('er','รหัสนิสิตไม่ถูกต้อง (10 หลัก ลงท้ายด้วย 27)');return}
  if(pw.length<6){a.innerHTML=alrtH('er','รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');return}
  if(pw!==pw2){a.innerHTML=alrtH('er','รหัสผ่านทั้งสองช่องไม่ตรงกัน');return}
  a.innerHTML='<div class="al al-in"><span class="sp sp-dark"></span><span> กำลังบันทึก...</span></div>';
  var ex=await dg('users','?student_id=eq.'+sid);
  if(ex&&ex.length){a.innerHTML=alrtH('er','รหัสนิสิตนี้มีการสมัครแล้ว');return}
  var pwHash=await hashPw(pw);
  await dp('users',{email:gemail,full_name:fn+' '+ln,student_id:sid,position_code:pos,role_code:PR[pos]||'ROLE-CRT',department:'กนค.',user_type:'gnk',approval_status:'pending',password_hash:pwHash,is_active:false,contact_email:gemail});
  a.innerHTML=alrtH('ok','สมัครสำเร็จ! กรุณารอผู้ดูแลระบบอนุมัติก่อนเข้าใช้งาน');
  setTimeout(function(){closeRegPopup()},2200)
}

async function doRegS(){
  var nm=gv('snm'),tp=gv('stp')||'advisor',em=gv('sem'),dp2=gv('sdp'),pw=gv('spw'),pw2=gv('spw2');
  var a=$e('lal'); if(!a)return;
  if(!nm||!em||!pw){a.innerHTML=alrtH('er','กรุณากรอกข้อมูลให้ครบ');return}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)){a.innerHTML=alrtH('er','รูปแบบอีเมลไม่ถูกต้อง');return}
  if(pw.length<6){a.innerHTML=alrtH('er','รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');return}
  if(pw!==pw2){a.innerHTML=alrtH('er','รหัสผ่านทั้งสองช่องไม่ตรงกัน');return}
  a.innerHTML='<div class="al al-in"><span class="sp sp-dark"></span><span> กำลังบันทึก...</span></div>';
  var ex=await dg('users','?email=eq.'+encodeURIComponent(em));
  if(ex&&ex.length){a.innerHTML=alrtH('er','อีเมลนี้มีการสมัครแล้ว');return}
  var pwHash2=await hashPw(pw);
  await dp('users',{email:em,full_name:nm,position_code:null,role_code:tp==='advisor'?'ROLE-ADV':'ROLE-STF',department:dp2||'สำนักกิจการนิสิต',user_type:tp,approval_status:'pending',password_hash:pwHash2,is_active:false});
  a.innerHTML=alrtH('ok','สมัครสำเร็จ! กรุณารอผู้ดูแลระบบอนุมัติ');
  setTimeout(function(){closeRegPopup()},2200)
}

/* ─── CHANGE PW POPUP (login page) ─── */
function showRegGnkPopup(){
  if(document.getElementById('regpopup')) return;
  var pOpts=POSS.map(function(p){return '<option value="'+p+'">'+p+' — '+PTH[p]+'</option>'}).join('');
  var el=document.createElement('div');
  el.id='regpopup'; el.className='cpopup-overlay';
  el.innerHTML=
    '<div class="cpopup-box max-w-[480px] max-h-[90vh] overflow-y-auto">'+
      '<div class="cpopup-head">'+
        '<div class="flex-1"><div class="cpopup-head-title">สมัครสมาชิก กนค.</div>'+
        '<div class="cpopup-head-sub">ต้องรอ Admin อนุมัติก่อนเข้าใช้งาน</div></div>'+
        '<button class="cpopup-close" data-action="closeRegPopup">'+svg('x',14)+'</button>'+
      '</div>'+
      '<div class="cpopup-body">'+
        '<div id="lal"></div>'+
        '<div class="fr">'+
        '<div class="fg"><label class="fl">ชื่อ <span class="req">*</span></label><input id="gfn" class="fi" placeholder="ชื่อ"></div>'+
        '<div class="fg"><label class="fl">นามสกุล <span class="req">*</span></label><input id="gln" class="fi" placeholder="นามสกุล"></div>'+
        '</div>'+
        '<div class="fg"><label class="fl">รหัสนิสิต <span class="req">*</span></label>'+
        '<input id="gsid" class="fi" placeholder="เช่น 6601012327" maxlength="10" oninput="chkSid()">'+
        '<p class="hint muted" id="sidh">รหัสนิสิต 10 หลัก</p></div>'+
        '<div class="fg"><label class="fl">อีเมลติดต่อ <span class="req">*</span></label>'+
        '<input id="gemail" class="fi" type="email" placeholder="ใช้สำหรับรับการแจ้งเตือน"></div>'+
        '<div class="fg"><label class="fl">ตำแหน่งใน กนค. <span class="req">*</span></label>'+
        '<select id="gpos" class="fi"><option value="">— เลือกตำแหน่ง —</option>'+pOpts+'</select></div>'+
        '<div class="fr">'+
        '<div class="fg"><label class="fl">รหัสผ่าน <span class="req">*</span></label><input id="gpw" class="fi" type="password" placeholder="อย่างน้อย 6 ตัว"></div>'+
        '<div class="fg"><label class="fl">ยืนยันรหัสผ่าน <span class="req">*</span></label><input id="gpw2" class="fi" type="password" placeholder="ยืนยัน"></div>'+
        '</div>'+
        '<button class="btn btn-primary fw py-[13px]" data-action="regG">สมัครสมาชิก กนค.</button>'+
      '</div>'+
    '</div>';
  el.addEventListener('click',function(ev){if(ev.target===el) closeRegPopup()});
  document.body.appendChild(el);
}

function showRegStaffPopup(){
  if(document.getElementById('regpopup')) return;
  var el=document.createElement('div');
  el.id='regpopup'; el.className='cpopup-overlay';
  el.innerHTML=
    '<div class="cpopup-box max-w-[480px]">'+
      '<div class="cpopup-head">'+
        '<div class="flex-1"><div class="cpopup-head-title">สมัครสมาชิก อาจารย์ / เจ้าหน้าที่</div>'+
        '<div class="cpopup-head-sub">ต้องรอ Admin อนุมัติก่อนเข้าใช้งาน</div></div>'+
        '<button class="cpopup-close" data-action="closeRegPopup">'+svg('x',14)+'</button>'+
      '</div>'+
      '<div class="cpopup-body">'+
        '<div id="lal"></div>'+
        '<div class="fr">'+
        '<div class="fg"><label class="fl">ชื่อ-นามสกุล <span class="req">*</span></label><input id="snm" class="fi" placeholder="ชื่อ นามสกุล"></div>'+
        '<div class="fg"><label class="fl">ประเภท <span class="req">*</span></label><select id="stp" class="fi"><option value="advisor">อาจารย์กิจการนิสิต</option><option value="staff">เจ้าหน้าที่กิจกรรม</option></select></div>'+
        '</div>'+
        '<div class="fg"><label class="fl">อีเมล <span class="req">*</span></label><input id="sem" class="fi" type="email" placeholder="email@university.ac.th"></div>'+
        '<div class="fg"><label class="fl">ฝ่าย / หน่วยงาน</label><input id="sdp" class="fi" placeholder="เช่น สำนักกิจการนิสิต"></div>'+
        '<div class="fr">'+
        '<div class="fg"><label class="fl">รหัสผ่าน <span class="req">*</span></label><input id="spw" class="fi" type="password" placeholder="อย่างน้อย 6 ตัว"></div>'+
        '<div class="fg"><label class="fl">ยืนยันรหัสผ่าน <span class="req">*</span></label><input id="spw2" class="fi" type="password" placeholder="ยืนยัน"></div>'+
        '</div>'+
        '<button class="btn btn-primary fw py-[13px]" data-action="regS">สมัครสมาชิก</button>'+
      '</div>'+
    '</div>';
  el.addEventListener('click',function(ev){if(ev.target===el) closeRegPopup()});
  document.body.appendChild(el);
}

function closeRegPopup(){var e=document.getElementById('regpopup');if(e)e.remove()}

function showChangePwPopup(){
  if(document.getElementById('cpopup')) return;
  var el=document.createElement('div');
  el.id='cpopup'; el.className='cpopup-overlay';
  el.innerHTML=
    '<div class="cpopup-box">'+
      '<div class="cpopup-head">'+
        '<div class="flex-1"><div class="cpopup-head-title">เปลี่ยนรหัสผ่าน</div>'+
        '<div class="cpopup-head-sub">กรอกรหัสผ่านเดิมเพื่อตั้งรหัสใหม่</div></div>'+
        '<button class="cpopup-close" data-action="closeChangePwPopup">'+svg('x',14)+'</button>'+
      '</div>'+
      '<div class="cpopup-body">'+
        '<div id="lal"></div>'+
        '<div class="al al-in text-xs mb-3.5"><span class="al-icon">'+svg('info',13)+'</span><span>กรอกข้อมูลเพื่อตั้งรหัสผ่านใหม่ โดยต้องทราบรหัสผ่านเดิมก่อน</span></div>'+
        '<div class="fg"><label class="fl">ชื่อผู้ใช้ / รหัสนิสิต / อีเมล <span class="req">*</span></label>'+
        '<input id="cpuser" class="fi" placeholder="กนค.: รหัสนิสิต | อ./จนท.: อีเมล"></div>'+
        '<div class="fg"><label class="fl">รหัสผ่านเดิม <span class="req">*</span></label>'+
        '<input id="cpold" class="fi" type="password" placeholder="••••••••"></div>'+
        '<div class="fg"><label class="fl">รหัสผ่านใหม่ <span class="req">*</span></label>'+
        '<input id="cpnew" class="fi" type="password" placeholder="อย่างน้อย 6 ตัวอักษร"></div>'+
        '<div class="fg"><label class="fl">ยืนยันรหัสผ่านใหม่ <span class="req">*</span></label>'+
        '<input id="cpnew2" class="fi" type="password" placeholder="ยืนยัน"></div>'+
        '<button class="btn btn-primary fw py-[13px]" data-action="doChangePwLogin">บันทึกรหัสผ่านใหม่</button>'+
      '</div>'+
    '</div>';
  // close on overlay click
  el.addEventListener('click',function(ev){if(ev.target===el) closeChangePwPopup()});
  document.body.appendChild(el);
}
function closeChangePwPopup(){var e=document.getElementById('cpopup');if(e)e.remove()}

/* ─── CHANGE PASSWORD (จากหน้า Login — ไม่ต้อง Login ก่อน) ─── */
async function doChangePwLogin(){
  var u=gv('cpuser').trim(), old=gv('cpold'), nw=gv('cpnew'), nw2=gv('cpnew2');
  var al=$e('lal'); if(!al) return;
  if(!u||!old||!nw||!nw2){al.innerHTML=alrtH('er','กรุณากรอกข้อมูลให้ครบทุกช่อง');return}
  if(nw.length<6){al.innerHTML=alrtH('er','รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');return}
  if(nw!==nw2){al.innerHTML=alrtH('er','รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน');return}
  al.innerHTML='<div class="al al-in"><span class="sp sp-dark"></span><span> กำลังตรวจสอบ...</span></div>';
  try{
    var r1=await dg('users','?student_id=eq.'+encodeURIComponent(u)+'&approval_status=eq.approved');
    var r2=await dg('users','?email=eq.'+encodeURIComponent(u)+'&approval_status=eq.approved');
    var row=[].concat(r1||[]).concat(r2||[])[0];
    if(!row){al.innerHTML=alrtH('er','ไม่พบบัญชีผู้ใช้นี้ในระบบ');return}
    if(!await checkPw(old,row.password_hash)){al.innerHTML=alrtH('er','รหัสผ่านปัจจุบันไม่ถูกต้อง');return}
    var newHash=await hashPw(nw);
    await dpa('users',row.id,{password_hash:newHash});
    al.innerHTML=alrtH('ok','เปลี่ยนรหัสผ่านสำเร็จ! กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่');
    setTimeout(function(){closeChangePwPopup()},1800)
  }catch(e){al.innerHTML=alrtH('er','เกิดข้อผิดพลาด: '+e.message)}
}

/* ─── CHANGE PASSWORD (Modal — ใช้เมื่อ Login แล้ว) ─── */
function showChangePw(){
  var mw=$e('mwrap'); if(!mw) return;
  mw.innerHTML='<div class="mo"><div class="modal">'+
    '<div class="modal-head"><span class="modal-title">เปลี่ยนรหัสผ่าน</span>'+
    '<button class="btn btn-soft xs btn-icon" data-action="closeModal">'+svg('x',14)+'</button></div>'+
    '<div class="modal-body">'+
    '<div id="cpwal"></div>'+
    '<div class="fg"><label class="fl">รหัสผ่านปัจจุบัน <span class="req">*</span></label>'+
    '<input type="password" class="fi" id="cpold" placeholder="รหัสผ่านปัจจุบัน"></div>'+
    '<div class="fg"><label class="fl">รหัสผ่านใหม่ <span class="req">*</span></label>'+
    '<input type="password" class="fi" id="cpnew" placeholder="อย่างน้อย 6 ตัวอักษร"></div>'+
    '<div class="fg"><label class="fl">ยืนยันรหัสผ่านใหม่ <span class="req">*</span></label>'+
    '<input type="password" class="fi" id="cpnew2" placeholder="ยืนยันรหัสผ่าน"></div>'+
    '</div>'+
    '<div class="modal-foot">'+
    '<button class="btn btn-soft" data-action="closeModal">ยกเลิก</button>'+
    '<button class="btn btn-primary" data-action="doChangePw">บันทึกรหัสผ่านใหม่</button>'+
    '</div></div></div>'
}

async function doChangePw(){
  var old=gv('cpold'), nw=gv('cpnew'), nw2=gv('cpnew2');
  var al=$e('cpwal'); if(!al) return;
  if(!old||!nw||!nw2){al.innerHTML=alrtH('er','กรุณากรอกข้อมูลให้ครบทุกช่อง');return}
  if(!await checkPw(old,CU.password_hash)){al.innerHTML=alrtH('er','รหัสผ่านปัจจุบันไม่ถูกต้อง');return}
  if(nw.length<6){al.innerHTML=alrtH('er','รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');return}
  if(nw!==nw2){al.innerHTML=alrtH('er','รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน');return}
  al.innerHTML='<div class="al al-in"><span class="sp sp-dark"></span><span> กำลังบันทึก...</span></div>';
  try{
    var newHash=await hashPw(nw);
    await dpa('users',CU.id,{password_hash:newHash});
    CU.password_hash=newHash;
    al.innerHTML=alrtH('ok','เปลี่ยนรหัสผ่านสำเร็จแล้ว!');
    setTimeout(function(){var mw=$e('mwrap');if(mw)mw.innerHTML=''},1500)
  }catch(e){al.innerHTML=alrtH('er','เกิดข้อผิดพลาด: '+e.message)}
}

function _togglePwVis(){
  var inp=$e('lp'), btn=$e('lp-eye');
  if(!inp||!btn) return;
  var show=inp.type==='password';
  inp.type=show?'text':'password';
  btn.innerHTML=show
    ?'<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/><line x1="2" y1="2" x2="14" y2="14"/></svg>'
    :svg('eye',16);
  btn.style.color=show?'#E83A00':'#a89e99';
}

