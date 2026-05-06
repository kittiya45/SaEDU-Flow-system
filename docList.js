/* ─── DOCS LIST ─── */
var _PROJ_FILTER=''; // โครงการที่เลือก filter

async function vDocs(){
  // ดึง workflow steps ของ user ก่อน เพื่อใช้ filter documents ฝั่ง server
  var _mySteps=await dg('workflow_steps','?assigned_to=eq.'+safeId(CU.id)+'&select=document_id,status');
  var _myStepDocIds=_mySteps.map(function(s){return s.document_id});
  MSTEPS=_mySteps.filter(function(s){return s.status==='active'}).map(function(s){return s.document_id});
  var _allDocs;
  if(CU.role_code==='ROLE-SYS'||CU.position_code==='GNK-SEC'){
    _allDocs=await dg('documents','?order=created_at.desc');
  } else if(_myStepDocIds.length){
    _allDocs=await dg('documents','?or=(created_by.eq.'+safeId(CU.id)+',id.in.('+_myStepDocIds.map(safeId).join(',')+'))&order=created_at.desc');
  } else {
    _allDocs=await dg('documents','?created_by=eq.'+safeId(CU.id)+'&order=created_at.desc');
  }
  ADOCS=_allDocs||[];
  DTAB='all'; _PROJ_FILTER='';
  var _myRejectedIds=ADOCS.filter(function(d){return d.status==='rejected'&&d.created_by===CU.id}).map(function(d){return d.id});
  var tc={all:ADOCS.length,pending:0,signed:0,draft:0,rejected:0,numbering:0,completed:0,mine:MSTEPS.length+_myRejectedIds.length};
  ADOCS.forEach(function(d){if(tc[d.status]!==undefined)tc[d.status]++});
  // รวบรวมชื่อโครงการจาก outgoing docs
  var _projSet=[...new Set(ADOCS.filter(function(d){return d.doc_type==='outgoing'&&d.description}).map(function(d){return d.description}))].sort();
  var _projOpts='<option value="">ทุกโครงการ</option>'+_projSet.map(function(p){return '<option value="'+esc(p)+'">'+esc(p)+'</option>'}).join('');

  var html=['<div class="flex gap-2.5 mb-4 flex-wrap items-center">'];
  html.push('<div class="search-wrap"><span class="search-icon">'+svg('srch',14)+'</span><input class="fi min-w-[220px]" id="dsrch" placeholder="ค้นหาชื่อเรื่องหรือเลขที่..." oninput="fDocsDebounced()"></div>');
  html.push('<select class="fi text-[13px]" id="dproj" style="max-width:200px" onchange="_PROJ_FILTER=this.value;fDocs()">'+_projOpts+'</select>');
  if(CAN.cr(CU.role_code)) html.push('<button class="btn btn-primary sm ml-auto" data-action="nav" data-view="new">'+svg('plus',13)+' สร้างเอกสาร</button>');
  html.push('<button class="btn btn-soft sm" data-action="exportCSV" title="ส่งออกรายงาน CSV">'+svg('chart',13)+' ส่งออก CSV</button>');
  html.push('</div>');
  html.push('<div class="page-tabs" id="dtabs">');
  [['all','ทั้งหมด'],['mine','รอฉัน'],['pending','รอลงนาม'],['numbering','รอออกเลข'],['completed','เสร็จสิ้น'],['draft','ร่าง'],['rejected','ส่งคืน']].forEach(function(x){
    var cnt=tc[x[0]]||0;
    var _redTabs=['mine','pending','rejected','numbering'];
    var badgeCls=(_redTabs.includes(x[0])&&cnt>0)?'bg-[#E83A00] text-white':'bg-[#EBEBEB] text-[#a89e99]';
    html.push('<div class="ptab'+(x[0]==='all'?' on':'')+'" data-action="setDT" data-tab="'+x[0]+'">'+x[1]+' <span class="'+badgeCls+' rounded-[10px] px-[7px] py-px text-[11px]">'+cnt+'</span></div>')
  });
  html.push('</div><div class="card mb-0" id="dtbl">'+rDocTbl(ADOCS)+'</div>');
  return html.join('')
}

function setDT(t){
  DTAB=t;
  document.querySelectorAll('#dtabs .ptab').forEach(function(el){
    el.className='ptab'+(el.dataset.tab===t?' on':'')
  });
  fDocs()
}

var fDocsDebounced=debounce(fDocs,200);
function fDocs(){
  var q=(($e('dsrch')||{value:''}).value||'').toLowerCase();
  var f=ADOCS.filter(function(d){
    var matchTab=DTAB==='all'||(DTAB==='mine'?(MSTEPS.indexOf(d.id)!==-1||(d.status==='rejected'&&d.created_by===CU.id)):d.status===DTAB);
    var matchProj=!_PROJ_FILTER||(d.doc_type==='outgoing'&&d.description===_PROJ_FILTER);
    return matchTab&&matchProj&&(!q||d.title.toLowerCase().includes(q)||(d.doc_number||'').includes(q)||(d.description||'').toLowerCase().includes(q));
  });
  var w=$e('dtbl'); if(w)w.innerHTML=rDocTbl(f)
}

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
    html.push('<td>'+sBadge(d.status)+'</td>');
    html.push('<td class="text-[#a89e99] text-xs">'+fd(d.due_date)+'</td>');
    html.push('<td><div class="flex gap-1.5 justify-end">');
    html.push('<button style="width:32px;height:32px;border-radius:9px;border:2px solid #3b82f6;background:#eff6ff;color:#3b82f6;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0" data-action="nav" data-view="det" data-id="'+d.id+'">'+svg('eye',14)+'</button>');
    if(CAN.ed(CU.role_code)&&(d.status==='draft'||(d.status==='rejected'&&d.created_by===CU.id))) html.push('<button class="btn btn-soft sm btn-icon" data-action="nav" data-view="edit" data-id="'+d.id+'">'+svg('edit',14)+'</button>');
    html.push('</div></td></tr>');
  });
  html.push('</tbody></table></div>');
  return html.join('')
}



