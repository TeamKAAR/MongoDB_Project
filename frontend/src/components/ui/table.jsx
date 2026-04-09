function Table({ className = '', ...props }) {
  return <table className={`ui-table ${className}`.trim()} {...props} />
}

function TableHeader(props) {
  return <thead {...props} />
}

function TableBody(props) {
  return <tbody {...props} />
}

function TableRow({ className = '', ...props }) {
  return <tr className={`ui-table-row ${className}`.trim()} {...props} />
}

function TableHead({ className = '', ...props }) {
  return <th className={`ui-table-head ${className}`.trim()} {...props} />
}

function TableCell({ className = '', ...props }) {
  return <td className={`ui-table-cell ${className}`.trim()} {...props} />
}

export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow }
