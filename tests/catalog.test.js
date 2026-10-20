import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CATALOG,localMatches,normalizeSearch,parseIsbn,searchRemote,inferCategory} from '../js/catalog.js';

test('中文补充书目覆盖用户反馈，常见译名和书名标点可以匹配',()=>{
 for(const query of ['紫颜色','紫色姐妹花','The Color Purple'])assert.equal(localMatches(query)[0].title,'紫颜色');
 assert.equal(localMatches('《简爱》')[0].title,'简·爱');
 assert.equal(localMatches('一九八四')[0].title,'1984');
 assert.ok(CATALOG.length>140);
});
test('中文快照包含有效的中文书名与来源，没有编码替换字符',()=>{
 const data=JSON.parse(readFileSync(new URL('../data/catalog-zh.json',import.meta.url),'utf8'));
 assert.ok(data.books.length>=500);
 for(const b of data.books){assert.match(b.source_id,/^Q\d+$/);assert.ok(b.title.trim());assert.ok(b.author.trim());assert.equal(`${b.title}${b.author}`.includes('\ufffd'),false);}
});
test('ISBN 验证和带连字符的输入能匹配中文书目',()=>{
 assert.equal(parseIsbn('ISBN: 978-7-5360-9808-4'),'9787536098084');
 assert.equal(parseIsbn('0-8044-2957-X'),'080442957X');
 assert.equal(parseIsbn('9787536098085'),null);
 assert.equal(localMatches('978-7-5360-9808-4')[0].title,'紫颜色');
});
test('用户保存的作者和分类优先，同名结果去重；完整匹配排在部分匹配之前',()=>{
 const saved={title:'紫颜色',author:'艾丽斯·沃克',category:'社会科学',id:'saved'};
 assert.equal(localMatches('紫颜色',[saved])[0].category,'社会科学');
 assert.equal(localMatches('紫颜色',[saved]).filter(b=>b.title==='紫颜色'&&b.author===saved.author).length,1);
 const custom={title:'我的未收录书籍',author:'作者',category:'其他'};
 assert.equal(localMatches('未收录',[custom])[0].source,'我的书架');
 assert.equal(normalizeSearch('Ａ · Book'),'abook');
});
test('科幻小说优先归入文学，未知主题保留其他',()=>{
 assert.equal(inferCategory(['Science fiction','History']),'文学小说');
 assert.equal(inferCategory(['Nonfiction']),'其他');
});
test('多个来源独立检索：一个失败仍保留另一个的结果',async()=>{
 const old=globalThis.fetch;const requests=[];const updates=[];
 globalThis.fetch=async url=>{requests.push(String(url));if(String(url).includes('wikidata'))return {ok:false};return {ok:true,json:async()=>({docs:[{title:'Remote Book',author_name:['Author'],subject:['fiction']}]})};};
 try{const result=await searchRemote('Remote',new AbortController().signal,books=>updates.push(books));assert.equal(requests.length,2);assert.equal(result.books[0].title,'Remote Book');assert.deepEqual(result.failures,['Wikidata']);assert.equal(updates.length,1);}finally{globalThis.fetch=old;}
});
test('ISBN 查询使用专用字段，并排除不适用的名称检索',async()=>{
 const old=globalThis.fetch;const requests=[];
 globalThis.fetch=async url=>{requests.push(new URL(url));return {ok:true,json:async()=>({docs:[]})};};
 try{await searchRemote('9780140328721',new AbortController().signal);assert.equal(requests.length,1);assert.equal(requests[0].searchParams.get('isbn'),'9780140328721');assert.equal(requests[0].searchParams.has('title'),false);}finally{globalThis.fetch=old;}
});
test('Wikidata 匹配书籍并补全作者，过滤同名电影',async()=>{
 const old=globalThis.fetch;
 globalThis.fetch=async value=>{
  const url=new URL(value);let data={docs:[]};
  if(url.hostname.includes('wikidata')){
   if(url.searchParams.get('action')==='wbsearchentities')data={search:[{id:'Q1'},{id:'Q2'}]};
   else if(url.searchParams.get('ids')==='Q3')data={entities:{Q3:{labels:{zh:{value:'中文作者'}}}}};
   else data={entities:{Q1:{labels:{zh:{value:'中文小说'}},claims:{P50:[{mainsnak:{datavalue:{value:{id:'Q3'}}}}],P31:[{mainsnak:{datavalue:{value:{id:'Q8261'}}}}]}},Q2:{labels:{zh:{value:'同名电影'}},claims:{P31:[{mainsnak:{datavalue:{value:{id:'Q11424'}}}}]}}}};
  }
  return {ok:true,json:async()=>data};
 };
 try{const result=await searchRemote('中文小说',new AbortController().signal);assert.equal(result.books.length,1);assert.equal(result.books[0].author,'中文作者');assert.equal(result.books[0].category,'文学小说');}finally{globalThis.fetch=old;}
});
test('取消过期检索，不返回旧结果',async()=>{
 const old=globalThis.fetch;const controller=new AbortController();controller.abort();
 globalThis.fetch=async()=>{throw new DOMException('cancelled','AbortError');};
 try{await assert.rejects(()=>searchRemote('Old query',controller.signal),{name:'AbortError'});}finally{globalThis.fetch=old;}
});
