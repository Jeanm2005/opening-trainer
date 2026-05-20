function MoveList({ moves, cursor, onMoveClick}) {
    if (moves.length === 0) return (
        <div className="move-list empty">
            <p>Play a move to begin...</p>
        </div>
    );

    const pairs = [];
    for (let i = 0; i < moves.length; i += 2) {
        pairs.push({
            number: Math.floor(i / 2) + 1,
            white: { san: moves[i], idx: i + 1},
            black: moves[i + 1] ? { san: moves[i + 1], idx: i + 2} : null
        });
    }

    return (
        <div className="move-list">
            {pairs.map(pair => (
                <span key={pair.number} className="move-pair">
                    <span className="move-number">{pair.number}.</span>
                    <span
                        className={`move ${cursor === pair.white.idx ? 'active' : ''}`}
                        onClick={() => onMoveClick(pair.white.idx)}
                    >
                        {pair.white.san}
                    </span>
                    {pair.black && (
                        <span
                            className={`move ${cursor === pair.black.idx ? 'active' : ''}`}
                            onClick={() => onMoveClick(pair.black.idx)}
                        >
                            {pair.black.san}
                        </span>
                    )}
                </span>
            ))}
        </div>
    );
}

export default MoveList;