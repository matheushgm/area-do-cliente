// Alça de redimensionar coluna: fica na borda direita de um <th position:relative>.
// Arrastar muda a largura; duplo clique volta ao padrão. Ver useColumnWidths.
export default function ResizeHandle({ onPointerDown, onDoubleClick, className = '' }) {
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      title="Arraste para ajustar a largura (duplo clique volta ao padrão)"
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      onClick={(e) => e.stopPropagation()}
      className={`absolute top-0 right-0 h-full w-2.5 cursor-col-resize touch-none select-none group/rz flex justify-center ${className}`}
    >
      <span className="w-px h-full bg-current opacity-15 group-hover/rz:opacity-60 group-hover/rz:w-0.5 transition-all" />
    </span>
  )
}
