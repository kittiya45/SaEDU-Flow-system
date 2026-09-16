-- schema-snapshot.sql — คิวรีที่ใช้ดึงโครงสร้างฐานข้อมูลจริงมาเป็น JSON สำหรับ schema.json
-- รันใน Supabase Dashboard → SQL Editor แล้วนำผลลัพธ์ (คอลัมน์ snapshot) มาปรับเป็น schema.json
-- (schema.json เก็บแบบย่อ: columns = [ชื่อ, ชนิด, notnull, default, หมายเหตุ] และมีคำอธิบายภาษาไทยที่เขียนเพิ่มด้วยมือ
--  จึงไม่ได้แทนที่ทั้งไฟล์อัตโนมัติ — ใช้ผลคิวรีนี้เทียบว่าตาราง/คอลัมน์/ฟังก์ชัน/นโยบายใดเพิ่มหรือหายไป)
select json_build_object(
  'tables', (
    select json_agg(t order by t.table_name) from (
      select c.relname as table_name, obj_description(c.oid) as comment, c.relrowsecurity as rls_enabled,
        (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policy_count,
        (select json_agg(json_build_object('name', a.attname, 'type', format_type(a.atttypid, a.atttypmod), 'notnull', a.attnotnull,
                 'default', pg_get_expr(d.adbin, d.adrelid), 'comment', col_description(c.oid, a.attnum)) order by a.attnum)
           from pg_attribute a left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
          where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped) as columns,
        (select json_agg(json_build_object('name', con.conname, 'def', pg_get_constraintdef(con.oid)) order by con.conname)
           from pg_constraint con where con.conrelid = c.oid and con.contype in ('p', 'u', 'c')) as constraints
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r') t),
  'fks', (select json_agg(json_build_object('table', c.relname, 'name', con.conname, 'def', pg_get_constraintdef(con.oid)) order by c.relname, con.conname)
            from pg_constraint con join pg_class c on c.oid = con.conrelid join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and con.contype = 'f'),
  'views', (select json_agg(json_build_object('name', table_name, 'def', pg_get_viewdef(('public.' || table_name)::regclass, true))) from information_schema.views where table_schema = 'public'),
  'functions', (select json_agg(json_build_object('name', p.proname, 'args', pg_get_function_identity_arguments(p.oid), 'returns', pg_get_function_result(p.oid), 'secdef', p.prosecdef) order by p.proname)
                  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'),
  'policies', (select json_agg(json_build_object('table', tablename, 'name', policyname, 'cmd', cmd) order by tablename, cmd, policyname) from pg_policies where schemaname = 'public'),
  'indexes', (select json_agg(json_build_object('table', tablename, 'name', indexname, 'def', indexdef) order by tablename, indexname) from pg_indexes where schemaname = 'public'),
  'buckets', (select json_agg(json_build_object('id', id, 'public', public, 'file_size_limit', file_size_limit)) from storage.buckets),
  'extensions', (select json_agg(extname order by extname) from pg_extension)
) as snapshot;
