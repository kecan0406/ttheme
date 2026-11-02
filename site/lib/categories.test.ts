import { expect, test } from 'bun:test'
import { alsoIn, categoriesFrom, placeLinks, placesFrom, placesOf, type WorkFacts } from '@/lib/categories'

function facts(
  medium: string | null,
  genres: string[] = [],
  nature: string | null = null,
  tags: string[] = [],
): WorkFacts {
  return { tags, medium, genres, nature }
}

test('a work sits wherever it reaches a screen, and in print only when it reaches no screen', () => {
  expect(placesFrom([facts('manga'), facts('anime')])).toEqual(['anime'])
  expect(placesFrom([facts('anime'), facts('game')])).toEqual(['anime', 'game'])
  expect(placesFrom([facts('manga')])).toEqual(['manga'])
  expect(placesFrom([facts('manga'), facts('novel')])).toEqual(['manga', 'novel'])
  expect(placesFrom([facts(null)])).toEqual([])
})

test('a game goes as deep as most of its releases say, and stops at game when they do not', () => {
  expect(placesFrom([facts('game', ['rhythm'])])).toEqual(['rhythm-game'])
  expect(placesFrom([facts('game', ['rhythm']), facts('game')])).toEqual(['rhythm-game'])
  expect(placesFrom([facts('game', ['vn']), facts('game'), facts('game')])).toEqual(['game'])
  expect(placesFrom([facts('game', ['rhythm', 'vn'])])).toEqual(['rhythm-game'])
  expect(placesFrom([facts('anime'), facts('game', ['vn'])])).toEqual(['anime', 'visual-novel'])
})

test('the works a tag names decide, and a spin-off that only inherits the family does not', () => {
  expect(placesFrom([facts('anime', [], null, ['moonlit_harbor']), facts('game', ['vn'])])).toEqual(['anime'])
  expect(placesFrom([facts('anime'), facts('game', ['vn'])])).toEqual(['anime', 'visual-novel'])
})

test('what is no work takes no place, whatever else carries its name', () => {
  expect(placesFrom([facts('anime', [], 'group')])).toEqual([])
  expect(placesFrom([facts(null, [], 'software')])).toEqual([])
})

test('the hand table wins over what the facts say, and a work it lacks takes them', () => {
  expect(placesOf('undertale', ['anime'])).toEqual(['game'])
  expect(placesOf('marvel', ['game'])).toEqual([])
  expect(placesOf('moonlit-harbor', ['anime'])).toEqual(['anime'])
  expect(placesOf('moonlit-harbor')).toEqual([])
})

test('a genre stands under game, in its category and on its tile', () => {
  expect(categoriesFrom(['visual-novel', 'anime'])).toEqual(['game', 'anime'])
  expect(alsoIn(['visual-novel', 'anime'], 'anime')).toBe('+ visual novel')
  expect(alsoIn(['visual-novel', 'anime'], 'game')).toBe('+ anime')
  expect(alsoIn(['rhythm-game'], 'game')).toBeNull()
  expect(placeLinks(['rhythm-game', 'anime'])).toEqual([
    { label: 'anime', href: '/browse/anime' },
    { label: 'rhythm game', href: '/browse/game?genre=rhythm-game' },
  ])
})
