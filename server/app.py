from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import chess
import google.genai as genai
import os
import json
import csv
import urllib.request

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

app = Flask(__name__)
CORS(app)

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
You are a strong chess coach explaining openings to a player rated under 1600.

Opening: {opening_name} ({eco_code})
Moves: {moves_str}

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
            model="gemini-2.0-flash",
            contents=prompt
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
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)