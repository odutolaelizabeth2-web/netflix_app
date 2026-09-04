import os
import time
import requests
from sqlalchemy import func
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy.orm import Session
from datetime import datetime

from dotenv import load_dotenv
from fastapi import FastAPI, Depends, Request, HTTPException, Form, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException
from pwdlib import PasswordHash
from Ndatabase import Base, engine, get_db
from model import User, Avatar, WatchHistory, Rating


load_dotenv()

TMDB_API_KEY = os.getenv("TMDB_API_KEY")

print("TMDB API KEY LOADED:", bool(TMDB_API_KEY))
print("TMDB API KEY LENGTH:", len(TMDB_API_KEY) if TMDB_API_KEY else 0)

TMDB_URL = "https://api.themoviedb.org/3"

app = FastAPI()
password_hash = PasswordHash.recommended()

app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SESSION_SECRET_KEY"),
    https_only=False,
    same_site="lax"
)

app.mount(
    "/static",
    StaticFiles(directory="static"),
    name="static"
)
templates = Jinja2Templates(directory="templates")
Base.metadata.create_all(bind=engine)


def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
):
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="You must be logged in"
        )
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        request.session.clear()
        raise HTTPException(
            status_code=401,
            detail="User no longer exists"
        )
    return user


@app.get("/")
def home(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="netflix.html",
        context={"request": request}
    )


@app.get("/create-profile")
def create_profile(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="netflix2.html",
        context={"request": request}
    )


@app.post("/created-profile")
def create_profile(
    request: Request,
    email: str = Form(...),
    username: str = Form(...),
    phone_number: str = Form(...),
    password: str = Form(...),
    confirm_password: str = Form(...),
    db: Session = Depends(get_db)
):
    email = email.strip().lower()
    username = username.strip()

    if password != confirm_password:
        raise HTTPException(
            status_code=400,
            detail="Passwords do not match"
        )

    existing_user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="An account with this email already exists"
        )
    avatar = db.query(Avatar).first()
    if not avatar:
        raise HTTPException(
            status_code=500,
            detail="No avatar found"
        )
    hashed_password = password_hash.hash(password)

    user = User(
        user_name=username,
        email=email,
        phone_number=phone_number,
        password=hashed_password,
        avatar_id=avatar.id
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    request.session["user_id"] = user.id

    return RedirectResponse(
        url="/movies",
        status_code=303
    )


@app.get("/welcome")
def welcome_back(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="netflix3.html",
        context={"request": request}
    )


@app.post("/login")
def login(
    request: Request,
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    email = email.strip().lower()
    user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )
    if not user or not password_hash.verify(password, user.password):
        return templates.TemplateResponse(
            request=request,
            name="netflix3.html",
            context={
                "request": request,
                "error": "Invalid Credentials"
            },
            status_code=400)

    request.session["user_id"] = user.id
    return RedirectResponse(
        url="/movies",
        status_code=303
    )


@app.get("/logout")
def logout(request: Request):
    request.session.clear()
    return RedirectResponse(url="/", status_code=303)


@app.get("/movies")
def movies_page(
    request: Request,
    search: str = "",
    current_user: User = Depends(get_current_user)
):
    return templates.TemplateResponse(
        request=request,
        name="netflix4.html",
        context={
            "request": request,
            "user": current_user
        }
    )


@app.get("/api/movies")
def search_movies(search: str = ""):
    search = search.strip()
    if not search:
        return []

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
        response.raise_for_status()
        data = response.json()
        return data.get("results", [])

    except requests.exceptions.RequestException as error:
        raise HTTPException(
            status_code=500,
            detail=f"TMDB request failed: {error}"
        )


@app.get("/api/movies/{movie_id}/trailer")
def get_movie_trailer(movie_id: int):
    url = f"{TMDB_URL}/movie/{movie_id}/videos"
    params = {
        "api_key": TMDB_API_KEY,
        "language": "en-US"
    }
    try:
        response = requests.get(
            url,
            params=params,
            timeout=10)
        response.raise_for_status()
        data = response.json()
        videos = data.get("results", [])

        # TMDB supplies the YouTube video ID; the frontend supplies the controls.
        for video in videos:
            if (
                video.get("site") == "YouTube"
                and video.get("type") == "Trailer"
                and video.get("official") is True
            ):
                return {
                    "key": video.get("key"),
                    "name": video.get("name")
                }

        # If there isn't an official trailer, look for any YouTube trailer
        for video in videos:
            if (
                video.get("site") == "YouTube"
                and video.get("type") == "Trailer"
            ):
                return {"key": video.get("key"), "name": video.get("name")}
                return {"key": video.get("key"), "name": video.get("name")}
        return {
            "key": None,
            "message": "No trailer found"
        }
    except requests.exceptions.RequestException as error:
        raise HTTPException(
            status_code=500,
            detail=f"TMDB trailer request failed: {error}"
        )


# ***** THIS IS THE FIX FOR "NOT SAVING IN DATABASE" *****
@app.post("/api/watch/{movie_id}")
def mark_as_watched(
    movie_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    # Check if this movie is already in this user's watch history
    existing = (
        db.query(WatchHistory)
        .filter(
            WatchHistory.user_id == current_user.id,
            WatchHistory.movie_id == movie_id,
        )
        .first()
    )

    if not existing:
        watch_entry = WatchHistory(
            user_id=current_user.id,
            movie_id=movie_id,
            watched_at=datetime.utcnow(),
        )
        db.add(watch_entry)
        db.commit()

    return {"success": True, "message": "Movie marked as watched"}


# TMDB's official genre IDs (these never change)
HOMEPAGE_GENRES = [
    ("Action", 28),
    ("Adventure", 12),
    ("Comedy", 35),
    ("Drama", 18),
    ("Horror", 27),
    ("Romance", 10749),
    ("Animation", 16),
    ("Science Fiction", 878),
    ("Thriller", 53),
    ("Fantasy", 14),
    ("Crime", 80),
    ("Family", 10751),
]

# Remember the result so we don't ask TMDB again on every page load
genre_cache = {"data": None, "saved_at": 0}
CACHE_SECONDS = 30 * 60  # 30 minutes


def fetch_genre_movies(genre):
    """Get the most popular movies for ONE genre from TMDB."""
    genre_name, genre_id = genre
    try:
        response = requests.get(
            f"{TMDB_URL}/discover/movie",
            params={
                "api_key": TMDB_API_KEY,
                "language": "en-US",
                "sort_by": "popularity.desc",
                "with_genres": genre_id,
                "page": 1,
                "include_adult": "false",
            },
            timeout=10,
        )
        response.raise_for_status()
        results = response.json().get("results", [])
    except requests.exceptions.RequestException:
        return None

    # Only send the page what it needs, and skip movies without a poster
    movies = [
        {
            "id": movie["id"],
            "title": movie.get("title"),
            "poster_path": movie.get("poster_path"),
            "overview": movie.get("overview"),
            "release_date": movie.get("release_date"),
        }
        for movie in results
        if movie.get("poster_path")
    ]
    return {"genre": genre_name, "movies": movies[:15]}


@app.get("/api/movies-by-genres")
def movies_by_genres():
    # 1. If we fetched recently, return the saved copy instantly
    is_fresh = (time.time() - genre_cache["saved_at"]) < CACHE_SECONDS
    if genre_cache["data"] and is_fresh:
        return genre_cache["data"]

    # 2. Otherwise ask TMDB for ALL genres at the same time (not one after another)
    with ThreadPoolExecutor(max_workers=len(HOMEPAGE_GENRES)) as executor:
        results = list(executor.map(fetch_genre_movies, HOMEPAGE_GENRES))

    data = [row for row in results if row and row["movies"]]

    if not data:
        raise HTTPException(
            status_code=500,
            detail="Could not load movies from TMDB"
        )

    # 3. Save it for next time
    genre_cache["data"] = data
    genre_cache["saved_at"] = time.time()
    return data


def format_runtime(minutes):
    """Turn 109 into '1h 49m'."""
    if not minutes:
        return ""
    hours, mins = divmod(minutes, 60)
    if hours and mins:
        return f"{hours}h {mins}m"
    if hours:
        return f"{hours}h"
    return f"{mins}m"


def pick_trailer_key(videos):
    """Pick the best YouTube trailer from TMDB's video list."""
    youtube = [v for v in videos if v.get(
        "site") == "YouTube" and v.get("key")]
    for video in youtube:
        if video.get("type") == "Trailer" and video.get("official"):
            return video["key"]
    for video in youtube:
        if video.get("type") == "Trailer":
            return video["key"]
    for video in youtube:
        if video.get("type") == "Teaser":
            return video["key"]
    return None


@app.get("/movies/{movie_id}")
def movie_details(
    movie_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    # One TMDB request that also brings credits, age ratings and videos
    try:
        response = requests.get(
            f"{TMDB_URL}/movie/{movie_id}",
            params={
                "api_key": TMDB_API_KEY,
                "language": "en-US",
                "append_to_response": "credits,release_dates,videos",
            },
            timeout=10,
        )
        if response.status_code == 404:
            raise HTTPException(status_code=404, detail="Movie not found")
        response.raise_for_status()
        data = response.json()
    except requests.exceptions.RequestException as error:
        raise HTTPException(
            status_code=500,
            detail=f"TMDB request failed: {error}"
        )

    # Release date: 2026-05-15  ->  05/15/2026
    raw_date = data.get("release_date") or ""
    year = raw_date[:4]
    try:
        release_date = datetime.strptime(
            raw_date, "%Y-%m-%d").strftime("%m/%d/%Y")
    except ValueError:
        release_date = ""

    # Age rating (R, PG-13, ...) from the US release info
    certification = ""
    for country in data.get("release_dates", {}).get("results", []):
        if country.get("iso_3166_1") == "US":
            for release in country.get("release_dates", []):
                if release.get("certification"):
                    certification = release["certification"]
                    break
            break

    # Genres: "Horror and Thriller"
    genre_names = [g["name"] for g in data.get("genres", [])]
    if len(genre_names) > 1:
        genres = ", ".join(genre_names[:-1]) + " and " + genre_names[-1]
    else:
        genres = genre_names[0] if genre_names else ""

    # User score: 8.2 -> 82
    score = round((data.get("vote_average") or 0) * 10)
    if score >= 70:
        score_class = "high"
    elif score >= 40:
        score_class = "mid"
    elif score > 0:
        score_class = "low"
    else:
        score_class = "none"

    # Director / Writer credits (one line per person)
    wanted_jobs = ["Director", "Writer", "Screenplay", "Story"]
    people = {}
    for person in data.get("credits", {}).get("crew", []):
        if person.get("job") in wanted_jobs:
            jobs = people.setdefault(person["name"], [])
            if person["job"] not in jobs:
                jobs.append(person["job"])
    crew = [{"name": name, "jobs": ", ".join(
        jobs)} for name, jobs in people.items()]
    crew.sort(key=lambda p: 0 if "Director" in p["jobs"] else 1)
    crew = crew[:4]

    poster_path = data.get("poster_path")
    backdrop_path = data.get("backdrop_path")
    movie = {
        "id": data.get("id"),
        "title": data.get("title") or "Untitled",
        "year": year,
        "poster": (
            f"https://image.tmdb.org/t/p/w500{poster_path}"
            if poster_path else "/static/default-poster.jpg"
        ),
        "backdrop": (
            f"https://image.tmdb.org/t/p/original{backdrop_path}"
            if backdrop_path else (
                f"https://image.tmdb.org/t/p/w780{poster_path}"
                if poster_path else "/static/default-poster.jpg"
            )
        ),
        "release_date": release_date,
        "certification": certification,
        "genres": genres,
        "runtime": format_runtime(data.get("runtime")),
        "score": score,
        "score_class": score_class,
        "tagline": data.get("tagline") or "",
        "overview": data.get("overview") or "",
        "crew": crew,
        "trailer_key": pick_trailer_key(data.get("videos", {}).get("results", [])),
    }

    return templates.TemplateResponse(
        request=request,
        name="netflix6.html",
        context={
            "request": request,
            "user": current_user,
            "movie": movie,
        }
    )


@app.get("/profile")
def profile(
        request: Request,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)):

    user = current_user
    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    watched_count = (
        db.query(func.count(WatchHistory.id))
        .filter(WatchHistory.user_id == current_user.id)
        .scalar()
    )

    watch_history = (
        db.query(WatchHistory)
        .filter(WatchHistory.user_id == user.id)
        .order_by(WatchHistory.watched_at.desc())
        .all()
    )

    def fetch_watched_movie(history):
        try:
            response = requests.get(
                f"{TMDB_URL}/movie/{history.movie_id}",
                params={
                    "api_key": TMDB_API_KEY,
                    "language": "en-US"
                },
                timeout=5
            )
            response.raise_for_status()
            movie_data = response.json()
            return {
                "title": movie_data.get("title"),
                "poster": (
                    f"https://image.tmdb.org/t/p/w500"
                    f"{movie_data.get('poster_path')}"
                    if movie_data.get("poster_path")
                    else "/static/default-poster.jpg"),
                "watched_at": history.watched_at.strftime("%B %d, %Y")
            }
        except (requests.exceptions.RequestException, AttributeError, TypeError):
            return None

    with ThreadPoolExecutor(max_workers=8) as executor:
        movies = [
            movie for movie in executor.map(fetch_watched_movie, watch_history)
            if movie
        ]

    return templates.TemplateResponse(
        request=request,
        name="netflix5.html",
        context={
            "request": request,
            "user": user,
            "movies": movies,
            "watched_count": watched_count
        })


@app.exception_handler(StarletteHTTPException)
def general_http_exception_handler(request: Request, exception: StarletteHTTPException):
    message = (
        exception.detail
        if exception.detail
        else "An error occurred. Please check your request and try again."
    )
    if request.url.path.startswith("/api"):
        return JSONResponse(
            status_code=exception.status_code,
            content={"detail": message},
        )
    return templates.TemplateResponse(
        request=request,
        name="error.html",
        context={
            "request": request,
            "status_code": exception.status_code,
            "title": exception.status_code,
            "message": message
        },
        status_code=exception.status_code,
    )


@app.exception_handler(RequestValidationError)
def validation_exception_handler(request: Request, exception: RequestValidationError):
    if request.url.path.startswith("/api"):
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            content={"detail": exception.errors()}
        )
    return templates.TemplateResponse(
        request=request,
        name="error.html",
        context={
            "request": request,
            "status_code": status.HTTP_422_UNPROCESSABLE_CONTENT,
            "title": status.HTTP_422_UNPROCESSABLE_CONTENT,
            "message": "Invalid request. Please check your input and try again.",
        },
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
    )
