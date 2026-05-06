/* ─── DOC TYPE ADMIN ─── */

var _dtFields = [];  // working fields array for the open modal

var _DT_COLS = {
  from_department: {defLabel:'จากหน่วยงาน / ผู้ส่ง', type:'text',     ph:'เช่น ฝ่ายวิชาการ'},
  addressed_to:    {defLabel:'เรียน / ผู้รับ',        type:'text',     ph:'ระบุผู้รับเอกสาร'},
  subject_line:    {defLabel:'เลขที่หนังสือ/อ้างอิง', type:'text',     ph:'—'},
  doc_date:        {defLabel:'วันที่เอกสาร',           type:'date',     ph:''},
  description:     {defLabel:'รายละเอียดเพิ่มเติม',   type:'textarea', ph:'รายละเอียด...'}
};
var _DT_COL_NAMES = {
  from_department:'จาก / ผู้ส่ง', addressed_to:'เรียน / ผู้รับ',
  subject_line:'เลขที่อ้างอิง', doc_date:'วันที่เอกสาร', description:'รายละเอียด'
};

var _DT_TYPE_STYLE={
  text:    {bg:'#F5F3F0',color:'#6b6560',label:'text'},
  date:    {bg:'#EFF6FF',color:'#2563EB',label:'date'},
  textarea:{bg:'#F5F3FF',color:'#7C3AED',label:'textarea'}
};

function _renderDtFieldsList(){
  var el=document.getElementById('dt-fields-list');
  if(!el) return;
  if(!_dtFields.length){
    el.innerHTML=
      '<div style="text-align:center;padding:20px 0 14px;border:1.5px dashed #E0DBD7;border-radius:10px">'+
        '<div style="font-size:22px;margin-bottom:6px;opacity:.35">⊞</div>'+
        '<div style="font-size:12px;color:#a89e99">ยังไม่มีช่องข้อมูล</div>'+
        '<div style="font-size:11px;color:#C0BAB4;margin-top:2px">เลือกช่องจากด้านล่างเพื่อเพิ่ม</div>'+
      '</div>';
  }else{
    el.innerHTML=_dtFields.map(function(f,i){
      var ts=_DT_TYPE_STYLE[f.field_type||'text']||_DT_TYPE_STYLE.text;
      var isFirst=i===0, isLast=i===_dtFields.length-1;
      var btnBase='width:26px;height:26px;border-radius:7px;font-size:12px;line-height:1;cursor:pointer;flex-shrink:0;border:1px solid ';
      return '<div style="display:flex;gap:8px;align-items:center;padding:9px 11px;background:#fff;border:1px solid #EBEBEB;border-radius:10px;margin-bottom:6px;box-shadow:0 1px 3px rgba(0,0,0,.04)">'+
        '<div style="display:flex;flex-direction:column;gap:4px;min-width:64px;flex-shrink:0">'+
          '<span style="font-size:9.5px;font-weight:700;color:#6b6560;line-height:1.2">'+esc(_DT_COL_NAMES[f.db_column]||f.db_column)+'</span>'+
          '<span style="font-size:9px;font-weight:600;padding:1px 5px;border-radius:4px;display:inline-block;background:'+ts.bg+';color:'+ts.color+'">'+ts.label+'</span>'+
        '</div>'+
        '<input type="text" class="gnk-inp" style="flex:1;font-size:12px;padding:5px 9px;height:30px;margin-bottom:0" value="'+esc(f.label)+
          '" oninput="_dtFields['+i+'].label=this.value" placeholder="ชื่อฉลาก">'+
        '<label style="display:flex;align-items:center;gap:4px;font-size:10.5px;white-space:nowrap;cursor:pointer;color:#6b6560;flex-shrink:0">'+
          '<input type="checkbox" class="accent-[#E83A00] w-3 h-3"'+(f.required?' checked':'')+
            ' onchange="_dtFields['+i+'].required=this.checked">จำเป็น</label>'+
        '<div style="display:flex;gap:3px;flex-shrink:0">'+
          '<button style="'+btnBase+(isFirst?'#EBEBEB;background:#FAFAF8;color:#D0CBCA;cursor:default':'#EBEBEB;background:#F5F3F0;color:#6b6560')+'" '+(isFirst?'disabled':'')+' onclick="_dtFieldMove('+i+',-1)">↑</button>'+
          '<button style="'+btnBase+(isLast?'#EBEBEB;background:#FAFAF8;color:#D0CBCA;cursor:default':'#EBEBEB;background:#F5F3F0;color:#6b6560')+'" '+(isLast?'disabled':'')+' onclick="_dtFieldMove('+i+',1)">↓</button>'+
          '<button style="'+btnBase+'#FECACA;background:#FEF2F2;color:#DC2626;display:inline-flex;align-items:center;justify-content:center" onclick="_dtFieldDel('+i+')">'+svg('x',12)+'</button>'+
        '</div>'+
      '</div>';
    }).join('');
  }
  _updateDtAddSelect();
}

function _dtPickIcon(ic){
  var h=$e('dt-icon'); if(h) h.value=ic;
  document.querySelectorAll('.dt-icon-tile').forEach(function(t){
    var sel=t.dataset.ic===ic;
    t.style.background=sel?'#FFF0EB':'#F5F3F0';
    t.style.color=sel?'#E83A00':'#6b6560';
    t.style.borderColor=sel?'#E83A00':'transparent';
    t.style.boxShadow=sel?'0 0 0 2px #FFD0BB':'none';
  });
}

function _dtFieldMove(i, dir){
  var j=i+dir;
  if(j<0||j>=_dtFields.length) return;
  var tmp=_dtFields[i]; _dtFields[i]=_dtFields[j]; _dtFields[j]=tmp;
  _renderDtFieldsList();
}

function _dtFieldDel(i){
  _dtFields.splice(i,1);
  _renderDtFieldsList();
}

function _dtFieldAdd(){
  var inp=document.getElementById('dt-add-col');
  if(!inp||!inp.value.trim()) return;
  var inputVal=inp.value.trim();
  // Reverse-lookup: if user picked a known Thai label, map to its db_column key
  var col=null;
  Object.keys(_DT_COLS).forEach(function(k){
    if(_DT_COLS[k].defLabel===inputVal) col=k;
  });
  if(!col){
    // Custom: sanitize to snake_case db_column
    col=inputVal.toLowerCase().replace(/[^a-z0-9_]/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'');
    if(!col) return;
  }
  if(_dtFields.some(function(f){return f.db_column===col})){
    inp.style.borderColor='#E83A00';
    setTimeout(function(){inp.style.borderColor='';},1500);
    return;
  }
  var def=_DT_COLS[col]||{defLabel:inputVal,type:'text',ph:''};
  _dtFields.push({db_column:col,label:def.defLabel,placeholder:def.ph,required:false,field_type:def.type});
  inp.value='';
  _renderDtFieldsList();
}

function _updateDtAddSelect(){
  var dl=document.getElementById('dt-col-datalist');
  if(!dl) return;
  var used=_dtFields.map(function(f){return f.db_column});
  dl.innerHTML=Object.keys(_DT_COLS).filter(function(k){return used.indexOf(k)===-1}).map(function(k){
    return '<option value="'+esc(_DT_COLS[k].defLabel)+'">';
  }).join('');
}

/* ─── DOC TYPES TABLE ─── */
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
        '<th style="text-align:center">ช่องในฟอร์ม</th>'+
        '<th style="text-align:center">ระยะเวลาขั้นต่ำ</th>'+
        '<th style="text-align:center">กำหนดส่ง</th>'+
        '<th style="text-align:center">สถานะ</th>'+
        '<th style="text-align:right">จัดการ</th>'+
      '</tr></thead><tbody>'
    );
    types.forEach(function(t){
      h.push(
        '<tr>'+
          '<td><span class="mono">'+esc(t.code)+'</span></td>'+
          '<td class="font-semibold text-[13px]">'+esc(t.label)+'</td>'+
          '<td style="text-align:center" class="text-[12px] text-[#6b6560]">'+(t._fieldCount||0)+' ช่อง</td>'+
          '<td style="text-align:center" class="text-[12px]">'+
            (t.min_days?t.min_days+' วัน':'<span class="text-[#C0BAB4]">—</span>')+
          '</td>'+
          '<td style="text-align:center">'+
            (t.enable_deadline!==false
              ?'<span class="badge b-signed">เปิด</span>'
              :'<span class="badge b-rejected">ปิด</span>')+
          '</td>'+
          '<td style="text-align:center">'+
            (t.is_active
              ?'<span class="badge b-signed">ใช้งาน</span>'
              :'<span class="badge b-rejected">ปิดใช้</span>')+
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

/* ─── DOC TYPE MODAL (Modern Orange Theme) ─── */
async function showDocTypeModal(typeId){
  var type=null;
  if(typeId){try{var r=await dg('doc_types','?id=eq.'+typeId);type=r&&r[0]||null;}catch(e){}}

  _dtFields=[];
  if(typeId&&type){
    try{
      var flds=await dg('doc_type_fields','?doc_type_id=eq.'+typeId+'&order=sort_order');
      _dtFields=flds||[];
    }catch(e){}
  }

  var isEdit=!!type;
  var v=function(f,def){return type!=null&&type[f]!=null?type[f]:def};
  var curIcon=v('icon','doc');
  var enableDl=v('enable_deadline',true);

  var _ICON_LABELS={dn:'ขาเข้า',up:'ขาออก',doc:'เอกสาร',edit:'แก้ไข',sign:'ลงนาม',bell:'แจ้งเตือน',folder:'แฟ้ม',users:'ทีม',key:'สำคัญ',ok:'เสร็จ'};
  var iconPicker=['dn','up','doc','edit','sign','bell','folder','users','key','ok'].map(function(ic){
    var sel=curIcon===ic;
    return '<div class="dt-icon-tile" data-ic="'+ic+'" onclick="_dtPickIcon(\''+ic+'\')" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 4px;border-radius:14px;border:1.5px solid '+(sel?'#E83A00':'#F1F1F1')+';background:'+(sel?'#FFF5F2':'#FAFAFA')+';color:'+(sel?'#E83A00':'#6b6560')+';cursor:pointer;min-width:54px;transition:all .2s;box-shadow:'+(sel?'0 4px 12px -2px rgba(232, 58, 0, 0.2)':'none')+'">'+
      svg(ic,18)+'<span style="font-size:9px;font-weight:700">'+esc(_ICON_LABELS[ic])+'</span>'+
    '</div>';
  }).join('');

  /* Section header helper */
  var _sec=function(t){
    return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;margin-top:24px">'+
      '<div style="width:10px;height:2px;background:#E83A00;border-radius:2px;flex-shrink:0"></div>'+
      '<span style="font-size:10px;font-weight:800;color:#E83A00;text-transform:uppercase;letter-spacing:0.1em">'+t+'</span>'+
    '</div>';
  };

  var box=[
    '<div class="gnk-box overflow-hidden" style="max-width:580px;max-height:92vh;border-radius:28px;background:#fff;box-shadow: 0 40px 100px -20px rgba(232, 58, 0, 0.15);border: 1px solid rgba(232, 58, 0, 0.05)" onclick="event.stopPropagation()">',
      
      // Header
      '<div class="gnk-pop-head" style="padding: 28px 32px 20px 32px; background: linear-gradient(to bottom, rgba(232, 58, 0, 0.05), #fff); display:flex; justify-content:space-between; align-items:flex-start;">',
        '<div class="flex flex-col gap-1">',
          '<div style="color:#E83A00; font-weight:800; font-size:10px; letter-spacing:0.12em; text-transform:uppercase; display:flex; align-items:center; gap:6px;">',
  '<span style="width:10px; height:2px; background:#E83A00; border-radius:2px;"></span> System Admin',
'</div>',
          '<div class="gnk-pop-title" style="font-size:19px; font-weight:850; color:#18120E; letter-spacing:-0.02em;">'+(isEdit?'แก้ไขประเภทเอกสาร':'เพิ่มประเภทเอกสารใหม่')+'</div>',
        '</div>',
        '<button class="gnk-xbtn" style="background:rgba(232, 58, 0, 0.08); color:#E83A00; border-radius:12px; width:34px; height:34px; display:flex; align-items:center; justify-content:center; border:none; cursor:pointer;" onclick="gnkClose(\'doctype\')">'+_XSVG+'</button>',
      '</div>',

      '<div class="gnk-pop-body" style="padding: 0 32px 24px 32px; overflow-y:auto; max-height:calc(92vh - 160px);">',
        '<input type="hidden" id="dt-id" value="'+(type?type.id:'')+'">',
        '<input type="hidden" id="dt-icon" value="'+esc(curIcon)+'">',

        /* ── ข้อมูลพื้นฐาน ── */
        _sec('ข้อมูลพื้นฐาน'),
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">',
          '<div class="gnk-inp-grp" style="margin-bottom:0">',
            '<label style="display:block; font-size:11.5px; font-weight:700; color:#18120E; margin-bottom:6px;">รหัสประเภท (Code) <span style="color:#E83A00">*</span></label>',
            '<input type="text" id="dt-code" class="gnk-inp" value="'+esc(v('code',''))+'"'+
              ' placeholder="เช่น incoming" maxlength="30"'+
              (isEdit?' disabled style="background:#FAFAFA;color:#a89e99;font-family:monospace;font-size:12.5px;border:1.5px solid #F1F1F1;border-radius:12px;width:100%;height:44px;padding:0 14px"' : ' style="font-family:monospace;font-size:12.5px;background:#FAFAFA;border:1.5px solid #F1F1F1;border-radius:12px;width:100%;height:44px;padding:0 14px"')+'>',
            (isEdit?'':'<div style="font-size:10px;color:#94A3B8;margin-top:4px;margin-left:2px">a–z, 0–9, _ เท่านั้น · แก้ไขไม่ได้ภายหลัง</div>'),
          '</div>',
          '<div class="gnk-inp-grp" style="margin-bottom:0">',
            '<label style="display:block; font-size:11.5px; font-weight:700; color:#18120E; margin-bottom:6px;">ลำดับการแสดง</label>',
            '<input type="number" id="dt-order" class="gnk-inp" value="'+v('sort_order',0)+'" min="0" max="999" style="font-size:12.5px;background:#FAFAFA;border:1.5px solid #F1F1F1;border-radius:12px;width:100%;height:44px;padding:0 14px">',
          '</div>',
        '</div>',
        '<div class="gnk-inp-grp">',
          '<label style="display:block; font-size:11.5px; font-weight:700; color:#18120E; margin-bottom:6px;">ชื่อประเภทเอกสาร (ภาษาไทย) <span style="color:#E83A00">*</span></label>',
          '<input type="text" id="dt-label" class="gnk-inp" value="'+esc(v('label',''))+'" placeholder="เช่น หนังสือขาเข้า" style="font-size:12.5px;background:#FAFAFA;border:1.5px solid #F1F1F1;border-radius:12px;width:100%;height:44px;padding:0 14px">',
        '</div>',

        /* ── ไอคอน ── */
        '<div class="gnk-inp-grp" style="margin-top:16px">',
          '<label style="display:block; font-size:11.5px; font-weight:700; color:#18120E; margin-bottom:10px;">เลือกไอคอนสัญลักษณ์</label>',
          '<div style="display:flex;flex-wrap:wrap;gap:8px;padding:12px;background:#FDFDFD;border-radius:18px;border:1px solid #F1F1F1">'+iconPicker+'</div>',
        '</div>',

        /* ── ช่องข้อมูล ── */
          _sec('ช่องข้อมูลในฟอร์ม'),
          '<div id="dt-fields-list"></div>',
          '<div style="display:flex; gap:10px; margin-top:12px; padding:12px; background:#F8F8F8; border-radius:16px; border:2px dashed #E5E5E5;">',
            '<input type="text" id="dt-add-col" list="dt-col-datalist" class="gnk-inp" style="flex:1; font-size:12px; margin-bottom:0; background:#fff; border-radius:10px; height:38px; padding:0 12px; border:1px solid #EBEBEB; outline:none;" placeholder="เลือกหรือพิมพ์ชื่อช่อง...">',
            '<datalist id="dt-col-datalist"></datalist>',
            '<button class="btn btn-primary" onclick="_dtFieldAdd()" style="white-space:nowrap; flex-shrink:0; background:#E83A00; color:#fff; border:none; border-radius:10px; padding:0 14px; font-size:11px; font-weight:700; display:flex; align-items:center; gap:6px; cursor:pointer; transition:opacity 0.2s;" onmouseover="this.style.opacity=\'0.9\'" onmouseout="this.style.opacity=\'1\'">'+svg('plus',12)+' เพิ่มช่องข้อมูล</button>',
          '</div>',

        /* ── วันกำหนดส่ง ── */
        _sec('วันกำหนดส่ง / Deadline'),
        '<div style="border:1px solid #F1F1F1;border-radius:20px;overflow:hidden;background:#FAFAFA;margin-bottom:14px">',
          '<label style="display:flex;align-items:center;gap:12px;padding:16px;cursor:pointer;margin:0">',
            '<input type="checkbox" id="dt-enable-deadline" class="accent-[#E83A00] w-4 h-4"'+(enableDl?' checked':'')+
              ' onchange="dtToggleDeadline(this.checked)">',
            '<div style="flex:1">',
              '<div style="font-size:12.5px;font-weight:700;color:#18120E">เปิดใช้งานฟังก์ชัน Deadline</div>',
              '<div style="font-size:10.5px;color:#94A3B8;margin-top:1px">ระบบจะแสดงตัวเลือกวันที่ต้องดำเนินการให้ในฟอร์ม</div>',
            '</div>',
            '<span style="font-size:10px;font-weight:700;padding:4px 10px;border-radius:8px;background:'+(enableDl?'#DCFCE7':'#F1F1F1')+';color:'+(enableDl?'#15803D':'#94A3B8')+'">'+(enableDl?'ACTIVE':'OFF')+'</span>',
          '</label>',
          '<div id="dt-deadline-detail" style="'+(enableDl?'':'display:none')+';padding:20px;border-top:1px solid #F1F1F1;background:#fff">',
            '<div style="display:grid;grid-template-columns:1fr auto;gap:12px;margin-bottom:14px;align-items:end">',
              '<div class="gnk-inp-grp" style="margin-bottom:0">',
                '<label style="font-size:11px;font-weight:700;color:#64748B;margin-bottom:6px;display:block">ชื่อป้ายกำกับ (Label)</label>',
                '<input type="text" id="dt-event-lbl" class="gnk-inp" value="'+esc(v('event_label','วันกำหนดส่ง'))+'" placeholder="เช่น วันที่ต้องดำเนินการเสร็จ" style="font-size:12px;height:40px;border-radius:10px;border:1.5px solid #F1F1F1;width:100%;padding:0 12px">',
              '</div>',
              '<div class="gnk-inp-grp" style="margin-bottom:0;min-width:120px">',
                '<label style="font-size:11px;font-weight:700;color:#64748B;margin-bottom:6px;display:block">ระยะเวลาขั้นต่ำ</label>',
                '<div style="display:flex;align-items:center;gap:8px">',
                  '<input type="number" id="dt-min-days" class="gnk-inp" value="'+v('min_days',0)+'" min="0" max="365" style="text-align:center;font-size:12px;height:40px;border-radius:10px;border:1.5px solid #F1F1F1;width:60px">',
                  '<span style="font-size:11px;color:#94A3B8;font-weight:600">วัน</span>',
                '</div>',
              '</div>',
            '</div>',
            '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:11px;color:#475569;padding:12px;background:#FAFAFA;border-radius:12px;border:1px solid #F1F1F1">',
              '<input type="checkbox" id="dt-event-req" class="accent-[#E83A00] w-3.5 h-3.5"'+(v('event_required',false)?' checked':'')+'>',
              '<span><b>บังคับระบุวันกำหนดส่ง</b> (Required Field)</span>',
            '</label>',
          '</div>',
        '</div>',

        /* ── สถานะ ── */
        '<label style="display:flex;align-items:center;gap:12px;cursor:pointer;padding:16px;border:1px solid #F1F1F1;border-radius:18px;background:#FAFAFA;transition:0.2s">',
          '<input type="checkbox" id="dt-active" class="accent-[#E83A00] w-4 h-4"'+(v('is_active',true)?' checked':'')+'>',
          '<div>',
            '<div style="font-size:12.5px;font-weight:700;color:#18120E">สถานะเปิดใช้งาน</div>',
            '<div style="font-size:10.5px;color:#94A3B8;margin-top:1px">แสดงประเภทเอกสารนี้ในระบบเพื่อให้พนักงานเลือกใช้งาน</div>',
          '</div>',
        '</label>',

      '</div>',
      
      // Footer
      '<div class="gnk-pop-foot" style="padding:0 32px 32px 32px;display:flex;gap:12px;background:none;border:none">',
        '<button class="gnk-btn-c" style="flex:1;height:48px;border-radius:14px;font-weight:600;font-size:12.5px;border:1px solid #EBEBEB;background:#fff;color:#6b6560;cursor:pointer" onclick="gnkClose(\'doctype\')">ยกเลิก</button>',
        '<button class="gnk-btn-p" id="dt-save-btn" data-action="saveDocType" style="flex:1.8;height:48px;border-radius:14px;font-weight:700;font-size:12.5px;background:#E83A00;color:#fff;display:flex;align-items:center;justify-content:center;gap:8px;border:none;cursor:pointer;box-shadow:0 8px 16px -4px rgba(232, 58, 0, 0.4)">',
          _OKSVG+(isEdit?'บันทึกการแก้ไข':'เพิ่มประเภทเอกสาร') + 
        '</button>',
      '</div>',
    '</div>'
  ].join('');

  _gnkOpen('doctype',box);
  setTimeout(function(){_renderDtFieldsList();},50);
}

function dtToggleDeadline(on){
  var el=document.getElementById('dt-deadline-detail');
  if(el) el.style.display=on?'block':'none';
  // Update status pill
  var pill=el&&el.parentElement&&el.parentElement.querySelector('label span:last-child');
  if(pill){
    pill.textContent=on?'เปิด':'ปิด';
    pill.style.background=on?'#DCFCE7':'#F5F3F0';
    pill.style.color=on?'#16A34A':'#a89e99';
  }
}

async function saveDocType(){
  var id=gv('dt-id')||'';
  var code=(gv('dt-code')||'').trim().toLowerCase().replace(/[^a-z0-9_]/g,'');
  var label=(gv('dt-label')||'').trim();
  if(!code){var c=$e('dt-code');if(c){c.style.borderColor='#E83A00';c.focus();setTimeout(function(){c.style.borderColor='';},1800);}return;}
  if(!label){var l=$e('dt-label');if(l){l.style.borderColor='#E83A00';l.focus();setTimeout(function(){l.style.borderColor='';},1800);}return;}
  var gc=function(i){return !!$e(i)&&$e(i).checked;};
  var enableDl=gc('dt-enable-deadline');
  var body={
    code:code, label:label, icon:gv('dt-icon')||'doc',
    sort_order:parseInt(gv('dt-order')||'0',10)||0,
    enable_deadline:enableDl,
    min_days:enableDl?parseInt(gv('dt-min-days')||'0',10)||0:0,
    event_label:enableDl?gv('dt-event-lbl')||'วันกำหนดส่ง':'',
    event_required:enableDl?gc('dt-event-req'):false,
    is_active:gc('dt-active')
  };
  var btn=$e('dt-save-btn');
  if(btn){btn.disabled=true;btn.innerHTML=_SPINSVG+'กำลังบันทึก...';}
  try{
    var savedType;
    if(id){
      var pr=await dpa('doc_types',id,body);
      savedType=pr&&pr[0]||{id:id};
    }else{
      var pr=await dp('doc_types',body);
      savedType=pr&&pr[0];
    }
    var typeId=savedType&&savedType.id||id;
    if(typeId){
      await fetch(SU+'/rest/v1/doc_type_fields?doc_type_id=eq.'+typeId,
        {method:'DELETE',headers:{apikey:SK,'Authorization':'Bearer '+SK}});
      if(_dtFields.length){
        var insertRows=_dtFields.map(function(f,i){
          return {doc_type_id:typeId,db_column:f.db_column,label:f.label,
            placeholder:f.placeholder||'',required:!!f.required,
            field_type:f.field_type||'text',sort_order:i+1};
        });
        await dp('doc_type_fields',insertRows);
      }
    }
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
