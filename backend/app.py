import os
import requests

from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

env_path = os.path.join(
    os.path.dirname(__file__),
    ".env"
)

load_dotenv(env_path)
app = Flask(__name__)

CORS(app)

TMDB_API_KEY = os.getenv("TMDB_API_KEY")

print(
    "TMDB API key loaded:",
    TMDB_API_KEY is not None
)

TMDB_URL = "https://api.themoviedb.org/3"


@app.route("/api/movies")
def search_movies():

    search = request.args.get(
        "search",
        ""
    ).strip()
    if not search:

        return jsonify([])

    if search.lower() == "new":

        url = f"{TMDB_URL}/movie/now_playing"

        params = {
            "api_key": TMDB_API_KEY,
            "language": "en-US",
            "page": 1
        }
    else:

        url = f"{TMDB_URL}/search/movie"

        params = {
            "api_key": TMDB_API_KEY,
            "query": search,
            "language": "en-US",
            "page": 1,
            "include_adult": "false"
        }
    try:

        response = requests.get(
            url,
            params=params,
            timeout=10
        )
        print(
            "TMDB status code:",
            response.status_code
        )

        print(
            "TMDB content type:",
            response.headers.get(
                "Content-Type"
            )
        )

        print(
            "TMDB response:",
            response.text[:1000]
        )
        response.raise_for_status()
        data = response.json()
        return jsonify(
            data.get(
                "results",
                []
            )
        )
    except requests.exceptions.RequestException as error:

        print(
            "TMDB ERROR:",
            error
        )
        return jsonify({
            "error": str(error)
        }), 500


if __name__ == "__main__":

    app.run(
        debug=True,
        port=5000
    )
