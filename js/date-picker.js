import {today,validDate} from './domain.js';

// Text entry stays editable while typing; normalize only on blur or submit.
export function parseDate(value) {
  const text=value.trim().replace(/[年/.]/g,'-').replace(/月/g,'-').replace(/日/g,'');
  const match=text.match(/^(\d{4})-([0-9]{1,2})-([0-9]{1,2})$/)||text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if(!match)return null;
  const iso=`${match[1]}-${match[2].padStart(2,'0')}-${match[3].padStart(2,'0')}`;
  return validDate(iso)?iso:null;
}
const isoDate=(year,month,day)=>`${String(year).padStart(4,'0')}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
const calendarDate=value=>new Date(`${value}T12:00:00`);

export function setupDatePickers(form) {
  const inputs=[...form.querySelectorAll('[data-date-input]')];
  const panel=document.createElement('section');
  panel.className='date-calendar';panel.hidden=true;panel.id='reading-calendar';
  panel.setAttribute('aria-label','选择阅读日期');
  form.querySelector('#date-fields').after(panel);
  let active=null,viewYear=0,viewMonth=0;
  const buttons=new Map();
  const allowed=value=>(!active.min||value>=active.min)&&(!active.max||value<=active.max);
  function check(input,normalize=false) {
    const raw=input.value.trim(),iso=parseDate(raw);
    let message='';
    if(raw&&!iso)message='请输入有效日期，例如 2026-10-20';
    else if(iso&&input.max&&iso>input.max)message='日期不能晚于今天';
    else if(iso&&input.min&&iso<input.min)message='读完日期不能早于开始日期';
    input.setCustomValidity(message);
    if(normalize&&iso)input.value=iso;
    return iso;
  }
  function close(restoreFocus=false){
    panel.hidden=true;
    if(active){buttons.get(active).setAttribute('aria-expanded','false');if(restoreFocus)buttons.get(active).focus();}
    active=null;
  }
  function show(input) {
    if(active===input&&!panel.hidden){close();return;}
    close();active=input;
    const selected=parseDate(input.value)||today();
    const bounded=selected>input.max?input.max:selected<input.min?input.min:selected;
    const date=calendarDate(bounded||today());viewYear=date.getFullYear();viewMonth=date.getMonth();
    panel.hidden=false;buttons.get(input).setAttribute('aria-expanded','true');render(true);
    panel.scrollIntoView({block:'nearest',behavior:'instant'});
  }
  function choose(value){
    if(!allowed(value))return;
    const input=active;input.value=value;check(input,true);
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
    close();input.focus();
  }
  function render(focusDay=false) {
    const selected=parseDate(active.value),current=today();
    const maxYear=Number((active.max||current).slice(0,4));
    const minYear=Math.min(1900,viewYear);
    const offset=(new Date(viewYear,viewMonth,1).getDay()+6)%7;
    const days=new Date(viewYear,viewMonth+1,0).getDate();
    const previousDate=new Date(viewYear,viewMonth,0),nextDate=new Date(viewYear,viewMonth+1,1);
    const prev=isoDate(previousDate.getFullYear(),previousDate.getMonth(),previousDate.getDate());
    const next=isoDate(nextDate.getFullYear(),nextDate.getMonth(),1);
    const label=active.id==='started-on'?'开始日期':'读完日期';
    panel.innerHTML=`<div class="calendar-heading"><strong>选择${label}</strong><button type="button" class="plain" data-calendar-close aria-label="收起日历">收起</button></div>
      <div class="calendar-navigation"><button type="button" class="secondary" data-calendar-prev aria-label="上个月" ${active.min&&prev<active.min?'disabled':''}>‹</button>
      <select aria-label="选择年份" data-calendar-year>${Array.from({length:maxYear-minYear+1},(_,i)=>minYear+i).map(y=>`<option value="${y}" ${y===viewYear?'selected':''}>${y} 年</option>`).join('')}</select>
      <select aria-label="选择月份" data-calendar-month>${Array.from({length:12},(_,m)=>`<option value="${m}" ${m===viewMonth?'selected':''}>${m+1} 月</option>`).join('')}</select>
      <button type="button" class="secondary" data-calendar-next aria-label="下个月" ${active.max&&next>active.max?'disabled':''}>›</button></div>
      <div class="calendar-week" aria-hidden="true">${['一','二','三','四','五','六','日'].map(d=>`<span>${d}</span>`).join('')}</div>
      <div class="calendar-days" role="group" aria-label="${viewYear} 年 ${viewMonth+1} 月">${'<span></span>'.repeat(offset)}${Array.from({length:days},(_,i)=>{
        const value=isoDate(viewYear,viewMonth,i+1);
        return `<button type="button" data-calendar-day="${value}" aria-label="${viewYear}年${viewMonth+1}月${i+1}日" aria-pressed="${selected===value}" ${value===current?'aria-current="date"':''} ${!allowed(value)?'disabled':''}>${i+1}</button>`;
      }).join('')}</div><div class="calendar-footer"><span>也可直接输入年月日</span><button type="button" class="plain" data-calendar-today ${!allowed(current)?'disabled':''}>今天</button></div>`;
    panel.querySelector('[data-calendar-close]').onclick=()=>close(true);
    panel.querySelector('[data-calendar-prev]').onclick=()=>moveMonth(-1);
    panel.querySelector('[data-calendar-next]').onclick=()=>moveMonth(1);
    panel.querySelector('[data-calendar-year]').onchange=e=>{viewYear=Number(e.target.value);render();panel.querySelector('[data-calendar-year]').focus();};
    panel.querySelector('[data-calendar-month]').onchange=e=>{viewMonth=Number(e.target.value);render();panel.querySelector('[data-calendar-month]').focus();};
    panel.querySelector('[data-calendar-today]').onclick=()=>choose(current);
    panel.querySelectorAll('[data-calendar-day]').forEach(button=>button.onclick=()=>choose(button.dataset.calendarDay));
    if(focusDay)(panel.querySelector(`[data-calendar-day="${selected}"]:not(:disabled)`)||panel.querySelector(`[data-calendar-day="${current}"]:not(:disabled)`)||panel.querySelector('[data-calendar-day]:not(:disabled)'))?.focus();
  }
  function moveMonth(offset){const d=new Date(viewYear,viewMonth+offset,1);viewYear=d.getFullYear();viewMonth=d.getMonth();render(true);}
  panel.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);return;}
    const day=event.target.closest('[data-calendar-day]');if(!day)return;
    const offsets={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};
    if(!(event.key in offsets))return;
    event.preventDefault();const next=calendarDate(day.dataset.calendarDay);next.setDate(next.getDate()+offsets[event.key]);
    const value=isoDate(next.getFullYear(),next.getMonth(),next.getDate());if(!allowed(value))return;
    viewYear=next.getFullYear();viewMonth=next.getMonth();render();panel.querySelector(`[data-calendar-day="${value}"]`)?.focus();
  });
  for(const input of inputs){
    const button=form.querySelector(`[data-date-toggle="${input.id}"]`);buttons.set(input,button);
    button.setAttribute('aria-controls',panel.id);button.setAttribute('aria-expanded','false');
    button.onclick=()=>show(input);
    input.addEventListener('input',()=>{input.setCustomValidity('');});
    input.addEventListener('blur',()=>{const before=input.value;check(input,true);if(input.value!==before)input.dispatchEvent(new Event('change',{bubbles:true}));});
    input.addEventListener('keydown',e=>{if(e.key==='ArrowDown'&&e.altKey){e.preventDefault();show(input);}});
  }
  form.addEventListener('submit',()=>inputs.forEach(input=>check(input,true)),true);
  form.addEventListener('change',()=>inputs.forEach(input=>{if(!input.closest('[hidden]'))check(input);}));
  document.addEventListener('pointerdown',event=>{if(active&&!panel.contains(event.target)&&!event.target.closest('.date-entry'))close();});
  form.closest('dialog').addEventListener('close',()=>{close();inputs.forEach(input=>input.setCustomValidity(''));});
  return {reset(){close();inputs.forEach(input=>input.setCustomValidity(''));},refresh(){if(active&&active.closest('[hidden]'))close();}};
}
