/* ─── DOC FORM ─── */
/* [UX] flag ติดตามว่า user เริ่มกรอกฟอร์มแล้วหรือยัง */
var _formDirty=false;

async function vForm(editId){
  _saveBusy=false; // reset ทุกครั้งที่ render form ใหม่
  var doc={title:'',doc_type:'outgoing',urgency:'normal',description:'',doc_date:new Date().toISOString().slice(0,10),due_date:''};
  FS=[{step_name:'ผู้จัดทำ',role_required:'ROLE-CRT',assigned_to:CU.id,deadline_days:1}];
  FF=[]; FDI=editId||null; PF=[];
  if(editId){
    var rs=await Promise.all([dg('documents','?id=eq.'+editId),dg('workflow_steps','?document_id=eq.'+editId+'&order=step_number'),dg('document_files','?document_id=eq.'+editId+'&order=uploaded_at')]);
    if(rs[0][0]) Object.assign(doc,rs[0][0]);
    if(rs[1].length) FS=rs[1];
    FF=rs[2]
  }
  FU=await dg('user_directory','?is_active=eq.true&approval_status=eq.approved&order=full_name');
  // GNK-PRE auto-add จัดการใน selectDocType() ตามประเภทเอกสาร

  var tOpts=Object.entries(DTYPES).map(function(e){
    var cfg=DTYPE_CFG[e[0]]||{};
    return '<option value="'+e[0]+'"'+(doc.doc_type===e[0]?' selected':'')+'>'+e[1]+'</option>'
  }).join('');
  var uOpts=Object.entries(URG).map(function(e){return '<option value="'+e[0]+'"'+(doc.urgency===e[0]?' selected':'')+'>'+e[1]+'</option>'}).join('');
  /* [UX] จัดกลุ่ม dropdown workflow ตาม role ลดความสับสน */
  var _wfGroups=[
    {role:'ROLE-SGN', label:'ผู้ลงนาม'},
    {role:'ROLE-REV', label:'ผู้ตรวจทาน'},
    {role:'ROLE-ADV', label:'อาจารย์กิจการ'},
    {role:'ROLE-STF', label:'เจ้าหน้าที่'},
    {role:'ROLE-CRT', label:'ผู้จัดทำ'}
  ];
  var _wfFiltered=(FU||[]).filter(function(u){return u.id!==CU.id&&u.role_code!=='ROLE-SYS'});
  var wfPersonOpts='<option value="">— เลือกผู้ดำเนินการ —</option>';
  _wfGroups.forEach(function(g){
    var members=_wfFiltered.filter(function(u){return u.role_code===g.role});
    if(!members.length) return;
    wfPersonOpts+='<optgroup label="'+g.label+'">';
    members.forEach(function(u){
      wfPersonOpts+='<option value="'+u.id+'">'+esc(u.full_name)+'</option>';
    });
    wfPersonOpts+='</optgroup>';
  });

  var _ico=function(i,bg,cl){return '<div style="width:26px;height:26px;border-radius:7px;background:'+bg+';display:flex;align-items:center;justify-content:center;color:'+cl+'">'+svg(i,13)+'</div>'};

  var html=[
    '<div class="flex items-center gap-2.5 mb-[18px]">',
    '<button class="btn btn-soft sm" data-action="nav" data-view="docs">'+svg('back',13)+' ย้อนกลับ</button>',
    '<span class="text-[#a89e99] text-[13px]">'+(editId?'แก้ไขเอกสาร':'สร้างเอกสารใหม่')+'</span>',
    '</div>',
    '<div id="fal"></div>'
  ];

  // ── Step 1: เลือกประเภทเอกสาร — Dropdown ──
  // SYS, STF, ADV เห็นทุกประเภท; ROLE-CRT เห็นเฉพาะ incoming/outgoing
  var _extRoles=['ROLE-SYS','ROLE-STF','ROLE-ADV'];
  var _VISIBLE_TYPES=_extRoles.includes(CU.role_code)?Object.keys(DTYPES):['incoming','outgoing'];
  var dtOpts='<option value="">— กรุณาเลือกประเภทเอกสาร —</option>'+Object.entries(DTYPES).filter(function(e){return _VISIBLE_TYPES.includes(e[0])}).map(function(e){
    return '<option value="'+e[0]+'"'+(editId&&doc.doc_type===e[0]?' selected':'')+'>'+e[1]+'</option>';
  }).join('');
  html.push('<div class="card" style="margin-bottom:16px"><div class="card-head">'+_ico('doc','#FFF3EE','#E83A00')+'<span class="card-head-title">ประเภทเอกสาร <span class="req">*</span></span></div><div class="card-body">');
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
  html.push('<div class="card"><div class="card-head">'+_ico('doc','#FFF3EE','#E83A00')+'<span class="card-head-title">ข้อมูลเอกสาร</span></div><div class="card-body">');
  html.push('<div class="fg"><label class="fl">ความเร่งด่วน</label><select class="fi" id="furg">'+uOpts+'</select></div>');
  html.push('<div class="fg"><label class="fl">ชื่อเรื่อง / หัวข้อ <span class="req">*</span></label><input class="fi" id="ftit" value="'+esc(doc.title||'')+'" placeholder="ระบุชื่อเรื่องเอกสาร"></div>');
  html.push('<div id="dtype-fields">'+(editId?renderTypeFields(doc.doc_type||'outgoing',doc):'')+'</div>');
  html.push('</div></div>');

// Files card
html.push('<div class="card"><div class="card-head">'+_ico('folder','#FFF3EE','#E83A00')+'<span class="card-head-title">ไฟล์เอกสาร</span></div><div class="card-body">');

html.push('<div id="fflist">'+buildFileList(FF, editId||'')+'</div>');

html.push(`
  <div class="upload-zone" id="fzone">
    <div class="upload-zone-inner">
      
      <div class="upload-zone-icon">
        ${svg('folder',48)}
      </div>

      <div class="upload-zone-text">คลิกหรือลากไฟล์มาวางที่นี่</div>
      <div class="upload-zone-hint">PDF, DOCX, PNG, JPG สูงสุด ${SETT.max_file_size_mb||10} MB</div>

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
    html.push('<div class="card" id="wf-card"><div class="card-head">'+_ico('user','#FFF3EE','#E83A00')+'<span class="card-head-title">ผู้ดำเนินการตามลำดับ</span></div>');
    html.push('<div class="card-body">');
    html.push('<div class="al al-in text-xs mb-3"><span class="al-icon">'+svg('info',13)+'</span><span>เลือกผู้ที่ต้องอนุมัติ / ตรวจสอบเอกสารตามลำดับ</span></div>');
    html.push('<div class="flex gap-[7px] mb-2.5">');
    html.push('<select class="fi flex-1 text-[13px]" id="wfadd">'+wfPersonOpts+'</select>');
    html.push('<button class="btn btn-primary sm" data-action="addWfPerson">'+svg('plus',12)+' เพิ่ม</button>');
    html.push('</div>');
    html.push('<div id="wfwrap"></div>');
    html.push('</div></div>');
  }
  // Info card สำหรับขาออก (ซ่อนสำหรับประเภทอื่น)
  html.push('<div class="card" id="out-info-card" style="display:none;border:1.5px solid #D1FAE5;background:#F0FDF4">');
  html.push('<div class="card-body py-3">');
  html.push('<div class="flex items-start gap-2.5"><div class="w-8 h-8 rounded-lg bg-[#DCFCE7] flex items-center justify-center shrink-0 text-[#16A34A]">'+svg('up',16)+'</div>');
  html.push('<div><div class="text-[12px] font-bold text-[#15803D] mb-1">ไม่มีขั้นตอนอนุมัติ — รอออกเลขหนังสือ</div>');
  html.push('<div class="text-[11px] text-[#166534] leading-[1.7]">หนังสือขาออกไม่ต้องผ่านขั้นตอนอนุมัติ แต่หลังกด "อัปโหลดและแชร์ไฟล์" ผู้จัดทำต้องกด "ออกเลขหนังสือ" อีกครั้งเพื่อกำหนดเลขที่และเผยแพร่ให้ผู้รับดาวน์โหลด</div>');
  html.push('</div></div></div></div>');

  html.push('<div class="card" id="notif-card"><div class="card-head">'+_ico('bell','#FFF3EE','#E83A00')+'<span class="card-head-title">การแจ้งเตือน</span></div>');
  html.push('<div class="card-body flex flex-col gap-[11px]">');
  var _ns=doc&&doc.notify_step===false?'':'checked';
  var _no=doc&&doc.notify_overdue===false?'':'checked';
  html.push('<label class="flex items-center gap-[9px] cursor-pointer text-[13px] text-[#6b6560]"><input type="checkbox" id="fnotifystep" '+_ns+' class="accent-[#E83A00] w-[15px] h-[15px]"> แจ้งเตือนผู้รับผิดชอบแต่ละขั้นตอนทางอีเมล</label>');
  html.push('<label class="flex items-center gap-[9px] cursor-pointer text-[13px] text-[#6b6560]"><input type="checkbox" id="fnotifyoverdue" '+_no+' class="accent-[#E83A00] w-[15px] h-[15px]"> แจ้งเตือนเมื่อเกินกำหนดส่ง</label>');
  html.push('</div></div>');
  var _staffOpts='<option value="">— ส่งคืนผู้จัดทำเอกสาร (ค่าเริ่มต้น) —</option>'+(FU||[]).filter(function(u){return u.id!==CU.id}).map(function(u){
    return '<option value="'+u.id+'"'+(doc.final_recipient_id===u.id?' selected':'')+'>'+esc(u.full_name)+' ('+RTH[u.role_code]+')</option>'
  }).join('');
  html.push('<div class="card" id="final-card"><div class="card-head">'+_ico('sign','#FFF3EE','#E83A00')+
    '<span class="card-head-title" id="final-card-title">ผู้รับเอกสารเมื่อเสร็จสิ้น</span></div>');
  html.push('<div class="card-body">');
  html.push('<div class="al al-in text-xs mb-3"><span class="al-icon">'+svg('info',13)+'</span>'+
    '<span id="final-card-desc">เมื่อทุกขั้นตอนอนุมัติครบ ระบบจะส่งเอกสารกลับให้บุคคลนี้ พร้อมแจ้งเตือนทางอีเมล</span></div>');
  html.push('<div class="fg"><label class="fl">ส่งไฟล์ให้ดาวน์โหลด</label><select class="fi" id="ffinalrec">'+_staffOpts+'</select></div>');
  html.push('<div class="fg"><label class="fl">หมายเหตุ</label><input class="fi" id="ffinalnote" value="'+esc(doc.final_recipient_note||'')+'" placeholder="เช่น สำหรับเก็บเข้าแฟ้ม / ส่งอาจารย์ที่ปรึกษา"></div>');
  html.push('</div></div>'); // close final recipient card-body + card
  html.push('</div>'); // close right col
  html.push('</div>'); // close two-col
  html.push('</div>'); // close form-rest

  /* [UX] ตั้ง unsaved changes flag — เตือนก่อน navigate ออกจากฟอร์มที่กรอกค้างไว้ */
  setTimeout(function(){
    attachFormEvents();
    calcDeadline();
    _formDirty=false;
    // ติด listener ทุก input/select/textarea ในฟอร์ม
    document.querySelectorAll('#form-rest input,#form-rest select,#form-rest textarea').forEach(function(el){
      el.addEventListener('input',function(){_formDirty=true},{once:false});
      el.addEventListener('change',function(){_formDirty=true},{once:false});
    });
  }, 100);
  return html.join('')
}

/* ─── TYPE-SPECIFIC FIELDS ─── */
function renderTypeFields(type, doc){
  var cfg=DTYPE_CFG[type]||DTYPE_CFG.outgoing||{};
  var html=[];

  /* ── หนังสือขาออก: อัปโหลดและแขวนไฟล์ให้ดาวน์โหลด ──  */
  if(type==='outgoing'){
    var _curDesc2=(doc&&doc.description)||'';
    var _curTo2=(doc&&doc.addressed_to)||'';
    var _curDate2=(doc&&doc.doc_date)||new Date().toISOString().slice(0,10);
    var _curEv2=(doc&&doc.due_date)||'';
    var _curLt2=(doc&&doc.subject_line)||'';
    var _curClub2=(doc&&doc.from_department)||'';

    // 1. ชมรม — เลือกก่อน เพื่อ auto-filter โครงการ
    var _clubOpts='<option value="">— กนค. (ไม่ใช่ชมรม) —</option>'+Object.keys(CLUBS).map(function(code){
      return '<option value="'+code+'"'+(_curClub2===code?' selected':'')+'>'+esc(CLUBS[code])+'</option>';
    }).join('');

    // 2. ประเภทจดหมาย
    var _lt2Opts='<option value="">— กรุณาเลือกประเภท —</option>'+OUT_LTYPES.slice(1).map(function(l,i){
      var code=String(i+1);
      return '<option value="'+code+'"'+(_curLt2===code?' selected':'')+'>'+esc(l)+'</option>';
    }).join('');

    // 3. ตำแหน่งผู้รับ
    var _posOpts='<option value="">— เลือกตำแหน่งที่ส่งถึง —</option>'+POSS.map(function(p){
      return '<option value="'+esc(p)+'"'+(_curTo2===p?' selected':'')+'>'+esc(PTH[p]||p)+'</option>'
    }).join('');

    // layout: ชมรม → โครงการ → ประเภท → ผู้รับ → วันที่
    html.push(
      '<div class="al al-in" style="margin-bottom:14px"><span class="al-icon">'+svg('up',13)+'</span>'+
      '<span class="text-[12px]">เอกสารขาออกไม่ต้องผ่านขั้นตอนอนุมัติ — หลังบันทึกแล้วผู้จัดทำต้องกด "ออกเลขหนังสือ" เพื่อกำหนดเลขที่ก่อนเผยแพร่ให้ดาวน์โหลด</span></div>'
    );
    html.push('<div class="fg"><label class="fl">สังกัด / ชมรม</label>'+
      '<select class="fi" id="fclub" onchange="_populateProjectList(this.value);_PROJ_FILTER_CLUB=this.value">'+_clubOpts+'</select></div>');
    html.push('<div class="fg"><label class="fl">โครงการ / กิจกรรม <span class="req">*</span></label>');
    var _projInList=PROJS.some(function(p){return p.name===_curDesc2});
    var _projOpts='<option value="">— กรุณาเลือกโครงการ —</option>';
    _projOpts+=PROJS.map(function(p){
      return '<option value="'+esc(p.name)+'"'+(_curDesc2===p.name?' selected':'')+'>'+esc(p.name)+'</option>';
    }).join('');
    _projOpts+='<option value="__other__"'+(!_projInList&&_curDesc2?' selected':'')+'>อื่น ๆ (ระบุเอง)</option>';
    html.push('<select class="fi" id="fdsc-sel" onchange="_onProjSelChange(this.value)">'+_projOpts+'</select>');
    var _showOther=!_projInList&&_curDesc2;
    html.push('<input class="fi" id="fdsc" style="margin-top:8px;display:'+(_showOther?'block':'none')+'" value="'+esc(_curDesc2)+'" placeholder="ระบุชื่อโครงการ / กิจกรรม">');
    html.push('</div>');
    html.push('<div class="fg"><label class="fl">ประเภทจดหมาย <span class="req">*</span></label><select class="fi" id="foutltype">'+_lt2Opts+'</select></div>');
    html.push('<div class="fg"><label class="fl">ส่งถึงตำแหน่ง <span class="req">*</span></label><select class="fi" id="fto">'+_posOpts+'</select></div>');
    html.push('<div class="two-col-sm"><div class="fg"><label class="fl">วันที่หนังสือ</label><input type="date" class="fi" id="fdate" value="'+esc(_curDate2)+'"></div>');
    html.push('<div class="fg"><label class="fl">วันที่กิจกรรม / ต้องใช้เอกสาร</label><input type="date" class="fi" id="feventdate" value="'+esc(_curEv2)+'" oninput="calcDeadline()"></div></div>');
    html.push('<div id="deadline-info"></div>');
    html.push('<input type="hidden" id="ffromdept" value=""><input type="hidden" id="fsubject" value="">');
    return html.join('');
  }

  /* ── หนังสือขาเข้า: custom layout ── */
  if(type==='incoming'){
    var _curDesc=(doc&&doc.description)||'';
    var _curFrom=(doc&&doc.from_department)||'';
    var _curTo=(doc&&doc.addressed_to)||'';
    var _curSubj=(doc&&doc.subject_line)||'';
    var _curDate=(doc&&doc.doc_date)||new Date().toISOString().slice(0,10);
    var _curEv=(doc&&doc.due_date)||'';
    var _ltOpts='<option value="">— เลือกประเภทหนังสือ —</option>'+LETTER_TYPES.map(function(t){
      return '<option value="'+esc(t)+'"'+(_curDesc===t?' selected':'')+'>'+esc(t)+'</option>'
    }).join('');
    var _spGnk=SENDER_POS.filter(function(p){return !p.isClub&&parseInt(p.code,10)<=14;});
    var _spDept=SENDER_POS.filter(function(p){return !p.isClub&&parseInt(p.code,10)>=15;});
    var _spClub=SENDER_POS.filter(function(p){return p.isClub;});
    var _spGrp=function(label,arr){
      if(!arr.length) return '';
      return '<optgroup label="'+label+'">'+arr.map(function(p){
        return '<option value="'+esc(p.name)+'"'+(_curTo===p.name?' selected':'')+'>'+esc(p.name)+'</option>';
      }).join('')+'</optgroup>';
    };
    var _spOpts='<option value="">— เลือกตำแหน่ง / สังกัด —</option>'+
      _spGrp('กนค.',_spGnk)+_spGrp('แผนก',_spDept)+_spGrp('ชมรม',_spClub);
    html.push('<div class="fg"><label class="fl">ประเภทหนังสือ <span class="req">*</span></label><select class="fi" id="fdsc">'+_ltOpts+'</select></div>');
    html.push('<div class="fg"><label class="fl">ชื่อผู้ส่งเอกสาร <span class="req">*</span></label><input class="fi" id="ffromdept" value="'+esc(_curFrom)+'" placeholder="ระบุชื่อผู้ส่งหรือหน่วยงาน"></div>');
    html.push('<div class="fg"><label class="fl">ตำแหน่ง / สังกัด</label><select class="fi" id="fto">'+_spOpts+'</select></div>');
    html.push('<input type="hidden" id="fsubject" value="'+esc(_curSubj)+'">');
    html.push('<div class="fg"><label class="fl">วันที่รับเอกสาร</label><input type="date" class="fi" id="fdate" value="'+esc(_curDate)+'"></div>');
    html.push('<div class="fg"><label class="fl">วันที่ต้องดำเนินการเสร็จ</label><input type="date" class="fi" id="feventdate" value="'+esc(_curEv)+'" oninput="calcDeadline()"></div>');
    html.push('<div id="deadline-info"></div>');
    return html.join('');
  }

  var _colToId={from_department:'ffromdept',addressed_to:'fto',subject_line:'fsubject',doc_date:'fdate',description:'fdsc'};
  var _colToVal={
    from_department:(doc&&doc.from_department)||CU.department||'',
    addressed_to:(doc&&doc.addressed_to)||'',
    subject_line:(doc&&doc.subject_line)||'',
    doc_date:(doc&&doc.doc_date)||new Date().toISOString().slice(0,10),
    description:(doc&&doc.description)||''
  };

  if(cfg.fields&&cfg.fields.length){
    var shownCols={};
    cfg.fields.forEach(function(f){
      var fid=_colToId[f.db_column]||f.db_column;
      var val=_colToVal[f.db_column]||'';
      shownCols[f.db_column]=true;
      if(f.field_type==='date'){
        html.push('<div class="fg"><label class="fl">'+esc(f.label)+(f.required?' <span class="req">*</span>':'')+'</label>');
        html.push('<input type="date" class="fi" id="'+fid+'" value="'+esc(val||new Date().toISOString().slice(0,10))+'"></div>');
      }else if(f.field_type==='textarea'){
        html.push('<div class="fg"><label class="fl">'+esc(f.label)+(f.required?' <span class="req">*</span>':'')+'</label>');
        html.push('<textarea class="fi" id="'+fid+'" rows="3" placeholder="'+esc(f.placeholder||'')+'">'+esc(val)+'</textarea></div>');
      }else{
        html.push('<div class="fg"><label class="fl">'+esc(f.label)+(f.required?' <span class="req">*</span>':'')+'</label>');
        html.push('<input class="fi" id="'+fid+'" value="'+esc(val)+'" placeholder="'+esc(f.placeholder||'')+'"></div>');
      }
    });
    Object.keys(_colToId).forEach(function(col){
      if(!shownCols[col]) html.push('<input type="hidden" id="'+_colToId[col]+'" value="'+esc(_colToVal[col])+'">');
    });
  }else{
    // Legacy fallback
    if(cfg.showFrom){
      html.push('<div class="fg"><label class="fl">'+esc(cfg.fromLabel)+' <span class="req">*</span></label>');
      html.push('<input class="fi" id="ffromdept" value="'+esc(_colToVal.from_department)+'" placeholder="เช่น ฝ่ายวิชาการ, กนค."></div>');
    }else{html.push('<input type="hidden" id="ffromdept" value="'+esc(_colToVal.from_department)+'">');}
    if(cfg.showTo){
      html.push('<div class="fg"><label class="fl">'+esc(cfg.toLabel)+' <span class="req">*</span></label>');
      html.push('<input class="fi" id="fto" value="'+esc(_colToVal.addressed_to)+'" placeholder="ระบุผู้รับเอกสาร"></div>');
    }else{html.push('<input type="hidden" id="fto" value="'+esc(_colToVal.addressed_to)+'">');}
    if(cfg.showRef){
      html.push('<div class="fg"><label class="fl">'+esc(cfg.refLabel)+'</label>');
      html.push('<input class="fi" id="fsubject" value="'+esc(_colToVal.subject_line)+'" placeholder="—"></div>');
    }else{html.push('<input type="hidden" id="fsubject" value="'+esc(_colToVal.subject_line)+'">');}
    if(cfg.showDocDate){
      html.push('<div class="fg"><label class="fl">'+esc(cfg.docDateLabel)+'</label>');
      html.push('<input type="date" class="fi" id="fdate" value="'+esc(_colToVal.doc_date)+'"></div>');
    }else{html.push('<input type="hidden" id="fdate" value="'+esc(_colToVal.doc_date)+'">');}
    html.push('<div class="fg"><label class="fl">รายละเอียดเพิ่มเติม</label>');
    html.push('<textarea class="fi" id="fdsc" rows="3" placeholder="รายละเอียด...">'+esc(_colToVal.description)+'</textarea></div>');
  }

  if(cfg.enableDeadline!==false){
    html.push('<div class="fg"><label class="fl">'+esc(cfg.eventLabel||'วันกำหนดส่ง')+(cfg.eventRequired?' <span class="req">*</span>':'')+'</label>');
    html.push('<input type="date" class="fi" id="feventdate" value="'+esc((doc&&doc.due_date)||'')+'" oninput="calcDeadline()"></div>');
  }else{
    html.push('<input type="hidden" id="feventdate" value="'+esc((doc&&doc.due_date)||'')+'">');
  }
  html.push('<div id="deadline-info"></div>');

  return html.join('')
}

/* เมื่อเลือกประเภทเอกสาร (dropdown) */
function selectDocType(type){
  if(!type) return;
  var fi=$e('ftype'); if(fi) fi.value=type;
  var sel=$e('ftype-sel'); if(sel) sel.value=type;
  var hint=$e('ftype-hint'); if(hint) hint.style.display='none';
  var fr=$e('form-rest');
  if(fr){
    /* [UX] animate form reveal แทน pop ทันที */
    fr.style.display='block';
    fr.style.opacity='0';
    fr.style.transform='translateY(8px)';
    requestAnimationFrame(function(){
      fr.style.transition='opacity .22s ease,transform .22s ease';
      fr.style.opacity='1';
      fr.style.transform='translateY(0)';
    });
    var tf=$e('dtype-fields');
    if(tf){
      var curDoc={from_department:gv('ffromdept'),addressed_to:gv('fto'),subject_line:gv('fsubject'),doc_date:gv('fdate'),due_date:gv('feventdate'),description:gv('fdsc')};
      tf.innerHTML=renderTypeFields(type,curDoc);
    }
    // GNK-PRE (หัวหน้านิสิต) ลงนามทุกเอกสาร — เพิ่ม locked step เฉพาะขาเข้า (ขาออกไม่ต้องผ่าน workflow)
    // ยกเว้น: ROLE-STF และ ROLE-SYS ออกเลขเองได้โดยไม่ต้องรอ GNK-PRE
    FS=FS.filter(function(s){return !s.locked});
    var _staffBypass=CU.role_code==='ROLE-STF'||CU.role_code==='ROLE-SYS';
    if(type==='incoming'&&!_staffBypass){
      var _pre=(FU||[]).find(function(u){return u.position_code==='GNK-PRE'&&u.id!==CU.id});
      if(_pre) FS.push({step_name:PTH['GNK-PRE']||'หัวหน้านิสิต',role_required:'ROLE-SGN',assigned_to:_pre.id,deadline_days:2,locked:true});
    }
    var wfc=$e('wf-card');
    var fsub=$e('fsub');
    var _notifCard=$e('notif-card');
    var _finalCard=$e('final-card');
    var _outInfoCard=$e('out-info-card');
    if(type==='outgoing'){
      if(wfc) wfc.style.display='none';
      if(_notifCard) _notifCard.style.display='none';
      if(_outInfoCard) _outInfoCard.style.display='';
      if(_finalCard) _finalCard.style.display='';
      if(fsub) fsub.innerHTML=svg('up',14)+' อัปโหลดและแชร์ไฟล์';
    }else{
      if(wfc) wfc.style.display='';
      if(_notifCard) _notifCard.style.display='';
      if(_outInfoCard) _outInfoCard.style.display='none';
      if(_finalCard) _finalCard.style.display='';
      if(fsub) fsub.innerHTML=svg('sign',14)+' ส่งเข้าขั้นตอนอนุมัติ';
    }
    var ww=$e('wfwrap'); if(ww) ww.innerHTML=rWfPeople();
    if(type==='outgoing'){_PROJ_FILTER_CLUB='';_populateProjectList();}
    else _applyWfTemplate(type);
    calcDeadline();
    attachFormEvents();
  }
}

/* โหลด Workflow Template default สำหรับประเภทเอกสารที่เลือก (ถ้ามี) */
async function _applyWfTemplate(docType){
  try{
    var tmpls=await dg('workflow_templates','?doc_type=eq.'+encodeURIComponent(docType)+'&is_default=eq.true&limit=1');
    if(!tmpls||!tmpls.length) return;
    var tmpl=tmpls[0];
    var steps=await dg('workflow_template_steps','?template_id=eq.'+tmpl.id+'&order=step_number');
    if(!steps||!steps.length) return;
    // เก็บ step แรก (ผู้จัดทำ) ไว้, เพิ่ม template steps ถัดไป
    var creatorStep=FS.find(function(s){return s.step_name==='ผู้จัดทำ'||s.assigned_to===CU.id})||FS[0]||{step_name:'ผู้จัดทำ',role_required:'ROLE-CRT',assigned_to:CU.id,deadline_days:1};
    FS=[creatorStep];
    steps.forEach(function(s){
      FS.push({step_name:s.step_name,role_required:s.role_required||'',assigned_to:s.assigned_to||null,deadline_days:s.deadline_days||2,locked:!!s.locked});
    });
    var ww=$e('wfwrap'); if(ww) ww.innerHTML=rWfPeople();
    showAlert('โหลด Template "'+esc(tmpl.name)+'" แล้ว','ok');
  }catch(e){}
}

function _onProjSelChange(val){
  var inp=$e('fdsc');
  if(!inp) return;
  if(val==='__other__'){
    inp.style.display='block';
    inp.value='';
    inp.focus();
  } else {
    inp.style.display='none';
    inp.value=val;
  }
}

function _getProjValue(){
  var sel=$e('fdsc-sel');
  var inp=$e('fdsc');
  if(!sel) return (inp?inp.value:'');
  if(sel.value==='__other__') return inp?inp.value.trim():'';
  return sel.value;
}

var _PROJ_FILTER_CLUB=''; // club code ที่เลือกอยู่ใน outgoing form
async function _populateProjectList(clubCode){
  if(clubCode!==undefined) _PROJ_FILTER_CLUB=clubCode||'';
  try{
    var q='?doc_type=eq.outgoing&select=description,from_department&not.description=is.null&order=created_at.desc&limit=400';
    if(_PROJ_FILTER_CLUB) q='?doc_type=eq.outgoing&from_department=eq.'+encodeURIComponent(_PROJ_FILTER_CLUB)+'&select=description&not.description=is.null&order=created_at.desc&limit=200';
    var rows=await dg('documents',q);
    var projs=[...new Set(rows.map(function(r){return r.description}).filter(Boolean))];
    var dl=$e('project-list');
    if(dl) dl.innerHTML=projs.map(function(p){return '<option value="'+esc(p)+'"></option>'}).join('');
  }catch(e){}
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
  var type=gv('ftype')||'outgoing';
  var cfg=DTYPE_CFG[type]||{};
  if(cfg.enableDeadline===false){di.innerHTML='';return}
  var totalDays=FS.reduce(function(s,step){return s+(step.deadline_days||1)},0)+(cfg.minDays||0);
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
      '<button style="display:inline-flex;align-items:center;gap:4px;height:28px;padding:0 10px;border-radius:8px;border:2px solid #3b82f6;background:#eff6ff;color:#3b82f6;font-size:11px;font-weight:600;cursor:pointer" data-action="openViewer" data-url="'+furl(f.file_path)+'" data-name="'+esc(f.file_name)+'">'+svg('eye',12)+' ดู</button>' +
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
    fz.ondrop=function(e){e.preventDefault();fz.classList.remove('drag');_formDirty=true;doUp(Array.from(e.dataTransfer.files))}
  }
  var fi=$e('finp');
  if(fi) fi.onchange=function(){_formDirty=true;doUp(Array.from(fi.files))}
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

async function genOutDocNumber(){
  var thYear=new Date().getFullYear()+543;
  var startSeq=1, orgPrefix='กนค.';
  try{
    var cfg=await dg('doc_number_settings','?year=eq.'+thYear+'&select=out_start_seq,out_prefix&limit=1');
    if(cfg&&cfg.length){
      if(cfg[0].out_start_seq) startSeq=cfg[0].out_start_seq;
      if(cfg[0].out_prefix) orgPrefix=cfg[0].out_prefix;
    }
  }catch(e){}
  var prefix=orgPrefix+thYear+'.';
  try{
    var docs=await dg('documents','?doc_type=eq.outgoing&doc_number=not.is.null&select=doc_number&order=doc_number.desc');
    var maxSeq=0;
    (docs||[]).forEach(function(d){
      if(d.doc_number&&d.doc_number.startsWith(prefix)){
        var seq=parseInt(d.doc_number.replace(prefix,''))||0;
        if(seq>maxSeq) maxSeq=seq;
      }
    });
    return prefix+String(Math.max(maxSeq+1,startSeq)).padStart(2,'0')
  }catch(e){return prefix+String(startSeq).padStart(2,'0')}
}

/* [UX] เรียกก่อน navigate ออกจากฟอร์ม — คืน true ถ้าไปได้, false ถ้า user ยกเลิก */
function confirmLeaveForm(onLeave){
  if(!_formDirty){onLeave();return;}
  showConfirm(
    'ออกจากฟอร์ม?',
    'ข้อมูลที่กรอกไว้จะหายหมด ยืนยันออกจากหน้านี้หรือไม่',
    function(){_formDirty=false;onLeave();},
    {confirmLabel:'ออก ไม่บันทึก',confirmClass:'btn-danger',cancelLabel:'อยู่ต่อ',icon:'warn',iconBg:'#FEF3C7',iconColor:'#D97706'}
  );
}

var _saveBusy=false;
async function saveDoc(status){
  if(_saveBusy)return;
  var a=$e('fal'), title=gv('ftit').trim();
  if(!title){a.innerHTML=alrtH('er','กรุณาระบุชื่อเรื่องเอกสาร');return}
  var _dtype=gv('ftype'), _dcfg=DTYPE_CFG[_dtype]||{};
  if(_dcfg.fields&&_dcfg.fields.length){
    var _fmap={from_department:'ffromdept',addressed_to:'fto',subject_line:'fsubject',doc_date:'fdate',description:'fdsc'};
    for(var _fi=0;_fi<_dcfg.fields.length;_fi++){
      var _rf=_dcfg.fields[_fi];
      if(_dtype==='outgoing'&&_rf.db_column==='from_department') continue;
      if(_rf.required&&!( gv(_fmap[_rf.db_column]||_rf.db_column)||'' ).trim()){
        a.innerHTML=alrtH('er','กรุณากรอก: '+_rf.label);return;
      }
    }
  }
  if(_dtype==='incoming'){
    if(!(gv('fdsc')||'').trim()){a.innerHTML=alrtH('er','กรุณาเลือกประเภทหนังสือ');return}
    if(!(gv('ffromdept')||'').trim()){a.innerHTML=alrtH('er','กรุณาระบุชื่อผู้ส่งเอกสาร');return}
  }
  if(_dtype==='outgoing'&&status!=='draft'){
    if(!_getProjValue()){a.innerHTML=alrtH('er','กรุณาระบุชื่อโครงการ / กิจกรรม');return}
    if(!(gv('fto')||'').trim()){a.innerHTML=alrtH('er','กรุณาเลือกตำแหน่งกนค. ที่รับเอกสาร');return}
  }
  _saveBusy=true;
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
    var _outLt=(_dtype==='outgoing')?(gv('foutltype')||''):'';
    var _outClub=(_dtype==='outgoing')?(gv('fclub')||''):'';
    var body={title:title,doc_type:gv('ftype'),urgency:gv('furg'),description:(_dtype==='outgoing'?_getProjValue():gv('fdsc')),doc_date:gv('fdate')||new Date().toISOString().slice(0,10),due_date:eventDate,from_department:_dtype==='outgoing'?_outClub:fromdept,addressed_to:addrto,subject_line:_dtype==='outgoing'?_outLt:(subj||title),final_recipient_id:finalRec,final_recipient_note:finalNote,status:status,notify_step:_ns?_ns.checked:true,notify_overdue:_no?_no.checked:true};
    if(FDI){
  await dpa('documents',FDI,Object.assign({},body,{updated_at:new Date().toISOString()}));
  if(status==='pending'){
    var _wfRej=await dg('workflow_steps','?document_id=eq.'+FDI+'&status=eq.rejected&order=step_number&limit=1');
    if(_wfRej.length) await dpa('workflow_steps',_wfRej[0].id,{status:'active',action_taken:null,note:null,revision_section:null,action_at:null,completed_at:null,deadline_datetime:null,deadline_days:null});
  }
  await dp('document_history',{document_id:FDI,action:'แก้ไขเอกสาร',performed_by:CU.id});
  a.innerHTML=alrtH('ok','บันทึกเรียบร้อยแล้ว');
  setTimeout(function(){nav('det',FDI)},900)

    } else {
      var docNum=(_dtype==='outgoing')?await genOutDocNumber():await genDocNumber();
      var finalStatus=status;
      var res=await dp('documents',Object.assign({},body,{status:finalStatus,created_by:CU.id,current_step:1,total_steps:FS.length,doc_number:docNum}));
      if(!Array.isArray(res)||!res[0]||!res[0].id){
        console.error('saveDoc dp error:',res);
        throw new Error('ไม่สามารถสร้างเอกสารได้ กรุณาลองใหม่');
      }
      var did=res[0].id;
      try{
        var _now=new Date().toISOString();
        for(var i=0;i<FS.length;i++){
          var stepSt,extraSt={};
          if(finalStatus==='pending'&&i===0){
            stepSt='done';extraSt={action_taken:'approve',action_at:_now,completed_at:_now};
          }else if(finalStatus==='pending'&&i===1){
            stepSt='active';
          }else{
            stepSt=i===0?'active':'pending';
          }
          await dp('workflow_steps',Object.assign({},FS[i],extraSt,{document_id:did,step_number:i+1,status:stepSt}));
        }
        if(finalStatus==='pending'){
          await dp('document_history',{document_id:did,action:'ผู้จัดทำยืนยันเอกสาร (อัตโนมัติ)',performed_by:CU.id});
          if(FS.length===1){
            // ทั้งขาเข้าและขาออกที่มี step เดียว (ผู้จัดทำ) ไปรอออกเลขหนังสือเสมอ — ไม่ข้ามไป completed
            var _autoSt=['incoming','outgoing'].indexOf(_dtype)>=0?'numbering':'completed';
            await dpa('documents',did,{status:_autoSt,current_step:1});
            finalStatus=_autoSt;
          }else{
            await dpa('documents',did,{current_step:2});
          }
        }
        for(var j=0;j<PF.length;j++) await dp('document_files',Object.assign({},PF[j],{document_id:did}));
      }catch(stepErr){
        try{await dd('documents',did);}catch(e){}
        throw new Error('สร้าง workflow ไม่สำเร็จ: '+stepErr.message);
      }
      PF=[];
      await dp('document_history',{document_id:did,action:'สร้างเอกสาร',performed_by:CU.id});
      // Notify
      if(_dtype==='outgoing'&&finalStatus==='numbering'){
        // แจ้งเตือนตำแหน่งกนค. ที่รับเอกสาร — แจ้งทันทีที่ส่ง ไม่ต้องรอออกเลขหนังสือ
        try{
          var _posCode=body.addressed_to;
          var _posUser=(FU||[]).find(function(u){return u.position_code===_posCode&&u.id!==CU.id});
          if(_posUser){
            var _posEmail=_posUser.contact_email||_posUser.email;
            if(_posEmail&&!_posEmail.includes('@gnk.student')){
              var _eSubj=(SETT.email_prefix||'[กนค.]')+' หนังสือขาออก: '+title;
              var _eBody='เรียน '+_posUser.full_name+', มีเอกสารขาออกสำหรับท่าน เรื่อง "'+title+'" โครงการ '+body.description;
              var _er=await fetch(SU+'/functions/v1/send-email',{method:'POST',headers:{'Content-Type':'application/json','Authorization':H.Authorization,'apikey':SK},body:JSON.stringify({to:_posEmail,subject:_eSubj,html:_eBody})});
              if(_er.ok&&typeof showEmailToast==='function') showEmailToast(_posEmail,_eSubj);
              await dp('notifications',{document_id:did,recipient_id:_posUser.id,recipient_email:_posEmail,subject:_eSubj,body:_eBody,notification_type:'outgoing',status:_er.ok?'sent':'failed',sent_at:new Date().toISOString()});
            }
          }
        }catch(ne){console.warn('Outgoing notify failed:',ne)}
      } else if(finalStatus==='pending'){
        try{await sendNotifEmail(did,'create','pending','');}catch(e2){}
      }
      a.innerHTML=alrtH('ok',_dtype==='outgoing'?'อัพโหลดเอกสารและส่งเรียบร้อยแล้ว':'สร้างเอกสารเรียบร้อยแล้ว');
      var _successMsg=finalStatus==='pending'?'ส่งเอกสารเข้าระบบเรียบร้อยแล้ว รอการอนุมัติตามขั้นตอน':
                      finalStatus==='numbering'?'อัพโหลดและส่งเรียบร้อยแล้ว รอออกเลขที่หนังสือ':
                      finalStatus==='completed'?'อัพโหลดและส่งเรียบร้อยแล้ว เอกสารถูกบันทึกในระบบ':
                      'บันทึกร่างเรียบร้อยแล้ว';
      setTimeout(function(){
        nav('det',did).then(function(){
          showAlert(_successMsg,'ok');
        }).catch(function(){});
      },600)
    }
  } catch(e){
    _saveBusy=false;
    a.innerHTML=alrtH('er','เกิดข้อผิดพลาด: '+e.message);
    if(btn){btn.disabled=false;btn.innerHTML=_dtype==='outgoing'?svg('up',14)+' อัพโหลดและส่งเอกสาร':svg('sign',14)+' ส่งเข้าขั้นตอนอนุมัติ'}
  }
}


