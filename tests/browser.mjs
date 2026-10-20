import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {mkdir,readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const modulePath=process.env.PLAYWRIGHT_MODULE||'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const {chromium}=await import(pathToFileURL(modulePath).href);
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1050}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
// Fulfil local assets directly: this machine blocks loopback traffic between the test browser and server.
const root=resolve('.');
await page.route('https://reading.test/**',async route=>{
 const url=new URL(route.request().url());
 if(url.pathname==='/config.js'){await route.fulfill({body:'window.READING_CONFIG={supabaseUrl:"",supabaseKey:""};',contentType:'text/javascript'});return;}
 const file=resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
 if(!file.startsWith(root+sep)){await route.fulfill({status:403});return;}
 try{const body=await readFile(file);await route.fulfill({body,contentType:({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream'});}catch{await route.fulfill({status:404});}
});
await mkdir('test-results',{recursive:true});
try {
 await page.goto('https://reading.test/');
 await page.waitForSelector('#view[aria-busy="false"]');
 assert.equal(await page.locator('#sync-state').textContent(),'仅本地保存');
 await page.getByRole('button',{name:'添加阅读',exact:true}).click();
 await page.locator('#book-title').fill('活着');
 await page.locator('.match-result').first().click();
 assert.equal(await page.locator('#book-author').inputValue(),'余华');
 assert.equal(await page.locator('#book-category').inputValue(),'文学小说');
 await page.locator('#started-on').fill('2024-01-01');
 await page.getByRole('button',{name:'保存阅读',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('#reading-dialog').open);
 assert.equal(await page.locator('.reading-card').count(),1);
 await page.locator('.reading-card').click();
 await page.locator('#reading-form').getByText('已读完',{exact:true}).click();
 await page.locator('#finished-on').fill('2024-02-01');
 await page.getByRole('button',{name:'保存阅读',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('#reading-dialog').open);
 await page.locator('[data-year]').selectOption('2024');
 assert.equal(await page.locator('.stat strong').first().textContent(),'1');
 await page.locator('[data-page="shelf"]').click();
 await page.locator('.shelf-book').click();
 await page.getByRole('button',{name:'再读一次'}).click();
 await page.locator('#started-on').fill('2024-03-01');
 await page.locator('#reading-form').getByText('已读完',{exact:true}).click();
 await page.locator('#finished-on').fill('2024-03-01');
 await page.getByRole('button',{name:'保存阅读',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('#reading-dialog').open);
 assert.equal(await page.locator('.shelf-book').count(),1);
 assert.match(await page.locator('.shelf-meta').textContent(),/读完 2 次/);
 await page.locator('[data-page="months"]').click();
 await page.locator('[data-select-month="3"]').click();
 assert.match(await page.locator('.month-summary').textContent(),/读完 1 次/);
 assert.match(await page.locator('.records-table').textContent(),/第 2 次/);
 await page.locator('[data-page="shelf"]').click();
 await page.locator('#shelf-search').fill('不存在');
 assert.equal(await page.locator('.shelf-book').count(),0);
 await page.locator('#shelf-search').fill('余华');
 assert.equal(await page.locator('.shelf-book').count(),1);
 await page.locator('#account').click();
 await page.locator('#project-url').fill('https://example.supabase.co');
 await page.locator('#publishable-key').fill('sb_secret_should_never_be_used');
 await page.getByRole('button',{name:'保存连接并刷新'}).click();
 assert.match(await page.locator('#config-error').textContent(),/禁止使用 Secret key/);
 await page.locator('#settings-dialog [data-close]').click();
 // Script-looking book names are displayed as text, including in the detailed history.
 await page.getByRole('button',{name:'添加阅读',exact:true}).click();
 await page.locator('#book-title').fill('<img src=x onerror="window.XSS=1">');
 await page.getByRole('button',{name:'保存阅读',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('#reading-dialog').open);
 assert.equal(await page.evaluate(()=>window.XSS),undefined);
 // Deletion requires explicit confirmation and preserves the other reading of the same book.
 await page.locator('#shelf-search').fill('活着');
 await page.locator('.shelf-book').click();
 await page.locator('.history-row [data-edit]').first().click();
 await page.getByRole('button',{name:'删除本次记录'}).click();
 await page.locator('#confirm-yes').click();
 await page.waitForFunction(()=>!document.querySelector('#reading-dialog').open);
 assert.match(await page.locator('.shelf-meta').textContent(),/读完 1 次/);
 // Fresh browser storage for screenshots of the explicitly requested demo.
 await page.evaluate(()=>localStorage.clear());await page.reload();
 await page.locator('[data-demo]').click();await page.locator('#confirm-yes').click();
 await page.locator('[data-page="overview"]').click();
 await page.waitForSelector('.reading-card');
 // Export and re-import the same backup must preserve counts.
 await page.locator('#settings').click();
 const downloading=page.waitForEvent('download');await page.locator('#export').click();
 const download=await downloading;const saved=await download.path();
 const backup=JSON.parse(await readFile(saved,'utf8'));
 const before=backup.sessions.length;
 await page.locator('#import-file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
 await page.locator('#confirm-yes').click();
 await page.waitForFunction(count=>JSON.parse(localStorage.getItem('reading-journal-v1')).sessions.length===count,before);
 await page.getByRole('status').filter({hasText:'备份已导入'}).waitFor();
 await page.locator('#settings-dialog [data-close]').click();
 await page.screenshot({path:'test-results/desktop.png',fullPage:true});
 for(const width of [375,768,1024,1440]){
   await page.setViewportSize({width,height:1000});
   if(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)){
    console.log(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>[e.tagName,e.className,e.getBoundingClientRect().right]).slice(0,18)));
    await page.screenshot({path:'test-results/overflow.png',fullPage:true});
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,`overflow at ${width}`);
 }
 await page.setViewportSize({width:375,height:1000});await page.screenshot({path:'test-results/mobile.png',fullPage:true});
 await page.locator('#settings-mobile').click();assert.equal(await page.locator('#settings-dialog').evaluate(e=>e.open),true);await page.locator('#settings-dialog [data-close]').click();
 assert.deepEqual(errors,[]);
 console.log('Browser checks passed: add, match, finish, reread, monthly attribution, shelf search, key rejection, XSS escaping, deletion, demo, responsive widths.');
}finally{await browser.close();}
