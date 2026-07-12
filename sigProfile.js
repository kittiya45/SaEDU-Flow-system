/* ─── ลายเซ็นส่วนตัว (1 รายการต่อผู้ใช้) ─── */

var _profSigCtx=null,_profSigDrawing=false,_profSigColor='#1C1C1E',_profSigSz=2;
var _profSigUploadSrc=null;

async function vProf(){
  var _ico=function(i,bg,cl){return '<div style="width:26px;height:26px;border-radius:7px;background:'+bg+';display:flex;align-items:center;justify-content:center;color:'+cl+'">'+svg(i,13)+'</div>'};
  var path=CU&&CU.signature_path;
  var prevUrl=null;
  if(path){
    try{prevUrl=await resolveUserSigPath(path)}catch(e){}
  }
  var updated=CU&&CU.signature_updated_at?new Date(CU.signature_updated_at).toLocaleString('th-TH',{day:'numeric',month:'short',year:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
  var sigColors=['#1C1C1E','#D32F2F','#1565C0','#1B5E20','#7B1FA2'];
  var html=[
    '<div class="card"><div class="card-head">'+_ico('pen','#FFF3EE','#E83A00')+'<span class="card-head-title">ลายเซ็นของฉัน</span></div>',
    '<div class="card-body">',
    '<div class="al al-in" style="margin-bottom:16px"><span class="al-icon">'+svg('info',13)+'</span>',
    '<span>บันทึกลายเซ็นไว้ครั้งเดียว แล้วเลือก <strong>“ใช้ที่บันทึกไว้”</strong> ตอนอนุมัติเอกสารได้ทันที · แนะนำ PNG พื้นหลังโปร่งใส</span></div>',
    path?'<div class="al al-ok" style="margin-bottom:16px"><span class="al-icon">'+svg('ok',13)+'</span><span>มีลายเซ็นที่บันทึกไว้'+(updated?' · อัปเดตล่าสุด '+esc(updated):'')+'</span></div>':'',
    '<div class="sig-prof-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start">',
    '<div>',
    '<div class="fg"><label class="fl">ลายเซ็นปัจจุบัน</label>',
    '<div class="sig-prof-preview'+(path?'':' sig-prof-preview-empty')+'" id="prof-sig-preview">',
    path&&prevUrl?'<img src="'+esc(prevUrl)+'" alt="ลายเซ็นที่บันทึก" style="max-width:100%;max-height:120px;object-fit:contain">':'<span class="sig-prof-empty-txt">ยังไม่มีลายเซ็นที่บันทึก</span>',
    '</div></div>',
    path?'<button class="btn btn-danger sm" data-action="deleteUserSig" style="margin-top:10px">'+svg('trash',12)+' ลบลายเซ็นที่บันทึก</button>':'',
    '</div>',
    '<div>',
    '<div class="fg"><label class="fl">บันทึกลายเซ็นใหม่</label>',
    '<div class="itabs mb-2"><button class="itab on" id="prof-tab-draw" onclick="profSigTab(\'draw\')">วาดลายเซ็น</button><button class="itab" id="prof-tab-upload" onclick="profSigTab(\'upload\')">อัปโหลดรูป</button></div>',
    '<div id="prof-panel-draw">',
    '<canvas id="prof-sig-canvas" class="border-[1.5px] border-[#EBEBEB] rounded-[10px] bg-white block w-full cursor-crosshair touch-none" height="130"></canvas>',
    '<button type="button" class="btn btn-soft sm mt-2 w-full" onclick="clearProfSig()">ล้าง</button>',
    '<div style="margin-top:10px"><div class="fl" style="margin-bottom:6px">สีหมึก</div><div style="display:flex;gap:6px;flex-wrap:wrap">',
    sigColors.map(function(c,i){return '<div class="csw'+(i===0?' on':'')+'" style="width:24px;height:24px;border-radius:50%;cursor:pointer;border:2px solid '+(i===0?'var(--text)':'transparent')+';background:'+c+'" onclick="profSigColor(\''+c+'\',this)"></div>'}).join(''),
    '</div></div>',
    '<div class="fl" style="margin:10px 0 6px">ความหนาเส้น</div>',
    '<input type="range" id="prof-sig-sz" min="1" max="8" value="2" oninput="_profSigSz=+this.value">',
    '</div>',
    '<div id="prof-panel-upload" class="hidden">',
    '<label for="prof-sig-file" class="upload-zone" id="prof-sig-drop" style="min-height:120px;padding:16px;border-radius:12px">',
    '<div class="upload-zone-inner" style="gap:4px">',
    '<div class="upload-zone-icon" style="margin-bottom:0;opacity:.35;transform:scale(.85)">'+svg('pen',28)+'</div>',
    '<div class="upload-zone-text" style="font-size:12.5px">คลิกเพื่ออัปโหลดรูปลายเซ็น</div>',
    '<div class="upload-zone-hint">PNG พื้นหลังโปร่งใส แนะนำ</div>',
    '</div></label>',
    '<input type="file" id="prof-sig-file" accept="image/png,image/jpeg,image/jpg" class="hidden">',
    '<div id="prof-sig-upload-prev" class="hidden" style="margin-top:8px;border:1px solid #EBEBEB;border-radius:12px;padding:10px;background:#fff;text-align:center">',
    '<img id="prof-sig-upload-img" style="max-height:90px;max-width:100%;object-fit:contain">',
    '</div>',
    '</div>',
    '<button class="btn btn-primary" data-action="saveUserSig" style="margin-top:14px;width:100%">'+svg('save',13)+' บันทึกลายเซ็น</button>',
    '<div id="prof-sig-alert" style="margin-top:10px"></div>',
    '</div>',
    '</div>',
    '</div></div>'
  ];
  return html.join('');
}

function profSigTab(tab){
  var d=$e('prof-tab-draw'),u=$e('prof-tab-upload');
  if(d) d.className='itab'+(tab==='draw'?' on':'');
  if(u) u.className='itab'+(tab==='upload'?' on':'');
  var pd=$e('prof-panel-draw');if(pd)pd.style.display=tab==='draw'?'block':'none';
  var pu=$e('prof-panel-upload');if(pu)pu.style.display=tab==='upload'?'block':'none';
}
function profSigColor(c,el){
  _profSigColor=c;
  document.querySelectorAll('#prof-panel-draw .csw').forEach(function(s){s.classList.remove('on')});
  if(el) el.classList.add('on');
}
function clearProfSig(){
  var sc=$e('prof-sig-canvas');
  if(sc&&_profSigCtx) _profSigCtx.clearRect(0,0,sc.width,sc.height);
}
function initProfSig(){
  var sc=$e('prof-sig-canvas'); if(!sc) return;
  sc.width=sc.offsetWidth||400;
  _profSigCtx=sc.getContext('2d');
  _profSigUploadSrc=null;
  var af=$e('prof-sig-file');
  if(af) af.onchange=function(){
    var f=af.files[0]; if(!f) return;
    var r=new FileReader();
    r.onload=function(e){
      _profSigUploadSrc=e.target.result;
      var img=$e('prof-sig-upload-img'); if(img) img.src=_profSigUploadSrc;
      var w=$e('prof-sig-upload-prev'); if(w) w.classList.remove('hidden');
    };
    r.readAsDataURL(f);
  };
  if(typeof _wireDropzone==='function') _wireDropzone($e('prof-sig-drop'),af,function(inp){
    var f=inp.files[0]; if(!f) return;
    var r=new FileReader();
    r.onload=function(e){
      _profSigUploadSrc=e.target.result;
      var img=$e('prof-sig-upload-img'); if(img) img.src=_profSigUploadSrc;
      var w=$e('prof-sig-upload-prev'); if(w) w.classList.remove('hidden');
    };
    r.readAsDataURL(f);
  });
  sc.onpointerdown=function(e){
    _profSigDrawing=true;
    var r=sc.getBoundingClientRect();
    _profSigCtx.beginPath();
    _profSigCtx.moveTo((e.clientX-r.left)*(sc.width/r.width),(e.clientY-r.top)*(sc.height/r.height));
  };
  sc.onpointermove=function(e){
    if(!_profSigDrawing) return;
    var r=sc.getBoundingClientRect();
    _profSigCtx.lineTo((e.clientX-r.left)*(sc.width/r.width),(e.clientY-r.top)*(sc.height/r.height));
    _profSigCtx.strokeStyle=_profSigColor;
    _profSigCtx.lineWidth=_profSigSz;
    _profSigCtx.lineCap='round';
    _profSigCtx.lineJoin='round';
    _profSigCtx.stroke();
  };
  sc.onpointerup=sc.onpointerleave=function(){_profSigDrawing=false};
}
function _profSigSrcFromForm(){
  var drawPanel=$e('prof-panel-draw');
  if(drawPanel&&drawPanel.style.display!=='none'){
    var sc=$e('prof-sig-canvas');
    if(sc&&typeof _cropSigCanvas==='function') return _cropSigCanvas(sc);
    return null;
  }
  return _profSigUploadSrc||null;
}
function _dataUrlToBlob(dataUrl){
  var parts=dataUrl.split(',');
  var mime=(parts[0].match(/:(.*?);/)||[])[1]||'image/png';
  var bin=atob(parts[1]);
  var arr=new Uint8Array(bin.length);
  for(var i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
  return new Blob([arr],{type:mime});
}
async function saveUserSig(){
  var alertEl=$e('prof-sig-alert');
  var src=_profSigSrcFromForm();
  if(!src){
    if(alertEl) alertEl.innerHTML=alrtH('wa','กรุณาวาดหรืออัปโหลดลายเซ็นก่อนบันทึก');
    return;
  }
  if(alertEl) alertEl.innerHTML=alrtH('in','กำลังบันทึก...');
  try{
    var blob=_dataUrlToBlob(src);
    if(blob.size>2*1024*1024) throw new Error('ไฟล์ใหญ่เกิน 2MB');
    var path=await upUserSig(blob);
    var now=new Date().toISOString();
    await dpa('users',CU.id,{signature_path:path,signature_updated_at:now});
    CU.signature_path=path;
    CU.signature_updated_at=now;
    if(alertEl) alertEl.innerHTML=alrtH('ok','บันทึกลายเซ็นเรียบร้อยแล้ว');
    setTimeout(function(){nav('prof')},800);
  }catch(e){
    console.warn('saveUserSig failed',e);
    if(alertEl) alertEl.innerHTML=alrtH('er','บันทึกไม่สำเร็จ: '+esc(e.message||e));
  }
}
async function deleteUserSig(){
  showConfirm('ลบลายเซ็นที่บันทึก?','ลายเซ็นจะถูกลบถาวร — ครั้งถัดไปต้องวาดหรืออัปโหลดใหม่ตอนอนุมัติ',async function(){
    try{
      if(CU.signature_path) await deleteUserSigStorage(CU.signature_path);
      await dpa('users',CU.id,{signature_path:null,signature_updated_at:null});
      CU.signature_path=null;
      CU.signature_updated_at=null;
      nav('prof');
    }catch(e){
      showAlert('ลบไม่สำเร็จ: '+(e.message||e),'er');
    }
  },{confirmLabel:'ลบ',confirmClass:'btn-danger',icon:'trash',iconBg:'#FEF2F2',iconColor:'#DC2626'});
}
