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
  '<div class="gnk-box overflow-hidden" style="max-width:460px; border-radius:24px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.15);" onclick="event.stopPropagation()">',
    // Header: เน้นความโปร่งและสะอาดตา
    '<div class="gnk-pop-head" style="padding: 32px 32px 20px 32px; background: linear-gradient(to bottom, #fff, #f9fafb);">',
      '<div class="flex flex-col gap-1">',
        '<div class="gnk-eyebrow" style="color:#92400E; font-weight:700; font-size:12px; letter-spacing:0.1em; text-transform:uppercase;">Document System</div>',
        '<div class="gnk-pop-title" style="font-size:24px; font-weight:800; color:#111827; letter-spacing:-0.02em;">ตั้งค่าเลขที่เอกสาร</div>',
        '<div class="gnk-pop-sub" style="font-size:14px; color:#6B7280; margin-top:4px;">ปีงบประมาณปัจจุบัน: <span style="color:#111827; font-weight:700; background:#FEF3C7; padding:2px 8px; border-radius:6px; margin-left:4px;">' + thYear + '</span></div>',
      '</div>',
      '<button class="gnk-xbtn" style="top:24px; right:24px; background:#f3f4f6; border-radius:50%; width:36px; height:36px; display:flex; align-items:center; justify-content:center; transition:all 0.2s;" onclick="gnkClose(\'docnum\')">' + _XSVG + '</button>',
    '</div>',

    '<div class="gnk-pop-body" style="padding: 0 32px 32px 32px;">',
      // Info Box: ปรับให้ดูซอฟต์ลง ไม่รกตา
      '<div class="gnk-info" style="background:#F8FAFC; border:1px dashed #E2E8F0; border-radius:16px; padding:16px; margin-bottom:24px; display:flex; gap:12px; align-items:flex-start;">',
        '<div style="color:#3B82F6; margin-top:2px;">' + _ISVG + '</div>',
        '<div style="font-size:13px; color:#475569; line-height:1.6;">ระบบจะสร้างเลขที่อัตโนมัติตามรูปแบบ <span style="font-family:monospace; font-weight:600; color:#1E293B;">[Prefix]-' + thYear + '-[No.]</span></div>',
      '</div>',

      // Input Group: เน้นความชัดเจน
      '<div class="gnk-inp-grp" style="margin-bottom:28px;">',
        '<label style="display:block; font-size:13px; font-weight:600; color:#374151; margin-bottom:10px; margin-left:4px;">ชื่อย่อ/รหัสองค์กร (Prefix)</label>',
        '<input type="text" id="dn-prefix" class="gnk-inp" value="' + esc(curPrefix) + '" ',
          'placeholder="เช่น GNK หรือ คณะ..." maxlength="20" oninput="updateDNPreview()" ',
          'style="width:100%; height:52px; padding:0 20px; font-size:16px; border-radius:14px; border:2px solid #E5E7EB; transition:all 0.3s; box-sizing:border-box; outline:none;">',
      '</div>',

      // Preview Box: ปรับให้ดูเหมือน Card พิเศษ
      '<div class="gnk-prev-box" style="background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%); border-radius:20px; padding:24px; position:relative; overflow:hidden; box-shadow: 0 10px 20px rgba(15,23,42,0.15);">',
        // ตกแต่งพื้นหลัง Preview นิดหน่อย
        '<div style="position:absolute; top:-20px; right:-20px; width:100px; height:100px; background:rgba(255,255,255,0.03); border-radius:50%;"></div>',
        
        '<div style="position:relative; z-index:1;">',
          '<div style="font-size:11px; color:#94A3B8; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:8px; font-weight:600;">Live Preview</div>',
          '<div id="dn-preview" class="gnk-prev-val" style="font-family:\'JetBrains Mono\', monospace; font-size:28px; color:#F8FAFC; font-weight:700; letter-spacing:0.05em;">' + esc(curPrefix) + '-' + thYear + '-001</div>',
        '</div>',
        '<div class="gnk-prev-tag" style="position:absolute; bottom:20px; right:24px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); color:#fff; font-size:10px; padding:4px 12px; border-radius:20px; backdrop-filter:blur(4px);">ตัวอย่างรูปแบบ</div>',
      '</div>',
    '</div>',

    // Footer: เน้นปุ่มให้ดู Clickable มากขึ้น
    '<div class="gnk-pop-foot" style="padding:20px 32px 32px 32px; background:#F9FAF9; display:flex; gap:12px;">',
      '<button class="gnk-btn-c" style="flex:1; height:48px; border-radius:12px; font-weight:600; border:1px solid #E5E7EB; background:#fff; color:#4B5563; transition:all 0.2s;" onclick="gnkClose(\'docnum\')">ยกเลิก</button>',
      '<button class="gnk-btn-p" id="dn-save-btn" data-action="saveDocNumSetting" style="flex:2; height:48px; border-radius:12px; font-weight:700; background:#111827; color:#fff; display:flex; align-items:center; justify-content:center; gap:8px; transition:all 0.2s; border:none; cursor:pointer;">' + _OKSVG + ' บันทึกการตั้งค่า</button>',
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
