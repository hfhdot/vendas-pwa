-- ============================================
-- SQL para Supabase - Dashboard Supervisor
-- Rodar APÓS o supabase-setup.sql
-- ============================================

-- 1. Novas colunas na tabela visitas
ALTER TABLE visitas ADD COLUMN IF NOT EXISTS retroativa boolean DEFAULT false;
ALTER TABLE visitas ADD COLUMN IF NOT EXISTS pos_vendas_resolvido boolean DEFAULT false;
ALTER TABLE visitas ADD COLUMN IF NOT EXISTS data_proximo_contato date;
ALTER TABLE visitas ADD COLUMN IF NOT EXISTS acionar_pos_vendas boolean DEFAULT false;

-- 2. Atualizar tipos permitidos de visita
ALTER TABLE visitas DROP CONSTRAINT IF EXISTS visitas_tipo_check;
ALTER TABLE visitas ADD CONSTRAINT visitas_tipo_check
  CHECK (tipo IN ('presencial','mensagem','telefonema','email','presenca','negociacao'));

-- 3. Coluna tamanho nas máquinas
ALTER TABLE maquinas ADD COLUMN IF NOT EXISTS tamanho text;
ALTER TABLE maquinas DROP CONSTRAINT IF EXISTS maquinas_tipo_check;
ALTER TABLE maquinas ADD CONSTRAINT maquinas_tipo_check
  CHECK (tipo IN ('trator','auto_propelido','pulverizador','distribuidor','grade','outro','colheitadeira','implemento'));

-- 4. Tabela de supervisores (vinculada ao Supabase Auth)
CREATE TABLE IF NOT EXISTS supervisores (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  auth_uid uuid REFERENCES auth.users(id),
  nome text NOT NULL,
  email text UNIQUE NOT NULL,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 5. Tabela para dados futuros do rastreador GPS veicular
CREATE TABLE IF NOT EXISTS gps_rastreador (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vendedor_id bigint REFERENCES "Tecnicos"("Id"),
  latitude numeric(10,7),
  longitude numeric(10,7),
  velocidade numeric(6,2),
  data_hora timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 6. View detalhada de visitas (para o dashboard do supervisor)
CREATE OR REPLACE VIEW vw_visitas_detalhadas AS
SELECT
  v.*,
  t."Nome" as vendedor_nome,
  cv.nome as cliente_nome,
  c.nome_fantasia as propriedade_nome
FROM visitas v
LEFT JOIN "Tecnicos" t ON t."Id" = v.vendedor_id
LEFT JOIN "Clientes" c ON c.id = v.propriedade_id
LEFT JOIN clientes_vendas cv ON cv.id = c.cliente_dono_id;

-- 7. View detalhada de negócios
CREATE OR REPLACE VIEW vw_negocios_detalhados AS
SELECT
  n.*,
  t."Nome" as vendedor_nome,
  cv.nome as cliente_nome
FROM negocios n
LEFT JOIN "Tecnicos" t ON t."Id" = n.vendedor_id
LEFT JOIN clientes_vendas cv ON cv.id = n.cliente_id;

-- 8. Desabilitar RLS para as views (supervisor precisa ver tudo)
-- As views herdam as policies das tabelas base.
-- Para o supervisor conseguir ler tudo, crie policies permissivas:
CREATE POLICY "supervisor_read_visitas" ON visitas
  FOR SELECT USING (true);

CREATE POLICY "supervisor_read_negocios" ON negocios
  FOR SELECT USING (true);

CREATE POLICY "supervisor_read_clientes_vendas" ON clientes_vendas
  FOR SELECT USING (true);

CREATE POLICY "supervisor_read_pessoas" ON pessoas
  FOR SELECT USING (true);

CREATE POLICY "supervisor_read_maquinas" ON maquinas
  FOR SELECT USING (true);

-- 9. Policy para supervisor atualizar pos_vendas_resolvido
CREATE POLICY "supervisor_update_visitas" ON visitas
  FOR UPDATE USING (true);
