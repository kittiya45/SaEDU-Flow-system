const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const http = require('node:http');
const root = path.resolve(__dirname, '../..');
function get(port, url, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({hostname:'127.0.0.1',port,path:url,method}, res => {
      let body=''; res.on('data',c=>body+=c); res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));
    }); req.on('error', reject); req.end();
  });
}
test('static server restricts files, symlinks, methods and supplies headers', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'saedu-server-test-'));
  const port = 26000 + Math.floor(Math.random()*10000);
  let child;
  try {
    fs.copyFileSync(path.join(root,'scripts/static-server.js'),path.join(dir,'server.js'));
    fs.copyFileSync(path.join(root,'vercel.json'),path.join(dir,'vercel.json'));
    fs.writeFileSync(path.join(dir,'index.html'),'<h1>Public</h1>');
    fs.writeFileSync(path.join(dir,'.env'),'PRIVATE');
    fs.writeFileSync(path.join(dir,'backup.json'),'PRIVATE');
    fs.symlinkSync(path.join(dir,'backup.json'),path.join(dir,'leak.js'));
    fs.writeFileSync(path.join(dir,'public-files.json'),JSON.stringify(['index.html','leak.js']));
    child = spawn(process.execPath,[path.join(dir,'server.js')],{env:{...process.env,PORT:String(port),HOST:'127.0.0.1'}});
    await new Promise((resolve,reject)=>{
      child.stdout.once('data',resolve); child.once('error',reject);
      child.once('exit',code=>reject(new Error('startup failed '+code)));
    });
    for (const p of ['/','.','/index.html?x=1']) {
      const res=await get(port,p==='.'?'/index.html':p);
      assert.equal(res.status,200); assert.match(res.headers['content-security-policy'],/base-uri 'none'/);
      assert.equal(res.headers['x-frame-options'],'DENY');
    }
    for (const p of ['/.env','/%2eenv','/backup.json','/server.js','/package.json','/public-files.json','/vercel.json','/leak.js','/../backup.json','/%2e%2e/backup.json']) {
      const res=await get(port,p); assert.equal(res.status,404,p); assert.ok(!res.body.includes('PRIVATE'));
    }
    assert.equal((await get(port,'/%ZZ')).status,400);
    assert.equal((await get(port,'/','POST')).status,405);
    assert.equal((await get(port,'/','HEAD')).body,'');
  } finally { if(child) child.kill(); fs.rmSync(dir,{recursive:true,force:true}); }
});
