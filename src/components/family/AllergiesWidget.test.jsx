import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import AllergiesWidget from './AllergiesWidget'

describe('AllergiesWidget', () => {
  it('lists the banned allergens and defaults to the personal-box rules', () => {
    const html = renderToString(<AllergiesWidget />)
    for (const a of ['בוטנים', 'שומשום', 'קשיו', 'פיסטוק', 'פקאן']) expect(html).toContain(a)
    expect(html).toContain(': מותר')
    expect(html).not.toContain('גם אסור')
  })
})
