-- Banco de LP: tabela global de referência de landing pages
-- Espelha o ad_bank (026), porém SEM métricas de conversão. Classificação por
-- funil reusa a mesma lista do Banco de Anúncios (ver src/lib/constants.js).
CREATE TABLE IF NOT EXISTS public.lp_bank (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  funil      TEXT        NOT NULL,
  title      TEXT,
  url        TEXT,        -- link da landing page (ao vivo)
  image_url  TEXT,        -- print/screenshot da LP (preview do card)
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID        REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.lp_bank ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados gerenciam tudo
CREATE POLICY "authenticated can manage lp bank"
  ON public.lp_bank
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Anônimos podem ler (para links compartilhados)
CREATE POLICY "public can read lp bank"
  ON public.lp_bank
  FOR SELECT
  TO anon
  USING (true);

-- Bucket público para prints das landing pages
INSERT INTO storage.buckets (id, name, public)
VALUES ('lp-bank', 'lp-bank', true)
ON CONFLICT (id) DO NOTHING;

-- Upload apenas para autenticados
CREATE POLICY "authenticated can upload lp bank"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'lp-bank');

CREATE POLICY "authenticated can delete lp bank"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'lp-bank');

-- Leitura pública (bucket público, mas policy explícita)
CREATE POLICY "public can read lp bank storage"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'lp-bank');
