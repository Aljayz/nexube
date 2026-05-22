export default function SettingsSection({ icon: Icon, title, description, children, className = '' }) {
  return (
    <div className={`pt-lg border-t border-border/40 first:border-t-0 first:pt-0 ${className}`}>
      <div className="flex items-center gap-sm mb-sm">
        {Icon && <Icon className="w-5 h-5 text-accent shrink-0" />}
        <h2 className="text-lg font-bold text-text-primary">{title}</h2>
      </div>
      {description && <p className="text-sm text-text-muted mb-md">{description}</p>}
      {children}
    </div>
  );
}
