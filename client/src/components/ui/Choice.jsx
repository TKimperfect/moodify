// A selectable chip built on a real radio button or checkbox,
// so keyboards and screen readers work without extra code.
export default function Choice({ type = 'radio', name, value, checked, onChange, label, hint, suggested = false, className = '' }) {
  return (
    <label className={`relative block cursor-pointer ${className}`}>
      <input type={type} name={name} value={value} checked={checked} onChange={onChange} className="peer sr-only" />
      <span className="choice">
        <span className="flex items-center gap-2">
          <span className="font-medium">{label}</span>
          {suggested && (
            <span className="h-1.5 w-1.5 shrink-0 bg-rose" title="Often chosen with your moods">
              <span className="sr-only">(often chosen with your moods)</span>
            </span>
          )}
        </span>
        {hint && <span className="mt-0.5 block text-xs text-silver">{hint}</span>}
      </span>
    </label>
  );
}
