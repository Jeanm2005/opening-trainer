function ExplorerPanel({ explorerData, onMoveClick, isLoading }) {
  if (isLoading) return (
    <div className="explorer-panel">
      <div className="analyzing">
        <div className="spinner" />
        <span>Loading explorer...</span>
      </div>
    </div>
  );

  if (!explorerData || explorerData.moves.length === 0) return (
    <div className="explorer-panel empty">
      <p>No book moves found for this position.</p>
    </div>
  );

  return (
    <div className="explorer-panel">
      <div className="explorer-header">
        <span className="explorer-title">Opening Explorer</span>
        <span className="explorer-total">{explorerData.total} moves</span>
      </div>

      <div className="explorer-moves">
        {explorerData.moves.map((move, i) => (
  <div
    key={move.san}
    className="explorer-move"
    onClick={() => onMoveClick(move.san)}
  >
    <span className="explorer-san">{move.san}</span>
    <div className="explorer-bar-wrap">
      <div className="explorer-bar">
        {move.winrate !== null && (
          <>
            <div className="bar-white" style={{ width: `${Math.min(move.winrate, 100)}%` }} />
            <div className="bar-black" style={{ width: `${Math.max(100 - move.winrate, 0)}%` }} />
          </>
        )}
      </div>
    </div>
    <span className="explorer-score" style={{
      color: move.score > 0 ? '#6aaa6a' : move.score < 0 ? '#cc6666' : '#888'
    }}>
      {move.score !== null ? (move.score > 0 ? '+' : '') + move.score : '??'}
    </span>
    {move.winrate !== null && (
      <span className="explorer-winrate">{move.winrate.toFixed(1)}%</span>
    )}
  </div>
))}
      </div>
      <p className="explorer-note">Click a move to play it · Backspace plays top move</p>
    </div>
  );
}

export default ExplorerPanel;