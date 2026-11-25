/*! Kit de teste A/B da Verta (Área do Cliente).
 *
 * Na LP, no <head>:
 *   <script src="https://<área do cliente>/ab.js" data-e="<slug do teste>" async></script>
 *
 * Teste de texto: marque os elementos que mudam com data-ab="headline",
 * data-ab="subheadline", data-ab="cta" (ou qualquer nome cadastrado na variante).
 * O texto que está na página é o Original.
 *
 * Conversão:
 *   - lead: POST para /api/lead-capture (o kit põe `_ab` no corpo) ou evento
 *     Lead / generate_lead no dataLayer do GTM;
 *   - clique: link de WhatsApp (wa.me, api.whatsapp.com) ou elemento com data-ab-convert.
 *
 * URL de cada variação: com o teste rodando, o kit põe ?variacao=<código> na barra de endereço depois do
 * sorteio (sem recarregar). Assim a URL que o formulário manda para o banco, o n8n e o CRM já diz de qual
 * variação o lead veio. Quem abre o link com ?variacao=<código> cai direto nela. Outro nome: data-param.
 *
 * Pré-visualizar uma variante sem contar visita: ?ab_variante=<id da variante>.
 * API para quem preferir código: window.vertaAB.{variante, texto(slot), converter(origem)}.
 */
(function () {
  'use strict'
  var script = document.currentScript
  if (!script) return
  var SLUG = script.getAttribute('data-e')
  if (!SLUG) return
  var BASE = script.getAttribute('data-api') || new URL(script.src).origin
  var API = BASE + '/api/ab'
  var TIMEOUT = Number(script.getAttribute('data-timeout')) || 800
  var CHAVE = 'vab_' + SLUG
  var PARAM = script.getAttribute('data-param') || 'variacao'
  var qs = new URLSearchParams(location.search)

  // ── Antipiscar: esconde os pontos marcados até a variante entrar (ou o tempo acabar).
  var estilo = document.createElement('style')
  estilo.textContent = 'html.vab-carregando [data-ab]{visibility:hidden!important}'
  document.head.appendChild(estilo)
  document.documentElement.classList.add('vab-carregando')
  var liberado = false
  function liberar() {
    if (liberado) return
    liberado = true
    document.documentElement.classList.remove('vab-carregando')
  }
  setTimeout(liberar, TIMEOUT)

  // ── Armazenamento que não quebra em aba anônima.
  function ler(k) { try { return localStorage.getItem(k) } catch (e) { return null } }
  function gravar(k, v) { try { localStorage.setItem(k, v) } catch (e) { /* segue */ } }

  function novoId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID()
    return 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  }

  // Vindo de um redirecionamento do teste de página: ?vab=<variante>.<visitante>
  var herdado = (qs.get('vab') || '').split('.')
  var visitante = herdado[1] || ler('vab_vid') || novoId()
  gravar('vab_vid', visitante)

  var dispositivo = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 768 ? 'mobile' : 'desktop'
  var utm = {}
  ;['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(function (k) {
    var v = qs.get(k)
    if (v) utm[k] = v
  })

  function enviar(corpo) {
    var dados = JSON.stringify(corpo)
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(API, new Blob([dados], { type: 'text/plain' }))) return
    } catch (e) { /* cai no fetch */ }
    try { fetch(API, { method: 'POST', body: dados, keepalive: true, headers: { 'Content-Type': 'text/plain' } }) } catch (e) { /* segue */ }
  }

  function sortear(variantes) {
    var total = 0
    variantes.forEach(function (v) { total += Math.max(0, v.peso || 0) })
    if (total <= 0) return variantes.filter(function (v) { return v.original })[0] || variantes[0]
    var r = Math.random() * total
    for (var i = 0; i < variantes.length; i++) {
      r -= Math.max(0, variantes[i].peso || 0)
      if (r < 0) return variantes[i]
    }
    return variantes[variantes.length - 1]
  }

  // Texto simples: **negrito** e quebra de linha. O resto é escapado.
  function formatar(txt) {
    return String(txt)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>')
  }

  var api = window.vertaAB = window.vertaAB || {}
  api.teste = SLUG
  api.variante = null
  api.texto = function (slot) {
    var v = api.variante
    return v && !v.original && v.conteudo && v.conteudo[slot] ? v.conteudo[slot] : null
  }

  function aplicarTextos(variante) {
    if (!variante || variante.original) return
    var conteudo = variante.conteudo || {}
    var els = document.querySelectorAll('[data-ab]')
    for (var i = 0; i < els.length; i++) {
      var el = els[i]
      var slot = el.getAttribute('data-ab')
      var txt = conteudo[slot]
      if (!txt) continue
      var html = formatar(txt)
      if (el.getAttribute('data-ab-aplicado') === html) continue
      el.innerHTML = html
      el.setAttribute('data-ab-aplicado', html)
    }
  }

  function iniciar(cfg) {
    var variantes = (cfg && cfg.variantes) || []
    if (!variantes.length) return liberar()
    var porId = {}
    variantes.forEach(function (v) { porId[v.id] = v })

    // Pré-visualização: mostra a variante pedida e não conta nada.
    var previa = qs.get('ab_variante')
    if (previa && porId[previa]) {
      api.variante = porId[previa]
      api.previa = true
      aplicar(porId[previa], cfg)
      return
    }
    // Encerrado com vencedor: todo mundo vê o vencedor, sem contar nada, até o
    // texto dele ir para o código da LP (e o script sair dela).
    if (cfg.status === 'encerrado' && cfg.vencedor && porId[cfg.vencedor]) {
      api.variante = porId[cfg.vencedor]
      api.previa = true
      if (cfg.tipo === 'pagina' && api.variante.url && !api.variante.original && !mesmaPagina(api.variante.url)) {
        return irPara(api.variante)
      }
      aplicar(api.variante, cfg)
      return
    }
    if (cfg.status !== 'rodando') return liberar()

    // Ordem: veio de um redirecionamento do teste de página, link com ?variacao=<código>, sorteio guardado, sorteio novo.
    var pedida = (qs.get(PARAM) || '').toLowerCase()
    var porCodigo = null
    variantes.forEach(function (v) { if (v.codigo && v.codigo === pedida) porCodigo = v })
    var guardada = herdado[0] && porId[herdado[0]] ? herdado[0] : porCodigo ? porCodigo.id : ler(CHAVE)
    var variante = guardada && porId[guardada] ? porId[guardada] : sortear(variantes)
    gravar(CHAVE, variante.id)
    api.variante = variante

    // Teste de página: a variante mora em outra URL. Leva a pessoa para lá com
    // os parâmetros (UTM, fbclid) e a marca do teste; a impressão conta lá.
    if (cfg.tipo === 'pagina' && variante.url && !variante.original && !mesmaPagina(variante.url)) {
      return irPara(variante)
    }

    marcarUrl(variante)
    aplicar(variante, cfg)
    enviar({ e: SLUG, v: variante.id, vis: visitante, t: 'impressao', p: location.href, u: utm, d: dispositivo })
    var dl = (window.dataLayer = window.dataLayer || [])
    dl.push({ event: 'ab_exposicao', ab_teste: SLUG, ab_variante: variante.nome })
    ouvirConversoes(cfg)
  }

  // Põe ?variacao=<código> na URL sem recarregar e sem mexer no histórico (replaceState guarda o state do
  // roteador do React). Se o roteador da página trocar a URL depois, o kit põe de volta.
  function marcarUrl(variante) {
    if (!variante || !variante.codigo || !window.history || !history.replaceState) return
    function marcar() {
      try {
        var u = new URL(location.href)
        if (u.searchParams.get(PARAM) === variante.codigo) return
        u.searchParams.set(PARAM, variante.codigo)
        history.replaceState(history.state, '', u.toString())
      } catch (e) { /* segue sem marcar */ }
    }
    marcar()
    window.addEventListener('popstate', marcar)
    window.addEventListener('hashchange', marcar)
    var tentativas = 0
    var vigia = setInterval(function () { marcar(); if (++tentativas >= 10) clearInterval(vigia) }, 500)
  }

  function irPara(variante) {
    var destino = new URL(variante.url, location.href)
    qs.forEach(function (val, k) { if (!destino.searchParams.has(k)) destino.searchParams.set(k, val) })
    destino.searchParams.set('vab', variante.id + '.' + visitante)
    location.replace(destino.toString())
  }

  function mesmaPagina(url) {
    try {
      var u = new URL(url, location.href)
      return u.host === location.host && u.pathname.replace(/\/$/, '') === location.pathname.replace(/\/$/, '')
    } catch (e) { return false }
  }

  function aplicar(variante, cfg) {
    if (cfg.tipo !== 'pagina') {
      aplicarTextos(variante)
      // SPA (Lovable/React): o hero pode ser desenhado depois ou redesenhado.
      if (!variante.original && window.MutationObserver) {
        var pendente = false
        new MutationObserver(function () {
          if (pendente) return
          pendente = true
          requestAnimationFrame(function () { pendente = false; aplicarTextos(variante) })
        }).observe(document.documentElement, { childList: true, subtree: true })
      }
    }
    liberar()
  }

  // ── Conversões
  var convertido = false
  api.converter = function (origem) {
    if (convertido || !api.variante || api.previa) return
    convertido = true
    enviar({ e: SLUG, v: api.variante.id, vis: visitante, t: 'conversao', o: origem === 'clique' ? 'clique' : 'lead', p: location.href, u: utm, d: dispositivo })
  }

  function marcaAB() {
    return { e: SLUG, v: api.variante.id, vis: visitante, d: dispositivo, u: utm }
  }

  function ouvirConversoes(cfg) {
    var contaLead = cfg.conversao !== 'clique'
    var contaClique = cfg.conversao !== 'lead'

    // Formulário que posta no lead-capture: o lead já chega ligado à variante.
    if (contaLead && window.fetch) {
      var fetchOriginal = window.fetch
      window.fetch = function (entrada, init) {
        try {
          var url = typeof entrada === 'string' ? entrada : (entrada && entrada.url) || ''
          if (/\/api\/lead-capture/.test(url) && init && typeof init.body === 'string') {
            var corpo = JSON.parse(init.body)
            if (corpo && typeof corpo === 'object' && !Array.isArray(corpo)) {
              corpo._ab = (corpo._ab || []).concat([marcaAB()])
              init = Object.assign({}, init, { body: JSON.stringify(corpo) })
            }
          }
        } catch (e) { /* corpo que não é JSON: segue como veio */ }
        return fetchOriginal.call(this, entrada, init)
      }
    }
    if (contaLead) {
      document.addEventListener('submit', function (ev) {
        var f = ev.target
        if (!f || !/\/api\/lead-capture/.test(f.action || '')) return
        var campo = f.querySelector('input[name="_ab"]') || document.createElement('input')
        campo.type = 'hidden'
        campo.name = '_ab'
        campo.value = JSON.stringify([marcaAB()])
        if (!campo.parentNode) f.appendChild(campo)
      }, true)

      // Evento Lead do GTM (cobre form que vai para n8n ou outro destino).
      var lidos = 0
      setInterval(function () {
        var dl = window.dataLayer
        if (!dl || !dl.length) return
        for (; lidos < dl.length; lidos++) {
          var it = dl[lidos]
          var nome = it && (it.event || (it[0] === 'event' && it[1]))
          if (nome === 'Lead' || nome === 'generate_lead' || nome === 'lead') api.converter('lead')
        }
      }, 500)
    }

    if (contaClique) {
      document.addEventListener('click', function (ev) {
        var el = ev.target && ev.target.closest && ev.target.closest('a, button, [data-ab-convert]')
        if (!el) return
        var href = el.getAttribute('href') || ''
        if (el.hasAttribute('data-ab-convert') || /wa\.me\/|api\.whatsapp\.com|web\.whatsapp\.com|whatsapp:\/\//i.test(href)) {
          api.converter('clique')
        }
      }, true)
    }
  }

  // ── Configuração (CDN, 30 s). Falhou = Original, sem contar nada.
  fetch(API + '?e=' + encodeURIComponent(SLUG))
    .then(function (r) { return r.ok ? r.json() : null })
    .then(function (cfg) { if (cfg) iniciar(cfg); else liberar() })
    .catch(liberar)
})()
