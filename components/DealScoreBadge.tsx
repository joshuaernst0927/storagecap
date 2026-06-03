import { getDealScoreTier, dealScoreTierColor, dealScoreDotColor, DEAL_TYPE_LABELS, type DealType } from '@/lib/dealScore'

interface Props {
  score: number
  dealType?: DealType
  size?: 'sm' | 'md'
}

export default function DealScoreBadge({ score, dealType, size = 'sm' }: Props) {
  const tier = getDealScoreTier(score)
  const colors = dealScoreTierColor(tier)
  const dot = dealScoreDotColor(tier)

  if (size === 'md') {
    return (
      <div className={`inline-flex flex-col items-center gap-0.5 px-3 py-1.5 rounded border font-mono ${colors}`}>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
          <span className="text-lg font-bold leading-none">{score}</span>
          <span className="text-xs font-bold uppercase tracking-wider">{tier}</span>
        </div>
        {dealType && (
          <span className="text-[0.6rem] uppercase tracking-widest opacity-70 font-sans">
            {DEAL_TYPE_LABELS[dealType]}
          </span>
        )}
      </div>
    )
  }

  return (
    <span title={dealType ? `Deal Score · ${DEAL_TYPE_LABELS[dealType]}` : 'Deal Score'}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[0.65rem] font-bold font-mono border ${colors}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
      {score} · {tier}
    </span>
  )
}
