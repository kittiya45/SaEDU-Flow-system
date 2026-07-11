/* ─── DOC NUM — ออกเลขที่หนังสือขาออก (กนค. SPPTNNN/BBBB หรือ กนค. SPPTNNN-CC/BBBB) ─── */
var _thFontCache=null;

/* แปลงชื่อชมรม → รหัส CLUBS (หลัก 8-9 ของเลขหนังสือ) — ยึด CLUBS เป็น canonical เดียว
   ให้ขาเข้าได้รหัสชมรมเดียวกับขาออกเสมอ (เดิมขาเข้าใช้รหัส SENDER_POS ที่ไม่ตรงกับ CLUBS)
   normalize: ตัดช่องว่าง + ส่วนท้าย "คณะครุศาสตร์ จุฬาฯ/จุฬาลงกรณ์มหาวิทยาลัย" ให้ชื่อสองชุดแมตช์กัน
   คืน '' ถ้าไม่พบใน CLUBS (ผู้เรียกจะ fallback รหัสเดิม ไม่ให้สูญหาย) */
var _CLUB_NAME_ALIAS={'ชมรมกิจกรรมและสันทนาการ':'07'}; // ชื่อใน SENDER_POS ที่ตรงกับชมรมเดิมใน CLUBS (เชียร์และสันทนาการ)
function _clubCodeByName(name){
  if(!name) return '';
  if(_CLUB_NAME_ALIAS[name]) return _CLUB_NAME_ALIAS[name];
  var _norm=function(s){return String(s||'').replace(/\s+/g,'').replace(/คณะครุศาสตร์จุฬา(ลงกรณ์มหาวิทยาลัย|ฯ)?$/,'');};
  var t=_norm(name);
  if(!t) return '';
  var keys=Object.keys(CLUBS);
  for(var i=0;i<keys.length;i++){ if(_norm(CLUBS[keys[i]])===t) return keys[i]; }
  return '';
}

// Query the next available sequence number for a given category, excluding the current doc
async function _nextDocNum(docId,docType,catPfx,club,thisYear,thaiYear){
  var gnkPfx='กนค. ',fullPfx=gnkPfx+catPfx;
  var fromDate=thisYear+'-01-01T00:00:00Z';
  try{
    var rcfg=await dg('doc_number_settings','?year=eq.'+thaiYear+'&select=seq_reset_at&limit=1');
    if(rcfg&&rcfg[0]&&rcfg[0].seq_reset_at&&rcfg[0].seq_reset_at>fromDate) fromDate=rcfg[0].seq_reset_at;
  }catch(e){}
  var seq=await dg('documents','?doc_type=eq.'+docType+'&doc_number=not.is.null&created_at=gte.'+encodeURIComponent(fromDate)+'&select=doc_number,id');
  var cat=(seq||[]).filter(function(d){
    if(d.id===docId)return false;
    var n=d.doc_number||'';
    if(!n.startsWith(fullPfx))return false;
    var rest=n.slice(fullPfx.length);
    if(!/^\d{3}/.test(rest))return false;
    return club?(rest[3]==='-'&&rest.slice(4,4+club.length)===club&&rest[4+club.length]==='/'):(rest[3]==='/');
  });
  var mx=cat.reduce(function(m,d){
    var s=parseInt((d.doc_number||'').slice(fullPfx.length,fullPfx.length+3),10)||0;
    return s>m?s:m;
  },0);
  return gnkPfx+catPfx+String(mx+1).padStart(3,'0')+(club?'-'+club:'')+'/'+thaiYear;
}

async function showNumModal(docId){
  var w=$e('mwrap'); if(!w)return;
  var doc=(await dg('documents','?id=eq.'+safeId(docId)))[0]||{};
  var today=new Date().toISOString().slice(0,10);

  if(doc.doc_type==='outgoing'){
    var creator=(await dg('user_directory','?id=eq.'+safeId(doc.created_by)+'&select=position_code,full_name&limit=1'))[0]||{};
    var posCode=GNK_NUM[creator.position_code]||'00';
    var posName=PTH[creator.position_code]||creator.position_code||'ไม่ระบุตำแหน่ง';
    var ltCode=doc.subject_line||'';
    var clubCode=doc.from_department||'';
    var semOpts=Object.keys(SEMS).map(function(k){
      return '<option value="'+k+'">'+k+' — '+esc(SEMS[k])+'</option>';
    }).join('');
    var ltOpts='<option value="">— กรุณาเลือกประเภทจดหมาย —</option>'+OUT_LTYPES.slice(1).map(function(l,i){
      var code=String(i+1);
      return '<option value="'+code+'"'+(code===ltCode?' selected':'')+'>'+code+'. '+esc(l)+'</option>';
    }).join('');
    var clubOpts='<option value="">— ไม่มีชมรม —</option>'+Object.keys(CLUBS).map(function(code){
      return '<option value="'+code+'"'+(code===clubCode?' selected':'')+'>'+code+' — '+esc(CLUBS[code])+'</option>';
    }).join('');

    w.innerHTML=[
      '<div class="mo"><div class="modal" style="max-width:880px;width:95vw">',
      '<div class="modal-head"><span class="modal-title">'+svg('pen',15)+' ออกเลขที่หนังสือขาออก</span>',
      '<button class="btn btn-soft sm btn-icon" data-action="closeModal">'+svg('x',14)+'</button></div>',
      '<div class="modal-body" style="display:grid;grid-template-columns:280px 1fr;gap:18px;align-items:start;max-height:72vh;overflow:hidden;padding-bottom:0">',

      // ─── ซ้าย: กรอกข้อมูล ───
      '<div style="overflow-y:auto;max-height:72vh;padding-right:4px;padding-bottom:16px">',
      '<div class="al al-ok" style="margin-bottom:12px"><span class="al-icon">'+svg('ok',13)+'</span>',
      '<span style="font-size:12px">ลายเซ็นครบแล้ว กรอกข้อมูลแล้วลากตำแหน่งเลขที่/วันที่บนตัวอย่างเอกสาร</span></div>',
      '<div class="fg"><label class="fl">ภาคการศึกษา (หลักที่ 1) <span class="req">*</span></label>',
      '<select class="fi" id="num-sem" onchange="_previewOutNum()">'+semOpts+'</select></div>',
      '<div class="fg"><label class="fl">ตำแหน่ง (หลักที่ 2–3)</label>',
      '<div class="fi" style="background:#f9f7f5;color:#6b6560;cursor:default;font-size:12px">'+esc(posCode)+' — '+esc(posName)+'</div></div>',
      '<input type="hidden" id="num-poscode" value="'+posCode+'">',
      '<div class="fg"><label class="fl">ประเภทจดหมาย (หลักที่ 4) <span class="req">*</span></label>',
      '<select class="fi" id="num-lt" onchange="_previewOutNum()">'+ltOpts+'</select></div>',
      '<div class="fg"><label class="fl">ชมรม (หลักที่ 8–9)</label>',
      '<select class="fi" id="num-club" onchange="_previewOutNum()">'+clubOpts+'</select></div>',
      '<div class="fg"><label class="fl">วันที่หนังสือ</label>',
      '<div class="fi" style="background:#f9f7f5;color:#6b6560;cursor:default">'+_fmtDateThai(today)+'</div>',
      '<input type="hidden" id="num-docdate" value="'+today+'"></div>',
      '<div class="fg"><label class="fl">ขนาดตัวอักษร</label>',
      '<div style="display:flex;align-items:center;gap:8px">',
      '<input type="range" id="num-fontsize" min="8" max="24" value="10" style="flex:1" oninput="_updateStampFontSize()">',
      '<span id="num-fontsize-val" style="font-size:12px;color:#6b6560;min-width:36px;text-align:right">10 pt</span>',
      '</div></div>',
      '<div class="fg"><label class="fl" style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:500">',
      '<input type="checkbox" id="num-stamp-lock" onchange="_toggleStampLock()">',
      '<span>ล็อคตำแหน่งเลขที่/วันที่</span></label>',
      '<div style="font-size:11px;color:#a89e99;margin-top:4px;line-height:1.6">เมื่อล็อคแล้วตำแหน่งจะไม่เลื่อน — เลื่อนดูเอกสารแต่ละหน้าได้ตามปกติ</div></div>',
      '<div class="fg"><label class="fl">ตัวอย่างเลขที่</label>',
      '<div class="fi" id="num-preview" style="background:#f9f7f5;color:#1261AB;font-size:12px;font-family:\TH Sarabun PSK\', Sarabun, sans-serif;font-weight:700;cursor:default;letter-spacing:.5px">—</div></div>',
      '<div style="font-size:11px;color:#a89e99;margin-top:6px;line-height:1.7;display:flex;gap:6px;align-items:flex-start">',
      svg('info',12)+'<span>ลากกล่องเลขที่และวันที่บนตัวอย่างด้านขวาเพื่อปรับตำแหน่งก่อนบันทึก</span></div>',
      '</div>',

      // ─── ขวา: PDF preview พร้อม draggable stamps ───
      '<div id="num-pdf-outer" style="background:#525659;border-radius:8px;overflow-y:auto;overflow-x:hidden;max-height:72vh;min-height:320px;padding:8px">',
      '<div id="num-pdf-wrap" style="display:block;width:100%">',
      '<div id="num-pdf-loading" style="color:rgba(255,255,255,.7);font-size:13px;display:flex;flex-direction:column;align-items:center;gap:10px">',
      '<span class="sp" style="border-color:rgba(255,255,255,.25);border-top-color:#fff;width:28px;height:28px;border-width:3px"></span>',
      '<span>กำลังโหลดเอกสาร...</span></div>',
      '</div></div>',

      '</div>',
      '<div class="modal-foot">',
      '<button class="btn btn-soft" data-action="closeModal">ยกเลิก</button>',
      '<button class="btn btn-primary" data-action="doSetDocNumber" data-id="'+docId+'">'+svg('ok',13)+' ออกเลขและเสร็จสิ้น</button>',
      '</div></div></div>'
    ].join('');

    _previewOutNum();
    setTimeout(function(){_loadNumPDFPreview(docId)},80);
    return;
  }

  // หนังสือขาเข้า: auto-generate เลขที่ (รูปแบบ กนค. SPPTNNN-CC/BBBB)
  var allUsers=await dg('user_directory','?role_code=eq.ROLE-STF&is_active=eq.true&approval_status=eq.approved&order=full_name');
  var uOpts='<option value="">— ไม่ส่งต่อ —</option>'+allUsers.map(function(u){
    return '<option value="'+u.id+'">'+esc(u.full_name)+'</option>'
  }).join('');
  var _ltIdx=LETTER_TYPES.indexOf(doc.description);
  var _ltCode=_ltIdx>=0?String(_ltIdx+1):'';
  var _sEntry=(SENDER_POS||[]).filter(function(p){return p.name===doc.addressed_to})[0]||null;
  var _sCode=_sEntry?_sEntry.code:'00';
  var _sIsClub=_sEntry?_sEntry.isClub:false;
  // หลัก 8-9 (ชมรม) ยึด CLUBS เป็นหลัก ให้ตรงกับขาออก; ถ้าไม่พบใน CLUBS fallback รหัส SENDER_POS เดิม
  var _sClubCode=_sIsClub?(_clubCodeByName(doc.addressed_to)||_sCode):'';
  var semOpts=Object.keys(SEMS).map(function(k){return '<option value="'+k+'">'+k+' — '+esc(SEMS[k])+'</option>';}).join('');
  var incLtOpts='<option value="">— กรุณาเลือกประเภทหนังสือ —</option>'+LETTER_TYPES.map(function(t,i){
    var code=String(i+1);
    return '<option value="'+code+'"'+(code===_ltCode?' selected':'')+'>'+code+'. '+esc(t)+'</option>';
  }).join('');
  w.innerHTML=[
    '<div class="mo"><div class="modal" style="max-width:880px;width:95vw">',
    '<div class="modal-head"><span class="modal-title">'+svg('pen',15)+' ออกเลขที่หนังสือขาเข้า</span>',
    '<button class="btn btn-soft sm btn-icon" data-action="closeModal">'+svg('x',14)+'</button></div>',
    '<div class="modal-body" style="display:grid;grid-template-columns:280px 1fr;gap:18px;align-items:start;max-height:72vh;overflow:hidden;padding-bottom:0">',
    '<div style="overflow-y:auto;max-height:72vh;padding-right:4px;padding-bottom:16px">',
    '<div class="al al-ok" style="margin-bottom:12px"><span class="al-icon">'+svg('ok',13)+'</span>',
    '<span style="font-size:12px">ลายเซ็นครบแล้ว กรอกข้อมูลแล้วลากตำแหน่งเลขที่/วันที่บนตัวอย่างเอกสาร</span></div>',
    '<div class="fg"><label class="fl">ภาคการศึกษา (หลักที่ 1) <span class="req">*</span></label>',
    '<select class="fi" id="num-sem" onchange="_previewIncNum()">'+semOpts+'</select></div>',
    '<div class="fg"><label class="fl">ตำแหน่ง / สังกัดผู้ส่ง (หลักที่ 2–3'+(_sIsClub?' และ 8–9':'')+')</label>',
    '<div class="fi" style="background:#f9f7f5;color:#6b6560;cursor:default;font-size:12px">'+esc(_sCode)+' — '+esc(doc.addressed_to||'—')+'</div></div>',
    '<input type="hidden" id="num-sendercode" value="'+esc(_sCode)+'">',
    '<input type="hidden" id="num-senderclub" value="'+esc(_sClubCode)+'">',
    '<div class="fg"><label class="fl">ประเภทหนังสือ (หลักที่ 4) <span class="req">*</span></label>',
    '<select class="fi" id="num-lt" onchange="_previewIncNum()">'+incLtOpts+'</select></div>',
    '<div class="fg"><label class="fl">วันที่หนังสือ</label>',
    '<div class="fi" style="background:#f9f7f5;color:#6b6560;cursor:default">'+_fmtDateThai(today)+'</div>',
    '<input type="hidden" id="num-docdate" value="'+today+'"></div>',
    '<div class="fg"><label class="fl">ขนาดตัวอักษร</label>',
    '<div style="display:flex;align-items:center;gap:8px">',
    '<input type="range" id="num-fontsize" min="8" max="24" value="10" style="flex:1" oninput="_updateStampFontSize()">',
    '<span id="num-fontsize-val" style="font-size:12px;color:#6b6560;min-width:36px;text-align:right">10 pt</span>',
    '</div></div>',
    '<div class="fg"><label class="fl" style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:500">',
    '<input type="checkbox" id="num-stamp-lock" onchange="_toggleStampLock()">',
    '<span>ล็อคตำแหน่งเลขที่/วันที่</span></label>',
    '<div style="font-size:11px;color:#a89e99;margin-top:4px;line-height:1.6">เมื่อล็อคแล้วตำแหน่งจะไม่เลื่อน — เลื่อนดูเอกสารแต่ละหน้าได้ตามปกติ</div></div>',
    '<div class="fg"><label class="fl">ตัวอย่างเลขที่</label>',
      '<div class="fi" id="num-preview" style="background:#f9f7f5;color:#1261AB;font-size:12px;font-family:\TH Sarabun PSK\', Sarabun, sans-serif;font-weight:700;cursor:default;letter-spacing:.5px">—</div></div>',
    '<div class="fg"><label class="fl">ส่งต่อให้ จนท.กิจนิสิต (ไม่บังคับ)</label>',
    '<select class="fi" id="num-fwd">'+uOpts+'</select></div>',
    '<div class="fg"><label class="fl">หมายเหตุ</label>',
    '<textarea class="fi" id="num-note" rows="2" placeholder="หมายเหตุ (ถ้ามี)"></textarea></div>',
    '<div style="font-size:11px;color:#a89e99;margin-top:6px;line-height:1.7;display:flex;gap:6px;align-items:flex-start">',
    svg('info',12)+'<span>ลากกล่องเลขที่และวันที่บนตัวอย่างด้านขวาเพื่อปรับตำแหน่งก่อนบันทึก</span></div>',
    '</div>',
    '<div id="num-pdf-outer" style="background:#525659;border-radius:8px;overflow-y:auto;overflow-x:hidden;max-height:72vh;min-height:320px;padding:8px">',
    '<div id="num-pdf-wrap" style="display:block;width:100%">',
    '<div id="num-pdf-loading" style="color:rgba(255,255,255,.7);font-size:13px;display:flex;flex-direction:column;align-items:center;gap:10px">',
    '<span class="sp" style="border-color:rgba(255,255,255,.25);border-top-color:#fff;width:28px;height:28px;border-width:3px"></span>',
    '<span>กำลังโหลดเอกสาร...</span></div>',
    '</div></div>',
    '</div>',
    '<div class="modal-foot">',
    '<button class="btn btn-soft" data-action="closeModal">ยกเลิก</button>',
    '<button class="btn btn-primary" data-action="doSetDocNumber" data-id="'+docId+'">'+svg('ok',13)+' ออกเลขและเสร็จสิ้น</button>',
    '</div></div></div>'
  ].join('');
  _previewIncNum();
  setTimeout(function(){_loadNumPDFPreview(docId)},80);
}

function _previewOutNum(){
  var sem=gv('num-sem')||'';
  var pos=($e('num-poscode')||{}).value||'00';
  var lt=gv('num-lt')||'';
  var club=gv('num-club')||'';
  var p=$e('num-preview');
  if(!p) return;
  if(!sem||!lt){p.textContent='— (กรุณาเลือกภาคเรียนและประเภทจดหมาย)';return}
  var _bbbb=String(new Date().getFullYear()+543);
  var txt='กนค. '+sem+pos+lt+'XXX'+(club?'-'+club:'')+'/'+_bbbb;
  p.textContent=txt;
  var ns=$e('num-stamp-num');
  if(ns) ns.textContent=txt;
}

function _previewIncNum(){
  var sem=gv('num-sem')||'';
  var pos=($e('num-sendercode')||{}).value||'00';
  var club=($e('num-senderclub')||{}).value||'';
  var lt=gv('num-lt')||'';
  var p=$e('num-preview');
  if(!p) return;
  if(!sem||!lt){p.textContent='— (กรุณาเลือกภาคเรียนและประเภทหนังสือ)';return}
  var _bbbb=String(new Date().getFullYear()+543);
  var txt='กนค. '+sem+pos+lt+'XXX'+(club?'-'+club:'')+'/'+_bbbb;
  p.textContent=txt;
  var ns=$e('num-stamp-num');
  if(ns) ns.textContent=txt;
}

/* ─── Thai date formatter: 5 พฤษภาคม 2568 ─── */
function _fmtDateThai(dateStr){
  if(!dateStr) return '';
  var d=new Date(dateStr+'T12:00:00');
  if(isNaN(d.getTime())) return '';
  var m=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
         'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  return d.getDate()+' '+m[d.getMonth()]+' '+(d.getFullYear()+543);
}

function _updateDateStamp(){
  var ds=$e('num-stamp-date');
  if(ds) ds.textContent=_fmtDateThai(gv('num-docdate')||'');
}

function _updateStampFontSize(){
  var sz=parseInt(($e('num-fontsize')||{}).value)||10; // pt จริงใน PDF (1 pt = 1/72 นิ้ว)
  var lbl=$e('num-fontsize-val'); if(lbl) lbl.textContent=sz+' pt';
  var pt=sz+'pt';
  var ns=$e('num-stamp-num'); if(ns) ns.style.fontSize=pt;
  var ds=$e('num-stamp-date'); if(ds) ds.style.fontSize=pt;
}

function _toggleStampLock(){
  var locked=!!(($e('num-stamp-lock')||{}).checked);
  ['num-stamp-num','num-stamp-date'].forEach(function(id){
    var el=$e(id); if(!el) return;
    el.dataset.locked=locked?'1':'';
    el.style.cursor=locked?'default':'grab';
    el.style.outline=locked?'1px solid rgba(18,97,171,.75)':'1px dashed rgba(18,97,171,.45)';
  });
}

/* โหลดฟอนต์ THSarabunNew ตัวเดียวกับที่ใช้ฝังลง PDF มาใช้ใน preview ด้วย —
   ถ้าปล่อยให้ fallback เป็น sans-serif ความกว้าง/สัดส่วนตัวอักษรบนจอจะไม่ตรงกับผลจริง */
function _ensureSarabunPrevFont(){
  if($e('sarabun-prev-style'))return;
  var st=document.createElement('style');
  st.id='sarabun-prev-style';
  st.textContent="@font-face{font-family:'THSarabunPrev';src:url('https://cdn.jsdelivr.net/gh/Phonbopit/sarabun-webfont@master/fonts/thsarabunnew-webfont.ttf') format('truetype');font-display:swap}";
  document.head.appendChild(st);
}

/* ตำแหน่ง stamp ใน PDF point (container ใช้ 1 CSS px = 1 pt) */
function _stampPdfPos(el){
  return {x:parseFloat(el.style.left)||0, y:parseFloat(el.style.top)||0};
}

/* ─── Drag handler สำหรับ stamp overlays ─── */
function _makeStampDraggable(el,container){
  var drag=false,ox=0,oy=0,sx=0,sy=0,ew=0,eh=0;
  function _sc(){return parseFloat(container.dataset.scale)||1;}
  el.addEventListener('pointerdown',function(e){
    if(el.dataset.locked==='1') return;
    drag=true; sx=e.clientX; sy=e.clientY;
    ox=parseFloat(el.style.left)||0; oy=parseFloat(el.style.top)||0;
    ew=el.offsetWidth; eh=el.offsetHeight;
    el.style.willChange='transform';
    el.setPointerCapture(e.pointerId); el.style.cursor='grabbing'; e.preventDefault();
  });
  el.addEventListener('pointermove',function(e){
    if(!drag) return;
    var s=_sc();
    // เคลื่อนเมาส์เป็นพิกเซลจอ แต่ left/top เป็น PDF pt — หาร scale ของ container
    var dx=(e.clientX-sx)/s, dy=(e.clientY-sy)/s;
    var nl=Math.max(0,Math.min(container.offsetWidth-ew,ox+dx));
    var nt=Math.max(0,Math.min(container.offsetHeight-eh,oy+dy));
    el.style.transform='translate3d('+(nl-ox)+'px,'+(nt-oy)+'px,0)';
  });
  el.addEventListener('pointerup',function(e){
    if(!drag) return;
    drag=false; el.releasePointerCapture(e.pointerId); el.style.cursor='grab';
    var s=_sc();
    var dx=(e.clientX-sx)/s, dy=(e.clientY-sy)/s;
    var nl=Math.max(0,Math.min(container.offsetWidth-ew,ox+dx));
    var nt=Math.max(0,Math.min(container.offsetHeight-eh,oy+dy));
    el.style.transform=''; el.style.willChange='';
    el.style.left=nl+'px'; el.style.top=nt+'px';
  });
}

/* ─── โหลด PDF ทุกหน้า + stamp บนหน้า 1 (เลื่อนดูแต่ละหน้าได้) ─── */
async function _loadNumPDFPreview(docId){
  var wrap=$e('num-pdf-wrap'); if(!wrap) return;
  try{
    var files=await dg('document_files','?document_id=eq.'+safeId(docId)+'&file_type=like.application%2Fpdf&order=version.desc&limit=1');
    if(!files||!files.length){
      wrap.innerHTML='<div style="color:rgba(255,255,255,.6);font-size:12px;padding:20px;text-align:center">ไม่พบไฟล์ PDF<br>ระบบจะประทับที่ตำแหน่งเริ่มต้น</div>';
      return;
    }
    var pdfUrl=await resolveFilePath(files[0].file_path);
    if(!window.pdfjsLib){
      await loadSc('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
      pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    } else if(!pdfjsLib.GlobalWorkerOptions.workerSrc){
      pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    var pdf=await pdfjsLib.getDocument(pdfUrl).promise;
    var outer=$e('num-pdf-outer');
    var availW=Math.max((outer?outer.clientWidth:420)-16, 200);
    var page1=await pdf.getPage(1);
    var vp0=page1.getViewport({scale:1});
    var sc=availW/vp0.width; // zoom เต็มความกว้างพื้นที่ preview
    var dpr=window.devicePixelRatio||1;

    _ensureSarabunPrevFont();
    if(document.fonts&&document.fonts.load){
      try{
        var _fs=parseInt(($e('num-fontsize')||{}).value)||10;
        await document.fonts.load(_fs+'pt THSarabunPrev');
      }catch(_fl){}
    }

    var col=document.createElement('div');
    col.id='num-pdf-pages';
    col.style.cssText='display:flex;flex-direction:column;align-items:center;gap:12px;width:100%';

    var SCSS='position:absolute;color:#1261AB;font-family:"THSarabunPrev","TH Sarabun PSK",Sarabun,sans-serif;font-weight:400;white-space:nowrap;cursor:grab;'+
             'user-select:none;padding:0;margin:0;line-height:1;touch-action:none;'+
             'outline:1px dashed rgba(18,97,171,.45);outline-offset:1px';
    var defTop=Math.round(vp0.height*0.32);
    var cont=null, ns=null, ds=null;

    for(var pi=1; pi<=pdf.numPages; pi++){
      var page=await pdf.getPage(pi);
      var pvp0=page.getViewport({scale:1});
      var vpHi=page.getViewport({scale:sc*dpr});
      var canvas=document.createElement('canvas');
      canvas.width=vpHi.width; canvas.height=vpHi.height;
      canvas.style.cssText='display:block;width:'+pvp0.width+'px;height:'+pvp0.height+'px;border-radius:4px';
      await page.render({canvasContext:canvas.getContext('2d'),viewport:vpHi}).promise;

      var slot=document.createElement('div');
      slot.className='num-pdf-page-slot';
      slot.dataset.page=String(pi);
      slot.style.cssText='width:'+(pvp0.width*sc)+'px;height:'+(pvp0.height*sc)+'px;position:relative;flex-shrink:0;'+
        'box-shadow:0 4px 16px rgba(0,0,0,.45);border-radius:4px;overflow:hidden;background:#fff';

      var inner=document.createElement('div');
      inner.style.cssText='position:absolute;left:0;top:0;width:'+pvp0.width+'px;height:'+pvp0.height+'px;transform:scale('+sc+');transform-origin:top left';
      inner.appendChild(canvas);

      if(pi===1){
        cont=document.createElement('div');
        cont.id='num-stamp-container';
        cont.style.cssText='position:absolute;left:0;top:0;width:'+pvp0.width+'px;height:'+pvp0.height+'px';
        cont.dataset.scale=String(sc);
        cont.dataset.pdfW=String(pvp0.width);
        cont.dataset.pdfH=String(pvp0.height);

        ns=document.createElement('div');
        ns.id='num-stamp-num'; ns.style.cssText=SCSS;
        ns.style.left='42px'; ns.style.top=defTop+'px';
        ns.textContent=($e('num-preview')||{}).textContent||'กนค. XXXX/XXXX';
        cont.appendChild(ns);

        ds=document.createElement('div');
        ds.id='num-stamp-date'; ds.style.cssText=SCSS;
        ds.style.left='42px'; ds.style.top=(defTop+Math.round(pvp0.height*0.065))+'px';
        ds.textContent=_fmtDateThai(gv('num-docdate')||'');
        cont.appendChild(ds);

        inner.appendChild(cont);
      }

      if(pdf.numPages>1){
        var badge=document.createElement('div');
        badge.style.cssText='position:absolute;right:8px;top:8px;z-index:2;background:rgba(0,0,0,.55);color:#fff;font-size:11px;padding:2px 8px;border-radius:10px;pointer-events:none';
        badge.textContent='หน้า '+pi+'/'+pdf.numPages;
        slot.appendChild(badge);
      }

      slot.appendChild(inner);
      col.appendChild(slot);
    }

    wrap.innerHTML=''; wrap.style.cssText='display:block;width:100%';
    wrap.appendChild(col);
    if(cont&&ns&&ds){
      _makeStampDraggable(ns,cont);
      _makeStampDraggable(ds,cont);
      _updateStampFontSize();
      _toggleStampLock();
    }
  }catch(e){
    console.warn('PDF preview failed:',e);
    wrap.innerHTML='<div style="color:rgba(255,255,255,.6);font-size:12px;padding:20px;text-align:center">โหลดตัวอย่างไม่ได้<br>ระบบจะประทับที่ตำแหน่งเริ่มต้น</div>';
  }
}

/* [UX] wrap doSetDocNumber ด้วย showConfirm ก่อน irreversible action */
function doSetDocNumber(docId){
  var docDate=gv('num-docdate');
  if(!docDate){showAlert('กรุณาเลือกวันที่หนังสือ','wa');return}
  // จับค่าฟอร์มทั้งหมดก่อน showConfirm เพราะ showConfirm จะ replace mwrap แล้วทำให้ elements หาย
  var _ns=$e('num-stamp-num'), _ds=$e('num-stamp-date');
  // left/top ของ stamp = PDF point โดยตรง (container 1px = 1pt)
  var _numPdfX,_numTopPdf,_datPdfX,_datTopPdf;
  if(_ns){var _no=_stampPdfPos(_ns); _numPdfX=_no.x; _numTopPdf=_no.y;}
  else    {_numPdfX=42; _numTopPdf=256;}
  if(_ds){var _do2=_stampPdfPos(_ds); _datPdfX=_do2.x; _datTopPdf=_do2.y;}
  else    {_datPdfX=42; _datTopPdf=276;}
  var _cap={
    docDate:docDate,
    sem:gv('num-sem')||'',
    lt:gv('num-lt')||'',
    poscode:($e('num-poscode')||{}).value||'00',
    club:gv('num-club')||'',
    sendercode:($e('num-sendercode')||{}).value||'00',
    senderclub:($e('num-senderclub')||{}).value||'',
    note:(gv('num-note')||'').trim(),
    fwdId:gv('num-fwd')||null,
    docnum:(gv('num-docnum')||'').trim(),
    fontsize:parseInt(($e('num-fontsize')||{}).value)||10,
    numPdfX:_numPdfX, numTopPdf:_numTopPdf,
    datPdfX:_datPdfX, datTopPdf:_datTopPdf
  };
  var previewNum=($e('num-preview')||{}).textContent||'—';
  var dateDisplay=_fmtDateThai?_fmtDateThai(docDate):docDate;
  showConfirm(
    'ยืนยันออกเลขหนังสือ?',
    'เลขที่: '+previewNum+'\nวันที่: '+dateDisplay,
    function(){_doSetDocNumberConfirmed(docId,_cap);},
    {
      confirmLabel:'ออกเลขและเสร็จสิ้น',
      confirmClass:'btn-primary',
      cancelLabel:'กลับไปตรวจสอบ',
      icon:'pen',
      iconBg:'#EFF6FF',
      iconColor:'#2563EB',
      detail:'การออกเลขไม่สามารถเปลี่ยนแปลงได้ภายหลัง'
    }
  );
}
async function _doSetDocNumberConfirmed(docId,cap){
  var docDate=cap.docDate;
  var btn=document.querySelector('[data-action="doSetDocNumber"]');
  if(btn){btn.disabled=true;btn.innerHTML='<span class="sp"></span>'}
  try{
    var doc=(await dg('documents','?id=eq.'+safeId(docId)))[0]||{};
    var docNum, note='', fwdId=null;
    var _numPdfX=cap.numPdfX,_numTopPdf=cap.numTopPdf,_datPdfX=cap.datPdfX,_datTopPdf=cap.datTopPdf,_dateText='';

    if(doc.doc_type==='outgoing'){
      var sem=cap.sem||'1';
      var pos=cap.poscode||'00';
      var lt=cap.lt||'';
      var club=cap.club||'';
      if(!lt){showAlert('กรุณาเลือกประเภทจดหมาย','wa');if(btn){btn.disabled=false;btn.innerHTML=svg('ok',13)+' ออกเลขและเสร็จสิ้น';}return}
      var thisYear=new Date().getFullYear();
      var thaiYear=String(thisYear+543);
      var catPfx=sem+pos+lt;
      docNum=await _nextDocNum(docId,'outgoing',catPfx,club,thisYear,thaiYear);
      note='ออกเลขหนังสือขาออก: '+docNum;
      _dateText=_fmtDateThai(docDate);
    } else if(doc.doc_type==='incoming'){
      var sem=cap.sem||'1';
      var pos=cap.sendercode||'00';
      var club=cap.senderclub||'';
      var lt=cap.lt||'';
      note=cap.note||'';
      fwdId=cap.fwdId||null;
      if(!lt){showAlert('กรุณาเลือกประเภทหนังสือ','wa');if(btn){btn.disabled=false;btn.innerHTML=svg('ok',13)+' ออกเลขและเสร็จสิ้น';}return}
      var thisYear=new Date().getFullYear();
      var thaiYear=String(thisYear+543);
      var catPfx=sem+pos+lt;
      docNum=await _nextDocNum(docId,'incoming',catPfx,club,thisYear,thaiYear);
      note=note||('ออกเลขหนังสือขาเข้า: '+docNum);
      _dateText=_fmtDateThai(docDate);
    } else {
      docNum=cap.docnum||'';
      note=cap.note||'';
      fwdId=cap.fwdId||null;
      if(!docNum){showAlert('กรุณาระบุเลขที่หนังสือ','wa');if(btn){btn.disabled=false;btn.innerHTML=svg('ok',13)+' บันทึกและเสร็จสิ้น';}return}
    }

    var upd={doc_number:docNum,doc_date:docDate,status:'completed',updated_at:new Date().toISOString()};
    if(fwdId) Object.assign(upd,{forwarded_to_id:fwdId,forwarded_at:new Date().toISOString()});
    // เขียนเลข + retry เมื่อชนเลขซ้ำ — อาศัย partial unique index บน documents(doc_number)
    // (ดู supabase/add_doc_number_unique_index.sql) ให้ DB ปฏิเสธเลขซ้ำจริง ถ้าชนจาก race
    // condition ให้คำนวณเลขถัดไปใหม่แล้วลองใหม่ (กันเลขหนังสือราชการซ้ำได้จริง ไม่ใช่แค่ best-effort)
    var _isSeqDoc=(doc.doc_type==='outgoing'||doc.doc_type==='incoming');
    var _saved=false;
    for(var _r=0;_r<4&&!_saved;_r++){
      try{
        await dpa('documents',docId,upd);
        _saved=true;
      }catch(_ue){
        var _isDup=/duplicate key|unique|23505/i.test((_ue&&_ue.message)||'');
        if(_isSeqDoc&&_isDup&&_r<3){
          docNum=await _nextDocNum(docId,doc.doc_type,catPfx,club,thisYear,thaiYear);
          upd.doc_number=docNum;
          if(doc.doc_type==='outgoing') note='ออกเลขหนังสือขาออก: '+docNum;
          else if(doc.doc_type==='incoming'&&!cap.note) note='ออกเลขหนังสือขาเข้า: '+docNum;
        }else{
          throw _ue; // เลขซ้ำเกิน 4 รอบ (แทบเป็นไปไม่ได้) หรือ error อื่น — โยนให้ catch แสดงผล ผู้ใช้กดใหม่ได้
        }
      }
    }
    await dp('document_history',{document_id:docId,action:'ออกเลขที่หนังสือ: '+docNum,performed_by:CU.id,note:note||'ออกเลขหนังสือและวันที่เรียบร้อยแล้ว'});

    // ── ประทับเลขและวันที่ลงบน PDF (ขาออกและขาเข้า) ──
    if(_dateText){
      try{
        var _pdfFiles=await dg('document_files','?document_id=eq.'+safeId(docId)+'&file_type=like.application%2Fpdf&order=version.desc&limit=1');
        if(_pdfFiles&&_pdfFiles.length){
          var _pf=_pdfFiles[0];
          if(!window.PDFLib) await loadSc('https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js');
          if(!window.fontkit) await loadSc('https://unpkg.com/@pdf-lib/fontkit/dist/fontkit.umd.min.js');
          var _pdfResp=await fetch(await resolveFileUrl(_pf.file_path));
          if(_pdfResp.ok){
            var _pdfBuf=await _pdfResp.arrayBuffer();
            var _pdfDoc=await PDFLib.PDFDocument.load(new Uint8Array(_pdfBuf),{ignoreEncryption:true});
            var _pg=_pdfDoc.getPage(0);
            var _ph=_pg.getHeight();
            var _stampFont=null;
            try{
              _pdfDoc.registerFontkit(window.fontkit);
              if(!_thFontCache){
                _thFontCache=await fetch('https://cdn.jsdelivr.net/gh/Phonbopit/sarabun-webfont@master/fonts/thsarabunnew-webfont.ttf').then(function(r){
                  if(!r.ok) throw new Error('Font HTTP error');
                  return r.arrayBuffer();
                });
              }
              _stampFont=await _pdfDoc.embedFont(_thFontCache.slice(0));
            }catch(_fe){
              console.warn('Thai font load failed, skipping auto-stamp:',_fe.message);
              // ฟอนต์ไทยโหลดไม่ได้ → ห้ามลบภาษาไทยแล้วปั๊มเลขผิด (เดิมทำให้ "กนค. ..." หายเหลือแต่ตัวเลข
              // = เลขบนเอกสารไม่ตรงกับเลขจริงในระบบ) ให้ "ข้าม" การปั๊มอัตโนมัติแทน เลขในระบบถูกต้องอยู่แล้ว
              _stampFont=null;
            }
            if(_stampFont){
              var _clr=PDFLib.rgb(0.07,0.38,0.67);
              var _stampSz=cap.fontsize||10;
              // top ของ stamp (PDF pt จากขอบบน) → baseline: ใช้ ascent ของฟอนต์เดียวกับ preview
              var _ascentAt=(function(sz,fnt){
                try{
                  var fk=fnt.embedder.font;
                  return fk.ascent/fk.unitsPerEm*sz;
                }catch(_me){return sz*0.88;}
              })(_stampSz,_stampFont);
              if(docNum) _pg.drawText(docNum,{x:_numPdfX,y:_ph-_numTopPdf-_ascentAt,size:_stampSz,font:_stampFont,color:_clr});
              if(_dateText) _pg.drawText(_dateText,{x:_datPdfX,y:_ph-_datTopPdf-_ascentAt,size:_stampSz,font:_stampFont,color:_clr});
              var _stampBytes=await _pdfDoc.save();
              var _stampPath='stamped_'+Date.now()+'_'+_pf.file_name.replace(/[^a-zA-Z0-9._-]/g,'_');
              var _stampBlob=new Blob([_stampBytes],{type:'application/pdf'});
              await upFile(_stampPath,_stampBlob);
              await dp('document_files',{document_id:docId,file_name:_pf.file_name,file_path:_stampPath,file_size:_stampBlob.size,file_type:'application/pdf',uploaded_by:CU.id,version:(_pf.version||1)+1});
              await dp('document_history',{document_id:docId,action:'ประทับเลขหนังสือลงในเอกสาร: '+docNum,performed_by:CU.id});
            }else{
              // ปั๊มอัตโนมัติไม่สำเร็จ — บันทึก audit ให้รู้ว่าต้องปั๊มเอง (เลขที่ในระบบยังถูกต้อง)
              await dp('document_history',{document_id:docId,action:'ปั๊มเลขอัตโนมัติไม่สำเร็จ (โหลดฟอนต์ไทยไม่ได้) เลขที่ในระบบถูกต้อง โปรดดาวน์โหลดไฟล์แล้วปั๊มเลขเอง',performed_by:CU.id,note:'เลขที่: '+docNum});
            }
          }
        }
      }catch(_se){console.warn('PDF stamp failed:',_se)}
    }
    if(doc.doc_type==='outgoing'){
      try{
        var posUsers=await dg('user_directory','?position_code=eq.'+encodeURIComponent(doc.addressed_to)+'&is_active=eq.true&approval_status=eq.approved&limit=1');
        var posUser=posUsers[0];
        if(posUser){
          var posEmail=posUser.contact_email||posUser.email;
          var eSubj='[กนค.] หนังสือขาออก เลขที่ '+docNum+': '+(doc.title||'');
          if(posEmail&&!posEmail.includes('@gnk.student')){
            var eBody='เรียน '+posUser.full_name+', มีหนังสือขาออกถึงท่าน เลขที่ '+docNum+' เรื่อง "'+esc(doc.title||'')+'"';
            var er=await sendEmailEdge({to:posEmail,subject:eSubj,html:eBody,documentId:docId,recipientUserId:posUser.id});
            if(er.ok&&typeof showEmailToast==='function') showEmailToast(posEmail,eSubj);
            await logNotifRow({document_id:docId,recipient_id:posUser.id,recipient_email:posEmail,subject:eSubj,body:eBody,notification_type:'outgoing',status:er.ok?'sent':'failed',sent_at:new Date().toISOString()});
          }
          // LINE OA push (ส่งได้แม้ผู้รับไม่มีอีเมลจริง)
          try{
            var eLine='[กนค.] 📄 หนังสือขาออกถึงท่าน\nเรียน '+posUser.full_name+'\nเลขที่: '+docNum+'\nเรื่อง: '+(doc.title||'')+'\n\n'+(SETT.app_url?'เข้าสู่ระบบ: '+SETT.app_url:'กรุณาเข้าสู่ระบบ SAEDU Flow เพื่อดูเอกสาร');
            var eFlex=null;
            try{eFlex=buildLineFlex({headText:'📄 หนังสือขาออกถึงท่าน',recipName:posUser.full_name,subj:doc.title||'',rows:[['เลขที่',docNum]],button:'เข้าสู่ระบบเพื่อดูเอกสาร'})}catch(fe){}
            await sendLineWithLog(docId,posUser.id,posEmail||'',eSubj,eLine,'outgoing',eFlex);
          }catch(le){console.warn('Outgoing LINE failed:',le)}
        }
      }catch(ne){console.warn('Outgoing notify failed:',ne)}
      $e('mwrap').innerHTML='';
      var a2=$e('dal');if(a2)a2.innerHTML='<div class="al al-ok"><span class="al-icon">'+svg('ok',13)+'</span><span>ออกเลขหนังสือขาออกเรียบร้อยแล้ว เลขที่: <strong class="mono">'+esc(docNum)+'</strong></span></div>';
    } else {
      if(fwdId){
        var fwdUser=(await dg('user_directory','?id=eq.'+fwdId))[0];
        var doc2=(await dg('documents','?id=eq.'+docId))[0]||{};
        var fwdEmail=fwdUser?(fwdUser.contact_email||fwdUser.email):'';
        var fwdSubj='[กนค.] ส่งต่อหนังสือขาเข้า: '+(doc2.title||'');
        var fwdBody='เรียน '+(fwdUser?fwdUser.full_name:'')+', ท่านได้รับหนังสือขาเข้าเลขที่ '+docNum+' เรื่อง "'+(doc2.title||'')+'" ที่ผ่านการลงนามครบถ้วนแล้ว'+(note?' หมายเหตุ: '+note:'');
        var fwdEmailStatus='skipped';
        try{
          if(fwdEmail&&!fwdEmail.includes('@gnk.student')){
            var r=await sendEmailEdge({to:fwdEmail,subject:fwdSubj,html:fwdBody,documentId:docId,recipientUserId:fwdId});
            fwdEmailStatus=r.ok?'sent':'failed';
            if(r.ok) showEmailToast(fwdEmail,fwdSubj);
          }
          await logNotifRow({document_id:docId,recipient_id:fwdId,recipient_email:fwdEmail||'',subject:fwdSubj,body:fwdBody,notification_type:'forward',status:fwdEmailStatus,sent_at:new Date().toISOString()});
        }catch(fe){console.warn('Forward notify failed:',fe)}
        // LINE OA push (ส่งได้แม้ผู้รับไม่มีอีเมลจริง)
        try{
          var fwdLine='[กนค.] 📨 มีหนังสือขาเข้าส่งต่อถึงคุณ\nเรียน '+(fwdUser?fwdUser.full_name:'')+'\nเลขที่: '+docNum+'\nเรื่อง: '+(doc2.title||'')+(note?'\nหมายเหตุ: '+note:'')+'\n\n'+(SETT.app_url?'เข้าสู่ระบบเพื่อรับเอกสาร: '+SETT.app_url:'กรุณาเข้าสู่ระบบ SAEDU Flow เพื่อรับเอกสาร');
          var fwdFlex=null;
          try{fwdFlex=buildLineFlex({headText:'📨 มีหนังสือขาเข้าส่งต่อถึงคุณ',recipName:(fwdUser?fwdUser.full_name:''),subj:doc2.title||'',rows:[['เลขที่',docNum]].concat(note?[['หมายเหตุ',note]]:[]),infoText:'เอกสารผ่านการลงนามครบถ้วนแล้ว กดรับเอกสารเพื่อดาวน์โหลดไฟล์',button:'เข้าสู่ระบบเพื่อรับเอกสาร'})}catch(fe){}
          await sendLineWithLog(docId,fwdId,fwdEmail||'',fwdSubj,fwdLine,'forward',fwdFlex);
        }catch(le){console.warn('Forward LINE failed:',le)}
      }
      $e('mwrap').innerHTML='';
      var a=$e('dal');if(a)a.innerHTML=alrtH('ok','ออกเลขเอกสารเรียบร้อยแล้ว เลขที่: <strong class="mono">'+esc(docNum)+'</strong>'+(fwdId?' และส่งต่อแล้ว':''));
    }
    setTimeout(function(){nav('det',docId)},900)
  }catch(e){showAlert('เกิดข้อผิดพลาด: '+e.message,'er');if(btn){btn.disabled=false;btn.innerHTML=svg('ok',13)+' บันทึกและเสร็จสิ้น'}}
}
