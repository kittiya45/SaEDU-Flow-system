/* ─── การเสนอเอกสารเพื่อ "รับทราบ" (document_acks) ───
   ใช้กับหนังสือขาเข้าเป็นหลัก (สลับ 2026-07-22: incoming = ฟอร์มง่าย ไม่มีขั้นตอนอนุมัติ)
   เดิมพอออกเลขขาเข้าเสร็จ ระบบส่งอีเมลออกไปแล้วจบ ไม่มีใครรู้ว่ามีคนอ่านหรือยัง
   ตอนนี้: ผู้จัดทำ/เจ้าหน้าที่ "เสนอ" รายชื่อ → เจ้าตัวกดรับทราบ + ลงลายเซ็นรับทราบลงบน PDF

   ต้องโหลดหลัง docSign.js — ใช้ state/ฟังก์ชันวางตำแหน่งลายเซ็นชุดเดียวกัน
   (_actSigMarks, initActSig, _loadSigPosPreview, getActSigSrc ฯลฯ)

   ⚠️ fail-open: ถ้ายังไม่ได้รัน supabase/43_incoming_receive_no_and_ack.sql
   dg() จะคืน error object แทน array — ทุกจุดจะซ่อน UI ส่วนนี้ไปเฉย ๆ ไม่ทำให้หน้าอื่นพัง */

var _ACK_DEFAULT_POS=['GNK-SEC','GNK-PRE']; // เลขานุการ + หัวหน้านิสิต — คู่ที่ต้องรับทราบเกือบทุกใบ
var _ackBusy=false;
var _ackHasPdf=false;   // เอกสารนี้มี PDF ให้ลงลายเซ็นรับทราบหรือไม่ (ตั้งใน showAckModal)
var _ackAllUsers=[];    // แคชรายชื่อในโมดัลเสนอ ใช้ตอนกรองค้นหา

/* อ่านรายชื่อผู้ถูกเสนอของเอกสารหนึ่ง — คืน null ถ้าตารางยังไม่มี (ไม่ใช่ [] เพื่อแยกจาก "ยังไม่มีใคร") */
async function loadDocAcks(docId){
  try{
    var r=await dg('document_acks','?document_id=eq.'+safeId(docId)+'&order=created_at');
    return Array.isArray(r)?r:null;
  }catch(e){return null}
}

/* ใครเสนอเอกสารให้คนอื่นรับทราบได้ — ผู้จัดทำ หรือ เจ้าหน้าที่/แอดมิน/dev
   จำกัดไว้ที่หนังสือขาเข้า เพราะขาออกมีสายอนุมัติของตัวเองอยู่แล้ว */
function canProposeAck(doc){
  if(!doc||doc.doc_type!=='incoming'||doc.status==='cancelled') return false;
  return doc.created_by===CU.id||['ROLE-STF','ROLE-SYS','ROLE-DEV'].includes(CU.role_code);
}

/* ── การ์ด "การรับทราบ" ในหน้ารายละเอียด ──
   uMap = แผนที่ id → user_directory row ที่ vDet โหลดมาแล้ว */
function _rAckCard(docId,doc,acks,uMap){
  if(!acks) return '';                                   // ตารางยังไม่ถูกสร้าง
  var canProp=canProposeAck(doc);
  if(!acks.length&&!canProp) return '';
  uMap=uMap||{};
  var done=acks.filter(function(a){return a.status==='acked'}).length;
  var mine=acks.filter(function(a){return a.user_id===CU.id})[0];
  var _ico='<div style="width:26px;height:26px;border-radius:7px;background:#FFF3EE;display:flex;align-items:center;justify-content:center;color:#E83A00">'+svg('eye',13)+'</div>';

  var h=['<div class="card"><div class="card-head">'+_ico+'<span class="card-head-title">การรับทราบเอกสาร</span>'+
    (acks.length?'<span class="ml-auto text-[11px] text-[#a89e99]">'+done+'/'+acks.length+' คน</span>':'')+
    '</div><div class="card-body">'];

  // แถบเรียกให้เจ้าตัวลงมือ
  if(mine&&mine.status!=='acked'){
    h.push('<div class="al al-wa" style="margin-bottom:12px;align-items:flex-start"><span class="al-icon">'+svg('bell',13)+'</span>'+
      '<span style="line-height:1.7"><strong>เอกสารนี้เสนอให้คุณรับทราบ</strong>'+
      (mine.note?'<div style="margin-top:3px">"'+esc(mine.note)+'"</div>':'')+
      '<div style="margin-top:6px"><button class="btn btn-primary sm" data-action="showAckModal" data-id="'+docId+'">'+svg('pen',13)+' รับทราบเอกสาร</button></div>'+
      '</span></div>');
  } else if(mine){
    h.push('<div class="al al-ok" style="margin-bottom:12px"><span class="al-icon">'+svg('ok',13)+'</span>'+
      '<span>คุณรับทราบเอกสารนี้แล้ว'+(mine.acked_at?' เมื่อ '+fdTime(mine.acked_at):'')+'</span></div>');
  }

  if(acks.length){
    h.push('<div class="timeline" style="margin-top:2px">');
    acks.forEach(function(a,i){
      var u=uMap[a.user_id]||{};
      var ok=a.status==='acked';
      var last=i===acks.length-1;
      var _pos=u.position_code?(PTH[u.position_code]||u.position_code):'';
      h.push('<div class="tl-item">');
      h.push('<div class="tl-spine"><div class="tl-dot '+(ok?'tl-dot-done':'tl-dot-wait')+'">'+(ok?svg('ok',11):svg('clock',11))+'</div>'+
        (!last?'<div class="tl-line '+(ok?'tl-line-done':'tl-line-wait')+'"></div>':'')+'</div>');
      h.push('<div class="tl-body"><div class="tl-title">'+esc(u.full_name||'—')+'</div>');
      if(_pos) h.push('<div class="tl-sub">'+esc(_pos)+'</div>');
      if(ok){
        h.push('<div class="tl-time text-[#16A34A]">'+svg('ok',11)+' รับทราบแล้ว'+(a.acked_at?' · '+fdTime(a.acked_at):'')+
          (a.signed?' · ลงลายเซ็นในเอกสารแล้ว':'')+'</div>');
        if(a.note) h.push('<div class="tl-note">"'+esc(a.note)+'"</div>');
      }else{
        h.push('<div class="tl-time text-[#D97706]">'+svg('clock',11)+' ยังไม่รับทราบ'+
          (canProp?' <button class="btn btn-soft xs" data-action="rmAckRow" data-id="'+a.id+'" data-docid="'+docId+'" style="margin-left:6px">ถอนรายชื่อ</button>':'')+'</div>');
      }
      h.push('</div></div>');
    });
    h.push('</div>');
  }else{
    h.push('<p class="text-[#a89e99] text-[13px]" style="margin-bottom:10px">ยังไม่ได้เสนอเอกสารนี้ให้ใครรับทราบ</p>');
  }

  if(canProp){
    h.push('<button class="btn btn-soft sm" data-action="showAckProposeModal" data-id="'+docId+'" style="margin-top:10px">'+
      svg('plus',13)+' เสนอให้รับทราบ</button>');
  }
  h.push('</div></div>');
  return h.join('');
}

/* ── โมดัล: เลือกคนที่ต้องรับทราบ ── */
async function showAckProposeModal(docId){
  var w=$e('mwrap'); if(!w)return;
  w.innerHTML='<div class="mo"><div class="modal"><div class="modal-body text-center py-10"><div class="sp sp-dark w-8 h-8 border-[3px] mx-auto"></div><p class="mt-4 text-[#a89e99]">กำลังโหลดรายชื่อ...</p></div></div></div>';
  var doc=(await dg('documents','?id=eq.'+safeId(docId)))[0]||{};
  var users=await dg('user_directory','?is_active=eq.true&approval_status=eq.approved&select=id,full_name,position_code,role_code,department&order=full_name');
  if(!Array.isArray(users)) users=[];
  var acks=await loadDocAcks(docId);
  if(!acks){
    w.innerHTML='';
    showAlert('ยังใช้งานส่วน "การรับทราบ" ไม่ได้ — ผู้ดูแลระบบต้องรันสคริปต์ supabase/43_incoming_receive_no_and_ack.sql ก่อน','wa');
    return;
  }
  var already={}; acks.forEach(function(a){already[a.user_id]=true});
  // ผู้จัดทำไม่ต้องเสนอให้ตัวเอง และคนที่ถูกเสนอไปแล้วไม่ต้องแสดงซ้ำ
  var pool=users.filter(function(u){return !already[u.id]&&u.id!==doc.created_by});
  _ackAllUsers=pool;

  var _row=function(u,checked){
    var pos=u.position_code?(PTH[u.position_code]||u.position_code):(RTH[u.role_code]||'');
    var search=(u.full_name||'')+' '+pos+' '+(u.department||'');
    return '<label class="ack-pick" data-s="'+esc(search)+'" style="display:flex;align-items:center;gap:10px;padding:9px 10px;border:1px solid #EBEBEB;border-radius:10px;margin-bottom:6px;cursor:pointer;background:#fff">'+
      '<input type="checkbox" class="ack-cb" value="'+u.id+'"'+(checked?' checked':'')+'>'+
      '<span style="flex:1;min-width:0"><span style="font-size:13px;font-weight:600;color:#18120E">'+esc(u.full_name||'')+'</span>'+
      (pos?'<span style="display:block;font-size:11px;color:#a89e99;margin-top:2px">'+esc(pos)+(u.department?' · '+esc(u.department):'')+'</span>':'')+
      '</span></label>';
  };
  var sug=pool.filter(function(u){return _ACK_DEFAULT_POS.indexOf(u.position_code)>=0});
  var rest=pool.filter(function(u){return _ACK_DEFAULT_POS.indexOf(u.position_code)<0});

  w.innerHTML=[
    '<div class="mo"><div class="modal" style="max-width:560px">',
    '<div class="modal-head"><span class="modal-title">'+svg('eye',14)+' เสนอเอกสารเพื่อรับทราบ</span>',
    '<button class="btn btn-soft sm btn-icon" data-action="closeModal">'+svg('x',14)+'</button></div>',
    '<div class="modal-body">',
    '<div class="al al-in" style="margin-bottom:12px;align-items:flex-start"><span class="al-icon">'+svg('info',13)+'</span>',
    '<span style="font-size:12px;line-height:1.7">ผู้ที่เลือกไว้จะได้รับอีเมล/LINE แจ้งทันที และเห็นปุ่ม <strong>รับทราบเอกสาร</strong> ในหน้านี้ ระบบจะบันทึกว่าใครรับทราบแล้วเมื่อไร</span></div>',
    (pool.length?'':'<p class="text-[#a89e99] text-[13px]">ไม่มีรายชื่อให้เสนอเพิ่มแล้ว</p>'),
    (pool.length?'<input class="fi" id="ack-search" placeholder="ค้นหาชื่อ / ตำแหน่ง" oninput="_ackFilterList(this.value)" style="margin-bottom:10px">':''),
    (sug.length?'<div class="fl" style="margin-bottom:6px">แนะนำ (เลือกไว้ให้แล้ว)</div>'+sug.map(function(u){return _row(u,true)}).join(''):''),
    (rest.length?'<div class="fl" style="margin:12px 0 6px">รายชื่ออื่น</div><div style="max-height:230px;overflow-y:auto;padding-right:2px">'+rest.map(function(u){return _row(u,false)}).join('')+'</div>':''),
    '<div class="fg" style="margin-top:12px"><label class="fl">ข้อความถึงผู้รับทราบ (ถ้ามี)</label>',
    '<textarea class="fi" id="ack-note" rows="2" placeholder="เช่น โปรดพิจารณาและลงนามรับทราบภายในสัปดาห์นี้"></textarea></div>',
    '</div>',
    '<div class="modal-foot">',
    '<button class="btn btn-soft" data-action="closeModal">ยกเลิก</button>',
    (pool.length?'<button class="btn btn-primary" data-action="doAckPropose" data-id="'+docId+'">'+svg('ok',13)+' เสนอและแจ้งเตือน</button>':''),
    '</div></div></div>'
  ].join('');
}

function _ackFilterList(q){
  q=(q||'').trim().toLowerCase();
  document.querySelectorAll('#mwrap .ack-pick').forEach(function(el){
    var s=(el.dataset.s||'').toLowerCase();
    el.style.display=(!q||s.indexOf(q)>=0)?'':'none';
  });
}

async function doAckPropose(docId){
  if(_ackBusy)return; _ackBusy=true;
  var ids=[],note=gv('ack-note')||'';
  document.querySelectorAll('#mwrap .ack-cb').forEach(function(cb){if(cb.checked)ids.push(cb.value)});
  if(!ids.length){showAlert('กรุณาเลือกผู้ที่ต้องรับทราบอย่างน้อย 1 คน','wa');_ackBusy=false;return}
  var w=$e('mwrap');
  if(w) w.innerHTML='<div class="mo"><div class="modal"><div class="modal-body text-center py-10"><div class="sp sp-dark w-8 h-8 border-[3px] mx-auto"></div><p class="mt-4 text-[#a89e99]">กำลังบันทึกและแจ้งเตือน...</p></div></div></div>';
  try{
    var added=[];
    for(var i=0;i<ids.length;i++){
      try{
        await dp('document_acks',{document_id:docId,user_id:ids[i],status:'pending',note:note||null,requested_by:CU.id});
        added.push(ids[i]);
      }catch(e){console.warn('ack insert failed',ids[i],e)}
    }
    if(!added.length) throw new Error('บันทึกรายชื่อไม่สำเร็จ (สิทธิ์ไม่พอ หรือยังไม่ได้รันสคริปต์ SQL)');
    var us=await dg('user_directory','?id=in.('+added.map(safeId).join(',')+')&select=id,full_name,email,contact_email,position_code');
    if(!Array.isArray(us)) us=[];
    await dp('document_history',{document_id:docId,action:'เสนอเอกสารเพื่อรับทราบ: '+us.map(function(u){return u.full_name}).join(', '),performed_by:CU.id,note:note||null});
    try{ await _notifyAckRequested(docId,us,note); }catch(ne){console.warn('ack notify failed:',ne)}
    if(w) w.innerHTML='';
    var a=$e('dal'); if(a) a.innerHTML=alrtH('ok','เสนอเอกสารให้ <strong>'+added.length+' คน</strong> รับทราบแล้ว และแจ้งเตือนไปเรียบร้อย');
    _ackBusy=false;
    setTimeout(function(){nav('det',docId)},900);
  }catch(e){
    if(w) w.innerHTML='';
    _ackBusy=false;
    showAlert('เกิดข้อผิดพลาด: '+e.message,'er');
  }
}

/* ถอนรายชื่อที่ยังไม่ได้รับทราบ */
async function rmAckRow(ackId,docId){
  showConfirm('ถอนรายชื่อผู้รับทราบ','ผู้ที่ถูกถอนจะไม่เห็นปุ่มรับทราบอีก และรายชื่อจะหายจากการ์ดนี้',async function(){
    try{
      await dd('document_acks',ackId);
      await dp('document_history',{document_id:docId,action:'ถอนรายชื่อผู้รับทราบ',performed_by:CU.id});
      nav('det',docId);
    }catch(e){showAlert('ถอนรายชื่อไม่สำเร็จ: '+e.message,'er')}
  },{confirmLabel:'ถอนรายชื่อ',confirmClass:'btn-danger'});
}

/* ── โมดัลรับทราบ + ลงลายเซ็น ──
   ใช้ markup/ids ชุดเดียวกับโหมดอนุมัติใน docSign.js เพื่อ reuse ตัวเลือกลายเซ็น
   และตัววางตำแหน่งบน PDF ทั้งชุด (initActSig / _loadSigPosPreview / _actSigMarks) */
async function showAckModal(docId){
  var w=$e('mwrap'); if(!w)return;
  w.innerHTML='<div class="mo"><div class="modal"><div class="modal-body text-center py-10"><div class="sp sp-dark w-8 h-8 border-[3px] mx-auto"></div><p class="mt-4 text-[#a89e99]">กำลังเตรียมเอกสาร...</p></div></div></div>';
  var pdfs=await dg('document_files','?document_id=eq.'+safeId(docId)+'&file_type=like.application%2Fpdf');
  var sp=Array.isArray(pdfs)?_signPdfWorkingCopy(pdfs):null;
  _ackHasPdf=!!(sp&&sp.working);

  // reset state ลายเซ็นชุดเดียวกับ showActModal — ต้องล้างทุกครั้ง ไม่งั้นจุดวางของรอบก่อนค้าง
  _actSigMarks=[]; _actSigLastIdx=-1;
  _sigPreviewFailed=false;
  _actSigPgDims={}; _actSigDefW=null;
  _actSigPdf=null; _actSigPage=1; _actSigZoom=1.0;
  _actSigRenderGen++;
  _actSigColor='#1C1C1E'; _actSigSz=2;
  var sigColors=['#1C1C1E','#D32F2F','#1565C0','#1B5E20','#7B1FA2'];

  // เอกสารไม่มี PDF (เช่นแนบมาเป็น .docx/รูป) — รับทราบได้แต่ไม่มีที่ให้ลงลายเซ็น
  if(!_ackHasPdf){
    w.innerHTML=[
      '<div class="mo"><div class="modal" style="max-width:480px">',
      '<div class="modal-head"><span class="modal-title">'+svg('ok',14)+' ยืนยันการรับทราบ</span>',
      '<button class="btn btn-soft sm btn-icon" data-action="closeModal">'+svg('x',14)+'</button></div>',
      '<div class="modal-body">',
      '<div class="al al-wa" style="margin-bottom:12px;align-items:flex-start"><span class="al-icon">'+svg('warn',13)+'</span>',
      '<span style="line-height:1.7">เอกสารนี้ไม่มีไฟล์ PDF จึงลงลายเซ็นรับทราบบนเอกสารไม่ได้ — ระบบจะบันทึกเฉพาะว่าคุณรับทราบแล้ว</span></div>',
      '<div class="fg"><label class="fl">หมายเหตุ (ถ้ามี)</label>',
      '<textarea class="fi" id="anote" rows="2" placeholder="ความเห็น / ข้อสั่งการเพิ่มเติม"></textarea></div>',
      '</div>',
      '<div class="modal-foot">',
      '<button class="btn btn-soft" data-action="closeModal">ยกเลิก</button>',
      '<button class="btn btn-success" data-action="doAckConfirm" data-id="'+docId+'">'+svg('ok',13)+' ยืนยันรับทราบ</button>',
      '</div></div></div>'
    ].join('');
    return;
  }

  w.innerHTML=[
    '<div class="mo"><div class="modal sig-act-modal">',
    '<div class="modal-head">',
    '<span class="modal-title">'+svg('pen',14)+' ลงนามรับทราบเอกสาร</span>',
    '<button class="btn btn-soft sm btn-icon" data-action="closeModal">'+svg('x',14)+'</button>',
    '</div>',
    '<div class="modal-body sig-act-body">',

    '<div class="sig-act-side">',
    '<div class="al al-in" style="margin-bottom:12px;align-items:flex-start"><span class="al-icon">'+svg('info',13)+'</span>',
    '<span style="font-size:12px;line-height:1.7">ในกรอบที่วาง: <strong>ลายเซ็นอยู่ครึ่งบน</strong> ส่วนข้อความ “รับทราบ” ชื่อ และวันที่ อยู่ครึ่งล่าง — ลากกรอบให้ใหญ่พอทั้งสองส่วน</span></div>',

    '<div class="fg" style="margin-bottom:10px">',
    '<label class="fl">ลายเซ็น <span class="req">*</span></label>',
    '<div class="itabs mb-2"><button class="itab" id="sig-tab-c" onclick="sigTabA(\'saved\')" style="display:none">ใช้ที่บันทึกไว้</button><button class="itab on" id="sig-tab-a" onclick="sigTabA(\'draw\')" data-t="draw">วาดลายเซ็น</button><button class="itab" id="sig-tab-b" onclick="sigTabA(\'upload\')" data-t="upload">อัปโหลดรูป</button></div>',
    '<div id="sig-panel-saved" style="display:none">',
    '<div id="sig-saved-empty" style="font-size:12px;color:#a89e99;line-height:1.7;padding:12px;background:#FAFAF8;border-radius:10px;border:1px dashed #EBEBEB">ยังไม่มีลายเซ็นที่บันทึก — ไปที่เมนู <strong>ลายเซ็นของฉัน</strong> เพื่อบันทึกก่อน</div>',
    '<div id="sig-saved-preview" class="hidden" style="border:1px solid #EBEBEB;border-radius:12px;padding:14px;background:#fff;text-align:center">',
    '<img id="sig-saved-img" alt="ลายเซ็นที่บันทึก" style="max-height:100px;max-width:100%;object-fit:contain">',
    '<div style="font-size:10px;color:#a89e99;margin-top:8px">ลายเซ็นจากโปรไฟล์ของคุณ</div>',
    '</div></div>',
    '<div id="sig-panel-draw">',
    '<canvas id="asgc" class="border-[1.5px] border-[#EBEBEB] rounded-[10px] bg-white block w-full cursor-crosshair touch-none" height="110"></canvas>',
    '<button class="btn btn-soft sm mt-1.5 w-full" onclick="clearASig()">ล้างลายเซ็น</button>',
    '<div style="margin-top:10px"><div class="fl" style="margin-bottom:6px">สีหมึก</div>',
    '<div style="display:flex;gap:6px;flex-wrap:wrap">',
    sigColors.map(function(c,i){return '<div class="csw'+(i===0?' on':'')+'" style="width:24px;height:24px;border-radius:50%;cursor:pointer;border:2px solid '+(i===0?'var(--text)':'transparent')+';background:'+c+'" onclick="actSigColor(\''+c+'\',this)"></div>'}).join(''),
    '</div></div>',
    '<div class="fl" style="margin:10px 0 6px">ความหนาเส้น</div>',
    '<input type="range" id="asig-sz" min="1" max="8" value="2" oninput="_actSigSz=+this.value">',
    '</div>',
    '<div id="sig-panel-upload" class="hidden">',
    '<label for="asig-file" class="upload-zone" id="asig-drop-zone" style="min-height:104px;padding:14px;border-radius:12px">',
    '<div class="upload-zone-inner" style="gap:4px">',
    '<div class="upload-zone-icon" style="margin-bottom:0;opacity:.35;transform:scale(.85)">'+svg('pen',30)+'</div>',
    '<div class="upload-zone-text" style="font-size:12.5px">คลิกเพื่ออัปโหลดรูปลายเซ็น</div>',
    '<div class="upload-zone-hint">PNG พื้นหลังโปร่งใส แนะนำ</div>',
    '</div></label>',
    '<input type="file" id="asig-file" accept="image/*" class="hidden">',
    '<div id="asig-prev-wrap" class="hidden" style="margin-top:8px;display:flex;align-items:center;gap:10px;border:1px solid #EBEBEB;border-radius:12px;padding:10px;background:#fff">',
    '<img id="asig-prev" style="height:72px;max-width:150px;object-fit:contain">',
    '<button type="button" class="btn btn-soft sm" id="asig-change" style="margin-left:auto;flex-shrink:0">เปลี่ยนรูป</button>',
    '</div>',
    '</div></div>',

    '<div class="fg sig-place-card">',
    '<label class="fl" style="display:flex;align-items:center;gap:6px">ตำแหน่งลายเซ็นรับทราบ <span class="req">*</span>',
    '<span id="sig-mark-count" class="sig-mark-count">0 จุด</span></label>',
    '<div id="sig-target-file" class="sig-target-file"></div>',
    '<div id="sig-place-req" class="al al-wa al-sm" style="margin:0 0 10px"><span class="al-icon">'+svg('warn',12)+'</span>',
    '<span>คลิกบนเอกสารทางขวาเพื่อวางตำแหน่งก่อน จึงจะกดยืนยันรับทราบได้</span></div>',
    '<div class="sig-size-row">',
    '<span class="sig-size-lbl">ขนาดลายเซ็น</span>',
    '<input type="range" id="sig-size" min="6" max="50" value="30" style="flex:1;min-width:0" oninput="_sigSizeAll(+this.value)">',
    '<span id="sig-size-val" class="sig-size-val">30%</span>',
    '</div>',
    '<div id="sig-mark-list" class="sig-mark-list"></div>',
    '<button type="button" class="sig-copy-btn" id="sig-all-pages" style="display:none" onclick="_sigStampAllPages()">'+svg('copy',12)+' วางตำแหน่งเดียวกันทุกหน้า</button>',
    '</div>',

    '<div class="fg">',
    '<label class="fl">หมายเหตุ / ข้อสั่งการ <span class="sig-act-opt">(ถ้ามี)</span></label>',
    '<textarea class="fi" id="anote" rows="2" placeholder="ความเห็นเพิ่มเติม..."></textarea>',
    '</div>',

    '<div class="sig-act-hint">',
    svg('info',12)+'<span>คลิกบนเอกสารเพื่อวางลายเซ็น · ลากกรอบเพื่อย้าย · ลากมุมส้มปรับขนาด · กด <strong>×</strong> ที่มุมกรอบเพื่อลบจุดนั้น</span>',
    '</div>',
    '</div>',

    '<div class="sig-act-preview">',
    '<div id="sig-page-ctrl" class="sig-page-ctrl" style="display:none">',
      '<div id="sig-pg-nav" style="display:flex;align-items:center;gap:4px">',
      '<button id="sig-pg-prev" onclick="_sigPageNav(-1)" class="sig-tb-btn">'+svg('back',12)+'</button>',
      '<select id="sig-page-sel" onchange="_sigGoPage(+this.value)" title="เลือกหน้า" class="sig-tb-sel"><option>หน้า 1</option></select>',
      '<span id="sig-page-total" class="sig-tb-total">/ 1</span>',
      '<button id="sig-pg-next" onclick="_sigPageNav(1)" class="sig-tb-btn">'+svg('tri',12)+'</button>',
      '</div>',
      '<div class="sig-tb-zoom">',
      '<button onclick="_sigZoom(-0.25)" title="ซูมออก" class="sig-tb-btn">'+svg('zout',13)+'</button>',
      '<span id="sig-zoom-info" class="sig-tb-zoom-lbl">100%</span>',
      '<button onclick="_sigZoom(0.25)" title="ซูมเข้า" class="sig-tb-btn">'+svg('zin',13)+'</button>',
      '</div>',
    '</div>',
    '<div id="sig-scroll" onscroll="_sigScrollSync()" class="sig-scroll">',
    '<div id="sig-pos-wrap" class="sig-pos-wrap">',
    '<div class="sig-pos-loading">',
    '<span class="sp" style="border-color:rgba(255,255,255,.25);border-top-color:#fff;width:28px;height:28px;border-width:3px"></span>',
    '<span id="sig-pos-hint">กำลังโหลดเอกสาร...</span></div>',
    '</div></div>',
    '</div>',

    '</div>',
    '<div class="modal-foot">',
    '<button class="btn btn-soft" data-action="closeModal">ยกเลิก</button>',
    '<button class="btn btn-success" data-action="doAckConfirm" data-id="'+docId+'">'+svg('ok',13)+' ยืนยันรับทราบ</button>',
    '</div></div></div>'
  ].join('');

  setTimeout(function(){
    initActSig();
    _renderSigMarkList();
    _loadSavedSigForActModal().then(function(){_loadSigPosPreview(docId)});
  },80);
}

async function doAckConfirm(docId){
  if(_ackBusy)return; _ackBusy=true;
  var note=gv('anote')||'';
  var sigSrc=_ackHasPdf?getActSigSrc():null;
  if(_ackHasPdf){
    if(!sigSrc){showAlert('กรุณาวาดหรืออัปโหลดลายเซ็นก่อนยืนยัน','wa');_ackBusy=false;return}
    if(!window._actSigMarks||!_actSigMarks.length){
      showAlert(window._sigPreviewFailed
        ?'ยังลงนามไม่ได้: โหลดตัวอย่างเอกสารไม่สำเร็จจึงวางตำแหน่งลายเซ็นไม่ได้ กรุณารีเฟรชหน้าแล้วลองใหม่'
        :'กรุณาคลิกบนเอกสารเพื่อวางตำแหน่งลายเซ็นรับทราบก่อนยืนยัน','wa');
      _ackBusy=false;return;
    }
  }
  var marks=_ackHasPdf?_actSigMarks.slice():[];
  var w=$e('mwrap');
  if(w) w.innerHTML='<div class="mo"><div class="modal"><div class="modal-body text-center py-10"><div class="sp sp-dark w-8 h-8 border-[3px] mx-auto"></div><p class="mt-4 text-[#a89e99]">กำลังบันทึกการรับทราบ...</p></div></div></div>';
  try{
    var rows=await dg('document_acks','?document_id=eq.'+safeId(docId)+'&user_id=eq.'+safeId(CU.id));
    if(!Array.isArray(rows)||!rows.length) throw new Error('ไม่พบรายชื่อของคุณในรายการผู้รับทราบเอกสารนี้');
    var row=rows[0];
    if(row.status==='acked'){
      if(w) w.innerHTML='';
      _ackBusy=false;
      showAlert('คุณรับทราบเอกสารนี้ไปแล้ว','in');
      return;
    }

    // ฝังลายเซ็นก่อน แล้วค่อยบันทึกสถานะ — ถ้าฝังไม่สำเร็จยังบันทึกการรับทราบไว้ (signed=false)
    // และต้องแสดงข้อความให้ชัด ไม่ปล่อยเงียบเหมือนบั๊กเดิมของ doAct()
    var embedErr=null;
    if(_ackHasPdf&&sigSrc){
      var r=await _ackEmbedSig(docId,sigSrc,marks);
      if(!r.ok) embedErr=r.err;
    }

    await dpa('document_acks',row.id,{status:'acked',acked_at:new Date().toISOString(),note:note||row.note||null,signed:!embedErr&&_ackHasPdf});
    await dp('document_history',{document_id:docId,action:'รับทราบเอกสาร',performed_by:CU.id,note:note||null});
    if(embedErr){
      try{ await dp('document_history',{document_id:docId,action:'ฝังลายเซ็นรับทราบไม่สำเร็จ',performed_by:CU.id,note:embedErr}); }catch(_he){}
    }
    try{ await _notifyAcked(docId,note); }catch(ne){console.warn('ack-back notify failed:',ne)}

    if(w) w.innerHTML='';
    var a=$e('dal');
    if(embedErr){
      if(a) a.innerHTML=alrtH('wa','บันทึกการรับทราบแล้ว แต่<strong>ประทับลายเซ็นลงไฟล์ไม่สำเร็จ</strong>: '+esc(embedErr)+
        ' — กรุณาแจ้งผู้ดูแลระบบ (บันทึกไว้ในประวัติเอกสารแล้ว)');
      _ackBusy=false;
      return;
    }
    if(a) a.innerHTML=alrtH('ok','บันทึกการรับทราบเรียบร้อยแล้ว'+(_ackHasPdf?' และประทับลายเซ็นรับทราบลงเอกสารแล้ว':''));
    _ackBusy=false;
    setTimeout(function(){nav('det',docId)},1000);
  }catch(e){
    if(w) w.innerHTML='';
    _ackBusy=false;
    showAlert('เกิดข้อผิดพลาด: '+e.message,'er');
  }
}

/* ประทับลายเซ็นรับทราบ + ข้อความ "รับทราบ / ชื่อ / วันที่" ลงบน PDF
   เดินตามกติกาเดียวกับ doAct() ทุกข้อ: เลือกไฟล์ด้วย _signPdfWorkingCopy, path ใหม่ทุกครั้ง,
   ล้าง _furlCache, fetch แบบ cache:'reload', และขยับ uploaded_at เมื่อ PATCH ทับแถวเดิม
   คืน {ok:true} หรือ {ok:false,err:'...'} — ไม่ throw เพื่อให้การรับทราบยังถูกบันทึกได้ */
async function _ackEmbedSig(docId,sigSrc,marks){
  try{
    var allPdfs=await dg('document_files','?document_id=eq.'+safeId(docId)+'&file_type=like.application%2Fpdf');
    var sp=_signPdfWorkingCopy(Array.isArray(allPdfs)?allPdfs:[]);
    if(!sp||!sp.working) return {ok:false,err:'ไม่พบไฟล์ PDF ในเอกสารนี้'};
    var sourceFile=sp.working, baseName=sp.baseName, signedRow=sp.signedRow;
    if(!window.PDFLib) await loadSc('https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js');
    if(sourceFile.file_size&&sourceFile.file_size>20*1024*1024)
      return {ok:false,err:'ไฟล์ PDF ขนาด '+Math.round(sourceFile.file_size/1024/1024)+'MB ใหญ่เกินไป'};

    var resp=await fetch(await resolveFileUrl(sourceFile.file_path),{cache:'reload'});
    if(!resp.ok) return {ok:false,err:'โหลดไฟล์ PDF ต้นฉบับไม่สำเร็จ (HTTP '+resp.status+')'};
    var pdfDoc=await PDFLib.PDFDocument.load(new Uint8Array(await resp.arrayBuffer()),{ignoreEncryption:true});

    // ห้าม fetch(sigSrc) — sigSrc เป็น data: URL เสมอ และ CSP บล็อก (ดู imgSrcToBytes ใน utils.js)
    var imgBytes=await imgSrcToBytes(sigSrc);
    var emb;
    if(sigSrc.indexOf('data:image/jpeg')===0||sigSrc.indexOf('data:image/jpg')===0) emb=await pdfDoc.embedJpg(imgBytes);
    else if(sigSrc.indexOf('data:image/png')===0) emb=await pdfDoc.embedPng(imgBytes);
    else return {ok:false,err:'รองรับเฉพาะไฟล์ PNG หรือ JPEG สำหรับลายเซ็น'};

    // ฟอนต์ไทยสำหรับข้อความ "รับทราบ" — โหลดไม่ได้ก็ประทับเฉพาะลายเซ็น
    // (ห้าม fallback เป็นฟอนต์ละติน แล้วปั๊มไทยเป็นตัวขยะ — เหมือนกติกาปั๊มเลขใน docNum.js)
    var thFont=null;
    try{
      if(!window.fontkit) await loadSc('https://unpkg.com/@pdf-lib/fontkit/dist/fontkit.umd.min.js');
      pdfDoc.registerFontkit(window.fontkit);
      if(!window._thFontCache){
        window._thFontCache=await fetch('https://cdn.jsdelivr.net/gh/Phonbopit/sarabun-webfont@master/fonts/thsarabunnew-webfont.ttf').then(function(r){
          if(!r.ok) throw new Error('Font HTTP error'); return r.arrayBuffer();
        });
      }
      thFont=await pdfDoc.embedFont(window._thFontCache.slice(0));
    }catch(fe){console.warn('ack: Thai font load failed, stamping signature only:',fe.message);thFont=null}

    var who=CU.full_name||'';
    var pos=CU.position_code?(PTH[CU.position_code]||''):'';
    var dStr=new Date().toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'});
    var pgN=pdfDoc.getPageCount();
    for(var i=0;i<marks.length;i++){
      var mk=marks[i];
      var pg=pdfDoc.getPage(Math.min(Math.max((mk?mk.page:1),1),pgN)-1);
      var pw=pg.getWidth(), ph=pg.getHeight();
      var bw=(mk.wFrac||180/pw)*pw;
      var bh=mk.hFrac!=null?mk.hFrac*ph:bw/3;
      var sx=Math.max(0,Math.min(pw-bw,mk.xFrac*pw));
      var sy=Math.max(0,Math.min(ph-bh,(1-mk.yFrac)*ph-bh));
      if(thFont){
        // แบ่งกรอบ: ลายเซ็นอยู่ครึ่งบน ข้อความ 3 บรรทัดอยู่ครึ่งล่าง จะได้ไม่ทับกัน
        var tSize=Math.max(7,Math.min(12,bh*0.17));
        var tBlock=tSize*3.1;
        var sigH=Math.max(bh*0.35,bh-tBlock);
        var fit=fitImgInBox(emb.width,emb.height,bw,sigH);
        pg.drawImage(emb,{x:sx+fit.ox,y:sy+bh-sigH+fit.oy,width:fit.dw,height:fit.dh});
        var lines=['รับทราบ — '+who,(pos?pos:''),dStr].filter(function(s){return s});
        for(var li=0;li<lines.length;li++){
          // ชื่อ/ตำแหน่งยาวเกินความกว้างกรอบ → ย่อขนาดเฉพาะบรรทัดนั้นให้พอดี ไม่ปล่อยล้นออกนอกกรอบ
          var lSize=tSize;
          var tw=thFont.widthOfTextAtSize(lines[li],lSize);
          if(tw>bw&&tw>0){ lSize=Math.max(5,lSize*bw/tw); tw=thFont.widthOfTextAtSize(lines[li],lSize); }
          pg.drawText(lines[li],{
            x:sx+Math.max(0,(bw-tw)/2),
            y:sy+(lines.length-1-li)*tSize*1.05+2,
            size:lSize,font:thFont,color:PDFLib.rgb(0.07,0.38,0.67)
          });
        }
      }else{
        var fit2=fitImgInBox(emb.width,emb.height,bw,bh);
        pg.drawImage(emb,{x:sx+fit2.ox,y:sy+fit2.oy,width:fit2.dw,height:fit2.dh});
      }
    }

    var newBytes=await pdfDoc.save();
    var newVer=(signedRow?(signedRow.version||1):(sourceFile.version||1))+1;
    var stablePath=_signedStablePath(docId,baseName,newVer);
    var blob=new Blob([newBytes],{type:'application/pdf'});
    var oldPath=signedRow?signedRow.file_path:null;
    await upFile(stablePath,blob);
    _invalidateFileUrl(oldPath);
    if(signedRow){
      await dpa('document_files',signedRow.id,{file_path:stablePath,file_size:blob.size,uploaded_by:CU.id,version:newVer,uploaded_at:new Date().toISOString()});
      if(oldPath&&oldPath!==stablePath) await _deleteStorage(oldPath);
    }else{
      await dp('document_files',{document_id:docId,file_name:'[ลงนาม] '+baseName,file_path:stablePath,file_size:blob.size,file_type:'application/pdf',uploaded_by:CU.id,version:newVer});
    }
    await dp('document_history',{document_id:docId,action:'ประทับลายเซ็นรับทราบในเอกสาร'+(marks.length>1?' ('+marks.length+' จุด)':'')+(thFont?'':' (ไม่มีข้อความกำกับ — โหลดฟอนต์ไทยไม่ได้)'),performed_by:CU.id});
    return {ok:true};
  }catch(e){
    console.warn('ack embed failed:',e);
    return {ok:false,err:(e&&e.message)||'ไม่ทราบสาเหตุ'};
  }
}

/* แจ้งผู้ที่ถูกเสนอให้รับทราบ — อีเมล + LINE (ผู้เสนอคือผู้จัดทำ/จนท. จึงผ่านด่านสิทธิ์ของ send-email) */
async function _notifyAckRequested(docId,users,note){
  var doc=(await dg('documents','?id=eq.'+safeId(docId)))[0]||{};
  var subj='[กนค.] เสนอเพื่อโปรดทราบ: '+(doc.title||'');
  for(var i=0;i<users.length;i++){
    var u=users[i];
    var em=u.contact_email||u.email||'';
    var body='เรียน '+(u.full_name||'')+'<br>มีหนังสือเสนอให้ท่านรับทราบ'+
      (doc.doc_number?'<br>เลขที่: '+esc(doc.doc_number):'')+
      '<br>เรื่อง: '+esc(doc.title||'')+
      (doc.received_number?'<br>เลขรับที่ (ต้นทาง): '+esc(doc.received_number):'')+
      (note?'<br>ข้อความจากผู้เสนอ: '+esc(note):'')+
      '<br><br>กรุณาเข้าระบบแล้วกด "รับทราบเอกสาร" เพื่อลงนามรับทราบ'+
      (SETT.app_url?'<br>'+SETT.app_url:'');
    var st='skipped';
    try{
      if(em&&em.indexOf('@gnk.student')<0){
        var r=await sendEmailEdge({to:em,subject:subj,html:body,documentId:docId,recipientUserId:u.id});
        st=r.ok?'sent':'failed';
        if(r.ok&&typeof showEmailToast==='function') showEmailToast(em,subj);
      }
      await logNotifRow({document_id:docId,recipient_id:u.id,recipient_email:em||'',subject:subj,body:body,notification_type:'ack',status:st,sent_at:new Date().toISOString()});
    }catch(e){console.warn('ack email failed',u.id,e)}
    try{
      if(typeof sendLineWithLog==='function'){
        var txt=(SETT.email_prefix||'[กนค.]')+' 📄 เสนอเพื่อโปรดทราบ\n'+
          'เรียน '+(u.full_name||'')+'\nเรื่อง: '+(doc.title||'')+
          (doc.doc_number?'\nเลขที่: '+doc.doc_number:'')+
          (note?'\nข้อความ: '+note:'')+
          '\nกรุณากด "รับทราบเอกสาร" ในระบบ'+
          (SETT.app_url?('\n\nเปิดระบบ: '+SETT.app_url):'');
        var flex=null;
        try{
          flex=buildLineFlex({
            headText:'เสนอเพื่อโปรดทราบ', headColor:'#1261AB', headIcon:'notice',
            subj:doc.title||'', recipName:u.full_name,
            rows:[['เลขที่',doc.doc_number||'—'],['ผู้เสนอ',CU.full_name||''],['สิ่งที่ต้องทำ','กดรับทราบในระบบ']],
            infoText:note||'เปิดระบบแล้วกดปุ่ม “รับทราบเอกสาร” เพื่อลงนามรับทราบ',
            button:'เปิดดูเอกสาร', buttonColor:'#1261AB'
          });
        }catch(fe){}
        await sendLineWithLog(docId,u.id,em,subj,txt,'ack',flex);
      }
    }catch(e){console.warn('ack LINE failed',u.id,e)}
  }
}

/* แจ้งกลับผู้จัดทำ/ผู้เสนอว่ามีคนรับทราบแล้ว
   ⚠️ ผู้กดรับทราบมักไม่ใช่ผู้จัดทำ/ผู้ลงนามของเอกสาร — ด่าน canNotifyDocument() ใน
   send-email จะปฏิเสธจนกว่าจะ deploy _shared/validateNotify.ts ฉบับที่นับ document_acks ด้วย
   ทั้งบล็อกจึงเป็น fail-silent: การรับทราบถูกบันทึกใน document_history เสมอ ไม่ว่าอีเมลจะไปถึงหรือไม่ */
async function _notifyAcked(docId,note){
  var doc=(await dg('documents','?id=eq.'+safeId(docId)))[0]||{};
  var targets={};
  if(doc.created_by&&doc.created_by!==CU.id) targets[doc.created_by]=true;
  var rows=await dg('document_acks','?document_id=eq.'+safeId(docId)+'&user_id=eq.'+safeId(CU.id)+'&select=requested_by');
  if(Array.isArray(rows)&&rows[0]&&rows[0].requested_by&&rows[0].requested_by!==CU.id) targets[rows[0].requested_by]=true;
  var ids=Object.keys(targets);
  if(!ids.length) return;
  var us=await dg('user_directory','?id=in.('+ids.map(safeId).join(',')+')&select=id,full_name,email,contact_email');
  if(!Array.isArray(us)) return;
  var subj='[กนค.] รับทราบเอกสารแล้ว: '+(doc.title||'');
  for(var i=0;i<us.length;i++){
    var u=us[i], em=u.contact_email||u.email||'';
    var body='เรียน '+(u.full_name||'')+'<br><strong>'+esc(CU.full_name||'')+'</strong> รับทราบเอกสารแล้ว'+
      (doc.doc_number?'<br>เลขที่: '+esc(doc.doc_number):'')+
      '<br>เรื่อง: '+esc(doc.title||'')+
      (note?'<br>หมายเหตุ: '+esc(note):'');
    try{
      if(em&&em.indexOf('@gnk.student')<0){
        var r=await sendEmailEdge({to:em,subject:subj,html:body,documentId:docId,recipientUserId:u.id});
        await logNotifRow({document_id:docId,recipient_id:u.id,recipient_email:em,subject:subj,body:body,notification_type:'ack',status:r.ok?'sent':'failed',sent_at:new Date().toISOString()});
      }
    }catch(e){console.warn('acked email failed',u.id,e)}
    try{
      if(typeof sendLineWithLog==='function'){
        await sendLineWithLog(docId,u.id,em,subj,
          (SETT.email_prefix||'[กนค.]')+' ✅ รับทราบเอกสารแล้ว\n'+(CU.full_name||'')+' รับทราบ "'+(doc.title||'')+'" แล้ว'+
          (note?'\nหมายเหตุ: '+note:''),'ack',null);
      }
    }catch(e){}
  }
}
