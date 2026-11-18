// Draws a small pixel icon from rows of "#" and "." characters.
export default function PixelGlyph({ rows, className = '' }) {
  const size = rows.length;
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      fill="currentColor"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {rows.flatMap((row, y) =>
        [...row].map((cell, x) =>
          cell === '#' ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" /> : null,
        ),
      )}
    </svg>
  );
}
