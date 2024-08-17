import * as co from 'chessops';
import { RoundProxy } from './roundProxy';
import { type MoveContext, type GameStatus, LocalGame } from './localGame';
import { clockToSpeed } from 'game';
import type { ClockData } from 'round';
import type { LocalPlayOpts, LocalSetup, SoundEvent, LocalSpeed } from './types';
import { env } from './localEnv';
import { statusOf } from 'game/status';

export class GameCtrl implements LocalSetup {
  private stopped = true;
  private setup: LocalSetup;
  private trans: Trans;
  live: LocalGame;
  history?: LocalGame;
  proxy: RoundProxy;
  clock?: ClockData & { since?: number };
  originalOrientation: Color;
  resolveThink?: () => void;

  constructor(readonly opts: LocalPlayOpts) {
    this.setup = opts.setup ?? {};
    this.setup.initialFen ??= co.fen.INITIAL_FEN;
    this.originalOrientation = this.black ? 'white' : this.white ? 'black' : 'white';
    this.trans = site.trans(opts.i18n);
    this.resetClock();
    this.live = new LocalGame(this.initialFen);
    site.pubsub.on('ply', this.jump);
    site.pubsub.on('flip', env.redraw);
  }

  async init(): Promise<void> {
    env.bot.setUids(this.setup);
    this.proxy = new RoundProxy();
    this.triggerStart();
  }

  reset(params: LocalSetup = this.setup): void {
    this.setup = { ...this.setup, ...params };
    this.history = undefined;
    this.stop();
    env.bot.reset();
    env.bot.setUids(this.setup);
    this.live = new LocalGame(this.initialFen);
    this.updateTurn();
    this.resetClock();
    this.updateClockUi();
    this.proxy.reset();
    this.triggerStart();
  }

  flag(): void {
    if (this.clock) this.clock[this.turn] = 0;
    this.gameOver({ winner: this.awaitingTurn, status: statusOf('outoftime') });
    this.updateClockUi();
  }

  resign(): void {
    this.gameOver({ winner: this.awaitingTurn, status: statusOf('resign') });
  }

  draw(): void {
    this.gameOver({ winner: undefined, status: statusOf('draw') });
  }

  start(): void {
    this.stopped = false;
    setTimeout(() => !this.live.end && this.updateTurn()); // ??
  }

  stop(): void {
    if (this.isStopped) return;
    this.stopped = true;
    this.resolveThink?.();
  }

  async botMove(): Promise<void> {
    const [bot, game] = [env.bot[this.turn], this.live];
    if (!bot || game.end || this.isStopped || this.resolveThink) return;
    const move = await env.bot.move({
      pos: { fen: game.initialFen, moves: game.moves.map(x => x.uci) },
      chess: this.live.chess,
      remaining: this.clock?.[this.turn],
      initial: this.clock?.initial,
      increment: this.clock?.increment,
    });
    if (!move) return;
    await new Promise<void>(resolve => {
      if (!this.clock || !move.thinktime) return resolve();
      this.clock[this.turn] -= move.thinktime;
      if (env.dev?.hurry) return resolve();
      this.resolveThink = resolve;
      this.clock.since = undefined;
      const realtime = Math.min(move.thinktime, this.clock[this.turn], 2 * (0.5 + Math.random()));
      setTimeout(resolve, realtime * 1000);
    });
    this.resolveThink = undefined;

    if (!this.isStopped && game === this.live && env.round.ply === game.ply) this.move(move.uci);
    else setTimeout(() => this.updateTurn(), 200);
  }

  move(uci: Uci): boolean {
    if (this.history) this.live = this.history;
    this.history = undefined;
    this.stopped = false;

    if (this.clock?.since) this.clock[this.turn] -= (performance.now() - this.clock.since) / 1000;
    const moveCtx = this.live.move({ uci, clock: this.clock });
    const { end, move, justPlayed } = moveCtx;

    this.proxy.data.steps.splice(this.live.ply);
    env.dev?.preMove?.(moveCtx);
    this.playSounds(moveCtx);
    env.round.apiMove(moveCtx);

    if (move?.promotion)
      env.round.chessground?.setPieces(
        new Map([[uci.slice(2, 4) as Cg.Key, { color: justPlayed, role: move.promotion, promoted: true }]]),
      );

    if (end) this.gameOver(moveCtx);
    if (this.clock?.increment) {
      this.clock[justPlayed] += this.clock.increment;
      this.updateClockUi();
    }
    env.redraw();
    return !end;
  }

  nameOf(color: Color): string {
    console.log(this.trans(color));
    if (!this[color] && this[co.opposite(color)]) return env.username;
    return this[color] ? env.bot.get(this[color])!.name : this.trans(color);
  }

  idOf(color: Color): string {
    return this[color] ?? env.user;
  }

  get turn(): Color {
    return this.live.chess.turn;
  }

  get awaitingTurn(): Color {
    return co.opposite(this.live.chess.turn);
  }

  get isUserTurn(): boolean {
    return this.history === undefined && !env.bot[this.turn];
  }

  get isStopped(): boolean {
    return this.stopped; // ??
  }

  get isLive(): boolean {
    return this.history === undefined && !this.isStopped;
  }

  get cgOrientation(): Color {
    return env.round?.flip ? co.opposite(this.originalOrientation) : this.originalOrientation;
  }

  get speed(): LocalSpeed {
    return clockToSpeed(this.initial, this.increment);
  }

  get white(): string | undefined {
    return this.setup.white;
  }

  get black(): string | undefined {
    return this.setup.black;
  }

  get initial(): number {
    return this.clock?.initial ?? Infinity;
  }

  get increment(): number {
    return this.clock?.increment ?? 0;
  }

  get initialFen(): string {
    return this.setup.initialFen ?? co.fen.INITIAL_FEN;
  }

  get localSetup(): LocalSetup {
    return { ...this.setup };
  }

  private jump = (ply: number): void => {
    this.history =
      ply < this.live.moves.length
        ? new LocalGame(this.initialFen, this.live.moves.slice(0, ply))
        : undefined;
    if (this.clock) this.clock.since = this.history ? undefined : performance.now();
    this.updateTurn();
  };

  private updateTurn(game: LocalGame = this.history ?? this.live): void {
    if (this.clock && game !== this.live) this.clock = { ...this.clock, ...game.clock };
    this.proxy.updateCg(game, this.live.ply === 0 ? { lastMove: undefined } : {});
    this.updateClockUi();
    if (this.isLive) this.botMove();
  }

  private updateClockUi(): void {
    if (!this.clock) return;
    this.clock.running = this.isLive && this.live.ply > 0;
    env.round.clock?.setClock(this.proxy.data, this.clock.white, this.clock.black);
    if (this.isStopped || !this.isLive) env.round.clock?.stopClock();
  }

  private playSounds(moveCtx: MoveContext): void {
    if (moveCtx.silent) return;
    const { justPlayed, san, end } = moveCtx;
    const sounds: SoundEvent[] = [];
    const prefix = env.bot[justPlayed] ? 'bot' : 'player';
    if (san.includes('x')) sounds.push(`${prefix}Capture`);
    if (this.live.chess.isCheck()) sounds.push(`${prefix}Check`);
    if (end) sounds.push(`${prefix}Win`);
    sounds.push(`${prefix}Move`);
    const boardSoundVolume = sounds ? env.bot.playSound(justPlayed, sounds) : 1;
    if (boardSoundVolume) site.sound.move({ ...moveCtx, volume: boardSoundVolume });
  }

  private triggerStart(): void {
    ['white', 'black'].forEach(c => env.bot.playSound(c as Color, ['greeting']));
    setTimeout(() => !env.dev && !this.isUserTurn && this.start(), 500);
  }

  private gameOver(final: Omit<GameStatus, 'end' | 'turn'>) {
    this.live.finish(final);
    this.stop();
    if (this.clock) env.round.clock?.stopClock();
    if (!env.dev?.onGameOver({ ...final, end: true, turn: this.turn })) {
      env.round.endWithData?.({ ...final, boosted: false });
    }
    env.redraw();
  }

  private resetClock(): void {
    // in dev mode unlimited, set initial to 999999 because round/ctrl.ts will not create a clock
    // controller unless there's a clock object, meaning we cannot switch from unlimited to realtime
    // without reloads. clockCtrl does not like Infinity and i don't want to pull any of those jenga
    // pieces. but it wouldn't be the worst thing if this were fixed in round/ctrl.ts and clockCtrl.ts
    const initial = Number.isFinite(this.setup.initial)
      ? this.setup.initial
      : this.opts.dev
      ? 999999
      : undefined;
    if (initial === undefined) return (this.clock = undefined);
    this.clock = {
      initial: initial,
      increment: this.setup.increment ?? 0,
      white: initial,
      black: initial,
      emerg: 0,
      showTenths: this.opts.pref.clockTenths,
      showBar: true,
      moretime: 0,
      running: false,
      since: undefined,
    };
  }
}
