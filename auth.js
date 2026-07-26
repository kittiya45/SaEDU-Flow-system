/* ─── SESSION MANAGEMENT ─── */
var _loginAttempts=+(localStorage.getItem('_la')||0);
var _loginLockedUntil=+(localStorage.getItem('_llu')||0);
var _loginBusy=false;
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
      _cleanupSession().then(function(){
        showAuth();
        showAlert('Session หมดอายุ กรุณาเข้าสู่ระบบใหม่','wa');
      });
    }
  },60000);
}
async function _cleanupSession(){
  if(_sesTmr){clearInterval(_sesTmr);_sesTmr=null;}
  document.removeEventListener('click',_actHandler,true);
  document.removeEventListener('keydown',_actHandler,true);
  CU=null;
  // ต้อง await signOut — ไม่งั้นรีเฟรชหน้า login แล้ว boot.js ยังเจอ session เดิมและ login กลับเอง
  try{await sb.auth.signOut();}catch(e){}
}
async function doLogout(){
  if(CU){try{await dp('document_history',{action:'logout',performed_by:CU.id,note:'ออกจากระบบ'});}catch(e){}}
  await _cleanupSession();
  showAuth();
}

/* ─── AUTH ─── */
function _authSvgEye(sz){
  sz=sz||16;
  return '<svg width="'+sz+'" height="'+sz+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
}
function _authSvgEyeOff(sz){
  sz=sz||16;
  return '<svg width="'+sz+'" height="'+sz+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>';
}
function _authSvgInfo(sz){
  sz=sz||26;
  return '<svg width="'+sz+'" height="'+sz+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';
}
function _authSvgWarn(sz){
  sz=sz||26;
  return '<svg width="'+sz+'" height="'+sz+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>';
}
function _authAlrtH(t,m){
  var ic={
    ok:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
    er:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>',
    in:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
    wa:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>'
  };
  return '<div class="al al-'+t+' auth-al"><span class="al-icon">'+(ic[t]||ic.in)+'</span><span class="al-msg">'+esc(m)+'</span></div>';
}

function showAuth(){
  var _luDraft='';
  try{_luDraft=sessionStorage.getItem('_luDraft')||'';}catch(e){}
  var loginB = [
    '<div id="lal"></div>',
    '<div class="fg"><label class="fl">ชื่อผู้ใช้ / รหัสนิสิต / อีเมล</label>',
    '<input id="lu" class="fi auth-fi" autocomplete="username" placeholder="กนค.: รหัสนิสิต | อ./จนท.: อีเมล " value="'+esc(_luDraft)+'"></div>',
    '<div class="fg"><label class="fl">รหัสผ่าน</label>',
    '<div class="auth-pw-wrap">',
    '<input id="lp" class="fi auth-fi" type="password" autocomplete="current-password" placeholder="••••••••">',
    '<button type="button" id="lp-eye" class="auth-pw-eye" onclick="_togglePwVis()" title="แสดง/ซ่อนรหัสผ่าน">'+_authSvgEye(16)+'</button>',
    '</div>',
    '<div class="auth-pw-actions">',
    '<button type="button" class="auth-link" data-action="showChangePwPopup">เปลี่ยนรหัสผ่าน</button>',
    '</div></div>',
    '<button type="button" id="btn-login" class="btn btn-primary fw auth-login-btn" data-action="login">เข้าสู่ระบบ</button>',
    '<div class="auth-divider"><span>ยังไม่มีบัญชี?</span></div>',
    '<div class="auth-reg-grid">',
    '<div class="auth-reg-col">',
    '<button type="button" class="btn btn-ghost fw auth-reg-btn" data-action="showRegGnkPopup">สมัคร กนค.</button>',
    '<span class="auth-reg-hint">สำหรับนิสิต กนค.</span>',
    '</div>',
    '<div class="auth-reg-col">',
    '<button type="button" class="btn btn-ghost fw auth-reg-btn" data-action="showRegStaffPopup">สมัคร อ./จนท.</button>',
    '<span class="auth-reg-hint">สำหรับอาจารย์และเจ้าหน้าที่</span>',
    '</div>',
    '</div>',
  ].join('');

  rdr([
    '<div class="auth-root">',
    '<div class="auth-card">',
    '<div class="auth-header">',
    '<div class="auth-orb" aria-hidden="true"></div>',
    '<div class="auth-logo-ring">',
    '<div class="auth-logo-wrap"><img src="img/Logo.png" alt="Logo กนค." class="auth-logo" onerror="this.style.display=\'none\';this.nextSibling.style.display=\'flex\'"><div class="auth-badge hidden">กนค.</div></div>',
    '</div>',
    '<div class="auth-title">SAEDU Flow</div>',
    '<div class="auth-sub">ระบบเสนอเอกสาร คณะกรรมการนิสิต</div>',
    '</div>',
    '<div class="auth-body">',
    loginB,
    '</div></div>',
    '<p class="auth-copy">SAEDUFLOW © 2569</p>',
    '<a href="manual.html?v=3&from=login" class="auth-manual">',
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
    'คู่มือการใช้งาน</a>',
    '</div>'
  ].join(''));

  // Bind enter key + จำชื่อผู้ใช้ชั่วคราว (รีเฟรชหน้าแล้วไม่หาย)
  setTimeout(function(){
    var lu=$e('lu'), lp=$e('lp');
    if(lu){
      lu.addEventListener('keydown',function(e){if(e.key==='Enter')doLogin()});
      lu.addEventListener('input',function(){
        try{sessionStorage.setItem('_luDraft',lu.value);}catch(ex){}
      });
    }
    if(lp) lp.addEventListener('keydown',function(e){if(e.key==='Enter')doLogin()});
  },50);

  _showLoginAnnouncement(); // popup ประกาศ (ถ้ามีเปิดไว้) — fail-silent
}

/* ─── Popup ประกาศหน้า Login ───
   ค่าอยู่ใน app_settings (key ขึ้นต้น login_announcement) — anon อ่านได้เฉพาะ key กลุ่มนี้
   ผ่าน policy app_settings_login_announce (supabase/17_create_dev_role.sql)
   จัดการเปิด/ปิด/แก้ข้อความได้ในแท็บ "ตั้งค่า & ประกาศ" ของ Dev Panel */
async function _showLoginAnnouncement(){
  try{
    var rows=await dg('app_settings','?key=like.login_announcement*&select=key,value');
    if(!Array.isArray(rows)||!rows.length) return;
    var m={}; rows.forEach(function(r){m[r.key]=r.value});
    if(m.login_announcement_active!=='true'||!(m.login_announcement||'').trim()) return;
    // ปิดแล้วไม่เด้งซ้ำใน session เดิม — แต่ถ้าแก้ข้อความใหม่ ประกาศใหม่จะเด้งอีกครั้ง
    var sig='la|'+(m.login_announcement_title||'')+'|'+m.login_announcement;
    try{if(sessionStorage.getItem('_laDismiss')===sig) return;}catch(e){}
    _renderLoginAnnouncePopup({
      title:m.login_announcement_title||'ประกาศ',
      msg:m.login_announcement,
      type:m.login_announcement_type||'info'
    },function(){try{sessionStorage.setItem('_laDismiss',sig);}catch(e){}});
  }catch(e){}
}

/* วาด popup ประกาศ — แยกเป็นฟังก์ชันเพื่อให้ Dev Panel เรียกพรีวิวได้ด้วย (o:{title,msg,type}) */
function _renderLoginAnnouncePopup(o,onClose){
  var old=document.getElementById('login-announce'); if(old) old.remove();
  var th={
    info:   {bg:'#DBEAFE',cl:'#2563EB',ic:'info'},
    warning:{bg:'#FEF3C7',cl:'#D97706',ic:'warn'},
    error:  {bg:'#FEE2E2',cl:'#DC2626',ic:'warn'}
  }[o.type]||{bg:'#DBEAFE',cl:'#2563EB',ic:'info'};
  var el=document.createElement('div');
  el.id='login-announce';
  el.className='cpopup-overlay';
  el.innerHTML=
    '<div class="cpopup-box la-popup-box">'+
      '<div class="cpopup-body la-popup-body">'+
        '<div class="la-popup-icon" style="background:'+th.bg+';color:'+th.cl+'">'+(o.type==='warning'||o.type==='error'?_authSvgWarn(26):_authSvgInfo(26))+'</div>'+
        '<div class="la-popup-title">'+esc(o.title||'ประกาศ')+'</div>'+
        '<div class="la-popup-msg">'+esc(o.msg||'')+'</div>'+
        '<button class="btn btn-primary fw la-popup-btn" id="login-announce-ok">รับทราบ</button>'+
      '</div>'+
    '</div>';
  var close=function(){el.remove();if(onClose)onClose();};
  el.addEventListener('click',function(e){if(e.target===el)close();});
  document.body.appendChild(el);
  var ok=document.getElementById('login-announce-ok');
  if(ok) ok.addEventListener('click',close);
  _lcr();
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

function _setLoginBusy(busy){
  _loginBusy=busy;
  var btn=$e('btn-login');
  if(btn){
    btn.disabled=busy;
    btn.innerHTML=busy?'<span class="sp" style="margin-right:8px"></span>กำลังเข้าสู่ระบบ...':'เข้าสู่ระบบ';
  }
  ['lu','lp','lp-eye'].forEach(function(id){
    var el=$e(id); if(el) el.disabled=!!busy;
  });
  document.querySelectorAll('.auth-body [data-action="showChangePwPopup"],.auth-body .auth-reg-btn').forEach(function(el){
    el.disabled=!!busy;
    el.style.pointerEvents=busy?'none':'';
    el.style.opacity=busy?'0.55':'';
  });
  if(busy) _showLoginBusyPopup();
  else _hideLoginBusyPopup();
}

/* Popup ระหว่างยืนยันตัวตน — ปิดเองเมื่อสำเร็จ/ล้มเหลว ห้ามคลิกปิด */
function _showLoginBusyPopup(){
  if(document.getElementById('login-busy')) return;
  var el=document.createElement('div');
  el.id='login-busy';
  el.className='cpopup-overlay login-busy-overlay';
  el.setAttribute('role','status');
  el.setAttribute('aria-live','polite');
  el.setAttribute('aria-busy','true');
  el.innerHTML=
    '<div class="cpopup-box login-busy-box">'+
      '<div class="cpopup-body login-busy-body">'+
        '<div class="login-busy-spin" aria-hidden="true"><span class="sp sp-dark login-busy-sp"></span></div>'+
        '<div class="login-busy-title">กำลังเข้าสู่ระบบ</div>'+
        '<div class="login-busy-msg">กำลังตรวจสอบบัญชีของคุณ กรุณารอสักครู่…</div>'+
      '</div>'+
    '</div>';
  document.body.appendChild(el);
}
function _hideLoginBusyPopup(){
  var el=document.getElementById('login-busy');
  if(el) el.remove();
}

async function doLogin(){
  if(_loginBusy) return;
  var u=gv('lu').trim(),p=gv('lp'),a=$e('lal');if(!a)return;
  if(!u||!p){a.innerHTML=_authAlrtH('er','กรุณากรอกข้อมูลให้ครบ');return}
  if(Date.now()<_loginLockedUntil){
    // [UX] countdown timer อัปเดตทุก 1 วินาที แทนแสดงครั้งเดียว
    var _updateLockMsg=function(){
      var remain=_loginLockedUntil-Date.now();
      if(remain<=0){if(a)a.innerHTML='';return;}
      var secs=Math.ceil(remain/1000);
      var mins=Math.floor(secs/60);
      var s2=secs%60;
      var timeStr=mins>0?(mins+' นาที '+(s2>0?s2+' วินาที':'')):(secs+' วินาที');
      if(a)a.innerHTML=_authAlrtH('er','พยายามเข้าสู่ระบบผิดพลาดหลายครั้ง กรุณารอ '+timeStr);
      setTimeout(_updateLockMsg,1000);
    };
    _updateLockMsg();
    return;
  }
  _setLoginBusy(true);
  a.innerHTML='';
  try{
    var email=u;
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u)){
      // ไม่ใช่รูปแบบอีเมล — สมมติว่าเป็นรหัสนิสิต แปลงเป็นอีเมลผ่าน RPC ก่อน (RLS ไม่ยอมให้ query ตาราง users ตรงๆตอนยังไม่ login)
      var _rr=await sb.rpc('resolve_login_email',{identifier:u});
      email=(_rr&&_rr.data)||u;
    }
    var _si=await sb.auth.signInWithPassword({email:email,password:p});
    if(_si.error||!_si.data||!_si.data.session){
      // อีเมลยังไม่ยืนยัน — รหัสผ่านถูกแล้ว อย่าแสดงว่า "รหัสผิด" และอย่านับเป็นความพยายามล้มเหลว
      var _ec=String((_si.error&&(_si.error.code||_si.error.message))||'').toLowerCase();
      if(_ec.indexOf('email_not_confirmed')>=0||_ec.indexOf('email not confirmed')>=0){
        a.innerHTML=_authAlrtH('wa','บัญชีนี้ยังไม่ได้ยืนยันอีเมล — กรุณากดลิงก์ยืนยันในกล่องจดหมาย (เช็คถัง Spam ด้วย) แล้วลองใหม่');
        _setLoginBusy(false);
        return;
      }
      _loginAttempts++;
      localStorage.setItem('_la',_loginAttempts);
      if(_loginAttempts>=5){
        _loginLockedUntil=Date.now()+15*60*1000;_loginAttempts=0;
        localStorage.setItem('_llu',_loginLockedUntil);
        localStorage.setItem('_la','0');
        a.innerHTML=_authAlrtH('er','พยายามเข้าสู่ระบบผิดพลาดหลายครั้งเกินไป กรุณารอ 15 นาที');
      } else {
        a.innerHTML=_authAlrtH('er','ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      }
      _setLoginBusy(false);
      return;
    }
    H.Authorization='Bearer '+_si.data.session.access_token;
    var rows=await dg('users','?auth_uid=eq.'+_si.data.user.id);
    var row=rows&&rows[0];
    var ok=await _enterAppAsUser(row,{logLogin:true,onError:function(msg){a.innerHTML=_authAlrtH('er',msg);_setLoginBusy(false);}});
    if(!ok){_setLoginBusy(false);return;}
    _loginAttempts=0;
    localStorage.setItem('_la','0');
    localStorage.removeItem('_llu');
    try{sessionStorage.removeItem('_luDraft');}catch(e){}
    _hideLoginBusyPopup(); // สำเร็จแล้ว — ลบ popup ออกจาก body (rdr ไม่ลบ element นอก #app)
  }catch(e){
    console.error('doLogin:',e);
    a.innerHTML=_authAlrtH('er','เกิดข้อผิดพลาด กรุณาลองใหม่');
    _setLoginBusy(false);
  }
}

/* ─── เข้าสู่แอปจริงหลังยืนยันตัวตนสำเร็จแล้ว (ใช้ทั้ง doLogin และ boot.js ตอน restore session) ─── */
async function _enterAppAsUser(row,opts){
  opts=opts||{};
  if(!row||row.approval_status==='pending'){
    _hideLoginBusyPopup();
    await sb.auth.signOut();showPend();return false
  }
  if(row.approval_status!=='approved'||!row.is_active){
    await sb.auth.signOut();
    if(opts.onError)opts.onError('บัญชีนี้ไม่สามารถใช้งานได้ กรุณาติดต่อผู้ดูแลระบบ');
    return false
  }
  if(row.user_type==='gnk'){
    var _gnkStart=typeof gnkAccountStartDate==='function'?gnkAccountStartDate():null;
    if(_gnkStart&&new Date()<_gnkStart){
      await sb.auth.signOut();
      if(opts.onError)opts.onError('บัญชี กนค. เริ่มใช้งานได้ตั้งแต่วันที่ 20 พฤษภาคม 2569');
      return false
    }
    if(row.expires_at&&new Date(row.expires_at)<new Date()){
      if(row.is_active) try{await dpa('users',row.id,{is_active:false});}catch(e){}
      await sb.auth.signOut();
      if(opts.onError)opts.onError('บัญชีนี้หมดอายุแล้ว กรุณาติดต่อเจ้าหน้าที่เพื่อต่ออายุการใช้งาน');
      return false
    }
  }
  CU=row;
  if(opts.logLogin){try{await dp('document_history',{action:'login',performed_by:CU.id,note:'เข้าสู่ระบบ'});}catch(e){}}
  _startSessionTimer();
  await loadDocTypes();
  await loadAppSettings();
  await loadProjects();
  if(!await _ensureHomeViews()){
    if(opts.onError)opts.onError('โหลดหน้าภาพรวมไม่สำเร็จ — ลอง hard refresh (Cmd+Shift+R) หรือปิด ad blocker');
    return false;
  }
  // นักพัฒนา (ROLE-DEV) เข้าระบบแล้วไปหน้าเครื่องมือนักพัฒนาเลย — เป็นหน้าหลักของ role นี้
  await nav(CU.role_code==='ROLE-DEV'?'dev':'dash');
  // overdue: cron รายวัน (check-overdue) — fallback ตอน login เฉพาะเมื่อปิด cron ใน app_settings
  try{await sendOverdueNotifs();}catch(e){console.warn('Overdue check failed:',e)}
  return true
}

function showPend(){
  rdr('<div class="pending-page"><div class="text-[64px] mb-4">⏳</div><div class="t1 mb-2.5">รอการอนุมัติ</div><p class="text-[#6b6560] max-w-[320px] leading-[1.8] mb-6">บัญชีของคุณอยู่ระหว่างการตรวจสอบ<br>กรุณารอผู้ดูแลระบบอนุมัติก่อนเข้าใช้งาน</p><button class="btn btn-ghost" data-action="auth" data-tab="login">← กลับหน้าเข้าสู่ระบบ</button></div>')
}

async function doRegG(){
  var fn=gv('gfn'),ln=gv('gln'),sid=gv('gsid'),pos=gv('gpos'),pw=gv('gpw'),pw2=gv('gpw2'),gemail=gv('gemail').trim();
  var a=$e('reg-alert'); if(!a)return;
  if(!fn||!ln||!sid||!pos||!pw||!gemail){a.innerHTML=_authAlrtH('er','กรุณากรอกข้อมูลให้ครบทุกช่อง');return}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gemail)){a.innerHTML=_authAlrtH('er','รูปแบบอีเมลไม่ถูกต้อง');return}
  var _slen=+(SETT&&SETT.student_id_length)||10, _ssfx=(SETT&&SETT.student_id_suffix)||'27';
  if(!(new RegExp('^\\d{'+_slen+'}$')).test(sid)||sid.slice(-_ssfx.length)!==_ssfx){a.innerHTML=_authAlrtH('er','รหัสนิสิตไม่ถูกต้อง ('+_slen+' หลัก ลงท้ายด้วย '+_ssfx+')');return}
  if(pw.length<6){a.innerHTML=_authAlrtH('er','รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');return}
  if(pw!==pw2){a.innerHTML=_authAlrtH('er','รหัสผ่านทั้งสองช่องไม่ตรงกัน');return}
  a.innerHTML=_authAlrtH('in','กำลังบันทึก...');
  var {data,error}=await sb.auth.signUp({email:gemail,password:pw,options:{data:{
    full_name:fn+' '+ln,student_id:sid,position_code:pos,role_code:PR[pos]||'ROLE-CRT',
    department:'กนค.',user_type:'gnk',contact_email:gemail
  }}});
  if(error){a.innerHTML=_authAlrtH('er',error.message==='User already registered'?'อีเมลนี้มีการสมัครแล้ว':error.message);return}
  try{await sb.auth.signOut();}catch(e){} // สมัครแล้วต้องรออนุมัติ ยังไม่ให้เข้าระบบทันที
  a.innerHTML=_authAlrtH('ok','สมัครสำเร็จ! กรุณารอผู้ดูแลระบบอนุมัติก่อนเข้าใช้งาน');
  setTimeout(function(){closeRegPopup()},2200)
}

async function doRegS(){
  var nm=gv('snm'),tp=gv('stp')||'advisor',em=gv('sem'),dp2=gv('sdp'),pw=gv('spw'),pw2=gv('spw2');
  var a=$e('reg-alert'); if(!a)return;
  if(!nm||!em||!pw){a.innerHTML=_authAlrtH('er','กรุณากรอกข้อมูลให้ครบ');return}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)){a.innerHTML=_authAlrtH('er','รูปแบบอีเมลไม่ถูกต้อง');return}
  if(pw.length<6){a.innerHTML=_authAlrtH('er','รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');return}
  if(pw!==pw2){a.innerHTML=_authAlrtH('er','รหัสผ่านทั้งสองช่องไม่ตรงกัน');return}
  a.innerHTML=_authAlrtH('in','กำลังบันทึก...');
  var {data,error}=await sb.auth.signUp({email:em,password:pw,options:{data:{
    full_name:nm,role_code:tp==='advisor'?'ROLE-ADV':'ROLE-STF',
    department:dp2||'สำนักกิจการนิสิต',user_type:tp,contact_email:em
  }}});
  if(error){a.innerHTML=_authAlrtH('er',error.message==='User already registered'?'อีเมลนี้มีการสมัครแล้ว':error.message);return}
  try{await sb.auth.signOut();}catch(e){}
  a.innerHTML=_authAlrtH('ok','สมัครสำเร็จ! กรุณารอผู้ดูแลระบบอนุมัติ');
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
            '<option value="advisor">อาจารย์ที่ปรึกษาชมรม</option>'+
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
        '<div class="al al-in auth-al text-xs mb-3.5"><span class="al-icon">'+_authSvgInfo(13)+'</span><span class="al-msg">กรอกข้อมูลเพื่อตั้งรหัสผ่านใหม่ โดยต้องทราบรหัสผ่านเดิมก่อน</span></div>'+
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
  if(!u||!old||!nw||!nw2){al.innerHTML=_authAlrtH('er','กรุณากรอกข้อมูลให้ครบทุกช่อง');return}
  if(nw.length<6){al.innerHTML=_authAlrtH('er','รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');return}
  if(nw!==nw2){al.innerHTML=_authAlrtH('er','รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน');return}
  al.innerHTML=_authAlrtH('in','กำลังตรวจสอบ...');
  try{
    var email=u;
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u)){
      var _rr=await sb.rpc('resolve_login_email',{identifier:u});
      email=(_rr&&_rr.data)||u;
    }
    // verify รหัสผ่านเดิมด้วยการลอง sign in จริง (Supabase Auth เป็นคนเช็คให้ ไม่ต้องเก็บ hash เองแล้ว)
    var _si=await sb.auth.signInWithPassword({email:email,password:old});
    if(_si.error||!_si.data||!_si.data.session){al.innerHTML=_authAlrtH('er','รหัสผ่านปัจจุบันไม่ถูกต้อง หรือไม่พบบัญชีผู้ใช้นี้');return}
    H.Authorization='Bearer '+_si.data.session.access_token;
    var {error}=await sb.auth.updateUser({password:nw});
    await sb.auth.signOut(); // หน้านี้แค่เปลี่ยนรหัส ไม่ใช่ login เข้าระบบ
    if(error){al.innerHTML=_authAlrtH('er',error.message);return}
    al.innerHTML=_authAlrtH('ok','เปลี่ยนรหัสผ่านสำเร็จ! กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่');
    setTimeout(function(){closeChangePwPopup()},1800)
  }catch(e){
    console.error('doChangePwLogin:',e);
    al.innerHTML=_authAlrtH('er','เกิดข้อผิดพลาด กรุณาลองใหม่')
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
  if(!old||!nw||!nw2){al.innerHTML=_authAlrtH('er','กรุณากรอกข้อมูลให้ครบทุกช่อง');return}
  if(nw.length<6){al.innerHTML=_authAlrtH('er','รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');return}
  if(nw!==nw2){al.innerHTML=_authAlrtH('er','รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน');return}
  al.innerHTML=_authAlrtH('in','กำลังตรวจสอบ...');
  try{
    var _si=await sb.auth.signInWithPassword({email:CU.email,password:old});
    if(_si.error){al.innerHTML=_authAlrtH('er','รหัสผ่านปัจจุบันไม่ถูกต้อง');return}
    al.innerHTML=_authAlrtH('in','กำลังบันทึก...');
    var {error}=await sb.auth.updateUser({password:nw});
    if(error){al.innerHTML=_authAlrtH('er',error.message);return}
    al.innerHTML=_authAlrtH('ok','เปลี่ยนรหัสผ่านสำเร็จแล้ว!');
    setTimeout(function(){var mw=$e('mwrap');if(mw)mw.innerHTML=''},1500)
  }catch(e){
    console.error('doChangePw:',e);
    al.innerHTML=_authAlrtH('er','เกิดข้อผิดพลาด กรุณาลองใหม่')
  }
}

function _togglePwVis(inputId,btnId){
  var inp=$e(inputId||'lp'), btn=$e(btnId||'lp-eye');
  if(!inp||!btn) return;
  var show=inp.type==='password';
  inp.type=show?'text':'password';
  btn.innerHTML=show?_authSvgEyeOff(16):_authSvgEye(16);
  btn.style.color=show?'#E83A00':'#a89e99';
}

