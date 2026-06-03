import { avatarGradient, initials } from '../config/workItems'

type Props = {
  name: string
  size?: number
  title?: string
  style?: React.CSSProperties
}

export function Avatar({ name, size, title, style }: Props) {
  const dim = size ? { width: size, height: size, fontSize: size * 0.38 } : undefined
  return (
    <span
      className="avatar"
      title={title ?? name}
      style={{ background: avatarGradient(name), ...dim, ...style }}
    >
      {initials(name)}
    </span>
  )
}
