/* ─── STATISTICS PAGE ─── */
// ปีที่เลือกสำหรับ annual summary (null = ปีปัจจุบัน)
if(typeof window._statYear==='undefined') window._statYear=null;

async function vStat(){
  var docs=await dg('documents','?select=id,status,doc_type,urgency,created_at,updated_at,due_date,title,doc_number,description,from_department&order=updated_at.desc,created_at.desc');
  var today=new Date().toISOString().substring(0,10);
  var total=docs.length;
  var byStatus={draft:0,pending:0,completed:0,rejected:0,signed:0};
  var byType={incoming:0,outgoing:0,certificate:0,memo:0};
  var byUrg={normal:0,urgent:0,very_urgent:0};
  var overdueCnt=0;
  docs.forEach(function(d){
    if(byStatus[d.status]!==undefined) byStatus[d.status]++;
    if(byType[d.doc_type]!==undefined) byType[d.doc_type]++;
    if(byUrg[d.urgency]!==undefined) byUrg[d.urgency]++;
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
      var _fr=await dg('document_files','?document_id=in.('+recentIds.join(',')+')'+'&select=id,document_id,file_name,file_path,version&order=version.desc,uploaded_at.desc');
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
    return '<div style="padding:15px 18px 11px;border-bottom:1px solid #F5F3F0;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">'+
      '<div><div style="font-size:13px;font-weight:700;color:#18120E">'+title+'</div>'+
      (sub?'<div style="font-size:10px;color:#a89e99;margin-top:2px">'+sub+'</div>':'')+
      '</div>'+(right||'')+'</div>';
  }

  var html=[];

  /* ══ ROW 1 — 4 stat tiles ══ */
  var statCards=[
    {label:'เอกสารทั้งหมด', val:total,              sub:'ร่าง '+byStatus.draft+' รายการ',
     ico:'doc_f',   grad:'linear-gradient(135deg,#1D4ED8 0%,#3B82F6 100%)', sh:'rgba(29,78,216,.30)'},
    {label:'รอลงนาม',       val:byStatus.pending,   sub:'รอการอนุมัติ',
     ico:'pen_f',   grad:'linear-gradient(135deg,#D97706 0%,#F59E0B 100%)', sh:'rgba(217,119,6,.30)'},
    {label:'เสร็จสิ้น',     val:byStatus.completed, sub:'ผ่านทุกขั้นตอน',
     ico:'check_f', grad:'linear-gradient(135deg,#15803D 0%,#22C55E 100%)', sh:'rgba(21,128,61,.30)'},
    {label:'เลยกำหนด',      val:overdueCnt,         sub:'ต้องเร่งดำเนินการ',
     ico:'warn_f',  grad:'linear-gradient(135deg,#7C3AED 0%,#A855F7 100%)', sh:'rgba(124,58,237,.30)'}
  ];
  html.push('<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:16px">');
  statCards.forEach(function(c){
    html.push(
      '<div style="border-radius:16px;padding:16px 18px;background:'+c.grad+
        ';position:relative;overflow:hidden;box-shadow:0 4px 16px '+c.sh+
        ';transition:transform .18s,box-shadow .18s;cursor:default" '+
      'onmouseover="this.style.transform=\'translateY(-3px)\';this.style.boxShadow=\'0 10px 28px '+c.sh+'\'" '+
      'onmouseout="this.style.transform=\'\';this.style.boxShadow=\'0 4px 16px '+c.sh+'\'">'+
        '<div style="position:absolute;right:-16px;bottom:-16px;width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,.1);pointer-events:none"></div>'+
        '<div style="position:absolute;right:20px;top:-20px;width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,.07);pointer-events:none"></div>'+
        '<div style="position:relative;z-index:1">'+
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">'+
            '<div style="font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:rgba(255,255,255,.7)">'+c.label+'</div>'+
            '<div style="width:32px;height:32px;border-radius:10px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;color:#fff">'+svgf(c.ico,16)+'</div>'+
          '</div>'+
          '<div style="font-size:32px;font-weight:900;color:#fff;line-height:1;letter-spacing:-1.5px;margin-bottom:5px">'+c.val+'</div>'+
          '<div style="font-size:10px;color:rgba(255,255,255,.6)">'+c.sub+'</div>'+
        '</div>'+
      '</div>'
    );
  });
  html.push('</div>');

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
    {l:'หนังสือขาเข้า', v:byType.incoming,    c:'#E83A00'},
    {l:'หนังสือขาออก',  v:byType.outgoing,    c:'#F59E0B'},
    {l:'หนังสือรับรอง', v:byType.certificate, c:'#3B82F6'},
    {l:'บันทึกข้อความ', v:byType.memo,        c:'#22C55E'}
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
    {l:'ปกติ',    v:byUrg.normal,      dot:'#15803D'},
    {l:'เร่งด่วน', v:byUrg.urgent,     dot:'#B45309'},
    {l:'ด่วนมาก', v:byUrg.very_urgent, dot:'#DC2626'}
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
      return {url:furl(f.file_path),name:f.file_name};
    });
  });
  /* set directly on window — script tags injected via innerHTML do not execute */
  window._sfm=fmForScript;
  window._sdl=function(docId){
    var fs=window._sfm[docId]||[];
    if(!fs.length){showAlert('ไม่มีไฟล์แนบในเอกสารนี้','wa');return;}
    var f=fs[0];
    var a=document.createElement('a');
    a.href=f.url;a.download=f.name||'file';a.target='_blank';
    document.body.appendChild(a);a.click();document.body.removeChild(a);
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
          ? '<button data-action="openViewer" data-url="'+firstFile.url+'" data-name="'+esc(firstFile.name)+'" title="พรีวิวเอกสาร" '+
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
    {l:'เสร็จสิ้น',   v:byStatus.completed, c:'#22C55E'},
    {l:'ลงนามแล้ว',   v:byStatus.signed,    c:'#3B82F6'},
    {l:'ส่งคืนแก้ไข', v:byStatus.rejected,  c:'#EF4444'},
    {l:'ร่างเอกสาร',  v:byStatus.draft,     c:'#C0BAB4'}
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

  /* ══ ROW 4 — สรุปโครงการประจำปี ══ */
  var _nowCE=new Date().getFullYear();
  var _selYear=window._statYear||_nowCE;
  var _selThYear=_selYear+543;
  var _yearStart=_selYear+'-01-01T00:00:00';
  var _yearEnd=(_selYear+1)+'-01-01T00:00:00';

  // กรองเฉพาะ outgoing docs ในปีที่เลือก
  var _yrDocs=docs.filter(function(d){
    return d.doc_type==='outgoing'&&(d.created_at||'')>=_yearStart&&(d.created_at||'')<_yearEnd;
  });

  // จัดกลุ่มตาม description (ชื่อโครงการ)
  var _projMap={};
  _yrDocs.forEach(function(d){
    var key=(d.description||'').trim()||'(ไม่ระบุโครงการ)';
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
    'หนังสือขาออกทั้งหมด ปีพ.ศ. '+_selThYear,
    '<div style="display:flex;align-items:center;gap:8px">'+
      '<span style="font-size:11px;color:#a89e99">'+_yrDocs.length+' เอกสาร · '+_projects.length+' โครงการ</span>'+
      '<select onchange="window._statYear=+this.value;nav(\'stat\')" style="height:28px;padding:0 8px 0 10px;border-radius:8px;border:1.5px solid #EBEBEB;background:#fff;font-size:12px;cursor:pointer;color:#18120E;outline:none">'+_yearOpts+'</select>'+
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
