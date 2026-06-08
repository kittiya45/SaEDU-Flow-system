/* ─── SYSTEM ADMIN (จัดการระบบ) ─── */

var _sysTab='docnum'; // tab ที่เปิดอยู่

async function vSys(){
  if(CU.role_code!=='ROLE-SYS') return '<div class="card-empty"><div class="card-empty-text">ไม่มีสิทธิ์เข้าถึง</div></div>';
  var _docNumCfgs=[], _docTypes=[], _settings=[], _emailTmpls=[], _wfTmpls=[], _projects=[];
  try{_docNumCfgs=await dg('doc_number_settings','?order=year.desc');}catch(e){}
  try{_docTypes=await dg('doc_types','?order=sort_order,created_at');}catch(e){}
  try{_settings=await dg('app_settings','?order=key');}catch(e){}
  try{_emailTmpls=await dg('email_templates','?order=key');}catch(e){}
  try{_wfTmpls=await dg('workflow_templates','?order=doc_type,created_at');}catch(e){}
  try{_projects=await dg('projects','?order=sort_order,name');}catch(e){}
  if(_wfTmpls.length){
    try{
      var _wfSteps=await dg('workflow_template_steps','?select=template_id');
      var _wfCnts={};
      (_wfSteps||[]).forEach(function(s){_wfCnts[s.template_id]=(_wfCnts[s.template_id]||0)+1;});
      _wfTmpls.forEach(function(t){t._stepCount=_wfCnts[t.id]||0;});
    }catch(e){}
  }
  if(_docTypes.length){
    try{
      var flds=await dg('doc_type_fields','?select=doc_type_id');
      var cnts={};
      flds.forEach(function(f){cnts[f.doc_type_id]=(cnts[f.doc_type_id]||0)+1;});
      _docTypes.forEach(function(t){t._fieldCount=cnts[t.id]||0;});
    }catch(e){}
  }

  // ── Derived counts for header stats ──
  var _projArr=Array.isArray(_projects)?_projects:[];
  var _wfTmplArr=Array.isArray(_wfTmpls)?_wfTmpls:[];
  var _dtArr=Array.isArray(_docTypes)?_docTypes:[];
  var _thYear=new Date().getFullYear()+543;
  var _sysAnnouncement=((Array.isArray(_settings)?_settings:[]).find(function(s){return s.key==='system_announcement'})||{}).value||'';
  var _annDot=_sysAnnouncement?'<span style="width:7px;height:7px;border-radius:50%;background:#E83A00;display:inline-block;margin-left:5px;vertical-align:middle;flex-shrink:0"></span>':'';

  // ── Page header ──
  var _statPills=[
    {val:_dtArr.length,     label:'ประเภทเอกสาร', color:'#E83A00'},
    {val:_projArr.length,   label:'โครงการ',        color:'#2563EB'},
    {val:_wfTmplArr.length, label:'Workflow',        color:'#16A34A'},
    {val:_thYear,           label:'ปี พ.ศ.',          color:'#D97706'}
  ];
  var _pillsHtml=_statPills.map(function(s){
    return '<div style="display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #EBEBEB;border-radius:12px;padding:9px 14px;box-shadow:0 1px 3px rgba(0,0,0,.04)">'+
      '<div style="width:8px;height:8px;border-radius:50%;background:'+s.color+';flex-shrink:0"></div>'+
      '<span style="font-size:15px;font-weight:900;color:#18120E;line-height:1">'+s.val+'</span>'+
      '<span style="font-size:11px;color:#a89e99;font-weight:500;white-space:nowrap">'+s.label+'</span>'+
    '</div>';
  }).join('');

  var _pageHeader=
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:20px;flex-wrap:wrap">'+
      '<div style="display:flex;align-items:center;gap:14px">'+
        '<div style="width:44px;height:44px;border-radius:14px;background:linear-gradient(135deg,#E83A00,#FF6035);display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;box-shadow:0 4px 12px rgba(232,58,0,.3)">'+svg('gear',21)+'</div>'+
        '<div>'+
          '<div style="font-size:20px;font-weight:900;color:#18120E;letter-spacing:-.5px;line-height:1.1">จัดการระบบ</div>'+
          '<div style="font-size:12px;color:#a89e99;margin-top:3px">ตั้งค่าและบริหารจัดการระบบเสนอเอกสาร กนค.</div>'+
        '</div>'+
      '</div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap">'+_pillsHtml+'</div>'+
    '</div>';

  // ── Pill tab navigation ──
  var _tabs=[
    {k:'docnum',   ico:'edit',    label:'เลขที่เอกสาร',  badge:''},
    {k:'doctypes', ico:'doc',     label:'ประเภทเอกสาร',  badge:''},
    {k:'projects', ico:'folder',  label:'โครงการ',        badge:_projArr.length>0?'<span style="display:inline-flex;align-items:center;justify-content:center;background:#E83A00;color:#fff;font-size:9px;font-weight:800;border-radius:20px;padding:1px 6px;margin-left:4px;line-height:1.4">'+_projArr.length+'</span>':''},
    {k:'settings', ico:'gear',    label:'ตั้งค่าระบบ'+_annDot, badge:''},
    {k:'email',    ico:'bell',    label:'แม่แบบอีเมล',   badge:''},
    {k:'workflow', ico:'refresh', label:'Workflow',        badge:_wfTmplArr.length>0?'<span style="display:inline-flex;align-items:center;justify-content:center;background:#E83A00;color:#fff;font-size:9px;font-weight:800;border-radius:20px;padding:1px 6px;margin-left:4px;line-height:1.4">'+_wfTmplArr.length+'</span>':''},
    {k:'refdata',  ico:'list',    label:'รายการอ้างอิง', badge:''}
  ];

  var tabNav='<div style="background:#F5F3F0;padding:5px;border-radius:16px;display:flex;gap:3px;margin-bottom:22px;overflow-x:auto;flex-wrap:nowrap">';
  _tabs.forEach(function(t){
    var isAct=t.k===_sysTab;
    var activeStyle=isAct?'background:#fff;color:#E83A00;font-weight:800;box-shadow:0 1px 4px rgba(0,0,0,.1);':'background:transparent;color:#6b6560;font-weight:600;';
    tabNav+='<button style="flex:1;min-width:max-content;padding:8px 14px;border-radius:11px;border:none;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-size:12px;white-space:nowrap;'+activeStyle+'" '+
      'onclick="setSysTab(\''+t.k+'\')" data-systab="'+t.k+'">'+
      svg(t.ico,12)+t.label+t.badge+'</button>';
  });
  tabNav+='</div>';

  var _panelContent={
    docnum:   rDocNumCard(_docNumCfgs),
    doctypes: rDocTypesCard(_docTypes),
    projects: rProjectsCard(_projects),
    settings: rAppSettingsCard(_settings),
    email:    rEmailTemplatesCard(_emailTmpls),
    workflow: rWfTemplatesCard(_wfTmpls),
    refdata:  rRefDataCard()
  };

  var html=_pageHeader+tabNav;
  _tabs.forEach(function(t){
    html+='<div id="sys-tab-'+t.k+'" style="display:'+(t.k===_sysTab?'block':'none')+'">'+_panelContent[t.k]+'</div>';
  });
  return html;
}

function setSysTab(tab){
  _sysTab=tab;
  ['docnum','doctypes','projects','settings','email','workflow','refdata'].forEach(function(t){
    var el=$e('sys-tab-'+t);
    if(el) el.style.display=t===tab?'block':'none';
  });
  document.querySelectorAll('[data-systab]').forEach(function(btn){
    var isAct=btn.dataset.systab===tab;
    btn.style.background=isAct?'#fff':'transparent';
    btn.style.color=isAct?'#E83A00':'#6b6560';
    btn.style.fontWeight=isAct?'800':'600';
    btn.style.boxShadow=isAct?'0 1px 4px rgba(0,0,0,.1)':'none';
  });
}

/* ─── DOC NUMBER CARD ─── */
function rDocNumCard(cfgs){
  cfgs=Array.isArray(cfgs)?cfgs:[];
  var thYear=new Date().getFullYear()+543;
  var cur=cfgs.find(function(c){return c.year===thYear});
  var curPrefix=cur?cur.prefix:'GNK';
  var curOutStart=cur&&cur.out_start_seq?cur.out_start_seq:1;
  var h=[];

  h.push(
    '<div class="card" style="margin-bottom:16px;overflow:hidden">'+
      /* ── Card header ── */
      '<div style="padding:18px 22px;border-bottom:1px solid #F5F3F0;display:flex;align-items:center;justify-content:space-between;gap:12px">'+
        '<div style="display:flex;align-items:center;gap:10px">'+
          '<div style="width:36px;height:36px;border-radius:10px;background:#FFF5F0;display:flex;align-items:center;justify-content:center;color:#E83A00;flex-shrink:0">'+svg('edit',17)+'</div>'+
          '<div>'+
            '<div style="font-size:14px;font-weight:800;color:#18120E">ตั้งค่าเลขที่เอกสาร</div>'+
            '<div style="font-size:11px;color:#a89e99;margin-top:1px">รูปแบบเลขที่สำหรับปี พ.ศ. '+thYear+'</div>'+
          '</div>'+
        '</div>'+
        '<button class="btn btn-primary sm" data-action="showDocNumModal" style="flex-shrink:0">'+svg('edit',12)+' แก้ไขการตั้งค่า</button>'+
      '</div>'+
      /* ── Two preview cards ── */
      '<div style="padding:20px 22px">'+
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px">'
  );

  /* incoming preview */
  h.push(
    '<div style="border-radius:20px;background:linear-gradient(135deg,#E83A00 0%,#FF6B35 100%);padding:22px 24px;position:relative;overflow:hidden;box-shadow:0 8px 28px rgba(232,58,0,.35)">'+
      '<div style="position:absolute;right:-18px;bottom:-18px;width:90px;height:90px;border-radius:50%;background:rgba(255,255,255,.15)"></div>'+
      '<div style="position:absolute;right:28px;bottom:-28px;width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,.1)"></div>'+
      '<div style="display:flex;align-items:center;gap:7px;margin-bottom:14px">'+
        '<div style="width:22px;height:22px;border-radius:6px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;color:#fff">'+svg('doc',11)+'</div>'+
        '<div style="font-size:10px;font-weight:800;color:rgba(255,255,255,.85);text-transform:uppercase;letter-spacing:.8px">หนังสือขาเข้า</div>'+
      '</div>'+
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:22px;font-weight:900;color:#fff;letter-spacing:.5px;margin-bottom:4px">'+esc(curPrefix)+'-'+thYear+'-<span style="opacity:.5">001</span></div>'+
      '<div style="font-size:10px;color:rgba(255,255,255,.65)">Prefix · ปี · ลำดับ</div>'+
    '</div>'
  );

  /* outgoing preview */
  h.push(
    '<div style="border-radius:20px;background:linear-gradient(135deg,#2563EB 0%,#60A5FA 100%);padding:22px 24px;position:relative;overflow:hidden;box-shadow:0 8px 28px rgba(37,99,235,.35)">'+
      '<div style="position:absolute;right:-18px;bottom:-18px;width:90px;height:90px;border-radius:50%;background:rgba(255,255,255,.15)"></div>'+
      '<div style="position:absolute;right:28px;bottom:-28px;width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,.1)"></div>'+
      '<div style="display:flex;align-items:center;gap:7px;margin-bottom:14px">'+
        '<div style="width:22px;height:22px;border-radius:6px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;color:#fff">'+svg('sign',11)+'</div>'+
        '<div style="font-size:10px;font-weight:800;color:rgba(255,255,255,.85);text-transform:uppercase;letter-spacing:.8px">หนังสือขาออก</div>'+
      '</div>'+
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:22px;font-weight:900;color:#fff;letter-spacing:.5px;margin-bottom:4px">กนค. '+thYear+'.<span style="opacity:.5">'+String(curOutStart).padStart(2,'0')+'</span></div>'+
      '<div style="font-size:10px;color:rgba(255,255,255,.65)">กนค. · ปี · ลำดับเริ่มต้น</div>'+
    '</div>'
  );

  h.push('</div>');

  /* ── History table ── */
  if(cfgs&&cfgs.length){
    h.push(
      '<div style="border-top:1px solid #F5F3F0;padding-top:16px">'+
        '<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:#a89e99;margin-bottom:10px">ประวัติการตั้งค่า</div>'+
        '<div style="border:1px solid #EBEBEB;border-radius:12px;overflow:hidden">'+
          '<table style="width:100%;border-collapse:collapse">'+
            '<thead><tr style="background:#FAFAF8">'+
              '<th style="padding:9px 14px;font-size:10px;font-weight:700;color:#6b6560;text-align:left;border-bottom:1px solid #EBEBEB">ปี พ.ศ.</th>'+
              '<th style="padding:9px 14px;font-size:10px;font-weight:700;color:#6b6560;text-align:left;border-bottom:1px solid #EBEBEB">ตัวอย่างขาเข้า</th>'+
              '<th style="padding:9px 14px;font-size:10px;font-weight:700;color:#6b6560;text-align:left;border-bottom:1px solid #EBEBEB">ตัวอย่างขาออก</th>'+
              '<th style="padding:9px 14px;font-size:10px;font-weight:700;color:#6b6560;text-align:right;border-bottom:1px solid #EBEBEB">วันที่แก้ไข</th>'+
            '</tr></thead><tbody>'
    );
    cfgs.forEach(function(c,i){
      var _os=c.out_start_seq||1;
      var _bg=i%2===0?'#fff':'#FDFBF9';
      h.push(
        '<tr style="background:'+_bg+'">'+
          '<td style="padding:10px 14px;border-bottom:1px solid #F5F3F0">'+
            '<span style="font-size:13px;font-weight:800;color:#18120E">'+c.year+'</span>'+
          '</td>'+
          '<td style="padding:10px 14px;border-bottom:1px solid #F5F3F0">'+
            '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:12px;color:#C42800;font-weight:700;background:#FFF5F0;padding:2px 8px;border-radius:6px">'+esc(c.prefix)+'-'+c.year+'-001</span>'+
          '</td>'+
          '<td style="padding:10px 14px;border-bottom:1px solid #F5F3F0">'+
            '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:12px;color:#1D4ED8;font-weight:700;background:#EFF6FF;padding:2px 8px;border-radius:6px">กนค.'+c.year+'.'+String(_os).padStart(2,'0')+'</span>'+
          '</td>'+
          '<td style="padding:10px 14px;border-bottom:1px solid #F5F3F0;text-align:right;font-size:12px;color:#a89e99">'+fd(c.created_at)+'</td>'+
        '</tr>'
      );
    });
    h.push('</tbody></table></div></div>');
  }

  h.push('</div></div>');
  return h.join('');
}

/* ─── DOC NUM MODAL ─── */
async function showDocNumModal(){
  var thYear=new Date().getFullYear()+543;
  var curPrefix='GNK';
  var curOutStart=1;
  try{
    var cfg=await dg('doc_number_settings','?year=eq.'+thYear+'&select=prefix,out_start_seq&limit=1');
    if(cfg&&cfg.length){
      if(cfg[0].prefix) curPrefix=cfg[0].prefix;
      if(cfg[0].out_start_seq) curOutStart=cfg[0].out_start_seq;
    }
  }catch(e){}

var box = [
  '<div class="gnk-box overflow-hidden" style="max-width:440px; border-radius:28px; background:#fff; box-shadow: 0 40px 80px -12px rgba(232, 58, 0, 0.12); border: 1px solid rgba(232, 58, 0, 0.05);" onclick="event.stopPropagation()">',
    
    // Header: ใช้สีส้ม #E83A00 เป็นหลัก
    '<div class="gnk-pop-head" style="padding: 28px 32px 20px 32px; background: linear-gradient(to bottom, rgba(232, 58, 0, 0.05), #fff);">',
      '<div class="flex flex-col gap-1">',
        '<div style="color:#E83A00; font-weight:800; font-size:10px; letter-spacing:0.12em; text-transform:uppercase; display:flex; align-items:center; gap:6px;">',
          '<span style="width:10px; height:2px; background:#E83A00; border-radius:2px;"></span> Document System',
        '</div>',
        '<div class="gnk-pop-title" style="font-size:19px; font-weight:850; color:#18120E; letter-spacing:-0.02em;">ตั้งค่าเลขที่เอกสาร</div>',
        '<div style="font-size:12px; color:#6b6560; margin-top:4px;">',
          'ปีงบประมาณปัจจุบัน: <span style="color:#E83A00; font-weight:800; background:rgba(232, 58, 0, 0.1); padding:2px 10px; border-radius:8px; font-size:13px;">' + thYear + '</span>',
        '</div>',
      '</div>',
      '<button class="gnk-xbtn" style="top:24px; right:24px; background:rgba(232, 58, 0, 0.08); color:#E83A00; border-radius:14px; width:36px; height:36px; display:flex; align-items:center; justify-content:center; transition:0.2s; border:none; cursor:pointer;" onmouseover="this.style.background=\'rgba(232, 58, 0, 0.15)\'" onmouseout="this.style.background=\'rgba(232, 58, 0, 0.08)\'" onclick="gnkClose(\'docnum\')">' + _XSVG + '</button>',
    '</div>',

    '<div class="gnk-pop-body" style="padding: 0 32px 28px 32px;">',
      // Info Box: ปรับเป็นขอบประสีส้มจาง
      '<div style="background:rgba(232, 58, 0, 0.02); border:1px dashed rgba(232, 58, 0, 0.2); border-radius:16px; padding:14px; margin-bottom:24px; display:flex; gap:10px; align-items:flex-start;">',
        '<div style="color:#E83A00; margin-top:2px;">' + _ISVG + '</div>',
        '<div style="font-size:11.5px; color:#4a4440; line-height:1.5;">ระบบจะสร้างเลขที่อัตโนมัติตามรูปแบบ <span style="font-family:monospace; font-weight:700; color:#E83A00;">[Prefix]-' + thYear + '-[No.]</span></div>',
      '</div>',

      // Input Group — incoming prefix
      '<div class="gnk-inp-grp" style="margin-bottom:16px;">',
        '<label style="display:block; font-size:11.5px; font-weight:700; color:#18120E; margin-bottom:8px; margin-left:2px;">ชื่อย่อ/รหัสองค์กร (Prefix) — ขาเข้า</label>',
        '<input type="text" id="dn-prefix" class="gnk-inp" value="' + esc(curPrefix) + '" ',
          'placeholder="ระบุตัวย่อ..." maxlength="20" oninput="updateDNPreview()" ',
          'style="width:100%; height:46px; padding:0 16px; font-size:13px; font-weight:600; border-radius:12px; border:1.5px solid #EBEBEB; background:#fff; transition:all 0.3s; box-sizing:border-box; outline:none; color:#18120E;">',
      '</div>',

      // Input Group — outgoing start seq
      '<div class="gnk-inp-grp" style="margin-bottom:24px;">',
        '<label style="display:block; font-size:11.5px; font-weight:700; color:#18120E; margin-bottom:8px; margin-left:2px;">เลขเริ่มต้น — ขาออก (กนค.'+thYear+'.XX)</label>',
        '<input type="number" id="dn-out-start" class="gnk-inp" value="' + curOutStart + '" min="1" max="999" oninput="updateDNPreview()" ',
          'style="width:100%; height:46px; padding:0 16px; font-size:13px; font-weight:600; border-radius:12px; border:1.5px solid #EBEBEB; background:#fff; transition:all 0.3s; box-sizing:border-box; outline:none; color:#18120E;">',
      '</div>',

      // Preview Box (incoming + outgoing)
      '<div style="display:flex;gap:10px;margin-bottom:8px">',
        '<div style="flex:1;background:#FFF5F0;border-radius:12px;padding:14px 18px;border:1.5px solid #ffc9a8">',
          '<div style="font-size:10px;color:#a89e99;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;font-weight:700">ขาเข้า</div>',
          '<div id="dn-preview" style="font-family:\'IBM Plex Mono\',monospace;font-size:15px;color:#C42800;font-weight:800;letter-spacing:.5px">'+esc(curPrefix)+'-'+thYear+'-001</div>',
        '</div>',
        '<div style="flex:1;background:#EFF6FF;border-radius:12px;padding:14px 18px;border:1.5px solid #BFDBFE">',
          '<div style="font-size:10px;color:#a89e99;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;font-weight:700">ขาออก</div>',
          '<div id="dn-out-preview" style="font-family:\'IBM Plex Mono\',monospace;font-size:15px;color:#1D4ED8;font-weight:800;letter-spacing:.5px">กนค.'+thYear+'.'+String(curOutStart).padStart(2,'0')+'</div>',
        '</div>',
      '</div>',
    '</div>',

    // Footer: ปุ่มหลักสี #E83A00
    '<div class="gnk-pop-foot" style="padding:0 32px 32px 32px; display:flex; gap:10px;">',
      '<button class="gnk-btn-c" style="flex:1; height:44px; border-radius:12px; font-weight:600; font-size:12px; border:1px solid #EBEBEB; background:#fff; color:#6b6560; transition:all 0.2s; cursor:pointer;" onmouseover="this.style.background=\'#F9FAF8\'" onmouseout="this.style.background=\'#fff\'" onclick="gnkClose(\'docnum\')">ยกเลิก</button>',
      '<button class="gnk-btn-p" id="dn-save-btn" data-action="saveDocNumSetting" style="flex:1.8; height:44px; border-radius:12px; font-weight:700; font-size:12px; background:#E83A00; color:#fff; display:flex; align-items:center; justify-content:center; gap:8px; border:none; cursor:pointer; box-shadow: 0 8px 16px -4px rgba(232, 58, 0, 0.4);" onmouseover="this.style.opacity=\'0.9\'" onmouseout="this.style.opacity=\'1\'">',
        _OKSVG + ' บันทึกการตั้งค่า',
      '</button>',
    '</div>',
  '</div>'
].join('');
_gnkOpen('docnum', box);

}

function updateDNPreview(){
  var thYear=new Date().getFullYear()+543;
  var prefix=(($e('dn-prefix')||{}).value||'GNK').trim()||'GNK';
  var outStart=parseInt(($e('dn-out-start')||{}).value)||1;
  var el=$e('dn-preview');
  if(el) el.textContent=prefix+'-'+thYear+'-001';
  var elO=$e('dn-out-preview');
  if(elO) elO.textContent='กนค.'+thYear+'.'+String(Math.max(1,outStart)).padStart(2,'0');
}

async function saveDocNumSetting(){
  var thYear=new Date().getFullYear()+543;
  var prefix=(($e('dn-prefix')||{}).value||'').trim();
  if(!prefix){
    var inp=$e('dn-prefix');
    if(inp){inp.style.borderColor='#C42800';inp.focus();setTimeout(function(){inp.style.borderColor='';},1800);}
    return;
  }
  var outStart=Math.max(1,parseInt(($e('dn-out-start')||{}).value)||1);
  var btn=$e('dn-save-btn');
  if(btn){btn.disabled=true;btn.innerHTML=_SPINSVG+'กำลังบันทึก...';}
  try{
    var ex=await dg('doc_number_settings','?year=eq.'+thYear+'&select=id&limit=1');
    if(ex&&ex.length){
      await dpa('doc_number_settings',ex[0].id,{prefix:prefix,out_start_seq:outStart});
    }else{
      await dp('doc_number_settings',{year:thYear,prefix:prefix,out_start_seq:outStart,created_by:CU.id});
    }
    gnkClose('docnum');
    setTimeout(function(){nav('sys');},220);
  }catch(e){
    if(btn){btn.disabled=false;btn.innerHTML=_OKSVG+'บันทึกการตั้งค่า';}
    showAlert('เกิดข้อผิดพลาด: '+(e.message||e),'er');
  }
}

/* ─── Announcement preview helpers ─── */
function _buildAnnPreview(text, type){
  if(!text) return '';
  var clsMap={info:'al-in',warning:'al-wa',error:'al-er'};
  var icoMap={info:'info',warning:'warn',error:'warn'};
  var cls=clsMap[type]||'al-in';
  var ico=icoMap[type]||'info';
  return '<div style="margin-top:0"><div class="text-[10px] text-[#a89e99] font-bold uppercase tracking-wider mb-1.5">ตัวอย่างบน Dashboard</div>'+
    '<div class="al '+cls+'" style="margin-bottom:0"><span class="al-icon">'+svg(ico,13)+'</span><span style="font-size:12px">'+esc(text)+'</span></div></div>';
}
function _updateAnnPreview(){
  var textEl=document.querySelector('[data-key="system_announcement"]');
  var typeEl=document.querySelector('[data-key="system_announcement_type"]');
  var previewEl=$e('ann-preview');
  if(!previewEl) return;
  var text=textEl?textEl.value:'';
  var type=typeEl?typeEl.value:'info';
  previewEl.innerHTML=text?_buildAnnPreview(text,type):'<div class="text-[11px] text-[#a89e99]">— ไม่มีประกาศ —</div>';
}
async function _clearAnnouncement(){
  var textEl=document.querySelector('[data-key="system_announcement"]');
  if(textEl) textEl.value='';
  var previewEl=$e('ann-preview');
  if(previewEl) previewEl.innerHTML='<div style="font-size:11px;color:#a89e99;padding:8px 0">— ไม่มีประกาศในขณะนี้ —</div>';
  try{
    var ex=await dg('app_settings','?key=eq.system_announcement&select=key&limit=1');
    if(ex&&ex.length){
      await fetch(SU+'/rest/v1/app_settings?key=eq.system_announcement',{method:'PATCH',headers:H,body:JSON.stringify({value:'',updated_by:CU.id,updated_at:new Date().toISOString()})});
    }
    SETT.system_announcement='';
    showAlert('ล้างประกาศเรียบร้อยแล้ว','ok');
    _sysTab='settings'; // คงอยู่ที่ tab settings หลัง reload
    setTimeout(function(){nav('sys');},500);
  }catch(e){showAlert('เกิดข้อผิดพลาด: '+(e.message||e),'er');}
}

/* ══════════════════════════════════════════════
   ⚙️  APP SETTINGS CARD
   ══════════════════════════════════════════════ */
function rAppSettingsCard(settings){
  var sMap={};
  (Array.isArray(settings)?settings:[]).forEach(function(r){sMap[r.key]=r;});

  function _val(key,def){
    var cur=sMap[key]; return cur?cur.value:(SETT[key]!==undefined?String(SETT[key]):(def||''));
  }

  var curAnnouncement=_val('system_announcement','');
  var curAnnType=_val('system_announcement_type','info');

  // ── กลุ่ม 0: ข้อมูลองค์กร ──
  var orgRow=
    '<div style="display:grid;grid-template-columns:1fr 2fr;gap:10px;margin-bottom:12px">'+
      '<div style="background:#FAFAF8;border-radius:12px;padding:14px 16px;border:1px solid #EBEBEB">'+
        '<div style="font-size:11px;font-weight:700;color:#18120E;margin-bottom:2px">ชื่อย่อองค์กร</div>'+
        '<div style="font-size:10px;color:#a89e99;margin-bottom:8px">แสดงใน sidebar เช่น กนค.</div>'+
        '<input id="sett-org-0" data-key="org_name" type="text" class="fi text-[13px]" style="font-weight:700" value="'+esc(_val('org_name','กนค.'))+'" placeholder="กนค.">'+
      '</div>'+
      '<div style="background:#FAFAF8;border-radius:12px;padding:14px 16px;border:1px solid #EBEBEB">'+
        '<div style="font-size:11px;font-weight:700;color:#18120E;margin-bottom:2px">ชื่อระบบ (ย่อ)</div>'+
        '<div style="font-size:10px;color:#a89e99;margin-bottom:8px">แสดงใต้โลโก้ใน sidebar</div>'+
        '<input id="sett-org-1" data-key="system_name" type="text" class="fi text-[13px]" value="'+esc(_val('system_name','ระบบเสนอเอกสาร'))+'" placeholder="ระบบเสนอเอกสาร">'+
      '</div>'+
    '</div>'+
    '<div style="background:#FAFAF8;border-radius:12px;padding:14px 16px;border:1px solid #EBEBEB;margin-bottom:12px">'+
      '<div style="font-size:11px;font-weight:700;color:#18120E;margin-bottom:2px">ชื่อระบบเต็ม</div>'+
      '<div style="font-size:10px;color:#a89e99;margin-bottom:8px">แสดงใต้ชื่อหน้าใน header</div>'+
      '<input id="sett-org-2" data-key="system_full_name" type="text" class="fi text-[13px]" value="'+esc(_val('system_full_name','ระบบเสนอเอกสารอิเล็กทรอนิกส์ กนค.'))+'" placeholder="ระบบเสนอเอกสารอิเล็กทรอนิกส์ กนค.">'+
    '</div>';

  // ── รหัสนิสิต ──
  var sidRow=
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'+
      '<div style="background:#FAFAF8;border-radius:12px;padding:14px 16px;border:1px solid #EBEBEB">'+
        '<div style="font-size:11px;font-weight:700;color:#18120E;margin-bottom:2px">ความยาวรหัสนิสิต</div>'+
        '<div style="font-size:10px;color:#a89e99;margin-bottom:8px">จำนวนหลัก เช่น 10</div>'+
        '<div style="display:flex;align-items:center;gap:8px">'+
          '<input id="sett-sid-0" data-key="student_id_length" type="number" class="fi text-[13px]" style="flex:1;font-weight:700" value="'+esc(_val('student_id_length','10'))+'" min="6" max="20">'+
          '<span style="font-size:11px;color:#a89e99">หลัก</span>'+
        '</div>'+
      '</div>'+
      '<div style="background:#FAFAF8;border-radius:12px;padding:14px 16px;border:1px solid #EBEBEB">'+
        '<div style="font-size:11px;font-weight:700;color:#18120E;margin-bottom:2px">ตัวเลขท้ายรหัส</div>'+
        '<div style="font-size:10px;color:#a89e99;margin-bottom:8px">รหัสต้องลงท้ายด้วย เช่น 27</div>'+
        '<input id="sett-sid-1" data-key="student_id_suffix" type="text" class="fi text-[13px]" style="font-weight:700;font-family:monospace" value="'+esc(_val('student_id_suffix','27'))+'" placeholder="27" maxlength="6">'+
      '</div>'+
    '</div>';

  // ── กลุ่ม 1: ค่าตัวเลขระบบ ──
  var numFields=[
    {key:'sla_cascade_days',    id:'sett-0', label:'SLA ตีกลับ',             unit:'วัน',  desc:'จำนวนวันที่ให้แก้ไขเมื่อถูกตีกลับ', min:1,max:30},
    {key:'session_timeout_min', id:'sett-1', label:'Session หมดอายุ',         unit:'นาที', desc:'เวลาไม่ใช้งานก่อน logout อัตโนมัติ', min:5,max:480},
    {key:'max_file_size_mb',    id:'sett-2', label:'ขนาดไฟล์สูงสุด',          unit:'MB',   desc:'ต่อไฟล์ที่อนุญาตให้อัปโหลด',          min:1,max:100},
  ];
  var numRow=numFields.map(function(f){
    return '<div style="background:#FAFAF8;border-radius:12px;padding:14px 16px;border:1px solid #EBEBEB">'+
      '<div style="font-size:11px;font-weight:700;color:#18120E;margin-bottom:2px">'+f.label+'</div>'+
      '<div style="font-size:10px;color:#a89e99;margin-bottom:8px">'+f.desc+'</div>'+
      '<div style="display:flex;align-items:center;gap:8px">'+
        '<input id="'+f.id+'" data-key="'+f.key+'" type="number" class="fi text-[13px]" style="flex:1;font-weight:700" value="'+esc(_val(f.key,''))+'" min="'+f.min+'" max="'+f.max+'">'+
        '<span style="font-size:11px;color:#a89e99;white-space:nowrap">'+f.unit+'</span>'+
      '</div>'+
    '</div>';
  }).join('');

  // ── กลุ่ม 2: อีเมล prefix ──
  var emailRow='<div style="background:#FAFAF8;border-radius:12px;padding:14px 16px;border:1px solid #EBEBEB;margin-top:12px">'+
    '<div style="font-size:11px;font-weight:700;color:#18120E;margin-bottom:2px">คำนำหน้า Subject อีเมล</div>'+
    '<div style="font-size:10px;color:#a89e99;margin-bottom:8px">ใส่วงเล็บด้วย เช่น [กนค.] หรือ [EDU]</div>'+
    '<input id="sett-3" data-key="email_prefix" type="text" class="fi text-[13px]" value="'+esc(_val('email_prefix',''))+'">'+
  '</div>';

  // ── กลุ่ม 3: ประกาศระบบ ──
  var annTypeOpts=['info','warning','error'].map(function(o){
    var labels={info:'ℹ️ ข้อมูล',warning:'⚠️ คำเตือน',error:'🔴 ข้อผิดพลาด'};
    return '<option value="'+o+'"'+(o===curAnnType?' selected':'')+'>'+labels[o]+'</option>';
  }).join('');

  var annRow='<div style="background:#FAFAF8;border-radius:12px;padding:16px;border:1px solid #EBEBEB;margin-top:12px">'+
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'+
      '<div>'+
        '<div style="font-size:11px;font-weight:700;color:#18120E">ประกาศระบบ</div>'+
        '<div style="font-size:10px;color:#a89e99;margin-top:2px">แสดงบน Dashboard ทุกคน — เว้นว่างเพื่อปิดประกาศ</div>'+
      '</div>'+
      (curAnnouncement?'<button class="btn btn-soft xs" onclick="_clearAnnouncement()" style="color:#DC2626;border-color:#FECACA">'+svg('x',12)+' ล้างประกาศ</button>':'')+
    '</div>'+
    '<div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:flex-start">'+
      '<textarea id="sett-4" data-key="system_announcement" rows="3" class="fi text-[12px]" style="resize:vertical" oninput="_updateAnnPreview()" placeholder="พิมพ์ข้อความประกาศที่นี่...">'+esc(curAnnouncement)+'</textarea>'+
      '<select id="sett-5" data-key="system_announcement_type" class="fi text-[12px]" style="width:130px" onchange="_updateAnnPreview()">'+annTypeOpts+'</select>'+
    '</div>'+
    '<div id="ann-preview" style="margin-top:10px">'+(curAnnouncement?_buildAnnPreview(curAnnouncement,curAnnType):'<div style="font-size:11px;color:#a89e99;padding:8px 0">— ไม่มีประกาศในขณะนี้ —</div>')+'</div>'+
  '</div>';

  return '<div class="card" style="margin-bottom:0">'+
    '<div class="card-head">'+
      '<div style="width:26px;height:26px;border-radius:7px;background:#FFF3EE;display:flex;align-items:center;justify-content:center;color:#E83A00;flex-shrink:0">'+svg('gear',13)+'</div>'+
      '<span class="card-head-title">ตั้งค่าระบบ</span>'+
      '<button class="btn btn-primary sm ml-auto" data-action="saveAppSettings">'+svg('ok',12)+' บันทึก</button>'+
    '</div>'+
    '<div id="sett-al"></div>'+
    '<div style="padding:16px 20px 20px">'+
      '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:#a89e99;margin-bottom:10px">ข้อมูลองค์กร</div>'+
      orgRow+
      '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:#a89e99;margin:14px 0 10px">รูปแบบรหัสนิสิต</div>'+
      sidRow+
      '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:#a89e99;margin:14px 0 10px">ค่าตัวเลขระบบ</div>'+
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">'+numRow+'</div>'+
      emailRow+
      '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:#a89e99;margin:18px 0 8px">ประกาศระบบ</div>'+
      annRow+
    '</div>'+
  '</div>';
}

async function saveAppSettings(){
  var btn=document.querySelector('[data-action="saveAppSettings"]');
  if(btn){btn.disabled=true;btn.innerHTML=_SPINSVG+'กำลังบันทึก...';}
  var al=$e('sett-al');
  try{
    var inputs=document.querySelectorAll('[id^="sett-"][data-key]');
    for(var i=0;i<inputs.length;i++){
      var el=inputs[i], key=el.dataset.key, val=el.value;
      var ex=await dg('app_settings','?key=eq.'+encodeURIComponent(key)+'&select=key&limit=1');
      if(ex&&ex.length){
        await fetch(SU+'/rest/v1/app_settings?key=eq.'+encodeURIComponent(key),{method:'PATCH',headers:H,body:JSON.stringify({value:val,updated_by:CU.id,updated_at:new Date().toISOString()})});
      }else{
        var _vtype=el.type==='number'?'number':(val==='true'||val==='false'?'boolean':'text');
        await dp('app_settings',{key:key,value:val,label:key,value_type:_vtype,updated_by:CU.id,updated_at:new Date().toISOString()});
      }
      SETT[key]=isNaN(+val)||val===''?val:+val;
    }
    if(al) al.innerHTML='<div class="al al-ok mb-2"><span class="al-icon">'+svg('ok',13)+'</span><span>บันทึกการตั้งค่าเรียบร้อยแล้ว</span></div>';
    await loadAppSettings();
  }catch(e){
    if(al) al.innerHTML='<div class="al al-er mb-2"><span class="al-icon">'+svg('warn',13)+'</span><span>เกิดข้อผิดพลาด: '+esc(e.message||String(e))+'</span></div>';
  }finally{
    if(btn){btn.disabled=false;btn.innerHTML=svg('ok',12)+' บันทึกทั้งหมด';}
  }
}

/* ══════════════════════════════════════════════
   📧  EMAIL TEMPLATES CARD
   ══════════════════════════════════════════════ */
function rEmailTemplatesCard(templates){
  var tMap={};
  (Array.isArray(templates)?templates:[]).forEach(function(t){tMap[t.key]=t;});
  var _ACTIONS=[
    {key:'approve',   ico:'ok',      bg:'#F0FDF4', ic:'#15803D', label:'อนุมัติ / ส่งต่อ'},
    {key:'reject',    ico:'undo',    bg:'#FEF2F2', ic:'#DC2626', label:'ส่งคืนแก้ไข'},
    {key:'create',    ico:'plus',    bg:'#EFF6FF', ic:'#2563EB', label:'เอกสารใหม่รอดำเนินการ'},
    {key:'completed', ico:'ok',      bg:'#F0FDF4', ic:'#15803D', label:'เอกสารเสร็จสิ้น'},
    {key:'numbering', ico:'pen',     bg:'#FFF5F0', ic:'#E83A00', label:'รอออกเลขหนังสือ'},
    {key:'overdue',   ico:'clock',   bg:'#FFFBEB', ic:'#D97706', label:'เตือนเลยกำหนด'}
  ];
  var rows=_ACTIONS.map(function(a,i){
    var t=tMap[a.key]||{};
    return '<tr>'+
      '<td style="white-space:nowrap">'+
        '<div style="display:inline-flex;align-items:center;gap:7px">'+
          '<div style="width:22px;height:22px;border-radius:6px;background:'+a.bg+';display:flex;align-items:center;justify-content:center;color:'+a.ic+';flex-shrink:0">'+svg(a.ico,11)+'</div>'+
          '<span style="font-size:12px;font-weight:600;color:#18120E">'+a.label+'</span>'+
        '</div>'+
      '</td>'+
      '<td><input id="et-sfx-'+i+'" data-etkey="'+a.key+'" data-field="subject_suffix" class="fi" style="font-size:12px;min-width:160px" placeholder="ต่อท้าย subject อีเมล" value="'+esc(t.subject_suffix||'')+'"></td>'+
      '<td><input id="et-note-'+i+'" data-etkey="'+a.key+'" data-field="extra_note" class="fi" style="font-size:12px;min-width:200px" placeholder="ข้อความเพิ่มในเนื้อหาอีเมล" value="'+esc(t.extra_note||'')+'"></td>'+
    '</tr>';
  }).join('');

  return '<div class="card" style="margin-bottom:0">'+
    '<div class="card-head">'+
      '<div style="width:26px;height:26px;border-radius:7px;background:#EFF6FF;display:flex;align-items:center;justify-content:center;color:#2563EB;flex-shrink:0">'+svg('bell',13)+'</div>'+
      '<span class="card-head-title">ตั้งค่าอีเมลแจ้งเตือน</span>'+
      '<button class="btn btn-primary sm ml-auto" data-action="saveEmailTemplates">'+svg('ok',12)+' บันทึก</button>'+
    '</div>'+
    '<div style="padding:14px 20px 0">'+
      '<div class="al al-in" style="margin-bottom:0"><span class="al-icon">'+svg('info',13)+'</span>'+
        '<span style="font-size:12px"><strong>Subject suffix</strong> ต่อท้าย subject อีเมลหลักโดยอัตโนมัติ · <strong>Extra note</strong> แสดงในเนื้อหาอีเมลเป็น callout สีส้มอ่อน</span>'+
      '</div>'+
    '</div>'+
    '<div id="et-al"></div>'+
    '<div class="tbl-wrap" style="margin:12px 0 0">'+
      '<table><thead><tr>'+
        '<th>เหตุการณ์</th>'+
        '<th>Subject suffix</th>'+
        '<th>Extra note ในเนื้ออีเมล</th>'+
      '</tr></thead><tbody>'+rows+'</tbody></table>'+
    '</div>'+
  '</div>';
}

async function saveEmailTemplates(){
  var btn=document.querySelector('[data-action="saveEmailTemplates"]');
  if(btn){btn.disabled=true;btn.innerHTML=_SPINSVG+'กำลังบันทึก...';}
  var al=$e('et-al');
  try{
    var sfxEls=document.querySelectorAll('[data-field="subject_suffix"]');
    for(var i=0;i<sfxEls.length;i++){
      var k=sfxEls[i].dataset.etkey;
      var sfx=sfxEls[i].value;
      var note=document.getElementById('et-note-'+i);
      var noteVal=note?note.value:'';
      var ex=await dg('email_templates','?key=eq.'+encodeURIComponent(k)+'&select=key&limit=1');
      if(ex&&ex.length){
        await fetch(SU+'/rest/v1/email_templates?key=eq.'+encodeURIComponent(k),{method:'PATCH',headers:H,body:JSON.stringify({subject_suffix:sfx,extra_note:noteVal,updated_by:CU.id,updated_at:new Date().toISOString()})});
      }else{
        await dp('email_templates',{key:k,label:k,subject_suffix:sfx,extra_note:noteVal,updated_by:CU.id,updated_at:new Date().toISOString()});
      }
    }
    if(al) al.innerHTML='<div class="al al-ok mx-4 mb-2"><span class="al-icon">'+svg('ok',13)+'</span><span>บันทึกเรียบร้อยแล้ว</span></div>';
  }catch(e){
    if(al) al.innerHTML='<div class="al al-er mx-4 mb-2"><span class="al-icon">'+svg('warn',13)+'</span><span>เกิดข้อผิดพลาด: '+esc(e.message||String(e))+'</span></div>';
  }finally{
    if(btn){btn.disabled=false;btn.innerHTML=svg('ok',12)+' บันทึก';}
  }
}

/* ══════════════════════════════════════════════
   🔄  WORKFLOW TEMPLATES CARD
   ══════════════════════════════════════════════ */
var _wfTplSteps=[];  // working steps array สำหรับ modal ที่เปิดอยู่
var _wfTplUsers=[];  // users list สำหรับ dropdown ใน modal

function rWfTemplatesCard(templates){
  var byType={incoming:[],outgoing:[],certificate:[],memo:[]};
  (Array.isArray(templates)?templates:[]).forEach(function(t){
    if(byType[t.doc_type]) byType[t.doc_type].push(t);
  });
  var dtLabels={incoming:'หนังสือขาเข้า',outgoing:'หนังสือขาออก',certificate:'หนังสือรับรอง',memo:'บันทึกข้อความ'};

  var sections=Object.keys(byType).map(function(dt){
    var tmpls=byType[dt];
    var rows=tmpls.length?tmpls.map(function(t){
      var _sc=t._stepCount||0;
      var _scBadge='<span style="font-size:10px;color:#a89e99;background:#F5F3F0;border-radius:6px;padding:1px 7px;white-space:nowrap">'+
        (_sc>0?_sc+' step':(_sc===0?'— ยังไม่มี step':''))+
      '</span>';
      return '<div style="display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid #F5F5F5">'+
        (t.is_default?'<span class="badge b-signed" style="font-size:10px;padding:2px 8px;flex-shrink:0">Default</span>':
          '<button class="btn btn-soft xs" data-action="setDefaultWfTemplate" data-id="'+t.id+'" data-doctype="'+dt+'" title="ตั้งเป็น Default" style="flex-shrink:0">'+svg('ok',10)+' ตั้ง default</button>')+
        '<span style="flex:1;font-size:12px;font-weight:600;color:#18120E">'+esc(t.name)+'</span>'+
        _scBadge+
        '<button class="btn btn-soft xs" data-action="showWfTemplateModal" data-id="'+t.id+'" data-doctype="'+dt+'" title="แก้ไข">'+svg('edit',12)+'</button>'+
        '<button class="btn btn-soft xs" style="color:#DC2626" data-action="deleteWfTemplate" data-id="'+t.id+'" title="ลบ">'+svg('trash',12)+'</button>'+
      '</div>';
    }).join(''):'<div style="font-size:12px;color:#a89e99;padding:12px 0">ยังไม่มี template — กด "+ เพิ่ม" เพื่อสร้าง</div>';

    var dtIcoMap={incoming:'doc',outgoing:'sign',certificate:'ok',memo:'edit'};
    return '<div style="padding:16px 20px;border-bottom:1px solid #F5F3F0">'+
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">'+
        '<div style="width:22px;height:22px;border-radius:6px;background:#F5F3F0;display:flex;align-items:center;justify-content:center;color:#6b6560;flex-shrink:0">'+svg(dtIcoMap[dt]||'doc',12)+'</div>'+
        '<span style="font-size:12px;font-weight:700;color:#18120E">'+dtLabels[dt]+'</span>'+
        '<span style="font-size:11px;color:#a89e99;margin-left:2px">('+tmpls.length+' template)</span>'+
        '<button class="btn btn-primary xs ml-auto" data-action="showWfTemplateModal" data-id="" data-doctype="'+dt+'">'+svg('plus',11)+' เพิ่ม</button>'+
      '</div>'+
      rows+
    '</div>';
  }).join('');

  return '<div class="card" style="margin-bottom:16px">'+
    '<div class="card-head">'+
      '<div class="w-[26px] h-[26px] rounded-[7px] bg-[#F0FDF4] flex items-center justify-center text-[#16A34A] shrink-0">'+svg('refresh',13)+'</div>'+
      '<span class="card-head-title">Workflow Templates</span>'+
    '</div>'+
    '<div class="card-body pb-0">'+
      '<div class="al al-in mb-3"><span class="al-icon">'+svg('info',13)+'</span><span class="text-[12px]">Template ที่ตั้งเป็น Default จะถูกโหลดอัตโนมัติเมื่อผู้ใช้เลือกประเภทเอกสาร</span></div>'+
    '</div>'+
    sections+
  '</div>';
}

async function showWfTemplateModal(tmplId, docType){
  var w=$e('mwrap'); if(!w)return;
  _wfTplSteps=[];
  _wfTplUsers=await dg('users','?is_active=eq.true&approval_status=eq.approved&role_code=neq.ROLE-SYS&order=full_name&select=id,full_name,role_code');
  var tmplName='';
  if(tmplId){
    try{
      var tmpl=(await dg('workflow_templates','?id=eq.'+safeId(tmplId)))[0]||{};
      tmplName=tmpl.name||'';
      _wfTplSteps=await dg('workflow_template_steps','?template_id=eq.'+safeId(tmplId)+'&order=step_number');
    }catch(e){}
  }
  var dtLabels={incoming:'หนังสือขาเข้า',outgoing:'หนังสือขาออก',certificate:'หนังสือรับรอง',memo:'บันทึกข้อความ'};
  w.innerHTML=[
    '<div class="mo"><div class="modal" style="max-width:580px">',
    '<div class="modal-head"><span class="modal-title">'+svg('refresh',14)+(tmplId?' แก้ไข':' สร้าง')+' Workflow Template — '+esc(dtLabels[docType]||docType)+'</span>',
    '<button class="btn btn-soft sm btn-icon" data-action="closeModal">'+svg('x',14)+'</button></div>',
    '<div class="modal-body">',
    '<div class="fg"><label class="fl">ชื่อ Template <span class="req">*</span></label>',
    '<input class="fi" id="wft-name" value="'+esc(tmplName)+'" placeholder="เช่น วาระปกติ, ด่วน, บริษัทนอก..."></div>',
    '<div class="fg">',
    '<label class="fl">ขั้นตอนใน Workflow</label>',
    '<div class="al al-in mb-2"><span class="al-icon">'+svg('info',12)+'</span><span class="text-[11px]">Step ผู้จัดทำ (Step 1) จะถูกเพิ่มอัตโนมัติ — ระบุเฉพาะขั้นตอนหลังจากนั้น</span></div>',
    '<div id="wft-steps">'+_renderWfTplSteps()+'</div>',
    '<button class="btn btn-soft sm mt-2" data-action="addWfTplStep">'+svg('plus',12)+' เพิ่มขั้นตอน</button>',
    '</div>',
    '</div>',
    '<div class="modal-foot">',
    '<button class="btn btn-soft" data-action="closeModal">ยกเลิก</button>',
    '<button class="btn btn-primary" data-action="saveWfTemplate" data-tmplid="'+(tmplId||'')+'" data-doctype="'+docType+'">'+svg('ok',13)+' บันทึก Template</button>',
    '</div></div></div>'
  ].join('');
}

function _renderWfTplSteps(){
  if(!_wfTplSteps.length){
    return '<div class="text-[12px] text-[#a89e99] py-2 px-1">— ยังไม่มีขั้นตอน (template จะมีแค่ Step ผู้จัดทำ) —</div>';
  }
  var uOpts='<option value="">— ไม่ระบุ (ผู้สร้างเอกสารเลือกเอง) —</option>'+
    (Array.isArray(_wfTplUsers)?_wfTplUsers:[]).map(function(u){
      return '<option value="'+u.id+'">'+esc(u.full_name)+' ('+esc(RTH[u.role_code]||u.role_code)+')</option>';
    }).join('');
  return _wfTplSteps.map(function(s,i){
    return '<div class="flex gap-2 items-start mb-2 p-2 bg-[#FAFAFA] rounded-[10px] border border-[#EBEBEB]">'+
      '<div class="text-[10px] font-bold text-[#a89e99] mt-2 shrink-0 w-8 text-center">'+svg('grip',14)+'</div>'+
      '<div class="flex-1 flex flex-col gap-1.5">'+
        '<input class="fi text-[12px]" value="'+esc(s.step_name)+'" placeholder="ชื่อขั้นตอน" oninput="_wfTplSteps['+i+'].step_name=this.value">'+
        '<select class="fi text-[12px]" onchange="_wfTplSteps['+i+'].assigned_to=this.value||null">'+
          uOpts.replace('value="'+(s.assigned_to||'')+'"','value="'+(s.assigned_to||'')+'" selected')+
        '</select>'+
        '<div class="flex gap-2 items-center">'+
          '<label class="text-[11px] text-[#a89e99]">SLA:</label>'+
          '<input type="number" class="fi text-[12px]" style="width:60px" min="1" max="30" value="'+(s.deadline_days||2)+'" oninput="_wfTplSteps['+i+'].deadline_days=+this.value||2">'+
          '<span class="text-[11px] text-[#a89e99]">วัน</span>'+
        '</div>'+
      '</div>'+
      '<button class="btn btn-soft xs mt-1 shrink-0" style="color:#ef4444" data-action="rmWfTplStep" data-id="'+i+'">'+svg('x',12)+'</button>'+
    '</div>';
  }).join('');
}

function addWfTplStep(){
  _wfTplSteps.push({step_name:'',role_required:'',assigned_to:null,deadline_days:2,locked:false});
  var el=$e('wft-steps'); if(el) el.innerHTML=_renderWfTplSteps();
}
function rmWfTplStep(idx){
  _wfTplSteps.splice(idx,1);
  var el=$e('wft-steps'); if(el) el.innerHTML=_renderWfTplSteps();
}

async function saveWfTemplate(existingId){
  var name=(gv('wft-name')||'').trim();
  if(!name){showAlert('กรุณาระบุชื่อ Template','wa');return}
  var btn=document.querySelector('[data-action="saveWfTemplate"]');
  var docType=btn?btn.dataset.doctype:'';
  if(btn){btn.disabled=true;btn.innerHTML='<span class="sp"></span> กำลังบันทึก...';}
  try{
    var tmplId=existingId;
    if(tmplId){
      await fetch(SU+'/rest/v1/workflow_templates?id=eq.'+safeId(tmplId),{method:'PATCH',headers:H,body:JSON.stringify({name:name})});
      // ลบ steps เก่า
      await fetch(SU+'/rest/v1/workflow_template_steps?template_id=eq.'+safeId(tmplId),{method:'DELETE',headers:{apikey:SK,'Authorization':'Bearer '+SK}});
    }else{
      var nr=await dp('workflow_templates',{doc_type:docType,name:name,is_default:false,created_by:CU.id});
      tmplId=nr&&nr[0]?nr[0].id:null;
    }
    if(!tmplId) throw new Error('ไม่สามารถสร้าง Template ได้');
    for(var i=0;i<_wfTplSteps.length;i++){
      var s=_wfTplSteps[i];
      if(!s.step_name.trim()) continue;
      await dp('workflow_template_steps',{template_id:tmplId,step_number:i+1,step_name:s.step_name.trim(),role_required:s.role_required||'',assigned_to:s.assigned_to||null,deadline_days:s.deadline_days||2,locked:!!s.locked});
    }
    var mw=$e('mwrap'); if(mw) mw.innerHTML='';
    setTimeout(function(){nav('sys');},200);
  }catch(e){
    showAlert('เกิดข้อผิดพลาด: '+(e.message||String(e)),'er');
    if(btn){btn.disabled=false;btn.innerHTML=svg('ok',13)+' บันทึก Template';}
  }
}

async function deleteWfTemplate(tmplId){
  showConfirm('ลบ Template?','Template นี้จะถูกลบถาวรพร้อม steps ทั้งหมด',
    async function(){
      try{
        await fetch(SU+'/rest/v1/workflow_templates?id=eq.'+safeId(tmplId),{method:'DELETE',headers:{apikey:SK,'Authorization':'Bearer '+SK}});
        nav('sys');
      }catch(e){showAlert('เกิดข้อผิดพลาด: '+(e.message||e),'er');}
    },
    {confirmLabel:'ลบ',confirmClass:'btn-danger',icon:'trash',iconBg:'#FEF2F2',iconColor:'#DC2626'}
  );
}

async function setDefaultWfTemplate(tmplId, docType){
  try{
    // ถอด default จาก template อื่นใน doc type เดียวกัน
    await fetch(SU+'/rest/v1/workflow_templates?doc_type=eq.'+encodeURIComponent(docType),{method:'PATCH',headers:H,body:JSON.stringify({is_default:false})});
    // ตั้ง default ใหม่
    await fetch(SU+'/rest/v1/workflow_templates?id=eq.'+safeId(tmplId),{method:'PATCH',headers:H,body:JSON.stringify({is_default:true})});
    nav('sys');
  }catch(e){showAlert('เกิดข้อผิดพลาด: '+(e.message||e),'er');}
}

/* ══════════════════════════════════════════════
   📁  PROJECTS CARD — จัดการรายชื่อโครงการ
   ══════════════════════════════════════════════ */
function rProjectsCard(rows){
  var isErr=!Array.isArray(rows)||(rows&&rows.code);
  if(!Array.isArray(rows)) rows=[];

  // ── Card header ──
  var html='<div class="card">'+
    '<div class="card-head">'+
      '<div style="width:28px;height:28px;border-radius:8px;background:#FFF5EE;display:flex;align-items:center;justify-content:center;color:#E83A00;flex-shrink:0">'+svg('folder',14)+'</div>'+
      '<span class="card-head-title">รายชื่อโครงการ / กิจกรรม</span>'+
      '<span style="display:inline-flex;align-items:center;justify-content:center;background:#F5F3F0;color:#6b6560;font-size:11px;font-weight:700;border-radius:8px;padding:2px 9px;margin-left:6px">'+rows.length+' รายการ</span>'+
    '</div>'+
    '<div class="card-body" style="padding:16px">';

  if(isErr){
    html+=alrtH('er','ยังไม่ได้สร้างตาราง <code>projects</code> ในฐานข้อมูล — กรุณารัน SQL ด้านล่างใน Supabase → SQL Editor');
    html+='<pre style="font-size:11px;background:#F5F3F0;padding:12px;border-radius:8px;overflow-x:auto;margin-top:8px;white-space:pre-wrap">'+
      'CREATE TABLE projects (\n  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,\n'+
      '  name text NOT NULL,\n  is_active boolean DEFAULT true,\n'+
      '  sort_order integer DEFAULT 0,\n  created_at timestamptz DEFAULT now(),\n'+
      '  created_by uuid REFERENCES users(id)\n);\n'+
      'ALTER TABLE projects ENABLE ROW LEVEL SECURITY;\n'+
      'CREATE POLICY "allow_all" ON projects USING (true) WITH CHECK (true);'+
      '</pre></div></div>';
    return html;
  }

  // ── Add form ──
  html+='<div style="display:flex;gap:8px;margin-bottom:14px">'+
    '<input class="fi" id="proj-new-name" placeholder="ชื่อโครงการ / กิจกรรมใหม่" style="flex:1" '+
      'onkeydown="if(event.key===\'Enter\')addProject()">'+
    '<button class="btn btn-primary sm" onclick="addProject()">'+svg('plus',13)+' เพิ่ม</button>'+
  '</div>';
  html+='<div id="proj-alert"></div>';

  // ── List ──
  if(!rows.length){
    html+='<div style="text-align:center;padding:32px 16px;color:#a89e99">'+
      '<div style="font-size:28px;margin-bottom:8px">📁</div>'+
      '<div style="font-size:13px;font-weight:600;color:#6b6560">ยังไม่มีโครงการในระบบ</div>'+
      '<div style="font-size:11px;margin-top:4px">เพิ่มโครงการแรกด้านบน</div>'+
    '</div>';
  } else {
    html+='<div style="border:1px solid #EBEBEB;border-radius:12px;overflow:hidden">';
    rows.forEach(function(r,i){
      var isActive=r.is_active!==false;
      var sid=safeId(r.id);
      var divider=i>0?'border-top:1px solid #F5F3F0;':'';
      html+=
        '<div id="proj-row-'+sid+'" style="'+divider+'display:flex;align-items:center;gap:10px;padding:11px 16px;background:'+(isActive?'#fff':'#FAFAF8')+'">'+
          // status dot
          '<div style="width:9px;height:9px;border-radius:50%;background:'+(isActive?'#16A34A':'#d0cac6')+';flex-shrink:0"></div>'+
          // display mode: name
          '<div id="proj-display-'+sid+'" style="flex:1;font-size:13px;font-weight:600;color:'+(isActive?'#18120E':'#a89e99')+';'+(isActive?'':'text-decoration:line-through')+'">'+ esc(r.name)+'</div>'+
          // edit mode: input (hidden)
          '<input id="proj-edit-inp-'+sid+'" style="display:none;flex:1;font-size:13px;font-weight:600;border:1.5px solid #E83A00;border-radius:8px;padding:4px 10px;outline:none;background:#fff;min-width:0" '+
            'value="'+esc(r.name)+'" '+
            'onkeydown="if(event.key===\'Enter\')saveProjectName(\''+sid+'\');if(event.key===\'Escape\')cancelEditProject(\''+sid+'\')">'+
          // edit button (shown in display mode)
          '<button id="proj-btn-edit-'+sid+'" class="btn btn-soft xs" onclick="editProject(\''+sid+'\')" title="เปลี่ยนชื่อ" style="display:inline-flex;align-items:center;gap:4px">'+svg('edit',12)+'</button>'+
          // save button (hidden, shown in edit mode)
          '<button id="proj-btn-save-'+sid+'" class="btn btn-primary xs" style="display:none;align-items:center;gap:4px" onclick="saveProjectName(\''+sid+'\')" title="บันทึก">'+svg('ok',12)+'</button>'+
          // cancel button (hidden, shown in edit mode)
          '<button id="proj-btn-cancel-'+sid+'" class="btn btn-soft xs" style="display:none;align-items:center;gap:4px" onclick="cancelEditProject(\''+sid+'\')" title="ยกเลิก">'+svg('x',12)+'</button>'+
          // toggle active/inactive
          '<button id="proj-btn-toggle-'+sid+'" class="btn btn-soft xs" onclick="toggleProject(\''+sid+'\','+isActive+')" style="display:inline-flex;align-items:center;gap:4px;color:'+(isActive?'#16A34A':'#a89e99')+'">'+
            svg('eye',12)+(isActive?' ใช้งาน':' ซ่อน')+
          '</button>'+
          // delete
          '<button class="btn xs" style="color:#DC2626;border:1px solid #FECACA;background:#FEF2F2;display:inline-flex;align-items:center" onclick="deleteProject(\''+sid+'\')" title="ลบ">'+svg('trash',12)+'</button>'+
        '</div>';
    });
    html+='</div>';
  }

  html+='</div></div>';
  return html;
}

function editProject(id){
  var disp=$e('proj-display-'+id);
  var inp=$e('proj-edit-inp-'+id);
  var btnEdit=$e('proj-btn-edit-'+id);
  var btnSave=$e('proj-btn-save-'+id);
  var btnCancel=$e('proj-btn-cancel-'+id);
  var btnToggle=$e('proj-btn-toggle-'+id);
  if(disp) disp.style.display='none';
  if(inp){inp.style.display='block';inp.focus();inp.select();}
  if(btnEdit) btnEdit.style.display='none';
  if(btnSave) btnSave.style.display='inline-flex';
  if(btnCancel) btnCancel.style.display='inline-flex';
  if(btnToggle) btnToggle.style.display='none';
}

function cancelEditProject(id){
  var disp=$e('proj-display-'+id);
  var inp=$e('proj-edit-inp-'+id);
  var btnEdit=$e('proj-btn-edit-'+id);
  var btnSave=$e('proj-btn-save-'+id);
  var btnCancel=$e('proj-btn-cancel-'+id);
  var btnToggle=$e('proj-btn-toggle-'+id);
  if(disp) disp.style.display='block';
  if(inp) inp.style.display='none';
  if(btnEdit) btnEdit.style.display='inline-flex';
  if(btnSave) btnSave.style.display='none';
  if(btnCancel) btnCancel.style.display='none';
  if(btnToggle) btnToggle.style.display='inline-flex';
}

async function saveProjectName(id){
  var inp=$e('proj-edit-inp-'+id);
  var name=inp?inp.value.trim():'';
  if(!name){showAlert('กรุณาระบุชื่อโครงการ','wa');return;}
  var res=await dpa('projects',id,{name:name});
  if(res&&res.code){showAlert('เกิดข้อผิดพลาด: '+(res.message||res.code),'er');return;}
  await loadProjects();
  _sysTab='projects';
  nav('sys');
}

async function addProject(){
  var nameEl=$e('proj-new-name');
  var name=(nameEl?nameEl.value:'').trim();
  var al=$e('proj-alert');
  if(!name){if(al)al.innerHTML=alrtH('er','กรุณาระบุชื่อโครงการ');return}
  if(al)al.innerHTML='<div class="al al-in"><span class="sp sp-dark"></span><span> กำลังบันทึก...</span></div>';
  var res=await dp('projects',{name:name,is_active:true,sort_order:0,created_by:CU.id});
  if(!Array.isArray(res)||!res.length){
    var msg=(res&&res.message)||'บันทึกไม่สำเร็จ กรุณาตรวจสอบ RLS หรือว่าสร้างตาราง projects แล้วหรือยัง';
    if(al)al.innerHTML=alrtH('er',msg);
    return;
  }
  await loadProjects();
  _sysTab='projects';
  nav('sys');
}

async function toggleProject(id,currentActive){
  var res=await dpa('projects',id,{is_active:!currentActive});
  if(res&&res.code){showAlert('เกิดข้อผิดพลาด: '+(res.message||res.code),'er');return}
  await loadProjects();
  _sysTab='projects';
  nav('sys');
}

function deleteProject(id){
  showConfirm('ลบโครงการ?','ลบโครงการนี้ออกจากระบบ ไม่กระทบเอกสารที่มีอยู่แล้ว',
    function(){_doDeleteProject(id);},
    {confirmLabel:'ลบ',confirmClass:'btn-danger',icon:'trash',iconBg:'#FEF2F2',iconColor:'#DC2626'}
  );
}
async function _doDeleteProject(id){
  var r=await fetch(SU+'/rest/v1/projects?id=eq.'+safeId(id),{method:'DELETE',headers:H});
  if(!r.ok){var e=await r.json();showAlert('เกิดข้อผิดพลาด: '+((e&&e.message)||r.status),'er');return}
  await loadProjects();
  _sysTab='projects';
  nav('sys');
}

/* ══════════════════════════════════════════════
   📋  REFERENCE DATA CARD — รายการอ้างอิง
   ══════════════════════════════════════════════ */
var _rdLT=[], _rdOT=[], _rdCL=[], _rdSP=[], _rdPOS=[];

function rRefDataCard(){
  _rdLT=LETTER_TYPES.slice();
  _rdOT=OUT_LTYPES.slice(1);
  _rdCL=Object.keys(CLUBS).map(function(k){return{code:k,name:CLUBS[k]};});
  _rdSP=SENDER_POS.map(function(p){return{name:p.name,code:String(p.code),isClub:!!p.isClub};});
  _rdPOS=POSS.map(function(c){return{code:c,name:PTH[c]||'',num:GNK_NUM[c]||'',role:PR[c]||'ROLE-CRT'};});

  function _rdCard(id,title,ico,subtitle,listHtml,noAdd){
    return '<div class="card" style="margin-bottom:0">'+
      '<div class="card-head">'+
        '<div style="width:26px;height:26px;border-radius:7px;background:#FFF5EE;display:flex;align-items:center;justify-content:center;color:#E83A00;flex-shrink:0">'+svg(ico,13)+'</div>'+
        '<div><div class="card-head-title">'+title+'</div>'+
          '<div style="font-size:10px;color:#a89e99;margin-top:1px">'+subtitle+'</div>'+
        '</div>'+
        '<div style="margin-left:auto;display:flex;gap:6px;align-items:center">'+
          (!noAdd?'<button class="btn btn-soft sm" onclick="_rdAdd(\''+id+'\')">'+svg('plus',12)+' เพิ่ม</button>':'')+
          '<button class="btn btn-primary sm" onclick="_rdSave(\''+id+'\')">'+svg('ok',12)+' บันทึก</button>'+
        '</div>'+
      '</div>'+
      '<div id="rd-'+id+'-al"></div>'+
      '<div id="rd-'+id+'-list" style="padding:8px 16px 16px">'+listHtml+'</div>'+
    '</div>';
  }

  function _grpHead(label,desc,color){
    color=color||'#E83A00';
    return '<div style="display:flex;align-items:center;gap:12px;padding:6px 0 2px">'+
      '<div style="width:4px;height:36px;border-radius:3px;background:'+color+';flex-shrink:0"></div>'+
      '<div>'+
        '<div style="font-size:13px;font-weight:800;color:#18120E;letter-spacing:-.2px">'+label+'</div>'+
        '<div style="font-size:11px;color:#a89e99;margin-top:1px">'+desc+'</div>'+
      '</div>'+
    '</div>';
  }

  return '<div style="display:flex;flex-direction:column;gap:20px">'+

    /* ── หมวด 1: ประเภทเอกสาร ── */
    _grpHead('ประเภทเอกสาร','รายการที่แสดงในฟอร์มสร้างหนังสือขาเข้าและขาออก','#E83A00')+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+
      _rdCard('lt','หนังสือขาเข้า','doc','ประเภทเรื่องที่ผู้ใช้เลือกได้',_renderRdLT())+
      _rdCard('ot','หนังสือขาออก','sign','ประเภทจดหมายขาออก',_renderRdOT())+
    '</div>'+

    /* ── หมวด 2: ชมรม & ผู้ส่งหนังสือ ── */
    _grpHead('ชมรม & ผู้ส่งหนังสือ','ใช้ในฟอร์มออกเลขหนังสือขาออก','#2563EB')+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+
      _rdCard('cl','รายชื่อชมรม','folder','รหัส 2 หลัก + ชื่อชมรม (suffix เลขขาออก)',_renderRdCL())+
      _rdCard('sp','ตำแหน่งผู้ส่งหนังสือ','user','ตำแหน่งที่เลือกได้ในฟอร์มออกเลข',_renderRdSP())+
    '</div>'+

    /* ── หมวด 3: ตำแหน่งนิสิต ── */
    _grpHead('ตำแหน่งนิสิต (POSS)','รหัสตำแหน่งที่ใช้สมัคร + เลข 2 หลักในเลขขาออก + สิทธิ์เริ่มต้น','#D97706')+
    _rdCard('pos','ตำแหน่งในระบบ','pen','รหัส GNK-XXX · ชื่อ · เลข 2 หลัก · สิทธิ์เริ่มต้น',_renderRdPOS())+

    /* ── หมวด 4: สิทธิ์ระบบ ── */
    _grpHead('สิทธิ์การใช้งาน','กำหนดว่า role ไหนลงนาม/ตรวจทานเอกสารได้','#16A34A')+
    _rdCanCard()+

  '</div>';
}

/* ── Render helpers ── */
function _renderRdLT(){
  if(!_rdLT.length) return '<div style="padding:12px 0;text-align:center;color:#a89e99;font-size:12px">ยังไม่มีรายการ — กด "เพิ่ม" เพื่อเริ่มต้น</div>';
  return '<div style="display:flex;flex-direction:column;gap:5px">'+
    _rdLT.map(function(v,i){
      return '<div style="display:flex;align-items:center;gap:8px">'+
        '<span style="font-size:11px;color:#c0b9b4;width:20px;text-align:right;flex-shrink:0">'+(i+1)+'</span>'+
        '<input class="fi" style="flex:1;font-size:12px;padding:6px 10px" id="rd-lt-'+i+'" value="'+esc(v)+'" placeholder="ชื่อประเภทเรื่อง">'+
        '<button onclick="_rdRemove(\'lt\','+i+')" style="background:none;border:none;cursor:pointer;color:#c0b9b4;padding:5px;border-radius:6px;flex-shrink:0" title="ลบ">'+svg('x',14)+'</button>'+
      '</div>';
    }).join('')+
  '</div>';
}

function _renderRdOT(){
  if(!_rdOT.length) return '<div style="padding:12px 0;text-align:center;color:#a89e99;font-size:12px">ยังไม่มีรายการ</div>';
  return '<div style="display:flex;flex-direction:column;gap:5px">'+
    _rdOT.map(function(v,i){
      return '<div style="display:flex;align-items:center;gap:8px">'+
        '<span style="font-size:11px;color:#c0b9b4;width:20px;text-align:right;flex-shrink:0">'+(i+1)+'</span>'+
        '<input class="fi" style="flex:1;font-size:12px;padding:6px 10px" id="rd-ot-'+i+'" value="'+esc(v)+'" placeholder="ชื่อประเภทจดหมาย">'+
        '<button onclick="_rdRemove(\'ot\','+i+')" style="background:none;border:none;cursor:pointer;color:#c0b9b4;padding:5px;border-radius:6px;flex-shrink:0" title="ลบ">'+svg('x',14)+'</button>'+
      '</div>';
    }).join('')+
  '</div>';
}

function _renderRdCL(){
  if(!_rdCL.length) return '<div style="padding:12px 0;text-align:center;color:#a89e99;font-size:12px">ยังไม่มีรายการ</div>';
  return '<div style="display:flex;flex-direction:column;gap:5px">'+
    _rdCL.map(function(c,i){
      return '<div style="display:flex;align-items:center;gap:8px">'+
        '<span style="font-size:11px;color:#c0b9b4;width:20px;text-align:right;flex-shrink:0">'+(i+1)+'</span>'+
        '<input class="fi" style="width:64px;flex-shrink:0;font-family:monospace;font-weight:700;text-align:center;font-size:12px;padding:6px 8px" id="rd-cl-code-'+i+'" value="'+esc(c.code)+'" placeholder="รหัส" maxlength="4">'+
        '<input class="fi" style="flex:1;font-size:12px;padding:6px 10px" id="rd-cl-name-'+i+'" value="'+esc(c.name)+'" placeholder="ชื่อชมรม">'+
        '<button onclick="_rdRemove(\'cl\','+i+')" style="background:none;border:none;cursor:pointer;color:#c0b9b4;padding:5px;border-radius:6px;flex-shrink:0" title="ลบ">'+svg('x',14)+'</button>'+
      '</div>';
    }).join('')+
  '</div>';
}

function _renderRdSP(){
  if(!_rdSP.length) return '<div style="padding:12px 0;text-align:center;color:#a89e99;font-size:12px">ยังไม่มีรายการ</div>';
  return '<div style="display:flex;flex-direction:column;gap:5px">'+
    _rdSP.map(function(p,i){
      return '<div style="display:flex;align-items:center;gap:8px">'+
        '<span style="font-size:11px;color:#c0b9b4;width:20px;text-align:right;flex-shrink:0">'+(i+1)+'</span>'+
        '<input class="fi" style="width:64px;flex-shrink:0;font-family:monospace;font-weight:700;text-align:center;font-size:12px;padding:6px 8px" id="rd-sp-code-'+i+'" value="'+esc(p.code)+'" placeholder="รหัส" maxlength="4">'+
        '<input class="fi" style="flex:1;font-size:12px;padding:6px 10px" id="rd-sp-name-'+i+'" value="'+esc(p.name)+'" placeholder="ชื่อตำแหน่ง / ชมรม">'+
        '<label style="display:flex;align-items:center;gap:4px;font-size:11px;color:#6b6560;cursor:pointer;white-space:nowrap;flex-shrink:0">'+
          '<input type="checkbox" id="rd-sp-club-'+i+'"'+(p.isClub?' checked':'')+' style="accent-color:#E83A00;width:14px;height:14px"> ชมรม</label>'+
        '<button onclick="_rdRemove(\'sp\','+i+')" style="background:none;border:none;cursor:pointer;color:#c0b9b4;padding:5px;border-radius:6px;flex-shrink:0" title="ลบ">'+svg('x',14)+'</button>'+
      '</div>';
    }).join('')+
  '</div>';
}

/* ── snapshot DOM values back into state arrays before re-render ── */
function _rdSnapshot(type){
  if(type==='lt'){
    _rdLT=_rdLT.map(function(v,i){var el=$e('rd-lt-'+i);return el?el.value:v;});
  } else if(type==='ot'){
    _rdOT=_rdOT.map(function(v,i){var el=$e('rd-ot-'+i);return el?el.value:v;});
  } else if(type==='cl'){
    _rdCL=_rdCL.map(function(c,i){
      return{code:($e('rd-cl-code-'+i)||{}).value||c.code, name:($e('rd-cl-name-'+i)||{}).value||c.name};
    });
  } else if(type==='sp'){
    _rdSP=_rdSP.map(function(p,i){
      return{name:($e('rd-sp-name-'+i)||{}).value||p.name, code:($e('rd-sp-code-'+i)||{}).value||p.code, isClub:($e('rd-sp-club-'+i)||{}).checked||false};
    });
  } else if(type==='pos'){
    _rdPOS=_rdPOS.map(function(p,i){
      return{code:($e('rd-pos-code-'+i)||{}).value||p.code, name:($e('rd-pos-name-'+i)||{}).value||p.name, num:($e('rd-pos-num-'+i)||{}).value||p.num, role:($e('rd-pos-role-'+i)||{}).value||p.role};
    });
  }
}

function _rdAdd(type){
  _rdSnapshot(type);
  if(type==='lt') _rdLT.push('');
  else if(type==='ot') _rdOT.push('');
  else if(type==='cl') _rdCL.push({code:'',name:''});
  else if(type==='sp') _rdSP.push({name:'',code:'',isClub:false});
  else if(type==='pos') _rdPOS.push({code:'',name:'',num:'',role:'ROLE-CRT'});
  var el=$e('rd-'+type+'-list');
  var fn={lt:_renderRdLT,ot:_renderRdOT,cl:_renderRdCL,sp:_renderRdSP,pos:_renderRdPOS};
  if(el) el.innerHTML=fn[type]();
  var arr={lt:_rdLT,ot:_rdOT,cl:_rdCL,sp:_rdSP,pos:_rdPOS}[type];
  var lastIdx=arr.length-1;
  var focusId=type==='lt'?'rd-lt-'+lastIdx:type==='ot'?'rd-ot-'+lastIdx:type==='cl'?'rd-cl-code-'+lastIdx:type==='pos'?'rd-pos-code-'+lastIdx:'rd-sp-code-'+lastIdx;
  setTimeout(function(){var f=$e(focusId);if(f)f.focus();},40);
}

function _rdRemove(type,idx){
  _rdSnapshot(type);
  if(type==='lt') _rdLT.splice(idx,1);
  else if(type==='ot') _rdOT.splice(idx,1);
  else if(type==='cl') _rdCL.splice(idx,1);
  else if(type==='sp') _rdSP.splice(idx,1);
  else if(type==='pos') _rdPOS.splice(idx,1);
  var el=$e('rd-'+type+'-list');
  var fn={lt:_renderRdLT,ot:_renderRdOT,cl:_renderRdCL,sp:_renderRdSP,pos:_renderRdPOS};
  if(el) el.innerHTML=fn[type]();
}

function _renderRdPOS(){
  if(!_rdPOS.length) return '<div style="padding:12px 0;text-align:center;color:#a89e99;font-size:12px">ยังไม่มีรายการ</div>';
  var roleOpts=['ROLE-SGN','ROLE-REV','ROLE-CRT','ROLE-STF','ROLE-ADV'];
  return '<div style="overflow-x:auto">'+
    '<div style="display:grid;grid-template-columns:20px 110px 1fr 64px 100px 28px;gap:6px;align-items:center;padding:6px 0;border-bottom:1px solid #F5F3F0;margin-bottom:4px">'+
      '<span></span>'+
      ['รหัสตำแหน่ง','ชื่อตำแหน่ง','เลข 2 หลัก','สิทธิ์เริ่มต้น',''].map(function(h){
        return '<span style="font-size:9px;font-weight:700;color:#c0b9b4;text-transform:uppercase;letter-spacing:.4px">'+h+'</span>';
      }).join('')+
    '</div>'+
    _rdPOS.map(function(p,i){
      var roleSelect='<select id="rd-pos-role-'+i+'" style="width:100%;height:30px;border:1.5px solid #EBEBEB;border-radius:7px;background:#fff;font-size:11px;padding:0 6px;color:#18120E;outline:none;cursor:pointer">'+
        roleOpts.map(function(r){return '<option value="'+r+'"'+(p.role===r?' selected':'')+'>'+r.replace('ROLE-','')+'</option>';}).join('')+
      '</select>';
      return '<div style="display:grid;grid-template-columns:20px 110px 1fr 64px 100px 28px;gap:6px;align-items:center;padding:4px 0">'+
        '<span style="font-size:10px;color:#c0b9b4;text-align:right">'+(i+1)+'</span>'+
        '<input class="fi" style="font-size:11px;font-family:monospace;font-weight:700;padding:5px 8px" id="rd-pos-code-'+i+'" value="'+esc(p.code)+'" placeholder="GNK-XXX">'+
        '<input class="fi" style="font-size:12px;padding:5px 8px" id="rd-pos-name-'+i+'" value="'+esc(p.name)+'" placeholder="ชื่อตำแหน่ง">'+
        '<input class="fi" style="font-size:13px;font-family:monospace;font-weight:900;text-align:center;padding:5px 4px" id="rd-pos-num-'+i+'" value="'+esc(p.num)+'" placeholder="01" maxlength="3">'+
        roleSelect+
        '<button onclick="_rdRemove(\'pos\','+i+')" style="background:none;border:none;cursor:pointer;color:#c0b9b4;padding:4px;border-radius:6px" title="ลบ">'+svg('x',13)+'</button>'+
      '</div>';
    }).join('')+
  '</div>';
}

function _rdCanCard(){
  var allRoles=[
    {code:'ROLE-SGN',label:'ผู้ลงนาม'},
    {code:'ROLE-REV',label:'ผู้ตรวจทาน'},
    {code:'ROLE-ADV',label:'อาจารย์กิจการ'},
    {code:'ROLE-STF',label:'เจ้าหน้าที่'},
    {code:'ROLE-CRT',label:'ผู้จัดทำ'},
    {code:'ROLE-SYS',label:'ผู้ดูแลระบบ'}
  ];
  var curSg=(Array.isArray(SETT.can_sign_roles_json)&&SETT.can_sign_roles_json)||['ROLE-SGN','ROLE-ADV','ROLE-SYS'];
  var curRv=(Array.isArray(SETT.can_review_roles_json)&&SETT.can_review_roles_json)||['ROLE-REV','ROLE-SGN','ROLE-ADV','ROLE-SYS'];

  var rows=allRoles.map(function(r){
    var isSys=r.code==='ROLE-SYS';
    var sgChk=curSg.includes(r.code);
    var rvChk=curRv.includes(r.code);
    return '<div style="display:grid;grid-template-columns:1fr 80px 80px;gap:8px;align-items:center;padding:10px 16px;border-top:1px solid #F9F8F7">'+
      '<span style="font-size:12px;font-weight:600;color:#18120E">'+r.label+
        (isSys?'<span style="font-size:10px;color:#a89e99;margin-left:6px">ล็อกเสมอ</span>':'')+
      '</span>'+
      '<label style="display:flex;justify-content:center;align-items:center;cursor:'+(isSys?'default':'pointer')+'">'+
        '<input type="checkbox" id="can-sg-'+r.code+'" value="'+r.code+'"'+(sgChk?' checked':'')+(isSys?' disabled':'')+
          ' style="width:16px;height:16px;accent-color:#E83A00;cursor:'+(isSys?'default':'pointer')+'">'+
      '</label>'+
      '<label style="display:flex;justify-content:center;align-items:center;cursor:'+(isSys?'default':'pointer')+'">'+
        '<input type="checkbox" id="can-rv-'+r.code+'" value="'+r.code+'"'+(rvChk?' checked':'')+(isSys?' disabled':'')+
          ' style="width:16px;height:16px;accent-color:#2563EB;cursor:'+(isSys?'default':'pointer')+'">'+
      '</label>'+
    '</div>';
  }).join('');

  return '<div class="card" style="margin-bottom:0">'+
    '<div class="card-head">'+
      '<div style="width:26px;height:26px;border-radius:7px;background:#FFF5EE;display:flex;align-items:center;justify-content:center;color:#E83A00;flex-shrink:0">'+svg('lock',13)+'</div>'+
      '<div><div class="card-head-title">สิทธิ์การใช้งาน (CAN)</div>'+
        '<div style="font-size:10px;color:#a89e99;margin-top:1px">กำหนดว่า role ไหนสามารถลงนามหรือตรวจทานเอกสารได้</div>'+
      '</div>'+
      '<button class="btn btn-primary sm ml-auto" onclick="_rdSaveCAN()">'+svg('ok',12)+' บันทึก</button>'+
    '</div>'+
    '<div id="rd-can-al"></div>'+
    '<div style="display:grid;grid-template-columns:1fr 80px 80px;gap:8px;padding:8px 16px 6px;border-bottom:1px solid #F5F3F0">'+
      '<span style="font-size:10px;font-weight:700;color:#a89e99;text-transform:uppercase;letter-spacing:.5px">Role</span>'+
      '<span style="font-size:10px;font-weight:700;color:#E83A00;text-align:center;text-transform:uppercase;letter-spacing:.5px">ลงนาม</span>'+
      '<span style="font-size:10px;font-weight:700;color:#2563EB;text-align:center;text-transform:uppercase;letter-spacing:.5px">ตรวจทาน</span>'+
    '</div>'+
    rows+
    '<div style="padding:10px 16px;background:#FAFAF8;border-top:1px solid #F5F3F0;font-size:10px;color:#a89e99;border-radius:0 0 16px 16px">'+
      svg('warn',11)+' ผู้ดูแลระบบ (ROLE-SYS) มีสิทธิ์ทุกอย่างเสมอ ไม่สามารถเปลี่ยนแปลงได้'+
    '</div>'+
  '</div>';
}

async function _rdSaveCAN(){
  var al=$e('rd-can-al');
  var roles=['ROLE-SGN','ROLE-REV','ROLE-ADV','ROLE-STF','ROLE-CRT','ROLE-SYS'];
  try{
    var sgRoles=roles.filter(function(r){var el=$e('can-sg-'+r);return el&&el.checked;});
    var rvRoles=roles.filter(function(r){var el=$e('can-rv-'+r);return el&&el.checked;});
    if(!sgRoles.includes('ROLE-SYS')) sgRoles.push('ROLE-SYS');
    if(!rvRoles.includes('ROLE-SYS')) rvRoles.push('ROLE-SYS');
    var pairs=[{key:'can_sign_roles_json',val:sgRoles},{key:'can_review_roles_json',val:rvRoles}];
    for(var i=0;i<pairs.length;i++){
      var k=pairs[i].key, v=JSON.stringify(pairs[i].val);
      var ex=await dg('app_settings','?key=eq.'+encodeURIComponent(k)+'&select=key&limit=1');
      if(ex&&ex.length){
        await fetch(SU+'/rest/v1/app_settings?key=eq.'+encodeURIComponent(k),{method:'PATCH',headers:H,body:JSON.stringify({value:v,updated_by:CU.id,updated_at:new Date().toISOString()})});
      }else{
        await dp('app_settings',{key:k,value:v,label:k,value_type:'json',updated_by:CU.id,updated_at:new Date().toISOString()});
      }
    }
    /* apply immediately */
    var _sg=sgRoles.slice(); CAN.sg=function(r){return _sg.includes(r);};
    var _rv=rvRoles.slice(); CAN.rv=function(r){return _rv.includes(r);};
    SETT.can_sign_roles_json=sgRoles; SETT.can_review_roles_json=rvRoles;
    if(al) al.innerHTML='<div class="al al-ok" style="margin:0 16px 8px"><span class="al-icon">'+svg('ok',13)+'</span><span>บันทึกสิทธิ์เรียบร้อย — มีผลทันที</span></div>';
    setTimeout(function(){if(al)al.innerHTML='';},3500);
  }catch(e){
    if(al) al.innerHTML='<div class="al al-er" style="margin:0 16px 8px"><span class="al-icon">'+svg('warn',13)+'</span><span>เกิดข้อผิดพลาด: '+esc(e.message||String(e))+'</span></div>';
  }
}

async function _rdSave(type){
  _rdSnapshot(type);
  var al=$e('rd-'+type+'-al');
  var key, val, arr;
  try{
    if(type==='lt'){
      arr=_rdLT.filter(function(v){return v.trim();});
      _rdLT=arr.slice();
      LETTER_TYPES.length=0; arr.forEach(function(x){LETTER_TYPES.push(x);});
      key='letter_types_json';
    } else if(type==='ot'){
      arr=_rdOT.filter(function(v){return v.trim();});
      _rdOT=arr.slice();
      OUT_LTYPES.length=0; OUT_LTYPES.push(''); arr.forEach(function(x){OUT_LTYPES.push(x);});
      key='out_ltypes_json';
    } else if(type==='cl'){
      arr=_rdCL.filter(function(c){return c.code.trim()&&c.name.trim();});
      _rdCL=arr.slice();
      Object.keys(CLUBS).forEach(function(k){delete CLUBS[k];});
      arr.forEach(function(c){CLUBS[c.code.trim()]=c.name.trim();});
      key='clubs_json';
    } else if(type==='sp'){
      arr=_rdSP.filter(function(p){return p.name.trim()&&p.code.trim();});
      _rdSP=arr.slice();
      SENDER_POS.length=0; arr.forEach(function(p){SENDER_POS.push({name:p.name.trim(),code:p.code.trim(),isClub:!!p.isClub});});
      key='sender_pos_json';
    } else if(type==='pos'){
      arr=_rdPOS.filter(function(p){return p.code.trim()&&p.name.trim();});
      _rdPOS=arr.slice();
      POSS.length=0;
      Object.keys(PTH).forEach(function(k){delete PTH[k];});
      Object.keys(GNK_NUM).forEach(function(k){delete GNK_NUM[k];});
      Object.keys(PR).forEach(function(k){delete PR[k];});
      arr.forEach(function(p){
        POSS.push(p.code.trim());
        PTH[p.code.trim()]=p.name.trim();
        GNK_NUM[p.code.trim()]=p.num.trim();
        PR[p.code.trim()]=p.role||'ROLE-CRT';
      });
      key='positions_json';
    }
    val=JSON.stringify(arr);
    var ex=await dg('app_settings','?key=eq.'+encodeURIComponent(key)+'&select=key&limit=1');
    if(ex&&ex.length){
      await fetch(SU+'/rest/v1/app_settings?key=eq.'+encodeURIComponent(key),{method:'PATCH',headers:H,body:JSON.stringify({value:val,updated_by:CU.id,updated_at:new Date().toISOString()})});
    }else{
      await dp('app_settings',{key:key,value:val,label:key,value_type:'json',updated_by:CU.id,updated_at:new Date().toISOString()});
    }
    var fn={lt:_renderRdLT,ot:_renderRdOT,cl:_renderRdCL,sp:_renderRdSP,pos:_renderRdPOS};
    var el=$e('rd-'+type+'-list'); if(el&&fn[type]) el.innerHTML=fn[type]();
    if(al) al.innerHTML='<div class="al al-ok" style="margin:0 16px 8px"><span class="al-icon">'+svg('ok',13)+'</span><span>บันทึกเรียบร้อย '+(arr.length)+' รายการ</span></div>';
    setTimeout(function(){if(al)al.innerHTML='';},3500);
  }catch(e){
    if(al) al.innerHTML='<div class="al al-er" style="margin:0 16px 8px"><span class="al-icon">'+svg('warn',13)+'</span><span>เกิดข้อผิดพลาด: '+esc(e.message||String(e))+'</span></div>';
  }
}
