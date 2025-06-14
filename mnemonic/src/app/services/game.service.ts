import {Injectable, signal} from "@angular/core";
import {Tile} from '../models/tile.model';

@Injectable({
  providedIn: "root",
})
export class GameService {
  // Game State
  currentLevel = signal(1);
  score = signal(0);
  gameState = signal<"idle" | "sequence" | "input" | "checking" | "over">("idle");

  // Grid Configuration
  gridSize = signal(3); // Initial grid size (3x3)
  tiles = signal<Tile[]>([]);
  numTilesToLight = signal(3); // Initial number of tiles to light

  // Sequence and Player Input
  #sequence: number[] = [];
  #playerInput: number[] = [];
  #isInCombo = false;

  constructor() {
    this.initializeGrid();
  }

  initializeGrid(): void {
    const size = this.gridSize();
    const newTiles: Tile[] = [];
    for (let i = 0; i < size * size; i++) {
      newTiles.push({ id: i, lit: false, selectedByPlayer: false, isCorrectAndClicked: false, isCorrectAndNotClicked: false, isIncorrectAndClicked: false });
    }
    this.tiles.set(newTiles);
    this.#playerInput = [];
  }

  startGame(): void {
    this.currentLevel.set(1);
    this.score.set(0);
    this.#isInCombo = false;
    this.numTilesToLight.set(3);
    this.gridSize.set(3);
    this.initializeGrid();
    this.nextRound();
    this.gameState.set("sequence");
  }

  // Reset game
  resetGame(): void {
    this.currentLevel.set(1);
    this.score.set(0);
    this.#isInCombo = false;
    this.numTilesToLight.set(3);
    this.gridSize.set(3);
    this.gameState.set("idle");
  }

  nextRound(): void {
    this.#playerInput = [];
    this.#isInCombo = true;
    this.tiles.update(tiles => tiles.map(t => ({ ...t, lit: false, selectedByPlayer: false, isCorrectAndClicked: false, isCorrectAndNotClicked: false, isIncorrectAndClicked: false })));
    this.#generateSequence();
    // Logic to display sequence will be handled by components observing state
    this.gameState.set("sequence");
    // After sequence display, move to "input"
  }

  #generateSequence(): void {
    const availableTiles = this.tiles().map(t => t.id);
    this.#sequence = [];
    const numToLight = this.numTilesToLight();

    for (let i = 0; i < numToLight; i++) {
      if (availableTiles.length === 0) break;
      const randomIndex = Math.floor(Math.random() * availableTiles.length);
      this.#sequence.push(availableTiles.splice(randomIndex, 1)[0]);
    }
    console.log("Generated Sequence:", this.#sequence); // For debugging
  }

  handlePlayerTileClick(tileId: number): void {
    if (this.gameState() !== "input") return;

    if (this.#playerInput.includes(tileId)) {
      // Already selected - do nothing
      return;
    }
    this.#playerInput.push(tileId);
    this.tiles.update(tiles =>
      tiles.map(t => (t.id === tileId ? { ...t, selectedByPlayer: true } : t))
    );

    const currentIndex = this.#playerInput.length - 1;
    const isInSequence = this.#sequence[currentIndex] === tileId;
    const isCorrectClick = this.#sequence.findIndex(id => id === tileId) !== -1;

    if (isCorrectClick) {
      // Check if tile clicked can score double
      if (this.#isInCombo && isInSequence) {
        this.score.update(s => s + 2);
      } else {
        // disable combo logic
        this.#isInCombo = false;
        this.score.update(s => s + 1);
      }
    } else {
      this.#isInCombo = false;
      // Game over logic is handled in #checkRound when it checks for correctSelections
    }

    // Check if player has made enough selections
    if (this.#playerInput.length === this.#sequence.length) {
      this.#checkRound();
    }
  }

  #checkRound(): void {
    this.gameState.set("checking");
    const correctSelections = this.#playerInput.every(id => this.#sequence.includes(id)) &&
      this.#playerInput.length === this.#sequence.length &&
      this.#sequence.every(id => this.#playerInput.includes(id));

    if (correctSelections) {
      this.currentLevel.update(l => l + 1);
      // Progression logic
      this.numTilesToLight.update(n => n + 1);
      // Grid growth logic: if numTilesToLight > (gridSize*gridSize)/2
      const currentGridCapacity = this.gridSize() * this.gridSize();
      if (this.numTilesToLight() > currentGridCapacity / 2) {
        this.gridSize.update(g => g + 1);
      }
      this.initializeGrid(); // Re-initialize grid for new size if it changed
      this.nextRound(); // Start next round
    } else {
      this.#isInCombo = false; // Reset combo on incorrect round
      // Update tiles with final states before setting the game to over
      const sequence = this.#sequence;
      const playerInput = this.#playerInput;
      this.tiles.update(tiles =>
        tiles.map(tile => {
          const isInSequence = sequence.includes(tile.id);
          const isClickedByPlayer = playerInput.includes(tile.id);
          return {
            ...tile,
            isCorrectAndClicked: isInSequence && isClickedByPlayer,
            isCorrectAndNotClicked: isInSequence && !isClickedByPlayer,
            isIncorrectAndClicked: !isInSequence && isClickedByPlayer,
          };
        })
      );

      // Player made a mistake, game over as per current simplified logic.
      this.gameState.set("over"); // Or could be "round_failed" then back to "idle" or "sequence"
      console.log("Round Failed, Game Over");
    }
  }

  // Method to get the current sequence (e.g., for the grid component to light up tiles)
  getSequence(): ReadonlyArray<number> {
    return this.#sequence;
  }
}
