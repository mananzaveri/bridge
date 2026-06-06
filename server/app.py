from flask import Flask, jsonify, request
from flask_cors import CORS
from transformers import pipeline

app = Flask(__name__)
CORS(app)

emotion_analyzer = pipeline(
    'text-classification',
    model='j-hartmann/emotion-english-distilroberta-base'
)

EMOTION_CHORDS = {
    'joy':      ['C', 'G', 'Am', 'F'],       # bright, uplifting
    'surprise': ['D', 'A', 'Bm', 'G'],       # energetic, unexpected
    'neutral':  ['Dm', 'G', 'Em', 'Am'],     # understated
    'sadness':  ['Am', 'F', 'C', 'G'],       # melancholic
    'fear':     ['Dm', 'Bb', 'F', 'C'],      # tense, unsettled
    'anger':    ['Em', 'Am', 'D', 'G'],      # driving, intense
    'disgust':  ['Bm', 'G', 'D', 'A'],       # dark, uneasy
}

@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.get_json()
    lyrics = data.get('lyrics', '')

    result = emotion_analyzer(lyrics[:512])[0]
    emotion = result['label']
    score = round(result['score'], 2)

    if score < 0.5:
        emotion = 'neutral'

    return jsonify({
        'emotion': emotion,
        'score': score,
        'chords': EMOTION_CHORDS.get(emotion, ['C', 'G', 'Am', 'F'])
    })
    
if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)