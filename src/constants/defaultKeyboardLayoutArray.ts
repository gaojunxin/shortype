// https://github.com/WICG/keyboard-map/blob/main/keyboard-polyfill.js
// Because there is no way to determine the current keyboard layout, this
// assumes that the current layout is US-en.

const defaultKeyboardLayoutArray = [
  ['Backquote', '`'],
  ['Digit1', '1'],
  ['Digit2', '2'],
  ['Digit3', '3'],
  ['Digit4', '4'],
  ['Digit5', '5'],
  ['Digit6', '6'],
  ['Digit7', '7'],
  ['Digit8', '8'],
  ['Digit9', '9'],
  ['Digit0', '0'],
  ['Minus', '-'],
  ['Equal', '='],
  ['IntlYen', '\\'],
  ['KeyQ', 'q'],
  ['KeyW', 'w'],
  ['KeyE', 'e'],
  ['KeyR', 'r'],
  ['KeyT', 't'],
  ['KeyY', 'y'],
  ['KeyU', 'u'],
  ['KeyI', 'i'],
  ['KeyO', 'o'],
  ['KeyP', 'p'],
  ['BracketLeft', '['],
  ['BracketRight', ']'],
  ['Backslash', '\\'],
  ['KeyA', 'a'],
  ['KeyS', 's'],
  ['KeyD', 'd'],
  ['KeyF', 'f'],
  ['KeyG', 'g'],
  ['KeyH', 'h'],
  ['KeyJ', 'j'],
  ['KeyK', 'k'],
  ['KeyL', 'l'],
  ['Semicolon', ':'],
  ['Quote', "'"],
  ['IntlBackslash', '\\'],
  ['KeyZ', 'z'],
  ['KeyX', 'x'],
  ['KeyC', 'c'],
  ['KeyV', 'v'],
  ['KeyB', 'b'],
  ['KeyN', 'n'],
  ['KeyM', 'm'],
  ['Comma', ','],
  ['Period', '.'],
  ['Slash', '/'],
] as const

export default defaultKeyboardLayoutArray
