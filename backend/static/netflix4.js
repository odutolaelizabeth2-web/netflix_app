const movieContainer = document.getElementById("movie-container");
const searchInput = document.getElementById("search");
const searchForm = document.getElementById("search-form");

const trailerModal = document.getElementById("trailer-modal");
const trailerVideo = document.getElementById("trailer-video");
const trailerFrame = document.getElementById("trailer-frame");
const trailerTitle = document.getElementById("trailer-title");
const trailerMessage = document.getElementById("trailer-message");
const trailerSaved = document.getElementById("trailer-saved");
const trailerLink = document.getElementById("trailer-link");
const trailerClose = document.getElementById("trailer-close");

// ================= TRAILER POP-UP =================

function openTrailer(title, youtubeKey, message) {


trailerTitle.textContent = title;


if (youtubeKey) {

    trailerFrame.src =
        `https://www.youtube.com/embed/${youtubeKey}?autoplay=1&rel=0`;

    trailerVideo.style.display = "block";

    trailerLink.href =
        `https://www.youtube.com/watch?v=${youtubeKey}`;

    trailerLink.style.display = "inline";

    trailerMessage.textContent = "";

} else {

    trailerFrame.src = "";

    trailerVideo.style.display = "none";

    trailerLink.style.display = "none";

    trailerMessage.textContent =
        message ||
        "Sorry, no trailer is available for this title.";

}


trailerModal.classList.add("open");

document.body.style.overflow = "hidden";


}

// ================= CLOSE TRAILER =================

function closeTrailer() {


trailerFrame.src = "";

trailerSaved.style.display = "none";

trailerModal.classList.remove("open");

document.body.style.overflow = "";

}

trailerClose.addEventListener(
"click",
closeTrailer
);

// Click outside the trailer to close it

trailerModal.addEventListener(
"click",
(e) => {


    if (e.target === trailerModal) {

        closeTrailer();

    }

}


);

// Escape key closes trailer

document.addEventListener(
"keydown",
(e) => {


    if (e.key === "Escape") {

        closeTrailer();

    }

}


);

// ================= WATCH HISTORY =================

async function markAsWatched(movieId) {


try {

    const res = await fetch(
        `/api/watch/${movieId}`,
        {
            method: "POST"
        }
    );


    if (res.ok) {

        trailerSaved.style.display = "inline";

    }

} catch (error) {

    console.error(
        "Could not save to watch history:",
        error
    );

}


}

// ================= PLAY MOVIE TRAILER =================

async function playMovieTrailer(movie) {


trailerSaved.style.display = "none";


// Show loading message first
openTrailer(
    movie.title,
    null,
    "Loading trailer..."
);


// Save movie to watch history
markAsWatched(movie.id);


try {

    const res = await fetch(
        `/api/movies/${movie.id}/trailer`
    );


    const data = await res.json();


    if (!res.ok) {

        throw new Error(
            data.detail ||
            "Trailer request failed"
        );

    }


    openTrailer(
        movie.title,
        data.key
    );


} catch (error) {

    console.error(
        "Trailer failed:",
        error
    );


    openTrailer(
        movie.title,
        null
    );

}


}

// ================= HERO PLAY BUTTON =================

document
.querySelector(".play-btn")
.addEventListener(
"click",
() => {


        trailerSaved.style.display = "none";


        openTrailer(
            "Stranger Things",
            "b9EkMc79ZSU"
        );

    }
);


// ================= CREATE MOVIE POSTER =================

function createPoster(movie) {


const poster =
    document.createElement("img");


poster.src =
    `https://image.tmdb.org/t/p/w300${movie.poster_path}`;


poster.alt =
    movie.title;


poster.title =
    movie.title;


// Lazy loading
poster.loading = "lazy";


poster.decoding = "async";


poster.className =
    "movie-poster";


// Click poster = save + trailer
poster.addEventListener(
    "click",
    () => playMovieTrailer(movie)
);


return poster;

}

// ================= LOAD MOVIES BY GENRE =================

async function loadMoviesByGenres() {


try {

    const res =
        await fetch(
            "/api/movies-by-genres"
        );


    const data =
        await res.json();


    if (!res.ok) {

        movieContainer.innerHTML =
            `<p class="message">
                Error loading movies
            </p>`;

        return;

    }


    movieContainer.innerHTML = "";


    data.forEach(
        (genreBlock) => {

            // Genre title
            const genreTitle =
                document.createElement("h2");


            genreTitle.textContent =
                genreBlock.genre;


            genreTitle.className =
                "genre-title";


            movieContainer.appendChild(
                genreTitle
            );


            // Movie row
            const row =
                document.createElement("div");


            row.className =
                "movie-row";


            // Add posters
            genreBlock.movies.forEach(
                (movie) => {

                    if (!movie.poster_path) {

                        return;

                    }


                    row.appendChild(
                        createPoster(movie)
                    );

                }
            );


            movieContainer.appendChild(
                row
            );

        }
    );


} catch (error) {

    console.error(
        "Failed to load movies:",
        error
    );


    movieContainer.innerHTML =
        `<p class="message">
            Something went wrong
        </p>`;

}


}

// ================= INITIAL MOVIE LOAD =================

loadMoviesByGenres();

// ================= SEARCH =================

searchForm.addEventListener(
"submit",
async (e) => {


    e.preventDefault();


    const query =
        searchInput.value.trim();


    // Empty search
    if (!query) {

        loadMoviesByGenres();

        return;

    }


    try {

        const res =
            await fetch(
                `/api/movies?search=${encodeURIComponent(query)}`
            );


        const data =
            await res.json();


        movieContainer.innerHTML = "";


        // Search title
        const title =
            document.createElement("h2");


        title.textContent =
            `Results for "${query}"`;


        title.className =
            "genre-title";


        movieContainer.appendChild(
            title
        );


        // Search results grid
        const grid =
            document.createElement("div");


        grid.className =
            "movie-grid";


        data.forEach(
            (movie) => {

                if (!movie.poster_path) {

                    return;

                }


                grid.appendChild(
                    createPoster(movie)
                );

            }
        );


        movieContainer.appendChild(
            grid
        );


    } catch (error) {

        console.error(
            "Search failed:",
            error
        );

    }

}


);
