// Fractal / reeded glass, built exactly like the Figma frame: a row of thin strips, each showing a
// 10%-wide slice of the same image, stepping 3% further across it per strip.
export default function Fluted({ src, strips, className = "" }: { src: string; strips: number; className?: string }) {
  return (
    <div className={`fluted ${className}`} aria-hidden>
      {Array.from({ length: strips }, (_, i) => (
        // background-size 1000% → the strip shows 10% of the image; position i/30 → offset 3% × i
        <span key={i} style={{ backgroundImage: `url(${src})`, backgroundPositionX: `${(i / 30) * 100}%` }} />
      ))}
    </div>
  );
}
