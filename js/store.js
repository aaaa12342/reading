import {bookKey,validateBook,validateSession,validateBackup,mergeBackup} from './domain.js';
const LOCAL_KEY='reading-journal-v1';
const CONFIG_KEY='reading-connection-v1';
export function getConfig() {
  let saved={}; try {saved=JSON.parse(localStorage.getItem(CONFIG_KEY)||'{}');} catch {}
  return {...(window.READING_CONFIG||{}),...saved};
}
export function checkConfig(config) {
  const url=new URL(config.supabaseUrl);
  if (url.protocol!=='https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) || url.pathname!=='/' || url.search || url.hash) throw new Error('请填写 https://项目编号.supabase.co 格式的 Project URL');
  const key=config.supabaseKey.trim();
  if (key.startsWith('sb_secret_')) throw new Error('禁止使用 Secret key，请改用 Publishable key');
  if (key.startsWith('sb_publishable_') && key.length>20) return;
  try {
    const payload=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
    if (payload.role==='anon') return;
  } catch {}
  throw new Error('请填写 Publishable key 或旧版 anon key，不能使用管理员密钥');
}
export function saveConfig(config) {checkConfig(config);localStorage.setItem(CONFIG_KEY,JSON.stringify(config));}
export class Store {
  constructor() {this.client=null;this.user=null;this.data={books:[],sessions:[]};this.loading=false;this.loadVersion=0;}
  async init() {
    const config=getConfig();
    if (config.supabaseUrl && config.supabaseKey) {
      checkConfig(config);
      if (!window.supabase) throw new Error('登录组件未加载，请刷新网页');
      this.client=window.supabase.createClient(config.supabaseUrl,config.supabaseKey);
      const {data,error}=await this.client.auth.getSession();
      if (error) throw error;
      this.user=data.session?.user||null;
    }
    await this.load();
  }
  async load() {
    const version=++this.loadVersion, userId=this.user?.id||null;
    this.loading=true;
    try {
      if (this.user) {
        const results=await Promise.all([this.client.from('books').select('*'),this.client.from('reading_sessions').select('*')]);
        for (const r of results) if (r.error) throw r.error;
        if (version===this.loadVersion && userId===(this.user?.id||null)) this.data={books:results[0].data,sessions:results[1].data};
      } else {
        const raw=localStorage.getItem(LOCAL_KEY);
        this.data=raw?validateBackup(JSON.parse(raw)):{books:[],sessions:[]};
      }
    } finally {this.loading=false;}
    return this.data;
  }
  persist(data) {localStorage.setItem(LOCAL_KEY,JSON.stringify({version:1,...data}));this.data=data;}
  async save(book,session,expected=null) {
    validateBook(book);validateSession(session);
    if (this.user) {
      const {error}=await this.client.rpc('save_reading',{p_book:book,p_session:session,p_expected:expected});
      if (error) throw error;
    } else {
      const next=structuredClone(this.data);
      let known=next.books.find(b=>bookKey(b.title,b.author)===bookKey(book.title,book.author));
      if (!known) {known={...book,id:crypto.randomUUID(),identity_key:bookKey(book.title,book.author)};next.books.push(known);} else {known.category=book.category;}
      const record={...session,book_id:known.id};
      const i=next.sessions.findIndex(s=>s.id===record.id);
      if (i<0) next.sessions.push(record); else next.sessions[i]=record;
      this.persist(next);
    }
  }
  async remove(id,expected) {
    if (this.user) {
      const {data,error}=await this.client.from('reading_sessions').delete().eq('id',id).eq('updated_at',expected).select('id');
      if (error) throw error;
      if (!data.length) throw new Error('记录已在另一台设备修改，请刷新后再操作');
    } else this.persist({...this.data,sessions:this.data.sessions.filter(s=>s.id!==id)});
  }
  async importBackup(raw) {
    const incoming=validateBackup(raw);
    if (this.user) {
      const {error}=await this.client.rpc('import_reading',{p_data:incoming});
      if (error) throw error;
    } else this.persist(mergeBackup(this.data,incoming));
  }
  async exportBackup() {
    await this.load();
    return {version:1,exported_at:new Date().toISOString(),books:this.data.books,sessions:this.data.sessions};
  }
}
