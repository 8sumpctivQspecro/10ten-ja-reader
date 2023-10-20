/// <reference path="../common/constants.d.ts" />
import Bugsnag from '@birchill/bugsnag-zero';
import { h, render } from 'preact';
import browser from 'webextension-polyfill';

import { CopyKeys, CopyNextKeyStrings } from '../common/copy-keys';
import { Config, DEFAULT_KEY_SETTINGS } from '../common/config';
import {
  AccentDisplay,
  FontSize,
  PartOfSpeechDisplay,
  TabDisplay,
} from '../common/content-config-params';
import { dbLanguageMeta, isDbLanguageId } from '../common/db-languages';
import { renderStar } from '../content/popup/icons';
import { startBugsnag } from '../utils/bugsnag';
import { html } from '../utils/builder';
import { isTouchDevice, possiblyHasPhysicalKeyboard } from '../utils/device';
import { empty } from '../utils/dom-utils';
import {
  isChromium,
  isEdge,
  isFenix,
  isFirefox,
  isMac,
  isSafari,
} from '../utils/ua-utils';
import { getThemeClass } from '../utils/themes';

import { Command, CommandParams, isValidKey } from './commands';
import { translateDoc } from './l10n';
import { OptionsPage } from './OptionsPage';

import './options.css';

startBugsnag();

const config = new Config();

function completeForm() {
  // UA-specific styles

  // We only add the 'firefox' class on desktop Firefox since Fenix doesn't
  // include browser styles.
  if (isFirefox() && !isFenix()) {
    document.documentElement.classList.add('firefox');
  }
  if (isChromium()) {
    document.documentElement.classList.add('chromium');
  }
  if (isEdge()) {
    document.documentElement.classList.add('edge');
  }
  if (isSafari()) {
    document.documentElement.classList.add('safari');
  }
  if (possiblyHasPhysicalKeyboard()) {
    document.documentElement.classList.add('has-keyboard');
  }
  if (isTouchDevice()) {
    document.documentElement.classList.add('has-touch');
  }

  // Pop-up
  renderPopupStyleSelect();
  setTabDisplayTheme(config.popupStyle);
  // Refresh the theme used in the tab preview if the dark mode setting changes
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => {
      setTabDisplayTheme(config.popupStyle);
    });

  // Keyboard
  configureCommands();
  configureHoldToShowKeys();
  addPopupKeys();
  translateKeys();

  // Puck
  configurePuckSettings();

  // Language
  fillInLanguages();

  // l10n
  translateDoc();

  // Auto-expire new badges
  expireNewBadges();

  document
    .getElementById('highlightText')!
    .addEventListener('click', (event) => {
      config.noTextHighlight = !(event.target as HTMLInputElement).checked;
    });

  const highlightStyleOptions = Array.from(
    document.querySelectorAll('input[type=radio][name=highlightStyle]')
  );
  for (const option of highlightStyleOptions) {
    option.addEventListener('change', (event) => {
      const highlightStyle = (event.target as HTMLInputElement).value as
        | 'none'
        | 'yellow'
        | 'blue';
      if (highlightStyle === 'none') {
        config.noTextHighlight = true;
      } else {
        config.highlightStyle = highlightStyle;
        config.noTextHighlight = false;
      }
    });

    const container = document.getElementById('container')!;
    render(h(OptionsPage, { config }), container);
  }

  document
    .getElementById('contextMenuEnable')!
    .addEventListener('click', (event) => {
      config.contextMenuEnable = (event.target as HTMLInputElement).checked;
    });

  const toolbarIconOptions = Array.from(
    document.querySelectorAll('input[type=radio][name=toolbarIcon]')
  );
  for (const option of toolbarIconOptions) {
    option.addEventListener('change', (event) => {
      const toolbarIcon = (event.target as HTMLInputElement).value as
        | 'default'
        | 'sky';
      config.toolbarIcon = toolbarIcon;
    });
  }

  document
    .getElementById('showPriority')!
    .addEventListener('click', (event) => {
      config.showPriority = (event.target as HTMLInputElement).checked;
      renderPopupStyleSelect();
    });

  document
    .getElementById('showWaniKaniLevel')!
    .addEventListener('click', (event) => {
      config.waniKaniVocabDisplay = (event.target as HTMLInputElement).checked
        ? 'show-matches'
        : 'hide';
      renderPopupStyleSelect();
    });

  document.getElementById('showRomaji')!.addEventListener('click', (event) => {
    config.showRomaji = (event.target as HTMLInputElement).checked;
    renderPopupStyleSelect();
  });

  document
    .getElementById('showDefinitions')!
    .addEventListener('click', (event) => {
      config.readingOnly = !(event.target as HTMLInputElement).checked;
      renderPopupStyleSelect();
    });

  document
    .getElementById('accentDisplay')!
    .addEventListener('input', (event) => {
      config.accentDisplay = (event.target as HTMLSelectElement)
        .value as AccentDisplay;
      renderPopupStyleSelect();
    });

  document.getElementById('posDisplay')!.addEventListener('input', (event) => {
    config.posDisplay = (event.target as HTMLSelectElement)
      .value as PartOfSpeechDisplay;
    renderPopupStyleSelect();
  });

  document.getElementById('fontSize')!.addEventListener('input', (event) => {
    config.fontSize = (event.target as HTMLSelectElement).value as FontSize;
    renderPopupStyleSelect();
  });

  document.getElementById('expandWords')!.addEventListener('click', (event) => {
    config.toggleAutoExpand(
      'words',
      (event.target as HTMLInputElement).checked
    );
  });
  document.getElementById('expandKanji')!.addEventListener('click', (event) => {
    config.toggleAutoExpand(
      'kanji',
      (event.target as HTMLInputElement).checked
    );
  });

  const mouseInteractivityOptions = Array.from(
    document.querySelectorAll('input[type=radio][name=mouseInteractivity]')
  );
  for (const option of mouseInteractivityOptions) {
    option.addEventListener('change', (event) => {
      const popupInteractive = (event.target as HTMLInputElement).value;
      config.popupInteractive = popupInteractive === 'enable';
    });
  }

  document
    .getElementById('enableTapLookup')!
    .addEventListener('click', (event) => {
      config.enableTapLookup = (event.target as HTMLInputElement).checked;
    });

  const tabDisplayOptions = Array.from(
    document.querySelectorAll('input[type=radio][name=tabDisplay]')
  );
  for (const option of tabDisplayOptions) {
    option.addEventListener('change', (event) => {
      const tabDisplay = (event.target as HTMLInputElement).value as TabDisplay;
      config.tabDisplay = tabDisplay;
    });
  }

  document.getElementById('fxCurrency')!.addEventListener('input', (event) => {
    config.fxCurrency = (event.target as HTMLSelectElement).value;
  });
}

function renderPopupStyleSelect() {
  const popupStyleSelect = document.getElementById('popupstyle-select')!;
  empty(popupStyleSelect);
  const themes = ['default', 'light', 'blue', 'lightblue', 'black', 'yellow'];

  for (const theme of themes) {
    const input = html('input', {
      type: 'radio',
      name: 'popupStyle',
      value: theme,
      id: `popupstyle-${theme}`,
    });
    popupStyleSelect.appendChild(input);

    input.addEventListener('click', () => {
      config.popupStyle = theme;
      setTabDisplayTheme(theme);
    });

    const label = html('label', { for: `popupstyle-${theme}` });
    popupStyleSelect.appendChild(label);

    // The default theme alternates between light and dark so we need to
    // generate two popup previews and overlay them.
    if (theme === 'default') {
      label.appendChild(
        html(
          'div',
          { class: 'overlay' },
          renderPopupPreview('light'),
          renderPopupPreview('black')
        )
      );
    } else {
      label.appendChild(renderPopupPreview(theme));
    }
  }
}

function renderPopupPreview(theme: string): HTMLElement {
  const popupPreview = html('div', {
    class: `popup-preview window theme-${theme}`,
  });
  if (config.fontSize !== 'normal') {
    popupPreview.classList.add(`font-${config.fontSize}`);
  }

  const entry = html('div', { class: 'entry' });
  popupPreview.appendChild(entry);

  const headingDiv = html('div', {});
  entry.append(headingDiv);

  const spanKanji = html('span', { class: 'w-kanji' }, '理解');
  if (config.showPriority) {
    spanKanji.append(renderStar('full'));
  }
  if (config.waniKaniVocabDisplay === 'show-matches') {
    spanKanji.appendChild(html('span', { class: 'wk-level' }, '21'));
  }
  headingDiv.appendChild(spanKanji);

  const spanKana = html('span', { class: 'w-kana' });

  switch (config.accentDisplay) {
    case 'downstep':
      spanKana.textContent = 'りꜜかい';
      break;

    case 'binary':
    case 'binary-hi-contrast':
      {
        spanKana.append(
          html(
            'span',
            {
              class: `w-binary${
                config.accentDisplay === 'binary-hi-contrast'
                  ? ' -hi-contrast'
                  : ''
              }`,
            },
            html('span', { class: 'h-l' }, 'り'),
            html('span', { class: 'l' }, 'かい')
          )
        );
      }
      break;

    case 'none':
      spanKana.textContent = 'りかい';
      break;
  }

  if (config.showPriority) {
    spanKana.append(renderStar('full'));
  }
  headingDiv.appendChild(spanKana);

  if (config.showRomaji) {
    headingDiv.appendChild(html('span', { class: 'w-romaji' }, 'rikai'));
  }

  if (!config.readingOnly) {
    const spanDef = html('span', { class: 'w-def' });

    if (config.posDisplay !== 'none') {
      const posSpan = html('span', { class: 'w-pos tag' });
      switch (config.posDisplay) {
        case 'expl':
          posSpan.append(
            ['n', 'vs']
              .map((pos) => browser.i18n.getMessage(`pos_label_${pos}`) || pos)
              .join(', ')
          );
          break;

        case 'code':
          posSpan.append('n, vs');
          break;
      }
      spanDef.append(posSpan);
    }

    spanDef.append('\u200bunderstanding');

    entry.appendChild(spanDef);
  }

  return popupPreview;
}

function setTabDisplayTheme(theme: string) {
  const tabIcons = Array.from(
    document.querySelectorAll(
      '.interactivity-select .icon .svg, .tabdisplay-select .icon .svg'
    )
  );

  const themeClass = getThemeClass(theme);
  for (const tabIcon of tabIcons) {
    for (const className of tabIcon.classList.values()) {
      if (className.startsWith('theme-')) {
        tabIcon.classList.remove(className);
      }
    }
    tabIcon.classList.add(themeClass);
  }
}

function renderCurrencyList(
  selectedCurrency: string,
  currencies: Array<string> | undefined
) {
  const heading = document.querySelector<HTMLDivElement>('.currency-heading')!;
  const body = document.querySelector<HTMLDivElement>('.currency-body')!;

  if (!currencies || !currencies.length) {
    heading.style.display = 'none';
    body.style.display = 'none';
    return;
  }

  heading.style.display = 'revert';
  body.style.display = 'revert';

  // Drop all the existing currencies since the set of currencies may have
  // changed
  const fxCurrency = document.getElementById('fxCurrency') as HTMLSelectElement;
  while (fxCurrency.options.length) {
    fxCurrency.options.remove(0);
  }

  // Re-add them
  const currencyNames = Intl.DisplayNames
    ? new Intl.DisplayNames(['en'], { type: 'currency' })
    : undefined;
  const options = ['none', ...currencies];
  for (const currency of options) {
    let label: string;
    if (currency === 'none') {
      label = browser.i18n.getMessage('options_currency_none_label');
    } else {
      label = currencyNames
        ? `${currency} - ${currencyNames.of(currency)}`
        : currency;
    }
    fxCurrency.options.add(new Option(label, currency));
  }
  fxCurrency.value = selectedCurrency;
}

function configureCommands() {
  // Disable any controls associated with configuring browser.commands if the
  // necessary APIs are not available.
  const canConfigureCommands =
    browser.commands &&
    typeof browser.commands.update === 'function' &&
    typeof browser.commands.reset === 'function';

  const browserCommandControls =
    document.querySelectorAll('.key.command input');
  for (const control of browserCommandControls) {
    (control as HTMLInputElement).disabled = !canConfigureCommands;
  }

  const explanationBlock = document.getElementById(
    'browser-commands-alternative'
  ) as HTMLDivElement;
  explanationBlock.style.display = canConfigureCommands ? 'none' : 'revert';

  if (!canConfigureCommands) {
    if (isEdge()) {
      explanationBlock.textContent = browser.i18n.getMessage(
        'options_browser_commands_no_toggle_key_edge'
      );
    } else if (isChromium()) {
      explanationBlock.textContent = browser.i18n.getMessage(
        'options_browser_commands_no_toggle_key_chrome'
      );
    } else {
      explanationBlock.textContent = browser.i18n.getMessage(
        'options_browser_commands_no_toggle_key'
      );
    }
    return;
  }

  const getFormToggleKeyValue = (): Command => {
    const getControl = (part: string): HTMLInputElement | null => {
      return document.getElementById(
        `toggle-${part}`
      ) as HTMLInputElement | null;
    };

    const params: CommandParams = {
      alt: getControl('alt')?.checked,
      ctrl: getControl('ctrl')?.checked,
      macCtrl: getControl('macctrl')?.checked,
      shift: getControl('shift')?.checked,
      key: getControl('key')?.value || '',
    };

    return Command.fromParams(params);
  };

  const updateToggleKey = async () => {
    try {
      const shortcut = getFormToggleKeyValue();
      await browser.commands.update({
        name: __MV3__ ? '_execute_action' : '_execute_browser_action',
        shortcut: shortcut.toString(),
      });
      setToggleKeyWarningState('ok');
    } catch (e) {
      setToggleKeyWarningState('error', e.message);
    }
  };

  const toggleKeyCheckboxes = document.querySelectorAll(
    '.command input[type=checkbox][id^=toggle-]'
  );
  for (const checkbox of toggleKeyCheckboxes) {
    checkbox.addEventListener('click', updateToggleKey);
  }

  const toggleKeyTextbox = document.getElementById(
    'toggle-key'
  ) as HTMLInputElement;
  toggleKeyTextbox.addEventListener('keydown', (event) => {
    let key = event.key;
    if (event.key.length === 1) {
      key = key.toUpperCase();
    }

    if (!isValidKey(key)) {
      // Most printable keys are one character in length so make sure we don't
      // allow the default action of adding them to the text input. For other
      // keys we don't handle though (e.g. Tab) we probably want to allow the
      // default action.
      if (event.key.length === 1) {
        event.preventDefault();
      }
      return;
    }

    toggleKeyTextbox.value = key;
    event.preventDefault();
    void updateToggleKey();
  });

  toggleKeyTextbox.addEventListener('compositionstart', () => {
    toggleKeyTextbox.value = '';
  });
  toggleKeyTextbox.addEventListener('compositionend', () => {
    toggleKeyTextbox.value = toggleKeyTextbox.value.toUpperCase();
    void updateToggleKey();
  });
}

type WarningState = 'ok' | 'warning' | 'error';

function setToggleKeyWarningState(state: WarningState, message?: string) {
  const icon = document.getElementById('toggle-key-icon')!;
  icon.classList.toggle('-warning', state === 'warning');
  icon.classList.toggle('-error', state === 'error');
  if (message) {
    icon.setAttribute('title', message);
  } else {
    icon.removeAttribute('title');
  }
}

async function getConfiguredToggleKeyValue(): Promise<Command | null> {
  // Firefox for Android does not support the browser.commands API at all
  // but probably not many people want to use keyboard shortcuts on Android
  // anyway so we can just return null from here in that case.
  if (!browser.commands) {
    return null;
  }

  const commands = await browser.commands.getAll();

  // Safari (14.1.1) has a very broken implementation of
  // chrome.commands.getAll(). It returns an object but it has no properties
  // and is not iterable.
  //
  // There's not much we can do in that case so we just hard code the default
  // key since Safari also has no way of changing shortcut keys. Hopefully
  // Safari will fix chrome.commands.getAll() before or at the same time it
  // provides a way of re-assigning shortcut keys.
  if (
    typeof commands === 'object' &&
    typeof commands[Symbol.iterator] !== 'function'
  ) {
    return new Command('R', 'MacCtrl', 'Ctrl');
  }

  for (const command of commands) {
    if (
      command.name ===
        (__MV3__ ? '_execute_action' : '_execute_browser_action') &&
      command.shortcut
    ) {
      return Command.fromString(command.shortcut);
    }
  }

  return null;
}

function configureHoldToShowKeys() {
  const getHoldToShowKeysValue = (
    checkboxes: NodeListOf<HTMLInputElement>
  ): string | null => {
    const parts: Array<string> = [];

    for (const checkbox of checkboxes) {
      if ((checkbox as HTMLInputElement).checked) {
        parts.push((checkbox as HTMLInputElement).value);
      }
    }
    if (!parts.length) {
      return null;
    }
    return parts.join('+');
  };

  const settings = ['holdToShowKeys', 'holdToShowImageKeys'] as const;
  for (const setting of settings) {
    const checkboxes = document.querySelectorAll<HTMLInputElement>(
      `.${setting.toLowerCase()} input[type=checkbox][id^=show-]`
    );

    for (const checkbox of checkboxes) {
      checkbox.addEventListener('click', () => {
        config[setting] = getHoldToShowKeysValue(checkboxes);
      });
    }
  }
}

function addPopupKeys() {
  const grid = document.getElementById('key-grid')!;

  for (const setting of DEFAULT_KEY_SETTINGS) {
    // Don't show the copy entry if the clipboard API is not available
    if (
      setting.name === 'startCopy' &&
      (!navigator.clipboard ||
        typeof navigator.clipboard.writeText !== 'function')
    ) {
      continue;
    }

    const keyBlock = html('div', { class: 'key' });

    for (const key of setting.keys) {
      const keyInput = html('input', {
        type: 'checkbox',
        class: `key-${setting.name}`,
        id: `key-${setting.name}-${key}`,
        name: `key-${setting.name}-${key}`,
      });
      keyInput.dataset.key = key;
      keyBlock.append(keyInput);
      keyBlock.append(' '); // <-- Mimick the whitespace in the template file

      keyInput.addEventListener('click', () => {
        const checkedKeys = document.querySelectorAll(
          `input[type=checkbox].key-${setting.name}:checked`
        );
        config.updateKeys({
          [setting.name]: Array.from(checkedKeys).map(
            (checkbox) => (checkbox as HTMLInputElement).dataset.key
          ),
        });
      });

      const keyLabel = html('label', { for: `key-${setting.name}-${key}` });

      // We need to add an extra span inside in order to be able to get
      // consistent layout when using older versions of extensions.css that put
      // the checkbox in a pseudo.
      if (setting.name === 'movePopupDownOrUp') {
        const [down, up] = key.split(',', 2);
        keyLabel.append(html('span', { class: 'key-box' }, down));
        keyLabel.append(html('span', { class: 'or' }, '/'));
        keyLabel.append(html('span', { class: 'key-box' }, up));
      } else {
        keyLabel.append(html('span', { class: 'key-box' }, key));
      }

      keyBlock.append(keyLabel);
    }

    grid.append(keyBlock);

    const keyDescription = html(
      'div',
      { class: 'key-description' },
      browser.i18n.getMessage(setting.l10nKey)
    );

    // Copy keys has an extended description.
    if (setting.name === 'startCopy') {
      const copyKeyList = html('ul', { class: 'key-list' });

      const copyKeys: Array<{
        key: string;
        l10nKey: string;
      }> = CopyKeys.map(({ key, optionsString }) => ({
        key,
        l10nKey: optionsString,
      }));
      copyKeys.push({
        // We just show the first key here. This matches what we show in the
        // pop-up too.
        key: setting.keys[0],
        l10nKey: CopyNextKeyStrings.optionsString,
      });

      for (const copyKey of copyKeys) {
        copyKeyList.append(
          html(
            'li',
            { class: 'key' },
            html('label', {}, html('span', { class: 'key-box' }, copyKey.key)),
            browser.i18n.getMessage(copyKey.l10nKey)
          )
        );
      }

      keyDescription.appendChild(copyKeyList);
    }

    if (NEW_KEYS.includes(setting.name)) {
      keyDescription.append(
        html(
          'span',
          { class: 'new-badge' },
          browser.i18n.getMessage('options_new_badge_text')
        )
      );
    }

    grid.appendChild(keyDescription);
  }
}

function translateKeys() {
  const mac = isMac();

  // Hide MacCtrl key if we're not on Mac
  const macCtrlInput = document.getElementById(
    'toggle-macctrl'
  ) as HTMLInputElement | null;
  const labels = macCtrlInput?.labels ? Array.from(macCtrlInput.labels) : [];
  if (macCtrlInput) {
    macCtrlInput.style.display = mac ? 'revert' : 'none';
  }
  for (const label of labels) {
    label.style.display = mac ? 'revert' : 'none';
  }

  if (!mac) {
    return;
  }

  const keyLabels = document.querySelectorAll<HTMLSpanElement>(
    '.key > label > span'
  );
  for (const label of keyLabels) {
    // Look for a special key on the label saying what it really is.
    //
    // We need to do this because we have an odd situation where the 'commands'
    // manifest.json property treats 'Ctrl' as 'Command' but in all other cases
    // where we see 'Ctrl', it should actually be 'Control'.
    //
    // So to cover this, we stick data-mac="Command" on any labels that map to
    // 'commands'.
    const labelText = label.dataset['mac'] || label.textContent;
    if (labelText === 'Command') {
      label.textContent = '⌘';
    } else if (labelText === 'Ctrl') {
      label.textContent = 'Control';
    } else if (labelText === 'Alt') {
      label.textContent = '⌥';
    }
  }
}

function configurePuckSettings() {
  const showPuckOptions = Array.from(
    document.querySelectorAll<HTMLInputElement>(
      'input[type=radio][name=showPuck]'
    )
  );
  for (const option of showPuckOptions) {
    option.addEventListener('change', (event) => {
      const setting = (event.target as HTMLInputElement).value as
        | 'auto'
        | 'show'
        | 'hide';
      config.showPuck = setting;
    });
  }
}

function fillInLanguages() {
  const select = document.querySelector('select#lang') as HTMLSelectElement;

  for (const [id, data] of dbLanguageMeta) {
    let label = data.name;
    if (data.hasWords && !data.hasKanji) {
      label += browser.i18n.getMessage('options_lang_words_only');
    } else if (!data.hasWords && data.hasKanji) {
      label += browser.i18n.getMessage('options_lang_kanji_only');
    }
    select.append(html('option', { value: id }, label));
  }

  select.addEventListener('change', () => {
    if (!isDbLanguageId(select.value)) {
      const msg = `Got unexpected language code: ${select.value}`;
      void Bugsnag.notify(new Error(msg));
      console.error(msg);
      return;
    }
    config.dictLang = select.value;
  });
}

// Expire current set of badges on Oct 10
const NEW_EXPIRY = new Date(2023, 9, 10);
const NEW_KEYS = ['expandPopup'];

function expireNewBadges() {
  if (new Date() < NEW_EXPIRY) {
    return;
  }

  const badges = document.querySelectorAll('.new-badge');
  for (const badge of badges) {
    if (badge instanceof HTMLElement) {
      badge.style.display = 'none';
    }
  }
}

function fillVals() {
  const optform = document.getElementById('optform') as HTMLFormElement;
  optform.highlightStyle.value = config.noTextHighlight
    ? 'none'
    : config.highlightStyle;
  optform.showPriority.checked = config.showPriority;
  optform.showWaniKaniLevel.checked =
    config.waniKaniVocabDisplay === 'show-matches';
  optform.showRomaji.checked = config.showRomaji;
  optform.showDefinitions.checked = !config.readingOnly;
  optform.accentDisplay.value = config.accentDisplay;
  optform.posDisplay.value = config.posDisplay;
  optform.fontSize.value = config.fontSize;
  const { autoExpand } = config;
  optform.expandWords.checked = autoExpand.includes('words');
  optform.expandKanji.checked = autoExpand.includes('kanji');
  optform.highlightText.checked = !config.noTextHighlight;
  optform.contextMenuEnable.checked = config.contextMenuEnable;
  optform.mouseInteractivity.value = config.popupInteractive
    ? 'enable'
    : 'disable';
  optform.popupStyle.value = config.popupStyle;
  optform.enableTapLookup.checked = config.enableTapLookup;
  optform.tabDisplay.value = config.tabDisplay;
  optform.toolbarIcon.value = config.toolbarIcon;
  optform.showPuck.value = config.showPuck;

  renderCurrencyList(config.fxCurrency, config.fxCurrencies);

  getConfiguredToggleKeyValue()
    .then((toggleCommand) => {
      const getToggleControl = (part: string): HTMLInputElement =>
        document.getElementById(`toggle-${part}`) as HTMLInputElement;
      getToggleControl('alt').checked = !!toggleCommand?.alt;
      getToggleControl('ctrl').checked = !!toggleCommand?.ctrl;
      getToggleControl('shift').checked = !!toggleCommand?.shift;
      if (getToggleControl('macctrl')) {
        getToggleControl('macctrl').checked = !!toggleCommand?.macCtrl;
      }
      getToggleControl('key').value = toggleCommand?.key || '';
    })
    .catch((e) => {
      console.error(e);
      void Bugsnag.notify(e);
    });

  // Note that this setting is hidden when we detect the device does not likely
  // have a physical keyboard.
  const holdToShowSettings = ['holdToShowKeys', 'holdToShowImageKeys'] as const;
  for (const setting of holdToShowSettings) {
    const holdKeyParts: Array<string> =
      typeof config[setting] === 'string' ? config[setting]!.split('+') : [];
    const holdKeyCheckboxes = document.querySelectorAll(
      `.${setting.toLowerCase()} input[type=checkbox][id^=show-]`
    );
    for (const checkbox of holdKeyCheckboxes) {
      (checkbox as HTMLInputElement).checked = holdKeyParts.includes(
        (checkbox as HTMLInputElement).value
      );
    }
  }

  for (const [setting, keys] of Object.entries(config.keys)) {
    const checkboxes = document.querySelectorAll<HTMLInputElement>(
      `input[type=checkbox].key-${setting}`
    );
    for (const checkbox of checkboxes) {
      checkbox.checked =
        !!checkbox.dataset.key && keys.includes(checkbox.dataset.key);
    }
  }

  const langSelect = document.querySelector('select#lang') as HTMLSelectElement;
  const langOptions = langSelect.querySelectorAll('option');
  const dictLang = config.dictLang;
  for (const option of langOptions) {
    option.selected = option.value === dictLang;
  }
}

window.onload = async () => {
  try {
    await config.ready;
    completeForm();
    fillVals();
  } finally {
    // Reveal contents now that it is complete
    document.documentElement.classList.add('initialized');
  }

  config.addChangeListener(fillVals);
};

window.onunload = () => {
  config.removeChangeListener(fillVals);
};
