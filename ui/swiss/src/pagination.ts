import type { MaybeVNodes } from 'lib/view';
import { maxPerPage, myPage, pagerData, renderPager as sharedRenderPager } from 'lib/view/pagination';
import type SwissCtrl from './ctrl';
import type { Pager } from './interfaces';
import * as search from './search';

export { maxPerPage, myPage };

export function renderPager(ctrl: SwissCtrl, pag: Pager): MaybeVNodes {
  return sharedRenderPager(ctrl, pag, search.button(ctrl), search.input(ctrl));
}

export function players(ctrl: SwissCtrl): Pager {
  return pagerData(ctrl) as Pager;
}
