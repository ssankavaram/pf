/**
 * "Volatility explained" widget from the Figma frame (Untitled, node 57:1718), shown on the
 * Investing education card. 327px wide design; scaled with the card via --k.
 */
export default function HomeWidget() {
  return (
    <div className="hw" aria-hidden>
      <div className="hw-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="hw-chart" src="/home/widget-chart.png" alt="" width={100} height={120} />
        <div className="hw-row">
          <div className="hw-label">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/home/sparkle.svg" alt="" width={18} height={18.5} />
            <span>Volatility explained</span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="hw-close" src="/home/close.svg" alt="" width={20} height={20} />
        </div>
        <p className="hw-q">Was this drop NVDA, or the whole market?</p>
      </div>
      <div className="hw-chips">
        <span>What moves NVDA?</span>
        <span>What&rsquo;s beta?</span>
        <span className="is-tint">Will it bounce back?</span>
      </div>
    </div>
  );
}
