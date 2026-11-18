import { useId } from 'react';

// A 0-100 slider with a number and a describing word.
export default function RangeSlider({ label, value, onChange, word, lowLabel, highLabel }) {
  const id = useId();
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="font-medium text-frost">
          {label}
        </label>
        <span className="pixel-label text-silver">
          <span className="text-orchid">{word}</span> · <span className="tabular-nums">{String(value).padStart(3, '0')}</span>
        </span>
      </div>
      <input
        id={id}
        type="range"
        min="0"
        max="100"
        step="1"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-valuetext={`${value} out of 100, ${word}`}
        className="spectrum-range mt-2"
        style={{ '--fill': `${value}%` }}
      />
      <div className="pixel-label flex justify-between text-silver">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}
