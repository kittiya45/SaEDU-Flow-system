/* ─── EXPORT CSV ─── */
async function exportDocPDF(docId){
  var did=docId||CDI; if(!did){alert('ไม่พบเอกสาร');return}
  var doc=(await dg('documents','?id=eq.'+did))[0]; if(!doc)return;
  var wf=await dg('workflow_steps','?document_id=eq.'+did+'&order=step_number');
  var hist=await dg('document_history','?document_id=eq.'+did+'&order=performed_at.asc');
  // Lookup user names
  var uids=[...new Set([doc.created_by].concat(hist.map(function(h){return h.performed_by})).filter(Boolean))];
  var umap={};
  if(uids.length){(await dg('users','?id=in.('+uids.join(',')+')'+'&select=id,full_name')).forEach(function(u){umap[u.id]=u.full_name})}
  var stTh={pending:'รอลงนาม',completed:'เสร็จสิ้น',rejected:'ส่งคืนแก้ไข',draft:'ร่างเอกสาร',signed:'ลงนามแล้ว',done:'ผ่านแล้ว',active:'กำลังดำเนินการ',skipped:'ข้ามขั้นตอน'};
  var wfRows=wf.map(function(s,i){
    var stCl=s.status==='done'?'color:#2E7D32':s.status==='active'?'color:#E65100':'color:#888';
    return '<tr><td>'+(i+1)+'</td><td>'+esc(s.step_name||'')+'</td><td style="'+stCl+'">'+(stTh[s.status]||s.status)+'</td>'+
      '<td>'+(s.completed_at?new Date(s.completed_at).toLocaleString('th-TH',{dateStyle:'short',timeStyle:'short'}):'—')+'</td>'+
      '<td style="font-size:11px">'+esc(s.note||'')+'</td></tr>'
  }).join('');
  var histRows=hist.map(function(h){
    return '<tr><td style="font-size:11px;white-space:nowrap">'+new Date(h.performed_at).toLocaleString('th-TH',{dateStyle:'short',timeStyle:'short'})+'</td>'+
      '<td>'+esc(h.action||'')+'</td><td>'+esc(umap[h.performed_by]||h.performed_by||'')+'</td>'+
      '<td style="font-size:11px">'+esc(h.note||'')+'</td></tr>'
  }).join('');
  var html='<!DOCTYPE html><html><head><meta charset="utf-8">'+
    '<title>รายงานเอกสาร '+esc(doc.doc_number||'')+'</title>'+
    '<style>body{font-family:"Sarabun",sans-serif;font-size:13px;color:#222;margin:32px}'+
    'h1{font-size:18px;margin-bottom:4px}h2{font-size:14px;margin:20px 0 8px;border-bottom:2px solid #E84300;padding-bottom:4px;color:#E84300}'+
    'table{width:100%;border-collapse:collapse;margin-bottom:8px}th,td{border:1px solid #ddd;padding:6px 10px;text-align:left}th{background:#FFF3EE;font-weight:600}'+
    '.meta{display:grid;grid-template-columns:1fr 1fr;gap:4px 20px;margin-bottom:12px}'+
    '.kv{display:flex;gap:8px}.k{color:#666;min-width:110px}.v{font-weight:600}'+
    '@media print{body{margin:16px}}</style>'+
    '<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">'+
    '</head><body>'+
    '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">'+
    '<div style="width:8px;height:40px;background:#E84300;border-radius:4px"></div>'+
    '<div><h1>รายงานเอกสาร: '+esc(doc.title||'')+'</h1>'+
    '<div style="font-size:11px;color:#888">พิมพ์เมื่อ '+new Date().toLocaleString('th-TH')+'</div></div></div>'+
    '<h2>ข้อมูลเอกสาร</h2>'+
    '<div class="meta">'+
    '<div class="kv"><span class="k">เลขที่:</span><span class="v">'+esc(doc.doc_number||'—')+'</span></div>'+
    '<div class="kv"><span class="k">สถานะ:</span><span class="v">'+(stTh[doc.status]||doc.status)+'</span></div>'+
    '<div class="kv"><span class="k">ประเภท:</span><span class="v">'+(DTYPES[doc.doc_type]||doc.doc_type||'')+'</span></div>'+
    '<div class="kv"><span class="k">ความเร่งด่วน:</span><span class="v">'+(URG[doc.urgency]||doc.urgency||'')+'</span></div>'+
    '<div class="kv"><span class="k">จากฝ่าย:</span><span class="v">'+esc(doc.from_department||'—')+'</span></div>'+
    '<div class="kv"><span class="k">เรียน:</span><span class="v">'+esc(doc.addressed_to||'—')+'</span></div>'+
    '<div class="kv"><span class="k">วันที่สร้าง:</span><span class="v">'+new Date(doc.created_at).toLocaleDateString('th-TH')+'</span></div>'+
    '<div class="kv"><span class="k">กำหนดเสร็จ:</span><span class="v">'+(doc.due_date?new Date(doc.due_date).toLocaleDateString('th-TH'):'—')+'</span></div>'+
    '</div>'+
    '<h2>ขั้นตอน Workflow</h2>'+
    '<table><thead><tr><th>#</th><th>ขั้นตอน</th><th>สถานะ</th><th>เสร็จเมื่อ</th><th>หมายเหตุ</th></tr></thead><tbody>'+wfRows+'</tbody></table>'+
    '<h2>ประวัติการดำเนินการ</h2>'+
    '<table><thead><tr><th>วันเวลา</th><th>การดำเนินการ</th><th>ผู้ดำเนินการ</th><th>หมายเหตุ</th></tr></thead><tbody>'+histRows+'</tbody></table>'+
    '<div style="margin-top:24px;font-size:11px;color:#aaa;text-align:right">ระบบเสนอเอกสาร กนค. — สร้างโดยอัตโนมัติ</div>'+
    '<script>window.onload=function(){window.print()}<\/script>'+
    '</body></html>';
  var w=window.open('','_blank');
  if(w){w.document.write(html);w.document.close()}
}

function exportCSV(){
  if(!ADOCS||!ADOCS.length){alert('ไม่มีข้อมูลเอกสารให้ส่งออก');return}
  var headers=['เลขที่เอกสาร','ชื่อเรื่อง','ประเภท','ความเร่งด่วน','สถานะ','จากฝ่าย','เรียน','วันที่สร้าง','Deadline/วันที่กิจกรรม','ผู้สร้าง'];
  var rows=ADOCS.map(function(d){
    return [
      d.doc_number||'—',
      d.title||'',
      DTYPES[d.doc_type]||d.doc_type||'',
      URG[d.urgency]||d.urgency||'',
      STTH[d.status]||d.status||'',
      d.from_department||'',
      d.addressed_to||'',
      d.created_at?new Date(d.created_at).toLocaleDateString('th-TH'):'',
      d.due_date?new Date(d.due_date).toLocaleDateString('th-TH'):'',
      d.created_by||''
    ]
  });
  var csv=[headers].concat(rows).map(function(r){
    return r.map(function(c){return'"'+String(c||'').replace(/"/g,'""')+'"'}).join(',')
  }).join('\r\n');
  var BOM='\ufeff'; // UTF-8 BOM for Excel (Thai charset)
  var blob=new Blob([BOM+csv],{type:'text/csv;charset=utf-8'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url;
  a.download='รายงาน_GNK_'+new Date().toISOString().slice(0,10)+'.csv';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url)
}


