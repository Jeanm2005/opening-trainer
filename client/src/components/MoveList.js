function MoveList({ moves }) {
    if (moves.length === 0) return (
        <div className="move-list empty">
            <p>Play a move to begin...</p>
        </div>
    );

    const pairs = [];
    for (let i = 0; i < moves.length; i += 2) {
        pairs.push({
            number: Math.floor(i / 2) + 1,
            white: moves[i],
            black: moves[i + 1] || ''
        });
    }

    return (
        <div className="move-list">
            {pairs.map(pair => (
                <span key={pair.number} className="move-pair">
                    <span className="move-number">{pair.number}.</span>
                    <span className="move">{pair.white}</span>
                    {pair.black && <span className="move">{pair.black}</span>}
                </span>
            ))}
        </div>
    );
}

export default MoveList;