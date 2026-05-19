function AnalysisPanel({ openingData, openingInfo, isAnalyzing }) {
    if (!openingData && !isAnalyzing) return (
        <div className="analysis-panel empty">
            <div className="empty-state">
                <span className="empty-icon">♟</span>
                <p>Play moves on the board or paste a PGN to get opening analysis.</p>
            </div>
        </div>
    );

    return (
        <div className="analysis-panel">
            {openingData && (
                <div className="opening-header">
                    <div className="opening-name">{openingData.opening_name}</div>
                    <div className="eco-badge">{openingData.eco_}</div>
                </div>
            )}

            {isAnalyzing && (
                <div className="analyzing">
                    <div className="spinner" />
                    <span>Analyzing position...</span>
                </div>
            )}

            {openingInfo && !isAnalyzing && (
                <div className="info-sections">
                    <InfoSection title="Main Ideas" content={openingInfo.main_ideas} icon="💡"/>
                    <InfoSection title="White's Plans" content={openingInfo.white_plans} icon="⬜" />
                    <InfoSection title="Black's Plans" content={openingInfo.black_plans} icon="⬛" />
                    <InfoSection title="Common Traps" content={openingInfo.common_traps} icon="⚠️" />
                    <InfoSection title="Beginner Mistakes" content={openingInfo.beginner_mistakes} icon="🚫" />
                    <InfoSection title="Middlegame Themes" content={openingInfo.middlegame_themes} icon="♟" />
                </div>
            )}
        </div>
    );
}

function InfoSection({ title, content, icon}) {
    if (!content) return null;
    return (
        <div className="info-section">
            <h3><span className="section-icon">{icon}</span>{title}</h3>
            <p>{content}</p>
        </div>
    );
}

export default AnalysisPanel;