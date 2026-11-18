// A retro "desktop window": title bar on top, content below.
// Used as the main container for every section of the site.
export default function Window({ title, status, as: Tag = 'section', className = '', children, ...rest }) {
  return (
    <Tag className={`window ${className}`} {...rest}>
      <div className="window-bar">
        <span className="pixel-label truncate">{title}</span>
        <span className="flex shrink-0 items-center gap-3">
          {status && <span className="pixel-label hidden text-rose sm:inline">{status}</span>}
          <span className="flex gap-1" aria-hidden="true">
            <span className="h-2 w-2 border border-silver/60" />
            <span className="h-2 w-2 border border-silver/60" />
            <span className="h-2 w-2 bg-silver/60" />
          </span>
        </span>
      </div>
      {children}
    </Tag>
  );
}
