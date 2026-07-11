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

/* ── จัดกลุ่มไฟล์แนบตามชื่อไฟล์ต้นฉบับ (ตัด tag [ลงนาม]/[ตีกลับ]/[แก้ไข] ออก) ──
   ไฟล์ล่าสุดของแต่ละชื่อ = "ฉบับปัจจุบัน" (ไฟล์ที่เซ็นใหม่ทับฉบับเก่าของไฟล์เดียวกัน)
   เวอร์ชันเก่าเห็นได้เฉพาะ admin/เจ้าหน้าที่ (_canSeeVerHist) */
function _fileBaseName(f){
  return f.file_name.replace(/^(\[(ลงนาม|ตีกลับ|แก้ไข)\]\s*)+/g,'').replace(/^(signed|reject|edited)_\d+_/,'');
}
function _isSignedFile(f){
  return f.file_name.indexOf('[ลงนาม]')>=0||f.file_path.indexOf('signed/')===0||/^signed_/.test(f.file_path||'');
}
function _signedStablePath(docId,baseName){
  var safe=baseName.replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,100);
  return 'signed/'+docId+'/'+safe+'.pdf';
}
async function _deleteStorage(path){
  if(!path) return;
  try{
    await fetch(SU+'/storage/v1/object/documents/'+encodeURIComponent(path),{method:'DELETE',headers:{apikey:SK,Authorization:H.Authorization}});
  }catch(e){}
}
function _fileGroups(files){
  var m={},order=[];
  files.forEach(function(f){
    var k=_fileBaseName(f);
    if(!m[k]){m[k]=[];order.push(k)}
    m[k].push(f);
  });
  var cur=[],hist=[];
  order.forEach(function(k){
    // ใหม่สุดก่อน — เทียบเวลาอัปโหลดจริงเป็นหลัก (version เชื่อไม่ได้ ตัวแก้ไข PDF insert v1 เสมอ)
    var g=m[k].slice().sort(function(a,b){
      var ta=a.uploaded_at?new Date(a.uploaded_at).getTime():0, tb=b.uploaded_at?new Date(b.uploaded_at).getTime():0;
      return (tb-ta)||((b.version||1)-(a.version||1));
    });
    cur.push(g[0]);
    for(var i=1;i<g.length;i++) hist.push(g[i]);
  });
  return {cur:cur,hist:hist};
}
function _canSeeVerHist(){return ['ROLE-SYS','ROLE-STF'].includes(CU.role_code)}
function _rCurFileRow(f,docId){
  var ft=fType(f);
  var isSigned=_isSignedFile(f);
  var isRejFile=f.file_name.indexOf('[ตีกลับ]')>=0;
  var isEditFile=f.file_name.indexOf('[แก้ไข]')>=0||f.file_name.indexOf('edited_')>=0;
  var _dispName=_fileBaseName(f);
  var dtStr=f.uploaded_at?new Date(f.uploaded_at).toLocaleString('th-TH',{day:'numeric',month:'short',year:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
  var h=['<div class="file-item file-item-detail">'];
  h.push('<div class="file-chip-wrap">'+fChip(f,18)+'</div>');
  h.push('<div class="file-info">');
  h.push('<div class="file-name">'+esc(_dispName)+'</div>');
  h.push('<div class="file-sub">');
  h.push('<span class="badge b-completed">v'+f.version+' ล่าสุด</span>');
  if(isSigned) h.push('<span class="badge b-signed">ลงนามแล้ว</span>');
  if(isRejFile) h.push('<span class="badge b-rejected">ตีกลับ</span>');
  if(isEditFile) h.push('<span class="badge b-pending">แก้ไข</span>');
  h.push('<span class="file-meta">'+ft.label+' · '+fsz(f.file_size)+(dtStr?' · '+dtStr:'')+'</span>');
  h.push('</div></div><div class="file-actions">');
  h.push('<button class="btn btn-ghost xs" data-action="openViewer" data-path="'+esc(f.file_path)+'" data-name="'+esc(_dispName)+'">'+svg('eye',11)+' ดู</button>');
  h.push('<button class="btn btn-soft xs" data-action="openEditor" data-path="'+esc(f.file_path)+'" data-name="'+esc(_dispName)+'" data-fid="'+f.id+'" data-did="'+docId+'">'+svg('edit',11)+' แก้ไข</button>');
  h.push('<button class="btn btn-soft xs" data-action="dlFile" data-path="'+esc(f.file_path)+'" data-name="'+esc(_dispName)+'">'+svg('dn',11)+' โหลด</button>');
  h.push('</div></div>');
  return h.join('');
}
function _rFilesBodyHtml(files,docId){
  if(!files.length) return '<div class="card-empty py-6"><div class="card-empty-icon">'+svg('folder',40)+'</div><div class="card-empty-text">ยังไม่มีไฟล์แนบ</div></div>';
  var fg=_fileGroups(files);
  var h=['<div class="files-list-label">ฉบับปัจจุบัน</div>','<div class="files-list">'];
  fg.cur.forEach(function(f){h.push(_rCurFileRow(f,docId))});
  h.push('</div>');
  if(_canSeeVerHist()&&fg.hist.length){
    h.push('<button class="files-hist-toggle" data-action="showVerHist" data-id="'+docId+'">'+svg('tri',10)+' ประวัติเวอร์ชันก่อนหน้า ('+fg.hist.length+' ไฟล์)</button>');
  }
  return h.join('');
}
function _rFileCountHtml(files){
  var fg=_fileGroups(files);
  var s=(_canSeeVerHist()?files.length:fg.cur.length)+' ไฟล์';
  if(_canSeeVerHist()&&fg.hist.length) s+=' · <span class="text-[#2563EB] font-semibold">'+fg.hist.length+' เวอร์ชันแก้ไข</span>';
  return s;
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
    var _aus=await dg('user_directory','?id=in.('+_aIds.map(safeId).join(',')+')'+'&select=id,full_name,contact_email,email');
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

  var html=['<div class="flex items-center gap-2.5 mb-3 flex-wrap">'];
  html.push('<button class="btn-back" data-action="nav" data-view="docs">'+svg('back',15)+' กลับรายการ</button>');
  html.push(sBadge(doc.status));
  // Status banners — เก็บแยกไว้ก่อน แสดงเป็นแถบเต็มความกว้างใต้ toolbar (ไม่ปนกับปุ่ม action)
  var banners=[];
  if(doc.status==='completed') banners.push('<div class="al al-ok"><span class="al-icon">'+svg('ok',13)+'</span><span><strong>อนุมัติครบทุกขั้นตอนแล้ว</strong> เอกสารเสร็จสมบูรณ์</span></div>');
  var _canNum=doc.status==='numbering'&&(doc.created_by===CU.id||['ROLE-SYS','ROLE-STF'].includes(CU.role_code));
  if(doc.status==='numbering') banners.push('<div class="al al-wa"><span class="al-icon">'+svg('pen',13)+'</span><span>'+(_canNum?'<strong>ลายเซ็นครบทุกขั้นตอนแล้ว</strong> กดปุ่ม “ออกเลขหนังสือ” ด้านบนเพื่อกำหนดเลขที่และวันที่':'<strong>รอผู้จัดทำออกเลขที่หนังสือ</strong> เอกสารผ่านการลงนามครบแล้ว')+'</span></div>');
  // Banner: cascade — แสดงเมื่อ step ที่ active ถูก re-activate เพราะ step ถัดไปตีกลับ
  var _curActWf=wf.filter(function(s){return s.status==='active'})[0];
  var _nextRejWf=_curActWf?wf.find(function(s){return s.step_number>_curActWf.step_number&&s.status==='rejected'}):null;
  if(_nextRejWf&&doc.status==='pending'){
    var _rejReason=_nextRejWf.revision_section?(' — <span class="font-semibold text-[#DC2626]">'+esc(_nextRejWf.revision_section)+'</span>'):'';
    var _rejNote=_nextRejWf.note?(' "<em>'+esc(_nextRejWf.note)+'</em>"'):'';
    banners.push('<div class="al al-wa"><span class="al-icon">'+svg('undo',13)+'</span><span>ส่งคืนมาจากขั้นตอน: <strong>'+esc(_nextRejWf.step_name)+'</strong>'+_rejReason+_rejNote+' · กรุณาดำเนินการภายใน <strong>'+(SETT.sla_cascade_days||3)+' วัน</strong></span></div>');
  } else if(hasRejectedHistory && doc.status==='pending') {
    banners.push('<div class="al al-wa"><span class="al-icon">'+svg('undo',13)+'</span><span>เอกสารที่แก้ไขแล้วหลังการส่งคืน - รอการอนุมัติตามขั้นตอน</span></div>');
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
      banners.push('<div class="al '+(_slaIsLate?'al-er':_wdLeft<=1?'al-er':'al-wa')+'"><span class="al-icon">'+svg('clock',13)+'</span><span>'+_wdLabel+'</span></div>');
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
  } else if(doc.status==='draft'&&doc.created_by===CU.id&&wf.length>0){
    html.push('<button class="btn btn-primary sm" data-action="doReSubmit" data-id="'+docId+'">'+svg('up',13)+' ส่งเข้าระบบอีกครั้ง</button>');
  }
  // ผู้จัดทำดึงกลับเป็นฉบับร่างได้ทุกกรณีที่ยังอยู่ใน workflow (pending) — แม้มีผู้อนุมัติไปแล้วบางขั้น
  if(doc.status==='pending'&&doc.created_by===CU.id&&wf.length>0){
    html.push('<button class="btn btn-soft sm" data-action="doRecall" data-id="'+docId+'">'+svg('undo',13)+' ดึงกลับ</button>');
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
    // ผู้ที่ส่งต่อได้ต้องเป็นผู้ถือเอกสารอยู่ตอนนี้ (ผู้จัดทำถ้ายังไม่ส่งต่อ หรือผู้ที่ถูกส่งต่อล่าสุด) หรือแอดมิน/เจ้าหน้าที่
    // — ต้องตรงกับสิทธิ์ที่ DB เช็คจริงใน documents_update RLS policy ไม่งั้นปุ่มจะกดได้แต่ขึ้น error
    var _holdsDoc=doc.forwarded_to_id?doc.forwarded_to_id===CU.id:doc.created_by===CU.id;
    var _canFwd=_holdsDoc||['ROLE-SYS','ROLE-STF'].includes(CU.role_code);
    if(!_fwdPending&&_canFwd){
      html.push('<button class="btn btn-soft sm" data-action="showFwdModal" data-id="'+docId+'">'+svg('sign',13)+' ส่งต่อ</button>');
    } else if(_fwdPending){
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
  if(banners.length) html.push('<div class="flex flex-col gap-2.5 mb-[18px]" style="margin-top:24px">'+banners.join('')+'</div>');
  html.push('<div id="dal"></div>');
  html.push('<div class="two-col"><div>');

  // Info
  var _ico=function(i,bg,cl){return '<div style="width:26px;height:26px;border-radius:7px;background:'+bg+';display:flex;align-items:center;justify-content:center;color:'+cl+'">'+svg(i,13)+'</div>'};
  html.push('<div class="card"><div class="card-head">'+_ico('doc','#FFF3EE','#E83A00')+'<span class="card-head-title">ข้อมูลเอกสาร</span></div><div class="card-body">');
  var _addrDisplay=doc.doc_type==='outgoing'?(PTH[doc.addressed_to]||doc.addressed_to||'—'):(doc.addressed_to||'—');
  var _fromDisplay=doc.doc_type==='outgoing'&&doc.description?'โครงการ: '+doc.description:(doc.from_department||'—');
  // หัวเรื่อง + เลขที่เอกสาร
  html.push('<div class="detail-head"><span class="detail-title">'+esc(doc.title)+'</span><span class="detail-num">'+esc(doc.doc_number||'—')+'</span></div>');
  var _scell=function(label,val){return '<div class="stat-cell"><span class="stat-label">'+label+'</span><span class="stat-value">'+val+'</span></div>'};
  // โซน 1: ผู้รับ/ผู้ส่ง — พื้นอ่อน 2 คอลัมน์เท่ากัน
  html.push('<div class="detail-parties">');
  html.push(_scell('เรียน (ถึง)','<span class="detail-val-accent">'+esc(_addrDisplay)+'</span>'));
  html.push(_scell('จากฝ่าย / หน่วยงาน','<span class="detail-val">'+esc(_fromDisplay)+'</span>'));
  html.push('</div>');
  // โซน 2: เมตาดาต้า — grid 3 คอลัมน์
  html.push('<div class="detail-fields">');
  [['ประเภท',tBadge(doc.doc_type)],
   ['ความเร่งด่วน',uBadge(doc.urgency)+
     (['ROLE-STF','ROLE-SYS'].includes(CU.role_code)?'<button class="btn btn-soft xs" data-action="showChgUrgency" data-id="'+docId+'" title="แก้ไขความเร่งด่วน">'+svg('edit',11)+'</button>':'')],
   ['วันที่เอกสาร','<span class="detail-val">'+fd(doc.doc_date)+'</span>'],
   ['กำหนดเสร็จ','<span class="detail-val-warn">'+fd(doc.due_date)+(doc.deadline_datetime?' '+new Date(doc.deadline_datetime).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}):'')+'</span>'],
   ['ผู้จัดทำ','<span class="detail-val">'+esc(creator.full_name)+'</span>'],
   ['ผู้รับเอกสารเสร็จสิ้น',doc.final_recipient_id&&_aMap[doc.final_recipient_id]?'<span class="detail-val">'+esc(_aMap[doc.final_recipient_id].full_name)+'</span>':'<span class="detail-val-muted">ผู้จัดทำ (ค่าเริ่มต้น)</span>']
  ].forEach(function(r){html.push(_scell(r[0],r[1]))});
  html.push('</div>');
  // โซน 3: รายละเอียดเพิ่มเติม — ข้อความยาว แยกเป็นบล็อกอ่านง่าย line-height สูง
  var _descBoxText=doc.description?((doc.description==='เรื่องอื่น ๆ'&&doc.subject_line)?'เรื่องอื่น ๆ: '+doc.subject_line:doc.description):'';
  if(_descBoxText) html.push('<div class="detail-desc"><div class="detail-desc-label">'+svg('doc',13)+' รายละเอียดเพิ่มเติม</div><div class="detail-desc-text">'+esc(_descBoxText)+'</div></div>');
  // Show forwarded_to info
  if(doc.forwarded_to_id&&doc.status==='completed'){
    var _fwdUser=_aMap[doc.forwarded_to_id];
    if(_fwdUser) html.push('<div class="al al-ok detail-fwd"><span class="al-icon">'+svg('sign',15)+'</span><div style="line-height:1.65"><strong>ส่งเอกสารถึง: '+esc(_fwdUser.full_name)+'</strong>'+(doc.forwarded_at?'<div style="font-size:11px;margin-top:4px;opacity:.85">เมื่อ '+new Date(doc.forwarded_at).toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'})+'</div>':'')+'</div></div>')
  }
  html.push('</div></div>');

  // Files — จัดกลุ่มตามไฟล์ต้นฉบับ: ฉบับล่าสุดของแต่ละไฟล์ (Word/PDF/เอกสารเบิกเงิน) = ฉบับปัจจุบัน
  // เวอร์ชันเก่าที่ถูกทับเห็นได้เฉพาะ admin/เจ้าหน้าที่ (ดู _fileGroups/_canSeeVerHist ด้านบน)
  var _signedFile=files.find(function(f){return _isSignedFile(f)});

  html.push('<div class="card files-card"><div class="card-head files-card-head">'+_ico('folder','#FFF3EE','#E83A00')+'<span class="card-head-title">ไฟล์แนบ</span>');
  html.push('<span class="file-head-actions ml-auto">');
  if(_signedFile){
    var _signedDispName=_fileBaseName(_signedFile);
    html.push('<span class="file-head-btns">');
    html.push('<button class="btn btn-ghost xs" data-action="openViewer" data-path="'+esc(_signedFile.file_path)+'" data-name="'+esc(_signedDispName)+'">'+svg('eye',12)+' ดูฉบับเซ็น</button>');
    html.push('<button class="btn btn-soft xs" data-action="dlFile" data-path="'+esc(_signedFile.file_path)+'" data-name="'+esc(_signedDispName)+'">'+svg('dn',12)+' โหลดฉบับเซ็น</button>');
    html.push('</span>');
  }
  html.push('<span class="files-count-chip" id="dfcount">'+_rFileCountHtml(files)+'</span>');
  html.push('</span></div>');
  html.push('<div class="card-body" id="dfiles">'+_rFilesBodyHtml(files,docId)+'</div></div>');

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
    if(a.indexOf('ยืนยัน')>=0)                          return {ic:'ok',  bg:'#D1FAE5',cl:'#16A34A'};
    if(a.indexOf('อนุมัติ')>=0||a.indexOf('ลงนาม')>=0) return {ic:'ok',  bg:'#D1FAE5',cl:'#16A34A'};
    if(a.indexOf('ออกเลขหนังสือ')>=0)                   return {ic:'pen', bg:'#FFF3EE',cl:'#E83A00'};
    if(a.indexOf('ส่งคืน')>=0)                          return {ic:'x',   bg:'#FEE2E2',cl:'#DC2626'};
    if(a.indexOf('ส่งใหม่')>=0||a.indexOf('ส่งอีกครั้ง')>=0) return {ic:'undo',bg:'#DBEAFE',cl:'#2563EB'};
    if(a.indexOf('อัปโหลด')>=0)                         return {ic:'up',  bg:'#EDE9FE',cl:'#7C3AED'};
    if(a.indexOf('ฝังลายเซ็น')>=0)                      return {ic:'pen', bg:'#D1FAE5',cl:'#16A34A'};
    if(a.indexOf('แก้ไข')>=0)                           return {ic:'edit',bg:'#FEF3C7',cl:'#D97706'};
    if(a.indexOf('ส่งต่อ')>=0)                          return {ic:'sign',bg:'#FFF3EE',cl:'#E83A00'};
    if(a.indexOf('เปิดดู')>=0)                          return {ic:'eye', bg:'#EFF6FF',cl:'#2563EB'};
    if(a.indexOf('สร้าง')>=0||a.indexOf('ส่งเอกสาร')>=0) return {ic:'doc',bg:'#FFF3EE',cl:'#E83A00'};
    return {ic:'doc',bg:'#F5F5F5',cl:'#6b6560'};
  };
  html.push('<div class="card"><div class="card-head">'+_ico('cal','#FFF3EE','#E83A00')+'<span class="card-head-title">ประวัติการดำเนินการ</span></div><div class="card-body">');
  /* [UX] ไม่ต้องแสดงทุก action — กรอง log ที่ทำให้ timeline รกออก เหลือเฉพาะ action ที่เป็นขั้นตอนการดำเนินงานจริง:
     - "เปิดดูไฟล์" เกิดทุกครั้งที่ preview ไฟล์
     - "เปลี่ยนสถานะ (Admin)" การบังคับเปลี่ยนสถานะของแอดมิน (ขึ้นซ้ำหลายครั้ง) */
  var _hidePrefix=['เปิดดูไฟล์','เปลี่ยนสถานะ (Admin)'];
  var _dispHist=hist.filter(function(h){return !(h.action&&_hidePrefix.some(function(p){return h.action.indexOf(p)===0}))});
  if(_dispHist.length){
    _dispHist.forEach(function(h){
      var _hi=_histIcon(h.action);
      html.push('<div class="htl-item">');
      html.push('<div class="htl-ic" style="background:'+_hi.bg+';color:'+_hi.cl+'">'+svg(_hi.ic,15)+'</div>');
      html.push('<div class="htl-body"><div class="htl-action">'+esc(h.action)+'</div>');
      if(h.note) html.push('<div class="htl-note">"'+esc(h.note)+'"</div>');
      /* [UX] แสดงเวลาด้วย fdTime() เพื่อแยก actions ที่เกิดในวันเดียวกัน */
      html.push('<div class="htl-time">'+fdTime(h.performed_at)+'</div></div></div>');
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
  var nf=await dg('document_files','?document_id=eq.'+safeId(docId)+'&order=version.desc,uploaded_at.desc');
  var df=$e('dfiles');
  if(df) df.innerHTML=_rFilesBodyHtml(nf,docId);
  var dc=$e('dfcount');
  if(dc) dc.innerHTML=_rFileCountHtml(nf);
}

async function showVerHist(docId){
  // ประวัติเวอร์ชันเห็นได้เฉพาะ admin/เจ้าหน้าที่ — คนอื่นเห็นแค่ฉบับปัจจุบัน
  if(!_canSeeVerHist()) return;
  var w=$e('mwrap'); if(!w)return;
  var files=await dg('document_files','?document_id=eq.'+safeId(docId)+'&order=version.desc,uploaded_at.desc');
  var _histFiles=_fileGroups(files).hist;
  if(!_histFiles.length){w.innerHTML='';return}
  var rows=_histFiles.map(function(f){
    var ft=fType(f);
    var isSigned=_isSignedFile(f);
    var isEdited=f.file_name.indexOf('[แก้ไข]')>=0||f.file_name.indexOf('edited_')>=0;
    var isRejFile=f.file_name.indexOf('[ตีกลับ]')>=0;
    var dtStr=f.uploaded_at?new Date(f.uploaded_at).toLocaleString('th-TH',{day:'numeric',month:'short',year:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
    var _dn=_fileBaseName(f);
    return '<div class="file-item file-item-detail file-item-hist">'+
      '<div class="file-chip-wrap">'+fChip(f,17)+'</div>'+
      '<div class="file-info">'+
        '<div class="file-name file-name-muted">'+esc(_dn)+'</div>'+
        '<div class="file-sub">'+
          '<span class="badge b-draft">v'+f.version+'</span>'+
          (isSigned?'<span class="badge b-signed">ลงนาม</span>':'')+
          (isEdited?'<span class="badge badge-muted">แก้ไข</span>':'')+
          (isRejFile?'<span class="badge b-rejected">ตีกลับ</span>':'')+
          '<span class="file-meta">'+ft.label+' · '+fsz(f.file_size)+(dtStr?' · '+dtStr:'')+'</span>'+
        '</div>'+
      '</div>'+
      '<div class="file-actions">'+
        '<button class="btn btn-ghost xs" data-action="openViewer" data-path="'+esc(f.file_path)+'" data-name="'+esc(_dn)+'">'+svg('eye',11)+' ดู</button>'+
        '<button class="btn btn-soft xs" data-action="dlFile" data-path="'+esc(f.file_path)+'" data-name="'+esc(_dn)+'">'+svg('dn',11)+' โหลด</button>'+
      '</div>'+
    '</div>'
  }).join('');
  w.innerHTML='<div class="mo"><div class="modal">'+
    '<div class="modal-head"><span class="modal-title">'+svg('save',15)+' ประวัติเวอร์ชันก่อนหน้า</span>'+
    '<button class="btn btn-ghost xs btn-icon ml-auto" data-action="closeModal">'+svg('x',14)+'</button></div>'+
    '<div class="modal-body files-list-modal" style="max-height:60vh;overflow-y:auto"><div class="files-list">'+rows+'</div></div>'+
  '</div></div>'
}

async function showFwdModal(docId){
  var w=$e('mwrap'); if(!w)return;
  // กรองเฉพาะ เจ้าหน้าที่ (ROLE-STF) และ อาจารย์กิจการ (ROLE-ADV) เท่านั้น
  var allUsers=await dg('user_directory','?is_active=eq.true&approval_status=eq.approved&role_code=in.(ROLE-STF,ROLE-ADV)&order=full_name');
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
    var toUser=(await dg('user_directory','?id=eq.'+safeId(toId)))[0];
    var doc2=(await dg('documents','?id=eq.'+docId))[0]||{};
    var recipEmail=toUser?(toUser.contact_email||toUser.email):'';
    var emailSubj=(SETT.email_prefix||'[กนค.]')+' ส่งต่อเอกสาร: '+(doc2.title||'');
    var emailBody='เรียน '+(toUser?toUser.full_name:'')+', ท่านได้รับเอกสารเรื่อง "'+(doc2.title||'')+'" ที่ผ่านการอนุมัติเรียบร้อยแล้ว'+(note?' หมายเหตุ: '+note:'');
    var fwdStatus='skipped';
    try{
      if(recipEmail&&!recipEmail.includes('@gnk.student')){
        var fwdResp=await sendEmailEdge({to:recipEmail,subject:emailSubj,html:emailBody,documentId:docId,recipientUserId:toId});
        fwdStatus=fwdResp.ok?'sent':'failed';
        if(fwdResp.ok) showEmailToast(recipEmail,emailSubj);
      }
      await logNotifRow({document_id:docId,recipient_id:toId,recipient_email:recipEmail||'',subject:emailSubj,body:emailBody,notification_type:'forward',status:fwdStatus,sent_at:new Date().toISOString()});
    }catch(fe){console.warn('Forward notify failed:',fe)}
    // LINE OA push (ช่องทางเสริม — ข้ามเงียบ ๆ ถ้าผู้รับไม่ได้ผูก LINE)
    try{
      var fwdLine=(SETT.email_prefix||'[กนค.]')+' 📨 มีเอกสารส่งต่อถึงคุณ\nเรียน '+(toUser?toUser.full_name:'')+'\nเรื่อง: '+(doc2.title||'')+(note?'\nหมายเหตุ: '+note:'')+'\n\n'+(SETT.app_url?'เข้าสู่ระบบเพื่อรับเอกสาร: '+SETT.app_url:'กรุณาเข้าสู่ระบบ SAEDU Flow เพื่อรับเอกสาร');
      var fwdFlex=null;
      try{fwdFlex=buildLineFlex({headText:'📨 มีเอกสารส่งต่อถึงคุณ',recipName:(toUser?toUser.full_name:''),subj:doc2.title||'',rows:note?[['หมายเหตุ',note]]:[],infoText:'เอกสารผ่านการอนุมัติครบทุกขั้นตอนแล้ว กดรับเอกสารเพื่อดาวน์โหลดไฟล์',button:'เข้าสู่ระบบเพื่อรับเอกสาร'})}catch(fe){}
      await sendLineWithLog(docId,toId,recipEmail,emailSubj,fwdLine,'forward',fwdFlex);
    }catch(le){console.warn('Forward LINE failed:',le)}
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
    await acceptForwardedDoc(docId);
    var a=$e('dal');if(a)a.innerHTML=alrtH('ok','รับเอกสารเรียบร้อยแล้ว');
    if(CV==='docs'){try{fDocs();}catch(e){nav('docs')}}
    else setTimeout(function(){nav('det',docId)},900);
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
    await declineForwardedDoc(docId,note);
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

/* [self-heal] ซ่อมสถานะเอกสารที่ค้างจาก write ข้ามตารางที่พังกลางทาง (เช่น step เปลี่ยนแล้วแต่ doc.status ไม่ขยับ)
   อ่าน workflow_steps แล้ว re-assert สถานะ canonical ของเอกสาร:
   - มี step active → ควรเป็น 'pending' (current_step = step นั้น)
   - มี step rejected → ควรเป็น 'rejected'
   กรณี "ครบทุก step แล้ว" ปล่อยให้ flow ปกติ/การกดซ้ำจัดการ (เลี่ยงออกเลข/ส่งต่อซ้ำ)
   ทำงานเฉพาะเอกสารที่ยังอยู่ในช่วง workflow (pending/active/rejected) เท่านั้น ไม่แตะ numbering/completed */
async function _reconcileDocState(docId){
  try{
    var st=await dg('workflow_steps','?document_id=eq.'+safeId(docId)+'&order=step_number');
    if(!Array.isArray(st)||!st.length) return;
    var d=(await dg('documents','?id=eq.'+safeId(docId)+'&select=status,current_step'))[0];
    if(!d||['pending','active','rejected'].indexOf(d.status)<0) return;
    var active=st.filter(function(s){return s.status==='active'})[0];
    var want=null,wantStep=null;
    if(active){want='pending';wantStep=active.step_number;}
    else if(st.some(function(s){return s.status==='rejected'})){want='rejected';}
    if(want&&d.status!==want){
      var patch={status:want,updated_at:new Date().toISOString()};
      if(wantStep) patch.current_step=wantStep;
      await dpa('documents',docId,patch);
      await dp('document_history',{document_id:docId,action:'ซ่อมสถานะอัตโนมัติ (self-heal): '+want,performed_by:CU.id,note:'สถานะเอกสารไม่ตรงกับขั้นตอน ระบบปรับให้สอดคล้อง'});
    }
  }catch(e){console.warn('reconcileDocState failed',e)}
}

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
  var wf,cur,ns,nst;
  var usedRpc=false;
  // [atomic RPC] อนุมัติ/ตีกลับแบบ transaction เดียว — fallback เป็น write แยกถ้า SQL ยังไม่ deploy
  try{
    var rpcRes=await drpc('workflow_action',{p_doc:docId,p_action:action,p_note:note,p_revision_section:revSection||null});
    if(rpcRes&&typeof rpcRes==='object'){
      nst=rpcRes.status;
      ns=rpcRes.current_step;
      usedRpc=true;
      wf=await dg('workflow_steps','?document_id=eq.'+safeId(docId)+'&order=step_number');
      cur=wf.filter(function(s){return s.step_number===(rpcRes.cur_step_number||1)})[0]||wf[0];
    }
  }catch(_rpcE){
    if(!rpcFnMissing(_rpcE)){
      await _reconcileDocState(docId);
      _actBusy=false;
      if(mw) mw.innerHTML='';
      showAlert('ดำเนินการไม่สำเร็จ ระบบได้ตรวจซ่อมสถานะเอกสารให้แล้ว กรุณาลองใหม่อีกครั้ง','er');
      return;
    }
    // fallback: write แยกตาราง (เดิม)
    try{
      wf=await dg('workflow_steps','?document_id=eq.'+docId+'&order=step_number');
      cur=wf.filter(function(s){return s.status==='active'})[0]||wf[0];
      if(cur){
        await dpa('workflow_steps',cur.id,{status:action==='approve'?'done':'rejected',action_taken:action,note:note,revision_section:revSection||null,action_at:new Date().toISOString(),completed_at:action==='approve'?new Date().toISOString():null,rejected_by:action==='reject'?CU.id:null});
        if(action==='approve'){
          var nx=wf.find(function(s){return s.step_number>cur.step_number&&s.status!=='done'});
          if(nx){
            var _nxUpd={status:'active',deadline_datetime:stepDeadline(nx.deadline_days)};
            if(nx.status==='rejected'){
              Object.assign(_nxUpd,{action_taken:null,note:null,revision_section:null,action_at:null,completed_at:null,rejected_by:null});
            }
            await dpa('workflow_steps',nx.id,_nxUpd);
          }
        }
      }
      ns=Math.min((doc.current_step||1)+1,doc.total_steps||1);
      var allDone=action==='approve'&&!wf.some(function(s){return s.step_number>cur.step_number&&s.status!=='done'});
      nst=action==='approve'?(allDone?(doc.doc_type==='incoming'?'numbering':'completed'):'pending'):'rejected';
      await dpa('documents',docId,{status:nst,current_step:ns,updated_at:new Date().toISOString()});
    }catch(_te){
      await _reconcileDocState(docId);
      _actBusy=false;
      if(mw) mw.innerHTML='';
      showAlert('ดำเนินการไม่สำเร็จ ระบบได้ตรวจซ่อมสถานะเอกสารให้แล้ว กรุณาลองใหม่อีกครั้ง','er');
      return;
    }
  }

  if(!usedRpc){
    var _histAct=action==='approve'?'อนุมัติ / ลงนาม':'ส่งคืนแก้ไขไปยังผู้จัดทำ';
    await dp('document_history',{document_id:docId,action:_histAct,performed_by:CU.id,note:note});
  }
  if(action==='reject'){
    // แจ้งเตือน (เพื่อทราบเท่านั้น) ผู้ที่อนุมัติ/ลงนามไปแล้วก่อนหน้า step ที่ตีกลับ
    var _priorApproved=wf.filter(function(s){return s.step_number>1&&s.step_number<cur.step_number&&s.status==='done'&&s.assigned_to});
    if(_priorApproved.length){
      try{
        var _paIds=_priorApproved.map(function(s){return s.assigned_to});
        var _paUsers=await dg('user_directory','?id=in.('+_paIds.map(safeId).join(',')+')'+'&select=id,full_name,contact_email,email');
        if(Array.isArray(_paUsers)&&_paUsers.length){
          await dp('document_history',{document_id:docId,action:'แจ้งเตือนผู้อนุมัติก่อนหน้า (เพื่อทราบ): '+_paUsers.map(function(u){return u.full_name}).join(', '),performed_by:CU.id,note:note});
          for(var _pi=0;_pi<_paUsers.length;_pi++){
            try{ await sendRejectFyiEmail(docId,_paUsers[_pi],cur.step_name,note); }catch(_fe){console.warn('FYI email failed:',_fe)}
          }
        }
      }catch(_pae){console.warn('Prior-approver lookup failed:',_pae)}
    }
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
  // Embed signature — ซ้อนลายเซ็นทับ PDF เดิม (อัปเดตไฟล์เดิม ไม่สร้างสำเนาใหม่ทุกขั้นตอน)
  if(sigSrc&&action==='approve'){
    try{
      var allPdfs=await dg('document_files','?document_id=eq.'+safeId(docId)+'&file_type=like.application%2Fpdf&order=uploaded_at.desc');
      if(allPdfs&&allPdfs.length){
        var latestFile=allPdfs[0];
        var baseName=_fileBaseName(latestFile);
        var groupPdfs=allPdfs.filter(function(f){return _fileBaseName(f)===baseName});
        var sourceFile=groupPdfs[0];
        var signedRow=groupPdfs.find(function(f){return _isSignedFile(f)});
        if(!window.PDFLib) await loadSc('https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js');
        if(sourceFile.file_size&&sourceFile.file_size>20*1024*1024)
          throw new Error('ไฟล์ PDF ขนาด '+Math.round(sourceFile.file_size/1024/1024)+'MB ใหญ่เกินไป กรุณาใช้ตัวแก้ไข PDF แนบลายเซ็นด้วยตนเอง');
        var pdfResp=await fetch(await resolveFileUrl(sourceFile.file_path));
        if(pdfResp.ok){
          var pdfBuf=await pdfResp.arrayBuffer();
          var pdfDoc=await PDFLib.PDFDocument.load(new Uint8Array(pdfBuf),{ignoreEncryption:true});
          var imgBytes=await fetch(sigSrc).then(function(r){return r.arrayBuffer()});
          var emb;
          if(sigSrc.startsWith('data:image/jpeg')||sigSrc.startsWith('data:image/jpg')){
            emb=await pdfDoc.embedJpg(imgBytes);
          }else if(sigSrc.startsWith('data:image/png')){
            emb=await pdfDoc.embedPng(imgBytes);
          }else{
            throw new Error('รองรับเฉพาะไฟล์ PNG หรือ JPEG สำหรับลายเซ็น กรุณาแปลงไฟล์ก่อน');
          }
          var _marks=(window._actSigMarks&&_actSigMarks.length)?_actSigMarks:[null];
          var _pgN=pdfDoc.getPageCount();
          for(var _mi=0;_mi<_marks.length;_mi++){
            var _mk=_marks[_mi];
            var _pg=pdfDoc.getPage(Math.min(Math.max((_mk?_mk.page:_pgN),1),_pgN)-1);
            var pw=_pg.getWidth(),ph=_pg.getHeight();
            var _w=180,_h=60,_sx=pw-220,_sy=40;
            if(_mk&&typeof _mk.xFrac==='number'){
              _w=(_mk.wFrac||180/pw)*pw;
              _h=_mk.hFrac!=null?_mk.hFrac*ph:_w/3;
              _sx=_mk.xFrac*pw;
              _sy=(1-_mk.yFrac)*ph-_h;
            }
            _sx=Math.max(0,Math.min(pw-_w,_sx));
            _sy=Math.max(0,Math.min(ph-_h,_sy));
            var _fit=fitImgInBox(emb.width,emb.height,_w,_h);
            _pg.drawImage(emb,{x:_sx+_fit.ox,y:_sy+_fit.oy,width:_fit.dw,height:_fit.dh});
          }
          var newBytes=await pdfDoc.save();
          var stablePath=_signedStablePath(docId,baseName);
          var newBlob=new Blob([newBytes],{type:'application/pdf'});
          var oldPath=signedRow?signedRow.file_path:null;
          await upFile(stablePath,newBlob);
          if(signedRow){
            await dpa('document_files',signedRow.id,{file_path:stablePath,file_size:newBlob.size,uploaded_by:CU.id,version:(signedRow.version||1)+1});
            if(oldPath&&oldPath!==stablePath) await _deleteStorage(oldPath);
          }else{
            await dp('document_files',{document_id:docId,file_name:'[ลงนาม] '+baseName,file_path:stablePath,file_size:newBlob.size,file_type:'application/pdf',uploaded_by:CU.id,version:(sourceFile.version||1)+1});
          }
          await dp('document_history',{document_id:docId,action:'ฝังลายเซ็นในเอกสาร'+(_marks.length>1?' ('+_marks.length+' จุด)':'')+(signedRow?' (ซ้อนทับฉบับเดิม)':''),performed_by:CU.id})
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
  var _okMsg=nst==='numbering'?'ลายเซ็นครบทุกขั้นตอนแล้ว! ระบบส่งคืนผู้จัดทำเพื่อออกเลขที่หนังสือ':nst==='completed'?'เอกสารผ่านทุกขั้นตอนแล้ว! สถานะเปลี่ยนเป็น "เสร็จสิ้น" และส่งอีเมลแจ้งทุกคนแล้ว':action==='approve'?'อนุมัติเรียบร้อยแล้ว และส่งอีเมลแจ้งผู้รับผิดชอบขั้นตอนถัดไปแล้ว':'ส่งคืนพร้อมระบุส่วนที่แก้ไขแล้ว — แจ้งผู้จัดทำทางอีเมลแล้ว (SLA '+_slaD+' วัน)';
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
    'ส่งเอกสารเข้าระบบอีกครั้ง?',
    'เอกสารจะเริ่มขั้นตอนอนุมัติใหม่ตั้งแต่ต้น (รวมผู้ที่เคยอนุมัติไปแล้วต้องอนุมัติใหม่) กรุณาแน่ใจว่าแก้ไขครบถ้วนแล้ว',
    function(){_doReSubmitConfirmed(docId);},
    {confirmLabel:'ส่งเข้าระบบ',confirmClass:'btn-primary',icon:'up',iconBg:'#EFF6FF',iconColor:'#2563EB'}
  );
}
async function _doReSubmitConfirmed(docId){
  if(_resubBusy)return;
  _resubBusy=true;
  try{
    var doc=(await dg('documents','?id=eq.'+safeId(docId)))[0];
    if(!doc||doc.created_by!==CU.id||!['draft','rejected'].includes(doc.status)){
      showAlert('ส่งใหม่ไม่ได้: สถานะเอกสารเปลี่ยนไปแล้ว','wa');_resubBusy=false;nav('det',docId);return;
    }
    var _rs=await restartDocWorkflow(docId);
    if(!_rs.ok){showAlert('ไม่พบขั้นตอนที่ต้องอนุมัติ','wa');_resubBusy=false;return;}
    var _note=doc.status==='rejected'?'ผู้จัดทำส่งเอกสารใหม่หลังแก้ไขแล้ว — เริ่มขั้นตอนอนุมัติใหม่ทั้งหมด':'ผู้จัดทำส่งเอกสารเข้าระบบอีกครั้ง — เริ่มขั้นตอนอนุมัติใหม่ทั้งหมด';
    await dp('document_history',{document_id:docId,action:'ส่งใหม่อีกครั้ง',performed_by:CU.id,note:_note});
    try{
      if(_rs.singleStep) await sendNotifEmail(docId,'create',_rs.status,'');
      else await sendNotifEmail(docId,'resubmit','pending','');
    }catch(ne){console.warn('Email notif failed:',ne)}
    nav('det',docId);
  }catch(e){
    showAlert('เกิดข้อผิดพลาด: '+e.message,'er');
  }finally{
    _resubBusy=false;
  }
}

var _recallBusy=false;
/* ── RECALL — ผู้จัดทำดึงกลับเป็นฉบับร่างได้ทุกกรณี (แม้มีผู้อนุมัติไปแล้ว) ── */
function doRecall(docId){
  if(_recallBusy)return;
  showConfirm(
    'ดึงเอกสารกลับ?',
    'เอกสารจะกลับเป็นฉบับร่างและรีเซ็ตขั้นตอนอนุมัติทั้งหมด ผู้ที่เคยอนุมัติหรือถืองานอยู่จะไม่เห็นงานนี้จนกว่าจะส่งเข้าระบบอีกครั้ง',
    function(){_doRecallConfirmed(docId);},
    {confirmLabel:'ดึงกลับ',confirmClass:'btn-danger',icon:'undo',iconBg:'#FFFBEB',iconColor:'#D97706'}
  );
}
async function _doRecallConfirmed(docId){
  if(_recallBusy)return;
  _recallBusy=true;
  try{
    var doc=(await dg('documents','?id=eq.'+safeId(docId)))[0];
    if(!doc||doc.status!=='pending'||doc.created_by!==CU.id){
      showAlert('ดึงกลับไม่ได้: สถานะเอกสารเปลี่ยนไปแล้ว','wa');_recallBusy=false;nav('det',docId);return
    }
    var rpcRes=await recallDocumentRpc(docId);
    var _notifyIds={};
    (rpcRes.notify_ids||[]).forEach(function(uid){_notifyIds[uid]=true});
    if(doc.notify_step!==false){
      for(var uid in _notifyIds){
        try{
          var _ru=await dg('user_directory','?id=eq.'+safeId(uid)+'&select=id,full_name,contact_email,email');
          var _u=Array.isArray(_ru)?_ru[0]:null;
          var _em=_u?(_u.contact_email||_u.email):'';
          var _subj=(SETT.email_prefix||'[กนค.]')+' ↩ ผู้จัดทำดึงเอกสารกลับ: '+(doc.title||'');
          if(_u&&_em&&_em.includes('@')&&!_em.includes('@gnk.student')){
            var _body='เรียน '+esc(_u.full_name)+',<br><br>เอกสารเรื่อง "'+esc(doc.title||'')+'" ถูกผู้จัดทำดึงกลับไปแก้ไขแล้ว ไม่ต้องดำเนินการใด ๆ หากส่งเข้าระบบใหม่จะมีอีเมลแจ้งอีกครั้ง';
            var _er=await sendEmailEdge({to:_em,subject:_subj,html:_body,documentId:docId,recipientUserId:_u.id});
            if(_er.ok&&typeof showEmailToast==='function') showEmailToast(_em,_subj);
            await logNotifRow({document_id:docId,recipient_id:_u.id,recipient_email:_em,subject:_subj,body:_body,notification_type:'recall',status:_er.ok?'sent':'failed',sent_at:new Date().toISOString()});
          }
          if(_u){
            var _lineTxt=(SETT.email_prefix||'[กนค.]')+' ↩️ ผู้จัดทำดึงเอกสารกลับ\nเรียน '+_u.full_name+'\nเรื่อง: '+(doc.title||'')+'\nเอกสารถูกดึงกลับไปแก้ไขแล้ว ไม่ต้องดำเนินการใด ๆ หากส่งเข้าระบบใหม่จะมีการแจ้งอีกครั้ง';
            var _rcFlex=null;
            try{_rcFlex=buildLineFlex({headText:'↩️ ผู้จัดทำดึงเอกสารกลับ',recipName:_u.full_name,subj:doc.title||'',infoText:'เอกสารถูกดึงกลับไปแก้ไขแล้ว ไม่ต้องดำเนินการใด ๆ หากส่งเข้าระบบใหม่จะมีการแจ้งอีกครั้ง'})}catch(fe){}
            try{await sendLineWithLog(docId,_u.id,_em||'',_subj,_lineTxt,'recall',_rcFlex)}catch(le){console.warn('Recall LINE failed:',le)}
          }
        }catch(ne){console.warn('Recall notify failed:',ne)}
      }
    }
    nav('det',docId).then(function(){showAlert('ดึงเอกสารกลับเรียบร้อยแล้ว กด "ส่งเข้าระบบอีกครั้ง" เพื่อเริ่ม Flow ใหม่ได้เลย','ok')}).catch(function(){});
  }catch(e){
    showAlert('เกิดข้อผิดพลาด: '+e.message,'er');
  }finally{
    _recallBusy=false;
  }
}

/* ─── เปลี่ยนความเร่งด่วน (เจ้าหน้าที่ / แอดมิน เท่านั้น — ผู้สร้างเลือกเองตอนสร้าง แต่เจ้าหน้าที่มีสิทธิ์ทบทวน/ปรับให้ตรงจริง) ─── */
async function showChgUrgency(docId){
  var w=$e('mwrap'); if(!w)return;
  var doc=(await dg('documents','?id=eq.'+safeId(docId)))[0]||{};
  var _udot={normal:'#16A34A',urgent:'#D97706',very_urgent:'#DC2626'};
  var opts=Object.entries(URG).map(function(e){
    var on=doc.urgency===e[0];
    return '<button class="btn '+(on?'btn-primary':'btn-soft')+' fw" style="text-align:left;justify-content:flex-start;gap:9px;margin-bottom:8px" data-action="doChgUrgency" data-id="'+docId+'" data-act="'+e[0]+'"><span style="width:9px;height:9px;border-radius:50%;flex-shrink:0;background:'+_udot[e[0]]+'"></span>'+e[1]+(on?' '+svg('ok',13):'')+'</button>';
  }).join('');
  w.innerHTML=
    '<div class="mo"><div class="modal">'+
    '<div class="modal-head"><span class="modal-title">'+svg('warn',14)+' แก้ไขความเร่งด่วน</span>'+
    '<button class="btn btn-soft sm btn-icon" data-action="closeModal">'+svg('x',14)+'</button></div>'+
    '<div class="modal-body">'+
    '<div class="al al-in" style="margin-bottom:14px"><span class="al-icon">'+svg('info',13)+'</span><span>ผู้สร้างเอกสารเลือกความเร่งด่วนไว้ตอนสร้าง เจ้าหน้าที่สามารถทบทวนและปรับให้ตรงกับความเป็นจริงได้</span></div>'+
    opts+
    '</div></div></div>';
}
function doChgUrgency(docId,val){
  showConfirm(
    'เปลี่ยนความเร่งด่วน?',
    'เปลี่ยนเป็น "'+(URG[val]||val)+'"',
    function(){_doChgUrgencyConfirmed(docId,val);},
    {confirmLabel:'บันทึก',confirmClass:'btn-primary',icon:'warn',iconBg:'#FFFBEB',iconColor:'#D97706'}
  );
}
async function _doChgUrgencyConfirmed(docId,val){
  try{
    await dpa('documents',docId,{urgency:val});
    await dp('document_history',{document_id:docId,action:'เปลี่ยนความเร่งด่วน',performed_by:CU.id,note:'ปรับเป็น: '+(URG[val]||val)});
    var mw=$e('mwrap');if(mw)mw.innerHTML='';
    nav('det',docId);
  }catch(e){
    showAlert('เกิดข้อผิดพลาด: '+e.message,'er');
  }
}

