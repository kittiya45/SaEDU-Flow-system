/* ─── STATISTICS PAGE ─── */
// ปีที่เลือกสำหรับ annual summary (null = ปีปัจจุบัน)
if(typeof window._statYear==='undefined') window._statYear=null;

async function vStat(){
  var _since=new Date();
  _since.setMonth(_since.getMonth()-24);
  var _sinceStr=_since.toISOString().substring(0,10);
  var docs=await dg('documents','?created_at=gte.'+_sinceStr+'&select=id,status,doc_type,urgency,created_at,updated_at,due_date,title,doc_number,description,project_name,from_department&order=updated_at.desc,created_at.desc&limit=5000');
  var today=new Date().toISOString().substring(0,10);
  var total=docs.length;
  var byStatus={draft:0,pending:0,awaiting_submit:0,completed:0,rejected:0,signed:0,numbering:0,cancelled:0};
  var byType={incoming:0,outgoing:0};
  var byUrg={normal:0,urgent:0};
  var overdueCnt=0;
  docs.forEach(function(d){
    if(byStatus[d.status]!==undefined) byStatus[d.status]++;
    if(byType[d.doc_type]!==undefined) byType[d.doc_type]++;
    if(d.urgency==='very_urgent') byUrg.urgent++;
    else if(byUrg[d.urgency]!==undefined) byUrg[d.urgency]++;
    if(d.due_date&&d.due_date<today&&(d.status==='pending'||d.status==='draft')) overdueCnt++;
  });

  /* last 6 months */
  var months=[];
  for(var m=5;m>=0;m--){
    var md=new Date(); md.setDate(1); md.setMonth(md.getMonth()-m);
    months.push({key:md.getFullYear()+'-'+String(md.getMonth()+1).padStart(2,'0'),
      label:md.toLocaleDateString('th-TH',{month:'short'}),cnt:0});
  }
  docs.forEach(function(d){
    var mk=(d.created_at||'').substring(0,7);
    var mo=months.find(function(x){return x.key===mk});
    if(mo) mo.cnt++;
  });
  var maxM=Math.max.apply(null,months.map(function(m){return m.cnt}))||1;

  /* fetch files for recent docs (top 10) */
  var recent=docs.slice(0,10);
  var recentIds=recent.map(function(d){return d.id});
  var allFiles=[];
  if(recentIds.length){
    try{
      var _fr=await dg('document_files','?document_id=in.('+recentIds.join(',')+')'+'&select=id,document_id,file_name,file_path,version,archive_url&order=version.desc,uploaded_at.desc');
      if(Array.isArray(_fr)) allFiles=_fr;
    }catch(e){}
  }
  var fileMap={};
  allFiles.forEach(function(f){
    if(!fileMap[f.document_id]) fileMap[f.document_id]=[];
    fileMap[f.document_id].push(f);
  });

  var CS='background:#fff;border-radius:16px;border:1px solid rgba(0,0,0,.06);box-shadow:0 1px 8px rgba(0,0,0,.05);display:flex;flex-direction:column';
  function cardHead(title,sub,right){
    return '<div style="padding:15px 18px 11px;border-bottom:1px solid #F5F3F0;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;background:#FAFAF8">'+
      '<div><div style="font-size:13px;font-weight:700;color:#18120E;line-height:1.5">'+title+'</div>'+
      (sub?'<div style="font-size:11px;color:#a89e99;margin-top:3px;line-height:1.65">'+sub+'</div>':'')+
      '</div>'+(right||'')+'</div>';
  }

  var html=[];

  if(docs.length>=5000){
    html.push('<div class="al al-wa mb-4"><span class="al-icon">'+svg('info',13)+'</span><span>สถิติคำนวณจากเอกสาร 24 เดือนล่าสุด (สูงสุด 5,000 รายการ) — ข้อมูลเก่ากว่านั้นไม่รวมในสรุป</span></div>');
  } else {
    html.push('<div class="al al-in mb-4" style="opacity:.85"><span class="al-icon">'+svg('info',13)+'</span><span>สถิติคำนวณจากเอกสารที่สร้างใน 24 เดือนล่าสุด ('+total+' รายการ)</span></div>');
  }

  /* ══ ROW 1 — 4 stat tiles ══ */
  html.push(rStatCards([
    {label:'เอกสารทั้งหมด', val:total, sub:'ร่าง '+byStatus.draft+' รายการ',
     ico:'doc_f', grad:'linear-gradient(135deg,#1D4ED8 0%,#3B82F6 100%)', shadow:'rgba(29,78,216,.30)'},
    {label:'รอลงนาม', val:byStatus.pending, sub:'รอการอนุมัติ',
     ico:'pen_f', grad:'linear-gradient(135deg,#D97706 0%,#F59E0B 100%)', shadow:'rgba(217,119,6,.30)'},
    {label:'เสร็จสมบูรณ์', val:byStatus.completed, sub:'ดำเนินการครบแล้ว',
     ico:'check_f', grad:'linear-gradient(135deg,#15803D 0%,#22C55E 100%)', shadow:'rgba(21,128,61,.30)'},
    {label:'เลยกำหนด', val:overdueCnt, sub:'ต้องเร่งดำเนินการ',
     ico:'warn_f', grad:'linear-gradient(135deg,#DC2626 0%,#EF4444 100%)', shadow:'rgba(220,38,38,.30)'}
  ], {mb:'16px'}));

  /* ══ ROW 2 — 3 cols equal height: chart | type | urgency ══ */
  html.push('<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px">');

  /* ── เอกสารที่สร้าง ── */
  var BAR_W=36, BAR_GAP=14, CHART_H=100;
  html.push(
    '<div style="'+CS+'">'+
      cardHead('เอกสารที่สร้าง','6 เดือนล่าสุด',
        '<span style="font-size:11px;font-weight:600;color:#E83A00;background:#fff5f0;padding:3px 10px;border-radius:20px">'+total+' รายการ</span>')+
      '<div style="flex:1;display:flex;align-items:flex-end;justify-content:center;padding:16px 18px 14px">'+
        '<div style="display:flex;align-items:flex-end;gap:'+BAR_GAP+'px;height:'+(CHART_H+28)+'px">'+
        months.map(function(m){
          var barH=m.cnt>0?Math.max(Math.round(m.cnt/maxM*CHART_H),8):0;
          var isMax=m.cnt>0&&m.cnt===maxM;
          return '<div style="width:'+BAR_W+'px;display:flex;flex-direction:column;align-items:center;gap:4px">'+
            '<span style="font-size:10px;font-weight:700;color:'+(m.cnt>0?(isMax?'#E83A00':'#6b6560'):'#ddd')+'">'+m.cnt+'</span>'+
            '<div style="width:'+BAR_W+'px;height:'+(barH||3)+'px;background:'+(m.cnt>0?(isMax?'#E83A00':'#FBBFA8'):'#F0EDE9')+';border-radius:6px 6px 0 0;align-self:flex-end"></div>'+
            '<span style="font-size:11px;color:#a89e99;white-space:nowrap">'+m.label+'</span>'+
          '</div>';
        }).join('')+
        '</div>'+
      '</div>'+
    '</div>'
  );

  /* ── ประเภทเอกสาร ── */
  var typeRows=[
    {l:'หนังสือขาเข้า', v:byType.incoming, c:'#E83A00'},
    {l:'หนังสือขาออก',  v:byType.outgoing, c:'#F59E0B'}
  ];
  var maxT=Math.max.apply(null,typeRows.map(function(r){return r.v}))||1;
  html.push(
    '<div style="'+CS+'">'+
      cardHead('ประเภทเอกสาร','')+
      '<div style="flex:1;padding:8px 0 12px">'+
      typeRows.map(function(r){
        var pct=Math.round(r.v/maxT*100);
        return '<div style="padding:9px 18px">'+
          '<div style="display:flex;justify-content:space-between;margin-bottom:6px">'+
            '<span style="font-size:12px;color:#6b6560">'+r.l+'</span>'+
            '<span style="font-size:12px;font-weight:700;color:#18120E">'+r.v+'</span>'+
          '</div>'+
          '<div style="background:#F4F2EF;border-radius:99px;height:7px;overflow:hidden">'+
            '<div style="width:'+pct+'%;background:'+r.c+';height:100%;border-radius:99px"></div>'+
          '</div>'+
        '</div>';
      }).join('')+
      '</div>'+
    '</div>'
  );

  /* ── ระดับความเร่งด่วน ── */
  var urgRows=[
    {l:'ปกติ',    v:byUrg.normal, dot:'#15803D'},
    {l:'เร่งด่วน', v:byUrg.urgent, dot:'#B45309'}
  ];
  html.push(
    '<div style="'+CS+'">'+
      cardHead('ระดับความเร่งด่วน','')+
      '<div style="flex:1;padding:8px 0 12px">'+
      urgRows.map(function(r){
        var pct=total?Math.round(r.v/total*100):0;
        return '<div style="padding:10px 18px">'+
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'+
            '<div style="width:8px;height:8px;border-radius:50%;background:'+r.dot+'"></div>'+
            '<span style="flex:1;font-size:12px;color:#6b6560">'+r.l+'</span>'+
            '<span style="font-size:12px;font-weight:700;color:#18120E">'+r.v+'</span>'+
            '<span style="font-size:10px;font-weight:700;color:'+r.dot+';min-width:28px;text-align:right">'+pct+'%</span>'+
          '</div>'+
          '<div style="background:#F4F2EF;border-radius:99px;height:7px;overflow:hidden">'+
            '<div style="width:'+pct+'%;background:'+r.dot+';height:100%;border-radius:99px"></div>'+
          '</div>'+
        '</div>';
      }).join('')+
      '</div>'+
    '</div>'
  );

  html.push('</div>'); /* row 2 */

  /* ══ ROW 3 — 2 cols equal height: recent docs | status ══ */
  html.push('<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">');

  /* ── เอกสารล่าสุด ── */
  /* pre-build fileMap with resolved urls and expose globally */
  var fmForScript={};
  Object.keys(fileMap).forEach(function(docId){
    fmForScript[docId]=fileMap[docId].map(function(f){
      return {path:f.file_path,name:f.file_name,archive_url:f.archive_url||null};
    });
  });
  window._sfm=fmForScript;
  window._sdl=async function(docId){
    var fs=window._sfm[docId]||[];
    if(!fs.length){showAlert('ไม่มีไฟล์แนบในเอกสารนี้','wa');return;}
    var f=fs[0];
    // ไฟล์ที่ย้ายไปคลัง Google Drive แล้ว — ตัวจริงไม่อยู่ใน Storage เปิดลิงก์คลังแทน
    if(f.archive_url){window.open(f.archive_url,'_blank','noopener');return;}
    try{
      var url=await resolveFilePath(f.path);
      if(!url){showAlert('ไม่สามารถสร้างลิงก์ดาวน์โหลดได้','er');return;}
      var r=await fetch(url);
      if(!r.ok) throw new Error('HTTP '+r.status);
      var blob=await r.blob();
      var a=document.createElement('a');
      a.href=URL.createObjectURL(blob);
      a.download=f.name||'file';
      document.body.appendChild(a);a.click();
      setTimeout(function(){URL.revokeObjectURL(a.href);document.body.removeChild(a);},200);
    }catch(e){showAlert('ดาวน์โหลดไม่สำเร็จ: '+(e.message||e),'er')}
  };

/* แสดงแค่ 5 รายการล่าสุด */
var recentLimited = recent.slice(0,5);

html.push('<div style="'+CS+'">'+
  cardHead('เอกสารล่าสุด','เรียงตามแก้ไขล่าสุด — แสดง '+recentLimited.length+' รายการ')
);

if(!recentLimited.length){

  html.push(
    '<div style="flex:1;display:flex;align-items:center;justify-content:center;padding:32px;color:#a89e99;font-size:12px">'+
      'ยังไม่มีเอกสาร'+
    '</div>'
  );

} else {

  /* column headers */
  html.push(
    '<div style="display:grid;grid-template-columns:112px 1fr auto auto auto;gap:8px;padding:7px 18px;border-bottom:1px solid #F5F3F0;flex-shrink:0">'+
      ['เลขที่','ชื่อเอกสาร','สถานะ','',''].map(function(h){
        return '<div style="font-size:10px;font-weight:700;color:#c0bab4;text-transform:uppercase;letter-spacing:.5px">'+h+'</div>';
      }).join('')+
    '</div>'
  );

  /* rows */
  recentLimited.forEach(function(d,i){

    var fls = fmForScript[d.id] || [];
    var hasFls = fls.length > 0;
    var firstFile = hasFls ? fls[0] : null;

    html.push(

      '<div style="display:grid;grid-template-columns:112px 1fr auto auto auto;gap:8px;padding:10px 18px;align-items:center;cursor:default'+
      (i>0 ? ';border-top:1px solid #F9F8F7' : '')+
      '" onmouseover="this.style.background=\'#FDFBF9\'" onmouseout="this.style.background=\'\'">'+

        /* document number */
        '<div style="font-size:10px;font-family:\'IBM Plex Mono\',monospace;color:#a89e99;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+
          esc(d.doc_number || '—')+
        '</div>'+

        /* title */
        '<div style="font-size:12px;font-weight:600;color:#18120E;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+
          esc(d.title)+
        '</div>'+

        /* status */
        '<div style="flex-shrink:0">'+
          sBadge(d.status)+
        '</div>'+

        /* preview */
        (
          hasFls
          ? '<button data-action="openViewer" data-path="'+esc(firstFile.path)+'" data-name="'+esc(firstFile.name)+'" data-ext="'+esc((firstFile.name||'').split('.').pop().toLowerCase())+'" title="พรีวิวเอกสาร" '+
              'style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;border:1px solid #EBEBEB;background:#F5F3F0;color:#6b6560;cursor:pointer">'+
                svg('eye',12)+
            '</button>'
          : '<div style="width:28px"></div>'
        )+

        /* download */
        '<button onclick="_sdl(\''+d.id+'\')" title="'+
          (hasFls ? 'ดาวน์โหลดไฟล์ทั้งหมด' : 'ไม่มีไฟล์แนบ')+
          '" style="display:inline-flex;align-items:center;gap:4px;padding:4px 9px;border-radius:7px;border:1.5px solid '+
          (hasFls ? '#E83A00' : '#EBEBEB')+
          ';background:'+
          (hasFls ? '#fff5f0' : '#F9F9F9')+
          ';color:'+
          (hasFls ? '#E83A00' : '#c0bab4')+
          ';font-size:10px;font-weight:700;cursor:'+
          (hasFls ? 'pointer' : 'default')+
          ';white-space:nowrap">'+
            svg('dn',11)+
            (hasFls ? ' ดาวน์โหลด' : ' ไม่มีไฟล์')+
        '</button>'+

      '</div>'
    );

  });

}

html.push('</div>');
  /* ── ภาพรวมสถานะ ── */
  var statusRows=[
    {l:'รอลงนาม',     v:byStatus.pending,   c:'#F59E0B'},
    {l:'เสร็จสมบูรณ์', v:byStatus.completed, c:'#22C55E'},
    {l:'ลงนามแล้ว',   v:byStatus.signed,    c:'#3B82F6'},
    {l:'ส่งคืนแก้ไข', v:byStatus.rejected,  c:'#EF4444'},
    {l:'ร่างเอกสาร',  v:byStatus.draft,     c:'#C0BAB4'},
    {l:'ยกเลิกแล้ว',  v:byStatus.cancelled, c:'#E0DBD5'}
  ];
  html.push(
    '<div style="'+CS+'">'+
      cardHead('ภาพรวมสถานะ','',
        '<span style="font-size:18px;font-weight:900;color:#18120E">'+total+
        '<span style="font-size:10px;font-weight:500;color:#a89e99;margin-left:3px">รายการ</span></span>')+
      '<div style="padding:10px 18px 6px;display:flex;gap:2px;flex-shrink:0">'+
      statusRows.filter(function(r){return r.v>0}).map(function(r){
        return '<div style="flex:'+r.v+';height:7px;background:'+r.c+';border-radius:3px" title="'+r.l+'"></div>';
      }).join('')+
      '</div>'+
      '<div style="flex:1">'+
      statusRows.map(function(r){
        var pct=total?Math.round(r.v/total*100):0;
        return '<div style="display:flex;align-items:center;gap:8px;padding:10px 18px;border-top:1px solid #F9F8F7">'+
          '<div style="width:8px;height:8px;border-radius:2px;background:'+r.c+';flex-shrink:0"></div>'+
          '<div style="flex:1;font-size:12px;color:#6b6560">'+r.l+'</div>'+
          '<span style="font-size:12px;font-weight:700;color:#18120E">'+r.v+'</span>'+
          '<span style="font-size:10px;color:#a89e99;min-width:28px;text-align:right">'+pct+'%</span>'+
        '</div>';
      }).join('')+
      '</div>'+
      '<div style="padding:12px 18px;border-top:1px solid #F5F3F0;flex-shrink:0">'+
        '<button class="btn btn-primary fw sm" data-action="nav" data-view="docs">ดูเอกสารทั้งหมด →</button>'+
      '</div>'+
    '</div>'
  );

  html.push('</div>'); /* row 3 */

  /* ══ ROW 4 — สรุปโครงการประจำปี (ROLE-STF, ROLE-SYS, ROLE-DEV — dev ต้องทดสอบปุ่ม PDF รวมได้) ══ */
  if(!CU||!['ROLE-STF','ROLE-SYS','ROLE-DEV'].includes(CU.role_code)) return html.join('');

  var _nowCE=new Date().getFullYear();
  var _selYear=window._statYear||_nowCE;
  var _selThYear=_selYear+543;
  var _yearStart=_selYear+'-01-01T00:00:00';
  var _yearEnd=(_selYear+1)+'-01-01T00:00:00';

  // รวมเอกสารทั้งขาเข้า+ขาออกที่มีชื่อโครงการ (project_name) ในปีที่เลือก
  var _yrDocs=docs.filter(function(d){
    return d.project_name&&(d.created_at||'')>=_yearStart&&(d.created_at||'')<_yearEnd;
  });

  // จัดกลุ่มตาม project_name (ชื่อโครงการ)
  var _projMap={};
  _yrDocs.forEach(function(d){
    var key=(d.project_name||'').trim()||'(ไม่ระบุโครงการ)';
    if(!_projMap[key]) _projMap[key]={name:key,docs:[]};
    _projMap[key].docs.push(d);
  });
  var _projects=Object.keys(_projMap).map(function(k){return _projMap[k]}).sort(function(a,b){
    var aLast=a.docs.reduce(function(m,d){return d.created_at>m?d.created_at:m},'');
    var bLast=b.docs.reduce(function(m,d){return d.created_at>m?d.created_at:m},'');
    return bLast>aLast?1:-1;
  });

  // Year select options (ย้อนหลัง 4 ปี)
  var _yearOpts='';
  for(var _yi=0;_yi<4;_yi++){
    var _y=_nowCE-_yi;
    _yearOpts+='<option value="'+_y+'"'+(_y===_selYear?' selected':'')+'>พ.ศ. '+(_y+543)+'</option>';
  }

  html.push('<div style="margin-top:14px">');
  html.push('<div style="'+CS+'">');
  html.push(cardHead(
    'สรุปโครงการประจำปี',
    'เอกสารที่มีข้อมูลโครงการ (ขาเข้า+ขาออก) ปีพ.ศ. '+_selThYear,
    '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'+
      (_yrDocs.length>0?'<span style="font-size:11px;color:#a89e99">'+_yrDocs.length+' เอกสาร · '+_projects.length+' โครงการ</span>':'')+
      '<select onchange="window._statYear=+this.value;nav(\'stat\')" style="height:28px;padding:0 8px 0 10px;border-radius:8px;border:1.5px solid #EBEBEB;background:#fff;font-size:12px;cursor:pointer;color:#18120E;outline:none">'+_yearOpts+'</select>'+
      (_yrDocs.length>0?'<button id="stat-proj-dl-btn" onclick="_downloadStatProjPdf('+_selYear+')" title="รวมไฟล์ฉบับลงนามครบของทุกเอกสารที่เสร็จสิ้นในปีนี้ เป็น PDF ไฟล์เดียว" style="background:#E83A00;color:#fff;border:none;border-radius:9px;padding:5px 12px;font-size:11px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;box-shadow:0 2px 8px rgba(232,58,0,.3)">ดาวน์โหลดไฟล์ลงนาม (PDF รวม)</button>':'')+
    '</div>'
  ));

  if(!_projects.length){
    html.push('<div style="padding:40px 20px;text-align:center;color:#a89e99;font-size:12px">'+
      '<div style="margin-bottom:8px">'+svg('doc',32)+'</div>'+
      'ยังไม่มีโครงการในปีพ.ศ. '+_selThYear+
    '</div>');
  } else {
    // Header row
    html.push('<div style="display:grid;grid-template-columns:36px 1fr 64px 90px 96px;gap:8px;padding:7px 18px;border-bottom:1px solid #F5F3F0;flex-shrink:0">'+
      ['#','ชื่อโครงการ / กิจกรรม','เอกสาร','สถานะล่าสุด','วันที่'].map(function(h){
        return '<div style="font-size:9px;font-weight:700;color:#c0bab4;text-transform:uppercase;letter-spacing:.5px">'+h+'</div>';
      }).join('')+
    '</div>');

    _projects.forEach(function(proj,idx){
      var _lastDoc=proj.docs.reduce(function(a,b){return(a.created_at||'')>=(b.created_at||'')?a:b});
      var _doneCnt=proj.docs.filter(function(d){return d.status==='completed'}).length;
      var _latestDate=_lastDoc.created_at?new Date(_lastDoc.created_at).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit'}):'—';
      var _allDone=_doneCnt===proj.docs.length;
      html.push(
        '<div style="display:grid;grid-template-columns:36px 1fr 64px 90px 96px;gap:8px;padding:11px 18px;align-items:center;border-top:1px solid #F9F8F7" '+
        'onmouseover="this.style.background=\'#FDFBF9\'" onmouseout="this.style.background=\'\'">'+
        // ลำดับ
        '<div style="font-size:11px;font-weight:700;color:#a89e99;text-align:center">'+(idx+1)+'</div>'+
        // ชื่อโครงการ
        '<div style="overflow:hidden">'+
          '<div style="font-size:12.5px;font-weight:600;color:#18120E;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+esc(proj.name)+'">'+esc(proj.name)+'</div>'+
          (proj.docs.length>1?'<div style="font-size:10px;color:'+(_allDone?'#16A34A':'#a89e99')+';margin-top:1px">'+_doneCnt+'/'+proj.docs.length+' เสร็จสิ้น</div>':'')+
        '</div>'+
        // จำนวน
        '<div style="font-size:13px;font-weight:700;color:#18120E;text-align:center">'+proj.docs.length+'</div>'+
        // สถานะล่าสุด
        '<div>'+sBadge(_lastDoc.status)+'</div>'+
        // วันที่
        '<div style="font-size:11px;color:#a89e99;white-space:nowrap">'+_latestDate+'</div>'+
        '</div>'
      );
    });

    // Footer summary
    var _totalDone=_yrDocs.filter(function(d){return d.status==='completed'}).length;
    var _totalPct=_yrDocs.length?Math.round(_totalDone/_yrDocs.length*100):0;
    html.push('<div style="padding:12px 18px;border-top:1px solid #F5F3F0;background:#FAFAF8;display:flex;align-items:center;gap:12px;border-radius:0 0 16px 16px">'+
      '<div style="flex:1;background:#EBEBEB;border-radius:99px;height:6px;overflow:hidden">'+
        '<div style="height:100%;background:#16A34A;border-radius:99px;transform:scaleX('+(_totalPct/100)+');transform-origin:left;transition:transform .4s cubic-bezier(.4,0,.2,1)"></div>'+
      '</div>'+
      '<span style="font-size:11px;font-weight:700;color:#16A34A;white-space:nowrap">'+_totalDone+'/'+_yrDocs.length+' เสร็จสิ้น ('+_totalPct+'%)</span>'+
    '</div>');
  }

  html.push('</div>');
  html.push('</div>'); /* row 4 */

  return html.join('');
}

/* ── ดาวน์โหลด "ไฟล์ที่ลงนามครบแล้ว" ของโครงการทั้งปี รวมเป็น PDF ไฟล์เดียว ──
   ใช้ทั้งหน้าสถิติและการ์ดสรุปโครงการหน้าแรก (homeViews.js ส่ง btnId='proj-dl-btn')
   เดิมเป็น ZIP ของทุกไฟล์แนบทุกเวอร์ชัน (ไฟล์ร่าง ไฟล์ก่อนเซ็น ไฟล์ประกอบปนกันหมด)
   ตอนนี้เอาเฉพาะเอกสาร completed (= ทุกขั้นลงนามครบ) และเฉพาะไฟล์ฉบับลงนามล่าสุดของแต่ละเอกสาร
   (_isSignedFile + _fileGroups → ฉบับที่ปั๊มเลขหนังสือแล้ว) ต่อกันเรียงตามโครงการ → วันที่สร้าง
   หน้าแรกเป็นสารบัญ (ต้องใช้ฟอนต์ไทย — โหลดไม่ได้ก็ข้ามสารบัญ ไม่พิมพ์ไทยด้วยฟอนต์ละติน)
   ไฟล์ที่ย้ายไปคลังแล้ว (archive_url) ดึงจากเบราว์เซอร์ไม่ได้ (CSP + คลังต้องล็อกอิน)
   → ไม่รวม แต่ระบุรายชื่อไว้ในสารบัญและแจ้งจำนวนตอนจบ ไม่ข้ามเงียบ ๆ */
async function _downloadStatProjPdf(selYear,btnId){
  var btn=$e(btnId||'stat-proj-dl-btn');
  var _lbl=btn?btn.innerHTML:'';
  function _st(t){if(btn) btn.textContent=t;}
  if(btn) btn.disabled=true;
  _st('กำลังค้นหาไฟล์...');
  try{
    if(!window.PDFLib) await loadSc('https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js');
    var yearStart=selYear+'-01-01T00:00:00';
    var yearEnd=(selYear+1)+'-01-01T00:00:00';
    var raw=await dg('documents','?status=eq.completed&project_name=not.is.null&select=id,title,doc_number,project_name,created_at&order=created_at.asc');
    if(!Array.isArray(raw)) throw new Error('โหลดรายการเอกสารไม่สำเร็จ');
    var yearDocs=raw.filter(function(d){
      return (d.created_at||'')>=yearStart&&(d.created_at||'')<yearEnd;
    });
    if(!yearDocs.length){showAlert('ไม่พบเอกสารที่ลงนามครบแล้วในปีนี้','wa');return;}
    yearDocs.sort(function(a,b){
      var pa=(a.project_name||'').trim(),pb=(b.project_name||'').trim();
      return pa.localeCompare(pb,'th')||((a.created_at||'')<(b.created_at||'')?-1:1);
    });

    // ไฟล์ทั้งหมดของเอกสารปีนี้ — ดึงทีละ 40 เอกสาร (URL ไม่ยาวเกิน)
    var filesByDoc={};
    for(var c=0;c<yearDocs.length;c+=40){
      var ids=yearDocs.slice(c,c+40).map(function(d){return safeId(d.id)}).join(',');
      var fr=await dg('document_files','?document_id=in.('+ids+')&select=id,document_id,file_name,file_path,file_size,uploaded_at,version,archive_url');
      if(!Array.isArray(fr)) throw new Error('โหลดรายการไฟล์ไม่สำเร็จ');
      fr.forEach(function(f){(filesByDoc[f.document_id]=filesByDoc[f.document_id]||[]).push(f)});
    }

    var out=await PDFLib.PDFDocument.create();
    var merged=[],archived=[],failed=[],unsigned=0,pageCount=0;
    for(var i=0;i<yearDocs.length;i++){
      var doc=yearDocs[i];
      _st('กำลังรวม '+(i+1)+'/'+yearDocs.length+' เอกสาร...');
      var signed=(filesByDoc[doc.id]||[]).filter(function(f){
        return _isSignedFile(f)&&/\.pdf$/i.test(f.file_name||f.file_path||'');
      });
      if(!signed.length){unsigned++;continue;}
      var cur=_fileGroups(signed).cur;
      for(var j=0;j<cur.length;j++){
        var f=cur[j];
        var info={proj:(doc.project_name||'').trim()||'(ไม่ระบุโครงการ)',num:doc.doc_number||'',title:doc.title||'',file:_fileBaseName(f)};
        if(_isArchivedFile(f)){info.url=f.archive_url;archived.push(info);continue;}
        try{
          var resp=await fetch(await resolveFileUrl(f.file_path),{cache:'reload'});
          if(!resp.ok) throw new Error('HTTP '+resp.status);
          var src=await PDFLib.PDFDocument.load(new Uint8Array(await resp.arrayBuffer()),{ignoreEncryption:true});
          var pages=await out.copyPages(src,src.getPageIndices());
          pages.forEach(function(pg){out.addPage(pg)});
          info.start=pageCount+1;info.pages=pages.length;
          pageCount+=pages.length;
          merged.push(info);
        }catch(e){info.err=e.message||String(e);failed.push(info);}
      }
    }

    if(!merged.length){
      showAlert(archived.length
        ?'ไฟล์ลงนามทั้ง '+archived.length+' เอกสารของปีนี้ถูกย้ายไปคลัง '+_archiveProvider(archived[0].url)+' แล้ว จึงรวมจากระบบไม่ได้ — ดาวน์โหลดได้จากโฟลเดอร์ SaEDU-Archive/'+(selYear+543)+' ในคลัง'
        :failed.length?'โหลดไฟล์ลงนามไม่สำเร็จ ('+failed.length+' ไฟล์) กรุณาลองใหม่อีกครั้ง'
        :'ไม่พบไฟล์ที่ลงนามแล้วในเอกสารปีนี้','wa');
      return;
    }

    _st('กำลังสร้างสารบัญ...');
    var tocOk=await _statProjPdfToc(out,selYear,merged,archived,failed);

    _st('กำลังสร้าง PDF...');
    var bytes=await out.save();
    var a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
    a.download='ไฟล์ลงนาม_โครงการ_พ.ศ.'+(selYear+543)+'.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){URL.revokeObjectURL(a.href);},3000);

    var msg='ดาวน์โหลดสำเร็จ — รวมไฟล์ลงนาม '+merged.length+' เอกสาร ('+pageCount+' หน้า) เป็น PDF ไฟล์เดียว';
    if(archived.length) msg+=' · อีก '+archived.length+' เอกสารอยู่ในคลัง '+_archiveProvider(archived[0].url)+' จึงไม่ได้รวม'+(tocOk?' (รายชื่ออยู่ในหน้าสารบัญ)':'');
    if(failed.length) msg+=' · โหลดไม่สำเร็จ '+failed.length+' ไฟล์: '+failed.map(function(r){return r.num||r.title}).join(', ');
    if(unsigned) msg+=' · ไม่นับ '+unsigned+' เอกสารที่ไม่มีไฟล์ลงนาม';
    if(!tocOk) msg+=' · สร้างหน้าสารบัญไม่ได้ (โหลดฟอนต์ไทยไม่สำเร็จ)';
    showAlert(msg,(archived.length||failed.length||!tocOk)?'wa':'ok');
  }catch(e){
    showAlert('เกิดข้อผิดพลาด: '+(e.message||e),'er');
  }finally{
    if(btn){btn.disabled=false;btn.innerHTML=_lbl;}
  }
}

/* สารบัญหน้าแรกของ PDF รวม — คืน false ถ้าโหลดฟอนต์ไทยไม่ได้ (ไม่แทรกหน้าใด ๆ) */
async function _statProjPdfToc(out,selYear,merged,archived,failed){
  var font;
  try{
    if(!window.fontkit) await loadSc('https://unpkg.com/@pdf-lib/fontkit/dist/fontkit.umd.min.js');
    out.registerFontkit(window.fontkit);
    if(!window._thFontCache){
      window._thFontCache=await fetch('https://cdn.jsdelivr.net/gh/Phonbopit/sarabun-webfont@master/fonts/thsarabunnew-webfont.ttf').then(function(r){
        if(!r.ok) throw new Error('Font HTTP error'); return r.arrayBuffer();
      });
    }
    font=await out.embedFont(window._thFontCache.slice(0));
  }catch(e){console.warn('proj pdf: Thai font load failed, skipping TOC:',e.message);return false;}

  var W=595.28,Hh=841.89,M=50,LH=20,SZ=14;
  var dark=PDFLib.rgb(.09,.07,.05),muted=PDFLib.rgb(.45,.41,.38),brand=PDFLib.rgb(.91,.23,0);
  function fit(t,maxW,sz){
    t=String(t||'');
    if(font.widthOfTextAtSize(t,sz)<=maxW) return t;
    while(t.length>1&&font.widthOfTextAtSize(t+'…',sz)>maxW) t=t.slice(0,-1);
    return t+'…';
  }
  // แถว: {t:ข้อความ, sz, c:สี, ind:ย่อหน้า, pg:เลขหน้าชิดขวา}
  var rows=[];
  rows.push({t:'ไฟล์ที่ลงนามครบแล้ว — สรุปโครงการประจำปี พ.ศ. '+(selYear+543),sz:20,c:dark,gap:6});
  rows.push({t:'รวม '+merged.length+' เอกสาร · สร้างเมื่อ '+new Date().toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'}),sz:SZ,c:muted,gap:10});
  var lastProj=null;
  merged.forEach(function(r){
    if(r.proj!==lastProj){rows.push({t:r.proj,sz:15,c:brand,gapTop:6});lastProj=r.proj;}
    rows.push({t:(r.num?r.num+'  ':'')+r.title,sz:SZ,c:dark,ind:14,pg:r});
  });
  function listSection(head,list){
    if(!list.length) return;
    rows.push({t:head,sz:15,c:brand,gapTop:14});
    list.forEach(function(r){rows.push({t:(r.num?r.num+'  ':'')+r.title+'  ('+r.proj+')',sz:SZ,c:muted,ind:14})});
  }
  listSection('ไม่ได้รวมในไฟล์นี้ — อยู่ในคลัง'+(archived.length?' '+_archiveProvider(archived[0].url):'')+' ('+archived.length+' เอกสาร)',archived);
  listSection('ไม่ได้รวมในไฟล์นี้ — โหลดไฟล์ไม่สำเร็จ ('+failed.length+' เอกสาร)',failed);

  // แบ่งหน้าก่อน เพื่อรู้ว่าสารบัญกินกี่หน้า แล้วค่อยเลื่อนเลขหน้าของเอกสาร
  var pagesRows=[[]],y=Hh-M;
  rows.forEach(function(r){
    var h=(r.gapTop||0)+LH+(r.gap||0);
    if(y-h<M&&pagesRows[pagesRows.length-1].length){pagesRows.push([]);y=Hh-M;}
    pagesRows[pagesRows.length-1].push(r);y-=h;
  });
  var off=pagesRows.length;
  pagesRows.forEach(function(list,pi){
    var page=out.insertPage(pi,[W,Hh]);
    var yy=Hh-M;
    list.forEach(function(r){
      yy-=(r.gapTop||0)+LH;
      var x=M+(r.ind||0);
      var pgTxt=r.pg?'หน้า '+(r.pg.start+off):'';
      var pgW=pgTxt?font.widthOfTextAtSize(pgTxt,r.sz)+16:0;
      page.drawText(fit(r.t,W-M-x-pgW,r.sz),{x:x,y:yy,size:r.sz,font:font,color:r.c});
      if(pgTxt) page.drawText(pgTxt,{x:W-M-font.widthOfTextAtSize(pgTxt,r.sz),y:yy,size:r.sz,font:font,color:muted});
      yy-=(r.gap||0);
    });
  });
  return true;
}
