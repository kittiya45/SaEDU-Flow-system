/* ─── VIEWER ─── */
function _safeUrl(url){
  try{var u=new URL(url);return u.protocol==='https:'?url:'';}catch(e){return ''}
}
// toolbar + canvas ของตัวแสดง PDF — ใช้ทั้งกรณีเปิดไฟล์ PDF ตรงๆ และกรณีแปลง DOCX→PDF แล้วนำมาแสดง
function _pdfBodyHtml(url,name,safeUrl){
  return '<div class="ped-toolbar" style="flex-shrink:0">'+
    '<button id="pdf-prev" class="btn btn-soft sm btn-icon">'+svg('back',13)+'</button>'+
    '<span id="pdf-page-info" style="font-size:12px;color:var(--text-3);min-width:80px;text-align:center">กำลังโหลด...</span>'+
    '<button id="pdf-next" class="btn btn-soft sm btn-icon" style="transform:scaleX(-1)">'+svg('back',13)+'</button>'+
    '<div style="width:1px;background:var(--border);height:24px;margin:0 4px"></div>'+
    '<button id="pdf-zoom-out" class="btn btn-soft sm btn-icon" title="ย่อ">'+svg('zout',13)+'</button>'+
    '<span id="pdf-zoom-lbl" style="font-size:11px;color:var(--text-2);min-width:40px;text-align:center;font-weight:600">100%</span>'+
    '<button id="pdf-zoom-in" class="btn btn-soft sm btn-icon" title="ขยาย">'+svg('zin',13)+'</button>'+
    '<button class="btn btn-ghost sm" style="margin-left:auto" data-action="dlFile" data-url="'+(safeUrl||url)+'" data-name="'+esc(name)+'">'+svg('dn',13)+' ดาวน์โหลด</button>'+
    '</div>'+
    (safeUrl?'<div id="pdf-canvas-wrap" class="ped-canvas-area" style="flex:1;min-height:0"><canvas id="pdf-canvas" style="box-shadow:0 2px 16px rgba(0,0,0,.18);border-radius:4px"></canvas></div>':'<p class="p-8 text-[#DC2626]">URL ไม่ถูกต้อง</p>');
}
function openViewer(url,name){
  // Audit log: file view
  if(CU&&CDI){
    try{dp('document_history',{document_id:CDI,action:'เปิดดูไฟล์',performed_by:CU.id,note:'เปิดดู: '+name});}catch(e){}
  }
  var w=$e('mwrap'); if(!w)return;
  var lname=name.toLowerCase();
  var isPDF=lname.endsWith('.pdf');
  var isImg=/\.(png|jpg|jpeg|gif|webp)$/i.test(name);
  var isDocx=/\.(docx|doc)$/i.test(name);
  var isHtml=/\.html?$/i.test(name);
  var inner='';
  var safeUrl=_safeUrl(url);
  if(isPDF){
    inner=_pdfBodyHtml(url,name,safeUrl)
  } else if(isImg){
    inner='<div class="p-6 bg-[#F5F5F5] text-center overflow-auto flex-1">'+
      (safeUrl?'<img src="'+safeUrl+'" class="max-w-full rounded-lg shadow-[0_8px_32px_rgba(0,0,0,.15)]" onerror="this.outerHTML=\'<p class=text-[#DC2626]>โหลดรูปไม่ได้</p>\'">':'<p class="text-[#DC2626]">URL ไม่ถูกต้อง</p>')+
      '</div>'
  } else if(isHtml){
    inner='<div class="flex-1 flex flex-col min-h-0">'+
      (safeUrl?'<iframe src="'+safeUrl+'" class="flex-1 border-none w-full min-h-[580px]"></iframe>':'<p class="p-8 text-[#DC2626]">URL ไม่ถูกต้อง</p>')+
      '</div>'
  } else if(isDocx){
    inner='<div id="docx-body" style="display:contents">'+
      '<div class="ped-toolbar" style="flex-shrink:0">'+
      '<span style="font-size:12px;color:var(--text-3)" id="docx-status">กำลังแปลงไฟล์ Word เป็น PDF เพื่อแสดงตัวอย่าง...</span>'+
      '<button class="btn btn-ghost sm" style="margin-left:auto" data-action="dlFile" data-url="'+(safeUrl||url)+'" data-name="'+esc(name)+'">'+svg('dn',13)+' ดาวน์โหลด</button>'+
      '</div>'+
      '<div class="ped-canvas-area" style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center">'+
      (safeUrl?'<div class="sp sp-dark" style="width:36px;height:36px;border-width:3px"></div>':'<p class="p-8 text-[#DC2626]">URL ไม่ถูกต้อง</p>')+
      '</div>'+
      '</div>'
  } else {
    inner='<div class="p-10 text-center text-[#a89e99] flex-1">'+
      '<div class="mb-4 opacity-50">'+svg('doc',48)+'</div>'+
      '<p class="text-[15px] font-semibold mb-2">ไม่รองรับการดูไฟล์ประเภทนี้ในระบบ</p>'+
      '<p class="text-[13px] mb-5">กรุณาดาวน์โหลดไฟล์และเปิดด้วยโปรแกรมที่เหมาะสม</p>'+
      '<button class="btn btn-primary" data-action="dlFile" data-url="'+url+'" data-name="'+esc(name)+'">'+svg('dn',14)+' ดาวน์โหลดไฟล์</button></div>'
  }
  var modalStyle=(isPDF||isDocx)?'height:96vh;max-height:96vh;display:flex;flex-direction:column;overflow:hidden':'';
  w.innerHTML=[
    '<div class="mo mo-lg"><div class="modal modal-lg" style="'+modalStyle+'">',
    '<div class="modal-head" style="flex-shrink:0">',
    '<div style="display:flex;align-items:center;gap:10px">',
    '<span style="color:var(--text-2)">'+svg(isDocx?'doc':isPDF?'pdf_ico':isImg?'img2':'doc',20)+'</span>',
    '<div><div class="modal-title">'+esc(name)+'</div><div style="font-size:11px;color:var(--text-3)">ดูเอกสาร</div></div>',
    '</div>',
    '<div style="display:flex;gap:8px">',
    (isPDF?'':'<button class="btn btn-ghost sm" data-action="dlFile" data-url="'+url+'" data-name="'+esc(name)+'">'+svg('dn',13)+' ดาวน์โหลด</button>'),
    '<button class="btn btn-soft sm btn-icon" data-action="closeModal">'+svg('x',14)+'</button>',
    '</div></div>',
    inner,
    '</div></div>'
  ].join('');
  // Trigger rendering after modal is in DOM
  if(isPDF&&safeUrl) setTimeout(function(){renderPdfView(safeUrl)},100)
  if(isDocx&&safeUrl) setTimeout(function(){renderDocxAsPdf(safeUrl,name)},100)
}

async function renderDocxAsPdf(url,name){
  var status=$e('docx-status');
  var body=$e('docx-body');
  try{
    var headers={apikey:SK,Authorization:H.Authorization,'Content-Type':'application/json'};
    var resp=await fetch(SU+'/functions/v1/convert-docx',{method:'POST',headers:headers,body:JSON.stringify({url:url})});
    var data=await resp.json();
    if(!resp.ok||!data.pdfUrl) throw new Error(data.error||'แปลงไฟล์ไม่สำเร็จ');
    if(body) body.outerHTML=_pdfBodyHtml(data.pdfUrl,name,data.pdfUrl);
    await renderPdfView(data.pdfUrl);
  }catch(e){
    if(status) status.textContent='แปลงไฟล์ไม่สำเร็จ';
    var area=body&&body.querySelector('.ped-canvas-area');
    if(area) area.innerHTML=
      '<div style="padding:40px;text-align:center;color:#DC2626;font-size:13px">ไม่สามารถแสดงตัวอย่างไฟล์ Word ได้<br>'+esc(e.message)+'<br><br>'+
      '<button class="btn btn-primary sm" data-action="dlFile" data-url="'+url+'" data-name="'+esc(name)+'">ดาวน์โหลดไฟล์แทน</button></div>';
    console.warn('DOCX→PDF conversion failed:',e);
  }
}

async function renderPdfView(url){
  var info=$e('pdf-page-info'); var canvas=$e('pdf-canvas');
  if(!canvas) return;
  var curPage=1; var totalPages=1; var pdfDoc=null; var zoom=1.0;
  async function doRender(num){
    var page=await pdfDoc.getPage(num);
    var wrap=$e('pdf-canvas-wrap');
    var availW=wrap?wrap.clientWidth-48:800;
    var vp0=page.getViewport({scale:1});
    var fitScale=Math.min(1.5,availW/vp0.width);
    var scale=fitScale*zoom;
    var vp=page.getViewport({scale:scale});
    canvas.width=vp.width; canvas.height=vp.height;
    var ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    await page.render({canvasContext:ctx,viewport:vp}).promise;
    if(info) info.textContent='หน้า '+num+' / '+totalPages;
    var lbl=$e('pdf-zoom-lbl'); if(lbl) lbl.textContent=Math.round(zoom*100)+'%';
  }
  try{
    if(!window.pdfjsLib){
      await loadSc('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
      window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    pdfDoc=await pdfjsLib.getDocument(url).promise;
    totalPages=pdfDoc.numPages;
    await doRender(1);
    var prev=$e('pdf-prev'); var next=$e('pdf-next');
    var zIn=$e('pdf-zoom-in'); var zOut=$e('pdf-zoom-out');
    if(prev) prev.onclick=async function(){if(curPage>1){curPage--;await doRender(curPage);}};
    if(next) next.onclick=async function(){if(curPage<totalPages){curPage++;await doRender(curPage);}};
    if(zIn) zIn.onclick=async function(){zoom=Math.min(3,zoom+0.25);await doRender(curPage);};
    if(zOut) zOut.onclick=async function(){zoom=Math.max(0.5,zoom-0.25);await doRender(curPage);};
  }catch(e){
    if(info) info.textContent='โหลดไม่สำเร็จ';
    if(canvas) canvas.outerHTML='<div style="padding:40px;text-align:center;color:#DC2626;font-size:14px">โหลด PDF ไม่สำเร็จ: '+e.message+'</div>';
    console.warn('PDF.js failed:',e);
  }
}

