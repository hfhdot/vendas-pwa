# Feature: Catálogo de Produtos — Plano de Implementação

> Documento de planejamento para a feature de Catálogo no app Vendas PWA. Destinado a guiar a implementação técnica em ondas, respeitando a restrição de não perturbar a rotina dos vendedores nas próximas 2 semanas.

---

## Contexto

App PWA offline-first React + Vite + Tailwind + IndexedDB no cliente, com Supabase (Postgres + Auth + Storage) direto como backend — **sem backend próprio**. Schema atual do IndexedDB na versão 5. Stack documentada em `FEATURES.md`.

A feature de Catálogo permite que vendedores em campo visualizem **imagens, vídeos, folheto técnico, estoque disponível e valor de venda** dos produtos comercializados.

## Decisões de produto travadas

1. **Manutenção do catálogo**: feita pelo supervisor diretamente no Supabase (dados já existem no banco). Sem tela de admin nesse ciclo.
2. **Estoque**: SKU global (sem filial/região).
3. **Preço**: tabela única para todos os vendedores. Preço diferenciado por cliente fica para v2.
4. **Integração com negócios**: fora do escopo dos 30 dias. Backlog pós-lançamento.

## Restrição operacional

Vendedores estão em rotina apurada nas próximas 2 semanas. **A feature não pode entrar em produção ativa pra equipe inteira nesse período.** Trabalho de engenharia acontece nessas semanas, ativação completa só na semana 4+, com piloto controlado antes.

---

## Modelo de dados

### Tabelas (assumidas — confirmar na Onda 0)

| Tabela | Campos-chave | Notas |
|---|---|---|
| `catalogo_produtos` | id, tipo, marca, modelo, nome_comercial, descricao, preco_venda, preco_promocional, estoque_disponivel, estoque_atualizado_em, ativo, ordem_exibicao, created_at, updated_at | Reusar enums de tipo (24 opções) e marca (7 opções) já existentes em `Maquinas` |
| `catalogo_midia` | id, produto_id, tipo (imagem/video/folheto), storage_path, thumbnail_path, titulo, ordem, tamanho_bytes, mime_type | Tabela separada (em vez de JSONB) para ordenação e remoção individual limpas |

### View de leitura

`vw_catalogo_vendedor` — join de produto + mídia + estoque no formato que o cliente consome. Padrão consistente com `vw_visitas_detalhadas` e `vw_negocios_detalhados`.

### RLS

- Vendedor autenticado: SELECT na view.
- Escrita: restrita a quem já tem permissão hoje (supervisor).

### Storage

Bucket no Supabase com prefixos:

- `catalogo/imagens/`
- `catalogo/videos/`
- `catalogo/folhetos/`
- `catalogo/thumbs/`

**Confirmar na Onda 0**: a mídia atual está em Storage do Supabase ou em URL externa.

---

## Estratégia offline

Catálogo precisa funcionar sem rede, mas mídia binária é pesada. Estratégia mista:

- **Metadata + thumbnails** (produto, preço, estoque, miniaturas pequenas) — IndexedDB, sincronizado no pull normal. Cabe inteiro no celular.
- **Imagens grandes, vídeos e PDFs** — Cache API via Service Worker, estratégia *stale-while-revalidate*. Baixa sob demanda quando o vendedor abre o produto, fica em cache para próxima visualização.
- **Pré-carga opt-in**: botão "Baixar catálogo completo offline" para uso no Wi-Fi do escritório saindo pra rota.
- **Cap de cache**: 500MB com política LRU para não engasgar o celular.

### Tratamento do estoque

Estoque muda mais rápido que o resto do catálogo. Mostrar **"estoque atualizado há X dias/horas"** ao lado do número — vendedor mente menos pro cliente se vê que o dado está velho. Quando online, refresh ativo de estoque ao abrir o produto.

Banner amarelo quando timestamp > 7 dias.

---

## Plano de implementação — 4 ondas

### Onda 0 — Descoberta (dias 1-2)

**Sem código.** Sentar com quem mantém os dados hoje no Supabase e mapear:

- [ ] Schema real das tabelas de produto/mídia/estoque (output de `\d` ou definições).
- [ ] Onde os arquivos de mídia vivem (Storage? URL externa?).
- [ ] Cadência de atualização do estoque (quem mexe, com que frequência).
- [ ] Sample de 5-10 produtos completos pra referência visual.
- [ ] Verificar se a tabela de estoque tem `estoque_atualizado_em` — se não tiver, adicionar com trigger.
- [ ] Verificar se imagens têm thumbnail otimizado — se não tiverem, gerar via Edge Function ou processo manual.
- [ ] Validar match entre os 24 tipos × 7 marcas do app e a taxonomia do catálogo existente.

**Saída**: documento de 1 página com o "de-para" entre o schema existente e o que o app do vendedor precisa consumir.

### Onda 1 — Backbone de leitura (semana 1)

Dado já existe — trabalho é **expor**, não criar. Três frentes:

#### 1.1. View de leitura no Postgres

Criar `vw_catalogo_vendedor` que junta produto + mídia + estoque no formato que o cliente vai consumir. Mídia agregada (array de objetos com path + tipo + ordem).

#### 1.2. RLS

Configurar policy na view para vendedor autenticado ler tudo. Escrita continua como está hoje.

#### 1.3. Store novo no IndexedDB

- Schema do IndexedDB: V5 → **V6**.
- Novo object store: `catalogo`.
- Índices: `por_tipo`, `por_marca`, `por_nome` (lowercase para busca case-insensitive).
- Migração com try/catch envolvendo criação. Fallback que recria o banco do zero se falhar (perde só pending de sync — log de auditoria reconstrói).
- **Testar com banco V5 populado antes de promover.**

#### 1.4. Sync engine

- Adicionar passo de pull do catálogo no fluxo existente (ordem: catálogo entra depois das entidades de domínio, antes dos logs).
- **Catálogo é read-only no cliente — sem push.**
- Pull traz a view inteira na primeira sincronização; nas seguintes, considerar delta com `updated_at` (decisão tática: se a base for pequena agora, traz tudo; quando crescer, otimiza).

**Entrega da Onda 1**: dados disponíveis no cliente, zero UI mudada. **Risco zero pra rotina dos vendedores.**

### Onda 2 — Visualização atrás de feature flag (semana 2)

#### 2.1. Feature flag

- Campo `feature_flags JSONB` em `vendedores` (ou tabela `vendedor_features` se preferir normalizar).
- Flag `catalogo_habilitado: true/false`.
- Hook `useFeatureFlag('catalogo_habilitado')` no React lendo de `localStorage.vendedor` (atualizado no pull).

#### 2.2. Tela "Catálogo" no menu

- Entrada nova no menu principal, condicionada à flag.
- Lista com card: thumbnail + nome comercial + tipo/marca + preço + estoque com timestamp.
- Busca multi-campo: nome, tipo, marca (reusa padrão dos filtros de Máquinas).
- Filtros rápidos por tipo e marca (chips no topo, como já feito em outras telas).
- Empty state seguindo padrão do app (ícone + mensagem + CTA quando aplicável).

#### 2.3. Tela de detalhe

- Galeria de imagens horizontal (swipe).
- Nome comercial + descrição + preço de tabela.
- Estoque com indicador de frescor ("atualizado há X" — verde <24h, âmbar <7d, vermelho >7d).
- Quando online: refresh ativo de estoque ao abrir.
- **Sem vídeo nem folheto ainda** — propositalmente. Onda 3.

#### 2.4. Piloto interno

- Flag ativada para **1-2 vendedores piloto** — idealmente de escritório, com tempo de dar feedback honesto.
- Não ativar pra ninguém em rota apertada.

**Entrega da Onda 2**: feature usável end-to-end no caso simples, validável sem perturbar a equipe.

### Onda 3 — Mídia rica + offline (semana 3)

#### 3.1. Vídeo

- Player HTML5 nativo (`<video>`).
- Thumbnail visível antes do play.
- Indicador de tamanho antes de baixar ("este vídeo vai ocupar 12MB").
- Botão "modo economia de dados" no perfil que bloqueia download automático de vídeos.

#### 3.2. Folheto técnico (PDF)

- Estratégia depende do que descobrimos na Onda 0:
  - Se URL externa: abrir no navegador nativo do celular (`window.open`).
  - Se Storage do Supabase: baixar via `pdf.js` para render in-app, ou link nativo.
- Cache local após primeira abertura.

#### 3.3. Service Worker — Cache API

- Estratégia *stale-while-revalidate* para mídia.
- Cap de 500MB com LRU (limpa o mais antigo quando estoura).
- Pré-carga opt-in: botão "Baixar catálogo completo offline" — útil no Wi-Fi do escritório antes de sair.
- Indicador de progresso durante pré-carga.

#### 3.4. Ativação progressiva

- 30% dos vendedores → coletar feedback por 3-5 dias → 100%.
- Botão "voltar ao app sem catálogo" via flag para qualquer um que quiser desabilitar.

**Entrega da Onda 3**: catálogo "completo" do ponto de vista do vendedor.

### Onda 4 — Backlog pós-30d

Documentar mas **não implementar agora**:

- Amarração com sub-editor de produtos no cadastro de negócio (referenciar catálogo em vez de tipo+marca+modelo solto).
- Cálculo automático: se preço da proposta < preço do catálogo, mostra desconto aplicado. Alimenta análise de motivo de perda "preço".
- Tela de admin pelo dashboard do supervisor (se a manutenção atual no Supabase direto não escalar).
- Preço diferenciado por cliente/carteira.

---

## Cronograma

| Período | Vendedor em campo apurado | O que rola | Risco pra equipe |
|---|---|---|---|
| Dias 1-2 | ✅ Sim | Onda 0 (descoberta) | Zero — conversa interna |
| Semana 1 | ✅ Sim | Onda 1 (view + sync, sem UI) | Zero — invisível pro vendedor |
| Semana 2 | ✅ Sim | Onda 2 (UI atrás de flag) + piloto | Zero — flag desligada na equipe |
| Semana 3 | ⚠️ Janela abrindo | Onda 3 (mídia + offline) + 30% ativos | Baixo — opt-in, piloto controlado |
| Semana 4+ | ❌ Rotina normal | Ativação 100% + treinamento | Médio — momento de dar suporte |
| Pós-30d | — | Onda 4 (backlog) | — |

---

## Riscos e mitigações

### Service Worker corrompendo o cache do app atual

Mudança em SW é a coisa mais perigosa do PWA.

**Mitigação**: testar o build novo em staging com `vite-plugin-pwa` em `registerType: 'autoUpdate'` por pelo menos 3 dias antes de promover. Ter botão escondido de "limpar cache" no app para suporte.

### Versão 6 do IndexedDB com migração mal feita travando login

**Mitigação**: migração com try/catch envolvendo cada criação de store. Fallback que recria o banco do zero (perde só pending de sync — log de auditoria reconstrói). Testar com banco V5 populado antes de promover.

### Estoque desatualizado virando problema comercial

**Mitigação**: timestamp visível sempre + refresh ativo ao abrir produto quando online + banner amarelo quando dado tem mais de 7 dias.

### Tamanho do download estourando plano de dados do vendedor

**Mitigação**: pré-carga é opt-in, vídeos não baixam automaticamente, indicador de tamanho antes de cada download, "modo economia de dados" que serve só thumbnails.

### Catálogo desatualizado matando confiança na feature

Mitigação técnica é fácil; a difícil é processo.

**Mitigação**: combinar com o supervisor *antes do lançamento* quem é o dono operacional do catálogo e qual a cadência mínima de atualização (sugiro semanal). Sem isso, a feature degrada em 2 meses.

### Dado existente inconsistente com necessidade do vendedor

Exemplo: nome interno do produto pode ser código ("TR-7-NH-22") quando o vendedor quer ver "Trator T7 New Holland 2022".

**Mitigação**: validar amostra real com supervisor na Onda 0. Se houver gap, decidir se a view faz transformação cosmética ou se cria-se campo `nome_comercial` na tabela existente.

### Mídia em local não-otimizado

Se imagens hoje são URLs do site institucional sem thumbnail, primeira carga vai ser dolorosa.

**Mitigação**: gerar thumbnails server-side (Edge Function rodando uma vez sobre o catálogo, ou processo manual na Onda 0).

---

## Checklist resumido

### Onda 0 — Descoberta

- [ ] Mapear schema atual das tabelas relacionadas a catálogo
- [ ] Identificar onde mídia está armazenada
- [ ] Validar amostra de 5-10 produtos
- [ ] Confirmar match de taxonomia (tipo/marca)
- [ ] Verificar/adicionar `estoque_atualizado_em`
- [ ] Verificar/gerar thumbnails

### Onda 1 — Backbone

- [ ] Criar `vw_catalogo_vendedor`
- [ ] Configurar RLS na view
- [ ] Migration IndexedDB V5 → V6 com store `catalogo`
- [ ] Adicionar pull do catálogo no sync engine
- [ ] Testar migração com banco V5 populado

### Onda 2 — UI atrás de flag

- [ ] Campo `feature_flags` em `vendedores`
- [ ] Hook `useFeatureFlag`
- [ ] Tela de lista do Catálogo
- [ ] Busca + filtros por tipo/marca
- [ ] Tela de detalhe com galeria + preço + estoque
- [ ] Refresh ativo de estoque quando online
- [ ] Ativar pra 1-2 vendedores piloto

### Onda 3 — Mídia + offline

- [ ] Player de vídeo com thumbnail e indicador de tamanho
- [ ] Visualização de folheto (PDF)
- [ ] Service Worker com Cache API + LRU
- [ ] Pré-carga opt-in "Baixar catálogo offline"
- [ ] Modo economia de dados no perfil
- [ ] Ativação progressiva 30% → 100%

---

## Princípios para a implementação

1. **A primeira pessoa que vê o catálogo em produção não pode estar em rota apertada fechando proposta.** Tem que ser alguém com tempo de dar feedback honesto.
2. **Feature flag sempre.** Qualquer dúvida sobre se algo vai pra produção atrás de flag — a resposta é sim.
3. **Catálogo é read-only no cliente.** Não há push de catálogo. Sync engine só faz pull.
4. **Reusar padrões existentes** (views, RLS, sync engine, telas de lista/detalhe). Não inventar arquitetura nova.
5. **Onda 0 não é negociável.** Pular descoberta porque "os dados já existem" é o que transforma plano simples em retrabalho.

---

## Adendo — Decisões consolidadas (atualizado 2026-05-28)

Decisões tomadas após descoberta no Supabase real. Estas mudanças **sobrescrevem partes do corpo do plano acima**. Onde houver conflito, o adendo vale.

### A. Tabela `vendedores` separada (Tecnicos intocada)

Descoberta no Supabase:

- A tabela `vendedores` separada **nunca foi criada** — o SQL antigo nunca rodou.
- `Tecnicos` tem coluna `is_vendedor` boolean já adicionada (não usaremos).
- Tabelas dependentes (`clientes_vendas`, `negocios`, `visitas`, `gps_rastreador`) têm FKs para `Tecnicos.Id`, mas estão quase vazias (3 + 0 + 0 + 0 linhas — tudo teste).
- `Login.jsx` já consulta `vendedores` — sem mudança no código necessária.

**Decisão**: criar tabela `vendedores` independente com schema próprio (`auth_uid`, `nome`, `email`, `ativo`, `feature_flags JSONB`). Trocar as FKs das tabelas dependentes para apontar pra `vendedores.id`. **`Tecnicos` fica 100% intocada** (sem alteração de schema nem dados).

**SQL pronto em [supabase-vendedores.sql](supabase-vendedores.sql)** — idempotente, inclui:
1. DELETE dos dados de teste em `clientes_vendas` (3 linhas) e `maquinas` (1 linha).
2. CREATE TABLE vendedores + trigger updated_at + RLS (SELECT permissivo, UPDATE só próprio).
3. DROP/ADD das FKs em 4 tabelas dependentes.
4. CREATE OR REPLACE das views `vw_visitas_detalhadas` e `vw_negocios_detalhados` apontando pra vendedores.

**A fazer antes da Onda 1**:
- [ ] Executar [supabase-vendedores.sql](supabase-vendedores.sql) no Supabase.
- [ ] Criar 1-2 vendedores reais (Authentication → Users + INSERT na vendedores — passos comentados no SQL).
- [ ] Smoke test: login com vendedor real → push/pull ponta a ponta.

### B. Catálogo = DESIGN curado (18 Mahindra), Supabase só pra estoque/preço

Reviravolta na fonte do catálogo: o usuário forneceu uma pasta `DESIGN/` com **18 produtos Mahindra cuidadosamente curados** (vitrine focada na marca). Cada produto tem JSON rico (titulo, descricao, argumentos_de_venda, especificacoes), 1 foto webp e (quando aplicável) 1 PDF de ficha técnica.

A tabela `produtos` do Supabase NÃO vira mais a fonte do catálogo. Vira **fonte de runtime pra estoque e preço** dos itens que têm match.

**Estrutura por produto** (`DESIGN/.../produtos/<id>/produto.json`):
```json
{
  "id": "mahindra-6065",
  "titulo": "MAHINDRA 6065",
  "subtitulo": "65 CV",
  "categoria": "tratores",
  "url_site": "https://www.mahindrabrasil.com.br/trator-mahindra-6065/",
  "descricao": "...",
  "argumentos_de_venda": ["..."],
  "especificacoes": {"potencia": "65 cv @ 2100 rpm", ...},
  "fotos": {"site": [...], "local": "fotos/mahindra-6065/"},
  "ficha_tecnica": {"arquivo_local": "pdfs/ficha-tecnica-6065.pdf"},
  "modelos_supabase": ["6065", "6065 CAB"],
  "filtro_supabase": {"familia_nome": ["Trator Novo","Trator Seminovo"], "marca_like": "mahindra"}
}
```

**Cross-reference em runtime**: ao abrir um card no app, fazer
```
SELECT codigo, modelo, estoque, valor_unitario, ambiente
FROM produtos
WHERE marca ILIKE '%mahindra%'
  AND familia_nome IN ('Trator Novo','Trator Seminovo')
  AND modelo IN (...modelos_supabase...)
```
Agregar `SUM(estoque)`, mostrar `MEDIANA(valor_unitario)` ou faixa, listar variações como sub-cards.

**11 produtos têm match validado**, 7 não têm SKU correspondente (carregador-frontal, plantadora-batatas, retroescavadeira-vx90, 6675f, mitra-200l/600l/1500l/2000l) → card aparece com badge "Consulte estoque/preço" e sem cross-ref.

**Manutenção**: editar JSONs em DESIGN/ e commitar. Baixa cadência (18 produtos, mudanças raras). Re-scrape via script Python quando o site Mahindra atualizar.

### C. Mídia v1: imagens bundladas + PDFs no Supabase Storage

Dados reais:
- **Fotos**: 18 webp, 1.3MB total. Bundla com o app em `public/catalogo/fotos/<id>/foto-principal.webp`. Sem download em runtime, sem cache custom.
- **PDFs (folhetos / fichas técnicas)**: 13 arquivos, 54MB total (maior é 18MB). Sobe pro Supabase Storage no bucket `catalogo-pdfs`. App baixa sob demanda + cacheia local via `window.caches` (mantém a decisão D).
- **Vídeos**: não temos dado. Vira backlog pós-v1.

**Implicação na Onda 3**: vira só "cache de PDFs via Cache API + indicador de tamanho antes de baixar". Sem player de vídeo, sem tela de modo economia.

### D. Estratégia de cache — Cache API via página

Mantida. Usar `window.caches.open('catalogo-pdfs')`, fora do SW. Não migrar `vite-plugin-pwa` pra `injectManifest`. LRU em JS no app. Pré-carga opt-in: botão "Baixar todos os folhetos offline" (~54MB, mostrar tamanho antes).

### E. Fonte da feature flag — pull do próprio vendedor no sync

Adicionar passo no `sync.js` que, após o pull das entidades, faz `SELECT feature_flags FROM vendedores WHERE auth_uid = current_uid` e atualiza `localStorage.vendedor.feature_flags`. Hook `useFeatureFlag('catalogo_habilitado')` lê dali. Cabe offline (última flag conhecida fica em cache local).

### F. Documento versionado no repo

Este `CATALOGO_PLANO.md` vive em `vendas-pwa/CATALOGO_PLANO.md`. Atualizações entram como commit. Mesmo vale pros JSONs do DESIGN (alteração = commit + deploy).

---

## Sequência executável (substitui o cronograma acima)

| # | Tarefa | Onde | Status |
|---|---|---|---|
| 0 | Executar [supabase-vendedores.sql](supabase-vendedores.sql) (cria tabela, troca FKs, atualiza views) | Supabase | ✅ feito |
| 1 | Inserir 5 vendedores reais (Henri, Pedro, Joaquim, Dougras, Leonardo, Lucas) | Supabase | ✅ feito |
| 2 | Smoke test: login real com Leonardo, criar cliente, push/pull | App local | 🔄 em andamento |
| 3 | Mover JSONs do DESIGN pra `src/data/catalogo/` e fotos pra `public/catalogo/fotos/` | Repo | pendente |
| 4 | Criar bucket `catalogo-pdfs` no Supabase Storage e fazer upload dos 13 PDFs | Supabase + manual | pendente |
| 5 | Adicionar pull do próprio vendedor em `sync.js` (popular `feature_flags` no localStorage) | Repo | pendente |
| 6 | Adicionar coluna `feature_flags` na `vendedores` (já está no schema, basta marcar `catalogo_habilitado` no Leonardo) | Supabase | pendente |
| 7 | Tela de Catálogo (lista por categoria + detalhe com galeria + cross-ref live com Supabase pra estoque/preço) | Repo | pendente |
| 8 | Hook `useFeatureFlag` + entrada no menu condicionada à flag | Repo | pendente |
| 9 | Cache de PDFs via `window.caches` + botão "Baixar folhetos offline" | Repo | só p/ Onda 3 |
| 10 | Corrigir `ficha_tecnica` do `carregador-frontal` (aponta pro PDF errado) | DESIGN JSON | nice-to-have |
