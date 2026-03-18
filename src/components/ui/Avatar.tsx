interface AvatarProps {
  src: string
  name?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizeClasses = {
  sm: { img: 'w-5 h-5', text: 'text-lg' },
  md: { img: 'w-8 h-8', text: 'text-xl' },
  lg: { img: 'w-10 h-10', text: 'text-3xl' },
  xl: { img: 'w-16 h-16', text: 'text-5xl' },
}

export function Avatar({ src, name, size = 'md' }: AvatarProps) {
  const classes = sizeClasses[size]
  const isUrl = src.startsWith('http')

  if (isUrl) {
    return <img src={src} alt={name ?? ''} className={`${classes.img} rounded-full inline-block`} referrerPolicy="no-referrer" />
  }

  return <span className={classes.text}>{src}</span>
}
