-- =====================================================================
-- PlanejaIA — Teste das políticas de Row Level Security (RLS)
-- Execute no Supabase: SQL Editor > New query > Run (depois do schema.sql).
-- Tudo roda dentro de uma transação e é desfeito no final (ROLLBACK):
-- nenhum dado de teste fica no banco.
-- Se algum teste falhar, aparece um ERRO com a descrição do problema.
-- Se tudo passar, o resultado mostrado será "TODOS OS TESTES DE RLS PASSARAM".
-- =====================================================================
begin;

-- Dois usuários fictícios
insert into auth.users (id, email)
values ('11111111-1111-1111-1111-111111111111', 'teste-a@planejaia.local'),
       ('22222222-2222-2222-2222-222222222222', 'teste-b@planejaia.local');

-- Dados do usuário A (inseridos como administrador)
insert into public.projects (id, user_id, nome, data_inicio, prazo_final)
values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
        'Projeto do A', '2026-01-01', '2026-02-01');
insert into public.tasks (id, user_id, project_id, titulo)
values ('aaaaaaaa-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-0000-0000-0000-000000000001', 'Tarefa do A');

-- ---- Agora agimos como o usuário B (autenticado) ----
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true),
       set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);

do $$
declare n int;
begin
  -- 1. B não vê projetos nem tarefas de A
  select count(*) into n from public.projects;
  if n <> 0 then raise exception 'FALHOU: usuário B consegue ver projetos de A'; end if;
  select count(*) into n from public.tasks;
  if n <> 0 then raise exception 'FALHOU: usuário B consegue ver tarefas de A'; end if;

  -- 2. B não altera nem exclui registros de A (0 linhas afetadas)
  update public.projects set nome = 'invadido' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHOU: usuário B alterou projeto de A'; end if;
  update public.tasks set titulo = 'invadida' where id = 'aaaaaaaa-0000-0000-0000-0000000000a1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHOU: usuário B alterou tarefa de A'; end if;
  delete from public.tasks where id = 'aaaaaaaa-0000-0000-0000-0000000000a1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHOU: usuário B excluiu tarefa de A'; end if;
  delete from public.projects where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHOU: usuário B excluiu projeto de A'; end if;

  -- 3. B não cria registro em nome de A
  begin
    insert into public.projects (user_id, nome, data_inicio, prazo_final)
    values ('11111111-1111-1111-1111-111111111111', 'falso', '2026-01-01', '2026-01-02');
    raise exception 'FALHOU: usuário B criou projeto em nome de A';
  exception when insufficient_privilege then null; -- esperado (violação de RLS)
  end;

  -- 4. B não vincula tarefa ao projeto de A
  begin
    insert into public.tasks (titulo, project_id)
    values ('tentativa', 'aaaaaaaa-0000-0000-0000-000000000001');
    raise exception 'FALHOU: usuário B vinculou tarefa ao projeto de A';
  exception when foreign_key_violation then null; -- esperado
  end;

  -- 5. B consegue criar os próprios dados (user_id preenchido automaticamente)
  insert into public.projects (id, nome, data_inicio, prazo_final)
  values ('bbbbbbbb-0000-0000-0000-000000000001', 'Projeto do B', '2026-03-01', '2026-03-31');
  insert into public.tasks (titulo, project_id) values ('Tarefa do B', 'bbbbbbbb-0000-0000-0000-000000000001');
  insert into public.tasks (titulo) values ('Tarefa independente do B');
  select count(*) into n from public.tasks;
  if n <> 2 then raise exception 'FALHOU: usuário B deveria ver 2 tarefas próprias, viu %', n; end if;

  -- 6. Datas inconsistentes são rejeitadas
  begin
    insert into public.projects (nome, data_inicio, prazo_final) values ('datas', '2026-05-10', '2026-05-01');
    raise exception 'FALHOU: aceitou prazo final anterior à data de início';
  exception when check_violation then null; -- esperado
  end;

  -- 7. Prioridade e status inválidos são rejeitados
  begin
    insert into public.tasks (titulo, prioridade) values ('x', 'altissima');
    raise exception 'FALHOU: aceitou prioridade inválida';
  exception when check_violation then null;
  end;

  -- 8. concluida_em é preenchido ao concluir e limpo ao reabrir
  update public.tasks set status = 'concluida' where titulo = 'Tarefa do B';
  select count(*) into n from public.tasks where titulo = 'Tarefa do B' and concluida_em is not null;
  if n <> 1 then raise exception 'FALHOU: concluida_em não foi preenchido'; end if;
  update public.tasks set status = 'pendente' where titulo = 'Tarefa do B';
  select count(*) into n from public.tasks where titulo = 'Tarefa do B' and concluida_em is null;
  if n <> 1 then raise exception 'FALHOU: concluida_em não foi limpo ao reabrir'; end if;

  -- 9. Excluir projeto exclui as tarefas vinculadas, mas mantém as independentes
  delete from public.projects where id = 'bbbbbbbb-0000-0000-0000-000000000001';
  select count(*) into n from public.tasks;
  if n <> 1 then raise exception 'FALHOU: esperado 1 tarefa independente após excluir projeto, há %', n; end if;

  raise notice 'TODOS OS TESTES DE RLS PASSARAM';
end;
$$;

-- ---- Visitante não autenticado (anon) não acessa nada ----
reset role;
set local role anon;
do $$
begin
  perform count(*) from public.projects;
  raise exception 'FALHOU: visitante anônimo conseguiu consultar projetos';
exception when insufficient_privilege then
  raise notice 'OK: visitante anônimo bloqueado';
end;
$$;

reset role;
-- Se chegou até aqui, nenhuma verificação falhou
select 'TODOS OS TESTES DE RLS PASSARAM' as resultado;
rollback;
