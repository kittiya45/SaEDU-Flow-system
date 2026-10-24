/* ─── UTILS ─── */
/* โหลด homeViews.js / dashboard.js สำรอง — กรณี cache เก่าชี้ dashboard.js หรือ ad blocker บล็อกไฟล์แรก */
var _homeViewsLoad=null;
function _homeViewsOk(){return typeof vDash==='function'&&typeof vTodo==='function'}
function _loadScriptOnce(url){
  return new Promise(function(ok,no){
    var s=document.createElement('script');
    s.src=url;
    s.async=false;
    s.onload=function(){ok();};
    s.onerror=function(){no(new Error('โหลด '+url+' ไม่สำเร็จ'));};
    document.head.appendChild(s);
  });
}
async function _ensureHomeViews(){
  if(_homeViewsOk()) return true;
  if(_homeViewsLoad) return _homeViewsLoad;
  _homeViewsLoad=(async function(){
    var urls=['homeViews.js?v=13','dashboard.js?v=33'];
    for(var i=0;i<urls.length;i++){
      if(_homeViewsOk()) return true;
      try{await _loadScriptOnce(urls[i]);}catch(e){console.warn(e);}
    }
    return _homeViewsOk();
  })();
  try{return await _homeViewsLoad;}
  finally{_homeViewsLoad=null;}
}
async function dlFile(urlOrPath,name){
  var resolved=urlOrPath;
  try{resolved=await resolveFileUrl(urlOrPath)}catch(e){}
  try{
    var r=await fetch(resolved);
    if(!r.ok) throw new Error('HTTP '+r.status);
    var blob=await r.blob();
    var a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=name||'download';
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){URL.revokeObjectURL(a.href);document.body.removeChild(a);},200);
  }catch(e){window.open(resolved,'_blank');}
}
function fd(d){
  if(!d)return'—';
  return new Date(d).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit'})
}
function fsz(b){
  if(!b)return'';
  if(b<1024)return b+'B';
  if(b<1048576)return(b/1024).toFixed(1)+'KB';
  return(b/1048576).toFixed(1)+'MB'
}
/* เทียบชื่อไฟล์แบบไม่สนตัวพิมพ์ — ใช้กันอัปโหลดชื่อซ้ำ + ติดป้ายในรายการ */
function _fileNameKey(name){
  return String(name||'').trim().toLowerCase();
}
/* แยกไฟล์ใหม่ / ชื่อซ้ำ (รวมชื่อซ้ำภายในชุดที่เลือกเอง) */
function _splitDupFiles(incoming, existing){
  var have={};
  (existing||[]).forEach(function(f){
    var k=_fileNameKey(f.file_name||f.name);
    if(k) have[k]=true;
  });
  var fresh=[], dups=[], seenBatch={};
  for(var i=0;i<(incoming||[]).length;i++){
    var f=incoming[i];
    var n=f.name||f.file_name||'';
    var k=_fileNameKey(n);
    if(!k) continue;
    if(have[k]||seenBatch[k]){ dups.push(n); continue; }
    seenBatch[k]=true;
    fresh.push(f);
  }
  return {fresh:fresh, dups:dups};
}
function ini(n){return(n||'').split(' ').map(function(w){return w[0]||''}).join('').slice(0,2).toUpperCase()||'??'}
function esc(s){return(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function _lcr(){if(window.lucide)window.lucide.createIcons()}
function rdr(h){document.getElementById('app').innerHTML=h;_lcr()}
function gv(id){var el=document.getElementById(id);return el?el.value:''}
function $e(id){return document.getElementById(id)}
/* ผูก drag & drop ให้ .upload-zone — เดิมรับไฟล์ได้แค่คลิกเลือกผ่าน <label for=inputId>
   onFiles รับ element ที่มี .files เหมือน <input type=file> จริง เพื่อให้ใช้ handler เดิมได้โดยไม่ต้องแก้ */
/* เนื้อในกล่องอัปโหลดแบบเดียวทั้งระบบ — ไอคอนเมฆ / "เลือกไฟล์ หรือลากและวางไฟล์ที่นี่" / ข้อความรองรับ / ปุ่มเลือกไฟล์
   ใส่ไว้ใน .upload-zone (เพิ่มคลาส sm สำหรับกล่องเล็กใน modal/แถบเครื่องมือ) — hintId ให้โค้ดอื่นเปลี่ยนข้อความรองรับได้
   title = ชื่อกล่อง (เป็น tooltip — ทุกจุดที่เรียกมีป้ายกำกับอยู่รอบกล่องแล้ว)
   ปุ่มเป็น <span> ไม่ใช่ <button> — คลิกได้เพราะทั้งกล่องเป็น <label for> หรือมี onclick อยู่แล้ว
   (<button> ใน <label> จะกลืนคลิกไม่ให้เปิดหน้าต่างเลือกไฟล์) */
function uploadZoneInner(title,hint,hintId){
  return '<div class="upload-zone-inner" title="'+esc(title||'อัปโหลดไฟล์')+'">'+
    '<div class="upload-zone-icon">'+svg('cloud-upload',40)+'</div>'+
    '<div class="upload-zone-title">เลือกไฟล์ หรือลากและวางไฟล์ที่นี่</div>'+
    (hint||hintId?'<div class="upload-zone-hint"'+(hintId?' id="'+hintId+'"':'')+'>'+esc(hint||'')+'</div>':'')+
    '<span class="upload-zone-btn">เลือกไฟล์</span>'+
  '</div>';
}
function _wireDropzone(zoneEl,inputEl,onFiles){
  if(!zoneEl||!inputEl) return;
  zoneEl.addEventListener('dragover',function(e){e.preventDefault();zoneEl.classList.add('dragover')});
  zoneEl.addEventListener('dragleave',function(){zoneEl.classList.remove('dragover')});
  zoneEl.addEventListener('drop',function(e){
    e.preventDefault();
    zoneEl.classList.remove('dragover');
    if(e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files.length){
      inputEl.files=e.dataTransfer.files;
      onFiles(inputEl);
    }
  });
}
function alrtH(t,m){
  var ic={ok:svg('ok',13),er:svg('x',13),in:svg('info',13),wa:svg('warn',13)};
  return '<div class="al al-'+t+'"><span class="al-icon">'+ic[t]+'</span><span>'+esc(m)+'</span></div>'
}

function sBadge(s, labelOverride){
  var cls={draft:'b-draft',pending:'b-pending',signed:'b-signed',rejected:'b-rejected',numbering:'b-numbering',awaiting_submit:'b-awaiting',completed:'b-completed',cancelled:'b-cancelled'};
  var txt={draft:'ร่างเอกสาร',pending:'รอลงนาม',signed:'ลงนามแล้ว',rejected:'ส่งคืนแก้ไข',numbering:'รอออกเลขหนังสือ',awaiting_submit:'รอเจ้าหน้าที่ยื่นในระบบ',completed:'เสร็จสมบูรณ์',cancelled:'ยกเลิกแล้ว'};
  var label=labelOverride||txt[s]||s;
  var wrap=(labelOverride||s==='awaiting_submit')?' style="white-space:normal;line-height:1.35;text-align:left;max-width:15.5rem"':'';
  return '<span class="badge '+(cls[s]||'b-draft')+'"'+wrap+'><span class="bdot"></span>'+esc(label)+'</span>'
}
/* สถานะแสดงเมื่อเอกสารออกเลขแล้วถูกส่งต่อไปยัง จนท./คณะ รอรับ */
var FWD_STATUS_LABEL='นำส่งเข้ากภ.กิจการนิสิต /คณะ';
function sBadgeFwd(pending){
  return sBadge('pending', pending?FWD_STATUS_LABEL:'เสร็จสมบูรณ์');
}
function _isStaffPoolFwd(d){
  return !!(d&&d.forwarded_to_staff&&d.status==='completed');
}
function _canActStaffPool(){
  return CU&&(CU.role_code==='ROLE-STF'||CU.role_code==='ROLE-SYS'||CU.role_code==='ROLE-DEV');
}
function _isFwdInboxForMe(d){
  if(!d||d.status!=='completed') return false;
  if(d.forwarded_to_id===CU.id) return true;
  if(_isStaffPoolFwd(d)&&CU.role_code==='ROLE-STF') return true;
  /* ส่งต่อแบบระบุตัวผู้รับ แต่ผู้รับกดรับเองไม่ได้ (เช่นเอกสารรุ่นเก่าที่ถูกส่งกลับไปหาผู้จัดทำ)
     — จนท./แอดมิน/dev รับเรื่องแทนได้ ไม่งั้นเอกสารค้างสถานะ "รอเจ้าหน้าที่รับเอกสาร" ถาวร
     (ตรงกับ forward_accept() ใน DB ที่ยกเว้น is_admin()/is_dev() จากเงื่อนไข forwarded_to_id) */
  return !!d.forwarded_to_id&&_canActStaffPool()&&d.created_by!==CU.id;
}

function tBadge(t){
  var cls={incoming:'b-draft',outgoing:'b-signed'};
  var lbl={incoming:'ขาเข้า',outgoing:'ขาออก'};   /* ตรงกับ DTYPES/doc_types ใน DB — อย่าสลับกลับ */
  return '<span class="badge '+(cls[t]||'b-draft')+'">'+esc(lbl[t]||t)+'</span>'
}
/* จำแนกประเภทไฟล์จากนามสกุล/mime — คืน {ic,label,bg,cl} สำหรับ chip ไอคอนรายการไฟล์
   ใช้ร่วมกัน: buildFileList (docForm), _rCurFileRow/showVerHist (docDetail) */
function fType(f){
  var n=((f&&(f.file_name||f.name))||'').toLowerCase(), t=((f&&f.file_type)||'').toLowerCase();
  var ext=(n.match(/\.([a-z0-9]+)$/)||[])[1]||'';
  if(t.indexOf('image')>=0||['png','jpg','jpeg','gif','webp'].indexOf(ext)>=0)
    return {ic:'img2',label:ext?ext.toUpperCase():'รูปภาพ',bg:'#EDE9FE',cl:'#7C3AED'};
  if(t.indexOf('pdf')>=0||ext==='pdf')
    return {ic:'pdf_ico',label:'PDF',bg:'#FEE2E2',cl:'#DC2626'};
  if(t.indexOf('word')>=0||t.indexOf('officedocument')>=0||ext==='doc'||ext==='docx')
    return {ic:'word_ico',label:ext?ext.toUpperCase():'Word',bg:'#DBEAFE',cl:'#2563EB'};
  if(t.indexOf('html')>=0||ext==='html')
    return {ic:'doc',label:'HTML',bg:'#FEF3C7',cl:'#D97706'};
  return {ic:'doc',label:ext?ext.toUpperCase():'ไฟล์',bg:'#F5F3F0',cl:'#6b6560'};
}
function fChip(f,s){
  var ft=fType(f);
  return '<div class="file-chip" style="background:'+ft.bg+';color:'+ft.cl+'">'+svg(ft.ic,s||19)+'</div>'
}
/* การ์ดไฟล์แบบ "หน้ากระดาษ + ป้ายนามสกุล" (ใช้ในหน้าแบบฟอร์ม) — w = ความกว้างเป็น px
   ลายในหน้ากระดาษบอกชนิดไฟล์: ข้อความ / ตาราง / zip / รูป / โค้ด / วิดีโอ  สไตล์อยู่ใน styles.css (.fcard*) */
var _FCARD_T={
  txt:['TXT','#78716C','ln'], doc:['DOC','#2563EB','ln'], docx:['DOCX','#2563EB','ln'], pdf:['PDF','#DC2626','ln'],
  md:['MD','#57534E','md'], mdx:['MDX','#57534E','md'],
  xls:['XLS','#15803D','grid'], xlsx:['XLSX','#15803D','grid'], csv:['CSV','#0F766E','grid'],
  zip:['ZIP','#7C3AED','zip'], rar:['RAR','#7C3AED','zip'], '7z':['7Z','#7C3AED','zip'], tar:['TAR','#B45309','zip'], gz:['GZ','#B45309','zip'],
  ppt:['PPT','#EA580C','media'], pptx:['PPTX','#EA580C','media'],
  json:['JSON','#CA8A04','code'], css:['CSS','#1D4ED8','code'], js:['CODE','#C2410C','code'], html:['HTML','#C2410C','code'],
  png:['PNG','#57534E','media'], jpg:['JPG','#15803D','media'], jpeg:['JPG','#15803D','media'],
  gif:['IMG','#DB2777','media'], webp:['IMG','#DB2777','media'], svg:['IMG','#DB2777','media'],
  mp4:['VIDEO','#15803D','video'], mov:['VIDEO','#15803D','video'], webm:['VIDEO','#15803D','video']
};
function fCard(f,w){
  var n=((f&&(f.file_name||f.name))||'').toLowerCase();
  var ext=(n.match(/\.([a-z0-9]+)$/)||[])[1]||'';
  var t=_FCARD_T[ext]||[ext?ext.toUpperCase().slice(0,5):'FILE','#78716C','ln'];
  var cl=t[1], k=t[2], ln=function(c){return '<i class="fcard-ln'+(c?' '+c:'')+'"></i>'}, body='';
  if(k==='grid') body='<i class="fcard-grid">'+new Array(13).join('<i></i>')+'</i>';
  else if(k==='zip') body='<i class="fcard-zip"></i>';
  else if(k==='media'||k==='video') body='<i class="fcard-media">'+(k==='video'?'<i class="fcard-play" style="border-left-color:'+cl+'"></i>':'<i class="fcard-dot" style="background:'+cl+'"></i>')+'</i>'+ln('w6')+ln('w4');
  else if(k==='code') body='<i class="fcard-code" style="color:'+cl+'">'+ln('w3')+ln('w6 in')+ln('w5 in')+ln('w3')+'</i>';
  else if(k==='md') body='<i class="fcard-hash">#</i>'+ln('w5')+ln('w8')+ln('w6')+ln('w7');
  else body=ln('w5')+ln('w8')+ln('w7')+ln('w8')+ln('w6')+ln('w7');
  return '<div class="fcard" style="font-size:'+(w||44)+'px" aria-hidden="true"><i class="fcard-page">'+body+'</i>'+
    '<span class="fcard-badge" style="background:'+cl+'">'+esc(t[0])+'</span></div>'
}
/* PDF หลักสำหรับลงนาม = ไฟล์ PDF แรกที่ผู้ใช้อัปโหลด (ไม่นับฉบับ [ลงนาม] ที่ระบบสร้าง)
   working = เวอร์ชันล่าสุดของกลุ่มชื่อเดียวกัน (ฉบับเซ็นแล้วถ้ามี — ใช้ซ้อนลายเซ็นต่อ) */
function _isSignedPdfRow(f){
  return f.file_name.indexOf('[ลงนาม]')>=0||f.file_path.indexOf('signed/')===0||/^signed_/.test(f.file_path||'');
}
function _signFileBaseName(f){
  return f.file_name.replace(/^(\[(ลงนาม|ตีกลับ|แก้ไข)\]\s*)+/g,'').replace(/^(signed|reject|edited)_\d+_/,'');
}
/* ไฟล์ที่ย้ายไปคลัง (Google Drive) แล้ว — ตัวจริงไม่อยู่ใน Storage ดึงมาปั๊มลายเซ็นไม่ได้
   ต้องกรองออกก่อนเลือกไฟล์ทุกครั้ง ไม่งั้นเอกสารที่จบแล้วแต่กลับเข้ากระบวนการ (จนท. ส่งคืน →
   ส่งใหม่, เสนอเพื่อโปรดทราบทีหลัง) จะหยิบไฟล์ในคลังมาแล้วค้างที่ "โหลดเอกสารไม่สำเร็จ"
   ถ้าผู้จัดทำอัปไฟล์ใหม่มาแก้ ตัวเลือกจะเห็นแค่ไฟล์ใหม่นั้น — ถ้าไม่มีเลยคืน null ให้ผู้เรียก
   แจ้งเอง (ดึงไฟล์คืนจากคลังได้ด้วย supabase/52_restore_from_archive.mjs) */
function _isArchivedPdfRow(f){return !!(f&&f.archive_url)}
function _signablePdfs(pdfs){
  return (pdfs||[]).filter(function(f){return f&&!_isArchivedPdfRow(f)});
}
function _primarySignPdf(pdfs){
  pdfs=_signablePdfs(pdfs);
  if(!pdfs.length) return null;
  var sorted=pdfs.slice().sort(function(a,b){
    var ta=a.uploaded_at?new Date(a.uploaded_at).getTime():0, tb=b.uploaded_at?new Date(b.uploaded_at).getTime():0;
    return (ta-tb)||((a.version||1)-(b.version||1));
  });
  return sorted.find(function(f){return !_isSignedPdfRow(f)})||sorted[0];
}
function _signPdfWorkingCopy(pdfs){
  pdfs=_signablePdfs(pdfs);
  var primary=_primarySignPdf(pdfs);
  if(!primary) return null;
  var bn=_signFileBaseName(primary);
  var group=pdfs.filter(function(f){return _signFileBaseName(f)===bn});
  group.sort(function(a,b){
    var ta=a.uploaded_at?new Date(a.uploaded_at).getTime():0, tb=b.uploaded_at?new Date(b.uploaded_at).getTime():0;
    // เสมอกันทั้งเวลาและ version → ให้ฉบับ [ลงนาม] ชนะเสมอ ห้ามหยิบฉบับเปล่าไปเซ็นทับ
    return (tb-ta)||((b.version||1)-(a.version||1))||((_isSignedPdfRow(b)?1:0)-(_isSignedPdfRow(a)?1:0));
  });
  return {primary:primary,working:group[0],baseName:bn,signedRow:group.find(function(f){return _isSignedPdfRow(f)})||null};
}
/* แปลงรูป (data: URL หรือ http URL) เป็นไบต์สำหรับ pdf-lib
   ⚠️ ห้ามใช้ fetch() กับ data: URL — CSP ใน vercel.json มี connect-src ที่ไม่มี data:
   fetch จึงถูกบล็อกและ reject เป็น TypeError "Failed to fetch" โดยไม่มี HTTP status ให้จับ
   นี่คือต้นเหตุที่ลายเซ็นไม่ถูกฝังลงเอกสารเลยตั้งแต่ CSP ถูกเพิ่มเมื่อ 26 ก.ค. 2026
   (ลายเซ็นทุกเส้นทางเป็น data: URL — วาดเองผ่าน canvas.toDataURL, อัปโหลดรูป,
   และลายเซ็นที่บันทึกไว้ซึ่งอ่านผ่าน FileReader.readAsDataURL) */
async function imgSrcToBytes(src){
  if(!src) throw new Error('ไม่พบข้อมูลรูปภาพ');
  if(String(src).indexOf('data:')===0){
    var comma=src.indexOf(',');
    if(comma<0) throw new Error('รูปแบบ data URL ไม่ถูกต้อง');
    var meta=src.slice(0,comma), payload=src.slice(comma+1);
    if(meta.indexOf(';base64')<0){
      // data: URL แบบ percent-encoded (canvas ไม่เคยสร้างแบบนี้ แต่รองรับไว้กันพัง)
      var txt=decodeURIComponent(payload);
      var o2=new Uint8Array(txt.length);
      for(var j=0;j<txt.length;j++) o2[j]=txt.charCodeAt(j);
      return o2;
    }
    var bin=atob(payload);
    var out=new Uint8Array(bin.length);
    for(var i=0;i<bin.length;i++) out[i]=bin.charCodeAt(i);
    return out;
  }
  var r=await fetch(src);
  if(!r.ok) throw new Error('โหลดรูปไม่สำเร็จ (HTTP '+r.status+')');
  return new Uint8Array(await r.arrayBuffer());
}
function urgNorm(u){return u==='very_urgent'?'urgent':(u||'normal')}
function urgTxt(u){return URG[urgNorm(u)]||u||''}
function urgCls(u){return urgNorm(u)==='urgent'?'urg-urgent':'urg-normal'}
/* ความเร่งด่วน: ปกติ / เร่งด่วน (very_urgent ในฐานข้อมูลเก่าแสดงเป็นเร่งด่วน) */
function uBadge(u){
  var n=urgNorm(u);
  var cls={normal:'u-normal',urgent:'u-urgent'};
  return '<span class="ubadge '+(cls[n]||'u-normal')+'"><span class="bdot"></span>'+esc(urgTxt(u))+'</span>'
}

/* การ์ดสถิติแบบ gradient สีสัน — cards: [{label,val,sub?,ico,grad,shadow,navTarget?}] */
function rStatCards(cards, opts){
  opts=opts||{};
  var cols=opts.cols||4;
  var mb=opts.mb||'28px';
  var cls='stat-cards'+(cols===3?' cols-3':'')+(opts.fit?' fit-row':'');
  var html=['<div class="'+cls+'" style="margin-bottom:'+mb+'">'];
  cards.forEach(function(c){
    var click=c.navTarget?' onclick="nav(\''+c.navTarget+'\')"':'';
    var grad=c.grad||'linear-gradient(135deg,#1D4ED8 0%,#3B82F6 100%)';
    var shadow=c.shadow||'rgba(29,78,216,.30)';
    html.push(
      '<div class="stat-card stat-card-grad'+(c.navTarget?' clickable':'')+'"'+click+
      ' style="background:'+grad+';box-shadow:0 4px 16px '+shadow+';--stat-shadow:'+shadow+'">'+
        '<div class="stat-card-bubble stat-card-bubble-a"></div>'+
        '<div class="stat-card-bubble stat-card-bubble-b"></div>'+
        '<div class="stat-card-inner">'+
          '<div class="stat-card-head">'+
            '<div class="stat-card-label">'+esc(c.label)+'</div>'+
            '<div class="stat-card-ico">'+svgf(c.ico,16)+'</div>'+
          '</div>'+
          '<div class="stat-card-val">'+c.val+'</div>'+
          (c.sub?'<div class="stat-card-sub">'+esc(c.sub)+'</div>':'')+
        '</div>'+
      '</div>'
    );
  });
  html.push('</div>');
  return html.join('');
}

function svg(n,s){
  s=s||16;
  var M={
    home:'home',doc:'file-text',plus:'circle-plus',
    users:'users',user:'user',sign:'pen-line',
    up:'upload',dn:'download',edit:'pencil',
    trash:'trash-2',ok:'check',x:'x',
    back:'arrow-left',eye:'eye',srch:'search',
    out:'log-out',save:'save',bell:'bell',
    img2:'image',undo:'undo-2',zin:'zoom-in',
    zout:'zoom-out',bold:'bold',italic:'italic',
    underline:'underline',word_ico:'file-text',pdf_ico:'file',
    lock:'lock',unlock:'unlock',key:'key-round',
    shield:'shield',cal:'calendar',chart:'bar-chart-2',
    warn:'alert-triangle',info:'info',folder:'folder',
    refresh:'refresh-cw',pen:'pen',dots:'more-horizontal',
    gear:'settings',clock:'clock',tri:'chevron-right',
    tasks:'clipboard-list',inbox:'inbox',
    chup:'chevron-up',chdn:'chevron-down'
  };
  var ln=M[n]||n;
  return '<i data-lucide="'+ln+'" width="'+s+'" height="'+s+'" stroke-width="1.6" style="display:inline-flex;vertical-align:middle;flex-shrink:0;pointer-events:none"></i>'
}

/* ไอคอนบนการ์ดสถิติพื้นสี — ใช้ Lucide (lucide.dev) เส้นหนาขึ้นเล็กน้อยให้อ่านง่ายบนพื้น gradient
   ชื่อ *_f คงไว้เพราะ ico ของการ์ดใน homeViews.js อ้างอยู่ */
function svgf(n,s){
  s=s||18;
  var M={doc_f:'file-text',pen_f:'pen-line',check_f:'circle-check',bell_f:'bell',
    warn_f:'triangle-alert',clip_f:'clipboard-list',cal_f:'calendar',users_f:'users'};
  return '<i data-lucide="'+(M[n]||n)+'" width="'+s+'" height="'+s+'" stroke-width="2.2" style="display:inline-flex;vertical-align:middle;flex-shrink:0;pointer-events:none"></i>'
}

function loadSc(src){
  return new Promise(function(res,rej){var s=document.createElement('script');s.src=src;s.onload=res;s.onerror=rej;document.head.appendChild(s)})
}
function debounce(fn,ms){var t=null;return function(){var args=arguments;clearTimeout(t);t=setTimeout(function(){fn.apply(null,args)},ms)}}

/* คำนวณขนาดวางรูปในกรอบ (contain, กึ่งกลาง) — ใช้ร่วมกัน preview + ฝัง PDF */
function fitImgInBox(iw,ih,bw,bh){
  if(!iw||!ih||!bw||!bh) return {dw:bw,dh:bh,ox:0,oy:0};
  var s=Math.min(bw/iw,bh/ih);
  var dw=iw*s,dh=ih*s;
  return {dw:dw,dh:dh,ox:(bw-dw)/2,oy:(bh-dh)/2};
}

/* ─── addWorkingDays: บวกวันทำการ (ข้ามเสาร์-อาทิตย์) ─── */
function addWorkingDays(fromDate, days){
  var d=new Date(fromDate); var added=0;
  while(added<days){
    d.setDate(d.getDate()+1);
    var dow=d.getDay();
    if(dow!==0&&dow!==6) added++; // 0=อาทิตย์, 6=เสาร์
  }
  return d;
}
/* ─── วันที่ออกเลขหนังสือขาออก ───
   นิสิตส่งเอกสารได้ทุกวัน แต่เลขหนังสือขาออกต้องลงวันที่เป็นวันทำการ (จ.–ศ. ไม่รวมวันหยุดตามปฏิทินนิสิต
   ที่ผู้ดูแลกรอกไว้ใน num_holidays) และออกได้ไม่เกิน num_cutoff_time (22:00) — ออกหลังเวลานั้น
   เลขและวันที่หนังสือเป็นของวันทำการถัดไปอัตโนมัติ (ปี พ.ศ. ท้ายเลขก็ตามวันนั้น)
   วันเสาร์–อาทิตย์/วันหยุด: num_holiday_mode='block' (ค่าเริ่มต้น) ออกเลขไม่ได้ · 'shift' ออกได้แต่ลงวันทำการถัดไป
   นับตามเวลาไทยเสมอ ฝั่ง DB คำนวณชุดเดียวกัน (supabase/60_num_issue_date.sql) — แก้กติกาต้องแก้ทั้งสองที่
   ใช้กับหนังสือขาออกเท่านั้น (สลับ 2026-07-22: outgoing=มีขั้นตอนอนุมัติ) — ลงทะเบียนรับขาเข้าไม่เกี่ยว */
var _SW_DOW=['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
var _SW_MON=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
var _BKK_OFS=7*3600e3; // ไทยไม่มี daylight saving — UTC+7 ตลอดปี
function _numCfg(){
  var m=/^(\d{1,2}):(\d{2})/.exec(String(SETT.num_cutoff_time||'').trim())||[0,22,0];
  var hol={}; (String(SETT.num_holidays||'').match(/\d{4}-\d{2}-\d{2}/g)||[]).forEach(function(d){hol[d]=1});
  return {on:settOn('num_window_enabled',true), wk:settOn('num_weekdays_only',true),
          cut:(Math.min(+m[1],24)*60+Math.min(+m[2],59))||1440, // 00:00 = ไม่มีเวลาตัด
          shift:String(SETT.num_holiday_mode||'block')==='shift', hol:hol};
}
/* d = Date ที่เลื่อนเป็นเวลาไทยแล้ว (อ่านด้วย getUTC*) → '' ถ้าเป็นวันทำการ */
function _numDayOff(d,c){
  if(c.wk&&(d.getUTCDay()===0||d.getUTCDay()===6)) return 'weekend';
  if(c.hol[d.toISOString().slice(0,10)]) return 'holiday';
  return '';
}
function _numNextWorkday(d,c){
  for(var i=1;i<=60;i++){
    var n=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+i));
    if(!_numDayOff(n,c)) return n;
  }
  return null;
}
/* → {date:'YYYY-MM-DD'|null, blocked, shifted, reason:'weekend'|'holiday'|'late'|'', today:'YYYY-MM-DD'} */
function numIssueInfo(atMs){
  var c=_numCfg(), b=new Date((atMs||Date.now())+_BKK_OFS), today=b.toISOString().slice(0,10);
  var r={date:today,blocked:false,shifted:false,reason:'',today:today};
  if(!c.on) return r;
  var off=_numDayOff(b,c), late=b.getUTCHours()*60+b.getUTCMinutes()>=c.cut;
  if(!off&&!late) return r;
  r.reason=off||'late';
  var nx=_numNextWorkday(b,c);
  r.date=nx?nx.toISOString().slice(0,10):null;
  if(off&&!c.shift) r.blocked=true; else r.shifted=true;
  return r;
}
function _numDateLong(ymd){
  var d=new Date(ymd+'T00:00:00Z');
  return 'วัน'+_SW_DOW[d.getUTCDay()]+'ที่ '+d.getUTCDate()+' '+_SW_MON[d.getUTCMonth()]+' '+(d.getUTCFullYear()+543);
}
function numIssueRuleText(){
  var c=_numCfg();
  return 'ออกเลขหนังสือได้'+(c.wk?'วันจันทร์–ศุกร์':'ทุกวัน')+' ยกเว้นวันหยุดตามปฏิทินนิสิต'+
    (c.cut<1440?' ไม่เกิน '+String(Math.floor(c.cut/60)).padStart(2,'0')+':'+String(c.cut%60).padStart(2,'0')+' น.':'');
}
function numIssueMsg(info){
  var why={weekend:'วันนี้เป็นวันเสาร์–อาทิตย์',holiday:'วันนี้เป็นวันหยุดตามปฏิทินนิสิต',late:'เลยเวลาออกเลขของวันนี้แล้ว'}[info.reason]||'';
  if(info.blocked)
    return 'ยังออกเลขหนังสือไม่ได้ — '+why+' ('+numIssueRuleText()+')'+(info.date?' · ออกเลขได้อีกครั้ง'+_numDateLong(info.date):'');
  if(info.shifted)
    return why+' — เลขและวันที่หนังสือจะเป็นของ'+_numDateLong(info.date)+' (วันทำการถัดไป) โดยอัตโนมัติ';
  return '';
}
/* วันหยุดตามปฏิทินนิสิตที่กำลังจะถึง (ภายใน days วัน) → [{ymd,name}] */
function _numUpcomingHolidays(fromYmd,days,max){
  var out=[], end=new Date(Date.parse(fromYmd+'T00:00:00Z')+days*864e5).toISOString().slice(0,10);
  String(SETT.num_holidays||'').split(/\n/).forEach(function(l){
    var m=/(\d{4}-\d{2}-\d{2})\s*(.*)/.exec(l);
    if(m&&m[1]>=fromYmd&&m[1]<=end) out.push({ymd:m[1],name:m[2].trim()});
  });
  return out.sort(function(a,b){return a.ymd<b.ymd?-1:1}).slice(0,max||3);
}
/* หมายเหตุช่วงเวลาออกเลขหนังสือ (หน้าออกเลข + หน้ารายละเอียดเอกสารที่รอออกเลข) — info = numIssueInfo()/checkNumIssue() */
function rNumIssueNote(info){
  var c=_numCfg(); info=info||numIssueInfo();
  if(!c.on) return '';
  var hm=function(m){return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')};
  var days=c.wk?'วันจันทร์–ศุกร์':'ทุกวัน';
  var rows=[];
  rows.push(c.cut<1440
    ?[days+' 00:00–'+hm(c.cut-1)+' น.','ออกเลขได้ เลขและวันที่หนังสือเป็นวันนั้น']
    :[days+' ตลอดวัน','ออกเลขได้ เลขและวันที่หนังสือเป็นวันนั้น']);
  if(c.cut<1440) rows.push(['ตั้งแต่ '+hm(c.cut)+' น.','ออกเลขได้ แต่เลขและวันที่หนังสือเป็นของวันทำการถัดไป'+(c.wk?' (เช่น กดคืนวันศุกร์ → ลงวันจันทร์)':'')]);
  rows.push([(c.wk?'เสาร์–อาทิตย์ และ':'')+'วันหยุดตามปฏิทินนิสิต',c.shift?'ออกเลขได้ แต่ลงวันที่เป็นวันทำการถัดไป':'ออกเลขไม่ได้']);
  var hol=_numUpcomingHolidays(info.today||new Date(Date.now()+_BKK_OFS).toISOString().slice(0,10),60,3);
  var why={weekend:'วันนี้เป็นวันเสาร์–อาทิตย์',holiday:'วันนี้เป็นวันหยุดตามปฏิทินนิสิต'}[info.reason]||'';
  var now=info.blocked?'ตอนนี้ออกเลขไม่ได้ ('+why+')'+(info.date?' — ออกได้อีกครั้ง'+_numDateLong(info.date):'')
         :info.shifted?'ตอนนี้: '+numIssueMsg(info)
         :'ตอนนี้ออกเลขได้ — ลงวันที่'+_numDateLong(info.date);
  return '<div style="background:#FAFAF8;border:1px solid #EBEBEB;border-radius:10px;padding:10px 12px;margin-top:8px;font-size:11px;color:#6b6560;line-height:1.7">'+
    '<div style="font-weight:700;color:#18120E;display:flex;align-items:center;gap:6px;margin-bottom:4px">'+svg('clock',12)+' หมายเหตุ: ช่วงเวลาออกเลขหนังสือ</div>'+
    rows.map(function(r){return '<div style="display:flex;gap:6px"><span style="flex-shrink:0">•</span><span><strong style="color:#18120E;font-weight:600">'+esc(r[0])+'</strong> — '+esc(r[1])+'</span></div>'}).join('')+
    (hol.length?'<div style="margin-top:4px">วันหยุดที่จะถึง: '+hol.map(function(h){return esc(_numDateLong(h.ymd).replace(/^วัน\S+ที่ /,'')+(h.name?' ('+h.name+')':''))}).join(', ')+'</div>':'')+
    '<div style="margin-top:6px;padding-top:6px;border-top:1px dashed #E5E0DB;font-weight:600;color:'+(info.blocked?'#B91C1C':info.shifted?'#B45309':'#15803D')+'">'+esc(now)+'</div>'+
  '</div>';
}
/* ใช้เวลาเซิร์ฟเวอร์ผ่าน RPC num_issue_info() ถ้ามี (นาฬิกาเครื่องผู้ใช้อาจคลาดเคลื่อน และ trigger ฝั่ง DB
   ตรวจด้วยเวลาเซิร์ฟเวอร์) — ยังไม่ได้รัน SQL หรือเรียกไม่สำเร็จ → คำนวณจากเวลาเครื่อง */
async function checkNumIssue(){
  try{
    var r=await fetch(SU+'/rest/v1/rpc/num_issue_info',{method:'POST',headers:H,body:'{}'});
    if(r.ok){
      var j=await r.json();
      if(j&&typeof j.blocked==='boolean'&&j.today)
        return {date:j.date||null,blocked:j.blocked,shifted:!!j.shifted,reason:j.reason||'',today:j.today};
    }
  }catch(e){}
  return numIssueInfo();
}

/* คำนวณจำนวนวันทำการที่เหลือจากวันนี้ถึง targetDate */
function workingDaysLeft(targetDate){
  var now=new Date(); now.setHours(0,0,0,0);
  var end=new Date(targetDate); end.setHours(0,0,0,0);
  if(end<=now) return 0;
  var count=0; var cur=new Date(now);
  while(cur<end){cur.setDate(cur.getDate()+1);var d=cur.getDay();if(d!==0&&d!==6)count++;}
  return count;
}
/* คำนวณจำนวนวันทำการที่ผ่านไปแล้วนับจาก fromDate ถึงวันนี้ (คู่ตรงข้ามของ workingDaysLeft) */
function workingDaysElapsed(fromDate){
  var start=new Date(fromDate); if(isNaN(start)) return 0;
  start.setHours(0,0,0,0);
  var now=new Date(); now.setHours(0,0,0,0);
  if(start>=now) return 0;
  var count=0; var cur=new Date(start);
  while(cur<now){cur.setDate(cur.getDate()+1);var d=cur.getDay();if(d!==0&&d!==6)count++;}
  return count;
}
/* เส้นตายของ workflow step ที่กำลังจะ active — deadlineDays วันทำการจากเวลานี้ สิ้นสุดวันนั้น 23:59 */
/* จำนวนวันทำการที่ให้ขั้นตอนหนึ่ง ตามบทบาทของขั้นนั้น — ทุกจุดที่สร้าง step ใหม่ต้องใช้ตัวนี้
   ไม่ใช่ตัวเลข 2 ตายตัว (docForm/workflow เคย hardcode คนละที่จนแก้ไม่ทั่ว) */
function stepDaysFor(role){
  var v=role==='ROLE-ADV'?SETT.step_days_advisor:SETT.step_days_default;
  v=parseInt(v,10);
  return v>0?v:(role==='ROLE-ADV'?5:2);
}
function stepDeadline(deadlineDays){
  var d=addWorkingDays(new Date(),deadlineDays||2);
  d.setHours(23,59,0,0);
  return d.toISOString();
}

/* ─── taskDueInfo: งานชิ้นนี้ของฉันเหลืออีกกี่วัน ───
   ระบบมี "กำหนด" 2 ตัวที่ไม่เกี่ยวกัน และเดิมหน้างานของฉัน/รายการเอกสารดูแค่ตัวหลัง
   ทำให้คนที่ดองขั้นตอนไว้เป็นสัปดาห์ไม่เห็นสัญญาณอะไรเลยถ้าวันจัดกิจกรรมยังอีกไกล
     step  = workflow_steps.deadline_datetime — เส้นตายที่ "ฉัน" ต้องลงนาม (ปกติ 2 วันทำการ)
     event = documents.due_date              — วันจัดกิจกรรม (ผู้จัดทำกรอกเอง)
   จึงเทียบทั้งสองแล้วเอาอันที่ถึงก่อนเป็นตัวตัดสินความเร่งด่วน
   คืน {days, src, ts} — days<0 = เลยกำหนด, src='step'|'event', src=null เมื่อไม่มีกำหนดเลย */
function taskDueInfo(step, doc){
  var today=new Date(); today.setHours(0,0,0,0);
  var cand=[];
  if(step&&step.deadline_datetime){
    var st=new Date(step.deadline_datetime);
    if(!isNaN(st)) cand.push({src:'step',ts:st});
  }
  if(doc&&doc.due_date){
    var ev=new Date(doc.due_date+'T00:00:00');
    if(!isNaN(ev)){ev.setHours(23,59,0,0); cand.push({src:'event',ts:ev});}
  }
  if(!cand.length) return {days:null,src:null,ts:null};
  cand.sort(function(a,b){return a.ts-b.ts});
  var pick=cand[0];
  var d0=new Date(pick.ts); d0.setHours(0,0,0,0);
  return {days:Math.round((d0-today)/86400000), src:pick.src, ts:pick.ts};
}

/* ─── stepStallInfo: เอกสารค้างอยู่ที่ขั้นตอนไหน มานานแค่ไหน ───
   workflow_steps ไม่มีคอลัมน์ "activated_at" — เวลาที่ขั้นนี้ถูกเปิดให้ทำ
   คือเวลาที่ขั้นก่อนหน้าอนุมัติ (ขั้นแรกสุดนับจากวันสร้างเอกสาร)
   คืน null เมื่อไม่มีขั้น active (เอกสารเสร็จ/ถูกส่งคืน/ยกเลิก) */
function stepStallInfo(steps, doc){
  if(!Array.isArray(steps)||!steps.length) return null;
  var act=steps.filter(function(s){return s.status==='active'})
               .sort(function(a,b){return (a.step_number||0)-(b.step_number||0)})[0];
  if(!act) return null;
  var since=null;
  steps.forEach(function(s){
    if((s.step_number||0)>=(act.step_number||0)) return;
    var t=s.completed_at||s.action_at; if(!t) return;
    var ts=new Date(t); if(isNaN(ts)) return;
    if(!since||ts>since) since=ts;
  });
  if(!since&&doc&&doc.created_at){var c=new Date(doc.created_at); if(!isNaN(c)) since=c;}
  if(!since) return null;
  var ddl=act.deadline_datetime?new Date(act.deadline_datetime):null;
  if(ddl&&isNaN(ddl)) ddl=null;
  return {step:act, since:since, days:workingDaysElapsed(since),
          deadline:ddl, late:!!(ddl&&new Date()>ddl)};
}

/* ประวัติ "เจ้าหน้าที่รับเอกสาร" นับเป็นการรับของรอบปัจจุบันหรือไม่
   document_history ลบไม่ได้ (append-only) ถ้าเอกสารถูกส่งต่อใหม่หลังจากนั้น
   รายการรับเก่าต้องไม่ทำให้คิวปิด — เทียบเวลากับ forwarded_at รอบล่าสุด */
function acceptIsCurrent(performedAt, forwardedAt){
  if(!performedAt) return false;
  if(!forwardedAt) return true;
  return new Date(performedAt).getTime() >= new Date(forwardedAt).getTime();
}

/* ใครกดรับเอกสารได้ — เฉพาะ จนท./อาจารย์ที่ปรึกษา/แอดมิน และต้องไม่ใช่ผู้จัดทำเอกสารเอง
   (ตรงกับ guard ฝั่ง DB ใน supabase/38_accepted_by_and_forward_guard.sql) */
function canAcceptDoc(doc){
  if(!CU||!doc) return false;
  if(doc.created_by===CU.id&&CU.role_code!=='ROLE-SYS'&&CU.role_code!=='ROLE-DEV') return false;
  return ['ROLE-STF','ROLE-ADV','ROLE-SYS','ROLE-DEV'].includes(CU.role_code);
}

/* เอกสารกำลังรอ "รับเรื่อง" อยู่หรือไม่ — ออกเลข/เสร็จสิ้นแล้วและถูกส่งต่อ (ระบุตัว หรือคิวกลุ่ม)
   accepted = มีประวัติ 'เจ้าหน้าที่รับเอกสาร' ของรอบส่งต่อล่าสุดแล้วหรือยัง (ดู acceptIsCurrent) */
function isFwdPendingDoc(doc, accepted){
  return !!(doc&&doc.status==='completed'&&!accepted&&(doc.forwarded_to_id||doc.forwarded_to_staff));
}

/* ใครกดปุ่ม "รับเรื่อง" ได้ — ต้องเป็น จนท.จริง (canAcceptDoc) และเป็นหนึ่งใน
   1) ผู้รับที่ถูกระบุชื่อไว้  2) จนท./แอดมิน/dev (รับคิวกลุ่ม หรือรับแทนเมื่อผู้รับที่ระบุกดเองไม่ได้)
   เงื่อนไขนี้ตรงกับ forward_accept()/forward_decline() ฝั่ง DB — อย่าให้กว้างกว่านั้น */
function canAcceptFwdDoc(doc, accepted){
  if(!isFwdPendingDoc(doc,accepted)) return false;
  if(!canAcceptDoc(doc)) return false;
  return doc.forwarded_to_id===CU.id||_canActStaffPool();
}

/* ใครกดยกเลิกเอกสารได้ — ผู้จัดทำเอง หรือ จนท./แอดมิน และต้องยังไม่ออกเลขหนังสือจริง
   (RLS documents_update / workflow_steps_update ครอบทั้งสองกรณีอยู่แล้ว ไม่ต้องรัน SQL เพิ่ม) */
function canCancelDoc(doc){
  if(!CU||!doc) return false;
  if(CANCELLABLE_ST.indexOf(doc.status)===-1) return false;
  return doc.created_by===CU.id||['ROLE-STF','ROLE-SYS','ROLE-DEV'].includes(CU.role_code);
}

/* รับเอกสารที่ส่งต่อ — atomic RPC (บันทึก accepted_by, ล้าง forwarded_to_id) พร้อม fallback */
async function acceptForwardedDoc(docId, note){
  try{
    await drpc('forward_accept',{p_doc:docId,p_note:note||null});
    return;
  }catch(e){
    if(!rpcFnMissing(e)) throw e;
  }
  await dpa('documents',docId,{status:'awaiting_submit',accepted_by:CU.id,accepted_at:new Date().toISOString(),forwarded_to_id:null,forwarded_to_staff:false,forwarded_at:null,updated_at:new Date().toISOString()});
  await dp('document_history',{document_id:docId,action:'เจ้าหน้าที่รับเอกสาร',performed_by:CU.id,note:note||'รับเอกสารแล้ว — รอเจ้าหน้าที่ยื่นในระบบมหาวิทยาลัย'});
}

/* ไม่อนุมัติเอกสารที่ส่งต่อ — atomic RPC + fallback */
async function declineForwardedDoc(docId, note){
  try{
    await drpc('forward_decline',{p_doc:docId,p_note:note});
    return;
  }catch(e){
    if(!rpcFnMissing(e)) throw e;
  }
  await dpa('documents',docId,{status:'rejected',forwarded_to_id:null,forwarded_to_staff:false,forwarded_at:null,updated_at:new Date().toISOString()});
  var _wfR=await dg('workflow_steps','?document_id=eq.'+safeId(docId)+'&order=step_number');
  var _firstRev=_wfR.find(function(s){return s.step_number>1})||(_wfR.length?_wfR[0]:null);
  for(var _ri=0;_ri<_wfR.length;_ri++){
    var _ru={action_taken:null,note:null,revision_section:null,action_at:null,completed_at:null,rejected_by:null,deadline_datetime:null};
    if(_firstRev&&_wfR[_ri].id===_firstRev.id){_ru.status='rejected';_ru.rejected_by=CU.id;}
    else{_ru.status='pending';}
    await dpa('workflow_steps',_wfR[_ri].id,_ru);
  }
  await dp('document_history',{document_id:docId,action:'ไม่อนุมัติ — ส่งคืนให้ดำเนินการใหม่',performed_by:CU.id,note:note});
}

/* ดึงเอกสารกลับเป็นฉบับร่าง — atomic RPC + fallback; คืน {notify_ids:[]} */
async function recallDocumentRpc(docId){
  try{
    var res=await drpc('recall_document',{p_doc:docId});
    return res&&res.notify_ids?res:{notify_ids:[]};
  }catch(e){
    if(!rpcFnMissing(e)) throw e;
  }
  var wf=await dg('workflow_steps','?document_id=eq.'+safeId(docId)+'&order=step_number');
  var notifyIds=[];
  for(var i=0;i<wf.length;i++){
    var step=wf[i];
    if(step.step_number>1&&(step.status==='active'||step.status==='done')&&step.assigned_to&&step.assigned_to!==CU.id)
      notifyIds.push(step.assigned_to);
    var _upd={action_taken:null,note:null,revision_section:null,action_at:null,completed_at:null,rejected_by:null};
    if(step.step_number===1){_upd.status='active';_upd.deadline_datetime=stepDeadline(step.deadline_days);}
    else{_upd.status='pending';_upd.deadline_datetime=null;}
    await dpa('workflow_steps',step.id,_upd);
  }
  await dpa('documents',docId,{status:'draft',current_step:1,updated_at:new Date().toISOString()});
  await dp('document_history',{document_id:docId,action:'ดึงเอกสารกลับ',performed_by:CU.id,note:'ผู้จัดทำดึงเอกสารกลับเป็นฉบับร่าง — รีเซ็ตขั้นตอนอนุมัติทั้งหมด'});
  return {notify_ids:notifyIds};
}

/* บันทึก notifications ผ่าน RPC (ตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์) */
/* สาเหตุที่ส่งไม่สำเร็จ — sendEmailEdge/sendLinePush จดไว้ต่อ (เอกสาร, ผู้รับ) แล้ว logNotifRow หยิบไปใส่
   notifications.error_message เอง ไม่ต้องแก้จุดเรียก 16 จุดที่ส่งแค่ status:r.ok?'sent':'failed'
   (เพิ่ม 2026-09-30 คู่กับ supabase/57_log_notification_error_message.sql) */
var _notifErrs={};
function _notifErrKey(docId,recipId){return (docId||'')+'|'+(recipId||'')}
function _noteNotifErr(docId,recipId,msg){_notifErrs[_notifErrKey(docId,recipId)]=String(msg||'').slice(0,1000)}

async function logNotifRow(row){
  var _k=_notifErrKey(row.document_id,row.recipient_id);
  var _err=row.error_message!=null?row.error_message:(row.status==='failed'?(_notifErrs[_k]||null):null);
  delete _notifErrs[_k];   // แถว sent ก็ล้างด้วย กันสาเหตุเก่าไปติดแถวที่ล้มครั้งหลัง
  var args={
    p_document_id:row.document_id||null,
    p_recipient_id:row.recipient_id,
    p_recipient_email:row.recipient_email||'',
    p_subject:row.subject||'',
    p_body:row.body||'',
    p_notification_type:row.notification_type||'email',
    p_status:row.status||'sent',
    p_sent_at:row.sent_at||new Date().toISOString()
  };
  // ส่ง p_error_message เฉพาะตอนมีค่า — DB ที่ยังไม่ได้รัน 57 จะไม่รู้จักพารามิเตอร์นี้
  if(_err) args.p_error_message=_err;
  try{
    await drpc('log_notification',args);
  }catch(e){
    if(_err&&rpcFnMissing(e)){
      delete args.p_error_message;
      try{await drpc('log_notification',args);return}catch(e2){e=e2}
    }
    if(rpcFnMissing(e)) await dp('notifications',row);
    else throw e;
  }
}

/* เรียก Edge Function send-email (ส่ง documentId/recipientUserId เพื่อตรวจสิทธิ์ฝั่ง server) */
async function sendEmailEdge(opts){
  var r;
  try{
    r=await fetch(SU+'/functions/v1/send-email',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':H.Authorization,'apikey':SK},
      body:JSON.stringify({
        to:opts.to,subject:opts.subject,html:opts.html,
        documentId:opts.documentId||null,
        recipientUserId:opts.recipientUserId||null,
        testSelf:!!opts.testSelf
      })
    });
  }catch(e){
    _noteNotifErr(opts.documentId,opts.recipientUserId,'email network: '+((e&&e.message)||e));
    throw e;
  }
  // clone — ผู้เรียกบางจุดอ่าน r.json() ต่อ body อ่านได้ครั้งเดียว
  if(!r.ok){try{_noteNotifErr(opts.documentId,opts.recipientUserId,'email HTTP '+r.status+': '+(await r.clone().text()))}catch(_e){}}
  return r;
}

/* รีสตาร์ท workflow ตั้งแต่ต้น (หลังดึงกลับ/ส่งใหม่/ส่งจากฉบับร่าง) — step 1 done, step 2 active, ที่เหลือ pending
   คืน {ok:true, singleStep:true} สำหรับเอกสาร 1 step (ขาออก → numbering) หรือ {ok:true} สำหรับหลาย step */
async function restartDocWorkflow(docId){
  var wf=await dg('workflow_steps','?document_id=eq.'+safeId(docId)+'&order=step_number');
  if(!Array.isArray(wf)||!wf.length) return {ok:false};
  var doc=(await dg('documents','?id=eq.'+safeId(docId)+'&select=doc_type'))[0];
  var _now=new Date().toISOString();
  var _firstRev=wf.find(function(s){return s.step_number>1});
  if(!_firstRev){
    var s1=wf[0];
    await dpa('workflow_steps',s1.id,{status:'done',action_taken:'approve',action_at:_now,completed_at:_now,rejected_by:null,note:null,revision_section:null,deadline_datetime:stepDeadline(s1.deadline_days)});
    var _autoSt=doc&&['incoming','outgoing'].indexOf(doc.doc_type)>=0?'numbering':'completed';
    await dpa('documents',docId,{status:_autoSt,current_step:1,updated_at:_now});
    return {ok:true,singleStep:true,status:_autoSt};
  }
  for(var i=0;i<wf.length;i++){
    var step=wf[i];
    if(step.step_number===1){
      await dpa('workflow_steps',step.id,{status:'done',action_taken:'approve',action_at:_now,completed_at:_now,rejected_by:null,note:null,revision_section:null,deadline_datetime:stepDeadline(step.deadline_days)});
      continue;
    }
    var _upd={action_taken:null,note:null,revision_section:null,action_at:null,completed_at:null,rejected_by:null,status:'pending',deadline_datetime:null};
    if(step.id===_firstRev.id){_upd.status='active';_upd.deadline_datetime=stepDeadline(step.deadline_days);}
    await dpa('workflow_steps',step.id,_upd);
  }
  await dpa('documents',docId,{status:'pending',current_step:2,updated_at:_now});
  return {ok:true};
}

/* ─── fdTime: แสดงวันที่ + เวลา HH:MM (ใช้ใน history log) ─── */
function fdTime(d){
  if(!d) return '—';
  var dt=new Date(d);
  var dateStr=dt.toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit'});
  var timeStr=dt.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
  return dateStr+' '+timeStr;
}

/* ─── showConfirm: แทน browser confirm() ด้วย modal ของระบบ ─── */
// opts: { confirmLabel, confirmClass, cancelLabel, icon, detail }
function showConfirm(title, msg, onConfirm, opts){
  opts=opts||{};
  var mw=$e('mwrap'); if(!mw) return;
  var icon=opts.icon||'warn';
  var iconBg=opts.iconBg||'#FEF3C7';
  var iconColor=opts.iconColor||'#D97706';
  var confirmLabel=opts.confirmLabel||'ยืนยัน';
  var confirmClass=opts.confirmClass||'btn-danger';
  var cancelLabel=opts.cancelLabel||'ยกเลิก';
  var detail=opts.detail?'<div class="text-xs text-[#a89e99] mt-1.5 leading-relaxed">'+esc(opts.detail)+'</div>':'';
  var cbId='_sc_'+Date.now();
  // ฝัง callback ลง window ชั่วคราว
  window[cbId]=function(){
    delete window[cbId];
    mw.innerHTML='';
    onConfirm();
  };
  mw.innerHTML=
    '<div class="mo">'+
    '<div class="modal" style="max-width:400px">'+
      '<div class="modal-body" style="padding:28px 24px 20px;text-align:center">'+
        '<div style="width:52px;height:52px;border-radius:14px;background:'+iconBg+';display:flex;align-items:center;justify-content:center;margin:0 auto 16px;color:'+iconColor+'">'+svg(icon,24)+'</div>'+
        '<div style="font-size:16px;font-weight:800;color:#18120E;margin-bottom:8px">'+esc(title)+'</div>'+
        '<div style="font-size:13.5px;color:#6b6560;line-height:1.7">'+esc(msg)+'</div>'+
        detail+
      '</div>'+
      '<div class="modal-foot" style="justify-content:center;gap:10px">'+
        '<button class="btn btn-soft" data-action="closeModal">'+esc(cancelLabel)+'</button>'+
        '<button class="btn '+confirmClass+'" onclick="window[\''+cbId+'\']()">'+esc(confirmLabel)+'</button>'+
      '</div>'+
    '</div></div>';
  _lcr();
}

/* ─── showAlert: แทน browser alert() ด้วย modal ของระบบ ─── */
function showAlert(msg, type){
  type=type||'er';
  var mw=$e('mwrap'); if(!mw) { alert(msg); return; }
  var iconMap={ok:'ok',er:'x',wa:'warn',in:'info'};
  var titleMap={ok:'สำเร็จ',er:'เกิดข้อผิดพลาด',wa:'คำเตือน',in:'ข้อมูล'};
  var bgMap={ok:'#ECFDF5',er:'#FEF2F2',wa:'#FFFBEB',in:'#EFF6FF'};
  var clrMap={ok:'#16A34A',er:'#DC2626',wa:'#D97706',in:'#2563EB'};
  mw.innerHTML=
    '<div class="mo">'+
    '<div class="modal" style="max-width:380px">'+
      '<div class="modal-body" style="padding:28px 24px 20px;text-align:center">'+
        '<div style="width:52px;height:52px;border-radius:14px;background:'+bgMap[type]+';display:flex;align-items:center;justify-content:center;margin:0 auto 16px;color:'+clrMap[type]+'">'+svg(iconMap[type]||'info',24)+'</div>'+
        '<div style="font-size:14px;color:#6b6560;line-height:1.7">'+esc(msg)+'</div>'+
      '</div>'+
      '<div class="modal-foot" style="justify-content:center">'+
        '<button class="btn btn-primary" data-action="closeModal">ตกลง</button>'+
      '</div>'+
    '</div></div>';
  _lcr();
}

/* ─── auto-init Lucide icons on any DOM mutation inside #app ─── */
;(function(){
  if(!window.MutationObserver) return;
  var _lt=null;
  var _lo=new MutationObserver(function(muts){
    var need=muts.some(function(m){
      return Array.from(m.addedNodes).some(function(n){
        return n.nodeType===1&&(n.dataset&&n.dataset.lucide||(n.querySelector&&n.querySelector('[data-lucide]')));
      });
    });
    if(!need) return;
    clearTimeout(_lt);
    _lt=setTimeout(function(){if(window.lucide)window.lucide.createIcons();},0);
  });
  _lo.observe(document.body||document.documentElement,{childList:true,subtree:true});
})();

/* ─── มุมมองข้อมูลเอกสารแบบเดียวกันทุกประเภท (ค้นหา / กรอง / แสดงผล / ส่งออก) ───
   คอลัมน์ 4 ตัวนี้เก็บคนละความหมายตาม doc_type (สลับ 2026-07-22 — incoming = ฟอร์มง่าย, outgoing = มี workflow):
     incoming: description = ชื่อโครงการ, from_department = รหัสชมรมใน CLUBS (ว่าง = กนค.),
               subject_line = ดัชนี OUT_LTYPES ('1'–'9'), addressed_to = รหัสตำแหน่ง POSS ที่ส่งถึง
     outgoing: description = ประเภทหนังสือ (LETTER_TYPES), subject_line = เรื่องที่ระบุเอง (หรือชื่อเรื่อง),
               from_department = ชื่อผู้ส่ง (พิมพ์เอง), addressed_to = ตำแหน่ง/สังกัดของผู้ส่ง (ชื่อใน SENDER_POS)
   ห้ามนำค่าดิบไปค้นหา/แสดง/ส่งออกตรง ๆ — ค้นคำว่า "แบดมินตัน" จะไม่เจอหนังสือที่เก็บเป็น '26'
   และจอจะโชว์ GNK-PRE แทนหัวหน้านิสิต ให้ผ่าน docFacets() เสมอ
   ไม่แปลงรหัสใน DB เป็นข้อความ เพราะ docNum.js ใช้รหัสเหล่านี้ประกอบเลขหนังสือ */
function normText(s){return String(s==null?'':s).replace(/\s+/g,' ').trim()}
/* กุญแจจัดกลุ่มโครงการ — "โครงการBorn to speak" / "Born to Speak" / "ค่าย…  ครั้งที่ 26" (เว้นวรรคสองที) ให้เป็นโครงการเดียวกัน */
function projKey(s){return normText(s).toLowerCase().replace(/^โครงการ\s*/,'').replace(/\s+/g,'')}
function docFacets(d){
  d=d||{};
  var inc=d.doc_type==='incoming'; /* สลับ 2026-07-22 */
  var f={project:normText(d.project_name)||(inc?normText(d.description):''),letterType:'',senderName:'',senderUnit:'',recipient:''};
  if(inc){
    f.letterType=OUT_LTYPES[parseInt(d.subject_line,10)]||'';
    f.senderUnit=d.from_department?(CLUBS[d.from_department]||normText(d.from_department)):'กนค.';
    f.recipient=PTH[d.addressed_to]||normText(d.addressed_to);
  }else{
    f.letterType=normText(d.description);
    var subj=normText(d.subject_line);
    if(f.letterType==='เรื่องอื่น ๆ'&&subj&&subj!==normText(d.title)) f.letterType+=': '+subj;
    f.senderName=normText(d.from_department);
    f.senderUnit=normText(d.addressed_to);
  }
  return f;
}
function docSearchText(d){
  var f=docFacets(d);
  return normText([d.title,d.doc_number,d.received_number,f.project,f.letterType,f.senderName,f.senderUnit,f.recipient,
    d.doc_type==='outgoing'?d.subject_line:''].join(' | ')).toLowerCase(); /* สลับ 2026-07-22 */
}
/* ทุกคำต้องเจอ (ลำดับไม่สำคัญ) หรือทั้งวลีเจอเมื่อไม่นับเว้นวรรค — "กนค.1065001" เจอ "กนค. 1065001/2569" */
function docMatchQ(d,q){
  q=normText(q).toLowerCase();
  if(!q) return true;
  var t=docSearchText(d);
  if(q.split(' ').every(function(w){return t.indexOf(w)!==-1})) return true;
  return t.replace(/ /g,'').indexOf(q.replace(/ /g,''))!==-1;
}
/* {key: ชื่อที่ใช้แสดง} — ใช้ตัวสะกดที่พบบ่อยที่สุดในกลุ่มเป็นชื่อหลัก */
function projLabels(docs){
  var m={};
  (docs||[]).forEach(function(d){
    var p=docFacets(d).project; if(!p) return;
    var k=projKey(p); (m[k]=m[k]||{})[p]=(m[k][p]||0)+1;
  });
  var out={};
  Object.keys(m).forEach(function(k){
    out[k]=Object.keys(m[k]).sort(function(a,b){return m[k][b]-m[k][a]||a.length-b.length})[0];
  });
  return out;
}

/* ─── เอกสารจะ "ถึง" ผู้ลงนามก็ต่อเมื่อขั้นของเขาถูกเปิดแล้ว ───
   workflow_steps ถูกสร้างครบทุกขั้นตั้งแต่ตอนส่งเอกสาร (ขั้นที่ยังไม่ถึงคิวเป็น pending)
   เดิมทุกหน้าดึง "เอกสารที่ฉันมีขั้นตอนอยู่" โดยไม่ดูสถานะ อาจารย์ที่ปรึกษา (ขั้นท้าย ๆ) จึงเห็นเอกสารตั้งแต่วันที่นิสิตกดส่ง
   (ต.ค. 2026: อาจารย์ 7 คนเห็นเอกสาร 35 ฉบับที่ยังไม่ถึงคิว) — ใช้ stepReached() กรองทุกครั้งที่ขอบเขตเอกสารมาจากขั้นตอนของผู้ใช้
   ถึงคิวแล้ว = active / done / rejected หรือเคยถูกเปิดหรือเคยมีการดำเนินการ (deadline_datetime/action_at จะถูกตั้งตอนเปิดขั้น)
   ขั้นที่ถูกดึงกลับหรือถูกรีเซ็ตกลับเป็น pending จะหายไปจนกว่าจะถึงคิวอีกครั้ง */
var STEP_REACH_SEL='document_id,status,action_at,deadline_datetime';
function stepReached(s){
  return !!s&&(s.status==='active'||s.status==='done'||s.status==='rejected'||!!s.action_at||!!s.deadline_datetime);
}
function reachedStepDocIds(steps){
  return Array.isArray(steps)?[...new Set(steps.filter(stepReached).map(function(s){return s.document_id}))]:[];
}
