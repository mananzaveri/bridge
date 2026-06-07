from flask import Flask, jsonify, request
from flask_cors import CORS
from transformers import pipeline
import random

app = Flask(__name__)
CORS(app)

emotion_analyzer = pipeline(
    'text-classification',
    model='j-hartmann/emotion-english-distilroberta-base'
)

# Each emotion maps to a pool of keys that fit its character.
# Major keys (C, G, D...) feel open and bright.
# Minor keys (Am, Dm, Em...) feel introspective or tense.
# We pick randomly from the pool so the same emotion doesn't
# always return the same key — adds personalization per lyric set.
EMOTION_KEYS = {
    'joy':      ['C', 'G', 'D', 'A', 'E'],
    'sadness':  ['Am', 'Dm', 'Em', 'Bm', 'Fm'],
    'anger':    ['Em', 'Dm', 'Am', 'Bm', 'Cm'],
    'fear':     ['Dm', 'Am', 'Bm', 'Em', 'Gm'],
    'disgust':  ['Bm', 'Dm', 'Am', 'Em', 'Cm'],
    'surprise': ['D', 'A', 'G', 'E', 'B'],
    'neutral':  ['C', 'Am', 'G', 'Em', 'F'],
}

@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.get_json()
    lyrics = data.get('lyrics', '')

    result = emotion_analyzer(lyrics[:512])[0]
    emotion = result['label']
    score = round(result['score'], 2)

    # Fall back to neutral if the model isn't confident
    if score < 0.5:
        emotion = 'neutral'

    # Pick a key from the emotion's pool at random
    key_pool = EMOTION_KEYS.get(emotion, EMOTION_KEYS['neutral'])
    suggested_key = random.choice(key_pool)

    return jsonify({
        'emotion': emotion,
        'score': score,
        'suggested_key': suggested_key,
    })

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)