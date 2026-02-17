import type { MaybeVNodes } from 'lib/view';
import { maxPerPage, myPage, pagerData, renderPager as sharedRenderPager } from 'lib/view/pagination';
import type TournamentController from './ctrl';
import type { Pagination } from './interfaces';
import * as search from './search';

export { maxPerPage, myPage };

export function renderPager(ctrl: TournamentController, pag: Pagination): MaybeVNodes {
  return sharedRenderPager(ctrl, pag, search.button(ctrl), search.input(ctrl));
}

export function players(ctrl: TournamentController): Pagination {
  return pagerData(ctrl);
}
