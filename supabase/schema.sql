-- =====================================================================
-- PlanejaIA — Estrutura do banco de dados (Supabase / PostgreSQL)
-- Execute este arquivo inteiro no Supabase: SQL Editor > New query > Run
-- Pode ser executado mais de uma vez sem causar erro.
-- =====================================================================
-- As contas de usuário são gerenciadas pelo Supabase Auth (tabela auth.users).
-- Nenhuma senha é armazenada nas tabelas da aplicação.

-- ---------------------------------------------------------------------
-- Tabela de projetos
-- ---------------------------------------------------------------------
create table if not exists public.projects (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid()
                       references auth.users (id) on delete cascade,
  nome               text not null,
  descricao          text,
  objetivo           text,
  data_inicio        date not null,
  prazo_final        date not null,
  orcamento_previsto numeric(14, 2),
  status             text not null default 'planejamento',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint projects_nome_tamanho      check (char_length(btrim(nome)) between 1 and 120),
  constraint projects_descricao_tamanho check (descricao is null or char_length(descricao) <= 2000),
  constraint projects_objetivo_tamanho  check (objetivo is null or char_length(objetivo) <= 1000),
  constraint projects_datas_validas     check (prazo_final >= data_inicio),
  constraint projects_orcamento_valido  check (orcamento_previsto is null or orcamento_previsto >= 0),
  constraint projects_status_valido     check (status in ('planejamento', 'em_andamento', 'concluido', 'cancelado')),
  -- Permite que as tarefas referenciem (id, user_id), garantindo o mesmo dono
  constraint projects_id_user_unique    unique (id, user_id)
);

create index if not exists projects_user_id_idx on public.projects (user_id);

-- ---------------------------------------------------------------------
-- Tabela de tarefas
-- ---------------------------------------------------------------------
create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid()
                 references auth.users (id) on delete cascade,
  project_id   uuid,                     -- pode ser nulo: tarefa independente
  titulo       text not null,
  descricao    text,
  prazo        date,
  prioridade   text not null default 'media',
  status       text not null default 'pendente',
  concluida_em timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint tasks_titulo_tamanho    check (char_length(btrim(titulo)) between 1 and 200),
  constraint tasks_descricao_tamanho check (descricao is null or char_length(descricao) <= 2000),
  constraint tasks_prioridade_valida check (prioridade in ('baixa', 'media', 'alta', 'urgente')),
  constraint tasks_status_valido     check (status in ('pendente', 'em_andamento', 'concluida')),
  -- Chave estrangeira composta: a tarefa só pode apontar para um projeto do MESMO usuário.
  -- Ao excluir o projeto, as tarefas vinculadas também são excluídas.
  constraint tasks_project_fk foreign key (project_id, user_id)
    references public.projects (id, user_id) on delete cascade
);

create index if not exists tasks_user_id_idx    on public.tasks (user_id);
create index if not exists tasks_project_id_idx on public.tasks (project_id);
create index if not exists tasks_prazo_idx      on public.tasks (user_id, prazo);

-- ---------------------------------------------------------------------
-- Atualização automática de updated_at e concluida_em
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.set_task_completed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'concluida' and (tg_op = 'INSERT' or old.status is distinct from 'concluida') then
    new.concluida_em := now();
  elsif new.status <> 'concluida' then
    new.concluida_em := null;
  end if;
  return new;
end;
$$;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

drop trigger if exists tasks_set_completed_at on public.tasks;
create trigger tasks_set_completed_at
  before insert or update of status on public.tasks
  for each row execute function public.set_task_completed_at();

-- ---------------------------------------------------------------------
-- Segurança: Row Level Security (RLS)
-- Cada usuário só enxerga e altera os próprios registros.
-- ---------------------------------------------------------------------
alter table public.projects enable row level security;
alter table public.tasks    enable row level security;

-- Visitantes não autenticados não têm nenhum acesso
revoke all on public.projects from anon;
revoke all on public.tasks    from anon;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.tasks    to authenticated;

-- Projetos
drop policy if exists "projetos: ver os próprios"     on public.projects;
drop policy if exists "projetos: criar os próprios"   on public.projects;
drop policy if exists "projetos: editar os próprios"  on public.projects;
drop policy if exists "projetos: excluir os próprios" on public.projects;

create policy "projetos: ver os próprios" on public.projects
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "projetos: criar os próprios" on public.projects
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "projetos: editar os próprios" on public.projects
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "projetos: excluir os próprios" on public.projects
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Tarefas
drop policy if exists "tarefas: ver as próprias"     on public.tasks;
drop policy if exists "tarefas: criar as próprias"   on public.tasks;
drop policy if exists "tarefas: editar as próprias"  on public.tasks;
drop policy if exists "tarefas: excluir as próprias" on public.tasks;

create policy "tarefas: ver as próprias" on public.tasks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "tarefas: criar as próprias" on public.tasks
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "tarefas: editar as próprias" on public.tasks
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "tarefas: excluir as próprias" on public.tasks
  for delete to authenticated using ((select auth.uid()) = user_id);
