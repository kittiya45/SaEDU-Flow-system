/* ─── APPROVE MODAL & SIGNATURE PLACEMENT ─── */
/* แยกจาก docDetail.js — ต้องโหลดก่อน docDetail.js */

async function showActModal(action,docId){
  var w=$e('mwrap'); if(!w)return;
  var _doc=(await dg('documents','?id=eq.'+docId))[0]||{};
  var isIncoming=_doc.doc_type==='incoming';
  var isApprove=action==='approve';

  // Reject modal: หา cascade destination (step ก่อนหน้าที่จะถูก re-activate)
  var _cascadeTargetModal=null;
  if(!isApprove){
    var _wfModal=await dg('workflow_steps','?document_id=eq.'+docId+'&order=step_number');
    var _curActModal=_wfModal.filter(function(s){return s.status==='active'})[0];
    if(_curActModal){
      for(var _mi=0;_mi<_wfModal.length;_mi++){
        if(_wfModal[_mi].step_number<_curActModal.step_number&&_wfModal[_mi].step_number>1) _cascadeTargetModal=_wfModal[_mi];
      }
    }
  }
  _actSigPos={xFrac:null,yFrac:null};
  _actSigPdf=null; _actSigPage=1; _actSigZoom=1.0;

  if(isApprove){
    // ── โหมดอนุมัติ: 2-column layout (ซ้าย=form, ขวา=PDF preview) ──
    var html=[
      '<div class="mo"><div class="modal" style="max-width:880px;width:95vw">',
      '<div class="modal-head">',
      '<span class="modal-title">'+svg('ok',14)+' ยืนยันการอนุมัติ / ลงนาม</span>',
      '<button class="btn btn-soft sm btn-icon" data-action="closeModal">'+svg('x',14)+'</button>',
      '</div>',
      '<div class="modal-body" style="display:grid;grid-template-columns:280px 1fr;gap:18px;align-items:start;max-height:72vh;overflow:hidden;padding-bottom:0">',

      // ── คอลัมน์ซ้าย: form ──
      '<div style="overflow-y:auto;max-height:72vh;padding-right:4px;padding-bottom:16px">',
      '<div class="al al-ok" style="margin-bottom:12px"><span class="al-icon">'+svg('ok',13)+'</span>',
      '<span style="font-size:12px">คุณกำลังจะอนุมัติและลงนามในเอกสารนี้</span></div>',

      // ลายเซ็น
      '<div class="fg" style="margin-bottom:10px">',
      '<label class="fl">ลายเซ็น'+(isIncoming?' <span class="req">*</span>':'<span style="font-size:10px;color:#a89e99;margin-left:4px">(ไม่บังคับ)</span>')+'</label>',
      '<div class="itabs mb-2"><button class="itab on" id="sig-tab-a" onclick="sigTabA(this.dataset.t)" data-t="draw">วาดลายเซ็น</button><button class="itab" id="sig-tab-b" onclick="sigTabA(this.dataset.t)" data-t="upload">อัปโหลดรูป</button></div>',
      '<div id="sig-panel-draw">',
      '<canvas id="asgc" class="border-[1.5px] border-[#EBEBEB] rounded-[10px] bg-white block w-full cursor-crosshair touch-none" height="110"></canvas>',
      '<button class="btn btn-soft sm mt-1.5 w-full" onclick="clearASig()">ล้างลายเซ็น</button>',
      '</div>',
      '<div id="sig-panel-upload" class="hidden">',
      '<div class="border-2 border-dashed border-[#EBEBEB] rounded-[10px] p-3 text-center cursor-pointer" id="asig-drop-zone">',
      '<div class="flex justify-center mb-1" style="color:#a89e99">'+svg('pen',20)+'</div>',
      '<div class="text-xs font-semibold">คลิกอัปโหลดรูปลายเซ็น</div>',
      '<div class="text-[10px] text-[#a89e99]">PNG โปร่งใสแนะนำ</div></div>',
      '<input type="file" id="asig-file" accept="image/*" class="hidden">',
      '<img id="asig-prev" class="hidden max-h-[60px] mt-2 max-w-full object-contain mx-auto">',
      '</div></div>',

      // หมายเหตุ
      '<div class="fg">',
      '<label class="fl">หมายเหตุ <span style="font-size:10px;color:#a89e99">(ถ้ามี)</span></label>',
      '<textarea class="fi" id="anote" rows="2" placeholder="ระบุหมายเหตุเพิ่มเติม..."></textarea>',
      '</div>',

      // hint
      '<div style="font-size:11px;color:#a89e99;line-height:1.7;display:flex;gap:6px;align-items:flex-start;margin-top:6px">',
      svg('info',12)+'<span>คลิกบนเอกสารด้านขวาเพื่อเลือกตำแหน่งวางลายเซ็น</span>',
      '</div>',
      '</div>',

      // ── คอลัมน์ขวา: toolbar + PDF preview ──
      '<div style="display:flex;flex-direction:column;gap:6px;min-width:0">',
      '<div id="sig-page-ctrl" style="display:none;align-items:center;gap:6px;padding:5px 8px;background:rgba(0,0,0,0.35);border-radius:8px">',
        '<div id="sig-pg-nav" style="display:flex;align-items:center;gap:4px">',
        '<button id="sig-pg-prev" onclick="_sigPageNav(-1)" style="width:26px;height:26px;border-radius:6px;border:none;background:rgba(255,255,255,0.15);color:#fff;cursor:pointer;display:inline-flex;align-items:center;justify-content:center">'+svg('back',12)+'</button>',
        '<span id="sig-page-info" style="color:#fff;font-size:12px;font-weight:600;min-width:60px;text-align:center">หน้า 1/1</span>',
        '<button id="sig-pg-next" onclick="_sigPageNav(1)" style="width:26px;height:26px;border-radius:6px;border:none;background:rgba(255,255,255,0.15);color:#fff;cursor:pointer;display:inline-flex;align-items:center;justify-content:center">'+svg('tri',12)+'</button>',
        '</div>',
        '<div style="display:flex;align-items:center;gap:4px;margin-left:auto">',
        '<button onclick="_sigZoom(-0.25)" title="ซูมออก" style="width:26px;height:26px;border-radius:6px;border:none;background:rgba(255,255,255,0.15);color:#fff;cursor:pointer;display:inline-flex;align-items:center;justify-content:center">'+svg('zout',13)+'</button>',
        '<span id="sig-zoom-info" style="color:#fff;font-size:12px;font-weight:600;min-width:38px;text-align:center">100%</span>',
        '<button onclick="_sigZoom(0.25)" title="ซูมเข้า" style="width:26px;height:26px;border-radius:6px;border:none;background:rgba(255,255,255,0.15);color:#fff;cursor:pointer;display:inline-flex;align-items:center;justify-content:center">'+svg('zin',13)+'</button>',
        '</div>',
      '</div>',
      '<div style="background:#525659;border-radius:8px;overflow:auto;max-height:calc(72vh - 46px);min-height:320px;display:flex;align-items:flex-start;justify-content:center;padding:12px">',
      '<div id="sig-pos-wrap" style="position:relative;line-height:0;cursor:crosshair;display:flex;align-items:center;justify-content:center;width:100%;min-height:296px">',
      '<div style="color:rgba(255,255,255,.7);font-size:13px;display:flex;flex-direction:column;align-items:center;gap:10px">',
      '<span class="sp" style="border-color:rgba(255,255,255,.25);border-top-color:#fff;width:28px;height:28px;border-width:3px"></span>',
      '<span id="sig-pos-hint">กำลังโหลดเอกสาร...</span></div>',
      '</div></div>',
      '</div>',

      '</div>',
      '<div class="modal-foot">',
      '<button class="btn btn-soft" data-action="closeModal">ยกเลิก</button>',
      '<button class="btn btn-success" data-action="doAct" data-act="approve" data-id="'+docId+'">'+svg('ok',13)+' ยืนยันอนุมัติ</button>',
      '</div></div></div>'
    ];
    w.innerHTML=html.join('');
    setTimeout(function(){initActSig();_loadSigPosPreview(docId)},80);
    return;
  }

  // ── โหมดส่งคืน: single-column ──
  var _cascadeTargetName=_cascadeTargetModal?esc(_cascadeTargetModal.step_name):'ผู้จัดทำ (เอกสารจะถูกส่งคืน)';
  var _cascadeSlaNote=_cascadeTargetModal?'ผู้รับจะต้องดำเนินการภายใน 3 วัน (SLA)':'ผู้จัดทำจะต้องแก้ไขและส่งใหม่ภายใน 3 วัน (SLA)';
  var html=[
    '<div class="mo"><div class="modal">',
    '<div class="modal-head">',
    '<span class="modal-title">'+svg('undo',14)+' ยืนยันการส่งคืน</span>',
    '<button class="btn btn-soft sm btn-icon" data-action="closeModal">'+svg('x',14)+'</button>',
    '</div>',
    '<div class="modal-body">',
    '<div class="al al-er" style="margin-bottom:10px">',
    '<span class="al-icon">'+svg('warn',13)+'</span>',
    '<span>คุณกำลังจะส่งคืนเอกสารเพื่อให้แก้ไข</span></div>',
    '<div class="al al-wa" style="margin-bottom:14px;font-size:12px">',
    '<span class="al-icon">'+svg('undo',13)+'</span>',
    '<div><div>ส่งต่อไปยัง: <strong>'+_cascadeTargetName+'</strong></div>',
    '<div style="color:#a89e99;font-size:11px;margin-top:2px">'+_cascadeSlaNote+'</div></div></div>',
    '<div class="fg"><label class="fl">ส่วนที่ต้องแก้ไข <span class="req">*</span></label>',
    '<select class="fi" id="rev-section">',
    '<option value="">— เลือกส่วนที่ต้องแก้ไข —</option>',
    '<option value="ชื่อเรื่อง / หัวเรื่อง">ชื่อเรื่อง / หัวเรื่อง</option>',
    '<option value="เนื้อหาเอกสาร">เนื้อหาเอกสาร</option>',
    '<option value="รูปแบบเอกสาร / การจัดหน้า">รูปแบบเอกสาร / การจัดหน้า</option>',
    '<option value="ข้อมูลผู้ส่ง / ที่อยู่">ข้อมูลผู้ส่ง / ที่อยู่</option>',
    '<option value="ลายเซ็น / การอนุมัติ">ลายเซ็น / การอนุมัติ</option>',
    '<option value="ไฟล์แนบ">ไฟล์แนบ</option>',
    '<option value="อื่น ๆ (ระบุในหมายเหตุ)">อื่น ๆ (ระบุในหมายเหตุ)</option>',
    '</select></div>',
    '<div class="fg"><label class="fl">รายละเอียดที่ต้องแก้ไข</label>',
    '<textarea class="fi" id="anote" rows="3" placeholder="อธิบายรายละเอียดที่ต้องแก้ไขให้ชัดเจน..."></textarea></div>',
    '<div class="fg"><label class="fl">แนบไฟล์วงแก้ไข (ถ้ามี)</label>',
    '<div class="border-2 border-dashed border-[#EBEBEB] rounded-[10px] p-3 text-center cursor-pointer" id="rej-drop-zone" onclick="document.getElementById(\'rej-file\').click()">',
    '<div class="text-xs text-[#a89e99]">คลิกเพื่ออัปโหลด PDF / รูปภาพที่วงหรือไฮไลต์ส่วนที่ต้องแก้ไข</div></div>',
    '<input type="file" id="rej-file" accept=".pdf,image/*" style="display:none" onchange="var n=this.files[0];var d=document.getElementById(\'rej-fname\');if(d&&n)d.textContent=\'✓ \'+n.name;">',
    '<div id="rej-fname" class="text-[11px] text-[#16A34A] font-semibold mt-1"></div></div>',
    '</div>',
    '<div class="modal-foot">',
    '<button class="btn btn-soft" data-action="closeModal">ยกเลิก</button>',
    '<button class="btn btn-danger" data-action="doAct" data-act="reject" data-id="'+docId+'">'+svg('undo',13)+' ยืนยันส่งคืน</button>',
    '</div></div></div>'
  ];
  w.innerHTML=html.join('');
}

// ─── Signature state ───
var _actSigCtx=null, _actSigDrawing=false;
var _actSigPos={xFrac:null,yFrac:null};
var _actSigPdfW=595,_actSigPdfH=842;
var _actSigPdf=null, _actSigPage=1, _actSigZoom=1.0;

function sigTabA(tab){
  $e('sig-tab-a').className='itab'+(tab==='draw'?' on':'');
  $e('sig-tab-b').className='itab'+(tab==='upload'?' on':'');
  $e('sig-panel-draw').style.display=tab==='draw'?'block':'none';
  $e('sig-panel-upload').style.display=tab==='upload'?'block':'none'
}
function initActSig(){
  var sc=$e('asgc'); if(!sc)return;
  sc.width=sc.offsetWidth||380;
  _actSigCtx=sc.getContext('2d');
  var af=$e('asig-file');
  if(af) af.onchange=function(){previewASig(af)};
  var dz=$e('asig-drop-zone');
  if(dz&&af) dz.onclick=function(){af.click()};
  sc.onpointerdown=function(e){_actSigDrawing=true;var r=sc.getBoundingClientRect();_actSigCtx.beginPath();_actSigCtx.moveTo((e.clientX-r.left)*(sc.width/r.width),(e.clientY-r.top)*(sc.height/r.height))};
  sc.onpointermove=function(e){if(!_actSigDrawing)return;var r=sc.getBoundingClientRect();_actSigCtx.lineTo((e.clientX-r.left)*(sc.width/r.width),(e.clientY-r.top)*(sc.height/r.height));_actSigCtx.strokeStyle='#1C1C1E';_actSigCtx.lineWidth=2;_actSigCtx.lineCap='round';_actSigCtx.lineJoin='round';_actSigCtx.stroke()};
  sc.onpointerup=sc.onpointerleave=function(){_actSigDrawing=false}
}
function clearASig(){var sc=$e('asgc');if(sc&&_actSigCtx)_actSigCtx.clearRect(0,0,sc.width,sc.height)}
function previewASig(inp){
  var f=inp.files[0];if(!f)return;
  var r=new FileReader();r.onload=function(e){
    var p=$e('asig-prev');if(p){p.src=e.target.result;p.style.display='block'}
    window._actSigSrc=e.target.result
  };r.readAsDataURL(f)
}
function getActSigSrc(){
  var drawPanel=$e('sig-panel-draw');
  if(drawPanel&&drawPanel.style.display!=='none'){
    var sc=$e('asgc');if(!sc)return null;
    var ctx=sc.getContext('2d');
    var px=ctx.getImageData(0,0,sc.width,sc.height).data;
    var hasContent=false;for(var i=3;i<px.length;i+=4){if(px[i]>10){hasContent=true;break}}
    return hasContent?sc.toDataURL('image/png'):null
  } else {
    return window._actSigSrc||null
  }
}

async function _loadSigPosPreview(docId){
  var wrap=$e('sig-pos-wrap'),hint=$e('sig-pos-hint');
  if(!wrap)return;
  try{
    var files=await dg('document_files','?document_id=eq.'+safeId(docId)+'&file_type=like.application%2Fpdf&order=uploaded_at.desc&limit=1');
    if(!files||!files.length){
      if(hint)hint.textContent='ไม่พบไฟล์ PDF — ลายเซ็นจะวางที่มุมขวาล่างอัตโนมัติ';
      return;
    }
    var fileUrl=furl(files[0].file_path);
    if(!window.pdfjsLib){
      await loadSc('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
      pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    } else if(!pdfjsLib.GlobalWorkerOptions.workerSrc){
      pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    _actSigPdf=await pdfjsLib.getDocument(fileUrl).promise;
    _actSigPage=_actSigPdf.numPages;

    var ctrl=$e('sig-page-ctrl');
    if(ctrl) ctrl.style.display='flex';
    var nav=$e('sig-pg-nav');
    if(nav) nav.style.display=_actSigPdf.numPages>1?'flex':'none';

    await _renderSigPage(_actSigPage,true,wrap,hint);
  }catch(e){
    console.warn('sig pos preview failed:',e);
    if(hint)hint.textContent='ไม่สามารถโหลดเอกสารได้ — ลายเซ็นจะวางที่มุมขวาล่างอัตโนมัติ';
  }
}

async function _renderSigPage(pageNum,resetPos,wrap,hint){
  if(!_actSigPdf)return;
  wrap=wrap||$e('sig-pos-wrap');
  hint=hint||$e('sig-pos-hint');
  if(!wrap)return;
  var page=await _actSigPdf.getPage(pageNum);
  var vp0=page.getViewport({scale:1.0});
  _actSigPdfW=vp0.width; _actSigPdfH=vp0.height;

  var outerW=Math.max((wrap.offsetWidth||480)-24,200);
  var outerH=window.innerHeight*0.6;
  var baseScale=Math.min(outerW/vp0.width,outerH/vp0.height);
  var scale=baseScale*_actSigZoom;
  var sv=page.getViewport({scale:scale});

  var canvas=document.createElement('canvas');
  canvas.id='sig-pos-canvas';
  canvas.width=sv.width; canvas.height=sv.height;
  canvas.style.cssText='display:block;border-radius:4px;box-shadow:0 6px 24px rgba(0,0,0,.5)';
  await page.render({canvasContext:canvas.getContext('2d'),viewport:sv}).promise;

  var ind=document.createElement('div');
  ind.id='sig-pos-ind';
  ind.style.cssText='display:none;position:absolute;border:2px solid #E83A00;background:rgba(232,58,0,0.12);border-radius:3px;pointer-events:none;box-sizing:border-box';

  var cont=document.createElement('div');
  cont.style.cssText='position:relative;flex-shrink:0';
  cont.appendChild(canvas); cont.appendChild(ind);

  wrap.innerHTML='';
  wrap.style.cssText='display:flex;align-items:flex-start;justify-content:center;width:100%;min-height:296px;cursor:crosshair';
  wrap.appendChild(cont);

  if(resetPos||_actSigPos.xFrac===null){
    _actSigPos.xFrac=Math.max(0,Math.min(1-180/_actSigPdfW,(vp0.width-220)/vp0.width));
    _actSigPos.yFrac=Math.max(0,Math.min(1-60/_actSigPdfH,1-(40+60)/_actSigPdfH));
  }
  _updateSigPosIndicator();
  if(hint)hint.textContent='คลิกบนเอกสารเพื่อเลือกตำแหน่งวางลายเซ็น';
  cont.onclick=function(e){
    var cr=canvas.getBoundingClientRect();
    _actSigPos.xFrac=Math.max(0,Math.min(1-180/_actSigPdfW,(e.clientX-cr.left)/cr.width));
    _actSigPos.yFrac=Math.max(0,Math.min(1-60/_actSigPdfH,(e.clientY-cr.top)/cr.height));
    _updateSigPosIndicator();
  };

  var pi=$e('sig-page-info'); if(pi) pi.textContent='หน้า '+pageNum+'/'+_actSigPdf.numPages;
  var zi=$e('sig-zoom-info'); if(zi) zi.textContent=Math.round(_actSigZoom*100)+'%';
  var bp=$e('sig-pg-prev'),bn=$e('sig-pg-next');
  if(bp){bp.disabled=pageNum<=1;bp.style.opacity=pageNum<=1?'0.35':'1';}
  if(bn){bn.disabled=pageNum>=_actSigPdf.numPages;bn.style.opacity=pageNum>=_actSigPdf.numPages?'0.35':'1';}
}

async function _sigPageNav(dir){
  if(!_actSigPdf)return;
  var newPage=_actSigPage+dir;
  if(newPage<1||newPage>_actSigPdf.numPages)return;
  _actSigPage=newPage;
  _actSigPos={xFrac:null,yFrac:null};
  await _renderSigPage(_actSigPage,true);
}

async function _sigZoom(delta){
  if(!_actSigPdf)return;
  var newZoom=Math.round(Math.min(3,Math.max(0.5,_actSigZoom+delta))*100)/100;
  if(newZoom===_actSigZoom)return;
  _actSigZoom=newZoom;
  await _renderSigPage(_actSigPage,false);
}

function _updateSigPosIndicator(){
  var canvas=$e('sig-pos-canvas'),ind=$e('sig-pos-ind');
  if(!canvas||!ind||_actSigPos.xFrac===null)return;
  var cw=canvas.offsetWidth,ch=canvas.offsetHeight;
  ind.style.display='block';
  ind.style.left=(_actSigPos.xFrac*cw)+'px';
  ind.style.top=(_actSigPos.yFrac*ch)+'px';
  ind.style.width=((180/_actSigPdfW)*cw)+'px';
  ind.style.height=((60/_actSigPdfH)*ch)+'px'
}
