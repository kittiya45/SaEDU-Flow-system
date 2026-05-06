/* ─── ADMIN IMPORT — นำเข้าผู้ใช้จากไฟล์ CSV ─── */
/* ─── IMPORT USERS (CSV) - Realistic Orange Style ─── */
function showImport(){
  if(!CU||!(CU.role_code==='ROLE-SYS'||CU.role_code==='ROLE-STF')){alert('เฉพาะผู้ดูแลระบบและเจ้าหน้าที่เท่านั้น');return}
  var tmpl='ชื่อ-นามสกุล,อีเมล,รหัสผ่าน,บทบาท,ฝ่าย,ประเภท\n'+
    'สมชาย ใจดี,somchai@gnk.ac.th,pass1234,ROLE-CRT,ฝ่ายวิชาการ,gnk\n'+
    'อาจารย์ A,teacher@uni.ac.th,pass1234,ROLE-ADV,สำนักกิจการนิสิต,advisor';

  var box = [
    '<div class="gnk-box overflow-hidden" style="max-width:580px; width:95%; border-radius:32px; background:#fff; box-shadow: 0 40px 100px -20px rgba(232, 58, 0, 0.12); border: 1px solid rgba(232, 58, 0, 0.03);" onclick="event.stopPropagation()">',
      
      // --- Header (Gradient Soft Orange) ---
      '<div class="gnk-pop-head" style="padding: 32px 32px 20px 32px; background: linear-gradient(to bottom, rgba(232, 58, 0, 0.05), #fff); display:flex; justify-content:space-between; align-items:flex-start;">',
        '<div class="flex flex-col gap-1.5">',
          '<div style="color:#E83A00; font-weight:800; font-size:10px; letter-spacing:0.12em; text-transform:uppercase; display:flex; align-items:center; gap:8px;">',
            '<span style="width:12px; height:2.5px; background:#E83A00; border-radius:3px;"></span> Import Tool',
          '</div>',
          '<div class="gnk-pop-title" style="font-size:20px; font-weight:850; color:#18120E; letter-spacing:-0.02em;">นำเข้าข้อมูลผู้ใช้</div>',
        '</div>',
        '<button class="gnk-xbtn" style="background:linear-gradient(145deg, #fff, #FFF0EB); color:#E83A00; border-radius:14px; width:36px; height:36px; display:flex; align-items:center; justify-content:center; border:none; cursor:pointer; box-shadow: 2px 2px 5px rgba(0,0,0,0.05), -2px -2px 5px #fff;" onclick="gnkClose(\'imp\')">' + _XSVG + '</button>',
      '</div>',

      // --- Body ---
      '<div class="gnk-pop-body" style="padding: 0 32px 28px 32px;">',
        
        // Info Box: ปรับให้สมจริงด้วยขอบประและ Icon ที่มีมิติ
        '<div style="background:rgba(232, 58, 0, 0.01); border:1.5px dashed rgba(232, 58, 0, 0.2); border-radius:24px; padding:20px; margin-bottom:24px; position:relative;">',
          '<div style="display:flex; gap:12px; align-items:flex-start;">',
            '<div style="width:36px; height:36px; background:#fff; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#E83A00; box-shadow: 2px 2px 8px rgba(232, 58, 0, 0.1); shrink:0;">' + _ISVG + '</div>',
            '<div>',
              '<div style="font-size:12px; font-weight:800; color:#18120E; margin-bottom:6px;">ข้อกำหนดไฟล์ CSV (ลำดับคอลัมน์):</div>',
              '<div style="font-size:11px; font-family:\'JetBrains Mono\', monospace; color:#E83A00; background:#FFF5F2; padding:6px 12px; border-radius:10px; display:inline-block; border:1px solid rgba(232, 58, 0, 0.1); font-weight:600;">ชื่อ-นามสกุล, อีเมล, รหัสผ่าน, บทบาท, ฝ่าย, ประเภท</div>',
              '<div style="display:grid; grid-template-columns:1.2fr 1fr; gap:15px; margin-top:12px; font-size:10.5px;">',
                '<div style="color:#6b6560;"><b style="color:#18120E; display:block; margin-bottom:2px;">Roles:</b> ROLE-CRT, ROLE-REV, ROLE-SGN,<br>ROLE-ADV, ROLE-STF</div>',
                '<div style="color:#6b6560;"><b style="color:#18120E; display:block; margin-bottom:2px;">Types:</b> gnk, advisor, staff</div>',
              '</div>',
            '</div>',
          '</div>',
        '</div>',

        // Action Buttons: ปรับให้ดูเป็นปุ่มกดที่มีมิติ (Semi-Realistic)
        '<div style="display:flex; gap:12px; margin-bottom:24px;">',
          '<label style="flex:1; display:flex; align-items:center; justify-content:center; gap:10px; background:#F59E0B; color:#fff; height:48px; border-radius:16px; font-size:13px; font-weight:800; cursor:pointer; transition:0.3s; box-shadow: 0 8px 15px -4px rgba(245, 158, 11, 0.4); position:relative; overflow:hidden;" onmouseover="this.style.transform=\'translateY(-1px)\'; this.style.boxShadow=\'0 12px 20px -4px rgba(245, 158, 11, 0.5)\'" onmouseout="this.style.transform=\'translateY(0)\'; this.style.boxShadow=\'0 8px 15px -4px rgba(245, 158, 11, 0.4)\'">',
            '<span style="position:absolute; top:0; left:0; width:100%; height:50%; background:rgba(255,255,255,0.1);"></span>',
           '<span style="position:relative; display:flex; align-items:center; gap:8px;">'+svg('up', 18) + ' เลือกไฟล์ CSV</span>',
            '<input type="file" id="imp-file" accept=".csv" style="display:none" onchange="parseImportCSV()">',
          '</label>',
          '<a style="flex:1; display:flex; align-items:center; justify-content:center; gap:10px; background:#fff; color:#6b6560; border:1.5px solid #F1F1F1; height:48px; border-radius:16px; font-size:13px; font-weight:700; text-decoration:none; transition:0.3s; box-shadow: 0 4px 6px rgba(0,0,0,0.02);" onmouseover="this.style.background=\'#FAFAFA\'; this.style.borderColor=\'#E83A00\'; this.style.color=\'#E83A00\'" onmouseout="this.style.background=\'#fff\'; this.style.borderColor=\'#F1F1F1\'; this.style.color=\'#6b6560\'" href="data:text/csv;charset=utf-8,\ufeff' + encodeURIComponent(tmpl) + '" download="template_import.csv">',
            svg('dn', 18) + ' ดาวน์โหลดแม่แบบ',
          '</a>',
        '</div>',

        // Preview Table Container
        '<div style="font-size:11px; font-weight:700; color:#94A3B8; margin-bottom:8px; margin-left:4px; text-transform:uppercase; letter-spacing:0.05em;">รายการที่ตรวจสอบพบ:</div>',
        '<div id="imp-preview" style="max-height:220px; overflow-y:auto; border-radius:20px; border:1.5px solid #F8F8F8; background:#FAFAFA; box-shadow:inset 0 2px 4px rgba(0,0,0,0.03);"></div>',
      '</div>',

      // --- Footer ---
      '<div class="gnk-pop-foot" style="padding:0 32px 32px 32px; display:flex; gap:16px; justify-content:flex-end; align-items:center; background:none;">',
        '<button style="font-size:13px; font-weight:700; color:#94A3B8; background:none; border:none; cursor:pointer; padding:0 15px; transition:0.2s;" onmouseover="this.style.color=\'#E83A00\'" onmouseout="this.style.color=\'#94A3B8\'" onclick="gnkClose(\'imp\')">ยกเลิก</button>',
        
        // ปรับเป็นปุ่มสีเขียวแบบมีมิติ (Semi-Realistic Green)
        '<button id="imp-btn" style="display:none; height:50px; padding:0 36px; border-radius:18px; font-weight:850; font-size:13px; background:#E83A00; color:#fff; align-items:center; justify-content:center; gap:10px; border:none; cursor:pointer; transition:0.3s; box-shadow: 0 10px 20px -5px rgba(232, 58, 0, 0.4); position:relative; overflow:hidden;" onmouseover="this.style.transform=\'translateY(-1px)\'; this.style.background=\'#C43200\'; this.style.boxShadow=\'0 12px 25px -5px rgba(232, 58, 0, 0.5)\'" onmouseout="this.style.transform=\'translateY(0)\'; this.style.background=\'#E83A00\'; this.style.boxShadow=\'0 10px 20px -5px rgba(232, 58, 0, 0.4)\'" data-action="doImport">',
          // แสง Highlight ด้านบนทำให้ดูนูนแบบ 3D
          '<span style="position:absolute; top:0; left:0; width:100%; height:50%; background:rgba(255,255,255,0.15); border-radius:18px 18px 0 0;"></span>',
          '<span style="position:relative; display:flex; align-items:center; gap:8px; text-shadow: 0 1px 2px rgba(0,0,0,0.1);">' + svg('ok', 18) + ' ยืนยันนำเข้าข้อมูล</span>', 
        '</button>',
      '</div>',
    '</div>'
  ].join('');

  _gnkOpen('imp', box);
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
