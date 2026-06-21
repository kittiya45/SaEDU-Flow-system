/* ─── UTILS ─── */
async function dlFile(url,name){
  try{
    var r=await fetch(url);
    if(!r.ok) throw new Error('HTTP '+r.status);
    var blob=await r.blob();
    var a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=name||'download';
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){URL.revokeObjectURL(a.href);document.body.removeChild(a);},200);
  }catch(e){window.open(url,'_blank');}
}
function fd(d){
  if(!d)return'—';
  return new Date(d).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit'})
}
function fsz(b){
  if(!b)return'';
  if(b<1024)return b+'B';
  if(b<1048576)return(b/1024).toFixed(1)+'KB';
  return(b/1048576).toFixed(1)+'MB'
}
function ini(n){return(n||'').split(' ').map(function(w){return w[0]||''}).join('').slice(0,2).toUpperCase()||'??'}
function esc(s){return(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function _lcr(){if(window.lucide)window.lucide.createIcons()}
function rdr(h){document.getElementById('app').innerHTML=h;_lcr()}
function gv(id){var el=document.getElementById(id);return el?el.value:''}
function $e(id){return document.getElementById(id)}
/* ผูก drag & drop ให้ .upload-zone — เดิมรับไฟล์ได้แค่คลิกเลือกผ่าน <label for=inputId>
   onFiles รับ element ที่มี .files เหมือน <input type=file> จริง เพื่อให้ใช้ handler เดิมได้โดยไม่ต้องแก้ */
function _wireDropzone(zoneEl,inputEl,onFiles){
  if(!zoneEl||!inputEl) return;
  zoneEl.addEventListener('dragover',function(e){e.preventDefault();zoneEl.classList.add('dragover')});
  zoneEl.addEventListener('dragleave',function(){zoneEl.classList.remove('dragover')});
  zoneEl.addEventListener('drop',function(e){
    e.preventDefault();
    zoneEl.classList.remove('dragover');
    if(e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files.length){
      inputEl.files=e.dataTransfer.files;
      onFiles(inputEl);
    }
  });
}
function alrtH(t,m){
  var ic={ok:svg('ok',13),er:svg('x',13),in:svg('info',13),wa:svg('warn',13)};
  return '<div class="al al-'+t+'"><span class="al-icon">'+ic[t]+'</span><span>'+esc(m)+'</span></div>'
}

/* ─── PASSWORD HASHING (PBKDF2 + salt via Web Crypto API) ─── */
async function hashPw(pw){
  var salt=crypto.getRandomValues(new Uint8Array(16));
  var saltHex=Array.from(salt).map(function(b){return b.toString(16).padStart(2,'0')}).join('');
  var key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pw),'PBKDF2',false,['deriveBits']);
  var bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:salt,iterations:100000},key,256);
  var hashHex=Array.from(new Uint8Array(bits)).map(function(b){return b.toString(16).padStart(2,'0')}).join('');
  return 'pbkdf2$'+saltHex+'$'+hashHex
}
async function _verifyPbkdf2(pw,stored){
  var parts=stored.split('$');
  if(parts.length!==3||parts[0]!=='pbkdf2') return false;
  var salt=new Uint8Array(parts[1].match(/.{2}/g).map(function(b){return parseInt(b,16)}));
  var key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pw),'PBKDF2',false,['deriveBits']);
  var bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:salt,iterations:100000},key,256);
  var hashHex=Array.from(new Uint8Array(bits)).map(function(b){return b.toString(16).padStart(2,'0')}).join('');
  return hashHex===parts[2]
}
async function _hashSha256(pw){
  var buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(pw));
  return Array.from(new Uint8Array(buf)).map(function(b){return b.toString(16).padStart(2,'0')}).join('')
}
// ตรวจสอบรหัสผ่าน: รองรับ PBKDF2 ใหม่ และ SHA-256 legacy (auto-upgrade ตอน login)
async function checkPw(input,stored){
  if(!stored||!input) return false;
  if(stored.startsWith('pbkdf2$')) return _verifyPbkdf2(input,stored);
  if(/^[0-9a-f]{64}$/.test(stored)) return (await _hashSha256(input))===stored; // SHA-256 legacy
  return false // plaintext ไม่รองรับแล้ว
}
function sBadge(s){
  var cls={draft:'b-draft',pending:'b-pending',signed:'b-signed',rejected:'b-rejected',numbering:'b-advisor',completed:'b-completed'};
  var txt={draft:'ร่างเอกสาร',pending:'รอลงนาม',signed:'ลงนามแล้ว',rejected:'ส่งคืนแก้ไข',numbering:'รอออกเลขหนังสือ',completed:'เสร็จสิ้น'};
  return '<span class="badge '+( cls[s]||'b-draft')+'"><span class="bdot"></span>'+esc(txt[s]||s)+'</span>'
}
function tBadge(t){
  var cls={incoming:'b-draft',outgoing:'b-signed',certificate:'b-advisor',memo:'b-staff'};
  var lbl={incoming:'ขาเข้า',outgoing:'ขาออก',certificate:'หนังสือรับรอง',memo:'บันทึกข้อความ'};
  return '<span class="badge '+(cls[t]||'b-draft')+'">'+esc(lbl[t]||t)+'</span>'
}
function urgCls(u){if(u==='urgent')return'urg-urgent';if(u==='very_urgent')return'urg-vurgent';return'urg-normal'}

function svg(n,s){
  s=s||16;
  var M={
    home:'home',doc:'file-text',plus:'circle-plus',
    users:'users',user:'user',sign:'pen-line',
    up:'upload',dn:'download',edit:'pencil',
    trash:'trash-2',ok:'check',x:'x',
    back:'arrow-left',eye:'eye',srch:'search',
    out:'log-out',save:'save',bell:'bell',
    img2:'image',undo:'undo-2',zin:'zoom-in',
    zout:'zoom-out',bold:'bold',italic:'italic',
    underline:'underline',word_ico:'file-text',pdf_ico:'file',
    lock:'lock',unlock:'unlock',key:'key-round',
    shield:'shield',cal:'calendar',chart:'bar-chart-2',
    warn:'alert-triangle',info:'info',folder:'folder',
    refresh:'refresh-cw',pen:'pen',dots:'more-horizontal',
    gear:'settings',clock:'clock',tri:'chevron-right',
    tasks:'clipboard-list',inbox:'inbox'
  };
  var ln=M[n]||n;
  return '<i data-lucide="'+ln+'" width="'+s+'" height="'+s+'" stroke-width="1.6" style="display:inline-flex;vertical-align:middle;flex-shrink:0;pointer-events:none"></i>'
}

/* solid/filled icon variants — used for stat-card icons on coloured backgrounds */
function svgf(n,s){
  s=s||18;
  var P={
    /* document stack */
    doc_f:'<path fill="currentColor" d="M3 2a1 1 0 011-1h6l4 4v9a1 1 0 01-1 1H4a1 1 0 01-1-1V2z"/>'
         +'<path fill="rgba(0,0,0,.25)" d="M10 1l4 4h-3a1 1 0 01-1-1V1z"/>'
         +'<rect fill="rgba(255,255,255,.55)" x="5" y="8" width="6" height="1.2" rx=".6"/>'
         +'<rect fill="rgba(255,255,255,.4)" x="5" y="10.5" width="4" height="1.2" rx=".6"/>',
    /* pen / signature */
    pen_f:'<path fill="currentColor" d="M11.7 1.3a1 1 0 011.4 0l1.6 1.6a1 1 0 010 1.4L5.5 13.5 2 14l.5-3.5L11.7 1.3z"/>'
         +'<path fill="rgba(255,255,255,.4)" d="M10.5 3l2.5 2.5-1 1L9.5 4l1-1z"/>'
         +'<path fill="rgba(255,255,255,.25)" d="M2 14l1.5-1 .5.5-1.5 1L2 14z"/>',
    /* filled checkmark circle — circle is white (currentColor), tick is dark so it's visible */
    check_f:'<circle fill="currentColor" cx="8" cy="8" r="6.8"/>'
            +'<path fill="none" stroke="rgba(0,0,0,.38)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="M4.8 8.2L7.3 10.7L11.8 5.5"/>'
            +'<path fill="none" stroke="rgba(0,0,0,.12)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="M4.8 8.8L7.3 11.3L11.8 6.1"/>',
    /* filled bell */
    bell_f:'<path fill="currentColor" d="M8 1a1 1 0 011 1 5 5 0 015 4.5v3l1.5 2.5h-13L4 9.5v-3A5 5 0 017 2a1 1 0 011-1z"/>'
          +'<path fill="currentColor" d="M6.5 13.5a1.5 1.5 0 003 0H6.5z"/>'
          +'<ellipse fill="rgba(255,255,255,.3)" cx="6" cy="6" rx="1.5" ry="1"/>',
    /* filled warning triangle */
    warn_f:'<path fill="currentColor" d="M7.13 1.64a1 1 0 011.74 0l6.13 10.5A1 1 0 0114.13 14H1.87a1 1 0 01-.87-1.5l6.13-10.86z"/>'
          +'<rect fill="rgba(255,255,255,.9)" x="7.4" y="5.5" width="1.2" height="4.5" rx=".6"/>'
          +'<circle fill="rgba(255,255,255,.9)" cx="8" cy="11.5" r=".8"/>',
    /* filled clipboard / tasks */
    clip_f:'<path fill="currentColor" d="M4 3a1 1 0 00-1 1v9a1 1 0 001 1h8a1 1 0 001-1V4a1 1 0 00-1-1H9.5A1.5 1.5 0 008 1.5 1.5 1.5 0 006.5 3H4z"/>'
          +'<rect fill="rgba(255,255,255,.55)" x="5" y="6.5" width="6" height="1.1" rx=".55"/>'
          +'<rect fill="rgba(255,255,255,.4)" x="5" y="8.8" width="4.5" height="1.1" rx=".55"/>'
          +'<rect fill="rgba(255,255,255,.3)" x="5" y="11" width="3" height="1.1" rx=".55"/>',
    /* filled calendar */
    cal_f:'<rect fill="currentColor" x="2" y="4" width="12" height="10" rx="2"/>'
         +'<rect fill="rgba(255,255,255,.25)" x="2" y="7" width="12" height="1.2"/>'
         +'<path fill="rgba(255,255,255,.7)" d="M5 2.5a.5.5 0 011 0V5H5V2.5zm5 0a.5.5 0 011 0V5h-1V2.5z"/>'
         +'<circle fill="rgba(255,255,255,.6)" cx="5.5" cy="9.5" r=".9"/>'
         +'<circle fill="rgba(255,255,255,.6)" cx="8" cy="9.5" r=".9"/>'
         +'<circle fill="rgba(255,255,255,.6)" cx="10.5" cy="9.5" r=".9"/>'
         +'<circle fill="rgba(255,255,255,.45)" cx="5.5" cy="12" r=".9"/>'
         +'<circle fill="rgba(255,255,255,.45)" cx="8" cy="12" r=".9"/>',
    /* filled users / people */
    users_f:'<circle fill="currentColor" cx="5.5" cy="5" r="2.8"/>'
           +'<path fill="currentColor" d="M0 14c0-3.3 2.5-5.5 5.5-5.5S11 10.7 11 14H0z"/>'
           +'<circle fill="rgba(255,255,255,.45)" cx="11.5" cy="5.5" r="2.2"/>'
           +'<path fill="rgba(255,255,255,.35)" d="M8 14c0-2.5 1.6-4.2 3.5-4.8a5 5 0 013.5 4.8H8z"/>'
  };
  return '<svg width="'+s+'" height="'+s+'" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">'+(P[n]||'')+'</svg>'
}

function loadSc(src){
  return new Promise(function(res,rej){var s=document.createElement('script');s.src=src;s.onload=res;s.onerror=rej;document.head.appendChild(s)})
}
function debounce(fn,ms){var t=null;return function(){var args=arguments;clearTimeout(t);t=setTimeout(function(){fn.apply(null,args)},ms)}}

/* ─── addWorkingDays: บวกวันทำการ (ข้ามเสาร์-อาทิตย์) ─── */
function addWorkingDays(fromDate, days){
  var d=new Date(fromDate); var added=0;
  while(added<days){
    d.setDate(d.getDate()+1);
    var dow=d.getDay();
    if(dow!==0&&dow!==6) added++; // 0=อาทิตย์, 6=เสาร์
  }
  return d;
}
/* คำนวณจำนวนวันทำการที่เหลือจากวันนี้ถึง targetDate */
function workingDaysLeft(targetDate){
  var now=new Date(); now.setHours(0,0,0,0);
  var end=new Date(targetDate); end.setHours(0,0,0,0);
  if(end<=now) return 0;
  var count=0; var cur=new Date(now);
  while(cur<end){cur.setDate(cur.getDate()+1);var d=cur.getDay();if(d!==0&&d!==6)count++;}
  return count;
}

/* ─── fdTime: แสดงวันที่ + เวลา HH:MM (ใช้ใน history log) ─── */
function fdTime(d){
  if(!d) return '—';
  var dt=new Date(d);
  var dateStr=dt.toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit'});
  var timeStr=dt.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
  return dateStr+' '+timeStr;
}

/* ─── showConfirm: แทน browser confirm() ด้วย modal ของระบบ ─── */
// opts: { confirmLabel, confirmClass, cancelLabel, icon, detail }
function showConfirm(title, msg, onConfirm, opts){
  opts=opts||{};
  var mw=$e('mwrap'); if(!mw) return;
  var icon=opts.icon||'warn';
  var iconBg=opts.iconBg||'#FEF3C7';
  var iconColor=opts.iconColor||'#D97706';
  var confirmLabel=opts.confirmLabel||'ยืนยัน';
  var confirmClass=opts.confirmClass||'btn-danger';
  var cancelLabel=opts.cancelLabel||'ยกเลิก';
  var detail=opts.detail?'<div class="text-xs text-[#a89e99] mt-1.5 leading-relaxed">'+esc(opts.detail)+'</div>':'';
  var cbId='_sc_'+Date.now();
  // ฝัง callback ลง window ชั่วคราว
  window[cbId]=function(){
    delete window[cbId];
    mw.innerHTML='';
    onConfirm();
  };
  mw.innerHTML=
    '<div class="mo">'+
    '<div class="modal" style="max-width:400px">'+
      '<div class="modal-body" style="padding:28px 24px 20px;text-align:center">'+
        '<div style="width:52px;height:52px;border-radius:14px;background:'+iconBg+';display:flex;align-items:center;justify-content:center;margin:0 auto 16px;color:'+iconColor+'">'+svg(icon,24)+'</div>'+
        '<div style="font-size:16px;font-weight:800;color:#18120E;margin-bottom:8px">'+esc(title)+'</div>'+
        '<div style="font-size:13.5px;color:#6b6560;line-height:1.65">'+esc(msg)+'</div>'+
        detail+
      '</div>'+
      '<div class="modal-foot" style="justify-content:center;gap:10px">'+
        '<button class="btn btn-soft" data-action="closeModal">'+esc(cancelLabel)+'</button>'+
        '<button class="btn '+confirmClass+'" onclick="window[\''+cbId+'\']()">'+esc(confirmLabel)+'</button>'+
      '</div>'+
    '</div></div>';
  _lcr();
}

/* ─── showAlert: แทน browser alert() ด้วย modal ของระบบ ─── */
function showAlert(msg, type){
  type=type||'er';
  var mw=$e('mwrap'); if(!mw) { alert(msg); return; }
  var iconMap={ok:'ok',er:'x',wa:'warn',in:'info'};
  var titleMap={ok:'สำเร็จ',er:'เกิดข้อผิดพลาด',wa:'คำเตือน',in:'ข้อมูล'};
  var bgMap={ok:'#ECFDF5',er:'#FEF2F2',wa:'#FFFBEB',in:'#EFF6FF'};
  var clrMap={ok:'#16A34A',er:'#DC2626',wa:'#D97706',in:'#2563EB'};
  mw.innerHTML=
    '<div class="mo">'+
    '<div class="modal" style="max-width:380px">'+
      '<div class="modal-body" style="padding:28px 24px 20px;text-align:center">'+
        '<div style="width:52px;height:52px;border-radius:14px;background:'+bgMap[type]+';display:flex;align-items:center;justify-content:center;margin:0 auto 16px;color:'+clrMap[type]+'">'+svg(iconMap[type]||'info',24)+'</div>'+
        '<div style="font-size:14px;color:#6b6560;line-height:1.65">'+esc(msg)+'</div>'+
      '</div>'+
      '<div class="modal-foot" style="justify-content:center">'+
        '<button class="btn btn-primary" data-action="closeModal">ตกลง</button>'+
      '</div>'+
    '</div></div>';
  _lcr();
}

/* ─── auto-init Lucide icons on any DOM mutation inside #app ─── */
;(function(){
  if(!window.MutationObserver) return;
  var _lt=null;
  var _lo=new MutationObserver(function(muts){
    var need=muts.some(function(m){
      return Array.from(m.addedNodes).some(function(n){
        return n.nodeType===1&&(n.dataset&&n.dataset.lucide||(n.querySelector&&n.querySelector('[data-lucide]')));
      });
    });
    if(!need) return;
    clearTimeout(_lt);
    _lt=setTimeout(function(){if(window.lucide)window.lucide.createIcons();},0);
  });
  _lo.observe(document.body||document.documentElement,{childList:true,subtree:true});
})();
