function initials(name = {}) {
  return `${name.first?.[0] ?? ''}${name.last?.[0] ?? ''}`.toUpperCase()
}

function avatarColor(seed = '') {
  const colors = [
    'rgba(21, 94, 117, 0.18)',
    'rgba(22, 101, 52, 0.18)',
    'rgba(180, 83, 9, 0.18)',
    'rgba(190, 24, 93, 0.18)',
    'rgba(79, 70, 229, 0.18)',
  ]

  const index = seed
    .split('')
    .reduce((total, character) => total + character.charCodeAt(0), 0) % colors.length

  return colors[index]
}

function formatDate(value) {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function toDateInputValue(value) {
  if (!value) {
    return ''
  }

  return new Date(value).toISOString().slice(0, 10)
}

export { avatarColor, formatDate, initials, toDateInputValue }
