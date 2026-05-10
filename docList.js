/* ─── DOCS LIST ─── */
var _PROJ_FILTER=''; // โครงการที่เลือก filter
var _FWD_ACT={};     // {docId: 'accepted'|'declined'} — populated in vDocs
var _ACTIVE_STEPS={}; // {docId: full_name} — ผู้รับผิดชอบขั้นตอน active ปัจจุบัน

async function vDocs(){
  // ดึง workflow steps ของ user ก่อน เพื่อใช้ filter documents ฝั่ง server
  var _mySteps=await dg('workflow_steps','?assigned_to=eq.'+safeId(CU.id)+'&select=document_id,status');
  var _myStepDocIds=_mySteps.map(function(s){return s.document_id});
  MSTEPS=_mySteps.filter(function(s){return s.status==='active'}).map(function(s){return s.document_id});
  var _allDocs;
  if(CU.role_code==='ROLE-SYS'||CU.position_code==='GNK-SEC'){
    _allDocs=await dg('documents','?order=created_at.desc');
  } else if(CU.role_code==='ROLE-STF'){
    var _stfOr='created_by.eq.'+safeId(CU.id)+',forwarded_to_id.eq.'+safeId(CU.id)+',status.eq.numbering';
    if(_myStepDocIds.length) _stfOr+=',id.in.('+_myStepDocIds.map(safeId).join(',')+')'
    _allDocs=await dg('documents','?or=('+_stfOr+')&order=created_at.desc');
  } else if(_myStepDocIds.length){
    _allDocs=await dg('documents','?or=(created_by.eq.'+safeId(CU.id)+',id.in.('+_myStepDocIds.map(safeId).join(',')+'),forwarded_to_id.eq.'+safeId(CU.id)+')&order=created_at.desc');
  } else {
    _allDocs=await dg('documents','?or=(created_by.eq.'+safeId(CU.id)+',forwarded_to_id.eq.'+safeId(CU.id)+')&order=created_at.desc');
  }
  ADOCS=_allDocs||[];

  // ── ดึงผู้รับผิดชอบขั้นตอน active สำหรับ pending docs ──
  _ACTIVE_STEPS={};
  var _pendingIds=ADOCS.filter(function(d){return d.status==='pending'}).map(function(d){return safeId(d.id)});
  if(_pendingIds.length){
    var _aSteps=await dg('workflow_steps','?status=eq.active&document_id=in.('+_pendingIds.join(',')+')'+'&select=document_id,assigned_to');
    var _stepUids=[...new Set((_aSteps||[]).filter(function(s){return s.assigned_to}).map(function(s){return s.assigned_to}))];
    var _stepUmap={};
    if(_stepUids.length){
      var _suRes=await dg('users','?id=in.('+_stepUids.map(safeId).join(',')+')'+'&select=id,full_name');
      (_suRes||[]).forEach(function(u){_stepUmap[u.id]=u.full_name});
    }
    (_aSteps||[]).forEach(function(s){if(s.document_id&&s.assigned_to)_ACTIVE_STEPS[s.document_id]=_stepUmap[s.assigned_to]||''});
  }

  // ── ตรวจสอบการตัดสินใจ รับ/ไม่รับ สำหรับเอกสารที่ถูก forward มาหาฉัน ──
  _FWD_ACT={};
  // เฉพาะเอกสาร completed ที่ถูกส่งมาหาฉัน (หลังลงนามและออกเลขเสร็จสิ้นแล้ว)
  var _fwdToMe=ADOCS.filter(function(d){return d.forwarded_to_id===CU.id&&d.status==='completed'});
  if(_fwdToMe.length){
    var _fwdHist=await dg('document_history',
      '?document_id=in.('+_fwdToMe.map(function(d){return safeId(d.id)}).join(',')+')'
      +'&action=in.(รับเอกสาร,ปฏิเสธเอกสาร)&performed_by=eq.'+safeId(CU.id)
      +'&select=document_id,action&order=performed_at.desc');
    (_fwdHist||[]).forEach(function(h){
      if(!_FWD_ACT[h.document_id]) // keep first (latest) action only
        _FWD_ACT[h.document_id]=h.action==='รับเอกสาร'?'accepted':'declined';
    });
  }

  DTAB='all'; _PROJ_FILTER='';

  // ── คำนวณจำนวน tab ──
  // เอกสาร "ของฉัน" = ไม่ใช่ forwarded-to-me ที่ declined, และ forwarded ที่ accepted ก็นับเป็นของฉัน
  var _docsForMain=ADOCS.filter(function(d){
    // docs created by self always visible (e.g. numbering status returns forwarded_to_id=creator)
    if(d.forwarded_to_id===CU.id&&d.created_by!==CU.id) return _FWD_ACT[d.id]==='accepted';
    return true;
  });
  var _pendingFwd=_fwdToMe.filter(function(d){return !_FWD_ACT[d.id]}).length;
  var _myRejectedIds=_docsForMain.filter(function(d){return d.status==='rejected'&&d.created_by===CU.id}).map(function(d){return d.id});
  var tc={all:_docsForMain.length,pending:0,signed:0,draft:0,rejected:0,numbering:0,completed:0,
          mine:MSTEPS.length+_myRejectedIds.length,fwd:_pendingFwd};
  _docsForMain.forEach(function(d){if(tc[d.status]!==undefined)tc[d.status]++});

  // รวบรวมชื่อโครงการจาก outgoing docs
  var _projSet=[...new Set(ADOCS.filter(function(d){return d.doc_type==='outgoing'&&d.description}).map(function(d){return d.description}))].sort();
  var _projOpts='<option value="">ทุกโครงการ</option>'+_projSet.map(function(p){return '<option value="'+esc(p)+'">'+esc(p)+'</option>'}).join('');

  var html=['<div class="flex gap-2.5 mb-4 flex-wrap items-center">'];
  html.push('<div class="search-wrap"><span class="search-icon">'+svg('srch',14)+'</span><input class="fi min-w-[220px]" id="dsrch" placeholder="ค้นหาชื่อเรื่องหรือเลขที่..." oninput="fDocsDebounced()"></div>');
  html.push('<select class="fi text-[13px]" id="dproj" style="max-width:200px'+(_projSet.length?'':';display:none')+'" onchange="_PROJ_FILTER=this.value;fDocs()">'+_projOpts+'</select>');
  if(CAN.cr(CU.role_code)) html.push('<button class="btn btn-primary sm ml-auto" data-action="nav" data-view="new">'+svg('plus',13)+' สร้างเอกสาร</button>');
  html.push('<button class="btn btn-soft sm" data-action="exportCSV" title="ส่งออกรายงาน CSV">'+svg('chart',13)+' ส่งออก CSV</button>');
  html.push('</div>');

  html.push('<div class="page-tabs" id="dtabs">');
  [['all','ทั้งหมด'],['mine','รอฉัน'],['pending','รอลงนาม'],['numbering','รอออกเลข'],
   ['completed','เสร็จสิ้น'],['draft','ร่าง'],['rejected','ส่งคืน'],
   ['fwd','ส่งมาให้ฉัน']].forEach(function(x){
    var cnt=tc[x[0]]||0;
    var _redTabs=['mine','rejected','numbering','fwd'];
    var badgeCls=(_redTabs.includes(x[0])&&cnt>0)?'bg-[#E83A00] text-white':'bg-[#EBEBEB] text-[#a89e99]';
    html.push('<div class="ptab'+(x[0]==='all'?' on':'')+'" data-action="setDT" data-tab="'+x[0]+'">'+x[1]+' <span class="'+badgeCls+' rounded-[10px] px-[7px] py-px text-[11px]">'+cnt+'</span></div>')
  });
  html.push('</div>');
  if(tc.numbering>0){
    var _canNumCount=_docsForMain.filter(function(d){return d.status==='numbering'&&(d.created_by===CU.id||CU.role_code==='ROLE-SYS'||CU.role_code==='ROLE-STF')}).length;
    var _numMsg=_canNumCount>0
      ?('<strong>'+_canNumCount+'</strong> เอกสารรอให้คุณออกเลขที่หนังสือ — ')
      :('<strong>'+tc.numbering+'</strong> เอกสารรอออกเลขที่หนังสือ (รอผู้จัดทำดำเนินการ) — ');
    html.push('<div class="al al-wa mb-3" style="cursor:pointer" data-action="setDT" data-tab="numbering">'+
      '<span class="al-icon">'+svg('pen',14)+'</span><span>'+_numMsg+'<u>คลิกเพื่อดู</u></span></div>');
  }
  html.push('<div class="card mb-0" id="dtbl">'+rDocTbl(_docsForMain)+'</div>');
  return html.join('')
}

function setDT(t){
  DTAB=t;
  _PROJ_FILTER='';
  var dp=$e('dproj'); if(dp) dp.value='';
  document.querySelectorAll('#dtabs .ptab').forEach(function(el){
    el.className='ptab'+(el.dataset.tab===t?' on':'')
  });
  fDocs()
}

var fDocsDebounced=debounce(fDocs,200);
function fDocs(){
  var q=(($e('dsrch')||{value:''}).value||'').toLowerCase();

  // tab 'fwd' — เอกสาร completed ที่ถูกส่งต่อมาหาฉัน ยังไม่ได้ตัดสินใจ
  if(DTAB==='fwd'){
    var f=ADOCS.filter(function(d){
      if(d.forwarded_to_id!==CU.id||d.status!=='completed'||_FWD_ACT[d.id]) return false;
      return !q||d.title.toLowerCase().includes(q)||(d.doc_number||'').includes(q)||(d.description||'').toLowerCase().includes(q);
    });
    var w=$e('dtbl'); if(w)w.innerHTML=rFwdTbl(f);
    return;
  }

  // tabs อื่น ๆ: แสดงเฉพาะ "เอกสารของฉัน" (ไม่รวม declined forwarded)
  var f=ADOCS.filter(function(d){
    // ถ้าถูก forward มาหาฉัน ต้อง accept ก่อนถึงจะอยู่ใน main list
    if(d.forwarded_to_id===CU.id&&d.created_by!==CU.id&&_FWD_ACT[d.id]!=='accepted') return false;
    var matchTab=DTAB==='all'||(DTAB==='mine'?(MSTEPS.indexOf(d.id)!==-1||(d.status==='rejected'&&d.created_by===CU.id)):d.status===DTAB);
    var matchProj=!_PROJ_FILTER||(d.doc_type==='outgoing'&&d.description===_PROJ_FILTER);
    return matchTab&&matchProj&&(!q||d.title.toLowerCase().includes(q)||(d.doc_number||'').includes(q)||(d.description||'').toLowerCase().includes(q));
  });
  var w=$e('dtbl'); if(w)w.innerHTML=rDocTbl(f)
}

/* ── ตารางเอกสารทั่วไป ── */
function rDocTbl(docs){
  if(!docs.length) return '<div style="padding:56px 20px;display:flex;flex-direction:column;align-items:center;gap:10px"><div style="opacity:0.35;color:#a89e99">'+svg('srch',40)+'</div><div style="font-size:14px;font-weight:500;color:#a89e99">ไม่พบเอกสาร</div></div>';
  var html=['<div class="tbl-wrap"><table><thead><tr><th>เลขที่</th><th>ชื่อเรื่อง / โครงการ</th><th>ประเภท</th><th>ความเร่งด่วน</th><th>สถานะ</th><th>กำหนดเสร็จ</th><th class="text-right">จัดการ</th></tr></thead><tbody>'];
  docs.forEach(function(d){
    var _projLabel=d.doc_type==='outgoing'&&d.description?'<div class="text-[10px] text-[#a89e99] mt-0.5 truncate">'+esc(d.description)+'</div>':'';
    html.push('<tr>');
    html.push('<td><span class="mono">'+esc(d.doc_number||'—')+'</span></td>');
    html.push('<td class="font-semibold max-w-[220px]"><div class="overflow-hidden text-ellipsis whitespace-nowrap">'+esc(d.title)+'</div>'+_projLabel+'</td>');
    html.push('<td>'+tBadge(d.doc_type)+'</td>');
    html.push('<td><span class="'+urgCls(d.urgency)+' text-xs font-semibold">'+(URG[d.urgency]||d.urgency)+'</span></td>');
    var _who=d.status==='pending'&&_ACTIVE_STEPS[d.id]?'<div class="text-[10px] text-[#a89e99] mt-0.5 truncate max-w-[100px]">รอ: '+esc(_ACTIVE_STEPS[d.id])+'</div>':'';
    html.push('<td>'+sBadge(d.status)+_who+'</td>');
    html.push('<td class="text-[#a89e99] text-xs">'+fd(d.due_date)+'</td>');
    html.push('<td><div class="flex gap-1.5 justify-end">');
    html.push('<button style="width:32px;height:32px;border-radius:9px;border:2px solid #3b82f6;background:#eff6ff;color:#3b82f6;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0" data-action="nav" data-view="det" data-id="'+d.id+'">'+svg('eye',14)+'</button>');
    if(CAN.ed(CU.role_code)&&(d.status==='draft'||(d.status==='rejected'&&d.created_by===CU.id))) html.push('<button class="btn btn-soft sm btn-icon" data-action="nav" data-view="edit" data-id="'+d.id+'">'+svg('edit',14)+'</button>');
    html.push('</div></td></tr>');
  });
  html.push('</tbody></table></div>');
  return html.join('')
}

/* ── ตาราง "ส่งมาให้ฉัน" — แสดงปุ่ม รับ/ไม่รับ ── */
function rFwdTbl(docs){
  if(!docs.length) return '<div style="padding:56px 20px;display:flex;flex-direction:column;align-items:center;gap:10px"><div style="opacity:0.35;color:#a89e99">'+svg('inbox',40)+'</div><div style="font-size:14px;font-weight:500;color:#a89e99">ไม่มีเอกสารที่รอการตัดสินใจ</div></div>';
  var html=['<div class="tbl-wrap"><table><thead><tr><th>เลขที่</th><th>ชื่อเรื่อง</th><th>ประเภท</th><th>สถานะ</th><th>วันที่ส่ง</th><th class="text-right">ดำเนินการ</th></tr></thead><tbody>'];
  docs.forEach(function(d){
    html.push('<tr style="background:linear-gradient(90deg,#EFF6FF 0%,#fff 60%)">');
    html.push('<td><span class="mono">'+esc(d.doc_number||'—')+'</span></td>');
    html.push('<td class="font-semibold max-w-[220px]">');
    html.push('<div class="overflow-hidden text-ellipsis whitespace-nowrap">'+esc(d.title)+'</div>');
    html.push('<div class="text-[10px] text-[#3b82f6] mt-0.5">ส่งมาให้คุณ</div>');
    html.push('</td>');
    html.push('<td>'+tBadge(d.doc_type)+'</td>');
    html.push('<td>'+sBadge(d.status)+'</td>');
    html.push('<td class="text-[#a89e99] text-xs">'+fd(d.forwarded_at)+'</td>');
    html.push('<td><div class="flex gap-1.5 justify-end items-center">');
    html.push('<button style="width:32px;height:32px;border-radius:9px;border:2px solid #3b82f6;background:#eff6ff;color:#3b82f6;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0" data-action="nav" data-view="det" data-id="'+d.id+'" title="ดูเอกสาร">'+svg('eye',14)+'</button>');
    html.push('<button class="btn btn-primary sm" data-action="acceptFwd" data-id="'+d.id+'">'+svg('ok',13)+' รับ</button>');
    html.push('<button class="btn btn-soft sm" style="color:#ef4444;border-color:#fca5a5" data-action="declineFwd" data-id="'+d.id+'">'+svg('x',13)+' ไม่รับ</button>');
    html.push('</div></td></tr>');
  });
  html.push('</tbody></table></div>');
  return html.join('')
}

/* ── รับเอกสารที่ส่งมา ── */
async function doAcceptFwd(docId){
  try{
    await dp('document_history',{document_id:docId,action:'รับเอกสาร',performed_by:CU.id,note:'รับเอกสารที่ส่งต่อมา'});
    _FWD_ACT[docId]='accepted';
    // อัปเดต tab count badge
    var fwdTab=document.querySelector('[data-tab="fwd"] span');
    if(fwdTab){var n=parseInt(fwdTab.textContent||'0')-1;fwdTab.textContent=Math.max(0,n);}
    fDocs();
  }catch(e){alert('เกิดข้อผิดพลาด กรุณาลองใหม่')}
}

/* ── ไม่รับเอกสารที่ส่งมา ── */
async function doDeclineFwd(docId){
  if(!confirm('ยืนยันไม่รับเอกสารนี้? เอกสารจะหายออกจากรายการของคุณ')) return;
  try{
    await dp('document_history',{document_id:docId,action:'ปฏิเสธเอกสาร',performed_by:CU.id,note:'ปฏิเสธเอกสารที่ส่งต่อมา'});
    _FWD_ACT[docId]='declined';
    var fwdTab=document.querySelector('[data-tab="fwd"] span');
    if(fwdTab){var n=parseInt(fwdTab.textContent||'0')-1;fwdTab.textContent=Math.max(0,n);}
    fDocs();
  }catch(e){alert('เกิดข้อผิดพลาด กรุณาลองใหม่')}
}
