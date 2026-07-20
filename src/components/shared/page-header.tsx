interface PageHeaderProps {
  title: string
  description: string
  actions?: React.ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>
      {actions && <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">{actions}</div>}
    </div>
  )
}
