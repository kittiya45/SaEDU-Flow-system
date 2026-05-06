/* ─── SYSTEM ADMIN (จัดการระบบ) ─── */

async function vSys(){
  if(CU.role_code!=='ROLE-SYS') return '<div class="card-empty"><div class="card-empty-text">ไม่มีสิทธิ์เข้าถึง</div></div>';
  var _docNumCfgs=[], _docTypes=[];
  try{_docNumCfgs=await dg('doc_number_settings','?order=year.desc');}catch(e){}
  try{_docTypes=await dg('doc_types','?order=sort_order,created_at');}catch(e){}
  if(_docTypes.length){
    try{
      var flds=await dg('doc_type_fields','?select=doc_type_id');
      var cnts={};
      flds.forEach(function(f){cnts[f.doc_type_id]=(cnts[f.doc_type_id]||0)+1;});
      _docTypes.forEach(function(t){t._fieldCount=cnts[t.id]||0;});
    }catch(e){}
  }
  return rDocNumCard(_docNumCfgs)+rDocTypesCard(_docTypes);
}

/* ─── DOC NUMBER CARD ─── */
function rDocNumCard(cfgs){
  cfgs=Array.isArray(cfgs)?cfgs:[];
  var thYear=new Date().getFullYear()+543;
  var cur=cfgs.find(function(c){return c.year===thYear});
  var curPrefix=cur?cur.prefix:'GNK';
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
        '<div class="flex items-center mb-4">' +
        '<div class="flex items-center gap-6 px-6 py-4 rounded-2xl border border-amber-200/60 shadow-sm" style="background: linear-gradient(135deg, #ffffff 0%, #fffbeb 100%);">' +
          '<div>' +
            '<div class="flex items-center gap-2 mb-1.5">' +
              '<span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>' +
              '<div class="text-[11px] font-bold uppercase tracking-[0.1em] text-amber-800/70">Current Format (' + thYear + ')</div>' +
            '</div>' +
            '<div class="font-mono text-2xl font-black tracking-widest flex items-center" style="color: #92400E;">' +
              '<span class="opacity-40 text-lg mr-1">#</span>' +
              esc(curPrefix) + '<span class="mx-1 opacity-30 text-lg">-</span>' + thYear + '<span class="mx-1 opacity-30 text-lg">-</span>001' +
            '</div>' +
          '</div>' +
        
          '<div class="w-[1.5px] h-10 bg-gradient-to-b from-transparent via-amber-200 to-transparent"></div>' +
          
          '<div class="flex flex-col justify-center">' +
            '<div class="text-[12px] font-semibold text-amber-900 leading-tight">รหัสตั้งต้น</div>' +
            '<div class="text-[10px] text-amber-700/80 font-medium tracking-tight">ระบบรันเลขปี ' + thYear + '</div>' +
          '</div>' +
        '</div>' +
      '</div>'

  );

  if(cfgs&&cfgs.length){
    h.push(
      '<div class="mt-4 pt-4 border-t border-[#F5F3F0]">'+
        '<div class="text-[10px] font-bold uppercase tracking-wider text-[#a89e99] mb-3">ประวัติการตั้งค่า</div>'+
        '<div class="tbl-wrap"><table>'+
          '<thead><tr>'+
            '<th>ปี พ.ศ.</th><th>Prefix</th><th>ตัวอย่าง</th><th style="text-align:right">วันที่แก้ไข</th>'+
          '</tr></thead><tbody>'
    );
    cfgs.forEach(function(c){
      h.push(
        '<tr>'+
          '<td class="font-bold">'+c.year+'</td>'+
          '<td><span class="mono">'+esc(c.prefix)+'</span></td>'+
          '<td class="font-mono text-[13px]" style="color:#C42800">'+esc(c.prefix)+'-'+c.year+'-001</td>'+
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
  try{
    var cfg=await dg('doc_number_settings','?year=eq.'+thYear+'&select=prefix&limit=1');
    if(cfg&&cfg.length&&cfg[0].prefix) curPrefix=cfg[0].prefix;
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

      // Input Group: ปรับตัวหนังสือ Label ให้เล็กลง
      '<div class="gnk-inp-grp" style="margin-bottom:24px;">',
        '<label style="display:block; font-size:11.5px; font-weight:700; color:#18120E; margin-bottom:8px; margin-left:2px;">ชื่อย่อ/รหัสองค์กร (Prefix)</label>',
        '<input type="text" id="dn-prefix" class="gnk-inp" value="' + esc(curPrefix) + '" ',
          'placeholder="ระบุตัวย่อ..." maxlength="20" oninput="updateDNPreview()" ',
          'style="width:100%; height:46px; padding:0 16px; font-size:13px; font-weight:600; border-radius:12px; border:1.5px solid #EBEBEB; background:#fff; transition:all 0.3s; box-sizing:border-box; outline:none; color:#18120E;">',
      '</div>',

      // Preview Box: ใช้สีส้ม #E83A00 แบบ Solid ไล่เฉดเล็กน้อย
      '<div class="gnk-prev-box" style="background: linear-gradient(135deg, #E83A00 0%, #B32D00 100%); border-radius:22px; padding:24px; position:relative; overflow:hidden; box-shadow: 0 15px 30px -5px rgba(232, 58, 0, 0.3);">',
        '<div style="position:absolute; top:-20px; right:-20px; width:100px; height:100px; background:rgba(255,255,255,0.08); border-radius:50%;"></div>',
        
        '<div style="position:relative; z-index:1;">',
          '<div style="font-size:9px; color:rgba(255,255,255,0.8); text-transform:uppercase; letter-spacing:0.15em; margin-bottom:6px; font-weight:600;">Live Preview</div>',
          '<div id="dn-preview" style="font-family:\'JetBrains Mono\', monospace; font-size:22px; color:#fff; font-weight:700; letter-spacing:0.02em;">' + esc(curPrefix) + '-' + thYear + '-001</div>',
        '</div>',
        '<div style="position:absolute; bottom:20px; right:20px; background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.2); color:#fff; font-size:9px; padding:3px 10px; border-radius:10px; backdrop-filter:blur(4px); font-weight:600;">EXAMPLE</div>',
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
  var el=$e('dn-preview');
  if(el) el.textContent=prefix+'-'+thYear+'-001';
}

async function saveDocNumSetting(){
  var thYear=new Date().getFullYear()+543;
  var prefix=(($e('dn-prefix')||{}).value||'').trim();
  if(!prefix){
    var inp=$e('dn-prefix');
    if(inp){inp.style.borderColor='#C42800';inp.focus();setTimeout(function(){inp.style.borderColor='';},1800);}
    return;
  }
  var btn=$e('dn-save-btn');
  if(btn){btn.disabled=true;btn.innerHTML=_SPINSVG+'กำลังบันทึก...';}
  try{
    var ex=await dg('doc_number_settings','?year=eq.'+thYear+'&select=id&limit=1');
    if(ex&&ex.length){
      await dpa('doc_number_settings',ex[0].id,{prefix:prefix});
    }else{
      await dp('doc_number_settings',{year:thYear,prefix:prefix,created_by:CU.id});
    }
    gnkClose('docnum');
    setTimeout(function(){nav('sys');},220);
  }catch(e){
    if(btn){btn.disabled=false;btn.innerHTML=_OKSVG+'บันทึกการตั้งค่า';}
    alert('เกิดข้อผิดพลาด: '+(e.message||e));
  }
}
