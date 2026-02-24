import * as licon from '../licon';
import { bind, hl, type MaybeVNode } from './index';

export function renderBlindfoldToggle(isActive: boolean | undefined | null, disable: () => void): MaybeVNode {
  if (!isActive) return undefined;

  return hl('div#blindfoldzone', [
    hl(
      'a#blindfoldtog.text',
      {
        attrs: { 'data-icon': licon.CautionCircle },
        hook: bind('click', disable),
      },
      i18n.preferences.blindfold,
    ),
  ]);
}
