// Limite do anexo enviado pelo VertaTask, lido pelo painel da tarefa (bloqueia e avisa) e pelo push
// (api/_tarefas_push_core.js), por isso sem dependências. O arquivo vai do Storage ao ClickUp dentro
// de uma função de 60 s. Medido em 04/11/2026, de fora da Vercel: 50 MB em 8 s, 25 MB em 24 s.
export const LIMITE_ANEXO_MB = 50
export const LIMITE_ANEXO_BYTES = LIMITE_ANEXO_MB * 1048576
