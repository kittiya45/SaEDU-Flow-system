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
function safeId(id){return encodeURIComponent(String(id||''))}
async function upFile(path,file){
  var r=await fetch(SU+'/storage/v1/object/documents/'+encodeURIComponent(path),{method:'POST',headers:{apikey:SK,'Authorization':'Bearer '+SK,'x-upsert':'true'},body:file});
  return r.json()
}
function furl(p){return SU+'/storage/v1/object/public/documents/'+encodeURIComponent(p)}

/* ─── CONSTANTS ─── */
var DTYPES={incoming:'หนังสือขาเข้า',outgoing:'หนังสือขาออก',certificate:'หนังสือรับรอง',memo:'บันทึกข้อความ'};
var URG={normal:'ปกติ',urgent:'เร่งด่วน',very_urgent:'ด่วนมาก'};
var LETTER_TYPES=['ขออนุมัติ','ขออนุเคราะห์','เบิกเงินรองจ่าย','เบิกเงินค่าใช้จ่าย','ขอคืนเงินสํารองจ่าย','ขอติดประกาศ','ขอเชิญประชุม','แจ้งให้ทราบ/แต่งตั้ง','จดหมายอื่น ๆ'];
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
  {name:'แผนกหาทุน',code:'17',isClub:false},
  {name:'แผนกสถานที่',code:'18',isClub:false},
  {name:'แผนกโสตทัศนูปกรณ์',code:'19',isClub:false},
  {name:'แผนกพัสดุ',code:'20',isClub:false},
  {name:'แผนกสื่อประชาสัมพันธ์',code:'22',isClub:false},
  {name:'แผนกถ่ายภาพ',code:'23',isClub:false},
  {name:'แผนกศิลป์และออกแบบ',code:'24',isClub:false}
];
var STTH={draft:'ร่างเอกสาร',pending:'รอลงนาม',signed:'ลงนามแล้ว',rejected:'ส่งคืนแก้ไข',numbering:'รอออกเลขหนังสือ',completed:'เสร็จสิ้น'};
var RTH={'ROLE-SYS':'ผู้ดูแลระบบ','ROLE-SGN':'ผู้ลงนาม','ROLE-REV':'ผู้ตรวจทาน','ROLE-CRT':'ผู้จัดทำ','ROLE-STF':'เจ้าหน้าที่','ROLE-ADV':'อาจารย์กิจการ'};
var POSS=['GNK-PRE','GNK-VPR','GNK-VPR2','GNK-SEC','GNK-TRS','GNK-ACA','GNK-STR','GNK-SPT','GNK-ART','GNK-SDV','GNK-YR4','GNK-YR3','GNK-YR2','GNK-YR1','GNK-WEL','GNK-CER','GNK-REG','GNK-FAC','GNK-AVT','GNK-SUP','GNK-COM','GNK-PHO','GNK-DES','GNK-IT','GNK-FND'];
var PTH={'GNK-PRE':'หัวหน้านิสิต','GNK-VPR':'รองหัวหน้านิสิตคนที่ 1','GNK-VPR2':'รองหัวหน้านิสิตคนที่ 2','GNK-SEC':'เลขานุการ','GNK-TRS':'เหรัญญิก','GNK-ACA':'ฝ่ายวิชาการ','GNK-STR':'ฝ่ายนิสิตสัมพันธ์','GNK-SPT':'ฝ่ายกีฬา','GNK-ART':'ฝ่ายศิลปะและวัฒนธรรม','GNK-SDV':'ฝ่ายพัฒนาสังคมและบำเพ็ญประโยชน์','GNK-YR4':'หัวหน้านิสิตชั้นปีที่ 4','GNK-YR3':'หัวหน้านิสิตชั้นปีที่ 3','GNK-YR2':'หัวหน้านิสิตชั้นปีที่ 2','GNK-YR1':'หัวหน้านิสิตชั้นปีที่ 1','GNK-WEL':'สวัสดิการและพยาบาล','GNK-CER':'ปฏิคมและพิธีการ','GNK-REG':'ทะเบียนและประเมินผล','GNK-FAC':'สถานที่','GNK-AVT':'โสตทัศนูปกรณ์','GNK-SUP':'พัสดุ','GNK-COM':'สื่อและประชาสัมพันธ์','GNK-PHO':'ถ่ายภาพ','GNK-DES':'ศิลป์และออกแบบ','GNK-IT':'เทคโนโลยีและสารสนเทศ','GNK-FND':'หาทุน'};
var PR={'GNK-PRE':'ROLE-SGN','GNK-VPR':'ROLE-CRT','GNK-VPR2':'ROLE-CRT','GNK-SEC':'ROLE-CRT','GNK-TRS':'ROLE-CRT','GNK-ACA':'ROLE-CRT','GNK-STR':'ROLE-CRT','GNK-SPT':'ROLE-CRT','GNK-ART':'ROLE-CRT','GNK-SDV':'ROLE-CRT','GNK-YR4':'ROLE-CRT','GNK-YR3':'ROLE-CRT','GNK-YR2':'ROLE-CRT','GNK-YR1':'ROLE-CRT','GNK-WEL':'ROLE-CRT','GNK-CER':'ROLE-CRT','GNK-REG':'ROLE-CRT','GNK-FAC':'ROLE-CRT','GNK-AVT':'ROLE-CRT','GNK-SUP':'ROLE-CRT','GNK-COM':'ROLE-CRT','GNK-PHO':'ROLE-CRT','GNK-DES':'ROLE-CRT','GNK-IT':'ROLE-CRT','GNK-FND':'ROLE-CRT'};
/* เลขรหัสตำแหน่ง (หลักที่ 2-3) สำหรับออกเลขหนังสือขาออก */
var GNK_NUM={'GNK-PRE':'01','GNK-VPR':'02','GNK-VPR2':'03','GNK-SEC':'04','GNK-TRS':'05','GNK-ACA':'06','GNK-STR':'07','GNK-SPT':'08','GNK-ART':'09','GNK-SDV':'10','GNK-YR4':'12','GNK-YR3':'13','GNK-YR2':'14','GNK-YR1':'15','GNK-WEL':'16','GNK-CER':'17','GNK-REG':'18','GNK-FAC':'19','GNK-AVT':'20','GNK-SUP':'21','GNK-COM':'22','GNK-PHO':'23','GNK-DES':'24','GNK-IT':'25','GNK-FND':'26'};
/* ประเภทจดหมายขาออก (หลักที่ 4) index 1-9 */
var OUT_LTYPES=['','ขออนุมัติ','ขอความอนุเคราะห์','เบิกเงินรองจ่าย','เบิกเงินค่าใช้จ่าย','ขอคืนเงินสำรองจ่าย','ขอติดประกาศ','เชิญประชุม','แจ้งให้ทราบ / แต่งตั้ง','จดหมายอื่น ๆ'];
/* ชมรม (หลักที่ 8-9) */
var CLUBS={'01':'ชมรมต้นกล้าคณิตศาสตร์','03':'ชมรมพลเมืองพลัส','04':'ชมรมภาษาและวัฒนธรรมไทย','05':'ชมรมอิงคลิศวิชชหรรษา','07':'ชมรมเชียร์และสันทนาการ','13':'ชมรมครุศาสตร์นานาศิลป์และศิลปะเพื่อการศึกษาร่วมสมัย','16':'ชมรมศิลปะการแสดง','17':'ชมรมครุศิลป์สู่สังคม','19':'ชมรมเพื่อเด็ก สตรี และสิทธิมนุษยชน','21':'ชมรมโต้วาที','23':'ชมรมดนตรีสากล คณะครุศาสตร์ จุฬาลงกรณ์มหาวิทยาลัย','24':'ชมรมสื่อสร้างสรรค์','25':'ชมรมวอลเลย์บอล','26':'ชมรมแบดมินตัน'};
/* ภาคการศึกษา (หลักที่ 1) */
var SEMS={'1':'ภาคการศึกษาต้น','2':'ภาคการศึกษาปลาย'};
var UTH={gnk:'กนค.',advisor:'อาจารย์',staff:'เจ้าหน้าที่',admin:'ผู้ดูแลระบบ'};
var _canAnyRole=function(r){return['ROLE-SYS','ROLE-SGN','ROLE-REV','ROLE-CRT','ROLE-STF','ROLE-ADV'].includes(r)};
var CAN={
  up:_canAnyRole,cr:_canAnyRole,ed:_canAnyRole,
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

/* ─── STATE ─── */
var CU=null, CV='', CDI=null;
var ADOCS=[], AUSERS=[], DTAB='all', PC=0;
var FS=[], FF=[], FU=[], FDI=null, PF=[];
var MSTEPS=[];           // doc IDs ที่ current user มี active workflow step
var _lastAct=0, _sesTmr=null; // session timeout
var PED={url:'',name:'',fid:'',did:'',pdf:null,pg:1,total:1,els:[],sel:null,tool:'sig',
  drawing:false,sigColor:'#1a1410',sigSz:2,txtColor:'#1a1410',txtSz:14,txtFont:'Noto Sans Thai',txtBold:false,txtItalic:false,txtUnder:false,
  localFile:null,isPDF:false,scale:1.4};

