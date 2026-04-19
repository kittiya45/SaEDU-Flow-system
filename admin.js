/* ─── ADMIN ─── */
async function vAdm(){
  AUSERS=await dg('users','?email=neq.admin&order=created_at.desc');
  var cnt={
    total:AUSERS.length,
    pnd:AUSERS.filter(function(u){return u.approval_status==='pending'}).length,
    apv:AUSERS.filter(function(u){return u.approval_status==='approved'}).length
  };
  var tc={all:AUSERS.length,pending:cnt.pnd,gnk:0,advisor:0,staff:0};
  AUSERS.forEach(function(u){if(tc[u.user_type]!==undefined)tc[u.user_type]++});

  var html=[];

  /* ── User stat cards ── */
  var uCards=[
    {
      label:'ผู้ใช้ทั้งหมด',
      val:cnt.total,
      sub:'กนค. '+tc.gnk+' · อาจารย์ '+tc.advisor+' · เจ้าหน้าที่ '+tc.staff,
      ico:'users_f',
      grad:'linear-gradient(135deg,#1D4ED8 0%,#3B82F6 100%)',
      shadow:'rgba(29,78,216,.30)'
    },
    {
      label:'อนุมัติแล้ว',
      val:cnt.apv,
      sub:'บัญชีที่ใช้งานได้แล้ว',
      ico:'check_f',
      grad:'linear-gradient(135deg,#15803D 0%,#22C55E 100%)',
      shadow:'rgba(21,128,61,.30)'
    },
    {
      label:'รอการอนุมัติ',
      val:cnt.pnd,
      sub:'กรุณาตรวจสอบและดำเนินการ',
      ico:'bell_f',
      grad:'linear-gradient(135deg,#7C3AED 0%,#A855F7 100%)',
      shadow:'rgba(124,58,237,.30)'
    }
  ];
  html.push('<div class="grid grid-cols-3 max-[600px]:grid-cols-1 gap-4 mb-5">');
  uCards.forEach(function(c){
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

  /* ── Doc number settings card (SYS only) ── */

  /* ── Pending warning ── */
  if(cnt.pnd>0){
    html.push(
      '<div class="flex items-center gap-3 px-4 py-3 rounded-[12px] border border-[#FDE68A] bg-[#FFFBEB] mb-5">'+
        '<div class="w-8 h-8 rounded-[10px] bg-[#FEF3C7] flex items-center justify-center text-[#D97706] shrink-0">'+svg('bell',15)+'</div>'+
        '<div class="flex-1 text-[13px] text-[#92400E]">มี <strong class="font-bold">'+cnt.pnd+' คน</strong> รอการอนุมัติบัญชีผู้ใช้งาน กรุณาตรวจสอบและดำเนินการ</div>'+
        '<button class="btn btn-warn xs shrink-0" data-action="setAT" data-tab="pending">ดูรายการ →</button>'+
      '</div>'
    );
  }

  /* ── Toolbar: search + buttons ── */
  var _canAddAdv=CU.role_code==='ROLE-SYS'||CU.role_code==='ROLE-STF';
  _admTab='all';
  html.push(
    '<div class="flex items-center gap-2.5 mb-3 flex-wrap">'+
      '<div class="search-wrap flex-1 min-w-[180px]">'+
        '<div class="search-icon">'+svg('srch',15)+'</div>'+
        '<input class="fi" id="asrch" placeholder="ค้นหาชื่อ, รหัสนิสิต, อีเมล, ตำแหน่ง..." oninput="setAS()" style="padding-left:38px;height:38px;font-size:13px">'+
      '</div>'+
      (_canAddAdv?
       
      '<button class="flex items-center gap-2 bg-[#FFB02E] hover:bg-[#F59E0B] text-white  px-4 py-1.5 rounded-lg font-bold text-sm transition-all shadow-sm shadow-amber-100 active:scale-95 shrink-0" data-action="showImport">' + 
  svg('dn', 14) + ' นำเข้า' + 
      '</button>' +
      '<button class="flex items-center gap-2 bg-[#D14D28] hover:bg-[#B53D1B] text-white px-4 py-1.5 rounded-lg font-bold text-sm transition-all shadow-sm shadow-orange-100 active:scale-95 shrink-0" data-action="showAddAdvisor">' + 
        svg('plus', 14) + ' เพิ่มอาจารย์' + 
      '</button>'
      :'')+
    '</div>'+
    '<div id="atabs" class="flex flex-wrap gap-1 mb-4">'+
    [['all','ทั้งหมด'],['pending','รอการอนุมัติ'],['gnk','กนค.'],['advisor','อาจารย์'],['staff','เจ้าหน้าที่']].map(function(x){
      return '<button class="ptab'+(x[0]==='all'?' on':'')+'" data-action="setAT" data-tab="'+x[0]+'">'+x[1]+
        ' <span class="ml-1 inline-block bg-[#EBEBEB] rounded-[10px] px-[7px] py-px text-[10px] text-[#a89e99] font-semibold">'+tc[x[0]]+'</span></button>';
    }).join('')+
    '</div>'
  );

  /* ── User table ── */
  html.push('<div class="card" id="atbl" style="margin-bottom:0">'+rAdmTbl(AUSERS)+'</div>');
  return html.join('');
}

function setAT(t){
  _admTab=t;
  document.querySelectorAll('#atabs .ptab').forEach(function(el){el.className='ptab'+(el.dataset.tab===t?' on':'')});
  applyAdmFilter();
}

function rAdmTbl(users){
  if(!users.length){
    return '<div class="py-14 text-center">'+
      '<div class="w-16 h-16 rounded-[20px] bg-[#F5F3F0] flex items-center justify-center mx-auto mb-4 text-[#a89e99]">'+svg('users',40)+'</div>'+
      '<div class="text-[14px] font-semibold text-[#6b6560]">ไม่มีผู้ใช้งานในหมวดนี้</div>'+
    '</div>';
  }

  function avGrad(ut,rc){
    if(rc==='ROLE-SYS') return 'linear-gradient(135deg,#18120E,#3D1A0A)';
    if(rc==='ROLE-SGN') return 'linear-gradient(135deg,#C42800,#E83A00)';
    if(rc==='ROLE-REV') return 'linear-gradient(135deg,#B45309,#D97706)';
    if(rc==='ROLE-ADV') return 'linear-gradient(135deg,#6D28D9,#7C3AED)';
    if(rc==='ROLE-STF') return 'linear-gradient(135deg,#0369A1,#0891B2)';
    if(rc==='ROLE-CRT') return 'linear-gradient(135deg,#1D4ED8,#2563EB)';
    if(ut==='gnk')    return 'linear-gradient(135deg,#C42800,#E83A00)';
    if(ut==='advisor')return 'linear-gradient(135deg,#6D28D9,#7C3AED)';
    return 'linear-gradient(135deg,#1D4ED8,#2563EB)';
  }
  function avDot(rc){
    var m={'ROLE-SYS':'#F59E0B','ROLE-SGN':'#E83A00','ROLE-REV':'#D97706','ROLE-CRT':'#3B82F6','ROLE-STF':'#06B6D4','ROLE-ADV':'#A855F7'};
    return m[rc]||'#a89e99';
  }
  function roleColor(rc){
    var m={'ROLE-SYS':'#F59E0B','ROLE-SGN':'#E83A00','ROLE-REV':'#D97706','ROLE-CRT':'#2563EB','ROLE-STF':'#0891B2','ROLE-ADV':'#7C3AED'};
    return m[rc]||'#a89e99';
  }
  var personSVG='<svg width="20" height="20" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5.5" r="2.8" fill="rgba(255,255,255,0.95)"/><path d="M2.5 15c0-3.04 2.46-5.5 5.5-5.5s5.5 2.46 5.5 5.5" fill="rgba(255,255,255,0.85)" stroke="none"/></svg>';

  var html=[
    '<div class="tbl-wrap"><table>',
    '<thead><tr>',
      '<th>ผู้ใช้งาน</th>',
      '<th>รหัส / อีเมล</th>',
      '<th>ประเภท</th>',
      '<th>ตำแหน่ง</th>',
      '<th>สถานะ</th>',
      '<th>สมัครเมื่อ</th>',
      '<th style="text-align:right">จัดการ</th>',
    '</tr></thead><tbody>'
  ];

  users.forEach(function(u){
    var apB=u.approval_status==='pending'
      ? '<span class="badge b-pending"><span class="bdot"></span>รอการอนุมัติ</span>'
      : u.approval_status==='approved'
        ? '<span class="badge b-signed"><span class="bdot"></span>อนุมัติแล้ว</span>'
        : '<span class="badge b-rejected"><span class="bdot"></span>ปฏิเสธ</span>';

    var activeRow='';
    if(u.approval_status==='approved'){
      activeRow=u.is_active
        ? '<span class="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-[#15803D]"><span class="w-1.5 h-1.5 rounded-full bg-[#15803D] inline-block"></span>ใช้งาน</span>'
        : '<span class="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-[#DC2626]"><span class="w-1.5 h-1.5 rounded-full bg-[#DC2626] inline-block"></span>ปิดบัญชี</span>';
    }

    var _isStaffOnly=CU.role_code==='ROLE-STF';
    var _advPending=_isStaffOnly&&u.user_type==='advisor'&&u.approval_status==='pending';
    var dropItems=[];
    if(!_advPending){
      if(u.approval_status==='pending'){
        dropItems.push('<button class="am-item am-ok" data-action="admApv" data-id="'+u.id+'">'+svg('ok',13)+' อนุมัติบัญชี</button>');
        dropItems.push('<button class="am-item am-danger" data-action="admRej" data-id="'+u.id+'">'+svg('x',13)+' ปฏิเสธบัญชี</button>');
      } else if(u.approval_status==='approved'){
        dropItems.push('<button class="am-item" data-action="showEU" data-id="'+u.id+'">'+svg('edit',13)+' แก้ไขข้อมูล</button>');
        if(u.is_active){
          dropItems.push('<button class="am-item" data-action="admToggle" data-id="'+u.id+'" data-active="1">'+svg('lock',13)+' ปิดบัญชี</button>');
        } else {
          dropItems.push('<button class="am-item am-ok" data-action="admToggle" data-id="'+u.id+'" data-active="0">'+svg('unlock',13)+' เปิดบัญชี</button>');
        }
        if(!_isStaffOnly){
          dropItems.push('<button class="am-item" data-action="admResetPw" data-id="'+u.id+'">'+svg('key',13)+' รีเซ็ตรหัสผ่าน</button>');
          dropItems.push('<div class="am-divider"></div>');
          dropItems.push('<button class="am-item am-danger" data-action="admDel" data-id="'+u.id+'">'+svg('trash',13)+' ลบผู้ใช้งาน</button>');
        }
      } else {
        if(!_isStaffOnly) dropItems.push('<button class="am-item am-danger" data-action="admDel" data-id="'+u.id+'">'+svg('trash',13)+' ลบผู้ใช้งาน</button>');
      }
    }
    var actB=_advPending
      ? '<span class="text-[11px] text-[#a89e99]">รอ Admin</span>'
      : dropItems.length
        ? '<div class="am-wrap"><button class="btn btn-soft xs btn-icon am-trig" onclick="toggleAM(\''+u.id+'\')" title="จัดการ">'+svg('dots',15)+'</button><div class="am-drop" id="amd-'+u.id+'">'+dropItems.join('')+'</div></div>'
        : '<span class="text-[11px] text-[#a89e99]">—</span>';

    html.push('<tr>');
    html.push(
      '<td>'+
        '<div class="flex items-center gap-3">'+
          '<div style="position:relative;width:40px;height:40px;flex-shrink:0">'+
            '<div style="width:40px;height:40px;border-radius:50%;background:'+avGrad(u.user_type,u.role_code)+';display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,0.18)">'+personSVG+'</div>'+
            '<span style="position:absolute;bottom:0;right:0;width:12px;height:12px;border-radius:50%;background:'+avDot(u.role_code)+';border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.18)"></span>'+
          '</div>'+
          '<div>'+
            '<div class="text-[13px] font-semibold text-[#18120E] leading-tight">'+esc(u.full_name)+'</div>'+
            '<div class="text-[11px] font-semibold mt-0.5" style="color:'+roleColor(u.role_code)+'">'+(RTH[u.role_code]||u.role_code||'—')+'</div>'+
          '</div>'+
        '</div>'+
      '</td>'
    );
    html.push('<td class="text-[12px] text-[#6b6560]" style="font-family:\'IBM Plex Mono\',monospace">'+esc(u.student_id||u.email||'—')+'</td>');
    html.push('<td><span class="badge b-'+(u.user_type||'staff')+'">'+(UTH[u.user_type]||u.user_type||'—')+'</span></td>');
    html.push('<td>'+(u.position_code?'<span class="mono">'+esc(u.position_code)+'</span>':'<span class="text-[#a89e99]">—</span>')+'</td>');
    html.push('<td><div class="flex flex-col gap-0.5">'+apB+activeRow+'</div></td>');
    html.push('<td class="text-[12px] text-[#a89e99] whitespace-nowrap">'+fd(u.created_at)+'</td>');
    html.push('<td><div class="flex gap-1.5 justify-end flex-wrap items-center">'+actB+'</div></td>');
    html.push('</tr>');
  });

  html.push('</tbody></table></div>');
  return html.join('');
}

async function admApv(uid){
  var u=(AUSERS||[]).filter(function(x){return x.id===uid})[0];
  if(CU.role_code==='ROLE-STF'&&u&&u.user_type==='advisor'){alert('เจ้าหน้าที่ไม่มีสิทธิ์อนุมัติอาจารย์');return}
  if(!confirm('อนุมัติผู้ใช้งานนี้?'))return;
  await dpa('users',uid,{approval_status:'approved',is_active:true,approved_at:new Date().toISOString()});
  try{await dp('document_history',{action:'อนุมัติบัญชีผู้ใช้',performed_by:CU.id,note:'อนุมัติ: '+(u?u.full_name:uid)});}catch(e){}
  nav('adm')
}
async function admRej(uid){
  var u=(AUSERS||[]).filter(function(x){return x.id===uid})[0];
  if(CU.role_code==='ROLE-STF'&&u&&u.user_type==='advisor'){alert('เจ้าหน้าที่ไม่มีสิทธิ์ปฏิเสธอาจารย์');return}
  var r=prompt('ระบุเหตุผลในการปฏิเสธ (ถ้ามี):');if(r===null)return;
  await dpa('users',uid,{approval_status:'rejected',is_active:false,reject_reason:r||''});
  try{await dp('document_history',{action:'ปฏิเสธบัญชีผู้ใช้',performed_by:CU.id,note:'ปฏิเสธ: '+(u?u.full_name:uid)+(r?' — เหตุผล: '+r:'')});}catch(e){}
  nav('adm')
}
async function admDel(uid){
  var u=(AUSERS||[]).filter(function(x){return x.id===uid})[0];
  if(!confirm('ลบผู้ใช้งานนี้?\n(ไม่สามารถเรียกคืนได้)'))return;
  var wf=[],dc=[],df=[];
  try{
    wf=await dg('workflow_steps','?assigned_to=eq.'+uid+'&select=id');
    dc=await dg('documents','?or=(created_by.eq.'+uid+',forwarded_to_id.eq.'+uid+',final_recipient_id.eq.'+uid+')&select=id,created_by,forwarded_to_id,final_recipient_id');
    df=await dg('document_files','?uploaded_by=eq.'+uid+'&select=id');
  }catch(e){}
  var hasDep=(wf&&wf.length)||(dc&&dc.length)||(df&&df.length);
  if(hasDep){
    var reason=[];
    if(wf&&wf.length) reason.push('Workflow Step '+wf.length+' รายการ');
    if(dc&&dc.length) reason.push('เอกสาร '+dc.length+' รายการ');
    if(df&&df.length) reason.push('ไฟล์เอกสาร '+df.length+' รายการ');
    var force=confirm(
      'ผู้ใช้นี้ยังมี '+reason.join(', ')+' ในระบบ\n\n'+
      'ต้องการลบแบบบังคับ?\n'+
      '• Workflow Steps จะถูกยกเลิกการมอบหมาย\n'+
      '• เอกสาร/ไฟล์จะยังคงอยู่ แต่ไม่มีเจ้าของ\n\n'+
      'กด OK เพื่อยืนยันการลบแบบบังคับ'
    );
    if(!force)return;
    try{
      if(wf&&wf.length){var rw=await fetch(SU+'/rest/v1/workflow_steps?assigned_to=eq.'+uid,{method:'PATCH',headers:H,body:JSON.stringify({assigned_to:null})});if(!rw.ok)throw new Error('ไม่สามารถ unlink workflow steps ได้')}
      if(dc&&dc.length){
        var hasCreated=dc.some(function(d){return d.created_by===uid});
        var hasForwarded=dc.some(function(d){return d.forwarded_to_id===uid});
        var hasFinal=dc.some(function(d){return d.final_recipient_id===uid});
        if(hasCreated){var r1=await fetch(SU+'/rest/v1/documents?created_by=eq.'+uid,{method:'PATCH',headers:H,body:JSON.stringify({created_by:null})});if(!r1.ok)throw new Error('ไม่สามารถ unlink created_by ได้')}
        if(hasForwarded){var r2=await fetch(SU+'/rest/v1/documents?forwarded_to_id=eq.'+uid,{method:'PATCH',headers:H,body:JSON.stringify({forwarded_to_id:null})});if(!r2.ok)throw new Error('ไม่สามารถ unlink forwarded_to_id ได้')}
        if(hasFinal){var r3=await fetch(SU+'/rest/v1/documents?final_recipient_id=eq.'+uid,{method:'PATCH',headers:H,body:JSON.stringify({final_recipient_id:null})});if(!r3.ok)throw new Error('ไม่สามารถ unlink final_recipient_id ได้')}
      }
      if(df&&df.length){var r4=await fetch(SU+'/rest/v1/document_files?uploaded_by=eq.'+uid,{method:'PATCH',headers:H,body:JSON.stringify({uploaded_by:null})});if(!r4.ok)throw new Error('ไม่สามารถ unlink document files ได้')}
    }catch(e){alert(e.message||String(e));return;}
  }
  try{await dp('document_history',{action:'ลบบัญชีผู้ใช้',performed_by:CU.id,note:'ลบ: '+(u?u.full_name+' ('+u.email+')':uid)});}catch(e){}
  try{
    await dd('users',uid);
    nav('adm');
  }catch(e){
    alert('ไม่สามารถลบผู้ใช้ได้\n'+(e.message||''));
  }
}

function showEU(uid){
  var u=AUSERS.filter(function(u){return u.id===uid})[0]; if(!u)return;
  var w=$e('mwrap'); if(!w)return;
  var po='<option value="">— ไม่มีตำแหน่ง —</option>'+POSS.map(function(p){return '<option value="'+p+'"'+(u.position_code===p?' selected':'')+'>'+p+' — '+PTH[p]+'</option>'}).join('');
  var ro=Object.entries(RTH).map(function(e){return '<option value="'+e[0]+'"'+(u.role_code===e[0]?' selected':'')+'>'+e[1]+' ('+e[0]+')</option>'}).join('');
  var html=[
    '<div class="mo"><div class="modal">',
    '<div class="modal-head"><span class="modal-title">'+svg('edit',14)+' แก้ไขข้อมูลผู้ใช้</span><button class="btn btn-soft sm btn-icon" data-action="closeModal">'+svg('x',14)+'</button></div>',
    '<div class="modal-body">',
    '<div class="fr"><div class="fg"><label class="fl">ชื่อ-นามสกุล</label><input class="fi" id="enm" value="'+esc(u.full_name)+'"></div>',
    '<div class="fg"><label class="fl">Role ในระบบ</label><select class="fi" id="erl">'+ro+'</select></div></div>',
    (u.user_type==='gnk'?'<div class="fg"><label class="fl">ตำแหน่งใน กนค.</label><select class="fi" id="epos">'+po+'</select></div>':''),
    '<div class="fg"><label class="fl">ฝ่าย / หน่วยงาน</label><input class="fi" id="edp" value="'+esc(u.department||'')+'"></div>',
    '</div>',
    '<div class="modal-foot"><button class="btn btn-soft" data-action="closeModal">ยกเลิก</button>',
    '<button class="btn btn-primary" data-action="saveEU" data-uid="'+uid+'" data-utype="'+u.user_type+'">บันทึกการเปลี่ยนแปลง</button></div>',
    '</div></div>'
  ];
  w.innerHTML=html.join('')
}

async function saveEU(uid,ut){
  var u=(AUSERS||[]).filter(function(x){return x.id===uid})[0];
  var b={full_name:gv('enm'),role_code:gv('erl'),department:gv('edp')};
  if(ut==='gnk') b.position_code=gv('epos')||null;
  await dpa('users',uid,b);
  try{await dp('document_history',{action:'แก้ไขข้อมูลผู้ใช้',performed_by:CU.id,note:'แก้ไข: '+(u?u.full_name:uid)+' → role='+b.role_code});}catch(e){}
  $e('mwrap').innerHTML=''; nav('adm')
}

async function admToggle(uid, isActive){
  var u=(AUSERS||[]).filter(function(x){return x.id===uid})[0];
  var label=isActive?'ปิดการใช้งาน':'เปิดการใช้งาน';
  if(!confirm(label+'บัญชีผู้ใช้นี้?'))return;
  await dpa('users',uid,{is_active:!isActive});
  try{await dp('document_history',{action:label+'บัญชี',performed_by:CU.id,note:label+': '+(u?u.full_name:uid)});}catch(e){}
  nav('adm');
}

function admResetPw(uid){
  var u=(AUSERS||[]).filter(function(x){return x.id===uid})[0]; if(!u)return;
  var w=$e('mwrap'); if(!w)return;
  w.innerHTML=
    '<div class="mo"><div class="modal">'+
    '<div class="modal-head"><span class="modal-title">'+svg('key',14)+' รีเซ็ตรหัสผ่าน — '+esc(u.full_name)+'</span>'+
    '<button class="btn btn-soft sm btn-icon" data-action="closeModal">'+svg('x',14)+'</button></div>'+
    '<div class="modal-body">'+
    '<div class="al al-wa" style="margin-bottom:16px"><span class="al-icon">'+svg('warn',13)+'</span><span>รหัสผ่านใหม่จะถูกบันทึกทันที ผู้ใช้จะต้องใช้รหัสนี้ในการเข้าสู่ระบบครั้งถัดไป</span></div>'+
    '<div id="rpal"></div>'+
    '<div class="fg"><label class="fl">รหัสผ่านใหม่ <span class="req">*</span></label>'+
    '<input id="rpnew" class="fi" type="password" placeholder="อย่างน้อย 6 ตัวอักษร"></div>'+
    '<div class="fg"><label class="fl">ยืนยันรหัสผ่านใหม่ <span class="req">*</span></label>'+
    '<input id="rpnew2" class="fi" type="password" placeholder="ยืนยัน"></div>'+
    '</div>'+
    '<div class="modal-foot">'+
    '<button class="btn btn-soft" data-action="closeModal">ยกเลิก</button>'+
    '<button class="btn btn-primary" data-action="doAdmResetPw" data-uid="'+uid+'">บันทึกรหัสผ่านใหม่</button>'+
    '</div></div></div>';
}

async function doAdmResetPw(uid){
  var pw=gv('rpnew'),pw2=gv('rpnew2'),al=$e('rpal'); if(!al)return;
  if(!pw||pw.length<6){al.innerHTML=alrtH('er','รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');return}
  if(pw!==pw2){al.innerHTML=alrtH('er','รหัสผ่านทั้งสองช่องไม่ตรงกัน');return}
  al.innerHTML='<div class="al al-in"><span class="sp sp-dark"></span><span> กำลังบันทึก...</span></div>';
  var h=await hashPw(pw);
  await dpa('users',uid,{password_hash:h});
  var u=(AUSERS||[]).filter(function(x){return x.id===uid})[0];
  try{await dp('document_history',{action:'รีเซ็ตรหัสผ่าน',performed_by:CU.id,note:'รีเซ็ตรหัสผ่าน: '+(u?u.full_name:uid)});}catch(e){}
  al.innerHTML=alrtH('ok','รีเซ็ตรหัสผ่านสำเร็จ');
  setTimeout(function(){var mw=$e('mwrap');if(mw)mw.innerHTML='';},1400);
}

async function admDelDoc(docId){
  if(!confirm('ลบเอกสารนี้ออกจากระบบ?\n(ไม่สามารถเรียกคืนได้)'))return;
  try{
    var _d=(await dg('documents','?id=eq.'+docId))[0];
    await dp('document_history',{document_id:docId,action:'ลบเอกสาร',performed_by:CU.id,note:'ลบเอกสาร: '+(_d?_d.doc_number+' — '+_d.title:docId)});
  }catch(e){}
  await dd('documents',docId);
  nav('docs');
}

function admChgStatus(docId){
  var w=$e('mwrap'); if(!w)return;
  var opts=Object.entries(STTH).map(function(e){
    return '<button class="btn btn-soft fw" style="text-align:left;justify-content:flex-start;margin-bottom:8px" data-action="doAdmChgStatus" data-id="'+docId+'" data-status="'+e[0]+'">'+e[1]+'</button>';
  }).join('');
  w.innerHTML=
    '<div class="mo"><div class="modal">'+
    '<div class="modal-head"><span class="modal-title">'+svg('refresh',14)+' เปลี่ยนสถานะเอกสาร</span>'+
    '<button class="btn btn-soft sm btn-icon" data-action="closeModal">'+svg('x',14)+'</button></div>'+
    '<div class="modal-body">'+
    '<div class="al al-wa" style="margin-bottom:16px"><span class="al-icon">'+svg('warn',13)+'</span><span>การเปลี่ยนสถานะโดยตรงจะข้ามขั้นตอน Workflow โปรดใช้ด้วยความระมัดระวัง</span></div>'+
    opts+
    '</div></div></div>';
}

async function doAdmChgStatus(docId,status){
  if(!confirm('เปลี่ยนสถานะเป็น "'+(STTH[status]||status)+'" ?'))return;
  await dpa('documents',docId,{status:status,updated_at:new Date().toISOString()});
  try{await dp('document_history',{document_id:docId,action:'เปลี่ยนสถานะ (Admin)',performed_by:CU.id,note:'บังคับเปลี่ยนสถานะเป็น: '+(STTH[status]||status)});}catch(e){}
  var mw=$e('mwrap');if(mw)mw.innerHTML='';
  nav('det',docId);
}

function showAddAdvisor(){
  var w=$e('mwrap'); if(!w)return;
  var html=[
    '<div class="mo"><div class="modal">',
    '<div class="modal-head"><span class="modal-title">'+svg('plus',14)+' เพิ่มบัญชีอาจารย์</span><button class="btn btn-soft sm btn-icon" data-action="closeModal">'+svg('x',14)+'</button></div>',
    '<div class="modal-body">',
    '<div class="fr"><div class="fg"><label class="fl">ชื่อ-นามสกุล <span class="req">*</span></label><input class="fi" id="aa-name" placeholder="เช่น อ.สมชาย ใจดี"></div>',
    '<div class="fg"><label class="fl">อีเมลล็อกอิน <span class="req">*</span></label><input class="fi" id="aa-email" placeholder="advisor@example.com"></div></div>',
    '<div class="fr"><div class="fg"><label class="fl">ฝ่าย / หน่วยงาน</label><input class="fi" id="aa-dept" placeholder="เช่น สำนักกิจการนิสิต" value="สำนักกิจการนิสิต"></div>',
    '<div class="fg"><label class="fl">รหัสผ่าน <span class="req">*</span></label><input class="fi" id="aa-pw" type="password" placeholder="ตั้งรหัสผ่าน"></div></div>',
    '<div class="fg"><label class="fl">อีเมลสำหรับรับแจ้งเตือน</label><input class="fi" id="aa-cemail" placeholder="อีเมลจริง (ถ้าต่างจากอีเมลล็อกอิน)"></div>',
    '</div>',
    '<div class="modal-foot"><button class="btn btn-soft" data-action="closeModal">ยกเลิก</button>',
    '<button class="btn btn-primary" data-action="saveAddAdvisor">บันทึก</button></div>',
    '</div></div>'
  ];
  w.innerHTML=html.join('');
}

async function saveAddAdvisor(){
  var nm=gv('aa-name'),em=gv('aa-email'),dept=gv('aa-dept'),pw=gv('aa-pw'),cemail=gv('aa-cemail');
  if(!nm||!em||!pw){alert('กรุณากรอกชื่อ อีเมล และรหัสผ่าน');return}
  if(pw.length<6){alert('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');return}
  var exist=await dg('users','?email=eq.'+encodeURIComponent(em));
  if(exist.length){alert('อีเมลนี้มีในระบบแล้ว');return}
  var pwHash=await hashPw(pw);
  await dp('users',{email:em,full_name:nm,role_code:'ROLE-ADV',department:dept||'สำนักกิจการนิสิต',
    user_type:'advisor',approval_status:'approved',is_active:true,password_hash:pwHash,
    contact_email:cemail||em,approved_at:new Date().toISOString(),approved_by:CU.full_name});
  $e('mwrap').innerHTML=''; nav('adm')
}

/* ─── ADMIN FILTER + SEARCH ─── */
var _admTab='all';

function applyAdmFilter(){
  var q=($e('asrch')||{}).value||'';
  var f=AUSERS.filter(function(u){
    var tabOk=_admTab==='all'?true:_admTab==='pending'?u.approval_status==='pending':u.user_type===_admTab;
    if(!tabOk)return false;
    if(!q.trim())return true;
    var s=(u.full_name+' '+(u.student_id||'')+' '+(u.email||'')+' '+(u.position_code||'')).toLowerCase();
    return s.includes(q.trim().toLowerCase());
  });
  var w=$e('atbl');if(w)w.innerHTML=rAdmTbl(f);
}
function setAS(){applyAdmFilter()}

/* ─── ACTION DROPDOWN ─── */
function toggleAM(uid){
  var d=$e('amd-'+uid);
  var was=d&&d.classList.contains('open');
  document.querySelectorAll('.am-drop.open').forEach(function(x){x.classList.remove('open')});
  if(d&&!was)d.classList.add('open');
}

/* ─── CLOSE MODAL (เดิม — ยังใช้กับ modal อื่นๆ) ─── */
function closeModal(){
  var w=document.getElementById('mwrap');
  if(w)w.innerHTML='';
}

/* ─── GLOBAL CLICK: close dropdown + close modal ─── */
document.addEventListener('click',function(e){
  if(!e.target.closest('.am-trig')){
    document.querySelectorAll('.am-drop.open').forEach(function(d){d.classList.remove('open')});
  }
  var el=e.target;
  while(el){
    if(el.getAttribute&&el.getAttribute('data-action')==='closeModal'){closeModal();return}
    el=el.parentNode;
  }
});

/* ═══════════════════════════════════════════════════════════════
   POPUP SYSTEM — นำเข้า CSV + ตั้งค่าเลขที่เอกสาร
   ═══════════════════════════════════════════════════════════════ */

/* ─── Inject popup CSS (ครั้งเดียว) ─── */
(function injectPopupCSS(){
  if(document.getElementById('gnk-popup-style'))return;
  var s=document.createElement('style');
  s.id='gnk-popup-style';
  s.textContent=
    '@keyframes gnkBdIn{from{opacity:0}to{opacity:1}}'+
    '@keyframes gnkBdOut{from{opacity:1}to{opacity:0}}'+
    '@keyframes gnkBoxIn{from{opacity:0;transform:translateY(18px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}'+
    '@keyframes gnkBoxOut{from{opacity:1;transform:translateY(0) scale(1)}to{opacity:0;transform:translateY(12px) scale(.97)}}'+
    '@keyframes gnkSpin{to{transform:rotate(360deg)}}'+

    '.gnk-bd{position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px;'+
    'background:rgba(24,18,14,.52);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:gnkBdIn .2s ease both}'+
    '.gnk-bd.closing{animation:gnkBdOut .18s ease both}'+
    '.gnk-bd.closing .gnk-box{animation:gnkBoxOut .18s ease both}'+

    '.gnk-box{background:#FEFCFA;border-radius:20px;'+
    'box-shadow:0 8px 40px rgba(24,18,14,.18),0 2px 8px rgba(24,18,14,.10),inset 0 1px 0 rgba(255,255,255,.9);'+
    'width:100%;max-height:88vh;overflow:hidden;display:flex;flex-direction:column;'+
    'animation:gnkBoxIn .22s cubic-bezier(.34,1.2,.64,1) both}'+

    '.gnk-pop-head{padding:22px 24px 0;flex-shrink:0;position:relative}'+
    '.gnk-eyebrow{font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#C42800;margin-bottom:4px;display:flex;align-items:center;gap:6px}'+
    '.gnk-eyebrow::before{content:"";display:inline-block;width:18px;height:2px;background:linear-gradient(90deg,#C42800,#E83A00);border-radius:2px}'+
    '.gnk-pop-title{font-size:18px;font-weight:700;color:#18120E;letter-spacing:-.3px;line-height:1.2;margin-bottom:4px}'+
    '.gnk-pop-sub{font-size:12px;color:#a89e99;margin-bottom:16px}'+
    '.gnk-divider{height:1px;background:linear-gradient(90deg,#F0EBE6 0%,#E8E0D8 50%,transparent 100%);flex-shrink:0}'+
    '.gnk-pop-body{padding:20px 24px;overflow-y:auto;flex:1}'+
    '.gnk-pop-foot{padding:16px 24px;flex-shrink:0;display:flex;justify-content:flex-end;gap:10px;'+
    'background:linear-gradient(0deg,#FAF7F4 0%,#FEFCFA 100%);border-top:1px solid #F0EBE6;border-radius:0 0 20px 20px}'+

    '.gnk-xbtn{position:absolute;top:18px;right:20px;width:30px;height:30px;border-radius:50%;'+
    'border:1px solid #E8E0D8;background:#FFF;display:flex;align-items:center;justify-content:center;'+
    'cursor:pointer;color:#a89e99;transition:all .15s;line-height:1}'+
    '.gnk-xbtn:hover{background:#F5F0EB;color:#18120E;border-color:#C9BDB5}'+

    '.gnk-info{background:#FFF3EE;border:1px solid #FFCFBB;border-radius:12px;padding:12px 14px;margin-bottom:16px;'+
    'display:flex;gap:10px;align-items:flex-start;font-size:12px;line-height:1.6;color:#7A3010}'+

    '.gnk-file-btn{display:inline-flex;align-items:center;gap:7px;padding:0 16px;height:36px;border-radius:10px;'+
    'border:1.5px dashed #D0C5BC;background:#FAF7F4;font-size:12px;font-weight:600;color:#6b6560;cursor:pointer;transition:all .15s}'+
    '.gnk-file-btn:hover{border-color:#C42800;background:#FFF3EE;color:#C42800}'+
    '.gnk-dl-btn{display:inline-flex;align-items:center;gap:7px;padding:0 14px;height:36px;border-radius:10px;'+
    'border:1.5px solid #E8E0D8;background:#FFF;font-size:12px;font-weight:600;color:#6b6560;cursor:pointer;text-decoration:none;transition:all .15s}'+
    '.gnk-dl-btn:hover{border-color:#6b6560;color:#18120E}'+

    '.gnk-tbl-count{font-size:11px;font-weight:700;color:#6b6560;margin-bottom:8px;text-transform:uppercase;letter-spacing:.4px}'+
    '.gnk-tbl{border-radius:12px;border:1px solid #EDE6DF;overflow:hidden;max-height:220px;overflow-y:auto}'+
    '.gnk-tbl table{width:100%;border-collapse:collapse;font-size:12px}'+
    '.gnk-tbl thead tr{background:#FFF3EE}'+
    '.gnk-tbl th{padding:8px 10px;text-align:left;font-weight:700;font-size:11px;letter-spacing:.4px;color:#C42800;border-bottom:1px solid #EDE6DF}'+
    '.gnk-tbl td{padding:7px 10px;border-bottom:1px solid #F5F0EB;color:#18120E}'+
    '.gnk-tbl tr:last-child td{border-bottom:none}'+
    '.gnk-tbl tr:hover td{background:#FAF7F4}'+

    '.gnk-inp-grp{margin-bottom:14px}'+
    '.gnk-inp-grp label{display:block;font-size:11px;font-weight:700;letter-spacing:.4px;color:#6b6560;margin-bottom:5px;text-transform:uppercase}'+
    '.gnk-inp{width:100%;box-sizing:border-box;height:42px;padding:0 12px;border-radius:10px;border:1.5px solid #E8E0D8;'+
    'background:#FFF;font-size:14px;color:#18120E;font-family:"IBM Plex Mono",monospace;letter-spacing:.5px;transition:border-color .15s,box-shadow .15s;outline:none}'+
    '.gnk-inp:focus{border-color:#C42800;box-shadow:0 0 0 3px rgba(196,40,0,.10)}'+

    '.gnk-prev-box{background:linear-gradient(135deg,#FFF3EE 0%,#FAF7F4 100%);border:1.5px solid #FFCFBB;border-radius:14px;'+
    'padding:16px 18px;display:flex;align-items:center;gap:14px;margin-top:18px}'+
    '.gnk-prev-val{font-family:"IBM Plex Mono",monospace;font-size:20px;font-weight:700;color:#C42800;letter-spacing:-.5px}'+
    '.gnk-prev-tag{font-size:10px;background:#FFCFBB;color:#7A3010;padding:2px 8px;border-radius:20px;font-weight:700;margin-left:auto;white-space:nowrap}'+

    '.gnk-btn-c{height:38px;padding:0 18px;border-radius:10px;border:1.5px solid #E8E0D8;background:#FFF;'+
    'font-size:13px;font-weight:600;color:#6b6560;cursor:pointer;transition:all .15s}'+
    '.gnk-btn-c:hover{border-color:#C9BDB5;background:#FAF7F4;color:#18120E}'+
    '.gnk-btn-p{height:38px;padding:0 20px;border-radius:10px;border:none;'+
    'background:linear-gradient(135deg,#C42800 0%,#E83A00 100%);'+
    'font-size:13px;font-weight:700;color:#FFF;cursor:pointer;letter-spacing:.1px;'+
    'box-shadow:0 2px 8px rgba(196,40,0,.30);display:inline-flex;align-items:center;gap:6px;transition:all .15s}'+
    '.gnk-btn-p:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(196,40,0,.38)}'+
    '.gnk-btn-p:active{transform:translateY(0);box-shadow:0 1px 4px rgba(196,40,0,.25)}'+
    '.gnk-btn-p:disabled{opacity:.55;cursor:not-allowed;transform:none;box-shadow:none}'+
    '.gnk-spin{animation:gnkSpin .8s linear infinite}';
  document.head.appendChild(s);
})();

/* ─── Popup core helpers ─── */
var _XSVG='<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
var _ISVG='<svg width="14" height="14" viewBox="0 0 16 16" fill="none" style="flex-shrink:0;margin-top:1px"><circle cx="8" cy="8" r="7" stroke="#C42800" stroke-width="1.5"/><path d="M8 7v5" stroke="#C42800" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="4.5" r=".8" fill="#C42800"/></svg>';
var _SPINSVG='<svg width="13" height="13" viewBox="0 0 16 16" fill="none" class="gnk-spin"><circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,.35)" stroke-width="1.7"/><path d="M8 2a6 6 0 0 1 6 6" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/></svg>';
var _DNSVG='<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 2v9M5 8l3 3 3-3" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 13h12" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/></svg>';
var _OKSVG='<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2 9l4 4 8-8" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function _gnkOpen(id,boxHtml){
  var w=$e('mwrap'); if(!w)return;
  w.innerHTML='<div class="gnk-bd" id="gnk-bd-'+id+'" onclick="_gnkBdClick(event,\''+id+'\')">'+boxHtml+'</div>';
}
function _gnkBdClick(ev,id){
  if(ev.target===ev.currentTarget) gnkClose(id);
}
function gnkClose(id){
  var bd=$e('gnk-bd-'+id); if(!bd)return;
  bd.classList.add('closing');
  bd.addEventListener('animationend',function(){var w=$e('mwrap');if(w)w.innerHTML='';},{once:true});
}

/* ─── IMPORT USERS (CSV) ─── */
function showImport(){
  var tmpl='ชื่อ-นามสกุล,อีเมล,รหัสผ่าน,บทบาท,ฝ่าย,ประเภท\n'+
    'สมชาย ใจดี,somchai@gnk.ac.th,pass1234,ROLE-CRT,ฝ่ายวิชาการ,gnk\n'+
    'อาจารย์ A,teacher@uni.ac.th,pass1234,ROLE-ADV,สำนักกิจการนิสิต,advisor';

  var box = [
  '<div class="max-w-[620px] w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-orange-100 transition-all" onclick="event.stopPropagation()">',
    // --- Header ---
    '<div class="relative p-6 border-b border-orange-50">',
      '<div class="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-500 mb-1">Admin Tools</div>',
      '<div class="text-2xl font-extrabold text-slate-800 tracking-tight">นำเข้าข้อมูลผู้ใช้</div>',
      '<div class="text-sm text-slate-400 mt-1">จัดการเพิ่มผู้ใช้ใหม่ผ่านไฟล์ CSV อย่างรวดเร็ว</div>',
      '<button class="absolute top-6 right-6 p-2 text-slate-300 hover:text-orange-500 hover:bg-orange-50 rounded-full transition-all" onclick="gnkClose(\'imp\')">' + _XSVG + '</button>',
    '</div>',

    // --- Body ---
    '<div class="p-6 space-y-6">',
      // Info Box (Orange Tone)
      '<div class="flex gap-4 bg-orange-50/50 border border-orange-100 p-4 rounded-2xl text-orange-900 text-sm leading-relaxed">',
        '<div class="shrink-0 text-orange-500 mt-0.5">' + _ISVG + '</div>',
        '<div>',
          '<p class="font-bold text-orange-800 mb-1">ข้อกำหนดไฟล์ CSV ที่ต้องมี:</p>',
          '<p class="text-orange-700/80 mb-3 italic">ชื่อ-นามสกุล, อีเมล, รหัสผ่าน, บทบาท, ฝ่าย, ประเภท</p>',
          '<div class="flex flex-col gap-2 font-mono text-[10px]">',
            '<div><span class="bg-orange-200/50 text-orange-800 px-1.5 py-0.5 rounded mr-2 uppercase font-bold">Roles:</span> ROLE-CRT, ROLE-REV, ROLE-SGN, ROLE-ADV, ROLE-STF</div>',
            '<div><span class="bg-orange-200/50 text-orange-800 px-1.5 py-0.5 rounded mr-2 uppercase font-bold">Types:</span> gnk, advisor, staff</div>',
          '</div>',
        '</div>',
      '</div>',

      // Action Buttons
      '<div class="flex flex-wrap gap-3 items-center">',
        '<label class="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-2.5 rounded-xl font-bold transition-all cursor-pointer shadow-lg shadow-orange-200 active:scale-95">',
          svg('dn', 18) + ' เลือกไฟล์ CSV',
          '<input type="file" id="imp-file" accept=".csv" class="hidden" onchange="parseImportCSV()">',
        '</label>',
        '<a class="flex items-center gap-2 bg-white border border-slate-200 hover:border-orange-300 hover:text-orange-600 text-slate-600 px-6 py-2.5 rounded-xl font-bold transition-all active:scale-95" href="data:text/csv;charset=utf-8,\ufeff' + encodeURIComponent(tmpl) + '" download="template_import.csv">',
          svg('dn', 18) + ' รับไฟล์แม่แบบ',
        '</a>',
      '</div>',

      // Preview Container
      '<div id="imp-preview" class="empty:hidden min-h-[40px] max-h-[250px] overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50 p-2"></div>',
    '</div>',

    // --- Footer ---
    '<div class="bg-slate-50/80 p-4 px-6 flex justify-end items-center gap-4 border-t border-slate-100">',
      // ปุ่มยกเลิกแบบใหม่ (Soft Elegant Style)
      '<button class="group flex items-center gap-1 px-4 py-2 text-slate-400 hover:text-rose-500 font-semibold transition-all" onclick="gnkClose(\'imp\')">',
        '<span class="text-lg opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">←</span>',
        '<span>ยกเลิก</span>',
      '</button>',
      
      '<button id="imp-btn" class="hidden items-center gap-2 bg-slate-800 hover:bg-orange-600 text-white px-8 py-2.5 rounded-xl font-bold transition-all shadow-xl shadow-slate-200 active:scale-95" data-action="doImport">' + _DNSVG + ' ยืนยันนำเข้า</button>',
    '</div>',
  '</div>'
].join('');

  _gnkOpen('imp',box);
}

var _impRows=[];
function parseImportCSV(){
  var file=$e('imp-file'); if(!file||!file.files[0])return;
  var reader=new FileReader();
  reader.onload=function(e){
    var lines=e.target.result.replace(/\r/g,'').split('\n').filter(function(l){return l.trim()});
    if(lines.length<2){$e('imp-preview').innerHTML=alrtH('er','ไฟล์ไม่มีข้อมูล');return}
    var rows=[];
    var roleOk={'ROLE-CRT':1,'ROLE-REV':1,'ROLE-SGN':1,'ROLE-ADV':1,'ROLE-STF':1};
    var typeOk={gnk:1,advisor:1,staff:1};
    for(var i=1;i<lines.length;i++){
      var cols=lines[i].split(',').map(function(c){return c.trim().replace(/^"|"$/g,'')});
      if(cols.length<4||!cols[0]||!cols[1])continue;
      var role=roleOk[cols[3]]?cols[3]:'ROLE-CRT';
      var utype=typeOk[cols[5]]?cols[5]:'gnk';
      rows.push({full_name:cols[0],email:cols[1],password:cols[2]||'changeme',role_code:role,department:cols[4]||'กนค.',user_type:utype});
    }
    _impRows=rows;
    if(!rows.length){$e('imp-preview').innerHTML=alrtH('er','ไม่พบข้อมูลที่ถูกต้อง');$e('imp-btn').style.display='none';return}
    var tbl=[
      '<div class="gnk-tbl-count">พบ '+rows.length+' รายการที่พร้อมนำเข้า</div>',
      '<div class="gnk-tbl"><table>',
        '<thead><tr>',
          ['ชื่อ-นามสกุล','อีเมล','บทบาท','ฝ่าย','ประเภท'].map(function(h){return '<th>'+h+'</th>'}).join(''),
        '</tr></thead><tbody>',
        rows.map(function(r){
          return '<tr>'+[r.full_name,r.email,r.role_code,r.department,r.user_type].map(function(v){
            return '<td>'+esc(v)+'</td>';
          }).join('')+'</tr>';
        }).join(''),
        '</tbody></table></div>'
    ].join('');
    $e('imp-preview').innerHTML=tbl;
    $e('imp-btn').style.display='';
  };
  reader.readAsText(file.files[0],'UTF-8');
}

async function doImport(){
  var btn=$e('imp-btn'); if(!_impRows.length)return;
  btn.disabled=true;
  btn.innerHTML=_SPINSVG+'กำลังนำเข้า...';
  var ok=0,skip=0,fail=0;
  for(var i=0;i<_impRows.length;i++){
    var r=_impRows[i];
    try{
      var ex=await dg('users','?email=eq.'+encodeURIComponent(r.email)+'&select=id');
      if(ex.length){skip++;continue}
      var pwHash=await hashPw(r.password);
      await dp('users',{full_name:r.full_name,email:r.email,password_hash:pwHash,role_code:r.role_code,
        department:r.department,user_type:r.user_type,approval_status:'approved',is_active:true,
        contact_email:r.email,approved_at:new Date().toISOString(),approved_by:CU.full_name});
      ok++;
    }catch(e){fail++}
  }
  $e('imp-preview').innerHTML=alrtH('ok','นำเข้าสำเร็จ '+ok+' รายการ'+(skip?' · ข้าม '+skip+' (มีแล้ว)':'')+(fail?' · ผิดพลาด '+fail+' รายการ':''));
  btn.style.display='none';
  _impRows=[];
  setTimeout(function(){gnkClose('imp');setTimeout(function(){nav('adm')},220)},1500);
}

/* Doc number + doc type management functions → sysAdmin.js / docTypeAdmin.js */
