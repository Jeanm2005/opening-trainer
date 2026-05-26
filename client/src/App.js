import { useState, useCallback, useEffect, useMemo } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import MoveList from './components/MoveList';
import AnalysisPanel from './components/AnalysisPanel';
import './App.css';
import ExplorerPanel from './components/ExplorerPanel';

function App() {
  const [history, setHistory] = useState([]);
  const [cursor, setCursor] = useState(0);
  const [game, setGame] = useState(new Chess());
  const [openingData, setOpeningData] = useState(null);
  const [openingInfo, setOpeningInfo] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pgn, setPgn] = useState('');
  const [pgnError, setPgnError] = useState('');
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [boardWidth, setBoardWidth] = useState(Math.min(440, window.innerWidth - 80));
  const [boardOrientation, setBoardOrientation] = useState('white');
  const [explorerData, setExplorerData] = useState(null);
  const [isExplorerLoading, setIsExplorerLoading] = useState(false);
  const flipBoard = () => {
    setBoardOrientation(prev => prev === 'white' ? 'black' : 'white');
  };

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
      const analyzeRes = await fetch('https://opening-trainer-api-2du6.onrender.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moves: currentMoves })
      });
      const analyzeData = await analyzeRes.json();
      setOpeningData(analyzeData);
      fetchExplorer(analyzeData.fen);

      // Step 2 - get AI explanation
      const infoRes = await fetch('https://opening-trainer-api-2du6.onrender.com', {
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
  }, [fetchExplorer]);

  const fetchExplorer = useCallback(async (fen) => {
    setIsExplorerLoading(true);
    try {
      const res = await fetch('https://opening-trainer-api-2du6.onrender.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fen })
      });
      const data = await res.json();
      console.log('Explorer data received:', data);
      setExplorerData(data);
    } catch (err) {
      console.error('Explorer error:', err);
    } finally {
      setIsExplorerLoading(false);
    }
  }, []);

  const buildGameAtCursor = useCallback((hist, cur) => {
    const g = new Chess();
    for (let i = 0; i < cur; i++) {
      g.move(hist[i]);
    }
    return g;
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
      const newHistory = [...history.slice(0, cursor), move.san];
      setHistory(newHistory);
      setCursor(newHistory.length);
      setGame(gameCopy);
      analyzePosition(newHistory);
      return true;
    } catch (e) {
      console.error('Move error:', e);
    }
  }, [game, history, cursor, analyzePosition]);

  const onSquareClick = useCallback(({ square }) => {
    if (!selectedSquare) {
      const piece = game.get(square);
      if (piece && piece.color === game.turn()) {
        setSelectedSquare(square);
      }
      return;
    }

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
        const newHistory = [...history.slice(0, cursor), move.san];
        setHistory(newHistory);
        setCursor(newHistory.length);
        setGame(gameCopy);
        analyzePosition(newHistory);
      }
    } catch (e) {
      // invalid move
    }
    setSelectedSquare(null);
  }, [selectedSquare, game, history, cursor, analyzePosition]);

  const playExplorerMove = useCallback((san) => {
    try {
      const gameCopy = new Chess(game.fen());
      const move = gameCopy.move(san);
      if (!move) return;
      const newHistory = [...history.slice(0, cursor), move.san];
      setHistory(newHistory);
      setCursor(newHistory.length);
      setGame(gameCopy);
      analyzePosition(newHistory);
      fetchExplorer(gameCopy.fen());
    } catch (e) {
      console.error('Explorer move error:', e);
    }
  }, [game, history, cursor, analyzePosition, fetchExplorer]);

  const stepBack = useCallback(() => {
    if (cursor === 0) return;
    const newCursor = cursor - 1;
    const newGame = buildGameAtCursor(history, newCursor);
    setCursor(newCursor);
    setGame(newGame);
    setSelectedSquare(null);
    analyzePosition(history.slice(0, newCursor));
  }, [cursor, history, buildGameAtCursor, analyzePosition]);

  const stepForward = useCallback(() => {
    if (cursor === history.length) return;
    const newCursor = cursor + 1;
    const newGame = buildGameAtCursor(history, newCursor);
    setCursor(newCursor);
    setGame(newGame);
    setSelectedSquare(null);
    analyzePosition(history.slice(0, newCursor));
  }, [cursor, history, buildGameAtCursor, analyzePosition]);

  
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') stepBack();
      if (e.key === 'ArrowRight') stepForward();
      if (e.key === 'Backspace' && explorerData?.moves?.length > 0) {
        playExplorerMove(explorerData.moves[0].san);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stepBack, stepForward, playExplorerMove, explorerData]);

  useEffect(() => {
    fetchExplorer(new Chess().fen());
  }, [fetchExplorer]);

  const handleReset = () => {
    const freshGame = new Chess();
    setGame(freshGame);
    setHistory([]);
    setCursor(0);
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
      const hist = newGame.history();
      if (hist.length === 0) {
        setPgnError('No moves found in PGN.');
        return;
      }
      setHistory(hist);
      setCursor(hist.length);
      setGame(newGame);
      analyzePosition(hist);
    } catch {
      setPgnError('Invalid PGN. Please check the format and try again.');
    }
  };

  const squareStyles = useMemo(() => {
    const styles = {};
    if (!selectedSquare) return styles;

    // Highlight selected square
    styles[selectedSquare] = { backgroundColor: 'rgba(100, 100, 255, 0.4)' };

    // Highlight legal moves
    const legalMoves = game.moves({ square: selectedSquare, verbose: true });
    legalMoves.forEach(move => {
      styles[move.to] = game.get(move.to)
      ? { backgroundColor: 'rgba(255, 80, 80, 0.5)' }
      : {
        background: 'radial-gradient(circle, rgba(100,100,255,0.4) 30%, transparent 30%)',
        borderRadius: '50%'
      };
    });

    return styles;
  }, [selectedSquare, game]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <span className="logo">♟</span>
          <h1>Opening Trainer</h1>
        </div>
        <div className="header-right">
          <button className="reset-btn" onClick={flipBoard}>Flip Board</button>
          <button className="reset-btn" onClick={handleReset}>Reset Board</button>
        </div>
      </header>

      <main className="app-main">
        <div className="board-section">
          <Chessboard
            options={{
              position: game.fen(),
              boardWidth: boardWidth,
              onPieceDrop: onDrop,
              onSquareClick: onSquareClick,
              squareStyles: squareStyles,
              boardOrientation: boardOrientation,
              customBoardStyle: {
                borderRadius: '6px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.18)'
              }
            }}
          />
          <MoveList moves={history} cursor={cursor} onMoveClick={(idx) => {
            setCursor(idx);
            setGame(buildGameAtCursor(history, idx));
            setSelectedSquare(null);
            analyzePosition(history.slice(0, idx));
          }} />

          <div className="step-controls">
            <button className="step-btn" onClick={stepBack} disabled={cursor === 0}>◀</button>
            <span className="step-counter">{cursor} / {history.length}</span>
            <button className="step-btn" onClick={stepForward} disabled={cursor === history.length}>▶</button>
          </div>

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

        <div className="right-panel">
          <AnalysisPanel
            openingData={openingData}
            openingInfo={openingInfo}
            isAnalyzing={isAnalyzing}
          />
          <ExplorerPanel
            explorerData={explorerData}
            onMoveClick={playExplorerMove}
            isLoading={isExplorerLoading}
          />
        </div>
      </main>
    </div>
  );
}

export default App;