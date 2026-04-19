/* ─── DOCS LIST ─── */
async function vDocs(){
  var _allDocs=await dg('documents','?order=created_at.desc');
  var _mySteps=await dg('workflow_steps','?assigned_to=eq.'+CU.id+'&select=document_id,status');
  var _myStepDocIds=_mySteps.map(function(s){return s.document_id});
  // "รอฉัน" = docs where I have an ACTIVE workflow step
  MSTEPS=_mySteps.filter(function(s){return s.status==='active'}).map(function(s){return s.document_id});
  if(CU.role_code==='ROLE-SYS'||CU.position_code==='GNK-SEC'){
    ADOCS=_allDocs;
  } else {
    ADOCS=_allDocs.filter(function(d){
      return d.created_by===CU.id||_myStepDocIds.indexOf(d.id)!==-1
    })
  }
  DTAB='all';
  var tc={all:ADOCS.length,pending:0,signed:0,draft:0,rejected:0,completed:0,mine:MSTEPS.length};
  ADOCS.forEach(function(d){if(tc[d.status]!==undefined)tc[d.status]++});
  var html=['<div class="flex gap-2.5 mb-4 flex-wrap items-center">'];
  html.push('<div class="search-wrap"><span class="search-icon">'+svg('srch',14)+'</span><input class="fi min-w-[220px]" id="dsrch" placeholder="ค้นหาชื่อเรื่องหรือเลขที่..." oninput="fDocs()"></div>');
  if(CAN.cr(CU.role_code)) html.push('<button class="btn btn-primary sm ml-auto" data-action="nav" data-view="new">'+svg('plus',13)+' สร้างเอกสาร</button>');
  html.push('<button class="btn btn-soft sm" data-action="exportCSV" title="ส่งออกรายงาน CSV">'+svg('chart',13)+' ส่งออก CSV</button>');
  html.push('</div>');
  html.push('<div class="page-tabs" id="dtabs">');
  [['all','ทั้งหมด'],['mine','รอฉัน'],['pending','รอลงนาม'],['completed','เสร็จสิ้น'],['signed','ลงนามแล้ว'],['draft','ร่าง'],['rejected','ส่งคืน']].forEach(function(x){
    var badgeCls=(x[0]==='mine'&&tc['mine']>0)?'bg-[#E83A00] text-white':'bg-[#EBEBEB] text-[#a89e99]';
    html.push('<div class="ptab'+(x[0]==='all'?' on':'')+'" data-action="setDT" data-tab="'+x[0]+'">'+x[1]+' <span class="'+badgeCls+' rounded-[10px] px-[7px] py-px text-[11px]">'+tc[x[0]]+'</span></div>')
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

function fDocs(){
  var q=(($e('dsrch')||{value:''}).value||'').toLowerCase();
  var f=ADOCS.filter(function(d){
    var matchTab=DTAB==='all'||(DTAB==='mine'?MSTEPS.indexOf(d.id)!==-1:d.status===DTAB);
    return matchTab&&(!q||d.title.toLowerCase().includes(q)||(d.doc_number||'').includes(q))
  });
  var w=$e('dtbl'); if(w)w.innerHTML=rDocTbl(f)
}

function rDocTbl(docs){
  if(!docs.length) return '<div class="card-empty"><div class="card-empty-icon">'+svg('srch',40)+'</div><div class="card-empty-text">ไม่พบเอกสาร</div></div>';
  var html=['<div class="tbl-wrap"><table><thead><tr><th>เลขที่</th><th>ชื่อเรื่อง</th><th>ประเภท</th><th>ความเร่งด่วน</th><th>สถานะ</th><th>กำหนดเสร็จ</th><th class="text-right">จัดการ</th></tr></thead><tbody>'];
  docs.forEach(function(d){
    html.push('<tr>');
    html.push('<td><span class="mono">'+esc(d.doc_number||'—')+'</span></td>');
    html.push('<td class="font-semibold max-w-[220px]"><div class="overflow-hidden text-ellipsis whitespace-nowrap">'+esc(d.title)+'</div></td>');
    html.push('<td>'+tBadge(d.doc_type)+'</td>');
    html.push('<td><span class="'+urgCls(d.urgency)+' text-xs font-semibold">'+(URG[d.urgency]||d.urgency)+'</span></td>');
    html.push('<td>'+sBadge(d.status)+'</td>');
    html.push('<td class="text-[#a89e99] text-xs">'+fd(d.due_date)+'</td>');
    html.push('<td><div class="flex gap-1.5 justify-end">');
    html.push('<button class="btn btn-ghost sm btn-icon" data-action="nav" data-view="det" data-id="'+d.id+'">'+svg('eye',14)+'</button>');
    if(CAN.ed(CU.role_code)&&(d.status==='draft'||(d.status==='rejected'&&d.created_by===CU.id))) html.push('<button class="btn btn-soft sm btn-icon" data-action="nav" data-view="edit" data-id="'+d.id+'">'+svg('edit',14)+'</button>');
    html.push('</div></td></tr>');
  });
  html.push('</tbody></table></div>');
  return html.join('')
}



