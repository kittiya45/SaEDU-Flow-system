/* ─── NOTIF — อีเมลแจ้งเตือนและตรวจเอกสารเลยกำหนด ─── */

/* LINE: แจ้งเฉพาะเมื่อถึงคิวขั้นตอนของเจ้าหน้าที่ (ROLE-STF) ให้เซ็น/อนุมัติ
   อีเมลยังส่งตามปกติทุกกรณี — จำกัดเฉพาะช่องทาง LINE */
function _shouldSendLineForStaffSign(recipUser, nextStep, action){
  // แจ้ง LINE เฉพาะตอนที่เอกสารเพิ่งถึงคิวเซ็นของเจ้าหน้าที่ (ไม่รวม overdue/reject/forward/ฯลฯ)
  if(!action||['create','resubmit','approve'].indexOf(action)<0) return false;
  if(!recipUser||!nextStep||!nextStep.assigned_to) return false;
  if(recipUser.id!==nextStep.assigned_to) return false;
  return recipUser.role_code==='ROLE-STF';
}

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
  // ผู้รับเข้า list เสมอแม้ไม่มีอีเมลจริง (@gnk.student) — เผื่อผูก LINE ไว้:
  // อีเมลส่งเฉพาะคน emailOk, LINE ลองส่งทุกคน (send-line ข้ามเงียบ ๆ ถ้าไม่ได้ผูก)
  var recipients=[];
  function _okEmail(em){return em&&em.includes('@')&&!em.includes('@gnk.student')}
  function _push(u){if(!u)return;if(recipients.some(function(r){return r.user.id===u.id}))return;var em=u.contact_email||u.email||'';recipients.push({user:u,email:em,emailOk:!!_okEmail(em)})}
  if(newStatus==='completed'||newStatus==='numbering'){
    // แจ้งผู้จัดทำ + ผู้รับผิดชอบทุกขั้นตอน — ให้การ์ด LINE อัปเดตเป็นครบทุกขั้น (ไม่ค้างข้อความเก่า)
    if(doc.created_by){
      var creatorUser=await dg('user_directory','?id=eq.'+safeId(doc.created_by));
      _push(creatorUser[0]);
    }
    var _partIds=[];
    (Array.isArray(wfSteps)?wfSteps:[]).forEach(function(s){
      if(s.assigned_to&&s.step_number>1&&_partIds.indexOf(s.assigned_to)<0) _partIds.push(s.assigned_to);
    });
    if(_partIds.length){
      var _parts=await dg('user_directory','?id=in.('+_partIds.map(safeId).join(',')+')&select=id,full_name,email,contact_email');
      (Array.isArray(_parts)?_parts:[]).forEach(function(u){_push(u)});
    }
  } else if(action==='approve'&&nextStep&&nextStep.assigned_to){
    var ru=await dg('user_directory','?id=eq.'+nextStep.assigned_to);
    _push(ru[0]);
  } else if(action==='reject'){
    // cascade: nextStep คือ step ก่อนหน้าที่ถูก re-activate → แจ้งเขา
    // final reject: ไม่มี active step → แจ้งผู้จัดทำ
    if(nextStep&&nextStep.assigned_to){
      var _ruc=await dg('user_directory','?id=eq.'+nextStep.assigned_to);
      _push(_ruc[0]);
    } else if(doc.created_by){
      var cu2=await dg('user_directory','?id=eq.'+doc.created_by);
      _push(cu2[0]);
    }
  } else if((action==='create'||action==='resubmit')&&nextStep&&nextStep.assigned_to){
    var ru3=await dg('user_directory','?id=eq.'+nextStep.assigned_to);
    _push(ru3[0]);
  } else if(action==='overdue'){
    var overdueIds=[];
    if(nextStep&&nextStep.assigned_to) overdueIds.push(nextStep.assigned_to);
    // เอกสาร completed ที่รอผู้รับปลายทางกดรับ — เตือนผู้รับปลายทางด้วย
    if(doc.status==='completed'&&doc.forwarded_to_id) overdueIds.push(doc.forwarded_to_id);
    if(doc.created_by) overdueIds.push(doc.created_by);
    var uniqueOIds=[...new Set(overdueIds)];
    if(uniqueOIds.length){
      var overdueUsers=await dg('user_directory','?id=in.('+uniqueOIds.join(',')+')'+'&select=id,full_name,email,contact_email');
      overdueUsers.forEach(function(u){_push(u)})
    }
  }

  if(!recipients.length) return;

  // ── สรุปขั้นตอน + ชื่อผู้รับผิดชอบ สำหรับแถบความคืบหน้าบนการ์ด LINE ──
  var lineSteps=await _lineStepsInfo(Array.isArray(wfSteps)?wfSteps:[]);

  // ── ดึงไฟล์ลงนามล่าสุด (กรณี completed) ──
  var signedFileUrl='';
  if(newStatus==='completed'){
    var _sFiles=await dg('document_files','?document_id=eq.'+docId+'&order=version.desc&limit=5');
    var _sFile=_sFiles.find(function(f){return f.file_name.indexOf('[ลงนาม]')>=0||f.file_name.indexOf('signed_')>=0})||_sFiles[0];
    if(_sFile) signedFileUrl=await resolveFilePath(_sFile.file_path,86400)||'';
  }

  // ── ดึง email template (subject_suffix + extra_note) ──
  var _etmpl={};
  try{
    var _etKey=newStatus==='completed'?'completed':newStatus==='numbering'?'numbering':action;
    var _etRows=await dg('email_templates','?key=eq.'+encodeURIComponent(_etKey)+'&limit=1');
    if(_etRows&&_etRows[0]) _etmpl=_etRows[0];
  }catch(e){}

  var _baseSubj=(SETT.email_prefix||'[กนค.]')+' '+(newStatus==='completed'?'เสร็จสิ้น: ':newStatus==='numbering'?'🔢 รอออกเลขหนังสือ: ':action==='reject'?'↩ ส่งคืนแก้ไข: ':action==='create'?'📋 เอกสารใหม่รอดำเนินการ: ':action==='overdue'?'⚠️ เลยกำหนด: ':'')+subj;
  var emailSubj=_baseSubj+(_etmpl.subject_suffix?' '+_etmpl.subject_suffix:'');
  var sentEmails=[];

  // เอกสารนี้เข้าเกณฑ์ "ระบบจัดการอัตโนมัติเมื่อเลยกำหนด" ไหม — เพื่อบอกในอีเมลเตือน
  // (ค้างขั้นตอนสุดท้ายของ workflow หรือรอผู้รับปลายทางกดรับ — ตรงกับเงื่อนไขใน auto_approve_overdue RPC)
  var _autoQ=false;
  if(action==='overdue'){
    if(doc.status==='pending'&&nextStep&&!wfSteps.some(function(s){return s.step_number>nextStep.step_number&&s.status!=='done'})) _autoQ=true;
    else if(doc.status==='completed'&&doc.forwarded_to_id) _autoQ=true;
  }

  var sentAt=new Date().toLocaleString('th-TH',{day:'numeric',month:'short',year:'2-digit',hour:'2-digit',minute:'2-digit'});

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
      signedFileUrl: signedFileUrl,
      extraNote: _etmpl.extra_note||'',
      autoApprove: _autoQ,
      slaDays: SETT.sla_cascade_days||3
    });

    // ── ส่งอีเมลจริงผ่าน Edge Function (เฉพาะผู้รับที่มีอีเมลจริง) ──
    if(recip.emailOk){
      var status='failed';
      try{
        var resp=await sendEmailEdge({to:recip.email,subject:emailSubj,html:html,documentId:docId,recipientUserId:recip.user.id});
        var result=await resp.json();
        status=resp.ok?'sent':'failed';
        if(!resp.ok) console.warn('Email send failed for '+recip.email+':',result);
        else sentEmails.push(recip.email);
      }catch(e){
        console.warn('Email fetch error:',e);
      }

      // ── บันทึก audit log ──
      try{
        await logNotifRow({
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

    // ── LINE: เฉพาะเมื่อผู้รับคือ จนท. และถึงคิวขั้นตอนของเขา ──
    if(_shouldSendLineForStaffSign(recip.user, nextStep, action)){
      try{
        var _lineO={
          recipName:recip.user.full_name, action:action, newStatus:newStatus,
          subj:subj, deadlineStr:deadlineStr, nextStep:nextStep, urgency:doc.urgency,
          note:note, autoApprove:_autoQ, slaDays:SETT.sla_cascade_days||3, sentAt:sentAt
        };
        var lineText=buildLineText(_lineO);
        var lineFlex=null;
        try{lineFlex=buildLineFlex(Object.assign({steps:lineSteps},_lineO))}catch(fe){console.warn('LINE flex build failed:',fe)}
        await sendLineWithLog(docId,recip.user.id,recip.email,emailSubj,lineText,action||'email',lineFlex);
      }catch(e){console.warn('LINE notify error:',e)}
    }
  }

  // ── กลุ่ม LINE: แจ้งเฉพาะเมื่อถึงคิวขั้นตอนของเจ้าหน้าที่ ──
  try{
    var _staffActive=false;
    if(nextStep&&nextStep.assigned_to){
      var _na=recipients.find(function(r){return r.user&&r.user.id===nextStep.assigned_to});
      if(_na&&_na.user.role_code==='ROLE-STF') _staffActive=true;
      else if(!_na){
        var _nu=await dg('user_directory','?id=eq.'+safeId(nextStep.assigned_to)+'&select=id,role_code');
        _staffActive=!!(_nu&&_nu[0]&&_nu[0].role_code==='ROLE-STF');
      }
    }
    if(SETT.line_group_id&&_staffActive&&['create','resubmit','approve'].indexOf(action)>=0){
      var _gO={
        action:action, newStatus:newStatus, subj:subj, deadlineStr:deadlineStr,
        nextStep:nextStep, urgency:doc.urgency, note:note,
        autoApprove:_autoQ, slaDays:SETT.sla_cascade_days||3, sentAt:sentAt
      };
      var _gFlex=null;
      try{_gFlex=buildLineFlex(Object.assign({steps:lineSteps},_gO))}catch(fe){}
      await sendLineGroupPush(buildLineText(_gO),_gFlex);
    }
  }catch(e){console.warn('LINE group notify error:',e)}

  if(sentEmails.length) showEmailToast(sentEmails,emailSubj);
}

/* ── อีเมลแจ้งเพื่อทราบ (ไม่ต้อง action) ไปยังผู้ที่อนุมัติ/ลงนามไปแล้วก่อนหน้า step ที่ตีกลับ ── */
async function sendRejectFyiEmail(docId, recipientUser, rejectedStepName, note){
  var em=recipientUser.contact_email||recipientUser.email||'';
  var emOk=!!(em&&em.includes('@')&&!em.includes('@gnk.student'));
  var doc=(await dg('documents','?id=eq.'+docId))[0]; if(!doc) return;
  var subj=(doc.subject_line&&doc.subject_line.length<3&&/^[1-9]$/.test(doc.subject_line.trim()))?doc.title:(doc.subject_line||doc.title);
  var emailSubj=(SETT.email_prefix||'[กนค.]')+' ℹ️ แจ้งเพื่อทราบ: '+subj;

  // LINE: ไม่แจ้ง reject_fyi — แจ้งเฉพาะเมื่อถึงคิวเซ็นของเจ้าหน้าที่
  if(!emOk) return;
  var html=buildEmailHtml({
    recipName: recipientUser.full_name,
    action: 'reject_fyi',
    newStatus: 'rejected',
    subj: subj,
    addrTo: doc.addressed_to||'',
    fromDept: doc.from_department||'กนค.',
    note: note,
    rejectedStepName: rejectedStepName,
    urgency: doc.urgency
  });
  var status='failed';
  try{
    var resp=await sendEmailEdge({to:em,subject:emailSubj,html:html,documentId:docId,recipientUserId:recipientUser.id});
    status=resp.ok?'sent':'failed';
    if(!resp.ok) console.warn('FYI email send failed for '+em+':',await resp.json());
  }catch(e){console.warn('FYI email fetch error:',e)}
  try{
    await logNotifRow({
      document_id:docId,
      recipient_id:recipientUser.id,
      recipient_email:em,
      subject:emailSubj,
      body:html,
      notification_type:'reject_fyi',
      status:status,
      sent_at:new Date().toISOString()
    });
  }catch(e){}
}

/* ── สร้าง HTML Template สำหรับอีเมล ── */
function buildEmailHtml(o){
  var _urgClr={normal:'#4CAF50',urgent:'#FF9800'};
  var _u=urgNorm(o.urgency);
  var urgClr=_urgClr[_u]||'#888';

  var bannerBg,bannerIcon,actionLabel;
  if(o.newStatus==='completed'){
    bannerBg='#E8F5E9'; bannerIcon='✅'; actionLabel='<span style="color:#2E7D32;font-weight:700">เอกสารผ่านทุกขั้นตอนเรียบร้อยแล้ว</span>';
  } else if(o.newStatus==='numbering'){
    bannerBg='#FFF8E1'; bannerIcon='🔢'; actionLabel='<span style="color:#F57F17;font-weight:700">ลายเซ็นครบแล้ว — กรุณาออกเลขที่หนังสือ</span>';
  } else if(o.action==='reject'){
    bannerBg='#FFF3E0'; bannerIcon='↩'; actionLabel='<span style="color:#E65100;font-weight:700">เอกสารถูกส่งคืนเพื่อแก้ไข</span>';
  } else if(o.action==='reject_fyi'){
    bannerBg='#FFF3E0'; bannerIcon='↩'; actionLabel='<span style="color:#E65100;font-weight:700">เอกสารที่ท่านเคยอนุมัติถูกส่งคืนแก้ไขแล้ว (เพื่อทราบ)</span>';
  } else if(o.action==='overdue'){
    bannerBg='#FFEBEE'; bannerIcon='⚠️'; actionLabel='<span style="color:#C62828;font-weight:700">เอกสารเลยกำหนดส่งแล้ว กรุณาดำเนินการโดยด่วน</span>';
  } else {
    bannerBg='#E3F2FD'; bannerIcon='📋'; actionLabel='<span style="color:#1565C0;font-weight:700">มีเอกสารรอการดำเนินการของคุณ</span>';
  }

  var rows='';
  if(o.addrTo) rows+='<tr><td style="color:#888;padding:5px 0;width:110px;font-size:13px">เรียน</td><td style="font-weight:600;font-size:13px">'+esc(o.addrTo)+'</td></tr>';
  if(o.fromDept) rows+='<tr><td style="color:#888;padding:5px 0;font-size:13px">จากฝ่าย</td><td style="font-size:13px">'+esc(o.fromDept)+'</td></tr>';
  if(o.urgency) rows+='<tr><td style="color:#888;padding:5px 0;font-size:13px">ความเร่งด่วน</td><td><span style="color:'+urgClr+';font-weight:600;font-size:13px">'+esc(urgTxt(o.urgency))+'</span></td></tr>';
  if(o.deadlineStr) rows+='<tr><td style="color:#888;padding:5px 0;font-size:13px">วันกำหนดส่ง</td><td style="font-weight:700;color:#E84300;font-size:13px">'+esc(o.deadlineStr)+'</td></tr>';
  if(o.nextStep&&o.action!=='reject'&&o.newStatus!=='completed') rows+='<tr><td style="color:#888;padding:5px 0;font-size:13px">ขั้นตอนที่รอ</td><td style="font-size:13px">'+esc(o.nextStep.step_name||'')+'</td></tr>';
  if(o.action==='reject'&&o.note) rows+='<tr><td style="color:#888;padding:5px 0;vertical-align:top;font-size:13px">ส่วนที่ต้องแก้ไข</td><td style="color:#E65100;font-size:13px">'+esc(o.note)+'</td></tr>';
  if(o.action==='reject_fyi'){
    if(o.rejectedStepName) rows+='<tr><td style="color:#888;padding:5px 0;font-size:13px">ตีกลับจากขั้นตอน</td><td style="font-size:13px">'+esc(o.rejectedStepName)+'</td></tr>';
    if(o.note) rows+='<tr><td style="color:#888;padding:5px 0;vertical-align:top;font-size:13px">ส่วนที่ต้องแก้ไข</td><td style="color:#E65100;font-size:13px">'+esc(o.note)+'</td></tr>';
  }

  var footerMsg='';
  if(o.newStatus==='completed'){
    footerMsg='<p style="font-size:13px;color:#2E7D32;margin:16px 0 8px">กรุณาเข้าระบบเพื่อดาวน์โหลดเอกสารฉบับลงนาม</p>';
    if(o.signedFileUrl) footerMsg+='<a href="'+o.signedFileUrl+'" style="display:inline-block;background:#E84300;color:#fff;text-decoration:none;padding:10px 22px;border-radius:8px;font-weight:600;font-size:13px;margin-top:4px">ดูเอกสารลงนาม</a>';
  } else if(o.newStatus==='numbering'){
    footerMsg='<p style="font-size:13px;color:#F57F17;margin:16px 0 0;font-weight:700">กรุณาเข้าสู่ระบบเพื่อออกเลขที่หนังสือและวันที่</p>';
  } else if(o.action==='reject'){
    footerMsg='<p style="font-size:13px;color:#E65100;margin:16px 0 0">กรุณาแก้ไขเอกสารและส่งกลับผ่านระบบ</p>';
  } else if(o.action==='reject_fyi'){
    footerMsg='<p style="font-size:13px;color:#E65100;margin:16px 0 0">เพื่อทราบเท่านั้น ไม่ต้องดำเนินการเพิ่มเติม — เอกสารอยู่ระหว่างผู้จัดทำแก้ไข</p>';
  } else if(o.action==='overdue'){
    footerMsg='<p style="font-size:13px;color:#C62828;margin:16px 0 0;font-weight:700">⚠️ กรุณาเข้าสู่ระบบเพื่อดำเนินการโดยด่วน</p>';
    if(o.autoApprove) footerMsg+='<p style="font-size:12.5px;color:#92400E;margin:10px 0 0;background:#FFFBEB;border-left:3px solid #F59E0B;border-radius:0 6px 6px 0;padding:10px 14px;line-height:1.6">อีเมลนี้ส่งเพียงครั้งเดียว — หากไม่มีการดำเนินการภายใน <strong>'+(o.slaDays||3)+' วันทำการ</strong> ระบบจะอนุมัติ/รับเอกสารให้อัตโนมัติ และบันทึกไว้ในประวัติเอกสาร</p>';
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
      (o.extraNote?'<div style="margin-top:14px;padding:10px 14px;background:#FFFBEB;border-left:3px solid #F59E0B;border-radius:0 6px 6px 0;font-size:12px;color:#92400E;line-height:1.6">'+esc(o.extraNote)+'</div>':'')+
    '</td></tr>'+
    // Footer
    '<tr><td style="padding:14px 28px;background:#F9F9F9;border-top:1px solid #EEE;text-align:center;font-size:11px;color:#BBB">'+
      'ระบบเสนอเอกสาร กนค. © 2568 &nbsp;·&nbsp; อีเมลนี้ส่งโดยอัตโนมัติ ไม่ต้องตอบกลับ'+
    '</td></tr>'+
    '</table></td></tr></table>'+
    '</body></html>'
}

/* ── ตรวจเอกสารเลยกำหนด (เรียกหลัง login, เครื่องละ 1 ครั้งต่อวัน) ──
   นโยบาย: เตือนครั้งเดียวต่อเอกสาร → ถ้ายังเงียบเกิน sla_cascade_days วันทำการ
   ระบบจัดการอัตโนมัติผ่าน auto_approve_overdue RPC เฉพาะเอกสารที่
   (a) ค้างขั้นตอนสุดท้ายของ workflow หรือ (b) รอผู้รับปลายทางกดรับ
   — เงื่อนไขจริงถูกตรวจซ้ำฝั่งเซิร์ฟเวอร์ใน RPC (supabase/21_overdue_once_auto_approve.sql) */
/* ── ตรวจเอกสารเลยกำหนด — ย้ายไป cron ฝั่งเซิร์ฟเวอร์ (check-overdue Edge Function)
   คงไว้เป็น fallback เฉพาะเจ้าหน้าที่ กรณี cron ล้มเหลว */
async function sendOverdueNotifs(force){
  if(!CU||['ROLE-SYS','ROLE-STF','ROLE-DEV'].indexOf(CU.role_code)<0) return;
  if(!force&&SETT.overdue_cron_enabled!==false) return;
  var today=new Date().toISOString().substring(0,10);
  if(!force&&localStorage.getItem('_overdueCk')===today) return;
  if(!force) localStorage.setItem('_overdueCk',today);
  // เอกสารค้าง workflow + เอกสารเสร็จสิ้นที่ส่งต่อแล้วแต่ผู้รับยังไม่กดรับ
  var rs=await Promise.all([
    dg('documents','?status=eq.pending&due_date=lt.'+today+'&notify_overdue=eq.true&select=id'),
    dg('documents','?status=eq.completed&forwarded_to_id=not.is.null&due_date=lt.'+today+'&notify_overdue=eq.true&select=id')
  ]);
  var pendDocs=Array.isArray(rs[0])?rs[0]:[];
  var fwdDocs=Array.isArray(rs[1])?rs[1]:[];
  // ตัดเอกสาร completed ที่ผู้รับกดรับไปแล้ว (forwarded_to_id ไม่ถูกล้างหลังรับ)
  if(fwdDocs.length){
    try{
      var _accHist=await dg('document_history','?document_id=in.('+fwdDocs.map(function(d){return safeId(d.id)}).join(',')+')&action=eq.เจ้าหน้าที่รับเอกสาร&select=document_id');
      var _accIds=new Set((Array.isArray(_accHist)?_accHist:[]).map(function(h){return h.document_id}));
      fwdDocs=fwdDocs.filter(function(d){return !_accIds.has(d.id)});
    }catch(e){fwdDocs=[]}
  }
  var overdueDocs=pendDocs.concat(fwdDocs);
  if(!overdueDocs.length) return;
  var slaDays=SETT.sla_cascade_days||3;
  for(var i=0;i<overdueDocs.length;i++){
    var did=overdueDocs[i].id;
    // เวลาที่เตือนครั้งแรก: null = ยังไม่เคยเตือน, undefined = RPC ใหม่ยังไม่ deploy
    var sentAt;
    try{
      var _sr=await fetch(SU+'/rest/v1/rpc/overdue_notif_sent_at',{method:'POST',headers:H,body:JSON.stringify({p_doc:did})});
      if(_sr.ok){var _sv=await _sr.json();sentAt=_sv?_sv:null;}
    }catch(e){}
    if(sentAt===undefined){
      // fallback: RPC เดิม (boolean) — เตือนเฉพาะที่ยังไม่เคยส่ง, ไม่ทำ auto-approve
      var _already=false;
      try{
        var _rr=await fetch(SU+'/rest/v1/rpc/overdue_notif_exists',{method:'POST',headers:H,body:JSON.stringify({p_doc:did})});
        if(_rr.ok) _already=(await _rr.json())===true;
      }catch(e){}
      if(_already) continue;
      try{await sendNotifEmail(did,'overdue','overdue','')}catch(e){console.warn('Overdue notif failed:',e)}
      continue;
    }
    if(sentAt===null){
      // ยังไม่เคยเตือน → เตือนครั้งเดียว (ครั้งต่อไป sentAt จะไม่ null อีก)
      try{await sendNotifEmail(did,'overdue','overdue','')}catch(e){console.warn('Overdue notif failed:',e)}
      continue;
    }
    // เตือนไปแล้ว → ครบ grace period หรือยัง (RPC ตรวจซ้ำฝั่งเซิร์ฟเวอร์อีกชั้น)
    if(new Date()<addWorkingDays(new Date(sentAt),slaDays)) continue;
    try{
      var _ar=await fetch(SU+'/rest/v1/rpc/auto_approve_overdue',{method:'POST',headers:H,body:JSON.stringify({p_doc:did})});
      if(!_ar.ok) continue;
      var _res=await _ar.json();
      // แจ้งผู้จัดทำตาม flow ปกติของสถานะใหม่ (numbering/completed แจ้งผู้จัดทำ)
      if(_res==='approved_numbering'){try{await sendNotifEmail(did,'approve','numbering','')}catch(e){}}
      else if(_res==='approved_completed'){try{await sendNotifEmail(did,'approve','completed','')}catch(e){}}
    }catch(e){console.warn('Auto-approve overdue failed:',e)}
  }
}

/* ═══ แจ้งเตือน LINE: ขั้นตอนค้างเกินกำหนดลงนาม ═══
   คนละเรื่องกับ sendOverdueNotifs ด้านบน ซึ่งวัดจาก documents.due_date (วันจัดกิจกรรม)
   ตัวนี้วัดจาก workflow_steps.deadline_datetime — เส้นตายที่ผู้ลงนามคนนั้นต้องกดอนุมัติ
   (ปกติ 2 วันทำการนับจากตอนที่ขั้นก่อนหน้าอนุมัติ) เดิมไม่มีอะไรอ่านคอลัมน์นี้เลย
   เอกสารที่ค้างที่คนกลางเป็นสัปดาห์จึงเงียบสนิทตราบใดที่วันจัดกิจกรรมยังมาไม่ถึง

   ⚠️ notification_type ต้องเป็น 'step_overdue' ห้ามใช้ 'overdue'
      overdue_notif_sent_at() นับแถว type='overdue' เป็นจุดเริ่มนาฬิกา auto_approve_overdue
      ถ้าใช้ type เดียวกัน เอกสารจะถูกนับว่า "เตือนเรื่องเลยกำหนดแล้ว" ทั้งที่ยังไม่เคยเตือน
      แล้วถูกอนุมัติอัตโนมัติเร็วกว่าที่ควร

   ช่องทาง: LINE เท่านั้น — ไม่ส่งอีเมล (ตามที่ตกลง อีเมลของเดิมไม่ถูกแตะ)
   เตือนครั้งเดียวต่อ "รอบการ active ของขั้นตอน" — dedup ด้วยแถว notifications ที่ sent_at
   ใหม่กว่าเวลาที่ขั้นนั้นถูกเปิด (ขั้นเดิมที่ถูก re-activate หลังตีกลับจึงเตือนได้ใหม่)
   ปลอดภัยถ้ารันคู่กับ cron check-overdue — ทั้งสองฝั่งเช็ค dedup จากตาราง notifications เดียวกัน */
async function sendStepStallLineNotifs(force){
  if(!CU||['ROLE-SYS','ROLE-STF','ROLE-DEV'].indexOf(CU.role_code)<0) return;
  var today=new Date().toISOString().substring(0,10);
  if(!force&&localStorage.getItem('_stepStallCk')===today) return;
  if(!force) localStorage.setItem('_stepStallCk',today);

  var nowIso=new Date().toISOString();
  var stalled=await dg('workflow_steps','?status=eq.active&deadline_datetime=lt.'+encodeURIComponent(nowIso)+
    '&select=id,document_id,step_number,step_name,assigned_to,deadline_datetime');
  if(!Array.isArray(stalled)||!stalled.length) return;

  var docIds=[...new Set(stalled.map(function(s){return s.document_id}).filter(Boolean))];
  if(!docIds.length) return;
  var _in='('+docIds.map(safeId).join(',')+')';
  var docs=await dg('documents','?id=in.'+_in+'&status=eq.pending&notify_overdue=eq.true'+
    '&select=id,title,subject_line,due_date,created_by,created_at');
  if(!Array.isArray(docs)||!docs.length) return;
  var docMap={}; docs.forEach(function(d){docMap[d.id]=d});

  // ขั้นตอนทั้งหมดของเอกสารเหล่านี้ — ใช้หาเวลาที่ขั้นที่ค้างถูกเปิดให้ทำ (stepStallInfo)
  var allSteps=await dg('workflow_steps','?document_id=in.'+_in+'&order=step_number'+
    '&select=id,document_id,step_number,step_name,assigned_to,status,action_at,completed_at,deadline_datetime');
  var stepsByDoc={};
  (Array.isArray(allSteps)?allSteps:[]).forEach(function(s){
    (stepsByDoc[s.document_id]=stepsByDoc[s.document_id]||[]).push(s);
  });

  // แถวเตือนเดิม — อ่านได้เพราะ scan นี้จำกัดที่ ROLE-STF/SYS/DEV (RLS ของ notifications)
  var prevByDoc={};
  try{
    var prev=await dg('notifications','?document_id=in.'+_in+'&notification_type=eq.step_overdue&select=document_id,sent_at');
    (Array.isArray(prev)?prev:[]).forEach(function(n){
      var t=new Date(n.sent_at);
      if(isNaN(t)) return;
      if(!prevByDoc[n.document_id]||t>prevByDoc[n.document_id]) prevByDoc[n.document_id]=t;
    });
  }catch(e){ return; }   // อ่าน dedup ไม่ได้ = ไม่ส่ง ดีกว่าส่งซ้ำทุกวัน

  var uids=[...new Set(docs.map(function(d){return d.created_by}).concat(
    stalled.map(function(s){return s.assigned_to})).filter(Boolean))];
  var uMap={};
  if(uids.length){
    var us=await dg('user_directory','?id=in.('+uids.map(safeId).join(',')+')&select=id,full_name');
    (Array.isArray(us)?us:[]).forEach(function(u){uMap[u.id]=u});
  }

  for(var i=0;i<docs.length;i++){
    var doc=docs[i];
    try{
      var info=stepStallInfo(stepsByDoc[doc.id]||[],doc);
      if(!info||!info.late) continue;
      // เตือนไปแล้วหลังจากขั้นนี้ถูกเปิด → ข้าม (ขั้นเดิมที่เพิ่งถูก re-activate จะไม่ติด dedup เก่า)
      if(prevByDoc[doc.id]&&prevByDoc[doc.id]>=info.since) continue;

      var subj=(doc.subject_line&&doc.subject_line.length>=3)?doc.subject_line:(doc.title||'');
      var assignee=info.step.assigned_to?uMap[info.step.assigned_to]:null;
      var sent=false;

      // 1) ผู้ที่ต้องลงนาม — คนที่กดแล้วเอกสารเดินต่อได้
      if(info.step.assigned_to){
        var st1=await sendLinePush(info.step.assigned_to,
          buildStepStallLineText({role:'assignee',name:assignee?assignee.full_name:'',subj:subj,info:info}),null,doc.id);
        if(st1!=='skipped'){
          sent=true;
          try{await logNotifRow({document_id:doc.id,recipient_id:info.step.assigned_to,recipient_email:'',
            subject:'[LINE] ค้างเกินกำหนดลงนาม: '+subj,
            body:'ขั้นตอน '+(info.step.step_name||'')+' ค้าง '+info.days+' วันทำการ',
            notification_type:'step_overdue',status:st1,sent_at:new Date().toISOString()})}catch(e){}
        }
      }
      // 2) ผู้จัดทำ — ให้รู้ว่าเอกสารตัวเองติดอยู่ที่ใคร จะได้ตามได้ถูกคน
      if(doc.created_by&&doc.created_by!==info.step.assigned_to){
        var cr=uMap[doc.created_by];
        var st2=await sendLinePush(doc.created_by,
          buildStepStallLineText({role:'creator',name:cr?cr.full_name:'',subj:subj,info:info,
            holder:assignee?assignee.full_name:''}),null,doc.id);
        if(st2!=='skipped'){
          sent=true;
          try{await logNotifRow({document_id:doc.id,recipient_id:doc.created_by,recipient_email:'',
            subject:'[LINE] เอกสารของท่านค้างเกินกำหนด: '+subj,
            body:'ค้างที่ '+(info.step.step_name||'')+' '+info.days+' วันทำการ',
            notification_type:'step_overdue',status:st2,sent_at:new Date().toISOString()})}catch(e){}
        }
      }
      if(!sent) continue;   // ไม่มีใครผูก LINE ไว้ — ไม่บันทึก จะได้เตือนใหม่เมื่อผูกแล้ว
    }catch(e){console.warn('Step-stall LINE notif failed:',doc.id,e)}
  }
}

/* ข้อความ LINE สำหรับขั้นตอนค้าง — plain text เหมือน buildLineText (คนละ head/CTA) */
function buildStepStallLineText(o){
  var pfx=SETT.email_prefix||'[กนค.]';
  var info=o.info, st=info.step;
  var ddl=info.deadline?info.deadline.toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit'}):'';
  var lines=[];
  if(o.role==='creator'){
    lines.push(pfx+' ⏰ เอกสารของท่านค้างเกินกำหนด');
    if(o.name) lines.push('เรียน '+o.name);
    lines.push('เรื่อง: '+(o.subj||''));
    lines.push('ค้างที่ขั้นตอน: '+(st.step_name||'')+(o.holder?' ('+o.holder+')':''));
  } else {
    lines.push(pfx+' ⏰ ท่านมีเอกสารค้างเกินกำหนดลงนาม');
    if(o.name) lines.push('เรียน '+o.name);
    lines.push('เรื่อง: '+(o.subj||''));
    lines.push('ขั้นตอนของท่าน: '+(st.step_name||''));
  }
  if(ddl) lines.push('ครบกำหนดลงนาม: '+ddl);
  lines.push('ค้างมาแล้ว: '+info.days+' วันทำการ');
  lines.push(o.role==='creator'?'กรุณาติดตามกับผู้รับผิดชอบขั้นตอนนี้':'กรุณาเข้าระบบเพื่อลงนาม');
  if(SETT.app_url) lines.push(SETT.app_url);
  return lines.join('\n');
}

function showEmailToast(emails, subj){
  var list=Array.isArray(emails)?emails.filter(Boolean):[emails].filter(Boolean);
  if(!list.length) return;
  var t=document.createElement('div');
  t.className='email-toast';
  t.setAttribute('role','status');
  t.setAttribute('aria-live','polite');
  var emailsHtml=list.map(function(e){
    return '<span class="email-toast-addr" title="'+esc(e)+'">'+esc(e)+'</span>';
  }).join('');
  var subjLine=subj?(subj.length>52?subj.slice(0,52)+'…':subj):'';
  var subjHtml=subjLine?'<div class="email-toast-subj" title="'+esc(subj)+'">'+esc(subjLine)+'</div>':'';
  t.innerHTML=[
    '<button type="button" class="email-toast-close" aria-label="ปิด">'+svg('x',14)+'</button>',
    '<div class="email-toast-icon">'+svg('ok',18)+'</div>',
    '<div class="email-toast-body">',
    '<div class="email-toast-title">ส่งอีเมลแจ้งเตือนแล้ว'+(list.length>1?' ('+list.length+' รายการ)':'')+'</div>',
    '<div class="email-toast-recipients">'+emailsHtml+'</div>',
    subjHtml,
    '</div>'
  ].join('');
  var close=t.querySelector('.email-toast-close');
  function dismiss(){
    if(!t.parentNode) return;
    t.classList.add('email-toast-out');
    setTimeout(function(){if(t.parentNode)t.remove()},220);
  }
  close.onclick=dismiss;
  document.body.appendChild(t);
  if(typeof _lcr==='function') _lcr();
  setTimeout(dismiss,5500);
}

/* ═══ LINE OA NOTIFICATIONS ═══
   ช่องทางแจ้งเตือนเสริมสำหรับผู้ที่ไม่ค่อยเปิดอีเมล — push ผ่าน Edge Function send-line
   (resolve line_user_id ฝั่ง server ด้วย service role — user_directory ไม่ expose คอลัมน์นี้)
   ผูกบัญชีด้วยรหัส 6 หลัก: แอปเขียน users.line_link_code → ผู้ใช้พิมพ์รหัสส่งในแชท OA
   → Edge Function line-webhook จับคู่แล้วเขียน line_user_id
   ล้มเหลว = เงียบ (fail-open) — อีเมลเดิมยังเป็นช่องทางหลักเสมอ */

async function sendLinePush(recipientId, text, flex, documentId, testSelf){
  if(!recipientId||!text) return 'skipped';
  try{
    var r=await fetch(SU+'/functions/v1/send-line',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':H.Authorization,'apikey':SK},
      body:JSON.stringify({recipientId:recipientId,text:text,flex:flex||undefined,documentId:documentId||undefined,testSelf:!!testSelf})
    });
    var j=await r.json().catch(function(){return{}});
    if(r.ok&&j.ok) return 'sent';
    if(j&&j.skipped) return 'skipped';
    console.warn('LINE push failed:',j);
    return 'failed';
  }catch(e){console.warn('LINE push error:',e);return 'failed'}
}

/* ส่งเข้ากลุ่ม LINE เจ้าหน้าที่ — send-line resolve groupId จาก app_settings ฝั่ง server
   ไม่บันทึกลง notifications (ไม่มี recipient_id รายคน และ dedup ของ overdue อาศัยแถวรายคน
   ที่เขียนใน loop ผู้รับอยู่แล้ว) */
async function sendLineGroupPush(text, flex){
  if(!text) return 'skipped';
  try{
    var r=await fetch(SU+'/functions/v1/send-line',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':H.Authorization,'apikey':SK},
      body:JSON.stringify({group:true,text:text,flex:flex||undefined})
    });
    var j=await r.json().catch(function(){return{}});
    if(r.ok&&j.ok) return 'sent';
    if(j&&j.skipped) return 'skipped';
    console.warn('LINE group push failed:',j);
    return 'failed';
  }catch(e){console.warn('LINE group push error:',e);return 'failed'}
}

/* ส่ง LINE + บันทึก audit ลง notifications (เฉพาะเมื่อได้ลองส่งจริง — 'skipped' ไม่บันทึก
   เพื่อไม่ให้เอกสารถูกนับว่า "เตือนแล้ว" โดย overdue_notif_sent_at ทั้งที่ไม่มีช่องทางไหนส่งออก)
   ใช้ notification_type เดียวกับอีเมลของ action นั้น (แยกช่องทางด้วย subject prefix [LINE])
   เพื่อให้ dedup ของ overdue ทำงานถูกต้องแม้ผู้รับไม่มีอีเมลจริง */
async function sendLineWithLog(docId, recipientId, recipientEmail, subject, text, ntype, flex){
  var st=await sendLinePush(recipientId, text, flex, docId);
  if(st==='skipped') return st;
  try{
    await logNotifRow({
      document_id:docId, recipient_id:recipientId, recipient_email:recipientEmail||'',
      subject:'[LINE] '+subject, body:text, notification_type:ntype,
      status:st, sent_at:new Date().toISOString()
    });
  }catch(e){}
  return st;
}

/* ── ข้อความ LINE แบบย่อ (plain text — คู่ขนานกับ buildEmailHtml) ── */
function buildLineText(o){
  var pfx=SETT.email_prefix||'[กนค.]';
  var head;
  if(o.newStatus==='completed')      head='✅ เอกสารเสร็จสิ้นทุกขั้นตอน';
  else if(o.newStatus==='numbering') head='🔢 ลายเซ็นครบแล้ว — รอออกเลขหนังสือ';
  else if(o.action==='reject')       head='↩️ เอกสารถูกส่งคืนเพื่อแก้ไข';
  else if(o.action==='reject_fyi')   head='ℹ️ แจ้งเพื่อทราบ: เอกสารที่ท่านเคยอนุมัติถูกส่งคืนแก้ไข';
  else if(o.action==='overdue')      head='⚠️ เอกสารเลยกำหนด — กรุณาดำเนินการด่วน';
  else                               head='📋 มีเอกสารรอการดำเนินการของคุณ';

  var lines=[pfx+' '+head];
  if(o.recipName)   lines.push('เรียน '+o.recipName);
  lines.push('เรื่อง: '+(o.subj||''));
  if(o.urgency&&urgNorm(o.urgency)!=='normal') lines.push('ความเร่งด่วน: '+urgTxt(o.urgency));
  if(o.deadlineStr) lines.push('กำหนดส่ง: '+o.deadlineStr);
  if(o.sentAt) lines.push('สถานะ ณ '+o.sentAt);
  if(o.nextStep&&o.action!=='reject'&&o.newStatus!=='completed'&&o.nextStep.step_name) lines.push('ขั้นตอนที่รอ: '+o.nextStep.step_name);
  if(o.rejectedStepName) lines.push('ตีกลับจากขั้นตอน: '+o.rejectedStepName);
  if((o.action==='reject'||o.action==='reject_fyi')&&o.note) lines.push('ส่วนที่ต้องแก้ไข: '+o.note);
  if(o.action==='overdue'&&o.autoApprove) lines.push('⏳ หากไม่ดำเนินการภายใน '+(o.slaDays||3)+' วันทำการ ระบบจะอนุมัติ/รับเอกสารให้อัตโนมัติ');
  lines.push('');
  lines.push(SETT.app_url?'เข้าสู่ระบบ: '+SETT.app_url:'กรุณาเข้าสู่ระบบ SAEDU Flow เพื่อดำเนินการ');
  return lines.join('\n');
}

/* ── สรุปขั้นตอน workflow + ชื่อผู้รับผิดชอบ สำหรับส่วน "ความคืบหน้า" บนการ์ด LINE ── */
async function _lineStepsInfo(wfSteps){
  try{
    if(!Array.isArray(wfSteps)||!wfSteps.length) return [];
    var ids=[]; wfSteps.forEach(function(s){if(s.assigned_to&&ids.indexOf(s.assigned_to)<0)ids.push(s.assigned_to)});
    var nm={};
    if(ids.length){
      var us=await dg('user_directory','?id=in.('+ids.map(function(i){return safeId(i)}).join(',')+')&select=id,full_name');
      (Array.isArray(us)?us:[]).forEach(function(u){nm[u.id]=u.full_name});
    }
    return wfSteps.map(function(s){return {name:s.step_name||('ขั้นที่ '+s.step_number),person:nm[s.assigned_to]||'',st:s.status}});
  }catch(e){return []}
}

/* ── LINE Flex Message — การ์ดแจ้งเตือน (คู่กับ buildLineText ซึ่งใช้เป็น altText/fallback) ──
   รับ o แบบเดียวกับ buildLineText เพิ่ม: steps จาก _lineStepsInfo() (แถบความคืบหน้า —
   ✓ ผ่านแล้ว / ● รออยู่ / ○ ยังไม่ถึงคิว / ✕ ตีกลับ), rows:[[label,value]] แถวข้อมูลเพิ่มเติม,
   headText/button/infoText สำหรับ override ข้อความ
   ⚠️ ต้อง deploy Edge Function send-line เวอร์ชันที่รองรับ {flex} ก่อนการ์ดถึงจะแสดง
   (เวอร์ชันเก่าไม่รู้จัก field นี้ — จะส่งเป็น text ธรรมดาต่อไป ไม่พัง) */
function buildLineFlex(o){
  var head=o.headText;
  if(!head){
    if(o.newStatus==='completed')      head='✅ เอกสารเสร็จสิ้นทุกขั้นตอน';
    else if(o.newStatus==='numbering') head='🔢 ลายเซ็นครบ — รอออกเลขหนังสือ';
    else if(o.action==='reject')       head='↩️ เอกสารถูกส่งคืนเพื่อแก้ไข';
    else if(o.action==='reject_fyi')   head='ℹ️ แจ้งเพื่อทราบ: เอกสารถูกส่งคืนแก้ไข';
    else if(o.action==='overdue')      head='⚠️ เอกสารเลยกำหนด';
    else                               head='📋 เอกสารรอการดำเนินการของคุณ';
  }
  function row(label,value,vColor){
    return {type:'box',layout:'baseline',spacing:'md',contents:[
      {type:'text',text:String(label),size:'xs',color:'#9A8F84',flex:3},
      {type:'text',text:String(value||'—'),size:'xs',color:vColor||'#18120E',flex:7,wrap:true}
    ]};
  }
  var body=[{type:'text',text:String(o.subj||'—'),weight:'bold',size:'sm',wrap:true,color:'#18120E'}];
  if(o.sentAt) body.push({type:'text',text:'สถานะ ณ '+o.sentAt,size:'xxs',color:'#9A8F84',margin:'sm'});
  if(o.recipName) body.push(row('เรียน',o.recipName));
  if(o.urgency&&urgNorm(o.urgency)!=='normal') body.push(row('ความเร่งด่วน',urgTxt(o.urgency),'#B45309'));
  if(o.deadlineStr) body.push(row('กำหนดส่ง',o.deadlineStr));
  (o.rows||[]).forEach(function(r){body.push(row(r[0],r[1]))});
  if(o.rejectedStepName) body.push(row('ตีกลับจาก',o.rejectedStepName,'#C77A1A'));
  if((o.action==='reject'||o.action==='reject_fyi')&&o.note) body.push(row('ต้องแก้ไข',o.note,'#C77A1A'));
  var steps=o.steps||[];
  if(steps.length){
    var done=steps.filter(function(s){return s.st==='done'}).length;
    body.push({type:'separator',margin:'lg',color:'#F0EBE0'});
    body.push({type:'text',text:'ความคืบหน้า '+done+'/'+steps.length+' ขั้นตอน',size:'xs',weight:'bold',color:'#9A8F84',margin:'lg'});
    steps.forEach(function(s){
      var mark='○',mc='#C9C0B8',tc='#9A8F84',bold=false;
      var txt=(s.name||'—')+(s.person?' — '+s.person:'');
      if(s.st==='done'){mark='✓';mc='#0F8C46';tc='#6B6157'}
      else if(s.st==='active'){mark='●';mc='#E83A00';tc='#18120E';bold=true;txt+='  ← รออยู่'}
      else if(s.st==='rejected'){mark='✕';mc='#DC2626';tc='#DC2626';txt+=' (ตีกลับ)'}
      var t={type:'text',text:txt,size:'xs',color:tc,flex:11,wrap:true};
      if(bold) t.weight='bold';
      body.push({type:'box',layout:'baseline',spacing:'sm',margin:'sm',contents:[
        {type:'text',text:mark,size:'xs',color:mc,flex:1,align:'center'},t
      ]});
    });
  } else if(o.nextStep&&o.nextStep.step_name&&o.action!=='reject'&&o.newStatus!=='completed'){
    body.push(row('ขั้นตอนที่รอ',o.nextStep.step_name,'#E83A00'));
  }
  if(o.infoText) body.push({type:'text',text:String(o.infoText),size:'xxs',color:'#9A8F84',wrap:true,margin:'lg'});
  if(o.action==='overdue'&&o.autoApprove) body.push({type:'text',text:'⏳ หากไม่ดำเนินการภายใน '+(o.slaDays||3)+' วันทำการ ระบบจะอนุมัติ/รับเอกสารให้อัตโนมัติ',size:'xxs',color:'#C77A1A',wrap:true,margin:'lg'});
  var bubble={
    type:'bubble',size:'mega',
    header:{type:'box',layout:'vertical',backgroundColor:'#E83A00',paddingAll:'16px',contents:[
      {type:'text',text:'SAEDU FLOW · ระบบเสนอเอกสาร กนค.',size:'xxs',weight:'bold',color:'#FFD9CC'},
      {type:'text',text:head,size:'md',weight:'bold',color:'#FFFFFF',wrap:true,margin:'xs'}
    ]},
    body:{type:'box',layout:'vertical',spacing:'sm',paddingAll:'16px',contents:body}
  };
  var url=String(SETT.app_url||'').trim();
  if(/^https?:\/\//.test(url)){
    bubble.footer={type:'box',layout:'vertical',paddingAll:'12px',contents:[
      {type:'button',style:'primary',color:'#E83A00',height:'sm',
       action:{type:'uri',label:o.button||'เข้าสู่ระบบเพื่อดำเนินการ',uri:url}}
    ]};
  }
  return bubble;
}

/* ── MODAL เชื่อมต่อ LINE (เปิดจากแผงกระดิ่งแจ้งเตือน) ── */
function showLineLink(){
  var mw=$e('mwrap'); if(!mw) return;
  var linked=!!(CU&&CU.line_user_id);
  var oaId=String(SETT.line_oa_id||'').trim();
  var addUrl=oaId?('https://line.me/R/ti/p/'+encodeURIComponent(oaId.charAt(0)==='@'?oaId:'@'+oaId)):'';
  var body;
  if(linked){
    body='<div class="al al-ok" style="margin-bottom:14px"><span class="al-icon">'+svg('ok',13)+'</span>'+
      '<span>เชื่อมต่อ LINE แล้ว — คุณจะได้รับการแจ้งเตือนเอกสารทาง LINE OA</span></div>'+
      '<p style="font-size:12px;color:#a89e99;line-height:1.7;margin:0 0 4px">หากต้องการเปลี่ยนบัญชี LINE ให้ยกเลิกการเชื่อมต่อก่อน แล้วเชื่อมต่อใหม่ด้วยบัญชีที่ต้องการ</p>';
  }else{
    body='<p style="font-size:13px;color:#18120E;line-height:1.8;margin:0 0 12px">รับการแจ้งเตือนเอกสาร (งานใหม่ ตีกลับ เลยกำหนด ฯลฯ) ผ่าน LINE — เหมาะสำหรับผู้ที่ไม่ค่อยได้เปิดอีเมล</p>'+
      '<ol style="font-size:12.5px;color:#18120E;line-height:2;margin:0 0 14px;padding-left:20px;list-style:decimal">'+
      '<li>เพิ่ม LINE OA ของระบบเป็นเพื่อน'+(addUrl?' — <a href="'+addUrl+'" target="_blank" rel="noopener" style="color:#06C755;font-weight:700">แอดเพื่อน '+esc(oaId)+'</a>':' (สแกน QR ของ OA หรือค้นหา LINE ID ที่เจ้าหน้าที่แจ้ง)')+'</li>'+
      '<li>กดปุ่มด้านล่างเพื่อสร้างรหัสเชื่อมต่อ</li>'+
      '<li>พิมพ์รหัส 6 หลักส่งในแชท LINE OA ภายใน 10 นาที</li>'+
      '</ol>'+
      '<div id="line-code-box"></div>';
  }
  mw.innerHTML='<div class="mo"><div class="modal">'+
    '<div class="modal-head"><span class="modal-title" style="display:flex;align-items:center;gap:8px">'+
      '<span style="width:22px;height:22px;border-radius:6px;background:#06C755;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:7px;font-weight:800">LINE</span>'+
      'รับแจ้งเตือนทาง LINE</span>'+
    '<button class="btn btn-soft xs btn-icon" data-action="closeModal">'+svg('x',14)+'</button></div>'+
    '<div class="modal-body">'+body+'</div>'+
    '<div class="modal-foot">'+
    '<button class="btn btn-soft" data-action="closeModal">ปิด</button>'+
    (linked
      ?'<button class="btn btn-danger" data-action="doLineUnlink">ยกเลิกการเชื่อมต่อ</button>'
      :'<button class="btn btn-primary" data-action="doLineLinkCode" id="line-gen-btn">สร้างรหัสเชื่อมต่อ</button>')+
    '</div></div></div>';
}

async function doLineLinkCode(){
  var btn=$e('line-gen-btn');
  if(btn){btn.disabled=true;btn.innerHTML='<span class="sp"></span>'}
  var code=String(Math.floor(100000+Math.random()*900000));
  var exp=new Date(Date.now()+10*60000).toISOString();
  try{
    await dpa('users',CU.id,{line_link_code:code,line_link_code_expires_at:exp});
    var box=$e('line-code-box');
    if(box) box.innerHTML=
      '<div style="background:#F0FDF4;border:1.5px dashed #06C755;border-radius:14px;padding:18px;text-align:center;margin-bottom:10px">'+
        '<div style="font-size:11px;color:#a89e99;margin-bottom:6px">รหัสเชื่อมต่อของคุณ (หมดอายุใน 10 นาที)</div>'+
        '<div class="mono" style="font-size:30px;font-weight:800;letter-spacing:8px;color:#18120E">'+code+'</div>'+
        '<div style="font-size:12px;color:#18120E;margin-top:8px;line-height:1.7">พิมพ์รหัสนี้ส่งในแชท LINE OA ได้เลย<br>เมื่อได้รับข้อความยืนยันแล้ว กดปุ่มด้านล่าง</div>'+
      '</div>'+
      '<button class="btn btn-soft" style="width:100%" data-action="lineLinkRefresh">'+svg('refresh',13)+' เชื่อมต่อแล้ว — ตรวจสอบสถานะ</button>';
    if(btn){btn.disabled=false;btn.innerHTML='สร้างรหัสใหม่'}
  }catch(e){
    showAlert('เกิดข้อผิดพลาด: '+(e.message||e),'er');
    if(btn){btn.disabled=false;btn.innerHTML='สร้างรหัสเชื่อมต่อ'}
  }
}

async function lineLinkRefresh(){
  try{
    var rows=await dg('users','?id=eq.'+safeId(CU.id)+'&select=line_user_id');
    if(Array.isArray(rows)&&rows[0]) CU.line_user_id=rows[0].line_user_id;
  }catch(e){}
  if(CU.line_user_id){showLineLink()}
  else showAlert('ยังไม่พบการเชื่อมต่อ — กรุณาส่งรหัส 6 หลักในแชท LINE OA ก่อน แล้วลองตรวจสอบอีกครั้ง','wa');
}

function doLineUnlink(){
  showConfirm('ยกเลิกการเชื่อมต่อ LINE','คุณจะไม่ได้รับการแจ้งเตือนเอกสารทาง LINE อีก (อีเมลยังส่งตามปกติ) ต้องการยกเลิกหรือไม่?',async function(){
    try{
      await dpa('users',CU.id,{line_user_id:null,line_link_code:null,line_link_code_expires_at:null});
      CU.line_user_id=null;
      showAlert('ยกเลิกการเชื่อมต่อ LINE เรียบร้อยแล้ว','ok');
    }catch(e){showAlert('เกิดข้อผิดพลาด: '+(e.message||e),'er')}
  });
}
