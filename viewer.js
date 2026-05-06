/* ─── VIEWER ─── */
function _safeUrl(url){
  try{var u=new URL(url);return u.protocol==='https:'?url:'';}catch(e){return ''}
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
    inner='<div class="ped-toolbar" style="flex-shrink:0">'+
      '<button id="pdf-prev" class="btn btn-soft sm btn-icon">'+svg('back',13)+'</button>'+
      '<span id="pdf-page-info" style="font-size:12px;color:var(--text-3);min-width:80px;text-align:center">กำลังโหลด...</span>'+
      '<button id="pdf-next" class="btn btn-soft sm btn-icon" style="transform:scaleX(-1)">'+svg('back',13)+'</button>'+
      '<div style="width:1px;background:var(--border);height:24px;margin:0 4px"></div>'+
      '<button id="pdf-zoom-out" class="btn btn-soft sm btn-icon" title="ย่อ">'+svg('zout',13)+'</button>'+
      '<span id="pdf-zoom-lbl" style="font-size:11px;color:var(--text-2);min-width:40px;text-align:center;font-weight:600">100%</span>'+
      '<button id="pdf-zoom-in" class="btn btn-soft sm btn-icon" title="ขยาย">'+svg('zin',13)+'</button>'+
      '<button class="btn btn-ghost sm" style="margin-left:auto" data-action="dlFile" data-url="'+(safeUrl||url)+'" data-name="'+esc(name)+'">'+svg('dn',13)+' ดาวน์โหลด</button>'+
      '</div>'+
      (safeUrl?'<div id="pdf-canvas-wrap" class="ped-canvas-area" style="flex:1;min-height:0"><canvas id="pdf-canvas" style="box-shadow:0 2px 16px rgba(0,0,0,.18);border-radius:4px"></canvas></div>':'<p class="p-8 text-[#DC2626]">URL ไม่ถูกต้อง</p>')
  } else if(isImg){
    inner='<div class="p-6 bg-[#F5F5F5] text-center overflow-auto flex-1">'+
      (safeUrl?'<img src="'+safeUrl+'" class="max-w-full rounded-lg shadow-[0_8px_32px_rgba(0,0,0,.15)]" onerror="this.outerHTML=\'<p class=text-[#DC2626]>โหลดรูปไม่ได้</p>\'">':'<p class="text-[#DC2626]">URL ไม่ถูกต้อง</p>')+
      '</div>'
  } else if(isHtml){
    inner='<div class="flex-1 flex flex-col min-h-0">'+
      (safeUrl?'<iframe src="'+safeUrl+'" class="flex-1 border-none w-full min-h-[580px]"></iframe>':'<p class="p-8 text-[#DC2626]">URL ไม่ถูกต้อง</p>')+
      '</div>'
  } else if(isDocx){
    inner='<div class="ped-toolbar" style="flex-shrink:0">'+
      '<span style="font-size:12px;color:var(--text-3)" id="docx-status">กำลังแปลงไฟล์ Word...</span>'+
      '<button class="btn btn-ghost sm" style="margin-left:auto" data-action="dlFile" data-url="'+(safeUrl||url)+'" data-name="'+esc(name)+'">'+svg('dn',13)+' ดาวน์โหลด</button>'+
      '</div>'+
      '<div id="docx-view-wrap" class="ped-canvas-area" style="flex:1;min-height:0">'+
      '<div id="docx-content" class="bg-white max-w-[820px] w-full px-16 py-12 shadow-[0_4px_24px_rgba(0,0,0,.15)] rounded-[4px] min-h-[500px]" style="font-family:TH Sarabun PSK,Sarabun,sans-serif;font-size:15px;line-height:1.8">'+
      '<div class="sp sp-dark" style="width:36px;height:36px;border-width:3px;margin:0 auto 16px"></div>'+
      '<p style="text-align:center;color:var(--text-3)">กำลังแปลงไฟล์ Word...</p>'+
      '</div></div>'
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
  if(isDocx) setTimeout(function(){renderDocxView(url)},100)
  if(isPDF&&safeUrl) setTimeout(function(){renderPdfView(safeUrl)},100)
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

async function renderDocxView(url){
  var content=$e('docx-content');
  var status=$e('docx-status');
  if(!content) return;
  try{
    if(!window.mammoth){
      await loadSc('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');
    }
    var resp=await fetch(url);
    if(!resp.ok) throw new Error('HTTP '+resp.status);
    var buf=await resp.arrayBuffer();
    var result=await mammoth.convertToHtml({arrayBuffer:buf});
    content.innerHTML=result.value||'<p style="color:var(--text-3);text-align:center">(เอกสารว่าง)</p>';
    content.style.cssText='font-family:TH Sarabun PSK,Sarabun,sans-serif;font-size:15px;line-height:1.9;background:#fff;max-width:820px;width:100%;padding:64px;box-shadow:0 4px 24px rgba(0,0,0,.15);border-radius:4px;min-height:500px';
    if(status) status.textContent='แสดงไฟล์ Word สำเร็จ';
    if(result.messages&&result.messages.length){
      var warn=document.createElement('div');
      warn.style.cssText='margin-top:20px;padding:10px 14px;background:#FFFBEB;border-radius:6px;font-size:11px;color:#D97706';
      warn.textContent='หมายเหตุ: รูปแบบบางส่วนอาจแตกต่างจากไฟล์ต้นฉบับ';
      content.appendChild(warn);
    }
  }catch(e){
    if(status) status.textContent='โหลดไม่สำเร็จ';
    content.innerHTML=
      '<div style="text-align:center;padding:40px">'+
      '<p style="font-weight:600;color:#DC2626;margin-bottom:8px">โหลดไฟล์ Word ไม่สำเร็จ</p>'+
      '<p style="font-size:13px;color:var(--text-3);margin-bottom:20px">'+e.message+'</p>'+
      '<button class="btn btn-primary" data-action="dlFile" data-url="'+url+'" data-name="'+esc(name)+'">'+svg('dn',14)+' ดาวน์โหลดแทน</button>'+
      '</div>';
    console.warn('DOCX render failed:',e);
  }
}


