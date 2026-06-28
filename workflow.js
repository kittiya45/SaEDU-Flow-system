/* ─── WORKFLOW PEOPLE PICKER ───
   การ์ดยกลอย (border + shadow เบา ๆ) ให้เข้ากับสไตล์ปุ่ม/อินพุตที่โค้งมนนิ่ม ๆ ของฟอร์มนี้
   ปุ่มลบอยู่ในกรอบการ์ดเดียวกับเนื้อหาเสมอ ไม่ลอยแยกออกไปนอกแถว */
function rWfPeople(){
  if(!FS.length) return '<p style="color:#9A8F84;font-size:13px;text-align:center;padding:20px">ยังไม่มีผู้ดำเนินการ</p>';
  return FS.map(function(s,i){
    var u=(FU||[]).find(function(x){return x.id===s.assigned_to});
    var nm=u?esc(u.full_name):(s.step_name||'—');
    var posLabel=u&&u.position_code?(PTH[u.position_code]||u.position_code):'';
    var roleLabel=posLabel||RTH[s.role_required]||s.role_required||'—';
    var roleColor={'ROLE-SGN':'#0F8C46','ROLE-REV':'#C77A1A','ROLE-ADV':'#7C3AED','ROLE-CRT':'#2563EB','ROLE-STF':'#6B6157'}[s.role_required]||'#6B6157';
    var cardBg=s.locked?'#FFF8F2':'#FEFCF9';
    var cardBd=s.locked?'#FFE3CF':'#F0EBE0';
    var lockBadge=s.locked?'<span style="font-size:10.5px;font-weight:600;color:#8C2400;background:#FFF1E8;border:1px solid #FFE3CF;padding:2px 8px;border-radius:999px;margin-left:8px;letter-spacing:-.005em">บังคับ</span>':'';
    var actionBtn=i===0?'':
      s.locked?'<span style="width:32px;height:32px;border-radius:10px;background:#FFF1E8;display:flex;align-items:center;justify-content:center;color:#E83A00;flex-shrink:0" title="ขั้นตอนบังคับ">'+svg('lock',14)+'</span>':
      '<button style="width:32px;height:32px;border-radius:10px;border:1px solid #EAE4D8;background:#FFFDFA;display:flex;align-items:center;justify-content:center;color:#9A8F84;cursor:pointer;flex-shrink:0;transition:color .15s ease,border-color .15s ease,background-color .15s ease" onmouseover="this.style.color=\'#D04444\';this.style.borderColor=\'#F2C3C3\';this.style.background=\'#FCEAEA\'" onmouseout="this.style.color=\'#9A8F84\';this.style.borderColor=\'#EAE4D8\';this.style.background=\'#FFFDFA\'" data-action="rmWfPerson" data-id="'+i+'" title="ลบ">'+svg('x',14)+'</button>';
    return '<div style="display:flex;align-items:center;gap:12px;padding:14px 16px;border:1px solid '+cardBd+';background:'+cardBg+';border-radius:12px;margin-bottom:8px;box-shadow:0 1px 2px rgba(26,22,18,.03)">'+
      '<span style="width:32px;height:32px;border-radius:10px;background:#E83A00;color:#FFFCF8;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;flex-shrink:0;font-variant-numeric:tabular-nums">'+(i+1)+'</span>'+
      '<div style="flex:1;min-width:0">'+
        '<div style="display:flex;align-items:center;flex-wrap:wrap"><span style="font-size:13.5px;font-weight:600;color:#1A1612;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;letter-spacing:-.005em">'+nm+'</span>'+lockBadge+'</div>'+
        '<span style="font-size:11.5px;font-weight:500;color:'+roleColor+';margin-top:3px;display:inline-block">'+esc(roleLabel)+'</span>'+
      '</div>'+
      actionBtn+
    '</div>'
  }).join('')
}

function rmWfPerson(i){
  if(i===0||(FS[i]&&FS[i].locked)) return;
  FS.splice(i,1);
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
  var _lockIdx=-1;
  for(var _k=0;_k<FS.length;_k++){if(FS[_k].locked){_lockIdx=_k;break;}}
  if(_lockIdx>=0) FS.splice(_lockIdx,0,{step_name:stepName,role_required:role,assigned_to:uid,deadline_days:2});
  else FS.push({step_name:stepName,role_required:role,assigned_to:uid,deadline_days:2});
  sel.value='';
  var w=$e('wfwrap'); if(w) w.innerHTML=rWfPeople();
  calcDeadline()
}

async function doUp(files){
  var pg=$e('fprog');
  var ALLOWED_MIME=['application/pdf','application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png','image/jpeg'];
  var MAX_SIZE=10*1024*1024; // 10 MB
  var errs=[];
  for(var i=0;i<files.length;i++){
    var f=files[i];
    if(f.size>MAX_SIZE) errs.push(f.name+' เกิน 10 MB ('+fsz(f.size)+')');
    else if(ALLOWED_MIME.indexOf(f.type)===-1) errs.push(f.name+' ประเภทไฟล์ไม่รองรับ ('+f.type+')');
  }
  if(errs.length){if(pg)pg.innerHTML=alrtH('er',errs.join(' · '));return}
  if(pg) pg.innerHTML='<div class="al al-in mt-2"><span class="sp sp-dark"></span><span> กำลังอัปโหลด '+files.length+' ไฟล์...</span></div>';
  for(var j=0;j<files.length;j++){
    var fj=files[j];var safeName2=fj.name.replace(/[^a-zA-Z0-9._-]/g,'_');var path=Date.now()+'_'+safeName2;
    await upFile(path,fj);
    if(FDI) await dp('document_files',{document_id:FDI,file_name:fj.name,file_path:path,file_size:fj.size,file_type:fj.type,uploaded_by:CU.id,version:1});
    else PF.push({file_name:fj.name,file_path:path,file_size:fj.size,file_type:fj.type,uploaded_by:CU.id,version:1})
  }
  if(pg) pg.innerHTML=alrtH('ok','อัปโหลด '+files.length+' ไฟล์เรียบร้อยแล้ว');
  if(FDI){var df=await dg('document_files','?document_id=eq.'+FDI+'&order=uploaded_at');var fl=$e('fflist');if(fl)fl.innerHTML=buildFileList(df,FDI)}
}

async function delFF(fid,idx){
  await dd('document_files',fid);
  var fl=$e('fflist');
  if(fl){
    // ใช้ fid ค้นหาแทน index — ป้องกัน NodeList shift เมื่อลบหลายรายการ
    var btn=fl.querySelector('[data-action="delFF"][data-id="'+fid+'"]');
    var item=btn&&btn.closest('.file-item');
    if(item) item.remove();
  }
}


