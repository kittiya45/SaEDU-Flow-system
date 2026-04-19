/* ─── DOC FORM ─── */
async function vForm(editId){
  var doc={title:'',doc_type:'outgoing',urgency:'normal',description:'',doc_date:new Date().toISOString().slice(0,10),due_date:''};
  FS=[{step_name:'ผู้จัดทำ',role_required:'ROLE-CRT',assigned_to:CU.id,deadline_days:1}];
  FF=[]; FDI=editId||null; PF=[];
  if(editId){
    var rs=await Promise.all([dg('documents','?id=eq.'+editId),dg('workflow_steps','?document_id=eq.'+editId+'&order=step_number'),dg('document_files','?document_id=eq.'+editId+'&order=uploaded_at')]);
    if(rs[0][0]) Object.assign(doc,rs[0][0]);
    if(rs[1].length) FS=rs[1];
    FF=rs[2]
  }
  FU=await dg('users','?is_active=eq.true&approval_status=eq.approved&order=full_name');

  var tOpts=Object.entries(DTYPES).map(function(e){
    var cfg=DTYPE_CFG[e[0]]||{};
    return '<option value="'+e[0]+'"'+(doc.doc_type===e[0]?' selected':'')+'>'+e[1]+'</option>'
  }).join('');
  var uOpts=Object.entries(URG).map(function(e){return '<option value="'+e[0]+'"'+(doc.urgency===e[0]?' selected':'')+'>'+e[1]+'</option>'}).join('');
  var wfPersonOpts='<option value="">— เลือกผู้ดำเนินการ —</option>'+(FU||[]).map(function(u){
    return '<option value="'+u.id+'">'+esc(u.full_name)+' · '+(RTH[u.role_code]||u.role_code)+'</option>'
  }).join('');

  var html=[
    '<div class="flex items-center gap-2.5 mb-[18px]">',
    '<button class="btn btn-soft sm" data-action="nav" data-view="docs">'+svg('back',13)+' ย้อนกลับ</button>',
    '<span class="text-[#a89e99] text-[13px]">'+(editId?'แก้ไขเอกสาร':'สร้างเอกสารใหม่')+'</span>',
    '</div>',
    '<div id="fal"></div>'
  ];

  // ── Step 1: เลือกประเภทเอกสาร — Dropdown ──
  var dtOpts='<option value="">— กรุณาเลือกประเภทเอกสาร —</option>'+Object.entries(DTYPES).map(function(e){
    return '<option value="'+e[0]+'"'+(editId&&doc.doc_type===e[0]?' selected':'')+'>'+e[1]+'</option>';
  }).join('');
  html.push('<div class="card" style="margin-bottom:16px"><div class="card-head">'+svg('doc',15)+'<span class="card-head-title">ประเภทเอกสาร <span class="req">*</span></span></div><div class="card-body">');
  html.push('<div class="fg" style="margin-bottom:0">');
  html.push('<label class="fl">เลือกประเภทเอกสาร <span class="req">*</span></label>');
  html.push('<select class="fi" id="ftype-sel" onchange="selectDocType(this.value)">'+dtOpts+'</select>');
  html.push('<input type="hidden" id="ftype" value="'+(editId?doc.doc_type||'':'')+'" >');
  html.push('</div>');
  if(!editId) html.push('<div id="ftype-hint" class="text-[#a89e99] text-xs mt-2.5">กรุณาเลือกประเภทเอกสารเพื่อดำเนินการต่อ</div>');
  html.push('</div></div>');

  // ── Step 2: ฟอร์มทั้งหมด (ซ่อนไว้จนกว่าจะเลือกประเภท) ──
  html.push('<div id="form-rest" style="display:'+(editId?'block':'none')+'">');
  html.push('<div class="two-col"><div>');

  // Info card
  html.push('<div class="card"><div class="card-head">'+svg('doc',15)+'<span class="card-head-title">ข้อมูลเอกสาร</span></div><div class="card-body">');
  html.push('<div class="fg"><label class="fl">ความเร่งด่วน</label><select class="fi" id="furg">'+uOpts+'</select></div>');
  html.push('<div class="fg"><label class="fl">ชื่อเรื่อง / หัวข้อ <span class="req">*</span></label><input class="fi" id="ftit" value="'+esc(doc.title||'')+'" placeholder="ระบุชื่อเรื่องเอกสาร"></div>');
  html.push('<div id="dtype-fields">'+(editId?renderTypeFields(doc.doc_type||'outgoing',doc):'')+'</div>');
  html.push('</div></div>');

// Files card
html.push('<div class="card"><div class="card-head">'+svg('save',15)+'<span class="card-head-title">ไฟล์เอกสาร</span></div><div class="card-body">');

html.push('<div id="fflist">'+buildFileList(FF, editId||'')+'</div>');

html.push(`
  <div class="upload-zone" id="fzone">
    <div class="upload-zone-inner">
      
      <div class="upload-zone-icon">
        ${svg('folder',48)}
      </div>

      <div class="upload-zone-text">คลิกหรือลากไฟล์มาวางที่นี่</div>
      <div class="upload-zone-hint">PDF, DOCX, PNG, JPG สูงสุด 10 MB</div>

    </div>
  </div>
`);

html.push('<input type="file" id="finp" class="hidden" multiple accept=".pdf,.doc,.docx,.png,.jpg">');
html.push('<div id="fprog"></div></div></div>');
  // Action buttons
  html.push('<div class="flex gap-2.5 justify-end mt-1">');
  html.push('<button class="btn btn-soft" data-action="saveDraft">'+svg('save',14)+' บันทึกร่าง</button>');
  html.push('<button class="btn btn-primary" id="fsub" data-action="saveSend">'+svg('sign',14)+' ส่งเข้าขั้นตอนอนุมัติ</button>');
  html.push('</div></div>'); // close left col

  // Right col
  html.push('<div>');
  if(!editId){
    html.push('<div class="card"><div class="card-head">'+svg('users',15)+'<span class="card-head-title">ผู้ดำเนินการตามลำดับ</span></div>');
    html.push('<div class="card-body">');
    html.push('<div class="al al-in text-xs mb-3"><span class="al-icon">'+svg('info',13)+'</span><span>เลือกผู้ที่ต้องอนุมัติ / ตรวจสอบเอกสารตามลำดับ</span></div>');
    html.push('<div class="flex gap-[7px] mb-2.5">');
    html.push('<select class="fi flex-1 text-[13px]" id="wfadd">'+wfPersonOpts+'</select>');
    html.push('<button class="btn btn-primary sm" data-action="addWfPerson">'+svg('plus',12)+' เพิ่ม</button>');
    html.push('</div>');
    html.push('<div id="wfwrap"></div>');
    html.push('</div></div>');
  }
  html.push('<div class="card"><div class="card-head">'+svg('bell',15)+'<span class="card-head-title">การแจ้งเตือน</span></div>');
  html.push('<div class="card-body flex flex-col gap-[11px]">');
  var _ns=doc&&doc.notify_step===false?'':'checked';
  var _no=doc&&doc.notify_overdue===false?'':'checked';
  html.push('<label class="flex items-center gap-[9px] cursor-pointer text-[13px] text-[#6b6560]"><input type="checkbox" id="fnotifystep" '+_ns+' class="accent-[#E83A00] w-[15px] h-[15px]"> แจ้งเตือนผู้รับผิดชอบแต่ละขั้นตอนทางอีเมล</label>');
  html.push('<label class="flex items-center gap-[9px] cursor-pointer text-[13px] text-[#6b6560]"><input type="checkbox" id="fnotifyoverdue" '+_no+' class="accent-[#E83A00] w-[15px] h-[15px]"> แจ้งเตือนเมื่อเกินกำหนดส่ง</label>');
  html.push('</div></div>');
  var _staffOpts='<option value="">— ส่งคืนผู้จัดทำเอกสาร (ค่าเริ่มต้น) —</option>'+(FU||[]).filter(function(u){return u.id!==CU.id}).map(function(u){
    return '<option value="'+u.id+'"'+(doc.final_recipient_id===u.id?' selected':'')+'>'+esc(u.full_name)+' ('+RTH[u.role_code]+')</option>'
  }).join('');
  html.push('<div class="card"><div class="card-head">'+svg('sign',15)+'<span class="card-head-title">ผู้รับเอกสารเมื่อเสร็จสิ้น</span></div>');
  html.push('<div class="card-body">');
  html.push('<div class="al al-in text-xs mb-3"><span class="al-icon">'+svg('info',13)+'</span><span>เมื่อทุกขั้นตอนอนุมัติครบ ระบบจะส่งเอกสารกลับให้บุคคลนี้ พร้อมแจ้งเตือนทางอีเมล</span></div>');
  html.push('<div class="fg"><label class="fl">ส่งเอกสารเสร็จสิ้นถึง</label><select class="fi" id="ffinalrec">'+_staffOpts+'</select></div>');
  html.push('<div class="fg"><label class="fl">หมายเหตุเพิ่มเติม</label><input class="fi" id="ffinalnote" value="'+esc(doc.final_recipient_note||'')+'" placeholder="เช่น สำหรับเก็บเข้าแฟ้ม / นำเสนออาจารย์ที่ปรึกษา"></div>');
  html.push('</div></div>'); // close final recipient card-body + card
  html.push('</div>'); // close right col
  html.push('</div>'); // close two-col
  html.push('</div>'); // close form-rest

  setTimeout(function(){attachFormEvents();calcDeadline()}, 100);
  return html.join('')
}

/* ─── TYPE-SPECIFIC FIELDS ─── */
function renderTypeFields(type, doc){
  var cfg=DTYPE_CFG[type]||DTYPE_CFG.outgoing;
  var html=[];

  if(cfg.showFrom){
    html.push('<div class="fg"><label class="fl">'+esc(cfg.fromLabel)+' <span class="req">*</span></label>');
    html.push('<input class="fi" id="ffromdept" value="'+esc((doc&&doc.from_department)||CU.department||'')+'" placeholder="เช่น ฝ่ายวิชาการ, กนค."></div>');
  } else {
    html.push('<input type="hidden" id="ffromdept" value="'+esc((doc&&doc.from_department)||CU.department||'')+'">');
  }

  if(cfg.showTo){
    html.push('<div class="fg"><label class="fl">'+esc(cfg.toLabel)+' <span class="req">*</span></label>');
    html.push('<input class="fi" id="fto" value="'+esc((doc&&doc.addressed_to)||'')+'" placeholder="ระบุผู้รับเอกสาร"></div>');
  } else {
    html.push('<input type="hidden" id="fto" value="'+esc((doc&&doc.addressed_to)||'')+'">');
  }

  if(cfg.showRef){
    html.push('<div class="fg"><label class="fl">'+esc(cfg.refLabel)+'</label>');
    html.push('<input class="fi" id="fsubject" value="'+esc((doc&&doc.subject_line)||'')+'" placeholder="—"></div>');
  } else {
    html.push('<input type="hidden" id="fsubject" value="'+esc((doc&&doc.subject_line)||'')+'">');
  }

  if(cfg.showDocDate){
    html.push('<div class="fg"><label class="fl">'+esc(cfg.docDateLabel)+'</label>');
    html.push('<input type="date" class="fi" id="fdate" value="'+((doc&&doc.doc_date)||new Date().toISOString().slice(0,10))+'"></div>');
  } else {
    html.push('<input type="hidden" id="fdate" value="'+new Date().toISOString().slice(0,10)+'">');
  }

  html.push('<div class="fg"><label class="fl">'+esc(cfg.eventLabel)+(cfg.eventRequired?' <span class="req">*</span>':'')+'</label>');
  html.push('<input type="date" class="fi" id="feventdate" value="'+((doc&&doc.due_date)||'')+'" oninput="calcDeadline()"></div>');
  html.push('<div id="deadline-info"></div>');

  html.push('<div class="fg"><label class="fl">รายละเอียดเพิ่มเติม</label>');
  html.push('<textarea class="fi" id="fdsc" rows="3" placeholder="รายละเอียด...">'+esc((doc&&doc.description)||'')+'</textarea></div>');

  return html.join('')
}

/* เมื่อเลือกประเภทเอกสาร (dropdown) */
function selectDocType(type){
  if(!type) return;
  // อัปเดต hidden input + sync dropdown
  var fi=$e('ftype'); if(fi) fi.value=type;
  var sel=$e('ftype-sel'); if(sel) sel.value=type;
  // ซ่อน hint, โชว์ฟอร์ม
  var hint=$e('ftype-hint'); if(hint) hint.style.display='none';
  var fr=$e('form-rest');
  if(fr){
    fr.style.display='block';
    var tf=$e('dtype-fields');
    if(tf){
      var curDoc={from_department:gv('ffromdept'),addressed_to:gv('fto'),subject_line:gv('fsubject'),doc_date:gv('fdate'),due_date:gv('feventdate'),description:gv('fdsc')};
      tf.innerHTML=renderTypeFields(type,curDoc);
    }
    var ww=$e('wfwrap'); if(ww) ww.innerHTML=rWfPeople();
    calcDeadline();
    attachFormEvents();
  }
}

function onTypeChange(){
  var type=gv('ftype');
  var tf=$e('dtype-fields');
  if(!tf) return;
  var curDoc={from_department:gv('ffromdept'),addressed_to:gv('fto'),subject_line:gv('fsubject'),doc_date:gv('fdate'),due_date:gv('feventdate'),description:gv('fdsc')};
  tf.innerHTML=renderTypeFields(type,curDoc);
  calcDeadline()
}

function calcDeadline(){
  var ev=gv('feventdate'), di=$e('deadline-info');
  if(!di) return;
  if(!ev){di.innerHTML='';return}
  var totalDays=FS.reduce(function(s,step){return s+(step.deadline_days||1)},0);
  var eventDate=new Date(ev+' 00:00:00');
  var startBy=new Date(ev+' 00:00:00');
  startBy.setDate(startBy.getDate()-totalDays);
  var today=new Date(); today.setHours(0,0,0,0);
  var daysLeft=Math.ceil((startBy-today)/86400000);
  var eventStr=eventDate.toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'2-digit'});
  var startStr=startBy.toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'2-digit'});
  var msg='';
  if(totalDays===0){di.innerHTML='';return}
  if(startBy<today){
    var overDays=Math.abs(daysLeft);
    msg='<div class="al al-er mb-2"><span class="al-icon">'+svg('warn',13)+'</span><span>'+
      '<strong>เกินระยะเวลาที่ดำเนินการได้!</strong><br>'+
      'กิจกรรม/Deadline วันที่ '+eventStr+' — ต้องการ <strong>'+totalDays+' วัน</strong> ดำเนินการ<br>'+
      'ควรเริ่มตั้งแต่ '+startStr+' (เลยกำหนดมาแล้ว '+overDays+' วัน)'+
      '</span></div>';
  } else if(daysLeft<=3){
    msg='<div class="al al-wa mb-2"><span class="al-icon">'+svg('warn',13)+'</span><span>'+
      'กิจกรรม/Deadline วันที่ '+eventStr+' — ต้องการ <strong>'+totalDays+' วัน</strong><br>'+
      '<strong>ใกล้ถึงกำหนด!</strong> ควรเริ่มดำเนินการภายในวันที่ '+startStr+' (อีก '+daysLeft+' วัน)'+
      '</span></div>';
  } else {
    msg='<div class="al al-ok mb-2"><span class="al-icon">'+svg('ok',13)+'</span><span>'+
      'กิจกรรม/Deadline วันที่ '+eventStr+' — ต้องการ <strong>'+totalDays+' วัน</strong> ดำเนินการ<br>'+
      'ควรเริ่มดำเนินการภายในวันที่ '+startStr+' (อีก '+daysLeft+' วัน)'+
      '</span></div>';
  }
  di.innerHTML=msg
}

function buildFileList(files, docId){
  if(!files||!files.length) return '';
  return files.map(function(f,i){
    var isImg=f.file_type&&f.file_type.includes('image');
    return '<div class="file-item">' +
      '<span class="file-icon">'+(isImg?svg('img2',18):svg('doc',18))+'</span>' +
      '<div class="file-info"><div class="file-name">'+esc(f.file_name)+'</div><div class="file-meta">'+fsz(f.file_size)+' · v'+f.version+'</div></div>' +
      '<div class="file-actions">' +
      '<button class="btn btn-ghost xs" data-action="openViewer" data-url="'+furl(f.file_path)+'" data-name="'+esc(f.file_name)+'">'+svg('eye',12)+' ดู</button>' +
      (docId?'<button class="btn btn-soft xs" data-action="openEditor" data-url="'+furl(f.file_path)+'" data-name="'+esc(f.file_name)+'" data-fid="'+f.id+'" data-did="'+docId+'">'+svg('edit',12)+' แก้ไข</button>':'')+
      '<button class="btn btn-danger xs btn-icon" data-action="delFF" data-id="'+f.id+'" data-idx="'+i+'">'+svg('trash',12)+'</button>' +
      '</div></div>'
  }).join('')
}

function attachFormEvents(){
  var fz=$e('fzone');
  if(fz){
    fz.onclick=function(){$e('finp')&&$e('finp').click()};
    fz.ondragover=function(e){e.preventDefault();fz.classList.add('drag')};
    fz.ondragleave=function(){fz.classList.remove('drag')};
    fz.ondrop=function(e){e.preventDefault();fz.classList.remove('drag');doUp(Array.from(e.dataTransfer.files))}
  }
  var fi=$e('finp');
  if(fi) fi.onchange=function(){doUp(Array.from(fi.files))}
}

/* ─── DOC NUMBER GENERATOR ─── */
async function genDocNumber(){
  var thYear=new Date().getFullYear()+543;
  var orgPrefix='GNK';
  try{
    var cfg=await dg('doc_number_settings','?year=eq.'+thYear+'&select=prefix&limit=1');
    if(cfg&&cfg.length&&cfg[0].prefix) orgPrefix=cfg[0].prefix;
  }catch(e){}
  var prefix=orgPrefix+'-'+thYear+'-';
  try{
    var docs=await dg('documents','?select=doc_number&order=doc_number.desc');
    var maxSeq=0;
    (docs||[]).forEach(function(d){
      if(d.doc_number&&d.doc_number.startsWith(prefix)){
        var seq=parseInt(d.doc_number.replace(prefix,''))||0;
        if(seq>maxSeq) maxSeq=seq;
      }
    });
    return prefix+String(maxSeq+1).padStart(3,'0')
  }catch(e){return prefix+'001'}
}

async function saveDoc(status){
  var a=$e('fal'), title=gv('ftit').trim();
  if(!title){a.innerHTML=alrtH('er','กรุณาระบุชื่อเรื่องเอกสาร');return}
  var btn=$e('fsub');
  if(btn){btn.disabled=true;btn.innerHTML='<span class="sp"></span> กำลังบันทึก...'}
  try{
    var fromdept=gv('ffromdept').trim()||CU.department||'';
    var subj=gv('fsubject').trim();
    var addrto=gv('fto').trim();
    var finalRec=gv('ffinalrec')||null;
    var finalNote=gv('ffinalnote')||null;
    var eventDate=gv('feventdate')||null;
    var _ns=$e('fnotifystep'); var _no=$e('fnotifyoverdue');
    var body={title:title,doc_type:gv('ftype'),urgency:gv('furg'),description:gv('fdsc'),doc_date:gv('fdate')||new Date().toISOString().slice(0,10),due_date:eventDate,from_department:fromdept,addressed_to:addrto,subject_line:subj||title,final_recipient_id:finalRec,final_recipient_note:finalNote,status:status,notify_step:_ns?_ns.checked:true,notify_overdue:_no?_no.checked:true};
    if(FDI){
      await dpa('documents',FDI,Object.assign({},body,{updated_at:new Date().toISOString()}));
      if(status==='pending'){
        var _wfRej=await dg('workflow_steps','?document_id=eq.'+FDI+'&status=eq.rejected&order=step_number&limit=1');
        if(_wfRej.length) await dpa('workflow_steps',_wfRej[0].id,{status:'active',action_taken:null,note:null,revision_section:null,action_at:null,completed_at:null});
      }
      await dp('document_history',{document_id:FDI,action:'แก้ไขเอกสาร',performed_by:CU.id});
      a.innerHTML=alrtH('ok','บันทึกเรียบร้อยแล้ว');
      setTimeout(function(){nav('det',FDI)},900)
    } else {
      var docNum=await genDocNumber();
      var now=new Date().toISOString();
      var autoSkip=status==='pending';
      var finalStatus=autoSkip&&FS.length===1?'completed':status;
      var initStep=autoSkip?Math.min(2,FS.length):1;
      var res=await dp('documents',Object.assign({},body,{status:finalStatus,created_by:CU.id,current_step:initStep,total_steps:FS.length,doc_number:docNum}));
      var did=Array.isArray(res)?res[0].id:res.id;
      if(!did) throw new Error('ไม่สามารถสร้างเอกสารได้');
      try{
        for(var i=0;i<FS.length;i++){
          var stepSt=autoSkip?(i===0?'done':i===1?'active':'pending'):(i===0?'active':'pending');
          var stepExtra=autoSkip&&i===0?{action_taken:'approve',completed_at:now,note:'ผู้จัดทำส่งเอกสาร'}:{};
          await dp('workflow_steps',Object.assign({},FS[i],stepExtra,{document_id:did,step_number:i+1,status:stepSt}));
        }
        for(var j=0;j<PF.length;j++) await dp('document_files',Object.assign({},PF[j],{document_id:did}));
      }catch(stepErr){
        try{await dd('documents',did);}catch(e){}
        throw new Error('สร้าง workflow ไม่สำเร็จ: '+stepErr.message);
      }
      PF=[];
      await dp('document_history',{document_id:did,action:'สร้างเอกสาร',performed_by:CU.id});
      // Notify first assignee
      if(status==='pending'){try{await sendNotifEmail(did,'create','pending','');}catch(e2){}}
      a.innerHTML=alrtH('ok','สร้างเอกสารเรียบร้อยแล้ว');
      setTimeout(function(){nav('det',did)},900)
    }
  } catch(e){
    a.innerHTML=alrtH('er','เกิดข้อผิดพลาด: '+e.message);
    if(btn){btn.disabled=false;btn.innerHTML=svg('sign',14)+' ส่งเข้าขั้นตอนอนุมัติ'}
  }
}


