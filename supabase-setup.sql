  -- ============================================
  -- SQL para Supabase - PWA Vendas
  -- Reaproveita: "Clientes" (propriedades) e "Tecnicos" (vendedores)
  -- Cria: clientes_vendas, pessoas, maquinas, visitas, negocios
  -- ============================================

  -- 1. Adicionar coluna id auto-incremento na tabela "Clientes" (propriedades)
  --    para servir como chave primária local do app
  ALTER TABLE "Clientes" ADD COLUMN IF NOT EXISTS id bigint GENERATED ALWAYS AS IDENTITY;
  ALTER TABLE "Clientes" ADD COLUMN IF NOT EXISTS observacoes text;
  ALTER TABLE "Clientes" ADD COLUMN IF NOT EXISTS area_hectares numeric(10,2);
  ALTER TABLE "Clientes" ADD COLUMN IF NOT EXISTS culturas text[];
  ALTER TABLE "Clientes" ADD COLUMN IF NOT EXISTS latitude numeric(10,7);
  ALTER TABLE "Clientes" ADD COLUMN IF NOT EXISTS longitude numeric(10,7);
  ALTER TABLE "Clientes" ADD COLUMN IF NOT EXISTS cliente_dono_id bigint;
  ALTER TABLE "Clientes" ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
  ALTER TABLE "Clientes" ADD COLUMN IF NOT EXISTS status_sync text DEFAULT 'synced';

  -- 2. Criar tabela de clientes (donos/empresas) do app de vendas
  CREATE TABLE IF NOT EXISTS clientes_vendas (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vendedor_id bigint REFERENCES "Tecnicos"("Id"),
    nome text NOT NULL,
    documento text,
    telefone text,
    email text,
    observacoes text,
    status_sync text DEFAULT 'pending',
    created_at timestamptz DEFAULT now()
  );

  -- 3. Adicionar FK de propriedade -> cliente dono
  -- (só adiciona se a coluna cliente_dono_id existir)
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'fk_cliente_dono' AND table_name = 'Clientes'
    ) THEN
      ALTER TABLE "Clientes"
        ADD CONSTRAINT fk_cliente_dono
        FOREIGN KEY (cliente_dono_id) REFERENCES clientes_vendas(id) ON DELETE SET NULL;
    END IF;
  END $$;

  -- 4. Pessoas (contatos da propriedade)
  CREATE TABLE IF NOT EXISTS pessoas (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    propriedade_id bigint NOT NULL,
    nome text NOT NULL,
    vinculo text CHECK (vinculo IN ('proprietario','familiar','funcionario','gerente','outro')),
    cargo text,
    telefone text,
    observacoes text,
    status_sync text DEFAULT 'pending',
    created_at timestamptz DEFAULT now()
  );

  -- 5. Máquinas (da propriedade)
  CREATE TABLE IF NOT EXISTS maquinas (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    propriedade_id bigint NOT NULL,
    tipo text CHECK (tipo IN ('trator','colheitadeira','pulverizador','implemento','outro')),
    marca text,
    modelo text,
    ano int,
    numero_serie text,
    horimetro int,
    estado text CHECK (estado IN ('otimo','bom','regular','critico')),
    observacoes text,
    status_sync text DEFAULT 'pending',
    created_at timestamptz DEFAULT now()
  );

  -- 6. Negócios (funil de vendas)
  CREATE TABLE IF NOT EXISTS negocios (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vendedor_id bigint REFERENCES "Tecnicos"("Id"),
    cliente_id bigint REFERENCES clientes_vendas(id),
    propriedade_id bigint,
    status text CHECK (status IN (
      'prospect','proposta_enviada','em_negociacao','fechado_ganho','fechado_perdido'
    )) DEFAULT 'prospect',
    valor numeric(12,2),
    motivo_perda text,
    data_fechamento_prevista date,
    notas text,
    status_sync text DEFAULT 'pending',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );

  -- 7. Visitas (check-ins com GPS)
  CREATE TABLE IF NOT EXISTS visitas (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vendedor_id bigint REFERENCES "Tecnicos"("Id"),
    propriedade_id bigint NOT NULL,
    negocio_id bigint REFERENCES negocios(id),
    tipo text CHECK (tipo IN ('presencial','mensagem','telefonema','email','presenca','negociacao')) NOT NULL,
    pessoa_ids bigint[],
    maquina_ids bigint[],
    data_visita timestamptz,
    latitude numeric(10,7),
    longitude numeric(10,7),
    gps_accuracy numeric(6,2),
    foto_path text,
    resumo text,
    proximos_passos text,
    status_sync text DEFAULT 'pending',
    created_at timestamptz DEFAULT now()
  );

  -- 8. Logs de auditoria
  CREATE TABLE IF NOT EXISTS audit_logs_vendas (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    acao text NOT NULL,
    entidade text NOT NULL,
    entidade_id bigint,
    vendedor_id bigint,
    vendedor_nome text,
    detalhes text,
    data_hora timestamptz NOT NULL
  );

  -- 9. Bucket para fotos (rodar separadamente em Storage se necessário)
  -- Criar bucket "fotos-visitas" manualmente no Supabase Storage (Private)

  -- 9. RLS (Row Level Security)
  ALTER TABLE clientes_vendas ENABLE ROW LEVEL SECURITY;
  ALTER TABLE pessoas ENABLE ROW LEVEL SECURITY;
  ALTER TABLE maquinas ENABLE ROW LEVEL SECURITY;
  ALTER TABLE negocios ENABLE ROW LEVEL SECURITY;
  ALTER TABLE visitas ENABLE ROW LEVEL SECURITY;

  -- Policies: cada vendedor vê só seus dados
  CREATE POLICY "vendedor_clientes" ON clientes_vendas
    FOR ALL USING (vendedor_id = current_setting('app.vendedor_id')::bigint);

  CREATE POLICY "vendedor_negocios" ON negocios
    FOR ALL USING (vendedor_id = current_setting('app.vendedor_id')::bigint);

  CREATE POLICY "vendedor_visitas" ON visitas
    FOR ALL USING (vendedor_id = current_setting('app.vendedor_id')::bigint);

  CREATE POLICY "vendedor_pessoas" ON pessoas
    FOR ALL USING (propriedade_id IN (
      SELECT id FROM "Clientes" WHERE cliente_dono_id IN (
        SELECT id FROM clientes_vendas WHERE vendedor_id = current_setting('app.vendedor_id')::bigint
      )
    ));

  CREATE POLICY "vendedor_maquinas" ON maquinas
    FOR ALL USING (propriedade_id IN (
      SELECT id FROM "Clientes" WHERE cliente_dono_id IN (
        SELECT id FROM clientes_vendas WHERE vendedor_id = current_setting('app.vendedor_id')::bigint
      )
    ));
