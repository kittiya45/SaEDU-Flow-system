/* [UX] toggle dropdown "⋮" สำหรับ admin actions ใน doc detail */
function _toggleDetMore(){
  var d=$e('det-more-drop');
  if(!d) return;
  d.style.display=d.style.display==='none'?'block':'none';
  // ปิด dropdown เมื่อ click นอก
  if(d.style.display==='block'){
    setTimeout(function(){
      document.addEventListener('click',function _close(e){
        if(!document.getElementById('det-more-wrap').contains(e.target)){
          d.style.display='none';
          document.removeEventListener('click',_close,true);
        }
      },true);
    },10);
  }
}

/* ─── DOC DETAIL ─── */
async function vDet(docId){
  var _id=safeId(docId);
  var rs=await Promise.all([
    dg('documents','?id=eq.'+_id),
    dg('document_files','?document_id=eq.'+_id+'&order=version.desc,uploaded_at.desc'),
    dg('workflow_steps','?document_id=eq.'+_id+'&order=step_number'),
    dg('document_history','?document_id=eq.'+_id+'&order=performed_at.desc&limit=50')
  ]);
  var doc=rs[0][0]; if(!doc) return '<div class="card-empty"><div class="card-empty-icon">'+svg('x',40)+'</div><div class="card-empty-text">ไม่พบเอกสาร</div></div>';
  var files=rs[1], wf=rs[2], hist=rs[3];
  // รวม creator เข้าใน batch user lookup แทนการ query แยก
  var _aIds=wf.filter(function(s){return s.assigned_to}).map(function(s){return s.assigned_to});
  if(doc.created_by&&_aIds.indexOf(doc.created_by)===-1) _aIds.push(doc.created_by);
  if(doc.forwarded_to_id&&_aIds.indexOf(doc.forwarded_to_id)===-1) _aIds.push(doc.forwarded_to_id);
  if(doc.final_recipient_id&&_aIds.indexOf(doc.final_recipient_id)===-1) _aIds.push(doc.final_recipient_id);
  var _aMap={};
  if(_aIds.length){
    var _aus=await dg('users','?id=in.('+_aIds.map(safeId).join(',')+')'+'&select=id,full_name,contact_email,email');
    _aus.forEach(function(u){_aMap[u.id]=u})
  }
  var creator=_aMap[doc.created_by]||{full_name:'—'};
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
  if(doc.status==='completed') html.push('<div class="al al-ok !m-0 !py-2 !px-3.5 text-xs !rounded-[20px]"><span class="al-icon">'+svg('ok',12)+'</span><span>เอกสารผ่านการอนุมัติทุกขั้นตอนเรียบร้อยแล้ว</span></div>');
  var _canNum=doc.status==='numbering'&&(doc.created_by===CU.id||['ROLE-SYS','ROLE-STF'].includes(CU.role_code));
  if(doc.status==='numbering') html.push('<div class="al al-wa !m-0 !py-2 !px-3.5 text-xs !rounded-[20px]"><span class="al-icon">'+svg('pen',12)+'</span><span>'+(_canNum?'ลายเซ็นครบแล้ว — กรุณาออกเลขที่หนังสือและวันที่':'รอผู้จัดทำออกเลขที่หนังสือ')+'</span></div>');
  // Banner: cascade — แสดงเมื่อ step ที่ active ถูก re-activate เพราะ step ถัดไปตีกลับ
  var _curActWf=wf.filter(function(s){return s.status==='active'})[0];
  var _nextRejWf=_curActWf?wf.find(function(s){return s.step_number>_curActWf.step_number&&s.status==='rejected'}):null;
  if(_nextRejWf&&doc.status==='pending'){
    var _rejReason=_nextRejWf.revision_section?(' — <span class="font-semibold text-[#DC2626]">'+esc(_nextRejWf.revision_section)+'</span>'):'';
    var _rejNote=_nextRejWf.note?(' "<em>'+esc(_nextRejWf.note)+'</em>"'):'';
    html.push('<div class="al al-wa !m-0 !py-2 !px-3.5 text-xs !rounded-[20px]"><span class="al-icon">'+svg('undo',12)+'</span><span>ส่งคืนมาจากขั้นตอน: <strong>'+esc(_nextRejWf.step_name)+'</strong>'+_rejReason+_rejNote+' · กรุณาดำเนินการภายใน <strong>'+(SETT.sla_cascade_days||3)+' วัน</strong></span></div>');
  } else if(hasRejectedHistory && doc.status==='pending') {
    html.push('<div class="al al-wa !m-0 !py-2 !px-3.5 text-xs !rounded-[20px]"><span class="al-icon">'+svg('undo',12)+'</span><span>เอกสารที่แก้ไขแล้วหลังการส่งคืน - รอการอนุมัติตามขั้นตอน</span></div>');
  }
  // Banner: SLA countdown เมื่อเอกสารถูกส่งคืนถึงผู้จัดทำ (status=rejected)
  if(doc.status==='rejected'){
    var _lastRejH=hist.filter(function(h){return h.action&&(h.action.indexOf('ส่งคืน')>=0||h.action.indexOf('ตีกลับ')>=0)})[0];
    if(_lastRejH&&_lastRejH.performed_at){
      var _slaDays2=SETT.sla_cascade_days||3;
      var _rejTs=new Date(_lastRejH.performed_at);
      var _slaTs=addWorkingDays(_rejTs,_slaDays2);
      _slaTs.setHours(23,59,0,0);
      var _slaIsLate=new Date()>_slaTs;
      var _slaStr=_slaTs.toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit'});
      var _wdLeft=workingDaysLeft(_slaTs);
      var _wdLabel=_slaIsLate?'<strong class="text-[#DC2626]">เกินกำหนดแก้ไขแล้ว!</strong> ครบกำหนด: '+_slaStr:
        (_wdLeft<=1?'<strong class="text-[#DC2626]">วันสุดท้ายแล้ว!</strong> ครบกำหนด: '+_slaStr:
        'กรุณาแก้ไขและส่งใหม่ภายใน <strong>'+_slaStr+'</strong> เหลืออีก '+_wdLeft+' วันทำการ (SLA '+_slaDays2+' วันทำการ)');
      html.push('<div class="al '+(_slaIsLate?'al-er':_wdLeft<=1?'al-er':'al-wa')+' !m-0 !py-2 !px-3.5 text-xs !rounded-[20px]"><span class="al-icon">'+svg('clock',12)+'</span><span>'+_wdLabel+'</span></div>');
    }
  }
  /* [UX] จัดกลุ่ม action buttons:
     - Primary actions: อนุมัติ, ส่งคืน, ออกเลข, ส่งใหม่
     - Secondary actions: แก้ไข, อัปโหลด, ส่งต่อ, Export
     - Destructive actions: ลบ, เปลี่ยนสถานะ — ซ่อนใน dropdown ⋮ (admin เท่านั้น) */
  html.push('<div class="ml-auto flex gap-2 flex-wrap items-center">');
  // Primary — action ที่ user ต้องทำตอนนี้
  if(canAct){
    html.push('<button class="btn btn-success sm" data-action="showActModal" data-act="approve" data-id="'+docId+'">'+svg('ok',13)+' อนุมัติ / ลงนาม</button>');
    html.push('<button class="btn btn-danger sm" data-action="showActModal" data-act="reject" data-id="'+docId+'">'+svg('x',13)+' ส่งคืนแก้ไข</button>');
  }
  if(_canNum){
    html.push('<button class="btn btn-primary sm" data-action="showNumModal" data-id="'+docId+'">'+svg('pen',13)+' ออกเลขหนังสือ</button>');
  }
  if(doc.status==='rejected'&&doc.created_by===CU.id){
    html.push('<button class="btn btn-primary sm" data-action="doReSubmit" data-id="'+docId+'">'+svg('up',13)+' ส่งใหม่อีกครั้ง</button>');
  }
  // Secondary
  if(CAN.up(CU.role_code)){
    html.push('<button class="btn btn-soft sm" data-action="detUp">'+svg('up',13)+' อัปโหลด</button>');
    html.push('<input type="file" id="dup" class="hidden" multiple accept=".pdf,.doc,.docx,.png,.jpg">');
  }
  if(CAN.ed(CU.role_code)&&(doc.status==='draft'||(doc.status==='rejected'&&doc.created_by===CU.id))){
    html.push('<button class="btn btn-soft sm" data-action="nav" data-view="edit" data-id="'+docId+'">'+svg('edit',13)+' แก้ไข</button>');
  }
  if(doc.status==='completed'){
    // ซ่อนปุ่มส่งต่อเมื่อรอการรับเอกสารอยู่แล้ว
    var _fwdPending=doc.forwarded_to_id&&!hist.some(function(h){return h.action&&h.action.indexOf('เจ้าหน้าที่รับเอกสาร')>=0});
    if(!_fwdPending){
      html.push('<button class="btn btn-soft sm" data-action="showFwdModal" data-id="'+docId+'">'+svg('sign',13)+' ส่งต่อ</button>');
    } else {
      html.push('<span style="font-size:12px;color:#D97706;display:flex;align-items:center;gap:4px">'+svg('clock',13)+' รอเจ้าหน้าที่รับเอกสาร</span>');
    }
  }
  // Accept / Decline buttons — แสดงเฉพาะ forwarded_to_id คนนั้น และยังไม่ได้รับ
  if(doc.status==='completed'&&doc.forwarded_to_id&&doc.forwarded_to_id===CU.id){
    var _fwdAccepted=hist.some(function(h){return h.action&&h.action.indexOf('เจ้าหน้าที่รับเอกสาร')>=0});
    if(!_fwdAccepted){
      html.push('<button class="btn btn-success sm" data-action="acceptFwd" data-id="'+docId+'">'+svg('ok',13)+' รับเอกสาร / อนุมัติ</button>');
      html.push('<button class="btn btn-danger sm" data-action="showDeclineFwdModal" data-id="'+docId+'">'+svg('x',13)+' ไม่อนุมัติ / ส่งคืน</button>');
    } else {
      html.push('<span class="badge b-completed" style="padding:6px 12px;display:flex;align-items:center;gap:4px">'+svg('ok',12)+' รับเอกสารแล้ว</span>');
    }
  }
  html.push('<button class="btn btn-soft sm" data-action="exportDocPDF" data-id="'+docId+'">'+svg('pdf_ico',13)+' PDF</button>');
  // Destructive — ซ่อนใน ⋮ dropdown สำหรับ admin เท่านั้น
  if(CU.role_code==='ROLE-SYS'){
    html.push(
      '<div style="position:relative;display:inline-block" id="det-more-wrap">'+
      '<button class="btn btn-soft sm" onclick="_toggleDetMore()" title="เพิ่มเติม">'+svg('dots',14)+'</button>'+
      '<div id="det-more-drop" style="display:none;position:absolute;right:0;top:100%;margin-top:4px;background:#fff;border:1px solid #EBEBEB;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.12);min-width:160px;z-index:200;overflow:hidden">'+
        '<button class="am-item" data-action="admChgStatus" data-id="'+docId+'">'+svg('refresh',13)+' เปลี่ยนสถานะ</button>'+
        '<div class="am-divider"></div>'+
        '<button class="am-item am-danger" data-action="admDelDoc" data-id="'+docId+'">'+svg('trash',13)+' ลบเอกสาร</button>'+
      '</div></div>'
    );
  }
  html.push('</div></div>');
  html.push('<div id="dal"></div>');
  html.push('<div class="two-col"><div>');

  // Info
  var _ico=function(i,bg,cl){return '<div style="width:26px;height:26px;border-radius:7px;background:'+bg+';display:flex;align-items:center;justify-content:center;color:'+cl+'">'+svg(i,13)+'</div>'};
  html.push('<div class="card"><div class="card-head">'+_ico('doc','#FFF3EE','#E83A00')+'<span class="card-head-title">ข้อมูลเอกสาร</span></div><div class="card-body"><div class="detail-list">');
  var _addrDisplay=doc.doc_type==='outgoing'?(PTH[doc.addressed_to]||doc.addressed_to||'—'):(doc.addressed_to||'—');
  var _fromDisplay=doc.doc_type==='outgoing'&&doc.description?'โครงการ: '+doc.description:(doc.from_department||'—');
  [['เลขที่','<span class="mono">'+esc(doc.doc_number||'—')+'</span>'],
   ['ชื่อเรื่อง',esc(doc.title)],
   ['เรียน (ถึง)','<strong style="color:var(--orange)">'+esc(_addrDisplay)+'</strong>'],
   ['จากฝ่าย / หน่วยงาน','<strong>'+esc(_fromDisplay)+'</strong>'],
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
  html.push('<span class="ml-auto flex items-center gap-2">');
  if(_signedFile){
    var _signedDispName=_signedFile.file_name.replace(/^(\[(ลงนาม|ตีกลับ|แก้ไข)\]\s*)+/g,'').replace(/^(signed|reject|edited)_\d+_/,'');
    html.push('<button class="btn btn-soft xs" style="border-color:#3b82f6;color:#3b82f6;background:#eff6ff" data-action="openViewer" data-url="'+furl(_signedFile.file_path)+'" data-name="'+esc(_signedDispName)+'">'+svg('eye',12)+' ดูฉบับเซ็น</button>');
    html.push('<button class="btn btn-soft xs" data-action="dlFile" data-url="'+furl(_signedFile.file_path)+'" data-name="'+esc(_signedDispName)+'">'+svg('dn',12)+' โหลดฉบับเซ็น</button>');
  }
  html.push('<span class="text-xs text-[#a89e99]">'+files.length+' ไฟล์');
  if(_verCount>0) html.push(' · <span class="text-[#2563EB] font-semibold">'+_verCount+' เวอร์ชันแก้ไข</span>');
  html.push('</span></span></div>');
  html.push('<div class="card-body" id="dfiles">');
  if(files.length){
    // ── ไฟล์เวอร์ชันปัจจุบัน ──
    html.push('<div class="text-[11px] font-bold tracking-[.5px] uppercase text-[#16A34A] mb-2">ฉบับปัจจุบัน</div>');
    (_currentFiles.length?_currentFiles:[files[0]]).forEach(function(f){
      var isImg=f.file_type&&f.file_type.includes('image');
      var isSigned=f.file_name.indexOf('[ลงนาม]')>=0||f.file_name.indexOf('signed_')>=0;
      var isRejFile=f.file_name.indexOf('[ตีกลับ]')>=0;
      var isEditFile=f.file_name.indexOf('[แก้ไข]')>=0||f.file_name.indexOf('edited_')>=0;
      var _dispName=f.file_name.replace(/^(\[(ลงนาม|ตีกลับ|แก้ไข)\]\s*)+/g,'').replace(/^(signed|reject|edited)_\d+_/,'');
      var dtStr=f.uploaded_at?new Date(f.uploaded_at).toLocaleString('th-TH',{day:'numeric',month:'short',year:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
      html.push('<div class="file-item border-[#16A34A] bg-[#F0FDF4]">');
      html.push('<span class="file-icon">'+svg(isImg?'img2':'pdf_ico',20)+'</span>');
      html.push('<div class="file-info">');
      html.push('<div class="file-name text-[#16A34A]">'+esc(_dispName)+'</div>');
      html.push('<div class="flex gap-[5px] items-center mt-1 flex-wrap">');
      html.push('<span class="badge b-completed text-[10px] px-[7px] py-0.5">v'+f.version+' ล่าสุด</span>');
      if(isSigned) html.push('<span class="badge b-signed text-[10px] px-[7px] py-0.5">ลงนามแล้ว</span>');
      if(isRejFile) html.push('<span class="badge b-rejected text-[10px] px-[7px] py-0.5">ตีกลับ</span>');
      if(isEditFile) html.push('<span class="badge b-pending text-[10px] px-[7px] py-0.5">แก้ไข</span>');
      html.push('<span class="file-meta">'+fsz(f.file_size)+' · '+dtStr+'</span></div>');
      html.push('</div><div class="file-actions">');
      html.push('<button style="display:inline-flex;align-items:center;gap:4px;height:28px;padding:0 10px;border-radius:8px;border:2px solid #3b82f6;background:#eff6ff;color:#3b82f6;font-size:11px;font-weight:600;cursor:pointer" data-action="openViewer" data-url="'+furl(f.file_path)+'" data-name="'+esc(_dispName)+'">'+svg('eye',12)+' ดู</button>');
      html.push('<button class="btn btn-soft xs" data-action="openEditor" data-url="'+furl(f.file_path)+'" data-name="'+esc(_dispName)+'" data-fid="'+f.id+'" data-did="'+docId+'">'+svg('edit',12)+' แก้ไข</button>');
      html.push('<button class="btn btn-soft xs" data-action="dlFile" data-url="'+furl(f.file_path)+'" data-name="'+esc(_dispName)+'">'+svg('dn',12)+' โหลด</button>');
      html.push('</div></div>');
    });

    // ── ประวัติเวอร์ชันก่อนหน้า ──
    if(_histFiles.length){
      html.push('<button class="cursor-pointer text-xs font-semibold text-[#2563EB] py-2 mt-2 border-t border-dashed border-[#EBEBEB] w-full text-left bg-transparent border-x-0 border-b-0 flex items-center gap-1.5" data-action="showVerHist" data-id="'+docId+'">'+svg('tri',10)+' ประวัติเวอร์ชันก่อนหน้า ('+_histFiles.length+' ไฟล์)</button>');
    }
  } else {
    html.push('<div class="card-empty py-6"><div class="card-empty-icon">'+svg('folder',40)+'</div><div class="card-empty-text">ยังไม่มีไฟล์แนบ</div></div>')
  }
  html.push('</div></div>');

  // Notification log card — admin only
  if(CU.role_code==='ROLE-SYS'){
    html.push('<div class="card"><div class="card-head">'+_ico('bell','#FFF3EE','#E83A00')+'<span class="card-head-title">บันทึกการแจ้งเตือนอีเมล</span></div><div class="card-body" id="d-notif-list">');
    html.push('<div class="al al-in text-xs"><span class="al-icon">'+svg('info',13)+'</span><span>ระบบส่งอีเมลแจ้งเตือนอัตโนมัติเมื่อมีการเปลี่ยนขั้นตอน</span></div>');
    html.push('<div id="notif-loading" class="text-[#a89e99] text-[13px]">กำลังโหลด...</div>');
    html.push('</div></div>');
  }
  html.push('</div>');

  // Right: Workflow
  html.push('<div><div class="card"><div class="card-head">'+_ico('ok','#FFF3EE','#E83A00')+'<span class="card-head-title">ติดตามสถานะงาน</span><span class="ml-auto text-[11px] text-[#a89e99]">'+wf.filter(function(s){return s.status==="done"}).length+'/'+wf.length+' ขั้นตอน</span></div><div class="card-body">');
  if(wf.length){
    html.push('<div class="timeline">');
    wf.forEach(function(s,i){
      var done=s.status==='done', act=s.status==='active', rej=s.status==='rejected', last=i===wf.length-1;
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
        html.push('<div class="tl-time text-[#D97706] flex items-center gap-1">'+svg('clock',12)+' กำลังดำเนินการ'+(_ddlStr?' · ครบกำหนด: '+_ddlStr+(_late?' <span class="text-[#DC2626] font-bold"> (เกินกำหนด!)</span>':''):'')+'</div>');
        if(!_ddlStr) html.push('<div class="tl-time text-[#a89e99]">กำหนด '+s.deadline_days+' วัน</div>');
      }
      if(s.revision_section) html.push('<div class="tl-note text-[#DC2626]">ส่วนที่ต้องแก้ไข: <strong>'+esc(s.revision_section)+'</strong></div>');
      if(s.note) html.push('<div class="tl-note">"'+esc(s.note)+'"</div>');
      html.push('</div></div>');
    });
    html.push('</div>')
  } else {
    html.push('<div class="card-empty py-6"><div class="card-empty-icon">'+svg('doc',40)+'</div><div class="card-empty-text">ยังไม่ได้กำหนดขั้นตอน</div></div>')
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
      /* [UX] แสดงเวลาด้วย fdTime() เพื่อแยก actions ที่เกิดในวันเดียวกัน */
      html.push('<div class="text-[11px] text-[#a89e99] mt-0.5">'+fdTime(h.performed_at)+'</div></div></div>');
    })
  } else {
    html.push('<p class="text-[#a89e99] text-[13px]">ยังไม่มีประวัติการดำเนินการ</p>')
  }
  html.push('</div></div>');

  html.push('</div></div>');

  setTimeout(function(){
    var dup=$e('dup');
    if(dup) dup.onchange=function(){detUp(Array.from(dup.files),docId)};
    if(CU.role_code==='ROLE-SYS'){
      loadNotifLog(docId);
      var _np=setInterval(function(){if(!$e('d-notif-list')){clearInterval(_np);return}loadNotifLog(docId)},60000);
    }
  },80);

  return html.join('')
}

async function detUp(files,docId){
  var a=$e('dal');
  var ALLOWED_MIME2=['application/pdf','application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png','image/jpeg'];
  var MAX_SIZE2=(SETT.max_file_size_mb||10)*1024*1024;
  var errs2=[];
  for(var k=0;k<files.length;k++){
    var fk=files[k];
    if(fk.size>MAX_SIZE2) errs2.push(fk.name+' เกิน 10 MB ('+fsz(fk.size)+')');
    else if(ALLOWED_MIME2.indexOf(fk.type)===-1) errs2.push(fk.name+' ประเภทไม่รองรับ ('+fk.type+')');
  }
  if(errs2.length){if(a)a.innerHTML=alrtH('er',errs2.join(' · '));return}
  if(a) a.innerHTML='<div class="al al-in"><span class="sp sp-dark"></span><span> กำลังอัปโหลด...</span></div>';
  var existingFiles=await dg('document_files','?document_id=eq.'+safeId(docId)+'&select=version&order=version.desc&limit=1');
  var nextVer=(existingFiles.length&&existingFiles[0].version?existingFiles[0].version:0)+1;
  for(var i=0;i<files.length;i++){
    var f=files[i];var safeName2=f.name.replace(/[^a-zA-Z0-9._-]/g,'_');var path=Date.now()+'_'+safeName2;
    await upFile(path,f);
    await dp('document_files',{document_id:docId,file_name:f.name,file_path:path,file_size:f.size,file_type:f.type,uploaded_by:CU.id,version:nextVer+i});
    await dp('document_history',{document_id:docId,action:'อัปโหลดไฟล์: '+f.name,performed_by:CU.id})
  }
  if(a) a.innerHTML=alrtH('ok','อัปโหลดเรียบร้อยแล้ว');
  var nf=await dg('document_files','?document_id=eq.'+safeId(docId)+'&order=uploaded_at');
  var df=$e('dfiles');
  if(df){
    df.innerHTML='';
    nf.forEach(function(f){
      var isImg=f.file_type&&f.file_type.includes('image');
      var div=document.createElement('div'); div.className='file-item';
      div.innerHTML='<span class="file-icon">'+(isImg?svg('img2',18):svg('pdf_ico',18))+'</span>'+
        '<div class="file-info"><div class="file-name">'+esc(f.file_name)+'</div><div class="file-meta">'+fsz(f.file_size)+' · v'+f.version+'</div></div>'+
        '<div class="file-actions">'+
        '<button style="display:inline-flex;align-items:center;gap:4px;height:28px;padding:0 10px;border-radius:8px;border:2px solid #3b82f6;background:#eff6ff;color:#3b82f6;font-size:11px;font-weight:600;cursor:pointer" data-action="openViewer" data-url="'+furl(f.file_path)+'" data-name="'+esc(f.file_name)+'">'+svg('eye',12)+' ดู</button>'+
        '<button class="btn btn-soft xs" data-action="openEditor" data-url="'+furl(f.file_path)+'" data-name="'+esc(f.file_name)+'" data-fid="'+f.id+'" data-did="'+docId+'">'+svg('edit',12)+' แก้ไข</button>'+
        '<button class="btn btn-soft xs" data-action="dlFile" data-url="'+furl(f.file_path)+'" data-name="'+esc(f.file_name)+'">'+svg('dn',12)+'</button>'+
        '</div>';
      df.appendChild(div)
    })
  }
}

async function showVerHist(docId){
  var w=$e('mwrap'); if(!w)return;
  var files=await dg('document_files','?document_id=eq.'+safeId(docId)+'&order=version.desc,uploaded_at.desc');
  var _maxVer=files.reduce(function(m,f){return Math.max(m,f.version||1)},0);
  var _histFiles=files.filter(function(f){return f.version<_maxVer});
  if(!_histFiles.length){w.innerHTML='';return}
  var rows=_histFiles.map(function(f){
    var isImg=f.file_type&&f.file_type.includes('image');
    var isSigned=f.file_name.indexOf('[ลงนาม]')>=0||f.file_name.indexOf('signed_')>=0;
    var isEdited=f.file_name.indexOf('[แก้ไข]')>=0||f.file_name.indexOf('edited_')>=0;
    var isRejFile=f.file_name.indexOf('[ตีกลับ]')>=0;
    var dtStr=f.uploaded_at?new Date(f.uploaded_at).toLocaleString('th-TH',{day:'numeric',month:'short',year:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
    var _dn=f.file_name.replace(/^(\[(ลงนาม|ตีกลับ|แก้ไข)\]\s*)+/g,'').replace(/^(signed|reject|edited)_\d+_/,'');
    return '<div class="file-item bg-[#FAFAFA]">'+
      '<span class="file-icon opacity-60">'+svg(isImg?'img2':'pdf_ico',18)+'</span>'+
      '<div class="file-info">'+
        '<div class="file-name text-[#6b6560] text-xs">'+esc(_dn)+'</div>'+
        '<div class="flex gap-[5px] items-center mt-[3px] flex-wrap">'+
          '<span class="badge b-draft text-[10px] px-1.5 py-px">v'+f.version+'</span>'+
          (isSigned?'<span class="badge b-signed text-[10px] px-1.5 py-px">ลงนาม</span>':'')+
          (isEdited?'<span class="badge text-[10px] px-1.5 py-px bg-[#f5f5f5] text-[#888]">แก้ไข</span>':'')+
          (isRejFile?'<span class="badge b-rejected text-[10px] px-1.5 py-px">ตีกลับ</span>':'')+
          '<span class="file-meta">'+fsz(f.file_size)+' · '+dtStr+'</span>'+
        '</div>'+
      '</div>'+
      '<div class="file-actions">'+
        '<button style="display:inline-flex;align-items:center;gap:4px;height:28px;padding:0 10px;border-radius:8px;border:2px solid #3b82f6;background:#eff6ff;color:#3b82f6;font-size:11px;font-weight:600;cursor:pointer" data-action="openViewer" data-url="'+furl(f.file_path)+'" data-name="'+esc(_dn)+'">'+svg('eye',12)+' ดู</button>'+
        '<button class="btn btn-soft xs" data-action="dlFile" data-url="'+furl(f.file_path)+'" data-name="'+esc(_dn)+'">'+svg('dn',12)+' โหลด</button>'+
      '</div>'+
    '</div>'
  }).join('');
  w.innerHTML='<div class="mo"><div class="modal">'+
    '<div class="modal-head"><span class="modal-title">'+svg('save',15)+' ประวัติเวอร์ชันก่อนหน้า</span>'+
    '<button class="btn btn-ghost xs btn-icon ml-auto" data-action="closeModal">'+svg('x',14)+'</button></div>'+
    '<div class="modal-body" style="max-height:60vh;overflow-y:auto">'+rows+'</div>'+
  '</div></div>'
}

async function showFwdModal(docId){
  var w=$e('mwrap'); if(!w)return;
  // กรองเฉพาะ เจ้าหน้าที่ (ROLE-STF) และ อาจารย์กิจการ (ROLE-ADV) เท่านั้น
  var allUsers=await dg('users','?is_active=eq.true&approval_status=eq.approved&role_code=in.(ROLE-STF,ROLE-ADV)&order=full_name');
  var doc=(await dg('documents','?id=eq.'+safeId(docId)))[0]||{};
  var uOpts=allUsers.map(function(u){
    return '<option value="'+u.id+'"'+(doc.forwarded_to_id===u.id?' selected':'')+'>'+esc(u.full_name)+' ('+RTH[u.role_code]+')</option>'
  }).join('');
  w.innerHTML=[
    '<div class="mo"><div class="modal">',
    '<div class="modal-head"><span class="modal-title">'+svg('sign',15)+' ส่งต่อเอกสารให้เจ้าหน้าที่</span>',
    '<button class="btn btn-soft sm btn-icon" data-action="closeModal">'+svg('x',14)+'</button></div>',
    '<div class="modal-body">',
    '<div class="al al-in" style="margin-bottom:14px"><span class="al-icon">'+svg('info',13)+'</span>',
    '<span>ส่งเอกสารให้ <strong>เจ้าหน้าที่กิจการนิสิต / อาจารย์กิจการ</strong> รับทราบและอนุมัติ ระบบจะแจ้งเตือนทางอีเมล</span></div>',
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
  if(!toId){showAlert('กรุณาเลือกผู้รับ','wa');return}
  var btn=document.querySelector('[data-action="doForward"]');
  if(btn){btn.disabled=true;btn.innerHTML='<span class="sp"></span>'}
  try{
    await dpa('documents',docId,{forwarded_to_id:toId,forwarded_at:new Date().toISOString()});
    await dp('document_history',{document_id:docId,action:'ส่งต่อเอกสาร',performed_by:CU.id,note:note||'ส่งต่อเอกสาร'});
    // Notify recipient — always log in-app, email only for non-gnk.student
    var toUser=(await dg('users','?id=eq.'+safeId(toId)))[0];
    var doc2=(await dg('documents','?id=eq.'+docId))[0]||{};
    var recipEmail=toUser?(toUser.contact_email||toUser.email):'';
    var emailSubj=(SETT.email_prefix||'[กนค.]')+' ส่งต่อเอกสาร: '+(doc2.title||'');
    var emailBody='เรียน '+(toUser?toUser.full_name:'')+', ท่านได้รับเอกสารเรื่อง "'+(doc2.title||'')+'" ที่ผ่านการอนุมัติเรียบร้อยแล้ว'+(note?' หมายเหตุ: '+note:'');
    var fwdStatus='skipped';
    try{
      if(recipEmail&&!recipEmail.includes('@gnk.student')){
        var fwdResp=await fetch(SU+'/functions/v1/send-email',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SK,'apikey':SK},body:JSON.stringify({to:recipEmail,subject:emailSubj,html:emailBody})});
        fwdStatus=fwdResp.ok?'sent':'failed';
        if(fwdResp.ok) showEmailToast(recipEmail,emailSubj);
      }
      await dp('notifications',{document_id:docId,recipient_id:toId,recipient_email:recipEmail||'',subject:emailSubj,body:emailBody,notification_type:'forward',status:fwdStatus,sent_at:new Date().toISOString()});
    }catch(fe){console.warn('Forward notify failed:',fe)}
    $e('mwrap').innerHTML='';
    var a=$e('dal');if(a)a.innerHTML=alrtH('ok','ส่งต่อเอกสารเรียบร้อยแล้ว และแจ้งเตือนทางอีเมลแล้ว');
    setTimeout(function(){nav('det',docId)},900)
  }catch(e){showAlert('เกิดข้อผิดพลาด: '+e.message,'er');if(btn)btn.disabled=false}
}

/* ─── FORWARD REVIEW (เจ้าหน้าที่/อาจารย์กิจการ อนุมัติ / ไม่อนุมัติ) ─── */

function doAcceptFwd(docId){
  showConfirm(
    'รับเอกสาร / อนุมัติ?',
    'ยืนยันการรับเอกสาร เอกสารจะถือว่าดำเนินการเสร็จสิ้นสมบูรณ์',
    function(){_doAcceptFwdConfirmed(docId)},
    {confirmLabel:'รับเอกสาร',confirmClass:'btn-success',icon:'ok',iconBg:'#D1FAE5',iconColor:'#16A34A'}
  );
}

async function _doAcceptFwdConfirmed(docId){
  try{
    await dp('document_history',{document_id:docId,action:'เจ้าหน้าที่รับเอกสาร',performed_by:CU.id,note:'รับและอนุมัติเอกสารเรียบร้อยแล้ว'});
    var a=$e('dal');if(a)a.innerHTML=alrtH('ok','รับเอกสารเรียบร้อยแล้ว');
    setTimeout(function(){nav('det',docId)},900);
  }catch(e){showAlert('เกิดข้อผิดพลาด: '+e.message,'er')}
}

function showDeclineFwdModal(docId){
  var mw=$e('mwrap'); if(!mw)return;
  mw.innerHTML=[
    '<div class="mo"><div class="modal">',
    '<div class="modal-head"><span class="modal-title">'+svg('x',14)+' ไม่อนุมัติ — ส่งคืนให้ดำเนินการใหม่</span>',
    '<button class="btn btn-soft sm btn-icon" data-action="closeModal">'+svg('x',14)+'</button></div>',
    '<div class="modal-body">',
    '<div class="al al-er" style="margin-bottom:10px"><span class="al-icon">'+svg('warn',13)+'</span>',
    '<span>เอกสารจะถูกส่งคืนผู้จัดทำและต้องเริ่มกระบวนการอนุมัติใหม่ทั้งหมดตั้งแต่ต้น</span></div>',
    '<div class="al al-wa" style="margin-bottom:14px;font-size:12px"><span class="al-icon">'+svg('info',13)+'</span>',
    '<span>ผู้จัดทำจะได้รับแจ้งทางอีเมล และต้องแก้ไขเอกสารก่อนส่งใหม่</span></div>',
    '<div class="fg"><label class="fl">เหตุผลที่ไม่อนุมัติ <span class="req">*</span></label>',
    '<textarea class="fi" id="decline-fwd-note" rows="3" placeholder="ระบุเหตุผลที่ต้องแก้ไขหรือส่งคืน..."></textarea></div>',
    '</div>',
    '<div class="modal-foot">',
    '<button class="btn btn-soft" data-action="closeModal">ยกเลิก</button>',
    '<button class="btn btn-danger" data-action="doDeclineFwd" data-id="'+docId+'">'+svg('x',13)+' ยืนยันไม่อนุมัติ</button>',
    '</div></div></div>'
  ].join('');
}

var _declineFwdBusy=false;
async function doDeclineFwd(docId){
  if(_declineFwdBusy)return;
  var note=(gv('decline-fwd-note')||'').trim();
  if(!note){showAlert('กรุณาระบุเหตุผลที่ไม่อนุมัติ','wa');return}
  _declineFwdBusy=true;
  var mw=$e('mwrap');
  if(mw)mw.innerHTML='<div class="mo"><div class="modal"><div class="modal-body text-center py-10"><div class="sp sp-dark w-8 h-8 border-[3px] mx-auto"></div><p class="mt-4 text-[#a89e99]">กำลังดำเนินการ...</p></div></div></div>';
  try{
    // เปลี่ยนสถานะเอกสารเป็น rejected และล้าง forwarded state
    await dpa('documents',docId,{status:'rejected',forwarded_to_id:null,forwarded_at:null,updated_at:new Date().toISOString()});

    // Reset workflow steps: step แรกของ reviewer → rejected (ให้ resubmit ทำงานได้), ที่เหลือ → waiting
    var _wfR=await dg('workflow_steps','?document_id=eq.'+safeId(docId)+'&order=step_number');
    // หา reviewer step แรก; ถ้าไม่มีให้ใช้ step 1 (creator) เป็น fallback เพื่อให้ resubmit ทำงานได้
    var _firstRev=_wfR.find(function(s){return s.step_number>1})||(_wfR.length?_wfR[0]:null);
    for(var _ri=0;_ri<_wfR.length;_ri++){
      var _ru={action_taken:null,note:null,revision_section:null,action_at:null,completed_at:null,rejected_by:null};
      if(_firstRev&&_wfR[_ri].id===_firstRev.id){
        _ru.status='rejected'; _ru.rejected_by=CU.id;
      } else {
        _ru.status='waiting';
      }
      await dpa('workflow_steps',_wfR[_ri].id,_ru);
    }

    await dp('document_history',{document_id:docId,action:'ไม่อนุมัติ — ส่งคืนให้ดำเนินการใหม่',performed_by:CU.id,note:note});
    try{await sendNotifEmail(docId,'reject','rejected',note)}catch(ne){console.warn('Notify failed:',ne)}
    if(mw)mw.innerHTML='';
    var _a=$e('dal');
    if(_a)_a.innerHTML=alrtH('ok','ส่งคืนเรียบร้อย ผู้จัดทำจะได้รับแจ้งให้แก้ไขและส่งใหม่');
    _declineFwdBusy=false;
    setTimeout(function(){nav('docs')},1200);
  }catch(e){
    _declineFwdBusy=false;
    if(mw)mw.innerHTML='';
    showAlert('เกิดข้อผิดพลาด: '+e.message,'er');
  }
}

async function loadNotifLog(docId){
  var wrap=$e('d-notif-list'); if(!wrap)return;
  try{
    var logs=await dg('notifications','?document_id=eq.'+docId+'&order=sent_at.desc&limit=10');
    wrap.innerHTML=logs.length?logs.map(function(n){
      var dt=new Date(n.sent_at);
      var dtStr=dt.toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit'})+' '+dt.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
      return '<div class="flex gap-2.5 py-[9px] border-b border-[#F5F5F5] items-start">'+
        '<div class="w-7 h-7 rounded-full bg-[#EFF6FF] flex items-center justify-center shrink-0">'+svg('bell',14)+'</div>'+
        '<div><div class="text-xs font-semibold text-[#18120E]">'+esc((n.subject||'').replace(/<[^>]*>/g,''))+'</div>'+
        '<div class="text-[11px] text-[#a89e99]">ถึง: '+esc(n.recipient_email)+'</div>'+
        '<div class="text-[11px] text-[#a89e99]">'+dtStr+'</div></div></div>'
    }).join(''):'<div class="text-[#a89e99] text-[13px]">ยังไม่มีการส่งอีเมล</div>';
  }catch(e){if(wrap)wrap.innerHTML='<div class="text-[#a89e99] text-[13px]">โหลดล้มเหลว</div>'}
}

var _actBusy=false;
async function doAct(action,docId){
  if(_actBusy)return;
  _actBusy=true;
  var note=gv('anote');
  var revSection=action==='reject'?(gv('rev-section')||''):'';
  if(action==='reject'&&!revSection){showAlert('กรุณาเลือกส่วนที่ต้องแก้ไข','wa');_actBusy=false;return}
  var fullNote=revSection?(revSection+(note?' — '+note:'')):(note||'');
  note=fullNote;
  // Capture signature before closing modal
  var sigSrc=action==='approve'?getActSigSrc():null;
  var docs=await dg('documents','?id=eq.'+docId); var doc=docs[0]; if(!doc){_actBusy=false;return}
  // Incoming docs require a signature
  if(action==='approve'&&doc.doc_type==='incoming'&&!sigSrc){
    showAlert('กรุณาวาดหรืออัปโหลดลายเซ็นก่อนยืนยัน','wa');_actBusy=false;return
  }
  var mw=$e('mwrap'); if(mw) mw.innerHTML='<div class="mo"><div class="modal"><div class="modal-body text-center py-10"><div class="sp sp-dark w-8 h-8 border-[3px] mx-auto"></div><p class="mt-4 text-[#a89e99]">กำลังดำเนินการ...</p></div></div></div>';
  var wf=await dg('workflow_steps','?document_id=eq.'+docId+'&order=step_number');
  var cur=wf.filter(function(s){return s.status==='active'})[0]||wf[0];
  if(cur){
    await dpa('workflow_steps',cur.id,{status:action==='approve'?'done':'rejected',action_taken:action,note:note,revision_section:revSection||null,action_at:new Date().toISOString(),completed_at:action==='approve'?new Date().toISOString():null,rejected_by:action==='reject'?CU.id:null});
    if(action==='approve'){
      // หาขั้นตอนถัดไป รวม rejected steps ที่อยู่ใน cascade (ต้อง re-activate)
      var nx=wf.find(function(s){return s.step_number>cur.step_number&&s.status!=='done'});
      if(nx){
        var _nxUpd={status:'active'};
        if(nx.status==='rejected'){
          // ล้างข้อมูลตีกลับเมื่อ re-activate กลับขึ้นไปใน cascade
          Object.assign(_nxUpd,{action_taken:null,note:null,revision_section:null,action_at:null,completed_at:null,rejected_by:null});
        }
        await dpa('workflow_steps',nx.id,_nxUpd);
      }
    }
  }
  var ns=Math.min((doc.current_step||1)+1,doc.total_steps||1);
  // allDone: ไม่มี step ใดหลัง step ปัจจุบันที่ยังไม่ done (รวม rejected steps ใน cascade)
  var allDone=action==='approve'&&!wf.some(function(s){return s.step_number>cur.step_number&&s.status!=='done'});

  // Cascade reject: หา step ก่อนหน้า (step_number > 1 = ไม่ใช่ step ผู้จัดทำ)
  var _cascadePrev=null;
  if(action==='reject'){
    for(var _cpi=0;_cpi<wf.length;_cpi++){
      if(wf[_cpi].step_number<cur.step_number&&wf[_cpi].step_number>1) _cascadePrev=wf[_cpi];
    }
  }

  // เมื่อลงนามครบ: ขาเข้า → numbering, ขาออก → completed
  // เมื่อตีกลับ: มี step ก่อนหน้า → cascade (pending), ไม่มี → rejected (ถึงผู้จัดทำ)
  var nst=action==='approve'?(allDone?(doc.doc_type==='incoming'?'numbering':'completed'):'pending'):(_cascadePrev?'pending':'rejected');
  await dpa('documents',docId,{status:nst,current_step:ns,updated_at:new Date().toISOString()});

  // Cascade: re-activate ขั้นตอนก่อนหน้าพร้อม SLA (วันทำการ)
  if(action==='reject'&&_cascadePrev){
    var _slaDays=SETT.sla_cascade_days||3;
    var _slaDt=addWorkingDays(new Date(),_slaDays);
    _slaDt.setHours(23,59,0,0);
    await dpa('workflow_steps',_cascadePrev.id,{status:'active',deadline_datetime:_slaDt.toISOString(),deadline_days:_slaDays,action_taken:null,note:null,revision_section:null,action_at:null,completed_at:null});
  }

  var _histAct=action==='approve'?'อนุมัติ / ลงนาม':(_cascadePrev?'ส่งคืนแก้ไข — ส่งต่อ: '+(_cascadePrev.step_name||'ขั้นตอนก่อนหน้า'):'ส่งคืนแก้ไขไปยังผู้จัดทำ');
  await dp('document_history',{document_id:docId,action:_histAct,performed_by:CU.id,note:note});
  if(action==='reject'){
    var _rejFile=$e('rej-file');
    if(_rejFile&&_rejFile.files&&_rejFile.files.length){
      try{
        var _rf=_rejFile.files[0];
        var _rvEx=await dg('document_files','?document_id=eq.'+safeId(docId)+'&select=version&order=version.desc&limit=1');
        var _rvNext=(_rvEx.length&&_rvEx[0].version?_rvEx[0].version:0)+1;
        var _rfSafe=_rf.name.replace(/[^a-zA-Z0-9._-]/g,'_');
        var _rfPath='reject_'+Date.now()+'_'+_rfSafe;
        await upFile(_rfPath,_rf);
        await dp('document_files',{document_id:docId,file_name:'[ตีกลับ] '+_rf.name,file_path:_rfPath,file_size:_rf.size,file_type:_rf.type,uploaded_by:CU.id,version:_rvNext});
        await dp('document_history',{document_id:docId,action:'แนบไฟล์วงแก้ไข: '+_rf.name,performed_by:CU.id});
      }catch(_rfe){console.warn('Reject file upload failed:',_rfe)}
    }
  }
  if(nst==='numbering'){
    // ส่งคืนผู้จัดทำเพื่อออกเลขหนังสือ
    await dpa('documents',docId,{forwarded_to_id:doc.created_by,forwarded_at:new Date().toISOString()});
    await dp('document_history',{document_id:docId,action:'ส่งคืนผู้จัดทำเพื่อออกเลขหนังสือ',performed_by:CU.id,note:'ลายเซ็นครบทุกขั้นตอนแล้ว'})
  }
  // When completed (outgoing): forward to final_recipient or back to creator
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
        if(latestFile.file_size&&latestFile.file_size>20*1024*1024)
          throw new Error('ไฟล์ PDF ขนาด '+Math.round(latestFile.file_size/1024/1024)+'MB ใหญ่เกินไป กรุณาใช้ตัวแก้ไข PDF แนบลายเซ็นด้วยตนเอง');
        var pdfResp=await fetch(fileUrl2);
        if(pdfResp.ok){
          var pdfBuf=await pdfResp.arrayBuffer();
          var pdfDoc=await PDFLib.PDFDocument.load(new Uint8Array(pdfBuf),{ignoreEncryption:true});
          var _sigPageIdx=Math.min(Math.max((_actSigPage||pdfDoc.getPageCount()),1),pdfDoc.getPageCount())-1;
          var lastPg=pdfDoc.getPage(_sigPageIdx);
          var pw=lastPg.getWidth(),ph=lastPg.getHeight();
          var imgBytes=await fetch(sigSrc).then(function(r){return r.arrayBuffer()});
          var emb;
          if(sigSrc.startsWith('data:image/jpeg')||sigSrc.startsWith('data:image/jpg')){
            emb=await pdfDoc.embedJpg(imgBytes);
          }else if(sigSrc.startsWith('data:image/png')){
            emb=await pdfDoc.embedPng(imgBytes);
          }else{
            throw new Error('รองรับเฉพาะไฟล์ PNG หรือ JPEG สำหรับลายเซ็น กรุณาแปลงไฟล์ก่อน');
          }
          var _sx,_sy;
          if(_actSigPos.xFrac!==null){
            _sx=_actSigPos.xFrac*pw;
            _sy=(1-_actSigPos.yFrac)*ph-60;
          }else{_sx=pw-220;_sy=40}
          _sx=Math.max(0,Math.min(pw-180,_sx));
          _sy=Math.max(0,Math.min(ph-60,_sy));
          lastPg.drawImage(emb,{x:_sx,y:_sy,width:180,height:60});
          var newBytes=await pdfDoc.save();
          var _baseName=latestFile.file_name.replace(/^(\[ลงนาม\]\s*)+/,'');
          var safeName=_baseName.replace(/[^a-zA-Z0-9._-]/g,'_');
          var newPath='signed_'+Date.now()+'_'+safeName;
          var newBlob=new Blob([newBytes],{type:'application/pdf'});
          await upFile(newPath,newBlob);
          await dp('document_files',{document_id:docId,file_name:'[ลงนาม] '+_baseName,file_path:newPath,file_size:newBlob.size,file_type:'application/pdf',uploaded_by:CU.id,version:(latestFile.version||1)+1});
          await dp('document_history',{document_id:docId,action:'ฝังลายเซ็นในเอกสาร',performed_by:CU.id})
        }
      }
    } catch(sigErr){
      console.warn('Signature embed failed:',sigErr.message);
      var _sa=$e('dal');if(_sa)_sa.innerHTML=alrtH('wa','ฝังลายเซ็นไม่สำเร็จ: '+sigErr.message);
    }
  }
  // Send email notification
  try{ await sendNotifEmail(docId, action, nst, note); }catch(ne){console.warn('Email notif failed:',ne)}
  if(mw) mw.innerHTML='';
  var a=$e('dal');
  var _slaD=SETT.sla_cascade_days||3;
  var _okMsg=nst==='numbering'?'ลายเซ็นครบทุกขั้นตอนแล้ว! ระบบส่งคืนผู้จัดทำเพื่อออกเลขที่หนังสือ':nst==='completed'?'เอกสารผ่านทุกขั้นตอนแล้ว! สถานะเปลี่ยนเป็น "เสร็จสิ้น" และส่งอีเมลแจ้งทุกคนแล้ว':action==='approve'?'อนุมัติเรียบร้อยแล้ว และส่งอีเมลแจ้งผู้รับผิดชอบขั้นตอนถัดไปแล้ว':(_cascadePrev?'ส่งคืนแก้ไขไปยัง "'+(_cascadePrev.step_name||'ขั้นตอนก่อนหน้า')+'" แล้ว — ผู้รับต้องดำเนินการภายใน '+_slaD+' วัน (SLA)':'ส่งคืนพร้อมระบุส่วนที่แก้ไขแล้ว — แจ้งผู้จัดทำทางอีเมลแล้ว (SLA '+_slaD+' วัน)');
  if(a) a.innerHTML=alrtH('ok',_okMsg);
  _actBusy=false;
  setTimeout(function(){nav('det',docId)},1200)
}

var _resubBusy=false;
/* ── RE-SUBMIT หลัง reject ── */
/* [UX] แทน confirm() ดิบด้วย showConfirm ของระบบ */
function doReSubmit(docId){
  if(_resubBusy)return;
  showConfirm(
    'ส่งเอกสารใหม่อีกครั้ง?',
    'เอกสารจะเริ่มขั้นตอนอนุมัติใหม่ตั้งแต่ต้น กรุณาแน่ใจว่าแก้ไขครบถ้วนแล้ว',
    function(){_doReSubmitConfirmed(docId);},
    {confirmLabel:'ส่งใหม่',confirmClass:'btn-primary',icon:'up',iconBg:'#EFF6FF',iconColor:'#2563EB'}
  );
}
async function _doReSubmitConfirmed(docId){
  if(_resubBusy)return;
  _resubBusy=true;
  try{
    var wf=await dg('workflow_steps','?document_id=eq.'+docId+'&order=step_number');
    // รีเซ็ตทุก step ตั้งแต่ step 2 ขึ้นไปทั้งหมด เพื่อเริ่มใหม่จริงตั้งแต่ต้น
    // (รวม step ที่ status='done' ด้วย — ไม่ข้ามผู้อนุมัติที่เคย approve ไปแล้ว)
    var _firstRevStep=wf.find(function(s){return s.step_number>1});
    if(!_firstRevStep){showAlert('ไม่พบขั้นตอนที่ต้องอนุมัติ','wa');_resubBusy=false;return}

    for(var i=0;i<wf.length;i++){
      var step=wf[i];
      if(step.step_number===1) continue; // step ผู้จัดทำ auto-done ตอน submit ไม่ต้อง reset
      var _upd={action_taken:null,note:null,revision_section:null,action_at:null,completed_at:null,rejected_by:null,deadline_datetime:null,deadline_days:null};
      _upd.status=(step.id===_firstRevStep.id)?'active':'waiting';
      await dpa('workflow_steps',step.id,_upd);
    }

    await dpa('documents',docId,{status:'pending',updated_at:new Date().toISOString()});
    await dp('document_history',{document_id:docId,action:'ส่งใหม่อีกครั้ง',performed_by:CU.id,note:'ผู้จัดทำส่งเอกสารใหม่หลังแก้ไขแล้ว — เริ่มขั้นตอนอนุมัติใหม่ทั้งหมด'});
    try{await sendNotifEmail(docId,'resubmit','pending','')}catch(ne){console.warn('Email notif failed:',ne)}
    nav('det',docId);
  }catch(e){
    showAlert('เกิดข้อผิดพลาด: '+e.message,'er');
  }finally{
    _resubBusy=false;
  }
}

