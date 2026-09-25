import type { Gate, Token } from "../data/stage";

export type Pick = {
  gate: Gate;
  side: "left" | "right";
  token: Token;
};

export class GameState {
  private picks: Pick[] = [];

  reset(): void {
    this.picks = [];
  }

  choose(gate: Gate, side: "left" | "right"): Pick {
    const pick = { gate, side, token: gate[side] };
    this.picks.push(pick);
    return pick;
  }

  get selections(): readonly Pick[] {
    return this.picks;
  }

  get invested(): number {
    return this.picks.length * 10;
  }

  get finalValue(): number {
    return this.picks.reduce((total, pick) => total + pick.token.goalValueUsd, 0);
  }

  get returnRate(): number {
    return this.invested === 0 ? 0 : this.finalValue / this.invested - 1;
  }
}
