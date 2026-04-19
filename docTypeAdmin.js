/* ─── DOC TYPE ADMIN ─── */

function rDocTypesCard(types){
  types=Array.isArray(types)?types:[];
  var h=[];

  h.push(
    '<div class="card" style="margin-bottom:0">'+
      '<div class="card-head">'+
        '<div class="w-[26px] h-[26px] rounded-[7px] bg-[#FFF3EE] flex items-center justify-center text-[#E83A00] shrink-0">'+svg('doc',13)+'</div>'+
        '<span class="card-head-title">จัดการประเภทเอกสาร</span>'+
        '<div class="ml-auto">'+
          '<button class="btn btn-primary sm" data-action="showDocTypeModal" data-id="">'+svg('plus',12)+' เพิ่มประเภทเอกสาร</button>'+
        '</div>'+
      '</div>'
  );

  if(types.length){
    h.push('<div class="tbl-wrap"><table>');
    h.push(
      '<thead><tr>'+
        '<th>รหัส</th>'+
        '<th>ชื่อประเภทเอกสาร</th>'+
        '<th style="text-align:center">ช่อง "จาก"</th>'+
        '<th style="text-align:center">ช่อง "ถึง"</th>'+
        '<th style="text-align:center">ช่องอ้างอิง</th>'+
        '<th style="text-align:center">วันที่เอกสาร</th>'+
        '<th style="text-align:center">สถานะ</th>'+
        '<th style="text-align:right">จัดการ</th>'+
      '</tr></thead><tbody>'
    );
    var chk='<span style="color:#16A34A;font-size:15px;line-height:1">✓</span>';
    var dash='<span class="text-[#C0BAB4]">—</span>';
    types.forEach(function(t){
      h.push(
        '<tr>'+
          '<td><span class="mono">'+esc(t.code)+'</span></td>'+
          '<td class="font-semibold text-[13px]">'+esc(t.label)+'</td>'+
          '<td style="text-align:center">'+(t.show_from?chk:dash)+'</td>'+
          '<td style="text-align:center">'+(t.show_to?chk:dash)+'</td>'+
          '<td style="text-align:center">'+(t.show_ref?chk:dash)+'</td>'+
          '<td style="text-align:center">'+(t.show_doc_date?chk:dash)+'</td>'+
          '<td style="text-align:center">'+
            (t.is_active
              ? '<span class="badge b-signed">ใช้งาน</span>'
              : '<span class="badge b-rejected">ปิดใช้</span>')+
          '</td>'+
          '<td style="text-align:right">'+
            '<div class="flex gap-1.5 justify-end">'+
              '<button class="btn btn-soft xs" data-action="showDocTypeModal" data-id="'+t.id+'">'+svg('edit',11)+' แก้ไข</button>'+
              '<button class="btn btn-soft xs" style="color:#DC2626;border-color:#FECACA" data-action="deleteDocType" data-id="'+t.id+'" data-code="'+esc(t.code)+'">'+svg('trash',11)+'</button>'+
            '</div>'+
          '</td>'+
        '</tr>'
      );
    });
    h.push('</tbody></table></div>');
  }else{
    h.push(
      '<div class="card-empty">'+
        '<div class="card-empty-icon">'+svg('doc',40)+'</div>'+
        '<div class="card-empty-text">ยังไม่มีประเภทเอกสาร</div>'+
        '<div class="text-[13px] text-[#a89e99] mt-2">คลิก "เพิ่มประเภทเอกสาร" เพื่อเริ่มต้น</div>'+
      '</div>'
    );
  }
  h.push('</div>');
  return h.join('');
}

/* ─── DOC TYPE MODAL ─── */
async function showDocTypeModal(typeId){
  var type=null;
  if(typeId){try{var r=await dg('doc_types','?id=eq.'+typeId);type=r&&r[0]||null;}catch(e){}}
  var isEdit=!!type;
  var v=function(f,def){return type!=null&&type[f]!=null?type[f]:def};
  var iconOpts=['dn','up','doc','edit','sign','bell','folder','users','key','ok'].map(function(ic){
    return '<option value="'+ic+'"'+(v('icon','doc')===ic?' selected':'')+'>'+ic+'</option>';
  }).join('');

  var _row=function(label,showId,showChecked,lbId,lbVal,placeholder){
    return '<div style="background:#FAFAF8;border-radius:10px;padding:12px 14px;margin-bottom:8px;border:1px solid #EBEBEB">'+
      '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:'+(showChecked?'10px':'0')+'">'+
        '<input type="checkbox" id="'+showId+'" class="accent-[#E83A00] w-4 h-4"'+(showChecked?' checked':'')+
          ' onchange="dtToggle(\''+lbId+'\',this.checked)">'+
        '<span style="font-size:13px;font-weight:600;color:#18120E">'+label+'</span>'+
      '</label>'+
      '<input type="text" id="'+lbId+'" class="fi" style="font-size:13px;'+(showChecked?'':'display:none')+'" value="'+esc(lbVal)+'" placeholder="'+placeholder+'">'+
    '</div>';
  };

  var box=[
    '<div class="gnk-box" style="max-width:560px;max-height:90vh;overflow-y:auto" onclick="event.stopPropagation()">',
      '<div class="gnk-pop-head">',
        '<div class="gnk-eyebrow">จัดการระบบ</div>',
        '<div class="gnk-pop-title">'+(isEdit?'แก้ไขประเภทเอกสาร':'เพิ่มประเภทเอกสารใหม่')+'</div>',
        '<button class="gnk-xbtn" onclick="gnkClose(\'doctype\')">'+_XSVG+'</button>',
      '</div>',
      '<div class="gnk-divider"></div>',
      '<div class="gnk-pop-body">',
        '<input type="hidden" id="dt-id" value="'+(type?type.id:'')+'">',

        '<div class="gnk-inp-grp">',
          '<label>รหัสประเภท (code) <span style="color:#E83A00">*</span></label>',
          '<input type="text" id="dt-code" class="gnk-inp" value="'+esc(v('code',''))+'"'+
            ' placeholder="เช่น incoming, outgoing, memo" maxlength="30"'+
            (isEdit?' disabled style="background:#F5F3F0;color:#a89e99"':'')+'>',
          (isEdit?'':'<div style="font-size:11px;color:#a89e99;margin-top:5px">ใช้ตัวอักษรภาษาอังกฤษและ underscore เท่านั้น ไม่สามารถแก้ไขได้ภายหลัง</div>'),
        '</div>',

        '<div class="gnk-inp-grp">',
          '<label>ชื่อประเภทเอกสาร (ภาษาไทย) <span style="color:#E83A00">*</span></label>',
          '<input type="text" id="dt-label" class="gnk-inp" value="'+esc(v('label',''))+'" placeholder="เช่น หนังสือขาเข้า">',
        '</div>',

        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">',
          '<div class="gnk-inp-grp" style="margin-bottom:0">',
            '<label>ไอคอน</label>',
            '<select id="dt-icon" class="gnk-inp">'+iconOpts+'</select>',
          '</div>',
          '<div class="gnk-inp-grp" style="margin-bottom:0">',
            '<label>ลำดับการแสดง</label>',
            '<input type="number" id="dt-order" class="gnk-inp" value="'+v('sort_order',0)+'" min="0" max="999">',
          '</div>',
        '</div>',

        '<div style="font-size:11px;font-weight:700;color:#a89e99;text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px">ช่องข้อมูลในฟอร์ม</div>',

        _row('แสดงช่อง "จาก / ผู้ส่ง"','dt-show-from',v('show_from',false),'dt-from-lbl',v('from_label',''),'เช่น จากหน่วยงาน / ผู้ส่ง'),
        _row('แสดงช่อง "ถึง / ผู้รับ"','dt-show-to',v('show_to',false),'dt-to-lbl',v('to_label',''),'เช่น เรียน / ส่งถึงฝ่าย'),
        _row('แสดงช่องอ้างอิง / เลขที่หนังสือ','dt-show-ref',v('show_ref',false),'dt-ref-lbl',v('ref_label',''),'เช่น เลขที่หนังสือ (อ้างอิง)'),
        _row('แสดงช่องวันที่เอกสาร','dt-show-docdate',v('show_doc_date',false),'dt-docdate-lbl',v('doc_date_label',''),'เช่น วันที่รับเอกสาร'),

        '<div style="background:#FAFAF8;border-radius:10px;padding:12px 14px;margin-bottom:8px;border:1px solid #EBEBEB">',
          '<div style="font-size:13px;font-weight:600;color:#18120E;margin-bottom:10px">ช่องวันกำหนด <span style="font-size:11px;color:#a89e99;font-weight:400">(แสดงเสมอ)</span></div>',
          '<input type="text" id="dt-event-lbl" class="fi" style="font-size:13px;margin-bottom:10px" value="'+esc(v('event_label','วันกำหนดส่ง'))+'" placeholder="เช่น วันที่ต้องดำเนินการเสร็จ">',
          '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:#6b6560">',
            '<input type="checkbox" id="dt-event-req" class="accent-[#E83A00] w-4 h-4"'+(v('event_required',false)?' checked':'')+'>',
            'บังคับกรอก (required)',
          '</label>',
        '</div>',

        '<div class="gnk-divider" style="margin:14px 0"></div>',
        '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:#18120E;font-weight:500">',
          '<input type="checkbox" id="dt-active" class="accent-[#E83A00] w-4 h-4"'+(v('is_active',true)?' checked':'')+'>',
          'เปิดใช้งาน <span style="font-size:11px;color:#a89e99;font-weight:400">(แสดงในฟอร์มสร้างเอกสาร)</span>',
        '</label>',

      '</div>',
      '<div class="gnk-pop-foot">',
        '<button class="gnk-btn-c" onclick="gnkClose(\'doctype\')">ยกเลิก</button>',
        '<button class="gnk-btn-p" id="dt-save-btn" data-action="saveDocType">'+_OKSVG+(isEdit?'บันทึกการแก้ไข':'เพิ่มประเภทเอกสาร')+'</button>',
      '</div>',
    '</div>'
  ].join('');
  _gnkOpen('doctype',box);
}

function dtToggle(inputId,on){
  var el=$e(inputId);
  if(!el) return;
  if(on){el.style.display='block';el.parentElement.querySelector('label').style.marginBottom='10px';}
  else{el.style.display='none';el.parentElement.querySelector('label').style.marginBottom='0';}
}

async function saveDocType(){
  var id=gv('dt-id')||'';
  var code=(gv('dt-code')||'').trim().toLowerCase().replace(/[^a-z0-9_]/g,'');
  var label=(gv('dt-label')||'').trim();
  if(!code){var c=$e('dt-code');if(c){c.style.borderColor='#E83A00';c.focus();setTimeout(function(){c.style.borderColor='';},1800);}return;}
  if(!label){var l=$e('dt-label');if(l){l.style.borderColor='#E83A00';l.focus();setTimeout(function(){l.style.borderColor='';},1800);}return;}
  var gc=function(i){return !!$e(i)&&$e(i).checked;};
  var body={
    code:code,label:label,icon:gv('dt-icon')||'doc',
    sort_order:parseInt(gv('dt-order')||'0',10)||0,
    show_from:gc('dt-show-from'),from_label:gv('dt-from-lbl')||'',
    show_to:gc('dt-show-to'),to_label:gv('dt-to-lbl')||'',
    show_ref:gc('dt-show-ref'),ref_label:gv('dt-ref-lbl')||'',
    show_doc_date:gc('dt-show-docdate'),doc_date_label:gv('dt-docdate-lbl')||'',
    event_label:gv('dt-event-lbl')||'วันกำหนดส่ง',event_required:gc('dt-event-req'),
    is_active:gc('dt-active')
  };
  var btn=$e('dt-save-btn');
  if(btn){btn.disabled=true;btn.innerHTML=_SPINSVG+'กำลังบันทึก...';}
  try{
    if(id){await dpa('doc_types',id,body);}else{await dp('doc_types',body);}
    await loadDocTypes();
    gnkClose('doctype');
    setTimeout(function(){nav('sys');},220);
  }catch(e){
    if(btn){btn.disabled=false;btn.innerHTML=_OKSVG+(id?'บันทึกการแก้ไข':'เพิ่มประเภทเอกสาร');}
    alert('เกิดข้อผิดพลาด: '+(e&&e.message||String(e)));
  }
}

async function deleteDocType(typeId,code){
  if(!confirm('ลบประเภทเอกสาร "'+code+'" ?\n\nเอกสารที่สร้างไว้แล้วจะยังคงอยู่ แต่จะไม่สามารถเลือกประเภทนี้ในฟอร์มสร้างเอกสารได้อีก'))return;
  try{
    await dd('doc_types',typeId);
    await loadDocTypes();
    nav('sys');
  }catch(e){alert('เกิดข้อผิดพลาด: '+(e&&e.message||String(e)));}
}
