-- 063 — Limpa linhas duplicadas em roi_calculators
--
-- A calculadora de ROI gravava uma linha NOVA a cada alteração porque o objeto
-- roiCalc não carregava id (o upsert gerava um UUID novo sempre). Alguns projetos
-- chegaram a ter 40+ linhas. A view cpl_targets_public sempre usou
-- DISTINCT ON (...) ORDER BY created_at DESC, então o CPL não muda — só removemos
-- o lixo. O fix no código (AppContext: reaproveitar o id da linha existente)
-- impede novas duplicações.
DELETE FROM roi_calculators r
USING (
  SELECT id,
         row_number() OVER (PARTITION BY project_id ORDER BY created_at DESC NULLS LAST) AS rn
  FROM roi_calculators
) d
WHERE r.id = d.id AND d.rn > 1;
