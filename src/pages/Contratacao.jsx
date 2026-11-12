import { useParams } from 'react-router-dom'
import Toast from '../components/UI/Toast'
import { useToast } from '../hooks/useToast'
import { CargosGrid, CargoHub } from '../components/Contratacao/CargosGrid'
import NovaEntrevista from '../components/Contratacao/NovaEntrevista'
import Entrevista from '../components/Contratacao/Entrevista'
import BancoTalentos from '../components/Contratacao/BancoTalentos'
import CandidatoPerfil from '../components/Contratacao/CandidatoPerfil'

// Contratação (sidebar > Time). Só admin (rota com RequireAdmin + RLS nas tabelas).
//   /contratacao                                  cargos em quadrados
//   /contratacao/:cargo                           as duas funções do cargo
//   /contratacao/:cargo/nova                      dados do candidato + currículo
//   /contratacao/:cargo/entrevista/:id            roteiro gamificado + IA + resultado
//   /contratacao/:cargo/talentos                  banco de talentos
//   /contratacao/:cargo/candidato/:id             perfil e histórico
// Config dos cargos e régua de pontos: src/lib/contratacao.js.
export default function Contratacao({ view }) {
  const { cargo, id } = useParams()
  const { toast, showToast } = useToast()

  let tela
  if (view === 'entrevista') tela = <Entrevista key={id} cargoId={cargo} entrevistaId={id} showToast={showToast} />
  else if (view === 'nova') tela = <NovaEntrevista cargoId={cargo} showToast={showToast} />
  else if (view === 'talentos') tela = <BancoTalentos cargoId={cargo} showToast={showToast} />
  else if (view === 'candidato') tela = <CandidatoPerfil key={id} cargoId={cargo} candidatoId={id} showToast={showToast} />
  else if (cargo) tela = <CargoHub cargoId={cargo} />
  else tela = <CargosGrid />

  return (
    <>
      {tela}
      <Toast toast={toast} />
    </>
  )
}
