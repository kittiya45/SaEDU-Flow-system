/* ─── APPROVE MODAL & SIGNATURE PLACEMENT ─── */
/* แยกจาก docDetail.js — ต้องโหลดก่อน docDetail.js */

async function showActModal(action,docId){
  var w=$e('mwrap'); if(!w)return;
  var _doc=(await dg('documents','?id=eq.'+docId))[0]||{};
  var isIncoming=_doc.doc_type==='incoming';
  var isApprove=action==='approve';

  _actSigMarks=[]; _actSigLastIdx=-1;
  _actSigPgDims={}; _actSigDefW=null;
  _actSigPdf=null; _actSigPage=1; _actSigZoom=1.0;
  _actSigColor='#1C1C1E'; _actSigSz=2;
  var sigColors=['#1C1C1E','#D32F2F','#1565C0','#1B5E20','#7B1FA2'];

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
      '<div style="margin-top:10px"><div class="fl" style="margin-bottom:6px">สีหมึก</div>',
      '<div style="display:flex;gap:6px;flex-wrap:wrap">',
      sigColors.map(function(c,i){return '<div class="csw'+(i===0?' on':'')+'" style="width:24px;height:24px;border-radius:50%;cursor:pointer;border:2px solid '+(i===0?'var(--text)':'transparent')+';background:'+c+'" onclick="actSigColor(\''+c+'\',this)"></div>'}).join(''),
      '</div></div>',
      '<div class="fl" style="margin:10px 0 6px">ความหนาเส้น</div>',
      '<input type="range" id="asig-sz" min="1" max="8" value="2" oninput="_actSigSz=+this.value">',
      '</div>',
      '<div id="sig-panel-upload" class="hidden">',
      '<label for="asig-file" class="upload-zone" id="asig-drop-zone" style="min-height:104px;padding:14px;border-radius:12px">',
      '<div class="upload-zone-inner" style="gap:4px">',
      '<div class="upload-zone-icon" style="margin-bottom:0;opacity:.35;transform:scale(.85)">'+svg('pen',30)+'</div>',
      '<div class="upload-zone-text" style="font-size:12.5px">คลิกเพื่ออัปโหลดรูปลายเซ็น</div>',
      '<div class="upload-zone-hint">PNG พื้นหลังโปร่งใส แนะนำ</div>',
      '</div></label>',
      '<input type="file" id="asig-file" accept="image/*" class="hidden">',
      '<div id="asig-prev-wrap" class="hidden" style="margin-top:8px;display:flex;align-items:center;gap:10px;border:1px solid #EBEBEB;border-radius:12px;padding:10px;background:#fff">',
      '<img id="asig-prev" style="height:72px;max-width:150px;object-fit:contain">',
      '<button type="button" class="btn btn-soft sm" id="asig-change" style="margin-left:auto;flex-shrink:0">เปลี่ยนรูป</button>',
      '</div>',
      '</div></div>',

      // ตำแหน่งวางลายเซ็น (หลายจุด หลายหน้าได้)
      '<div class="fg" style="margin-bottom:10px">',
      '<label class="fl" style="display:flex;align-items:center;gap:6px">ตำแหน่งวางลายเซ็น',
      '<span id="sig-mark-count" style="font-size:10px;font-weight:700;color:#C03200;background:#FFF5F0;border-radius:20px;padding:1px 8px">0 จุด</span></label>',
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">',
      '<span style="font-size:11px;color:#6B6560;flex-shrink:0">ขนาดลายเซ็น</span>',
      '<input type="range" id="sig-size" min="6" max="50" value="30" style="flex:1;min-width:0" oninput="_sigSizeAll(+this.value)">',
      '<span id="sig-size-val" style="font-size:11px;font-weight:600;color:#6B6560;min-width:34px;text-align:right">30%</span>',
      '</div>',
      '<div id="sig-mark-list" style="display:flex;flex-wrap:wrap;gap:6px"></div>',
      '<button type="button" class="btn btn-soft sm w-full" id="sig-all-pages" style="display:none;margin-top:8px" onclick="_sigStampAllPages()">'+svg('copy',12)+' วางตำแหน่งเดียวกันทุกหน้า</button>',
      '</div>',

      // หมายเหตุ
      '<div class="fg">',
      '<label class="fl">หมายเหตุ <span style="font-size:10px;color:#a89e99">(ถ้ามี)</span></label>',
      '<textarea class="fi" id="anote" rows="2" placeholder="ระบุหมายเหตุเพิ่มเติม..."></textarea>',
      '</div>',

      // hint
      '<div style="font-size:11px;color:#a89e99;line-height:1.7;display:flex;gap:6px;align-items:flex-start;margin-top:6px">',
      svg('info',12)+'<span>เลื่อนดูเอกสารได้ทุกหน้า · ลากกรอบลายเซ็นเพื่อย้ายตำแหน่ง · คลิกพื้นที่ว่างเพื่อเพิ่มจุดวาง · ปรับขนาดด้วยแถบ "ขนาดลายเซ็น" หรือลากมุมสีส้ม</span>',
      '</div>',
      '</div>',

      // ── คอลัมน์ขวา: toolbar + PDF preview ──
      '<div style="display:flex;flex-direction:column;gap:6px;min-width:0">',
      '<div id="sig-page-ctrl" style="display:none;align-items:center;gap:6px;padding:5px 8px;background:rgba(0,0,0,0.35);border-radius:8px">',
        '<div id="sig-pg-nav" style="display:flex;align-items:center;gap:4px">',
        '<button id="sig-pg-prev" onclick="_sigPageNav(-1)" style="width:26px;height:26px;border-radius:6px;border:none;background:rgba(255,255,255,0.15);color:#fff;cursor:pointer;display:inline-flex;align-items:center;justify-content:center">'+svg('back',12)+'</button>',
        '<select id="sig-page-sel" onchange="_sigGoPage(+this.value)" title="เลือกหน้า" style="background:rgba(255,255,255,0.15);color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;padding:4px 8px;cursor:pointer;-webkit-appearance:none;appearance:none;text-align:center;min-width:66px"><option>หน้า 1</option></select>',
        '<span id="sig-page-total" style="color:#fff;font-size:12px;font-weight:600;opacity:.75">/ 1</span>',
        '<button id="sig-pg-next" onclick="_sigPageNav(1)" style="width:26px;height:26px;border-radius:6px;border:none;background:rgba(255,255,255,0.15);color:#fff;cursor:pointer;display:inline-flex;align-items:center;justify-content:center">'+svg('tri',12)+'</button>',
        '</div>',
        '<div style="display:flex;align-items:center;gap:4px;margin-left:auto">',
        '<button onclick="_sigZoom(-0.25)" title="ซูมออก" style="width:26px;height:26px;border-radius:6px;border:none;background:rgba(255,255,255,0.15);color:#fff;cursor:pointer;display:inline-flex;align-items:center;justify-content:center">'+svg('zout',13)+'</button>',
        '<span id="sig-zoom-info" style="color:#fff;font-size:12px;font-weight:600;min-width:38px;text-align:center">100%</span>',
        '<button onclick="_sigZoom(0.25)" title="ซูมเข้า" style="width:26px;height:26px;border-radius:6px;border:none;background:rgba(255,255,255,0.15);color:#fff;cursor:pointer;display:inline-flex;align-items:center;justify-content:center">'+svg('zin',13)+'</button>',
        '</div>',
      '</div>',
      '<div id="sig-scroll" onscroll="_sigScrollSync()" style="background:#525659;border-radius:8px;overflow:auto;max-height:calc(72vh - 46px);min-height:320px;display:flex;align-items:flex-start;justify-content:center;padding:12px">',
      '<div id="sig-pos-wrap" style="position:relative;line-height:0;display:flex;align-items:center;justify-content:center;width:100%;min-height:296px">',
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
    setTimeout(function(){initActSig();_renderSigMarkList();_loadSigPosPreview(docId)},80);
    return;
  }

  // ── โหมดส่งคืน: single-column ──
  // ตีกลับกลับไปหาผู้จัดทำเอกสารโดยตรงเสมอ (ไม่ cascade ทีละขั้นแล้ว — ดู doAct() ใน docDetail.js)
  var _cascadeTargetName='ผู้จัดทำ (เอกสารจะถูกส่งคืน)';
  var _cascadeSlaNote='ผู้จัดทำจะต้องแก้ไขและส่งใหม่ภายใน '+(SETT.sla_cascade_days||3)+' วัน (SLA)';
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
var _actSigColor='#1C1C1E', _actSigSz=2;
var _actSigMarks=[];   // จุดวางลายเซ็น {page,xFrac,yFrac,wFrac,hFrac} — สัดส่วนเทียบขนาดหน้านั้น
var _actSigLastIdx=-1; // จุดที่แตะล่าสุด ใช้เป็นต้นแบบของ "วางตำแหน่งเดียวกันทุกหน้า"
var _actSigPgDims={};  // ขนาดหน้าแต่ละหน้า (pt) {p:{w,h}} — รองรับเอกสารที่หน้าไม่เท่ากัน
var _actSigDefW=null;  // ขนาดลายเซ็น (สัดส่วนความกว้างหน้า) จากแถบ "ขนาดลายเซ็น" — null = ค่าเริ่มต้น 180pt
var _actSigPdfW=595,_actSigPdfH=842;
var _actSigPdf=null, _actSigPage=1, _actSigZoom=1.0;

function sigTabA(tab){
  $e('sig-tab-a').className='itab'+(tab==='draw'?' on':'');
  $e('sig-tab-b').className='itab'+(tab==='upload'?' on':'');
  $e('sig-panel-draw').style.display=tab==='draw'?'block':'none';
  $e('sig-panel-upload').style.display=tab==='upload'?'block':'none';
  _updateSigPosIndicator();
}
function initActSig(){
  var sc=$e('asgc'); if(!sc)return;
  sc.width=sc.offsetWidth||380;
  _actSigCtx=sc.getContext('2d');
  var af=$e('asig-file');
  if(af) af.onchange=function(){previewASig(af)};
  _wireDropzone($e('asig-drop-zone'),af,previewASig);
  var ach=$e('asig-change');
  if(ach) ach.onclick=function(){
    var w=$e('asig-prev-wrap');if(w)w.classList.add('hidden');
    var dz=$e('asig-drop-zone');if(dz)dz.classList.remove('hidden');
    if(af)af.value='';
    window._actSigSrc=null;
    _updateSigPosIndicator();
  };
  sc.onpointerdown=function(e){_actSigDrawing=true;var r=sc.getBoundingClientRect();_actSigCtx.beginPath();_actSigCtx.moveTo((e.clientX-r.left)*(sc.width/r.width),(e.clientY-r.top)*(sc.height/r.height))};
  sc.onpointermove=function(e){if(!_actSigDrawing)return;var r=sc.getBoundingClientRect();_actSigCtx.lineTo((e.clientX-r.left)*(sc.width/r.width),(e.clientY-r.top)*(sc.height/r.height));_actSigCtx.strokeStyle=_actSigColor;_actSigCtx.lineWidth=_actSigSz;_actSigCtx.lineCap='round';_actSigCtx.lineJoin='round';_actSigCtx.stroke()};
  sc.onpointerup=sc.onpointerleave=function(){if(_actSigDrawing){_actSigDrawing=false;_updateSigPosIndicator()}}
}
function actSigColor(c,el){
  _actSigColor=c;
  document.querySelectorAll('#sig-panel-draw .csw').forEach(function(s){s.classList.remove('on')});
  if(el)el.classList.add('on')
}
function clearASig(){var sc=$e('asgc');if(sc&&_actSigCtx)_actSigCtx.clearRect(0,0,sc.width,sc.height);_updateSigPosIndicator()}
function previewASig(inp){
  var f=inp.files[0];if(!f)return;
  var r=new FileReader();r.onload=function(e){
    var p=$e('asig-prev');if(p)p.src=e.target.result;
    var w=$e('asig-prev-wrap');if(w)w.classList.remove('hidden');
    var dz=$e('asig-drop-zone');if(dz)dz.classList.add('hidden');
    window._actSigSrc=e.target.result;
    _updateSigPosIndicator();
  };r.readAsDataURL(f)
}
function getActSigSrc(){
  var drawPanel=$e('sig-panel-draw');
  if(drawPanel&&drawPanel.style.display!=='none'){
    var sc=$e('asgc');if(!sc)return null;
    return _cropSigCanvas(sc);
  } else {
    return window._actSigSrc||null
  }
}

/* ตัดขอบโปร่งใสรอบเส้นลายเซ็นที่วาดออกก่อนใช้งาน — ถ้าไม่ตัด พื้นที่ว่างรอบเส้นจะถูกนับ
   เป็นส่วนหนึ่งของรูป ทำให้ลายเซ็นที่ฝังจริงดูเล็กกว่ากรอบที่เห็นใน preview มาก */
function _cropSigCanvas(sc){
  var w=sc.width,h=sc.height; if(!w||!h)return null;
  var d=sc.getContext('2d').getImageData(0,0,w,h).data;
  var minX=w,minY=h,maxX=-1,maxY=-1;
  for(var y=0;y<h;y++){
    for(var x=0;x<w;x++){
      if(d[(y*w+x)*4+3]>10){
        if(x<minX)minX=x; if(x>maxX)maxX=x;
        if(y<minY)minY=y; if(y>maxY)maxY=y;
      }
    }
  }
  if(maxX<0)return null; // ยังไม่ได้วาดอะไร
  var pad=4;
  minX=Math.max(0,minX-pad);minY=Math.max(0,minY-pad);
  maxX=Math.min(w-1,maxX+pad);maxY=Math.min(h-1,maxY+pad);
  var cw=maxX-minX+1,ch=maxY-minY+1;
  var oc=document.createElement('canvas');oc.width=cw;oc.height=ch;
  oc.getContext('2d').drawImage(sc,minX,minY,cw,ch,0,0,cw,ch);
  return oc.toDataURL('image/png');
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
    var fileUrl=await resolveFilePath(files[0].file_path);
    if(!window.pdfjsLib){
      await loadSc('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
      pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    } else if(!pdfjsLib.GlobalWorkerOptions.workerSrc){
      pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    _actSigPdf=await pdfjsLib.getDocument(fileUrl).promise;
    var N=_actSigPdf.numPages;
    _actSigPage=N;

    var ctrl=$e('sig-page-ctrl');
    if(ctrl) ctrl.style.display='flex';
    var nav=$e('sig-pg-nav');
    if(nav) nav.style.display=N>1?'flex':'none';
    var allBtn=$e('sig-all-pages');
    if(allBtn&&N>1) allBtn.style.display='';
    var sel=$e('sig-page-sel');
    if(sel){
      var opts='';for(var p=1;p<=N;p++)opts+='<option value="'+p+'">หน้า '+p+'</option>';
      sel.innerHTML=opts;
    }
    var tot=$e('sig-page-total'); if(tot)tot.textContent='/ '+N;

    await _renderSigDoc();
    // ตั้งค่าแถบ "ขนาดลายเซ็น" ตามค่าเริ่มต้นของหน้าสุดท้าย
    var defPct=Math.round(_sigDefaultWFrac(N)*100);
    var sl=$e('sig-size'); if(sl)sl.value=defPct;
    var slv=$e('sig-size-val'); if(slv)slv.textContent=defPct+'%';
    _seedDefaultMark();
    _sigGoPage(N,true);
  }catch(e){
    console.warn('sig pos preview failed:',e);
    if(hint)hint.textContent='ไม่สามารถโหลดเอกสารได้ — ลายเซ็นจะวางที่มุมขวาล่างอัตโนมัติ';
  }
}

/* เรนเดอร์ทุกหน้าเรียงต่อกันแนวตั้ง (เลื่อนดูได้เหมือน PDF viewer) — แต่ละหน้ามีเลเยอร์วางลายเซ็นของตัวเอง */
async function _renderSigDoc(keepPage){
  if(!_actSigPdf)return;
  var wrap=$e('sig-pos-wrap'); if(!wrap)return;
  var N=_actSigPdf.numPages;
  var outerW=Math.max((wrap.offsetWidth||480)-24,200);
  var outerH=window.innerHeight*0.6;
  wrap.innerHTML='';
  wrap.style.cssText='position:relative;line-height:0;display:flex;flex-direction:column;align-items:center;gap:14px;width:100%;min-height:296px';
  for(var p=1;p<=N;p++){
    var page=await _actSigPdf.getPage(p);
    var vp0=page.getViewport({scale:1.0});
    _actSigPgDims[p]={w:vp0.width,h:vp0.height};
    if(p===N){_actSigPdfW=vp0.width;_actSigPdfH=vp0.height;}
    var baseScale=Math.min(outerW/vp0.width,outerH/vp0.height);
    var sv=page.getViewport({scale:baseScale*_actSigZoom});
    var canvas=document.createElement('canvas');
    canvas.id='sig-canvas-p'+p;
    canvas.width=sv.width; canvas.height=sv.height;
    canvas.style.cssText='display:block;border-radius:4px;box-shadow:0 6px 24px rgba(0,0,0,.5)';
    await page.render({canvasContext:canvas.getContext('2d'),viewport:sv}).promise;

    // เลเยอร์วางลายเซ็น: คลิกพื้นที่ว่าง = เพิ่มจุดใหม่บนหน้านั้น, ลากกรอบ = ย้ายตำแหน่ง
    var layer=document.createElement('div');
    layer.id='sig-layer-p'+p;
    layer.className='sig-layer';
    layer.dataset.page=p;
    layer.style.cssText='position:absolute;inset:0;cursor:crosshair';
    layer.onclick=(function(pp,cv,ly){return function(e){
      if(e.target!==ly)return;
      var cr=cv.getBoundingClientRect();
      _addSigMarkAt((e.clientX-cr.left)/cr.width,(e.clientY-cr.top)/cr.height,pp);
    }})(p,canvas,layer);

    var badge=document.createElement('div');
    badge.textContent=p+' / '+N;
    badge.style.cssText='position:absolute;left:6px;bottom:6px;background:rgba(0,0,0,.45);color:#fff;font-size:10px;font-weight:600;padding:2px 7px;border-radius:10px;pointer-events:none;line-height:1.5';

    var cont=document.createElement('div');
    cont.className='sig-pg-cont';
    cont.dataset.page=p;
    cont.style.cssText='position:relative;flex-shrink:0;line-height:0';
    cont.appendChild(canvas); cont.appendChild(layer); cont.appendChild(badge);
    wrap.appendChild(cont);
  }
  _renderSigStamps();
  var zi=$e('sig-zoom-info'); if(zi) zi.textContent=Math.round(_actSigZoom*100)+'%';
  if(keepPage)_sigGoPage(_actSigPage,true);
  else _sigPageUI(_actSigPage);
  requestAnimationFrame(function(){_renderSigStamps()});
}

/* กระโดดไปหน้า p (จาก dropdown / ปุ่มลูกศร / chip) */
function _sigGoPage(p,instant){
  if(!_actSigPdf)return;
  p=Math.min(Math.max(+p||1,1),_actSigPdf.numPages);
  _actSigPage=p;
  var sc=$e('sig-scroll'),cont=document.querySelector('.sig-pg-cont[data-page="'+p+'"]');
  if(sc&&cont){
    var top=cont.getBoundingClientRect().top-sc.getBoundingClientRect().top+sc.scrollTop-12;
    sc.scrollTo({top:Math.max(0,top),behavior:instant?'auto':'smooth'});
  }
  _sigPageUI(p);
}

function _sigPageNav(dir){_sigGoPage(_actSigPage+dir)}

function _sigPageUI(p){
  var sel=$e('sig-page-sel'); if(sel&&+sel.value!==p)sel.value=p;
  var N=_actSigPdf?_actSigPdf.numPages:1;
  var bp=$e('sig-pg-prev'),bn=$e('sig-pg-next');
  if(bp){bp.disabled=p<=1;bp.style.opacity=p<=1?'0.35':'1';}
  if(bn){bn.disabled=p>=N;bn.style.opacity=p>=N?'0.35':'1';}
}

/* sync dropdown เลขหน้ากับตำแหน่ง scroll (หน้าที่อยู่กลางจอ) */
var _sigScrollTick=false;
function _sigScrollSync(){
  if(_sigScrollTick)return;
  _sigScrollTick=true;
  requestAnimationFrame(function(){
    _sigScrollTick=false;
    var sc=$e('sig-scroll'); if(!sc)return;
    var mid=sc.getBoundingClientRect().top+sc.clientHeight/2;
    var best=null,bd=1e9;
    document.querySelectorAll('.sig-pg-cont').forEach(function(c){
      var r=c.getBoundingClientRect();
      var d=Math.abs((r.top+r.height/2)-mid);
      if(d<bd){bd=d;best=c}
    });
    if(best){_actSigPage=+best.dataset.page;_sigPageUI(_actSigPage);}
  });
}

async function _sigZoom(delta){
  if(!_actSigPdf)return;
  var newZoom=Math.round(Math.min(3,Math.max(0.5,_actSigZoom+delta))*100)/100;
  if(newZoom===_actSigZoom)return;
  _actSigZoom=newZoom;
  await _renderSigDoc(true);
}

// ─── Multi-stamp placement ───
function _sigPgDim(p){return _actSigPgDims[p]||{w:_actSigPdfW,h:_actSigPdfH}}
function _sigDefaultWFrac(p){if(_actSigDefW)return _actSigDefW;var d=_sigPgDim(p);return Math.min(180/d.w,0.5)}
function _sigHFrac(wf,p){var d=_sigPgDim(p);return (wf*d.w/3)/d.h} // กรอบสัดส่วน 3:1 เทียบขนาดหน้านั้น

/* แถบ "ขนาดลายเซ็น" — ปรับทุกจุดพร้อมกัน (ลายเซ็นเดียวกันควรขนาดเท่ากันทุกจุด) และเป็นค่าเริ่มต้นของจุดใหม่ */
function _sigSizeAll(pct){
  var v=$e('sig-size-val'); if(v)v.textContent=pct+'%';
  _actSigDefW=pct/100;
  _actSigMarks.forEach(function(m){
    m.wFrac=_actSigDefW;
    m.hFrac=_sigHFrac(m.wFrac,m.page);
    m.xFrac=Math.min(m.xFrac,Math.max(0,1-m.wFrac));
    m.yFrac=Math.min(m.yFrac,Math.max(0,1-m.hFrac));
  });
  _renderSigStamps();
}

/* จุดเริ่มต้น: มุมขวาล่างหน้าสุดท้าย (พฤติกรรมเดิมของระบบ) — ลากปรับต่อได้เลย */
function _seedDefaultMark(){
  if(_actSigMarks.length||!_actSigPdf)return;
  var p=_actSigPdf.numPages;
  var wf=_sigDefaultWFrac(p),hf=_sigHFrac(wf,p),d=_sigPgDim(p);
  _actSigMarks.push({page:p,wFrac:wf,hFrac:hf,
    xFrac:Math.max(0,1-wf-40/d.w),
    yFrac:Math.max(0,1-hf-40/d.h)});
  _actSigLastIdx=0;
  _renderSigStamps();_renderSigMarkList();
}

function _addSigMarkAt(xf,yf,p){
  p=p||_actSigPage;
  var wf=_sigDefaultWFrac(p),hf=_sigHFrac(wf,p);
  _actSigMarks.push({page:p,wFrac:wf,hFrac:hf,
    xFrac:Math.max(0,Math.min(1-wf,xf-wf/2)),
    yFrac:Math.max(0,Math.min(1-hf,yf-hf/2))});
  _actSigLastIdx=_actSigMarks.length-1;
  _renderSigStamps();_renderSigMarkList();
}

function _rmSigMark(i){
  _actSigMarks.splice(i,1);
  if(_actSigLastIdx>=_actSigMarks.length)_actSigLastIdx=_actSigMarks.length-1;
  _renderSigStamps();_renderSigMarkList();
}

/* วางลายเซ็นตำแหน่งเดียวกันบนทุกหน้าที่ยังไม่มีจุด (ใช้จุดล่าสุดเป็นต้นแบบ) */
function _sigStampAllPages(){
  if(!_actSigPdf)return;
  var ref=_actSigMarks[_actSigLastIdx]||_actSigMarks[_actSigMarks.length-1]||null;
  var have={};_actSigMarks.forEach(function(m){have[m.page]=1});
  for(var p=1;p<=_actSigPdf.numPages;p++){
    if(have[p])continue;
    var wf=ref?ref.wFrac:_sigDefaultWFrac(p);
    var hf=_sigHFrac(wf,p),d=_sigPgDim(p);
    var xf=ref?Math.min(ref.xFrac,Math.max(0,1-wf)):Math.max(0,1-wf-40/d.w);
    var yf=ref?Math.min(ref.yFrac,Math.max(0,1-hf)):Math.max(0,1-hf-40/d.h);
    _actSigMarks.push({page:p,xFrac:xf,yFrac:yf,wFrac:wf,hFrac:hf});
  }
  _renderSigStamps();_renderSigMarkList();
}

/* วาดกรอบลายเซ็นทุกจุดลงบนเลเยอร์ของหน้าที่จุดนั้นอยู่ (ทุกหน้าแสดงพร้อมกันใน scroll viewer) */
function _renderSigStamps(){
  document.querySelectorAll('#sig-pos-wrap .sig-layer').forEach(function(l){l.innerHTML=''});
  _actSigMarks.forEach(function(m,i){
    var layer=$e('sig-layer-p'+m.page),canvas=$e('sig-canvas-p'+m.page);
    if(!layer||!canvas)return;
    var cr=canvas.getBoundingClientRect();
    layer.appendChild(_mkStampEl(m,i,cr.width,cr.height));
  });
}

function _mkStampEl(m,i,cw,ch){
  var hf=m.hFrac!=null?m.hFrac:_sigHFrac(m.wFrac,m.page);
  var w=m.wFrac*cw,h=hf*ch;
  var el=document.createElement('div');
  el.className='sig-stamp';
  el.dataset.idx=i;
  el.style.cssText='position:absolute;box-sizing:border-box;border:1.5px solid #E83A00;border-radius:4px;cursor:grab;touch-action:none;left:'+(m.xFrac*cw)+'px;top:'+(m.yFrac*ch)+'px;width:'+w+'px;height:'+h+'px';
  _paintStamp(el);

  var del=document.createElement('button');
  del.type='button';
  del.innerHTML='&times;';
  del.title='ลบจุดนี้';
  del.style.cssText='position:absolute;top:-9px;right:-9px;width:18px;height:18px;border-radius:50%;border:1px solid #EBEBEB;background:#fff;color:#18120E;font-size:12px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;box-shadow:0 1px 3px rgba(0,0,0,.15)';
  del.onpointerdown=function(e){e.stopPropagation()};
  del.onclick=function(e){e.stopPropagation();_rmSigMark(i)};
  el.appendChild(del);

  var rz=document.createElement('div');
  rz.title='ลากเพื่อปรับขนาด';
  rz.style.cssText='position:absolute;right:-9px;bottom:-9px;width:18px;height:18px;border-radius:4px;background:#E83A00;border:2.5px solid #fff;cursor:nwse-resize;touch-action:none;box-shadow:0 1px 3px rgba(0,0,0,.25)';
  el.appendChild(rz);

  // ลากย้ายตำแหน่ง (pointer capture — รองรับทั้งเมาส์และนิ้ว)
  el.onpointerdown=function(e){
    if(e.target===rz||e.target===del)return;
    e.preventDefault();e.stopPropagation();
    var sx=e.clientX,sy=e.clientY,ox=m.xFrac*cw,oy=m.yFrac*ch;
    el.setPointerCapture(e.pointerId);
    el.style.cursor='grabbing';
    el.style.boxShadow='0 0 0 3px rgba(232,58,0,.15),0 6px 16px rgba(0,0,0,.25)';
    _actSigLastIdx=i;
    el.onpointermove=function(ev){
      var nx=Math.max(0,Math.min(cw-w,ox+ev.clientX-sx));
      var ny=Math.max(0,Math.min(ch-h,oy+ev.clientY-sy));
      el.style.left=nx+'px';el.style.top=ny+'px';
      m.xFrac=nx/cw;m.yFrac=ny/ch;
    };
    el.onpointerup=el.onpointercancel=function(ev){
      el.onpointermove=el.onpointerup=el.onpointercancel=null;
      try{el.releasePointerCapture(ev.pointerId)}catch(_e){}
      el.style.cursor='grab';el.style.boxShadow='';
    };
  };

  // ลากมุมปรับขนาด (คงสัดส่วน 3:1)
  rz.onpointerdown=function(e){
    e.preventDefault();e.stopPropagation();
    var sx=e.clientX,ow=w;
    rz.setPointerCapture(e.pointerId);
    _actSigLastIdx=i;
    rz.onpointermove=function(ev){
      var nw=Math.max(cw*0.05,Math.min(cw*0.6,ow+ev.clientX-sx));
      nw=Math.min(nw,cw-m.xFrac*cw);
      var nh=Math.max(ch*0.03,Math.min(ch*0.45,nw/3));
      nh=Math.min(nh,ch-m.yFrac*ch);
      nw=Math.min(nw,nh*3);
      w=nw;h=nh;
      el.style.width=w+'px';el.style.height=h+'px';
      m.wFrac=w/cw;
      m.hFrac=h/ch;
    };
    rz.onpointerup=rz.onpointercancel=function(ev){
      rz.onpointermove=rz.onpointerup=rz.onpointercancel=null;
      try{rz.releasePointerCapture(ev.pointerId)}catch(_e){}
      // sync แถบ "ขนาดลายเซ็น" กับขนาดที่เพิ่งลากปรับ — จุดที่เพิ่มใหม่จะใช้ขนาดนี้ด้วย
      _actSigDefW=m.wFrac;
      var s=$e('sig-size');if(s)s.value=Math.round(m.wFrac*100);
      var v=$e('sig-size-val');if(v)v.textContent=Math.round(m.wFrac*100)+'%';
    };
  };
  return el;
}

function _paintStamp(el){
  var src=getActSigSrc();
  el.style.overflow='hidden';
  el.style.position='absolute';
  var img=el.querySelector('img.sig-stamp-img');
  if(!src){
    if(img) img.remove();
    el.style.background='rgba(232,58,0,0.12)';
    return;
  }
  el.style.background='rgba(255,255,255,.55)';
  if(!img){
    img=document.createElement('img');
    img.className='sig-stamp-img';
    img.draggable=false;
    img.alt='';
    img.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:center;pointer-events:none;display:block';
    el.insertBefore(img,el.firstChild);
  }
  if(img.src!==src) img.src=src;
}

/* รีเฟรชภาพลายเซ็นในทุกกรอบ — เรียกทุกครั้งที่วาด/ลบ/อัปโหลดลายเซ็นใหม่ */
function _updateSigPosIndicator(){
  document.querySelectorAll('#sig-pos-wrap .sig-stamp').forEach(function(el){_paintStamp(el)});
}

/* รายการจุดวางในคอลัมน์ซ้าย */
function _renderSigMarkList(){
  var list=$e('sig-mark-list'),cnt=$e('sig-mark-count');
  if(cnt)cnt.textContent=_actSigMarks.length+' จุด';
  if(!list)return;
  if(!_actSigMarks.length){
    list.innerHTML='<div style="font-size:11px;color:#a89e99;line-height:1.7">ยังไม่มีจุดวาง · คลิกบนเอกสารเพื่อวางลายเซ็น<br>(ถ้าไม่วาง ระบบจะวางมุมขวาล่างหน้าสุดท้ายให้)</div>';
    return;
  }
  list.innerHTML=_actSigMarks.map(function(m,i){
    return '<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:#6B6560;background:#FAFAF8;border:1px solid #EBEBEB;border-radius:20px;padding:3px 6px 3px 10px">'
      +'<a href="javascript:void(0)" onclick="_sigGoMark('+i+')" style="color:#6B6560;text-decoration:none">หน้า '+m.page+'</a>'
      +'<button type="button" title="ลบจุดนี้" onclick="_rmSigMark('+i+')" style="width:16px;height:16px;border-radius:50%;border:none;background:#EBEBEB;color:#6B6560;font-size:11px;line-height:1;cursor:pointer;padding:0;display:inline-flex;align-items:center;justify-content:center">&times;</button></span>';
  }).join('');
}

/* คลิก chip → เลื่อนไปหน้านั้นแล้วกะพริบกรอบที่เลือก */
function _sigGoMark(i){
  var m=_actSigMarks[i]; if(!m||!_actSigPdf)return;
  _sigGoPage(m.page);
  var el=document.querySelector('#sig-pos-wrap .sig-stamp[data-idx="'+i+'"]');
  if(el){
    el.style.boxShadow='0 0 0 4px rgba(232,58,0,.3)';
    setTimeout(function(){el.style.boxShadow=''},700);
  }
}
