const hero = document.getElementById("hero");
const heroPlay = document.getElementById("hero-play");
let currentTrailerModal = null;

function escapeHtml(value) {
    return String(value).replace(/[&<>\'\"]/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    })[character]);
}

function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return "00:00";
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function loadYouTubeAPI() {
    if (window.YT?.Player) return Promise.resolve();
    if (window.youtubeApiReady) return window.youtubeApiReady;
    window.youtubeApiReady = new Promise(resolve => {
        window.onYouTubeIframeAPIReady = resolve;
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(script);
    });
    return window.youtubeApiReady;
}

async function openTrailer(trailerKey) {
    closeTrailer();
    const title = document.getElementById("hero-title").textContent.trim();
    const modal = document.createElement("div");
    modal.className = "trailer-modal active";
    modal.innerHTML = `
        <div class="trailer-box"><div class="trailer-content">
            <button class="close-trailer" type="button" aria-label="Close trailer"><i class="fa-solid fa-xmark"></i></button>
            <h2>${escapeHtml(title)}</h2>
            <p class="trailer-status">Official Trailer</p>
            <div class="video-container">
                <img class="video-poster" src="${hero.style.backgroundImage.match(/url\(['"]?([^'"]+)/)?.[1] || ""}" alt="">
                <div class="youtube-player"></div>
                <button class="video-surface" type="button" aria-label="Play or pause trailer"></button>
                <div class="video-loading" role="status" aria-label="Loading trailer"><span class="loading-spinner"></span></div>
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
                    <button class="video-button fullscreen-button" type="button" aria-label="Fullscreen"><i class="fa-solid fa-expand"></i></button>
                </div>
                <div class="settings-menu" hidden><label>Speed <select class="speed-select" aria-label="Playback speed"><option value="0.5">0.5x</option><option value="1" selected>Normal</option><option value="1.5">1.5x</option><option value="2">2x</option></select></label></div>
            </div>
        </div></div>`;
    document.body.appendChild(modal);
    currentTrailerModal = modal;
    document.body.style.overflow = "hidden";

    const container = modal.querySelector(".video-container");
    const controls = modal.querySelector(".video-controls");
    const loading = modal.querySelector(".video-loading");
    const play = modal.querySelector(".play-button");
    const mute = modal.querySelector(".mute-button");
    const volume = modal.querySelector(".volume-slider");
    const progress = modal.querySelector(".progress-bar");
    const time = modal.querySelector(".time-display");
    const settings = modal.querySelector(".settings-menu");
    const speed = modal.querySelector(".speed-select");
    let player;
    let hideTimer;
    const updateButton = playing => { play.innerHTML = `<i class="fa-solid fa-${playing ? "pause" : "play"}"></i>`; };
    const showControls = () => { controls.classList.remove("controls-hidden"); clearTimeout(hideTimer); if (player?.getPlayerState() === YT.PlayerState.PLAYING) hideTimer = setTimeout(() => controls.classList.add("controls-hidden"), 3000); };
    const updateTime = () => { if (!player?.getDuration()) return; const duration = player.getDuration(); progress.value = player.getCurrentTime() / duration * 100; time.textContent = `${formatTime(player.getCurrentTime())} / ${formatTime(duration)}`; };

    modal.querySelector(".close-trailer").addEventListener("click", closeTrailer);
    play.addEventListener("click", () => player && (player.getPlayerState() === YT.PlayerState.PLAYING ? player.pauseVideo() : player.playVideo()));
    modal.querySelector(".restart-button").addEventListener("click", () => { player?.seekTo(0, true); player?.playVideo(); });
    modal.querySelectorAll(".skip-button").forEach(button => button.addEventListener("click", () => player?.seekTo(Math.max(0, player.getCurrentTime() + Number(button.dataset.seconds)), true)));
    mute.addEventListener("click", () => { if (!player) return; player.isMuted() ? player.unMute() : player.mute(); mute.innerHTML = `<i class="fa-solid fa-volume-${player.isMuted() ? "xmark" : "high"}"></i>`; });
    volume.addEventListener("input", () => { const value = Number(volume.value); player?.setVolume(value); value ? player?.unMute() : player?.mute(); });
    progress.addEventListener("input", () => player?.seekTo(progress.value / 100 * player.getDuration(), true));
    modal.querySelector(".settings-button").addEventListener("click", () => { settings.hidden = !settings.hidden; });
    speed.addEventListener("change", () => player?.setPlaybackRate(Number(speed.value)));
    modal.querySelector(".theater-button").addEventListener("click", () => modal.classList.toggle("theater-mode"));
    modal.querySelector(".fullscreen-button").addEventListener("click", () => document.fullscreenElement ? document.exitFullscreen() : container.requestFullscreen());
    modal.querySelector(".video-surface").addEventListener("click", () => play.click());
    modal.querySelector(".video-surface").addEventListener("dblclick", () => modal.querySelector(".fullscreen-button").click());
    container.addEventListener("mousemove", showControls);

    await loadYouTubeAPI();
    if (currentTrailerModal !== modal) return;
    player = new YT.Player(modal.querySelector(".youtube-player"), {
        videoId: trailerKey, width: container.clientWidth, height: Math.round(container.clientWidth * 9 / 16),
        playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, playsinline: 1, rel: 0 },
        events: {
            onReady: event => { event.target.setVolume(100); event.target.playVideo(); loading.classList.add("loading-hidden"); modal.querySelector(".video-poster").classList.add("loading-hidden"); showControls(); },
            onStateChange: event => { if (event.data === YT.PlayerState.PLAYING) { updateButton(true); showControls(); } if (event.data === YT.PlayerState.PAUSED) { updateButton(false); showControls(); } if (event.data === YT.PlayerState.ENDED) closeTrailer(); },
            onError: () => { loading.textContent = "Unable to play this trailer."; }
        }
    });
    modal.youtubePlayer = player;
    const timer = setInterval(() => currentTrailerModal === modal ? updateTime() : clearInterval(timer), 250);
}

function closeTrailer() {
    currentTrailerModal?.youtubePlayer?.destroy();
    currentTrailerModal?.remove();
    currentTrailerModal = null;
    document.body.style.overflow = "";
}

heroPlay?.addEventListener("click", () => {
    const trailerKey = hero?.dataset.trailerKey;
    if (trailerKey) openTrailer(trailerKey);
    else alert("Sorry, no trailer is available for this movie.");
});

document.addEventListener("keydown", event => {
    if (!currentTrailerModal) return;
    if (event.key === "Escape") { document.fullscreenElement ? document.exitFullscreen() : closeTrailer(); return; }
    const player = currentTrailerModal.youtubePlayer;
    if (!player || event.target.matches("input, select, button")) return;
    if (event.key === " ") { event.preventDefault(); currentTrailerModal.querySelector(".play-button").click(); }
    if (event.key === "ArrowLeft") player.seekTo(Math.max(0, player.getCurrentTime() - 10), true);
    if (event.key === "ArrowRight") player.seekTo(player.getCurrentTime() + 10, true);
    if (event.key === "ArrowUp") { event.preventDefault(); player.setVolume(Math.min(100, player.getVolume() + 5)); }
    if (event.key === "ArrowDown") { event.preventDefault(); player.setVolume(Math.max(0, player.getVolume() - 5)); }
    if (event.key.toLowerCase() === "m") currentTrailerModal.querySelector(".mute-button").click();
    if (event.key.toLowerCase() === "f") currentTrailerModal.querySelector(".fullscreen-button").click();
});
