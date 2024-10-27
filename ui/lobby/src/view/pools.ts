import { h, Hooks, VNode } from 'snabbdom';
import { spinnerVdom as spinner } from 'common/spinner';
import LobbyController from '../ctrl';

const createHandler = (ctrl: LobbyController) => (e: Event) => {
  if (ctrl.redirecting) return;

  if (e instanceof KeyboardEvent) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault(); // Prevent page scroll on space
  }

  const id =
    (e.target as HTMLElement).dataset['id'] ||
    ((e.target as HTMLElement).parentNode as HTMLElement).dataset['id'];
  if (id === 'custom') ctrl.setupCtrl.openModal('hook');
  else if (id) ctrl.clickPool(id);

  ctrl.redraw();
};

export const hooks = (ctrl: LobbyController): Hooks => {
  const handler = createHandler(ctrl);
  return {
    insert: (vnode: VNode) => {
      const el = vnode.elm as HTMLElement;
      el.addEventListener('click', handler);
      el.addEventListener('keydown', handler);
    },
    destroy: (vnode: VNode) => {
      const el = vnode.elm as HTMLElement;
      el.removeEventListener('click', handler);
      el.removeEventListener('keydown', handler);
    },
  };
};

export function render(ctrl: LobbyController) {
  const member = ctrl.poolMember;
  return ctrl.pools
    .map(pool => {
      const active = member?.id === pool.id,
        transp = !!member && !active;
      return h(
        'div',
        {
          class: { active, transp },
          attrs: { role: 'button', 'data-id': pool.id, tabindex: '0' },
        },
        [
          h('div.clock', `${pool.lim}+${pool.inc}`),
          active && member.range && ctrl.opts.showRatings
            ? h('div.range', member.range.replace('-', '–'))
            : h('div.perf', pool.perf),
          active ? spinner() : null,
        ],
      );
    })
    .concat(
      h(
        'div.custom',
        {
          class: { transp: !!member },
          attrs: { role: 'button', 'data-id': 'custom', tabindex: '0' },
        },
        i18n.site.custom,
      ),
    );
}
