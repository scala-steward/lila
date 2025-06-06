import { h } from 'snabbdom';
import { spinnerVdom } from 'lib/view/controls';
import type LobbyController from '../../../ctrl';
import { colors, variantsWhereWhiteIsBetter } from '../../../options';
import { option } from './option';

const renderBlindModeColorPicker = (ctrl: LobbyController) => [
  ...(ctrl.setupCtrl.gameType === 'hook'
    ? []
    : [
        h('label', { attrs: { for: 'sf_color' } }, i18n.site.side),
        h(
          'select#sf_color',
          {
            on: {
              change: (e: Event) =>
                ctrl.setupCtrl.blindModeColor((e.target as HTMLSelectElement).value as Color | 'random'),
            },
          },
          colors.map(color => option(color, ctrl.setupCtrl.blindModeColor())),
        ),
      ]),
  h(
    'button',
    { on: { click: () => ctrl.setupCtrl.submit(ctrl.setupCtrl.blindModeColor()) } },
    i18n.site.createTheGame,
  ),
];

export const createButtons = (ctrl: LobbyController) => {
  const { setupCtrl } = ctrl;

  const enabledColors: (Color | 'random')[] = [];
  if (setupCtrl.valid()) {
    enabledColors.push('random');

    const randomColorOnly =
      setupCtrl.gameType === 'hook' ||
      (setupCtrl.gameType !== 'ai' &&
        setupCtrl.gameMode() === 'rated' &&
        variantsWhereWhiteIsBetter.includes(setupCtrl.variant()));
    if (!randomColorOnly) enabledColors.push('white', 'black');
  }

  return h(
    'div.color-submits',
    site.blindMode
      ? renderBlindModeColorPicker(ctrl)
      : setupCtrl.loading
        ? spinnerVdom()
        : colors.map(({ key, name }) =>
            h(
              `button.button.button-metal.color-submits__button.${key}`,
              {
                attrs: { disabled: !enabledColors.includes(key), title: name, value: key },
                on: { click: () => setupCtrl.submit(key) },
              },
              h('i'),
            ),
          ),
  );
};
