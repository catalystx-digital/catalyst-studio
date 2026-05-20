import type { DomProbeEvaluationResult } from './evaluation'

export function computeDomProbeConfidence(evaluation?: DomProbeEvaluationResult): number | undefined {
  if (!evaluation) {
    return undefined
  }

  if (evaluation.summary.overall) {
    return 0.95
  }

  const paletteScore = evaluation.summary.palette.agreementRatio
  const typographyDenominator =
    evaluation.summary.typography.matched +
    evaluation.summary.typography.missing +
    evaluation.summary.typography.unexpected
  const typographyScore = evaluation.summary.typography.passed
    ? 1
    : Math.max(0, evaluation.summary.typography.matched / Math.max(1, typographyDenominator))
  const spacingScore = evaluation.summary.spacing.passed ? 1 : 0.5

  const weighted = paletteScore * 0.6 + typographyScore * 0.2 + spacingScore * 0.2
  return Number(Math.max(0.3, Math.min(1, weighted)).toFixed(2))
}
