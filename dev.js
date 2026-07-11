/* ─── DEV PANEL (เครื่องมือนักพัฒนา — เฉพาะ ROLE-DEV) ───
   ระบบนักพัฒนาแยกจากแอดมินทั้งเมนูและสิทธิ์:
   - เมนู: แอดมิน (ROLE-SYS) ไม่เห็น/ไม่เข้าหน้านี้ · นักพัฒนาไม่เข้าหน้า "จัดการระบบ" ของแอดมิน
     แต่ใช้เนื้อหาเดียวกันผ่านแท็บ "จัดการระบบ" ด้านใน (_vSysContent() จาก sysAdmin.js)
   - สิทธิ์ DB: is_dev() แยกจาก is_admin() — เขียนได้เฉพาะตาราง config + UPDATE documents/workflow_steps
     (ซ่อมเอกสาร) + อ่าน log — จัดการผู้ใช้/ลบข้อมูลไม่ได้ (supabase/create_dev_role.sql)
   ทุกการแก้ข้อมูลเอกสารผ่านแท็บ "ซ่อมเอกสาร" จะถูกบันทึกลง document_history เสมอ */

var _devTab='health';      // แท็บที่เปิดอยู่: health | logs | doctool | sysadmin | info
var _devLogTab='syslog';   // แท็บย่อยใน logs: syslog | history | notif
var _devUsers=null;        // cache รายชื่อจาก user_directory (ใช้ใน dropdown ผู้รับผิดชอบขั้นตอน)
var _devCurDocId=null;     // เอกสารที่เปิดใน inspector อยู่

/* นับแถวทั้งตารางผ่าน Content-Range (HEAD + Prefer: count=exact — ไม่ดึงข้อมูลจริง) */
async function _devCount(t,q){
  try{
    var r=await fetch(SU+'/rest/v1/'+t+'?select=id'+(q||'')+'&limit=1',{method:'HEAD',headers:Object.assign({},H,{Prefer:'count=exact'})});
    if(!r.ok) return null;
    var cr=r.headers.get('content-range')||'';
    var n=+cr.split('/')[1];
    return n>=0?n:null;
  }catch(e){return null;}
}

async function vDev(){
  if(CU.role_code!=='ROLE-DEV') return '<div class="card-empty"><div class="card-empty-text">ไม่มีสิทธิ์เข้าถึง — หน้านี้สำหรับบัญชีนักพัฒนา (ROLE-DEV) เท่านั้น</div></div>';

  // ตรวจว่ารัน create_dev_role.sql แล้วหรือยัง (ตาราง system_logs ต้องมีอยู่)
  var _sqlReady=true;
  try{
    var _probe=await dg('system_logs','?select=id&limit=1');
    if(!Array.isArray(_probe)) _sqlReady=false;
  }catch(e){_sqlReady=false;}

  var _pageHeader=
    '<div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;flex-wrap:wrap">'+
      '<div style="width:44px;height:44px;border-radius:14px;background:linear-gradient(135deg,#18120E,#3A332E);display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;box-shadow:0 4px 12px rgba(24,18,14,.3)">'+svg('code',21)+'</div>'+
      '<div>'+
        '<div style="font-size:20px;font-weight:900;color:#18120E;letter-spacing:-.5px;line-height:1.1">เครื่องมือนักพัฒนา</div>'+
        '<div style="font-size:12px;color:#a89e99;margin-top:3px">ตรวจสุขภาพระบบ ดูบันทึก และซ่อมข้อมูลเอกสาร — สำหรับผู้ดูแลด้านเทคนิค</div>'+
      '</div>'+
    '</div>';

  var _sqlWarn=_sqlReady?'':'<div class="al al-wa" style="margin-bottom:16px"><span class="al-icon">'+svg('warn',13)+'</span><span><strong>ยังไม่ได้รัน supabase/create_dev_role.sql</strong> — ตาราง system_logs ยังไม่ถูกสร้าง และบัญชี ROLE-DEV จะยังไม่มีสิทธิ์ฝั่งฐานข้อมูล ให้รันไฟล์นี้ใน Supabase SQL Editor ก่อน (ดูแท็บ "คู่มือ & ลิงก์")</span></div>';

  var _tabs=[
    {k:'health',  ico:'activity',    label:'สุขภาพระบบ'},
    {k:'logs',    ico:'scroll-text', label:'บันทึกระบบ'},
    {k:'doctool', ico:'wrench',      label:'ซ่อมเอกสาร'},
    {k:'sandbox', ico:'flask-conical',label:'ทดสอบระบบ'},
    {k:'sysadmin',ico:'gear',        label:'จัดการระบบ'},
    {k:'info',    ico:'book-open',   label:'คู่มือ & ลิงก์'}
  ];
  var tabNav='<div style="background:#F5F3F0;padding:5px;border-radius:16px;display:flex;gap:3px;margin-bottom:22px;overflow-x:auto;flex-wrap:nowrap">';
  _tabs.forEach(function(t){
    var isAct=t.k===_devTab;
    var activeStyle=isAct?'background:#fff;color:#E83A00;font-weight:800;box-shadow:0 1px 4px rgba(0,0,0,.1);':'background:transparent;color:#6b6560;font-weight:600;';
    tabNav+='<button style="flex:1;min-width:max-content;padding:8px 14px;border-radius:11px;border:none;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-size:12px;white-space:nowrap;'+activeStyle+'" onclick="setDevTab(\''+t.k+'\')" data-devtab="'+t.k+'">'+svg(t.ico,12)+t.label+'</button>';
  });
  tabNav+='</div>';

  var _panels={
    health:  await _devHealthPanel(_sqlReady),
    logs:    await _devLogsPanel(),
    doctool: _devDocToolPanel(),
    sandbox: _sbxPanel(),
    sysadmin:await _vSysContent({embed:true}),   // เนื้อหาเดียวกับหน้า "จัดการระบบ" ของแอดมิน (ตัด header ใหญ่ออก ไม่ให้หัวข้อซ้อนกัน)
    info:    _devInfoPanel(_sqlReady)
  };
  // ผูก event ของแท็บทดสอบระบบหลัง DOM ถูกวาด (canvas ลายเซ็น + คำนวณ SLA เริ่มต้น)
  setTimeout(function(){_sbxWireSig();_sbxCalcSla();},120);
  var html=_pageHeader+_sqlWarn+tabNav;
  _tabs.forEach(function(t){
    html+='<div id="dev-tab-'+t.k+'" style="display:'+(t.k===_devTab?'block':'none')+'">'+_panels[t.k]+'</div>';
  });
  return html;
}

function setDevTab(tab){
  _devTab=tab;
  ['health','logs','doctool','sandbox','sysadmin','info'].forEach(function(t){
    var el=$e('dev-tab-'+t); if(el) el.style.display=t===tab?'block':'none';
  });
  document.querySelectorAll('[data-devtab]').forEach(function(btn){
    var isAct=btn.dataset.devtab===tab;
    btn.style.background=isAct?'#fff':'transparent';
    btn.style.color=isAct?'#E83A00':'#6b6560';
    btn.style.fontWeight=isAct?'800':'600';
    btn.style.boxShadow=isAct?'0 1px 4px rgba(0,0,0,.1)':'none';
  });
}

/* ═══ แท็บ 1: สุขภาพระบบ ═══ */
async function _devHealthPanel(sqlReady){
  var tables=['documents','users','workflow_steps','document_files','document_history','notifications','system_logs'];
  var labels={documents:'เอกสาร',users:'ผู้ใช้',workflow_steps:'ขั้นตอน',document_files:'ไฟล์แนบ',document_history:'ประวัติ',notifications:'การแจ้งเตือน',system_logs:'Error log'};
  var counts=await Promise.all(tables.map(function(t){return _devCount(t);}));

  var pills=tables.map(function(t,i){
    var n=counts[i];
    return '<div style="display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #EBEBEB;border-radius:12px;padding:9px 14px;box-shadow:0 1px 3px rgba(0,0,0,.04)">'+
      '<div style="width:8px;height:8px;border-radius:50%;background:'+(n===null?'#DC2626':'#16A34A')+';flex-shrink:0"></div>'+
      '<span style="font-size:15px;font-weight:900;color:#18120E;line-height:1">'+(n===null?'—':n)+'</span>'+
      '<span style="font-size:11px;color:#a89e99;font-weight:500;white-space:nowrap">'+labels[t]+'</span>'+
    '</div>';
  }).join('');
  var countCard=
    '<div class="card"><div class="card-head">'+
      '<div style="width:26px;height:26px;border-radius:7px;background:#EFF6FF;display:flex;align-items:center;justify-content:center;color:#2563EB">'+svg('database',13)+'</div>'+
      '<div><div class="card-head-title">จำนวนแถวในตารางหลัก</div>'+
      '<div style="font-size:10px;color:#a89e99;margin-top:1px">จุดแดง = อ่านตารางนั้นไม่ได้ (ตารางไม่มีอยู่ หรือไม่มีสิทธิ์ RLS)</div></div>'+
      '<button class="btn btn-soft sm ml-auto" onclick="nav(\'dev\')">'+svg('refresh',12)+' รีเฟรช</button>'+
    '</div><div class="card-body"><div style="display:flex;gap:8px;flex-wrap:wrap">'+pills+'</div></div></div>';

  // ── ตรวจความสอดคล้อง status เอกสาร ↔ workflow_steps ──
  var issues=[];
  try{
    var docs=await dg('documents','?status=in.(pending,rejected,numbering)&select=id,title,doc_number,status&order=created_at.desc&limit=500');
    if(Array.isArray(docs)&&docs.length){
      var ids=docs.map(function(d){return safeId(d.id)}).join(',');
      var steps=await dg('workflow_steps','?document_id=in.('+ids+')&select=document_id,status,step_number');
      var byDoc={};
      (Array.isArray(steps)?steps:[]).forEach(function(s){(byDoc[s.document_id]=byDoc[s.document_id]||[]).push(s);});
      docs.forEach(function(d){
        var st=byDoc[d.id]||[];
        var hasActive=st.some(function(s){return s.status==='active'});
        var hasRejected=st.some(function(s){return s.status==='rejected'});
        if(d.status==='pending'&&!hasActive&&!hasRejected) issues.push({doc:d,why:'สถานะ "รอลงนาม" แต่ไม่มีขั้นตอนใด active อยู่ — เอกสารค้าง ไม่มีใครได้รับงาน',fixable:true});
        else if(d.status==='pending'&&!hasActive&&hasRejected) issues.push({doc:d,why:'สถานะ "รอลงนาม" แต่มีขั้นตอนถูกตีกลับและไม่มีขั้นตอน active — ควรเป็น "ส่งคืนแก้ไข"',fixable:true});
        else if(d.status==='rejected'&&!hasRejected) issues.push({doc:d,why:'สถานะ "ส่งคืนแก้ไข" แต่ไม่มีขั้นตอนใดมีสถานะ rejected',fixable:true});
        else if(d.status==='numbering'&&(hasActive||hasRejected)) issues.push({doc:d,why:'สถานะ "รอออกเลขหนังสือ" แต่ยังมีขั้นตอนไม่เสร็จ (active/rejected) ค้างอยู่',fixable:false});
      });
    }
  }catch(e){}

  var issueRows=issues.length?issues.map(function(it){
    return '<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-top:1px solid #F9F8F7;flex-wrap:wrap">'+
      '<div style="flex:1;min-width:200px">'+
        '<div style="font-size:12.5px;font-weight:700;color:#18120E">'+esc(it.doc.title||'—')+' <span class="mono" style="font-size:10px;color:#a89e99">'+esc(it.doc.doc_number||'')+'</span></div>'+
        '<div style="font-size:11px;color:#B45309;margin-top:2px;line-height:1.6">'+esc(it.why)+'</div>'+
      '</div>'+
      sBadge(it.doc.status)+
      '<button class="btn btn-soft sm" data-action="nav" data-view="det" data-id="'+it.doc.id+'">'+svg('eye',12)+' เปิดดู</button>'+
      (it.fixable?'<button class="btn btn-primary sm" onclick="_devFixDoc(\''+it.doc.id+'\')">'+svg('wrench',12)+' ซ่อมสถานะ</button>':'')+
    '</div>';
  }).join(''):'<div style="padding:24px 16px;text-align:center;color:#16A34A;font-size:12.5px">'+svg('ok',14)+' ไม่พบเอกสารที่สถานะไม่สอดคล้องกับขั้นตอน</div>';

  var issueCard=
    '<div class="card"><div class="card-head">'+
      '<div style="width:26px;height:26px;border-radius:7px;background:'+(issues.length?'#FEF3C7':'#ECFDF5')+';display:flex;align-items:center;justify-content:center;color:'+(issues.length?'#D97706':'#16A34A')+'">'+svg(issues.length?'warn':'ok',13)+'</div>'+
      '<div><div class="card-head-title">ตรวจความสอดคล้องเอกสาร'+(issues.length?' — พบ '+issues.length+' รายการ':'')+'</div>'+
      '<div style="font-size:10px;color:#a89e99;margin-top:1px">เทียบสถานะเอกสารกับสถานะขั้นตอน (เกิดได้เมื่อการอนุมัติ/ตีกลับเขียนข้อมูลไม่ครบเพราะเน็ตหลุดกลางทาง)</div></div>'+
    '</div><div id="dev-issue-al"></div>'+issueRows+'</div>';

  // ── error ล่าสุดจาก system_logs ──
  var errCard='';
  if(sqlReady){
    var errs=[];
    try{var er=await dg('system_logs','?order=at.desc&limit=5');if(Array.isArray(er))errs=er;}catch(e){}
    var errRows=errs.length?errs.map(function(l){
      return '<div style="padding:9px 16px;border-top:1px solid #F9F8F7">'+
        '<div style="display:flex;gap:8px;align-items:baseline;flex-wrap:wrap"><span class="mono" style="font-size:10px;color:#a89e99">'+fdTime(l.at)+'</span>'+
        '<span style="font-size:10px;font-weight:700;color:#DC2626">'+esc(l.source||'')+'</span></div>'+
        '<div style="font-size:11.5px;color:#18120E;margin-top:2px;word-break:break-word">'+esc(l.message||'')+'</div>'+
      '</div>';
    }).join(''):'<div style="padding:20px 16px;text-align:center;color:#a89e99;font-size:12px">ยังไม่มี error ที่ถูกบันทึก</div>';
    errCard='<div class="card"><div class="card-head">'+
      '<div style="width:26px;height:26px;border-radius:7px;background:#FEF2F2;display:flex;align-items:center;justify-content:center;color:#DC2626">'+svg('bug',13)+'</div>'+
      '<div><div class="card-head-title">Error ล่าสุดจากเบราว์เซอร์ผู้ใช้</div>'+
      '<div style="font-size:10px;color:#a89e99;margin-top:1px">JS error ที่ระบบดักได้เอง — ดูทั้งหมดที่แท็บ "บันทึกระบบ"</div></div>'+
      '<button class="btn btn-soft sm ml-auto" onclick="_devTab=\'logs\';_devLogTab=\'syslog\';nav(\'dev\')">ดูทั้งหมด →</button>'+
    '</div>'+errRows+'</div>';
  }

  return countCard+issueCard+errCard;
}

/* ซ่อมสถานะเอกสารจากแท็บสุขภาพ — ใช้ _reconcileDocState (docDetail.js) แล้วโหลดหน้าใหม่ */
async function _devFixDoc(docId){
  var al=$e('dev-issue-al');
  if(al) al.innerHTML='<div class="al al-in" style="margin:8px 16px"><span class="sp sp-dark"></span><span> กำลังซ่อมสถานะ...</span></div>';
  try{
    await _reconcileDocState(docId);
    try{await dp('document_history',{document_id:docId,action:'ซ่อมสถานะเอกสาร (dev)',performed_by:CU.id,note:'ปรับสถานะให้สอดคล้องกับขั้นตอนโดยเครื่องมือนักพัฒนา'});}catch(e){}
    nav('dev');
  }catch(e){
    if(al) al.innerHTML='<div class="al al-er" style="margin:8px 16px"><span class="al-icon">'+svg('warn',13)+'</span><span>ซ่อมไม่สำเร็จ: '+esc(e.message||String(e))+'</span></div>';
  }
}

/* ═══ แท็บ 2: บันทึกระบบ ═══ */
async function _devLogsPanel(){
  var subs=[
    {k:'syslog', label:'Error log'},
    {k:'history',label:'ประวัติการใช้งาน'},
    {k:'notif',  label:'การแจ้งเตือนที่ส่ง'}
  ];
  var subNav='<div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">'+subs.map(function(s){
    var on=s.k===_devLogTab;
    return '<button class="btn '+(on?'btn-primary':'btn-soft')+' sm" onclick="_devLogTab=\''+s.k+'\';_devReloadLogs()" data-devlogtab="'+s.k+'">'+s.label+'</button>';
  }).join('')+
  '<span style="flex:1"></span>'+
  '<button class="btn btn-soft sm" onclick="_devReloadLogs()">'+svg('refresh',12)+' รีเฟรช</button>'+
  '</div>';
  return subNav+'<div id="dev-log-body">'+await _devLogBody()+'</div>';
}

async function _devReloadLogs(){
  var el=$e('dev-log-body');
  if(!el) return;
  el.innerHTML='<div style="padding:40px;text-align:center;color:#a89e99"><span class="sp sp-dark"></span></div>';
  document.querySelectorAll('[data-devlogtab]').forEach(function(b){
    var on=b.dataset.devlogtab===_devLogTab;
    b.className='btn '+(on?'btn-primary':'btn-soft')+' sm';
  });
  el.innerHTML=await _devLogBody();
}

async function _devLogBody(){
  var _wrap=function(headCols,rows,empty){
    return '<div class="card" style="overflow-x:auto"><div style="min-width:640px">'+
      '<div style="display:flex;gap:10px;padding:9px 16px;border-bottom:1px solid #F5F3F0">'+headCols.map(function(c){
        return '<span style="'+c.style+';font-size:9.5px;font-weight:700;color:#c0b9b4;text-transform:uppercase;letter-spacing:.4px">'+c.label+'</span>';
      }).join('')+'</div>'+
      (rows.length?rows.join(''):'<div style="padding:28px;text-align:center;color:#a89e99;font-size:12px">'+empty+'</div>')+
    '</div></div>';
  };
  var _err=function(hint){return '<div class="al al-wa"><span class="al-icon">'+svg('warn',13)+'</span><span>'+hint+'</span></div>';};

  if(_devLogTab==='syslog'){
    var logs=[];
    try{logs=await dg('system_logs','?order=at.desc&limit=100');}catch(e){}
    if(!Array.isArray(logs)) return _err('อ่านตาราง system_logs ไม่ได้ — ต้องรัน supabase/create_dev_role.sql ก่อน');
    var rows=logs.map(function(l){
      return '<div style="display:flex;gap:10px;padding:9px 16px;border-bottom:1px solid #F9F8F7;align-items:baseline">'+
        '<span class="mono" style="width:110px;flex-shrink:0;font-size:10.5px;color:#a89e99">'+fdTime(l.at)+'</span>'+
        '<span style="width:130px;flex-shrink:0;font-size:10.5px;font-weight:700;color:#DC2626;word-break:break-all">'+esc(l.source||'—')+'</span>'+
        '<span style="flex:1;font-size:11.5px;color:#18120E;word-break:break-word" title="'+esc(l.detail||'')+'">'+esc(l.message||'—')+'</span>'+
      '</div>';
    });
    var clearBtn='<div style="display:flex;justify-content:flex-end;margin-bottom:10px"><button class="btn btn-soft sm" onclick="_devClearOldLogs()">'+svg('trash',12)+' ลบ log ที่เก่ากว่า 30 วัน</button></div>';
    return clearBtn+_wrap([
      {label:'เวลา',style:'width:110px;flex-shrink:0'},
      {label:'จุดที่เกิด',style:'width:130px;flex-shrink:0'},
      {label:'ข้อความ (ชี้ค้างเพื่อดู stack)',style:'flex:1'}
    ],rows,'ยังไม่มี error ที่ถูกบันทึก');
  }

  if(_devLogTab==='history'){
    var hist=[];
    try{hist=await dg('document_history','?order=performed_at.desc&limit=100');}catch(e){}
    if(!Array.isArray(hist)) return _err('อ่าน document_history ไม่ได้');
    var uids=Array.from(new Set(hist.map(function(h){return h.performed_by}).filter(Boolean)));
    var umap={};
    if(uids.length){
      try{
        var us=await dg('user_directory','?id=in.('+uids.map(safeId).join(',')+')&select=id,full_name');
        (Array.isArray(us)?us:[]).forEach(function(u){umap[u.id]=u.full_name;});
      }catch(e){}
    }
    var hrows=hist.map(function(h){
      return '<div style="display:flex;gap:10px;padding:9px 16px;border-bottom:1px solid #F9F8F7;align-items:baseline">'+
        '<span class="mono" style="width:110px;flex-shrink:0;font-size:10.5px;color:#a89e99">'+fdTime(h.performed_at)+'</span>'+
        '<span style="width:150px;flex-shrink:0;font-size:11px;font-weight:700;color:#18120E">'+esc(h.action||'—')+'</span>'+
        '<span style="width:130px;flex-shrink:0;font-size:11px;color:#6b6560">'+esc(umap[h.performed_by]||'—')+'</span>'+
        '<span style="flex:1;font-size:11px;color:#6b6560;word-break:break-word">'+esc(h.note||'')+'</span>'+
        (h.document_id?'<button class="btn btn-soft sm" data-action="nav" data-view="det" data-id="'+h.document_id+'" style="flex-shrink:0">'+svg('eye',11)+'</button>':'')+
      '</div>';
    });
    return _wrap([
      {label:'เวลา',style:'width:110px;flex-shrink:0'},
      {label:'การกระทำ',style:'width:150px;flex-shrink:0'},
      {label:'โดย',style:'width:130px;flex-shrink:0'},
      {label:'หมายเหตุ',style:'flex:1'}
    ],hrows,'ไม่มีข้อมูล');
  }

  // notif
  var nt=[];
  try{nt=await dg('notifications','?order=sent_at.desc&limit=100');}catch(e){}
  if(!Array.isArray(nt)) return _err('อ่าน notifications ไม่ได้ — สิทธิ์อ่านของ ROLE-DEV มาจาก policy notifications_select_dev (ต้องรัน supabase/create_dev_role.sql ก่อน)');
  var nrows=nt.map(function(n){
    var ok=(n.status||'')==='sent'||(n.status||'')==='success';
    return '<div style="display:flex;gap:10px;padding:9px 16px;border-bottom:1px solid #F9F8F7;align-items:baseline">'+
      '<span class="mono" style="width:110px;flex-shrink:0;font-size:10.5px;color:#a89e99">'+fdTime(n.sent_at)+'</span>'+
      '<span style="width:90px;flex-shrink:0;font-size:10.5px;font-weight:700;color:#6b6560">'+esc(n.notification_type||'—')+'</span>'+
      '<span style="width:70px;flex-shrink:0;font-size:10.5px;font-weight:700;color:'+(ok?'#16A34A':'#DC2626')+'">'+esc(n.status||'—')+'</span>'+
      '<span style="width:170px;flex-shrink:0;font-size:11px;color:#6b6560;word-break:break-all">'+esc(n.recipient_email||'—')+'</span>'+
      '<span style="flex:1;font-size:11px;color:#18120E;word-break:break-word">'+esc(n.subject||'')+'</span>'+
    '</div>';
  });
  return _wrap([
    {label:'เวลา',style:'width:110px;flex-shrink:0'},
    {label:'ประเภท',style:'width:90px;flex-shrink:0'},
    {label:'สถานะ',style:'width:70px;flex-shrink:0'},
    {label:'ผู้รับ',style:'width:170px;flex-shrink:0'},
    {label:'หัวข้อ',style:'flex:1'}
  ],nrows,'ไม่มีข้อมูล');
}

async function _devClearOldLogs(){
  showConfirm('ลบ log เก่า','ลบ error log ที่เก่ากว่า 30 วันทั้งหมด?',async function(){
    try{
      var cutoff=new Date(Date.now()-30*24*3600*1000).toISOString();
      var r=await fetch(SU+'/rest/v1/system_logs?at=lt.'+encodeURIComponent(cutoff),{method:'DELETE',headers:{apikey:SK,'Authorization':H.Authorization}});
      if(!r.ok) throw new Error('HTTP '+r.status);
      _devReloadLogs();
    }catch(e){showAlert('ลบไม่สำเร็จ: '+(e.message||e),'er');}
  },{confirmLabel:'ลบ log เก่า'});
}

/* ═══ แท็บ 3: ซ่อมเอกสาร ═══ */
function _devDocToolPanel(){
  return '<div class="al al-wa" style="margin-bottom:14px"><span class="al-icon">'+svg('warn',13)+'</span>'+
    '<span><strong>เครื่องมือนี้แก้ข้อมูลในฐานข้อมูลตรง ๆ</strong> ข้ามการตรวจสอบตามขั้นตอนปกติของระบบ — ใช้เฉพาะเมื่อเข้าใจผลลัพธ์เท่านั้น ทุกการแก้ไขจะถูกบันทึกลงประวัติเอกสารโดยอัตโนมัติ</span></div>'+
    '<div class="card"><div class="card-body">'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
        '<input class="fi" id="dev-doc-q" placeholder="ค้นหาด้วยเลขที่เอกสาร / ชื่อเรื่อง / document id" style="flex:1;min-width:220px" onkeydown="if(event.key===\'Enter\')_devDocSearch()">'+
        '<button class="btn btn-primary sm" onclick="_devDocSearch()">'+svg('srch',13)+' ค้นหา</button>'+
      '</div>'+
      '<div id="dev-doc-results" style="margin-top:12px"></div>'+
    '</div></div>'+
    '<div id="dev-doc-inspector"></div>';
}

async function _devDocSearch(){
  var q=(gv('dev-doc-q')||'').trim();
  var box=$e('dev-doc-results');
  if(!box) return;
  if(!q){box.innerHTML='<div style="font-size:12px;color:#a89e99">พิมพ์คำค้นก่อนค่ะ</div>';return;}
  box.innerHTML='<div style="padding:16px;text-align:center"><span class="sp sp-dark"></span></div>';
  var docs=[];
  try{
    if(/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(q)){
      docs=await dg('documents','?id=eq.'+safeId(q)+'&select=id,title,doc_number,status,doc_type,created_at');
    }else{
      var pat=encodeURIComponent('*'+q.replace(/[(),]/g,' ')+'*');
      docs=await dg('documents','?or=(doc_number.ilike.'+pat+',title.ilike.'+pat+')&select=id,title,doc_number,status,doc_type,created_at&order=created_at.desc&limit=20');
    }
  }catch(e){}
  if(!Array.isArray(docs)){box.innerHTML=alrtH('er','ค้นหาไม่สำเร็จ');return;}
  if(!docs.length){box.innerHTML='<div style="font-size:12px;color:#a89e99;padding:8px 0">ไม่พบเอกสารที่ตรงกับ "'+esc(q)+'"</div>';return;}
  box.innerHTML=docs.map(function(d){
    return '<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border:1px solid #F0EEEB;border-radius:10px;margin-bottom:6px;cursor:pointer;background:#fff" onclick="_devDocInspect(\''+d.id+'\')" onmouseover="this.style.borderColor=\'#E83A00\'" onmouseout="this.style.borderColor=\'#F0EEEB\'">'+
      '<div style="flex:1;min-width:0"><div style="font-size:12.5px;font-weight:700;color:#18120E">'+esc(d.title||'—')+'</div>'+
      '<div class="mono" style="font-size:10px;color:#a89e99;margin-top:1px">'+esc(d.doc_number||'ยังไม่มีเลขที่')+' · '+fd(d.created_at)+'</div></div>'+
      tBadge(d.doc_type)+sBadge(d.status)+
      '<span style="color:#a89e99">›</span>'+
    '</div>';
  }).join('');
}

async function _devDocInspect(docId){
  _devCurDocId=docId;
  var box=$e('dev-doc-inspector');
  if(!box) return;
  box.innerHTML='<div style="padding:24px;text-align:center"><span class="sp sp-dark"></span></div>';
  var doc,steps;
  try{
    doc=(await dg('documents','?id=eq.'+safeId(docId)))[0];
    steps=await dg('workflow_steps','?document_id=eq.'+safeId(docId)+'&order=step_number');
  }catch(e){}
  if(!doc){box.innerHTML=alrtH('er','โหลดเอกสารไม่สำเร็จ');return;}
  if(!Array.isArray(steps)) steps=[];
  if(!_devUsers){
    try{
      var us=await dg('user_directory','?select=id,full_name,role_code,position_code&order=full_name&limit=500');
      _devUsers=Array.isArray(us)?us:[];
    }catch(e){_devUsers=[];}
  }

  var stOpts=['draft','pending','rejected','numbering','completed'].map(function(s){
    return '<option value="'+s+'"'+(doc.status===s?' selected':'')+'>'+(STTH[s]||s)+' ('+s+')</option>';
  }).join('');

  var stepRows=steps.length?steps.map(function(s){
    var sOpts=['pending','active','done','rejected'].map(function(x){
      return '<option value="'+x+'"'+(s.status===x?' selected':'')+'>'+x+'</option>';
    }).join('');
    var uOpts='<option value="">— ไม่ระบุ —</option>'+_devUsers.map(function(u){
      return '<option value="'+u.id+'"'+(s.assigned_to===u.id?' selected':'')+'>'+esc(u.full_name)+(PTH[u.position_code]?' — '+esc(PTH[u.position_code]):(RTH[u.role_code]?' — '+RTH[u.role_code]:''))+'</option>';
    }).join('');
    return '<div style="display:grid;grid-template-columns:34px 1fr 120px 1fr 70px;gap:8px;align-items:center;padding:8px 16px;border-top:1px solid #F9F8F7">'+
      '<span class="mono" style="font-size:11px;font-weight:800;color:#a89e99;text-align:center">'+s.step_number+'</span>'+
      '<span style="font-size:12px;font-weight:600;color:#18120E">'+esc(s.step_name||'—')+'</span>'+
      '<select class="fi" id="dev-st-status-'+s.id+'" style="font-size:11px;padding:5px 8px">'+sOpts+'</select>'+
      '<select class="fi" id="dev-st-user-'+s.id+'" style="font-size:11px;padding:5px 8px">'+uOpts+'</select>'+
      '<button class="btn btn-soft sm" onclick="_devSaveStep(\''+s.id+'\')">'+svg('save',12)+'</button>'+
    '</div>';
  }).join(''):'<div style="padding:20px;text-align:center;color:#a89e99;font-size:12px">เอกสารนี้ไม่มีขั้นตอน workflow</div>';

  box.innerHTML=
    '<div class="card" style="margin-top:14px"><div class="card-head">'+
      '<div style="width:26px;height:26px;border-radius:7px;background:#FFF3EE;display:flex;align-items:center;justify-content:center;color:#E83A00">'+svg('wrench',13)+'</div>'+
      '<div><div class="card-head-title">'+esc(doc.title||'—')+'</div>'+
      '<div class="mono" style="font-size:10px;color:#a89e99;margin-top:1px">'+esc(doc.doc_number||'ยังไม่มีเลขที่')+' · id: '+esc(doc.id)+'</div></div>'+
      '<button class="btn btn-soft sm ml-auto" data-action="nav" data-view="det" data-id="'+doc.id+'">'+svg('eye',12)+' เปิดหน้าเอกสาร</button>'+
    '</div>'+
    '<div id="dev-insp-al"></div>'+
    '<div class="card-body" style="border-bottom:1px solid #F5F3F0">'+
      '<div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">'+
        '<div class="fg" style="flex:1;min-width:200px;margin:0"><label class="fl">สถานะเอกสาร</label>'+
        '<select class="fi" id="dev-doc-status">'+stOpts+'</select></div>'+
        '<button class="btn btn-primary sm" onclick="_devSaveDocStatus()">'+svg('save',12)+' บันทึกสถานะ</button>'+
        '<button class="btn btn-soft sm" onclick="_devFixDocInspect()">'+svg('wrench',12)+' ซ่อมสถานะอัตโนมัติ</button>'+
      '</div>'+
      '<div style="font-size:10.5px;color:#a89e99;margin-top:8px;line-height:1.7">"ซ่อมสถานะอัตโนมัติ" คำนวณสถานะที่ถูกต้องจากขั้นตอนด้านล่างให้เอง (เฉพาะเอกสารที่ยังอยู่ระหว่าง workflow) — แนะนำให้ใช้ก่อนแก้มือ</div>'+
    '</div>'+
    '<div style="display:grid;grid-template-columns:34px 1fr 120px 1fr 70px;gap:8px;padding:8px 16px 4px">'+
      ['#','ขั้นตอน','สถานะ','ผู้รับผิดชอบ',''].map(function(h){return '<span style="font-size:9.5px;font-weight:700;color:#c0b9b4;text-transform:uppercase;letter-spacing:.4px">'+h+'</span>';}).join('')+
    '</div>'+stepRows+'</div>';
}

async function _devSaveDocStatus(){
  var docId=_devCurDocId;
  var newStatus=gv('dev-doc-status');
  if(!docId||!newStatus) return;
  showConfirm('ยืนยันเปลี่ยนสถานะเอกสาร','เปลี่ยนสถานะเป็น "'+(STTH[newStatus]||newStatus)+'" — การเปลี่ยนสถานะตรง ๆ จะไม่ยิงแจ้งเตือน/ไม่ปรับขั้นตอนให้อัตโนมัติ',async function(){
    var al=$e('dev-insp-al');
    try{
      await dpa('documents',docId,{status:newStatus,updated_at:new Date().toISOString()});
      await dp('document_history',{document_id:docId,action:'แก้สถานะเอกสาร (dev)',performed_by:CU.id,note:'เปลี่ยนสถานะเป็น '+newStatus+' ผ่านเครื่องมือนักพัฒนา'});
      if(al) al.innerHTML='<div class="al al-ok" style="margin:10px 16px 0"><span class="al-icon">'+svg('ok',13)+'</span><span>บันทึกสถานะเรียบร้อย</span></div>';
    }catch(e){
      if(al) al.innerHTML='<div class="al al-er" style="margin:10px 16px 0"><span class="al-icon">'+svg('warn',13)+'</span><span>บันทึกไม่สำเร็จ: '+esc(e.message||String(e))+'</span></div>';
    }
  },{confirmLabel:'เปลี่ยนสถานะ',confirmClass:'btn-primary'});
}

async function _devSaveStep(stepId){
  var docId=_devCurDocId;
  var st=gv('dev-st-status-'+stepId);
  var asg=gv('dev-st-user-'+stepId);
  var al=$e('dev-insp-al');
  try{
    var b={status:st,assigned_to:asg||null};
    if(st==='done'&&!b.completed_at) b.completed_at=new Date().toISOString();
    if(st==='pending'||st==='active'){b.completed_at=null;b.rejected_by=null;b.action_taken=null;}
    await dpa('workflow_steps',stepId,b);
    await dp('document_history',{document_id:docId,action:'แก้ขั้นตอน workflow (dev)',performed_by:CU.id,note:'ปรับขั้นตอน '+stepId+' → status='+st+(asg?', ผู้รับผิดชอบใหม่':'')+' ผ่านเครื่องมือนักพัฒนา'});
    if(al) al.innerHTML='<div class="al al-ok" style="margin:10px 16px 0"><span class="al-icon">'+svg('ok',13)+'</span><span>บันทึกขั้นตอนเรียบร้อย — อย่าลืมตรวจสถานะเอกสารให้สอดคล้อง (หรือกด "ซ่อมสถานะอัตโนมัติ")</span></div>';
  }catch(e){
    if(al) al.innerHTML='<div class="al al-er" style="margin:10px 16px 0"><span class="al-icon">'+svg('warn',13)+'</span><span>บันทึกไม่สำเร็จ: '+esc(e.message||String(e))+'</span></div>';
  }
}

async function _devFixDocInspect(){
  var docId=_devCurDocId;
  if(!docId) return;
  try{
    await _reconcileDocState(docId);
    try{await dp('document_history',{document_id:docId,action:'ซ่อมสถานะเอกสาร (dev)',performed_by:CU.id,note:'ปรับสถานะให้สอดคล้องกับขั้นตอนโดยเครื่องมือนักพัฒนา'});}catch(e){}
    _devDocInspect(docId);
  }catch(e){showAlert('ซ่อมไม่สำเร็จ: '+(e.message||e),'er');}
}

/* ═══ การ์ดเสริมท้ายแท็บ "ตั้งค่าระบบ" (ฝังใน _vSysContent — เห็นทั้งแอดมินใน vSys และ dev ในแท็บจัดการระบบ) ═══ */

/* upsert หนึ่ง key ลง app_settings — ใช้ header H (JWT จริง) เสมอ + เช็ค r.ok (ดู Key Constraints ใน CLAUDE.md) */
async function _devUpsertSetting(key,value,type){
  var ex=await dg('app_settings','?key=eq.'+encodeURIComponent(key)+'&select=key&limit=1');
  if(Array.isArray(ex)&&ex.length){
    var r=await fetch(SU+'/rest/v1/app_settings?key=eq.'+encodeURIComponent(key),{method:'PATCH',headers:H,body:JSON.stringify({value:value,updated_by:CU.id,updated_at:new Date().toISOString()})});
    if(!r.ok) throw new Error('บันทึก '+key+' ไม่สำเร็จ (HTTP '+r.status+')');
  }else{
    await dp('app_settings',{key:key,value:value,label:key,value_type:type||'text',updated_by:CU.id,updated_at:new Date().toISOString()});
  }
}

/* รีเฟรชหน้าที่การ์ด settings แสดงอยู่ — แอดมินอยู่หน้า sys, dev อยู่แท็บ sysadmin ใน Dev Panel */
function _devRefreshSettingsView(){
  _sysTab='settings';
  if(CV==='dev'){_devTab='sysadmin';nav('dev');}else{nav('sys');}
}

function _rDevExtraSettingsCards(rows,anns){
  rows=Array.isArray(rows)?rows:[];
  var m={}; rows.forEach(function(r){m[r.key]=r.value});
  _annbEditId=null; _ANNB={};
  (Array.isArray(anns)?anns:[]).forEach(function(a){_ANNB[a.id]=a;});

  // ── Card 1: ประกาศหน้า Login (popup ก่อนเข้าระบบ) ──
  var laActive=m.login_announcement_active==='true';
  var laType=m.login_announcement_type||'info';
  var loginCard=
    '<div class="card"><div class="card-head">'+
      '<div style="width:26px;height:26px;border-radius:7px;background:#FFF3EE;display:flex;align-items:center;justify-content:center;color:#E83A00">'+svg('megaphone',13)+'</div>'+
      '<div><div class="card-head-title">Popup ประกาศหน้า Login</div>'+
      '<div style="font-size:10px;color:#a89e99;margin-top:1px">เด้งขึ้นก่อนเข้าระบบ — ใช้แจ้งปิดปรับปรุง เปิดรับสมัคร หรือข่าวด่วน (ผู้ใช้กด "รับทราบ" แล้วจะไม่เด้งซ้ำจนกว่าจะแก้ข้อความใหม่)</div></div>'+
      '<label style="margin-left:auto;display:flex;align-items:center;gap:7px;cursor:pointer;flex-shrink:0">'+
        '<input type="checkbox" id="dev-la-active"'+(laActive?' checked':'')+' style="width:16px;height:16px;accent-color:#E83A00;cursor:pointer">'+
        '<span style="font-size:12px;font-weight:700;color:'+(laActive?'#16A34A':'#a89e99')+'" id="dev-la-active-lb">'+(laActive?'เปิดแสดงอยู่':'ปิดอยู่')+'</span>'+
      '</label>'+
    '</div>'+
    '<div id="dev-la-al"></div>'+
    '<div class="card-body">'+
      '<div style="display:grid;grid-template-columns:1fr 160px;gap:10px;margin-bottom:10px">'+
        '<div class="fg" style="margin:0"><label class="fl">หัวข้อประกาศ</label>'+
        '<input class="fi" id="dev-la-title" value="'+esc(m.login_announcement_title||'')+'" placeholder="เช่น ปิดปรับปรุงระบบชั่วคราว"></div>'+
        '<div class="fg" style="margin:0"><label class="fl">รูปแบบ</label>'+
        '<select class="fi" id="dev-la-type">'+
          '<option value="info"'+(laType==='info'?' selected':'')+'>ℹ️ ข้อมูลทั่วไป (ฟ้า)</option>'+
          '<option value="warning"'+(laType==='warning'?' selected':'')+'>⚠️ เตือน (เหลือง)</option>'+
          '<option value="error"'+(laType==='error'?' selected':'')+'>⛔ สำคัญมาก (แดง)</option>'+
        '</select></div>'+
      '</div>'+
      '<div class="fg" style="margin-bottom:12px"><label class="fl">ข้อความประกาศ (เว้นบรรทัดได้)</label>'+
      '<textarea class="fi" id="dev-la-msg" rows="4" placeholder="รายละเอียดประกาศ...">'+esc(m.login_announcement||'')+'</textarea></div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
        '<button class="btn btn-primary sm" onclick="_devSaveLoginAnnounce()">'+svg('save',12)+' บันทึกประกาศ</button>'+
        '<button class="btn btn-soft sm" onclick="_devPreviewLoginAnnounce()">'+svg('eye',12)+' ดูตัวอย่าง</button>'+
      '</div>'+
      '<div style="font-size:10.5px;color:#a89e99;margin-top:10px;line-height:1.7">ต้องรัน supabase/create_dev_role.sql ก่อน popup ถึงจะแสดงบนหน้า Login ได้ (เปิดสิทธิ์ให้คนที่ยังไม่ล็อกอินอ่านประกาศ)</div>'+
    '</div></div>';

  // ── Card 2: app_settings ทั้งหมด (raw editor) ──
  // (แถบประกาศในระบบหลังล็อกอินแก้ได้ในการ์ด "ตั้งค่าระบบ" ด้านบนอยู่แล้ว — ไม่ทำซ้ำ)
  var rawRows=rows.map(function(r,i){
    return '<div style="display:grid;grid-template-columns:220px 1fr 70px 70px;gap:8px;align-items:center;padding:6px 16px;border-top:1px solid #F9F8F7">'+
      '<span class="mono" style="font-size:11px;font-weight:700;color:#18120E;word-break:break-all">'+esc(r.key)+'</span>'+
      '<input class="fi" id="dev-set-val-'+i+'" data-key="'+esc(r.key)+'" value="'+esc(r.value||'')+'" style="font-size:11px;padding:5px 8px;font-family:monospace">'+
      '<span class="mono" style="font-size:10px;color:#a89e99">'+esc(r.value_type||'text')+'</span>'+
      '<div style="display:flex;gap:4px">'+
        '<button class="btn btn-soft sm" onclick="_devSaveRawSetting('+i+')" title="บันทึก">'+svg('save',12)+'</button>'+
        '<button style="background:none;border:none;cursor:pointer;color:#c0b9b4;padding:4px;border-radius:6px" onclick="_devDeleteSetting(\''+esc(r.key)+'\')" title="ลบ key นี้">'+svg('trash',12)+'</button>'+
      '</div>'+
    '</div>';
  }).join('');
  var rawCard=
    '<div class="card"><div class="card-head">'+
      '<div style="width:26px;height:26px;border-radius:7px;background:#F5F3F0;display:flex;align-items:center;justify-content:center;color:#18120E">'+svg('database',13)+'</div>'+
      '<div><div class="card-head-title">ค่าระบบทั้งหมด (app_settings — '+rows.length+' key)</div>'+
      '<div style="font-size:10px;color:#a89e99;margin-top:1px">แก้ค่า runtime ของระบบตรง ๆ — ค่าที่บันทึกจะ override ค่า default ในโค้ด มีผลรอบโหลดถัดไป</div></div>'+
    '</div>'+
    '<div class="al al-wa" style="margin:10px 16px 0"><span class="al-icon">'+svg('warn',13)+'</span><span style="font-size:11.5px">แก้ผิด key/รูปแบบ (โดยเฉพาะ key ที่เป็น json) อาจทำให้บางฟีเจอร์อ่านค่าเพี้ยน — key รายการอ้างอิง (clubs_json, positions_json ฯลฯ) แนะนำแก้ผ่านหน้า "จัดการระบบ → รายการอ้างอิง" ที่มีฟอร์มเฉพาะดีกว่า</span></div>'+
    '<div id="dev-raw-al"></div>'+
    '<div style="display:grid;grid-template-columns:220px 1fr 70px 70px;gap:8px;padding:10px 16px 4px">'+
      ['Key','Value','Type',''].map(function(h){return '<span style="font-size:9.5px;font-weight:700;color:#c0b9b4;text-transform:uppercase;letter-spacing:.4px">'+h+'</span>';}).join('')+
    '</div>'+
    (rawRows||'<div style="padding:20px;text-align:center;color:#a89e99;font-size:12px">ยังไม่มีค่าใน app_settings</div>')+
    '<div style="display:grid;grid-template-columns:220px 1fr 90px 70px;gap:8px;align-items:center;padding:10px 16px;border-top:1px solid #F5F3F0;background:#FAFAF8;border-radius:0 0 16px 16px">'+
      '<input class="fi" id="dev-set-newkey" placeholder="key ใหม่" style="font-size:11px;padding:5px 8px;font-family:monospace">'+
      '<input class="fi" id="dev-set-newval" placeholder="value" style="font-size:11px;padding:5px 8px;font-family:monospace">'+
      '<select class="fi" id="dev-set-newtype" style="font-size:11px;padding:5px 8px"><option value="text">text</option><option value="number">number</option><option value="boolean">boolean</option><option value="json">json</option></select>'+
      '<button class="btn btn-primary sm" onclick="_devAddSetting()">'+svg('plus',12)+'</button>'+
    '</div></div>';

  return loginCard+_rAnnbManageCard(anns)+rawCard;
}

/* ═══ การ์ดจัดการบอร์ดประกาศหน้า Home (ตาราง announcements) ═══ */
var _annbEditId=null;   // id ประกาศที่กำลังแก้ไขอยู่ (null = โหมดเพิ่มใหม่)
var _ANNB={};           // cache id → row สำหรับ prefill ตอนกดแก้ไข

function _rAnnbManageCard(anns){
  var head=
    '<div class="card-head">'+
      '<div style="width:26px;height:26px;border-radius:7px;background:#FFF3EE;display:flex;align-items:center;justify-content:center;color:#E83A00">'+svg('newspaper',13)+'</div>'+
      '<div><div class="card-head-title">บอร์ดประกาศหน้า Home</div>'+
      '<div style="font-size:10px;color:#a89e99;margin-top:1px">แสดงเป็นการ์ด "ประกาศ" บนหน้าภาพรวมของทุกคนที่ล็อกอิน — ปักหมุดได้ ปิดชั่วคราวได้</div></div>'+
    '</div>';
  if(!Array.isArray(anns)){
    return '<div class="card">'+head+
      '<div class="al al-wa" style="margin:12px 16px 16px"><span class="al-icon">'+svg('warn',13)+'</span><span><strong>ยังไม่ได้รัน supabase/create_announcements.sql</strong> — ตาราง announcements ยังไม่ถูกสร้าง รันไฟล์นี้ใน Supabase SQL Editor ก่อน (ต้องรันหลัง create_dev_role.sql เพราะ policy อ้าง is_dev())</span></div></div>';
  }
  var TH={info:{cl:'#2563EB',bg:'#EFF6FF',label:'ข้อมูล'},warning:{cl:'#D97706',bg:'#FFFBEB',label:'เตือน'},error:{cl:'#DC2626',bg:'#FEF2F2',label:'สำคัญ'}};
  var list=anns.length?anns.map(function(a){
    var t=TH[a.level]||TH.info;
    return '<div style="display:flex;gap:10px;align-items:center;padding:9px 16px;border-top:1px solid #F9F8F7;flex-wrap:wrap">'+
      '<div style="flex:1;min-width:180px">'+
        '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">'+
          (a.pinned?'<span style="color:#E83A00;display:inline-flex" title="ปักหมุด">'+svg('pin',11)+'</span>':'')+
          '<span style="font-size:12.5px;font-weight:700;color:#18120E">'+esc(a.title)+'</span>'+
          '<span style="font-size:9px;font-weight:700;color:'+t.cl+';background:'+t.bg+';border-radius:99px;padding:1px 7px">'+t.label+'</span>'+
          '<span style="font-size:9px;font-weight:700;color:'+(a.is_active?'#16A34A':'#a89e99')+';background:'+(a.is_active?'#ECFDF5':'#F5F3F0')+';border-radius:99px;padding:1px 7px">'+(a.is_active?'แสดงอยู่':'ปิดอยู่')+'</span>'+
        '</div>'+
        '<div style="font-size:10px;color:#a89e99;margin-top:2px">'+fd(a.created_at)+(a.body?' · '+esc(String(a.body).slice(0,60))+(String(a.body).length>60?'…':''):'')+'</div>'+
      '</div>'+
      '<div style="display:flex;gap:4px;flex-shrink:0">'+
        '<button class="btn btn-soft sm" onclick="_annbToggle(\''+a.id+'\','+(a.is_active?'false':'true')+')" title="'+(a.is_active?'ปิดการแสดง':'เปิดการแสดง')+'">'+svg(a.is_active?'eye':'unlock',12)+' '+(a.is_active?'ปิด':'เปิด')+'</button>'+
        '<button class="btn btn-soft sm" onclick="_annbEdit(\''+a.id+'\')">'+svg('edit',12)+' แก้ไข</button>'+
        '<button style="background:none;border:none;cursor:pointer;color:#c0b9b4;padding:4px 6px;border-radius:6px" onclick="_annbDel(\''+a.id+'\')" title="ลบถาวร">'+svg('trash',13)+'</button>'+
      '</div>'+
    '</div>';
  }).join(''):'<div style="padding:18px 16px;text-align:center;color:#a89e99;font-size:12px;border-top:1px solid #F9F8F7">ยังไม่มีประกาศ — เพิ่มอันแรกด้านบนได้เลย</div>';

  return '<div class="card">'+head+
    '<div id="annb-al"></div>'+
    '<div class="card-body" style="border-bottom:1px solid #F5F3F0">'+
      '<div style="display:grid;grid-template-columns:1fr 150px 110px;gap:10px;margin-bottom:10px">'+
        '<div class="fg" style="margin:0"><label class="fl">หัวข้อประกาศ <span class="req">*</span></label>'+
        '<input class="fi" id="annb-title" placeholder="เช่น กำหนดส่งเอกสารงบประมาณ ภาคต้น"></div>'+
        '<div class="fg" style="margin:0"><label class="fl">ระดับ</label>'+
        '<select class="fi" id="annb-level"><option value="info">ℹ️ ข้อมูล</option><option value="warning">⚠️ เตือน</option><option value="error">⛔ สำคัญ</option></select></div>'+
        '<label style="display:flex;align-items:center;gap:7px;cursor:pointer;align-self:end;height:40px">'+
          '<input type="checkbox" id="annb-pin" style="width:15px;height:15px;accent-color:#E83A00;cursor:pointer">'+
          '<span style="font-size:12px;font-weight:600;color:#18120E">ปักหมุด</span>'+
        '</label>'+
      '</div>'+
      '<div class="fg" style="margin-bottom:12px"><label class="fl">รายละเอียด <span style="font-size:10px;color:#a89e99">(ถ้ามี — เว้นบรรทัดได้)</span></label>'+
      '<textarea class="fi" id="annb-body" rows="3" placeholder="รายละเอียดประกาศ..."></textarea></div>'+
      '<div style="display:flex;gap:8px">'+
        '<button class="btn btn-primary sm" id="annb-submit" onclick="_annbSave()">'+svg('plus',12)+' เพิ่มประกาศ</button>'+
        '<button class="btn btn-soft sm" id="annb-cancel" onclick="_annbCancelEdit()" style="display:none">ยกเลิกการแก้ไข</button>'+
      '</div>'+
    '</div>'+
    '<div style="display:flex;padding:8px 16px 2px"><span style="font-size:9.5px;font-weight:700;color:#c0b9b4;text-transform:uppercase;letter-spacing:.4px">ประกาศทั้งหมด ('+anns.length+')</span></div>'+
    list+'</div>';
}

async function _annbSave(){
  var title=gv('annb-title').trim();
  var body=(($e('annb-body')||{}).value||'').trim();
  var level=gv('annb-level')||'info';
  var pin=!!($e('annb-pin')&&$e('annb-pin').checked);
  var al=$e('annb-al');
  if(!title){if(al)al.innerHTML='<div class="al al-er" style="margin:10px 16px 0"><span class="al-icon">'+svg('warn',13)+'</span><span>ใส่หัวข้อประกาศก่อนค่ะ</span></div>';return;}
  try{
    if(_annbEditId){
      await dpa('announcements',_annbEditId,{title:title,body:body||null,level:level,pinned:pin,updated_at:new Date().toISOString()});
    }else{
      await dp('announcements',{title:title,body:body||null,level:level,pinned:pin,is_active:true,created_by:CU.id});
    }
    _annbEditId=null;
    _devRefreshSettingsView();
  }catch(e){
    if(al)al.innerHTML='<div class="al al-er" style="margin:10px 16px 0"><span class="al-icon">'+svg('warn',13)+'</span><span>บันทึกไม่สำเร็จ: '+esc(e.message||String(e))+'</span></div>';
  }
}

function _annbEdit(id){
  var a=_ANNB[id]; if(!a) return;
  _annbEditId=id;
  var t=$e('annb-title'),b=$e('annb-body'),l=$e('annb-level'),p=$e('annb-pin');
  if(t)t.value=a.title||''; if(b)b.value=a.body||''; if(l)l.value=a.level||'info'; if(p)p.checked=!!a.pinned;
  var s=$e('annb-submit'); if(s)s.innerHTML=svg('save',12)+' บันทึกการแก้ไข';
  var c=$e('annb-cancel'); if(c)c.style.display='inline-flex';
  if(t)t.scrollIntoView({behavior:'smooth',block:'center'});
}

function _annbCancelEdit(){
  _annbEditId=null;
  var t=$e('annb-title'),b=$e('annb-body'),l=$e('annb-level'),p=$e('annb-pin');
  if(t)t.value=''; if(b)b.value=''; if(l)l.value='info'; if(p)p.checked=false;
  var s=$e('annb-submit'); if(s)s.innerHTML=svg('plus',12)+' เพิ่มประกาศ';
  var c=$e('annb-cancel'); if(c)c.style.display='none';
}

async function _annbToggle(id,to){
  try{
    await dpa('announcements',id,{is_active:to===true||to==='true',updated_at:new Date().toISOString()});
    _devRefreshSettingsView();
  }catch(e){showAlert('เปลี่ยนสถานะไม่สำเร็จ: '+(e.message||e),'er');}
}

function _annbDel(id){
  showConfirm('ลบประกาศถาวร','ลบแล้วกู้คืนไม่ได้ — ถ้าแค่อยากซ่อนจากหน้า Home ชั่วคราว ใช้ปุ่ม "ปิด" แทน',async function(){
    try{await dd('announcements',id);_devRefreshSettingsView();}
    catch(e){showAlert('ลบไม่สำเร็จ: '+(e.message||e),'er');}
  },{confirmLabel:'ลบถาวร'});
}

function _devLaVals(){
  return {
    active:$e('dev-la-active')&&$e('dev-la-active').checked?'true':'false',
    title:gv('dev-la-title').trim(),
    msg:(($e('dev-la-msg')||{}).value||'').trim(),
    type:gv('dev-la-type')||'info'
  };
}

async function _devSaveLoginAnnounce(){
  var v=_devLaVals();
  var al=$e('dev-la-al');
  if(v.active==='true'&&!v.msg){if(al)al.innerHTML='<div class="al al-er" style="margin:10px 16px 0"><span class="al-icon">'+svg('warn',13)+'</span><span>เปิดแสดงอยู่แต่ยังไม่มีข้อความประกาศ — พิมพ์ข้อความก่อนค่ะ</span></div>';return;}
  try{
    await _devUpsertSetting('login_announcement_active',v.active,'boolean');
    await _devUpsertSetting('login_announcement_title',v.title,'text');
    await _devUpsertSetting('login_announcement',v.msg,'text');
    await _devUpsertSetting('login_announcement_type',v.type,'text');
    var lb=$e('dev-la-active-lb');
    if(lb){lb.textContent=v.active==='true'?'เปิดแสดงอยู่':'ปิดอยู่';lb.style.color=v.active==='true'?'#16A34A':'#a89e99';}
    if(al)al.innerHTML='<div class="al al-ok" style="margin:10px 16px 0"><span class="al-icon">'+svg('ok',13)+'</span><span>บันทึกเรียบร้อย — '+(v.active==='true'?'ประกาศจะแสดงบนหน้า Login ทันที':'ปิดการแสดงประกาศแล้ว')+'</span></div>';
    setTimeout(function(){if(al)al.innerHTML='';},4000);
  }catch(e){
    if(al)al.innerHTML='<div class="al al-er" style="margin:10px 16px 0"><span class="al-icon">'+svg('warn',13)+'</span><span>บันทึกไม่สำเร็จ: '+esc(e.message||String(e))+'</span></div>';
  }
}

function _devPreviewLoginAnnounce(){
  var v=_devLaVals();
  _renderLoginAnnouncePopup({title:v.title||'ประกาศ',msg:v.msg||'(ยังไม่มีข้อความ)',type:v.type});
}

async function _devSaveRawSetting(i){
  var inp=$e('dev-set-val-'+i);
  if(!inp) return;
  var key=inp.dataset.key, val=inp.value;
  var al=$e('dev-raw-al');
  try{
    var r=await fetch(SU+'/rest/v1/app_settings?key=eq.'+encodeURIComponent(key),{method:'PATCH',headers:H,body:JSON.stringify({value:val,updated_by:CU.id,updated_at:new Date().toISOString()})});
    if(!r.ok) throw new Error('HTTP '+r.status);
    if(al)al.innerHTML='<div class="al al-ok" style="margin:8px 16px 0"><span class="al-icon">'+svg('ok',13)+'</span><span>บันทึก '+esc(key)+' เรียบร้อย — มีผลรอบโหลดถัดไป (รีเฟรชหน้า)</span></div>';
    setTimeout(function(){if(al)al.innerHTML='';},4000);
  }catch(e){
    if(al)al.innerHTML='<div class="al al-er" style="margin:8px 16px 0"><span class="al-icon">'+svg('warn',13)+'</span><span>บันทึกไม่สำเร็จ: '+esc(e.message||String(e))+'</span></div>';
  }
}

async function _devAddSetting(){
  var key=gv('dev-set-newkey').trim(), val=gv('dev-set-newval'), type=gv('dev-set-newtype')||'text';
  var al=$e('dev-raw-al');
  if(!key){if(al)al.innerHTML='<div class="al al-er" style="margin:8px 16px 0"><span class="al-icon">'+svg('warn',13)+'</span><span>ใส่ชื่อ key ก่อนค่ะ</span></div>';return;}
  try{
    await _devUpsertSetting(key,val,type);
    _devRefreshSettingsView();
  }catch(e){
    if(al)al.innerHTML='<div class="al al-er" style="margin:8px 16px 0"><span class="al-icon">'+svg('warn',13)+'</span><span>เพิ่มไม่สำเร็จ: '+esc(e.message||String(e))+'</span></div>';
  }
}

async function _devDeleteSetting(key){
  showConfirm('ลบค่า '+key,'ระบบจะกลับไปใช้ค่า default ในโค้ดสำหรับ key นี้ (ถ้ามี) — ลบแล้วกู้คืนไม่ได้',async function(){
    try{
      var r=await fetch(SU+'/rest/v1/app_settings?key=eq.'+encodeURIComponent(key),{method:'DELETE',headers:{apikey:SK,'Authorization':H.Authorization}});
      if(!r.ok) throw new Error('HTTP '+r.status);
      _devRefreshSettingsView();
    }catch(e){showAlert('ลบไม่สำเร็จ: '+(e.message||e),'er');}
  },{confirmLabel:'ลบ key นี้'});
}

/* ═══ แท็บ 5: คู่มือ & ลิงก์ ═══ */
function _devInfoPanel(sqlReady){
  var links=[
    {label:'คู่มือนักพัฒนา (Handover)',desc:'สถาปัตยกรรม วิธี deploy และปัญหาที่พบบ่อย — อ่านก่อนเริ่มแก้ระบบ',url:'dev-manual.html',ico:'book-open',color:'#E83A00',bg:'#FFF3EE'},
    {label:'GitHub Repository',desc:'kittiya45/SaEDU-Flow-system — push ขึ้น main แล้ว Vercel deploy ให้อัตโนมัติ',url:'https://github.com/kittiya45/SaEDU-Flow-system',ico:'code',color:'#18120E',bg:'#F5F3F0'},
    {label:'Supabase Dashboard',desc:'ฐานข้อมูล, Auth, Storage, Edge Functions และ SQL Editor (project: jrubupvzltxqstzcpoov)',url:'https://supabase.com/dashboard/project/jrubupvzltxqstzcpoov',ico:'database',color:'#16A34A',bg:'#ECFDF5'},
    {label:'Vercel Dashboard',desc:'สถานะ deploy และ log ของเว็บ',url:'https://vercel.com/dashboard',ico:'activity',color:'#2563EB',bg:'#EFF6FF'}
  ];
  var linkCards=links.map(function(l){
    return '<a href="'+l.url+'" target="_blank" style="display:flex;align-items:center;gap:12px;padding:14px 16px;background:#fff;border:1px solid #EBEBEB;border-radius:14px;text-decoration:none;transition:border-color .15s" onmouseover="this.style.borderColor=\''+l.color+'\'" onmouseout="this.style.borderColor=\'#EBEBEB\'">'+
      '<div style="width:36px;height:36px;border-radius:10px;background:'+l.bg+';display:flex;align-items:center;justify-content:center;color:'+l.color+';flex-shrink:0">'+svg(l.ico,17)+'</div>'+
      '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700;color:#18120E">'+l.label+'</div>'+
      '<div style="font-size:11px;color:#a89e99;margin-top:2px;line-height:1.6">'+l.desc+'</div></div>'+
      '<span style="color:#a89e99">↗</span>'+
    '</a>';
  }).join('');

  var setup=
    '<div class="card" style="margin-top:16px"><div class="card-head">'+
      '<div style="width:26px;height:26px;border-radius:7px;background:#FEF3C7;display:flex;align-items:center;justify-content:center;color:#D97706">'+svg('list',13)+'</div>'+
      '<div><div class="card-head-title">เช็กลิสต์เปิดใช้ระบบนักพัฒนา</div></div>'+
    '</div><div class="card-body" style="font-size:12.5px;color:#3A332E;line-height:2">'+
      '<div>'+(sqlReady?svg('ok',13)+' <strong>รัน supabase/create_dev_role.sql แล้ว</strong> — ตาราง system_logs พร้อมใช้':svg('x',13)+' <strong style="color:#DC2626">ยังไม่ได้รัน supabase/create_dev_role.sql</strong> — เปิด Supabase Dashboard → SQL Editor → วางเนื้อหาไฟล์แล้วรัน')+'</div>'+
      '<div>'+svg('info',13)+' <strong>มอบสิทธิ์นักพัฒนา:</strong> ให้คนนั้นสมัครสมาชิกตามปกติก่อน → แอดมินอนุมัติบัญชี → หน้า "จัดการผู้ใช้" → เมนู ⋮ → แก้ไขข้อมูล → เปลี่ยนสิทธิ์เป็น "นักพัฒนา (ROLE-DEV)"</div>'+
      '<div>'+svg('info',13)+' ระบบนักพัฒนา<strong>แยกจากแอดมิน</strong>: บัญชีนักพัฒนาเห็นเมนู "นักพัฒนา" เมนูเดียว (การตั้งค่าระบบอยู่ในแท็บ "จัดการระบบ" ด้านใน) ส่วนแอดมินไม่เห็น/ไม่เข้าหน้านี้ — สิทธิ์ฐานข้อมูลก็แยกกัน: นักพัฒนาแก้ config + ซ่อมเอกสารได้ แต่จัดการผู้ใช้·ลบเอกสาร·อ่านอีเมลผู้ใช้ไม่ได้</div>'+
    '</div></div>';

  return '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px">'+linkCards+'</div>'+setup;
}

/* ═══ แท็บ "ทดสอบระบบ" (Sandbox) — ทดสอบแต่ละฟังก์ชันโดยไม่สร้างเอกสารจริง ═══
   หลักการ: ใช้ "โค้ดเส้นทางเดียวกับของจริง" ให้มากที่สุด แต่ไม่เขียนอะไรลงตารางเอกสารเลย
   - ออกเลข: เรียก _nextDocNum() ตัวจริง (อ่านอย่างเดียว — ไม่จอง/ไม่บันทึกเลข)
   - ประทับ PDF: pdf-lib + fontkit + ฟอนต์ไทย URL/cache เดียวกับที่ใช้ปั๊มเลขจริง (_thFontCache)
   - แจ้งเตือน: ส่งอีเมล/LINE หา "ตัวเอง" เท่านั้น และไม่บันทึกลงตาราง notifications */

function _sbxPanel(){
  var thisYear=new Date().getFullYear(), thaiYear=thisYear+543;

  // ── 1) จำลองการออกเลขหนังสือ ──
  var semOpts=Object.keys(SEMS).map(function(k){return '<option value="'+k+'">'+k+' — '+esc(SEMS[k])+'</option>';}).join('');
  var outPosOpts=POSS.map(function(p){return '<option value="'+esc(GNK_NUM[p]||'00')+'">'+esc(GNK_NUM[p]||'00')+' — '+esc(PTH[p]||p)+'</option>';}).join('');
  var inPosOpts=SENDER_POS.map(function(p){return '<option value="'+esc(p.code)+'">'+esc(p.code)+' — '+esc(p.name)+(p.isClub?' (ชมรม)':'')+'</option>';}).join('');
  var ltOpts=OUT_LTYPES.slice(1).map(function(l,i){return '<option value="'+(i+1)+'">'+(i+1)+'. '+esc(l)+'</option>';}).join('');
  var clubOpts='<option value="">— ไม่มีชมรม —</option>'+Object.keys(CLUBS).map(function(c){return '<option value="'+c+'">'+c+' — '+esc(CLUBS[c])+'</option>';}).join('');
  var numCard=
    '<div class="card"><div class="card-head">'+
      '<div style="width:26px;height:26px;border-radius:7px;background:#EFF6FF;display:flex;align-items:center;justify-content:center;color:#2563EB">'+svg('pen',13)+'</div>'+
      '<div><div class="card-head-title">จำลองการออกเลขหนังสือ</div>'+
      '<div style="font-size:10px;color:#a89e99;margin-top:1px">คำนวณด้วยฟังก์ชันเดียวกับการออกเลขจริง (_nextDocNum) — อ่านอย่างเดียว ไม่จองเลข ไม่แตะเอกสารใคร</div></div>'+
    '</div><div class="card-body">'+
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-bottom:12px">'+
        '<div class="fg" style="margin:0"><label class="fl">ประเภทเอกสาร</label>'+
        '<select class="fi" id="sbx-num-type" onchange="_sbxNumTypeChanged()"><option value="outgoing">หนังสือขาออก</option><option value="incoming">หนังสือขาเข้า</option></select></div>'+
        '<div class="fg" style="margin:0"><label class="fl">ภาคการศึกษา (หลัก 1)</label>'+
        '<select class="fi" id="sbx-num-sem">'+semOpts+'</select></div>'+
        '<div class="fg" style="margin:0"><label class="fl" id="sbx-num-pos-lb">ตำแหน่งผู้สร้าง (หลัก 2-3)</label>'+
        '<select class="fi" id="sbx-num-pos">'+outPosOpts+'</select></div>'+
        '<div class="fg" style="margin:0"><label class="fl">ประเภทจดหมาย (หลัก 4)</label>'+
        '<select class="fi" id="sbx-num-lt">'+ltOpts+'</select></div>'+
        '<div class="fg" style="margin:0"><label class="fl">ชมรม (หลัก 8-9 ถ้ามี)</label>'+
        '<select class="fi" id="sbx-num-club">'+clubOpts+'</select></div>'+
      '</div>'+
      '<button class="btn btn-primary sm" onclick="_sbxCalcNum()">'+svg('srch',12)+' คำนวณเลขถัดไป</button>'+
      '<div id="sbx-num-result" style="margin-top:12px"></div>'+
    '</div></div>';

  // ── 2) ลายเซ็น & ประทับ PDF ──
  var sigCard=
    '<div class="card"><div class="card-head">'+
      '<div style="width:26px;height:26px;border-radius:7px;background:#FFF3EE;display:flex;align-items:center;justify-content:center;color:#E83A00">'+svg('sign',13)+'</div>'+
      '<div><div class="card-head-title">ทดสอบลายเซ็น & ประทับ PDF</div>'+
      '<div style="font-size:10px;color:#a89e99;margin-top:1px">วาดลายเซ็นแล้วสร้าง PDF ทดสอบ — ใช้ pdf-lib + ฟอนต์ไทยตัวเดียวกับที่ระบบใช้ปั๊มเลขจริง ถ้าฟอนต์/ไลบรารีพังจะเห็นที่นี่ก่อนผู้ใช้เจอ</div></div>'+
    '</div><div class="card-body">'+
      '<div style="display:grid;grid-template-columns:280px 1fr;gap:14px;align-items:start">'+
        '<div>'+
          '<label class="fl">วาดลายเซ็นทดสอบ</label>'+
          '<canvas id="sbx-sig" width="520" height="220" style="border:1.5px solid #EBEBEB;border-radius:10px;background:#fff;display:block;width:100%;height:110px;cursor:crosshair;touch-action:none"></canvas>'+
          '<button class="btn btn-soft sm mt-1.5 w-full" onclick="_sbxSigClear()">ล้างลายเซ็น</button>'+
        '</div>'+
        '<div>'+
          '<div class="fg" style="margin-bottom:10px"><label class="fl">ข้อความไทยที่จะประทับ (ทดสอบฟอนต์)</label>'+
          '<input class="fi" id="sbx-sig-text" value="กนค. 101001/'+thaiYear+' — ทดสอบประทับข้อความไทย"></div>'+
          '<button class="btn btn-primary sm" onclick="_sbxMakePdf()">'+svg('doc',12)+' สร้าง PDF ทดสอบ (เปิดดูทันที)</button>'+
          '<div id="sbx-sig-result" style="margin-top:10px"></div>'+
        '</div>'+
      '</div>'+
    '</div></div>';

  // ── 3) ทดสอบการแจ้งเตือน ──
  var myEmail=(CU&&(CU.contact_email||CU.email))||'';
  var notifCard=
    '<div class="card"><div class="card-head">'+
      '<div style="width:26px;height:26px;border-radius:7px;background:#ECFDF5;display:flex;align-items:center;justify-content:center;color:#16A34A">'+svg('bell',13)+'</div>'+
      '<div><div class="card-head-title">ทดสอบการแจ้งเตือน</div>'+
      '<div style="font-size:10px;color:#a89e99;margin-top:1px">ส่งหา "ตัวเอง" เท่านั้น ไม่บันทึกลง log การแจ้งเตือน — ใช้เช็คว่า Edge Function / Resend / LINE ยังทำงาน</div></div>'+
    '</div><div class="card-body">'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
        '<button class="btn btn-soft sm" onclick="_sbxTestEmail()">'+svg('bell',12)+' ส่งอีเมลทดสอบหาตัวเอง'+(myEmail?' ('+esc(myEmail)+')':'')+'</button>'+
        '<button class="btn btn-soft sm" onclick="_sbxTestLine()"><span style="background:#06C755;color:#fff;font-size:8px;font-weight:800;border-radius:4px;padding:1px 4px;margin-right:4px">LINE</span> ส่ง LINE ทดสอบหาตัวเอง</button>'+
      '</div>'+
      '<div id="sbx-notif-result" style="margin-top:10px"></div>'+
    '</div></div>';

  // ── 4) เครื่องคิดวันทำการ (SLA) ──
  var slaCard=
    '<div class="card"><div class="card-head">'+
      '<div style="width:26px;height:26px;border-radius:7px;background:#FEF3C7;display:flex;align-items:center;justify-content:center;color:#D97706">'+svg('clock',13)+'</div>'+
      '<div><div class="card-head-title">เครื่องคิดวันทำการ (SLA)</div>'+
      '<div style="font-size:10px;color:#a89e99;margin-top:1px">ทดสอบ addWorkingDays() — ตัวเดียวกับที่ใช้คำนวณเส้นตายตีกลับ/auto-approve (นับเฉพาะจันทร์–ศุกร์)</div></div>'+
    '</div><div class="card-body">'+
      '<div style="display:flex;gap:10px;align-items:end;flex-wrap:wrap">'+
        '<div class="fg" style="margin:0"><label class="fl">นับจากวันที่</label>'+
        '<input class="fi" type="date" id="sbx-sla-date" value="'+new Date().toISOString().slice(0,10)+'" oninput="_sbxCalcSla()"></div>'+
        '<div class="fg" style="margin:0;width:120px"><label class="fl">วันทำการ</label>'+
        '<input class="fi" type="number" id="sbx-sla-days" value="'+(SETT.sla_cascade_days||3)+'" min="1" max="60" oninput="_sbxCalcSla()"></div>'+
        '<div id="sbx-sla-result" style="font-size:13px;font-weight:700;color:#18120E;padding-bottom:10px"></div>'+
      '</div>'+
    '</div></div>';

  // ── 5) จำลองขั้นตอน workflow ──
  var ltFlowOpts=LETTER_TYPES.map(function(l){return '<option value="'+esc(l)+'">'+esc(l)+'</option>';}).join('');
  var flowCard=
    '<div class="card"><div class="card-head">'+
      '<div style="width:26px;height:26px;border-radius:7px;background:#F5F3FF;display:flex;align-items:center;justify-content:center;color:#7C3AED">'+svg('refresh',13)+'</div>'+
      '<div><div class="card-head-title">จำลองขั้นตอน workflow (หนังสือขาเข้า)</div>'+
      '<div style="font-size:10px;color:#a89e99;margin-top:1px">ดูว่าเลือกประเภทจดหมายไหนแล้วระบบจะล็อกขั้นตอนอะไรบ้าง — ไม่สร้างเอกสารจริง</div></div>'+
    '</div><div class="card-body">'+
      '<div class="fg" style="margin-bottom:10px"><label class="fl">ประเภทจดหมาย</label>'+
      '<select class="fi" id="sbx-flow-lt" onchange="_sbxShowFlow()">'+ltFlowOpts+'</select></div>'+
      '<div id="sbx-flow-result"></div>'+
    '</div></div>';

  // แสดง flow แรกทันทีหลัง DOM พร้อม
  setTimeout(function(){if($e('sbx-flow-result'))_sbxShowFlow();},150);

  return '<div class="al al-in" style="margin-bottom:14px"><span class="al-icon">'+svg('info',13)+'</span>'+
    '<span>ทุกเครื่องมือในแท็บนี้<strong>ไม่เขียนข้อมูลลงตารางเอกสาร/ประวัติ/การแจ้งเตือน</strong> — ทดสอบซ้ำกี่รอบก็ได้อย่างปลอดภัย</span></div>'+
    numCard+sigCard+notifCard+slaCard+flowCard;
}

/* ── 1) จำลองออกเลข ── */
function _sbxNumTypeChanged(){
  var type=gv('sbx-num-type');
  var pos=$e('sbx-num-pos'), lb=$e('sbx-num-pos-lb');
  if(!pos) return;
  if(type==='incoming'){
    if(lb) lb.textContent='ตำแหน่ง/สังกัดผู้ส่ง (หลัก 2-3)';
    pos.innerHTML=SENDER_POS.map(function(p){return '<option value="'+esc(p.code)+'">'+esc(p.code)+' — '+esc(p.name)+(p.isClub?' (ชมรม)':'')+'</option>';}).join('');
  }else{
    if(lb) lb.textContent='ตำแหน่งผู้สร้าง (หลัก 2-3)';
    pos.innerHTML=POSS.map(function(p){return '<option value="'+esc(GNK_NUM[p]||'00')+'">'+esc(GNK_NUM[p]||'00')+' — '+esc(PTH[p]||p)+'</option>';}).join('');
  }
}
async function _sbxCalcNum(){
  var box=$e('sbx-num-result'); if(!box) return;
  var type=gv('sbx-num-type'), sem=gv('sbx-num-sem'), pos=gv('sbx-num-pos'), lt=gv('sbx-num-lt'), club=gv('sbx-num-club');
  box.innerHTML='<div style="padding:8px"><span class="sp sp-dark"></span></div>';
  try{
    var thisYear=new Date().getFullYear(), thaiYear=thisYear+543;
    var catPfx=sem+pos+lt;
    // เรียกฟังก์ชันออกเลขตัวจริง (docNum.js) — docId=null คือไม่ยกเว้นเอกสารไหน = ได้เลขถัดไปจริง
    var num=await _nextDocNum(null,type,catPfx,club||'',thisYear,thaiYear);
    var m=num.match(/^กนค\. (\d)(\d\d)(\d)(\d{3})(?:-(\d\d))?\/(\d{4})$/);
    var seg=function(v,label,cl){return '<div style="text-align:center"><div class="mono" style="font-size:20px;font-weight:900;color:'+cl+'">'+esc(v)+'</div><div style="font-size:9px;color:#a89e99;margin-top:2px;max-width:86px">'+label+'</div></div>';};
    box.innerHTML=
      '<div style="background:#F8F5F2;border:1px solid #EBEBEB;border-radius:12px;padding:14px 16px">'+
        '<div style="font-size:11px;color:#a89e99;margin-bottom:6px">เลขที่ถัดไปของหมวดนี้ (ถ้าออกจริงตอนนี้):</div>'+
        '<div class="mono" style="font-size:22px;font-weight:900;color:#1261AB;letter-spacing:.5px;margin-bottom:12px">'+esc(num)+'</div>'+
        (m?'<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start">'+
          seg(m[1],'ภาคการศึกษา','#E83A00')+seg(m[2],'ตำแหน่ง/ผู้ส่ง','#2563EB')+seg(m[3],'ประเภทจดหมาย','#7C3AED')+seg(m[4],'ลำดับที่ (running)','#16A34A')+
          (m[5]?seg(m[5],'ชมรม','#D97706'):'')+seg(m[6],'ปี พ.ศ.','#6b6560')+
        '</div>':'')+
        '<div style="font-size:10px;color:#a89e99;margin-top:10px">'+svg('info',11)+' โหมดจำลอง — ไม่ได้จองเลขนี้ เลขจริงอาจขยับถ้ามีคนออกเลขหมวดเดียวกันก่อน</div>'+
      '</div>';
  }catch(e){
    box.innerHTML=alrtH('er','คำนวณไม่สำเร็จ: '+(e.message||e));
  }
}

/* ── 2) ลายเซ็น & PDF ── */
var _sbxSigDrawn=false;
function _sbxWireSig(){
  var c=$e('sbx-sig'); if(!c||c._wired) return; c._wired=true;
  var ctx=c.getContext('2d'); ctx.lineWidth=2.4; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.strokeStyle='#1C1C1E';
  var drawing=false;
  var pos=function(e){var r=c.getBoundingClientRect();var t=e.touches?e.touches[0]:e;return{x:(t.clientX-r.left)*(c.width/r.width),y:(t.clientY-r.top)*(c.height/r.height)};};
  var dn=function(e){drawing=true;_sbxSigDrawn=true;var p=pos(e);ctx.beginPath();ctx.moveTo(p.x,p.y);e.preventDefault();};
  var mv=function(e){if(!drawing)return;var p=pos(e);ctx.lineTo(p.x,p.y);ctx.stroke();e.preventDefault();};
  var up=function(){drawing=false;};
  c.addEventListener('mousedown',dn); c.addEventListener('mousemove',mv); window.addEventListener('mouseup',up);
  c.addEventListener('touchstart',dn,{passive:false}); c.addEventListener('touchmove',mv,{passive:false}); c.addEventListener('touchend',up);
}
function _sbxSigClear(){
  var c=$e('sbx-sig'); if(!c) return;
  c.getContext('2d').clearRect(0,0,c.width,c.height);
  _sbxSigDrawn=false;
}
async function _sbxMakePdf(){
  var box=$e('sbx-sig-result'); if(!box) return;
  box.innerHTML='<div class="al al-in"><span class="sp sp-dark"></span><span> กำลังสร้าง PDF (โหลด pdf-lib + ฟอนต์ไทย)...</span></div>';
  try{
    if(!window.PDFLib) await loadSc('https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js');
    if(!window.fontkit) await loadSc('https://unpkg.com/@pdf-lib/fontkit/dist/fontkit.umd.min.js');
    var pdfDoc=await PDFLib.PDFDocument.create();
    pdfDoc.registerFontkit(window.fontkit);
    // ฟอนต์ไทย: URL + cache ก้อนเดียวกับที่ใช้ปั๊มเลขจริง (docNum.js _thFontCache) — ทดสอบ path จริง
    if(!_thFontCache){
      _thFontCache=await fetch('https://cdn.jsdelivr.net/gh/Phonbopit/sarabun-webfont@master/fonts/thsarabunnew-webfont.ttf').then(function(r){
        if(!r.ok) throw new Error('โหลดฟอนต์ไทยไม่สำเร็จ (HTTP '+r.status+') — การปั๊มเลขจริงจะถูกข้ามด้วยเหตุเดียวกัน');
        return r.arrayBuffer();
      });
    }
    var thFont=await pdfDoc.embedFont(_thFontCache.slice(0));
    var page=pdfDoc.addPage([595.28,841.89]); // A4
    var blue=PDFLib.rgb(0.07,0.38,0.67);
    page.drawText('เอกสารทดสอบระบบ — SAEDU Flow Sandbox',{x:50,y:790,size:18,font:thFont,color:PDFLib.rgb(.1,.07,.05)});
    page.drawText('สร้างเมื่อ: '+new Date().toLocaleString('th-TH'),{x:50,y:765,size:12,font:thFont,color:PDFLib.rgb(.55,.5,.47)});
    var txt=gv('sbx-sig-text')||'ทดสอบข้อความไทย';
    page.drawText(txt,{x:50,y:720,size:14,font:thFont,color:blue}); // จุดเดียวกับการปั๊มเลขจริง: ข้อความไทยสีน้ำเงิน
    if(_sbxSigDrawn){
      var c=$e('sbx-sig');
      var pngBytes=await fetch(c.toDataURL('image/png')).then(function(r){return r.arrayBuffer()});
      var img=await pdfDoc.embedPng(pngBytes);
      page.drawText('ลายเซ็นทดสอบ:',{x:50,y:660,size:12,font:thFont,color:PDFLib.rgb(.55,.5,.47)});
      page.drawImage(img,{x:50,y:530,width:260,height:110});
    }
    var bytes=await pdfDoc.save();
    var url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
    window.open(url,'_blank');
    box.innerHTML=alrtH('ok','สร้าง PDF สำเร็จ — เปิดในแท็บใหม่แล้ว (ฟอนต์ไทย + pdf-lib'+(_sbxSigDrawn?' + ฝังลายเซ็น':'')+' ทำงานปกติ)');
  }catch(e){
    box.innerHTML=alrtH('er','สร้าง PDF ไม่สำเร็จ: '+(e.message||e));
  }
}

/* ── 3) แจ้งเตือน ── */
async function _sbxTestEmail(){
  var box=$e('sbx-notif-result'); if(!box) return;
  var to=(CU&&(CU.contact_email||CU.email))||'';
  if(!to||to.indexOf('@gnk.student')>=0){box.innerHTML=alrtH('wa','บัญชีนี้ไม่มีอีเมลจริง (placeholder) — ทดสอบอีเมลไม่ได้ค่ะ');return;}
  box.innerHTML='<div class="al al-in"><span class="sp sp-dark"></span><span> กำลังส่งอีเมลทดสอบ...</span></div>';
  try{
    // header ต้องเป็นชุดเล็กเสมอสำหรับ Edge Functions — ห้ามส่ง H ตรง ๆ (มี Prefer ที่ CORS ปฏิเสธ)
    var r=await fetch(SU+'/functions/v1/send-email',{method:'POST',headers:{apikey:SK,'Authorization':H.Authorization,'Content-Type':'application/json'},
      body:JSON.stringify({to:to,subject:(SETT.email_prefix||'[กนค.]')+' ทดสอบระบบอีเมล (Dev Sandbox)',html:'<p>อีเมลทดสอบจากแท็บ "ทดสอบระบบ" ใน Dev Panel — ถ้าได้รับฉบับนี้แปลว่า Edge Function send-email และ Resend ทำงานปกติค่ะ</p><p style="color:#888;font-size:12px">ส่งเมื่อ '+new Date().toLocaleString('th-TH')+'</p>'})});
    box.innerHTML=r.ok?alrtH('ok','ส่งสำเร็จ — เช็คกล่องจดหมาย '+to+' (Edge Function + Resend ทำงานปกติ)')
      :alrtH('er','ส่งไม่สำเร็จ (HTTP '+r.status+') — เช็ค RESEND_API_KEY / การ deploy ฟังก์ชัน send-email');
  }catch(e){box.innerHTML=alrtH('er','ส่งไม่สำเร็จ: '+(e.message||e)+' — ถ้าเป็น "Failed to fetch" มักคือฟังก์ชันยังไม่ถูก deploy');}
}
async function _sbxTestLine(){
  var box=$e('sbx-notif-result'); if(!box) return;
  box.innerHTML='<div class="al al-in"><span class="sp sp-dark"></span><span> กำลังส่ง LINE ทดสอบ...</span></div>';
  try{
    if(typeof sendLinePush!=='function') throw new Error('ไม่พบฟังก์ชัน sendLinePush');
    var res=await sendLinePush(CU.id,'🧪 ทดสอบระบบ LINE จาก Dev Panel — '+new Date().toLocaleString('th-TH'));
    if(res&&res.skipped==='not_linked') box.innerHTML=alrtH('wa','บัญชีนี้ยังไม่ได้เชื่อม LINE — เชื่อมก่อนที่กระดิ่ง → "รับแจ้งเตือนทาง LINE" แล้วลองใหม่');
    else box.innerHTML=alrtH('ok','ส่ง LINE สำเร็จ — เช็คแชท LINE ของคุณ (Edge Function send-line ทำงานปกติ)');
  }catch(e){box.innerHTML=alrtH('er','ส่ง LINE ไม่สำเร็จ: '+(e.message||e)+' — เช็คการ deploy ฟังก์ชัน send-line / LINE_CHANNEL_ACCESS_TOKEN');}
}

/* ── 4) SLA ── */
function _sbxCalcSla(){
  var out=$e('sbx-sla-result'); if(!out) return;
  var d=gv('sbx-sla-date'), n=+gv('sbx-sla-days')||0;
  if(!d||n<1){out.innerHTML='';return;}
  var res=addWorkingDays(new Date(d+'T00:00:00'),n);
  out.innerHTML='→ ครบกำหนด: <span style="color:#E83A00">'+res.toLocaleDateString('th-TH',{weekday:'long',day:'numeric',month:'long',year:'numeric'})+'</span>'+
    '<span style="font-size:11px;color:#a89e99;font-weight:500;margin-left:8px">(เหลือ '+workingDaysLeft(res)+' วันทำการจากวันนี้)</span>';
}

/* ── 5) จำลอง workflow ── */
function _sbxShowFlow(){
  var out=$e('sbx-flow-result'); if(!out) return;
  var lt=gv('sbx-flow-lt');
  var isBudget=BUDGET_LTYPES.includes(lt);
  var steps=[{step_name:'ผู้จัดทำ (ผู้สร้างเอกสาร)',self:true}].concat(isBudget?FLOW_STEPS_BUDGET:FLOW_STEPS_GENERAL);
  var srcLabel=function(s){
    if(s.self) return 'ตัวผู้สร้างเอง (แก้ไม่ได้)';
    if(s.pos) return 'ค่าเริ่มต้น: ผู้ถือตำแหน่ง '+(PTH[s.pos]||s.pos);
    if(s.role) return 'ค่าเริ่มต้น: คนแรกที่มีสิทธิ์ '+(RTH[s.role]||s.role);
    return 'ไม่มีค่าเริ่มต้น — ผู้สร้างต้องเลือกเอง';
  };
  out.innerHTML=
    '<div class="al '+(isBudget?'al-wa':'al-in')+'" style="margin-bottom:10px"><span class="al-icon">'+svg('info',13)+'</span>'+
    '<span>ประเภทนี้ใช้สาย<strong>'+(isBudget?'ตรวจงบประมาณ ('+steps.length+' ขั้น)':'ทั่วไป ('+steps.length+' ขั้น)')+'</strong> — ขั้นตอนถูกล็อก ลบ/สลับไม่ได้ แต่เปลี่ยนตัวบุคคลในแต่ละขั้นได้</span></div>'+
    steps.map(function(s,i){
      return '<div style="display:flex;gap:10px;align-items:center;padding:7px 4px;'+(i?'border-top:1px solid #F9F8F7;':'')+'">'+
        '<div style="width:24px;height:24px;border-radius:50%;background:'+(s.self?'#F5F3F0':'#FFF3EE')+';color:'+(s.self?'#a89e99':'#E83A00')+';display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">'+(i+1)+'</div>'+
        '<div style="flex:1"><div style="font-size:12.5px;font-weight:700;color:#18120E">'+esc(s.step_name)+'</div>'+
        '<div style="font-size:10.5px;color:#a89e99">'+srcLabel(s)+'</div></div>'+
      '</div>';
    }).join('');
}
