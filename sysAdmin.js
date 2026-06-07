/* ─── SYSTEM ADMIN (จัดการระบบ) ─── */

var _sysTab='docnum'; // tab ที่เปิดอยู่

async function vSys(){
  if(CU.role_code!=='ROLE-SYS') return '<div class="card-empty"><div class="card-empty-text">ไม่มีสิทธิ์เข้าถึง</div></div>';
  var _docNumCfgs=[], _docTypes=[], _settings=[], _emailTmpls=[], _wfTmpls=[];
  try{_docNumCfgs=await dg('doc_number_settings','?order=year.desc');}catch(e){}
  try{_docTypes=await dg('doc_types','?order=sort_order,created_at');}catch(e){}
  try{_settings=await dg('app_settings','?order=key');}catch(e){}
  try{_emailTmpls=await dg('email_templates','?order=key');}catch(e){}
  try{_wfTmpls=await dg('workflow_templates','?order=doc_type,created_at');}catch(e){}
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

  // ── Tab navigation ──
  var _sysAnnouncement=((Array.isArray(_settings)?_settings:[]).find(function(s){return s.key==='system_announcement'})||{}).value||'';
  var _annBadge=_sysAnnouncement?'<span style="width:7px;height:7px;border-radius:50%;background:#E83A00;display:inline-block;margin-left:5px;vertical-align:middle"></span>':'';
  var _tabs=[
    {k:'docnum',   ico:'edit',    label:'เลขที่เอกสาร'},
    {k:'doctypes', ico:'doc',     label:'ประเภทเอกสาร'},
    {k:'settings', ico:'gear',    label:'ตั้งค่าระบบ'+_annBadge},
    {k:'email',    ico:'bell',    label:'แม่แบบอีเมล'},
    {k:'workflow', ico:'refresh', label:'Workflow'}
  ];

  var tabNav='<div style="display:flex;gap:2px;border-bottom:2px solid #EBEBEB;margin-bottom:20px;overflow-x:auto;flex-wrap:nowrap">';
  _tabs.forEach(function(t){
    var isAct=t.k===_sysTab;
    tabNav+='<button class="ptab'+(isAct?' on':'')+'" style="white-space:nowrap;display:flex;align-items:center;gap:6px" '+
      'onclick="setSysTab(\''+t.k+'\')" data-systab="'+t.k+'">'+
      svg(t.ico,12)+' '+t.label+'</button>';
  });
  tabNav+='</div>';

  var _panelContent={
    docnum:   rDocNumCard(_docNumCfgs),
    doctypes: rDocTypesCard(_docTypes),
    settings: rAppSettingsCard(_settings),
    email:    rEmailTemplatesCard(_emailTmpls),
    workflow: rWfTemplatesCard(_wfTmpls)
  };

  var html=tabNav;
  _tabs.forEach(function(t){
    html+='<div id="sys-tab-'+t.k+'" style="display:'+(t.k===_sysTab?'block':'none')+'">'+_panelContent[t.k]+'</div>';
  });
  return html;
}

function setSysTab(tab){
  _sysTab=tab;
  ['docnum','doctypes','settings','email','workflow'].forEach(function(t){
    var el=$e('sys-tab-'+t);
    if(el) el.style.display=t===tab?'block':'none';
  });
  document.querySelectorAll('[data-systab]').forEach(function(btn){
    var isAct=btn.dataset.systab===tab;
    btn.className='ptab'+(isAct?' on':'');
    btn.style.cssText='white-space:nowrap;display:inline-flex;align-items:center;gap:6px';
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
    '<div class="card" style="margin-bottom:16px">'+
      '<div class="card-head">'+
        '<div class="w-[26px] h-[26px] rounded-[7px] bg-[#FFF3EE] flex items-center justify-center text-[#E83A00] shrink-0">'+svg('edit',13)+'</div>'+
        '<span class="card-head-title">ตั้งค่าเลขที่เอกสาร</span>'+
        '<div class="ml-auto">'+
          '<button class="btn btn-primary sm" data-action="showDocNumModal">'+svg('edit',12)+' ตั้งค่าปี '+thYear+'</button>'+
        '</div>'+
      '</div>'+
      '<div class="card-body">'+
        '<div class="flex gap-4 flex-wrap mb-4">'+
          '<div style="flex:1;background:#FFF5F0;border-radius:12px;padding:14px 18px;border:1.5px solid #ffc9a8">'+
            '<div style="font-size:10px;color:#a89e99;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;font-weight:700">ขาเข้า ('+thYear+')</div>'+
            '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:15px;color:#C42800;font-weight:800;letter-spacing:.5px">'+esc(curPrefix)+'-'+thYear+'-001</div>'+
          '</div>'+
          '<div style="flex:1;background:#EFF6FF;border-radius:12px;padding:14px 18px;border:1.5px solid #BFDBFE">'+
            '<div style="font-size:10px;color:#a89e99;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;font-weight:700">ขาออก ('+thYear+')</div>'+
            '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:15px;color:#1D4ED8;font-weight:800;letter-spacing:.5px">กนค.'+thYear+'.'+String(curOutStart).padStart(2,'0')+'</div>'+
          '</div>'+
        '</div>'
  );

  if(cfgs&&cfgs.length){
    h.push(
      '<div class="mt-4 pt-4 border-t border-[#F5F3F0]">'+
        '<div class="text-[10px] font-bold uppercase tracking-wider text-[#a89e99] mb-3">ประวัติการตั้งค่า</div>'+
        '<div class="tbl-wrap"><table>'+
          '<thead><tr>'+
            '<th>ปี พ.ศ.</th><th>Prefix (ขาเข้า)</th><th>เลขเริ่ม (ขาออก)</th><th>ตัวอย่างขาออก</th><th style="text-align:right">วันที่แก้ไข</th>'+
          '</tr></thead><tbody>'
    );
    cfgs.forEach(function(c){
      var _os=c.out_start_seq||1;
      h.push(
        '<tr>'+
          '<td class="font-bold">'+c.year+'</td>'+
          '<td><span class="mono">'+esc(c.prefix)+'</span></td>'+
          '<td class="font-mono text-[13px]">'+_os+'</td>'+
          '<td class="font-mono text-[13px]" style="color:#1d4ed8">กนค.'+c.year+'.'+String(_os).padStart(2,'0')+'</td>'+
          '<td style="text-align:right" class="text-[#a89e99] text-[12px]">'+fd(c.created_at)+'</td>'+
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
      '<button class="gnk-btn-p" id="dn-save-btn" data-action="saveDocNumSetting" style="flex:1.8; height:44px; border-radius:12px; font-weight:700; font-size:12px; background:#E83A00; color:#fff; display:flex; align-items:center; justify-content:center; gap:8px; border:none; cursor:pointer; box-shadow: 0 8px 16px -4px rgba(232, 58, 0, 0.4); transition:all 0.3s;" onmouseover="this.style.transform=\'translateY(-1px)\';this.style.opacity=\'0.9\'" onmouseout="this.style.transform=\'translateY(0)\';this.style.opacity=\'1\'">',
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
      '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:#a89e99;margin-bottom:10px">ค่าตัวเลขระบบ</div>'+
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
