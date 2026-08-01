/* ─── CONFIG ─── */
var SU = 'https://jrubupvzltxqstzcpoov.supabase.co';
var SK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpydWJ1cHZ6bHR4cXN0emNwb292Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2OTc2MDEsImV4cCI6MjA5MTI3MzYwMX0.nA1VY7i-syUHQNb-wmmFdjFyQCZKaCeIzPOIEDtTHFA';
/* ─── Supabase Auth client — H.Authorization ถูกอัปเดตสดจาก auth.js เมื่อ session เปลี่ยน (login/logout/refresh token) ───
   ทุกฟังก์ชันด้านล่างอ้าง H ตัวเดียวกันเสมอ (mutate ไม่ใช่ reassign) เพื่อให้รับรู้ token ปัจจุบันโดยไม่ต้องแก้จุดเรียกใช้ทุกที่ */
var sb = supabase.createClient(SU, SK);
var H = {apikey:SK,'Authorization':'Bearer '+SK,'Content-Type':'application/json','Prefer':'return=representation'};

async function dg(t,q){
  var r=await fetch(SU+'/rest/v1/'+t+(q||''),{headers:H});
  var data=await r.json().catch(function(){return null});
  if(!r.ok){
    var msg=(data&&data.message)||String(r.status);
    throw new Error(msg);
  }
  // PostgREST คืน error object (มี code) แม้ r.ok ในบาง edge case
  if(data&&data.code&&data.message&&!Array.isArray(data)) throw new Error(data.message);
  return data;
}
async function drpc(fn,body){
  var r=await fetch(SU+'/rest/v1/rpc/'+fn,{method:'POST',headers:H,body:JSON.stringify(body||{})});
  var data=await r.json().catch(function(){return null});
  if(!r.ok){
    var msg=(data&&data.message)||(data&&data.hint)||String(r.status);
    throw new Error(msg);
  }
  return data;
}
function rpcFnMissing(err){
  var m=String(err&&err.message||err||'');
  return /PGRST202|Could not find the function|does not exist/i.test(m);
}
var REQUIRED_SCHEMA_VERSION='3';
async function dp(t,b){
  var r=await fetch(SU+'/rest/v1/'+t,{method:'POST',headers:H,body:JSON.stringify(b)});
  if(!r.ok){var e=await r.json().catch(function(){return{}});throw new Error(e.message||String(r.status))}
  return r.json()
}
async function dpa(t,id,b){
  var r=await fetch(SU+'/rest/v1/'+t+'?id=eq.'+id,{method:'PATCH',headers:H,body:JSON.stringify(b)});
  if(!r.ok){var e=await r.json().catch(function(){return{}});throw new Error(e.message||String(r.status))}
  var rows=await r.json();
  // PostgREST เงียบ ๆ คืน [] เมื่อ RLS กรองแถวออกหมด (ไม่ใช่ error) — ต้องเช็คเองว่ามีแถวที่แก้ไขจริง
  // ไม่งั้นปุ่ม "อนุมัติ"/"แก้ไข" จะดูเหมือนกดได้ปกติ แต่ข้อมูลไม่เปลี่ยนเลยเงียบ ๆ
  if(Array.isArray(rows)&&!rows.length) throw new Error('ไม่มีสิทธิ์แก้ไขข้อมูลนี้ หรือไม่พบรายการ (RLS/0 rows affected)');
  return rows
}
// ตาราง document_history และ notifications ห้ามลบจาก client เด็ดขาด
var _PROTECTED_TABLES=['document_history','notifications'];
async function dd(t,id){
  if(_PROTECTED_TABLES.indexOf(t)!==-1){console.warn('Blocked: DELETE on protected table "'+t+'"');return;}
  var r=await fetch(SU+'/rest/v1/'+t+'?id=eq.'+id,{method:'DELETE',headers:{apikey:SK,'Authorization':H.Authorization}});
  if(!r.ok){var e=await r.json().catch(function(){return{}});throw new Error(e.message||String(r.status))}
}
function safeId(id){return encodeURIComponent(String(id||''))}
/* ─── System error log → ตาราง system_logs (ดูใน Dev Panel) ───
   fail-silent เสมอ: log ไม่ได้ = ข้ามเงียบ ๆ (ตารางยังไม่ถูกสร้าง / ยังไม่ล็อกอิน / เน็ตล่ม — ไม่กระทบผู้ใช้)
   จำกัด 15 รายการต่อ session + ไม่ log ข้อความเดิมซ้ำติดกัน กัน error loop ยิง insert รัว ๆ */
var _selCount=0,_selLast='';
function logSysErr(source,message,detail){
  try{
    if(!CU||_selCount>=15) return;
    var m=String(message||'').slice(0,500);
    if(m===_selLast) return;
    _selLast=m; _selCount++;
    fetch(SU+'/rest/v1/system_logs',{method:'POST',headers:H,body:JSON.stringify({
      level:'error',source:String(source||'').slice(0,80),message:m,
      detail:detail?String(detail).slice(0,2000):null,user_id:CU.id
    })}).catch(function(){});
  }catch(e){}
}
window.addEventListener('error',function(ev){
  logSysErr('window.onerror',ev.message,(ev.filename||'')+':'+(ev.lineno||0)+(ev.error&&ev.error.stack?'\n'+ev.error.stack:''));
});

/* [Safety net] dp()/dpa() เพิ่งเปลี่ยนให้ throw จริงเมื่อ RLS ปฏิเสธหรือ error (เดิมเงียบ ๆ คืน [] ทำให้ปุ่มดูเหมือนใช้งานไม่ได้)
   จุดเรียกใช้บางจุดยังไม่ได้ครอบ try/catch ของตัวเอง — ดักด้วย unhandledrejection กลาง ๆ ไว้ ไม่ให้ error หายไปเงียบ ๆ อีก */
window.addEventListener('unhandledrejection',function(ev){
  console.error('Unhandled error:',ev.reason);
  logSysErr('unhandledrejection',(ev.reason&&ev.reason.message)||ev.reason,ev.reason&&ev.reason.stack);
  if(typeof showAlert==='function') showAlert('เกิดข้อผิดพลาด: '+((ev.reason&&ev.reason.message)||ev.reason||'ไม่ทราบสาเหตุ'),'er');
});
async function upFile(path,file){
  // cache-control: no-store — เดิม Storage ตั้ง max-age=3600 ให้อัตโนมัติ ทำให้ไฟล์ที่ถูกเขียนทับ
  // ยังถูกเสิร์ฟฉบับเก่าจากแคชได้อีกเป็นชั่วโมง (ต้นเหตุลายเซ็นหาย — ดู _signedStablePath ใน docDetail.js)
  var r=await fetch(SU+'/storage/v1/object/documents/'+encodeURIComponent(path),{method:'POST',headers:{apikey:SK,'Authorization':H.Authorization,'x-upsert':'true','cache-control':'no-store'},body:file});
  if(!r.ok){
    var e=await r.json().catch(function(){return{}});
    throw new Error((e&&e.message)||('อัปโหลดไฟล์ล้มเหลว ('+r.status+')'));
  }
  return r.json().catch(function(){return{ok:true}});
}
function furl(p){
  var path=String(p||'');
  return SU+'/storage/v1/object/public/documents/'+path.split('/').map(encodeURIComponent).join('/');
}
function _storagePathFromUrl(url){
  if(!url) return null;
  var m=String(url).match(/\/storage\/v1\/object\/(?:public|sign)\/documents\/(.+?)(?:\?|$)/);
  if(!m) return null;
  try{return decodeURIComponent(m[1].replace(/%2F/gi,'/'))}catch(e){return m[1]}
}
var _furlCache={};
async function resolveFilePath(path,expiresSec){
  if(!path||!sb||!sb.storage) return null;
  var exp=expiresSec||3600;
  var cacheKey=path+'|'+exp;
  var hit=_furlCache[cacheKey];
  if(hit&&hit.exp>Date.now()) return hit.url;
  try{
    var r=await sb.storage.from('documents').createSignedUrl(path,exp);
    if(r.data&&r.data.signedUrl){
      _furlCache[cacheKey]={url:r.data.signedUrl,exp:Date.now()+(exp-300)*1000};
      return r.data.signedUrl;
    }
  }catch(e){console.warn('resolveFilePath failed',path,e)}
  return null;
}
/* ทิ้ง signed URL ของ path นี้ออกจาก _furlCache — เรียกหลังเขียนทับไฟล์เดิม
   ไม่งั้นแท็บที่เปิดค้างอยู่จะได้ URL เดิม (แคชไว้ ~55 นาที) ที่ชี้ไปยังเนื้อไฟล์ก่อนแก้ */
function _invalidateFileUrl(path){
  if(!path) return;
  Object.keys(_furlCache).forEach(function(k){
    if(k.slice(0,k.lastIndexOf('|'))===path) delete _furlCache[k];
  });
}
async function resolveFileUrl(urlOrPath,expiresSec){
  if(!urlOrPath) return urlOrPath;
  var path=_storagePathFromUrl(urlOrPath);
  if(!path&&urlOrPath.indexOf('http')!==0) path=String(urlOrPath);
  if(path){
    var signed=await resolveFilePath(path,expiresSec);
    if(signed) return signed;
  }
  return urlOrPath;
}
async function fetchStorageBlob(pathOrUrl){
  var url=await resolveFileUrl(pathOrUrl);
  var r=await fetch(url);
  if(!r.ok) throw new Error('HTTP '+r.status);
  return r.blob();
}
async function deleteStorage(path){
  if(!path) return;
  try{
    var enc=String(path).split('/').map(encodeURIComponent).join('/');
    await fetch(SU+'/storage/v1/object/documents/'+enc,{method:'DELETE',headers:{apikey:SK,Authorization:H.Authorization}});
  }catch(e){console.warn('deleteStorage failed',path,e)}
}
var USER_SIG_BUCKET='user-signatures';
function userSigStoragePath(userId){
  return String(userId||'')+'/signature.png';
}
var _userSigUrlCache={};
async function resolveUserSigPath(path,expiresSec){
  if(!path||!sb||!sb.storage) return null;
  var exp=expiresSec||3600;
  var cacheKey=path+'|'+exp;
  var hit=_userSigUrlCache[cacheKey];
  if(hit&&hit.exp>Date.now()) return hit.url;
  try{
    var r=await sb.storage.from(USER_SIG_BUCKET).createSignedUrl(path,exp);
    if(r.data&&r.data.signedUrl){
      _userSigUrlCache[cacheKey]={url:r.data.signedUrl,exp:Date.now()+(exp-300)*1000};
      return r.data.signedUrl;
    }
  }catch(e){console.warn('resolveUserSigPath failed',path,e)}
  return null;
}
async function upUserSig(file){
  if(!CU||!CU.id) throw new Error('ไม่พบผู้ใช้');
  var path=userSigStoragePath(CU.id);
  var enc=path.split('/').map(encodeURIComponent).join('/');
  var r=await fetch(SU+'/storage/v1/object/'+USER_SIG_BUCKET+'/'+enc,{
    method:'POST',
    headers:{apikey:SK,Authorization:H.Authorization,'x-upsert':'true','cache-control':'no-store','Content-Type':file.type||'image/png'},
    body:file
  });
  if(!r.ok){
    var e=await r.json().catch(function(){return{}});
    throw new Error((e&&e.message)||('บันทึกลายเซ็นล้มเหลว ('+r.status+')'));
  }
  // path ลายเซ็นส่วนตัวคงที่ ({user}/signature.png) — ต้องล้าง signed URL เดิมทิ้ง
  // ไม่งั้นบันทึกลายเซ็นใหม่แล้วยังหยิบรูปเก่ามาใช้ได้อีกเป็นชั่วโมง (เหมือนที่ deleteUserSigStorage ทำ)
  Object.keys(_userSigUrlCache).forEach(function(k){if(k.indexOf(path)===0)delete _userSigUrlCache[k]});
  return path;
}
async function deleteUserSigStorage(path){
  if(!path) return;
  try{
    var enc=String(path).split('/').map(encodeURIComponent).join('/');
    await fetch(SU+'/storage/v1/object/'+USER_SIG_BUCKET+'/'+enc,{method:'DELETE',headers:{apikey:SK,Authorization:H.Authorization}});
    Object.keys(_userSigUrlCache).forEach(function(k){if(k.indexOf(path)===0)delete _userSigUrlCache[k]});
  }catch(e){console.warn('deleteUserSigStorage failed',path,e)}
}
async function dgCount(t,q){
  var qs=q||'';
  if(qs.indexOf('select=')<0) qs+=(qs.indexOf('?')>=0?'&':'?')+'select=id';
  if(qs.indexOf('limit=')<0) qs+=(qs.indexOf('?')>=0?'&':'?')+'limit=1';
  var r=await fetch(SU+'/rest/v1/'+t+qs,{headers:{apikey:SK,Authorization:H.Authorization,'Prefer':'count=exact'}});
  if(!r.ok) return null;
  var cr=r.headers.get('content-range')||'';
  var m=cr.match(/\/(\d+)/);
  return m?parseInt(m[1],10):null;
}

/* ─── CONSTANTS ─── */
var DTYPES={incoming:'หนังสือขาเข้า',outgoing:'หนังสือขาออก'};
var URG={normal:'ปกติ',urgent:'เร่งด่วน'};
var LETTER_TYPES=[
  'ขออนุมัติโครงการ ไม่เกิน 1 แสนบาท',
  'ขออนุมัติโครงการ เกิน 1 แสนบาท',
  'ขออนุมัติปรับงบ',
  'ขออนุมัติปรับเปลี่ยนวันจัด',
  'ขอความอนุเคราะห์สถานที่ ภายในคณะ',
  'ขอความอนุเคราะห์ใช้ห้องภายในอาคาร 6',
  'ขอความอนุเคราะห์สถานที่อาคาร 6 นอกเวลาทำการ',
  'ขอความอนุเคราะห์เปิด ปิดอาคาร 6 หลัง 20.00 น.',
  'ขอความอนุเคราะห์สำรองที่จอดรถในคณะ',
  'ขอความอนุเคราะห์รถยนต์',
  'ขอความอนุเคราะห์ประชาสัมพันธ์ ภายในคณะ',
  'ขอความอนุเคราะห์ใช้ยานพาหนะรถตู้คณะ',
  'เรื่องอื่น ๆ'
];
/* ระยะเวลาที่ต้องยื่นล่วงหน้า ต่อประเภทหนังสือขาเข้า (key ต้องตรงกับ LETTER_TYPES ทุกตัวอักษร) */
var LT_LEADTIME={
  'ขออนุมัติโครงการ ไม่เกิน 1 แสนบาท':'ไม่ต่ำกว่า 4 สัปดาห์ก่อนเริ่มกิจกรรม/โครงการ',
  'ขออนุมัติโครงการ เกิน 1 แสนบาท':'ไม่ต่ำกว่า 4 สัปดาห์ก่อนเริ่มกิจกรรม/โครงการ',
  'ขออนุมัติปรับงบ':'ไม่ต่ำกว่า 1 สัปดาห์',
  'ขออนุมัติปรับเปลี่ยนวันจัด':'ไม่ต่ำกว่า 1 สัปดาห์ก่อนเริ่มกิจกรรม/โครงการ',
  'ขอความอนุเคราะห์สถานที่ ภายในคณะ':'ไม่ต่ำกว่า 3 สัปดาห์ก่อนเริ่มกิจกรรม/โครงการ',
  'ขอความอนุเคราะห์ใช้ห้องภายในอาคาร 6':'ไม่ต่ำกว่า 3 สัปดาห์ก่อนเริ่มกิจกรรม/โครงการ',
  'ขอความอนุเคราะห์สถานที่อาคาร 6 นอกเวลาทำการ':'ไม่ต่ำกว่า 3 สัปดาห์ก่อนเริ่มกิจกรรม/โครงการ',
  'ขอความอนุเคราะห์เปิด ปิดอาคาร 6 หลัง 20.00 น.':'ไม่ต่ำกว่า 3 สัปดาห์ก่อนเริ่มกิจกรรม/โครงการ',
  'ขอความอนุเคราะห์สำรองที่จอดรถในคณะ':'ไม่ต่ำกว่า 3 สัปดาห์ก่อนเริ่มกิจกรรม/โครงการ',
  'ขอความอนุเคราะห์รถยนต์':'ไม่ต่ำกว่า 3 สัปดาห์ก่อนเริ่มกิจกรรม/โครงการ',
  'ขอความอนุเคราะห์ประชาสัมพันธ์ ภายในคณะ':'ไม่ต่ำกว่า 2 สัปดาห์ก่อนเริ่มกิจกรรม/โครงการ',
  'ขอความอนุเคราะห์ใช้ยานพาหนะรถตู้คณะ':'ไม่ต่ำกว่า 3 สัปดาห์ก่อนเริ่มกิจกรรม/โครงการ (ต้องประสานกับกายภาพก่อน)'
};
/* ─── ขั้นตอนบังคับ (Fixed Workflow) สำหรับหนังสือขาออก ───
   สายทั่วไป 4 ขั้น / สายตรวจงบประมาณ 7 ขั้น — ล็อกโครงลำดับขั้นตอน แต่เปลี่ยนตัวบุคคลในแต่ละขั้นได้
   ใช้ใน _applyFixedFlow() (docForm.js); ROLE-STF/ROLE-SYS ได้รับการยกเว้น (จัดขั้นตอนเองได้อิสระ)
   pos: เติมคนที่ถือตำแหน่งนี้เป็นค่าเริ่มต้น | role: เติมคนแรกที่มี role นี้ | self: ผู้สร้างเอกสารเอง (เปลี่ยนไม่ได้) */
var BUDGET_LTYPES=[
  'ขออนุมัติโครงการ ไม่เกิน 1 แสนบาท',
  'ขออนุมัติโครงการ เกิน 1 แสนบาท',
  'ขออนุมัติปรับงบ'
];
var FLOW_STEPS_GENERAL=[
  {step_name:'ประธานฝ่าย',role_required:'ROLE-SGN'},
  {step_name:'หัวหน้านิสิต',role_required:'ROLE-SGN',pos:'GNK-PRE'},
  {step_name:'อาจารย์ที่ปรึกษา',role_required:'ROLE-ADV',role:'ROLE-ADV'}
];
var FLOW_STEPS_BUDGET=[
  {step_name:'เหรัญญิก',role_required:'ROLE-SGN',pos:'GNK-TRS'},
  {step_name:'เจ้าหน้าที่กิจการนิสิต',role_required:'ROLE-STF',role:'ROLE-STF'},
  {step_name:'ผู้รับผิดชอบโครงการ',role_required:'ROLE-CRT',self:true}
].concat(FLOW_STEPS_GENERAL);
function _normFlowStep(s){
  if(!s||!s.step_name) return null;
  var o={step_name:String(s.step_name),role_required:s.role_required||'ROLE-SGN'};
  if(s.pos) o.pos=String(s.pos);
  if(s.role) o.role=String(s.role);
  if(s.self) o.self=true;
  return o;
}
function _applyFlowStepsJson(jsonArr,targetArr){
  if(!Array.isArray(jsonArr)||!jsonArr.length) return;
  targetArr.length=0;
  jsonArr.forEach(function(s){var o=_normFlowStep(s);if(o) targetArr.push(o);});
}
var SENDER_POS=[
  {name:'หัวหน้านิสิต',code:'01',isClub:false},
  {name:'ชมรมต้นกล้าคณิตศาสตร์',code:'01',isClub:true},
  {name:'รองหัวหน้านิสิตคนที่ 1',code:'02',isClub:false},
  {name:'ชมรมคิดแบบนักวิทย์',code:'02',isClub:true},
  {name:'รองหัวหน้านิสิตคนที่ 2',code:'03',isClub:false},
  {name:'ชมรมพลเมืองพลัส',code:'03',isClub:true},
  {name:'เลขานุการ',code:'04',isClub:false},
  {name:'ชมรมภาษาและวัฒนธรรมไทย',code:'04',isClub:true},
  {name:'เหรัญญิก',code:'05',isClub:false},
  {name:'ชมรมอิงคลิศวิชชหรรษา',code:'05',isClub:true},
  {name:'ฝ่ายวิชาการ',code:'06',isClub:false},
  {name:'ชมรมโต้วาที',code:'06',isClub:true},
  {name:'ฝ่ายนิสิตสัมพันธ์',code:'07',isClub:false},
  {name:'ชมรมกิจกรรมและสันทนาการ',code:'07',isClub:true},
  {name:'ฝ่ายกีฬา',code:'08',isClub:false},
  {name:'ชมรมวอลเลย์บอล',code:'08',isClub:true},
  {name:'ฝ่ายศิลปะและวัฒนธรรม',code:'09',isClub:false},
  {name:'ชมรมแบดมินตัน',code:'09',isClub:true},
  {name:'ฝ่ายพัฒนาสังคมและบำเพ็ญประโยชน์',code:'10',isClub:false},
  {name:'ชมรมครุศาสตร์นานาศิลป์และศิลปะเพื่อการศึกษาร่วมสมัย',code:'10',isClub:true},
  {name:'หัวหน้าชั้นปีที่ 1',code:'11',isClub:false},
  {name:'ชมรมศิลปะการแสดง',code:'11',isClub:true},
  {name:'หัวหน้าชั้นปีที่ 2',code:'12',isClub:false},
  {name:'ชมรมสื่อสร้างสรรค์',code:'12',isClub:true},
  {name:'หัวหน้าชั้นปีที่ 3',code:'13',isClub:false},
  {name:'ชมรมครุศาสตร์นาฎยสโมสร',code:'13',isClub:true},
  {name:'หัวหน้าชั้นปีที่ 4',code:'14',isClub:false},
  {name:'ชมรมดนตรีสากล คณะครุศาสตร์ จุฬาฯ',code:'14',isClub:true},
  {name:'แผนกทะเบียนและประเมินผล',code:'15',isClub:false},
  {name:'ชมรมครุศิลป์สู่สังคม',code:'15',isClub:true},
  {name:'แผนกสวัสดิการและพยาบาล',code:'16',isClub:false},
  {name:'ชมรม ICU CLUB',code:'16',isClub:true},
  {name:'แผนกหาทุน',code:'17',isClub:false},
  {name:'แผนกสถานที่',code:'18',isClub:false},
  {name:'แผนกโสตทัศนูปกรณ์',code:'19',isClub:false},
  {name:'แผนกพัสดุ',code:'20',isClub:false},
  {name:'แผนกสื่อประชาสัมพันธ์',code:'22',isClub:false},
  {name:'แผนกถ่ายภาพ',code:'23',isClub:false},
  {name:'แผนกศิลป์และออกแบบ',code:'24',isClub:false}
];
var STTH={draft:'ร่างเอกสาร',pending:'รอลงนาม',signed:'ลงนามแล้ว',rejected:'ส่งคืนแก้ไข',numbering:'รอออกเลขหนังสือ',awaiting_submit:'รอเจ้าหน้าที่ยื่นในระบบ',completed:'เสร็จสมบูรณ์'};
var RTH={'ROLE-SYS':'ผู้ดูแลระบบ','ROLE-SGN':'ผู้ลงนาม','ROLE-REV':'ผู้ตรวจทาน','ROLE-CRT':'ผู้จัดทำ','ROLE-STF':'เจ้าหน้าที่','ROLE-ADV':'อาจารย์ที่ปรึกษาชมรม','ROLE-DEV':'นักพัฒนา'};
var POSS=['GNK-PRE','GNK-VPR','GNK-VPR2','GNK-SEC','GNK-TRS','GNK-ACA','GNK-STR','GNK-SPT','GNK-ART','GNK-SDV','GNK-YR4','GNK-YR3','GNK-YR2','GNK-YR1','GNK-WEL','GNK-CER','GNK-REG','GNK-FAC','GNK-AVT','GNK-SUP','GNK-COM','GNK-PHO','GNK-DES','GNK-IT','GNK-FND','GNK-CPR','GNK-CVP','GNK-CSEC','GNK-CTRS'];
var PTH={'GNK-PRE':'หัวหน้านิสิต','GNK-VPR':'รองหัวหน้านิสิตคนที่ 1','GNK-VPR2':'รองหัวหน้านิสิตคนที่ 2','GNK-SEC':'เลขานุการ','GNK-TRS':'เหรัญญิก','GNK-ACA':'ฝ่ายวิชาการ','GNK-STR':'ฝ่ายนิสิตสัมพันธ์','GNK-SPT':'ฝ่ายกีฬา','GNK-ART':'ฝ่ายศิลปะและวัฒนธรรม','GNK-SDV':'ฝ่ายพัฒนาสังคมและบำเพ็ญประโยชน์','GNK-YR4':'หัวหน้านิสิตชั้นปีที่ 4','GNK-YR3':'หัวหน้านิสิตชั้นปีที่ 3','GNK-YR2':'หัวหน้านิสิตชั้นปีที่ 2','GNK-YR1':'หัวหน้านิสิตชั้นปีที่ 1','GNK-WEL':'สวัสดิการและพยาบาล','GNK-CER':'ปฏิคมและพิธีการ','GNK-REG':'ทะเบียนและประเมินผล','GNK-FAC':'สถานที่','GNK-AVT':'โสตทัศนูปกรณ์','GNK-SUP':'พัสดุ','GNK-COM':'สื่อและประชาสัมพันธ์','GNK-PHO':'ถ่ายภาพ','GNK-DES':'ศิลป์และออกแบบ','GNK-IT':'เทคโนโลยีและสารสนเทศ','GNK-FND':'หาทุน','GNK-CPR':'ประธานชมรม','GNK-CVP':'รองประธานชมรม','GNK-CSEC':'เลขานุการชมรม','GNK-CTRS':'เหรัญญิกชมรม'};
var PR={'GNK-PRE':'ROLE-SGN','GNK-VPR':'ROLE-CRT','GNK-VPR2':'ROLE-CRT','GNK-SEC':'ROLE-CRT','GNK-TRS':'ROLE-CRT','GNK-ACA':'ROLE-CRT','GNK-STR':'ROLE-CRT','GNK-SPT':'ROLE-CRT','GNK-ART':'ROLE-CRT','GNK-SDV':'ROLE-CRT','GNK-YR4':'ROLE-CRT','GNK-YR3':'ROLE-CRT','GNK-YR2':'ROLE-CRT','GNK-YR1':'ROLE-CRT','GNK-WEL':'ROLE-CRT','GNK-CER':'ROLE-CRT','GNK-REG':'ROLE-CRT','GNK-FAC':'ROLE-CRT','GNK-AVT':'ROLE-CRT','GNK-SUP':'ROLE-CRT','GNK-COM':'ROLE-CRT','GNK-PHO':'ROLE-CRT','GNK-DES':'ROLE-CRT','GNK-IT':'ROLE-CRT','GNK-FND':'ROLE-CRT','GNK-CPR':'ROLE-CRT','GNK-CVP':'ROLE-CRT','GNK-CSEC':'ROLE-CRT','GNK-CTRS':'ROLE-CRT'};
/* เลขรหัสตำแหน่ง (หลักที่ 2-3) สำหรับออกเลขหนังสือขาออก */
var GNK_NUM={'GNK-PRE':'01','GNK-VPR':'02','GNK-VPR2':'03','GNK-SEC':'04','GNK-TRS':'05','GNK-ACA':'06','GNK-STR':'07','GNK-SPT':'08','GNK-ART':'09','GNK-SDV':'10','GNK-YR4':'12','GNK-YR3':'13','GNK-YR2':'14','GNK-YR1':'15','GNK-WEL':'16','GNK-CER':'17','GNK-REG':'18','GNK-FAC':'19','GNK-AVT':'20','GNK-SUP':'21','GNK-COM':'22','GNK-PHO':'23','GNK-DES':'24','GNK-IT':'25','GNK-FND':'26','GNK-CPR':'27','GNK-CVP':'28','GNK-CSEC':'29','GNK-CTRS':'30'};
/* ประเภทจดหมายขาออก (หลักที่ 4) index 1-9 */
var OUT_LTYPES=['','ขออนุมัติ','ขอความอนุเคราะห์','เบิกเงินรองจ่าย','เบิกเงินค่าใช้จ่าย','ขอคืนเงินสำรองจ่าย','ขอติดประกาศ','เชิญประชุม','แจ้งให้ทราบ / แต่งตั้ง','จดหมายอื่น ๆ'];
/* ชมรม (หลักที่ 8-9) */
var CLUBS={'01':'ชมรมต้นกล้าคณิตศาสตร์','03':'ชมรมพลเมืองพลัส','04':'ชมรมภาษาและวัฒนธรรมไทย','05':'ชมรมอิงคลิศวิชชหรรษา','07':'ชมรมเชียร์และสันทนาการ','13':'ชมรมครุศาสตร์นานาศิลป์และศิลปะเพื่อการศึกษาร่วมสมัย','16':'ชมรมศิลปะการแสดง','17':'ชมรมครุศิลป์สู่สังคม','19':'ชมรมเพื่อเด็ก สตรี และสิทธิมนุษยชน','21':'ชมรมโต้วาที','23':'ชมรมดนตรีสากล คณะครุศาสตร์ จุฬาลงกรณ์มหาวิทยาลัย','24':'ชมรมสื่อสร้างสรรค์','25':'ชมรมวอลเลย์บอล','26':'ชมรมแบดมินตัน','27':'ชมรมคิดแบบนักวิทย์','28':'ชมรมครุศาสตร์นาฎยสโมสร','29':'ชมรม ICU CLUB'};
/* ภาคการศึกษา (หลักที่ 1) */
var SEMS={'1':'ภาคการศึกษาต้น','2':'ภาคการศึกษาปลาย'};
var UTH={gnk:'กนค.',advisor:'อาจารย์',staff:'เจ้าหน้าที่',admin:'ผู้ดูแลระบบ'};
/* ROLE-DEV ใช้ฟีเจอร์ฝั่งผู้ใช้ได้ทุกอย่าง (สร้าง/ลงนาม/ตรวจทาน/อัปโหลด) เพื่อทดสอบระบบ
   — สิทธิ์ DB ยังเป็น is_dev() แคบ ๆ เหมือนเดิม (เขียนเอกสารได้เฉพาะที่ตัวเองเกี่ยวข้อง เหมือน user ทั่วไป) */
var _canAnyRole=function(r){return['ROLE-SYS','ROLE-SGN','ROLE-REV','ROLE-CRT','ROLE-STF','ROLE-ADV','ROLE-DEV'].includes(r)};
var CAN={
  up:_canAnyRole,cr:_canAnyRole,ed:_canAnyRole,
  sg:function(r){return['ROLE-SGN','ROLE-ADV','ROLE-SYS','ROLE-DEV'].includes(r)},
  rv:function(r){return['ROLE-REV','ROLE-SGN','ROLE-ADV','ROLE-SYS','ROLE-DEV'].includes(r)},
  ci:function(r,p){return true;}, // สร้างหนังสือขาเข้า — ค่าเริ่มต้นเปิดให้ทุก role/ตำแหน่ง, override ผ่าน SETT.can_create_incoming_roles_json/_positions_json
  co:function(r,p){return true;} // สร้างหนังสือขาออก — ค่าเริ่มต้นเปิดให้ทุก role/ตำแหน่ง, override ผ่าน SETT.can_create_outgoing_roles_json/_positions_json
};

/* ─── อายุบัญชี กนค. — รอบละ 1 ปี เริ่ม 20 พ.ค. 2569 (ค.ศ. 2026-05-20)
   หมดอายุ 20 พ.ค. ปีถัดไป (2570 / 2027-05-20) — อนุมัติ/สมัครใหม่ใช้วันนี้เป็นมาตรฐาน
   ต่ออายุ = เลื่อนวันหมดอายุออกไปอีก 1 ปี (คงวัน 20 พ.ค.) */
var GNK_ACCOUNT_START='2026-05-20';
function gnkAccountStartDate(){
  return new Date(GNK_ACCOUNT_START+'T00:00:00+07:00');
}
function gnkDefaultExpiresAt(){
  var d=gnkAccountStartDate();
  d.setFullYear(d.getFullYear()+1);
  return d.toISOString();
}
function gnkRenewExpiresAt(currentExpires){
  var d=currentExpires?new Date(currentExpires):null;
  if(!d||isNaN(d.getTime())) d=new Date(gnkDefaultExpiresAt());
  d=new Date(d.getTime());
  d.setFullYear(d.getFullYear()+1);
  var now=new Date();
  while(d<=now) d.setFullYear(d.getFullYear()+1);
  return d.toISOString();
}

/* ─── DOCUMENT TYPE FIELD CONFIG ─── */
var DTYPE_CFG={
  incoming:{label:'หนังสือขาเข้า',icon:'dn',
    showFrom:true,fromLabel:'จากหน่วยงาน / ผู้ส่ง',
    showTo:true,toLabel:'เรียน / ส่งถึงฝ่าย',
    showRef:true,refLabel:'เลขที่หนังสือ (อ้างอิง)',
    showDocDate:true,docDateLabel:'วันที่รับเอกสาร',
    eventLabel:'วันที่ต้องดำเนินการเสร็จ',eventRequired:false},
  outgoing:{label:'หนังสือขาออก',icon:'up',
    showFrom:true,fromLabel:'จากฝ่าย / หน่วยงาน',
    showTo:true,toLabel:'เรียน (ส่งถึงใคร)',
    showRef:true,refLabel:'หัวข้ออีเมลแจ้งเตือน',
    showDocDate:false,docDateLabel:'',
    eventLabel:'วันที่จัดกิจกรรม / วันที่ต้องใช้เอกสาร',eventRequired:true}
};

/* โหลดประเภทเอกสารจาก DB แทนค่าที่ hardcode ไว้ */
async function loadDocTypes(){
  try{
    var rows=await dg('doc_types','?is_active=eq.true&order=sort_order,created_at');
    if(!rows||!rows.length) return;
    var typeIds=rows.map(function(r){return r.id});
    var allFields=[];
    try{allFields=await dg('doc_type_fields','?doc_type_id=in.('+typeIds.join(',')+')'+'&order=sort_order');}catch(e){}
    var fieldsByType={};
    allFields.forEach(function(f){
      if(!fieldsByType[f.doc_type_id]) fieldsByType[f.doc_type_id]=[];
      fieldsByType[f.doc_type_id].push(f);
    });
    var newDT={}, newCFG={};
    rows.forEach(function(r){
      newDT[r.code]=r.label;
      newCFG[r.code]={
        label:r.label, icon:r.icon||'doc',
        showFrom:r.show_from, fromLabel:r.from_label||'',
        showTo:r.show_to, toLabel:r.to_label||'',
        showRef:r.show_ref, refLabel:r.ref_label||'',
        showDocDate:r.show_doc_date, docDateLabel:r.doc_date_label||'',
        eventLabel:r.event_label||'วันกำหนดส่ง', eventRequired:!!r.event_required,
        minDays:r.min_days||0, enableDeadline:r.enable_deadline!==false,
        fields:fieldsByType[r.id]||[]
      };
    });
    Object.keys(DTYPES).forEach(function(k){delete DTYPES[k]});
    Object.assign(DTYPES,newDT);
    Object.keys(DTYPE_CFG).forEach(function(k){delete DTYPE_CFG[k]});
    Object.assign(DTYPE_CFG,newCFG);
  }catch(e){console.warn('loadDocTypes failed, using defaults',e)}
}

/* ─── APP SETTINGS (โหลดจาก Supabase — มี fallback ค่า default เสมอ) ─── */
var SETT={
  sla_cascade_days:3,
  session_timeout_min:30,
  max_file_size_mb:10,
  email_prefix:'[กนค.]',
  system_announcement:'',
  system_announcement_type:'info',
  line_oa_id:'',   // Basic ID ของ LINE OA (เช่น @123abcd) — ใช้สร้างลิงก์แอดเพื่อนใน modal เชื่อมต่อ LINE
  app_url:'',      // URL ระบบ — แนบท้ายข้อความแจ้งเตือน LINE
  line_group_id:'',                             // groupId กลุ่มเจ้าหน้าที่ (webhook เขียนให้ตอนพิมพ์รหัสเชื่อมกลุ่ม)
  line_group_events:'create,resubmit,overdue'   // เหตุการณ์ที่แจ้งเข้ากลุ่ม (action ของ sendNotifEmail)
};
async function loadAppSettings(){
  try{
    var rows=await dg('app_settings','?');
    if(!Array.isArray(rows)) return;
    rows.forEach(function(r){
      var v=r.value;
      if(r.value_type==='number') v=+v||0;
      if(r.value_type==='boolean') v=(v==='true');
      if(r.value_type==='json'){try{v=JSON.parse(v);}catch(e){return;}}
      SETT[r.key]=v;
    });
    /* override global reference arrays from saved settings */
    if(Array.isArray(SETT.letter_types_json)&&SETT.letter_types_json.length){
      LETTER_TYPES.length=0;
      SETT.letter_types_json.forEach(function(x){LETTER_TYPES.push(x);});
    }
    if(Array.isArray(SETT.out_ltypes_json)&&SETT.out_ltypes_json.length){
      OUT_LTYPES.length=0; OUT_LTYPES.push('');
      SETT.out_ltypes_json.forEach(function(x){OUT_LTYPES.push(x);});
    }
    if(Array.isArray(SETT.clubs_json)&&SETT.clubs_json.length){
      Object.keys(CLUBS).forEach(function(k){delete CLUBS[k];});
      SETT.clubs_json.forEach(function(c){CLUBS[c.code]=c.name;});
    }
    if(Array.isArray(SETT.sender_pos_json)&&SETT.sender_pos_json.length){
      SENDER_POS.length=0;
      SETT.sender_pos_json.forEach(function(p){SENDER_POS.push(p);});
    }
    /* positions system (POSS/PTH/GNK_NUM/PR) */
    if(Array.isArray(SETT.positions_json)&&SETT.positions_json.length){
      POSS.length=0;
      Object.keys(PTH).forEach(function(k){delete PTH[k];});
      Object.keys(GNK_NUM).forEach(function(k){delete GNK_NUM[k];});
      Object.keys(PR).forEach(function(k){delete PR[k];});
      SETT.positions_json.forEach(function(p){
        POSS.push(p.code);
        PTH[p.code]=p.name;
        GNK_NUM[p.code]=p.num;
        PR[p.code]=p.role||'ROLE-CRT';
      });
    }
    /* fixed workflow presets (หนังสือขาเข้า) — แก้ผ่าน จัดการระบบ → รายการอ้างอิง */
    if(Array.isArray(SETT.budget_ltypes_json)&&SETT.budget_ltypes_json.length){
      BUDGET_LTYPES.length=0;
      SETT.budget_ltypes_json.forEach(function(x){if(x) BUDGET_LTYPES.push(String(x));});
    }
    _applyFlowStepsJson(SETT.flow_steps_general_json,FLOW_STEPS_GENERAL);
    if(Array.isArray(SETT.flow_steps_budget_json)&&SETT.flow_steps_budget_json.length){
      _applyFlowStepsJson(SETT.flow_steps_budget_json,FLOW_STEPS_BUDGET);
    }
    /* CAN permissions */
    if(Array.isArray(SETT.can_sign_roles_json)&&SETT.can_sign_roles_json.length){
      var _sg=SETT.can_sign_roles_json.slice();
      if(!_sg.includes('ROLE-SYS')) _sg.push('ROLE-SYS');
      if(!_sg.includes('ROLE-DEV')) _sg.push('ROLE-DEV'); // นักพัฒนาลงนามได้เสมอ — ไว้ทดสอบระบบ
      CAN.sg=function(r){return _sg.includes(r);};
    }
    if(Array.isArray(SETT.can_review_roles_json)&&SETT.can_review_roles_json.length){
      var _rv=SETT.can_review_roles_json.slice();
      if(!_rv.includes('ROLE-SYS')) _rv.push('ROLE-SYS');
      if(!_rv.includes('ROLE-DEV')) _rv.push('ROLE-DEV');
      CAN.rv=function(r){return _rv.includes(r);};
    }
    if((Array.isArray(SETT.can_create_incoming_roles_json)&&SETT.can_create_incoming_roles_json.length)||(Array.isArray(SETT.can_create_incoming_positions_json)&&SETT.can_create_incoming_positions_json.length)){
      var _ci=(Array.isArray(SETT.can_create_incoming_roles_json)?SETT.can_create_incoming_roles_json.slice():[]);
      var _ciP=(Array.isArray(SETT.can_create_incoming_positions_json)?SETT.can_create_incoming_positions_json.slice():[]);
      if(!_ci.includes('ROLE-SYS')) _ci.push('ROLE-SYS');
      if(!_ci.includes('ROLE-DEV')) _ci.push('ROLE-DEV');
      CAN.ci=function(r,p){return _ci.includes(r)||_ciP.includes(p);};
    }
    if((Array.isArray(SETT.can_create_outgoing_roles_json)&&SETT.can_create_outgoing_roles_json.length)||(Array.isArray(SETT.can_create_outgoing_positions_json)&&SETT.can_create_outgoing_positions_json.length)){
      var _co=(Array.isArray(SETT.can_create_outgoing_roles_json)?SETT.can_create_outgoing_roles_json.slice():[]);
      var _coP=(Array.isArray(SETT.can_create_outgoing_positions_json)?SETT.can_create_outgoing_positions_json.slice():[]);
      if(!_co.includes('ROLE-SYS')) _co.push('ROLE-SYS');
      if(!_co.includes('ROLE-DEV')) _co.push('ROLE-DEV');
      CAN.co=function(r,p){return _co.includes(r)||_coP.includes(p);};
    }
  }catch(e){}
  checkSchemaHealth();
}
function checkSchemaHealth(){
  if(!CU||['ROLE-SYS','ROLE-STF','ROLE-DEV'].indexOf(CU.role_code)<0) return;
  var got=String(SETT.schema_version||'');
  window._schemaWarning=got!==REQUIRED_SCHEMA_VERSION;
}

/* ─── PROJECTS (รายชื่อโครงการสำหรับหนังสือขาออก) ─── */
var PROJS=[];
async function loadProjects(){
  try{
    var rows=await dg('projects','?is_active=eq.true&order=sort_order,name');
    PROJS=Array.isArray(rows)?rows.map(function(r){return{id:r.id,name:r.name}}):[];
  }catch(e){PROJS=[];}
}

/* ─── STATE ─── */
var CU=null, CV='', CDI=null;
var ADOCS=[], AUSERS=[], DTAB='all', PC=0;
var FS=[], FF=[], FU=[], FDI=null, PF=[];
var MSTEPS=[];           // doc IDs ที่ current user มี active workflow step
var _lastAct=0, _sesTmr=null; // session timeout
var PED={url:'',name:'',fid:'',did:'',pdf:null,pg:1,total:1,els:[],sel:null,tool:'sig',
  drawing:false,sigColor:'#1a1410',sigSz:2,txtColor:'#1a1410',txtSz:14,txtFont:'Noto Sans Thai',txtBold:false,txtItalic:false,txtUnder:false,
  localFile:null,isPDF:false,scale:1.4};

