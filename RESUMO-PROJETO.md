# PWA Vendas - Resumo do Projeto

## O que é
App PWA offline-first para equipe de vendas em campo. O vendedor cadastra clientes, registra visitas com GPS/foto/áudio, gerencia negócios (funil de vendas) e tudo sincroniza com Supabase quando volta online.

---

## Stack
- **Frontend**: React + Vite + Tailwind CSS
- **Offline**: IndexedDB (dados locais) + Service Worker (cache do app)
- **Backend**: Supabase direto (sem servidor intermediário)
- **Auth**: Supabase Auth (email/senha)
- **Deploy**: Railway (Dockerfile + Caddy) → URL gerada em `*.up.railway.app`
- **Repositório**: `https://github.com/hfhdot/vendas-pwa`

---

## O que foi feito

### Fase 1 - Frontend offline-first
- [x] Projeto Vite + React + Tailwind
- [x] IndexedDB com 7 stores (clientes, propriedades, pessoas, maquinas, visitas, negocios, logs)
- [x] Captura de GPS e câmera (foto comprimida)
- [x] Transcrição por áudio (Web Speech API) nos campos de resumo/próximos passos
- [x] Service Worker para funcionar offline

### Fase 2 - Telas do vendedor
- [x] **Login** - Supabase Auth com tabela `vendedores` (independente de `Tecnicos`)
- [x] **Dashboard** - KPIs (visitas hoje/semana/mês, pipeline, contatos atrasados/próximos)
- [x] **Clientes** - Lista de propriedades (do Supabase tabela "Clientes"), agrupamento por dono quando há múltiplas, agenda de contatos no topo
- [x] **Propriedades** - Cadastro vinculado a cliente/dono
- [x] **Pessoas** - Contatos da propriedade (pode criar inline na visita)
- [x] **Máquinas** - Cadastro com tipos do catálogo (21 tipos) e marcas (7 marcas), pode criar inline na visita
- [x] **Visitas** - Check-in com GPS, foto, áudio, tipos (presencial/mensagem/telefonema/email), data retroativa, vinculação de negócio, acionamento pós-vendas, próximo contato planejado
- [x] **Negócios** - Funil de vendas com produtos (tipo+marca+modelo), motivo de perda estruturado com sub-campos, edição completa

### Fase 3 - Funcionalidades avançadas
- [x] **Visita retroativa** - campo data/hora editável, flag automática se >5min no passado
- [x] **Edição de visitas** - todos os campos editáveis por 48h, com log de alteração
- [x] **Edição de negócios** - sem limite de tempo, log de alteração
- [x] **Motivo de perda** - dropdown com 8 categorias + sub-campos dinâmicos (ex: Concorrência → nome do concorrente, condições, valor)
- [x] **Produtos no negócio** - multi-select com tipo + marca + modelo
- [x] **Acionar Pós Vendas** - botão na visita quando seleciona máquina, gera log separado
- [x] **Logs de auditoria** - toda ação (criar/alterar/excluir) gera log com data/hora/vendedor/detalhes

### Fase 4 - Dashboard do Supervisor
- [x] **Login separado** - Supabase Auth com tabela `supervisores`
- [x] **Overview** - KPIs gerais (visitas, pipeline, fechados, retroativas, pós-vendas pendentes)
- [x] **Vendedores** - métricas por vendedor (visitas semana, pipeline, dias sem visita)
- [x] **Visitas** - lista com filtros (vendedor, tipo, período, só retroativas)
- [x] **Pós Vendas** - fila com botão resolver/reabrir
- [x] **Alertas** - presenciais sem GPS, retroativas, vendedores inativos

### Fase 5 - Polimento mobile
- [x] Ícones PWA (SVG + gerador de PNG)
- [x] Splash screen com animação
- [x] Meta tags PWA completas (iOS + Android)
- [x] Máscaras CPF/CNPJ e telefone
- [x] Pull-to-refresh em todas as telas
- [x] Confirmação antes de deletar (modal)
- [x] Animações (fade-in, slide-up, scale-in)
- [x] Empty states com ícones e ação rápida

### Fase 6 - Sync e Deploy
- [x] Sync engine: push (IndexedDB → Supabase) + pull (Supabase → IndexedDB)
- [x] Sync automático ao voltar online + botão manual
- [x] Indicador visual de sync + contador de pendências
- [x] Deploy no Railway via Dockerfile (multi-stage Node 20 + Caddy)
- [x] Caddyfile com try_files para SPA routing e cache headers para PWA

---

## Estrutura do Supabase

### Tabelas existentes (reaproveitadas)
| Tabela | Uso no app |
|---|---|
| `"Clientes"` | Propriedades (nome_fantasia, cnpj_cpf, cidade, estado, etc.) |

### Tabelas criadas
| Tabela | Função |
|---|---|
| `vendedores` | Vendedores do app (auth_uid, nome, email) - **INDEPENDENTE de Tecnicos** |
| `supervisores` | Supervisores (auth_uid, nome, email) |
| `clientes_vendas` | Donos/empresas dos clientes |
| `pessoas` | Contatos das propriedades |
| `maquinas` | Máquinas das propriedades |
| `visitas` | Check-ins com GPS, foto, tipo, retroativa, pós-vendas |
| `negocios` | Funil de vendas com produtos e motivo de perda |
| `audit_logs_vendas` | Logs de auditoria |
| `gps_rastreador` | Preparação futura para rastreador veicular |

### Views
| View | Função |
|---|---|
| `vw_visitas_detalhadas` | Visitas com nome do vendedor, cliente e propriedade |
| `vw_negocios_detalhados` | Negócios com nome do vendedor e cliente |

### Mapeamento IndexedDB ↔ Supabase
| IndexedDB | Supabase |
|---|---|
| `clientes` | `clientes_vendas` |
| `propriedades` | `"Clientes"` |
| `pessoas` | `pessoas` |
| `maquinas` | `maquinas` |
| `visitas` | `visitas` |
| `negocios` | `negocios` |
| `logs` | `audit_logs_vendas` |

---

## Situação atual

### ✅ Funcionando
- App no ar via Railway (URL `*.up.railway.app` gerada no dashboard)
- Login de teste (sem auth) funciona
- Todas as telas do vendedor funcionam offline (IndexedDB)
- Dashboard do supervisor funciona
- Supervisor logado em `/supervisor/login`
- Deploy automático via git push (Railway detecta o Dockerfile)

### 🔧 Em andamento
- **Tabela `vendedores`** - SQL criado mas FK com erro por dados existentes apontando para Tecnicos
  - Tabela `vendedores` já criada no Supabase
  - Falta: inserir o vendedor Henri com auth_uid correto
  - Falta: limpar dados de teste e trocar as FKs de clientes_vendas/negocios/visitas
  - Falta: atualizar as views

### ⚠️ Entraves encontrados
1. **Firewall Windows** - não conseguiu acessar dev server pelo celular na rede local (resolvido com deploy em nuvem)
2. **UUID vs bigint** - projeto original usava UUID, Supabase existente usava bigint auto-increment. Migrado todo o app para bigint (DB versão 5)
3. **Tabela Tecnicos** - usada inicialmente como vendedores, mas tinha dados de técnicos que não são vendedores. O email vinculou ao técnico errado. Solução: criar tabela `vendedores` independente
4. **RLS Supabase** - policies precisaram ser permissivas para o supervisor ver tudo
5. **Sync sem sessão** - o botão "entrar sem login (teste)" não criava sessão Supabase Auth, impedindo o sync. Corrigido: pull funciona sem sessão, push requer auth
6. **Busca de clientes** - campos do Supabase (nome_fantasia) vs IndexedDB (nome) causavam busca vazia. Corrigido: pull traz mais campos, busca procura em todos

---

## Próximos passos

### Urgente
1. Finalizar migração para tabela `vendedores` (inserir Henri, trocar FKs)
2. Testar sync completo com login real (push + pull)
3. Cadastrar vendedores reais

### Melhorias
4. Edição de propriedades e máquinas
5. Histórico completo por propriedade (visitas + negócios + máquinas)
6. Busca global
7. Notificações de lembrete (próximo contato)
8. Fotos múltiplas por visita
9. Mapa das visitas com GPS
10. Relatórios exportáveis (CSV/PDF)
11. Integração rastreador GPS veicular

---

## Arquivos SQL (ordem de execução)
1. `supabase-setup.sql` - tabelas base
2. `supabase-supervisor.sql` - colunas extras + supervisor + views
3. `supabase-login.sql` - colunas auth na Tecnicos (pode ignorar agora)
4. `supabase-vendedores.sql` - tabela vendedores independente (em andamento)

## Estrutura de pastas
```
vendas-pwa/
├── public/
│   ├── icon.svg
│   ├── icon-192.png
│   └── icon-512.png
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── index.css
│   ├── lib/
│   │   ├── db.js          IndexedDB (7 stores + fotos + logs)
│   │   ├── sync.js        Push/Pull + Supabase client
│   │   ├── supabaseQueries.js  Queries do supervisor
│   │   ├── constants.js   Tipos de produto e marcas
│   │   ├── masks.js       CPF/CNPJ e telefone
│   │   ├── gps.js         Captura GPS
│   │   └── camera.js      Captura foto + compressão
│   ├── hooks/
│   │   └── useCheckin.js   Hook de check-in (GPS + foto + salvar)
│   ├── components/
│   │   ├── Layout.jsx      Header + nav + sync indicator
│   │   ├── PullToRefresh.jsx
│   │   ├── ConfirmModal.jsx
│   │   └── AudioTextInput.jsx  Input com gravação de áudio
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Clientes.jsx    Lista de propriedades + agenda
│   │   ├── Propriedades.jsx
│   │   ├── Pessoas.jsx
│   │   ├── Maquinas.jsx
│   │   ├── Visitas.jsx     Check-in completo
│   │   └── Negocios.jsx    Funil de vendas
│   └── supervisor/
│       ├── SupervisorLogin.jsx
│       ├── SupervisorLayout.jsx
│       ├── SupervisorOverview.jsx
│       ├── SupervisorVendedores.jsx
│       ├── SupervisorVisitas.jsx
│       ├── SupervisorPosVendas.jsx
│       └── SupervisorAlertas.jsx
├── .env
├── .gitignore
├── vercel.json
├── vite.config.js
├── tailwind.config.js
├── package.json
└── supabase-*.sql
```
