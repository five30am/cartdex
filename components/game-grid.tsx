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
        <div className="text-5xl mb-4 opacity-30">🎮</div>
        <p className="text-neutral-500 text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
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
