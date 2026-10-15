# PlanejaIA

Sistema web de gerenciamento de projetos e tarefas com assistente de Inteligência Artificial, feito para pequenos empreendedores.

- **Front-end:** React + Vite (pasta `client/`)
- **Back-end:** Node.js + Express (pasta `server/`)
- **Banco de dados e login:** Supabase (PostgreSQL + Supabase Auth + Row Level Security)
- **IA:** Google Gemini, acessado **somente pelo servidor**

---

## Sumário

1. [Estrutura do projeto](#1-estrutura-do-projeto)
2. [Pré-requisitos](#2-pré-requisitos)
3. [Configurar o Supabase](#3-configurar-o-supabase)
4. [Obter a chave do Gemini](#4-obter-a-chave-do-gemini)
5. [Instalar e executar](#5-instalar-e-executar)
6. [Funcionalidades implementadas](#6-funcionalidades-implementadas)
7. [Como testar](#7-como-testar)
8. [Publicar na internet](#8-publicar-na-internet)
9. [Segurança](#9-segurança)
10. [Limitações conhecidas](#10-limitações-conhecidas)
11. [Problemas comuns](#11-problemas-comuns)

---

## 1. Estrutura do projeto

```
planejaia/
├── client/                    # Front-end (React + Vite)
│   ├── src/
│   │   ├── pages/             # Telas: acesso, painel, projetos, tarefas, assistente, configurações
│   │   ├── components/        # Componentes reutilizáveis (formulários, listas, modais...)
│   │   │   └── ai/            # Componentes de exibição/revisão das respostas da IA
│   │   ├── context/           # Sessão do usuário e mensagens (toasts)
│   │   ├── services/api.js    # Comunicação com o back-end
│   │   ├── lib/supabase.js    # Cliente do Supabase (somente login/sessão)
│   │   ├── utils/             # Datas, rótulos e validações
│   │   └── styles.css         # Visual (responsivo)
│   └── .env.example
├── server/                    # Back-end (Node.js + Express)
│   ├── src/
│   │   ├── routes/            # Rotas: projetos, tarefas, painel, IA
│   │   ├── services/          # Integração com o Gemini (cliente, prompts, validação das respostas)
│   │   ├── middleware/        # Autenticação, limite de uso, tratamento de erros
│   │   ├── utils/             # Validações e mensagens de erro
│   │   ├── lib/supabase.js    # Cliente do Supabase com as permissões do usuário
│   │   ├── app.js             # Montagem do aplicativo Express
│   │   └── index.js           # Inicialização do servidor
│   ├── test/                  # Testes automatizados
│   └── .env.example
├── .github/workflows/       # Publicação automática no GitHub Pages
├── render.yaml              # Configuração do servidor no Render
├── supabase/
│   ├── schema.sql             # Tabelas, relacionamentos, restrições e políticas RLS
│   └── rls_test.sql           # Script de teste das políticas de segurança
└── package.json               # Atalhos para instalar e rodar tudo
```

**Como os dados circulam:** o navegador faz login direto no Supabase Auth e recebe um token. Todas as operações com projetos, tarefas e IA passam pelo back-end, que valida o token, valida os dados e acessa o banco **como o próprio usuário** — por isso as políticas de RLS do banco também se aplicam (dupla proteção).

---

## 2. Pré-requisitos

- **Node.js 20 ou mais novo** — baixe a versão "LTS" em <https://nodejs.org>. Para conferir, abra o terminal e digite `node -v`.
- Uma conta gratuita no **Supabase** — <https://supabase.com>
- Uma chave de API do **Google Gemini** — <https://aistudio.google.com/apikey>

> No Windows, use o **PowerShell** ou o terminal do **VS Code** (menu *Terminal > New Terminal*) para rodar os comandos abaixo.

---

## 3. Configurar o Supabase

1. Entre em <https://supabase.com>, clique em **New project**, escolha um nome (ex.: `planejaia`), uma senha para o banco e a região **South America (São Paulo)**. Aguarde a criação.
2. **Criar as tabelas:** no menu lateral, abra **SQL Editor > New query**, copie todo o conteúdo do arquivo `supabase/schema.sql`, cole e clique em **Run**. Deve aparecer "Success".
3. **(Recomendado) Testar a segurança:** abra outra query, cole o conteúdo de `supabase/rls_test.sql` e clique em **Run**. O resultado deve mostrar `TODOS OS TESTES DE RLS PASSARAM` (se algo falhar, aparece um erro em vermelho explicando o problema). O script desfaz tudo no final, sem deixar dados de teste.
4. **Pegar as chaves:** vá em **Project Settings > API** (ou **Data API / API Keys**) e copie:
   - **Project URL** → será `SUPABASE_URL` e `VITE_SUPABASE_URL`
   - **anon public key** (chave pública) → será `SUPABASE_ANON_KEY` e `VITE_SUPABASE_ANON_KEY`
   > Nunca use a chave `service_role` neste projeto.
5. **Endereços de login:** em **Authentication > URL Configuration**:
   - **Site URL:** `http://localhost:5173` (depois troque pelo endereço publicado)
   - **Redirect URLs:** adicione `http://localhost:5173/**` (e depois o endereço publicado + `/**`)
6. **Confirmação de e-mail (opcional):** em **Authentication > Sign In / Providers > Email**, a opção *Confirm email* vem ligada. Com ela ligada, o usuário precisa clicar no link do e-mail antes de entrar. Para testar mais rápido, você pode desligá-la.
   > O e-mail gratuito do Supabase tem limite baixo de envios por hora. Para uso real, configure um SMTP próprio em **Authentication > Emails > SMTP Settings**.

---

## 4. Obter a chave do Gemini

1. Acesse <https://aistudio.google.com/apikey> com sua conta Google.
2. Clique em **Create API key** e copie a chave.
3. Ela vai **somente** no arquivo `server/.env` (variável `GEMINI_API_KEY`). Nunca coloque essa chave no `client/.env`, no código React ou no GitHub.

O modelo padrão é `gemini-flash-latest`, que aponta sempre para o modelo Flash mais recente. Se quiser fixar um modelo específico, altere `GEMINI_MODEL` no `server/.env` (veja a lista em <https://ai.google.dev/gemini-api/docs/models>).

---

## 5. Instalar e executar

### 5.1 Instalar as dependências

Na pasta `planejaia`, rode:

```bash
npm run install:all
```

### 5.2 Criar os arquivos de configuração

Copie os modelos e preencha com os seus valores:

```bash
# Windows (PowerShell)
copy server\.env.example server\.env
copy client\.env.example client\.env

# macOS / Linux
cp server/.env.example server/.env
cp client/.env.example client/.env
```

**`server/.env`**

| Variável | O que colocar |
|---|---|
| `PORT` | `3001` |
| `CLIENT_ORIGIN` | `http://localhost:5173` |
| `SUPABASE_URL` | Project URL do Supabase |
| `SUPABASE_ANON_KEY` | anon public key do Supabase |
| `GEMINI_API_KEY` | sua chave do Gemini |
| `GEMINI_MODEL` | `gemini-flash-latest` |
| `AI_RATE_LIMIT` | pedidos à IA por usuário a cada 10 min (padrão 20) |
| `AI_DEMO_MODE` | `false` (veja abaixo) |

**`client/.env`**

| Variável | O que colocar |
|---|---|
| `VITE_SUPABASE_URL` | Project URL do Supabase |
| `VITE_SUPABASE_ANON_KEY` | anon public key do Supabase |
| `VITE_API_URL` | deixe **vazio** em desenvolvimento |

### 5.3 Rodar

```bash
npm run dev
```

Isso inicia o back-end (porta 3001) e o front-end (porta 5173) juntos. Abra <http://localhost:5173>, clique em **Criar conta** e comece a usar.

> **Sem chave de IA?** O sistema funciona normalmente e a tela do assistente informa que ele está indisponível. Se quiser apenas ver como a tela funciona, coloque `AI_DEMO_MODE=true` no `server/.env`: as respostas serão exemplos fixos, **claramente marcados como DEMONSTRAÇÃO**. Quando há `GEMINI_API_KEY`, o modo demonstração é ignorado.

---

## 6. Funcionalidades implementadas

**Acesso**
- Entrar, criar conta, recuperar senha por e-mail e criar nova senha
- Cada usuário vê e altera somente os próprios dados (validação no servidor + RLS no banco)

**Painel**
- Indicadores calculados com os dados reais: projetos, tarefas pendentes, em andamento, concluídas e atrasadas (cada indicador abre a lista filtrada)
- Próximas tarefas com prazo, tarefas atrasadas em destaque e projetos em andamento com progresso
- Atalhos para novo projeto, nova tarefa e assistente de IA
- Estado vazio com instruções para começar

**Projetos**
- Criar, ver detalhes, editar e excluir (com confirmação, avisando quantas tarefas serão excluídas junto)
- Campos: nome, descrição, objetivo, data de início, prazo final, orçamento, status, data de criação
- Validação de campos obrigatórios e de datas (prazo final não pode ser anterior ao início) — no navegador, no servidor e no banco
- Página de detalhes com tarefas vinculadas, contagem de concluídas/pendentes/atrasadas, barra de progresso (concluídas ÷ total), botão para adicionar tarefa e botão para pedir ajuda da IA
- Filtro por status

**Tarefas**
- Criar (com ou sem projeto), editar, concluir, reabrir, iniciar e excluir (com confirmação)
- Prioridades: baixa, média, alta, urgente — Status: pendente, em andamento, concluída
- Filtros por projeto (incluindo "sem projeto"), status, prioridade e "somente atrasadas"; ordenação por prazo
- Tarefas atrasadas (prazo passado e não concluídas) destacadas automaticamente
- Filtros ficam no endereço da página (podem ser salvos nos favoritos)

**Assistente de IA (Gemini)**
- A. Criar plano de ação (objetivo, etapas, tarefas com descrição, ordem, prioridade, prazo sugerido marcado como estimativa, riscos, recomendações e informações que faltam)
- B. Organizar tarefas (ordem sugerida, dependências e foco imediato)
- C. Identificar riscos (prazos apertados, concentração, etapas faltando, dependências, falta de informação) — apresentados como possibilidades
- D. Replanejar (mostra "antes → depois" de prazos e prioridades, permite ajustar e aplica só o que for aprovado; informa exatamente o que foi e o que não foi salvo)
- E. Resumir o andamento (com botão para copiar)
- F. Textos de divulgação editáveis, com botão para copiar
- Seletor de projeto ou plano livre; opção de criar um novo projeto a partir do plano
- Revisar, editar, selecionar, descartar e confirmar antes de salvar — **a IA nunca grava nada sozinha**
- Indicador de carregamento e mensagens claras para: falta de configuração, falha de conexão, tempo esgotado, limite de uso, chave inválida, modelo inexistente, serviço fora do ar e resposta inválida

**Configurações**
- Ver dados da conta, alterar nome e senha, sair, informações de privacidade e uso da IA

**Interface**
- Responsiva (computador e celular), menu lateral que vira menu "hambúrguer" no celular
- Cores para prioridades e status, mensagens de sucesso/erro, carregamento e estados vazios

---

## 7. Como testar

### 7.1 Testes automatizados (back-end)

```bash
npm test
```

Executa 28 testes que verificam: validações, datas inconsistentes, cálculo de atrasos e progresso, indicadores do painel, remoção de dados sensíveis antes do envio à IA, tratamento de todas as falhas da API do Gemini (sem chave, chave inválida, limite de uso, indisponibilidade, falha de conexão, tempo esgotado, resposta inválida, conteúdo bloqueado), solicitações vazias/inválidas e bloqueio de acesso sem login.

Existe também um **teste de integração** (`server/test/api.integration.test.js`) que roda o fluxo completo contra um PostgreSQL real com o `schema.sql` e o RLS (criar/editar/excluir projetos e tarefas, filtros, painel, IA sem gravação automática, cadastro só das tarefas confirmadas e isolamento entre dois usuários). Ele é ignorado automaticamente, a menos que as variáveis `TEST_POSTGREST_URL` e `TEST_JWT_SECRET` apontem para um PostgREST de teste — é um teste para desenvolvedores, não é necessário para usar o sistema.

### 7.2 Teste de segurança do banco

Rode `supabase/rls_test.sql` no SQL Editor do Supabase (passo 3.3).

### 7.3 Roteiro de testes manuais

Marque cada item ao testar:

**Projetos**
- [ ] Criar um projeto
- [ ] Tentar salvar com prazo final antes do início (deve mostrar erro)
- [ ] Editar os dados e ver os detalhes
- [ ] Excluir (deve pedir confirmação) e conferir que o painel atualizou

**Tarefas**
- [ ] Criar uma tarefa vinculada a um projeto e outra independente
- [ ] Alterar prioridade e prazo
- [ ] Concluir e reabrir (o progresso do projeto deve mudar)
- [ ] Usar os filtros; criar uma tarefa com prazo no passado e ver o destaque de atrasada

**IA**
- [ ] Gerar um plano a partir de uma descrição
- [ ] Editar uma sugestão, descartar outra e desmarcar uma terceira
- [ ] Confirmar e verificar que só as tarefas selecionadas foram cadastradas
- [ ] Enviar o pedido vazio (deve mostrar aviso)
- [ ] Apagar a `GEMINI_API_KEY`, reiniciar o servidor e ver o aviso de indisponibilidade
- [ ] Com a chave errada, ver a mensagem de chave inválida
- [ ] Abrir o navegador em *F12 > Network*, fazer um pedido à IA e confirmar que a chave **não** aparece em nenhuma requisição (o navegador só fala com `/api/ai/...`)

**Contas**
- [ ] Entrar e sair
- [ ] Criar uma segunda conta e confirmar que ela não vê os projetos da primeira

**Interface**
- [ ] Abrir no celular (ou *F12 > ícone de celular*) e navegar por todas as telas
- [ ] Atualizar a página (F5) e conferir que os dados continuam lá

---

## 8. Publicar na internet

O site fica dividido em duas partes, as duas gratuitas:

- **Telas (front-end):** GitHub Pages → `https://SEU-USUARIO.github.io/planejaia/`
- **Servidor (back-end, com a chave do Gemini):** Render → `https://planejaia-api.onrender.com`

O GitHub Pages só hospeda arquivos estáticos; por isso o servidor precisa ficar no Render.

### 8.1 Enviar o código ao GitHub

1. Instale o Git, se ainda não tiver: <https://git-scm.com/download/win> (pode aceitar todas as opções padrão).
2. Em <https://github.com/new>, crie um repositório chamado **planejaia**. Deixe-o **vazio** (sem README, sem .gitignore).
3. No PowerShell, dentro da pasta do projeto:

```bash
git init
git add .
git status
```

Confira na lista do `git status` que **nenhum arquivo `.env`** aparece (só `.env.example`). Depois:

```bash
git commit -m "PlanejaIA"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/planejaia.git
git push -u origin main
```

Na primeira vez o Git abre uma janela para você entrar na sua conta do GitHub.

> O repositório pode ser público: ele não contém nenhuma chave secreta. A chave do Gemini fica só no Render.

### 8.2 Servidor no Render

1. Crie uma conta em <https://render.com> (pode entrar com o GitHub).
2. Clique em **New > Blueprint** e escolha o repositório **planejaia**. O Render lê o arquivo `render.yaml`.
3. Ele vai pedir os valores:
   - `CLIENT_ORIGIN` → `https://SEU-USUARIO.github.io` (**sem** `/planejaia` e sem barra no final)
   - `SUPABASE_URL` → a URL do seu projeto Supabase
   - `SUPABASE_ANON_KEY` → a chave publishable (`sb_publishable_...`)
   - `GEMINI_API_KEY` → sua chave do Gemini
4. Clique em **Apply** e espere o deploy terminar (alguns minutos).
5. Copie o endereço do serviço (ex.: `https://planejaia-api.onrender.com`) e teste abrindo `.../api/health` no navegador. Deve aparecer `{"ok":true}`.

> No plano gratuito, o servidor "dorme" após ~15 minutos sem uso. O primeiro acesso depois disso pode demorar cerca de 1 minuto; os seguintes são rápidos.

### 8.3 Telas no GitHub Pages

1. No repositório do GitHub, vá em **Settings > Pages** e, em **Source**, escolha **GitHub Actions**.
2. Vá em **Settings > Secrets and variables > Actions**, abra a aba **Variables** e crie três variáveis (**New repository variable**):
   - `SUPABASE_URL` → a URL do Supabase
   - `SUPABASE_ANON_KEY` → a chave publishable
   - `API_URL` → o endereço do Render (sem barra no final)
3. Vá na aba **Actions**, clique em **Publicar no GitHub Pages** e em **Run workflow** (das próximas vezes, ele roda sozinho a cada `git push`).
4. Quando ficar verde, o site estará em `https://SEU-USUARIO.github.io/planejaia/`.

### 8.4 Ajustar o Supabase

Em **Authentication > URL Configuration**:
- **Site URL:** `https://SEU-USUARIO.github.io/planejaia/`
- **Redirect URLs:** adicione `https://SEU-USUARIO.github.io/planejaia/**` (mantenha também `http://localhost:5173/**` para continuar testando no seu computador)

Pronto: é só mandar o link para o seu amigo criar a conta dele. Cada pessoa vê apenas os próprios projetos.

### 8.5 Atualizar o site depois

Depois de qualquer alteração no código:

```bash
git add .
git commit -m "descreva a mudança"
git push
```

O GitHub Pages e o Render se atualizam sozinhos em alguns minutos.

### Alternativa: Vercel

Se preferir, as telas também podem ir para a Vercel em vez do GitHub Pages: importe o repositório em <https://vercel.com>, escolha **Root Directory** `client` e cadastre `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e `VITE_API_URL`. Nesse caso, use o endereço da Vercel no `CLIENT_ORIGIN` do Render e no Supabase.

---

## 9. Segurança

- **Senhas:** gerenciadas pelo Supabase Auth; nenhuma tabela da aplicação guarda senhas.
- **Isolamento entre contas:** o servidor exige token válido e filtra por usuário; o banco aplica RLS em todas as operações; a chave estrangeira composta `(project_id, user_id)` impede vincular tarefa a projeto de outra pessoa; visitantes sem login não têm permissão nas tabelas.
- **Chave da IA:** existe apenas no `server/.env` / variáveis do Render. O front-end nunca a recebe.
- **Privacidade na IA:** só são enviados o texto do pedido e os dados de projeto/tarefas necessários. E-mail, nome e IDs internos não são enviados (as tarefas viajam como T1, T2...). E-mails, telefones, CPF/CNPJ, números de cartão e senhas digitados no pedido são removidos antes do envio.
- **Respostas da IA:** validadas no servidor (formato, prioridades, datas, referências a tarefas) antes de chegar à tela; nada é salvo sem confirmação.
- **Limites:** até `AI_RATE_LIMIT` pedidos de IA por usuário a cada 10 minutos; corpo das requisições limitado a 200 KB.
- **Honestidade:** o sistema só mostra "salvo" quando o banco confirma a gravação; em operações em lote, informa exatamente o que foi e o que não foi salvo.

---

## 10. Limitações conhecidas

- O limite de pedidos à IA fica na memória do servidor: é zerado quando o servidor reinicia e não é compartilhado se houver mais de uma instância.
- A remoção automática de dados sensíveis usa padrões (e-mail, telefone, CPF, cartão etc.) e pode não reconhecer todos os formatos. Por isso a tela orienta o usuário a não digitar esses dados.
- A IA pode errar ou sugerir prazos irreais; as sugestões são sempre apresentadas para revisão.
- Para análise, o assistente considera até 80 tarefas por pedido (as de prazo mais próximo).
- As listas não têm paginação (até 1.000 tarefas por consulta), suficiente para o uso de um pequeno negócio.
- Excluir um projeto exclui as tarefas vinculadas (o aviso aparece na confirmação).
- O "hoje" usado para calcular atrasos é a data do computador/celular do usuário.
- Não há exclusão da própria conta pela tela de configurações (pode ser feita pelo painel do Supabase em *Authentication > Users*).
- O plano gratuito do Gemini tem limites de uso por minuto/dia; quando atingidos, o sistema mostra a mensagem de limite.

---

## 11. Problemas comuns

| Sintoma | Solução |
|---|---|
| Tela "Configuração necessária" | Falta o `client/.env` ou as variáveis `VITE_SUPABASE_*`. Depois de criar, pare e rode `npm run dev` de novo. |
| O servidor fecha dizendo para configurar o Supabase | Preencha `SUPABASE_URL` e `SUPABASE_ANON_KEY` no `server/.env`. |
| "Não foi possível conectar ao servidor" | O back-end não está rodando, ou `VITE_API_URL` está errado. |
| "Sua sessão expirou" em todas as telas | As chaves do Supabase do `client/.env` e do `server/.env` são de projetos diferentes. |
| Erro ao salvar projeto/tarefa ("permissão") | O `schema.sql` não foi executado por completo. Rode-o de novo (ele pode ser executado várias vezes). |
| "O modelo configurado não foi encontrado" | Verifique `GEMINI_MODEL` no `server/.env`. |
| "A chave de acesso da IA é inválida" | Confira a `GEMINI_API_KEY` (sem espaços ou aspas). |
| Não recebo o e-mail de confirmação/recuperação | Veja o spam; o e-mail gratuito do Supabase tem poucos envios por hora. Para testes, desligue *Confirm email*. |
| Erro de CORS no navegador (produção) | `CLIENT_ORIGIN` no Render deve ser exatamente `https://SEU-USUARIO.github.io` — sem `/planejaia` e sem `/` no final. |
| Site do Pages abre em branco ou com erro 404 nos arquivos | Confira se **Settings > Pages > Source** está em **GitHub Actions** e se o workflow terminou verde. |
| A publicação no Actions falha em "Verificar configuração" | Faltam as variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY` ou `API_URL` em **Settings > Secrets and variables > Actions > Variables**. |
| Primeiro acesso demora ~1 minuto | Normal no plano gratuito do Render: o servidor estava "dormindo". |
