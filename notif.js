/* ─── NOTIF — อีเมลแจ้งเตือนและตรวจเอกสารเลยกำหนด ─── */
/* ── EMAIL NOTIFICATION (ส่งจริงผ่าน Supabase Edge Function + Resend) ── */
async function sendNotifEmail(docId, action, newStatus, note){
  var doc=(await dg('documents','?id=eq.'+docId))[0]; if(!doc)return;
  if(action==='overdue'&&doc.notify_overdue===false) return;
  if(action!=='overdue'&&doc.notify_step===false) return;
  var wfSteps=await dg('workflow_steps','?document_id=eq.'+docId+'&order=step_number');
  var nextStep=wfSteps.filter(function(s){return s.status==='active'})[0];
  var subj=(doc.subject_line&&doc.subject_line.length<3&&/^[1-9]$/.test(doc.subject_line.trim()))?doc.title:(doc.subject_line||doc.title);
  var addrTo=doc.addressed_to||'';
  var fromDept=doc.from_department||'กนค.';
  var deadlineStr=doc.due_date?new Date(doc.due_date).toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'2-digit'}):'';

  // ── สร้าง recipient list ──
  var recipients=[];
  function _okEmail(em){return em&&em.includes('@')&&!em.includes('@gnk.student')}
  if(newStatus==='completed'){
    // แจ้งเตือนเฉพาะผู้จัดทำเมื่อเอกสารเสร็จสิ้น
    if(doc.created_by){
      var creatorUser=await dg('users','?id=eq.'+safeId(doc.created_by));
      if(creatorUser[0]){
        var em=creatorUser[0].contact_email||creatorUser[0].email;
        if(_okEmail(em)) recipients.push({user:creatorUser[0],email:em});
      }
    }
  } else if(action==='approve'&&nextStep&&nextStep.assigned_to){
    var ru=await dg('users','?id=eq.'+nextStep.assigned_to);
    if(ru[0]){var em=ru[0].contact_email||ru[0].email;if(_okEmail(em))recipients.push({user:ru[0],email:em})}
  } else if(action==='reject'&&doc.created_by){
    var cu2=await dg('users','?id=eq.'+doc.created_by);
    if(cu2[0]){var em2=cu2[0].contact_email||cu2[0].email;if(_okEmail(em2))recipients.push({user:cu2[0],email:em2})}
  } else if((action==='create'||action==='resubmit')&&nextStep&&nextStep.assigned_to){
    var ru3=await dg('users','?id=eq.'+nextStep.assigned_to);
    if(ru3[0]){var em3=ru3[0].contact_email||ru3[0].email;if(_okEmail(em3))recipients.push({user:ru3[0],email:em3})}
  } else if(action==='overdue'){
    var overdueIds=[];
    if(nextStep&&nextStep.assigned_to) overdueIds.push(nextStep.assigned_to);
    if(doc.created_by) overdueIds.push(doc.created_by);
    var uniqueOIds=[...new Set(overdueIds)];
    if(uniqueOIds.length){
      var overdueUsers=await dg('users','?id=in.('+uniqueOIds.join(',')+')'+'&select=id,full_name,email,contact_email');
      overdueUsers.forEach(function(u){
        var em=u.contact_email||u.email;
        if(_okEmail(em)) recipients.push({user:u,email:em})
      })
    }
  }

  if(!recipients.length) return;

  // ── ดึงไฟล์ลงนามล่าสุด (กรณี completed) ──
  var signedFileUrl='';
  if(newStatus==='completed'){
    var _sFiles=await dg('document_files','?document_id=eq.'+docId+'&order=version.desc&limit=5');
    var _sFile=_sFiles.find(function(f){return f.file_name.indexOf('[ลงนาม]')>=0||f.file_name.indexOf('signed_')>=0})||_sFiles[0];
    if(_sFile) signedFileUrl=furl(_sFile.file_path);
  }

  var emailSubj='[กนค.] '+(newStatus==='completed'?'เสร็จสิ้น: ':action==='reject'?'↩ ส่งคืนแก้ไข: ':action==='create'?'📋 เอกสารใหม่รอดำเนินการ: ':action==='overdue'?'⚠️ เลยกำหนด: ':'')+subj;
  var sentEmails=[];

  for(var ri=0;ri<recipients.length;ri++){
    var recip=recipients[ri];
    var html=buildEmailHtml({
      recipName: recip.user.full_name,
      action: action,
      newStatus: newStatus,
      subj: subj,
      addrTo: addrTo,
      fromDept: fromDept,
      deadlineStr: deadlineStr,
      note: note,
      nextStep: nextStep,
      urgency: doc.urgency,
      signedFileUrl: signedFileUrl
    });

    // ── ส่งอีเมลจริงผ่าน Edge Function ──
    try{
      var resp=await fetch(SU+'/functions/v1/send-email',{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+SK,'apikey':SK},
        body:JSON.stringify({to:recip.email,subject:emailSubj,html:html})
      });
      var result=await resp.json();
      var status=resp.ok?'sent':'failed';
      if(!resp.ok) console.warn('Email send failed for '+recip.email+':',result);
      else sentEmails.push(recip.email);
    }catch(e){
      console.warn('Email fetch error:',e);
      var status='failed';
    }

    // ── บันทึก audit log ──
    try{
      await dp('notifications',{
        document_id:docId,
        recipient_id:recip.user.id,
        recipient_email:recip.email,
        subject:emailSubj,
        body:html,
        notification_type:action||'email',
        status:status,
        sent_at:new Date().toISOString()
      });
    }catch(e){}
  }

  if(sentEmails.length) showEmailToast(sentEmails,emailSubj);
}

/* ── สร้าง HTML Template สำหรับอีเมล ── */
function buildEmailHtml(o){
  var urgColor={normal:'#4CAF50',urgent:'#FF9800',very_urgent:'#F44336'};
  var urgLabel={normal:'ปกติ',urgent:'เร่งด่วน',very_urgent:'ด่วนมาก'};
  var urgClr=urgColor[o.urgency]||'#888';

  var bannerBg,bannerIcon,actionLabel;
  if(o.newStatus==='completed'){
    bannerBg='#E8F5E9'; bannerIcon='✅'; actionLabel='<span style="color:#2E7D32;font-weight:700">เอกสารผ่านทุกขั้นตอนเรียบร้อยแล้ว</span>';
  } else if(o.action==='reject'){
    bannerBg='#FFF3E0'; bannerIcon='↩'; actionLabel='<span style="color:#E65100;font-weight:700">เอกสารถูกส่งคืนเพื่อแก้ไข</span>';
  } else if(o.action==='overdue'){
    bannerBg='#FFEBEE'; bannerIcon='⚠️'; actionLabel='<span style="color:#C62828;font-weight:700">เอกสารเลยกำหนดส่งแล้ว กรุณาดำเนินการโดยด่วน</span>';
  } else {
    bannerBg='#E3F2FD'; bannerIcon='📋'; actionLabel='<span style="color:#1565C0;font-weight:700">มีเอกสารรอการดำเนินการของคุณ</span>';
  }

  var rows='';
  if(o.addrTo) rows+='<tr><td style="color:#888;padding:5px 0;width:110px;font-size:13px">เรียน</td><td style="font-weight:600;font-size:13px">'+esc(o.addrTo)+'</td></tr>';
  if(o.fromDept) rows+='<tr><td style="color:#888;padding:5px 0;font-size:13px">จากฝ่าย</td><td style="font-size:13px">'+esc(o.fromDept)+'</td></tr>';
  if(o.urgency) rows+='<tr><td style="color:#888;padding:5px 0;font-size:13px">ความเร่งด่วน</td><td><span style="color:'+urgClr+';font-weight:600;font-size:13px">'+esc(urgLabel[o.urgency]||o.urgency)+'</span></td></tr>';
  if(o.deadlineStr) rows+='<tr><td style="color:#888;padding:5px 0;font-size:13px">วันกำหนดส่ง</td><td style="font-weight:700;color:#E84300;font-size:13px">'+esc(o.deadlineStr)+'</td></tr>';
  if(o.nextStep&&o.action!=='reject'&&o.newStatus!=='completed') rows+='<tr><td style="color:#888;padding:5px 0;font-size:13px">ขั้นตอนที่รอ</td><td style="font-size:13px">'+esc(o.nextStep.step_name||'')+'</td></tr>';
  if(o.action==='reject'&&o.note) rows+='<tr><td style="color:#888;padding:5px 0;vertical-align:top;font-size:13px">ส่วนที่ต้องแก้ไข</td><td style="color:#E65100;font-size:13px">'+esc(o.note)+'</td></tr>';

  var footerMsg='';
  if(o.newStatus==='completed'){
    footerMsg='<p style="font-size:13px;color:#2E7D32;margin:16px 0 8px">กรุณาเข้าระบบเพื่อดาวน์โหลดเอกสารฉบับลงนาม</p>';
    if(o.signedFileUrl) footerMsg+='<a href="'+o.signedFileUrl+'" style="display:inline-block;background:#E84300;color:#fff;text-decoration:none;padding:10px 22px;border-radius:8px;font-weight:600;font-size:13px;margin-top:4px">ดูเอกสารลงนาม</a>';
  } else if(o.action==='reject'){
    footerMsg='<p style="font-size:13px;color:#E65100;margin:16px 0 0">กรุณาแก้ไขเอกสารและส่งกลับผ่านระบบ</p>';
  } else if(o.action==='overdue'){
    footerMsg='<p style="font-size:13px;color:#C62828;margin:16px 0 0;font-weight:700">⚠️ กรุณาเข้าสู่ระบบเพื่อดำเนินการโดยด่วน</p>';
  } else {
    footerMsg='<p style="font-size:13px;color:#1565C0;margin:16px 0 0">กรุณาเข้าสู่ระบบเพื่อดำเนินการในขั้นตอนที่ได้รับมอบหมาย</p>';
  }

  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'+
    '<body style="margin:0;padding:0;background:#F5F5F5;font-family:\'Sarabun\',\'Helvetica Neue\',Arial,sans-serif">'+
    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F5;padding:32px 16px">'+
    '<tr><td align="center">'+
    '<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08)">'+
    // Header
    '<tr><td style="background:#E84300;padding:22px 28px">'+
      '<table cellpadding="0" cellspacing="0"><tr>'+
        '<td style="width:44px;height:44px;background:rgba(255,255,255,.2);border-radius:50%;text-align:center;vertical-align:middle;font-size:20px;padding:0 12px">📄</td>'+
        '<td style="padding-left:14px"><div style="color:#fff;font-size:18px;font-weight:700">SAEDU Flow</div>'+
        '<div style="color:rgba(255,255,255,.8);font-size:12px;margin-top:2px">ระบบเสนอเอกสาร คณะกรรมการนิสิต</div></td>'+
      '</tr></table>'+
    '</td></tr>'+
    // Body
    '<tr><td style="padding:26px 28px">'+
      '<p style="margin:0 0 16px;font-size:14px;color:#555">เรียน <strong style="color:#222">'+esc(o.recipName)+'</strong></p>'+
      '<div style="background:'+bannerBg+';border-radius:8px;padding:13px 16px;margin-bottom:20px;font-size:14px">'+
        '<span style="margin-right:8px">'+bannerIcon+'</span>'+actionLabel+
      '</div>'+
      '<div style="background:#FAFAFA;border-radius:8px;padding:16px 18px;margin-bottom:4px">'+
        '<div style="font-size:11px;color:#aaa;font-weight:700;letter-spacing:.6px;margin-bottom:8px;text-transform:uppercase">เรื่อง</div>'+
        '<div style="font-size:15px;font-weight:700;color:#222;margin-bottom:14px;line-height:1.5">'+esc(o.subj)+'</div>'+
        (rows?'<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">'+rows+'</table>':'')+
      '</div>'+
      footerMsg+
    '</td></tr>'+
    // Footer
    '<tr><td style="padding:14px 28px;background:#F9F9F9;border-top:1px solid #EEE;text-align:center;font-size:11px;color:#BBB">'+
      'ระบบเสนอเอกสาร กนค. © 2568 &nbsp;·&nbsp; อีเมลนี้ส่งโดยอัตโนมัติ ไม่ต้องตอบกลับ'+
    '</td></tr>'+
    '</table></td></tr></table>'+
    '</body></html>'
}

/* ── ตรวจและส่ง Overdue notification (เรียก 1 ครั้งต่อวัน) ── */
async function sendOverdueNotifs(){
  var today=new Date().toISOString().substring(0,10);
  if(localStorage.getItem('_overdueCk')===today) return;
  localStorage.setItem('_overdueCk',today);
  var overdueDocs=await dg('documents','?status=eq.pending&due_date=lt.'+today+'&notify_overdue=eq.true&select=id');
  if(!overdueDocs.length) return;
  var since=new Date(Date.now()-24*60*60*1000).toISOString();
  for(var i=0;i<overdueDocs.length;i++){
    var did=overdueDocs[i].id;
    var recent=await dg('notifications','?document_id=eq.'+did+'&notification_type=eq.overdue&created_at=gt.'+encodeURIComponent(since)+'&limit=1');
    if(recent.length) continue;
    try{await sendNotifEmail(did,'overdue','overdue','')}catch(e){console.warn('Overdue notif failed:',e)}
  }
}

function showEmailToast(emails, subj){
  var list=Array.isArray(emails)?emails:[emails];
  var t=document.createElement('div');
  t.className='fixed bottom-5 right-5 bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7] rounded-[14px] px-[18px] py-3.5 shadow-[0_8px_24px_rgba(0,0,0,.15)] z-[9999] flex items-start gap-2.5 text-[13px] max-w-[340px] [animation:slideUp_.2s]';
  t.innerHTML=svg('bell',16)+'<div><strong>ส่งอีเมลแจ้งเตือนแล้ว</strong><div class="text-[11px] text-[#388E3C] mt-[3px]">'+list.map(function(e){return '• '+e}).join('<br>')+'</div></div>';
  document.body.appendChild(t);
  setTimeout(function(){t.remove()},5000)
}
