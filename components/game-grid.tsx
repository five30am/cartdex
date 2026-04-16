import { GameCard } from "@/components/game-card";

interface Game {
  id: number;
  title: string;
  year?: string | null;
  box_art_path?: string | null;
  system_slug?: string;
  system_name?: string;
  user_rating?: number | null;
}

interface GameGridProps {
  games: Game[];
  showSystem?: boolean;
  emptyMessage?: string;
}

export function GameGrid({
  games,
  showSystem = false,
  emptyMessage = "No games found",
}: GameGridProps) {
  if (games.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p
          style={{
            fontFamily: "'Orbitron', sans-serif",
            fontSize: 13,
            letterSpacing: "3px",
            color: "var(--text-dim)",
            opacity: 0.5,
            textTransform: "uppercase",
          }}
        >
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))",
        gap: "20px",
      }}
    >
      {games.map((game) => (
        <GameCard
          key={game.id}
          id={game.id}
          title={game.title}
          year={game.year}
          box_art_path={game.box_art_path}
          system_slug={game.system_slug}
          system_name={game.system_name}
          user_rating={game.user_rating}
          showSystem={showSystem}
        />
      ))}
    </div>
  );
}
