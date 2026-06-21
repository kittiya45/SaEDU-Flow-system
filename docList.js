/* ─── DOCS LIST ─── */
var _PROJ_FILTER='';  // โครงการที่เลือก filter
var _DTYPE_FILTER=''; // ประเภทเอกสารที่เลือก filter
var _FWD_ACT={};      // {docId: 'accepted'|'declined'} — populated in vDocs
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
      var _suRes=await dg('user_directory','?id=in.('+_stepUids.map(safeId).join(',')+')'+'&select=id,full_name');
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
      +'&action=eq.เจ้าหน้าที่รับเอกสาร&performed_by=eq.'+safeId(CU.id)
      +'&select=document_id,action&order=performed_at.desc');
    (_fwdHist||[]).forEach(function(h){
      if(!_FWD_ACT[h.document_id]) // keep first (latest) action only
        _FWD_ACT[h.document_id]='accepted';
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
  /* [UX] รวม mine+numbering+fwd เป็น 1 กลุ่ม "ต้องดำเนินการ" ลด cognitive load */
  var tc={all:_docsForMain.length,pending:0,signed:0,draft:0,rejected:0,numbering:0,completed:0,
          mine:MSTEPS.length+_myRejectedIds.length,fwd:_pendingFwd};
  _docsForMain.forEach(function(d){if(tc[d.status]!==undefined)tc[d.status]++});
  // กลุ่มรวม "ต้องดำเนินการ" = mine + fwd ที่ยังไม่ตอบ + numbering ที่ทำได้
  var _canNumCount=_docsForMain.filter(function(d){return d.status==='numbering'&&(d.created_by===CU.id||CU.role_code==='ROLE-SYS'||CU.role_code==='ROLE-STF')}).length;
  tc.action=tc.mine+_pendingFwd+_canNumCount;

  // รวบรวมชื่อโครงการจาก outgoing docs
  var _projSet=[...new Set(ADOCS.filter(function(d){return d.doc_type==='outgoing'&&d.description}).map(function(d){return d.description}))].sort();
  var _projOpts='<option value="">ทุกโครงการ</option>'+_projSet.map(function(p){return '<option value="'+esc(p)+'">'+esc(p)+'</option>'}).join('');

  var _dtypeOpts='<option value="">ทุกประเภท</option>'+Object.entries(DTYPES).map(function(e){return '<option value="'+e[0]+'">'+e[1]+'</option>'}).join('');

  var html=['<div class="flex gap-2.5 mb-4 flex-wrap items-center">'];
  html.push('<div class="search-wrap"><span class="search-icon">'+svg('srch',14)+'</span><input class="fi min-w-[220px]" id="dsrch" placeholder="ค้นหาชื่อเรื่อง เลขที่ หรือ จาก/ถึง..." oninput="fDocsDebounced()"></div>');
  html.push('<select class="fi text-[13px]" id="ddtype" style="max-width:160px" onchange="_DTYPE_FILTER=this.value;fDocs()">'+_dtypeOpts+'</select>');
  html.push('<select class="fi text-[13px]" id="dproj" style="max-width:180px'+(_projSet.length?'':';display:none')+'" onchange="_PROJ_FILTER=this.value;fDocs()">'+_projOpts+'</select>');
  if(CAN.cr(CU.role_code)) html.push('<button class="btn btn-primary sm ml-auto" data-action="nav" data-view="new">'+svg('plus',13)+' สร้างเอกสาร</button>');
  html.push('<button class="btn btn-soft sm" data-action="exportCSV" title="ส่งออกรายงาน CSV">'+svg('chart',13)+' ส่งออก CSV</button>');
  html.push('</div>');

  /* [UX] ลด tabs จาก 8 → 5 กลุ่ม เพื่อลด cognitive load
     - "ต้องดำเนินการ" = mine + fwd + numbering (ที่ทำได้)
     - "กำลังดำเนินการ" = pending
     - "เสร็จสิ้น" = completed
     - "ร่าง" = draft
     - "ทั้งหมด" = all                                          */
  html.push('<div class="page-tabs" id="dtabs">');
  [['all','ทั้งหมด'],['action','ต้องดำเนินการ'],['pending','กำลังดำเนินการ'],
   ['completed','เสร็จสิ้น'],['draft','ร่าง']].forEach(function(x){
    var cnt=tc[x[0]]||0;
    var badgeCls=(x[0]==='action'&&cnt>0)?'bg-[#E83A00] text-white':'bg-[#EBEBEB] text-[#a89e99]';
    html.push('<div class="ptab'+(x[0]==='all'?' on':'')+'" data-action="setDT" data-tab="'+x[0]+'">'+x[1]+' <span class="'+badgeCls+' rounded-[10px] px-[7px] py-px text-[11px]">'+cnt+'</span></div>')
  });
  html.push('</div>');
  // แสดง banner แจ้งเตือนถ้ามีงานรอออกเลข
  if(_canNumCount>0){
    html.push('<div class="al al-wa mb-3" style="cursor:pointer" data-action="setDT" data-tab="action">'+
      '<span class="al-icon">'+svg('pen',14)+'</span><span><strong>'+_canNumCount+'</strong> เอกสารรอให้คุณออกเลขที่หนังสือ — <u>คลิกเพื่อดู</u></span></div>');
  }
  html.push('<div class="card mb-0" id="dtbl">'+rDocTbl(_docsForMain)+'</div>');
  return html.join('')
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

  /* [UX] tab 'action' — รวม mine + fwd ที่รอตัดสินใจ + numbering ที่ทำได้
     ส่วน fwd ที่ pending decision แสดงใน rFwdTbl ด้านล่าง main table */
  if(DTAB==='action'){
    var _actionDocs=ADOCS.filter(function(d){
      var _isMyTask=MSTEPS.indexOf(d.id)!==-1;
      var _isMyRej=d.status==='rejected'&&d.created_by===CU.id;
      var _isMyNum=d.status==='numbering'&&(d.created_by===CU.id||CU.role_code==='ROLE-SYS'||CU.role_code==='ROLE-STF');
      var _isFwd=d.forwarded_to_id===CU.id&&d.status==='completed'&&!_FWD_ACT[d.id];
      if(!(_isMyTask||_isMyRej||_isMyNum||_isFwd)) return false;
      if(_DTYPE_FILTER&&d.doc_type!==_DTYPE_FILTER) return false;
      return _matchQ(d,q);
    });
    var _fwdOnly=_actionDocs.filter(function(d){return d.forwarded_to_id===CU.id&&d.status==='completed'&&!_FWD_ACT[d.id]});
    var _mainOnly=_actionDocs.filter(function(d){return _fwdOnly.indexOf(d)===-1});
    var w=$e('dtbl'); if(!w) return;
    var html2=(_mainOnly.length||!_fwdOnly.length)?rDocTbl(_mainOnly):'';
    if(_fwdOnly.length) html2+='<div class="px-4 pt-4 pb-1 text-[11px] font-bold tracking-wide text-[#a89e99] uppercase">เอกสารที่ส่งมาให้คุณ</div>'+rFwdTbl(_fwdOnly);
    w.innerHTML=html2;
    return;
  }

  var f=ADOCS.filter(function(d){
    if(d.forwarded_to_id===CU.id&&d.created_by!==CU.id&&_FWD_ACT[d.id]!=='accepted') return false;
    var matchTab=DTAB==='all'||(d.status===DTAB);
    var matchProj=!_PROJ_FILTER||(d.doc_type==='outgoing'&&d.description===_PROJ_FILTER);
    var matchType=!_DTYPE_FILTER||d.doc_type===_DTYPE_FILTER;
    return matchTab&&matchProj&&matchType&&_matchQ(d,q);
  });
  var w=$e('dtbl'); if(w)w.innerHTML=rDocTbl(f)
}

/* ── ตารางเอกสาร — Registry Ledger style ── */
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
    var _rowBg=_isMyTask?'#FFFBF8':_isOverdue?'#FFF9F9':'';

    var _dueHtml='<span style="color:#EBEBEB;font-size:11px">—</span>';
    if(d.due_date){
      var _days=Math.ceil((new Date(d.due_date+'T00:00:00')-_todayMs)/86400000);
      if(_isOverdue)
        _dueHtml='<span style="color:#DC2626;font-size:11px;font-weight:700">เกิน '+Math.abs(_days)+' วัน</span>';
      else if(_days===0)
        _dueHtml='<span style="color:#EA580C;font-size:11px;font-weight:700">วันนี้</span>';
      else if(_days<=3)
        _dueHtml='<span style="color:#D97706;font-size:11px;font-weight:600">'+_days+' วัน</span>';
      else
        _dueHtml='<span style="color:#a89e99;font-size:11px">'+_days+' วัน</span>';
    }

    var _whoHtml=d.status==='pending'&&_ACTIVE_STEPS[d.id]
      ?'<div style="font-size:10px;color:#a89e99;margin-top:3px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">รอ: '+esc(_ACTIVE_STEPS[d.id])+'</div>':'';

    var _projHtml=d.doc_type==='outgoing'&&d.description
      ?'<div style="font-size:10px;color:#a89e99;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(d.description)+'</div>':'';

    return '<tr data-pg="'+pg+'" style="'+(pg>0?'display:none;':'')+'background:'+(_rowBg||'transparent')+';cursor:pointer" '+
      'data-action="nav" data-view="det" data-id="'+d.id+'" '+
      'onmouseover="if(!\''+_rowBg+'\')this.style.background=\'#FDFBF9\';" '+
      'onmouseout="this.style.background=\''+(_rowBg||'')+'\'">' +
      '<td style="width:44px;padding:14px 6px 14px 18px;text-align:right;font-size:11px;font-family:\'IBM Plex Mono\',monospace;color:#d0cac6;font-weight:500;vertical-align:top;padding-top:16px">'+(idx+1)+'</td>'+
      '<td style="padding:12px 16px;max-width:0">'+
        '<div style="display:flex;align-items:center;gap:7px;margin-bottom:5px">'+
          '<span class="mono" style="font-size:11px;background:#F5F3F0;color:#18120E;padding:2px 8px;border-radius:5px;border:1px solid rgba(0,0,0,.06);flex-shrink:0;letter-spacing:.3px">'+esc(d.doc_number||'—')+'</span>'+
          tBadge(d.doc_type)+
        '</div>'+
        '<div style="font-size:13px;font-weight:600;color:#18120E;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(d.title)+'</div>'+
        _projHtml+
      '</td>'+
      '<td style="width:148px;padding:12px 16px;vertical-align:top">'+sBadge(d.status)+_whoHtml+'</td>'+
      '<td style="width:88px;padding:12px 16px;text-align:right;vertical-align:top">'+_dueHtml+'</td>'+
      '<td style="width:72px;padding:12px 18px 12px 8px;text-align:right;vertical-align:top">'+
        '<div style="display:flex;gap:5px;justify-content:flex-end">'+
          (CAN.ed(CU.role_code)&&(d.status==='draft'||(d.status==='rejected'&&d.created_by===CU.id))
            ?'<button class="btn btn-soft xs btn-icon" data-action="nav" data-view="edit" data-id="'+d.id+'" title="แก้ไข">'+svg('edit',13)+'</button>'
            :'')+
          '<button style="width:30px;height:30px;border-radius:8px;background:#F5F3F0;color:#6b6560;display:inline-flex;align-items:center;justify-content:center;border:none;cursor:pointer;flex-shrink:0" data-action="nav" data-view="det" data-id="'+d.id+'" title="ดูรายละเอียด">'+svg('eye',13)+'</button>'+
        '</div>'+
      '</td>'+
    '</tr>';
  }

  var allRows=docs.map(function(d,i){return mkDocRow(d,i);}).join('');

  var pgBar='';
  if(totalPages>1){
    var _bs='height:30px;border-radius:7px;font-size:11px;font-weight:700;border:1px solid #E8E5E2;cursor:pointer;padding:0 14px;background:#F5F3F0;';
    pgBar='<tbody id="'+uid+'pg"><tr><td colspan="5" style="padding:10px 18px 12px;border-top:1px solid #F5F3F0">'+
      '<div style="display:flex;align-items:center;gap:10px">'+
        '<button id="'+uid+'prev" onclick="_docPg(\''+uid+'\', -1, '+totalPages+')" disabled '+
        'style="'+_bs+'color:#C8C3BE" onmouseover="if(!this.disabled)this.style.background=\'#ECEAE7\'" onmouseout="if(!this.disabled)this.style.background=\'#F5F3F0\'">◂ ก่อนหน้า</button>'+
        '<span id="'+uid+'lbl" style="font-size:11px;font-weight:600;color:#a89e99;min-width:72px;text-align:center">หน้า 1 / '+totalPages+'</span>'+
        '<button id="'+uid+'next" onclick="_docPg(\''+uid+'\', 1, '+totalPages+')" '+
        'style="'+_bs+'color:#18120E" onmouseover="if(!this.disabled)this.style.background=\'#ECEAE7\'" onmouseout="if(!this.disabled)this.style.background=\'#F5F3F0\'">ถัดไป ▸</button>'+
      '</div>'+
    '</td></tr></tbody>';
  }

  return '<div class="tbl-wrap">'+
    '<table id="'+uid+'" data-pg="0" style="table-layout:fixed;width:100%">'+
      '<thead><tr>'+
        '<th style="width:44px;padding:10px 6px 10px 18px;text-align:right">#</th>'+
        '<th style="padding:10px 16px">เลขที่ / ชื่อเรื่อง</th>'+
        '<th style="width:148px;padding:10px 16px">สถานะ</th>'+
        '<th style="width:88px;padding:10px 16px;text-align:right">กำหนด</th>'+
        '<th style="width:72px;padding:10px 18px 10px 8px"></th>'+
      '</tr></thead>'+
      '<tbody>'+allRows+'</tbody>'+
      pgBar+
    '</table>'+
  '</div>';
}

function _docPg(uid, delta, totalPages){
  var tbl=document.getElementById(uid);
  if(!tbl)return;
  var cur=parseInt(tbl.dataset.pg||0);
  var next=Math.max(0,Math.min(totalPages-1,cur+delta));
  if(next===cur)return;
  tbl.dataset.pg=next;
  var rows=tbl.querySelectorAll('tbody tr[data-pg]');
  for(var i=0;i<rows.length;i++){
    rows[i].style.display=parseInt(rows[i].dataset.pg)===next?'':'none';
  }
  var lbl=document.getElementById(uid+'lbl');
  if(lbl)lbl.textContent='หน้า '+(next+1)+' / '+totalPages;
  var prev=document.getElementById(uid+'prev');
  var nxt=document.getElementById(uid+'next');
  if(prev){prev.disabled=next===0;prev.style.color=next===0?'#C8C3BE':'#18120E';}
  if(nxt){nxt.disabled=next===totalPages-1;nxt.style.color=next===totalPages-1?'#C8C3BE':'#18120E';}
}

/* ── ตาราง "ส่งมาให้ฉัน" — ส่งต่อเอกสารรอตัดสินใจ ── */
function rFwdTbl(docs){
  if(!docs.length) return '<div style="padding:56px 20px;display:flex;flex-direction:column;align-items:center;gap:10px"><div style="opacity:.3;color:#a89e99">'+svg('inbox',40)+'</div><div style="font-size:14px;font-weight:500;color:#a89e99">ไม่มีเอกสารที่รอการตัดสินใจ</div></div>';

  var LIMIT=7;
  function mkFwdRow(d,idx){
    return '<tr style="background:#F2F6FF" '+
      'onmouseover="this.style.background=\'#E9F0FD\'" onmouseout="this.style.background=\'#F2F6FF\'">'+
      '<td style="width:44px;padding:14px 6px 14px 18px;text-align:right;font-size:11px;font-family:\'IBM Plex Mono\',monospace;color:#b8c4e0;font-weight:500;vertical-align:top;padding-top:16px">'+(idx+1)+'</td>'+
      '<td style="padding:12px 16px;max-width:0">'+
        '<div style="display:flex;align-items:center;gap:7px;margin-bottom:5px">'+
          '<span class="mono" style="font-size:11px;background:rgba(255,255,255,.85);color:#1D4ED8;padding:2px 8px;border-radius:5px;border:1px solid rgba(29,78,216,.12);flex-shrink:0;letter-spacing:.3px">'+esc(d.doc_number||'—')+'</span>'+
          tBadge(d.doc_type)+
        '</div>'+
        '<div style="font-size:13px;font-weight:600;color:#18120E;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(d.title)+'</div>'+
        '<div style="font-size:10px;color:#2563EB;margin-top:3px">ส่งมาให้คุณ · '+fd(d.forwarded_at)+'</div>'+
      '</td>'+
      '<td style="width:148px;padding:12px 16px;vertical-align:top">'+sBadge(d.status)+'</td>'+
      '<td style="width:104px;padding:12px 16px;text-align:right;vertical-align:top;font-size:11px;color:#a89e99">'+fd(d.forwarded_at)+'</td>'+
      '<td style="width:160px;padding:10px 14px;text-align:right;vertical-align:top">'+
        '<div style="display:flex;gap:5px;justify-content:flex-end">'+
          '<button style="width:28px;height:28px;border-radius:7px;background:#fff;color:#6b6560;display:inline-flex;align-items:center;justify-content:center;border:1px solid #EBEBEB;cursor:pointer;flex-shrink:0" data-action="nav" data-view="det" data-id="'+d.id+'" title="ดูเอกสาร">'+svg('eye',13)+'</button>'+
          '<button class="btn btn-primary xs" data-action="acceptFwd" data-id="'+d.id+'">'+svg('ok',12)+' รับ</button>'+
          '<button class="btn btn-soft xs" style="color:#DC2626;border-color:#FECACA" data-action="showDeclineFwdModal" data-id="'+d.id+'">'+svg('x',12)+' ไม่รับ</button>'+
        '</div>'+
      '</td>'+
    '</tr>';
  }

  var recent=docs.slice(0,LIMIT);
  var older=docs.slice(LIMIT);

  var recentRows=recent.map(function(d,i){return mkFwdRow(d,i);}).join('');

  var olderTbody='';
  var toggleTbody='';
  if(older.length){
    var olderRows=older.map(function(d,i){return mkFwdRow(d,LIMIT+i);}).join('');
    var uid='fwdOld'+Date.now();
    olderTbody='<tbody id="'+uid+'" style="display:none">'+olderRows+'</tbody>';
    toggleTbody='<tbody><tr><td colspan="5" style="padding:6px 18px 10px;border-top:1px solid #F5F3F0">'+
      '<button data-fwd-toggle="'+uid+'" data-fwd-count="'+older.length+'" onclick="_fwdToggle(this)" '+
      'style="font-size:11px;font-weight:600;color:#E83A00;background:none;border:none;cursor:pointer;padding:0;display:inline-flex;align-items:center;gap:5px">'+
        '▸ ดูรายการก่อนหน้า ('+older.length+' รายการ)'+
      '</button>'+
    '</td></tr></tbody>';
  }

  return '<div class="tbl-wrap">'+
    '<table style="table-layout:fixed;width:100%">'+
      '<thead><tr>'+
        '<th style="width:44px;padding:10px 6px 10px 18px;text-align:right">#</th>'+
        '<th style="padding:10px 16px">เลขที่ / ชื่อเรื่อง</th>'+
        '<th style="width:148px;padding:10px 16px">สถานะ</th>'+
        '<th style="width:104px;padding:10px 16px;text-align:right">วันที่ส่ง</th>'+
        '<th style="width:160px;padding:10px 14px;text-align:right">ดำเนินการ</th>'+
      '</tr></thead>'+
      '<tbody>'+recentRows+'</tbody>'+
      olderTbody+
      toggleTbody+
    '</table>'+
  '</div>';
}

function _fwdToggle(btn){
  var t=document.getElementById(btn.dataset.fwdToggle);
  if(!t)return;
  var opening=t.style.display==='none';
  t.style.display=opening?'':'none';
  btn.textContent=opening?'▾ ซ่อนรายการก่อนหน้า':'▸ ดูรายการก่อนหน้า ('+btn.dataset.fwdCount+' รายการ)';
}

/* ── รับเอกสารที่ส่งมา ── */
function doAcceptFwd(docId){
  showConfirm(
    'รับเอกสาร?',
    'ยืนยันการรับเอกสารที่ส่งต่อมา',
    function(){_doAcceptFwdConfirmedList(docId)},
    {confirmLabel:'รับเอกสาร',confirmClass:'btn-success',icon:'ok',iconBg:'#D1FAE5',iconColor:'#16A34A'}
  );
}
async function _doAcceptFwdConfirmedList(docId){
  try{
    await dp('document_history',{document_id:docId,action:'เจ้าหน้าที่รับเอกสาร',performed_by:CU.id,note:'รับเอกสารที่ส่งต่อมา'});
    _FWD_ACT[docId]='accepted';
    var fwdTab=document.querySelector('[data-tab="fwd"] span');
    if(fwdTab){var n=parseInt(fwdTab.textContent||'0')-1;fwdTab.textContent=Math.max(0,n);}
    fDocs();
  }catch(e){showAlert('เกิดข้อผิดพลาด กรุณาลองใหม่','er')}
}

/* ── ไม่รับเอกสารที่ส่งมา — ใช้ showConfirm แทน confirm() ดิบ ── */
function doDeclineFwd(docId){
  showConfirm(
    'ไม่รับเอกสาร?',
    'เอกสารจะหายออกจากรายการของคุณ',
    function(){_doDeclineFwdConfirmed(docId);},
    {confirmLabel:'ไม่รับ',confirmClass:'btn-danger',icon:'x',iconBg:'#FEF2F2',iconColor:'#DC2626'}
  );
}
async function _doDeclineFwdConfirmed(docId){
  try{
    await dp('document_history',{document_id:docId,action:'ปฏิเสธเอกสาร',performed_by:CU.id,note:'ปฏิเสธเอกสารที่ส่งต่อมา'});
    _FWD_ACT[docId]='declined';
    fDocs();
  }catch(e){showAlert('เกิดข้อผิดพลาด กรุณาลองใหม่','er')}
}
