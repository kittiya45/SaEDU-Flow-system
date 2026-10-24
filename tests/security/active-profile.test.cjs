const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const source = fs.readFileSync(path.join(__dirname,'../../supabase/functions/_shared/activeProfile.ts'),'utf8');
const context = vm.createContext({});
vm.runInContext(stripTypeScriptTypes(source).replace('export function','function'),context);
const { assertActiveProfile } = context;
test('service-role entry points reject invalid account state', () => {
  const active={is_active:true,approval_status:'approved',expires_at:null};
  assert.doesNotThrow(()=>assertActiveProfile(active));
  assert.doesNotThrow(()=>assertActiveProfile({...active,expires_at:'2099-01-01T00:00:00Z'}));
  for (const profile of [null,{}, {...active,is_active:false}, {...active,approval_status:'pending'},
    {...active,expires_at:'2000-01-01T00:00:00Z'}, {...active,expires_at:'invalid'}]) {
    assert.throws(()=>assertActiveProfile(profile),e=>e.status===403);
  }
});
test('general API cannot authenticate using a cron secret', async () => {
  const authSource=fs.readFileSync(path.join(__dirname,'../../supabase/functions/_shared/requireAuth.ts'),'utf8');
  const context=vm.createContext({
    Deno:{env:{get:key=>({SUPABASE_URL:'https://test.invalid',SUPABASE_SERVICE_ROLE_KEY:'server-key',OVERDUE_CRON_SECRET:'cron-key'})[key]}},
    createClient:()=>({auth:{getUser:async()=>({data:null,error:new Error('invalid')})}}),
    assertActiveProfile,
  });
  vm.runInContext(stripTypeScriptTypes(authSource).replace(/^import .*;\n/gm,'').replace(/export /g,''),context);
  const req={headers:{get:key=>({'Authorization':'Bearer fake-jwt','x-cron-secret':'cron-key'})[key]}};
  await assert.rejects(()=>context.requireAuth(req),e=>e.status===401);
  const system=await context.requireAuth({headers:{get:()=> 'Bearer server-key'}});
  assert.equal(system.caller.type,'system');
});
test('password reset respects DEV/SYS boundary and validates input', async () => {
  const endpoint=fs.readFileSync(path.join(__dirname,'../../supabase/functions/admin-set-password/index.ts'),'utf8');
  async function run(role,target,input={targetAuthUid:'target-id',newPassword:'valid-password'}) {
    let handler,updates=0;
    const admin={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:target,error:null})})})}),
      auth:{admin:{updateUserById:async()=>{updates++;return {error:null};}}}};
    const context=vm.createContext({
      Deno:{serve:fn=>handler=fn},corsHeaders:{},Response,
      requireStaff:async()=>({admin,role_code:role}),json:(body,status=200)=>({body,status}),
    });
    vm.runInContext(stripTypeScriptTypes(endpoint).replace(/^import .*;\n/gm,''),context);
    const response=await handler({method:'POST',json:async()=>input});
    return {response,updates};
  }
  let result=await run('ROLE-DEV',{role_code:'ROLE-SYS'});
  assert.equal(result.response.status,403);assert.equal(result.updates,0);
  result=await run('ROLE-DEV',{role_code:'ROLE-CRT'});
  assert.equal(result.response.status,200);assert.equal(result.updates,1);
  result=await run('ROLE-SYS',{role_code:'ROLE-SYS'});
  assert.equal(result.response.status,200);assert.equal(result.updates,1);
  result=await run('ROLE-SYS',null);
  assert.equal(result.response.status,404);assert.equal(result.updates,0);
  result=await run('ROLE-SYS',{role_code:'ROLE-CRT'},{targetAuthUid:'x',newPassword:{length:12}});
  assert.equal(result.response.status,400);assert.equal(result.updates,0);
});
