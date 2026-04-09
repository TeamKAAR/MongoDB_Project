function Input({ className = '', ...props }) {
  return <input className={`ui-input ${className}`.trim()} {...props} />
}

export { Input }
