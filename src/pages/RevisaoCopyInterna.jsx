// Revisão interna de uma leva de copy (/revisao-copy/:token, exige login): a
// mesma tela do link do cliente, decidindo a etapa do time. Ver
// AprovacaoCopyPublico e api/copy-aprovacao.js.
import AprovacaoCopyPublico from './AprovacaoCopyPublico'

export default function RevisaoCopyInterna() {
  return <AprovacaoCopyPublico modo="interno" />
}
