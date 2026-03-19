-- ============================================
-- SQL para Login Real - Vendedores
-- ============================================

-- 1. Adicionar colunas na tabela Tecnicos para vincular ao Supabase Auth
ALTER TABLE "Tecnicos" ADD COLUMN IF NOT EXISTS auth_uid uuid REFERENCES auth.users(id);
ALTER TABLE "Tecnicos" ADD COLUMN IF NOT EXISTS email text;

-- 2. Policy para vendedor ler seus próprios dados
CREATE POLICY IF NOT EXISTS "tecnico_read_self" ON "Tecnicos"
  FOR SELECT USING (true);

-- 3. Policy para vendedor atualizar seu auth_uid (auto-vinculação no primeiro login)
CREATE POLICY IF NOT EXISTS "tecnico_update_self" ON "Tecnicos"
  FOR UPDATE USING (true);

-- ============================================
-- COMO CADASTRAR UM VENDEDOR:
--
-- 1. No Supabase, vá em Authentication → Users → Add User
--    Email: vendedor@empresa.com
--    Senha: senha123
--
-- 2. Na tabela Tecnicos, adicione ou atualize o email:
--    UPDATE "Tecnicos" SET email = 'vendedor@empresa.com' WHERE "Id" = 1;
--
-- O auth_uid será vinculado automaticamente no primeiro login.
-- ============================================
