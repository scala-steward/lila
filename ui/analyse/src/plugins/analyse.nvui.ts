import { h, type VNode, type VNodeChildren } from 'snabbdom';
import { defined, prop, type Prop } from 'common';
import { text as xhrText } from 'common/xhr';
import type AnalyseController from '../ctrl';
import { makeConfig as makeCgConfig } from '../ground';
import type { AnalyseData, NvuiPlugin } from '../interfaces';
import type { Player } from 'game';
import {
  type MoveStyle,
  renderSan,
  renderPieces,
  renderBoard,
  renderMainline,
  renderComments,
  styleSetting,
  pieceSetting,
  prefixSetting,
  boardSetting,
  positionSetting,
  boardCommandsHandler,
  selectionHandler,
  arrowKeyHandler,
  positionJumpHandler,
  pieceJumpingHandler,
  castlingFlavours,
  inputToLegalUci,
  lastCapturedCommandHandler,
} from 'nvui/chess';
import { renderSetting } from 'nvui/setting';
import { Notify } from 'nvui/notify';
import { commands, boardCommands } from 'nvui/command';
import { bind, onInsert, type MaybeVNode, type MaybeVNodes } from 'common/snabbdom';
import { throttle } from 'common/timing';
import explorerView from '../explorer/explorerView';
import { ops, path as treePath } from 'tree';
import { view as cevalView, renderEval, type CevalCtrl } from 'ceval';
import { next, prev } from '../control';
import { lichessRules } from 'chessops/compat';
import { makeSan } from 'chessops/san';
import { charToRole, opposite, parseUci } from 'chessops/util';
import { parseFen } from 'chessops/fen';
import { setupPosition } from 'chessops/variant';
import { plyToTurn } from 'chess';
import { Chessground as makeChessground } from 'chessground';
import { pubsub } from 'common/pubsub';
import { renderResult } from '../view/components';
import { view as chapterNewFormView } from '../study/chapterNewForm';
import { view as chapterEditFormView } from '../study/chapterEditForm';

const throttled = (sound: string) => throttle(100, () => site.sound.play(sound));
const selectSound = throttled('select');
const borderSound = throttled('outOfBound');
const errorSound = throttled('error');

export function initModule(ctrl: AnalyseController): NvuiPlugin {
  const notify = new Notify(),
    moveStyle = styleSetting(),
    pieceStyle = pieceSetting(),
    prefixStyle = prefixSetting(),
    positionStyle = positionSetting(),
    boardStyle = boardSetting(),
    analysisInProgress = prop(false);

  pubsub.on('analysis.server.progress', (data: AnalyseData) => {
    if (data.analysis && !data.analysis.partial) notify.set('Server-side analysis complete');
  });

  site.mousetrap.bind('c', () => notify.set(renderEvalAndDepth(ctrl)));

  return {
    render(): VNode {
      notify.redraw = ctrl.redraw;
      const d = ctrl.data,
        style = moveStyle.get();
      ctrl.chessground = makeChessground(document.createElement('div'), {
        ...makeCgConfig(ctrl),
        animation: { enabled: false },
        drawable: { enabled: false },
        coordinates: false,
      });
      return h('main.analyse', [
        h('div.nvui', [
          studyDetails(ctrl),
          h('h1', 'Textual representation'),
          h('h2', 'Game info'),
          ...['white', 'black'].map((color: Color) =>
            h('p', [color + ' player: ', renderPlayer(ctrl, playerByColor(d, color))]),
          ),
          h('p', `${d.game.rated ? 'Rated' : 'Casual'} ${d.game.perf || d.game.variant.name}`),
          d.clock ? h('p', `Clock: ${d.clock.initial / 60} + ${d.clock.increment}`) : null,
          h('h2', 'Moves'),
          h('p.moves', { attrs: { role: 'log', 'aria-live': 'off' } }, renderCurrentLine(ctrl, style)),
          ...(!ctrl.studyPractice
            ? [
                h(
                  'button',
                  {
                    attrs: { 'aria-pressed': `${ctrl.explorer.enabled()}` },
                    hook: bind('click', _ => ctrl.explorer.toggle(), ctrl.redraw),
                  },
                  i18n.site.openingExplorerAndTablebase,
                ),
                explorerView(ctrl),
              ]
            : []),
          h('h2', 'Pieces'),
          h('div.pieces', renderPieces(ctrl.chessground.state.pieces, style)),
          ...renderAriaResult(ctrl),
          h('h2', 'Current position'),
          h(
            'p.position.lastMove',
            { attrs: { 'aria-live': 'assertive', 'aria-atomic': 'true' } },
            // make sure consecutive positions are different so that they get re-read
            renderCurrentNode(ctrl, style) + (ctrl.node.ply % 2 === 0 ? '' : ' '),
          ),
          h('h2', 'Move form'),
          h(
            'form',
            {
              hook: {
                insert(vnode) {
                  const $form = $(vnode.elm as HTMLFormElement),
                    $input = $form.find('.move').val('');
                  $input[0]?.focus();
                  $form.on('submit', onSubmit(ctrl, notify.set, moveStyle.get, $input));
                },
              },
            },
            [
              h('label', [
                'Command input',
                h('input.move.mousetrap', {
                  attrs: { name: 'move', type: 'text', autocomplete: 'off', autofocus: true },
                }),
              ]),
            ],
          ),
          notify.render(),
          h('h2', 'Computer analysis'),
          ...cevalView.renderCeval(ctrl),
          cevalView.renderPvs(ctrl),
          ...(renderAcpl(ctrl, style) || [requestAnalysisButton(ctrl, analysisInProgress, notify.set)]),
          h('h2', 'Board'),
          h(
            'div.board',
            {
              hook: {
                insert: el => {
                  const $board = $(el.elm as HTMLElement);
                  $board.on('keypress', boardCommandsHandler());
                  const $buttons = $board.find('button');
                  const steps = () => ctrl.tree.getNodeList(ctrl.path);
                  const fenSteps = () => steps().map(step => step.fen);
                  const opponentColor = () => (ctrl.node.ply % 2 === 0 ? 'black' : 'white');
                  $buttons.on('click', selectionHandler(opponentColor, selectSound));
                  $buttons.on('keydown', arrowKeyHandler(ctrl.data.player.color, borderSound));
                  $buttons.on(
                    'keypress',
                    lastCapturedCommandHandler(fenSteps, pieceStyle.get(), prefixStyle.get()),
                  );
                  $buttons.on('keypress', positionJumpHandler());
                  $buttons.on('keypress', pieceJumpingHandler(selectSound, errorSound));
                },
              },
            },
            renderBoard(
              ctrl.chessground.state.pieces,
              ctrl.data.game.variant.key === 'racingKings' ? 'white' : ctrl.data.player.color,
              pieceStyle.get(),
              prefixStyle.get(),
              positionStyle.get(),
              boardStyle.get(),
            ),
          ),
          h(
            'div.boardstatus',
            {
              attrs: { 'aria-live': 'polite', 'aria-atomic': 'true' },
            },
            '',
          ),
          h('div.content', {
            hook: {
              insert: vnode => {
                const root = $(vnode.elm as HTMLElement);
                root.append($('.blind-content').removeClass('none'));
                root.find('.copy-pgn').on('click', function (this: HTMLElement) {
                  navigator.clipboard.writeText(this.dataset.pgn!).then(() => {
                    notify.set('PGN copied into clipboard.');
                  });
                });
              },
            },
          }),
          h('h2', 'Settings'),
          h('label', ['Move notation', renderSetting(moveStyle, ctrl.redraw)]),
          h('h3', 'Board settings'),
          h('label', ['Piece style', renderSetting(pieceStyle, ctrl.redraw)]),
          h('label', ['Piece prefix style', renderSetting(prefixStyle, ctrl.redraw)]),
          h('label', ['Show position', renderSetting(positionStyle, ctrl.redraw)]),
          h('label', ['Board layout', renderSetting(boardStyle, ctrl.redraw)]),
          h('h2', 'Keyboard shortcuts'),
          h('p', [
            'Use arrow keys to navigate in the game.',
            h('br'),
            `l: ${i18n.site.toggleLocalAnalysis}`,
            h('br'),
            `z: ${i18n.site.toggleAllAnalysis}`,
            h('br'),
            `space: ${i18n.site.playComputerMove}`,
            h('br'),
            'c: announce computer evaluation',
            h('br'),
            `x: ${i18n.site.showThreat}`,
            h('br'),
          ]),
          ...boardCommands(),
          h('h2', 'Commands'),
          h('p', [
            'Type these commands in the command input.',
            h('br'),
            commands.piece.help,
            h('br'),
            commands.scan.help,
            h('br'),
            "eval: announce last move's computer evaluation",
            h('br'),
            'best: announce the top engine move',
            h('br'),
            'prev: return to the previous move',
            h('br'),
            'next: go to the next move',
            h('br'),
            'prev line: switch to the previous variation',
            h('br'),
            'next line: switch to the next variation',
          ]),
        ]),
      ]);
    },
  };
}

function renderEvalAndDepth(ctrl: AnalyseController): string {
  if (ctrl.threatMode()) return `${evalInfo(ctrl.node.threat)} ${depthInfo(ctrl.node.threat, false)}`;
  const evs = ctrl.currentEvals(),
    bestEv = cevalView.getBestEval(evs);
  const evalStr = evalInfo(bestEv);
  return !evalStr ? noEvalStr(ctrl.ceval) : `${evalStr} ${depthInfo(evs.client, !!evs.client?.cloud)}`;
}

const evalInfo = (bestEv: EvalScore | undefined): string =>
  defined(bestEv?.cp)
    ? renderEval(bestEv.cp).replace('-', '−')
    : defined(bestEv?.mate)
      ? `mate in ${Math.abs(bestEv.mate)} for ${bestEv.mate > 0 ? 'white' : 'black'}`
      : '';

const depthInfo = (clientEv: Tree.ClientEval | undefined, isCloud: boolean): string =>
  clientEv ? `${i18n.site.depthX(clientEv.depth || 0)} ${isCloud ? 'Cloud' : ''}` : '';

const noEvalStr = (ctrl: CevalCtrl) =>
  !ctrl.allowed()
    ? 'local evaluation not allowed'
    : !ctrl.possible
      ? 'local evaluation not possible'
      : !ctrl.enabled()
        ? 'local evaluation not enabled'
        : '';

function renderBestMove(ctrl: AnalyseController, style: MoveStyle): string {
  const noEvalMsg = noEvalStr(ctrl.ceval);
  if (noEvalMsg) return noEvalMsg;
  const node = ctrl.node,
    setup = parseFen(node.fen).unwrap();
  let pvs: Tree.PvData[] = [];
  if (ctrl.threatMode() && node.threat) {
    pvs = node.threat.pvs;
    setup.turn = opposite(setup.turn);
    if (setup.turn === 'white') setup.fullmoves += 1;
  } else if (node.ceval) pvs = node.ceval.pvs;
  const pos = setupPosition(lichessRules(ctrl.ceval.opts.variant.key), setup);
  if (pos.isOk && pvs.length > 0 && pvs[0].moves.length > 0) {
    const uci = pvs[0].moves[0];
    const san = makeSan(pos.unwrap(), parseUci(uci)!);
    return renderSan(san, uci, style);
  }
  return '';
}

function renderAriaResult(ctrl: AnalyseController): VNode[] {
  const result = renderResult(ctrl);
  const res = result.length ? result : 'No result';
  return [
    h('h2', 'Game status'),
    h('div.status', { attrs: { role: 'status', 'aria-live': 'assertive', 'aria-atomic': 'true' } }, res),
  ];
}

function renderCurrentLine(ctrl: AnalyseController, style: MoveStyle): VNodeChildren {
  if (ctrl.path.length === 0) {
    return renderMainline(ctrl.mainline, ctrl.path, style);
  } else {
    const futureNodes = ctrl.node.children.length > 0 ? ops.mainlineNodeList(ctrl.node.children[0]) : [];
    return renderMainline(ctrl.nodeList.concat(futureNodes), ctrl.path, style);
  }
}

function onSubmit(
  ctrl: AnalyseController,
  notify: (txt: string) => void,
  style: () => MoveStyle,
  $input: Cash,
) {
  return (e: SubmitEvent) => {
    e.preventDefault();
    let input = castlingFlavours(($input.val() as string).trim());
    if (isShortCommand(input)) input = '/' + input;
    if (input[0] === '/') onCommand(ctrl, notify, input.slice(1), style());
    else {
      const uci = inputToLegalUci(input, ctrl.node.fen, ctrl.chessground);
      if (uci)
        ctrl.sendMove(uci.slice(0, 2) as Key, uci.slice(2, 4) as Key, undefined, charToRole(uci.slice(4)));
      else notify('Invalid command');
    }
    $input.val('');
  };
}

const isShortCommand = (input: string) =>
  ['p', 's', 'next', 'prev', 'eval', 'best'].includes(input.split(' ')[0].toLowerCase());

function onCommand(ctrl: AnalyseController, notify: (txt: string) => void, c: string, style: MoveStyle) {
  const lowered = c.toLowerCase();
  const doAndRedraw = (fn: (ctrl: AnalyseController) => void): void => {
    fn(ctrl);
    ctrl.redraw();
  };
  if (lowered === 'next') doAndRedraw(next);
  else if (lowered === 'prev') doAndRedraw(prev);
  else if (lowered === 'next line') doAndRedraw(jumpNextLine);
  else if (lowered === 'prev line') doAndRedraw(jumpPrevLine);
  else if (lowered === 'eval') notify(renderEvalAndDepth(ctrl));
  else if (lowered === 'best') notify(renderBestMove(ctrl, style));
  else {
    const pieces = ctrl.chessground.state.pieces;
    notify(
      commands.piece.apply(c, pieces, style) ||
        commands.scan.apply(c, pieces, style) ||
        `Invalid command: ${c}`,
    );
  }
}

function renderAcpl(ctrl: AnalyseController, style: MoveStyle): MaybeVNodes | undefined {
  const anal = ctrl.data.analysis; // heh
  if (!anal) return undefined;
  const analysisGlyphs = ['?!', '?', '??'];
  const analysisNodes = ctrl.mainline.filter(n => n.glyphs?.find(g => analysisGlyphs.includes(g.symbol)));
  const res: Array<VNode> = [];
  ['white', 'black'].forEach((color: Color) => {
    res.push(h('h3', `${color} player: ${anal[color].acpl} ACPL`));
    res.push(
      h(
        'select',
        {
          hook: bind(
            'change',
            e => ctrl.jumpToMain(parseInt((e.target as HTMLSelectElement).value)),
            ctrl.redraw,
          ),
        },
        analysisNodes
          .filter(n => (n.ply % 2 === 1) === (color === 'white'))
          .map(node =>
            h(
              'option',
              { attrs: { value: node.ply, selected: node.ply === ctrl.node.ply } },
              [plyToTurn(node.ply), renderSan(node.san!, node.uci, style), renderComments(node, style)].join(
                ' ',
              ),
            ),
          ),
      ),
    );
  });
  return res;
}

const requestAnalysisButton = (
  ctrl: AnalyseController,
  inProgress: Prop<boolean>,
  notify: (msg: string) => void,
): MaybeVNode =>
  ctrl.ongoing || ctrl.synthetic
    ? undefined
    : inProgress()
      ? h('p', 'Server-side analysis in progress')
      : h(
          'button',
          {
            hook: bind('click', _ =>
              xhrText(`/${ctrl.data.game.id}/request-analysis`, { method: 'post' }).then(
                () => {
                  inProgress(true);
                  notify('Server-side analysis in progress');
                },
                () => notify('Cannot run server-side analysis'),
              ),
            ),
          },
          i18n.site.requestAComputerAnalysis,
        );

function currentLineIndex(ctrl: AnalyseController): { i: number; of: number } {
  if (ctrl.path === treePath.root) return { i: 1, of: 1 };
  const prevNode = ctrl.tree.nodeAtPath(treePath.init(ctrl.path));
  return {
    i: prevNode.children.findIndex(node => node.id === ctrl.node.id),
    of: prevNode.children.length,
  };
}

function renderLineIndex(ctrl: AnalyseController): string {
  const { i, of } = currentLineIndex(ctrl);
  return of > 1 ? `, line ${i + 1} of ${of} ,` : '';
}

function renderCurrentNode(ctrl: AnalyseController, style: MoveStyle): string {
  const node = ctrl.node;
  if (!node.san || !node.uci) return 'Initial position';
  return [
    plyToTurn(node.ply),
    renderSan(node.san, node.uci, style),
    renderLineIndex(ctrl),
    renderComments(node, style),
  ]
    .join(' ')
    .trim();
}

const renderPlayer = (ctrl: AnalyseController, player: Player): VNodeChildren =>
  player.ai ? i18n.site.aiNameLevelAiLevel('Stockfish', player.ai) : userHtml(ctrl, player);

function userHtml(ctrl: AnalyseController, player: Player) {
  const d = ctrl.data,
    user = player.user,
    perf = user ? user.perfs[d.game.perf] : null,
    rating = player.rating ? player.rating : perf && perf.rating,
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
    : 'Anonymous';
}

const playerByColor = (d: AnalyseData, color: Color): Player =>
  color === d.player.color ? d.player : d.opponent;

const jumpNextLine = (ctrl: AnalyseController) => jumpLine(ctrl, 1);
const jumpPrevLine = (ctrl: AnalyseController) => jumpLine(ctrl, -1);

function jumpLine(ctrl: AnalyseController, delta: number) {
  const { i, of } = currentLineIndex(ctrl);
  if (of === 1) return;
  const newI = (i + delta + of) % of;
  const prevPath = treePath.init(ctrl.path);
  const prevNode = ctrl.tree.nodeAtPath(prevPath);
  const newPath = prevPath + prevNode.children[newI].id;
  ctrl.userJumpIfCan(newPath);
}

function studyDetails(ctrl: AnalyseController): MaybeVNode {
  const study = ctrl.study;
  const onInsertHandler = (callback: () => void, el: HTMLElement) => {
    el.addEventListener('click', callback);
    el.addEventListener('keydown', ev => ev.key === 'Enter' && callback());
  };

  return (
    study &&
    h('div.study-details', [
      h('h2', 'Study details'),
      h('span', `Title: ${study.data.name}. By: ${study.data.ownerId}`),
      h('br'),
      h('label.chapters', [
        h('h2', 'Current chapter:'),
        h(
          'select',
          {
            hook: bind('change', (e: InputEvent) => {
              const target = e.target as HTMLSelectElement;
              const selectedOption = target.options[target.selectedIndex];
              const chapterId = selectedOption.getAttribute('chapterId');
              study.setChapter(chapterId!);
            }),
          },
          study.chapters.list.all().map((ch, i) =>
            h(
              'option',
              {
                attrs: {
                  selected: ch.id === study.currentChapter().id,
                  chapterId: ch.id,
                },
              },
              `${i + 1}. ${ch.name}`,
            ),
          ),
        ),
        study.members.canContribute()
          ? h('div.buttons', [
              h(
                'button',
                {
                  hook: onInsert((el: HTMLButtonElement) => {
                    const toggle = () => {
                      study.chapters.editForm.toggle(study.currentChapter());
                      ctrl.redraw();
                    };
                    onInsertHandler(toggle, el);
                  }),
                },
                [
                  'Edit current chapter',
                  study.chapters.editForm.current() && chapterEditFormView(study.chapters.editForm),
                ],
              ),
              h(
                'button',
                {
                  hook: onInsert((el: HTMLButtonElement) => {
                    const toggle = () => {
                      study.chapters.newForm.toggle();
                      ctrl.redraw();
                    };
                    onInsertHandler(toggle, el);
                  }),
                },
                [
                  'Add new chapter',
                  study.chapters.newForm.isOpen() ? chapterNewFormView(study.chapters.newForm) : undefined,
                ],
              ),
            ])
          : undefined,
      ]),
    ])
  );
}
