/* ─── VIEWER ─── */
function _safeUrl(url){
  try{var u=new URL(url);return u.protocol==='https:'?url:'';}catch(e){return ''}
}
// toolbar + พื้นที่เลื่อนดู PDF ทุกหน้าแนวตั้ง — ใช้ทั้ง PDF ตรงๆ และ DOCX→PDF
function _pdfBodyHtml(url,name,safeUrl){
  return '<div class="pdf-viewer-body">'+
    '<div class="ped-toolbar" style="flex-shrink:0">'+
    '<span id="pdf-page-info" style="font-size:12px;color:var(--text-3);min-width:120px">กำลังโหลด...</span>'+
    '<div style="width:1px;background:var(--border);height:24px;margin:0 4px"></div>'+
    '<button id="pdf-zoom-out" class="btn btn-soft sm btn-icon" title="ย่อ">'+svg('zout',13)+'</button>'+
    '<span id="pdf-zoom-lbl" style="font-size:11px;color:var(--text-2);min-width:40px;text-align:center;font-weight:600">100%</span>'+
    '<button id="pdf-zoom-in" class="btn btn-soft sm btn-icon" title="ขยาย">'+svg('zin',13)+'</button>'+
    '<span style="font-size:11px;color:var(--text-3);margin-left:4px">เลื่อนในพื้นที่สีเทา</span>'+
    '<button class="btn btn-ghost sm" style="margin-left:auto" data-action="dlFile" data-url="'+(safeUrl||url)+'" data-name="'+esc(name)+'">'+svg('dn',13)+' ดาวน์โหลด</button>'+
    '</div>'+
    (safeUrl?'<div id="pdf-canvas-wrap" class="ped-canvas-area pdf-viewer-scroll">'+
      '<div id="pdf-loading" style="padding:40px;text-align:center;color:var(--text-3);font-size:13px;display:flex;flex-direction:column;align-items:center;gap:10px">'+
      '<span class="sp sp-dark" style="width:28px;height:28px;border-width:3px"></span><span>กำลังโหลดเอกสาร...</span></div>'+
    '</div>':'<p class="p-8 text-[#DC2626]">URL ไม่ถูกต้อง</p>')+
  '</div>';
}
/* เหมือนหน้าแบบฟอร์ม (tmplPreview) — resolveFileUrl + นามสกุลไฟล์ครบ + ส่ง storage path ให้ convert-docx */
function previewFile(urlOrPath,name,ext){
  var displayName=name||'';
  if(ext){
    var sfx='.'+String(ext).toLowerCase();
    if(!displayName.toLowerCase().endsWith(sfx)) displayName+=sfx;
  }else if(urlOrPath&&String(urlOrPath).indexOf('http')!==0){
    var m=String(urlOrPath).match(/\.([^.]+)$/);
    if(m&&!displayName.toLowerCase().endsWith('.'+m[1].toLowerCase())) displayName=(displayName||'file')+'.'+m[1];
  }
  var storagePath=(urlOrPath&&String(urlOrPath).indexOf('http')!==0)?String(urlOrPath):(_storagePathFromUrl(urlOrPath)||'');
  resolveFileUrl(urlOrPath).then(function(u){
    openViewer(u,displayName||name||'file',storagePath||_storagePathFromUrl(u)||'');
  }).catch(function(){
    openViewer(urlOrPath,displayName||name||'file',storagePath||'');
  });
}

function openViewer(url,name,storagePath){
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
    inner='<div id="docx-body" class="pdf-viewer-body">'+
      '<div class="ped-toolbar" style="flex-shrink:0">'+
      '<span style="font-size:12px;color:var(--text-3)" id="docx-status">กำลังแปลงไฟล์ Word เป็น PDF เพื่อแสดงตัวอย่าง...</span>'+
      '<button class="btn btn-ghost sm" style="margin-left:auto" data-action="dlFile" data-path="'+esc(storagePath||'')+'" data-url="'+(safeUrl||url||'')+'" data-name="'+esc(name)+'">'+svg('dn',13)+' ดาวน์โหลด</button>'+
      '</div>'+
      '<div class="ped-canvas-area pdf-viewer-scroll" style="display:flex;align-items:center;justify-content:center">'+
      ((safeUrl||storagePath)?'<div class="sp sp-dark" style="width:36px;height:36px;border-width:3px"></div>':'<p class="p-8 text-[#DC2626]">URL ไม่ถูกต้อง</p>')+
      '</div>'+
      '</div>'
  } else {
    inner='<div class="p-10 text-center text-[#a89e99] flex-1">'+
      '<div class="mb-4 opacity-50">'+svg('doc',48)+'</div>'+
      '<p class="text-[15px] font-semibold mb-2">ไม่รองรับการดูไฟล์ประเภทนี้ในระบบ</p>'+
      '<p class="text-[13px] mb-5">กรุณาดาวน์โหลดไฟล์และเปิดด้วยโปรแกรมที่เหมาะสม</p>'+
      '<button class="btn btn-primary" data-action="dlFile" data-url="'+url+'" data-name="'+esc(name)+'">'+svg('dn',14)+' ดาวน์โหลดไฟล์</button></div>'
  }
  var modalStyle=(isPDF||isDocx)?'height:96vh;max-height:96vh;display:flex;flex-direction:column;overflow:hidden;min-height:0':'';
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
  if(isPDF&&safeUrl) setTimeout(function(){renderPdfView(safeUrl)},150)
  if(isDocx&&(safeUrl||storagePath)) setTimeout(function(){renderDocxAsPdf(safeUrl,name,storagePath)},150)
}

async function _pdfWaitLayout(el){
  for(var i=0;i<24;i++){
    if(el&&el.clientHeight>100&&el.clientWidth>100) return;
    await new Promise(function(r){requestAnimationFrame(r);});
  }
}

async function renderDocxAsPdf(url,name,storagePath){
  var status=$e('docx-status');
  var body=$e('docx-body');
  try{
    var headers={apikey:SK,Authorization:H.Authorization,'Content-Type':'application/json'};
    var path=storagePath||_storagePathFromUrl(url);
    if(!path&&!url) throw new Error('ไม่พบ path ไฟล์');
    var payload=path?{path:path}:{url:url};
    var resp=await fetch(SU+'/functions/v1/convert-docx',{method:'POST',headers:headers,body:JSON.stringify(payload)});
    var data=await resp.json();
    if(!resp.ok||!data.pdfUrl){
      var errMsg=data.error||data.message||'แปลงไฟล์ไม่สำเร็จ';
      throw new Error(errMsg);
    }
    if(body) body.outerHTML=_pdfBodyHtml(data.pdfUrl,name,data.pdfUrl);
    await renderPdfView(data.pdfUrl);
  }catch(e){
    if(status) status.textContent='แปลงไฟล์ไม่สำเร็จ';
    var area=body&&body.querySelector('.ped-canvas-area');
    if(area) area.innerHTML=
      '<div style="padding:40px;text-align:center;color:#DC2626;font-size:13px">ไม่สามารถแสดงตัวอย่างไฟล์ Word ได้<br>'+esc(e.message)+'<br><br>'+
      '<button class="btn btn-primary sm" data-action="dlFile" data-path="'+esc(storagePath||'')+'" data-url="'+esc(url||'')+'" data-name="'+esc(name)+'">ดาวน์โหลดไฟล์แทน</button></div>';
    console.warn('DOCX→PDF conversion failed:',e);
  }
}

async function renderPdfView(url){
  var info=$e('pdf-page-info');
  var wrap=$e('pdf-canvas-wrap');
  if(!wrap) return;
  await _pdfWaitLayout(wrap);
  var zoom=1.0;
  var pdfDoc=null;
  var totalPages=1;

  async function doRenderAll(){
    await _pdfWaitLayout(wrap);
    var availW=Math.max(wrap.clientWidth-48, 240);
    var dpr=window.devicePixelRatio||1;
    var frag=document.createDocumentFragment();

    for(var pi=1; pi<=totalPages; pi++){
      var page=await pdfDoc.getPage(pi);
      var vp0=page.getViewport({scale:1});
      var scale=(availW/vp0.width)*zoom;
      var vpHi=page.getViewport({scale:scale*dpr});

      var slot=document.createElement('div');
      slot.className='pdf-page-slot';
      slot.style.cssText='position:relative;flex-shrink:0;width:'+(vp0.width*scale)+'px;height:'+(vp0.height*scale)+'px;'+
        'box-shadow:0 2px 16px rgba(0,0,0,.18);border-radius:4px;overflow:hidden;background:#fff';

      var inner=document.createElement('div');
      inner.style.cssText='position:absolute;left:0;top:0;width:'+vp0.width+'px;height:'+vp0.height+'px;transform:scale('+scale+');transform-origin:top left';

      var canvas=document.createElement('canvas');
      canvas.width=vpHi.width; canvas.height=vpHi.height;
      canvas.style.cssText='display:block;width:'+vp0.width+'px;height:'+vp0.height+'px';
      await page.render({canvasContext:canvas.getContext('2d'),viewport:vpHi}).promise;

      inner.appendChild(canvas);
      slot.appendChild(inner);

      if(totalPages>1){
        var badge=document.createElement('span');
        badge.style.cssText='position:absolute;right:8px;top:8px;z-index:2;background:rgba(0,0,0,.55);color:#fff;font-size:11px;padding:2px 8px;border-radius:10px;pointer-events:none';
        badge.textContent='หน้า '+pi+'/'+totalPages;
        slot.appendChild(badge);
      }

      frag.appendChild(slot);
    }

    wrap.innerHTML='';
    wrap.appendChild(frag);
    if(info) info.textContent=totalPages>1?(totalPages+' หน้า — เลื่อนดูทั้งหมด'):'1 หน้า';
    var lbl=$e('pdf-zoom-lbl'); if(lbl) lbl.textContent=Math.round(zoom*100)+'%';
  }

  try{
    if(!window.pdfjsLib){
      await loadSc('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
      window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    pdfDoc=await pdfjsLib.getDocument(url).promise;
    totalPages=pdfDoc.numPages;
    await doRenderAll();
    var zIn=$e('pdf-zoom-in'); var zOut=$e('pdf-zoom-out');
    if(zIn) zIn.onclick=async function(){zoom=Math.min(3,zoom+0.25);await doRenderAll();};
    if(zOut) zOut.onclick=async function(){zoom=Math.max(0.5,zoom-0.25);await doRenderAll();};
  }catch(e){
    if(info) info.textContent='โหลดไม่สำเร็จ';
    if(wrap) wrap.innerHTML='<div style="padding:40px;text-align:center;color:#DC2626;font-size:14px">โหลด PDF ไม่สำเร็จ: '+esc(e.message)+'</div>';
    console.warn('PDF.js failed:',e);
  }
}

