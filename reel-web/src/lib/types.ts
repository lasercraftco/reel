/**
 * Shared TypeScript types — mirrors the FastAPI schemas + Drizzle row shapes.
 */

export type MovieGenre = { id: number; name: string };

export type MovieSummary = {
  id: number;
  title: string;
  release_date?: string | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string | null;
  runtime?: number | null;
  vote_average?: number | null;
  original_language?: string | null;
  genres: MovieGenre[];
  ratings_external?: { rt?: number; mc?: number; imdb?: number; letterboxd?: number };
  mood_tags?: string[];
  era_tag?: string | null;
};

export type MovieCastMember = {
  id: number;
  name: string;
  character?: string;
  profilePath?: string | null;
  order?: number;
};

export type MovieCrewMember = {
  id: number;
  name: string;
  job?: string;
  department?: string;
  profilePath?: string | null;
};

export type MovieDetail = MovieSummary & {
  original_title?: string | null;
  original_language?: string | null;
  tagline?: string | null;
  keywords: { id: number; name: string }[];
  certification?: string | null;
  cast: MovieCastMember[];
  crew: MovieCrewMember[];
  watch_providers?: Record<string, unknown>;
  awards?: Array<{ ceremony: string; year: number; category: string; result: string }>;
  homepage?: string | null;
  imdb_id?: string | null;
  library_status?: string | null;
  plex_key?: string | null;
};

export type LibraryState = {
  in_library: boolean;
  status?: string;
  progress?: number | null;
  plex_link?: string | null;
};

export type Recommendation = {
  movie: MovieSummary;
  score: number;
  rank?: number;
  per_scorer?: Record<string, number>;
  explanation?: Record<string, unknown> & { reason?: string };
  library?: LibraryState;
};

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: "owner" | "trusted" | "friend" | "guest";
  blocked: boolean;
};
