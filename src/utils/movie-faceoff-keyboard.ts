export interface MovieFaceoffKeyboardCallbacks {
    hasTargetedInsertion: () => boolean;
    hasMoviePair: () => boolean;
    cancelTargetedInsertion: () => void;
    markMovieUnseen: (index: 0 | 1) => void;
    markBothMoviesUnseen: () => void;
    vote: (index: 0 | 1) => void;
}

export function createMovieFaceoffKeyboardHandler(
    callbacks: MovieFaceoffKeyboardCallbacks
): (event: KeyboardEvent) => void {
    return (event) => {
        if (callbacks.hasTargetedInsertion() && event.key === 'Escape') {
            event.preventDefault();
            callbacks.cancelTargetedInsertion();
            return;
        }

        if (!callbacks.hasMoviePair()) return;

        if (event.shiftKey && event.key === 'ArrowLeft') {
            event.preventDefault();
            callbacks.markMovieUnseen(0);
            return;
        }

        if (event.shiftKey && event.key === 'ArrowRight') {
            event.preventDefault();
            callbacks.markMovieUnseen(1);
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            callbacks.markBothMoviesUnseen();
            return;
        }

        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            callbacks.vote(0);
            return;
        }

        if (event.key === 'ArrowRight') {
            event.preventDefault();
            callbacks.vote(1);
        }
    };
}
