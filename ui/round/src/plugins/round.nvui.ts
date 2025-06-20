import { LooseVNode, type VNode, looseH as h, noTrans, onInsert } from 'lib/snabbdom';
import type RoundController from '../ctrl';
import { renderClock } from 'lib/game/clock/clockView';
import { renderTableWatch, renderTablePlay, renderTableEnd } from '../view/table';
import { makeConfig as makeCgConfig } from '../ground';
import renderCorresClock from '../corresClock/corresClockView';
import { renderResult } from '../view/replay';
import { plyStep } from '../util';
import type { Step, NvuiPlugin } from '../interfaces';
import { type Player, type TopOrBottom, playable } from 'lib/game/game';
import {
  type MoveStyle,
  renderSan,
  renderPieces,
  renderBoard as renderChessBoard,
  styleSetting,
  pieceSetting,
  prefixSetting,
  positionSetting,
  boardSetting,
  boardCommandsHandler,
  possibleMovesHandler,
  lastCapturedCommandHandler,
  selectionHandler,
  arrowKeyHandler,
  positionJumpHandler,
  pieceJumpingHandler,
  castlingFlavours,
  inputToMove,
  renderPockets,
  type DropMove,
  pocketsStr,
} from 'lib/nvui/chess';
import { makeSetting, renderSetting, Setting } from 'lib/nvui/setting';
import { Notify } from 'lib/nvui/notify';
import { commands, boardCommands } from 'lib/nvui/command';
import { Chessground as makeChessground } from '@lichess-org/chessground';
import { pubsub } from 'lib/pubsub';
import { plyToTurn } from 'lib/game/chess';
import { next, prev } from '../keyboard';
import { storage } from 'lib/storage';

const selectSound = () => site.sound.play('select');
const borderSound = () => site.sound.play('outOfBound');
const errorSound = () => site.sound.play('error');

// esbuild
export function initModule(): NvuiPlugin {
  const notify = new Notify(),
    moveStyle = styleSetting(),
    prefixStyle = prefixSetting(),
    pieceStyle = pieceSetting(),
    positionStyle = positionSetting(),
    boardStyle = boardSetting(),
    pageStyle = pageSetting();

  pubsub.on('socket.in.message', line => {
    if (line.u === 'lichess') notify.set(line.t);
  });
  pubsub.on('round.suggestion', notify.set);

  return {
    premoveInput: '',
    playPremove(ctrl: RoundController) {
      const nvui = ctrl.nvui!;
      nvui.submitMove?.(true);
      nvui.premoveInput = '';
    },
    submitMove: undefined,
    render(ctrl: RoundController): VNode {
      notify.redraw = ctrl.redraw;
      const d = ctrl.data,
        nvui = ctrl.nvui!,
        step = plyStep(d, ctrl.ply),
        style = moveStyle.get(),
        pockets = step.crazy?.pockets,
        clocks = [anyClock(ctrl, 'bottom'), anyClock(ctrl, 'top')];
      if (!ctrl.chessground) {
        ctrl.setChessground(
          makeChessground(document.createElement('div'), {
            ...makeCgConfig(ctrl),
            animation: { enabled: false },
            drawable: { enabled: false },
            coordinates: false,
          }),
        );
      }
      return h('div.nvui', { hook: onInsert(_ => setTimeout(() => notify.set(gameText(ctrl)), 2000)) }, [
        h('h1', gameText(ctrl)),
        h('h2', i18n.nvui.gameInfo),
        ...['white', 'black'].map((color: Color) =>
          h('p', [i18n.site[color], ':', playerHtml(ctrl, ctrl.playerByColor(color))]),
        ),
        h('p', [i18n.site[d.game.rated ? 'rated' : 'casual'] + ' ' + transGamePerf(d.game.perf)]),
        d.clock ? h('p', [i18n.site.clock, `${d.clock.initial / 60} + ${d.clock.increment}`]) : null,
        h('h2', i18n.nvui.moveList),
        h('p.moves', { attrs: { role: 'log', 'aria-live': 'off' } }, renderMoves(d.steps.slice(1), style)),
        h('h2', i18n.nvui.pieces),
        h('div.pieces', renderPieces(ctrl.chessground.state.pieces, style)),
        pockets && h('div.pockets', renderPockets(pockets)),
        h('h2', i18n.nvui.gameStatus),
        h('div.status', { attrs: { role: 'status', 'aria-live': 'assertive', 'aria-atomic': 'true' } }, [
          ctrl.data.game.status.name === 'started' ? i18n.site.playingRightNow : renderResult(ctrl),
        ]),
        h('h2', i18n.nvui.lastMove),
        h(
          'p.lastMove',
          { attrs: { 'aria-live': 'assertive', 'aria-atomic': 'true' } },
          // make sure consecutive moves are different so that they get re-read
          renderSan(step.san, step.uci, style) + (ctrl.ply % 2 === 0 ? '' : ' '),
        ),
        clocks.some(c => !!c) &&
          h('div.clocks', [
            h('h2', i18n.nvui.yourClock),
            h('div.botc', clocks[0]),
            h('h2', i18n.nvui.opponentClock),
            h('div.topc', clocks[1]),
          ]),
        notify.render(),
        ctrl.isPlaying() &&
          h('div.move-input', [
            h('h2', i18n.nvui.inputForm),
            h(
              'form#move-form',
              {
                hook: onInsert(el => {
                  const $form = $(el as HTMLFormElement),
                    $input = $form.find('.move').val('');
                  nvui.submitMove = createSubmitHandler(ctrl, notify.set, moveStyle.get, $input);
                  $form.on('submit', (ev: SubmitEvent) => {
                    ev.preventDefault();
                    nvui.submitMove?.();
                  });
                }),
              },
              [
                h('label', [
                  d.player.color === d.game.player ? i18n.site.yourTurn : i18n.site.waiting,
                  h('input.move.mousetrap', {
                    attrs: {
                      name: 'move',
                      type: 'text',
                      autocomplete: 'off',
                      autofocus: true,
                    },
                  }),
                ]),
              ],
            ),
          ]),
        ...(pageStyle.get() === 'actions-board'
          ? [...renderActions(ctrl), ...renderBoard(ctrl)]
          : [...renderBoard(ctrl), ...renderActions(ctrl)]),
        h('h2', i18n.site.advancedSettings),
        h('label', [noTrans('Move notation'), renderSetting(moveStyle, ctrl.redraw)]),
        h('label', [noTrans('Page layout'), renderSetting(pageStyle, ctrl.redraw)]),
        h('h3', noTrans('Board settings')),
        h('label', [noTrans('Piece style'), renderSetting(pieceStyle, ctrl.redraw)]),
        h('label', [noTrans('Piece prefix style'), renderSetting(prefixStyle, ctrl.redraw)]),
        h('label', [noTrans('Show position'), renderSetting(positionStyle, ctrl.redraw)]),
        h('label', [noTrans('Board layout'), renderSetting(boardStyle, ctrl.redraw)]),
        h('h2', i18n.keyboardMove.keyboardInputCommands),
        h('p', [
          i18n.nvui.inputFormCommandList,
          h('br'),
          i18n.nvui.movePiece,
          h('br'),
          i18n.nvui.promotion,
          h('br'),
          ...inputCommands
            .filter(c => !c.invalid?.(ctrl))
            .flatMap(cmd => [`${cmd.cmd}${cmd.alt ? ` / ${cmd.alt}` : ''}: `, cmd.help, h('br')]),
        ]),
        ...boardCommands(),
      ]);
    },
  };
}

function renderBoard(ctrl: RoundController): LooseVNode[] {
  const prefixStyle = prefixSetting(),
    pieceStyle = pieceSetting(),
    positionStyle = positionSetting(),
    boardStyle = boardSetting();

  return [
    h('h2', i18n.site.board),
    h(
      'div.board',
      {
        hook: onInsert(el => {
          const $board = $(el);
          const $buttons = $board.find('button');
          $buttons.on(
            'click',
            selectionHandler(() => ctrl.data.opponent.color, selectSound),
          );
          $buttons.on('keydown', (e: KeyboardEvent) => {
            if (e.shiftKey && e.key.match(/^[ad]$/i)) nextOrPrev(ctrl)(e);
            else if (['o', 'l', 't'].includes(e.key)) boardCommandsHandler()(e);
            else if (e.key.startsWith('Arrow')) arrowKeyHandler(ctrl.data.player.color, borderSound)(e);
            else if (e.key === 'c')
              lastCapturedCommandHandler(
                () => ctrl.data.steps.map(step => step.fen),
                pieceStyle.get(),
                prefixStyle.get(),
              )();
            else if (e.code.match(/^Digit([1-8])$/)) positionJumpHandler()(e);
            else if (e.key.match(/^[kqrbnp]$/i)) pieceJumpingHandler(selectSound, errorSound)(e);
            else if (e.key.toLowerCase() === 'm')
              possibleMovesHandler(
                ctrl.data.player.color,
                ctrl.chessground,
                ctrl.data.game.variant.key,
                ctrl.data.steps,
              )(e);
            else if (e.key === 'i') {
              e.preventDefault();
              $('input.move').get(0)?.focus();
            }
          });
        }),
      },
      renderChessBoard(
        ctrl.chessground.state.pieces,
        ctrl.data.game.variant.key === 'racingKings' ? 'white' : ctrl.data.player.color,
        pieceStyle.get(),
        prefixStyle.get(),
        positionStyle.get(),
        boardStyle.get(),
      ),
    ),
    h('div.boardstatus', { attrs: { 'aria-live': 'polite', 'aria-atomic': 'true' } }, ''),
  ];
}

function renderActions(ctrl: RoundController): LooseVNode[] {
  return [
    h('h2', i18n.nvui.actions),
    ...(ctrl.data.player.spectator
      ? renderTableWatch(ctrl)
      : playable(ctrl.data)
        ? renderTablePlay(ctrl)
        : renderTableEnd(ctrl)),
  ];
}

function createSubmitHandler(
  ctrl: RoundController,
  notify: (txt: string) => void,
  style: () => MoveStyle,
  $input: Cash,
) {
  return (submitStoredPremove = false) => {
    const nvui = ctrl.nvui!;

    if (submitStoredPremove && nvui.premoveInput === '') return;
    if (!submitStoredPremove && $input.val() === '') {
      if (nvui.premoveInput !== '') {
        // if this is not a premove submission, the input is empty, and we have a stored premove, clear it
        nvui.premoveInput = '';
        notify(i18n.nvui.premoveCancelled);
      } else notify(i18n.nvui.invalidMove);
    }

    const input = submitStoredPremove ? nvui.premoveInput : castlingFlavours(($input.val() as string).trim());
    if (!input) return;

    // commands may be submitted with or without a leading /
    const command = isInputCommand(input) || isInputCommand(input.slice(1));
    if (command) command.cb(notify, ctrl, style(), input);
    else {
      const move = inputToMove(input, plyStep(ctrl.data, ctrl.ply).fen, ctrl.chessground);
      const isDrop = (u: undefined | string | DropMove) => !!(u && typeof u !== 'string');
      const isOpponentsTurn = ctrl.data.player.color !== ctrl.data.game.player;
      const isInvalidDrop = (d: DropMove) =>
        !ctrl.crazyValid(d.role, d.key) || (!isOpponentsTurn && ctrl.chessground.state.pieces.has(d.key));

      if (isOpponentsTurn) {
        // if it is not the user's turn, store this input as a premove
        nvui.premoveInput = input;
        notify(i18n.nvui.premoveRecorded(input));
      } else if (isDrop(move) && isInvalidDrop(move)) notify(`Invalid drop: ${input}`);
      else if (move) sendMove(move, ctrl, !!nvui.premoveInput);
      else notify(`${i18n.nvui.invalidMove}: ${input}`);
    }
    $input.val('');
  };
}

type Command =
  | 'board'
  | 'clock'
  | 'last'
  | 'abort'
  | 'resign'
  | 'draw'
  | 'takeback'
  | 'p'
  | 's'
  | 'opponent'
  | 'pocket';

type InputCommand = {
  cmd: Command;
  help: string | VNode;
  cb: (notify: (txt: string) => void, ctrl: RoundController, style: MoveStyle, input: string) => void;
  alt?: string;
  invalid?: (ctrl: RoundController) => boolean;
};

const inputCommands: InputCommand[] = [
  {
    cmd: 'board',
    help: i18n.nvui.goToBoard,
    cb: (_notify, _ctrl, _style, input) => {
      const words = input.split(' ');
      const file = words[1]?.charAt(0) || 'e';
      const rank = words[1]?.charAt(1) || '4';
      const button = $('button[file="' + file + '"][rank="' + rank + '"]').get(0);
      button?.focus();
    },
    alt: 'b',
  },
  {
    cmd: 'clock',
    help: i18n.keyboardMove.readOutClocks,
    cb: notify => notify($('.nvui .botc').text() + ' - ' + $('.nvui .topc').text()),
    alt: 'c',
  },
  {
    cmd: 'last',
    help: i18n.nvui.announceLastMove,
    cb: notify => notify($('.lastMove').text()),
    alt: 'l',
  },
  { cmd: 'abort', help: i18n.site.abortGame, cb: () => $('.nvui button.abort').trigger('click') },
  { cmd: 'resign', help: i18n.site.resign, cb: () => $('.nvui button.resign').trigger('click') },
  {
    cmd: 'draw',
    help: i18n.keyboardMove.offerOrAcceptDraw,
    cb: () => $('.nvui button.draw-yes').trigger('click'),
  },
  {
    cmd: 'takeback',
    help: i18n.site.proposeATakeback,
    cb: () => $('.nvui button.takeback-yes').trigger('click'),
  },
  {
    cmd: 'p',
    help: commands().piece.help,
    cb: (notify, ctrl, style, input) =>
      notify(
        commands().piece.apply(input, ctrl.chessground.state.pieces, style) ??
          `Bad input: ${input}. Expected format: ${commands().piece.help}`,
      ),
  },
  {
    cmd: 's',
    help: commands().scan.help,
    cb: (notify, ctrl, style, input) =>
      notify(
        commands().scan.apply(input, ctrl.chessground.state.pieces, style) ??
          `Bad input: ${input}. Expected format: ${commands().scan.help}`,
      ),
  },
  {
    cmd: 'opponent',
    help: i18n.keyboardMove.readOutOpponentName,
    cb: (notify, ctrl) => notify(playerText(ctrl)),
    alt: 'o',
  },
  {
    cmd: 'pocket',
    help: 'Read out pockets for white or black. Example: "pocket black"',
    cb: (notify, ctrl, _, input) => {
      const pockets = ctrl.data?.crazyhouse?.pockets;
      const color = input.split(' ')?.[1]?.trim();
      return notify(
        pockets
          ? color
            ? pocketsStr(color === 'white' ? pockets[0] : pockets[1]) || i18n.site.none
            : 'Expected format: pocket [white|black]'
          : 'Command only available in crazyhouse',
      );
    },
    invalid: ctrl => ctrl.data.game.variant.key !== 'crazyhouse',
  },
];

const isInputCommand = (input: string) => {
  const firstWordLowerCase = input.split(' ')[0].toLowerCase();
  return inputCommands.find(c => c.cmd === firstWordLowerCase || c?.alt === firstWordLowerCase);
};

const sendMove = (uciOrDrop: string | DropMove, ctrl: RoundController, premove: boolean): void =>
  typeof uciOrDrop === 'string'
    ? ctrl.socket.send('move', { u: uciOrDrop }, { ackable: true })
    : ctrl.sendNewPiece(uciOrDrop.role, uciOrDrop.key, premove);

function anyClock(ctrl: RoundController, position: TopOrBottom): VNode | undefined {
  const d = ctrl.data,
    player = ctrl.playerAt(position);
  return (
    (ctrl.clock && renderClock(ctrl.clock, player.color, position, _ => [])) ||
    (d.correspondence && renderCorresClock(ctrl.corresClock!, player.color, position, d.game.player))
  );
}

const renderMoves = (steps: Step[], style: MoveStyle) =>
  steps.reduce<(string | VNode)[]>((res, s) => {
    const turn = s.ply & 1 ? `${plyToTurn(s.ply)}.` : '';
    const san = `${renderSan(s.san, s.uci, style)}, `;
    return res.concat(`${turn} ${san}`).concat(s.ply % 2 === 0 ? h('br') : []);
  }, []);

function playerHtml(ctrl: RoundController, player: Player) {
  if (player.ai) return i18n.site.aiNameLevelAiLevel('Stockfish', player.ai);
  const perf = ctrl.data.game.perf,
    user = player.user,
    rating = user?.perfs[perf]?.rating,
    rd = player.ratingDiff,
    ratingDiff = rd ? (rd > 0 ? '+' + rd : rd < 0 ? '−' + -rd : '') : '';
  return user
    ? h('span', [
        h(
          'a',
          { attrs: { href: '/@/' + user.username } },
          user.title ? `${user.title} ${user.username}` : user.username,
        ),
        rating ? ` ${rating}` : ``,
        ' ' + ratingDiff,
      ])
    : i18n.site.anonymous;
}

function playerText(ctrl: RoundController) {
  const player = ctrl.data.opponent;
  if (player.ai) return i18n.site.aiNameLevelAiLevel('Stockfish', player.ai);
  const user = player.user,
    rating = player?.rating ?? user?.perfs[ctrl.data.game.perf]?.rating ?? i18n.site.unknown;
  return !user ? i18n.site.anonymous : `${user.title || ''} ${user.username}. ${i18n.site.rating} ${rating}`;
}

function gameText(ctrl: RoundController) {
  const d = ctrl.data;
  return [
    d.game.status.name === 'started'
      ? ctrl.isPlaying()
        ? i18n.site[ctrl.data.player.color === 'white' ? 'youPlayTheWhitePieces' : 'youPlayTheBlackPieces']
        : 'Spectating.'
      : i18n.site.gameOver,
    i18n.site[ctrl.data.game.rated ? 'rated' : 'casual'],
    d.clock ? `${d.clock.initial / 60} + ${d.clock.increment}` : '',
    transGamePerf(d.game.perf),
    i18n.site.gameVsX(playerText(ctrl)),
  ].join(' ');
}

function doAndRedraw(ctrl: RoundController, f: (ctrl: RoundController) => void) {
  f(ctrl);
  ctrl.redraw();
}

function nextOrPrev(ctrl: RoundController) {
  return (e: KeyboardEvent) => {
    if (e.key === 'A') doAndRedraw(ctrl, prev);
    else if (e.key === 'D') doAndRedraw(ctrl, next);
  };
}

type PageStyle = 'board-actions' | 'actions-board';
function pageSetting(): Setting<PageStyle> {
  return makeSetting<PageStyle>({
    choices: [
      ['actions-board', `${i18n.nvui.actions} ${i18n.site.board}`],
      ['board-actions', `${i18n.site.board} ${i18n.nvui.actions}`],
    ],
    default: 'actions-board',
    storage: storage.make('nvui.pageLayout'),
  });
}

const transGamePerf = (perf: string): string => (i18n.site[perf as keyof typeof i18n.site] as string) || perf;
