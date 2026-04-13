-- Banco de Anúncios: tabela global de referência de ads
CREATE TABLE IF NOT EXISTS public.ad_bank (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type       TEXT        NOT NULL CHECK (type IN ('estatico', 'video')),
  funil      TEXT        NOT NULL,
  title      TEXT,
  url        TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID        REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.ad_bank ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados gerenciam tudo
CREATE POLICY "authenticated can manage ad bank"
  ON public.ad_bank
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Anônimos podem ler (para links compartilhados)
CREATE POLICY "public can read ad bank"
  ON public.ad_bank
  FOR SELECT
  TO anon
  USING (true);

-- Bucket público para imagens de anúncios estáticos
INSERT INTO storage.buckets (id, name, public)
VALUES ('ad-bank', 'ad-bank', true)
ON CONFLICT (id) DO NOTHING;

-- Upload apenas para autenticados
CREATE POLICY "authenticated can upload ad bank"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'ad-bank');

CREATE POLICY "authenticated can delete ad bank"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'ad-bank');

-- Leitura pública (bucket público, mas policy explícita)
CREATE POLICY "public can read ad bank storage"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'ad-bank');
