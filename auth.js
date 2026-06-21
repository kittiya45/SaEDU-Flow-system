/* ─── SESSION MANAGEMENT ─── */
var _loginAttempts=+(localStorage.getItem('_la')||0);
var _loginLockedUntil=+(localStorage.getItem('_llu')||0);
/* [SECURITY] Supabase Auth — H.Authorization ต้องตามสถานะ session เสมอ (login/logout/auto refresh token)
   นี่คือจุดเดียวที่ต้องอัปเดต ทุกฟังก์ชัน dg/dp/dpa/dd และ fetch(headers:H) อื่นๆ ทั่วแอปจะเห็น token ปัจจุบันโดยอัตโนมัติ */
sb.auth.onAuthStateChange(function(_event,session){
  H.Authorization = session ? 'Bearer '+session.access_token : 'Bearer '+SK;
});
function _actHandler(){_lastAct=Date.now()}
function _startSessionTimer(){
  _lastAct=Date.now();
  document.removeEventListener('click',_actHandler,true);
  document.removeEventListener('keydown',_actHandler,true);
  document.addEventListener('click',_actHandler,true);
  document.addEventListener('keydown',_actHandler,true);
  if(_sesTmr)clearInterval(_sesTmr);
  _sesTmr=setInterval(function(){
    if(CU&&Date.now()-_lastAct>(SETT.session_timeout_min||30)*60*1000){
      try{dp('document_history',{action:'session_timeout',performed_by:CU.id,note:'Session หมดอายุอัตโนมัติ'});}catch(e){}
      _cleanupSession();
      showAuth();
      showAlert('Session หมดอายุ กรุณาเข้าสู่ระบบใหม่','wa');
    }
  },60000);
}
function _cleanupSession(){
  if(_sesTmr){clearInterval(_sesTmr);_sesTmr=null;}
  document.removeEventListener('click',_actHandler,true);
  document.removeEventListener('keydown',_actHandler,true);
  CU=null;
}
async function doLogout(){
  if(CU){try{await dp('document_history',{action:'logout',performed_by:CU.id,note:'ออกจากระบบ'});}catch(e){}}
  try{await sb.auth.signOut();}catch(e){}
  _cleanupSession();
  showAuth();
}

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
    /* [UX] เปลี่ยน label ให้ตรงกับ behavior จริง (ต้องใส่รหัสเดิม ไม่ใช่ reset) */
    '<button type="button" style="font-size:12px;background:transparent;color:#E83A00;border:none;padding:0;cursor:pointer;font-weight:600" data-action="showChangePwPopup">เปลี่ยนรหัสผ่าน</button>',
    '</div></div>',
    '<button class="btn btn-primary fw py-[13px] mt-1" data-action="login">เข้าสู่ระบบ</button>',
    '<div class="divider">ยังไม่มีบัญชี?</div>',
    /* [UX] เพิ่ม sub-caption ใต้ปุ่มสมัครเพื่อบอกว่าแต่ละปุ่มสำหรับใคร */
    '<div class="grid grid-cols-2 gap-[9px]">',
    '<div class="flex flex-col items-center gap-1">',
    '<button class="btn btn-ghost fw" data-action="showRegGnkPopup">สมัคร กนค.</button>',
    '<span style="font-size:11px;color:#a89e99">สำหรับนิสิต กนค.</span>',
    '</div>',
    '<div class="flex flex-col items-center gap-1">',
    '<button class="btn btn-ghost fw" data-action="showRegStaffPopup">สมัคร อ./จนท.</button>',
    '<span style="font-size:11px;color:#a89e99">สำหรับอาจารย์และเจ้าหน้าที่</span>',
    '</div></div>',

  ].join('');

  rdr([
    '<div class="auth-root">',
    '<div class="auth-card">',
    '<div class="auth-header">',
    '<div class="auth-orb"></div>',
    '<div class="auth-logo-ring">',
    '<div class="auth-logo-wrap"><img src="img/Logo.png" alt="Logo SAEDU Flow" class="auth-logo" onerror="this.style.display=\'none\';this.nextSibling.style.display=\'flex\'"><div class="auth-badge hidden"></div></div>',
    '</div>',
    '<div class="auth-title">SAEDU Flow</div>',
    '<div class="auth-sub">ระบบเสนอเอกสาร คณะกรรมการนิสิต</div>',
    '</div>',
    '<div class="auth-body">',
    loginB,
    '</div></div>',
    '<p class="text-[11px] text-[#a89e99] mt-5">SAEDUFLOW © 2569</p>',
    '<a href="manual.html?from=login" style="margin-top:10px;font-size:12px;color:#C42E00;text-decoration:none;display:inline-flex;align-items:center;gap:5px;opacity:.8;transition:opacity .15s" onmouseover="this.style.opacity=\'1\'" onmouseout="this.style.opacity=\'.8\'">',
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
    'คู่มือการใช้งาน</a>',
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
  var _len=+(SETT&&SETT.student_id_length)||10;
  var _sfx=(SETT&&SETT.student_id_suffix)||'27';
  var v=gv('gsid'), h=$e('sidh'); if(!h)return;
  if(!v){h.className='hint muted';h.textContent='รหัสนิสิต '+_len+' หลัก — '+_sfx.length+' ตัวสุดท้ายต้องเป็น '+_sfx;return}
  var _pat=new RegExp('^\\d{'+_len+'}$');
  if(!_pat.test(v)){h.className='hint er';h.innerHTML=svg('x',12)+' ต้องเป็นตัวเลข '+_len+' หลัก';return}
  if(v.slice(-_sfx.length)!==_sfx){h.className='hint er';h.innerHTML=svg('x',12)+' '+_sfx.length+' ตัวสุดท้ายต้องเป็น '+_sfx;return}
  h.className='hint ok';h.innerHTML=svg('ok',12)+' รหัสนิสิตถูกต้อง'
}

async function doLogin(){
  var u=gv('lu').trim(),p=gv('lp'),a=$e('lal');if(!a)return;
  if(!u||!p){a.innerHTML=alrtH('er','กรุณากรอกข้อมูลให้ครบ');return}
  if(Date.now()<_loginLockedUntil){
    // [UX] countdown timer อัปเดตทุก 1 วินาที แทนแสดงครั้งเดียว
    var _updateLockMsg=function(){
      var remain=_loginLockedUntil-Date.now();
      if(remain<=0){if(a)a.innerHTML='';return;}
      var secs=Math.ceil(remain/1000);
      var mins=Math.floor(secs/60);
      var s2=secs%60;
      var timeStr=mins>0?(mins+' นาที '+(s2>0?s2+' วินาที':'')):(secs+' วินาที');
      if(a)a.innerHTML=alrtH('er','พยายามเข้าสู่ระบบผิดพลาดหลายครั้ง กรุณารอ '+timeStr);
      setTimeout(_updateLockMsg,1000);
    };
    _updateLockMsg();
    return;
  }
  a.innerHTML='<div class="al al-in"><span class="sp sp-dark"></span><span> กำลังตรวจสอบ...</span></div>';
  try{
    var email=u;
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u)){
      // ไม่ใช่รูปแบบอีเมล — สมมติว่าเป็นรหัสนิสิต แปลงเป็นอีเมลผ่าน RPC ก่อน (RLS ไม่ยอมให้ query ตาราง users ตรงๆตอนยังไม่ login)
      var _rr=await sb.rpc('resolve_login_email',{identifier:u});
      email=(_rr&&_rr.data)||u;
    }
    var _si=await sb.auth.signInWithPassword({email:email,password:p});
    if(_si.error||!_si.data||!_si.data.session){
      _loginAttempts++;
      localStorage.setItem('_la',_loginAttempts);
      if(_loginAttempts>=5){
        _loginLockedUntil=Date.now()+15*60*1000;_loginAttempts=0;
        localStorage.setItem('_llu',_loginLockedUntil);
        localStorage.setItem('_la','0');
        a.innerHTML=alrtH('er','พยายามเข้าสู่ระบบผิดพลาดหลายครั้งเกินไป กรุณารอ 15 นาที');
      } else {
        a.innerHTML=alrtH('er','ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      }
      return;
    }
    H.Authorization='Bearer '+_si.data.session.access_token;
    var rows=await dg('users','?auth_uid=eq.'+_si.data.user.id);
    var row=rows&&rows[0];
    var ok=await _enterAppAsUser(row,{logLogin:true,onError:function(msg){a.innerHTML=alrtH('er',msg)}});
    if(!ok)return;
    _loginAttempts=0;
    localStorage.setItem('_la','0');
    localStorage.removeItem('_llu');
  }catch(e){
    console.error('doLogin:',e);
    a.innerHTML=alrtH('er','เกิดข้อผิดพลาด กรุณาลองใหม่')
  }
}

/* ─── เข้าสู่แอปจริงหลังยืนยันตัวตนสำเร็จแล้ว (ใช้ทั้ง doLogin และ boot.js ตอน restore session) ─── */
async function _enterAppAsUser(row,opts){
  opts=opts||{};
  if(!row||row.approval_status==='pending'){await sb.auth.signOut();showPend();return false}
  if(row.approval_status!=='approved'||!row.is_active){
    await sb.auth.signOut();
    if(opts.onError)opts.onError('บัญชีนี้ไม่สามารถใช้งานได้ กรุณาติดต่อผู้ดูแลระบบ');
    return false
  }
  if(row.user_type==='gnk'&&row.expires_at&&new Date(row.expires_at)<new Date()){
    if(row.is_active) try{await dpa('users',row.id,{is_active:false});}catch(e){}
    await sb.auth.signOut();
    if(opts.onError)opts.onError('บัญชีนี้หมดอายุแล้ว กรุณาติดต่อเจ้าหน้าที่เพื่อต่ออายุการใช้งาน');
    return false
  }
  CU=row;
  if(opts.logLogin){try{await dp('document_history',{action:'login',performed_by:CU.id,note:'เข้าสู่ระบบ'});}catch(e){}}
  _startSessionTimer();
  await loadDocTypes();
  await loadAppSettings();
  await loadProjects();
  await nav('dash');
  try{await sendOverdueNotifs();}catch(e){console.warn('Overdue check failed:',e)}
  return true
}

function showPend(){
  rdr('<div class="pending-page"><div class="text-[64px] mb-4">⏳</div><div class="t1 mb-2.5">รอการอนุมัติ</div><p class="text-[#6b6560] max-w-[320px] leading-[1.8] mb-6">บัญชีของคุณอยู่ระหว่างการตรวจสอบ<br>กรุณารอผู้ดูแลระบบอนุมัติก่อนเข้าใช้งาน</p><button class="btn btn-ghost" data-action="auth" data-tab="login">← กลับหน้าเข้าสู่ระบบ</button></div>')
}

async function doRegG(){
  var fn=gv('gfn'),ln=gv('gln'),sid=gv('gsid'),pos=gv('gpos'),pw=gv('gpw'),pw2=gv('gpw2'),gemail=gv('gemail').trim();
  var a=$e('reg-alert'); if(!a)return;
  if(!fn||!ln||!sid||!pos||!pw||!gemail){a.innerHTML=alrtH('er','กรุณากรอกข้อมูลให้ครบทุกช่อง');return}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gemail)){a.innerHTML=alrtH('er','รูปแบบอีเมลไม่ถูกต้อง');return}
  var _slen=+(SETT&&SETT.student_id_length)||10, _ssfx=(SETT&&SETT.student_id_suffix)||'27';
  if(!(new RegExp('^\\d{'+_slen+'}$')).test(sid)||sid.slice(-_ssfx.length)!==_ssfx){a.innerHTML=alrtH('er','รหัสนิสิตไม่ถูกต้อง ('+_slen+' หลัก ลงท้ายด้วย '+_ssfx+')');return}
  if(pw.length<6){a.innerHTML=alrtH('er','รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');return}
  if(pw!==pw2){a.innerHTML=alrtH('er','รหัสผ่านทั้งสองช่องไม่ตรงกัน');return}
  a.innerHTML='<div class="al al-in"><span class="sp sp-dark"></span><span> กำลังบันทึก...</span></div>';
  var {data,error}=await sb.auth.signUp({email:gemail,password:pw,options:{data:{
    full_name:fn+' '+ln,student_id:sid,position_code:pos,role_code:PR[pos]||'ROLE-CRT',
    department:'กนค.',user_type:'gnk',contact_email:gemail
  }}});
  if(error){a.innerHTML=alrtH('er',error.message==='User already registered'?'อีเมลนี้มีการสมัครแล้ว':error.message);return}
  try{await sb.auth.signOut();}catch(e){} // สมัครแล้วต้องรออนุมัติ ยังไม่ให้เข้าระบบทันที
  a.innerHTML=alrtH('ok','สมัครสำเร็จ! กรุณารอผู้ดูแลระบบอนุมัติก่อนเข้าใช้งาน');
  setTimeout(function(){closeRegPopup()},2200)
}

async function doRegS(){
  var nm=gv('snm'),tp=gv('stp')||'advisor',em=gv('sem'),dp2=gv('sdp'),pw=gv('spw'),pw2=gv('spw2');
  var a=$e('reg-alert'); if(!a)return;
  if(!nm||!em||!pw){a.innerHTML=alrtH('er','กรุณากรอกข้อมูลให้ครบ');return}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)){a.innerHTML=alrtH('er','รูปแบบอีเมลไม่ถูกต้อง');return}
  if(pw.length<6){a.innerHTML=alrtH('er','รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');return}
  if(pw!==pw2){a.innerHTML=alrtH('er','รหัสผ่านทั้งสองช่องไม่ตรงกัน');return}
  a.innerHTML='<div class="al al-in"><span class="sp sp-dark"></span><span> กำลังบันทึก...</span></div>';
  var {data,error}=await sb.auth.signUp({email:em,password:pw,options:{data:{
    full_name:nm,role_code:tp==='advisor'?'ROLE-ADV':'ROLE-STF',
    department:dp2||'สำนักกิจการนิสิต',user_type:tp,contact_email:em
  }}});
  if(error){a.innerHTML=alrtH('er',error.message==='User already registered'?'อีเมลนี้มีการสมัครแล้ว':error.message);return}
  try{await sb.auth.signOut();}catch(e){}
  a.innerHTML=alrtH('ok','สมัครสำเร็จ! กรุณารอผู้ดูแลระบบอนุมัติ');
  setTimeout(function(){closeRegPopup()},2200)
}

/* ─── CHANGE PW POPUP (login page) ─── */
function showRegGnkPopup(){
  if(document.getElementById('regpopup')) return;
  var pOpts = POSS.map(function(p){
    return '<option value="'+p+'">'+p+' — '+PTH[p]+'</option>'
  }).join('');
  var el = document.createElement('div');
  el.id = 'regpopup';
  el.className = 'cpopup-overlay';
  el.innerHTML =
    '<div class="cpopup-box" style="max-width:480px">'+
      '<div class="cpopup-head">'+
        '<div style="flex:1"><div class="cpopup-head-title">สมัครสมาชิก กนค.</div>'+
        '<div class="cpopup-head-sub">รอผู้ดูแลระบบอนุมัติก่อนเข้าใช้งาน</div></div>'+
        '<button class="cpopup-close" data-action="closeRegPopup">'+svg('x',14)+'</button>'+
      '</div>'+
      '<div class="cpopup-body" style="max-height:70vh;overflow-y:auto">'+
        '<div id="reg-alert"></div>'+
        '<div class="fr">'+
          '<div class="fg"><label class="fl">ชื่อ <span class="req">*</span></label>'+
          '<input id="gfn" class="fi" placeholder="ชื่อ"></div>'+
          '<div class="fg"><label class="fl">นามสกุล <span class="req">*</span></label>'+
          '<input id="gln" class="fi" placeholder="นามสกุล"></div>'+
        '</div>'+
        '<div class="fg"><label class="fl">รหัสนิสิต <span class="req">*</span></label>'+
        '<input id="gsid" class="fi" placeholder="เช่น 6601012327" maxlength="'+(+(SETT&&SETT.student_id_length)||10)+'" oninput="chkSid()">'+
        '<p class="hint muted" id="sidh">รหัสนิสิต '+(+(SETT&&SETT.student_id_length)||10)+' หลัก — '+(+(SETT&&SETT.student_id_suffix||'27').length)+' ตัวสุดท้ายต้องเป็น '+((SETT&&SETT.student_id_suffix)||'27')+'</p></div>'+
        '<div class="fg"><label class="fl">อีเมลติดต่อ <span class="req">*</span></label>'+
        '<input id="gemail" class="fi" type="email" placeholder="ใช้สำหรับรับการแจ้งเตือน"></div>'+
        '<div class="fg"><label class="fl">ตำแหน่งใน กนค. <span class="req">*</span></label>'+
        '<select id="gpos" class="fi"><option value="">— เลือกตำแหน่ง —</option>'+pOpts+'</select></div>'+
        '<div class="fr">'+
          '<div class="fg"><label class="fl">รหัสผ่าน <span class="req">*</span></label>'+
          '<input id="gpw" class="fi" type="password" placeholder="อย่างน้อย 6 ตัว"></div>'+
          '<div class="fg"><label class="fl">ยืนยันรหัสผ่าน <span class="req">*</span></label>'+
          '<input id="gpw2" class="fi" type="password" placeholder="ยืนยัน"></div>'+
        '</div>'+
        '<button class="btn btn-primary fw" data-action="regG">สมัครสมาชิก กนค.</button>'+
      '</div>'+
    '</div>';
  el.addEventListener('click', function(ev){ if(ev.target === el) closeRegPopup() });
  document.body.appendChild(el);
}


function showRegStaffPopup() {
  if (document.getElementById('regpopup')) return;
  var el = document.createElement('div');
  el.id = 'regpopup';
  el.className = 'cpopup-overlay';
  el.innerHTML =
    '<div class="cpopup-box" style="max-width:480px">'+
      '<div class="cpopup-head">'+
        '<div style="flex:1"><div class="cpopup-head-title">สมัครสมาชิก อาจารย์ / เจ้าหน้าที่</div>'+
        '<div class="cpopup-head-sub">รอผู้ดูแลระบบอนุมัติก่อนเข้าใช้งาน</div></div>'+
        '<button class="cpopup-close" data-action="closeRegPopup">'+svg('x',14)+'</button>'+
      '</div>'+
      '<div class="cpopup-body" style="max-height:85vh;overflow-y:auto">'+
        '<div id="reg-alert"></div>'+
        '<div class="fr">'+
          '<div class="fg"><label class="fl">ชื่อ-นามสกุล <span class="req">*</span></label>'+
          '<input id="snm" class="fi" placeholder="ชื่อ นามสกุล"></div>'+
          '<div class="fg"><label class="fl">ประเภท <span class="req">*</span></label>'+
          '<select id="stp" class="fi">'+
            '<option value="advisor">อาจารย์กิจการนิสิต</option>'+
            '<option value="staff">เจ้าหน้าที่กิจการ</option>'+
          '</select></div>'+
        '</div>'+
        '<div class="fg"><label class="fl">อีเมล <span class="req">*</span></label>'+
        '<input id="sem" class="fi" type="email" placeholder="email@university.ac.th"></div>'+
        '<div class="fg"><label class="fl">ฝ่าย / หน่วยงาน</label>'+
        '<input id="sdp" class="fi" placeholder="เช่น สำนักกิจการนิสิต"></div>'+
        '<div class="fr">'+
          '<div class="fg"><label class="fl">รหัสผ่าน <span class="req">*</span></label>'+
          '<input id="spw" class="fi" type="password" placeholder="อย่างน้อย 6 ตัว"></div>'+
          '<div class="fg"><label class="fl">ยืนยันรหัสผ่าน <span class="req">*</span></label>'+
          '<input id="spw2" class="fi" type="password" placeholder="ยืนยัน"></div>'+
        '</div>'+
        '<button class="btn btn-primary fw" data-action="regS">สมัครสมาชิก</button>'+
      '</div>'+
    '</div>';
  el.addEventListener('click', function(ev) { if (ev.target === el) closeRegPopup() });
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
        /* [UX] sub-text ชัดขึ้น — ระบุว่าต้องทราบรหัสเดิม */
        '<div class="cpopup-head-sub">ต้องทราบรหัสผ่านปัจจุบันก่อนตั้งรหัสใหม่</div></div>'+
        '<button class="cpopup-close" data-action="closeChangePwPopup">'+svg('x',14)+'</button>'+
      '</div>'+
      '<div class="cpopup-body">'+
        '<div id="cpw-alert"></div>'+
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
  var al=$e('cpw-alert'); if(!al) return;
  if(!u||!old||!nw||!nw2){al.innerHTML=alrtH('er','กรุณากรอกข้อมูลให้ครบทุกช่อง');return}
  if(nw.length<6){al.innerHTML=alrtH('er','รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');return}
  if(nw!==nw2){al.innerHTML=alrtH('er','รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน');return}
  al.innerHTML='<div class="al al-in"><span class="sp sp-dark"></span><span> กำลังตรวจสอบ...</span></div>';
  try{
    var email=u;
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u)){
      var _rr=await sb.rpc('resolve_login_email',{identifier:u});
      email=(_rr&&_rr.data)||u;
    }
    // verify รหัสผ่านเดิมด้วยการลอง sign in จริง (Supabase Auth เป็นคนเช็คให้ ไม่ต้องเก็บ hash เองแล้ว)
    var _si=await sb.auth.signInWithPassword({email:email,password:old});
    if(_si.error||!_si.data||!_si.data.session){al.innerHTML=alrtH('er','รหัสผ่านปัจจุบันไม่ถูกต้อง หรือไม่พบบัญชีผู้ใช้นี้');return}
    H.Authorization='Bearer '+_si.data.session.access_token;
    var {error}=await sb.auth.updateUser({password:nw});
    await sb.auth.signOut(); // หน้านี้แค่เปลี่ยนรหัส ไม่ใช่ login เข้าระบบ
    if(error){al.innerHTML=alrtH('er',error.message);return}
    al.innerHTML=alrtH('ok','เปลี่ยนรหัสผ่านสำเร็จ! กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่');
    setTimeout(function(){closeChangePwPopup()},1800)
  }catch(e){
    console.error('doChangePwLogin:',e);
    al.innerHTML=alrtH('er','เกิดข้อผิดพลาด กรุณาลองใหม่')
  }
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
  if(nw.length<6){al.innerHTML=alrtH('er','รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');return}
  if(nw!==nw2){al.innerHTML=alrtH('er','รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน');return}
  al.innerHTML='<div class="al al-in"><span class="sp sp-dark"></span><span> กำลังตรวจสอบ...</span></div>';
  try{
    var _si=await sb.auth.signInWithPassword({email:CU.email,password:old});
    if(_si.error){al.innerHTML=alrtH('er','รหัสผ่านปัจจุบันไม่ถูกต้อง');return}
    al.innerHTML='<div class="al al-in"><span class="sp sp-dark"></span><span> กำลังบันทึก...</span></div>';
    var {error}=await sb.auth.updateUser({password:nw});
    if(error){al.innerHTML=alrtH('er',error.message);return}
    al.innerHTML=alrtH('ok','เปลี่ยนรหัสผ่านสำเร็จแล้ว!');
    setTimeout(function(){var mw=$e('mwrap');if(mw)mw.innerHTML=''},1500)
  }catch(e){
    console.error('doChangePw:',e);
    al.innerHTML=alrtH('er','เกิดข้อผิดพลาด กรุณาลองใหม่')
  }
}

function _togglePwVis(inputId,btnId){
  var inp=$e(inputId||'lp'), btn=$e(btnId||'lp-eye');
  if(!inp||!btn) return;
  var show=inp.type==='password';
  inp.type=show?'text':'password';
  btn.innerHTML=show
    ?'<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/><line x1="2" y1="2" x2="14" y2="14"/></svg>'
    :svg('eye',16);
  btn.style.color=show?'#E83A00':'#a89e99';
}

