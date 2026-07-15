// ─── Registry de wireframes de anúncio estático ───────────────────────────────
// Espelha o padrão dos wireframes de LP (src/components/Wireframes): cada
// layout de anúncio vira um wireframe com slots de texto + tokens de marca,
// gerando HTML standalone nos 2 formatos (feed 1080×1080 e story 1080×1920).
//
// Para adicionar um novo wireframe: criar o arquivo com { id, name, description,
// thumbnail, fields, mediaFields, brandFields, buildHtml } e registrar aqui.

import destaqueDuasFotos from './destaqueDuasFotos'

export { AD_FORMATS } from './shared'

export const AD_WIREFRAMES = [destaqueDuasFotos]

export const AD_WIREFRAMES_BY_ID = Object.fromEntries(
  AD_WIREFRAMES.map((w) => [w.id, w])
)
