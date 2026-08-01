/* ─── WORKFLOW PEOPLE PICKER ───
   การ์ดยกลอย (border + shadow เบา ๆ) ให้เข้ากับสไตล์ปุ่ม/อินพุตที่โค้งมนนิ่ม ๆ ของฟอร์มนี้
   ปุ่มลบอยู่ในกรอบการ์ดเดียวกับเนื้อหาเสมอ ไม่ลอยแยกออกไปนอกแถว */
/* ตัวเลือกบุคคลแบบจัดกลุ่มตามตำแหน่ง/บทบาท (optgroup) — ใช้ทั้ง picker หลัก (#wfadd ใน vForm)
   และ dropdown ของขั้นตอนที่ล็อก เพื่อให้เลื่อนหาเหมือนกันทุกจุด */
function _wfPersonOptsHtml(selectedId, placeholder){
  var list=(FU||[]).filter(function(u){return u.id!==CU.id&&u.role_code!=='ROLE-SYS'});
  var order=POSS.concat(['ROLE-SGN','ROLE-REV','ROLE-ADV','ROLE-STF','ROLE-CRT','ROLE-DEV']);
  var html='<option value="">'+esc(placeholder||'— เลือกผู้ดำเนินการ —')+'</option>';
  order.forEach(function(key){
    var members=list.filter(function(u){return (u.position_code||u.role_code)===key});
    if(!members.length) return;
    html+='<optgroup label="'+esc(PTH[key]||RTH[key]||key)+'">';
    members.forEach(function(u){
      html+='<option value="'+u.id+'"'+(u.id===selectedId?' selected':'')+'>'+esc(u.full_name)+'</option>';
    });
    html+='</optgroup>';
  });
  return html;
}

/* ปุ่มเลื่อนลำดับขั้น (ขึ้น/ลง) — ขั้นแรก (ผู้จัดทำ) ตรึงไว้บนสุดเสมอ ห้ามสลับ */
function _wfMoveBtns(i){
  if(i===0) return '';
  var canUp=i>1, canDown=i<FS.length-1;
  function b(dir,en,ic,title){
    return '<button style="width:30px;height:26px;border-radius:8px;border:1px solid #EAE4D8;background:#FFFDFA;display:flex;align-items:center;justify-content:center;color:'+(en?'#6B6157':'#DAD4CC')+';cursor:'+(en?'pointer':'default')+';flex-shrink:0" '+
      (en?'data-action="moveWf" data-id="'+i+'" data-dir="'+dir+'"':'disabled')+' title="'+title+'">'+svg(ic,12)+'</button>';
  }
  return '<div style="display:flex;flex-direction:column;gap:3px;flex-shrink:0">'+b('up',canUp,'chup','เลื่อนขึ้น')+b('down',canDown,'chdn','เลื่อนลง')+'</div>';
}
function rWfPeople(){
  if(!FS.length) return '<p style="color:#9A8F84;font-size:13px;text-align:center;padding:20px">ยังไม่มีผู้ดำเนินการ</p>';
  var out=FS.map(function(s,i){
    var u=(FU||[]).find(function(x){return x.id===s.assigned_to});
    var nm=u?esc(u.full_name):(s.step_name||'—');
    var posLabel=u&&u.position_code?(PTH[u.position_code]||u.position_code):'';
    var roleLabel=posLabel||RTH[s.role_required]||s.role_required||'—';
    var roleColor={'ROLE-SGN':'#0F8C46','ROLE-REV':'#C77A1A','ROLE-ADV':'#7C3AED','ROLE-CRT':'#2563EB','ROLE-STF':'#6B6157'}[s.role_required]||'#6B6157';
    var cardBg='#FEFCF9';
    var cardBd='#F0EBE0';
    var numBadge='<span style="width:32px;height:32px;border-radius:10px;background:#E83A00;color:#FFFCF8;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;flex-shrink:0;font-variant-numeric:tabular-nums">'+(i+1)+'</span>';
    if(s.locked){
      // ขั้นตอนบังคับตาม flow ระบบ: ชื่อขั้นฟิก ลบ/สลับลำดับไม่ได้ — เปลี่ยนตัวบุคคลได้
      // ขั้นที่ผู้ใช้กดเพิ่มเอง (s.extra เช่น อาจารย์ที่ปรึกษาท่านที่ 2) ลบได้
      var body;
      if(s.formSelf){
        body='<div style="display:flex;align-items:center;flex-wrap:wrap"><span style="font-size:13.5px;font-weight:600;color:#1A1612;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;letter-spacing:-.005em">'+nm+'</span></div>'+
          '<span style="font-size:11.5px;font-weight:500;color:'+roleColor+';margin-top:3px;display:inline-block">'+esc(s.step_name)+' (ผู้จัดทำลงนามยืนยันอีกครั้ง)</span>';
      }else{
        body='<div style="font-size:12px;font-weight:600;color:'+roleColor+';margin-bottom:5px">'+esc(s.step_name)+(s.extra?' <span style="font-weight:500;color:#9A8F84">(เพิ่มเติม)</span>':'')+'</div>'+
          '<select class="fi" style="font-size:12.5px;padding:7px 10px" onchange="_setWfAssignee('+i+',this.value)">'+_wfPersonOptsHtml(s.assigned_to||'','— เลือก'+s.step_name+' —')+'</select>'+
          (!s.assigned_to?'<div style="font-size:11px;color:#C77A1A;margin-top:4px">'+svg('warn',11)+' ยังไม่ได้เลือกผู้ลงนาม</div>':'');
      }
      // ขั้นที่ระบบเติมให้ลบได้เช่นกัน (ยกเว้นขั้นแรก = ผู้จัดทำ) — locked แปลว่า "ระบบเติมให้" ไม่ใช่ "ห้ามลบ"
      var tail=i===0?'':
        '<button style="width:32px;height:32px;border-radius:10px;border:1px solid #EAE4D8;background:#FFFDFA;display:flex;align-items:center;justify-content:center;color:#9A8F84;cursor:pointer;flex-shrink:0;transition:color .15s ease,border-color .15s ease,background-color .15s ease" onmouseover="this.style.color=\'#D04444\';this.style.borderColor=\'#F2C3C3\';this.style.background=\'#FCEAEA\'" onmouseout="this.style.color=\'#9A8F84\';this.style.borderColor=\'#EAE4D8\';this.style.background=\'#FFFDFA\'" data-action="rmWfPerson" data-id="'+i+'" title="ลบขั้นตอนนี้">'+svg('x',14)+'</button>';
      return '<div style="display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border:1px solid '+cardBd+';background:'+cardBg+';border-radius:12px;margin-bottom:8px;box-shadow:0 1px 2px rgba(26,22,18,.03)">'+
        numBadge+
        '<div style="flex:1;min-width:0">'+body+'</div>'+
        _wfMoveBtns(i)+
        tail+
      '</div>';
    }
    var actionBtn=i===0?'':
      '<button style="width:32px;height:32px;border-radius:10px;border:1px solid #EAE4D8;background:#FFFDFA;display:flex;align-items:center;justify-content:center;color:#9A8F84;cursor:pointer;flex-shrink:0;transition:color .15s ease,border-color .15s ease,background-color .15s ease" onmouseover="this.style.color=\'#D04444\';this.style.borderColor=\'#F2C3C3\';this.style.background=\'#FCEAEA\'" onmouseout="this.style.color=\'#9A8F84\';this.style.borderColor=\'#EAE4D8\';this.style.background=\'#FFFDFA\'" data-action="rmWfPerson" data-id="'+i+'" title="ลบ">'+svg('x',14)+'</button>';
    return '<div style="display:flex;align-items:center;gap:12px;padding:14px 16px;border:1px solid '+cardBd+';background:'+cardBg+';border-radius:12px;margin-bottom:8px;box-shadow:0 1px 2px rgba(26,22,18,.03)">'+
      numBadge+
      '<div style="flex:1;min-width:0">'+
        '<div style="display:flex;align-items:center;flex-wrap:wrap"><span style="font-size:13.5px;font-weight:600;color:#1A1612;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;letter-spacing:-.005em">'+nm+'</span></div>'+
        '<span style="font-size:11.5px;font-weight:500;color:'+roleColor+';margin-top:3px;display:inline-block">'+esc(roleLabel)+'</span>'+
      '</div>'+
      _wfMoveBtns(i)+
      actionBtn+
    '</div>'
  }).join('');
  // ปุ่มเพิ่มอาจารย์ที่ปรึกษาท่านที่ 2 — เฉพาะ flow ที่ล็อกซึ่งมีขั้นอาจารย์ที่ปรึกษาอยู่แล้ว
  if(FS.some(function(s){return s.locked&&s.step_name==='อาจารย์ที่ปรึกษา'&&!s.extra})){
    out+='<button class="btn btn-soft sm" style="width:100%;justify-content:center;margin-top:2px" data-action="addAdvisorStep">'+svg('plus',12)+' เพิ่มอาจารย์ที่ปรึกษา (กรณีมี 2 ท่าน)</button>';
  }
  return out
}

/* เปลี่ยนตัวบุคคลของขั้นตอนที่ล็อก (fixed flow) — เรียกจาก onchange ของ dropdown ใน rWfPeople */
function _setWfAssignee(i,uid){
  if(!FS[i]) return;
  FS[i].assigned_to=uid||null;
  var w=$e('wfwrap'); if(w) w.innerHTML=rWfPeople();
  calcDeadline()
}

/* เพิ่มขั้นอาจารย์ที่ปรึกษาอีกท่าน (ต่อท้าย flow) — flag extra ทำให้รอดจากการ rebuild เมื่อสลับประเภทหนังสือ
   ค่าเริ่มต้น: อาจารย์ (ROLE-ADV) คนแรกที่ยังไม่อยู่ในรายการ */
function addAdvisorStep(){
  var used={}; FS.forEach(function(s){if(s.assigned_to)used[s.assigned_to]=1});
  var u=(FU||[]).find(function(x){return x.role_code==='ROLE-ADV'&&x.id!==CU.id&&!used[x.id]});
  FS.push({step_name:'อาจารย์ที่ปรึกษา',role_required:'ROLE-ADV',assigned_to:u?u.id:null,deadline_days:2,locked:true,extra:true});
  var w=$e('wfwrap'); if(w) w.innerHTML=rWfPeople();
  calcDeadline()
}

function rmWfPerson(i){
  if(i===0||!FS[i]) return; // ลบได้ทุกขั้นยกเว้นขั้นแรก (ผู้จัดทำ) — รวมขั้นที่ระบบเติมให้ (locked)
  FS.splice(i,1);
  var w=$e('wfwrap'); if(w) w.innerHTML=rWfPeople();
  calcDeadline()
}

/* สลับลำดับ — ขั้นแรก (ผู้จัดทำ) ตรึงไว้บนสุดเสมอ นอกนั้นสลับได้ทั้งหมด */
function moveWfPerson(i,dir){
  var j=i+dir;
  if(i<=0||j<=0||i>=FS.length||j>=FS.length) return;
  var t=FS[i]; FS[i]=FS[j]; FS[j]=t;
  var w=$e('wfwrap'); if(w) w.innerHTML=rWfPeople();
  calcDeadline()
}

function addWfPerson(){
  var sel=$e('wfadd'); if(!sel||!sel.value) return;
  var uid=sel.value;
  var u=(FU||[]).find(function(x){return x.id===uid});
  if(!u) return;
  if(FS.some(function(s){return s.assigned_to===uid})){
    var w=$e('wfwrap');
    if(w) w.innerHTML=rWfPeople()+'<div class="al al-wa" style="margin-top:6px;font-size:12px"><span class="al-icon">'+svg('warn',13)+'</span><span>บุคคลนี้มีอยู่ในรายการแล้ว</span></div>';
    return
  }
  var role=u.role_code||'ROLE-CRT';
  var stepName=RTH[role]||u.full_name;
  FS.push({step_name:stepName,role_required:role,assigned_to:uid,deadline_days:2});
  sel.value='';
  var w=$e('wfwrap'); if(w) w.innerHTML=rWfPeople();
  calcDeadline()
}

async function doUp(files){
  var pg=$e('fprog');
  var list=Array.from(files||[]);
  var finpClr=$e('finp'); if(finpClr) finpClr.value='';
  var ALLOWED_MIME=['application/pdf','application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png','image/jpeg'];
  var MAX_SIZE=(SETT.max_file_size_mb||10)*1024*1024;
  var errs=[], valid=[];
  for(var i=0;i<list.length;i++){
    var f=list[i];
    if(f.size>MAX_SIZE) errs.push(f.name+' เกิน '+(SETT.max_file_size_mb||10)+' MB ('+fsz(f.size)+')');
    else if(ALLOWED_MIME.indexOf(f.type)===-1) errs.push(f.name+' ประเภทไฟล์ไม่รองรับ ('+(f.type||'ไม่ทราบ')+')');
    else valid.push(f);
  }
  if(errs.length){if(pg)pg.innerHTML=alrtH('er',errs.join(' · '));if(!valid.length)return}
  if(!valid.length) return;
  var existing=FDI
    ? await dg('document_files','?document_id=eq.'+safeId(FDI)+'&select=file_name')
    : PF.slice();
  if(!Array.isArray(existing)) existing=[];
  // ใช้ชื่อต้นฉบับถ้ามี helper (ตัด [ลงนาม]/[แก้ไข]) — runtime มีหลัง docDetail.js โหลดแล้ว
  if(typeof _fileBaseName==='function'){
    existing=existing.map(function(f){return {file_name:_fileBaseName(f)}});
  }
  var split=_splitDupFiles(valid, existing);
  if(!split.fresh.length){
    if(pg) pg.innerHTML=alrtH('wa','ไฟล์ที่เลือกซ้ำกับที่มีอยู่แล้วทั้งหมด — ไม่ได้อัปโหลดซ้ำ: '+split.dups.join(' · '));
    return;
  }
  function _go(){ _doUpFiles(split.fresh, split.dups); }
  if(split.dups.length){
    showConfirm(
      'พบไฟล์ชื่อซ้ำ',
      'จะข้าม '+split.dups.length+' ไฟล์ชื่อซ้ำ แล้วอัปโหลดเฉพาะ '+split.fresh.length+' ไฟล์ใหม่',
      _go,
      {confirmLabel:'อัปโหลดไฟล์ใหม่', confirmClass:'btn-primary', cancelLabel:'ยกเลิก', detail:split.dups.join(', '), icon:'warn'}
    );
  } else _go();
}

async function _doUpFiles(files, skipped){
  var pg=$e('fprog');
  var ok=0, fail=[];
  for(var j=0;j<files.length;j++){
    var fj=files[j];
    if(pg) pg.innerHTML='<div class="al al-in mt-2"><span class="sp sp-dark"></span><span> กำลังอัปโหลด '+(j+1)+'/'+files.length+': '+esc(fj.name)+'</span></div>';
    try{
      var safeName2=fj.name.replace(/[^a-zA-Z0-9._-]/g,'_');
      var path=Date.now()+'_'+j+'_'+safeName2;
      await upFile(path,fj);
      if(FDI) await dp('document_files',{document_id:FDI,file_name:fj.name,file_path:path,file_size:fj.size,file_type:fj.type,uploaded_by:CU.id,version:1});
      else PF.push({file_name:fj.name,file_path:path,file_size:fj.size,file_type:fj.type,uploaded_by:CU.id,version:1});
      ok++;
    }catch(e){
      fail.push(fj.name+(e&&e.message?(' ('+e.message+')'):''));
    }
  }
  var total=FDI
    ? (await dg('document_files','?document_id=eq.'+safeId(FDI)+'&order=uploaded_at'))
    : PF;
  if(!Array.isArray(total)) total=FDI?[]:PF;
  _setFormFileUi(total, FDI||'');
  var msg='แนบครบแล้ว '+total.length+' ไฟล์';
  if(ok) msg='อัปโหลดสำเร็จ '+ok+' ไฟล์ · '+msg;
  if(skipped&&skipped.length) msg+=' · ข้ามชื่อซ้ำ '+skipped.length+' ไฟล์';
  if(fail.length) msg+=' · ล้มเหลว: '+fail.join(' · ');
  if(pg) pg.innerHTML=alrtH(fail.length?'wa':'ok', msg);
}

async function delFF(fid,idx){
  var pg=$e('fprog');
  // ไฟล์ของเอกสารใหม่ (ยังไม่บันทึก) ไม่มีแถวใน DB — ลบออกจาก PF + Storage
  if(!fid){
    var gone=PF[idx];
    if(gone&&gone.file_path) await deleteStorage(gone.file_path);
    PF.splice(idx,1);
    _setFormFileUi(PF,'');
    if(pg) pg.innerHTML=alrtH('ok','ลบไฟล์แล้ว · เหลือ '+PF.length+' ไฟล์');
    return;
  }
  var fl=$e('fflist');
  var btn=fl&&fl.querySelector('[data-action="delFF"][data-id="'+fid+'"]');
  var path=btn&&btn.dataset.path;
  await dd('document_files',fid);
  if(path) await deleteStorage(path);
  if(FDI){
    var df=await dg('document_files','?document_id=eq.'+safeId(FDI)+'&order=uploaded_at');
    _setFormFileUi(Array.isArray(df)?df:[], FDI);
    if(pg) pg.innerHTML=alrtH('ok','ลบไฟล์แล้ว · เหลือ '+(Array.isArray(df)?df.length:0)+' ไฟล์');
  } else if(btn){
    var item=btn.closest('.file-item');
    if(item) item.remove();
  }
}


