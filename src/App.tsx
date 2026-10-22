import { useCallback, useEffect, useRef } from "react";
import type Phaser from "phaser";
import { createGame } from "./game/createGame";

export default function App() {
  const gameRef = useRef<Phaser.Game | null>(null);

  // Fokus na canvasie gry — skróty klawiaturowe działają od razu po załadowaniu
  // strony i po każdym kliknięciu w obszar gry (także przy osadzeniu strony).
  const focusCanvas = useCallback(() => {
    const canvas = gameRef.current?.canvas;
    if (canvas) {
      canvas.setAttribute("tabindex", "0");
      canvas.focus({ preventScroll: true });
    }
  }, []);

  useEffect(() => {
    if (gameRef.current) return;
    const game = createGame("game-root");
    gameRef.current = game;
    const timer = window.setTimeout(focusCanvas, 150);
    return () => {
      window.clearTimeout(timer);
      game.destroy(true);
      gameRef.current = null;
    };
  }, [focusCanvas]);

  return (
    <div
      className="flex h-full w-full items-center justify-center bg-black"
      onPointerDown={focusCanvas}
    >
      <div id="game-root" className="h-full w-full" />
    </div>
  );
}
