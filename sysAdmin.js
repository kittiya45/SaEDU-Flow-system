/* ─── SYSTEM ADMIN (จัดการระบบ) ─── */

async function vSys(){
  if(CU.role_code!=='ROLE-SYS') return '<div class="card-empty"><div class="card-empty-text">ไม่มีสิทธิ์เข้าถึง</div></div>';
  var _docNumCfgs=[], _docTypes=[];
  try{_docNumCfgs=await dg('doc_number_settings','?order=year.desc');}catch(e){}
  try{_docTypes=await dg('doc_types','?order=sort_order,created_at');}catch(e){}
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
        '<div class="flex items-center gap-3 mb-1">'+
          '<div class="flex items-center gap-4 px-5 py-3.5 rounded-[12px] border border-[#FDE68A]" style="background:linear-gradient(135deg,#FFFBEB,#FEF3C7)">'+
            '<div>'+
              '<div class="text-[10px] font-bold uppercase tracking-wider text-[#92400E] mb-1">รูปแบบปัจจุบัน ('+thYear+')</div>'+
              '<div class="font-black text-[22px] font-mono tracking-wider" style="color:#C42800;letter-spacing:.05em">'+esc(curPrefix)+'-'+thYear+'-001</div>'+
            '</div>'+
            '<div class="w-px h-9 bg-[#FDE68A] mx-1"></div>'+
            '<div class="text-[11px] text-[#92400E] leading-snug font-medium">รหัสตั้งต้น<br>สำหรับปีนี้</div>'+
          '</div>'+
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

  var box=[
    '<div class="gnk-box" style="max-width:440px" onclick="event.stopPropagation()">',
      '<div class="gnk-pop-head">',
        '<div class="gnk-eyebrow">จัดการระบบ</div>',
        '<div class="gnk-pop-title">ตั้งค่าเลขที่เอกสาร</div>',
        '<div class="gnk-pop-sub">ปีงบประมาณ <strong style="color:#C42800">'+thYear+'</strong> (พ.ศ.)</div>',
        '<button class="gnk-xbtn" onclick="gnkClose(\'docnum\')">'+_XSVG+'</button>',
      '</div>',
      '<div class="gnk-divider"></div>',
      '<div class="gnk-pop-body">',
        '<div class="gnk-info">'+_ISVG+
          '<div>รูปแบบจะเป็น <strong>[Prefix]-'+thYear+'-[ลำดับ]</strong> เช่น ถ้าตั้ง Prefix เป็น <strong>กนค</strong> จะได้ <strong>กนค-'+thYear+'-001</strong></div>'+
        '</div>',
        '<div class="gnk-inp-grp">',
          '<label>Prefix (รหัสองค์กร / คณะ)</label>',
          '<input type="text" id="dn-prefix" class="gnk-inp" value="'+esc(curPrefix)+'" placeholder="เช่น GNK หรือ กนค" maxlength="20" oninput="updateDNPreview()">',
        '</div>',
        '<div class="gnk-prev-box">',
          '<div>',
            '<div style="font-size:12px;color:#a89e99;margin-bottom:4px">ตัวอย่างเลขที่เอกสาร</div>',
            '<div id="dn-preview" class="gnk-prev-val">'+esc(curPrefix)+'-'+thYear+'-001</div>',
          '</div>',
          '<div class="gnk-prev-tag">ตัวอย่าง</div>',
        '</div>',
      '</div>',
      '<div class="gnk-pop-foot">',
        '<button class="gnk-btn-c" onclick="gnkClose(\'docnum\')">ยกเลิก</button>',
        '<button class="gnk-btn-p" id="dn-save-btn" data-action="saveDocNumSetting">'+_OKSVG+'บันทึกการตั้งค่า</button>',
      '</div>',
    '</div>'
  ].join('');
  _gnkOpen('docnum',box);
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
