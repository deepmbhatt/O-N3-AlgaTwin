export default function Mascot({ message, mood = 'calm', compact = false }) {
  return (
    <div className={`mascot-guide mascot-${mood} ${compact ? 'mascot-compact' : ''}`}>
      <div className="mascot-speech">
        <span className="eyebrow">Aoi · pond guide</span>
        <p>{message}</p>
      </div>
      <img src="/images/aoi-mascot.png" alt="Aoi, the AlgaTwin pond guide" />
    </div>
  );
}
