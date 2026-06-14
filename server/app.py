from flask import Flask, jsonify, request
from flask_cors import CORS
from transformers import pipeline
import random

app = Flask(__name__)
CORS(app)

emotion_analyzer = pipeline(
    'text-classification',
    model='j-hartmann/emotion-english-distilroberta-base',
    return_all_scores=True  # get scores for all 7 emotions, not just the top one
)

# Each emotion maps to a pool of keys that fit its character
EMOTION_KEYS = {
    'joy':      ['C', 'G', 'D', 'A', 'E'],
    'sadness':  ['Am', 'Dm', 'Em', 'Bm', 'Fm'],
    'anger':    ['Em', 'Dm', 'Am', 'Bm', 'Cm'],
    'fear':     ['Dm', 'Am', 'Bm', 'Em', 'Gm'],
    'disgust':  ['Bm', 'Dm', 'Am', 'Em', 'Cm'],
    'surprise': ['D', 'A', 'G', 'E', 'B'],
    'neutral':  ['C', 'Am', 'G', 'Em', 'F'],
}

def blend_key(emotion_scores):
    """
    Instead of picking a key from one emotion's pool, we blend
    across all emotions weighted by their scores. This means a lyric
    that's 45% sadness / 40% anger gets a key that reflects both,
    rather than just defaulting to whichever emotion won by a hair.

    Steps:
    1. Filter out emotions below a meaningful threshold (< 0.1)
       so weak signals don't pollute the result
    2. Normalize the remaining scores so they sum to 1
    3. For each emotion, pick a key candidate from its pool
    4. Weight those candidates by score and pick probabilistically
    """
    # Filter to emotions with meaningful presence
    significant = {e: s for e, s in emotion_scores.items() if s >= 0.1}

    # If nothing clears the threshold (very rare), fall back to top emotion
    if not significant:
        top = max(emotion_scores, key=emotion_scores.get)
        return random.choice(EMOTION_KEYS[top])

    # Normalize scores so they sum to 1
    total = sum(significant.values())
    normalized = {e: s / total for e, s in significant.items()}

    # Build a weighted candidate list: each emotion contributes
    # one key candidate, weighted by its normalized score
    candidates = []
    weights = []
    for emotion, score in normalized.items():
        key_pool = EMOTION_KEYS.get(emotion, EMOTION_KEYS['neutral'])
        candidates.append(random.choice(key_pool))
        weights.append(score)

    # random.choices uses weights to pick probabilistically —
    # higher-scoring emotions are more likely to win, but not guaranteed
    return random.choices(candidates, weights=weights, k=1)[0]

def get_primary_emotion(emotion_scores, threshold=0.5):
    """
    Returns the top emotion if it clears the confidence threshold,
    otherwise returns neutral. Same logic as before but now operating
    on the full score dict rather than a single pipeline result.
    """
    top_emotion = max(emotion_scores, key=emotion_scores.get)
    top_score = emotion_scores[top_emotion]
    if top_score < threshold:
        return 'neutral'
    return top_emotion

@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.get_json()
    lyrics = data.get('lyrics', '')

    # return_all_scores=True gives us a list of dicts: [{label, score}, ...]
    # We reshape it into a clean {emotion: score} dict for easier use
    raw = emotion_analyzer(lyrics[:512])
    raw_results = raw[0] if isinstance(raw[0], list) else raw
    emotion_scores = {r['label']: r['score'] for r in raw_results}    

    primary_emotion = get_primary_emotion(emotion_scores)
    suggested_key = blend_key(emotion_scores)

    # Send back the full score breakdown so the frontend
    # can display it if we ever want to show emotion details
    return jsonify({
        'emotion': primary_emotion,
        'emotion_scores': emotion_scores,
        'suggested_key': suggested_key,
    })

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)