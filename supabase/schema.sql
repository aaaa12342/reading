-- 在你自己的 Supabase 项目的 SQL Editor 中完整运行一次。
-- 无管理员 API key；权限由当前登录用户和 RLS 控制。
begin;

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  identity_key text not null check (length(identity_key) between 1 and 500),
  title text not null check (length(trim(title)) between 1 and 200),
  author text not null default '' check (length(author) <= 200),
  category text not null default '其他' check (category in ('文学小说','历史传记','哲学思想','心理成长','社会科学','经济商业','科学技术','艺术设计','生活方式','其他')),
  created_at timestamptz not null default now(),
  unique(user_id, identity_key),
  unique(id, user_id)
);
create table if not exists public.reading_sessions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  book_id uuid not null,
  started_on date not null,
  finished_on date,
  notes text not null default '' check (length(notes) <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (book_id,user_id) references public.books(id,user_id) on delete cascade,
  check (finished_on is null or finished_on >= started_on)
);
create index if not exists reading_sessions_user_month on public.reading_sessions(user_id,finished_on);
create index if not exists reading_sessions_user_book on public.reading_sessions(user_id,book_id);
alter table public.books enable row level security;
alter table public.reading_sessions enable row level security;
revoke all on public.books,public.reading_sessions from anon;
grant select,insert,update,delete on public.books,public.reading_sessions to authenticated;
drop policy if exists own_books on public.books;
create policy own_books on public.books for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists own_sessions on public.reading_sessions;
create policy own_sessions on public.reading_sessions for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

create or replace function public.check_reading_dates()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.started_on > (now() at time zone 'Asia/Shanghai')::date or new.finished_on > (now() at time zone 'Asia/Shanghai')::date then
    raise exception '阅读日期不能晚于今天';
  end if;
  if TG_OP='UPDATE' then new.updated_at=clock_timestamp(); end if;
  return new;
end;
$$;
drop trigger if exists reading_dates on public.reading_sessions;
create trigger reading_dates before insert or update on public.reading_sessions for each row execute function public.check_reading_dates();

-- 一次阅读的图书与日期在同一个事务中保存；编辑时检查版本，避免静默覆盖另一台设备的更改。
create or replace function public.save_reading(p_book jsonb,p_session jsonb,p_expected timestamptz default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare
  uid uuid=auth.uid();
  bid uuid;
  sid uuid=(p_session->>'id')::uuid;
  old_updated timestamptz;
  title_text text=trim(p_book->>'title');
  author_text text=trim(coalesce(p_book->>'author',''));
  book_identity text;
begin
  if uid is null then raise exception '请先登录'; end if;
  -- 与客户端 NFKC + 小写 + 空白归一化保持一致。
  book_identity=lower(regexp_replace(normalize(title_text,NFKC),'\s+',' ','g')) || '|' || lower(regexp_replace(normalize(author_text,NFKC),'\s+',' ','g'));
  if p_expected is not null then
    select updated_at into old_updated from public.reading_sessions where id=sid and user_id=uid for update;
    if old_updated is null or old_updated<>p_expected then raise exception '记录已在另一台设备修改或删除，请刷新后再操作'; end if;
  elsif exists(select 1 from public.reading_sessions where id=sid and user_id=uid) then
    raise exception '阅读记录已存在，请刷新后再操作';
  end if;
  insert into public.books(user_id,identity_key,title,author,category)
    values(uid,book_identity,title_text,author_text,p_book->>'category')
    on conflict(user_id,identity_key) do update set category=excluded.category
    returning id into bid;
  if p_expected is not null then
    update public.reading_sessions set book_id=bid,started_on=(p_session->>'started_on')::date,finished_on=nullif(p_session->>'finished_on','')::date,notes=coalesce(p_session->>'notes','') where id=sid and user_id=uid;
  else
    insert into public.reading_sessions(id,user_id,book_id,started_on,finished_on,notes)
    values(sid,uid,bid,(p_session->>'started_on')::date,nullif(p_session->>'finished_on','')::date,coalesce(p_session->>'notes',''));
  end if;
  return sid;
end;
$$;
revoke all on function public.save_reading(jsonb,jsonb,timestamptz) from public,anon;
grant execute on function public.save_reading(jsonb,jsonb,timestamptz) to authenticated;

-- 追加导入：任何一条失败都会整体回滚；相同 ID 且内容相同的记录跳过。
create or replace function public.import_reading(p_data jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare
  uid uuid=auth.uid(); b jsonb; s jsonb; bid uuid; sid uuid;
  mapping jsonb='{}'::jsonb;
  existing public.reading_sessions%rowtype;
  identity_text text;
begin
  if uid is null then raise exception '请先登录'; end if;
  if jsonb_typeof(p_data->'books')<>'array' or jsonb_typeof(p_data->'sessions')<>'array' or jsonb_array_length(p_data->'books')>20000 or jsonb_array_length(p_data->'sessions')>50000 then raise exception '备份格式无效'; end if;
  for b in select value from jsonb_array_elements(p_data->'books') loop
    identity_text=lower(regexp_replace(normalize(trim(b->>'title'),NFKC),'\s+',' ','g')) || '|' || lower(regexp_replace(normalize(trim(coalesce(b->>'author','')),NFKC),'\s+',' ','g'));
    insert into public.books(user_id,identity_key,title,author,category)
      values(uid,identity_text,trim(b->>'title'),trim(coalesce(b->>'author','')),b->>'category')
      on conflict(user_id,identity_key) do update set identity_key=excluded.identity_key
      returning id into bid;
    mapping=mapping || jsonb_build_object(b->>'id',bid::text);
  end loop;
  for s in select value from jsonb_array_elements(p_data->'sessions') loop
    sid=(s->>'id')::uuid; bid=(mapping->>(s->>'book_id'))::uuid;
    if bid is null then raise exception '备份中的阅读记录缺少图书'; end if;
    select * into existing from public.reading_sessions where id=sid and user_id=uid;
    if found then
      if existing.book_id<>bid or existing.started_on<>(s->>'started_on')::date or existing.finished_on is distinct from nullif(s->>'finished_on','')::date or existing.notes<>coalesce(s->>'notes','') then
        raise exception '阅读记录 ID 冲突，导入已取消';
      end if;
    else
      insert into public.reading_sessions(id,user_id,book_id,started_on,finished_on,notes)
      values(sid,uid,bid,(s->>'started_on')::date,nullif(s->>'finished_on','')::date,coalesce(s->>'notes',''));
    end if;
  end loop;
end;
$$;
revoke all on function public.import_reading(jsonb) from public,anon;
grant execute on function public.import_reading(jsonb) to authenticated;
commit;
