const searchBar = document.getElementById("search");
const searchForm = document.getElementById("search-form");
const movieResults = document.getElementById("movie-container");
const heroSection = document.querySelector(".hero");
const heroTitle = document.getElementById("hero-title");
const heroDescription = document.getElementById("hero-description");
const heroPlayButton = document.querySelector(".play-btn");

let currentTrailerModal = null;
let featuredMovie = null;
let heroMovies = [];

function escapeHtml(value) {
    return String(value).replace(/[&<>\'"]/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;"
    })[character]);
}

async function showMovie(movie) {
    try {
        const response = await fetch(`/api/movies/${movie.id}/trailer`);
        if (!response.ok) throw new Error("Unable to load trailer.");

        const trailer = await response.json();
        if (!trailer.key) {
            alert("Sorry, no trailer is available for this movie.");
            return;
        }

        openTrailer(movie, trailer.key);
        recordMovieWatched(movie.id);
    } catch (error) {
        console.error("Trailer error:", error);
        alert("Unable to load the trailer right now.");
    }
}

const genreNames = {
    28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy",
    80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family",
    14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music",
    9648: "Mystery", 10749: "Romance", 878: "Science Fiction",
    10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western"
};

function openTrailer(movie, trailerKey) {
    closeTrailer();
    const movieGenres = (movie.genre_ids || [])
        .map(genreId => genreNames[genreId])
        .filter(Boolean)
        .slice(0, 2);

    const modal = document.createElement("div");
    modal.className = "trailer-modal active";
    modal.innerHTML = `
        <div class="trailer-box">
            <button class="close-trailer" type="button" aria-label="Close trailer">
                <i class="fa-solid fa-xmark"></i>
            </button>
            <div class="trailer-content">
                <h2>${escapeHtml(movie.title)}</h2>
                <p class="trailer-status">${escapeHtml(movie.release_date ? movie.release_date.substring(0, 4) : "Released")} ${movieGenres.length ? `· ${escapeHtml(movieGenres.join(" · "))}` : "· Official Trailer"}</p>
                <div class="video-container">
                    <img class="video-poster" src="${movie.poster_path ? `https://image.tmdb.org/t/p/w780${movie.poster_path}` : ""}" alt="">
                    <div class="youtube-player"></div>
                    <button class="video-surface" type="button" aria-label="Play or pause trailer"></button>
                    <div class="video-loading" role="status" aria-label="Loading trailer">
                        <span class="loading-spinner"></span>
                    </div>
                    <div class="video-controls">
                        <button class="video-button play-button" type="button" aria-label="Play trailer"><i class="fa-solid fa-play"></i></button>
                        <button class="video-button restart-button" type="button" aria-label="Restart trailer"><i class="fa-solid fa-backward-step"></i></button>
                        <button class="video-button skip-button" type="button" data-seconds="-10" aria-label="Skip backward 10 seconds"><i class="fa-solid fa-rotate-left"></i><span class="skip-label">10</span></button>
                        <button class="video-button skip-button" type="button" data-seconds="10" aria-label="Skip forward 10 seconds"><i class="fa-solid fa-rotate-right"></i><span class="skip-label">10</span></button>
                        <button class="video-button mute-button" type="button" aria-label="Mute trailer"><i class="fa-solid fa-volume-high"></i></button>
                        <input class="volume-slider" type="range" min="0" max="100" value="100" aria-label="Volume">
                        <input class="progress-bar" type="range" min="0" max="100" value="0" step="0.1" aria-label="Trailer progress">
                        <span class="time-display">00:00 / 00:00</span>
                        <button class="video-button settings-button" type="button" aria-label="Settings"><i class="fa-solid fa-gear"></i></button>
                        <button class="video-button theater-button" type="button" aria-label="Theater mode"><i class="fa-solid fa-table-columns"></i></button>
                        <button class="video-button pip-button" type="button" aria-label="Picture in picture"><i class="fa-solid fa-picture-in-picture"></i></button>
                        <button class="video-button fullscreen-button" type="button" aria-label="Enter fullscreen"><i class="fa-solid fa-expand"></i></button>
                    </div>
                    <div class="settings-menu" hidden>
                        <label>Speed <select class="speed-select" aria-label="Playback speed">
                            <option value="0.5">0.5x</option><option value="0.75">0.75x</option>
                            <option value="1" selected>Normal</option><option value="1.25">1.25x</option>
                            <option value="1.5">1.5x</option><option value="2">2x</option>
                        </select></label>
                        <label>Quality <select class="quality-select" aria-label="Video quality"><option value="auto">Auto</option></select></label>
                    </div>
                </div>
            </div>
        </div>
    `;

    const videoContainer = modal.querySelector(".video-container");
    const controls = modal.querySelector(".video-controls");
    const loading = modal.querySelector(".video-loading");
    const playButton = modal.querySelector(".play-button");
    const muteButton = modal.querySelector(".mute-button");
    const volumeSlider = modal.querySelector(".volume-slider");
    const progressBar = modal.querySelector(".progress-bar");
    const timeDisplay = modal.querySelector(".time-display");
    const settingsMenu = modal.querySelector(".settings-menu");
    const speedSelect = modal.querySelector(".speed-select");
    const qualitySelect = modal.querySelector(".quality-select");
    let player;
    let controlsTimer;

    const formatTime = seconds => {
        if (!Number.isFinite(seconds)) return "00:00";
        return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
    };
    const updatePlayButton = playing => {
        playButton.innerHTML = `<i class="fa-solid fa-${playing ? "pause" : "play"}"></i>`;
        playButton.setAttribute("aria-label", playing ? "Pause trailer" : "Play trailer");
    };
    const updateTime = () => {
        if (!player || !player.getDuration()) return;
        const current = player.getCurrentTime();
        const duration = player.getDuration();
        progressBar.value = current / duration * 100;
        timeDisplay.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
    };
    const showControls = () => {
        controls.classList.remove("controls-hidden");
        clearTimeout(controlsTimer);
        if (player?.getPlayerState() === YT.PlayerState.PLAYING) {
            controlsTimer = setTimeout(() => controls.classList.add("controls-hidden"), 3000);
        }
    };

    modal.querySelector(".close-trailer").addEventListener("click", closeTrailer);
    playButton.addEventListener("click", () => {
        if (!player) return;
        player.getPlayerState() === YT.PlayerState.PLAYING ? player.pauseVideo() : player.playVideo();
    });
    modal.querySelector(".restart-button").addEventListener("click", () => {
        player?.seekTo(0, true);
        player?.playVideo();
    });
    modal.querySelectorAll(".skip-button").forEach(button => button.addEventListener("click", () => {
        if (player) player.seekTo(Math.max(0, player.getCurrentTime() + Number(button.dataset.seconds)), true);
    }));
    muteButton.addEventListener("click", () => {
        if (!player) return;
        player.isMuted() ? player.unMute() : player.mute();
        const muted = player.isMuted();
        muteButton.innerHTML = `<i class="fa-solid fa-volume-${muted ? "xmark" : "high"}"></i>`;
        muteButton.setAttribute("aria-label", muted ? "Unmute trailer" : "Mute trailer");
    });
    volumeSlider.addEventListener("input", () => {
        player?.setVolume(Number(volumeSlider.value));
        muteButton.innerHTML = `<i class="fa-solid fa-volume-${Number(volumeSlider.value) ? "high" : "xmark"}"></i>`;
        if (Number(volumeSlider.value)) player?.unMute();
        else player?.mute();
    });
    progressBar.addEventListener("input", () => {
        if (player?.getDuration()) player.seekTo(progressBar.value / 100 * player.getDuration(), true);
    });
    modal.querySelector(".settings-button").addEventListener("click", event => {
        event.stopPropagation();
        settingsMenu.hidden = !settingsMenu.hidden;
    });
    speedSelect.addEventListener("change", () => player?.setPlaybackRate(Number(speedSelect.value)));
    qualitySelect.addEventListener("change", () => {
        if (player && qualitySelect.value !== "auto") player.setPlaybackQuality(qualitySelect.value);
    });
    modal.querySelector(".theater-button").addEventListener("click", () => modal.classList.toggle("theater-mode"));
    modal.querySelector(".fullscreen-button").addEventListener("click", () => {
        if (document.fullscreenElement) document.exitFullscreen();
        else videoContainer.requestFullscreen();
    });
    modal.querySelector(".pip-button").addEventListener("click", () => {
        const iframe = modal.querySelector("iframe");
        if (iframe?.requestPictureInPicture) iframe.requestPictureInPicture().catch(() => {});
        else alert("Picture-in-picture is not supported by this browser.");
    });
    modal.querySelector(".video-surface").addEventListener("click", () => {
        if (player) player.getPlayerState() === YT.PlayerState.PLAYING ? player.pauseVideo() : player.playVideo();
    });
    modal.querySelector(".video-surface").addEventListener("dblclick", () => modal.querySelector(".fullscreen-button").click());
    videoContainer.addEventListener("mousemove", showControls);
    videoContainer.addEventListener("mouseleave", () => {
        if (player?.getPlayerState() === YT.PlayerState.PLAYING) controls.classList.add("controls-hidden");
    });
    modal.addEventListener("touchstart", showControls, {passive: true});
    modal.addEventListener("click", event => {
        if (event.target === modal) closeTrailer();
    });
    document.body.appendChild(modal);
    currentTrailerModal = modal;
    document.body.style.overflow = "hidden";

    const loadYouTubeAPI = () => {
        if (window.YT?.Player) return Promise.resolve();
        if (window.youtubeApiReady) return window.youtubeApiReady;
        window.youtubeApiReady = new Promise(resolve => {
            window.onYouTubeIframeAPIReady = resolve;
            const script = document.createElement("script");
            script.src = "https://www.youtube.com/iframe_api";
            document.head.appendChild(script);
        });
        return window.youtubeApiReady;
    };

    loadYouTubeAPI().then(() => {
        if (currentTrailerModal !== modal) return;
        const playerWidth = videoContainer.clientWidth;
        const playerHeight = Math.round(playerWidth * 9 / 16);
        player = new YT.Player(modal.querySelector(".youtube-player"), {
            videoId: trailerKey,
            width: playerWidth,
            height: playerHeight,
            playerVars: {
                autoplay: 1,
                controls: 0,
                disablekb: 1,
                fs: 0,
                iv_load_policy: 3,
                playsinline: 1,
                rel: 0
            },
            events: {
                onReady: event => {
                    const youtubePlayer = modal.querySelector(".youtube-player");
                    const iframe = youtubePlayer?.querySelector("iframe");
                    if (youtubePlayer) {
                        youtubePlayer.style.position = "absolute";
                        youtubePlayer.style.inset = "0";
                        youtubePlayer.style.width = "100%";
                        youtubePlayer.style.height = "100%";
                    }
                    if (iframe) {
                        iframe.style.position = "absolute";
                        iframe.style.inset = "0";
                        iframe.style.width = `${playerWidth}px`;
                        iframe.style.height = `${playerHeight}px`;
                        iframe.style.maxWidth = "100%";
                        iframe.style.maxHeight = "100%";
                    }
                    event.target.setVolume(100);
                    event.target.playVideo();
                    loading.classList.add("loading-hidden");
                    modal.querySelector(".video-poster")?.classList.add("loading-hidden");
                    const qualities = player.getAvailableQualityLevels();
                    qualitySelect.innerHTML = '<option value="auto">Auto</option>' + qualities.map(quality => `<option value="${quality}">${quality}</option>`).join("");
                    showControls();
                },
                onStateChange: event => {
                    if (event.data === YT.PlayerState.PLAYING) {
                        updatePlayButton(true);
                        showControls();
                    } else if (event.data === YT.PlayerState.PAUSED) {
                        updatePlayButton(false);
                        showControls();
                    } else if (event.data === YT.PlayerState.ENDED) {
                        closeTrailer();
                    }
                },
                onError: () => {
                    loading.innerHTML = "<span>Unable to play this trailer.</span>";
                }
            }
        });
        modal.player = player;
    });

    const timeUpdater = setInterval(() => {
        if (currentTrailerModal !== modal) return clearInterval(timeUpdater);
        updateTime();
    }, 250);
}

function closeTrailer() {
    currentTrailerModal?.remove();
    currentTrailerModal = null;
    document.body.style.overflow = "";
}

async function recordMovieWatched(movieId) {
    try {
        await fetch(`/api/watch/${movieId}`, {
            method: "POST",
            credentials: "same-origin"
        });
    } catch (error) {
        console.error("Watch history error:", error);
    }
}

async function searchMovies() {
    const search = searchBar.value.trim();
    if (!search) {
        heroSection?.classList.remove("search-hidden");
        loadMoviesByGenre();
        return;
    }

    heroSection?.classList.add("search-hidden");
    movieResults.innerHTML = '<p class="message">Loading movies...</p>';

    try {
        const response = await fetch(`/api/movies?search=${encodeURIComponent(search)}`);
        if (!response.ok) throw new Error("Unable to load movies.");

        const movies = await response.json();
        if (!movies.length) {
            movieResults.innerHTML = '<p class="message">No movies found.</p>';
            return;
        }

        movieResults.innerHTML = `
            <h2 class="genre-title">
                ${search.toLowerCase() === "new" ? "New Movies" : `Search results for "${escapeHtml(search)}"`}
            </h2>
            <div class="movie-grid">
                ${movies.map(movie => `
                    <article class="movie-card" data-movie-id="${movie.id}">
                        <img
                            src="${movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : ""}"
                            alt="${escapeHtml(movie.title || "Movie poster")}"
                        >
                        <h3>${escapeHtml(movie.title || "Untitled")}</h3>
                        <p>${movie.release_date ? movie.release_date.substring(0, 4) : "Unknown"}</p>
                    </article>
                `).join("")}
            </div>
        `;

        movieResults.querySelectorAll(".movie-card").forEach(card => {
    card.addEventListener("click", () => {
        const movie = movies.find(
            item => item.id === Number(card.dataset.movieId)
        );

        if (movie) {
            window.location.href = `/movies/${movie.id}`;
        }
    });
});
    } catch (error) {
        movieResults.innerHTML = '<p class="message">Unable to load movies right now. Please try again.</p>';
        console.error("Search error:", error);
    }
}

async function loadMoviesByGenre() {
    try {
        const response = await fetch("/api/movies-by-genres");
        if (!response.ok) throw new Error("Unable to load movies.");

        const rows = await response.json();
        heroMovies = rows.flatMap(row => row.movies);
        updateHeroMovie();
        movieResults.innerHTML = rows.map(row => `
            <section class="genre-section">
                <h2 class="genre-title">${escapeHtml(row.genre)}</h2>
                <div class="movie-row">
                    ${row.movies.map(movie => `
                        <img
                            class="movie-poster"
                            src="https://image.tmdb.org/t/p/w500${movie.poster_path}"
                            alt="${escapeHtml(movie.title || "Movie poster")}"
                            data-movie-id="${movie.id}"
                        >
                    `).join("")}
                </div>
            </section>
        `).join("");

        movieResults.querySelectorAll(".movie-poster").forEach(poster => {
    poster.addEventListener("click", () => {
        const movieId = poster.dataset.movieId;

        window.location.href = `/movies/${movieId}`;
    });
});
    } catch (error) {
        movieResults.innerHTML = '<p class="message">Unable to load movies right now. Please try again.</p>';
        console.error("Movie loading error:", error);
    }
}

function updateHeroMovie() {
    if (!heroMovies.length) return;

    const candidates = heroMovies.filter(movie => movie.id !== featuredMovie?.id);
    featuredMovie = candidates[Math.floor(Math.random() * candidates.length)] || heroMovies[0];
    heroTitle.textContent = featuredMovie.title || "Featured Movie";
    heroDescription.textContent = featuredMovie.overview || "Discover a new movie from our collection.";
}

searchForm?.addEventListener("submit", event => {
    event.preventDefault();
    searchMovies();
});

searchBar?.addEventListener("input", () => {
    if (!searchBar.value.trim()) {
        heroSection?.classList.remove("search-hidden");
    } else {
        heroSection?.classList.add("search-hidden");
    }
});

loadMoviesByGenre();
setInterval(updateHeroMovie, 9000);

heroPlayButton?.addEventListener("click", () => {
    if (featuredMovie) showMovie(featuredMovie);
});

document.addEventListener("keydown", event => {
    if (!currentTrailerModal) return;
    if (event.key === "Escape") {
        if (document.fullscreenElement) document.exitFullscreen();
        else closeTrailer();
        return;
    }

    const player = currentTrailerModal.player;
    if (!player || event.target.matches("input, select, button")) return;
    if (event.key === " ") {
        event.preventDefault();
        player.getPlayerState() === YT.PlayerState.PLAYING ? player.pauseVideo() : player.playVideo();
    } else if (event.key === "ArrowLeft") {
        player.seekTo(Math.max(0, player.getCurrentTime() - 5), true);
    } else if (event.key === "ArrowRight") {
        player.seekTo(player.getCurrentTime() + 5, true);
    } else if (event.key === "ArrowUp") {
        event.preventDefault();
        player.setVolume(Math.min(100, player.getVolume() + 5));
    } else if (event.key === "ArrowDown") {
        event.preventDefault();
        player.setVolume(Math.max(0, player.getVolume() - 5));
    } else if (event.key.toLowerCase() === "m") {
        currentTrailerModal.querySelector(".mute-button").click();
    } else if (event.key.toLowerCase() === "f") {
        currentTrailerModal.querySelector(".fullscreen-button").click();
    }
});

const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");

loginForm?.addEventListener("submit", async event => {
    event.preventDefault();
    loginError.textContent = "";

    try {
        const response = await fetch("/login", {
            method: "POST",
            body: new FormData(loginForm)
        });
        const data = await response.json();
        if (!response.ok) {
            loginError.textContent = data.message;
            return;
        }
        if (data.success) window.location.href = data.redirect;
    } catch (error) {
        console.error("Login failed:", error);
    }
});
