import { getAvatarById } from '../../lib/utils'

interface AvatarProps {
  avatarId: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24',
}

export function Avatar({ avatarId, size = 'md', className = '' }: AvatarProps) {
  const avatar = getAvatarById(avatarId)

  // Se encontrou o avatar nas imagens, renderiza a imagem
  if (avatar) {
    return (
      <div className={`${sizeClasses[size]} rounded-full overflow-hidden flex-shrink-0 ${className}`}>
        <img
          src={avatar.src}
          alt={avatar.id}
          className="w-full h-full object-cover"
        />
      </div>
    )
  }

  // Fallback para emoji (compatibilidade com dados antigos)
  const emojiSizeClasses = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-4xl',
    xl: 'text-6xl',
  }

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 ${className}`}>
      <span className={emojiSizeClasses[size]}>{avatarId}</span>
    </div>
  )
}
