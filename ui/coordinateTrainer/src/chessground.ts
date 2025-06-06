import { h, type VNode } from 'snabbdom';
import type { Elements } from '@lichess-org/chessground/types';
import resizeHandle from 'lib/chessgroundResize';
import type CoordinateTrainerCtrl from './ctrl';
import { Chessground as makeChessground } from '@lichess-org/chessground';
import { pubsub } from 'lib/pubsub';

export default function (ctrl: CoordinateTrainerCtrl): VNode {
  return h('div.cg-wrap', {
    hook: {
      insert: vnode => {
        const el = vnode.elm as HTMLElement;
        ctrl.chessground = makeChessground(el, makeConfig(ctrl));
        pubsub.on('board.change', (is3d: boolean) => {
          ctrl.chessground!.state.addPieceZIndex = is3d;
          ctrl.chessground!.redrawAll();
        });
      },
      destroy: () => ctrl.chessground!.destroy(),
    },
  });
}

function makeConfig(ctrl: CoordinateTrainerCtrl): CgConfig {
  return {
    fen: ctrl.boardFEN(),
    orientation: ctrl.orientation,
    blockTouchScroll: true,
    coordinates: ctrl.showCoordinates(),
    coordinatesOnSquares: ctrl.showCoordsOnAllSquares(),
    addPieceZIndex: ctrl.config.is3d,
    movable: { free: false, color: undefined },
    drawable: { enabled: false },
    draggable: { enabled: false },
    selectable: { enabled: false },
    events: {
      insert(elements: Elements) {
        resizeHandle(elements, ctrl.config.resizePref, ctrl.playing ? 2 : 0);
      },
      select: ctrl.onChessgroundSelect,
    },
  };
}
