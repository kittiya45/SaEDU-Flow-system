// Read-only/unauthenticated probes. Never prints keys, records, or response bodies.
import fs from 'node:fs';
const config=fs.readFileSync(new URL('../../config.js',import.meta.url),'utf8');
const base=config.match(/var SU = '([^']+)'/)[1];
const anon=config.match(/var SK = '([^']+)'/)[1];
const headers={apikey:anon,Authorization:'Bearer '+anon,'Content-Type':'application/json'};
let failures=0;
for (const name of ['admin-create-user','admin-delete-user','admin-set-password','convert-docx',
  'integration-status','message-quota','send-line','send-email','check-overdue','line-webhook']) {
  const response=await fetch(base+'/functions/v1/'+name,{method:'POST',headers,body:'{}',signal:AbortSignal.timeout(20000)});
  const pass=[401,403].includes(response.status);
  console.log(`${pass?'PASS':'FAIL'} ${name}: unauthenticated request ${response.status}`);
  if(!pass) failures++;
}
for (const endpoint of ['/rest/v1/users?select=id&limit=1','/rest/v1/app_settings?key=eq.overdue_cron_secret&select=value', '/storage/v1/object/list/documents']) {
  const storage=endpoint.includes('/storage/');
  const response=await fetch(base+endpoint,{method:storage?'POST':'GET',headers,
    ...(storage?{body:JSON.stringify({prefix:'',limit:1})}:{}),signal:AbortSignal.timeout(20000)});
  const data=await response.json();
  const pass=[401,403].includes(response.status)||(response.ok&&Array.isArray(data)&&data.length===0);
  console.log(`${pass?'PASS':'FAIL'} ${storage?'Storage list':endpoint.includes('users')?'users table':'cron secret'}: no anonymous records`);
  if(!pass) failures++;
}
if(failures) process.exitCode=1;
