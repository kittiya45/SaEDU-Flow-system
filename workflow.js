/* ─── WORKFLOW PEOPLE PICKER ─── */
function rWfPeople(){
  if(!FS.length) return '<p class="text-[#a89e99] text-[13px] text-center py-4">ยังไม่มีผู้ดำเนินการ — เลือกจาก Dropdown ด้านบน</p>';
  return FS.map(function(s,i){
    var u=(FU||[]).find(function(x){return x.id===s.assigned_to});
    var nm=u?esc(u.full_name):(s.step_name||'—');
    var roleLabel=RTH[s.role_required]||s.role_required||'—';
    var roleColorCls={'ROLE-SGN':'text-[#16A34A]','ROLE-REV':'text-[#D97706]','ROLE-ADV':'text-[#6A1B9A]','ROLE-CRT':'text-[#2563EB]','ROLE-STF':'text-[#a89e99]'}[s.role_required]||'text-[#a89e99]';
    var rowBg=s.locked?'border-[#FFD9CC] bg-[#FFFBF9]':'border-[#EBEBEB] bg-white';
    var lockBadge=s.locked?'<span class="text-[10px] font-semibold text-[#E83A00] ml-1 border border-[#FFD9CC] rounded px-1 py-px">บังคับ</span>':'';
    var actionBtn=i===0?'<span class="w-7"></span>':
      s.locked?'<span class="w-7 h-6 flex items-center justify-center text-[#a89e99]" title="ขั้นตอนบังคับ — ลบไม่ได้">'+svg('lock',12)+'</span>':
      '<button class="btn btn-danger xs btn-icon" data-action="rmWfPerson" data-id="'+i+'" title="ลบ">'+svg('x',12)+'</button>';
    return '<div class="flex items-center gap-2.5 px-3 py-2.5 border rounded-[10px] mb-2 '+rowBg+'">'+
      '<span class="min-w-[24px] h-6 rounded-full bg-[#E83A00] text-white flex items-center justify-center text-[11px] font-bold shrink-0">'+(i+1)+'</span>'+
      '<div class="flex-1 min-w-0">'+
        '<div class="text-[13px] font-semibold overflow-hidden text-ellipsis whitespace-nowrap">'+nm+lockBadge+'</div>'+
        '<span class="text-[11px] font-semibold '+roleColorCls+'">'+esc(roleLabel)+'</span>'+
      '</div>'+
      '<div class="flex items-center gap-[5px] shrink-0">'+actionBtn+'</div>'+
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


