from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.get_json()
    lyrics = data.get('lyrics', '')
    
    # dummy response for now
    return jsonify({
        'sentiment': 'positive',
        'chords': ['C', 'G', 'Am', 'F']
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)