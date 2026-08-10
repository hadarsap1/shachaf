import { describe, it, expect } from 'vitest'
import { onboardingGaps, computeHealthAnomalies } from './health'
import { CONSENT_VERSION } from './consent'

const consented = { consentVersion: CONSENT_VERSION }

describe('onboardingGaps', () => {
  const child = (over = {}) => ({ id: 'c1', classId: 'class-1', parentUids: ['u1'], ...over })

  it('reports nothing to chase when the family has everything', () => {
    const user = { uid: 'u1', phone: '050-1234567', ...consented }
    const { gaps, onlyFinalStep } = onboardingGaps(user, { children: [child()] })
    expect(gaps).toEqual([])
    expect(onlyFinalStep).toBe(true)
  })

  it('flags a family with no linked children', () => {
    const user = { uid: 'u1', phone: '050-1234567', ...consented }
    const { gaps, onlyFinalStep } = onboardingGaps(user, { children: [child({ parentUids: ['other'] })] })
    expect(gaps).toContain('לא שויכו ילדים')
    expect(onlyFinalStep).toBe(false)
  })

  it('takes the class from the linked child, not only from the profile', () => {
    const user = { uid: 'u1', phone: '050-1234567', classIds: [], ...consented }
    expect(onboardingGaps(user, { children: [child()] }).gaps).not.toContain('אין כיתה')
  })

  it('falls back to classIds on the profile when no child carries a class', () => {
    const user = { uid: 'u1', phone: '050-1234567', classIds: ['class-2'], ...consented }
    const { gaps } = onboardingGaps(user, { children: [child({ classId: '' })] })
    expect(gaps).not.toContain('אין כיתה')
  })

  it('flags a missing class when neither the profile nor a child has one', () => {
    const user = { uid: 'u1', phone: '050-1234567', classIds: [], ...consented }
    expect(onboardingGaps(user, { children: [child({ classId: '' })] }).gaps).toContain('אין כיתה')
  })

  it('flags a missing phone', () => {
    const user = { uid: 'u1', ...consented }
    expect(onboardingGaps(user, { children: [child()] }).gaps).toContain('אין טלפון')
  })

  it('flags an un-approved policy, including an outdated version', () => {
    expect(onboardingGaps({ uid: 'u1', phone: '05' }, { children: [child()] }).gaps)
      .toContain('לא אישרו את התקנון')
    expect(onboardingGaps({ uid: 'u1', phone: '05', consentVersion: '0.9' }, { children: [child()] }).gaps)
      .toContain('לא אישרו את התקנון')
  })

  it('lists every gap at once for a family that only registered', () => {
    const { gaps, onlyFinalStep } = onboardingGaps({ uid: 'u1' }, { children: [] })
    expect(gaps).toEqual(['לא שויכו ילדים', 'אין כיתה', 'אין טלפון', 'לא אישרו את התקנון'])
    expect(onlyFinalStep).toBe(false)
  })

  it('survives missing arguments', () => {
    expect(onboardingGaps({ uid: 'u1' }).gaps.length).toBeGreaterThan(0)
  })
})

describe('computeHealthAnomalies — onboardingIncomplete', () => {
  it('flags a new_family member who never finished the wizard', () => {
    const { onboardingIncomplete } = computeHealthAnomalies({
      users: [{ uid: 'u1', role: 'new_family', status: 'active' }],
    })
    expect(onboardingIncomplete.map(u => u.uid)).toEqual(['u1'])
  })

  it('does not flag one who finished it', () => {
    const { onboardingIncomplete } = computeHealthAnomalies({
      users: [{ uid: 'u1', role: 'new_family', status: 'active', onboardingComplete: true }],
    })
    expect(onboardingIncomplete).toEqual([])
  })

  it('leaves accounts still awaiting approval to their own section', () => {
    const { onboardingIncomplete, awaitingApproval } = computeHealthAnomalies({
      users: [{ uid: 'u1', role: 'new_family', status: 'pending' }],
    })
    expect(onboardingIncomplete).toEqual([])
    expect(awaitingApproval.map(u => u.uid)).toEqual(['u1'])
  })

  it('ignores community members — the wizard is not theirs to finish', () => {
    const { onboardingIncomplete } = computeHealthAnomalies({
      users: [{ uid: 'u1', role: 'community', status: 'active' }],
    })
    expect(onboardingIncomplete).toEqual([])
  })
})
