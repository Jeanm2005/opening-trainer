import { useState, useCallback, useEffect } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import MoveList from './components/MoveList';
import AnalysisPanel from './components/AnalysisPanel';
import './App.css';

function App() {
  const [game, setGame] = useState(new Chess());
  const [moves, setMoves] = useState([]);
  const [openingData, setOpeningData] = useState(null);
  const [openingInfo, setOpeningInfo] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pgn, setPgn] = useState('');
  const [pgnError, setPgnError] = useState('');
  const [selectedSquare, setSelectedSquare] = useState(null);

  const [boardWidth, setBoardWidth] = useState(
    Math.min(440, window.innerWidth - 80)
  );

  useEffect(() => {
    const handleResize = () => {
      setBoardWidth(Math.min(440, window.innerWidth - 80));
    };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);

  const analyzePosition = useCallback(async (currentMoves) => {
    if (currentMoves.length === 0) return;
    setIsAnalyzing(true);
    try {
      // Step 1 - identify opening
      const analyzeRes = await fetch('http://localhost:5000/analyze-opening', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moves: currentMoves })
      });
      const analyzeData = await analyzeRes.json();
      setOpeningData(analyzeData);

      // Step 2 - get AI explanation
      const infoRes = await fetch('http://localhost:5000/opening-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opening_name: analyzeData.opening_name,
          eco_code: analyzeData.eco_code,
          moves: currentMoves
        })
      });
      const infoData = await infoRes.json();
      setOpeningInfo(infoData);
    } catch (err) {
      console.error('Analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);


  const onDrop = useCallback(({ sourceSquare, targetSquare }) => {
  console.log('DROP fired:', sourceSquare, targetSquare);
  try {
    const gameCopy = new Chess(game.fen());
    const move = gameCopy.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: 'q'
    });
    if (!move) return false;
    const newMoves = [...moves, move.san];
    setGame(gameCopy);
    setMoves(newMoves);
    analyzePosition(newMoves);
    return true;
  } catch (e) {
    console.error('Move error:', e);
    return false;
  }
}, [game, moves, analyzePosition]);

const onSquareClick = useCallback(({ square }) => {
  if (!selectedSquare) {
    const piece = game.get(square);
    if (piece && piece.color === game.turn()) {
      setSelectedSquare(square);
    }
    return;
  }

  // Clicked the same square — deselect
  if (selectedSquare === square) {
    setSelectedSquare(null);
    return;
  }

  try {
    const gameCopy = new Chess(game.fen());
    const move = gameCopy.move({
      from: selectedSquare,
      to: square,
      promotion: 'q'
    });
    if (move) {
      const newMoves = [...moves, move.san];
      setGame(gameCopy);
      setMoves(newMoves);
      analyzePosition(newMoves);
    }
  } catch (e) {
    // Invalid move — just deselect
  }
  setSelectedSquare(null);
}, [selectedSquare, game, moves, analyzePosition]);

  const handleReset = () => {
    setGame(new Chess());
    setMoves([]);
    setOpeningData(null);
    setOpeningInfo(null);
    setPgn('');
    setPgnError('');
    setSelectedSquare(null);
  };

  const handlePgnLoad = () => {
    setPgnError('');
    try {
      const newGame = new Chess();
      newGame.loadPgn(pgn.trim());
      const history = newGame.history();
      if (history.length === 0) {
        setPgnError('No moves found in PGN.');
        return;
      }
      setGame(newGame);
      setMoves(history);
      analyzePosition(history);
    } catch {
      setPgnError('Invalid PGN. Please check the format and try again.');
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <span className="logo">♟</span>
          <h1>Opening Trainer</h1>
        </div>
        <button className="reset-btn" onClick={handleReset}>Reset Board</button>
      </header>

      <main className="app-main">
        <div className="board-section">
          <Chessboard
            options={{
              position: game.fen(),
              boardWidth: boardWidth,
              onPieceDrop: onDrop,
              onSquareClick: onSquareClick,
              selectedSquare: selectedSquare,
              customBoardStyle: {
                borderRadius: '6px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.18)'
              }
            }}
          />
          <MoveList moves={moves} />

          <div className="pgn-section">
            <textarea
              className="pgn-input"
              placeholder="Paste PGN here..."
              value={pgn}
              onChange={e => setPgn(e.target.value)}
              rows={3}
            />
            {pgnError && <p className="pgn-error">{pgnError}</p>}
            <button className="pgn-btn" onClick={handlePgnLoad}>Load PGN</button>
          </div>
        </div>

        <AnalysisPanel
          openingData={openingData}
          openingInfo={openingInfo}
          isAnalyzing={isAnalyzing}
        />
      </main>
    </div>
  );
}

export default App;