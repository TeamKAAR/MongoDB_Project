function Button({ className = '', variant = 'primary', ...props }) {
  return (
    <button
      className={`ui-button ui-button-${variant} ${className}`.trim()}
      {...props}
    />
  )
}

export { Button }
