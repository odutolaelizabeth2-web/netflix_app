
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

        openTrailer(movie, trailer.key);

    } catch (error) {

        console.error("Trailer error:", error);

        alert("Unable to load the trailer right now.");
    }
}


/* =================================
   OPEN TRAILER
================================= */

function openTrailer(movie, trailerKey) {

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

                <h2>${movie.title}</h2>

                <p class="trailer-status">
                    Official Trailer
                </p>

                <div class="video-container">

                    <iframe
                        src="https://www.youtube.com/embed/${trailerKey}?autoplay=1&rel=0"
                        title="${movie.title} Trailer"
                        allow="autoplay; encrypted-media; picture-in-picture"
                        allowfullscreen>
                    </iframe>

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

    closeButton.addEventListener("click", closeTrailer);


    /* Close when clicking outside the trailer box */

    modal.addEventListener("click", function(event) {

        if (event.target === modal) {
            closeTrailer();
        }

    });
}


/* =================================
   CLOSE TRAILER
================================= */

function closeTrailer() {

    if (currentTrailerModal) {

        /*
         * Removing the iframe stops the YouTube
         * video and therefore stops the audio too.
         */
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

    if (event.key === "Escape") {
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