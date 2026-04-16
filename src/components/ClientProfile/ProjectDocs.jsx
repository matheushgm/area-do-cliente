import { useState, useEffect } from 'react'
import { FileText } from 'lucide-react'
import { getSignedUrl } from '../../lib/supabase'

function DocChip({ label, path, url, color }) {
  const filename = path?.split('/').pop() ?? label
  return (
    <div className="flex items-center gap-2 bg-rl-surface border border-rl-border rounded-xl px-4 py-2.5">
      <FileText className={`w-4 h-4 ${color}`} />
      <div className="mr-2">
        <p className="text-[10px] text-rl-muted">{label}</p>
        <p className="text-xs text-rl-text">{filename}</p>
      </div>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-[10px] font-medium text-rl-purple hover:underline whitespace-nowrap"
        >
          Abrir
        </a>
      )}
    </div>
  )
}

export default function ProjectDocs({ project }) {
  const [urls, setUrls] = useState({ raioX: null, sla: null })

  useEffect(() => {
    async function loadUrls() {
      const [raioX, sla] = await Promise.all([
        project.raioXFileName ? getSignedUrl('project-docs', project.raioXFileName) : null,
        project.slaFileName   ? getSignedUrl('project-docs', project.slaFileName)   : null,
      ])
      setUrls({ raioX, sla })
    }
    if (project.raioXFileName || project.slaFileName) loadUrls()
  }, [project.raioXFileName, project.slaFileName])

  if (!project.raioXFileName && !project.slaFileName) return null

  return (
    <div>
      <p className="text-xs font-semibold text-rl-muted uppercase tracking-wider mb-3">📁 Documentos</p>
      <div className="flex flex-wrap gap-3">
        {project.raioXFileName && (
          <DocChip label="Raio-X" path={project.raioXFileName} url={urls.raioX} color="text-rl-purple" />
        )}
        {project.slaFileName && (
          <DocChip label="SLA" path={project.slaFileName} url={urls.sla} color="text-rl-cyan" />
        )}
      </div>
    </div>
  )
}
