import Phaser from "phaser";

export class RunnerScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Container;
  private roadLines: Phaser.GameObjects.Rectangle[] = [];
  private gateFrames: Phaser.GameObjects.Container[] = [];
  private speed = 8;
  private bossLabel?: Phaser.GameObjects.Text;

  constructor() {
    super("runner");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#090a0c");
    this.drawWorld();
    this.player = this.createPlayer(this.scale.width / 2, this.scale.height * 0.72);
    this.scale.on("resize", this.handleResize, this);
  }

  update(): void {
    const height = this.scale.height;
    for (const line of this.roadLines) {
      line.y += this.speed;
      line.scaleY = 1 + (line.y / height) * 1.8;
      if (line.y > height + 40) line.y = -40;
    }
  }

  setGateLabels(left: string, right: string): void {
    this.gateFrames.forEach((gate) => gate.destroy(true));
    this.gateFrames = [
      this.createGate(this.scale.width * 0.28, this.scale.height * 0.38, left, 0x67e8f9),
      this.createGate(this.scale.width * 0.72, this.scale.height * 0.38, right, 0xffdd57)
    ];
    this.gateFrames.forEach((gate) => {
      gate.setAlpha(0);
      gate.setScale(0.72);
      this.tweens.add({ targets: gate, alpha: 1, scale: 1, duration: 280, ease: "Back.Out" });
    });
  }

  hideGates(): void {
    this.gateFrames.forEach((gate) => {
      this.tweens.add({ targets: gate, alpha: 0, y: gate.y + 130, duration: 220 });
    });
  }

  runThrough(side: "left" | "right", outcome: number, done: () => void): void {
    const targetX = this.scale.width * (side === "left" ? 0.28 : 0.72);
    this.tweens.add({
      targets: this.player,
      x: targetX,
      y: this.scale.height * 0.43,
      scale: 0.72,
      duration: 390,
      ease: "Cubic.In",
      onComplete: () => {
        this.flashImpact(outcome >= 0);
        this.time.delayedCall(260, () => {
          this.hideGates();
          this.player.setPosition(this.scale.width / 2, this.scale.height * 0.72).setScale(1);
          done();
        });
      }
    });
  }

  bossFinish(returnRate: number, marketLabel: string): void {
    this.gateFrames.forEach((gate) => gate.destroy(true));
    this.gateFrames = [];
    const boss = this.add.container(this.scale.width / 2, this.scale.height * 0.3);
    const body = this.add.circle(0, 0, 76, 0xff4f64).setStrokeStyle(8, 0x090a0c);
    const eyeL = this.add.rectangle(-27, -13, 18, 8, 0x090a0c).setRotation(0.2);
    const eyeR = this.add.rectangle(27, -13, 18, 8, 0x090a0c).setRotation(-0.2);
    const mouth = this.add.rectangle(0, 25, 58, 9, 0x090a0c);
    const label = this.add.text(0, -112, marketLabel, {
      fontFamily: "Arial Black, sans-serif",
      fontSize: "22px",
      color: "#ffffff"
    }).setOrigin(0.5);
    this.bossLabel = label;
    boss.add([body, eyeL, eyeR, mouth, label]).setScale(0);
    this.tweens.add({ targets: boss, scale: 1, duration: 420, ease: "Back.Out" });

    this.time.delayedCall(620, () => {
      if (returnRate < 0) {
        this.cameras.main.shake(500, 0.03);
        this.tweens.add({
          targets: this.player,
          x: -180,
          y: this.scale.height + 120,
          angle: -520,
          duration: 700,
          ease: "Cubic.In"
        });
      } else {
        this.tweens.add({ targets: boss, x: this.scale.width + 180, angle: 360, duration: 700 });
      }
    });
  }

  setBossLabel(label: string): void {
    this.bossLabel?.setText(label);
  }

  resetWorld(): void {
    this.scene.restart();
  }

  private drawWorld(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const graphics = this.add.graphics();
    graphics.fillStyle(0x15181b, 1);
    graphics.fillTriangle(width * 0.37, 0, width * 0.07, height, width * 0.93, height);
    graphics.lineStyle(4, 0x2b3035, 1);
    graphics.lineBetween(width * 0.37, 0, width * 0.07, height);
    graphics.lineBetween(width * 0.63, 0, width * 0.93, height);

    for (let i = 0; i < 10; i += 1) {
      const y = i * (height / 9);
      const line = this.add.rectangle(width / 2, y, 5, 48, 0x5b646b, 0.68);
      this.roadLines.push(line);
    }

    for (let i = 0; i < 26; i += 1) {
      const x = (i * 83) % width;
      const y = (i * 137) % height;
      this.add.circle(x, y, i % 3 === 0 ? 2 : 1, i % 2 === 0 ? 0x67e8f9 : 0xffdd57, 0.45);
    }
  }

  private createPlayer(x: number, y: number): Phaser.GameObjects.Container {
    const shadow = this.add.ellipse(0, 43, 58, 18, 0x000000, 0.42);
    const body = this.add.rectangle(0, 0, 43, 56, 0xf4f7f8).setStrokeStyle(5, 0x090a0c);
    const head = this.add.circle(0, -39, 22, 0xffdd57).setStrokeStyle(5, 0x090a0c);
    const visor = this.add.rectangle(7, -42, 23, 8, 0x67e8f9).setRotation(-0.08);
    const legL = this.add.rectangle(-12, 36, 11, 34, 0xff4f64).setRotation(-0.2);
    const legR = this.add.rectangle(12, 36, 11, 34, 0x67e8f9).setRotation(0.2);
    const player = this.add.container(x, y, [shadow, legL, legR, body, head, visor]);
    this.tweens.add({ targets: [legL, legR], angle: { from: -13, to: 13 }, yoyo: true, repeat: -1, duration: 110 });
    this.tweens.add({ targets: player, y: y - 4, yoyo: true, repeat: -1, duration: 180 });
    return player;
  }

  private createGate(x: number, y: number, symbol: string, color: number): Phaser.GameObjects.Container {
    const width = Math.min(150, this.scale.width * 0.34);
    const sideL = this.add.rectangle(-width / 2, 28, 10, 112, color);
    const sideR = this.add.rectangle(width / 2, 28, 10, 112, color);
    const top = this.add.rectangle(0, -28, width, 10, color);
    const coin = this.add.circle(0, 9, 42, color, 0.95).setStrokeStyle(5, 0x090a0c);
    const text = this.add.text(0, 8, symbol, {
      fontFamily: "Arial Black, sans-serif",
      fontSize: symbol.length > 7 ? "10px" : symbol.length > 5 ? "15px" : "19px",
      color: "#090a0c",
      align: "center"
    }).setOrigin(0.5);
    return this.add.container(x, y, [sideL, sideR, top, coin, text]);
  }

  private flashImpact(positive: boolean): void {
    const color = positive ? 0x62f58d : 0xff4f64;
    const flash = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, color, 0.48);
    flash.setDepth(20);
    this.tweens.add({ targets: flash, alpha: 0, duration: 280, onComplete: () => flash.destroy() });
    this.cameras.main.shake(150, 0.014);
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.cameras.resize(gameSize.width, gameSize.height);
  }
}
