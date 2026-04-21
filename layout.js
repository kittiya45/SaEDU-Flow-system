/* ─── MAIN LAYOUT ─── */

var _ROLE_GRAD = {
  'ROLE-SYS': 'linear-gradient(135deg,#18120E,#3D1A0A)',
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
      var pr = await dg('documents', '?status=eq.pending&select=id');
      PC = pr.length || 0;
    } else {
      var results = await Promise.all([
        dg('documents',      '?status=eq.pending&select=id,created_by'),
        dg('workflow_steps', '?assigned_to=eq.'+CU.id+'&select=document_id')
      ]);
      var psIds = results[1].map(function(s){ return s.document_id; });
      PC = results[0].filter(function(d){ return d.created_by===CU.id || psIds.indexOf(d.id)!==-1; }).length || 0;
    }
  } catch(e) { PC = 0; }

  try {
    var ms = await dg('workflow_steps', '?assigned_to=eq.'+CU.id+'&status=eq.active&select=id');
    activeSteps = ms.length || 0;
  } catch(e) {}

  var content = '';
  try {
    if      (view==='dash')               content = await vDash();
    else if (view==='docs')               content = await vDocs();
    else if (view==='todo')               content = await vTodo();
    else if (view==='new'||view==='edit') content = await vForm(id);
    else if (view==='det')                content = await vDet(id);
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
    adm:'จัดการผู้ใช้งาน', sys:'จัดการระบบ', stat:'สถิติ & รายงาน'
  };

  var ni = [
    {k:'dash', i:'home', l:'ภาพรวม'},
    {k:'todo', i:'tasks', l:'งานของฉัน', b: activeSteps || null},
    {k:'docs', i:'doc',  l:'เอกสาร',    b: PC || null}
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
      '</header>' +
      '<main class="flex-1 p-7 overflow-y-auto max-[900px]:p-5 max-[600px]:p-4">'+content+'</main>' +
    '</div>' +

    '<div id="mwrap"></div>' +
    '</div>'
  );
} 