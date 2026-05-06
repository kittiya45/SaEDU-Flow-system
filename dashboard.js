/* ─── CALENDAR STATE ─── */
var _calY=new Date().getFullYear();
var _calM=new Date().getMonth();
var _calSel='';
var _calDocs=[];
var _calEvts=[];
var _calAddMode=false;

async function _loadEvtsDB(){
  _calEvts=await dg('calendar_events','?order=date')
}
function _calNav(dir){
  _calM+=dir;
  if(_calM>11){_calM=0;_calY++}
  if(_calM<0){_calM=11;_calY--}
  _calSel=''; _calAddMode=false; _renderCal()
}
function _calPick(d){
  _calSel=_calSel===d?'':d; _calAddMode=false; _renderCal()
}
function _calAddToggle(){
  _calAddMode=!_calAddMode; _renderCal();
  if(_calAddMode) setTimeout(function(){var i=$e('cal-inp');if(i)i.focus()},50)
}
async function _calSaveEvt(){
  var ti=$e('cal-inp'), da=$e('cal-date');
  if(!ti||!ti.value.trim()) return;
  var date=da&&da.value?da.value:(_calSel||new Date().toISOString().substring(0,10));
  await dp('calendar_events',{date:date,title:ti.value.trim(),color:'#3B82F6',created_by:CU.id});
  if(!_calSel) _calSel=date;
  _calAddMode=false;
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
    eMap[e.date].push({type:'cust',title:e.title,eid:e.id})
  });
  var firstDay=new Date(yr,mo,1).getDay();
  var dim=new Date(yr,mo+1,0).getDate();
  var h=[];

  /* card */
  h.push('<div style="background:#fff;border-radius:16px;border:1px solid rgba(0,0,0,.055);overflow:hidden;box-shadow:var(--sh-card)">');

  /* header */
  h.push(
    '<div style="padding:14px 18px;border-bottom:1px solid #EBEBEB;display:flex;align-items:center;justify-content:space-between">'+
    '<div style="display:flex;align-items:center;gap:8px">'+
      '<div style="width:26px;height:26px;border-radius:7px;background:#fff5f0;display:flex;align-items:center;justify-content:center;color:#E83A00">'+svg('cal',13)+'</div>'+
      '<span style="font-size:13px;font-weight:700">ปฏิทิน</span>'+
    '</div>'+
    '<button onclick="_calAddToggle()" style="background:'+(_calAddMode?'#6b6560':'#E83A00')+';color:#fff;border:none;border-radius:8px;padding:5px 11px;font-size:11px;font-weight:700;cursor:pointer">'+(_calAddMode?'ยกเลิก':'+ เพิ่มกิจกรรม')+'</button>'+
    '</div>'
  );

  /* add form */
  if(_calAddMode){
    var defDate=_calSel||todayStr;
    h.push(
      '<div style="padding:12px 18px;background:#FDFBF9;border-bottom:1px solid #EBEBEB">'+
      '<div style="font-size:11px;font-weight:700;color:#6b6560;margin-bottom:8px">เพิ่มกิจกรรมใหม่</div>'+
      '<input id="cal-inp" type="text" placeholder="ชื่อกิจกรรม..." '+
        'style="width:100%;box-sizing:border-box;border:1px solid #EBEBEB;border-radius:8px;padding:8px 10px;font-size:12px;outline:none;margin-bottom:7px" '+
        'onkeydown="if(event.key===\'Enter\')_calSaveEvt()">'+
      '<div style="display:flex;gap:8px">'+
        '<input id="cal-date" type="date" value="'+defDate+'" style="flex:1;min-width:0;border:1px solid #EBEBEB;border-radius:8px;padding:7px 10px;font-size:12px;outline:none">'+
        '<button onclick="_calSaveEvt()" style="background:#E83A00;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap">บันทึก</button>'+
      '</div>'+
      '</div>'
    );
  }

  /* month nav */
  h.push(
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 18px 6px">'+
    '<button onclick="_calNav(-1)" style="background:none;border:1px solid #EBEBEB;border-radius:8px;width:28px;height:28px;cursor:pointer;color:#6b6560;font-size:16px;display:flex;align-items:center;justify-content:center">‹</button>'+
    '<span style="font-size:13px;font-weight:700;color:#18120E">'+MTHS[mo]+' '+(yr+543)+'</span>'+
    '<button onclick="_calNav(1)" style="background:none;border:1px solid #EBEBEB;border-radius:8px;width:28px;height:28px;cursor:pointer;color:#6b6560;font-size:16px;display:flex;align-items:center;justify-content:center">›</button>'+
    '</div>'
  );

  /* day headers */
  h.push('<div style="display:grid;grid-template-columns:repeat(7,1fr);padding:0 12px 2px">');
  DAYS.forEach(function(d,i){
    h.push('<div style="text-align:center;font-size:10px;font-weight:600;padding:3px 0;color:'+(i===0||i===6?'#E83A00':'#a89e99')+'">'+d+'</div>');
  });
  h.push('</div>');

  /* cells */
  h.push('<div style="display:grid;grid-template-columns:repeat(7,1fr);padding:0 10px 10px;gap:1px">');
  for(var i=0;i<firstDay;i++) h.push('<div></div>');
  for(var d=1;d<=dim;d++){
    var p=yr+'-'+(mo+1<10?'0':'')+(mo+1)+'-'+(d<10?'0':'')+d;
    var isTod=p===todayStr, isSel=p===_calSel;
    var evts=eMap[p]||[];
    var hasDoc=evts.some(function(e){return e.type==='doc'});
    var hasCust=evts.some(function(e){return e.type==='cust'});
    var isWknd=(firstDay+d-1)%7===0||(firstDay+d-1)%7===6;
    var bg=isSel?'#E83A00':isTod?'#fff5f0':'transparent';
    var tc=isSel?'#fff':isTod?'#E83A00':isWknd?'#16A34A':'#18120E';
    h.push(
      '<div onclick="_calPick(\''+p+'\')" style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:5px 1px;border-radius:8px;cursor:pointer;background:'+bg+'" '+
      (!isSel?'onmouseover="this.style.background=\'#F5F3F0\'" onmouseout="this.style.background=\''+bg+'\'"':'')+'>'+
        '<span style="font-size:12px;font-weight:'+(isTod||isSel?'800':'400')+';color:'+tc+';line-height:1.2">'+d+'</span>'+
        '<div style="display:flex;gap:2px;height:5px;align-items:center;margin-top:1px">'+
          (hasDoc?'<div style="width:4px;height:4px;border-radius:50%;background:'+(isSel?'rgba(255,255,255,.85)':'#E83A00')+'"></div>':'')+
          (hasCust?'<div style="width:4px;height:4px;border-radius:50%;background:'+(isSel?'rgba(255,255,255,.65)':'#3B82F6')+'"></div>':'')+
        '</div>'+
      '</div>'
    );
  }
  h.push('</div>');

  /* legend */
  h.push(
    '<div style="padding:0 18px 12px;display:flex;gap:10px;flex-wrap:wrap">'+
    '<div style="display:flex;align-items:center;gap:4px"><div style="width:6px;height:6px;border-radius:50%;background:#E83A00"></div><span style="font-size:10px;color:#a89e99">กำหนดส่งเอกสาร</span></div>'+
    '<div style="display:flex;align-items:center;gap:4px"><div style="width:6px;height:6px;border-radius:50%;background:#3B82F6"></div><span style="font-size:10px;color:#a89e99">กิจกรรม</span></div>'+
    '</div>'
  );

  /* selected date panel */
  if(_calSel){
    var selEvts=eMap[_calSel]||[];
    h.push('<div style="border-top:1px solid #EBEBEB;padding:12px 18px">');
    var selD=new Date(_calSel+'T12:00:00');
    h.push('<div style="font-size:11px;font-weight:700;color:#6b6560;margin-bottom:8px">'+selD.toLocaleDateString('th-TH',{weekday:'long',day:'numeric',month:'long',year:'numeric'})+'</div>');
    if(!selEvts.length){
      h.push('<div style="font-size:11px;color:#a89e99;padding:6px 0">ไม่มีกิจกรรมในวันนี้ กด "+ เพิ่มกิจกรรม" เพื่อเพิ่ม</div>');
    } else {
      selEvts.forEach(function(e){
        if(e.type==='doc'){
          h.push(
            '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#fff5f0;border-radius:8px;margin-bottom:5px;cursor:pointer" '+
            'onclick="nav(\'det\',\''+e.id+'\')" onmouseover="this.style.opacity=\'.75\'" onmouseout="this.style.opacity=\'1\'">'+
              '<div style="width:6px;height:6px;border-radius:50%;background:#E83A00;flex-shrink:0"></div>'+
              '<div style="flex:1;min-width:0">'+
                '<div style="font-size:11px;font-weight:600;color:#18120E;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(e.title)+'</div>'+
                '<div style="font-size:10px;color:#a89e99;margin-top:2px;display:flex;align-items:center;gap:4px">'+esc(e.num)+' · '+sBadge(e.status)+'</div>'+
              '</div>'+
              '<span style="color:#a89e99;font-size:13px;flex-shrink:0">›</span>'+
            '</div>'
          );
        } else {
          h.push(
            '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#EFF6FF;border-radius:8px;margin-bottom:5px">'+
              '<div style="width:6px;height:6px;border-radius:50%;background:#3B82F6;flex-shrink:0"></div>'+
              '<div style="flex:1;min-width:0;font-size:11px;font-weight:600;color:#18120E;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(e.title)+'</div>'+
              '<button onclick="_calDelEvt(\''+e.eid+'\')" style="background:none;border:none;color:#a89e99;cursor:pointer;padding:2px;line-height:1;flex-shrink:0;display:inline-flex;align-items:center" title="ลบ">'+svg('x',14)+'</button>'+
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
  var _allD2=await dg('documents','?order=created_at.desc');
  var _mySteps2=await dg('workflow_steps','?assigned_to=eq.'+CU.id+'&select=document_id,status');
  var _myIds2=_mySteps2.map(function(s){return s.document_id});
  var _myActive=_mySteps2.filter(function(s){return s.status==='active'}).length;
  var _canSeeAll=CU.role_code==='ROLE-SYS'||CU.position_code==='GNK-SEC';
  var docs=_canSeeAll?_allD2:_allD2.filter(function(d){return d.created_by===CU.id||_myIds2.indexOf(d.id)!==-1});

  var cnt={total:docs.length,pnd:0,cplt:0,rej:0,draft:0};
  docs.forEach(function(d){
    if(d.status==='pending') cnt.pnd++;
    else if(d.status==='completed'||d.status==='signed') cnt.cplt++;
    else if(d.status==='rejected') cnt.rej++;
    else if(d.status==='draft') cnt.draft++;
  });

  var hr=new Date().getHours();
  var greet=hr<12?'Good Morning':'Good Afternoon';
  if(hr>=17) greet='Good Evening';
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

  // ── 4 Stat cards ──
  var cards=[
    {label:'เอกสารทั้งหมด', val:cnt.total, sub:'ร่าง '+cnt.draft+' · ส่งคืน '+cnt.rej,   ico:'doc_f',
     grad:'linear-gradient(135deg,#1D4ED8 0%,#3B82F6 100%)', shadow:'rgba(29,78,216,.30)'},
    {label:'รอลงนาม',        val:cnt.pnd,   sub:'รอการอนุมัติจากผู้รับผิดชอบ',             ico:'pen_f',
     grad:'linear-gradient(135deg,#D97706 0%,#F59E0B 100%)', shadow:'rgba(217,119,6,.30)'},
    {label:'เสร็จสิ้นแล้ว', val:cnt.cplt,  sub:'ผ่านทุกขั้นตอนเรียบร้อย',               ico:'check_f',
     grad:'linear-gradient(135deg,#15803D 0%,#22C55E 100%)', shadow:'rgba(21,128,61,.30)'},
    {label:'งานรอฉัน',       val:_myActive, sub:'ขั้นตอนที่ต้องดำเนินการ',               ico:'bell_f',
     grad:'linear-gradient(135deg,#7C3AED 0%,#A855F7 100%)', shadow:'rgba(124,58,237,.30)'}
  ];

  html.push('<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:28px">');
  cards.forEach(function(c){
    html.push(
      '<div style="border-radius:16px;padding:16px 18px;background:'+c.grad+';position:relative;overflow:hidden;box-shadow:0 4px 16px '+c.shadow+';cursor:default;transition:transform .18s,box-shadow .18s" '+
      'onmouseover="this.style.transform=\'translateY(-3px)\';this.style.boxShadow=\'0 10px 28px '+c.shadow+'\'" '+
      'onmouseout="this.style.transform=\'\';this.style.boxShadow=\'0 4px 16px '+c.shadow+'\'">'+
      '<div style="position:absolute;right:-16px;bottom:-16px;width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,.1);pointer-events:none"></div>'+
      '<div style="position:absolute;right:20px;top:-20px;width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,.07);pointer-events:none"></div>'+
      '<div style="position:relative;z-index:1">'+
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">'+
          '<div style="font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:rgba(255,255,255,.7)">'+c.label+'</div>'+
          '<div style="width:32px;height:32px;border-radius:10px;background:rgba(255,255,255,.2);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.15),inset 0 1px 0 rgba(255,255,255,.35);color:#fff">'+svgf(c.ico,16)+'</div>'+
        '</div>'+
        '<div style="font-size:32px;font-weight:900;color:#fff;line-height:1;letter-spacing:-1.5px;margin-bottom:5px">'+c.val+'</div>'+
        '<div style="font-size:10px;color:rgba(255,255,255,.65)">'+c.sub+'</div>'+
      '</div>'+
      '</div>'
    );
  });
  html.push('</div>');

  /* ── Main 2-col grid ── */

  html.push('<div style="display:grid;grid-template-columns:1fr 320px;gap:20px;align-items:start">');

  /* ── LEFT: Recent docs ── */
  html.push('<div style="min-width:0">');
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
  html.push('<div style="background:#fff;border-radius:16px;border:1px solid rgba(0,0,0,.055);overflow:hidden;box-shadow:var(--sh-card)">');
  if(recent.length){
    recent.forEach(function(d,idx){
      var isMyTask=_myIds2.indexOf(d.id)!==-1;
      html.push(
        '<div style="display:flex;align-items:center;gap:14px;padding:14px 20px;cursor:pointer;transition:background 120ms'+(idx>0?';border-top:1px solid #F5F3F0':'')+'" '+
        'onclick="nav(\'det\',\''+d.id+'\')" '+
        'onmouseover="this.style.background=\'#FDFBF9\'" onmouseout="this.style.background=\'\'">'+
          '<div style="width:3px;height:36px;border-radius:2px;flex-shrink:0;background:'+(isMyTask?'#E83A00':'transparent')+'"></div>'+
          '<span class="mono" style="font-size:11px;flex-shrink:0;min-width:88px">'+esc(d.doc_number||'—')+'</span>'+
          '<div style="flex:1;min-width:0">'+
            '<div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:3px">'+esc(d.title)+'</div>'+
            '<div>'+tBadge(d.doc_type)+'</div>'+
          '</div>'+
          '<div style="flex-shrink:0">'+sBadge(d.status)+'</div>'+
          '<div style="font-size:12px;color:#a89e99;white-space:nowrap;flex-shrink:0;min-width:72px;text-align:right">'+fd(d.created_at)+'</div>'+
          '<button style="width:30px;height:30px;border-radius:8px;border:2px solid #3b82f6;background:#eff6ff;color:#3b82f6;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0" data-action="nav" data-view="det" data-id="'+d.id+'">'+svg('eye',13)+'</button>'+
        '</div>'
      );
    });
  } else {
    html.push(
      '<div style="padding:64px 24px;text-align:center">'+
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

  return html.join('');
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

  /* ── 4 stat cards ── */
  var statCards=[
    {label:'งานทั้งหมด',   val:mySteps.length,   ico:'clip_f',  grad:'linear-gradient(135deg,#1D4ED8,#3B82F6)', shadow:'rgba(29,78,216,.28)'},
    {label:'เลยกำหนด',    val:overdue.length,   ico:'warn_f',  grad:'linear-gradient(135deg,#DC2626,#EF4444)', shadow:'rgba(220,38,38,.28)'},
    {label:'ต้องทำวันนี้', val:todayList.length,  ico:'bell_f',  grad:'linear-gradient(135deg,#D97706,#F59E0B)', shadow:'rgba(217,119,6,.28)'},
    {label:'ภายใน 3 วัน', val:soon.length,      ico:'cal_f',   grad:'linear-gradient(135deg,#7C3AED,#A855F7)', shadow:'rgba(124,58,237,.28)'}
  ];
  html.push('<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:28px">');
  statCards.forEach(function(c){
    html.push(
      '<div style="border-radius:18px;padding:22px;background:'+c.grad+';position:relative;overflow:hidden;box-shadow:0 8px 24px '+c.shadow+';cursor:default;transition:transform .2s,box-shadow .2s" '+
      'onmouseover="this.style.transform=\'translateY(-3px)\';this.style.boxShadow=\'0 16px 40px '+c.shadow+'\'" '+
      'onmouseout="this.style.transform=\'\';this.style.boxShadow=\'0 8px 24px '+c.shadow+'\'">'+
        '<div style="position:absolute;right:-20px;bottom:-20px;width:90px;height:90px;border-radius:50%;background:rgba(255,255,255,.1);pointer-events:none"></div>'+
        '<div style="position:relative;z-index:1">'+
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">'+
            '<div style="font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:rgba(255,255,255,.7)">'+c.label+'</div>'+
            '<div style="width:38px;height:38px;border-radius:12px;background:rgba(255,255,255,.2);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.35);color:#fff">'+svgf(c.ico,20)+'</div>'+
          '</div>'+
          '<div style="font-size:44px;font-weight:900;color:#fff;line-height:1;letter-spacing:-2.5px;margin-bottom:8px">'+c.val+'</div>'+
        '</div>'+
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
