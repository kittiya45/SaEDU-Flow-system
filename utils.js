/* ─── UTILS ─── */
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
function rdr(h){document.getElementById('app').innerHTML=h}
function gv(id){var el=document.getElementById(id);return el?el.value:''}
function $e(id){return document.getElementById(id)}
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
// ตรวจสอบรหัสผ่าน: รองรับ PBKDF2 ใหม่, SHA-256 เดิม, และ plaintext legacy
async function checkPw(input,stored){
  if(!stored||!input) return false;
  if(stored.startsWith('pbkdf2$')) return _verifyPbkdf2(input,stored);
  if(/^[0-9a-f]{64}$/.test(stored)) return (await _hashSha256(input))===stored; // SHA-256 legacy
  return input===stored // plaintext legacy
}
function sBadge(s){
  var cls={draft:'b-draft',pending:'b-pending',signed:'b-signed',rejected:'b-rejected',completed:'b-completed'};
  var txt={draft:'ร่างเอกสาร',pending:'รอลงนาม',signed:'ลงนามแล้ว',rejected:'ส่งคืนแก้ไข',completed:'เสร็จสิ้น'};
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
  var P={
    home:'<path d="M2 8L8 2l6 6v8h-4v-5H6v5H2V8z"/>',
    doc:'<path d="M4 2h7l4 4v11H4V2z"/><path d="M11 2v4h4"/><line x1="7" y1="9" x2="11" y2="9"/><line x1="7" y1="12" x2="11" y2="12"/>',
    plus:'<circle cx="8" cy="8" r="6"/><line x1="8" y1="5" x2="8" y2="11"/><line x1="5" y1="8" x2="11" y2="8"/>',
    users:'<circle cx="5.5" cy="5" r="2.5"/><path d="M1 14.5c0-2.8 2-4.5 4.5-4.5"/><circle cx="11.5" cy="5" r="2.5"/><path d="M9 14.5c0-2.8 2-4.5 4.5-4.5"/>',
    user:'<circle cx="8" cy="5.5" r="3"/><path d="M2 15c0-3.5 2.7-5.5 6-5.5s6 2 6 5.5"/>',
    sign:'<path d="M2.5 11c1-2.5 2.5-4 4-2.5 1 .9.5 3.5-1.5 3 1.5-.5 2.5-4 4.5-3s-.5 3.5 0 3c1.5-1.5 3-2.5 4.5-1.5" stroke-linecap="round"/><line x1="2" y1="14.5" x2="14" y2="14.5"/>',
    up:'<path d="M4 14v3h8v-3"/><polyline points="8,3 8,11"/><polyline points="5,6 8,3 11,6"/>',
    dn:'<path d="M4 12v3h8v-3"/><polyline points="8,5 8,13"/><polyline points="5,10 8,13 11,10"/>',
    edit:'<path d="M11.5 2.5a1 1 0 011.5 1.5L4.5 12.5l-2.5.5.5-2.5L11.5 2.5z"/><line x1="9.5" y1="4.5" x2="11.5" y2="6.5"/><line x1="2" y1="12.5" x2="4.5" y2="13"/>',
    trash:'<polyline points="3,5 5,5 13,5"/><path d="M12 5l-1 10H5L4 5"/><path d="M6 5V3h4v2"/>',
    ok:'<polyline points="2,8 6,12 14,4"/>',
    x:'<line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/>',
    back:'<polyline points="10,4 4,8 10,12"/><line x1="4" y1="8" x2="14" y2="8"/>',
    eye:'<path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/>',
    srch:'<circle cx="7" cy="7" r="5"/><line x1="12" y1="12" x2="15" y2="15"/>',
    out:'<path d="M10 3H5a1 1 0 00-1 1v8a1 1 0 001 1h5"/><polyline points="13,10 16,7 13,4"/><line x1="7" y1="7" x2="16" y2="7"/>',
    save:'<path d="M13 2H4a1 1 0 00-1 1v10a1 1 0 001 1h9l2-2V3a1 1 0 00-1-1z"/><path d="M10 2v4H5V2"/><rect x="5" y="9" width="6" height="4"/>',
    bell:'<path d="M6 9a4 4 0 018 0c0 3.5 1.5 4.5 1.5 4.5H4.5S6 12.5 6 9"/><path d="M7 15.5a1.5 1.5 0 003 0"/>',
    img2:'<rect x="1" y="3" width="14" height="10" rx="1"/><circle cx="5" cy="7" r="1.5"/><path d="M1 10l4-4 3 3 2-2 4 4"/>',
    undo:'<path d="M4 7h7a4 4 0 010 8H7"/><polyline points="4,4 4,7 7,7"/>',
    zin:'<circle cx="7" cy="7" r="5"/><line x1="11" y1="11" x2="15" y2="15"/><line x1="7" y1="4" x2="7" y2="10"/><line x1="4" y1="7" x2="10" y2="7"/>',
    zout:'<circle cx="7" cy="7" r="5"/><line x1="11" y1="11" x2="15" y2="15"/><line x1="4" y1="7" x2="10" y2="7"/>',
    bold:'<path d="M5 4h4a2.5 2.5 0 010 5H5z"/><path d="M5 9h4.5a3 3 0 010 6H5z"/>',
    italic:'<line x1="10" y1="3" x2="6" y2="13"/><line x1="7" y1="3" x2="13" y2="3"/><line x1="3" y1="13" x2="9" y2="13"/>',
    underline:'<path d="M4 3v5a4 4 0 008 0V3"/><line x1="2" y1="14" x2="14" y2="14"/>',
    word_ico:'<path d="M3 1h7l4 4v10H3V1z"/><path d="M10 1v4h4"/><path d="M5 7.5l1 4 2-3 2 3 1-4" stroke-width="1.3"/>',
    pdf_ico:'<path d="M3 1h7l4 4v10H3V1z"/><path d="M10 1v4h4"/><line x1="5.5" y1="8" x2="10.5" y2="8"/><line x1="5.5" y1="10.5" x2="10.5" y2="10.5"/><line x1="5.5" y1="13" x2="8" y2="13"/>',
    lock:'<rect x="3" y="7" width="10" height="8" rx="2"/><path d="M5 7V5a3 3 0 016 0v2"/>',
    unlock:'<rect x="3" y="7" width="10" height="8" rx="2"/><path d="M5 7V4.5A3 3 0 0111 4.5"/>',
    key:'<circle cx="5.5" cy="8" r="3.5"/><path d="M8.5 8H14"/><line x1="12" y1="6" x2="12" y2="10"/><line x1="14" y1="7" x2="14" y2="9"/>',
    shield:'<path d="M8 1l6 2.5v4C14 11 11.5 14 8 15 4.5 14 2 11 2 7.5v-4L8 1z"/>',
    cal:'<rect x="2" y="3" width="12" height="11" rx="1.5"/><line x1="5" y1="1" x2="5" y2="5"/><line x1="11" y1="1" x2="11" y2="5"/><line x1="2" y1="7" x2="14" y2="7"/>',
    chart:'<line x1="2" y1="14" x2="14" y2="14"/><rect x="3" y="8" width="3" height="6" rx="0.5"/><rect x="7" y="5" width="3" height="9" rx="0.5"/><rect x="11" y="2" width="3" height="12" rx="0.5"/>',
    warn:'<path d="M8 2.5L14 13.5H2L8 2.5z"/><line x1="8" y1="7" x2="8" y2="10"/><circle cx="8" cy="12" r="0.6" fill="currentColor" stroke="none"/>',
    info:'<circle cx="8" cy="8" r="6"/><line x1="8" y1="8" x2="8" y2="11.5"/><circle cx="8" cy="5.5" r="0.6" fill="currentColor" stroke="none"/>',
    folder:'<path d="M1 4.5a1 1 0 011-1h4l1.5 1.5H14a1 1 0 011 1v6a1 1 0 01-1 1H2a1 1 0 01-1-1V4.5z"/>',
    refresh:'<path d="M13.5 3.5a7 7 0 11-1.8 7.7"/><polyline points="13.5,1 13.5,5.5 9,5.5"/>',
    pen:'<path d="M11.5 2l2.5 2.5-8 8H3.5v-2.5L11.5 2z"/><line x1="9.5" y1="4" x2="12" y2="6.5"/>',
    dots:'<circle cx="4" cy="8" r="1.5" fill="currentColor" stroke="none"/><circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="8" r="1.5" fill="currentColor" stroke="none"/>',
    gear:'<line x1="3" y1="5" x2="13" y2="5"/><circle cx="7" cy="5" r="2" fill="white" stroke="currentColor"/><line x1="3" y1="11" x2="13" y2="11"/><circle cx="10" cy="11" r="2" fill="white" stroke="currentColor"/>',
    clock:'<circle cx="8" cy="8" r="6"/><polyline points="8,5 8,8 10.5,10.5"/>',
    tri:'<polygon points="5,4 12,8 5,12" fill="currentColor" stroke="none"/>',
    tasks:'<rect x="2" y="2" width="12" height="12" rx="1.5"/><polyline points="5,8 7,10.5 11,6"/>'
  };
  return '<svg width="'+s+'" height="'+s+'" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+(P[n]||'')+'</svg>'
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
