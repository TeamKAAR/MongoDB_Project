function getHomePath(user) {
  if (!user) {
    return '/login'
  }

  if (user.role === 'student' && user.student_profile_id) {
    return `/students/${user.student_profile_id}`
  }

  return '/dashboard'
}

function roleAllows(user, allowedRoles = []) {
  if (!user) {
    return false
  }

  if (allowedRoles.length === 0) {
    return true
  }

  return allowedRoles.includes(user.role)
}

export { getHomePath, roleAllows }
