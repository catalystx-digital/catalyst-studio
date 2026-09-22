/**
 * The question registry.
 *
 * Every question is declared exactly once, here, with its shape, criteria,
 * threshold, facets and fallback. Call sites reference a question by id and
 * never write criteria inline — that is what lets twenty scattered home-page
 * checks collapse into one, instead of becoming twenty inline model calls.
 *
 * No network. No side effects beyond registration.
 *
 * @module decisions/registry
 */
import type { BooleanQuestion, ChoiceQuestion, Question, ScoreQuestion } from './types'

const questions = new Map<string, Question>()

/** The model caps a Choice at 255 options, however those options were built. */
export function assertChoiceOptions(questionId: string, options: string[]): void {
  if (options.length > 255) {
    throw new Error(`Choice ${questionId} has ${options.length} options; the model caps at 255`)
  }
}

function assertValid(question: Question): void {
  if (!question.id.includes('.')) {
    throw new Error(`Question id must be namespaced, e.g. 'page.isHome': got '${question.id}'`)
  }
  if (!Number.isInteger(question.version) || question.version < 1) {
    throw new Error(`Question ${question.id} needs an integer version >= 1`)
  }
  if (question.facets.length === 0) {
    throw new Error(`Question ${question.id} declares no facets, so its state would be empty`)
  }

  if (question.shape === 'choice' && typeof question.criteria !== 'function') {
    // Lazy criteria are validated at ask time instead; see assertChoiceOptions.
    const options = Object.keys(question.criteria)
    if (options.length < 2) throw new Error(`Choice ${question.id} needs at least 2 options`)
    assertChoiceOptions(question.id, options)
  }

  if (question.shape === 'score') {
    const levels = question.criteria.length
    if (levels < 2 || levels > 10) {
      throw new Error(`Score ${question.id} has ${levels} levels; the model supports 2 to 10`)
    }
  }

  if (question.shape !== 'score') {
    const { threshold } = question
    if (!(threshold > 0 && threshold <= 1)) {
      throw new Error(`Question ${question.id} needs a threshold in (0, 1]; got ${threshold}`)
    }
  }
}

export function defineQuestion<T extends Question>(question: T): T {
  assertValid(question)
  const existing = questions.get(question.id)
  if (existing && existing !== (question as unknown as Question)) {
    throw new Error(`Question ${question.id} is already registered. Ids are never reused.`)
  }
  questions.set(question.id, question)
  return question
}

export function getQuestion(id: string): Question {
  const question = questions.get(id)
  if (!question) {
    throw new Error(
      `Unknown question '${id}'. Register it in lib/studio/decisions/questions/ and export it from index.ts.`
    )
  }
  return question
}

export function hasQuestion(id: string): boolean {
  return questions.has(id)
}

export function listQuestions(): Question[] {
  return [...questions.values()].sort((a, b) => a.id.localeCompare(b.id))
}

/** Test helper. Never call this from product code. */
export function __resetRegistryForTests(): void {
  questions.clear()
}

export type { BooleanQuestion, ChoiceQuestion, ScoreQuestion, Question }
