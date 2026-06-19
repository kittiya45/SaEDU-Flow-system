/* ─── BOOT ─── */
(async function(){
  try{
    var _sr=await sb.auth.getSession();
    var session=_sr&&_sr.data&&_sr.data.session;
    if(session){
      H.Authorization='Bearer '+session.access_token;
      var rows=await dg('users','?auth_uid=eq.'+session.user.id);
      var row=rows&&rows[0];
      var ok=await _enterAppAsUser(row,{logLogin:false});
      if(ok)return;
    }
  }catch(e){console.warn('Session restore failed:',e)}
  showAuth();
})();
