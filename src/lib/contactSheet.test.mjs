// Run: node src/lib/contactSheet.test.mjs
import assert from 'node:assert'
import { entriesFromChildren, buildSheetSvg, TEMPLATES } from './contactSheet.js'

// entriesFromChildren: sorts by Hebrew name, builds parent lines from phones
const kids = [
  { name: 'שי ביטון', parents: [{ name: 'אלי', phone: '050-1' }, { name: 'גל', phone: '052-2' }] },
  { name: 'אבי כהן', parents: [{ name: 'רן', phone: '' }, { name: '', phone: '' }] },
]
const entries = entriesFromChildren(kids)
assert.equal(entries[0].name, 'אבי כהן', 'sorted Hebrew: אבי before שי')
assert.deepEqual(entries[1].lines, ['אלי  050-1', 'גל  052-2'])
assert.deepEqual(entries[0].lines, ['רן'], 'parent with no phone still listed, empty parent dropped')

// buildSheetSvg: every template returns SVG containing escaped user text
const evil = [{ name: '<script>&"x', lines: ['a<b'] }]
for (const t of TEMPLATES) {
  const svg = buildSheetSvg({ template: t.id, title: 'כותרת<>', subtitle: '', entries: evil })
  assert.ok(svg.startsWith('<svg'), `${t.id} is svg`)
  assert.ok(!svg.includes('<script>'), `${t.id} escapes < in names (no raw <script>)`)
  assert.ok(svg.includes('&lt;script&gt;&amp;&quot;x'), `${t.id} escapes name`)
  assert.ok(svg.includes('כותרת&lt;&gt;'), `${t.id} escapes title`)
}

// empty entries → still valid svg, no crash
assert.ok(buildSheetSvg({ template: 'cards', title: 't', entries: [] }).startsWith('<svg'))

console.log('contactSheet: all checks passed')
