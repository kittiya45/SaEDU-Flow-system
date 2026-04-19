/* ─── CONFIG ─── */
var SU = 'https://jrubupvzltxqstzcpoov.supabase.co';
var SK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpydWJ1cHZ6bHR4cXN0emNwb292Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2OTc2MDEsImV4cCI6MjA5MTI3MzYwMX0.nA1VY7i-syUHQNb-wmmFdjFyQCZKaCeIzPOIEDtTHFA';
var H = {apikey:SK,'Authorization':'Bearer '+SK,'Content-Type':'application/json','Prefer':'return=representation'};

async function dg(t,q){var r=await fetch(SU+'/rest/v1/'+t+(q||''),{headers:H});return r.json()}
async function dp(t,b){var r=await fetch(SU+'/rest/v1/'+t,{method:'POST',headers:H,body:JSON.stringify(b)});return r.json()}
async function dpa(t,id,b){var r=await fetch(SU+'/rest/v1/'+t+'?id=eq.'+id,{method:'PATCH',headers:H,body:JSON.stringify(b)});return r.json()}
// ตาราง document_history และ notifications ห้ามลบจาก client เด็ดขาด
var _PROTECTED_TABLES=['document_history','notifications'];
async function dd(t,id){
  if(_PROTECTED_TABLES.indexOf(t)!==-1){console.warn('Blocked: DELETE on protected table "'+t+'"');return;}
  var r=await fetch(SU+'/rest/v1/'+t+'?id=eq.'+id,{method:'DELETE',headers:{apikey:SK,'Authorization':'Bearer '+SK}});
  if(!r.ok){var e=await r.json().catch(function(){return{}});throw new Error(e.message||String(r.status))}
}
async function upFile(path,file){
  var r=await fetch(SU+'/storage/v1/object/documents/'+encodeURIComponent(path),{method:'POST',headers:{apikey:SK,'Authorization':'Bearer '+SK,'x-upsert':'true'},body:file});
  return r.json()
}
function furl(p){return SU+'/storage/v1/object/public/documents/'+encodeURIComponent(p)}

/* ─── CONSTANTS ─── */
var DTYPES={incoming:'หนังสือขาเข้า',outgoing:'หนังสือขาออก',certificate:'หนังสือรับรอง',memo:'บันทึกข้อความ'};
var URG={normal:'ปกติ',urgent:'เร่งด่วน',very_urgent:'ด่วนมาก'};
var STTH={draft:'ร่างเอกสาร',pending:'รอลงนาม',signed:'ลงนามแล้ว',rejected:'ส่งคืนแก้ไข',completed:'เสร็จสิ้น'};
var RTH={'ROLE-SYS':'ผู้ดูแลระบบ','ROLE-SGN':'ผู้ลงนาม','ROLE-REV':'ผู้ตรวจทาน','ROLE-CRT':'ผู้จัดทำ','ROLE-STF':'เจ้าหน้าที่','ROLE-ADV':'อาจารย์กิจการ'};
var POSS=['GNK-PRE','GNK-VPR','GNK-ACA','GNK-STR','GNK-SPT','GNK-SDV','GNK-SUP','GNK-REG','GNK-TRS','GNK-COM','GNK-SEC'];
var PTH={'GNK-PRE':'หัวหน้านิสิต (President)','GNK-VPR':'รองหัวหน้านิสิต (VP)','GNK-ACA':'ประธานฝ่ายวิชาการ','GNK-STR':'ประธานฝ่ายนิสิตสัมพันธ์','GNK-SPT':'ประธานฝ่ายกีฬา','GNK-SDV':'ประธานฝ่ายพัฒนาสังคมฯ','GNK-SUP':'ฝ่ายพัสดุ','GNK-REG':'ฝ่ายทะเบียน','GNK-TRS':'ฝ่ายเหรัญญิก','GNK-COM':'ฝ่ายสื่อสารองค์กร','GNK-SEC':'เลขานุการ (Secretary)'};
var PR={'GNK-PRE':'ROLE-SGN','GNK-VPR':'ROLE-SGN','GNK-ACA':'ROLE-REV','GNK-STR':'ROLE-REV','GNK-SPT':'ROLE-REV','GNK-SDV':'ROLE-REV','GNK-SUP':'ROLE-CRT','GNK-REG':'ROLE-CRT','GNK-TRS':'ROLE-CRT','GNK-COM':'ROLE-CRT','GNK-SEC':'ROLE-CRT'};
var UTH={gnk:'กนค.',advisor:'อาจารย์',staff:'เจ้าหน้าที่',admin:'ผู้ดูแลระบบ'};
var CAN={
  up:function(r){return['ROLE-SYS','ROLE-SGN','ROLE-REV','ROLE-CRT','ROLE-STF','ROLE-ADV'].includes(r)},
  cr:function(r){return['ROLE-SYS','ROLE-SGN','ROLE-REV','ROLE-CRT','ROLE-STF','ROLE-ADV'].includes(r)},
  ed:function(r){return['ROLE-SYS','ROLE-SGN','ROLE-REV','ROLE-CRT','ROLE-STF','ROLE-ADV'].includes(r)},
  sg:function(r){return['ROLE-SGN','ROLE-ADV','ROLE-SYS'].includes(r)},
  rv:function(r){return['ROLE-REV','ROLE-SGN','ROLE-ADV','ROLE-SYS'].includes(r)}
};

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
    eventLabel:'วันที่จัดกิจกรรม / วันที่ต้องใช้เอกสาร',eventRequired:true},
  certificate:{label:'หนังสือรับรอง',icon:'doc',
    showFrom:false,fromLabel:'',
    showTo:true,toLabel:'ออกให้แก่ / เรียน',
    showRef:false,refLabel:'',
    showDocDate:false,docDateLabel:'',
    eventLabel:'วันที่ต้องการใช้ (Deadline)',eventRequired:true},
  memo:{label:'บันทึกข้อความ',icon:'edit',
    showFrom:true,fromLabel:'จาก (ฝ่าย / ผู้บันทึก)',
    showTo:true,toLabel:'ถึง (ฝ่าย / ผู้รับ)',
    showRef:false,refLabel:'',
    showDocDate:false,docDateLabel:'',
    eventLabel:'วันที่ต้องการ (ถ้ามี)',eventRequired:false}
};

/* โหลดประเภทเอกสารจาก DB แทนค่าที่ hardcode ไว้ */
async function loadDocTypes(){
  try{
    var rows=await dg('doc_types','?is_active=eq.true&order=sort_order,created_at');
    if(!rows||!rows.length) return;
    var newDT={}, newCFG={};
    rows.forEach(function(r){
      newDT[r.code]=r.label;
      newCFG[r.code]={label:r.label,icon:r.icon||'doc',
        showFrom:r.show_from,fromLabel:r.from_label||'',
        showTo:r.show_to,toLabel:r.to_label||'',
        showRef:r.show_ref,refLabel:r.ref_label||'',
        showDocDate:r.show_doc_date,docDateLabel:r.doc_date_label||'',
        eventLabel:r.event_label||'วันกำหนดส่ง',eventRequired:!!r.event_required};
    });
    Object.keys(DTYPES).forEach(function(k){delete DTYPES[k]});
    Object.assign(DTYPES,newDT);
    Object.keys(DTYPE_CFG).forEach(function(k){delete DTYPE_CFG[k]});
    Object.assign(DTYPE_CFG,newCFG);
  }catch(e){console.warn('loadDocTypes failed, using defaults',e)}
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

