"""Multi-strategy scorer ensemble.

Each scorer takes a seed Movie + Candidate and returns a normalized score
in [0, 1]. The ensemble combines them with per-mode weights, applies a
diversity penalty (no 3+ films from same director), reserves a small
exploration / multi-armed-bandit slot, and balances eras."""

from __future__ import annotations

from app.scorers.awards import AwardsScorer
from app.scorers.collaborative import CollaborativeScorer
from app.scorers.content import ContentScorer
from app.scorers.crew import CrewScorer
from app.scorers.critic import CriticScorer
from app.scorers.item2vec import Item2VecScorer
from app.scorers.letterboxd_scorer import LetterboxdScorer
from app.scorers.llm_scorer import LLMScorer
from app.scorers.plot_embedding import PlotEmbeddingScorer
from app.scorers.reddit_scorer import RedditScorer
from app.scorers.tmdb_similar import TmdbSimilarScorer

REGISTERED = [
    ContentScorer(),          # genre / decade / runtime / language vector cosine
    PlotEmbeddingScorer(),    # synopsis embedding cosine
    CollaborativeScorer(),    # Trakt similar + global rec graph
    LetterboxdScorer(),       # Letterboxd similar-films panel
    TmdbSimilarScorer(),      # TMDB similar + recommendations
    CrewScorer(),             # director / cast / DoP / composer / writer overlap
    CriticScorer(),           # RT / MC / IMDb / Letterboxd avg
    AwardsScorer(),           # festival / Oscar shortlists
    RedditScorer(),           # r/MovieSuggestions "if you liked X try Y"
    LLMScorer(),              # Anthropic deep rerank on top-K
    Item2VecScorer(),         # session embedding from per-user view history
]


def by_name() -> dict[str, object]:
    return {s.name: s for s in REGISTERED}
