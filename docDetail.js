/* ─── DOC DETAIL ─── */
async function vDet(docId){
  var rs=await Promise.all([
    dg('documents','?id=eq.'+docId),
    dg('document_files','?document_id=eq.'+docId+'&order=version.desc,uploaded_at.desc'),
    dg('workflow_steps','?document_id=eq.'+docId+'&order=step_number'),
    dg('document_history','?document_id=eq.'+docId+'&order=performed_at.desc&limit=10')
  ]);
  var doc=rs[0][0]; if(!doc) return '<div class="card-empty"><div class="card-empty-icon">'+svg('x',40)+'</div><div class="card-empty-text">ไม่พบเอกสาร</div></div>';
  var files=rs[1], wf=rs[2], hist=rs[3];
  var creator={full_name:'—'};
  if(doc.created_by){var cr=await dg('users','?id=eq.'+doc.created_by);if(cr[0])creator=cr[0]}
  // Fetch assignee names for each workflow step
  var _aIds=wf.filter(function(s){return s.assigned_to}).map(function(s){return s.assigned_to});
  // Include creator and forwarded_to in the lookup
  if(doc.created_by&&_aIds.indexOf(doc.created_by)===-1) _aIds.push(doc.created_by);
  if(doc.forwarded_to_id&&_aIds.indexOf(doc.forwarded_to_id)===-1) _aIds.push(doc.forwarded_to_id);
  if(doc.final_recipient_id&&_aIds.indexOf(doc.final_recipient_id)===-1) _aIds.push(doc.final_recipient_id);
  var _aMap={};
  if(_aIds.length){
    var _aus=await dg('users','?id=in.('+_aIds.join(',')+')'+'&select=id,full_name,contact_email,email');
    _aus.forEach(function(u){_aMap[u.id]=u})
  }
  wf.forEach(function(s){
    if(s.assigned_to&&_aMap[s.assigned_to]){
      s._assigneeName=_aMap[s.assigned_to].full_name;
      s._assigneeEmail=_aMap[s.assigned_to].contact_email||_aMap[s.assigned_to].email
    }
  })
  var _curStep=wf.filter(function(s){return s.status==='active'})[0];
  var canAct=(_curStep&&(_curStep.assigned_to===CU.id || _curStep.rejected_by===CU.id))&&doc.status==='pending';

  // ตรวจสอบว่ามีการส่งคืนแก้ไขในอดีตหรือไม่
  var hasRejectedHistory=wf.some(function(s){return s.status==='rejected'});

  var html=['<div class="flex items-center gap-2.5 mb-[18px] flex-wrap">'];
  html.push('<button class="btn btn-soft sm" data-action="nav" data-view="docs">'+svg('back',13)+' กลับรายการ</button>');
  html.push(sBadge(doc.status));
  if(doc.status==='completed') html.push('<div class="al al-ok !m-0 !py-2 !px-3.5 text-xs !rounded-[20px]"><span class="al-icon">✓</span><span>เอกสารผ่านการอนุมัติทุกขั้นตอนเรียบร้อยแล้ว</span></div>');
  if(hasRejectedHistory && doc.status==='pending') html.push('<div class="al al-wa !m-0 !py-2 !px-3.5 text-xs !rounded-[20px]"><span class="al-icon">↩</span><span>เอกสารที่แก้ไขแล้วหลังการส่งคืน - รอการอนุมัติตามขั้นตอน</span></div>');
  html.push('<div class="ml-auto flex gap-2 flex-wrap">');
  if(CAN.up(CU.role_code)){
    html.push('<button class="btn btn-soft sm" data-action="detUp">'+svg('up',13)+' อัปโหลดไฟล์</button>');
    html.push('<input type="file" id="dup" class="hidden" multiple accept=".pdf,.doc,.docx,.png,.jpg">');
  }
  if(CAN.ed(CU.role_code)&&(doc.status==='draft'||(doc.status==='rejected'&&doc.created_by===CU.id))) html.push('<button class="btn btn-soft sm" data-action="nav" data-view="edit" data-id="'+docId+'">'+svg('edit',13)+' แก้ไขข้อมูล</button>');
  if(doc.status==='rejected'&&doc.created_by===CU.id) html.push('<button class="btn btn-primary sm" data-action="doReSubmit" data-id="'+docId+'">'+svg('up',13)+' ส่งใหม่อีกครั้ง</button>');
  if(canAct){
    html.push('<button class="btn btn-success sm" data-action="showActModal" data-act="approve" data-id="'+docId+'">'+svg('ok',13)+' อนุมัติ / ลงนาม</button>');
    html.push('<button class="btn btn-danger sm" data-action="showActModal" data-act="reject" data-id="'+docId+'">'+svg('x',13)+' ส่งคืนแก้ไข</button>');
  }
  if(doc.status==='completed'){
    html.push('<button class="btn btn-primary sm" data-action="showFwdModal" data-id="'+docId+'">'+svg('sign',13)+' ส่งต่อเอกสาร</button>');
  }
  if(CU.role_code==='ROLE-SYS'){
    html.push('<button class="btn btn-soft sm" data-action="admChgStatus" data-id="'+docId+'">เปลี่ยนสถานะ</button>');
    html.push('<button class="btn btn-danger sm" data-action="admDelDoc" data-id="'+docId+'">ลบเอกสาร</button>');
  }
  html.push('<button class="btn btn-soft sm" data-action="exportDocPDF" data-id="'+docId+'" title="ส่งออก PDF พร้อมประวัติ">📄 Export PDF</button>');
  html.push('</div></div>');
  html.push('<div id="dal"></div>');
  html.push('<div class="two-col"><div>');

  // Info
  var _ico=function(i,bg,cl){return '<div style="width:26px;height:26px;border-radius:7px;background:'+bg+';display:flex;align-items:center;justify-content:center;color:'+cl+'">'+svg(i,13)+'</div>'};
  html.push('<div class="card"><div class="card-head">'+_ico('doc','#FFF3EE','#E83A00')+'<span class="card-head-title">ข้อมูลเอกสาร</span></div><div class="card-body"><div class="detail-list">');
  [['เลขที่','<span class="mono">'+esc(doc.doc_number||'—')+'</span>'],
   ['ชื่อเรื่อง',esc(doc.title)],
   ['เรียน (ถึง)','<strong style="color:var(--orange)">'+esc(doc.addressed_to||'—')+'</strong>'],
   ['จากฝ่าย / หน่วยงาน','<strong>'+esc(doc.from_department||'—')+'</strong>'],
   ['ประเภท',tBadge(doc.doc_type)],
   ['ความเร่งด่วน','<span class="'+urgCls(doc.urgency)+'">'+(URG[doc.urgency]||doc.urgency)+'</span>'],
   ['วันที่เอกสาร',fd(doc.doc_date)],
   ['กำหนดเสร็จ','<span class="text-[#D97706]">'+fd(doc.due_date)+(doc.deadline_datetime?' '+new Date(doc.deadline_datetime).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}):'')+'</span>'],
   ['ผู้จัดทำ',esc(creator.full_name)],
   ['ผู้รับเอกสารเสร็จสิ้น',doc.final_recipient_id&&_aMap[doc.final_recipient_id]?'<strong>'+esc(_aMap[doc.final_recipient_id].full_name)+'</strong>':'<span class="text-[#a89e99]">ผู้จัดทำ (ค่าเริ่มต้น)</span>']
  ].forEach(function(r){
    html.push('<div class="detail-row"><span class="detail-key">'+r[0]+'</span><span class="detail-val">'+r[1]+'</span></div>')
  });
  html.push('</div>');
  if(doc.description) html.push('<div class="mt-3.5 p-3 bg-[#FAFAFA] rounded-[10px] text-[13px] text-[#6b6560] leading-[1.7] border-l-[3px] border-l-[#ffc9a8]">'+esc(doc.description)+'</div>');
  // Show forwarded_to info
  if(doc.forwarded_to_id&&doc.status==='completed'){
    var _fwdUser=_aMap[doc.forwarded_to_id];
    if(_fwdUser) html.push('<div class="al al-ok mt-3.5"><span class="al-icon">'+svg('sign',15)+'</span><div><strong>ส่งเอกสารถึง: '+esc(_fwdUser.full_name)+'</strong>'+(doc.forwarded_at?'<div class="text-[11px] mt-0.5">เมื่อ '+new Date(doc.forwarded_at).toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'})+'</div>':'')+'</div></div>')
  }
  html.push('</div></div>');

  // Files — grouped version history
  var _signedFile=files.find(function(f){return f.file_name.indexOf('[ลงนาม]')>=0||f.file_name.indexOf('signed_')>=0});
  var _maxVer=files.reduce(function(m,f){return Math.max(m,f.version||1)},0);
  var _currentFiles=files.filter(function(f){return f.version===_maxVer});
  var _histFiles=files.filter(function(f){return f.version<_maxVer});
  var _verCount=files.filter(function(f){return f.version>1}).length;

  html.push('<div class="card"><div class="card-head">'+_ico('folder','#FFF3EE','#E83A00')+'<span class="card-head-title">ไฟล์แนบ</span>');
  html.push('<span class="ml-auto text-xs text-[#a89e99]">'+files.length+' ไฟล์');
  if(_verCount>0) html.push(' · <span class="text-[#2563EB] font-semibold">'+_verCount+' เวอร์ชันแก้ไข</span>');
  html.push('</span></div>');
  if(_signedFile){
    html.push('<div class="px-4 py-2.5 bg-[#F0FDF4] border-b border-[#C8E6C9] flex items-center gap-2.5">');
    html.push(svg('ok',14)+'<div class="flex-1"><div class="text-xs font-semibold text-[#16A34A]">เอกสารฉบับลงนาม (ล่าสุด)</div>');
    html.push('<div class="text-[11px] text-[#a89e99]">'+esc(_signedFile.file_name)+'</div></div>');
    html.push('<a class="btn btn-ghost xs" href="'+furl(_signedFile.file_path)+'" target="_blank" download>'+svg('dn',12)+' ดาวน์โหลด</a>');
    html.push('<button class="btn btn-success xs" data-action="openViewer" data-url="'+furl(_signedFile.file_path)+'" data-name="'+esc(_signedFile.file_name)+'">'+svg('eye',12)+' ดูฉบับเซ็น</button>');
    html.push('</div>');
  }
  html.push('<div class="card-body" id="dfiles">');
  if(files.length){
    // ── ไฟล์เวอร์ชันปัจจุบัน ──
    html.push('<div class="text-[11px] font-bold tracking-[.5px] uppercase text-[#16A34A] mb-2">ฉบับปัจจุบัน</div>');
    (_currentFiles.length?_currentFiles:[files[0]]).forEach(function(f){
      var isImg=f.file_type&&f.file_type.includes('image');
      var isSigned=f.file_name.indexOf('[ลงนาม]')>=0||f.file_name.indexOf('signed_')>=0;
      var dtStr=f.uploaded_at?new Date(f.uploaded_at).toLocaleString('th-TH',{day:'numeric',month:'short',year:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
      html.push('<div class="file-item border-[#16A34A] bg-[#F0FDF4]">');
      html.push('<span class="file-icon">'+svg(isImg?'img2':'pdf_ico',20)+'</span>');
      html.push('<div class="file-info">');
      html.push('<div class="file-name text-[#16A34A]">'+esc(f.file_name)+'</div>');
      html.push('<div class="flex gap-[5px] items-center mt-1 flex-wrap">');
      html.push('<span class="badge b-completed text-[10px] px-[7px] py-0.5">v'+f.version+' ล่าสุด</span>');
      if(isSigned) html.push('<span class="badge b-signed text-[10px] px-[7px] py-0.5">ลงนามแล้ว</span>');
      html.push('<span class="file-meta">'+fsz(f.file_size)+' · '+dtStr+'</span></div>');
      html.push('</div><div class="file-actions">');
      html.push('<button class="btn btn-ghost xs" data-action="openViewer" data-url="'+furl(f.file_path)+'" data-name="'+esc(f.file_name)+'">'+svg('eye',12)+' ดู</button>');
      html.push('<button class="btn btn-soft xs" data-action="openEditor" data-url="'+furl(f.file_path)+'" data-name="'+esc(f.file_name)+'" data-fid="'+f.id+'" data-did="'+docId+'">'+svg('edit',12)+' แก้ไข</button>');
      html.push('<a class="btn btn-soft xs" href="'+furl(f.file_path)+'" target="_blank" download>'+svg('dn',12)+' โหลด</a>');
      html.push('</div></div>');
    });

    // ── ประวัติเวอร์ชันก่อนหน้า ──
    if(_histFiles.length){
      html.push('<button class="cursor-pointer text-xs font-semibold text-[#2563EB] py-2 mt-2 border-t border-dashed border-[#EBEBEB] w-full text-left bg-transparent border-x-0 border-b-0" data-action="showVerHist" data-id="'+docId+'">▶ ประวัติเวอร์ชันก่อนหน้า ('+_histFiles.length+' ไฟล์)</button>');
    }
  } else {
    html.push('<div class="card-empty py-6"><div class="card-empty-icon">📂</div><div class="card-empty-text">ยังไม่มีไฟล์แนบ</div></div>')
  }
  html.push('</div></div>');

  // Notification log card — admin only
  if(CU.role_code==='ROLE-SYS'){
    html.push('<div class="card"><div class="card-head">'+_ico('bell','#FFF3EE','#E83A00')+'<span class="card-head-title">บันทึกการแจ้งเตือนอีเมล</span></div><div class="card-body" id="d-notif-list">');
    html.push('<div class="al al-in text-xs"><span class="al-icon">ℹ</span><span>ระบบส่งอีเมลแจ้งเตือนอัตโนมัติเมื่อมีการเปลี่ยนขั้นตอน</span></div>');
    html.push('<div id="notif-loading" class="text-[#a89e99] text-[13px]">กำลังโหลด...</div>');
    html.push('</div></div>');
  }
  html.push('</div>');

  // Right: Workflow
  html.push('<div><div class="card"><div class="card-head">'+_ico('ok','#FFF3EE','#E83A00')+'<span class="card-head-title">ติดตามสถานะงาน</span><span class="ml-auto text-[11px] text-[#a89e99]">'+wf.filter(function(s){return s.status==="done"}).length+'/'+wf.length+' ขั้นตอน</span></div><div class="card-body">');
  if(wf.length){
    html.push('<div class="timeline">');
    wf.forEach(function(s,i){
      var done=s.status==='done', act=s.status==='active', wait=s.status==='waiting', rej=s.status==='rejected', last=i===wf.length-1;
      html.push('<div class="tl-item">');
      html.push('<div class="tl-spine"><div class="tl-dot '+(done?'tl-dot-done':act?'tl-dot-active':rej?'tl-dot-rejected':'tl-dot-wait')+'">'+(done?svg('ok',11):rej?svg('x',11):i+1)+'</div>'+(!last?'<div class="tl-line '+(done?'tl-line-done':'tl-line-wait')+'"></div>':'')+'</div>');
      html.push('<div class="tl-body"><div class="tl-title '+(act?'text-[#D97706]':rej?'text-[#DC2626]':'')+'">'+esc(s.step_name)+'</div>');
      html.push('<div class="tl-sub">'+(RTH[s.role_required]||s.role_required)+(s._assigneeName?' · <strong>'+esc(s._assigneeName)+'</strong>':'')+'</div>');
      if(s.action_at){
        var _adt=new Date(s.action_at);
        var _adtStr=_adt.toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit'})+' '+_adt.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
        html.push('<div class="tl-time '+(done?'text-[#16A34A]':'text-[#DC2626]')+'">'+(done?svg('ok',11)+' เสร็จสิ้น':svg('x',11)+' ส่งคืน')+' · '+_adtStr+'</div>');
      }
      if(act){
        var _ddl=s.deadline_datetime?new Date(s.deadline_datetime):null;
        var _late=_ddl&&(new Date())>_ddl;
        var _ddlStr=_ddl?(_ddl.toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit'})+' '+_ddl.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})):'';
        html.push('<div class="tl-time text-[#D97706]">⏳ กำลังดำเนินการ'+(_ddlStr?' · ครบกำหนด: '+_ddlStr+(_late?' <span class="text-[#DC2626] font-bold"> (เกินกำหนด!)</span>':''):'')+'</div>');
        if(!_ddlStr) html.push('<div class="tl-time text-[#a89e99]">กำหนด '+s.deadline_days+' วัน</div>');
      }
      if(s.revision_section) html.push('<div class="tl-note text-[#DC2626]">ส่วนที่ต้องแก้ไข: <strong>'+esc(s.revision_section)+'</strong></div>');
      if(s.note) html.push('<div class="tl-note">"'+esc(s.note)+'"</div>');
      html.push('</div></div>');
    });
    html.push('</div>')
  } else {
    html.push('<div class="card-empty py-6"><div class="card-empty-icon">📋</div><div class="card-empty-text">ยังไม่ได้กำหนดขั้นตอน</div></div>')
  }
  html.push('</div></div>');

  // History — right column, below workflow
  var _histIcon=function(action){
    var a=action||'';
    if(a.indexOf('อนุมัติ')>=0||a.indexOf('ลงนาม')>=0) return {ic:'ok',  bg:'#D1FAE5',cl:'#16A34A'};
    if(a.indexOf('ส่งคืน')>=0)                          return {ic:'x',   bg:'#FEE2E2',cl:'#DC2626'};
    if(a.indexOf('ส่งใหม่')>=0||a.indexOf('ส่งอีกครั้ง')>=0) return {ic:'undo',bg:'#DBEAFE',cl:'#2563EB'};
    if(a.indexOf('อัปโหลด')>=0)                         return {ic:'up',  bg:'#EDE9FE',cl:'#7C3AED'};
    if(a.indexOf('ฝังลายเซ็น')>=0)                      return {ic:'pen', bg:'#D1FAE5',cl:'#16A34A'};
    if(a.indexOf('แก้ไข')>=0)                           return {ic:'edit',bg:'#FEF3C7',cl:'#D97706'};
    if(a.indexOf('ส่งต่อ')>=0)                          return {ic:'sign',bg:'#FFF3EE',cl:'#E83A00'};
    if(a.indexOf('สร้าง')>=0||a.indexOf('ส่งเอกสาร')>=0) return {ic:'doc',bg:'#FFF3EE',cl:'#E83A00'};
    return {ic:'doc',bg:'#F5F5F5',cl:'#6b6560'};
  };
  html.push('<div class="card"><div class="card-head">'+_ico('cal','#FFF3EE','#E83A00')+'<span class="card-head-title">ประวัติการดำเนินการ</span></div><div class="card-body">');
  if(hist.length){
    hist.forEach(function(h){
      var _hi=_histIcon(h.action);
      html.push('<div class="flex gap-3 py-2.5 border-b border-[#F5F5F5] last:border-0">');
      html.push('<div class="w-[32px] h-[32px] rounded-[9px] flex items-center justify-center shrink-0" style="background:'+_hi.bg+';color:'+_hi.cl+'">'+svg(_hi.ic,15)+'</div>');
      html.push('<div class="flex-1 min-w-0"><div class="text-[13px] font-semibold leading-tight">'+esc(h.action)+'</div>');
      if(h.note) html.push('<div class="text-xs text-[#a89e99] italic mt-0.5 truncate">"'+esc(h.note)+'"</div>');
      html.push('<div class="text-[11px] text-[#a89e99] mt-0.5">'+fd(h.performed_at)+'</div></div></div>');
    })
  } else {
    html.push('<p class="text-[#a89e99] text-[13px]">ยังไม่มีประวัติการดำเนินการ</p>')
  }
  html.push('</div></div>');

  html.push('</div></div>');

  setTimeout(function(){
    var dup=$e('dup');
    if(dup) dup.onchange=function(){detUp(Array.from(dup.files),docId)};
    if(CU.role_code==='ROLE-SYS') loadNotifLog(docId)
  },80);

  return html.join('')
}

async function detUp(files,docId){
  var a=$e('dal');
  var ALLOWED_MIME2=['application/pdf','application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png','image/jpeg'];
  var MAX_SIZE2=10*1024*1024;
  var errs2=[];
  for(var k=0;k<files.length;k++){
    var fk=files[k];
    if(fk.size>MAX_SIZE2) errs2.push(fk.name+' เกิน 10 MB ('+fsz(fk.size)+')');
    else if(ALLOWED_MIME2.indexOf(fk.type)===-1) errs2.push(fk.name+' ประเภทไม่รองรับ ('+fk.type+')');
  }
  if(errs2.length){if(a)a.innerHTML=alrtH('er',errs2.join(' · '));return}
  if(a) a.innerHTML='<div class="al al-in"><span class="sp sp-dark"></span><span> กำลังอัปโหลด...</span></div>';
  var existingFiles=await dg('document_files','?document_id=eq.'+docId+'&select=version&order=version.desc&limit=1');
  var nextVer=(existingFiles.length&&existingFiles[0].version?existingFiles[0].version:0)+1;
  for(var i=0;i<files.length;i++){
    var f=files[i];var safeName2=f.name.replace(/[^a-zA-Z0-9._-]/g,'_');var path=Date.now()+'_'+safeName2;
    await upFile(path,f);
    await dp('document_files',{document_id:docId,file_name:f.name,file_path:path,file_size:f.size,file_type:f.type,uploaded_by:CU.id,version:nextVer+i});
    await dp('document_history',{document_id:docId,action:'อัปโหลดไฟล์: '+f.name,performed_by:CU.id})
  }
  if(a) a.innerHTML=alrtH('ok','อัปโหลดเรียบร้อยแล้ว');
  var nf=await dg('document_files','?document_id=eq.'+docId+'&order=uploaded_at');
  var df=$e('dfiles');
  if(df){
    df.innerHTML='';
    nf.forEach(function(f){
      var isImg=f.file_type&&f.file_type.includes('image');
      var div=document.createElement('div'); div.className='file-item';
      div.innerHTML='<span class="file-icon">'+(isImg?''+svg('img2',18)+'':'📄')+'</span>'+
        '<div class="file-info"><div class="file-name">'+esc(f.file_name)+'</div><div class="file-meta">'+fsz(f.file_size)+' · v'+f.version+'</div></div>'+
        '<div class="file-actions">'+
        '<button class="btn btn-ghost xs" data-action="openViewer" data-url="'+furl(f.file_path)+'" data-name="'+esc(f.file_name)+'">'+svg('eye',12)+' ดู</button>'+
        '<button class="btn btn-soft xs" data-action="openEditor" data-url="'+furl(f.file_path)+'" data-name="'+esc(f.file_name)+'" data-fid="'+f.id+'" data-did="'+docId+'">'+svg('edit',12)+' แก้ไข</button>'+
        '<a class="btn btn-soft xs" href="'+furl(f.file_path)+'" target="_blank" download>'+svg('dn',12)+'</a>'+
        '</div>';
      df.appendChild(div)
    })
  }
}

async function showVerHist(docId){
  var w=$e('mwrap'); if(!w)return;
  var files=await dg('document_files','?document_id=eq.'+docId+'&order=version.desc,uploaded_at.desc');
  var _maxVer=files.reduce(function(m,f){return Math.max(m,f.version||1)},0);
  var _histFiles=files.filter(function(f){return f.version<_maxVer});
  if(!_histFiles.length){w.innerHTML='';return}
  var rows=_histFiles.map(function(f){
    var isImg=f.file_type&&f.file_type.includes('image');
    var isSigned=f.file_name.indexOf('[ลงนาม]')>=0||f.file_name.indexOf('signed_')>=0;
    var isEdited=f.file_name.indexOf('[แก้ไข]')>=0||f.file_name.indexOf('edited_')>=0;
    var dtStr=f.uploaded_at?new Date(f.uploaded_at).toLocaleString('th-TH',{day:'numeric',month:'short',year:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
    return '<div class="file-item bg-[#FAFAFA]">'+
      '<span class="file-icon opacity-60">'+svg(isImg?'img2':'pdf_ico',18)+'</span>'+
      '<div class="file-info">'+
        '<div class="file-name text-[#6b6560] text-xs">'+esc(f.file_name)+'</div>'+
        '<div class="flex gap-[5px] items-center mt-[3px] flex-wrap">'+
          '<span class="badge b-draft text-[10px] px-1.5 py-px">v'+f.version+'</span>'+
          (isSigned?'<span class="badge b-signed text-[10px] px-1.5 py-px">ลงนาม</span>':'')+
          (isEdited?'<span class="badge text-[10px] px-1.5 py-px bg-[#f5f5f5] text-[#888]">แก้ไข</span>':'')+
          '<span class="file-meta">'+fsz(f.file_size)+' · '+dtStr+'</span>'+
        '</div>'+
      '</div>'+
      '<div class="file-actions">'+
        '<button class="btn btn-ghost xs" data-action="openViewer" data-url="'+furl(f.file_path)+'" data-name="'+esc(f.file_name)+'">'+svg('eye',12)+' ดู</button>'+
        '<a class="btn btn-soft xs" href="'+furl(f.file_path)+'" target="_blank" download>'+svg('dn',12)+' โหลด</a>'+
      '</div>'+
    '</div>'
  }).join('');
  w.innerHTML='<div class="mo"><div class="modal">'+
    '<div class="modal-head"><span class="modal-title">'+svg('save',15)+' ประวัติเวอร์ชันก่อนหน้า</span>'+
    '<button class="btn btn-ghost xs ml-auto" data-action="closeModal">✕</button></div>'+
    '<div class="modal-body" style="max-height:60vh;overflow-y:auto">'+rows+'</div>'+
  '</div></div>'
}

async function showFwdModal(docId){
  var w=$e('mwrap'); if(!w)return;
  var allUsers=await dg('users','?is_active=eq.true&approval_status=eq.approved&order=full_name');
  var doc=(await dg('documents','?id=eq.'+docId))[0]||{};
  var uOpts=allUsers.map(function(u){
    return '<option value="'+u.id+'"'+(doc.forwarded_to_id===u.id?' selected':'')+'>'+esc(u.full_name)+' ('+RTH[u.role_code]+')</option>'
  }).join('');
  w.innerHTML=[
    '<div class="mo"><div class="modal">',
    '<div class="modal-head"><span class="modal-title">'+svg('sign',15)+' ส่งต่อเอกสาร</span>',
    '<button class="btn btn-soft sm btn-icon" data-action="closeModal">'+svg('x',14)+'</button></div>',
    '<div class="modal-body">',
    '<div class="al al-in" style="margin-bottom:14px"><span class="al-icon">ℹ</span>',
    '<span>เลือกบุคคลที่ต้องการส่งเอกสารฉบับสมบูรณ์นี้ไปให้ ระบบจะแจ้งเตือนทางอีเมล</span></div>',
    '<div class="fg"><label class="fl">ส่งเอกสารถึง <span class="req">*</span></label>',
    '<select class="fi" id="fwd-to"><option value="">— เลือกผู้รับ —</option>'+uOpts+'</select></div>',
    '<div class="fg"><label class="fl">หมายเหตุ / วัตถุประสงค์</label>',
    '<textarea class="fi" id="fwd-note" rows="2" placeholder="เช่น เพื่อพิจารณา / เพื่อทราบ / สำหรับเก็บเข้าแฟ้ม..."></textarea></div>',
    '</div>',
    '<div class="modal-foot">',
    '<button class="btn btn-soft" data-action="closeModal">ยกเลิก</button>',
    '<button class="btn btn-primary" data-action="doForward" data-id="'+docId+'">'+svg('sign',13)+' ส่งต่อเอกสาร</button>',
    '</div></div></div>'
  ].join('');
}

async function doForward(docId){
  var toId=gv('fwd-to'), note=gv('fwd-note');
  if(!toId){alert('กรุณาเลือกผู้รับ');return}
  var btn=document.querySelector('[data-action="doForward"]');
  if(btn){btn.disabled=true;btn.innerHTML='<span class="sp"></span>'}
  try{
    await dpa('documents',docId,{forwarded_to_id:toId,forwarded_at:new Date().toISOString()});
    await dp('document_history',{document_id:docId,action:'ส่งต่อเอกสาร',performed_by:CU.id,note:note||'ส่งต่อเอกสาร'});
    // Notify recipient
    var toUser=(await dg('users','?id=eq.'+toId))[0];
    var doc2=(await dg('documents','?id=eq.'+docId))[0]||{};
    var recipEmail=toUser?(toUser.contact_email||toUser.email):'';
    if(recipEmail&&!recipEmail.includes('@gnk.student')){
      var emailSubj='[กนค.] ส่งต่อเอกสาร: '+(doc2.subject_line||doc2.title||'');
      var emailBody='เรียน '+(toUser?toUser.full_name:'')+', ท่านได้รับเอกสารเรื่อง "'+(doc2.title||'')+'" ที่ผ่านการอนุมัติเรียบร้อยแล้ว'+(note?' หมายเหตุ: '+note:'');
      var fwdStatus='failed';
      try{
        var fwdResp=await fetch(SU+'/functions/v1/send-email',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SK,'apikey':SK},body:JSON.stringify({to:recipEmail,subject:emailSubj,html:emailBody})});
        fwdStatus=fwdResp.ok?'sent':'failed';
        if(fwdResp.ok) showEmailToast(recipEmail,emailSubj);
      }catch(fe){console.warn('Forward email failed:',fe)}
      await dp('notifications',{document_id:docId,recipient_id:toId,recipient_email:recipEmail,subject:emailSubj,body:emailBody,notification_type:'forward',status:fwdStatus,sent_at:new Date().toISOString()});
    }
    $e('mwrap').innerHTML='';
    var a=$e('dal');if(a)a.innerHTML=alrtH('ok','ส่งต่อเอกสารเรียบร้อยแล้ว และแจ้งเตือนทางอีเมลแล้ว');
    setTimeout(function(){nav('det',docId)},900)
  }catch(e){alert('เกิดข้อผิดพลาด: '+e.message);if(btn)btn.disabled=false}
}

async function loadNotifLog(docId){
  var el=$e('notif-loading'); if(!el)return;
  try{
    var logs=await dg('notifications','?document_id=eq.'+docId+'&order=sent_at.desc&limit=10');
    if(!logs.length){el.textContent='ยังไม่มีการส่งอีเมล';return}
    el.outerHTML=logs.map(function(n){
      var dt=new Date(n.sent_at);
      var dtStr=dt.toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit'})+' '+dt.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
      return '<div class="flex gap-2.5 py-[9px] border-b border-[#F5F5F5] items-start">'+
        '<div class="w-7 h-7 rounded-full bg-[#EFF6FF] flex items-center justify-center shrink-0">'+svg('bell',14)+'</div>'+
        '<div><div class="text-xs font-semibold text-[#18120E]">'+esc((n.subject||'').replace(/<[^>]*>/g,''))+'</div>'+
        '<div class="text-[11px] text-[#a89e99]">ถึง: '+esc(n.recipient_email)+'</div>'+
        '<div class="text-[11px] text-[#a89e99]">'+dtStr+'</div></div></div>'
    }).join('')
  }catch(e){if(el)el.textContent='โหลดล้มเหลว'}
}

function showActModal(action,docId){
  var w=$e('mwrap'); if(!w)return;
  var isApprove=action==='approve';
  var sigSection=isApprove?[
    '<div class="border border-[#EBEBEB] rounded-[10px] p-3.5 mb-3.5 bg-[#FAFAFA]">',
    '<div class="text-xs font-semibold text-[#6b6560] mb-2.5">วางลายเซ็นในเอกสาร (ไม่บังคับ)</div>',
    '<div class="itabs mb-2.5"><button class="itab on" id="sig-tab-a" onclick="sigTabA(this.dataset.t)" data-t="draw">วาดลายเซ็น</button><button class="itab" id="sig-tab-b" onclick="sigTabA(this.dataset.t)" data-t="upload">อัปโหลดรูป</button></div>',
    '<div id="sig-panel-draw">',
    '<canvas id="asgc" class="border-[1.5px] border-[#EBEBEB] rounded-[10px] bg-white block w-full cursor-crosshair touch-none" height="90"></canvas>',
    '<div class="flex gap-[7px] mt-2">',
    '<button class="btn btn-soft sm fw" onclick="clearASig()">ล้าง</button>',
    '</div></div>',
    '<div id="sig-panel-upload" class="hidden">',
    '<div class="border-2 border-dashed border-[#EBEBEB] rounded-[10px] p-3.5 text-center cursor-pointer" id="asig-drop-zone">',
    '<div class="text-[22px] mb-1">🖊️</div><div class="text-xs font-semibold">คลิกอัปโหลดรูปลายเซ็น</div><div class="text-[10px] text-[#a89e99]">PNG โปร่งใสแนะนำ</div></div>',
    '<input type="file" id="asig-file" accept="image/*" class="hidden">',
    '<img id="asig-prev" class="hidden max-h-[70px] mt-2 max-w-full object-contain">',
    '</div></div>'
  ].join(''):'';

  var html=[
    '<div class="mo"><div class="modal">',
    '<div class="modal-head">',
    '<span class="modal-title">'+(isApprove?'ยืนยันการอนุมัติ':'↩ ยืนยันการส่งคืน')+'</span>',
    '<button class="btn btn-soft sm btn-icon" data-action="closeModal">'+svg('x',14)+'</button>',
    '</div>',
    '<div class="modal-body">',
    '<div class="al al-'+(isApprove?'ok':'er')+'" style="margin-bottom:14px">',
    '<span class="al-icon">'+(isApprove?'✓':'⚠')+'</span>',
    '<span>'+(isApprove?'คุณกำลังจะอนุมัติและลงนามในเอกสารนี้':'คุณกำลังจะส่งคืนเอกสารเพื่อให้แก้ไข')+'</span></div>',
    sigSection,
    (!isApprove?'<div class="fg"><label class="fl">ส่วนที่ต้องแก้ไข <span class="req">*</span></label>'+
    '<select class="fi" id="rev-section">'+
    '<option value="">— เลือกส่วนที่ต้องแก้ไข —</option>'+
    '<option value="ชื่อเรื่อง / หัวเรื่อง">ชื่อเรื่อง / หัวเรื่อง</option>'+
    '<option value="เนื้อหาเอกสาร">เนื้อหาเอกสาร</option>'+
    '<option value="รูปแบบเอกสาร / การจัดหน้า">รูปแบบเอกสาร / การจัดหน้า</option>'+
    '<option value="ข้อมูลผู้ส่ง / ที่อยู่">ข้อมูลผู้ส่ง / ที่อยู่</option>'+
    '<option value="ลายเซ็น / การอนุมัติ">ลายเซ็น / การอนุมัติ</option>'+
    '<option value="ไฟล์แนบ">ไฟล์แนบ</option>'+
    '<option value="อื่น ๆ (ระบุในหมายเหตุ)">อื่น ๆ (ระบุในหมายเหตุ)</option>'+
    '</select></div>':''),
    '<div class="fg"><label class="fl">หมายเหตุ '+(isApprove?'(ถ้ามี)':'/ รายละเอียดที่ต้องแก้ไข')+'</label>',
    '<textarea class="fi" id="anote" rows="3" placeholder="'+(isApprove?'ระบุหมายเหตุเพิ่มเติม...':'อธิบายรายละเอียดที่ต้องแก้ไขให้ชัดเจน...')+'"></textarea></div>',
    '</div>',
    '<div class="modal-foot">',
    '<button class="btn btn-soft" data-action="closeModal">ยกเลิก</button>',
    '<button class="btn '+(isApprove?'btn-success':'btn-danger')+'" data-action="doAct" data-act="'+action+'" data-id="'+docId+'">',
    (isApprove?'ยืนยันอนุมัติ':'↩ ยืนยันส่งคืน'),
    '</button></div></div></div>'
  ];
  w.innerHTML=html.join('');
  if(isApprove) setTimeout(function(){initActSig()},80)
}

// ─── Approve-modal signature ───
var _actSigCtx=null, _actSigDrawing=false;
function sigTabA(tab){
  $e('sig-tab-a').className='itab'+(tab==='draw'?' on':'');
  $e('sig-tab-b').className='itab'+(tab==='upload'?' on':'');
  $e('sig-panel-draw').style.display=tab==='draw'?'block':'none';
  $e('sig-panel-upload').style.display=tab==='upload'?'block':'none'
}
function initActSig(){
  var sc=$e('asgc'); if(!sc)return;
  sc.width=sc.offsetWidth||380;
  _actSigCtx=sc.getContext('2d');
  var af=$e('asig-file');
  if(af) af.onchange=function(){previewASig(af)};
  var dz=$e('asig-drop-zone');
  if(dz&&af) dz.onclick=function(){af.click()};
  sc.onpointerdown=function(e){_actSigDrawing=true;var r=sc.getBoundingClientRect();_actSigCtx.beginPath();_actSigCtx.moveTo((e.clientX-r.left)*(sc.width/r.width),(e.clientY-r.top)*(sc.height/r.height))};
  sc.onpointermove=function(e){if(!_actSigDrawing)return;var r=sc.getBoundingClientRect();_actSigCtx.lineTo((e.clientX-r.left)*(sc.width/r.width),(e.clientY-r.top)*(sc.height/r.height));_actSigCtx.strokeStyle='#1C1C1E';_actSigCtx.lineWidth=2;_actSigCtx.lineCap='round';_actSigCtx.lineJoin='round';_actSigCtx.stroke()};
  sc.onpointerup=sc.onpointerleave=function(){_actSigDrawing=false}
}
function clearASig(){var sc=$e('asgc');if(sc&&_actSigCtx)_actSigCtx.clearRect(0,0,sc.width,sc.height)}
function previewASig(inp){
  var f=inp.files[0];if(!f)return;
  var r=new FileReader();r.onload=function(e){
    var p=$e('asig-prev');if(p){p.src=e.target.result;p.style.display='block'}
    window._actSigSrc=e.target.result
  };r.readAsDataURL(f)
}
function getActSigSrc(){
  // Returns signature dataURL or null
  var drawPanel=$e('sig-panel-draw');
  if(drawPanel&&drawPanel.style.display!=='none'){
    var sc=$e('asgc');if(!sc)return null;
    // Check if canvas has content
    var ctx=sc.getContext('2d');
    var px=ctx.getImageData(0,0,sc.width,sc.height).data;
    var hasContent=false;for(var i=3;i<px.length;i+=4){if(px[i]>10){hasContent=true;break}}
    return hasContent?sc.toDataURL('image/png'):null
  } else {
    return window._actSigSrc||null
  }
}

async function doAct(action,docId){
  var note=gv('anote');
  var revSection=action==='reject'?(gv('rev-section')||''):'';
  if(action==='reject'&&!revSection){alert('กรุณาเลือกส่วนที่ต้องแก้ไข');return}
  var fullNote=revSection?(revSection+(note?' — '+note:'')):(note||'');
  note=fullNote;
  // Capture signature before closing modal
  var sigSrc=action==='approve'?getActSigSrc():null;
  var mw=$e('mwrap'); if(mw) mw.innerHTML='<div class="mo"><div class="modal"><div class="modal-body text-center py-10"><div class="sp sp-dark w-8 h-8 border-[3px] mx-auto"></div><p class="mt-4 text-[#a89e99]">กำลังดำเนินการ...</p></div></div></div>';
  var docs=await dg('documents','?id=eq.'+docId); var doc=docs[0]; if(!doc)return;
  var wf=await dg('workflow_steps','?document_id=eq.'+docId+'&order=step_number');
  var cur=wf.filter(function(s){return s.status==='active'})[0]||wf[0];
  if(cur){
    await dpa('workflow_steps',cur.id,{status:action==='approve'?'done':'rejected',action_taken:action,note:note,revision_section:revSection||null,action_at:new Date().toISOString(),completed_at:action==='approve'?new Date().toISOString():null,rejected_by:action==='reject'?CU.id:null});
    if(action==='approve'){
      // หาขั้นตอนถัดไปที่ยังไม่เสร็จ (ไม่ใช่ done หรือ rejected)
      var nx=wf.find(function(s){return s.step_number>cur.step_number && s.status!=='done' && s.status!=='rejected'});
      if(nx)await dpa('workflow_steps',nx.id,{status:'active'});
    }
  }
  var ns=Math.min((doc.current_step||1)+1,doc.total_steps||1);
  var allDone=action==='approve'&&cur.step_number>=(doc.total_steps||1);
  var nst=action==='approve'?(allDone?'completed':'pending'):'rejected';
  await dpa('documents',docId,{status:nst,current_step:ns,updated_at:new Date().toISOString()});
  await dp('document_history',{document_id:docId,action:action==='approve'?'อนุมัติ / ลงนาม':'ส่งคืนแก้ไข',performed_by:CU.id,note:note});
  // When completed: forward to final_recipient or back to creator
  if(nst==='completed'){
    var _finalRecId=doc.final_recipient_id||doc.created_by;
    if(_finalRecId){
      await dpa('documents',docId,{forwarded_to_id:_finalRecId,forwarded_at:new Date().toISOString()});
      await dp('document_history',{document_id:docId,action:'ส่งเอกสารคืนผู้รับเอกสาร',performed_by:CU.id,note:doc.final_recipient_note||'เอกสารเสร็จสิ้น ส่งคืนผู้รับผิดชอบ'})
    }
  }
  // Embed signature into latest PDF if provided
  if(sigSrc&&action==='approve'){
    try{
      var files=await dg('document_files','?document_id=eq.'+docId+'&file_type=like.application%2Fpdf&order=uploaded_at.desc&limit=1');
      if(files&&files.length){
        var latestFile=files[0];
        var fileUrl2=furl(latestFile.file_path);
        if(!window.PDFLib) await loadSc('https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js');
        var pdfResp=await fetch(fileUrl2);
        if(pdfResp.ok){
          var pdfBuf=await pdfResp.arrayBuffer();
          var pdfDoc=await PDFLib.PDFDocument.load(new Uint8Array(pdfBuf),{ignoreEncryption:true});
          var lastPg=pdfDoc.getPage(pdfDoc.getPageCount()-1);
          var pw=lastPg.getWidth(),ph=lastPg.getHeight();
          var imgBytes=await fetch(sigSrc).then(function(r){return r.arrayBuffer()});
          var emb=await pdfDoc.embedPng(imgBytes);
          // Place signature at bottom-right area
          lastPg.drawImage(emb,{x:pw-220,y:40,width:180,height:60});
          var newBytes=await pdfDoc.save();
          var safeName=latestFile.file_name.replace(/[^a-zA-Z0-9._-]/g,'_');
          var newPath='signed_'+Date.now()+'_'+safeName;
          var newBlob=new Blob([newBytes],{type:'application/pdf'});
          await upFile(newPath,newBlob);
          await dp('document_files',{document_id:docId,file_name:'[ลงนาม] '+latestFile.file_name,file_path:newPath,file_size:newBlob.size,file_type:'application/pdf',uploaded_by:CU.id,version:(latestFile.version||1)+1});
          await dp('document_history',{document_id:docId,action:'ฝังลายเซ็นในเอกสาร',performed_by:CU.id})
        }
      }
    } catch(sigErr){console.warn('Signature embed failed:',sigErr.message)}
  }
  // Send email notification
  try{ await sendNotifEmail(docId, action, nst, note); }catch(ne){console.warn('Email notif failed:',ne)}
  if(mw) mw.innerHTML='';
  var a=$e('dal');
  var _okMsg=nst==='completed'?'เอกสารผ่านทุกขั้นตอนแล้ว! สถานะเปลี่ยนเป็น "เสร็จสิ้น" และส่งอีเมลแจ้งทุกคนแล้ว':action==='approve'?'อนุมัติเรียบร้อยแล้ว และส่งอีเมลแจ้งผู้รับผิดชอบขั้นตอนถัดไปแล้ว':'ส่งคืนพร้อมระบุส่วนที่แก้ไขแล้ว และแจ้งผู้จัดทำทางอีเมลแล้ว';
  if(a) a.innerHTML=alrtH('ok',_okMsg);
  setTimeout(function(){nav('det',docId)},1200)
}

/* ── RE-SUBMIT หลัง reject ── */
async function doReSubmit(docId){
  if(!confirm('ยืนยันการส่งเอกสารใหม่อีกครั้ง?')) return;
  var wf=await dg('workflow_steps','?document_id=eq.'+docId+'&order=step_number');
  var rejStep=wf.find(function(s){return s.status==='rejected'});
  if(!rejStep){alert('ไม่พบขั้นตอนที่ถูกส่งคืน');return}

  // รีเซ็ตขั้นตอนที่ถูก reject กลับเป็น active โดยเก็บ assigned_to เดิมไว้
  await dpa('workflow_steps',rejStep.id,{status:'active',action_taken:null,note:null,revision_section:null,action_at:null,completed_at:null});

  // ตั้งขั้นตอนอื่นๆ ที่อาจ active อยู่เป็น waiting หรือ pending
  for(var i=0;i<wf.length;i++){
    var step=wf[i];
    if(step.id !== rejStep.id && step.status === 'active'){
      await dpa('workflow_steps',step.id,{status:'waiting'});
    }
  }

  await dpa('documents',docId,{status:'pending',updated_at:new Date().toISOString()});
  await dp('document_history',{document_id:docId,action:'ส่งใหม่อีกครั้ง',performed_by:CU.id,note:'ผู้จัดทำส่งเอกสารใหม่หลังแก้ไขแล้ว - รอการอนุมัติจากผู้ส่งคืน'});
  try{await sendNotifEmail(docId,'resubmit','pending','')}catch(ne){console.warn('Email notif failed:',ne)}
  nav('det',docId);
}

/* ── EMAIL NOTIFICATION (ส่งจริงผ่าน Supabase Edge Function + Resend) ── */
async function sendNotifEmail(docId, action, newStatus, note){
  var doc=(await dg('documents','?id=eq.'+docId))[0]; if(!doc)return;
  if(action==='overdue'&&doc.notify_overdue===false) return;
  if(action!=='overdue'&&doc.notify_step===false) return;
  var wfSteps=await dg('workflow_steps','?document_id=eq.'+docId+'&order=step_number');
  var nextStep=wfSteps.filter(function(s){return s.status==='active'})[0];
  var subj=doc.subject_line||doc.title;
  var addrTo=doc.addressed_to||'';
  var fromDept=doc.from_department||'กนค.';
  var deadlineStr=doc.due_date?new Date(doc.due_date).toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'2-digit'}):'';

  // ── สร้าง recipient list ──
  var recipients=[];
  function _okEmail(em){return em&&em.includes('@')&&!em.includes('@gnk.student')}
  if(newStatus==='completed'){
    // แจ้งเตือนเฉพาะผู้จัดทำเมื่อเอกสารเสร็จสิ้น
    if(doc.created_by){
      var creatorUser=await dg('users','?id=eq.'+doc.created_by);
      if(creatorUser[0]){
        var em=creatorUser[0].contact_email||creatorUser[0].email;
        if(_okEmail(em)) recipients.push({user:creatorUser[0],email:em});
      }
    }
  } else if(action==='approve'&&nextStep&&nextStep.assigned_to){
    var ru=await dg('users','?id=eq.'+nextStep.assigned_to);
    if(ru[0]){var em=ru[0].contact_email||ru[0].email;if(_okEmail(em))recipients.push({user:ru[0],email:em})}
  } else if(action==='reject'&&doc.created_by){
    var cu2=await dg('users','?id=eq.'+doc.created_by);
    if(cu2[0]){var em2=cu2[0].contact_email||cu2[0].email;if(_okEmail(em2))recipients.push({user:cu2[0],email:em2})}
  } else if((action==='create'||action==='resubmit')&&nextStep&&nextStep.assigned_to){
    var ru3=await dg('users','?id=eq.'+nextStep.assigned_to);
    if(ru3[0]){var em3=ru3[0].contact_email||ru3[0].email;if(_okEmail(em3))recipients.push({user:ru3[0],email:em3})}
  } else if(action==='overdue'){
    var overdueIds=[];
    if(nextStep&&nextStep.assigned_to) overdueIds.push(nextStep.assigned_to);
    if(doc.created_by) overdueIds.push(doc.created_by);
    var uniqueOIds=[...new Set(overdueIds)];
    if(uniqueOIds.length){
      var overdueUsers=await dg('users','?id=in.('+uniqueOIds.join(',')+')'+'&select=id,full_name,email,contact_email');
      overdueUsers.forEach(function(u){
        var em=u.contact_email||u.email;
        if(_okEmail(em)) recipients.push({user:u,email:em})
      })
    }
  }

  if(!recipients.length) return;

  // ── ดึงไฟล์ลงนามล่าสุด (กรณี completed) ──
  var signedFileUrl='';
  if(newStatus==='completed'){
    var _sFiles=await dg('document_files','?document_id=eq.'+docId+'&order=version.desc&limit=5');
    var _sFile=_sFiles.find(function(f){return f.file_name.indexOf('[ลงนาม]')>=0||f.file_name.indexOf('signed_')>=0})||_sFiles[0];
    if(_sFile) signedFileUrl=furl(_sFile.file_path);
  }

  var emailSubj='[กนค.] '+(newStatus==='completed'?'เสร็จสิ้น: ':action==='reject'?'↩ ส่งคืนแก้ไข: ':action==='create'?'📋 เอกสารใหม่รอดำเนินการ: ':action==='overdue'?'⚠️ เลยกำหนด: ':'')+subj;
  var sentEmails=[];

  for(var ri=0;ri<recipients.length;ri++){
    var recip=recipients[ri];
    var html=buildEmailHtml({
      recipName: recip.user.full_name,
      action: action,
      newStatus: newStatus,
      subj: subj,
      addrTo: addrTo,
      fromDept: fromDept,
      deadlineStr: deadlineStr,
      note: note,
      nextStep: nextStep,
      urgency: doc.urgency,
      signedFileUrl: signedFileUrl
    });

    // ── ส่งอีเมลจริงผ่าน Edge Function ──
    try{
      var resp=await fetch(SU+'/functions/v1/send-email',{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+SK,'apikey':SK},
        body:JSON.stringify({to:recip.email,subject:emailSubj,html:html})
      });
      var result=await resp.json();
      var status=resp.ok?'sent':'failed';
      if(!resp.ok) console.warn('Email send failed for '+recip.email+':',result);
      else sentEmails.push(recip.email);
    }catch(e){
      console.warn('Email fetch error:',e);
      var status='failed';
    }

    // ── บันทึก audit log ──
    try{
      await dp('notifications',{
        document_id:docId,
        recipient_id:recip.user.id,
        recipient_email:recip.email,
        subject:emailSubj,
        body:html,
        notification_type:action||'email',
        status:status,
        sent_at:new Date().toISOString()
      });
    }catch(e){}
  }

  if(sentEmails.length) showEmailToast(sentEmails,emailSubj);
}

/* ── สร้าง HTML Template สำหรับอีเมล ── */
function buildEmailHtml(o){
  var urgColor={normal:'#4CAF50',urgent:'#FF9800',very_urgent:'#F44336'};
  var urgLabel={normal:'ปกติ',urgent:'เร่งด่วน',very_urgent:'ด่วนมาก'};
  var urgClr=urgColor[o.urgency]||'#888';

  var bannerBg,bannerIcon,actionLabel;
  if(o.newStatus==='completed'){
    bannerBg='#E8F5E9'; bannerIcon='✅'; actionLabel='<span style="color:#2E7D32;font-weight:700">เอกสารผ่านทุกขั้นตอนเรียบร้อยแล้ว</span>';
  } else if(o.action==='reject'){
    bannerBg='#FFF3E0'; bannerIcon='↩'; actionLabel='<span style="color:#E65100;font-weight:700">เอกสารถูกส่งคืนเพื่อแก้ไข</span>';
  } else if(o.action==='overdue'){
    bannerBg='#FFEBEE'; bannerIcon='⚠️'; actionLabel='<span style="color:#C62828;font-weight:700">เอกสารเลยกำหนดส่งแล้ว กรุณาดำเนินการโดยด่วน</span>';
  } else {
    bannerBg='#E3F2FD'; bannerIcon='📋'; actionLabel='<span style="color:#1565C0;font-weight:700">มีเอกสารรอการดำเนินการของคุณ</span>';
  }

  var rows='';
  if(o.addrTo) rows+='<tr><td style="color:#888;padding:5px 0;width:110px;font-size:13px">เรียน</td><td style="font-weight:600;font-size:13px">'+esc(o.addrTo)+'</td></tr>';
  if(o.fromDept) rows+='<tr><td style="color:#888;padding:5px 0;font-size:13px">จากฝ่าย</td><td style="font-size:13px">'+esc(o.fromDept)+'</td></tr>';
  if(o.urgency) rows+='<tr><td style="color:#888;padding:5px 0;font-size:13px">ความเร่งด่วน</td><td><span style="color:'+urgClr+';font-weight:600;font-size:13px">'+esc(urgLabel[o.urgency]||o.urgency)+'</span></td></tr>';
  if(o.deadlineStr) rows+='<tr><td style="color:#888;padding:5px 0;font-size:13px">วันกำหนดส่ง</td><td style="font-weight:700;color:#E84300;font-size:13px">'+esc(o.deadlineStr)+'</td></tr>';
  if(o.nextStep&&o.action!=='reject'&&o.newStatus!=='completed') rows+='<tr><td style="color:#888;padding:5px 0;font-size:13px">ขั้นตอนที่รอ</td><td style="font-size:13px">'+esc(o.nextStep.step_name||'')+'</td></tr>';
  if(o.action==='reject'&&o.note) rows+='<tr><td style="color:#888;padding:5px 0;vertical-align:top;font-size:13px">ส่วนที่ต้องแก้ไข</td><td style="color:#E65100;font-size:13px">'+esc(o.note)+'</td></tr>';

  var footerMsg='';
  if(o.newStatus==='completed'){
    footerMsg='<p style="font-size:13px;color:#2E7D32;margin:16px 0 8px">กรุณาเข้าระบบเพื่อดาวน์โหลดเอกสารฉบับลงนาม</p>';
    if(o.signedFileUrl) footerMsg+='<a href="'+o.signedFileUrl+'" style="display:inline-block;background:#E84300;color:#fff;text-decoration:none;padding:10px 22px;border-radius:8px;font-weight:600;font-size:13px;margin-top:4px">ดูเอกสารลงนาม</a>';
  } else if(o.action==='reject'){
    footerMsg='<p style="font-size:13px;color:#E65100;margin:16px 0 0">กรุณาแก้ไขเอกสารและส่งกลับผ่านระบบ</p>';
  } else if(o.action==='overdue'){
    footerMsg='<p style="font-size:13px;color:#C62828;margin:16px 0 0;font-weight:700">⚠️ กรุณาเข้าสู่ระบบเพื่อดำเนินการโดยด่วน</p>';
  } else {
    footerMsg='<p style="font-size:13px;color:#1565C0;margin:16px 0 0">กรุณาเข้าสู่ระบบเพื่อดำเนินการในขั้นตอนที่ได้รับมอบหมาย</p>';
  }

  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'+
    '<body style="margin:0;padding:0;background:#F5F5F5;font-family:\'Sarabun\',\'Helvetica Neue\',Arial,sans-serif">'+
    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F5;padding:32px 16px">'+
    '<tr><td align="center">'+
    '<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08)">'+
    // Header
    '<tr><td style="background:#E84300;padding:22px 28px">'+
      '<table cellpadding="0" cellspacing="0"><tr>'+
        '<td style="width:44px;height:44px;background:rgba(255,255,255,.2);border-radius:50%;text-align:center;vertical-align:middle;font-size:20px;padding:0 12px">📄</td>'+
        '<td style="padding-left:14px"><div style="color:#fff;font-size:18px;font-weight:700">SAEDU Flow</div>'+
        '<div style="color:rgba(255,255,255,.8);font-size:12px;margin-top:2px">ระบบเสนอเอกสาร คณะกรรมการนิสิต</div></td>'+
      '</tr></table>'+
    '</td></tr>'+
    // Body
    '<tr><td style="padding:26px 28px">'+
      '<p style="margin:0 0 16px;font-size:14px;color:#555">เรียน <strong style="color:#222">'+esc(o.recipName)+'</strong></p>'+
      '<div style="background:'+bannerBg+';border-radius:8px;padding:13px 16px;margin-bottom:20px;font-size:14px">'+
        '<span style="margin-right:8px">'+bannerIcon+'</span>'+actionLabel+
      '</div>'+
      '<div style="background:#FAFAFA;border-radius:8px;padding:16px 18px;margin-bottom:4px">'+
        '<div style="font-size:11px;color:#aaa;font-weight:700;letter-spacing:.6px;margin-bottom:8px;text-transform:uppercase">เรื่อง</div>'+
        '<div style="font-size:15px;font-weight:700;color:#222;margin-bottom:14px;line-height:1.5">'+esc(o.subj)+'</div>'+
        (rows?'<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">'+rows+'</table>':'')+
      '</div>'+
      footerMsg+
    '</td></tr>'+
    // Footer
    '<tr><td style="padding:14px 28px;background:#F9F9F9;border-top:1px solid #EEE;text-align:center;font-size:11px;color:#BBB">'+
      'ระบบเสนอเอกสาร กนค. © 2568 &nbsp;·&nbsp; อีเมลนี้ส่งโดยอัตโนมัติ ไม่ต้องตอบกลับ'+
    '</td></tr>'+
    '</table></td></tr></table>'+
    '</body></html>'
}

/* ── ตรวจและส่ง Overdue notification (เรียก 1 ครั้งต่อวัน) ── */
async function sendOverdueNotifs(){
  var today=new Date().toISOString().substring(0,10);
  if(localStorage.getItem('_overdueCk')===today) return;
  localStorage.setItem('_overdueCk',today);
  var overdueDocs=await dg('documents','?status=eq.pending&due_date=lt.'+today+'&notify_overdue=eq.true&select=id');
  if(!overdueDocs.length) return;
  var since=new Date(Date.now()-24*60*60*1000).toISOString();
  for(var i=0;i<overdueDocs.length;i++){
    var did=overdueDocs[i].id;
    var recent=await dg('notifications','?document_id=eq.'+did+'&notification_type=eq.overdue&created_at=gt.'+encodeURIComponent(since)+'&limit=1');
    if(recent.length) continue;
    try{await sendNotifEmail(did,'overdue','overdue','')}catch(e){console.warn('Overdue notif failed:',e)}
  }
}

function showEmailToast(emails, subj){
  var list=Array.isArray(emails)?emails:[emails];
  var t=document.createElement('div');
  t.className='fixed bottom-5 right-5 bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7] rounded-[14px] px-[18px] py-3.5 shadow-[0_8px_24px_rgba(0,0,0,.15)] z-[9999] flex items-start gap-2.5 text-[13px] max-w-[340px] [animation:slideUp_.2s]';
  t.innerHTML=svg('bell',16)+'<div><strong>ส่งอีเมลแจ้งเตือนแล้ว</strong><div class="text-[11px] text-[#388E3C] mt-[3px]">'+list.map(function(e){return '• '+e}).join('<br>')+'</div></div>';
  document.body.appendChild(t);
  setTimeout(function(){t.remove()},5000)
}



