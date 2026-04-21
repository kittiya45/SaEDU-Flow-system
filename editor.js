/* ─── EDITOR ─── */
function openEditor(url,name,fileId,docId){
  PED.url=url; PED.name=name; PED.fid=fileId; PED.did=docId;
  PED.pdf=null; PED.pg=1; PED.total=1; PED.els=[]; PED.sel=null; PED.tool='sig'; PED.localFile=null;
  PED.isPDF=name.toLowerCase().endsWith('.pdf');
  var isDocx=/\.(docx|doc)$/i.test(name);
  var isImg=/\.(png|jpg|jpeg|gif|webp)$/i.test(name);
  PED.isDocx=isDocx;
if(!PED.isPDF&&!isImg&&!isDocx){alert('รองรับ PDF, DOCX และรูปภาพในโหมดแก้ไข');return}

  var sigColors=['#1C1C1E','#D32F2F','#1565C0','#1B5E20','#7B1FA2'];
  var txtColors=['#1C1C1E','#D32F2F','#1565C0','#1B5E20','#F57C00'];

  var html=[
    '<div class="mo mo-lg"><div class="modal modal-lg" style="height:96vh;max-height:96vh;display:flex;flex-direction:column;overflow:hidden">',
    '<div class="modal-head" style="flex-shrink:0">',
    '<div style="display:flex;align-items:center;gap:10px"><span style="color:var(--text-2)">'+svg('edit',20)+'</span>',
    '<div><div class="modal-title">แก้ไขเอกสาร</div><div style="font-size:11px;color:var(--text-3)">'+esc(name)+'</div></div></div>',
    '<div style="display:flex;gap:8px">',
    '<button class="btn btn-success sm" id="ped-save" data-action="pedSave">'+svg('save',13)+' บันทึก & อัปโหลด</button>',
    '<button class="btn btn-soft sm btn-icon" data-action="closeModal">'+svg('x',14)+'</button>',
    '</div></div>',
    // Toolbar
    '<div class="ped-toolbar" style="flex-shrink:0;flex-wrap:wrap;row-gap:6px">',
    // Tool buttons
    '<button class="btn btn-primary sm" id="pt-sig" data-action="pedTool" data-type="sig">'+svg('sign',13)+' ลายเซ็น</button>',
    '<button class="btn btn-soft sm" id="pt-txt" data-action="pedTool" data-type="txt">'+svg('edit',13)+' ข้อความ</button>',
    '<button class="btn btn-soft sm" id="pt-img" data-action="pedTool" data-type="img">'+svg('img2',13)+' รูปภาพ</button>',
    '<div style="width:1px;background:var(--border);height:24px;margin:0 2px"></div>',
    '<button class="btn btn-soft sm btn-icon" data-action="pedUndo" title="เลิกทำ">'+svg('undo',13)+'</button>',
    '<button class="btn btn-danger sm btn-icon" data-action="pedClear" title="ล้างทั้งหมดในหน้านี้">'+svg('trash',13)+'</button>',
    '<div style="width:1px;background:var(--border);height:24px;margin:0 2px"></div>',
    // Zoom controls
    '<button class="btn btn-soft sm btn-icon" data-action="pedZoom" data-dir="-1" title="ย่อ (-)">'+svg('zout',13)+'</button>',
    '<span id="ped-zoom-lbl" style="font-size:11px;color:var(--text-2);min-width:40px;text-align:center;font-weight:600">100%</span>',
    '<button class="btn btn-soft sm btn-icon" data-action="pedZoom" data-dir="1" title="ขยาย (+)">'+svg('zin',13)+'</button>',
    '<button class="btn btn-soft sm" data-action="pedZoomFit" style="font-size:11px;padding:5px 10px">พอดีหน้าจอ</button>',
    (PED.isPDF?
      '<div style="margin-left:auto;display:flex;align-items:center;gap:8px">'+
      svg('doc',12)+
      '<span id="ped-pgi" style="font-size:12px;color:var(--text-3)">กำลังโหลด...</span>'+
      '</div>':
      ''),
    '</div>',
    // Main area
    '<div class="ped-wrap" style="flex:1;overflow:hidden;min-height:0;display:flex">',
    '<div class="ped-canvas-area" id="ped-area">',
    '<div id="ped-load" style="text-align:center;padding:40px;color:var(--text-3)">',
    '<div class="sp sp-dark" style="width:36px;height:36px;border-width:3px;margin:0 auto 16px"></div>',
    '<div style="font-size:14px;font-weight:600;color:var(--text)">กำลังโหลดเอกสาร...</div>',
    '<p style="font-size:12px;margin-top:6px;color:var(--text-3)">'+esc(name)+'</p>',
    '<input type="file" id="ped-local" accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.gif,.webp" style="display:none">',
    '<div id="ped-load-fallback" style="display:none;margin-top:20px">',
    '<div class="al al-wa" style="text-align:left;margin-bottom:12px"><span class="al-icon">'+svg('warn',13)+'</span><span>โหลดอัตโนมัติไม่สำเร็จ กรุณาเลือกไฟล์จากเครื่อง</span></div>',
    '<button class="btn btn-primary" data-action="uploadLocal">'+svg('up',14)+(PED.isPDF?' เลือกไฟล์ PDF':PED.isDocx?' เลือกไฟล์ Word':' เลือกไฟล์รูปภาพ')+'</button>',
    '</div>',
    '</div></div>',
    // Sidebar
    '<div class="ped-sidebar">',
    // Sig panel
    '<div class="tool-sec" id="ps-sig">',
    '<div class="tool-head">ลายเซ็นอิเล็กทรอนิกส์</div>',
    '<div class="itabs"><button class="itab on" id="sigt-draw" data-action="sigTab" data-tab="draw">วาด</button><button class="itab" id="sigt-upload" data-action="sigTab" data-tab="upload">อัปโหลดรูป</button></div>',
    '<div id="sp-draw">',
    '<canvas id="sigc" class="sig-canvas" height="100" style="height:100px;width:100%"></canvas>',
    '<div style="display:flex;gap:7px;margin-top:8px">',
    '<button class="btn btn-soft sm fw" data-action="sigClear">ล้าง</button>',
    '<button class="btn btn-primary sm fw" data-action="pedAddSig">+ วางลายเซ็น</button>',
    '</div>',
    '<div style="margin-top:12px"><div class="fl" style="margin-bottom:6px">สีหมึก</div>',
    '<div style="display:flex;gap:6px;flex-wrap:wrap">',
    sigColors.map(function(c,i){return '<div class="csw'+(i===0?' on':'')+'" style="width:24px;height:24px;border-radius:50%;cursor:pointer;border:2px solid '+(i===0?'var(--text)':'transparent')+';background:'+c+'" data-action="sigColor" data-color="'+c+'"></div>'}).join(''),
    '</div>',
    '<div class="fl" style="margin:10px 0 6px">ขนาด</div>',
    '<input type="range" id="sig-sz" min="1" max="8" value="2" oninput="PED.sigSz=+this.value">',
    '</div></div>',
    '<div id="sp-upload" style="display:none">',
    '<div class="upload-zone" style="padding:16px">',
    '<div style="margin-bottom:4px">'+svg('sign',20)+'</div>',
    '<div style="font-size:12px;font-weight:600">อัปโหลดรูปลายเซ็น</div>',
    '<div style="font-size:10px;color:var(--text-3)">PNG โปร่งใสดีที่สุด</div>',
    '</div>',
    '<input type="file" id="sig-file" style="display:none" accept="image/*">',
    '<img id="sig-prev" style="display:none;width:100%;max-height:90px;object-fit:contain;border:1px solid var(--border);border-radius:6px;margin-top:8px">',
    '<button class="btn btn-primary sm fw" id="sig-place" style="display:none;margin-top:8px" data-action="pedAddSigImg">+ วางลายเซ็น</button>',
    '</div></div>',
    // Text panel
    '<div class="tool-sec" id="ps-txt" style="display:none">',
    '<div class="tool-head">เพิ่มข้อความ</div>',
    '<div class="fg"><label class="fl">ข้อความ</label><textarea id="txt-val" class="fi" rows="3" placeholder="พิมพ์ข้อความที่นี่..."></textarea></div>',
    '<div class="fg"><label class="fl">ฟอนต์</label>'+
    '<select class="fi" id="txt-font" style="font-size:12px" onchange="PED.txtFont=this.value">'+
    '<option value=\"ChulaCharasNew\" selected>ChulaCharasNew</option>'+
    '<option value=\"ChulaLongkorn\">ChulaLongkorn</option>'+
    '<option value=\"TH Sarabun PSK\">TH Sarabun PSK</option>'+
    '<option value=\"Sarabun\">Sarabun</option>'+
    '<option value=\"Tahoma\">Tahoma</option>'+
    '<option value=\"Arial\">Arial</option>'+
    '<option value=\"Times New Roman\">Times New Roman</option>'+
    '</select>'+
    '</div>',
    '<div style="display:grid;grid-template-columns:1fr auto;gap:8px;margin-bottom:12px">',
    '<div class="fg" style="margin-bottom:0"><label class="fl">ขนาด: <span id="txtsz-lbl">14px</span></label>'+
    '<input type="range" id="txt-sz" min="8" max="72" value="14" oninput="PED.txtSz=+this.value;$e(\'txtsz-lbl\').textContent=this.value+\'px\'">'+
    '</div>',
    '<div><div class="fl" style="margin-bottom:6px">สไตล์</div>'+
    '<div style="display:flex;gap:3px">'+
    '<button class="btn btn-soft xs btn-icon" id="txt-b" data-action="toggleTxtStyle" data-sty="bold" title="ตัวหนา">'+svg('bold',12)+'</button>'+
    '<button class="btn btn-soft xs btn-icon" id="txt-i" data-action="toggleTxtStyle" data-sty="italic" title="ตัวเอียง">'+svg('italic',12)+'</button>'+
    '<button class="btn btn-soft xs btn-icon" id="txt-u" data-action="toggleTxtStyle" data-sty="underline" title="ขีดเส้นใต้">'+svg('underline',12)+'</button>'+
    '</div></div>',
    '</div>',
    '<div class="fg"><div class="fl" style="margin-bottom:6px">สีข้อความ</div><div style="display:flex;gap:6px">',
    txtColors.map(function(clr,i){return '<div class="csw'+(i===0?' on':'')+'" style="width:24px;height:24px;border-radius:50%;cursor:pointer;border:2px solid '+(i===0?'var(--text)':'transparent')+';background:'+clr+'" data-action="txtColor" data-color="'+clr+'"></div>'}).join(''),
    '</div></div>',
    '<button class="btn btn-primary sm fw" data-action="pedAddTxt">'+svg('edit',12)+' วางข้อความในเอกสาร</button>',
    '</div>',
    // Img panel
    '<div class="tool-sec" id="ps-img" style="display:none">',
    '<div class="tool-head">แทรกรูปภาพ</div>',
    '<div class="upload-zone" style="padding:16px">',
    '<div style="margin-bottom:4px">'+svg('img2',20)+'</div>',
    '<div style="font-size:12px;font-weight:600">อัปโหลดรูปภาพ</div>',
    '</div>',
    '<input type="file" id="ins-img" style="display:none" accept="image/*">',
    '<img id="ins-prev" style="display:none;width:100%;max-height:90px;object-fit:contain;margin-top:8px">',
    '<button class="btn btn-primary sm fw" id="ins-btn" style="display:none;margin-top:8px" data-action="pedAddInsImg">+ วางรูป</button>',
    '</div>',
    // Tips
    '<div class="tool-sec">',
    '<div class="tool-head">วิธีใช้งาน</div>',
    '<div style="font-size:12px;color:var(--text-3);line-height:1.9">',
    '1. อัปโหลดไฟล์จากเครื่อง<br>',
    '2. วาดลายเซ็น หรือพิมพ์ข้อความ<br>',
    '3. กดปุ่ม "+ วาง..."<br>',
    '4. ลากเพื่อย้ายตำแหน่ง<br>',
    '5. กด <strong>บันทึก & อัปโหลด</strong>',
    '</div></div>',
    '</div></div></div></div>'
  ];
  $e('mwrap').innerHTML=html.join('');
  setTimeout(function(){initPED();pedAutoLoad()},200)
}

function pedTool(t){
  PED.tool=t;
  ['sig','txt','img'].forEach(function(k){
    var btn=$e('pt-'+k), panel=$e('ps-'+k);
    if(btn) btn.className='btn '+(k===t?'btn-primary':'btn-soft')+' sm';
    if(panel) panel.style.display=k===t?'block':'none'
  })
}

function sigTab(tab){
  $e('sigt-draw').className='itab'+(tab==='draw'?' on':'');
  $e('sigt-upload').className='itab'+(tab==='upload'?' on':'');
  $e('sp-draw').style.display=tab==='draw'?'block':'none';
  $e('sp-upload').style.display=tab==='upload'?'block':'none'
}

function pedSigColor(c){PED.sigColor=c}

var sigCtx=null;
function initPED(){
  var sc=$e('sigc');
  if(sc){
    sc.width=sc.offsetWidth||230;
    sigCtx=sc.getContext('2d');
    sc.onpointerdown=function(e){
      PED.drawing=true;
      var r=sc.getBoundingClientRect();
      sigCtx.beginPath();
      sigCtx.moveTo((e.clientX-r.left)*(sc.width/r.width),(e.clientY-r.top)*(sc.height/r.height))
    };
    sc.onpointermove=function(e){
      if(!PED.drawing)return;
      var r=sc.getBoundingClientRect();
      sigCtx.lineTo((e.clientX-r.left)*(sc.width/r.width),(e.clientY-r.top)*(sc.height/r.height));
      sigCtx.strokeStyle=PED.sigColor; sigCtx.lineWidth=PED.sigSz;
      sigCtx.lineCap='round'; sigCtx.lineJoin='round'; sigCtx.stroke()
    };
    sc.onpointerup=sc.onpointerleave=function(){PED.drawing=false}
  }
  var sf=$e('sig-file'); if(sf) sf.onchange=function(){pedLoadSigImg(sf)};
  var ii=$e('ins-img');
  if(ii){
    ii.onchange=function(){pedLoadInsImg(ii)};
    var uz=$e('ps-img').querySelector('.upload-zone');
    if(uz) uz.onclick=function(){ii.click()}
  }
  var pl=$e('ped-local'); if(pl) pl.onchange=function(){pedLoadLocal(pl)}
}

async function pedAutoLoad(){
  // Try to fetch file directly from Supabase public storage
  var url=PED.url;
  var ld=$e('ped-load'); if(!ld)return;
  try{
    var resp=await fetch(url,{method:'GET',mode:'cors'});
    if(!resp.ok) throw new Error('HTTP '+resp.status);
    var buf=await resp.arrayBuffer();
    if(PED.isDocx){
      if(!window.mammoth) await loadSc('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');
      var res3=await mammoth.convertToHtml({arrayBuffer:buf});
      ld.style.display='none';
      var area3=$e('ped-area'); if(!area3)return;
      var w3=document.createElement('div');w3.className='ped-page-wrap';w3.dataset.page=1;
      w3.style.cssText='width:'+Math.round(794*(PED.scale/1.4))+'px;min-height:600px;position:relative;background:#fff;padding:40px 60px;box-sizing:border-box;font-family:TH Sarabun PSK,Sarabun,sans-serif;font-size:14px';
      var cd3=document.createElement('div');cd3.innerHTML=res3.value;cd3.style.cssText='width:100%;outline:none';cd3.contentEditable='true';cd3.id='docx-content';
      var ly3=mkLayer(w3,1);ly3.style.pointerEvents='none';
      w3.appendChild(cd3);w3.appendChild(ly3);area3.appendChild(w3);
      PED.isDocxMode=true
    } else if(PED.isPDF){
      if(!window.pdfjsLib){
        await loadSc('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
        pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      }
      PED.pdf=await pdfjsLib.getDocument({data:buf.slice(0)}).promise;
      PED.total=PED.pdf.numPages;
      ld.style.display='none';
      renderPEDPage()
    } else {
      var blob=new Blob([buf],{type:'image/png'});
      var burl=URL.createObjectURL(blob);
      ld.style.display='none';
      var area=$e('ped-area'); if(!area)return;
      var wrap=document.createElement('div');
      wrap.className='ped-page-wrap'; wrap.dataset.page=1;
      var img=new Image(); img.onload=function(){
        wrap.style.cssText='width:'+Math.min(img.naturalWidth,860)+'px;position:relative;flex-shrink:0';
        var di=document.createElement('img');
        di.src=burl; di.style.cssText='width:100%;height:auto;display:block';
        var layer=mkLayer(wrap,1); wrap.appendChild(di); wrap.appendChild(layer); area.appendChild(wrap)
      }; img.src=burl
    }
  } catch(e){
    console.warn('Auto-load failed:',e.message);
    ld.innerHTML='';
    var fb=$e('ped-load-fallback'); if(fb){fb.style.display='block';ld.style.display='block'}
  }
}

function sigClear(){if($e('sigc')&&sigCtx)sigCtx.clearRect(0,0,$e('sigc').width,$e('sigc').height)}

function pedLoadSigImg(inp){
  var f=inp.files[0]; if(!f)return;
  var r=new FileReader(); r.onload=function(e){
    var p=$e('sig-prev'); if(p){p.src=e.target.result;p.style.display='block'}
    var b=$e('sig-place'); if(b)b.style.display='block';
    PED._sigSrc=e.target.result
  }; r.readAsDataURL(f)
}

function pedLoadInsImg(inp){
  var f=inp.files[0]; if(!f)return;
  var r=new FileReader(); r.onload=function(e){
    var p=$e('ins-prev'); if(p){p.src=e.target.result;p.style.display='block'}
    var b=$e('ins-btn'); if(b)b.style.display='block';
    PED._insSrc=e.target.result
  }; r.readAsDataURL(f)
}

async function pedLoadLocal(inp){
  var f=inp.files[0]; if(!f)return;
  PED.localFile=f;
  var ld=$e('ped-load');
  if(ld) ld.innerHTML='<div class="sp sp-dark" style="width:32px;height:32px;border-width:3px;margin:0 auto 16px"></div><p>กำลังโหลดเอกสาร...</p>';
  var buf=await f.arrayBuffer();
  if(PED.isDocx){
    if(!window.mammoth) await loadSc('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');
    try{
      var res2=await mammoth.convertToHtml({arrayBuffer:buf});
      if(ld) ld.style.display='none';
      var area2=$e('ped-area'); if(!area2)return;
      var w2=document.createElement('div');w2.className='ped-page-wrap';w2.dataset.page=1;
      w2.style.cssText='width:'+Math.round(794*PED.scale/1.4)+'px;min-height:600px;position:relative;background:#fff;padding:40px 60px;box-sizing:border-box;font-family:TH Sarabun PSK,Sarabun,sans-serif;font-size:14px';
      var cd2=document.createElement('div');cd2.innerHTML=res2.value;cd2.style.cssText='width:100%;outline:none';cd2.contentEditable='true';cd2.id='docx-content';
      var ly2=mkLayer(w2,1);ly2.style.pointerEvents='none';
      w2.appendChild(cd2);w2.appendChild(ly2);area2.appendChild(w2);
      PED.isDocxMode=true;PED.docxHtml=res2.value
    }catch(e){if(ld)ld.innerHTML='<p style="color:var(--er)">โหลด DOCX ไม่ได้: '+e.message+'</p>'}
  } else if(PED.isPDF){
    if(!window.pdfjsLib){
      await loadSc('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
      pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
    }
    try{
      PED.pdf=await pdfjsLib.getDocument({data:buf.slice(0)}).promise;
      PED.total=PED.pdf.numPages;
      if(ld) ld.style.display='none';
      renderPEDPage()
    } catch(e){if(ld)ld.innerHTML='<p style="color:var(--er)">โหลด PDF ไม่ได้: '+e.message+'</p>'}
  } else {
    var reader=new FileReader();
    reader.onload=function(ev){
      var img=new Image(); img.onload=function(){
        PED.imgEl=img; PED.total=1;
        if(ld) ld.style.display='none';
        var area=$e('ped-area'); if(!area)return;
        var wrap=document.createElement('div');
        wrap.id='ped-page-wrap'; wrap.className='ped-page-wrap';
        wrap.style.cssText='width:'+Math.min(img.naturalWidth,860)+'px;position:relative';
        var di=document.createElement('img');
        di.src=ev.target.result; di.style.cssText='width:100%;height:auto;display:block';
        var layer=mkLayer(wrap); wrap.appendChild(di); wrap.appendChild(layer); area.appendChild(wrap)
      }; img.src=ev.target.result
    }; reader.readAsDataURL(f)
  }
}

async function renderPEDPage(){
  // Render ALL pages stacked so user can scroll to any position
  var area=$e('ped-area'); if(!area||!PED.pdf)return;
  var pi=$e('ped-pgi'); if(pi) pi.textContent='ทั้งหมด '+PED.total+' หน้า';
  // Remove existing pages
  var existing=area.querySelectorAll('.ped-page-wrap');
  existing.forEach(function(el){el.remove()});
  // Render each page
  for(var pgNum=1;pgNum<=PED.total;pgNum++){
    var page=await PED.pdf.getPage(pgNum);
    var vp=page.getViewport({scale:PED.scale||1.4});
    var wrap=document.createElement('div');
    wrap.className='ped-page-wrap';
    wrap.dataset.page=pgNum;
    wrap.style.cssText='width:'+vp.width+'px;height:'+vp.height+'px;position:relative;flex-shrink:0';
    // Page number label
    var lbl=document.createElement('div');
    lbl.style.cssText='position:absolute;top:-22px;left:0;font-size:11px;color:#888;font-family:"Noto Sans Thai",sans-serif';
    lbl.textContent='หน้า '+pgNum+'/'+PED.total;
    var canvas=document.createElement('canvas');
    canvas.width=vp.width; canvas.height=vp.height;
    canvas.style.cssText='display:block;position:absolute;top:0;left:0';
    var layer=mkLayer(wrap,pgNum);
    layer.style.cssText='position:absolute;top:0;left:0;width:'+vp.width+'px;height:'+vp.height+'px;z-index:10';
    wrap.appendChild(lbl); wrap.appendChild(canvas); wrap.appendChild(layer);
    area.appendChild(wrap);
    await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;
    // Restore elements for this page
    PED.els.filter(function(el){return el.pg===pgNum}).forEach(function(el){placeEl(el,layer)})
  }
}

function mkLayer(wrap, pgNum){
  pgNum=pgNum||PED.pg;
  var layer=document.createElement('div');
  layer.className='ped-elements-layer';
  layer.dataset.page=pgNum;
  layer.style.cssText='position:absolute;top:0;left:0;width:100%;height:100%;z-index:10;cursor:crosshair';
  layer.onclick=function(e){
    if(e.target===layer){
      var r=layer.getBoundingClientRect();
      var x=e.clientX-r.left, y=e.clientY-r.top;
      PED.pg=pgNum; // set active page when clicking
      if(PED.tool==='txt'){var v=gv('txt-val');if(v.trim())pedPlaceTxt(x,y,layer,pgNum)}
    }
  };
  return layer
}

function pedPg(d){/* page nav disabled - all pages shown */}

function pedAddSig(){
  var sc=$e('sigc'); if(!sc)return;
  var layer=getActiveLayer();
  var el={id:Date.now(),type:'sig',pg:PED.pg,src:sc.toDataURL('image/png'),x:50,y:50,w:180,h:80};
  PED.els.push(el); if(layer)placeEl(el,layer)
}
function pedAddSigImg(){
  if(!PED._sigSrc)return;
  var layer=getActiveLayer();
  var el={id:Date.now(),type:'sig',pg:PED.pg,src:PED._sigSrc,x:50,y:50,w:180,h:80};
  PED.els.push(el); if(layer)placeEl(el,layer)
}
function pedAddInsImg(){
  if(!PED._insSrc)return;
  var layer=getActiveLayer();
  var el={id:Date.now(),type:'img',pg:PED.pg,src:PED._insSrc,x:50,y:50,w:200,h:150};
  PED.els.push(el); if(layer)placeEl(el,layer)
}
function pedAddTxt(){
  var v=$e('txt-val'); if(!v||!v.value.trim()){alert('กรุณาพิมพ์ข้อความก่อน');return}
  var layer=getActiveLayer(); if(layer)pedPlaceTxt(80,80,layer)
}
function pedPlaceTxt(x,y,layer,pgNum){
  var text=gv('txt-val')||'ข้อความ';
  var pg=pgNum||PED.pg;
  var font=gv('txt-font')||PED.txtFont||'Noto Sans Thai';
  var el={id:Date.now(),type:'txt',pg:pg,text:text,x:x,y:y,
    color:PED.txtColor,size:PED.txtSz,font:font,
    bold:PED.txtBold,italic:PED.txtItalic,underline:PED.txtUnder};
  PED.els.push(el); placeEl(el,layer)
}

function placeEl(el,layer){
  var div=document.createElement('div');
  div.className='ped-el'; div.dataset.id=el.id;
  div.style.cssText='left:'+el.x+'px;top:'+el.y+'px;position:absolute';
  var delBtn=document.createElement('button');
  delBtn.className='del'; delBtn.innerHTML=svg('x',13);
  delBtn.onclick=function(e){e.stopPropagation();PED.els=PED.els.filter(function(e2){return e2.id!==el.id});div.remove()};
  if(el.type==='txt'){
    var fFamily=el.font||'Noto Sans Thai';
    var fStyle=(el.italic?'italic ':'')+(el.bold?'bold ':'')+el.size+'px '+fFamily+',sans-serif';
    div.style.cssText+='color:'+el.color+';font-size:'+el.size+'px;font-family:'+fFamily+',sans-serif;'+
      (el.bold?'font-weight:700;':'')+
      (el.italic?'font-style:italic;':'')+
      (el.underline?'text-decoration:underline;':'')+
      'white-space:pre-wrap;cursor:move;padding:2px 4px;border:1px dashed transparent;min-width:40px';
    div.contentEditable='true'; div.textContent=el.text;
    div.oninput=function(){el.text=div.innerText};
    div.onfocus=function(){div.style.border='1px dashed var(--orange)'};
    div.onblur=function(){div.style.border='1px dashed transparent'}
  } else {
    var img=document.createElement('img');
    img.src=el.src; img.style.cssText='width:'+el.w+'px;height:'+el.h+'px;object-fit:contain;display:block;pointer-events:none';
    var rsz=document.createElement('div'); rsz.className='rsz';
    rsz.onpointerdown=function(e){e.stopPropagation();startRsz(e,img,el)};
    div.appendChild(img); div.appendChild(rsz)
  }
  div.appendChild(delBtn);
  makeDrag(div,el);
  div.onclick=function(e){e.stopPropagation();selEl(div)};
  layer.appendChild(div); selEl(div)
}

function selEl(div){if(PED.sel&&PED.sel!==div)PED.sel.classList.remove('sel');PED.sel=div;div.classList.add('sel')}
function makeDrag(div,el){
  var ox,oy,sx,sy,drag=false;
  div.onpointerdown=function(e){
    if(e.target.className==='del'||e.target.className==='rsz')return;
    e.preventDefault(); drag=true; ox=e.clientX; oy=e.clientY; sx=el.x; sy=el.y; div.setPointerCapture(e.pointerId)
  };
  div.onpointermove=function(e){if(!drag)return;el.x=sx+(e.clientX-ox);el.y=sy+(e.clientY-oy);div.style.left=el.x+'px';div.style.top=el.y+'px'};
  div.onpointerup=function(){drag=false}
}
function startRsz(e,img,el){
  e.preventDefault();var sx=e.clientX,sy=e.clientY,sw=el.w,sh=el.h;
  function mv(e){el.w=Math.max(40,sw+(e.clientX-sx));el.h=Math.max(20,sh+(e.clientY-sy));img.style.width=el.w+'px';img.style.height=el.h+'px'}
  function up(){document.onpointermove=null;document.onpointerup=null}
  document.onpointermove=mv; document.onpointerup=up
}
function getActiveLayer(){
  // Get layer of current active page, or first layer
  var layers=document.querySelectorAll('.ped-elements-layer');
  for(var i=0;i<layers.length;i++){
    if(+layers[i].dataset.page===PED.pg) return layers[i]
  }
  return layers[layers.length-1]||null
}

function pedUndo(){if(!PED.els.length)return;var last=PED.els.pop();var div=document.querySelector('[data-id="'+last.id+'"]');if(div)div.remove()}
function pedClear(){if(!confirm('ล้างทุกองค์ประกอบในหน้าที่ '+(PED.pg)+'?'))return;PED.els=PED.els.filter(function(el){return el.pg!==PED.pg});var layer=getActiveLayer();if(layer)layer.innerHTML=''}

async function pedSave(){
  var btn=$e('ped-save');
  if(btn){btn.disabled=true;btn.innerHTML='<span class="sp"></span> กำลังบันทึก...'}
  try{
    // DOCX mode - save as HTML blob (DOCX regeneration requires server-side)
    if(PED.isDocxMode){
      var cd=$e('docx-content');
      var htmlContent=cd?cd.innerHTML:'';
      var fullHtml='<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:"TH Sarabun PSK",Sarabun,sans-serif;font-size:14px;padding:40px 60px;} p{margin:0 0 8px;line-height:1.6}<\/style><\/head><body>'+htmlContent+'<\/body><\/html>';
      var safeName=PED.name.replace(/[^a-zA-Z0-9._-]/g,'_').replace(/\.(docx|doc)$/i,'.html');
      var path='edited_'+Date.now()+'_'+safeName;
      var blob=new Blob([fullHtml],{type:'text/html'});
      await upFile(path,blob);
      await dp('document_files',{document_id:PED.did,file_name:'[แก้ไข] '+PED.name.replace(/\.(docx|doc)$/i,'.html'),file_path:path,file_size:blob.size,file_type:'text/html',uploaded_by:CU.id,version:1});
      await dp('document_history',{document_id:PED.did,action:'แก้ไขและบันทึกเอกสาร Word: '+PED.name,performed_by:CU.id});
      $e('mwrap').innerHTML='';
      var a2=$e('dal');if(a2)a2.innerHTML=alrtH('ok','บันทึกเรียบร้อยแล้ว (HTML)');
      nav('det',PED.did); return
    }
    if(!window.PDFLib) await loadSc('https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js');
    var pdfBytes;
    if(PED.isPDF){
      var rawBuf=PED.localFile?await PED.localFile.arrayBuffer():await(await fetch(PED.url)).arrayBuffer();
      var pdfDoc=await PDFLib.PDFDocument.load(new Uint8Array(rawBuf),{ignoreEncryption:true});
      // Get dimensions from first page layer
      var layers=document.querySelectorAll('.ped-elements-layer');
      var layer=layers[0]||null;
      var wW=layer?layer.offsetWidth:800, wH=layer?layer.offsetHeight:1000;
      for(var i=0;i<PED.els.length;i++){
        var el=PED.els[i]; var pdfPg=pdfDoc.getPage(el.pg-1);
        var pw=pdfPg.getWidth(), ph=pdfPg.getHeight();
        // Get the actual layer for this element's page
        var elLayer=document.querySelector('.ped-elements-layer[data-page="'+el.pg+'"]');
        var elWW=elLayer?elLayer.offsetWidth:wW;
        var elWH=elLayer?elLayer.offsetHeight:wH;
        var sx=pw/elWW, sy=ph/elWH;
        if(el.type==='txt'){
          var stdFont=el.bold?PDFLib.StandardFonts.HelveticaBold:PDFLib.StandardFonts.Helvetica;
          var fnt=await pdfDoc.embedFont(stdFont);
          var rgb=PDFLib.rgb(parseInt(el.color.slice(1,3),16)/255,parseInt(el.color.slice(3,5),16)/255,parseInt(el.color.slice(5,7),16)/255);
          var lines=el.text.split('\n');
          lines.forEach(function(line,li){
            pdfPg.drawText(line,{x:el.x*sx,y:ph-(el.y+el.size*(li+1.2))*sy,size:el.size*0.75,font:fnt,color:rgb})
          })
        } else {
          try{
            var ib=await(await fetch(el.src)).arrayBuffer();
            var emb;try{emb=await pdfDoc.embedPng(ib)}catch(e2){emb=await pdfDoc.embedJpg(ib)}
            pdfPg.drawImage(emb,{x:el.x*sx,y:ph-(el.y+el.h*sy),width:el.w*sx,height:el.h*sy})
          }catch(e3){console.warn('embed img failed',e3)}
        }
      }
      pdfBytes=await pdfDoc.save()
    } else {
      var c2=document.createElement('canvas');
      var wrap2=document.querySelector('.ped-page-wrap[data-page="1"]')||document.querySelector('.ped-page-wrap');
      var di2=wrap2?wrap2.querySelector('img'):null;
      if(!di2){throw new Error('ไม่พบรูปภาพ')}
      c2.width=di2.naturalWidth; c2.height=di2.naturalHeight;
      var ctx2=c2.getContext('2d');
      ctx2.fillStyle='#fff'; ctx2.fillRect(0,0,c2.width,c2.height);
      ctx2.drawImage(di2,0,0,c2.width,c2.height);
      var wW2=wrap2.offsetWidth, sx2=c2.width/wW2, sy2=c2.height/wrap2.offsetHeight;
      for(var j=0;j<PED.els.length;j++){
        var e2=PED.els[j];
        if(e2.type==='txt'){
          ctx2.font=e2.size*sx2+'px '+(e2.font||'Noto Sans Thai')+',sans-serif'; ctx2.fillStyle=e2.color;
          e2.text.split('\n').forEach(function(line,li){ctx2.fillText(line,e2.x*sx2,(e2.y+e2.size*(li+1))*sy2)})
        } else {
          var im2=new Image(); im2.crossOrigin='anonymous';
          await new Promise(function(res){im2.onload=im2.onerror=res;im2.src=e2.src});
          ctx2.drawImage(im2,e2.x*sx2,e2.y*sy2,e2.w*sx2,e2.h*sy2)
        }
      }
      var blob2=await new Promise(function(res){c2.toBlob(res,'image/png')});
      pdfBytes=new Uint8Array(await blob2.arrayBuffer())
    }
    var safePedName=PED.name.replace(/[^a-zA-Z0-9._-]/g,'_');var path='edited_'+Date.now()+'_'+safePedName;
    var blob3=new Blob([pdfBytes],{type:PED.isPDF?'application/pdf':'image/png'});
    await upFile(path,blob3);
    await dp('document_files',{document_id:PED.did,file_name:'[แก้ไข] '+PED.name,file_path:path,file_size:blob3.size,file_type:PED.isPDF?'application/pdf':'image/png',uploaded_by:CU.id,version:1});
    await dp('document_history',{document_id:PED.did,action:'แก้ไขและบันทึกเอกสาร: '+PED.name,performed_by:CU.id});
    $e('mwrap').innerHTML='';
    var a=$e('dal'); if(a)a.innerHTML=alrtH('ok','บันทึกเอกสารที่แก้ไขเรียบร้อยแล้ว');
    nav('det',PED.did)
  } catch(e){
    alert('เกิดข้อผิดพลาด: '+e.message);
    if(btn){btn.disabled=false;btn.innerHTML=svg('save',13)+' บันทึก & อัปโหลด'}
  }
}

/* ─── ZOOM ─── */
function pedZoom(dir){
  var steps=[0.5,0.6,0.7,0.8,0.9,1.0,1.1,1.2,1.4,1.6,1.8,2.0,2.5,3.0];
  var cur=steps.indexOf(PED.scale);
  if(cur===-1) cur=steps.indexOf(1.4);
  var next=Math.max(0,Math.min(steps.length-1,cur+dir));
  PED.scale=steps[next];
  var lbl=$e('ped-zoom-lbl');
  if(lbl) lbl.textContent=Math.round(PED.scale*100/1.4*100)+'%';
  if(PED.isPDF) renderPEDPage();
  else applyImgZoom()
}
function pedZoomFit(){
  var area=$e('ped-area');
  if(!area)return;
  var aW=area.clientWidth-60;
  // Find current page width at scale 1.4
  if(PED.pdf){
    PED.pdf.getPage(1).then(function(p){
      var baseW=p.getViewport({scale:1.4}).width;
      PED.scale=Math.max(0.5,Math.min(3.0,(aW/baseW)*1.4));
      var lbl=$e('ped-zoom-lbl');
      if(lbl) lbl.textContent=Math.round(PED.scale*100/1.4*100)+'%';
      renderPEDPage()
    })
  } else {
    PED.scale=1.4;
    applyImgZoom()
  }
}
function applyImgZoom(){
  var wrap=document.querySelector('.ped-page-wrap[data-page="1"]');
  if(!wrap)return;
  var pct=Math.round(PED.scale/1.4*100)+'%';
  wrap.style.width=pct;
  var lbl=$e('ped-zoom-lbl');
  if(lbl) lbl.textContent=Math.round(PED.scale/1.4*100)+'%'
}
/* ─── FONT STYLE TOGGLE ─── */
function toggleTxtStyle(sty){
  if(sty==='bold') PED.txtBold=!PED.txtBold;
  else if(sty==='italic') PED.txtItalic=!PED.txtItalic;
  else if(sty==='underline') PED.txtUnder=!PED.txtUnder;
  var ids={bold:'txt-b',italic:'txt-i',underline:'txt-u'};
  var btn=$e(ids[sty]);
  if(btn) btn.className='btn '+(PED.txtBold&&sty==='bold'||PED.txtItalic&&sty==='italic'||PED.txtUnder&&sty==='underline'?'btn-primary':'btn-soft')+' xs btn-icon';
  PED.txtFont=gv('txt-font')||PED.txtFont
}



