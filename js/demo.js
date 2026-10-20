import {CATALOG} from './catalog.js';
import {today} from './domain.js';
export function demoData() {
  const year=new Date().getFullYear(),month=new Date().getMonth()+1;
  const titles=['活着','悉达多','人类简史','被讨厌的勇气','乡土中国','百年孤独','置身事内','小王子'];
  const books=titles.map(title=>({...CATALOG.find(b=>b.title===title),id:crypto.randomUUID()}));
  const sessions=[];
  const date=(m,d)=>`${year}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  for(let m=1;m<=month;m++) {
    for(let j=0;j<(m%3)+1;j++) {
      const end=date(m,j*5+3);
      if(end>today()) continue;
      sessions.push({id:crypto.randomUUID(),book_id:books[(m+j)%books.length].id,started_on:date(m,1),finished_on:end,notes:''});
    }
  }
  for(let i=0;i<3;i++)sessions.push({id:crypto.randomUUID(),book_id:books[i].id,started_on:date(month,1),finished_on:null,notes:i===0?'这是示例笔记，可以编辑或删除。':''});
  return {books,sessions};
}
