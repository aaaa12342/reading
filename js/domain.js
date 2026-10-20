export const CATEGORIES = ['文学小说','历史传记','哲学思想','心理成长','社会科学','经济商业','科学技术','艺术设计','生活方式','其他'];
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === value;
}
export function duration(start, end = today()) {
  return Math.round((Date.parse(`${end}T00:00:00Z`)-Date.parse(`${start}T00:00:00Z`))/86400000)+1;
}
export function validateSession(s) {
  if (!validDate(s.started_on) || s.started_on > today()) throw new Error('请选择有效的开始日期，不能晚于今天');
  if (s.finished_on && (!validDate(s.finished_on) || s.finished_on < s.started_on || s.finished_on > today())) throw new Error('读完日期须在开始日期和今天之间');
  if (typeof s.notes !== 'string' || s.notes.length > 10000) throw new Error('阅读笔记不能超过 10000 字');
}
export function bookKey(title, author) {
  return `${title.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase()}|${author.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase()}`;
}
export function validateBook(b) {
  if (typeof b.title !== 'string' || !b.title.trim() || b.title.length > 200) throw new Error('书名不能为空，最多 200 字');
  if (typeof b.author !== 'string' || b.author.length > 200) throw new Error('作者最多 200 字');
  if (!CATEGORIES.includes(b.category)) throw new Error('请选择书籍类型');
}
export function statistics(books, sessions, year) {
  const finished = sessions.filter(s=>s.finished_on?.startsWith(`${year}-`));
  const byId = new Map(books.map(b=>[b.id,b]));
  const months = Array.from({length:12},(_,i)=>finished.filter(s=>Number(s.finished_on.slice(5,7))===i+1));
  const categories = CATEGORIES.map(category=>({category,count:finished.filter(s=>byId.get(s.book_id)?.category===category).length})).filter(c=>c.count);
  return { finished, months, categories, total:finished.length, unique:new Set(finished.map(s=>s.book_id)).size,
    reading:sessions.filter(s=>!s.finished_on).length,
    average:finished.length?Math.round(finished.reduce((n,s)=>n+duration(s.started_on,s.finished_on),0)/finished.length):0 };
}
export function validateBackup(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.books) || !Array.isArray(data.sessions)) throw new Error('这不是支持的阅读备份文件');
  if (data.books.length > 20000 || data.sessions.length > 50000) throw new Error('备份文件过大');
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const ids = new Set(); const sessionIds = new Set(); const keys = new Set();
  const books=data.books.map(b=>{
    validateBook(b);
    const key=bookKey(b.title,b.author);
    if (!uuid.test(b.id)||ids.has(b.id)||keys.has(key)) throw new Error('备份中存在无效或重复图书');
    ids.add(b.id); keys.add(key);
    return {id:b.id,title:b.title.trim(),author:b.author.trim(),category:b.category,identity_key:key};
  });
  const sessions=data.sessions.map(s=>{
    validateSession(s);
    if (!uuid.test(s.id)||sessionIds.has(s.id)||!ids.has(s.book_id)) throw new Error('备份中存在无效或重复阅读记录');
    sessionIds.add(s.id);
    return {id:s.id,book_id:s.book_id,started_on:s.started_on,finished_on:s.finished_on||null,notes:s.notes};
  });
  return {books,sessions};
}
export function mergeBackup(existing, incoming) {
  const books=existing.books.map(b=>({...b})); const sessions=existing.sessions.map(s=>({...s}));
  const remap=new Map(); const byKey=new Map(books.map(b=>[bookKey(b.title,b.author),b]));
  for (const b of incoming.books) {
    const known=byKey.get(bookKey(b.title,b.author));
    if (known) {remap.set(b.id,known.id);continue;}
    if (books.some(x=>x.id===b.id)) throw new Error('图书 ID 冲突，导入已取消');
    books.push(b); byKey.set(bookKey(b.title,b.author),b); remap.set(b.id,b.id);
  }
  for (const s of incoming.sessions) {
    const mapped={...s,book_id:remap.get(s.book_id)};
    const known=sessions.find(x=>x.id===s.id);
    if (known) {
      if (['book_id','started_on','finished_on','notes'].some(k=>(known[k]||null)!==(mapped[k]||null))) throw new Error('阅读记录 ID 冲突，导入已取消');
      continue;
    }
    sessions.push(mapped);
  }
  return {books,sessions};
}
