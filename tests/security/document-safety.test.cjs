const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
test('DOCX sanitizer removes active content and preserves document text/table/image', async () => {
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage();
    await page.setContent('<div id="output"></div>');
    await page.addScriptTag({path:path.join(root,'vendor/purify.min.js')});
    await page.addScriptTag({path:path.join(root,'editor.js')});
    const result = await page.evaluate(() => {
      const source='<p>เอกสารทดสอบ <strong>ข้อความ</strong></p><table><tr><td>ข้อมูล</td></tr></table>'+
        '<img src="data:image/png;base64,AA==" onerror="window.hacked=true">'+
        '<a href="javascript:window.hacked=true">link</a><svg onload="window.hacked=true"></svg>'+
        '<script>window.hacked=true</script><form id="CU"><input name="role"></form>';
      const html=sanitizeDocxHtml(source);
      document.getElementById('output').innerHTML=html;
      return {html, hacked:!!window.hacked, text:document.getElementById('output').textContent};
    });
    assert.equal(result.hacked,false);
    assert.doesNotMatch(result.html,/onerror|onload|javascript:|<script|<svg|<form|<input/i);
    assert.match(result.html,/<table>/); assert.match(result.html,/<img/);
    assert.match(result.text,/เอกสารทดสอบ/);
    await page.evaluate(()=>{window.DOMPurify=undefined;});
    await assert.rejects(()=>page.evaluate(()=>sanitizeDocxHtml('<p>x</p>')),/โหลดตัวตรวจ/);
  } finally { await browser.close(); }
});
test('every PDF.js entry point explicitly disables eval', () => {
  let count=0;
  for (const name of ['viewer.js','docSign.js','docNum.js','editor.js']) {
    const source=fs.readFileSync(path.join(root,name),'utf8');
    for (const match of source.matchAll(/pdfjsLib\.getDocument\(([^\n]+?)\)\.promise/g)) {
      count++; assert.match(match[1],/isEvalSupported:false/,name);
    }
  }
  assert.equal(count,5);
});
