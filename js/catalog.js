import {EXTRA_BOOKS} from './catalog-seed.js';
const BASE_BOOKS = [
  ['活着','余华','文学小说'],['许三观卖血记','余华','文学小说'],['文城','余华','文学小说'],['三体','刘慈欣','文学小说'],['三体Ⅱ：黑暗森林','刘慈欣','文学小说'],['三体Ⅲ：死神永生','刘慈欣','文学小说'],
  ['百年孤独','加西亚·马尔克斯','文学小说'],['霍乱时期的爱情','加西亚·马尔克斯','文学小说'],['小王子','安托万·德·圣埃克苏佩里','文学小说'],['悉达多','赫尔曼·黑塞','文学小说'],['平凡的世界','路遥','文学小说'],['红楼梦','曹雪芹','文学小说'],['围城','钱锺书','文学小说'],['局外人','阿尔贝·加缪','文学小说'],['追风筝的人','卡勒德·胡赛尼','文学小说'],['月亮与六便士','威廉·萨默塞特·毛姆','文学小说'],
  ['人类简史','尤瓦尔·赫拉利','历史传记'],['明朝那些事儿','当年明月','历史传记'],['万历十五年','黄仁宇','历史传记'],['苏东坡传','林语堂','历史传记'],['置身事内','兰小欢','经济商业'],['原则','瑞·达利欧','经济商业'],['穷查理宝典','查理·芒格','经济商业'],
  ['被讨厌的勇气','岸见一郎、古贺史健','心理成长'],['思考，快与慢','丹尼尔·卡尼曼','心理成长'],['蛤蟆先生去看心理医生','罗伯特·戴博德','心理成长'],['也许你该找个人聊聊','洛莉·戈特利布','心理成长'],['原子习惯','詹姆斯·克利尔','心理成长'],['认知觉醒','周岭','心理成长'],
  ['乡土中国','费孝通','社会科学'],['娱乐至死','尼尔·波兹曼','社会科学'],['第二性','西蒙娜·德·波伏瓦','社会科学'],['沉思录','马可·奥勒留','哲学思想'],['苏菲的世界','乔斯坦·贾德','哲学思想'],['时间简史','史蒂芬·霍金','科学技术'],['自私的基因','理查德·道金斯','科学技术'],['艺术的故事','贡布里希','艺术设计'],['瓦尔登湖','亨利·戴维·梭罗','文学小说'],['斯通纳','约翰·威廉斯','文学小说']
].map(([title,author,category])=>({title,author,category,source:'内置书目'}));
export const CATALOG=[...BASE_BOOKS,...EXTRA_BOOKS];
export function normalizeSearch(value){return String(value||'').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');}
export function parseIsbn(value){
  const digits=value.normalize('NFKC').replace(/^\s*isbn(?:-1[03])?\s*[:：]?\s*/i,'').replace(/[\s-]/g,'').toUpperCase();
  if(/^\d{13}$/.test(digits))return [...digits].reduce((n,d,i)=>n+Number(d)*(i%2?3:1),0)%10===0?digits:null;
  if(/^\d{9}[\dX]$/.test(digits))return [...digits].reduce((n,d,i)=>n+(d==='X'?10:Number(d))*(10-i),0)%11===0?digits:null;
  return null;
}
export function mergeMatches(...groups){
  const seen=new Set();return groups.flat().filter(b=>{
    if(!b||typeof b.title!=='string'||!b.title.trim())return false;
    const key=`${normalizeSearch(b.title)}|${normalizeSearch(b.author)}`;
    if(seen.has(key))return false;seen.add(key);return true;
  });
}
export function localMatches(query,personal=[]){
  const q=normalizeSearch(query),isbn=parseIsbn(query);if(!q)return [];
  const candidates=[...personal.map(b=>{
    const known=CATALOG.find(c=>[c.title,...(c.aliases||[])].some(t=>normalizeSearch(t)===normalizeSearch(b.title)));
    return {...b,aliases:known?.aliases||[],isbns:known?.isbns||[],source:'我的书架',personal:true};
  }),...CATALOG];
  return mergeMatches(candidates.map((b,index)=>{
    const titles=[b.title,...(b.aliases||[])].map(normalizeSearch);
    const exact=titles.includes(q)||(isbn&&(b.isbns||[]).includes(isbn));
    const prefix=titles.some(t=>t.startsWith(q));
    const includes=titles.some(t=>t.includes(q));
    if(!exact&&!includes&&!normalizeSearch(b.author).includes(q))return null;
    return {...b,score:(exact?1000:prefix?500:includes?300:100)+(b.personal?30:0),index};
  }).filter(Boolean).sort((a,b)=>b.score-a.score||a.index-b.index)).slice(0,10);
}
export async function loadCatalog(){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
  try{
    const response=await fetch(new URL('../data/catalog-zh.json',import.meta.url),{signal:controller.signal});if(!response.ok)return;
    const data=await response.json();
    if(Array.isArray(data.books))CATALOG.push(...data.books.filter(b=>typeof b.title==='string'&&typeof b.author==='string'));
  }catch{/* 内置常见书目仍可使用。 */}finally{clearTimeout(timer);}
}
export function inferCategory(subjects=[]) {
  const s=subjects.join(' ').toLowerCase();
  const rules=[['文学小说',/\bfiction\b|literature|poetry|novel|文学|小说/],['历史传记',/history|biography|历史|传记/],['心理成长',/psychology|self.help|心理/],['经济商业',/economics|business|finance|经济|商业/],['哲学思想',/philosophy|哲学/],['科学技术',/science|technology|computer|科学|计算机/],['艺术设计',/art\b|design|艺术|设计/],['社会科学',/sociology|social|社会/]];
  return rules.find(([,re])=>re.test(s))?.[0]||'其他';
}
async function openLibrary(query,signal) {
  const url=new URL('https://openlibrary.org/search.json');
  const isbn=parseIsbn(query);
  url.search=new URLSearchParams({[isbn?'isbn':'title']:isbn||query,limit:'8',fields:'key,title,author_name,subject,isbn'});
  const response=await fetch(url,{signal});
  if (!response.ok) throw new Error('在线书目暂时不可用');
  const result=await response.json();
  return (result.docs||[]).map(d=>({title:d.title,author:d.author_name?.join('、')||'',category:inferCategory(d.subject),isbns:d.isbn||[],source:'Open Library · 分类供参考'}));
}
const label=entity=>['zh-hans','zh-cn','zh','zh-hant','zh-tw','en'].map(lang=>entity.labels?.[lang]?.value).find(Boolean)||'';
async function wikidataRequest(params,signal){
  const url=new URL('https://www.wikidata.org/w/api.php');
  url.search=new URLSearchParams({format:'json',origin:'*',...params});
  const response=await fetch(url,{signal});if(!response.ok)throw new Error('中文在线书目暂时不可用');
  const data=await response.json();if(data.error)throw new Error('中文在线书目检索失败');return data;
}
async function wikidata(query,signal){
  const language=/[\u3400-\u9fff]/u.test(query)?'zh':'en';
  const result=await wikidataRequest({action:'wbsearchentities',search:query,language,uselang:'zh',type:'item',limit:'6'},signal);
  const ids=(result.search||[]).map(x=>x.id);if(!ids.length)return [];
  const data=await wikidataRequest({action:'wbgetentities',ids:ids.join('|'),props:'labels|claims',languages:'zh-hans|zh-cn|zh|zh-hant|zh-tw|en'},signal);
  // P50 is the author property: exclude films, people, and other non-book search hits.
  const books=Object.values(data.entities||{}).filter(e=>e.claims?.P50?.length&&!e.claims?.P31?.some(p=>['Q11424','Q5','Q5398426'].includes(p.mainsnak?.datavalue?.value?.id)));
  const authors=[...new Set(books.flatMap(b=>b.claims.P50.map(a=>a.mainsnak?.datavalue?.value?.id).filter(Boolean)))];
  const people=authors.length?await wikidataRequest({action:'wbgetentities',ids:authors.join('|'),props:'labels',languages:'zh-hans|zh-cn|zh|zh-hant|zh-tw|en'},signal):{entities:{}};
  return books.map(b=>({title:label(b),author:b.claims.P50.map(a=>label(people.entities?.[a.mainsnak?.datavalue?.value?.id]||{})).filter(Boolean).join('、'),category:inferCategory(b.claims.P31?.some(p=>['Q8261','Q7725634','Q127956'].includes(p.mainsnak?.datavalue?.value?.id))?['fiction']:[]),source:'Wikidata · 分类供参考'}));
}
async function timedSearch(search,query,parent){
  const controller=new AbortController(),abort=()=>controller.abort();
  if(parent?.aborted)controller.abort();else parent?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,8000);
  try{return await search(query,controller.signal);}finally{clearTimeout(timer);parent?.removeEventListener('abort',abort);}
}
export async function searchRemote(query,signal,onUpdate=()=>{}){
  const results=[],failures=[];
  const sources=parseIsbn(query)?[['Open Library',openLibrary]]:[['Open Library',openLibrary],['Wikidata',wikidata]];
  await Promise.allSettled(sources.map(async([name,search])=>{
    try{results.push(...await timedSearch(search,query,signal));onUpdate(mergeMatches(results));}catch(error){failures.push(name);}
  }));
  if(signal?.aborted)throw new DOMException('检索已取消','AbortError');
  return {books:mergeMatches(results),failures};
}
