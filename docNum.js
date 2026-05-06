/* ─── DOC NUM — ออกเลขที่หนังสือขาออก (กนค. SPPTNNN/BBBB หรือ กนค. SPPTNNN-CC/BBBB) ─── */

// Query the next available sequence number for a given category, excluding the current doc
async function _nextDocNum(docId,docType,catPfx,club,thisYear,thaiYear){
  var gnkPfx='กนค. ',fullPfx=gnkPfx+catPfx;
  var seq=await dg('documents','?doc_type=eq.'+docType+'&doc_number=not.is.null&created_at=gte.'+thisYear+'-01-01T00:00:00Z&select=doc_number,id');
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
    var creator=(await dg('users','?id=eq.'+safeId(doc.created_by)+'&select=position_code,full_name&limit=1'))[0]||{};
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
      '<div class="fg"><label class="fl">ตำแหน่ง (หลักที่ 2–3)</label>',
      '<div class="fi" style="background:#f9f7f5;color:#6b6560;cursor:default;font-size:12px">'+esc(posCode)+' — '+esc(posName)+'</div></div>',
      '<input type="hidden" id="num-poscode" value="'+posCode+'">',
      '<div class="fg"><label class="fl">ภาคการศึกษา (หลักที่ 1) <span class="req">*</span></label>',
      '<select class="fi" id="num-sem" onchange="_previewOutNum()">'+semOpts+'</select></div>',
      '<div class="fg"><label class="fl">ประเภทจดหมาย (หลักที่ 4) <span class="req">*</span></label>',
      '<select class="fi" id="num-lt" onchange="_previewOutNum()">'+ltOpts+'</select></div>',
      '<div class="fg"><label class="fl">ชมรม (หลักที่ 8–9)</label>',
      '<select class="fi" id="num-club" onchange="_previewOutNum()">'+clubOpts+'</select></div>',
      '<div class="fg"><label class="fl">วันที่หนังสือ <span class="req">*</span></label>',
      '<input type="date" class="fi" id="num-docdate" value="'+today+'" oninput="_updateDateStamp()"></div>',
      '<div class="fg"><label class="fl">ตัวอย่างเลขที่</label>',
      '<div class="fi" id="num-preview" style="background:#f9f7f5;color:#1261AB;font-size:12px;font-family:\'TH Sarabun PSK\', Sarabun, sans-serif;font-weight:700;cursor:default;letter-spacing:.5px">—</div></div>',
      '<div style="font-size:11px;color:#a89e99;margin-top:6px;line-height:1.7;display:flex;gap:6px;align-items:flex-start">',
      svg('info',12)+'<span>ลากกล่องเลขที่และวันที่บนตัวอย่างด้านขวาเพื่อปรับตำแหน่งก่อนบันทึก</span></div>',
      '</div>',

      // ─── ขวา: PDF preview พร้อม draggable stamps ───
      '<div id="num-pdf-outer" style="background:#525659;border-radius:8px;overflow:auto;max-height:72vh;min-height:320px;display:flex;align-items:flex-start;justify-content:center;padding:12px">',
      '<div id="num-pdf-wrap" style="display:flex;align-items:center;justify-content:center;width:100%;min-height:296px">',
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
  var allUsers=await dg('users','?is_active=eq.true&approval_status=eq.approved&order=full_name');
  var uOpts='<option value="">— ไม่ส่งต่อ —</option>'+allUsers.map(function(u){
    return '<option value="'+u.id+'">'+esc(u.full_name)+' ('+RTH[u.role_code]+')</option>'
  }).join('');
  var _ltIdx=LETTER_TYPES.indexOf(doc.description);
  var _ltCode=_ltIdx>=0?String(_ltIdx+1):'';
  var _sEntry=(SENDER_POS||[]).filter(function(p){return p.name===doc.addressed_to})[0]||null;
  var _sCode=_sEntry?_sEntry.code:'00';
  var _sIsClub=_sEntry?_sEntry.isClub:false;
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
    '<div class="fg"><label class="fl">ตำแหน่ง / สังกัดผู้ส่ง (หลักที่ 2–3'+(_sIsClub?' และ 8–9':'')+')</label>',
    '<div class="fi" style="background:#f9f7f5;color:#6b6560;cursor:default;font-size:12px">'+esc(_sCode)+' — '+esc(doc.addressed_to||'—')+'</div></div>',
    '<input type="hidden" id="num-sendercode" value="'+esc(_sCode)+'">',
    '<input type="hidden" id="num-senderclub" value="'+(_sIsClub?esc(_sCode):'')+'">',
    '<div class="fg"><label class="fl">ภาคการศึกษา (หลักที่ 1) <span class="req">*</span></label>',
    '<select class="fi" id="num-sem" onchange="_previewIncNum()">'+semOpts+'</select></div>',
    '<div class="fg"><label class="fl">ประเภทหนังสือ (หลักที่ 4) <span class="req">*</span></label>',
    '<select class="fi" id="num-lt" onchange="_previewIncNum()">'+incLtOpts+'</select></div>',
    '<div class="fg"><label class="fl">วันที่หนังสือ <span class="req">*</span></label>',
    '<input type="date" class="fi" id="num-docdate" value="'+today+'" oninput="_updateDateStamp()"></div>',
    '<div class="fg"><label class="fl">ตัวอย่างเลขที่</label>',
      '<div class="fi" id="num-preview" style="background:#f9f7f5;color:#1261AB;font-size:12px;font-family:\'TH Sarabun PSK\', Sarabun, sans-serif;font-weight:700;cursor:default;letter-spacing:.5px">—</div></div>',
    '<div class="fg"><label class="fl">ส่งต่อให้ จนท.กิจนิสิต (ไม่บังคับ)</label>',
    '<select class="fi" id="num-fwd">'+uOpts+'</select></div>',
    '<div class="fg"><label class="fl">หมายเหตุ</label>',
    '<textarea class="fi" id="num-note" rows="2" placeholder="หมายเหตุ (ถ้ามี)"></textarea></div>',
    '<div style="font-size:11px;color:#a89e99;margin-top:6px;line-height:1.7;display:flex;gap:6px;align-items:flex-start">',
    svg('info',12)+'<span>ลากกล่องเลขที่และวันที่บนตัวอย่างด้านขวาเพื่อปรับตำแหน่งก่อนบันทึก</span></div>',
    '</div>',
    '<div id="num-pdf-outer" style="background:#525659;border-radius:8px;overflow:auto;max-height:72vh;min-height:320px;display:flex;align-items:flex-start;justify-content:center;padding:12px">',
    '<div id="num-pdf-wrap" style="display:flex;align-items:center;justify-content:center;width:100%;min-height:296px">',
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

/* ─── Drag handler สำหรับ stamp overlays ─── */
function _makeStampDraggable(el,container){
  var drag=false,ox=0,oy=0,sx=0,sy=0;
  el.addEventListener('pointerdown',function(e){
    drag=true; sx=e.clientX; sy=e.clientY;
    ox=parseInt(el.style.left)||0; oy=parseInt(el.style.top)||0;
    el.setPointerCapture(e.pointerId); el.style.cursor='grabbing'; e.preventDefault();
  });
  el.addEventListener('pointermove',function(e){
    if(!drag) return;
    var nl=ox+(e.clientX-sx), nt=oy+(e.clientY-sy);
    el.style.left=Math.max(0,Math.min(container.offsetWidth-el.offsetWidth-2,nl))+'px';
    el.style.top=Math.max(0,Math.min(container.offsetHeight-el.offsetHeight-2,nt))+'px';
  });
  el.addEventListener('pointerup',function(e){
    drag=false; el.releasePointerCapture(e.pointerId); el.style.cursor='grab';
  });
}

/* ─── โหลด PDF และสร้าง canvas preview พร้อม draggable stamps ─── */
async function _loadNumPDFPreview(docId){
  var wrap=$e('num-pdf-wrap'); if(!wrap) return;
  try{
    var files=await dg('document_files','?document_id=eq.'+safeId(docId)+'&file_type=like.application%2Fpdf&order=version.desc&limit=1');
    if(!files||!files.length){
      wrap.innerHTML='<div style="color:rgba(255,255,255,.6);font-size:12px;padding:20px;text-align:center">ไม่พบไฟล์ PDF<br>ระบบจะประทับที่ตำแหน่งเริ่มต้น</div>';
      return;
    }
    var pdfUrl=furl(files[0].file_path);
    if(!window.pdfjsLib){
      await loadSc('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js');
      pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
    }
    var pdf=await pdfjsLib.getDocument(pdfUrl).promise;
    var page=await pdf.getPage(1);
    var outer=$e('num-pdf-outer');
    var availW=Math.max((outer?outer.offsetWidth:420)-24, 200);
    var vp0=page.getViewport({scale:1});
    var sc=Math.min(availW/vp0.width,(window.innerHeight*0.64)/vp0.height);
    var vp=page.getViewport({scale:sc});

    var canvas=document.createElement('canvas');
    canvas.width=vp.width; canvas.height=vp.height;
    canvas.style.cssText='display:block;border-radius:4px;box-shadow:0 6px 24px rgba(0,0,0,.5)';
    await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;

    var cont=document.createElement('div');
    cont.id='num-stamp-container';
    cont.style.cssText='position:relative;flex-shrink:0';
    cont.dataset.scale=String(sc);
    cont.dataset.pdfH=String(vp0.height);
    cont.appendChild(canvas);

    var SCSS='position:absolute;color:#1261AB;font-size:12px;font-family:"TH Sarabun PSK", Sarabun, sans-serif;font-weight:700;white-space:nowrap;cursor:grab;'+
             'user-select:none;padding:2px 6px;border:1.5px dashed rgba(18,97,171,.55);border-radius:3px;'+
             'background:rgba(255,255,255,.88);line-height:1.5;touch-action:none';
    var defTop=Math.round(vp.height*0.32);

    var ns=document.createElement('div');
    ns.id='num-stamp-num'; ns.style.cssText=SCSS;
    ns.style.left='42px'; ns.style.top=defTop+'px';
    ns.textContent=($e('num-preview')||{}).textContent||'กนค. XXXX/XXXX';
    cont.appendChild(ns);

    var ds=document.createElement('div');
    ds.id='num-stamp-date'; ds.style.cssText=SCSS;
    ds.style.left='42px'; ds.style.top=(defTop+Math.round(vp.height*0.065))+'px';
    ds.textContent=_fmtDateThai(gv('num-docdate')||'');
    cont.appendChild(ds);

    wrap.innerHTML=''; wrap.style.cssText='display:block';
    wrap.appendChild(cont);
    _makeStampDraggable(ns,cont);
    _makeStampDraggable(ds,cont);
  }catch(e){
    console.warn('PDF preview failed:',e);
    wrap.innerHTML='<div style="color:rgba(255,255,255,.6);font-size:12px;padding:20px;text-align:center">โหลดตัวอย่างไม่ได้<br>ระบบจะประทับที่ตำแหน่งเริ่มต้น</div>';
  }
}

async function doSetDocNumber(docId){
  var docDate=gv('num-docdate');
  if(!docDate){alert('กรุณาเลือกวันที่หนังสือ');return}
  var btn=document.querySelector('[data-action="doSetDocNumber"]');
  if(btn){btn.disabled=true;btn.innerHTML='<span class="sp"></span>'}
  try{
    var doc=(await dg('documents','?id=eq.'+safeId(docId)))[0]||{};
    var docNum, note='', fwdId=null;
    var _numPdfX=42,_numPdfY=572,_datPdfX=42,_datPdfY=550,_dateText='';

    if(doc.doc_type==='outgoing'){
      var sem=gv('num-sem')||'1';
      var pos=($e('num-poscode')||{}).value||'00';
      var lt=gv('num-lt')||'';
      var club=gv('num-club')||'';
      if(!lt){alert('กรุณาเลือกประเภทจดหมาย');if(btn){btn.disabled=false;btn.innerHTML=svg('ok',13)+' ออกเลขและเสร็จสิ้น';}return}
      var thisYear=new Date().getFullYear();
      var thaiYear=String(thisYear+543);
      var catPfx=sem+pos+lt;
      docNum=await _nextDocNum(docId,'outgoing',catPfx,club,thisYear,thaiYear);
      note='ออกเลขหนังสือขาออก: '+docNum;
      _dateText=_fmtDateThai(docDate);

      // อ่านตำแหน่ง stamp จาก draggable elements แปลงจาก canvas px → PDF points
      var _sc=$e('num-stamp-container');
      var _scSc=_sc?parseFloat(_sc.dataset.scale)||1:1;
      var _scPdfH=_sc?parseFloat(_sc.dataset.pdfH)||842:842;
      var _ns=$e('num-stamp-num');
      var _ds=$e('num-stamp-date');
      if(_ns){_numPdfX=parseInt(_ns.style.left)/_scSc; _numPdfY=_scPdfH-parseInt(_ns.style.top)/_scSc-14;}
      else    {_numPdfX=42; _numPdfY=_scPdfH-270;}
      if(_ds){_datPdfX=parseInt(_ds.style.left)/_scSc; _datPdfY=_scPdfH-parseInt(_ds.style.top)/_scSc-14;}
      else    {_datPdfX=42; _datPdfY=_scPdfH-290;}
    } else if(doc.doc_type==='incoming'){
      var sem=gv('num-sem')||'1';
      var pos=($e('num-sendercode')||{}).value||'00';
      var club=($e('num-senderclub')||{}).value||'';
      var lt=gv('num-lt')||'';
      note=(gv('num-note')||'').trim();
      fwdId=gv('num-fwd')||null;
      if(!lt){alert('กรุณาเลือกประเภทหนังสือ');if(btn){btn.disabled=false;btn.innerHTML=svg('ok',13)+' ออกเลขและเสร็จสิ้น';}return}
      var thisYear=new Date().getFullYear();
      var thaiYear=String(thisYear+543);
      var catPfx=sem+pos+lt;
      docNum=await _nextDocNum(docId,'incoming',catPfx,club,thisYear,thaiYear);
      note=note||('ออกเลขหนังสือขาเข้า: '+docNum);
      _dateText=_fmtDateThai(docDate);
      var _sc=$e('num-stamp-container');
      var _scSc=_sc?parseFloat(_sc.dataset.scale)||1:1;
      var _scPdfH=_sc?parseFloat(_sc.dataset.pdfH)||842:842;
      var _ns=$e('num-stamp-num');
      var _ds=$e('num-stamp-date');
      if(_ns){_numPdfX=parseInt(_ns.style.left)/_scSc; _numPdfY=_scPdfH-parseInt(_ns.style.top)/_scSc-14;}
      else    {_numPdfX=42; _numPdfY=_scPdfH-270;}
      if(_ds){_datPdfX=parseInt(_ds.style.left)/_scSc; _datPdfY=_scPdfH-parseInt(_ds.style.top)/_scSc-14;}
      else    {_datPdfX=42; _datPdfY=_scPdfH-290;}
    } else {
      docNum=(gv('num-docnum')||'').trim();
      note=(gv('num-note')||'').trim();
      fwdId=gv('num-fwd')||null;
      if(!docNum){alert('กรุณาระบุเลขที่หนังสือ');if(btn){btn.disabled=false;btn.innerHTML=svg('ok',13)+' บันทึกและเสร็จสิ้น';}return}
    }

    var upd={doc_number:docNum,doc_date:docDate,status:'completed',updated_at:new Date().toISOString()};
    if(fwdId) Object.assign(upd,{forwarded_to_id:fwdId,forwarded_at:new Date().toISOString()});
    await dpa('documents',docId,upd);
    // Detect-and-retry: ถ้าเลขซ้ำจาก race condition ให้คำนวณใหม่และ patch อีกครั้ง (สูงสุด 2 รอบ)
    // หมายเหตุ: ถ้าชนครั้งที่ 3 (ซึ่งแทบเป็นไปไม่ได้จริง) ให้ log แล้วดำเนินต่อ
    // เพราะ document อยู่ใน completed แล้ว — throw จะทำให้ user เห็น error ทั้งที่เลขถูก save ไปแล้ว
    if(doc.doc_type==='outgoing'||doc.doc_type==='incoming'){
      for(var _r=0;_r<3;_r++){
        var _ck=await dg('documents','?doc_number=eq.'+encodeURIComponent(docNum)+'&id=neq.'+safeId(docId)+'&select=id&limit=1');
        if(!_ck||!_ck.length)break;
        if(_r===2){console.warn('[docNum] 3 consecutive collisions, proceeding with last written number:',docNum,'doc:',docId);break;}
        docNum=await _nextDocNum(docId,doc.doc_type,catPfx,club,thisYear,thaiYear);
        if(doc.doc_type==='outgoing') note='ออกเลขหนังสือขาออก: '+docNum;
        else if(doc.doc_type==='incoming'&&!gv('num-note')) note='ออกเลขหนังสือขาเข้า: '+docNum;
        await dpa('documents',docId,{doc_number:docNum,updated_at:new Date().toISOString()});
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
          var _pdfResp=await fetch(furl(_pf.file_path));
          if(_pdfResp.ok){
            var _pdfBuf=await _pdfResp.arrayBuffer();
            var _pdfDoc=await PDFLib.PDFDocument.load(new Uint8Array(_pdfBuf),{ignoreEncryption:true});
            var _pg=_pdfDoc.getPage(0);
            var _ph=_pg.getHeight(), _pw2=_pg.getWidth();
            var _stampFont=null;
            try{
              _pdfDoc.registerFontkit(window.fontkit);
              var _fBytes=await fetch('https://cdn.jsdelivr.net/gh/Phonbopit/sarabun-webfont@master/fonts/thsarabunnew-webfont.ttf').then(function(r){
                if(!r.ok) throw new Error('Font HTTP error');
                return r.arrayBuffer();
              });
              _stampFont=await _pdfDoc.embedFont(_fBytes);
            }catch(_fe){
              console.warn('Thai font load failed, using fallback:',_fe.message);
              // หากโหลดฟอนต์ไทยไม่ได้ ต้องลบภาษาไทยออกเพื่อป้องกัน pdf-lib error (WinAnsi cannot encode)
              docNum = docNum.replace(/[^\x00-\x7F]/g, '').trim(); 
              _dateText = ''; 
            }
            if(!_stampFont) _stampFont=await _pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
            var _clr=PDFLib.rgb(0.07,0.38,0.67);
            var clamp=function(v,lo,hi){return Math.max(lo,Math.min(hi,v));};
            
            if(docNum) _pg.drawText(docNum,{x:clamp(_numPdfX,0,_pw2-10),y:clamp(_numPdfY,10,_ph-10),size:12,font:_stampFont,color:_clr});
            if(_dateText) _pg.drawText(_dateText,{x:clamp(_datPdfX,0,_pw2-10),y:clamp(_datPdfY,10,_ph-10),size:12,font:_stampFont,color:_clr});
            
            var _stampBytes=await _pdfDoc.save();
            var _stampPath='stamped_'+Date.now()+'_'+_pf.file_name.replace(/[^a-zA-Z0-9._-]/g,'_');
            var _stampBlob=new Blob([_stampBytes],{type:'application/pdf'});
            await upFile(_stampPath,_stampBlob);
            await dp('document_files',{document_id:docId,file_name:_pf.file_name,file_path:_stampPath,file_size:_stampBlob.size,file_type:'application/pdf',uploaded_by:CU.id,version:(_pf.version||1)+1});
            await dp('document_history',{document_id:docId,action:'ประทับเลขหนังสือลงในเอกสาร: '+docNum,performed_by:CU.id});
          }
        }
      }catch(_se){console.warn('PDF stamp failed:',_se)}
    }
    if(doc.doc_type==='outgoing'){
      try{
        var posUsers=await dg('users','?position_code=eq.'+encodeURIComponent(doc.addressed_to)+'&is_active=eq.true&approval_status=eq.approved&limit=1');
        var posUser=posUsers[0];
        if(posUser){
          var posEmail=posUser.contact_email||posUser.email;
          if(posEmail&&!posEmail.includes('@gnk.student')){
            var eSubj='[กนค.] หนังสือขาออก เลขที่ '+docNum+': '+(doc.title||'');
            var eBody='เรียน '+posUser.full_name+', มีหนังสือขาออกถึงท่าน เลขที่ '+docNum+' เรื่อง "'+esc(doc.title||'')+'"';
            var er=await fetch(SU+'/functions/v1/send-email',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SK,'apikey':SK},body:JSON.stringify({to:posEmail,subject:eSubj,html:eBody})});
            if(er.ok&&typeof showEmailToast==='function') showEmailToast(posEmail,eSubj);
            await dp('notifications',{document_id:docId,recipient_id:posUser.id,recipient_email:posEmail,subject:eSubj,body:eBody,notification_type:'outgoing',status:er.ok?'sent':'failed',sent_at:new Date().toISOString()});
          }
        }
      }catch(ne){console.warn('Outgoing notify failed:',ne)}
      $e('mwrap').innerHTML='';
      var a2=$e('dal');if(a2)a2.innerHTML='<div class="al al-ok"><span class="al-icon">'+svg('ok',13)+'</span><span>ออกเลขหนังสือขาออกเรียบร้อยแล้ว เลขที่: <strong class="mono">'+esc(docNum)+'</strong></span></div>';
    } else {
      if(fwdId){
        var fwdUser=(await dg('users','?id=eq.'+fwdId))[0];
        var doc2=(await dg('documents','?id=eq.'+docId))[0]||{};
        var fwdEmail=fwdUser?(fwdUser.contact_email||fwdUser.email):'';
        if(fwdEmail&&!fwdEmail.includes('@gnk.student')){
          var fwdSubj='[กนค.] ส่งต่อหนังสือขาเข้า: '+(doc2.title||'');
          var fwdBody='เรียน '+(fwdUser?fwdUser.full_name:'')+', ท่านได้รับหนังสือขาเข้าเลขที่ '+docNum+' เรื่อง "'+(doc2.title||'')+'" ที่ผ่านการลงนามครบถ้วนแล้ว'+(note?' หมายเหตุ: '+note:'');
          try{
            var r=await fetch(SU+'/functions/v1/send-email',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SK,'apikey':SK},body:JSON.stringify({to:fwdEmail,subject:fwdSubj,html:fwdBody})});
            if(r.ok) showEmailToast(fwdEmail,fwdSubj);
            await dp('notifications',{document_id:docId,recipient_id:fwdId,recipient_email:fwdEmail,subject:fwdSubj,body:fwdBody,notification_type:'forward',status:r.ok?'sent':'failed',sent_at:new Date().toISOString()});
          }catch(fe){console.warn('Forward email failed:',fe)}
        }
      }
      $e('mwrap').innerHTML='';
      var a=$e('dal');if(a)a.innerHTML=alrtH('ok','ออกเลขเอกสารเรียบร้อยแล้ว เลขที่: <strong class="mono">'+esc(docNum)+'</strong>'+(fwdId?' และส่งต่อแล้ว':''));
    }
    setTimeout(function(){nav('det',docId)},900)
  }catch(e){alert('เกิดข้อผิดพลาด: '+e.message);if(btn){btn.disabled=false;btn.innerHTML=svg('ok',13)+' บันทึกและเสร็จสิ้น'}}
}
