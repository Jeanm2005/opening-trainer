from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import chess
import google.genai as genai
import os
import json
import csv
import urllib.request
import urllib.parse
import requests as req_lib

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

app = Flask(__name__)
CORS(app, origins=[
    "https://opening-trainer-zssv.vercel.app",
    "http://localhost:3000"
])

# --- Load Lichess ECO dataset at startup ---
ECO_LOOKUP = {}

def load_eco_database():
    urls = [
        "https://raw.githubusercontent.com/lichess-org/chess-openings/master/a.tsv",
        "https://raw.githubusercontent.com/lichess-org/chess-openings/master/b.tsv",
        "https://raw.githubusercontent.com/lichess-org/chess-openings/master/c.tsv",
        "https://raw.githubusercontent.com/lichess-org/chess-openings/master/d.tsv",
        "https://raw.githubusercontent.com/lichess-org/chess-openings/master/e.tsv",
    ]
    for url in urls:
        try:
            with urllib.request.urlopen(url) as response:
                lines = response.read().decode('utf-8').splitlines()
                reader = csv.DictReader(lines, delimiter='\t')
                for row in reader:
                    try:
                        pgn_moves = row['pgn'].strip()
                        board = chess.Board()
                        uci_moves = []
                        tokens = pgn_moves.split()
                        for token in tokens:
                            if '.' in token:
                                continue
                            move = board.parse_san(token)
                            uci_moves.append(move.uci())
                            board.push(move)
                        key = " ".join(uci_moves)
                        ECO_LOOKUP[key] = {
                            'name': row['name'].strip(),
                            'eco': row['eco'].strip(),
                        }
                    except Exception:
                        continue 
        except Exception:
            continue

load_eco_database()

# --- Opening detection ---
def identify_opening(moves_list):
    board = chess.Board()
    uci_moves = []

    for san in moves_list:
        try:
            move = board.parse_san(san)
            uci_moves.append(move.uci())
            board.push(move)
        except Exception:
            break

    for i in range(len(uci_moves), 0, -1):
        key = " ".join(uci_moves[:i])
        if key in ECO_LOOKUP:
            return ECO_LOOKUP[key]

    return {"name": "Unknown Opening", "eco": "A00"}

@app.route('/health')
def health():
    return jsonify({'status': 'ok'})

@app.route('/analyze-opening', methods=['POST'])
def analyze_opening():
    data = request.get_json()
    moves = data.get('moves', [])

    if not moves:
        return jsonify({'error': 'No moves provided'}), 400

    board = chess.Board()
    valid_moves = []
    for move_san in moves:
        try:
            move = board.parse_san(move_san)
            board.push(move)
            valid_moves.append(move_san)
        except Exception:
            break

    opening = identify_opening(valid_moves)

    return jsonify({
        'opening_name': opening['name'],
        'eco_code': opening['eco'],
        'moves': valid_moves,
        'fen': board.fen()
    })

@app.route('/explorer', methods=['POST'])
def explorer():
    data = request.get_json()
    fen = data.get('fen', '')
    
    if not fen:
        return jsonify({'error': 'No FEN provided'}), 400
    
    try:
        response = req_lib.get(
            'http://www.chessdb.cn/cdb.php',
            params={
                'action': 'queryall',
                'board': fen,
                'json': 1,
                'showall': 1,
                'learn': 0
            },
            headers={'User-Agent': 'OpeningTrainer/1.0'},
            timeout=10
        )
        
        print(f"ChessDB status: {response.status_code}")
        
        if response.status_code != 200:
            return jsonify({'error': f'ChessDB error: {response.status_code}'}), 500
        
        result = response.json()
        print(f"ChessDB result: {result}")
        
        if 'moves' not in result:
            return jsonify({'moves': [], 'total': 0})
        
        moves = []
        for move in result['moves']:
            score = move.get('score', 0)
            winrate = move.get('winrate', 0)
            try:
                score = float(score)
            except (ValueError, TypeError):
                score = None
            try:
                winrate = float(winrate)
            except (ValueError, TypeError):
                winrate = None
                
            moves.append({
                'san': move.get('san', ''),
                'score': score,
                'winrate': winrate,
                'rank': move.get('rank', 0),
                'note': move.get('note', '')
            })
            
        moves = [m for m in moves if m['rank'] > 0 and m['winrate'] is not None]
        moves.sort(key=lambda m: (m['rank'], m['winrate'] if m['winrate'] else 0), reverse=True)
            
        return jsonify({
            'moves': moves,
            'total': len(moves)
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
            
@app.route('/opening-info', methods=['POST'])
def opening_info():
    data = request.get_json()
    opening_name = data.get('opening_name', '')
    moves = data.get('moves', [])
    eco_code = data.get('eco_code', '')

    if not opening_name:
        return jsonify({'error': 'No opening name provided'}), 400

    moves_str = " ".join([
        f"{i//2 + 1}{'.' if i % 2 == 0 else '...'}{m}"
        for i, m in enumerate(moves)
    ])

    prompt = f"""
You are a chess coach explaining opening theory to a club player rated under 1600.
Base your explanation strictly on established opening theory for this specific opening.
Do not invent move sequences. If unsure about a specific claim, use "typically" or "often".
Avoid vague generalities — focus on concrete plans, piece placement, and pawn structure.
Do not mention specific move sequences beyond move 10.

Opening: {opening_name} ({eco_code})
Moves played so far: {moves_str}

Respond ONLY with a valid JSON object, no markdown, no explanation outside the JSON.

{{
    "main_ideas": "2-3 sentences on the core strategic ideas",
    "white_plans": "2-3 sentences on typical plans for White",
    "black_plans": "2-3 sentences on typical plans for Black",
    "common_traps": "1-2 sentences on tactical traps to know",
    "beginner_mistakes": "2-3 sentences on mistakes players under 1600 commonly make",
    "middlegame_themes": "2-3 sentences on typical middlegame structures that arise"
}}
"""

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config={"temperature": 0.2}
        )
        text = response.text.strip()
        
        # Simple cleanup to ensure valid JSON parsing
        if "```" in text:
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        
        info = json.loads(text)
        return jsonify(info)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)