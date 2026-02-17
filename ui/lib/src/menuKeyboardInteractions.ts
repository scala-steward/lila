export default function (): void {
  if ('ontouchstart' in window) return;

  const $el = $('#topnav');

  const handleKeyDown = (ev: KeyboardEvent) => {
    ev.stopPropagation();

    const target = ev.target as HTMLElement | null;
    const $parent = $(target).parent().is('section') ? $(target).parent() : $(target).parent().parent();

    if (ev.code === 'Tab') {
      if ($(target).is(':last-child')) {
        $parent.removeClass('active');
        return;
      } else if ($parent.hasClass('active')) {
        return;
      }
    }

    if (ev.code === 'Space') {
      $parent.toggleClass('active');
      ev.preventDefault();
    } else {
      $parent.removeClass('active');
    }
  };

  const handleFocusOut = (ev: FocusEvent) => {
    const focusTarget = ev.relatedTarget as HTMLElement | null;
    const hasFocus = focusTarget && ($el[0] === focusTarget || $el[0]?.contains(focusTarget));

    if (!hasFocus) {
      $el.find('section.active').removeClass('active');
    }
  };

  const handleSwitchToMouse = (_: MouseEvent) => {
    $el.find('section.active').removeClass('active');
  };

  $el.on('keydown', handleKeyDown).on('focusout', handleFocusOut).on('mouseover', handleSwitchToMouse);
}
