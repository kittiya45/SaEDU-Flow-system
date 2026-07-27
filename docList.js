/* ─── DOCS LIST ─── */
var _PROJ_FILTER='';  // โครงการที่เลือก filter
var _DTYPE_FILTER=''; // ประเภทเอกสารที่เลือก filter
var _FWD_ACT={};      // {docId: 'accepted'|'declined'} — populated in vDocs
var _ACTIVE_STEPS={}; // {docId: full_name} — ผู้รับผิดชอบขั้นตอน active ปัจจุบัน
var _ACCEPTED_BY={};  // {docId: full_name} — จนท.ที่รับเอกสารไว้ (สถานะ awaiting_submit)
var _curFilteredDocs=null; // รายการที่กำลังแสดงในตารางจริง (หลัง filter tab/ประเภท/โครงการ/คำค้น) — ใช้โดย exportCSV() ใน report.js จะได้ export ตรงกับที่เห็นบนจอ
var _DOC_PAGE=0;
var DOC_LIST_LIMIT=200;
var _DOC_TOTAL=null;

function _docPageSuffix(){
  return '&limit='+DOC_LIST_LIMIT+'&offset='+(_DOC_PAGE*DOC_LIST_LIMIT);
}
function docPageNav(dir){
  var next=_DOC_PAGE+(dir>0?1:-1);
  if(next<0) return;
  if(_DOC_TOTAL!=null&&next*DOC_LIST_LIMIT>=_DOC_TOTAL) return;
  _DOC_PAGE=next;
  nav('docs');
}

async function vDocs(){
  // ดึง workflow steps ของ user ก่อน เพื่อใช้ filter documents ฝั่ง server
  var _mySteps=await dg('workflow_steps','?assigned_to=eq.'+safeId(CU.id)+'&select=document_id,status');
  var _myStepDocIds=_mySteps.map(function(s){return s.document_id});
  MSTEPS=_mySteps.filter(function(s){return s.status==='active'}).map(function(s){return s.document_id});
  var _allDocs;
  var _paginated=false;
  if(CU.role_code==='ROLE-SYS'||CU.role_code==='ROLE-STF'||CU.position_code==='GNK-SEC'){
    _paginated=true;
    _allDocs=await dg('documents','?order=created_at.desc'+_docPageSuffix());
    try{_DOC_TOTAL=await dgCount('documents','?order=created_at.desc')}catch(e){_DOC_TOTAL=null}
  } else if(CU.role_code==='ROLE-ADV'){
    // อาจารย์ที่ปรึกษาเห็นเฉพาะเอกสารที่ตนมีรายชื่ออยู่ (สร้างเอง/ถูกส่งต่อมา/มี workflow step) ไม่เห็นภาพรวมทั้งหมดเหมือน ROLE-STF
    var _advOr='created_by.eq.'+safeId(CU.id)+',forwarded_to_id.eq.'+safeId(CU.id);
    if(_myStepDocIds.length) _advOr+=',id.in.('+_myStepDocIds.map(safeId).join(',')+')'
    _allDocs=await dg('documents','?or=('+_advOr+')&order=created_at.desc&limit=500');
  } else if(_myStepDocIds.length){
    _allDocs=await dg('documents','?or=(created_by.eq.'+safeId(CU.id)+',id.in.('+_myStepDocIds.map(safeId).join(',')+'),forwarded_to_id.eq.'+safeId(CU.id)+')&order=created_at.desc&limit=500');
  } else {
    _allDocs=await dg('documents','?or=(created_by.eq.'+safeId(CU.id)+',forwarded_to_id.eq.'+safeId(CU.id)+')&order=created_at.desc&limit=500');
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
      var _suRes=await dg('user_directory','?id=in.('+_stepUids.map(safeId).join(',')+')'+'&select=id,full_name');
      (_suRes||[]).forEach(function(u){_stepUmap[u.id]=u.full_name});
    }
    (_aSteps||[]).forEach(function(s){if(s.document_id&&s.assigned_to)_ACTIVE_STEPS[s.document_id]=_stepUmap[s.assigned_to]||''});
  }

  // ── เจ้าหน้าที่ที่รับเอกสารไว้ (awaiting_submit) — ให้รู้ว่าเอกสารอยู่กับใคร ──
  _ACCEPTED_BY={};
  var _accIds=[...new Set(ADOCS.filter(function(d){return d.status==='awaiting_submit'&&d.accepted_by}).map(function(d){return d.accepted_by}))];
  if(_accIds.length){
    var _accRes=await dg('user_directory','?id=in.('+_accIds.map(safeId).join(',')+')'+'&select=id,full_name');
    var _accMap={};
    (Array.isArray(_accRes)?_accRes:[]).forEach(function(u){_accMap[u.id]=u.full_name});
    ADOCS.forEach(function(d){if(d.accepted_by&&_accMap[d.accepted_by])_ACCEPTED_BY[d.id]=_accMap[d.accepted_by]});
  }

  // ── ตรวจสอบการตัดสินใจ รับ/ไม่รับ สำหรับเอกสารที่ถูก forward มาหาฉัน / คิวกลุ่ม ──
  _FWD_ACT={};
  var _fwdToMe=ADOCS.filter(function(d){return _isFwdInboxForMe(d)});
  if(_fwdToMe.length){
    var _fwdHist=await dg('document_history',
      '?document_id=in.('+_fwdToMe.map(function(d){return safeId(d.id)}).join(',')+')'
      +'&action=eq.เจ้าหน้าที่รับเอกสาร'
      +'&select=document_id,action,performed_at&order=performed_at.desc');
    var _fwdAtMap={};
    _fwdToMe.forEach(function(d){_fwdAtMap[d.id]=d.forwarded_at});
    (_fwdHist||[]).forEach(function(h){
      // นับเฉพาะการรับที่เกิดหลังการส่งต่อรอบล่าสุด — รายการเก่าที่ลบไม่ได้ต้องไม่ปิดคิว
      if(!_FWD_ACT[h.document_id]&&acceptIsCurrent(h.performed_at,_fwdAtMap[h.document_id])) // คนใดคนหนึ่งรับแล้ว = คิวกลุ่มปิด
        _FWD_ACT[h.document_id]='accepted';
    });
  }

  _PROJ_FILTER='';

  // ── คำนวณจำนวน tab ──
  // เอกสาร "ของฉัน" = ไม่ใช่ forwarded-to-me ที่ declined, และ forwarded ที่ accepted ก็นับเป็นของฉัน
  var _docsForMain=ADOCS.filter(function(d){
    // docs created by self always visible (e.g. numbering status returns forwarded_to_id=creator)
    if(d.forwarded_to_id===CU.id&&d.created_by!==CU.id) return _FWD_ACT[d.id]==='accepted';
    if(_isStaffPoolFwd(d)&&CU.role_code==='ROLE-STF'&&d.created_by!==CU.id) return _FWD_ACT[d.id]==='accepted';
    return true;
  });
  var _pendingFwd=_fwdToMe.filter(function(d){return !_FWD_ACT[d.id]}).length;
  var _fwdTabCount=_fwdToMe.length;
  var _showFwdTab=['ROLE-SYS','ROLE-DEV','ROLE-STF','ROLE-ADV'].includes(CU.role_code)||_fwdToMe.length>0;
  var _myRejectedIds=_docsForMain.filter(function(d){return d.status==='rejected'&&d.created_by===CU.id}).map(function(d){return d.id});
  /* [UX] "ต้องดำเนินการ" = งาน workflow + ออกเลข — เอกสารส่งมาถึงแยกแท็บ fwd */
  var tc={all:_docsForMain.length,pending:0,signed:0,draft:0,rejected:0,numbering:0,awaiting_submit:0,completed:0,
          mine:MSTEPS.length+_myRejectedIds.length,fwd:_fwdTabCount};
  _docsForMain.forEach(function(d){if(tc[d.status]!==undefined)tc[d.status]++});
  // คิวรออัพเข้าระบบนับจาก ADOCS ทั้งหมด — เอกสารที่รอ จนท.รับยังไม่อยู่ใน _docsForMain
  tc.awaiting_submit=ADOCS.filter(_isAwaitQueueDoc).length;
  // เอกสารที่ยังรอ จนท.รับ ไม่นับเป็น "เสร็จสิ้น" — ไม่งั้นชิ้นเดียวโผล่สองแท็บ
  tc.completed=_docsForMain.filter(function(d){return d.status==='completed'&&!_isAwaitQueueDoc(d)}).length;
  var _canNumCount=_docsForMain.filter(function(d){return d.status==='numbering'&&(d.created_by===CU.id||CU.role_code==='ROLE-SYS'||CU.role_code==='ROLE-STF')}).length;
  tc.action=tc.mine+_canNumCount;

  /* [UX] เปิดหน้ามาให้เห็นแท็บ "ต้องดำเนินการ" ทันทีถ้ามีงานค้าง แทนที่จะเป็น "ทั้งหมด" เฉยๆ */
  DTAB=tc.action>0?'action':'all';
  var _initialDocs=DTAB==='action'?_actionFilterDocs():_docsForMain;
  _curFilteredDocs=_initialDocs;

  // รวบรวมชื่อโครงการจาก project_name — รวมทั้งขาเข้า+ขาออก
  var _projSet=[...new Set(ADOCS.filter(function(d){return d.project_name}).map(function(d){return d.project_name}))].sort();
  var _projOpts='<option value="">ทุกโครงการ</option>'+_projSet.map(function(p){return '<option value="'+esc(p)+'">'+esc(p)+'</option>'}).join('');

  var _dtypeOpts='<option value="">ทุกประเภท</option>'+Object.entries(DTYPES).map(function(e){return '<option value="'+e[0]+'">'+e[1]+'</option>'}).join('');

  var html=['<div class="page-toolbar">'];
  html.push('<div class="search-wrap"><span class="search-icon">'+svg('srch',14)+'</span><input class="fi min-w-[220px]" id="dsrch" placeholder="ค้นหาชื่อเรื่อง เลขที่ หรือ จาก/เรียน..." oninput="fDocsDebounced()"></div>');
  html.push('<select class="fi text-[13px]" id="ddtype" style="max-width:160px" onchange="_DTYPE_FILTER=this.value;fDocs()">'+_dtypeOpts+'</select>');
  html.push('<select class="fi text-[13px]" id="dproj" style="max-width:180px'+(_projSet.length?'':';display:none')+'" onchange="_PROJ_FILTER=this.value;fDocs()">'+_projOpts+'</select>');
  if(CAN.cr(CU.role_code)) html.push('<button class="btn btn-primary sm ml-auto" data-action="nav" data-view="new">'+svg('plus',13)+' สร้างเอกสาร</button>');
  html.push('<button class="btn btn-soft sm" data-action="exportCSV" title="ส่งออกรายงาน CSV">'+svg('chart',13)+' ส่งออก CSV</button>');
  html.push('</div>');

  /* tabs: ทั้งหมด | ร่าง | ต้องดำเนินการ | ส่งมาถึงฉัน | อยู่ระหว่างดำเนินการ | รออัพเข้าระบบ | เสร็จสิ้น */
  html.push('<div class="page-tabs" id="dtabs">');
  var _tabDefs=[['all','ทั้งหมด'],['draft','ร่าง'],['action','ต้องดำเนินการ']];
  if(_showFwdTab) _tabDefs.push(['fwd','ส่งมาถึงฉัน']);
  _tabDefs.push(['pending','อยู่ระหว่างดำเนินการ'],['awaiting_submit','รออัพเข้าระบบ'],['completed','เสร็จสิ้น']);
  _tabDefs.forEach(function(x){
    var cnt=tc[x[0]]||0;
    var chipMod=(x[0]==='action'&&cnt>0)?' tab-count-action'
      :(x[0]==='fwd'&&_pendingFwd>0)?' tab-count-action'
      :(x[0]==='awaiting_submit'&&cnt>0)?' tab-count-action'
      :(cnt===0?' tab-count-zero':'');
    html.push('<div class="ptab'+(x[0]===DTAB?' on':'')+'" data-action="setDT" data-tab="'+x[0]+'">'+x[1]+'<span class="tab-count'+chipMod+'">'+cnt+'</span></div>')
  });
  html.push('</div>');

  // แสดง banner แจ้งเตือนถ้ามีงานรอออกเลข
  if(_canNumCount>0){
    html.push('<div class="al al-wa mb-3" style="cursor:pointer" data-action="setDT" data-tab="action">'+
      '<span class="al-icon">'+svg('pen',14)+'</span><span><strong>'+_canNumCount+'</strong> เอกสารรอให้คุณออกเลขที่หนังสือ — <u>คลิกเพื่อดู</u></span></div>');
  }
  html.push('<div class="card mb-0" id="dtbl">'+rDocTbl(_initialDocs)+'</div>');
  if(_paginated&&_DOC_TOTAL!=null&&_DOC_TOTAL>DOC_LIST_LIMIT){
    var _from=_DOC_PAGE*DOC_LIST_LIMIT+1;
    var _to=Math.min((_DOC_PAGE+1)*DOC_LIST_LIMIT,_DOC_TOTAL);
    html.push('<div class="flex items-center justify-between gap-3 mt-3 px-1 text-[13px] text-[#a89e99]">');
    html.push('<span>แสดง '+_from+'–'+_to+' จาก '+_DOC_TOTAL+' รายการ</span>');
    html.push('<div class="flex gap-2">');
    if(_DOC_PAGE>0) html.push('<button class="btn btn-soft sm" data-action="docPagePrev">'+svg('back',12)+' ก่อนหน้า</button>');
    if(_to<_DOC_TOTAL) html.push('<button class="btn btn-soft sm" data-action="docPageNext">ถัดไป '+svg('tri',12)+'</button>');
    html.push('</div></div>');
  } else if(!_paginated&&(_allDocs||[]).length>=500){
    html.push('<div class="al al-wa mt-3"><span class="al-icon">'+svg('info',13)+'</span><span>แสดง 500 รายการล่าสุด — ใช้ช่องค้นหาหรือตัวกรองเพื่อแคบผลลัพธ์</span></div>');
  }
  return html.join('')
}

/* ── คิว "รออัพเข้าระบบ" — งานที่ต้องนำไปยื่นในระบบมหาวิทยาลัย ──
   รวม 2 สถานะ เพราะเป็นงานชิ้นเดียวกันในมุมเจ้าหน้าที่:
     1) awaiting_submit           — จนท.รับแล้ว รอยื่น
     2) completed + ยัง forward อยู่ — ส่งถึง จนท.แล้วแต่ยังไม่มีใครกดรับ
   (forward_accept ล้าง forwarded_to_id/staff ตอนรับ — ธงที่ยังค้างจึงแปลว่ายังไม่ถูกรับ) */
function _isAwaitQueueDoc(d){
  if(!d) return false;
  if(d.status==='awaiting_submit') return true;
  return d.status==='completed'&&(!!d.forwarded_to_staff||!!d.forwarded_to_id);
}

/* ── ตัวกรองแท็บ "ต้องดำเนินการ" — ใช้ร่วมกันทั้งตอน render ครั้งแรกและตอนสลับแท็บ กันตรรกะเพี้ยนสองที่ ── */
function _actionFilterDocs(q){
  q=q||'';
  return ADOCS.filter(function(d){
    var _isMyTask=MSTEPS.indexOf(d.id)!==-1;
    var _isMyRej=d.status==='rejected'&&d.created_by===CU.id;
    var _isMyNum=d.status==='numbering'&&(d.created_by===CU.id||CU.role_code==='ROLE-SYS'||CU.role_code==='ROLE-STF');
    var _isAwait=_isAwaitQueueDoc(d)&&['ROLE-STF','ROLE-SYS','ROLE-DEV'].includes(CU.role_code);
    if(!(_isMyTask||_isMyRej||_isMyNum||_isAwait)) return false;
    if(_DTYPE_FILTER&&d.doc_type!==_DTYPE_FILTER) return false;
    return _matchQ(d,q);
  });
}

function setDT(t){
  DTAB=t;
  _PROJ_FILTER=''; _DTYPE_FILTER='';
  var dp=$e('dproj'); if(dp) dp.value='';
  var dd=$e('ddtype'); if(dd) dd.value='';
  document.querySelectorAll('#dtabs .ptab').forEach(function(el){
    el.className='ptab'+(el.dataset.tab===t?' on':'')
  });
  fDocs()
}

var fDocsDebounced=debounce(fDocs,200);
function _matchQ(d,q){
  if(!q) return true;
  return d.title.toLowerCase().includes(q)||
    (d.doc_number||'').toLowerCase().includes(q)||
    (d.description||'').toLowerCase().includes(q)||
    (d.from_department||'').toLowerCase().includes(q)||
    (d.addressed_to||'').toLowerCase().includes(q)||
    (d.subject_line||'').toLowerCase().includes(q);
}
function fDocs(){
  var q=(($e('dsrch')||{value:''}).value||'').toLowerCase();

  /* tab 'action' — งาน workflow + ออกเลข (ไม่รวมเอกสารส่งมาถึง — ดูแท็บ fwd) */
  if(DTAB==='action'){
    var _actionDocs=_actionFilterDocs(q);
    _curFilteredDocs=_actionDocs;
    var w=$e('dtbl'); if(!w) return;
    w.innerHTML=rDocTbl(_actionDocs);
    return;
  }

  /* tab 'fwd' — เอกสารที่ส่งมาถึงเจ้าหน้าที่ (completed + forwarded_to_id = ฉัน) */
  if(DTAB==='fwd'){
    var _fwdDocs=ADOCS.filter(function(d){
      if(!_isFwdInboxForMe(d)) return false;
      if(_DTYPE_FILTER&&d.doc_type!==_DTYPE_FILTER) return false;
      return _matchQ(d,q);
    });
    var _fwdPending=_fwdDocs.filter(function(d){return !_FWD_ACT[d.id]});
    var _fwdDone=_fwdDocs.filter(function(d){return _FWD_ACT[d.id]==='accepted'});
    _curFilteredDocs=_fwdDocs;
    var w2=$e('dtbl'); if(!w2) return;
    var html3='';
    if(_fwdPending.length) html3+=rFwdTbl(_fwdPending);
    if(_fwdDone.length){
      if(_fwdPending.length) html3+='<div class="px-4 pt-4 pb-1 text-[11px] font-bold tracking-wide text-[#a89e99] uppercase">รับแล้ว</div>';
      html3+=rDocTbl(_fwdDone);
    }
    if(!html3) html3='<div style="padding:64px 20px;display:flex;flex-direction:column;align-items:center;gap:10px"><div style="opacity:.3;color:#a89e99">'+svg('inbox',40)+'</div><div style="font-size:14px;font-weight:500;color:#a89e99">ไม่มีเอกสารที่ส่งมาถึง</div></div>';
    w2.innerHTML=html3;
    return;
  }

  var _awaitTab=DTAB==='awaiting_submit';
  var f=ADOCS.filter(function(d){
    // แท็บรออัพเข้าระบบต้องเห็นงานที่ยังรอ จนท.รับด้วย จึงข้าม guard ของแท็บอื่น
    if(!_awaitTab&&d.forwarded_to_id===CU.id&&d.created_by!==CU.id&&_FWD_ACT[d.id]!=='accepted') return false;
    var matchTab=DTAB==='all'
      ||(_awaitTab?_isAwaitQueueDoc(d)
        :DTAB==='completed'?(d.status==='completed'&&!_isAwaitQueueDoc(d))
        :d.status===DTAB);
    var matchProj=!_PROJ_FILTER||d.project_name===_PROJ_FILTER;
    var matchType=!_DTYPE_FILTER||d.doc_type===_DTYPE_FILTER;
    return matchTab&&matchProj&&matchType&&_matchQ(d,q);
  });
  _curFilteredDocs=f;
  var w=$e('dtbl'); if(w)w.innerHTML=rDocTbl(f)
}

/* ── ตารางเอกสาร — ledger กระชับ (meta ชิดขวา ไม่ยืดช่องว่าง) ── */
function rDocTbl(docs){
  if(!docs.length) return '<div style="padding:64px 20px;display:flex;flex-direction:column;align-items:center;gap:10px"><div style="opacity:.3;color:#a89e99">'+svg('srch',40)+'</div><div style="font-size:14px;font-weight:500;color:#a89e99">ไม่พบเอกสาร</div></div>';
  var _todayMs=new Date().setHours(0,0,0,0);
  var _todayStr=new Date().toISOString().slice(0,10);
  var LIMIT=7;
  var totalPages=Math.ceil(docs.length/LIMIT);
  var uid='dt'+Date.now();

  function mkDocRow(d,idx){
    var pg=Math.floor(idx/LIMIT);
    var _isMyTask=MSTEPS.indexOf(d.id)!==-1;
    var _isOverdue=d.due_date&&d.due_date<_todayStr&&d.status!=='completed';
    var rowCls='doc-ledger-row'+(_isMyTask?' is-mine':'')+(_isOverdue?' is-overdue':'');

    var dueCls='doc-ledger-due is-empty',dueTxt='—';
    if(d.due_date&&d.status!=='completed'){
      var _days=Math.ceil((new Date(d.due_date+'T00:00:00')-_todayMs)/86400000);
      if(_isOverdue){dueCls='doc-ledger-due is-late';dueTxt='เกิน '+Math.abs(_days)+' วัน'}
      else if(_days===0){dueCls='doc-ledger-due is-today';dueTxt='วันนี้'}
      else if(_days<=3){dueCls='doc-ledger-due is-soon';dueTxt=_days+' วัน'}
      else{dueCls='doc-ledger-due is-ok';dueTxt=_days+' วัน'}
    }

    var who='';
    if(d.status==='pending'&&_ACTIVE_STEPS[d.id])
      who='<div class="doc-ledger-who tip" data-tip="'+esc(_ACTIVE_STEPS[d.id])+'">รอ: '+esc(_ACTIVE_STEPS[d.id])+'</div>';
    // ขึ้นบรรทัดเองด้วย <br> — ปล่อยให้เบราว์เซอร์ตัดคำไทยจะหั่นกลางชื่อคน (นันท/ปิยะ)
    else if(d.status==='awaiting_submit'&&_ACCEPTED_BY[d.id])
      who='<div class="doc-ledger-who is-held">เจ้าหน้าที่รับเอกสารแล้ว<br>'+esc(_ACCEPTED_BY[d.id])+'</div>';
    else if(d.status==='completed'&&(d.forwarded_to_staff||d.forwarded_to_id))
      who='<div class="doc-ledger-who is-wait">รอเจ้าหน้าที่กิจการนิสิต<br>กดรับเอกสาร</div>';
    var proj=d.project_name
      ?'<div class="doc-ledger-sub">'+esc(d.project_name)+'</div>':'';
    var canEdit=CAN.ed(CU.role_code)&&(d.status==='draft'||(d.status==='rejected'&&d.created_by===CU.id));

    return '<div class="'+rowCls+'" data-pg="'+pg+'" style="'+(pg>0?'display:none':'')+'" '+
      'data-action="nav" data-view="det" data-id="'+d.id+'">'+
      '<div class="doc-ledger-idx">'+(idx+1)+'</div>'+
      '<div class="doc-ledger-main">'+
        '<div class="doc-ledger-tags">'+
          '<span class="mono">'+esc(d.doc_number||'—')+'</span>'+
          tBadge(d.doc_type)+
        '</div>'+
        '<div class="doc-ledger-title tip" data-tip="'+esc(d.title)+'">'+esc(d.title)+'</div>'+
        proj+
      '</div>'+
      '<div class="doc-ledger-side">'+
        '<div class="doc-ledger-status">'+((d.status==='completed'&&(d.forwarded_to_staff||d.forwarded_to_id))?sBadgeFwd(true):sBadge(d.status))+who+'</div>'+
        '<div class="'+dueCls+'">'+dueTxt+'</div>'+
        '<div class="doc-ledger-acts doc-row-acts">'+
          (canEdit?'<button type="button" class="doc-row-act is-edit" data-action="nav" data-view="edit" data-id="'+d.id+'" title="แก้ไข" aria-label="แก้ไข">'+svg('edit',15)+'</button>':'')+
          '<button type="button" class="doc-row-act is-view" data-action="nav" data-view="det" data-id="'+d.id+'" title="ดูรายละเอียด" aria-label="ดูรายละเอียด">'+svg('eye',15)+'</button>'+
        '</div>'+
      '</div>'+
    '</div>';
  }

  var rows=docs.map(function(d,i){return mkDocRow(d,i)}).join('');
  var foot='';
  if(totalPages>1){
    foot='<div class="doc-ledger-foot" id="'+uid+'pg">'+
      '<button type="button" class="doc-pg-btn" id="'+uid+'prev" onclick="_docPg(\''+uid+'\',-1,'+totalPages+')" disabled>ก่อนหน้า</button>'+
      '<span class="doc-pg-lbl" id="'+uid+'lbl">หน้า 1 / '+totalPages+'</span>'+
      '<button type="button" class="doc-pg-btn" id="'+uid+'next" onclick="_docPg(\''+uid+'\',1,'+totalPages+')">ถัดไป</button>'+
    '</div>';
  }

  return '<div class="doc-ledger" id="'+uid+'" data-pg="0">'+
    '<div class="doc-ledger-head">'+
      '<span class="doc-ledger-idx">#</span>'+
      '<span>เลขที่ / ชื่อเรื่อง</span>'+
      '<div class="doc-ledger-head-side"><span>สถานะ</span><span>กำหนด</span><span></span></div>'+
    '</div>'+
    rows+foot+
  '</div>';
}

function _docPg(uid, delta, totalPages){
  var root=document.getElementById(uid);
  if(!root)return;
  var cur=parseInt(root.dataset.pg||0,10);
  var next=Math.max(0,Math.min(totalPages-1,cur+delta));
  if(next===cur)return;
  root.dataset.pg=next;
  var rows=root.querySelectorAll('.doc-ledger-row[data-pg]');
  for(var i=0;i<rows.length;i++){
    rows[i].style.display=parseInt(rows[i].dataset.pg,10)===next?'':'none';
  }
  var lbl=document.getElementById(uid+'lbl');
  if(lbl)lbl.textContent='หน้า '+(next+1)+' / '+totalPages;
  var prev=document.getElementById(uid+'prev');
  var nxt=document.getElementById(uid+'next');
  if(prev)prev.disabled=next===0;
  if(nxt)nxt.disabled=next===totalPages-1;
}

/* ── รายการ "ส่งมาให้ฉัน" — ส่งต่อเอกสารรอตัดสินใจ ── */
function rFwdTbl(docs){
  if(!docs.length) return '<div style="padding:56px 20px;display:flex;flex-direction:column;align-items:center;gap:10px"><div style="opacity:.3;color:#a89e99">'+svg('inbox',40)+'</div><div style="font-size:14px;font-weight:500;color:#a89e99">ไม่มีเอกสารที่รอการตัดสินใจ</div></div>';

  var LIMIT=7;
  function mkFwdRow(d,idx){
    return '<div class="doc-ledger-row is-fwd" data-action="nav" data-view="det" data-id="'+d.id+'">'+
      '<div class="doc-ledger-idx">'+(idx+1)+'</div>'+
      '<div class="doc-ledger-main">'+
        '<div class="doc-ledger-tags">'+
          '<span class="mono" style="background:rgba(255,255,255,.9);color:#1D4ED8;border:1px solid rgba(29,78,216,.12)">'+esc(d.doc_number||'—')+'</span>'+
          tBadge(d.doc_type)+
        '</div>'+
        '<div class="doc-ledger-title tip" data-tip="'+esc(d.title)+'">'+esc(d.title)+'</div>'+
        '<div class="doc-ledger-sub is-fwd">'+(_isStaffPoolFwd(d)?'ส่งเข้ากิจการทั้งหมด':'ส่งมาให้คุณ')+' · '+fd(d.forwarded_at)+'</div>'+
      '</div>'+
      '<div class="doc-ledger-side" style="grid-template-columns:150px auto">'+
        '<div class="doc-ledger-status">'+sBadgeFwd(true)+'</div>'+
        '<div class="doc-row-acts" style="gap:6px">'+
          '<button type="button" class="doc-row-act is-view" data-action="nav" data-view="det" data-id="'+d.id+'" title="ดูเอกสาร" aria-label="ดูเอกสาร">'+svg('eye',15)+'</button>'+
          '<button class="btn btn-primary xs" data-action="acceptFwd" data-id="'+d.id+'">'+svg('ok',12)+' รับ</button>'+
          '<button class="btn btn-soft xs" style="color:#DC2626;border-color:#FECACA" data-action="showDeclineFwdModal" data-id="'+d.id+'">'+svg('x',12)+' ไม่รับ</button>'+
        '</div>'+
      '</div>'+
    '</div>';
  }

  var recent=docs.slice(0,LIMIT);
  var older=docs.slice(LIMIT);
  var html='<div class="doc-ledger">'+
    '<div class="doc-ledger-head">'+
      '<span class="doc-ledger-idx">#</span>'+
      '<span>เลขที่ / ชื่อเรื่อง</span>'+
      '<div class="doc-ledger-head-side" style="grid-template-columns:150px auto"><span>สถานะ</span><span style="text-align:right">การดำเนินการ</span></div>'+
    '</div>'+
    recent.map(mkFwdRow).join('')+
  '</div>';

  if(older.length){
    html+='<details style="border-top:1px solid #F0EEEB">'+
      '<summary style="padding:12px 18px;font-size:12px;font-weight:600;color:#6B6560;cursor:pointer;list-style:none">แสดงอีก '+older.length+' รายการ</summary>'+
      '<div class="doc-ledger">'+older.map(function(d,i){return mkFwdRow(d,i+LIMIT)}).join('')+'</div>'+
    '</details>';
  }
  return html;
}

function _fwdToggle(btn){
  var t=document.getElementById(btn.dataset.fwdToggle);
  if(!t)return;
  var opening=t.style.display==='none';
  t.style.display=opening?'':'none';
  btn.textContent=opening?'▾ ซ่อนรายการก่อนหน้า':'▸ ดูรายการก่อนหน้า ('+btn.dataset.fwdCount+' รายการ)';
}

/* ── รับเอกสารที่ส่งมา — ใช้ acceptForwardedDoc จาก utils.js (docDetail.js override หลังโหลด) ── */
