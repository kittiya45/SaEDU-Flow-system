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
    inner='<div class="flex-1 flex flex-col bg-[#E8E8E8] min-h-0">'+
      '<div class="px-[18px] py-2.5 bg-[#FAFAFA] border-b border-[#EBEBEB] flex items-center">'+
      '<span class="text-xs text-[#a89e99]">หากไฟล์ไม่แสดง กรุณาดาวน์โหลด</span>'+
      '<a class="btn btn-ghost sm ml-auto" href="'+safeUrl+'" target="_blank">'+svg('dn',12)+' ดาวน์โหลด</a>'+
      '</div>'+
      (safeUrl?'<iframe src="'+safeUrl+'" class="flex-1 border-none w-full min-h-[580px]"></iframe>':'<p class="p-8 text-[#DC2626]">URL ไม่ถูกต้อง</p>')+
      '</div>'
  } else if(isImg){
    inner='<div class="p-6 bg-[#F5F5F5] text-center overflow-auto flex-1">'+
      (safeUrl?'<img src="'+safeUrl+'" class="max-w-full rounded-lg shadow-[0_8px_32px_rgba(0,0,0,.15)]" onerror="this.outerHTML=\'<p class=text-[#DC2626]>โหลดรูปไม่ได้</p>\'">':'<p class="text-[#DC2626]">URL ไม่ถูกต้อง</p>')+
      '</div>'
  } else if(isHtml){
    inner='<div class="flex-1 flex flex-col min-h-0">'+
      (safeUrl?'<iframe src="'+safeUrl+'" class="flex-1 border-none w-full min-h-[580px]"></iframe>':'<p class="p-8 text-[#DC2626]">URL ไม่ถูกต้อง</p>')+
      '</div>'
  } else if(isDocx){
    inner='<div id="docx-view-wrap" class="flex-1 overflow-auto p-8 bg-[#E8E8E8] flex justify-center">'+
      '<div class="bg-white max-w-[820px] w-full px-16 py-12 shadow-[0_4px_24px_rgba(0,0,0,.15)] rounded-[4px] min-h-[500px]" style="font-family:TH Sarabun PSK,Sarabun,sans-serif;font-size:15px;line-height:1.8">'+
      '<div class="sp sp-dark w-8 h-8 border-[3px] mx-auto mt-10"></div>'+
      '<p class="text-center text-[#a89e99]">กำลังแปลงไฟล์ Word...</p>'+
      '</div></div>'
  } else {
    inner='<div class="p-10 text-center text-[#a89e99] flex-1">'+
      '<div class="mb-4 opacity-50">'+svg('doc',48)+'</div>'+
      '<p class="text-[15px] font-semibold mb-2">ไม่รองรับการดูไฟล์ประเภทนี้ในระบบ</p>'+
      '<p class="text-[13px] mb-5">กรุณาดาวน์โหลดไฟล์และเปิดด้วยโปรแกรมที่เหมาะสม</p>'+
      '<a class="btn btn-primary" href="'+url+'" target="_blank" download>'+svg('dn',14)+' ดาวน์โหลดไฟล์</a></div>'
  }
  w.innerHTML=[
    '<div class="mo mo-lg"><div class="modal modal-lg flex flex-col">',
    '<div class="modal-head shrink-0">',
    '<div class="flex items-center gap-2.5">',
    '<span class="text-xl">'+svg(isDocx?'doc':isPDF?'pdf_ico':isImg?'img2':'doc',20)+'</span>',
    '<div><div class="modal-title">'+esc(name)+'</div><div class="text-[11px] text-[#a89e99]">ดูเอกสาร</div></div>',
    '</div>',
    '<div class="flex gap-2">',
    '<a class="btn btn-ghost sm" href="'+url+'" target="_blank">'+svg('dn',13)+' ดาวน์โหลด</a>',
    '<button class="btn btn-soft sm btn-icon" data-action="closeModal">'+svg('x',14)+'</button>',
    '</div></div>',
    inner,
    '</div></div>'
  ].join('');
  // Trigger DOCX rendering after modal is in DOM
  if(isDocx) setTimeout(function(){renderDocxView(url)},100)
}

async function renderDocxView(url){
  var wrap=$e('docx-view-wrap');
  if(!wrap) return;
  var inner=wrap.querySelector('div');
  try{
    if(!window.mammoth){
      await loadSc('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js')
    }
    var resp=await fetch(url);
    if(!resp.ok) throw new Error('HTTP '+resp.status);
    var buf=await resp.arrayBuffer();
    var result=await mammoth.convertToHtml({arrayBuffer:buf});
    if(inner){
      inner.innerHTML=result.value||'<p style="color:var(--text-3)">(เอกสารว่าง)</p>';
      // Apply Thai font styles
      inner.style.fontFamily='TH Sarabun PSK,Sarabun,sans-serif';
      inner.style.fontSize='15px';
      inner.style.lineHeight='1.8';
    }
    // Show warnings if any
    if(result.messages&&result.messages.length&&inner){
      var warnEl=document.createElement('div');
      warnEl.className='mt-5 p-2.5 bg-[#FFFBEB] rounded-[6px] text-[11px] text-[#D97706]';
      warnEl.textContent='หมายเหตุ: รูปแบบบางส่วนอาจแตกต่างจากไฟล์ต้นฉบับ';
      wrap.appendChild(warnEl)
    }
  } catch(e){
    if(inner) inner.innerHTML=
      '<div class="text-center p-10">'+
      '<div class="mb-4 text-[#DC2626]">'+svg('x',32)+'</div>'+
      '<p class="font-semibold text-[#DC2626] mb-2">โหลดไฟล์ Word ไม่สำเร็จ</p>'+
      '<p class="text-[13px] text-[#a89e99] mb-5">'+e.message+'</p>'+
      '<a class="btn btn-primary" href="'+url+'" target="_blank" download>'+svg('dn',14)+' ดาวน์โหลดแทน</a>'+
      '</div>'
  }
}


