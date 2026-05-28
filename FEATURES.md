# Vendas PWA — Inventário de Features

> Documento de referência funcional do app. Descreve o que ele faz hoje (Maio/2026), o modelo de dados e as ideias já mapeadas mas ainda não entregues. Pensado para servir de contexto em consultas externas sobre evolução de produto.

## O que é

App PWA offline-first para uma equipe de vendas de máquinas agrícolas em campo. O vendedor cadastra clientes/propriedades, registra visitas com GPS + foto + áudio, gerencia o funil de negócios — tudo offline — e sincroniza com Supabase quando volta a ter sinal. Um dashboard web separado dá ao supervisor visibilidade em tempo real da equipe (visitas por vendedor, pipeline, alertas de inatividade, fila de pós-vendas).

Stack: React + Vite + Tailwind + IndexedDB no cliente; Supabase (Postgres + Auth + Storage) direto, sem backend próprio. Deploy via Docker + Caddy.

Diferenciais: (1) **offline-first real** — tudo funciona sem rede e sincroniza depois; (2) **captura rica na visita** — GPS automático, foto comprimida, transcrição de áudio em pt-BR; (3) **camada de supervisão** com alertas estruturados (sem GPS, retroativa, vendedor inativo) e fila de pós-vendas.

---

## Features do vendedor (app móvel)

### Login
Login por email/senha via Supabase Auth contra a tabela `vendedores` (independente da tabela `Tecnicos` legada). Faz vinculação automática por `auth_uid` no primeiro acesso, com fallback de busca por email. Bloqueia vendedor com `ativo = false`. Existe um botão "entrar sem login (teste)" que pula a auth e popula `localStorage` com um vendedor mock — útil para demos e desenvolvimento offline, mas nesse modo o push de sync é desabilitado (só pull funciona).

### Dashboard
Tela inicial após login. Saudação dinâmica (bom dia/tarde/noite). Cards de KPI: visitas hoje, semana, mês, pipeline em R$, contagem de negócios abertos, total de clientes e propriedades (clicável → Clientes). Seção "Contatos atrasados" (com `data_proximo_contato < hoje`) em vermelho, ordenada por urgência. Seção "Próximos contatos planejados" (até 5 itens). Lista das últimas 3 visitas com tipo + resumo + data. Pull-to-refresh.

### Clientes
Lista de **propriedades** (a tabela `Clientes` do Supabase mapeia para o conceito de propriedade no domínio). Busca multi-campo: nome, nome fantasia, razão social, cidade, estado, endereço, CNPJ/CPF, nome do dono. Quando um mesmo dono tem múltiplas propriedades, elas ficam **agrupadas e expansíveis** sob o nome do dono. No topo da tela aparece uma agenda integrada com os contatos atrasados (vermelho), de hoje (azul) e da semana. Cadastro inline com máscaras de CPF/CNPJ e telefone. Cada card tem atalhos rápidos para Máquinas e Pessoas da propriedade. Indicador visual de sync (ponto verde = sincronizado, amarelo = pendente).

### Propriedades
Drill-down a partir de um cliente (`/propriedades/:clienteId`). Campos: nome, endereço, cidade, estado, área em hectares, culturas (lista separada por vírgula que renderiza como tags verdes), observações. Botões de navegação para Pessoas e Máquinas daquela propriedade. Cadastro e exclusão geram log de auditoria; **não há edição** pós-criação.

### Pessoas
Contatos vinculados a uma propriedade. Cada pessoa tem: nome, vínculo (proprietário / familiar / funcionário / gerente / outro), cargo, telefone (clicável para discar), observações. Cadastro inline e exclusão com confirmação. Pessoas podem ser criadas também **inline na tela de Visita**, sem precisar sair do check-in.

### Máquinas
Catálogo de máquinas por propriedade. Cadastro com **24 tipos** (Trator Novo/Seminovo, Pulverizador, Plantadeira, Colheitadeira, Implementos diversos, ATV/UTV, Peças, Agricultura de Precisão, etc.) e **7 marcas** (New Holland, John Deere, Case, Yanmar, Sollis, YTO, Lovol). Campos: modelo, tamanho, ano, número de série, horímetro, estado (ótimo/bom/regular/crítico — renderizado como badge colorido verde→vermelho). Como em Pessoas, máquinas podem ser criadas inline durante o registro de uma visita. Sem edição pós-criação.

### Visitas (check-in) — a tela mais rica do app
O coração do produto. Ao iniciar um check-in, o app dispara automaticamente a captura de GPS de alta precisão (lat/lon/accuracy em metros). Para visitas presenciais o GPS é praticamente obrigatório — se faltar, o supervisor recebe alerta.

Campos do registro:
- **Tipo**: presencial / mensagem / telefonema / email (toggle).
- **Cliente** → **Propriedade** (dropdown encadeado).
- **Data/hora**: editável; se for >5 min no passado, marca automaticamente a visita como `retroativa` (flag visível para o supervisor).
- **Foto** opcional, capturada pela câmera traseira do celular, comprimida no cliente via Canvas (max 1280px, JPEG 75%) antes de armazenar.
- **Pessoas presentes**: multi-check entre as pessoas da propriedade + botão "Nova pessoa" inline.
- **Máquinas tratadas**: multi-check + botão "Nova máquina" inline.
- **Acionar Pós Vendas**: aparece quando há máquina selecionada; quando marcado, a visita entra na fila de pós-vendas do supervisor.
- **Negócio vinculado**: abre modal para selecionar um negócio existente daquele cliente OU criar um novo negócio inline (valor, status, notas) sem sair do check-in.
- **Resumo** e **Próximos passos**: textareas com botão 🎤 que ativa Web Speech API em pt-BR, gravação contínua com resultado intermediário aparecendo em tempo real.
- **Próximo contato planejado**: date picker; alimenta a agenda do dashboard e os alertas de "atrasado".

Histórico abaixo do formulário, ordenado por data DESC, mostrando tipo + resumo + GPS + flags. **Edição de visita é permitida por até 48h** após criação (tipo, resumo, próximos passos, próximo contato, flag pós-vendas), e cada alteração gera log de auditoria. Exclusão também possível com confirmação.

### Negócios (funil de vendas)
Funil com 5 status: prospect, proposta enviada, em negociação, fechado_ganho, fechado_perdido. No topo aparece o pipeline total em R$ (soma de tudo que não está perdido). Duas linhas de filtros rápidos com contadores: por **status** e por **horizonte de fechamento** (Atrasados, Próx. 30 dias, Próx. 90 dias, Mais distantes, Sem data) — combináveis em AND. Negócios em aberto com previsão vencida ganham badge vermelho "Atrasado" no card. Quando o filtro de horizonte está ativo, a lista vem ordenada pela previsão mais próxima primeiro. Cadastro com: cliente, propriedade (opcional, filtrada pelo cliente), status, valor, previsão de fechamento, notas, e **produtos** — um sub-editor que permite escolher múltiplos pares "tipo + marca + modelo" do mesmo catálogo das máquinas.

Botões de ação rápida nos cards permitem mudar status sem abrir modal — exceto para `fechado_perdido`, que **obriga preencher o motivo de perda estruturado**. Esse motivo tem 8 categorias e cada uma abre sub-campos específicos:
- **Preço** → valor desejado, diferença de preço.
- **Concorrência** → nome do concorrente, condições oferecidas, valor.
- **Sem orçamento** → previsão de verba.
- **Sem interesse** → motivo do desinteresse.
- **Prazo** → prazo necessário vs oferecido.
- **Produto inadequado** → qual produto seria necessário.
- **Sem retorno** → tentativas de contato, data da última.
- **Outro** → descrição livre.

Esse modelo estruturado é o que alimenta análises do supervisor sobre por que se perde — não fica em texto solto. Edição completa permitida sem limite de tempo, com log.

---

## Features do supervisor (dashboard web)

Acesso por `/supervisor/login`, autenticação separada contra a tabela `supervisores`. Sessão guardada em `localStorage.supervisor`.

### Overview
Grid 2×4 de KPIs gerais: visitas hoje / semana / mês, pipeline total em R$, negócios fechados no mês, **visitas retroativas** (âmbar quando >0), **pós-vendas pendentes** (laranja quando >0), total de negócios. Botão de refresh manual. As cores comunicam saúde imediata — qualquer card âmbar/laranja é sinal de atenção.

### Vendedores
Linha por vendedor mostrando: visitas semana, visitas totais, pipeline em K (ex.: "120k"), retroativas, data da última visita. Quando um vendedor está há >3 dias sem visita aparece um selo vermelho "Xd sem visita". Clicar leva para a tela de Visitas filtrada por aquele vendedor.

### Visitas (supervisor)
Lista global com filtros poderosos: vendedor, tipo, intervalo de datas, checkbox "apenas retroativas". Cada card mostra vendedor + tipo + data + cliente/propriedade + resumo + coordenadas GPS, com **destaque visual em âmbar** se retroativa e **alerta vermelho "Sem GPS"** se for presencial sem coordenadas. Contador no topo: "X visitas encontradas".

### Pós-vendas
Fila exclusiva das visitas com `acionar_pos_vendas = true`. Filtros: pendentes / resolvidos / todos, com contadores. Cada card tem botão toggle "Resolver" / "Reabrir" que persiste no Supabase. Itens resolvidos ficam com opacidade reduzida.

### Alertas
Tela de exceções, agrupadas por severidade (alta em vermelho no topo, média em âmbar abaixo). Três categorias:
1. **Sem GPS** (alta) — visita presencial sem coordenadas.
2. **Retroativa** (média) — registrada com data significativamente no passado.
3. **Vendedor inativo** — média se >3 dias sem visita, alta se >7.

Esse é o "feed de problemas" que o supervisor revisa diariamente.

---

## Plataforma e infraestrutura

### Offline / IndexedDB
Banco local chamado `vendas-offline`, atualmente na **versão 5 do schema**. Tem 6 object stores de dados (clientes, propriedades, pessoas, máquinas, visitas, negócios) + 1 store para blobs de foto pendentes + 1 store para logs de auditoria. Cada registro carrega um campo `status_sync` (`pending` ou `synced`) com índice próprio para o sync engine consultar rapidamente. Há também índices nas FKs (cliente_dono_id, propriedade_id, cliente_id) para queries de drill-down.

### Sync engine
Operação em duas direções:
- **Push** (IndexedDB → Supabase): percorre os stores em ordem que respeita FKs — clientes → propriedades → pessoas → máquinas → negócios → visitas → logs. Estratégia upsert (tenta insert; em colisão de PK, faz update). Fotos pendentes vão para o bucket `fotos-visitas/` do Supabase Storage e o path resultante é gravado na visita. Push só roda com sessão Supabase Auth válida.
- **Pull** (Supabase → IndexedDB): traz tudo e sobrescreve local. Pull funciona mesmo sem sessão (útil para o modo teste).
- **Auto-sync** dispara no evento `window.online`. Botão manual no header faz o mesmo, com spinner + badge mostrando contador de pendências (cap em "9+").

### PWA
Manifest e service worker gerados automaticamente pelo `vite-plugin-pwa` no build, com `registerType: 'autoUpdate'` (atualização silenciosa em background). App é instalável tanto em Android quanto iOS (prompts nativos do SO). Display `standalone`, theme color azul (#1e40af), ícones 192 e 512.

### Captura de mídia
- **GPS**: `navigator.geolocation` com `enableHighAccuracy: true` e timeout 10s.
- **Câmera**: input nativo com `capture="environment"` (câmera traseira), compressão Canvas no cliente.
- **Áudio**: Web Speech API (`webkitSpeechRecognition`) em pt-BR, modo contínuo com interim results — o texto vai aparecendo enquanto a pessoa fala.

### Autenticação e autorização
Supabase Auth para sessão de verdade. `localStorage` guarda apenas `{ id, nome, email }` (não tokens sensíveis) para identificar o usuário entre reloads. Dois guards de rota: `ProtectedRoute` lê `localStorage.vendedor` para liberar `/*`, `SupervisorRoute` lê `localStorage.supervisor` para liberar `/supervisor/*`. RLS no Supabase permissivo o suficiente para o supervisor ler tudo.

### Logs de auditoria
Toda operação criar / alterar / excluir em qualquer entidade gera um registro em `audit_logs_vendas` com ação, entidade, ID, vendedor, timestamp e um JSON de detalhes (no caso de alteração, traz o diff dos campos mudados). Logs também são bufferizados no IndexedDB e sincronizados junto com o restante.

### UX transversal
- **Pull-to-refresh** com gesture (threshold 80px) em todas as páginas principais.
- **Confirm modals** genéricos para qualquer ação destrutiva.
- **Máscaras** de CPF, CNPJ e telefone (auto-detecta 10 ou 11 dígitos).
- **Indicador online/offline** no header (ponto verde/vermelho) + status bar contextual.
- **Animações** fade-in staggered, slide-up, scale-in nos modais.
- **Empty states** com ícone emoji + mensagem + CTA para criar o primeiro item da lista.
- **Feedback toasts** verdes de sucesso (ex.: "Visita registrada com sucesso!", 3s).

---

## Modelo de dados

| Entidade | Campos-chave | Relacionamentos |
|---|---|---|
| **Clientes (donos)** — `clientes_vendas` | id, vendedor_id, nome, documento, telefone, email, observacoes, created_at | 1 → N propriedades |
| **Propriedades** — tabela `Clientes` do Supabase | id, cliente_dono_id, nome, nome_fantasia, razao_social, cnpj_cpf, telefone, email, endereco, cidade, estado, **area_hectares**, **culturas[]**, latitude, longitude, observacoes | N → 1 cliente; 1 → N pessoas; 1 → N máquinas; 1 → N visitas |
| **Pessoas** | id, propriedade_id, nome, **vinculo** (proprietário/familiar/funcionário/gerente/outro), cargo, telefone, observacoes | N → 1 propriedade; M → N visitas (via `pessoa_ids[]`) |
| **Máquinas** | id, propriedade_id, **tipo** (24 opções), **marca** (7 opções), modelo, tamanho, ano, numero_serie, **horimetro**, **estado** (ótimo/bom/regular/crítico) | N → 1 propriedade; M → N visitas (via `maquina_ids[]`) |
| **Visitas** | id, vendedor_id, propriedade_id, **tipo**, negocio_id, pessoa_ids[], maquina_ids[], data_visita, **retroativa**, latitude, longitude, gps_accuracy, foto_path, resumo, proximos_passos, **data_proximo_contato**, **acionar_pos_vendas**, **pos_vendas_resolvido**, created_at, status_sync | N → 1 vendedor; N → 1 propriedade; 0/1 → 1 negócio |
| **Negócios** | id, vendedor_id, cliente_id, propriedade_id, **status** (prospect/proposta/negociação/ganho/perdido), valor, data_fechamento_prevista, **produtos[]** (tipo+marca+modelo), **motivo_perda** (JSON estruturado, 8 categorias), notas | N → 1 vendedor; N → 1 cliente; 0/1 → 1 propriedade; 1 → N visitas |
| **Logs** — `audit_logs_vendas` | id, acao, entidade, entidade_id, vendedor_id, vendedor_nome, detalhes (JSON), data_hora | Auditoria global |
| **Vendedores** | auth_uid, nome, email, ativo | — |
| **Supervisores** | auth_uid, nome, email, ativo | — |
| **gps_rastreador** | (vazia) | Reservada para integração futura com rastreador veicular |

Views de leitura usadas pelo supervisor: `vw_visitas_detalhadas` (visitas com join de vendedor + cliente + propriedade) e `vw_negocios_detalhados` (negócios com vendedor + cliente).

---

## Gaps observados (já pensados, ainda não entregues)

Lista honesta para evitar reinventar a roda nas sugestões:

1. **Edição de propriedades e máquinas pós-criação** — hoje só é possível criar e excluir. Para corrigir um erro de cadastro, precisa deletar e recriar.
2. **Histórico agregado por propriedade** — uma timeline única na propriedade reunindo visitas + negócios + mudanças de máquina. Hoje cada um vive na sua tela.
3. **Busca global cross-entidade** — cada tela tem sua busca isolada; não existe um campo "buscar em todo o sistema".
4. **Notificações locais de próximo contato** — o campo `data_proximo_contato` é capturado e listado no dashboard, mas não dispara push notification nem lembrete proativo.
5. **Fotos múltiplas por visita** — hoje é uma foto só.
6. **Mapa das visitas com GPS** — as coordenadas são capturadas e armazenadas mas nunca renderizadas em mapa (nem para o vendedor revisar a própria rota, nem para o supervisor ver heatmap).
7. **Relatórios exportáveis** (CSV / PDF) — supervisor não consegue exportar dados; só visualização no dashboard.
8. **Integração com rastreador GPS veicular** — tabela `gps_rastreador` está provisionada vazia, aguardando hardware/integração.
9. **Histórico longitudinal de máquina** — horímetro ao longo do tempo, manutenções, peças trocadas. Hoje o estado da máquina é um snapshot único, sobrescrito a cada update.
10. **Compartilhamento entre vendedores** — toda visita/cliente está atrelada a um vendedor; não há conceito de propriedade compartilhada ou transferência de carteira.

---

## Stack resumido para contexto de expansão

PWA Vite + React + Tailwind no cliente. Persistência local em IndexedDB. Backend é **Supabase direto** — Postgres + Auth + Storage + Realtime disponível mas não usado ainda. **Sem backend próprio** entre o cliente e o Supabase. Deploy em Railway via Docker + Caddy servindo o `dist/` estático.

Qualquer feature nova precisa ser viável dentro desse modelo: ou roda 100% no cliente (incluindo offline), ou usa um recurso já disponível do Supabase (Postgres, Edge Functions, Storage, Realtime), ou pede uma decisão de adicionar uma camada nova de infra.
