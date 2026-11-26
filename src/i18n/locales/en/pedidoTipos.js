// Inglês dos tipos de pedido de src/lib/pedidoTipos.js, lido só pela página /pedido/:token.
// tipos.<id>.campos.<k> = { label, curto, placeholder, ajuda, opcoes.<valor>.{ label, desc } }.
// Texto que muda com as respostas guarda uma variante por chave (ex.: label.pronto / label.outro),
// escolhida em VARIANTES de PedidoPublico.jsx. Os valores enviados ao servidor não mudam.

const PLATAFORMAS = {
  meta: { label: 'Meta Ads', desc: 'Facebook and Instagram' },
  google: { label: 'Google Ads' },
}
const DECIDAM = { label: 'You decide' }

const DESTINO = {
  label: 'Where does someone who clicks the ad go?', curto: 'Destination',
  opcoes: {
    whatsapp: { label: 'WhatsApp' },
    site: { label: 'Landing page or website' },
    formulario: { label: 'Instagram form' },
    perfil: { label: 'Instagram profile' },
    nao_sei: { label: "I don't know yet" },
  },
}
const DESTINO_LINK = { label: 'Page link', curto: 'Destination link', placeholder: 'https://' }
const OBS = { label: 'Anything else we need to know?', curto: 'Notes' }

export default {
  e: ' and ',
  grupos: {
    criacao: 'Creatives and pages',
    campanhas: 'Campaigns',
    outras: 'Something else',
  },
  finais: {
    prazo: { label: 'When do you need it?', curto: 'Desired deadline', ajuda: 'If there is a hard date, like the start of a promotion, put it here.' },
    urgente: { label: "It's urgent: it's hurting sales or customer service right now", curto: 'Urgent' },
    nome: { label: 'Your name', curto: 'Requested by' },
    contato: { label: 'Your WhatsApp or email', curto: 'Contact', placeholder: 'So the team can ask a quick question, if needed' },
  },
  tipos: {
    criativo_estatico: {
      nome: 'Static creative',
      resumo: 'Ad artwork for feed or stories',
      prazoMsg: 'From request to artwork live usually takes about {n} business days, because the copy and the artwork go through your approval.',
      titulo: 'Static creative · {assunto}',
      campos: {
        assunto: { label: "What's the ad about?", curto: 'Subject', placeholder: 'E.g.: car service promotion in November' },
        situacao: {
          label: "What's the status of the artwork?", curto: 'Status',
          opcoes: {
            pronto: { label: "It's ready", desc: 'Just put it in the ads' },
            criar: { label: 'I need you to create it', desc: "I'll send the material and the text" },
          },
        },
        drive: {
          curto: 'Drive',
          label: { pronto: 'Drive link with the finished artwork', outro: 'Drive link with the material for the artwork' },
          ajuda: { pronto: 'It can be the folder with all the artwork.', outro: 'Photos, logo, product, everything that goes into the artwork.' },
        },
        formatos: {
          label: 'In which formats?', curto: 'Formats',
          opcoes: {
            feed: { label: 'Feed', desc: 'Square or 4:5' },
            story: { label: 'Stories and Reels', desc: 'Vertical' },
            decidam: DECIDAM,
          },
        },
        quantidade: { label: 'How many pieces?', curto: 'Quantity', placeholder: '1' },
        texto: {
          label: 'What needs to be written on the artwork?', curto: 'Artwork text',
          placeholder: 'Offer, price, terms and deadline. E.g.: full service for R$ 199 until 11/30, up to 3 card installments',
        },
        referencias: { label: 'References you like', curto: 'References', placeholder: 'Links to ads or profiles; screenshots can go in the same Drive' },
        destino: DESTINO,
        destino_link: DESTINO_LINK,
        campanha: {
          label: 'Which campaign does it go into?', curto: 'Campaign',
          opcoes: {
            atual: { label: 'The one already running' },
            nova: { label: 'A new campaign' },
            decidam: DECIDAM,
          },
        },
        obs: OBS,
      },
    },
    criativo_video: {
      nome: 'Video creative',
      resumo: 'Video for Reels, Stories or feed',
      prazoMsg: {
        editar: 'From request to video live usually takes about {n} business days, counting copy, editing and your approval.',
        roteiro: 'From request to video live usually takes about {n} business days after recording, counting copy, editing and your approval.',
      },
      titulo: 'Video creative · {assunto}',
      campos: {
        assunto: { label: "What's the video about?", curto: 'Subject', placeholder: 'E.g.: launch of the new maintenance plan' },
        situacao: {
          label: "Where does the video stand?", curto: 'Status',
          opcoes: {
            pronto: { label: "It's ready", desc: 'Just put it in the ads' },
            editar: { label: "I've recorded it", desc: 'I need you to edit it' },
            roteiro: { label: "I haven't recorded it yet", desc: 'I need the script first' },
          },
        },
        drive: {
          curto: 'Drive',
          label: {
            pronto: 'Drive link with the finished video',
            editar: 'Drive link with the recorded videos',
            outro: 'Drive link with supporting material (optional)',
          },
          ajuda: "Upload the original files from your phone, not through WhatsApp (it lowers the quality).",
        },
        formatos: {
          label: 'In which formats?', curto: 'Formats',
          opcoes: {
            vertical: { label: 'Vertical', desc: 'Reels and Stories' },
            feed: { label: 'Feed', desc: 'Square or 4:5' },
            horizontal: { label: 'Horizontal', desc: 'YouTube' },
            decidam: DECIDAM,
          },
        },
        duracao: {
          label: 'Approximate length', curto: 'Length',
          opcoes: {
            15: { label: 'Up to 15 s' },
            30: { label: '15 to 30 s' },
            60: { label: '30 to 60 s' },
            mais: { label: 'Over 1 min' },
            decidam: DECIDAM,
          },
        },
        mensagem: {
          label: "What's the main message of the video?", curto: 'Message',
          placeholder: 'What the viewer needs to understand and what they do after watching',
        },
        legenda: {
          label: 'Do you want captions on the video?', curto: 'Captions',
          opcoes: { sim: { label: 'Yes' }, nao: { label: 'No' }, decidam: DECIDAM },
        },
        referencias: { label: 'References you like', curto: 'References', placeholder: 'Links to videos or profiles with the style you want' },
        destino: DESTINO,
        destino_link: DESTINO_LINK,
        obs: OBS,
      },
    },
    landing_page: {
      nome: 'Landing page',
      resumo: 'A new page or a change to an existing one',
      prazoMsg: 'A new page usually takes about {n} business days to go into the campaign, with the copy and layout approved by you.',
      tituloAjuste: 'Landing page change · {texto}',
      tituloNova: 'New landing page · {texto}',
      campos: {
        situacao: {
          label: 'What do you need?', curto: 'Request',
          opcoes: {
            nova: { label: 'A new page' },
            ajuste: { label: 'A change to an existing page' },
          },
        },
        pagina_link: { label: 'Page link', curto: 'Page', placeholder: 'https://' },
        ajuste: {
          label: 'What needs to change?', curto: 'Change',
          placeholder: "E.g.: change the price in the plans section from R$ 297 to R$ 347 and remove Ana's testimonial",
        },
        oferta: { label: 'What will the page sell or offer?', curto: 'Offer', placeholder: 'Product or service, price and special terms, if any' },
        publico: { label: 'Who is the page for?', curto: 'Audience', placeholder: 'Who the ideal customer is, which city, what they are looking for' },
        objetivo: {
          label: 'What does the visitor do on the page?', curto: 'Action on the page',
          opcoes: {
            formulario: { label: 'Fills out a form' },
            whatsapp: { label: 'Messages on WhatsApp' },
            compra: { label: 'Buys directly' },
            evento: { label: 'Signs up for an event or class' },
          },
        },
        drive: { label: 'Drive link with logo, photos and texts (optional)', curto: 'Drive', ajuda: "If you don't have it, we'll use what we already have from your brand." },
        referencias: { label: 'Pages you like', curto: 'References', placeholder: 'Links to pages as reference' },
        dominio: { label: 'At which address will it live?', curto: 'Address', placeholder: "E.g.: promo.yourcompany.com. If you don't know, we'll sort it out" },
        obs: OBS,
      },
    },
    nova_campanha: {
      nome: 'New campaign',
      resumo: 'Advertise a product, service or promotion',
      titulo: 'New campaign · {oferta}',
      campos: {
        oferta: {
          label: 'What are we advertising?', curto: 'Offer',
          placeholder: 'Product, service or promotion, with price and terms. E.g.: Black Friday with 20% off all tires',
        },
        objetivo: {
          label: 'What do you want people to do?', curto: 'Goal',
          opcoes: {
            whatsapp: { label: 'Message on WhatsApp' },
            cadastro: { label: 'Fill out a sign-up form' },
            site: { label: 'Buy on the website' },
            loja: { label: 'Call or visit the store' },
            alcance: { label: 'Get to know the brand' },
          },
        },
        whatsapp_numero: { label: 'Which WhatsApp receives the contacts?', curto: 'WhatsApp', ajuda: "Leave blank if it's the same as today's ads." },
        link: { label: 'Website or page link', curto: 'Link', placeholder: 'https://' },
        plataformas: {
          label: 'Where to advertise?', curto: 'Platforms',
          opcoes: { ...PLATAFORMAS, decidam: DECIDAM },
        },
        regiao: { label: 'For which cities or regions?', curto: 'Region', placeholder: 'E.g.: Goiânia and Aparecida, or a 10 km radius around the store' },
        publico: { label: 'Who is the ideal customer?', curto: 'Audience', placeholder: 'Age, profession, what they are looking for' },
        verba: { label: 'How much to invest in this campaign?', curto: 'Budget' },
        verba_origem: {
          label: 'This amount is…', curto: 'Budget source',
          opcoes: {
            nova: { label: 'New money', desc: 'On top of what we already invest' },
            atual: { label: "Comes out of today's budget", desc: 'Taken from other campaigns' },
          },
        },
        inicio: { label: 'When does it start?', curto: 'Start' },
        ate: {
          label: 'Until when?', curto: 'Duration',
          opcoes: { sem_fim: { label: 'No end date' }, data: { label: 'Until a date' } },
        },
        fim: { label: 'Until which day?', curto: 'End' },
        criativos: {
          label: 'Do you already have the creatives?', curto: 'Creatives',
          opcoes: {
            tenho: { label: "Yes, they're in the Drive" },
            criar: { label: 'I need you to create them' },
            atuais: { label: 'Use the ones already running' },
          },
        },
        drive: { label: 'Drive link with the creatives', curto: 'Drive' },
        regras: { label: 'Offer rules', curto: 'Rules', placeholder: 'Validity, stock, fine print that needs to appear' },
        obs: OBS,
      },
    },
    orcamento: {
      nome: 'Budget',
      resumo: 'Increase or decrease the investment',
      titulo: 'Budget: {acao} {plataformas} to {valor}',
      tituloAcao: { aumentar: 'increase', diminuir: 'decrease' },
      campos: {
        acao: {
          label: 'What do you want to do?', curto: 'Change',
          opcoes: {
            aumentar: { label: 'Increase the investment' },
            diminuir: { label: 'Decrease the investment' },
          },
        },
        plataformas: { label: 'On which platform?', curto: 'Platforms', opcoes: PLATAFORMAS },
        valor: { label: "What's the new amount?", curto: 'New amount', ajuda: 'Enter the total for both and explain the split in the notes.' },
        valor_atual: { label: 'How much is it today?', curto: "Today's amount", ajuda: 'If you know.' },
        inicio: { label: 'Starting when?', curto: 'Starting' },
        ate: {
          label: 'Until when?', curto: 'Until',
          opcoes: { aviso: { label: 'Until I say so' }, data: { label: 'Until a date' } },
        },
        fim: { label: 'Until which day?', curto: 'End' },
        pagamento: {
          label: "Does the account's payment already cover the new amount?", curto: 'Payment',
          ajuda: 'On a prepaid account (boleto or Pix), the balance has to come in before the increase.',
          opcoes: {
            sim: { label: "Yes, it's all set" },
            ajuda: { label: 'No, I need help' },
            nao_sei: { label: "I don't know" },
          },
        },
        motivo: { label: 'Why the change?', curto: 'Reason', placeholder: 'E.g.: Black Friday promotion, slower month, fully booked schedule' },
        obs: OBS,
      },
    },
    whatsapp: {
      nome: 'WhatsApp change',
      resumo: 'Change the number or message in the ads',
      titulo: 'WhatsApp: {partes}',
      tituloTrocar: 'change the number to {numero}',
      tituloAdicionar: 'add the number {numero}',
      tituloMensagem: 'change the message',
      tituloAlteracao: 'change',
      campos: {
        mudanca: {
          label: 'What changes?', curto: 'Change',
          opcoes: {
            trocar: { label: 'Change the number', desc: 'That receives the contacts from the ads' },
            mensagem: { label: 'Change the message', desc: 'That the person sends when clicking' },
            adicionar: { label: 'Add another number', desc: 'Another location or agent' },
            outra: { label: 'Something else' },
          },
        },
        numero_atual: { label: "Today's number", curto: 'Current number', ajuda: 'Helps find the right ads.' },
        numero_novo: { label: 'New number, with area code', curto: 'New number' },
        business: {
          label: 'Does this number use WhatsApp Business?', curto: 'WhatsApp Business',
          opcoes: { sim: { label: 'Yes' }, nao: { label: 'No' }, nao_sei: { label: "I don't know" } },
        },
        aviso_codigo: {
          label: 'To connect the new number to the ads, Facebook sends a code by SMS or WhatsApp to it. On the day of the change, keep someone with that phone nearby.',
        },
        mensagem: {
          label: 'What message does the person send when clicking?', curto: 'Message',
          placeholder: "E.g.: Hi! I saw the service ad and I'd like to book.", ajuda: "It's the text already typed in when the chat opens.",
        },
        outra_desc: { label: 'Tell us what needs to change', curto: 'Other change' },
        onde: {
          label: 'In which ads?', curto: 'Where',
          opcoes: { todos: { label: 'All of them' }, alguns: { label: 'Only some' } },
        },
        onde_quais: { label: 'Which ones?', curto: 'Which ads', placeholder: 'E.g.: only the Trindade location ones' },
        inicio: { label: 'Starting when?', curto: 'Starting' },
        obs: OBS,
      },
    },
    outras: {
      nome: 'Other',
      resumo: 'Any other request, with a free-text field',
      campos: {
        resumo: { label: 'Request summary', curto: 'Summary', placeholder: 'E.g.: change the promotion price in the ads' },
        detalhes: { label: 'Details', curto: 'Details', placeholder: 'What needs to be done, where, and what done looks like' },
        arquivo: { label: 'File link', curto: 'File', placeholder: 'https://', ajuda: "If it's from Google Drive, we check that it's open." },
      },
    },
  },
}
