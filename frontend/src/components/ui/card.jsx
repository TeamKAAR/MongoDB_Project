function Card({ className = '', ...props }) {
  return <section className={`ui-card ${className}`.trim()} {...props} />
}

function CardHeader({ className = '', ...props }) {
  return <header className={`ui-card-header ${className}`.trim()} {...props} />
}

function CardTitle({ className = '', ...props }) {
  return <h2 className={`ui-card-title ${className}`.trim()} {...props} />
}

function CardDescription({ className = '', ...props }) {
  return <p className={`ui-card-description ${className}`.trim()} {...props} />
}

function CardContent({ className = '', ...props }) {
  return <div className={`ui-card-content ${className}`.trim()} {...props} />
}

export { Card, CardContent, CardDescription, CardHeader, CardTitle }
