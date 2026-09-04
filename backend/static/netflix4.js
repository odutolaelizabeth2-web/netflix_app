
const searchBar = document.getElementById("movie-search");
const searchButton = document.getElementById("search-button");
const movieResults = document.getElementById("movie-results");

let currentTrailerModal = null;

/* =================================
   SHOW MOVIE TRAILER
================================= */
async function showmovie(movie) {
    console.log("Movie selected:", movie);
    // Prevent opening multiple trailers
    if (currentTrailerModal) {
        closeTrailer();
    }
    try {
        const response = await fetch(
            `/api/movies/${movie.id}/trailer`
        );
        if (!response.ok) {
            throw new Error("Unable to load trailer.");
        }
        const trailer = await response.json();
        console.log("Trailer:", trailer);
        if (!trailer.key) {
            alert("Sorry, no trailer is available for this movie.");
            return;
        }
        openTrailer(movie, trailer);
        await recordMovieWatched(movie.id);
    } catch (error) {
        console.error("Trailer error:", error);
        alert("Unable to load the trailer right now.");
    }
}

/* =================================
   OPEN TRAILER
================================= */
function escapeHtml(value) {
    return String(value).replace(/[&<>\'"]/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;",
        "'": "&#39;", '"': "&quot;"
    })[character]);
}

function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return "00:00";
    const minutes = Math.floor(seconds / 60);
    const remainder = Math.floor(seconds % 60);
    return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

const genreNames = {
    28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy",
    80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family",
    14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music",
    9648: "Mystery", 10749: "Romance", 878: "Science Fiction",
    53: "Thriller", 10752: "War", 37: "Western"
};

function loadYouTubeAPI() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (window.youtubeApiReady) return window.youtubeApiReady;

    window.youtubeApiReady = new Promise(resolve => {
        const previousReady = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            if (previousReady) previousReady();
            resolve();
        };
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(script);
    });
    return window.youtubeApiReady;
}

async function openTrailer(movie, trailer) {
    const title = escapeHtml(movie.title);
    const poster = movie.poster_path
        ? `https://image.tmdb.org/t/p/w780${movie.poster_path}`
        : "";
    const genres = (movie.genre_ids || []).map(id => genreNames[id]).filter(Boolean).slice(0, 3);
    const movieInfo = [movie.release_date?.substring(0, 4), ...genres].filter(Boolean).join(" • ");
    const modal = document.createElement("div");
    modal.className = "trailer-modal active";

    modal.innerHTML = `
        <div class="trailer-box">

            <button
                class="close-trailer"
                type="button"
                aria-label="Close trailer">
                <i class="fa-solid fa-xmark"></i>
            </button>

            <div class="trailer-content">

                <h2>${title}</h2>

                <p class="trailer-status">${escapeHtml(movieInfo || "Official Trailer")}</p>

                <div class="video-container">

                    <img class="video-poster" src="${poster}" alt="">
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
                        <button class="video-button mute-button" type="button" aria-label="Unmute trailer"><i class="fa-solid fa-volume-xmark"></i></button>
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
                        <label>Quality <select class="quality-select" aria-label="Video quality"><option>Auto</option></select></label>
                    </div>

                </div>

            </div>

        </div>
     `;

    document.body.appendChild(modal);

    currentTrailerModal = modal;

    // Prevent background page from scrolling
    document.body.style.overflow = "hidden";


    /* Close button */

    const closeButton =
        modal.querySelector(".close-trailer");
    const videoContainer = modal.querySelector(".video-container");
    const controls = modal.querySelector(".video-controls");
    const loading = modal.querySelector(".video-loading");
    const playButton = modal.querySelector(".play-button");
    const muteButton = modal.querySelector(".mute-button");
    const volumeSlider = modal.querySelector(".volume-slider");
    const progressBar = modal.querySelector(".progress-bar");
    const timeDisplay = modal.querySelector(".time-display");
    const surface = modal.querySelector(".video-surface");
    const settingsButton = modal.querySelector(".settings-button");
    const settingsMenu = modal.querySelector(".settings-menu");
    const speedSelect = modal.querySelector(".speed-select");
    const qualitySelect = modal.querySelector(".quality-select");
    const theaterButton = modal.querySelector(".theater-button");
    const pipButton = modal.querySelector(".pip-button");
    const fullscreenButton = modal.querySelector(".fullscreen-button");
    let hideControlsTimer;

    closeButton.addEventListener("click", closeTrailer);

    let player;

    function updatePlayButton(isPlaying) {
        playButton.innerHTML = `<i class="fa-solid fa-${isPlaying ? "pause" : "play"}"></i>`;
        playButton.setAttribute("aria-label", isPlaying ? "Pause trailer" : "Play trailer");
    }

    function showControls() {
        controls.classList.remove("controls-hidden");
        clearTimeout(hideControlsTimer);
        if (player && player.getPlayerState() === YT.PlayerState.PLAYING) {
            hideControlsTimer = setTimeout(() => controls.classList.add("controls-hidden"), 3000);
        }
    }

    function updateTime() {
        if (!player || !player.getDuration()) return;
        const currentTime = player.getCurrentTime();
        const duration = player.getDuration();
        progressBar.value = (currentTime / duration) * 100;
        timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
    }

    playButton.addEventListener("click", () => {
        if (!player) return;
        player.getPlayerState() === YT.PlayerState.PLAYING ? player.pauseVideo() : player.playVideo();
    });
    modal.querySelector(".restart-button").addEventListener("click", () => {
        if (player) { player.seekTo(0, true); player.playVideo(); }
    });
    modal.querySelectorAll(".skip-button").forEach(button => button.addEventListener("click", () => {
        if (player) player.seekTo(Math.max(0, player.getCurrentTime() + Number(button.dataset.seconds)), true);
    }));
    muteButton.addEventListener("click", () => {
        if (!player) return;
        if (player.isMuted()) player.unMute();
        else player.mute();
        const muted = player.isMuted();
        muteButton.innerHTML = `<i class="fa-solid fa-volume-${muted ? "xmark" : "high"}"></i>`;
        muteButton.setAttribute("aria-label", muted ? "Unmute trailer" : "Mute trailer");
    });
    volumeSlider.addEventListener("input", () => {
        if (!player) return;
        player.setVolume(Number(volumeSlider.value));
        if (Number(volumeSlider.value) > 0) player.unMute();
    });
    progressBar.addEventListener("input", () => {
        if (player && player.getDuration()) player.seekTo((progressBar.value / 100) * player.getDuration(), true);
    });
    fullscreenButton.addEventListener("click", () => {
        if (document.fullscreenElement) document.exitFullscreen();
        else videoContainer.requestFullscreen();
    });
    settingsButton.addEventListener("click", event => {
        event.stopPropagation();
        settingsMenu.hidden = !settingsMenu.hidden;
    });
    speedSelect.addEventListener("change", () => player?.setPlaybackRate(Number(speedSelect.value)));
    qualitySelect.addEventListener("change", () => {
        if (player && qualitySelect.value !== "Auto") player.setPlaybackQuality(qualitySelect.value);
    });
    theaterButton.addEventListener("click", () => {
        modal.classList.toggle("theater-mode");
        theaterButton.setAttribute("aria-label", modal.classList.contains("theater-mode") ? "Exit theater mode" : "Theater mode");
    });
    pipButton.addEventListener("click", () => {
        const iframe = modal.querySelector("iframe");
        if (iframe?.requestPictureInPicture) iframe.requestPictureInPicture().catch(() => {});
        else alert("Picture-in-picture is not supported for this embedded trailer.");
    });
    surface.addEventListener("click", () => {
        if (player) player.getPlayerState() === YT.PlayerState.PLAYING ? player.pauseVideo() : player.playVideo();
    });
    surface.addEventListener("dblclick", () => fullscreenButton.click());
    modal.addEventListener("mousemove", showControls);
    modal.addEventListener("touchstart", showControls, {passive: true});
    updatePlayButton(false);

    await loadYouTubeAPI();
    if (!currentTrailerModal) return;
    player = new YT.Player(modal.querySelector(".youtube-player"), {
        videoId: trailer.key,
        playerVars: { autoplay: 1, controls: 0, rel: 0, playsinline: 1, modestbranding: 1 },
        events: {
            onReady: event => {
                event.target.setVolume(100);
                event.target.playVideo();
                loading.classList.add("loading-hidden");
                player.setPlaybackRate(Number(speedSelect.value));
                const qualities = player.getAvailableQualityLevels();
                qualitySelect.innerHTML = '<option value="Auto">Auto</option>' + qualities.map(quality => `<option value="${quality}">${quality}</option>`).join("");
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
                    setTimeout(closeTrailer, 500);
                }
            },
            onError: () => { loading.innerHTML = "<span>Unable to play this trailer.</span>"; }
        }
    });
    modal.youtubePlayer = player;
    const timeUpdater = setInterval(() => {
        if (!currentTrailerModal) return clearInterval(timeUpdater);
        updateTime();
    }, 250);

    function handleKeyboard(event) {
        if (!currentTrailerModal || event.target.matches("input, select, button")) return;
        if (event.key === "Escape") {
            event.stopPropagation();
            if (document.fullscreenElement) document.exitFullscreen();
            else closeTrailer();
            return;
        }
        if (!player) return;
        if (event.key === " ") {
            event.preventDefault();
            player.getPlayerState() === YT.PlayerState.PLAYING ? player.pauseVideo() : player.playVideo();
        } else if (event.key === "ArrowLeft") player.seekTo(Math.max(0, player.getCurrentTime() - 5), true);
        else if (event.key === "ArrowRight") player.seekTo(player.getCurrentTime() + 5, true);
        else if (event.key === "ArrowUp") { event.preventDefault(); player.setVolume(Math.min(100, player.getVolume() + 5)); volumeSlider.value = player.getVolume(); }
        else if (event.key === "ArrowDown") { event.preventDefault(); player.setVolume(Math.max(0, player.getVolume() - 5)); volumeSlider.value = player.getVolume(); }
        else if (event.key.toLowerCase() === "m") muteButton.click();
        else if (event.key.toLowerCase() === "f") fullscreenButton.click();
        showControls();
    }
    document.addEventListener("keydown", handleKeyboard);
    modal.keyboardHandler = handleKeyboard;


    /* Close when clicking outside the trailer box */

    modal.addEventListener("click", function(event) {

        if (event.target === modal) {
            closeTrailer();
        }

    });
}

async function recordMovieWatched(movieId) {
    try {
        const response = await fetch(`/api/watch-history/${movieId}`, {
            method: "POST",
            credentials: "same-origin"
        });

        const result = await response.json();
        console.log("Watch history response:", result);

        if (!response.ok) {
            console.error("Watch history failed:", response.status);
        }
    } catch (error) {
        console.error("Watch history error:", error);
    }
}


/* =================================
   CLOSE TRAILER
================================= */

function closeTrailer() {
    if (currentTrailerModal) {
        const player = currentTrailerModal.youtubePlayer;
        if (player) player.destroy();
        if (currentTrailerModal.keyboardHandler) document.removeEventListener("keydown", currentTrailerModal.keyboardHandler);
        currentTrailerModal.remove();
        currentTrailerModal = null;
    }
    // Allow the page to scroll again
    document.body.style.overflow = "";
}


/* =================================
   ESC KEY
================================= */

document.addEventListener("keydown", function(event) {

    if (event.key === "Escape" && !currentTrailerModal) {
        closeTrailer();
    }

});


/* =================================
   SEARCH BUTTON
================================= */

searchButton.addEventListener(
    "click",
    searchMovies
);


/*ENTER KEY SEARCH */

searchBar.addEventListener(
    "keydown",
    function(event) {

        if (event.key === "Enter") {
            searchMovies();
        }
    }
);

/* =================================
   SEARCH MOVIES
================================= */
async function searchMovies() {
    const search = searchBar.value.trim();
    if (search === "") {
        movieResults.innerHTML = "";
        return;
    }

    movieResults.innerHTML = `
        <p>Loading movies...</p>
    `;

    try {
        const response = await fetch(
            `/api/movies?search=${encodeURIComponent(search)}`
        );
        if (!response.ok) {
            throw new Error("Unable to load movies.");
        }
        const movies = await response.json();
        if (movies.length === 0) {
            movieResults.innerHTML = `
                <p>No movies found.</p>
            `;
            return;
        }

        movieResults.innerHTML = `
            <h2>
                ${
                    search.toLowerCase() === "new"
                        ? "New Movies"
                        : `Search results for "${search}"`
                }
            </h2>

            <div class="movie-grid">
                ${movies.map(movie => `
                    <div
                        class="movie-card"
                        data-movie-id="${movie.id}"
                    >
                        <img
                            src="${
                                movie.poster_path
                                    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
                                    : ""
                            }"
                            alt="${movie.title}"
                        >
                        <h3>
                            ${movie.title}
                        </h3>

                        <p>
                            ${
                                movie.release_date
                                    ? movie.release_date.substring(0, 4)
                                    : "Unknown"
                            }
                        </p>
                    </div>
                `).join("")}
            </div>
        `;

        /* =================================
           ADD CLICK EVENTS TO MOVIE CARDS
        ================================= */
        document
            .querySelectorAll(".movie-card")
            .forEach(card => {
                card.addEventListener(
                    "click",
                    function() {
                        const movieId =
                            Number(card.dataset.movieId);
                        const movie =
                            movies.find(
                                movie => movie.id === movieId
                            );

                        if (movie) {
                            showmovie(movie);
                        }

                    }
                );

            });
    } catch (error) {
        movieResults.innerHTML = `
            <p>
                Unable to load movies right now.
                Please try again.
            </p>
        `;
        console.error("Search error:", error);
    }
}


const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginError.textContent = "";

    const formData = new FormData(loginForm);
    try {
        const response = await fetch("/login", {
            method: "POST",
            body: formData
        });
        const data = await response.json();
        if (!response.ok) {
            loginError.textContent = data.message;
            return;
        }

        if (data.success) {
            window.location.href = data.redirect;
        }

    } catch (error) {
        loginError.textContent = "Something went wrong. Please try again.";
        console.error(error);
    }
});