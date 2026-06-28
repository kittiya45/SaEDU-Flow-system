/* ─── CALENDAR STATE ─── */
var _calY=new Date().getFullYear();
var _calM=new Date().getMonth();
var _calSel='';
var _calDocs=[];
var _calEvts=[];
var _calEvtPg=0;

/* ─── PROJECT SUMMARY STATE ─── */
var _projYear=new Date().getFullYear()+543;

async function _loadEvtsDB(){
  try{
    var _ev=await dg('calendar_events','?order=date');
    _calEvts=Array.isArray(_ev)?_ev:[];
  }catch(e){_calEvts=[];}
}
function _calNav(dir){
  _calM+=dir;
  if(_calM>11){_calM=0;_calY++}
  if(_calM<0){_calM=11;_calY--}
  _calSel=''; _renderCal()
}
function _calPick(d){
  _calSel=_calSel===d?'':d; _calEvtPg=0; _renderCal()
}
function _calEvtNav(dir){
  _calEvtPg+=dir; _renderCal()
}
/* เปิด popup เพิ่มกิจกรรม — โครงเดียวกับ showTmplUpload() ใน templates.js */
var _calNewEvtPrivate=false;
function showCalAddEvt(){
  var w=$e('mwrap'); if(!w) return;
  var defDate=_calSel||new Date().toISOString().substring(0,10);
  _calNewEvtPrivate=false;

  w.innerHTML=[
    '<div id="cal-evt-overlay" class="mo" style="position:fixed;inset:0;z-index:9999;background:rgba(24,18,14,0.4);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;">',

      '<div class="modal" style="max-width:440px;width:95%;border-radius:28px;background:#fff;box-shadow:0 40px 100px -20px rgba(232,58,0,.15);border:1px solid rgba(232,58,0,.05);overflow:hidden;position:relative;" onclick="event.stopPropagation()">',

        // HEADER
        '<div class="modal-head" style="padding:28px 32px 20px 32px;background:linear-gradient(to bottom, rgba(232,58,0,.05), #fff);border:none;display:flex;justify-content:space-between;align-items:flex-start;">',

          '<div class="flex flex-col gap-1">',
            '<div style="color:#E83A00;font-weight:800;font-size:10px;letter-spacing:.12em;text-transform:uppercase;display:flex;align-items:center;gap:6px;">',
              '<span style="width:10px;height:2px;background:#E83A00;border-radius:2px;"></span>',
              'ปฏิทินกิจกรรม',
            '</div>',

            '<span class="modal-title" style="font-size:19px;font-weight:850;color:#18120E;letter-spacing:-0.02em;">',
              'เพิ่มกิจกรรมใหม่',
            '</span>',
          '</div>',

          '<button type="button" id="btn-close-cal-evt" class="btn btn-soft sm btn-icon" style="cursor:pointer;background:rgba(232,58,0,.08);color:#E83A00;border-radius:12px;width:34px;height:34px;border:none;display:flex;align-items:center;justify-content:center;">',
            svg('x',14),
          '</button>',

        '</div>',

        // BODY
        '<div class="modal-body" style="padding:0 32px 24px 32px;">',

          '<div class="fg" style="margin-bottom:16px;">',
            '<label class="fl" style="display:block;font-size:11.5px;font-weight:700;color:#18120E;margin-bottom:6px;">',
              'ชื่อกิจกรรม <span class="req" style="color:#E83A00">*</span>',
            '</label>',
            '<input class="fi" id="cal-inp" type="text" placeholder="เช่น ประชุม กนค." style="width:100%;height:44px;padding:0 14px;font-size:12.5px;border-radius:12px;border:1.5px solid #F1F1F1;background:#FAFAFA;outline:none;" onkeydown="if(event.key===\'Enter\')_calSaveEvt()">',
          '</div>',

          '<div class="fg" style="margin:0">',
            '<label class="fl" style="display:block;font-size:11.5px;font-weight:700;color:#18120E;margin-bottom:6px;">',
              'วันที่ <span class="req" style="color:#E83A00">*</span>',
            '</label>',
            '<input class="fi" id="cal-date" type="date" value="'+defDate+'" style="width:100%;height:44px;padding:0 14px;font-size:12.5px;border-radius:12px;border:1.5px solid #F1F1F1;background:#FAFAFA;">',
          '</div>',

          '<div class="fg" style="margin:16px 0 0">',
            '<label class="fl" style="display:block;font-size:11.5px;font-weight:700;color:#18120E;margin-bottom:6px;">',
              'การมองเห็น',
            '</label>',
            '<div style="display:flex;gap:8px">',
              '<button type="button" id="cal-vis-pub" onclick="_calSetVis(false)" style="flex:1;height:40px;border-radius:12px;border:1.5px solid #E83A00;background:#FFF5F0;color:#E83A00;font-size:12px;font-weight:700;cursor:pointer;">สาธารณะ — ทุกคนเห็น</button>',
              '<button type="button" id="cal-vis-priv" onclick="_calSetVis(true)" style="flex:1;height:40px;border-radius:12px;border:1.5px solid #EBEBEB;background:#FAFAFA;color:#6b6560;font-size:12px;font-weight:700;cursor:pointer;">ส่วนตัว — เห็นแค่ฉัน</button>',
            '</div>',
          '</div>',

        '</div>',

        // FOOTER
        '<div class="modal-foot" style="padding:0 32px 32px 32px;border:none;background:none;display:flex;gap:10px;">',

          '<button type="button" id="btn-cancel-cal-evt" class="btn btn-soft" style="cursor:pointer;flex:1;height:46px;border-radius:14px;font-weight:600;font-size:12.5px;border:1px solid #EBEBEB;background:#fff;color:#6b6560;">',
            'ยกเลิก',
          '</button>',

          '<button type="button" id="btn-save-cal-evt" class="btn btn-primary" style="cursor:pointer;flex:1.8;height:46px;border-radius:14px;font-weight:700;font-size:12.5px;background:#E83A00;color:#fff;display:flex;align-items:center;justify-content:center;gap:8px;border:none;box-shadow:0 8px 16px -4px rgba(232,58,0,.3);">',
            'บันทึก',
          '</button>',

        '</div>',

      '</div>',
    '</div>'
  ].join('');

  var overlay=$e('cal-evt-overlay');
  var closeBtn=$e('btn-close-cal-evt');
  var cancelBtn=$e('btn-cancel-cal-evt');
  var saveBtn=$e('btn-save-cal-evt');

  function closeModal(){ w.innerHTML=''; }

  overlay.addEventListener('click',function(){ closeModal(); });
  closeBtn.addEventListener('click',function(e){ e.preventDefault();e.stopPropagation();closeModal(); });
  cancelBtn.addEventListener('click',function(e){ e.preventDefault();e.stopPropagation();closeModal(); });
  saveBtn.addEventListener('click',function(e){ e.preventDefault();e.stopPropagation();_calSaveEvt(); });

  setTimeout(function(){var i=$e('cal-inp');if(i)i.focus()},50);
}
function _calSetVis(priv){
  _calNewEvtPrivate=priv;
  var pub=$e('cal-vis-pub'), pv=$e('cal-vis-priv');
  if(!pub||!pv) return;
  function style(btn,on){
    btn.style.border=on?'1.5px solid #E83A00':'1.5px solid #EBEBEB';
    btn.style.background=on?'#FFF5F0':'#FAFAFA';
    btn.style.color=on?'#E83A00':'#6b6560';
  }
  style(pub,!priv); style(pv,priv);
}
async function _calSaveEvt(){
  var ti=$e('cal-inp'), da=$e('cal-date');
  if(!ti||!ti.value.trim()) return;
  var date=da&&da.value?da.value:(_calSel||new Date().toISOString().substring(0,10));
  await dp('calendar_events',{date:date,title:ti.value.trim(),color:'#3B82F6',created_by:CU.id,is_private:!!_calNewEvtPrivate});
  if(!_calSel) _calSel=date;
  var mw=$e('mwrap'); if(mw) mw.innerHTML='';
  await _loadEvtsDB(); _renderCal()
}
async function _calDelEvt(id){
  var ev=_calEvts.find(function(e){return e.id===id});
  if(ev&&ev.created_by!==CU.id&&CU.role_code!=='ROLE-SYS') return;
  await dd('calendar_events',id);
  await _loadEvtsDB(); _renderCal()
}
function _renderCal(){
  var w=$e('cal-widget'); if(w) w.innerHTML=_buildCal(_calDocs)
}
function _buildCal(docs){
  var MTHS=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  var DAYS=['อา','จ','อ','พ','พฤ','ศ','ส'];
  var todayStr=new Date().toISOString().substring(0,10);
  var yr=_calY, mo=_calM;
  var eMap={};
  docs.forEach(function(d){
    if(!d.due_date) return;
    var k=d.due_date.substring(0,10);
    if(!eMap[k]) eMap[k]=[];
    eMap[k].push({type:'doc',title:d.title,id:d.id,status:d.status,num:d.doc_number||'—'})
  });
  _calEvts.forEach(function(e){
    if(!eMap[e.date]) eMap[e.date]=[];
    eMap[e.date].push({type:'cust',title:e.title,eid:e.id,priv:e.is_private})
  });
  var firstDay=new Date(yr,mo,1).getDay();
  var dim=new Date(yr,mo+1,0).getDate();
  var h=[];

  /* card wrapper */
  h.push('<div style="background:#fff;border-radius:20px;border:1px solid rgba(0,0,0,.07);overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.07)">');

  /* gradient header */
  h.push(
    '<div style="background:linear-gradient(135deg,#E83A00 0%,#FF6035 100%);padding:16px 18px;display:flex;align-items:center;justify-content:space-between">'+
    '<div style="display:flex;align-items:center;gap:9px">'+
      '<div style="width:30px;height:30px;border-radius:9px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;color:#fff">'+svg('cal',15)+'</div>'+
      '<span style="font-size:13px;font-weight:800;color:#fff;letter-spacing:-.2px">ปฏิทินกิจกรรม</span>'+
    '</div>'+
    '<button onclick="showCalAddEvt()" style="background:rgba(255,255,255,.15);color:#fff;border:1px solid rgba(255,255,255,.45);border-radius:9px;padding:5px 12px;font-size:11px;font-weight:700;cursor:pointer;letter-spacing:.1px">'+
    '+ เพิ่มกิจกรรม</button>'+
    '</div>'
  );

  /* month navigation */
  h.push(
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 16px 8px">'+
    '<button onclick="_calNav(-1)" style="width:32px;height:32px;border-radius:10px;background:#F5F3F0;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#6b6560;font-size:18px;line-height:1;flex-shrink:0">‹</button>'+
    '<div style="text-align:center">'+
      '<div style="font-size:15px;font-weight:900;color:#18120E;letter-spacing:-.5px">'+MTHS[mo]+'</div>'+
      '<div style="font-size:11px;color:#a89e99;font-weight:600;margin-top:1px">'+(yr+543)+'</div>'+
    '</div>'+
    '<button onclick="_calNav(1)" style="width:32px;height:32px;border-radius:10px;background:#F5F3F0;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#6b6560;font-size:18px;line-height:1;flex-shrink:0">›</button>'+
    '</div>'
  );

  /* day name headers */
  h.push('<div style="display:grid;grid-template-columns:repeat(7,1fr);padding:0 12px 6px">');
  DAYS.forEach(function(d,i){
    var hdrColor=i===0?'#E83A00':i===6?'#3B82F6':'#b8b0ab';
    h.push('<div style="text-align:center;font-size:10px;font-weight:800;padding:4px 0;color:'+hdrColor+';letter-spacing:.4px">'+d+'</div>');
  });
  h.push('</div>');

  /* calendar grid */
  h.push('<div style="display:grid;grid-template-columns:repeat(7,1fr);padding:0 10px 10px;gap:3px">');
  for(var i=0;i<firstDay;i++) h.push('<div></div>');
  for(var d=1;d<=dim;d++){
    var p=yr+'-'+(mo+1<10?'0':'')+(mo+1)+'-'+(d<10?'0':'')+d;
    var isTod=p===todayStr, isSel=p===_calSel;
    var evts=eMap[p]||[];
    var hasDoc=evts.some(function(e){return e.type==='doc'});
    var hasCust=evts.some(function(e){return e.type==='cust'});
    var col=(firstDay+d-1)%7;
    var isSun=col===0, isSat=col===6;
    var cellBg=isSel?'#E83A00':'transparent';
    var hoverBg=isSat?'#EFF6FF':'#F5F3F0';
    var dotOnSel='rgba(255,255,255,.9)';
    var numHtml;
    if(isTod&&!isSel){
      numHtml='<span style="width:28px;height:28px;border-radius:50%;background:#E83A00;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:11.5px;line-height:1;flex-shrink:0">'+d+'</span>';
    } else {
      var tc=isSel?'#fff':isSun?'#C05440':isSat?'#3B82F6':'#18120E';
      var fw=isSel?'900':'400';
      numHtml='<span style="font-size:11.5px;font-weight:'+fw+';color:'+tc+';line-height:1">'+d+'</span>';
    }
    h.push(
      '<div onclick="_calPick(\''+p+'\')" '+
      'style="display:flex;flex-direction:column;align-items:center;justify-content:center;aspect-ratio:1/1;border-radius:10px;cursor:pointer;background:'+cellBg+';box-sizing:border-box;" '+
      (!isSel?'onmouseover="this.style.background=\''+hoverBg+'\'" onmouseout="this.style.background=\''+cellBg+'\'"':'')+'>'+
        numHtml+
        '<div style="display:flex;gap:2px;margin-top:3px;height:5px;align-items:center">'+
          (hasDoc?'<div style="width:4px;height:4px;border-radius:50%;background:'+(isSel?dotOnSel:'#E83A00')+'"></div>':'')+
          (hasCust?'<div style="width:4px;height:4px;border-radius:50%;background:'+(isSel?'rgba(255,255,255,.7)':'#3B82F6')+'"></div>':'')+
        '</div>'+
      '</div>'
    );
  }
  h.push('</div>');

  /* legend */
  h.push(
    '<div style="padding:0 16px 14px;display:flex;gap:14px">'+
    '<div style="display:flex;align-items:center;gap:5px">'+
      '<div style="width:5px;height:5px;border-radius:50%;background:#E83A00"></div>'+
      '<span style="font-size:10px;color:#b0a9a4;font-weight:600">กำหนดส่งเอกสาร</span>'+
    '</div>'+
    '<div style="display:flex;align-items:center;gap:5px">'+
      '<div style="width:5px;height:5px;border-radius:50%;background:#3B82F6"></div>'+
      '<span style="font-size:10px;color:#b0a9a4;font-weight:600">กิจกรรม</span>'+
    '</div>'+
    '</div>'
  );

  /* selected date panel */
  if(_calSel){
    var selEvts=eMap[_calSel]||[];
    h.push('<div style="border-top:1px solid #F0EDE8;padding:14px 16px 16px">');
    var selD=new Date(_calSel+'T12:00:00');
    h.push(
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">'+
        '<div style="width:4px;height:20px;border-radius:2px;background:#E83A00;flex-shrink:0"></div>'+
        '<div style="font-size:12px;font-weight:700;color:#18120E">'+selD.toLocaleDateString('th-TH',{weekday:'long',day:'numeric',month:'long',year:'numeric'})+'</div>'+
      '</div>'
    );
    if(!selEvts.length){
      h.push(
        '<div style="text-align:center;padding:16px 0">'+
          '<div style="font-size:26px;margin-bottom:8px">📅</div>'+
          '<div style="font-size:11px;font-weight:700;color:#c0b9b4">ไม่มีกิจกรรมในวันนี้</div>'+
          '<div style="font-size:10px;color:#c0b9b4;margin-top:3px">กด "+ เพิ่มกิจกรรม" เพื่อเพิ่ม</div>'+
        '</div>'
      );
    } else {
      var EVT_PER_PG=3;
      var totalEvtPg=Math.ceil(selEvts.length/EVT_PER_PG);
      if(_calEvtPg>=totalEvtPg) _calEvtPg=totalEvtPg-1;
      if(_calEvtPg<0) _calEvtPg=0;
      var pgEvts=selEvts.slice(_calEvtPg*EVT_PER_PG,(_calEvtPg+1)*EVT_PER_PG);
      if(totalEvtPg>1){
        var btnBase='border:none;border-radius:8px;width:28px;height:28px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;font-size:15px;';
        h.push(
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'+
          '<button onclick="_calEvtNav(-1)" '+(_calEvtPg===0?'disabled ':'')+'style="'+btnBase+'background:'+(_calEvtPg===0?'#F5F3F0':'#F5F3F0')+';color:'+(_calEvtPg===0?'#d0c9c4':'#6b6560')+'">◂</button>'+
          '<span style="font-size:10px;color:#a89e99;font-weight:700">'+(_calEvtPg+1)+' / '+totalEvtPg+' ('+selEvts.length+' กิจกรรม)</span>'+
          '<button onclick="_calEvtNav(1)" '+(_calEvtPg===totalEvtPg-1?'disabled ':'')+'style="'+btnBase+'background:#F5F3F0;color:'+(_calEvtPg===totalEvtPg-1?'#d0c9c4':'#6b6560')+'">▸</button>'+
          '</div>'
        );
      }
      pgEvts.forEach(function(e){
        if(e.type==='doc'){
          h.push(
            '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#FFF5F0;border-radius:10px;margin-bottom:6px;cursor:pointer;border:1px solid rgba(232,58,0,.1)" '+
            'onclick="nav(\'det\',\''+e.id+'\')" onmouseover="this.style.background=\'#FFE8DC\'" onmouseout="this.style.background=\'#FFF5F0\'">'+
              '<div style="width:7px;height:7px;border-radius:50%;background:#E83A00;flex-shrink:0"></div>'+
              '<div style="flex:1;min-width:0">'+
                '<div style="font-size:11px;font-weight:700;color:#18120E;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(e.title)+'</div>'+
                '<div style="font-size:10px;color:#a89e99;margin-top:3px;display:flex;align-items:center;gap:4px">'+esc(e.num)+' · '+sBadge(e.status)+'</div>'+
              '</div>'+
              '<div style="color:#c0b9b4;font-size:14px;flex-shrink:0">›</div>'+
            '</div>'
          );
        } else {
          h.push(
            '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#EFF6FF;border-radius:10px;margin-bottom:6px;border:1px solid rgba(59,130,246,.1)">'+
              '<div style="width:7px;height:7px;border-radius:50%;background:#3B82F6;flex-shrink:0"></div>'+
              '<div style="flex:1;min-width:0;font-size:11px;font-weight:700;color:#18120E;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(e.title)+(e.priv?' <span style="color:#a89e99;font-weight:600">(ส่วนตัว)</span>':'')+'</div>'+
              '<button onclick="_calDelEvt(\''+e.eid+'\')" style="background:none;border:none;color:#c0b9b4;cursor:pointer;padding:2px;line-height:1;flex-shrink:0;display:inline-flex;align-items:center" title="ลบ">'+svg('x',13)+'</button>'+
            '</div>'
          );
        }
      });
    }
    h.push('</div>');
  }

  h.push('</div>');
  return h.join('')
}

/* ─── DASHBOARD ─── */
async function vDash(){
  var _ds=await Promise.all([
    dg('documents','?order=created_at.desc&limit=500&select=id,title,doc_type,status,urgency,due_date,created_by,created_at,doc_number'),
    dg('workflow_steps','?assigned_to=eq.'+CU.id+'&select=document_id,status')
  ]);
  var _allD2=_ds[0], _mySteps2=_ds[1];
  var _myIds2=_mySteps2.map(function(s){return s.document_id});
  var _myActive=_mySteps2.filter(function(s){return s.status==='active'}).length;
  var _canSeeAll=CU.role_code==='ROLE-SYS'||CU.position_code==='GNK-SEC';
  var docs=_canSeeAll?_allD2:_allD2.filter(function(d){
    // ROLE-ADV เห็นภาพรวมกว้างเหมือน ROLE-STF (ตรงกับที่ vDocs()/vStat() ให้เห็นอยู่แล้ว) ไม่ใช่แค่เอกสารของตัวเอง
    if(['ROLE-STF','ROLE-ADV'].includes(CU.role_code)) return d.created_by===CU.id||d.forwarded_to_id===CU.id||d.status==='numbering'||_myIds2.indexOf(d.id)!==-1;
    return d.created_by===CU.id||_myIds2.indexOf(d.id)!==-1;
  });

  var cnt={total:docs.length,pnd:0,cplt:0,rej:0,draft:0};
  docs.forEach(function(d){
    if(d.status==='pending') cnt.pnd++;
    else if(d.status==='completed'||d.status==='signed') cnt.cplt++;
    else if(d.status==='rejected') cnt.rej++;
    else if(d.status==='draft') cnt.draft++;
  });

  /* [UX] เปลี่ยน greeting เป็นภาษาไทยให้ consistent กับ locale ของระบบ */
  var hr=new Date().getHours();
  var greet=hr<12?'สวัสดีตอนเช้า':(hr<17?'สวัสดีตอนบ่าย':'สวัสดีตอนเย็น');
  var today=new Date().toLocaleDateString('th-TH',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  var html=[];

  /* ── Greeting row ── */
  html.push(
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:24px;flex-wrap:wrap">'+
    '<div>'+
      '<div style="font-size:22px;font-weight:900;letter-spacing:-0.5px;color:#18120E">'+greet+', '+esc(CU.full_name.split(' ')[0])+'</div>'+
      '<div style="font-size:13px;color:#a89e99;margin-top:3px">'+today+' · '+(RTH[CU.role_code]||'')+'</div>'+
    '</div>'+
    '<div style="display:flex;gap:9px">'+
      (CAN.cr(CU.role_code)?'<button class="btn btn-primary" data-action="nav" data-view="new">'+svg('plus',14)+' สร้างเอกสารใหม่</button>':'')+
    '</div>'+
    '</div>'
  );

  // ── 4 Stat cards — white neutral ──
  var cards=[
    {label:'เอกสารทั้งหมด', val:cnt.total, sub:'ร่าง '+cnt.draft+' · ส่งคืน '+cnt.rej,
     ico:'doc_f', grad:'linear-gradient(135deg,#1D4ED8 0%,#3B82F6 100%)', sh:'rgba(29,78,216,.35)', navTarget:'docs'},
    {label:'รอลงนาม',        val:cnt.pnd,   sub:'รอการอนุมัติจากผู้รับผิดชอบ',
     ico:'pen_f', grad:'linear-gradient(135deg,#D97706 0%,#F59E0B 100%)', sh:'rgba(217,119,6,.35)', navTarget:'docs'},
    {label:'เสร็จสิ้นแล้ว', val:cnt.cplt,  sub:'ผ่านทุกขั้นตอนเรียบร้อย',
     ico:'check_f', grad:'linear-gradient(135deg,#15803D 0%,#22C55E 100%)', sh:'rgba(21,128,61,.35)', navTarget:'docs'},
    {label:'งานรอฉัน',       val:_myActive, sub:'ขั้นตอนที่ต้องดำเนินการ',
     ico:'bell_f', grad:'linear-gradient(135deg,#7C3AED 0%,#A855F7 100%)', sh:'rgba(124,58,237,.35)', navTarget:'todo'}
  ];

  html.push('<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:28px">');
  cards.forEach(function(c){
    html.push(
      '<div style="border-radius:20px;padding:20px 22px;background:'+c.grad+';position:relative;overflow:hidden;cursor:pointer;box-shadow:0 8px 28px '+c.sh+'" '+
      'onclick="nav(\''+c.navTarget+'\')">'+
        '<div style="position:absolute;right:-18px;bottom:-18px;width:100px;height:100px;border-radius:50%;background:rgba(255,255,255,.15)"></div>'+
        '<div style="position:absolute;right:26px;bottom:-30px;width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,.1)"></div>'+
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;position:relative">'+
          '<div style="font-size:11px;font-weight:700;color:rgba(255,255,255,.88);letter-spacing:.3px">'+c.label+'</div>'+
          '<div style="width:34px;height:34px;border-radius:11px;background:rgba(255,255,255,.22);display:flex;align-items:center;justify-content:center;color:#fff">'+svgf(c.ico,17)+'</div>'+
        '</div>'+
        '<div style="font-size:36px;font-weight:900;color:#fff;line-height:1;letter-spacing:-2px;margin-bottom:7px;position:relative">'+c.val+'</div>'+
        '<div style="font-size:11px;color:rgba(255,255,255,.75);position:relative">'+c.sub+'</div>'+
      '</div>'
    );
  });
  html.push('</div>');

  /* ── Main 2-col grid ── */

  html.push('<div style="display:grid;grid-template-columns:1fr 320px;gap:20px;align-items:stretch">');

  /* ── LEFT: Recent docs ── */
  html.push('<div style="min-width:0;display:flex;flex-direction:column">');
  html.push(
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">'+
    '<div>'+
      '<div style="font-size:13px;font-weight:600;color:#18120E">เอกสารล่าสุด</div>'+
      '<div style="font-size:11px;color:#a89e99;margin-top:2px">'+docs.length+' รายการทั้งหมดที่คุณเกี่ยวข้อง</div>'+
    '</div>'+
    '<button class="btn btn-soft sm" data-action="nav" data-view="docs">ดูทั้งหมด →</button>'+
    '</div>'
  );

  var recent=docs.slice(0,5);
  html.push('<div style="background:#fff;border-radius:16px;border:1px solid rgba(0,0,0,.055);overflow:hidden;box-shadow:var(--sh-card);flex:1;display:flex;flex-direction:column">');
  if(recent.length){
    recent.forEach(function(d,idx){
      var isMyTask=_myIds2.indexOf(d.id)!==-1;
      html.push(
        '<div style="display:flex;align-items:center;gap:14px;padding:14px 20px;cursor:pointer;transition:background 120ms'+(idx>0?';border-top:1px solid #F5F3F0':'')+'" '+
        'data-action="nav" data-view="det" data-id="'+d.id+'" '+
        'onmouseover="this.style.background=\'#FDFBF9\'" onmouseout="this.style.background=\'\'">'+
          '<div style="width:3px;height:36px;border-radius:2px;flex-shrink:0;background:'+(isMyTask?'#E83A00':'transparent')+'"></div>'+
          '<span class="mono" style="font-size:11px;flex-shrink:0;min-width:88px">'+esc(d.doc_number||'—')+'</span>'+
          '<div style="flex:1;min-width:0">'+
            '<div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:3px">'+esc(d.title)+'</div>'+
            '<div>'+tBadge(d.doc_type)+'</div>'+
          '</div>'+
          '<div style="flex-shrink:0">'+sBadge(d.status)+'</div>'+
          '<div style="font-size:12px;color:#a89e99;white-space:nowrap;flex-shrink:0;min-width:72px;text-align:right">'+fd(d.created_at)+'</div>'+
          '<div style="width:30px;height:30px;border-radius:8px;background:#F5F3F0;color:#6b6560;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">'+svg('eye',13)+'</div>'+
        '</div>'
      );
    });
  } else {
    html.push(
      '<div style="padding:64px 24px;text-align:center;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center">'+
        '<div style="width:64px;height:64px;border-radius:20px;background:#EBEBEB;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;color:#a89e99">'+svg('doc',28)+'</div>'+
        '<div style="font-size:15px;font-weight:700;color:#6b6560;margin-bottom:6px">ยังไม่มีเอกสาร</div>'+
        '<div style="font-size:12px;color:#a89e99;margin-bottom:20px">เริ่มต้นด้วยการสร้างเอกสารแรกของคุณ</div>'+
        (CAN.cr(CU.role_code)?'<button class="btn btn-primary sm" data-action="nav" data-view="new">'+svg('plus',13)+' สร้างเอกสารใหม่</button>':'')+
      '</div>'
    );
  }
  html.push('</div>'); /* doc list card */
  html.push('</div>'); /* left col */

  /* ── RIGHT col: Calendar ── */
  _calDocs=docs;
  await _loadEvtsDB();
  html.push('<div id="cal-widget">'+_buildCal(docs)+'</div>');

  html.push('</div>'); /* 2-col grid */

  /* ── Project Summary (เฉพาะ ROLE-STF, ROLE-ADV, ROLE-SYS) ── */
  if(CU&&['ROLE-STF','ROLE-ADV','ROLE-SYS'].includes(CU.role_code)){
    html.push('<div id="proj-summary-widget" style="margin-top:24px">');
    html.push(await _buildProjSummary());
    html.push('</div>');
  }

  return html.join('');
}

/* ─── PROJECT SUMMARY ─── */
function _projYearNav(delta){_projYear+=delta;_renderProjSummary();}
async function _renderProjSummary(){
  var el=$e('proj-summary-widget');
  if(el) el.innerHTML=await _buildProjSummary();
}

/* ปีที่กรองยึดตามวันที่ "สร้าง" เอกสาร (created_at) ให้ตรงกับหน้าสถิติ — ไม่ใช่ปีในเลขหนังสือ
   เพราะเอกสารที่ยังไม่ออกเลขหนังสือ (doc_number เป็น null) จะไม่ถูกนับเลยถ้ากรองด้วยเลขหนังสือ */
function _projYearRange(thYear){
  var gYear=thYear-543;
  return {start:gYear+'-01-01T00:00:00',end:(gYear+1)+'-01-01T00:00:00'};
}

async function _buildProjSummary(){
  var raw=await dg('documents','?doc_type=eq.outgoing&select=id,title,doc_number,description,status,created_at,updated_at&order=created_at.desc');
  var all=Array.isArray(raw)?raw:[];

  var _rng=_projYearRange(_projYear);
  var yearDocs=all.filter(function(d){
    return (d.created_at||'')>=_rng.start&&(d.created_at||'')<_rng.end;
  });

  /* group by project name stored in description */
  var projMap={};
  yearDocs.forEach(function(d){
    var key=(d.description||'').trim()||'(ไม่ระบุโครงการ)';
    if(!projMap[key]) projMap[key]={name:key,docs:[],latestDate:null,latestStatus:''};
    projMap[key].docs.push(d);
    var dt=d.updated_at||d.created_at;
    if(!projMap[key].latestDate||dt>projMap[key].latestDate){
      projMap[key].latestDate=dt;
      projMap[key].latestStatus=d.status;
    }
  });
  var groups=Object.values(projMap).sort(function(a,b){return b.docs.length-a.docs.length;});
  var total=yearDocs.length;
  var totalDone=yearDocs.filter(function(d){return d.status==='completed';}).length;
  var pct=total>0?Math.round(totalDone/total*100):0;

  var h=[];
  h.push(
    '<div style="background:#fff;border-radius:16px;border:1px solid #EBEBEB;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.05)">'+
    '<div style="padding:16px 20px;border-bottom:1px solid #F5F3F0;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">'+
      '<div>'+
        '<div style="font-size:14px;font-weight:800;color:#18120E">สรุปโครงการประจำปี</div>'+
        '<div style="font-size:11px;color:#a89e99;margin-top:2px">หนังสือขาออกที่ถึงหมด ปีพ.ศ. '+_projYear+'</div>'+
      '</div>'+
      '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'+
        (total>0?'<span style="font-size:11px;color:#a89e99">'+total+' เอกสาร · '+groups.length+' โครงการ</span>':'')+
        '<div style="display:flex;align-items:center;background:#F5F3F0;border-radius:10px;padding:3px 6px;gap:2px">'+
          '<button onclick="_projYearNav(-1)" style="width:26px;height:26px;border-radius:7px;background:none;border:none;cursor:pointer;color:#6b6560;font-size:16px;display:flex;align-items:center;justify-content:center;line-height:1">‹</button>'+
          '<span style="font-size:12px;font-weight:800;color:#18120E;padding:0 6px;white-space:nowrap">พ.ศ. '+_projYear+'</span>'+
          '<button onclick="_projYearNav(1)" style="width:26px;height:26px;border-radius:7px;background:none;border:none;cursor:pointer;color:#6b6560;font-size:16px;display:flex;align-items:center;justify-content:center;line-height:1">›</button>'+
        '</div>'+
        (total>0?'<button id="proj-dl-btn" onclick="_downloadProjZip()" style="background:#E83A00;color:#fff;border:none;border-radius:9px;padding:7px 14px;font-size:11px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;box-shadow:0 2px 8px rgba(232,58,0,.3)">'+
          svg('doc',12)+' ดาวน์โหลดทุกไฟล์ (ZIP)</button>':'')+
      '</div>'+
    '</div>'
  );

  if(!yearDocs.length){
    h.push(
      '<div style="padding:48px 20px;text-align:center">'+
        '<div style="width:64px;height:64px;border-radius:16px;background:#F5F3F0;display:flex;align-items:center;justify-content:center;color:#6b6560;margin:0 auto 14px">'+svg('doc',30)+'</div>'+
        '<div style="font-size:13px;font-weight:700;color:#c0b9b4">ไม่มีหนังสือขาออกในปี พ.ศ. '+_projYear+'</div>'+
      '</div>'
    );
  } else {
    h.push(
      '<table style="width:100%;border-collapse:collapse">'+
      '<thead><tr style="border-bottom:2px solid #F5F3F0">'+
        '<th style="padding:9px 20px;font-size:10px;font-weight:700;color:#a89e99;text-align:left;width:32px">#</th>'+
        '<th style="padding:9px 12px;font-size:10px;font-weight:700;color:#a89e99;text-align:left">ชื่อโครงการ / กิจกรรม</th>'+
        '<th style="padding:9px 12px;font-size:10px;font-weight:700;color:#a89e99;text-align:right;width:80px">เอกสาร</th>'+
        '<th style="padding:9px 12px;font-size:10px;font-weight:700;color:#a89e99;text-align:center;width:110px">สถานะล่าสุด</th>'+
        '<th style="padding:9px 20px;font-size:10px;font-weight:700;color:#a89e99;text-align:right;width:90px">วันที่</th>'+
      '</tr></thead><tbody>'
    );
    groups.forEach(function(g,i){
      var cntDone=g.docs.filter(function(d){return d.status==='completed';}).length;
      var allDone=cntDone===g.docs.length;
      h.push(
        '<tr style="border-bottom:1px solid #F9F8F7">'+
          '<td style="padding:13px 20px;font-size:12px;color:#c0b9b4;font-weight:600">'+(i+1)+'</td>'+
          '<td style="padding:13px 12px">'+
            '<div style="font-size:13px;font-weight:700;color:#18120E;margin-bottom:2px">'+esc(g.name)+'</div>'+
            '<div style="font-size:10px;font-weight:700;color:'+(allDone?'#16A34A':'#D97706')+'">'+cntDone+'/'+g.docs.length+' เสร็จสิ้น</div>'+
          '</td>'+
          '<td style="padding:13px 12px;text-align:right;font-size:18px;font-weight:900;color:#18120E">'+g.docs.length+'</td>'+
          '<td style="padding:13px 12px;text-align:center">'+sBadge(g.latestStatus)+'</td>'+
          '<td style="padding:13px 20px;text-align:right;font-size:11px;color:#a89e99">'+fd(g.latestDate)+'</td>'+
        '</tr>'
      );
    });
    h.push('</tbody></table>');
    h.push(
      '<div style="padding:14px 20px;border-top:1px solid #F5F3F0;background:#FAFAF8">'+
        '<div style="height:7px;background:#EBEBEB;border-radius:99px;overflow:hidden;margin-bottom:6px">'+
          '<div style="height:100%;width:'+pct+'%;background:linear-gradient(90deg,#16A34A,#22C55E);border-radius:99px"></div>'+
        '</div>'+
        '<div style="display:flex;justify-content:flex-end;font-size:11px;color:#16A34A;font-weight:800">'+
          totalDone+'/'+total+' เสร็จสิ้น ('+pct+'%)'+
        '</div>'+
      '</div>'
    );
  }
  h.push('</div>');
  return h.join('');
}

async function _loadJSZip(){
  if(typeof JSZip!=='undefined') return;
  return new Promise(function(res,rej){
    var s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    s.onload=res;
    s.onerror=function(){rej(new Error('โหลด JSZip ไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต'));};
    document.head.appendChild(s);
  });
}

async function _downloadProjZip(){
  var btn=$e('proj-dl-btn');
  if(btn){btn.disabled=true;btn.innerHTML='<span class="sp" style="border-color:rgba(255,255,255,.3);border-top-color:#fff"></span> กำลังรวมไฟล์...';}
  try{
    await _loadJSZip();
    var raw=await dg('documents','?doc_type=eq.outgoing&status=eq.completed&select=id,title,doc_number,description,created_at&order=created_at.desc');
    var _rng=_projYearRange(_projYear);
    var yearDocs=(Array.isArray(raw)?raw:[]).filter(function(d){
      return (d.created_at||'')>=_rng.start&&(d.created_at||'')<_rng.end;
    });
    if(!yearDocs.length){showAlert('ไม่พบเอกสารที่เสร็จสิ้นในปีนี้','wa');return;}

    var zip=new JSZip();
    var fileCount=0;

    for(var i=0;i<yearDocs.length;i++){
      var doc=yearDocs[i];
      var proj=(doc.description||'ไม่ระบุโครงการ').replace(/[\/\\:*?"<>|]/g,'_').trim()||'ไม่ระบุโครงการ';
      var num=(doc.doc_number||'doc').replace(/[\/\\:*?"<>|]/g,'-').trim();

      var files=await dg('document_files','?document_id=eq.'+doc.id+'&order=version.desc&limit=20');
      if(!Array.isArray(files)||!files.length) continue;

      var seen={};
      for(var j=0;j<files.length;j++){
        var f=files[j];
        var rawName=f.file_path.split('/').pop();
        if(seen[rawName]) continue;
        seen[rawName]=true;
        try{
          var resp=await fetch(furl(f.file_path));
          if(!resp.ok) continue;
          var blob=await resp.blob();
          zip.file(proj+'/'+num+'_'+rawName,blob);
          fileCount++;
        }catch(e){}
      }
      if(btn) btn.innerHTML='<span class="sp" style="border-color:rgba(255,255,255,.3);border-top-color:#fff"></span> '+(i+1)+'/'+yearDocs.length+' เอกสาร...';
    }

    if(!fileCount){showAlert('ไม่พบไฟล์แนบในเอกสารปีนี้','wa');return;}
    if(btn) btn.innerHTML='<span class="sp" style="border-color:rgba(255,255,255,.3);border-top-color:#fff"></span> กำลังสร้าง ZIP...';

    var content=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
    var a=document.createElement('a');
    a.href=URL.createObjectURL(content);
    a.download='โครงการ_พ.ศ.'+_projYear+'.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){URL.revokeObjectURL(a.href);},3000);
    showAlert('ดาวน์โหลดสำเร็จ — รวม '+fileCount+' ไฟล์','ok');
  }catch(e){
    showAlert('เกิดข้อผิดพลาด: '+(e.message||e),'er');
  }finally{
    if(btn){btn.disabled=false;btn.innerHTML=svg('doc',12)+' ดาวน์โหลดทุกไฟล์ (ZIP)';}
  }
}


/* ─── MY TASKS ─── */
async function vTodo(){
  var mySteps=await dg('workflow_steps','?assigned_to=eq.'+CU.id+'&status=eq.active&order=created_at');
  var html=[];

  if(!mySteps.length){
    html.push(
      '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 24px;text-align:center">'+
        '<div style="width:72px;height:72px;border-radius:22px;background:#F0FDF4;display:flex;align-items:center;justify-content:center;margin-bottom:20px;color:#16A34A">'+svg('ok',32)+'</div>'+
        '<div style="font-size:18px;font-weight:900;letter-spacing:-0.3px;color:#18120E;margin-bottom:8px">ทำงานครบหมดแล้ว!</div>'+
        '<div style="font-size:13px;color:#a89e99;max-width:280px;line-height:1.6">เมื่อมีเอกสารถูกมอบหมายให้คุณ จะปรากฏที่นี่</div>'+
      '</div>'
    );
    return html.join('');
  }

  var docIds=[...new Set(mySteps.map(function(s){return s.document_id}))];
  var docs=await dg('documents','?id=in.('+docIds.join(',')+')'+'&select=id,title,doc_type,urgency,due_date,status,doc_number,from_department,created_by,created_at');
  var docMap={};
  docs.forEach(function(d){docMap[d.id]=d});

  var todayMidnight=new Date(); todayMidnight.setHours(0,0,0,0);
  var overdue=[], todayList=[], soon=[], normal=[];
  mySteps.forEach(function(s){
    var d=docMap[s.document_id];
    if(!d) return;
    s._doc=d;
    if(d.due_date){
      var diff=new Date(d.due_date+'T00:00:00')-todayMidnight;
      var days=Math.round(diff/86400000);
      if(days<0) overdue.push(s);
      else if(days===0) todayList.push(s);
      else if(days<=3) soon.push(s);
      else normal.push(s);
    } else {
      normal.push(s);
    }
  });

  /* ── 4 stat cards — white neutral ── */
  var statCards=[
    {label:'งานทั้งหมด',   val:mySteps.length,   ico:'clip_f',  color:'#2563EB', bg:'#EFF6FF'},
    {label:'เลยกำหนด',    val:overdue.length,   ico:'warn_f',  color:'#DC2626', bg:'#FEF2F2'},
    {label:'ต้องทำวันนี้', val:todayList.length,  ico:'bell_f',  color:'#D97706', bg:'#FFFBEB'},
    {label:'ภายใน 3 วัน', val:soon.length,       ico:'cal_f',   color:'#7C3AED', bg:'#F5F3FF'}
  ];
  html.push('<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:28px">');
  statCards.forEach(function(c){
    html.push(
      '<div style="border-radius:16px;padding:16px 18px;background:#fff;border:1px solid #EBEBEB;box-shadow:0 1px 3px rgba(0,0,0,.05),0 4px 12px rgba(0,0,0,.06)" '+
      'onmouseover="this.style.background=\'#FDFBF9\'" '+
      'onmouseout="this.style.background=\'#fff\'">'+
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">'+
          '<div style="font-size:11px;font-weight:600;color:#a89e99;letter-spacing:.2px">'+c.label+'</div>'+
          '<div style="width:32px;height:32px;border-radius:10px;background:'+c.bg+';display:flex;align-items:center;justify-content:center;color:'+c.color+'">'+svgf(c.ico,16)+'</div>'+
        '</div>'+
        '<div style="font-size:36px;font-weight:900;color:'+c.color+';line-height:1;letter-spacing:-2px;margin-bottom:5px">'+c.val+'</div>'+
      '</div>'
    );
  });
  html.push('</div>');

  /* ── renderGroup ── */
  function renderGroup(label, accentColor, bgColor, svgIco, steps){
    if(!steps.length) return '';
    var rows=steps.map(function(s,idx){
      var d=s._doc;
      var diff=d.due_date?new Date(d.due_date+'T00:00:00')-todayMidnight:null;
      var daysLeft=diff!==null?Math.ceil(diff/86400000):null;
      var daysTxt=daysLeft===null?'—':daysLeft<0?'เกิน '+Math.abs(daysLeft)+' วัน':daysLeft===0?'วันนี้':daysLeft===1?'พรุ่งนี้':'อีก '+daysLeft+' วัน';
      var dayColor=daysLeft===null?'var(--text-3)':daysLeft<0?'#DC2626':daysLeft<=1?'#EA580C':daysLeft<=3?'#D97706':'#15803D';
      var dayBg=daysLeft===null?'var(--border)':daysLeft<0?'#FEF2F2':daysLeft<=1?'#FFF7ED':daysLeft<=3?'#FFFBEB':'#F0FDF4';
      return '<div style="display:flex;align-items:center;gap:14px;padding:14px 20px;cursor:pointer;transition:background 120ms'+(idx>0?';border-top:1px solid #F5F3F0':'')+'" '+
        'onclick="nav(\'det\',\''+d.id+'\')" '+
        'onmouseover="this.style.background=\'#FDFBF9\'" onmouseout="this.style.background=\'\'">'+
          '<div style="width:3px;height:38px;border-radius:2px;flex-shrink:0;background:'+accentColor+'"></div>'+
          '<span class="mono" style="font-size:11px;flex-shrink:0;min-width:88px">'+esc(d.doc_number||'—')+'</span>'+
          '<div style="flex:1;min-width:0">'+
            '<div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:3px">'+esc(d.title)+'</div>'+
            '<div style="display:flex;align-items:center;gap:6px">'+
              tBadge(d.doc_type)+
              '<span style="font-size:11px;background:#fff5f0;color:#E83A00;padding:2px 8px;border-radius:6px;font-weight:600">'+esc(s.step_name||'ขั้นตอน')+'</span>'+
            '</div>'+
          '</div>'+
          '<span style="border-radius:8px;padding:4px 10px;font-size:11px;font-weight:700;white-space:nowrap;flex-shrink:0;background:'+dayBg+';color:'+dayColor+'">'+daysTxt+'</span>'+
          '<button class="btn btn-primary xs" style="flex-shrink:0" data-action="nav" data-view="det" data-id="'+d.id+'">ดำเนินการ</button>'+
        '</div>';
    }).join('');

    return '<div style="margin-bottom:20px">'+
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">'+
        '<div style="width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:'+bgColor+';color:'+accentColor+'">'+svg(svgIco,13)+'</div>'+
        '<span style="font-size:13px;font-weight:700;color:'+accentColor+'">'+label+'</span>'+
        '<span style="background:#EBEBEB;border-radius:10px;padding:2px 9px;font-size:11px;color:#a89e99;font-weight:600">'+steps.length+' งาน</span>'+
      '</div>'+
      '<div style="background:#fff;border-radius:16px;border:1px solid rgba(0,0,0,.055);overflow:hidden;box-shadow:var(--sh-card)">'+rows+'</div>'+
      '</div>';
  }

  html.push(renderGroup('เลยกำหนดแล้ว',  '#DC2626','#FEF2F2','x',     overdue));
  html.push(renderGroup('ต้องทำวันนี้',   '#EA580C','#FFF7ED','bell',  todayList));
  html.push(renderGroup('ภายใน 3 วัน',   '#D97706','#FFFBEB','doc',   soon));
  html.push(renderGroup('งานอื่น ๆ',     'var(--text-2)','var(--border)','ok', normal));

  return html.join('');
}
