/* ─── EVENT DELEGATION ─── */
/* All dynamic clicks handled via data-action */
document.addEventListener('click', function(e){
  var el = e.target.closest('[data-action]');
  if(!el) return;
  e.preventDefault();
  var a = el.dataset.action;
  var id = el.dataset.id;
  var tab = el.dataset.tab;
  var view = el.dataset.view;
  var action = el.dataset.act;
  var type = el.dataset.type;

  if(a==='nav') nav(view, id);
  else if(a==='auth') showAuth();
  else if(a==='login') doLogin();
  else if(a==='regG') doRegG();
  else if(a==='regS') doRegS();
  else if(a==='logout'){
    if(CU){try{dp('document_history',{action:'logout',performed_by:CU.id,note:'ออกจากระบบ'});}catch(e){}}
    if(_sesTmr){clearInterval(_sesTmr);_sesTmr=null;}
    CU=null; showAuth();
  }
  else if(a==='setDT') setDT(tab);
  else if(a==='setAT') setAT(tab);
  else if(a==='exportCSV') exportCSV();
  else if(a==='exportDocPDF') exportDocPDF(id);
  else if(a==='addWfPerson') addWfPerson();
  else if(a==='rmWfPerson') rmWfPerson(+id);
  else if(a==='changePw') showChangePw();
  else if(a==='doChangePw') doChangePw();
  else if(a==='doChangePwLogin') doChangePwLogin();
  else if(a==='showChangePwPopup') showChangePwPopup();
  else if(a==='closeChangePwPopup') closeChangePwPopup();
  else if(a==='showRegGnkPopup') showRegGnkPopup();
  else if(a==='showRegStaffPopup') showRegStaffPopup();
  else if(a==='closeRegPopup') closeRegPopup();
  else if(a==='saveDraft') saveDoc('draft');
  else if(a==='saveSend') saveDoc('pending');
  else if(a==='delFF') delFF(id, +el.dataset.idx);
  else if(a==='detUp') $e('dup').click();
  else if(a==='openViewer') openViewer(el.dataset.url, el.dataset.name);
  else if(a==='openEditor') openEditor(el.dataset.url, el.dataset.name, el.dataset.fid, el.dataset.did);
  else if(a==='showActModal') showActModal(action, id);
  else if(a==='doAct') doAct(action, id);
  else if(a==='closeModal'){var mw=$e('mwrap');if(mw)mw.innerHTML=''}
  else if(a==='showVerHist') showVerHist(id);
  else if(a==='showFwdModal') showFwdModal(id);
  else if(a==='doForward') doForward(id);
  else if(a==='admApv') admApv(id);
  else if(a==='admRej') admRej(id);
  else if(a==='admDel') admDel(id);
  else if(a==='admToggle') admToggle(id, el.dataset.active==='1');
  else if(a==='admResetPw') admResetPw(id);
  else if(a==='doAdmResetPw') doAdmResetPw(el.dataset.uid);
  else if(a==='doReSubmit') doReSubmit(id);
  else if(a==='admDelDoc') admDelDoc(id);
  else if(a==='admChgStatus') admChgStatus(id);
  else if(a==='doAdmChgStatus') doAdmChgStatus(id, el.dataset.status);
  else if(a==='showEU') showEU(id);
  else if(a==='saveEU') saveEU(el.dataset.uid, el.dataset.utype);
  else if(a==='showAddAdvisor') showAddAdvisor();
  else if(a==='showImport') showImport();
  else if(a==='doImport') doImport();
  else if(a==='saveAddAdvisor') saveAddAdvisor();
  else if(a==='showDocNumModal') showDocNumModal();
  else if(a==='saveDocNumSetting') saveDocNumSetting();
  else if(a==='pedTool') pedTool(type);
  else if(a==='sigTab') sigTab(tab);
  else if(a==='pedAddSig') pedAddSig();
  else if(a==='pedAddSigImg') pedAddSigImg();
  else if(a==='pedAddInsImg') pedAddInsImg();
  else if(a==='pedAddTxt') pedAddTxt();
  else if(a==='pedUndo') pedUndo();
  else if(a==='pedClear') pedClear();
  else if(a==='pedSave') pedSave();
  else if(a==='pedChangePg') pedPg(+el.dataset.dir);
  else if(a==='pedZoom') pedZoom(+el.dataset.dir);
  else if(a==='pedZoomFit') pedZoomFit();
  else if(a==='toggleTxtStyle') toggleTxtStyle(el.dataset.sty);
  else if(a==='trigFile') $e(el.dataset.target).click();
  else if(a==='sigClear') sigClear();
  else if(a==='sigColor'){pedSigColor(el.dataset.color);document.querySelectorAll('#sp-draw .csw').forEach(function(s){s.classList.remove('on')});el.classList.add('on')}
  else if(a==='txtColor'){PED.txtColor=el.dataset.color;document.querySelectorAll('#ps-txt .csw').forEach(function(s){s.classList.remove('on')});el.classList.add('on')}
  else if(a==='uploadLocal') $e('ped-local').click();
});


