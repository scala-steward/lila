import { looseH as h } from 'common/snabbdom';
import { clockIsRunning, formatMs } from 'common/clock';
import { ChapterPreview, isChapterPreview } from '../interfaces';
import { StudyCtrl } from '../studyDeps';
import RelayCtrl from './relayCtrl';
import { gameLinkProps } from './relayTourView';
import { userTitle } from 'common/userLink';
import { computeTimeLeft } from '../multiBoard';
import { fenColor } from 'common/miniBoard';
import { defined, scrollToInnerSelector } from 'common';

export const gamesList = (study: StudyCtrl, relay: RelayCtrl) => {
  const chapters = study.chapters.list().filter(isChapterPreview);
  return h(
    'div.relay-games',
    {
      hook: {
        insert(vnode) {
          vnode.data!.current = null;
          // (vnode.elm as HTMLElement).addEventListener('click', e => {
          //   const target = e.target as HTMLElement;
          //   const id =
          //     (target.parentNode as HTMLElement).getAttribute('data-id') || target.getAttribute('data-id');
          // }
        },
        postpatch(old, vnode) {
          const currentId = study.data.chapter.id;
          if (old.data!.current !== currentId) {
            scrollToInnerSelector(vnode.elm as HTMLElement, '.relay-game--current');
          }
          vnode.data!.current = currentId;
        },
      },
    },
    chapters.length == 1 && chapters[0].name == 'Chapter 1'
      ? []
      : chapters.map(c => {
          const players = c.players || {
            white: { name: 'Unknown player' },
            black: { name: 'Unknown player' },
          };
          const status =
            !c.status || c.status == '*' ? renderClocks(c) : [c.status.slice(0, 1), c.status.slice(2, 3)];
          return h(
            `a.relay-game.relay-game--${c.id}`,
            {
              ...gameLinkProps(relay.roundPath, study.setChapter, c),
              class: { 'relay-game--current': c.id === study.data.chapter.id },
            },
            [
              h('span.relay-game__gauge', [
                h('span.relay-game__gauge__black', {
                  hook: {
                    postpatch() {
                      // do the magic here, like in multiboard.ts
                    },
                  },
                }),
                h('tick'),
              ]),
              h(
                'span.relay-game__players',
                [players.white, players.black].map((p, i) => {
                  const s = status[i];
                  return h('span.relay-game__player', [
                    h('player', [userTitle(p), p.name]),
                    h(s == '1' ? 'good' : s == '0' ? 'bad' : 'status', [s]),
                  ]);
                }),
              ),
            ],
          );
        }),
  );
};

const renderClocks = (chapter: ChapterPreview) => {
  const turnColor = fenColor(chapter.fen);
  return ['white', 'black'].map((color: Color) => {
    const timeleft = computeTimeLeft(chapter, color);
    const ticking = turnColor == color && clockIsRunning(chapter.fen, color);
    return defined(timeleft) ? renderClock(timeleft, ticking) : '*';
  });
};

export const renderClock = (time: number, ticking: boolean) =>
  h('span.mini-game__clock.mini-game__clock', { class: { 'clock--run': ticking } }, formatMs(time * 1000));
