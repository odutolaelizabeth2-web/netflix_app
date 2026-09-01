import os
import requests
from sqlalchemy.orm import Session

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
                "error": "Invalid email or password"
            },
            status_code=400 )

    request.session["user_id"] = user.id
    return RedirectResponse(
        url="/movies",
        status_code=303
    )

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
            timeout=10 )
        response.raise_for_status()
        data = response.json()
        videos = data.get("results", [])

        # Look for an official YouTube trailer
        for video in videos:
            if (
                video.get("site") == "YouTube"
                and video.get("type") == "Trailer"
                and video.get("official") is True ):
                return {
                    "key": video.get("key"),
                    "name": video.get("name")
                }

        # If there isn't an official trailer,
        # look for any YouTube trailer
        for video in videos:
            if (
                video.get("site") == "YouTube"
                and video.get("type") == "Trailer"
            ):
                return { "key": video.get("key"),"name": video.get("name") }
        return {
            "key": None,
            "message": "No trailer found"
        }
    except requests.exceptions.RequestException as error:
        raise HTTPException(
            status_code=500,
            detail=f"TMDB trailer request failed: {error}"
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

    watch_history = (
        db.query(WatchHistory)
        .filter(WatchHistory.user_id == user.id)
        .order_by(WatchHistory.watched_at.desc())
        .all()
    )
    movies = []
    for history in watch_history:
        try:
            response = requests.get(
                f"{TMDB_URL}/movie/{history.movie_id}",
                params={
                    "api_key": TMDB_API_KEY,
                    "language": "en-US"
                },
                timeout=10
            )

            response.raise_for_status()
            movie_data = response.json()
            movies.append({
                "title": movie_data.get("title"),
                "poster": (
                    f"https://image.tmdb.org/t/p/w500"
                    f"{movie_data.get('poster_path')}"
                    if movie_data.get("poster_path")
                    else "/static/default-poster.jpg"),
                "watched_at": history.watched_at.strftime("%B %d, %Y")
            })
        except requests.exceptions.RequestException:
            continue

    return templates.TemplateResponse(
        request=request,
        name="netflix5.html",
        context={
            "request": request,
            "user": user,
            "movies": movies} )


@app.exception_handler(StarletteHTTPException)
def general_http_exception_handler(request: Request, exception: StarletteHTTPException):
    message = (
        exception.detail
        if exception.detail
        else "An error occurred. Please check your request and try again."
    )
    if request.url.path.startswith ("/api"):
        return JSONResponse (
            status_code= exception.status_code,
            content= {"detail":message},
        )
    return templates.TemplateResponse (request= request,
        name="error.html",
        context={
            "request": request,
            "status_code": exception.status_code,
            "title": exception.status_code,
            "message": message
        },
        status_code= exception.status_code,
    )


@app.exception_handler(RequestValidationError)
def validation_exception_handler (request: Request, exception: RequestValidationError):
    if request.url.path.startswith("/api"):
        return JSONResponse (
            status_code= status.HTTP_422_UNPROCESSABLE_CONTENT,
            content= {"detail": exception.errors()}
        )
    return templates.TemplateResponse (
        request=request, name="error.html",
        context={
            "request": request,
            "status_code":status.HTTP_422_UNPROCESSABLE_CONTENT,
            "title":status.HTTP_422_UNPROCESSABLE_CONTENT,
            "message": "Invalid request. Please check your input and try again.",
        },
        status_code= status.HTTP_422_UNPROCESSABLE_CONTENT,
    )