/* ─── NOTIFICATION BELL ─── */
function _buildNotifBell(activeSteps, pendingCount){
  var total=(activeSteps||0)+(pendingCount||0);
  // Badge แสดงเฉพาะ activeSteps (งานที่ต้องดำเนินการจริง) ไม่รวม pendingCount ที่เป็นแค่รอคนอื่น
  var badgeNum=activeSteps||0;
  var badge=badgeNum>0?'<span style="position:absolute;top:-3px;right:-3px;background:#E83A00;color:#fff;font-size:9px;font-weight:800;border-radius:99px;padding:1px 4px;min-width:14px;text-align:center;line-height:14px;border:1.5px solid #fff">'+Math.min(badgeNum,99)+'</span>':'';
  return '<div style="position:relative;display:inline-block">' +
    '<button id="notif-btn" onclick="_toggleNotifPanel()" style="width:36px;height:36px;border-radius:10px;border:1.5px solid #EBEBEB;background:'+(badgeNum>0?'#FFF5F0':'#F9F9F9')+';display:flex;align-items:center;justify-content:center;cursor:pointer;color:'+(badgeNum>0?'#E83A00':'#a89e99')+';transition:all .15s" title="การแจ้งเตือน">' +
      svg('bell',16)+badge+
    '</button>' +
    '<div id="notif-panel" style="display:none;position:absolute;top:calc(100% + 8px);right:0;width:300px;background:#fff;border-radius:14px;border:1px solid #EBEBEB;box-shadow:0 8px 32px rgba(0,0,0,.12);z-index:9999;overflow:hidden">' +
      '<div style="padding:12px 16px;border-bottom:1px solid #F0F0F0;display:flex;align-items:center;justify-content:space-between">' +
        '<span style="font-size:13px;font-weight:700;color:#18120E">การแจ้งเตือน</span>' +
        (total>0?'<span style="background:#E83A00;color:#fff;font-size:10px;font-weight:700;border-radius:99px;padding:1px 7px">'+total+'</span>':'<span style="font-size:11px;color:#a89e99">ไม่มีงานค้างอยู่</span>') +
      '</div>' +
      '<div style="max-height:280px;overflow-y:auto">' +
        (activeSteps>0?'<div style="padding:10px 16px;display:flex;align-items:center;gap:10px;cursor:pointer;transition:background .12s" onmouseover="this.style.background=\'#FAFAFA\'" onmouseout="this.style.background=\'\'" onclick="_closeNotifPanel();nav(\'todo\')">' +
          '<div style="width:32px;height:32px;border-radius:9px;background:#FFF0EB;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#E83A00">'+svg('tasks',14)+'</div>' +
          '<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:600;color:#18120E">งานรอคุณอยู่ <strong style="color:#E83A00">'+activeSteps+' รายการ</strong></div><div style="font-size:10px;color:#a89e99;margin-top:2px">ขั้นตอนที่รอการดำเนินการของคุณ</div></div>' +
          '<span style="color:#a89e99;font-size:14px">›</span>'+
        '</div>':'') +
        (pendingCount>0?'<div style="padding:10px 16px;display:flex;align-items:center;gap:10px;cursor:pointer;transition:background .12s" onmouseover="this.style.background=\'#FAFAFA\'" onmouseout="this.style.background=\'\'" onclick="_closeNotifPanel();nav(\'docs\')">' +
          '<div style="width:32px;height:32px;border-radius:9px;background:#EFF6FF;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#2563EB">'+svg('doc',14)+'</div>' +
          '<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:600;color:#18120E">เอกสารรออยู่ <strong style="color:#2563EB">'+pendingCount+' ฉบับ</strong></div><div style="font-size:10px;color:#a89e99;margin-top:2px">รอดำเนินการหรือรอรับเอกสาร</div></div>' +
          '<span style="color:#a89e99;font-size:14px">›</span>'+
        '</div>':'') +
        (total===0?'<div style="padding:32px 16px;text-align:center;color:#a89e99;font-size:12px">ทุกอย่างเรียบร้อยดี ✓</div>':'') +
      '</div>' +
    '</div>' +
  '</div>';
}
function _toggleNotifPanel(){
  var p=$e('notif-panel');
  if(!p) return;
  var show=p.style.display==='none';
  p.style.display=show?'block':'none';
  if(show){
    setTimeout(function(){
      document.addEventListener('click',function _nc(e){
        var btn=$e('notif-btn'), panel=$e('notif-panel');
        if(btn&&!btn.contains(e.target)&&panel&&!panel.contains(e.target)){
          panel.style.display='none';
          document.removeEventListener('click',_nc,true);
        }
      },true);
    },10);
  }
}
function _closeNotifPanel(){var p=$e('notif-panel');if(p)p.style.display='none';}

/* ─── MOBILE BOTTOM NAV ─── */
/* [UX] แสดงเฉพาะบน viewport < 600px แทน sidebar ที่ซ่อนไป */
function _buildMobileNav(view, activeSteps, pendingCount, navItems){
  // แสดงแค่ 5 items สำคัญ: ภาพรวม, งานของฉัน, เอกสาร, สร้าง, โปรไฟล์
  var items=[
    {k:'dash', i:'home',  l:'ภาพรวม',    b:null},
    {k:'todo', i:'tasks', l:'งานของฉัน', b:activeSteps||null},
    {k:'docs', i:'doc',   l:'เอกสาร',    b:pendingCount||null}
  ];
  if(CAN&&CAN.cr&&CU&&CAN.cr(CU.role_code)) items.push({k:'new',i:'plus',l:'สร้าง',b:null});
  // slot สุดท้าย: "เพิ่มเติม" เพื่อเปิด sidebar overlay
  items.push({k:'_more',i:'dots',l:'เพิ่มเติม',b:null});

  return items.map(function(n){
    var isAct=view===n.k;
    var color=isAct?'#E83A00':'#a89e99';
    var badgeHtml=n.b?'<span style="position:absolute;top:2px;right:8px;background:#E83A00;color:#fff;font-size:9px;font-weight:700;border-radius:99px;padding:1px 5px;min-width:16px;text-align:center">'+n.b+'</span>':'';
    if(n.k==='_more'){
      return '<button class="mob-nav-item" onclick="_openMobileMenu()" style="color:'+color+'">'+
        '<span style="position:relative;display:inline-block">'+svg(n.i,20)+'</span>'+
        '<span class="mob-nav-label">'+n.l+'</span>'+
      '</button>';
    }
    return '<button class="mob-nav-item'+(isAct?' mob-nav-active':'')+'" data-action="nav" data-view="'+n.k+'" style="color:'+color+'">'+
      '<span style="position:relative;display:inline-block">'+svg(n.i,20)+badgeHtml+'</span>'+
      '<span class="mob-nav-label">'+n.l+'</span>'+
    '</button>';
  }).join('');
}

/* เปิด sidebar ในรูปแบบ overlay บน mobile */
function _openMobileMenu(){
  var sb=document.getElementById('sidebar');
  if(!sb) return;
  sb.classList.add('mobile-open');
  // backdrop
  var bd=document.createElement('div');
  bd.id='mob-backdrop';
  bd.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:99;backdrop-filter:blur(2px)';
  bd.onclick=function(){sb.classList.remove('mobile-open');bd.remove();};
  document.body.appendChild(bd);
}

/* ─── MAIN LAYOUT ─── */

var _ROLE_GRAD = {
  'ROLE-SYS': 'linear-gradient(135deg,#3D1A0A,#6B3320)',
  'ROLE-SGN': 'linear-gradient(135deg,#C42800,#E83A00)',
  'ROLE-REV': 'linear-gradient(135deg,#B45309,#D97706)',
  'ROLE-ADV': 'linear-gradient(135deg,#6D28D9,#7C3AED)',
  'ROLE-STF': 'linear-gradient(135deg,#0369A1,#0891B2)',
  'ROLE-CRT': 'linear-gradient(135deg,#1D4ED8,#2563EB)'
};
var _ROLE_DOT = {
  'ROLE-SYS':'#F59E0B','ROLE-SGN':'#E83A00','ROLE-REV':'#D97706',
  'ROLE-CRT':'#3B82F6','ROLE-STF':'#06B6D4','ROLE-ADV':'#A855F7'
};

function _navItem(n, active) {
  var cls = 'flex items-center gap-3 px-3 py-[10px] mb-1.5 rounded-xl text-[13px] cursor-pointer transition-all duration-150 relative' +
    (active ? ' font-bold' : ' font-medium hover:bg-[#F5F3F0]');
  var activeBg = active ? 'background:#FFF0EB;' : '';
  return '<div class="'+cls+'" data-action="nav" data-view="'+n.k+'" style="'+activeBg+'">' +
    (active ? '<span style="position:absolute;left:0;top:20%;bottom:20%;width:3px;border-radius:0 3px 3px 0;background:#E83A00"></span>' : '') +
    '<div class="w-[18px] h-[18px] flex items-center justify-center shrink-0" style="color:'+(active?'#E83A00':'#a89e99')+'">'+svg(n.i,16)+'</div>' +
    '<span class="flex-1 max-[900px]:hidden" style="color:'+(active?'#E83A00':'#6b6560')+'">'+esc(n.l)+'</span>' +
    (n.b ? '<span class="text-[10px] font-bold rounded-full px-1.5 py-px max-[900px]:hidden" style="background:#E83A00;color:#fff">'+n.b+'</span>' : '') +
    '</div>';
}

function _userFooter() {
  var grad = _ROLE_GRAD[CU.role_code] || 'linear-gradient(135deg,#1D4ED8,#2563EB)';
  var dot  = _ROLE_DOT[CU.role_code]  || '#a89e99';
  var personSVG = '<svg width="18" height="18" viewBox="0 0 16 16" fill="none">' +
    '<circle cx="8" cy="5.5" r="2.8" fill="rgba(255,255,255,0.95)"/>' +
    '<path d="M2.5 15c0-3.04 2.46-5.5 5.5-5.5s5.5 2.46 5.5 5.5" fill="rgba(255,255,255,0.85)" stroke="none"/>' +
    '</svg>';
  return '<div class="px-2.5 py-3.5 border-t border-[#EBEBEB] flex items-center gap-2.5 mt-auto max-[900px]:flex-col max-[900px]:items-center max-[900px]:gap-2 max-[900px]:px-0 max-[900px]:py-2.5">' +
    '<div style="position:relative;width:34px;height:34px;flex-shrink:0">' +
      '<div style="width:34px;height:34px;border-radius:50%;background:'+grad+';display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.18)">'+personSVG+'</div>' +
      '<span style="position:absolute;bottom:0;right:0;width:10px;height:10px;border-radius:50%;background:'+dot+';border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.2)"></span>' +
    '</div>' +
    '<div class="flex-1 min-w-0 max-[900px]:hidden">' +
      '<div class="text-xs font-bold truncate" style="color:#18120E">'+esc(CU.full_name)+'</div>' +
      '<div class="text-[10px] mt-px" style="color:#a89e99">'+(RTH[CU.role_code]||'')+'</div>' +
    '</div>' +
    '<button class="w-[30px] h-[30px] rounded-lg border-0 bg-[#F5F3F0] flex items-center justify-center cursor-pointer transition-all duration-150 shrink-0 ' +
'hover:bg-red-50 hover:text-red-500 ' +
'active:bg-red-600 active:text-white active:scale-95' +
'" style="color:#a89e99" data-action="logout" title="ออกจากระบบ">'+svg('out',15)+'</button>' +
  '</div>';
}

async function nav(view, id) {
  CV = view; CDI = id || null;

  var activeSteps = 0;
  try {
    if (CU.role_code === 'ROLE-SYS') {
      var pr = await dg('documents', '?status=in.(pending,rejected)&select=id');
      PC = pr.length || 0;
    } else {
      var results = await Promise.all([
        dg('documents',      '?status=in.(pending,rejected)&select=id,created_by'),
        dg('workflow_steps', '?assigned_to=eq.'+safeId(CU.id)+'&select=document_id'),
        dg('documents',      '?forwarded_to_id=eq.'+safeId(CU.id)+'&status=eq.completed&select=id&limit=99')
      ]);
      var psIds = results[1].map(function(s){ return s.document_id; });
      var pendCount = results[0].filter(function(d){ return d.created_by===CU.id || psIds.indexOf(d.id)!==-1; }).length || 0;
      var fwdDocs = results[2]; var fwdCount = 0;
      if(fwdDocs.length){
        var _actedHist=await dg('document_history',
          '?document_id=in.('+fwdDocs.map(function(d){return safeId(d.id)}).join(',')+')'
          +'&action=eq.เจ้าหน้าที่รับเอกสาร&performed_by=eq.'+safeId(CU.id)+'&select=document_id');
        var _actedIds=new Set((_actedHist||[]).map(function(h){return h.document_id}));
        fwdCount=fwdDocs.filter(function(d){return !_actedIds.has(d.id)}).length;
      }
      PC = pendCount + fwdCount;
    }
  } catch(e) { PC = 0; }

  try {
    var ms = await dg('workflow_steps', '?assigned_to=eq.'+safeId(CU.id)+'&status=eq.active&select=id');
    activeSteps = ms.length || 0;
  } catch(e) {}

  // ── ประกาศระบบ (ถ้ามี) ──
  var _annHtml='';
  if(SETT&&SETT.system_announcement){
    var _annCls=SETT.system_announcement_type==='error'?'al-er':SETT.system_announcement_type==='warning'?'al-wa':'al-ok';
    var _annIco=SETT.system_announcement_type==='error'?'warn':SETT.system_announcement_type==='warning'?'warn':'info';
    _annHtml='<div class="al '+_annCls+' mb-4" style="margin-bottom:16px"><span class="al-icon">'+svg(_annIco,14)+'</span><span>'+esc(SETT.system_announcement)+'</span></div>';
  }

  // แสดง loading state ทันทีก่อนดึงข้อมูล
  var _appEl = document.getElementById('app');
  if(_appEl){
    var _mainEl = _appEl.querySelector('main');
    if(_mainEl) _mainEl.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 24px;gap:14px;color:#a89e99"><span class="sp sp-dark" style="width:24px;height:24px;border-width:3px"></span><span style="font-size:13px">กำลังโหลด...</span></div>';
  }

  var content = '';
  try {
    if      (view==='dash')               content = await vDash();
    else if (view==='docs')               content = await vDocs();
    else if (view==='todo')               content = await vTodo();
    else if (view==='new'||view==='edit') content = await vForm(id);
    else if (view==='det')                content = await vDet(id);
    else if (view==='tmpl')               content = await vTmpl();
    else if (view==='adm')                content = await vAdm();
    else if (view==='sys')                content = await vSys();
    else if (view==='stat')               content = await vStat();
  } catch(e) {
    content = '<div style="padding:32px;color:#DC2626;font-size:14px">เกิดข้อผิดพลาด: '+esc(String(e.message||e))+'</div>';
  }

  var isAdm = CU.role_code === 'ROLE-SYS';
  var titles = {
    dash:'ภาพรวม', docs:'เอกสารทั้งหมด', todo:'งานของฉัน',
    new:'สร้างเอกสารใหม่', edit:'แก้ไขเอกสาร', det:'รายละเอียดเอกสาร',
    tmpl:'แบบฟอร์มดาวน์โหลด',
    adm:'จัดการผู้ใช้งาน', sys:'จัดการระบบ', stat:'สถิติ & รายงาน'
  };

  var ni = [
    {k:'dash', i:'home', l:'ภาพรวม'},
    {k:'todo', i:'tasks', l:'งานของฉัน', b: activeSteps || null},
    {k:'docs', i:'doc',  l:'เอกสาร',    b: PC || null},
    {k:'tmpl', i:'folder', l:'แบบฟอร์ม'}
  ];
  if (CAN.cr(CU.role_code))                  ni.push({k:'new',  i:'plus',  l:'สร้างเอกสาร'});
  if (isAdm || CU.role_code==='ROLE-STF')    ni.push({k:'stat', i:'chart', l:'สถิติ'});
  if (isAdm || CU.role_code==='ROLE-STF')    ni.push({k:'adm',  i:'users', l:'จัดการผู้ใช้'});
  if (isAdm)                                  ni.push({k:'sys',  i:'gear',  l:'จัดการระบบ'});

  var sidebarItems = ni.map(function(n){ return _navItem(n, CV===n.k); }).join('');

  rdr(
    '<div class="flex h-screen bg-[#F4F2EF] overflow-hidden">' +

    /* ── Sidebar ── */
    '<aside class="w-[240px] max-[900px]:w-16 max-[600px]:hidden shrink-0 bg-white border-r border-[#EBEBEB] flex flex-col sticky top-0 h-screen overflow-y-auto z-[100]">' +
      '<div class="flex items-center gap-[11px] px-[18px] py-5 pb-4 border-b border-[#EBEBEB] max-[900px]:justify-center max-[900px]:px-0 max-[900px]:py-4">' +
        '<div class="w-[38px] h-[38px] shrink-0 rounded-[10px] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.10)]">' +
          '<img src="img/logo.png" alt="Logo" class="w-full h-full object-cover">' +
        '</div>' +
        '<div class="max-[900px]:hidden">' +
          '<div class="text-sm font-black tracking-[-0.2px]" style="color:#18120E">SAEDU Flow</div>' +
          '<div class="text-[10px] mt-0.5" style="color:#a89e99">ระบบเสนอเอกสาร</div>' +
        '</div>' +
      '</div>' +
      '<div class="text-[10px] font-bold tracking-[0.8px] uppercase px-[18px] pt-5 pb-2 max-[900px]:hidden" style="color:#c0bab4">เมนูหลัก</div>' +
      '<nav class="flex flex-col px-2.5 flex-1 max-[900px]:px-2 pt-1">'+sidebarItems+'</nav>' +
      _userFooter() +
    '</aside>' +

    /* ── Main ── */
    '<div class="flex-1 flex flex-col min-w-0 overflow-hidden">' +
      '<header class="bg-white border-b border-[#EBEBEB] px-7 py-[14px] flex items-center justify-between shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">' +
        '<div>' +
          '<div class="text-lg font-black tracking-[-0.4px]" style="color:#E83A00">'+(titles[view]||view)+'</div>' +
          '<div class="text-[11px] text-[#a89e99] mt-0.5">ระบบเสนอเอกสารอิเล็กทรอนิกส์ กนค.</div>' +
        '</div>' +
        '<div class="flex items-center gap-2">' +
          _buildNotifBell(activeSteps, PC) +
          '<a href="manual.html" target="_blank" style="width:36px;height:36px;border-radius:10px;border:1.5px solid #EBEBEB;background:#F9F9F9;display:flex;align-items:center;justify-content:center;color:#a89e99;transition:all .15s;text-decoration:none" title="คู่มือการใช้งาน" onmouseover="this.style.background=\'#FFF5F0\';this.style.color=\'#E83A00\'" onmouseout="this.style.background=\'#F9F9F9\';this.style.color=\'#a89e99\'">'+svg('book',16)+'</a>' +
        '</div>' +
      '</header>' +
      '<main class="flex-1 p-7 overflow-y-auto max-[900px]:p-5 max-[600px]:p-4">'+_annHtml+content+'</main>' +
    '</div>' +

    '<div id="mwrap"></div>' +

    /* [UX] Mobile bottom navigation bar — แสดงเฉพาะบน viewport < 600px */
    '<nav class="mobile-bottom-nav" id="mobileNav">' +
      _buildMobileNav(view, activeSteps, PC, ni) +
    '</nav>' +

    '</div>'
  );
} 