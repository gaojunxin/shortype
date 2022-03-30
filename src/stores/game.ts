import { computed, reactive, readonly } from 'vue'

import Keyboard from '@/keyboard'
import KeyCombination from '@/models/keyCombination'
import { KeyCombinable, Shortcut } from '@/types/interfaces'
import {
  loadAllTools,
  loadAnsweredHistory,
  loadRemovedIds,
  loadShortcutsByTool,
  saveAnsweredHistory,
  saveRemovedIds,
  weight,
  weightedSampleKey,
} from '@/utils'

const TimeIntervalToRestartTyping = import.meta.env.MODE === 'test' ? 0 : 1000
const removedIds = [...loadRemovedIds()]

const gameStore = (shortcuts: Shortcut[]) => {
  const state = reactive({
    shortcuts: shortcuts,
    shortcut:
      shortcuts.find((shortcut) => !removedIds.includes(shortcut.id)) ??
      shortcuts[0],
    isListeningKeyboardEvent: true,
    isCorrectKeyPressed: false,
    isWrongKeyPressed: false,
    isRemoveKeyPressed: false,
    isSelectToolsKeyPressed: false,
    isShowCorrectKeyPressed: false,
    isMarkedSelfAsCorrect: false,
    isMarkedSelfAsWrong: false,
    isShakingKeyCombinationView: false,
    pressedKeyCombination: new KeyCombination(),
    removedIdSet: new Set<string>(removedIds),
    answeredHistoryMap: loadAnsweredHistory(),
  })

  const shortcutsIds = computed(() =>
    state.shortcuts.map((shortcut) => shortcut.id)
  )

  const wordsOfDescriptionFilledByCorrectKeys = computed(() =>
    Keyboard.splitByKey(state.shortcut.shortcut)
  )

  const wordsOfDescriptionFilledByPressedKeys = computed(() => {
    const pressedKeys = state.pressedKeyCombination.keys()

    return Keyboard.splitByKey(state.shortcut.shortcut).map((word) => {
      if (Keyboard.isKey(word)) {
        return pressedKeys.shift() ?? ''
      } else {
        return word
      }
    })
  })

  const availableIds = computed(() =>
    shortcutsIds.value.filter((id) => !state.removedIdSet.has(id))
  )

  const answeredIds = computed(() => {
    return Array.from(state.answeredHistoryMap.keys())
  })

  const noAnsweredAvailableIds = computed(() => {
    return availableIds.value.filter((id) => !answeredIds.value.includes(id))
  })

  const idToWeightMap = computed(() => {
    const idToWeightMap = new Map()

    for (const [id, results] of state.answeredHistoryMap.entries()) {
      if (shortcutsIds.value.includes(id)) {
        idToWeightMap.set(id, weight(results))
      }
    }

    return idToWeightMap
  })

  const availableIdToWeightMap = computed(() => {
    const availableIdToWeightMap = new Map()

    for (const [id, weight] of idToWeightMap.value.entries()) {
      if (availableIds.value.includes(id)) {
        availableIdToWeightMap.set(id, weight)
      }
    }

    return availableIdToWeightMap
  })

  const countsOfEachStatus = computed(() => {
    const [masteredIds, unmasteredIds]: [string[], string[]] = [
      ...idToWeightMap.value,
    ].reduce(
      ([masteredIds, unmasteredIds], [id, weight]) =>
        weight <= 0.6
          ? [[...masteredIds, id], unmasteredIds]
          : [masteredIds, [...unmasteredIds, id]],
      [[], []]
    )

    const noAnsweredIds = shortcutsIds.value.filter(
      (id) => !answeredIds.value.includes(id)
    )

    return {
      mastered: {
        included: masteredIds.filter((id) => availableIds.value.includes(id))
          .length,
        removed: masteredIds.filter((id) => !availableIds.value.includes(id))
          .length,
      },
      unmastered: {
        included: unmasteredIds.filter((id) => availableIds.value.includes(id))
          .length,
        removed: unmasteredIds.filter((id) => !availableIds.value.includes(id))
          .length,
      },
      noAnswered: {
        included: noAnsweredIds.filter((id) => availableIds.value.includes(id))
          .length,
        removed: noAnsweredIds.filter((id) => !availableIds.value.includes(id))
          .length,
      },
    }
  })

  const removedShortcutExists = computed(() => state.removedIdSet.size > 0)
  const isAllRemoved = computed(() =>
    state.shortcuts.every((shortcut) => state.removedIdSet.has(shortcut.id))
  )

  const keyDown = (keyCombinable: KeyCombinable) => {
    if (isAllRemoved.value || !state.isListeningKeyboardEvent) return

    state.pressedKeyCombination.keyDown(keyCombinable)
    judge()
  }

  const keyUp = (key: string) => {
    if (isAllRemoved.value || !state.isListeningKeyboardEvent) return

    state.pressedKeyCombination.keyUp(key)
  }

  const judge = () => {
    if (!state.pressedKeyCombination.hasPressedSomeKey()) return
    if (
      state.pressedKeyCombination.isModifierKey() &&
      !state.shortcut.keyCombinations.some((keyCombination) =>
        KeyCombination.isOnlyModifierKeys(keyCombination)
      )
    )
      return

    if (
      state.pressedKeyCombination.isOnlyEnterKey() &&
      !state.shortcut.keyCombinations.some((keyCombination) =>
        KeyCombination.isOnlyEnterKey(keyCombination)
      )
    ) {
      state.shortcut = nextShortcut()
      resetTypingState()
      return
    } else if (state.pressedKeyCombination.isRemoveKey()) {
      respondToRemoveKey()
      return
    } else if (state.pressedKeyCombination.isSelectToolsKey()) {
      respondToSelectToolsKey()
      return
    }

    if (state.shortcut.isAvailable) {
      if (
        state.shortcut.keyCombinations.some(
          (keyCombination) =>
            state.pressedKeyCombination.is(keyCombination) ||
            (KeyCombination.isOnlyModifierKeys(keyCombination) &&
              state.pressedKeyCombination.hasEqualModifiers(keyCombination))
        )
      ) {
        respondToCorrectKey()
      } else if (
        !state.isWrongKeyPressed &&
        !state.pressedKeyCombination.isModifierKey()
      ) {
        respondToWrongKey()
      }
    } else {
      if (
        !state.isShowCorrectKeyPressed &&
        state.pressedKeyCombination.isShowCorrectKey()
      ) {
        respondToShowCorrectKey()
      } else if (
        state.isShowCorrectKeyPressed &&
        state.pressedKeyCombination.isMarkedSelfAsCorrectKey()
      ) {
        respondToMarkSelfAsCorrectKey()
      } else if (
        state.isShowCorrectKeyPressed &&
        state.pressedKeyCombination.isMarkedSelfAsWrongKey()
      ) {
        respondToMarkSelfAsWrongKey()
      }
    }
  }

  const nextShortcut = () => {
    let nextId: string

    if (noAnsweredAvailableIds.value.length > 0) {
      nextId =
        noAnsweredAvailableIds.value.find((id) => id > state.shortcut.id) ??
        noAnsweredAvailableIds.value[0]
    } else {
      nextId = weightedSampleKey(availableIdToWeightMap.value)
    }

    return state.shortcuts.find(
      (shortcut) => shortcut.id === nextId
    ) as Shortcut
  }

  const respondToSelectToolsKey = () => {
    resetTypingState()
    state.isListeningKeyboardEvent = false
    state.isSelectToolsKeyPressed = true
  }

  const respondToShowCorrectKey = () => {
    resetTypingState()
    state.isShowCorrectKeyPressed = true
  }

  const respondToRemoveKey = () => {
    state.isListeningKeyboardEvent = false
    state.isRemoveKeyPressed = true
    state.removedIdSet.add(state.shortcut.id)
    saveRemovedIds([...state.removedIdSet])

    setTimeout(() => {
      state.shortcut = nextShortcut()
      resetTypingState()
      state.isListeningKeyboardEvent = true
    }, TimeIntervalToRestartTyping)
  }

  const respondToCorrectKey = () => {
    state.isListeningKeyboardEvent = false
    state.isCorrectKeyPressed = true
    if (!state.isWrongKeyPressed) saveResult(state.shortcut.id, true)

    setTimeout(() => {
      state.shortcut = nextShortcut()
      resetTypingState()
      state.isListeningKeyboardEvent = true
    }, TimeIntervalToRestartTyping)
  }

  const respondToWrongKey = () => {
    state.isListeningKeyboardEvent = false
    state.isWrongKeyPressed = true
    state.isShakingKeyCombinationView = true
    saveResult(state.shortcut.id, false)

    setTimeout(() => {
      state.isListeningKeyboardEvent = true
      state.isShakingKeyCombinationView = false
      state.pressedKeyCombination.reset()
    }, TimeIntervalToRestartTyping)
  }

  const respondToMarkSelfAsCorrectKey = () => {
    state.isListeningKeyboardEvent = false
    state.isMarkedSelfAsCorrect = true
    saveResult(state.shortcut.id, true)

    setTimeout(() => {
      state.shortcut = nextShortcut()
      resetTypingState()
      state.isListeningKeyboardEvent = true
    }, TimeIntervalToRestartTyping)
  }

  const respondToMarkSelfAsWrongKey = () => {
    state.isListeningKeyboardEvent = false
    state.isMarkedSelfAsWrong = true
    saveResult(state.shortcut.id, false)

    setTimeout(() => {
      state.shortcut = nextShortcut()
      resetTypingState()
      state.isListeningKeyboardEvent = true
    }, TimeIntervalToRestartTyping)
  }

  const saveResult = (id: string, result: boolean) => {
    if (state.answeredHistoryMap.has(id)) {
      state.answeredHistoryMap.get(id)?.push(result)
    } else {
      state.answeredHistoryMap.set(id, [result])
    }

    saveAnsweredHistory(state.answeredHistoryMap)
  }

  const resetTypingState = () => {
    state.isRemoveKeyPressed = false
    state.isCorrectKeyPressed = false
    state.isWrongKeyPressed = false
    state.isSelectToolsKeyPressed = false
    state.isShowCorrectKeyPressed = false
    state.isMarkedSelfAsCorrect = false
    state.isMarkedSelfAsWrong = false
    state.pressedKeyCombination.reset()
  }

  const restoreRemovedShortcuts = () => {
    if (
      confirm(
        'すべてのショートカットキーが出題されるようになります。\nよろしいですか？'
      )
    ) {
      localStorage.removeItem('removedIds')
      state.removedIdSet = new Set<string>()
      resetTypingState()
      state.shortcut = shortcuts[0]
    }
  }

  const updateTool = (tool: string) => {
    state.shortcuts = loadShortcutsByTool(tool)

    state.shortcut =
      state.shortcuts.find((shortcut) => !removedIds.includes(shortcut.id)) ??
      state.shortcuts[0]
    hideToolsView()
  }

  const hideToolsView = () => {
    resetTypingState()
    state.isListeningKeyboardEvent = true
  }

  const masteredRateOfEachTool = (): {
    name: string
    masteredRate: number
  }[] => {
    const allTools = loadAllTools()
    const masteredIds = [...state.answeredHistoryMap]
      .map(([id, results]) => [id, weight(results)])
      .filter(([, weight]) => weight <= 0.6)
      .map(([id]) => id)

    return Object.values(allTools).map(({ name, shortcuts }) => {
      const countOfShortcut = shortcuts.filter(
        (shortcut) => !state.removedIdSet.has(shortcut.id)
      ).length
      const countOfMastered = shortcuts.filter(
        (shortcut) =>
          masteredIds.includes(shortcut.id) &&
          !state.removedIdSet.has(shortcut.id)
      ).length

      return {
        name,
        masteredRate: Math.floor((countOfMastered / countOfShortcut) * 100),
      }
    })
  }

  return {
    state: readonly(state),

    removedShortcutExists,
    isAllRemoved,
    wordsOfDescriptionFilledByCorrectKeys,
    wordsOfDescriptionFilledByPressedKeys,

    keyDown,
    keyUp,
    judge,
    restoreRemovedShortcuts,
    updateTool,
    masteredRateOfEachTool,
    hideToolsView,
    countsOfEachStatus,
  }
}

export default gameStore
export type GameStore = ReturnType<typeof gameStore>
