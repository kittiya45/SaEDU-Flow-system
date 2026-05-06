/* ─── TEMPLATES / แบบฟอร์มดาวน์โหลด ─── */

var TMPL_CATS={incoming:'หนังสือขาเข้า',outgoing:'หนังสือขาออก',general:'ทั่วไป'};
var TMPL_CAT_CLS={incoming:'b-draft',outgoing:'b-signed',general:'b-staff'};
var TMPL_CAT_ICO={incoming:'dn',outgoing:'up',general:'doc'};

async function vTmpl(){
  var result=await dg('form_templates','?is_active=eq.true&order=sort_order,created_at');
  if(!Array.isArray(result)){
    return '<div class="card" style="margin-top:8px"><div class="card-body">'+
      '<div class="al al-er"><span class="al-icon">'+svg('warn',13)+'</span>'+
      '<span><strong>ยังไม่ได้ตั้งค่าฐานข้อมูล</strong><br>กรุณาไปที่ Supabase → SQL Editor แล้วรันคำสั่งสร้างตาราง <code>form_templates</code> ก่อนใช้งาน</span></div>'+
      '</div></div>';
  }
  var rows=result;
  var isAdm=CU.role_code==='ROLE-SYS';
  var html=['<div id="tal"></div>'];

  // ── Toolbar (search + admin button) — same pattern as docList ──
  html.push('<div class="flex gap-2.5 mb-4 flex-wrap items-center">');
  html.push('<div class="search-wrap"><span class="search-icon">'+svg('srch',14)+'</span>'+
    '<input class="fi" id="tmpl-search" placeholder="ค้นหาชื่อแบบฟอร์ม..." oninput="tmplFilter(this.value)"></div>');
  if(isAdm){
    html.push('<button class="btn btn-primary sm ml-auto" data-action="showTmplUpload">'+svg('up',13)+' อัปโหลดแบบฟอร์ม</button>');
  }
  html.push('</div>');

  if(!rows.length){
    html.push('<div class="card"><div class="card-empty">'+
      '<div class="card-empty-icon">'+svg('doc',40)+'</div>'+
      '<div class="card-empty-text">ยังไม่มีแบบฟอร์มในระบบ</div>'+
      (isAdm?'<div style="font-size:12px;color:var(--text-3);margin-top:6px">กดปุ่ม "อัปโหลดแบบฟอร์ม" ด้านบนเพื่อเพิ่มแบบฟอร์มแรก</div>':'')+
      '</div></div>');
    return html.join('');
  }

  // จัดกลุ่มตาม category
  var grouped={};
  Object.keys(TMPL_CATS).forEach(function(c){grouped[c]=[]});
  rows.forEach(function(r){var c=r.category||'general';if(!grouped[c])grouped[c]=[];grouped[c].push(r)});

  html.push('<div id="tmpl-body">');
  Object.keys(TMPL_CATS).forEach(function(cat){
    var items=grouped[cat];
    if(!items||!items.length) return;
    html.push('<div class="card tmpl-section" data-cat="'+cat+'">');
    html.push('<div class="card-head">'+
      svg(TMPL_CAT_ICO[cat],15)+
      '<span class="card-head-title">'+esc(TMPL_CATS[cat])+'</span>'+
      '<span class="badge '+TMPL_CAT_CLS[cat]+' ml-1">'+items.length+'</span>'+
      '</div>');
    html.push('<div class="card-body" style="padding:0 16px 4px;">');
    items.forEach(function(t,i){
      var ext=(t.file_name||'').split('.').pop().toLowerCase();
      var isPdf=ext==='pdf'; var isWord=ext==='doc'||ext==='docx';
      var icoName=isPdf?'pdf_ico':(isWord?'word_ico':'doc');
      var icoClr=isPdf?{bg:'#FEF2F2',ic:'#DC2626'}:(isWord?{bg:'#EFF6FF',ic:'#2563EB'}:{bg:'#F5F3F0',ic:'#6b6560'});
      var divider=i<items.length-1?'border-bottom:1px solid var(--border);':'';
      html.push('<div class="tmpl-card" data-name="'+esc((t.name||'').toLowerCase())+'" style="display:flex;align-items:center;gap:12px;padding:10px 2px;'+divider+'">');
      html.push('<div style="width:36px;height:36px;border-radius:9px;background:'+icoClr.bg+';display:flex;align-items:center;justify-content:center;color:'+icoClr.ic+';flex-shrink:0">'+svg(icoName,18)+'</div>');
      html.push('<div style="flex:1;min-width:0">');
      html.push('<div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#18120E">'+esc(t.name)+'</div>');
      html.push('<div style="font-size:11px;color:var(--text-3);margin-top:2px">');
      if(t.description) html.push(esc(t.description)+' · ');
      html.push('<span class="mono">'+ext.toUpperCase()+'</span>');
      if(t.file_size) html.push(' · '+fsz(t.file_size));
      html.push('</div></div>');
      html.push('<div style="display:flex;gap:8px;align-items:center;flex-shrink:0">');
      html.push('<button style="width:36px;height:36px;border-radius:10px;border:2px solid #3b82f6;background:#eff6ff;color:#3b82f6;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0" data-action="tmplPreview" data-url="'+esc(furl(t.file_path))+'" data-name="'+esc(t.name)+'" data-ext="'+esc(ext)+'" title="ดูตัวอย่าง">'+svg('eye',15)+'</button>');
      html.push('<button style="height:36px;padding:0 14px;border-radius:10px;border:2px solid #ea580c;background:#fff7ed;color:#ea580c;font-size:12.5px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;flex-shrink:0" data-action="dlFile" data-url="'+furl(t.file_path)+'" data-name="'+esc(t.file_name)+'">'+svg('dn',13)+'<span>ดาวน์โหลด</span></button>');
      if(isAdm){
        html.push('<button class="btn btn-soft sm btn-icon" data-action="doTmplDelete" data-id="'+t.id+'" data-path="'+esc(t.file_path)+'" title="ลบ">'+svg('trash',13)+'</button>');
      }
      html.push('</div>');
      html.push('</div>');
    });
    html.push('</div></div>');
  });
  html.push('</div>');

    // No-result placeholder
  html.push('<div id="tmpl-no-result" style="display:none" class="card">' +
    '<div class="card-empty" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; text-align: center;">' +
    '<div class="card-empty-icon" style="margin-bottom: 12px;">' + svg('srch', 36) + '</div>' +
    '<div class="card-empty-text" style="font-size: 16px; color: #666;">ไม่พบแบบฟอร์มที่ค้นหา</div>' +
    '</div></div>');

  return html.join('');
  }
function tmplFilter(q){
  q=(q||'').toLowerCase().trim();
  var sections=document.querySelectorAll('.tmpl-section');
  var anyVisible=false;
  sections.forEach(function(sec){
    var cards=sec.querySelectorAll('.tmpl-card');
    var secVisible=false;
    cards.forEach(function(c){
      var show=!q||(c.getAttribute('data-name')||'').indexOf(q)>=0;
      c.style.display=show?'':'none';
      if(show) secVisible=true;
    });
    sec.style.display=secVisible?'':'none';
    if(secVisible) anyVisible=true;
  });
  var nr=$e('tmpl-no-result');
  if(nr) nr.style.display=(q&&!anyVisible)?'block':'none';
}

async function showTmplUpload(){

  var w = $e('mwrap');
  if(!w) return;

  var catOpts = Object.entries(TMPL_CATS).map(function(e){
    return '<option value="'+e[0]+'">'+e[1]+'</option>';
  }).join('');

  w.innerHTML = [
    '<div id="tmpl-overlay" class="mo" style="position:fixed; inset:0; z-index:9999; background:rgba(24,18,14,0.4); backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center;">',

      '<div class="modal gnk-box" style="max-width:520px; width:95%; border-radius:28px; background:#fff; box-shadow:0 40px 100px -20px rgba(232,58,0,.15); border:1px solid rgba(232,58,0,.05); overflow:hidden; position:relative;" onclick="event.stopPropagation()">',

        // HEADER
        '<div class="modal-head" style="padding:28px 32px 20px 32px; background:linear-gradient(to bottom, rgba(232,58,0,.05), #fff); border:none; display:flex; justify-content:space-between; align-items:flex-start;">',

          '<div class="flex flex-col gap-1">',
            '<div style="color:#E83A00; font-weight:800; font-size:10px; letter-spacing:.12em; text-transform:uppercase; display:flex; align-items:center; gap:6px;">',
              '<span style="width:10px; height:2px; background:#E83A00; border-radius:2px;"></span>',
              'เทมเพลตใหม่แบบฟอร์ม',
            '</div>',

            '<span class="modal-title" style="font-size:19px; font-weight:850; color:#18120E; letter-spacing:-0.02em;">',
              'อัปโหลดแบบฟอร์ม',
            '</span>',
          '</div>',

          // FIX CLOSE BUTTON
          '<button type="button" id="btn-close-tmpl" class="btn btn-soft sm btn-icon" style="cursor:pointer; background:rgba(232,58,0,.08); color:#E83A00; border-radius:12px; width:34px; height:34px; border:none; display:flex; align-items:center; justify-content:center;">',
            svg('x',14),
          '</button>',

        '</div>',

        // BODY
        '<div class="modal-body" style="padding:0 32px 24px 32px;">',

          // NAME
          '<div class="fg" style="margin-bottom:16px;">',
            '<label class="fl" style="display:block; font-size:11.5px; font-weight:700; color:#18120E; margin-bottom:6px;">',
              'ชื่อแบบฟอร์ม <span class="req" style="color:#E83A00">*</span>',
            '</label>',

            '<input class="fi" id="tmpl-name" placeholder="เช่น แบบฟอร์มขอใช้สถานที่" style="width:100%; height:44px; padding:0 14px; font-size:12.5px; border-radius:12px; border:1.5px solid #F1F1F1; background:#FAFAFA; outline:none;">',
          '</div>',

          // GRID
          '<div class="fr" style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px;">',

            '<div class="fg" style="margin:0">',
              '<label class="fl" style="display:block; font-size:11.5px; font-weight:700; color:#18120E; margin-bottom:6px;">',
                'หมวดหมู่ <span class="req" style="color:#E83A00">*</span>',
              '</label>',

              '<select class="fi" id="tmpl-cat" style="width:100%; height:44px; padding:0 10px; font-size:12.5px; border-radius:12px; border:1.5px solid #F1F1F1; background:#FAFAFA;">',
                catOpts,
              '</select>',
            '</div>',

            '<div class="fg" style="margin:0">',
              '<label class="fl" style="display:block; font-size:11.5px; font-weight:700; color:#18120E; margin-bottom:6px;">',
                'คำอธิบาย (ไม่บังคับ)',
              '</label>',

              '<input class="fi" id="tmpl-desc" placeholder="อธิบายสั้นๆ" style="width:100%; height:44px; padding:0 14px; font-size:12.5px; border-radius:12px; border:1.5px solid #F1F1F1; background:#FAFAFA; outline:none;">',
            '</div>',

          '</div>',

          // UPLOAD
          '<div class="fg" style="margin-bottom:16px;">',

            '<label class="fl" style="display:block; font-size:11.5px; font-weight:700; color:#18120E; margin-bottom:8px;">',
              'ไฟล์แบบฟอร์ม <span class="req" style="color:#E83A00">*</span>',
            '</label>',

            '<label class="upload-zone" for="tmpl-file" id="tmpl-dropzone" style="display:block; cursor:pointer; border:2px dashed rgba(232,58,0,.2); background:rgba(232,58,0,.01); border-radius:20px; padding:32px 20px; text-align:center;">',

              '<div class="upload-zone-inner">',

                '<div class="upload-zone-icon" style="width:56px; height:56px; background:#FFF5F2; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 12px; color:#E83A00; box-shadow:0 10px 20px -5px rgba(232,58,0,.1);">',
                  svg('up',24),
                '</div>',

                '<div class="upload-zone-text" style="font-size:13px; font-weight:700; color:#18120E; margin-bottom:4px;">',
                  'คลิก หรือ ลากไฟล์มาวางเพื่ออัปโหลด',
                '</div>',

                '<div class="upload-zone-hint" style="font-size:10.5px; color:#9A3412; opacity:.7;">',
                  'รองรับ PDF, DOC, DOCX (สูงสุด 20 MB)',
                '</div>',

              '</div>',

            '</label>',

            '<input type="file" id="tmpl-file" accept=".pdf,.doc,.docx" style="display:none" onchange="tmplFileChg(this)">',

            '<div id="tmpl-file-preview" style="display:none; margin-top:12px; padding:12px; background:#F9FAF8; border-radius:12px; border:1px solid #EBEBEB; font-size:12px;"></div>',

          '</div>',

          '<div id="tmpl-prog"></div>',

        '</div>',

        // FOOTER
        '<div class="modal-foot" style="padding:0 32px 32px 32px; border:none; background:none; display:flex; gap:10px;">',

          // FIX CANCEL BUTTON
          '<button type="button" id="btn-cancel-tmpl" class="btn btn-soft" style="cursor:pointer; flex:1; height:46px; border-radius:14px; font-weight:600; font-size:12.5px; border:1px solid #EBEBEB; background:#fff; color:#6b6560;">',
            'ยกเลิก',
          '</button>',

          // FIX UPLOAD BUTTON
          '<button type="button" id="btn-upload-tmpl" class="btn btn-primary" style="cursor:pointer; flex:1.8; height:46px; border-radius:14px; font-weight:700; font-size:12.5px; background:#E83A00; color:#fff; display:flex; align-items:center; justify-content:center; gap:8px; border:none; box-shadow:0 8px 16px -4px rgba(232,58,0,.3);">',
            svg('up',14),
            '<span>เริ่มการอัปโหลด</span>',
          '</button>',

        '</div>',

      '</div>',
    '</div>'
  ].join('');

  // -----------------------------
  // ELEMENTS
  // -----------------------------
  var overlay   = document.getElementById('tmpl-overlay');
  var closeBtn  = document.getElementById('btn-close-tmpl');
  var cancelBtn = document.getElementById('btn-cancel-tmpl');
  var uploadBtn = document.getElementById('btn-upload-tmpl');

  // -----------------------------
  // CLOSE MODAL
  // -----------------------------
  function closeModal(){
    w.innerHTML = '';
  }

  // CLICK OUTSIDE
  overlay.addEventListener('click', function(){
    closeModal();
  });

  // CLOSE BUTTON
  closeBtn.addEventListener('click', function(e){
    e.preventDefault();
    e.stopPropagation();
    closeModal();
  });

  // CANCEL BUTTON
  cancelBtn.addEventListener('click', function(e){
    e.preventDefault();
    e.stopPropagation();
    closeModal();
  });

  // UPLOAD BUTTON
  uploadBtn.addEventListener('click', function(e){
    e.preventDefault();
    e.stopPropagation();
    doTmplUpload();
  });

  // -----------------------------
  // STYLE
  // -----------------------------
  var st = document.createElement('style');

  st.innerHTML = `
    @keyframes spin{
      to{
        transform:rotate(360deg);
      }
    }
  `;

  document.head.appendChild(st);
}
function tmplFileChg(input){
  var f=input&&input.files&&input.files[0];
  var preview=$e('tmpl-file-preview');
  var zone=$e('tmpl-dropzone');
  if(!preview) return;
  if(!f){preview.style.display='none';if(zone)zone.style.display='flex';return}
  var ext=f.name.split('.').pop().toLowerCase();
  var isPdf=ext==='pdf'; var isWord=ext==='doc'||ext==='docx';
  var icoName=isPdf?'pdf_ico':(isWord?'word_ico':'doc');
  var icoClr=isPdf?{bg:'#FEF2F2',ic:'#DC2626'}:(isWord?{bg:'#EFF6FF',ic:'#2563EB'}:{bg:'#F5F3F0',ic:'#6b6560'});
  preview.style.display='block';
  preview.innerHTML='<div class="file-item" style="margin-bottom:0;border-color:'+icoClr.ic+'33;background:'+icoClr.bg+'">'+
    '<div style="width:36px;height:36px;border-radius:9px;background:#fff;display:flex;align-items:center;justify-content:center;color:'+icoClr.ic+';flex-shrink:0;box-shadow:0 1px 4px rgba(0,0,0,.08)">'+svg(icoName,18)+'</div>'+
    '<div class="file-info"><div class="file-name">'+esc(f.name)+'</div>'+
    '<div class="file-meta"><span class="mono">'+ext.toUpperCase()+'</span> · '+fsz(f.size)+'</div></div>'+
    '<button type="button" onclick="tmplFileClear()" class="btn btn-soft sm btn-icon">'+svg('x',12)+'</button>'+
  '</div>';
  if(zone) zone.style.display='none';
  var nameEl=$e('tmpl-name');
  if(nameEl&&!nameEl.value.trim()) nameEl.value=f.name.replace(/\.[^.]+$/,'').replace(/[_-]/g,' ');
}

function tmplFileClear(){
  var fi=$e('tmpl-file'); if(fi) fi.value='';
  var preview=$e('tmpl-file-preview');
  if(preview){preview.style.display='none';preview.innerHTML='';}
  var zone=$e('tmpl-dropzone'); if(zone) zone.style.display='flex';
}

function tmplPreview(url, name, ext){
  var displayName=name+(ext&&!name.toLowerCase().endsWith('.'+ext.toLowerCase())?'.'+ext:'');
  openViewer(url, displayName);
}

async function doTmplUpload(){
  var name=(gv('tmpl-name')||'').trim();
  var cat=gv('tmpl-cat')||'general';
  var desc=(gv('tmpl-desc')||'').trim();
  var fileEl=$e('tmpl-file');
  var f=fileEl&&fileEl.files[0];
  if(!name){alert('กรุณาระบุชื่อแบบฟอร์ม');return}
  if(!f){alert('กรุณาเลือกไฟล์');return}
  if(f.size>20*1024*1024){alert('ไฟล์ต้องไม่เกิน 20 MB');return}
  var btn=$e('btn-upload-tmpl');
  if(btn){btn.disabled=true;btn.innerHTML='<span class="sp"></span> กำลังอัปโหลด...'}
  var pg=$e('tmpl-prog');
  if(pg) pg.innerHTML='<div class="al al-in mt-2"><span class="sp sp-dark"></span><span> กำลังอัปโหลดไฟล์...</span></div>';
  try{
    var safeName=f.name.replace(/[^a-zA-Z0-9._-]/g,'_');
    var path='tmpl_'+Date.now()+'_'+safeName;
    await upFile(path,f);
    var insertResult=await dp('form_templates',{name:name,category:cat,description:desc||null,file_path:path,file_name:f.name,file_size:f.size,sort_order:0,is_active:true,uploaded_by:CU.id});
    if(!Array.isArray(insertResult)||!insertResult.length){
      throw new Error('บันทึกข้อมูลไม่สำเร็จ: '+(insertResult&&insertResult.message?insertResult.message:'กรุณาตรวจสอบสิทธิ์ตาราง form_templates ใน Supabase'));
    }
    $e('mwrap').innerHTML='';
    var a=$e('tal'); if(a) a.innerHTML=alrtH('ok','อัปโหลดแบบฟอร์มเรียบร้อยแล้ว');
    setTimeout(function(){nav('tmpl')},900);
  }catch(e){
    if(pg) pg.innerHTML=alrtH('er','อัปโหลดไม่สำเร็จ: '+e.message);
    if(btn){btn.disabled=false;btn.innerHTML=svg('up',14)+'<span> เริ่มการอัปโหลด</span>'}
  }
}

async function doTmplDelete(id,path){
  if(!confirm('ลบแบบฟอร์มนี้ออกจากระบบ?')) return;
  try{
    await dpa('form_templates',id,{is_active:false});
    var a=$e('tal'); if(a) a.innerHTML=alrtH('ok','ลบแบบฟอร์มเรียบร้อยแล้ว');
    setTimeout(function(){nav('tmpl')},800);
  }catch(e){alert('เกิดข้อผิดพลาด: '+e.message)}
}
