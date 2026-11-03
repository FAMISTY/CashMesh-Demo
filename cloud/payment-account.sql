create or replace function cm_private.cm_cloud(action text, args jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
 u uuid := auth.uid(); b cm_private.cm_books; member cm_private.cm_members; pair cm_private.cm_pairs;
 r cm_private.cm_records; op jsonb; payload jsonb; rid text; expected bigint; opid uuid;
 code text; attempts integer; results jsonb := '[]'::jsonb; changes jsonb;
 c bigint := 0; next_cursor bigint := 0; amount numeric; label text;
begin
 if u is null then raise exception '请先连接设备' using errcode='42501'; end if;
 if jsonb_typeof(args)<>'object' or octet_length(args::text)>200000 then raise exception '请求过大或格式不正确'; end if;
 label := left(coalesce(nullif(args->>'label',''),'设备'),60);
 if action='create' then
  perform pg_advisory_xact_lock(hashtextextended(u::text,0));
  select * into member from cm_private.cm_members where user_id=u;
  if found then return jsonb_build_object('bookId',member.book_id); end if;
  insert into cm_private.cm_books(owner_id) values(u) returning * into b;
  insert into cm_private.cm_members(book_id,user_id,label) values(b.id,u,label);
  return jsonb_build_object('bookId',b.id);
 end if;
 if action='join' then
  insert into cm_private.cm_attempts(user_id,bucket,count) values(u,floor(extract(epoch from now())/600)::bigint,1)
   on conflict(user_id,bucket) do update set count=cm_private.cm_attempts.count+1 returning count into attempts;
  -- Return an error object so failed attempts commit their rate-limit counters.
  if attempts>10 then return jsonb_build_object('error','尝试次数过多，请10分钟后重试'); end if;
  code := upper(regexp_replace(coalesce(args->>'code',''),'[ -]','','g'));
  if code !~ '^[0-9A-F]{16}$' then return jsonb_build_object('error','请输入完整的16位配对码'); end if;
  select * into pair from cm_private.cm_pairs where code_hash=encode(sha256(convert_to(code,'UTF8')),'hex') for update;
  if not found or pair.used_at is not null or pair.expires_at<=now() then return jsonb_build_object('error','配对码无效、已使用或已过期'); end if;
  select * into member from cm_private.cm_members where user_id=u;
  if found then return jsonb_build_object('error','此设备已连接账本，请继续使用原账本'); end if;
  if (select count(*) from cm_private.cm_members where book_id=pair.book_id)>=10 then return jsonb_build_object('error','一本账本最多连接10台设备'); end if;
  insert into cm_private.cm_members(book_id,user_id,label) values(pair.book_id,u,label);
  update cm_private.cm_pairs set used_at=now() where code_hash=pair.code_hash;
  return jsonb_build_object('bookId',pair.book_id);
 end if;
 select * into member from cm_private.cm_members where user_id=u;
 if not found then raise exception '此设备未连接账本或已被移除' using errcode='42501'; end if;
 select * into b from cm_private.cm_books where id=member.book_id for update;
 if not exists(select 1 from cm_private.cm_members where book_id=b.id and user_id=u) then raise exception '设备已被移除' using errcode='42501'; end if;
 if action='pair' then
  delete from cm_private.cm_pairs where expires_at<now() or creator=u;
  code := upper(left(replace(gen_random_uuid()::text,'-',''),16));
  insert into cm_private.cm_pairs(code_hash,book_id,creator,expires_at) values(encode(sha256(convert_to(code,'UTF8')),'hex'),b.id,u,now()+interval '10 minutes');
  return jsonb_build_object('code',code,'expiresAt',now()+interval '10 minutes');
 elsif action='devices' then
  return jsonb_build_object('owner',b.owner_id=u,'devices',(select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'label',m.label,'self',m.user_id=u,'owner',m.user_id=b.owner_id,'connectedAt',m.created_at)),'[]'::jsonb) from cm_private.cm_members m where m.book_id=b.id));
 elsif action='revoke' then
  if b.owner_id<>u or args->>'userId'=u::text then raise exception '只能由账本创建者移除其他设备' using errcode='42501'; end if;
  delete from cm_private.cm_pairs where creator=(args->>'userId')::uuid and book_id=b.id;
  delete from cm_private.cm_members where book_id=b.id and user_id=(args->>'userId')::uuid;
  return jsonb_build_object('ok',true);
 elsif action='leave' then
  if b.owner_id=u then return jsonb_build_object('error','创建者请保留此设备，可在设备列表移除其他设备'); end if;
  delete from cm_private.cm_members where book_id=b.id and user_id=u;
  delete from cm_private.cm_pairs where book_id=b.id and creator=u;
  return jsonb_build_object('ok',true);
 elsif action<>'exchange' then raise exception '未知操作'; end if;
 if args ? 'cursor' then c := (args->>'cursor')::bigint; end if;
 if c<0 or c>b.revision then raise exception '同步位置无效，请重新拉取'; end if;
 if jsonb_typeof(coalesce(args->'ops','[]'::jsonb))<>'array' or jsonb_array_length(coalesce(args->'ops','[]'::jsonb))>100 then raise exception '一次最多同步100笔'; end if;
 for op in select value from jsonb_array_elements(coalesce(args->'ops','[]'::jsonb)) loop
  rid := op->>'id'; expected := (op->>'base')::bigint; opid := (op->>'op')::uuid;
  if rid is null or length(rid)<1 or length(rid)>200 or expected is null or expected<0 or opid is null then raise exception '记录标识无效'; end if;
  select * into r from cm_private.cm_records where book_id=b.id and record_id=rid;
  if r.last_op=opid then
   results := results || jsonb_build_array(jsonb_build_object('id',rid,'op',opid,'status','ok','revision',r.revision)); continue;
  end if;
  if coalesce(r.revision,0)<>expected then
   results := results || jsonb_build_array(jsonb_build_object('id',rid,'op',opid,'status','conflict','remote',to_jsonb(r))); continue;
  end if;
  payload := op->'data';
  if not coalesce((op->>'deleted')::boolean,false) then
   if jsonb_typeof(payload)<>'object' or octet_length(payload::text)>4000 or payload->>'id'<>rid or payload->>'id' is null then raise exception '记录格式无效'; end if;
   if coalesce(payload->>'kind','') not in ('expense','income','transfer','refund','repayment','statement') then raise exception '记录类型无效'; end if;
   amount := (payload->>'amount')::numeric;
   if amount is null or amount<=0 or amount>9007199254740991 or amount<>trunc(amount) then raise exception '金额无效'; end if;
   if coalesce(payload->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' or (payload->>'date')::date::text<>payload->>'date' then raise exception '日期无效'; end if;
   if length(coalesce(payload->>'platform','')) not between 1 and 80 then raise exception '平台无效'; end if;
   -- Only structured fields leave the device; reject raw OCR or arbitrary extra payload.
   payload := jsonb_build_object('id',rid,'kind',payload->>'kind','amount',amount,'date',payload->>'date','platform',left(payload->>'platform',80),'paymentAccount',left(regexp_replace(coalesce(payload->>'paymentAccount',r.payload->>'paymentAccount',''),'(?:[0-9][ -]?){4,}([0-9])[ -]?([0-9])[ -]?([0-9])[ -]?([0-9])','尾号\1\2\3\4','g'),120),'merchant',left(coalesce(payload->>'merchant',''),150),'settlement',case when payload->>'settlement'='credit' then 'credit' else 'cash' end,'destination',left(coalesce(payload->>'destination',''),80),'transactionId',left(coalesce(payload->>'transactionId',''),200),'sync',coalesce((payload->>'sync')::boolean,true),'createdAt',left(coalesce(payload->>'createdAt',''),40),'updatedAt',left(coalesce(payload->>'updatedAt',''),40));
  else payload := null; end if;
  if r.record_id is null and (select count(*) from cm_private.cm_records where book_id=b.id)>=10000 then raise exception '演示账本最多保存10000笔记录（含已删除记录）'; end if;
  b.revision := b.revision+1;
  insert into cm_private.cm_records(book_id,record_id,revision,payload,deleted,last_op) values(b.id,rid,b.revision,payload,coalesce((op->>'deleted')::boolean,false),opid)
   on conflict(book_id,record_id) do update set revision=excluded.revision,payload=excluded.payload,deleted=excluded.deleted,last_op=excluded.last_op;
  results := results || jsonb_build_array(jsonb_build_object('id',rid,'op',opid,'status','ok','revision',b.revision));
 end loop;
 update cm_private.cm_books set revision=b.revision where id=b.id;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.revision),'[]'::jsonb),coalesce(max(t.revision),c) into changes,next_cursor from (select cr.record_id,cr.revision,cr.payload,cr.deleted from cm_private.cm_records cr where cr.book_id=b.id and cr.revision>c order by cr.revision limit 500) t;
 return jsonb_build_object('results',results,'changes',changes,'cursor',next_cursor,'hasMore',next_cursor<b.revision);
end $$;
