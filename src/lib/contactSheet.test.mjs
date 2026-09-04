// Run: node src/lib/contactSheet.test.mjs
import assert from 'node:assert'
import { entriesFromChildren, buildSheetSvg, TEMPLATES, THEMES, formatILPhone, photoKeyOf, formatBirthDate } from './contactSheet.js'

// themes recolor the sheet — each theme's card color appears in the SVG
for (const t of THEMES) {
  const svg = buildSheetSvg({ template: 'cards', title: 't', entries: [{ name: 'א', lines: ['x'] }], theme: t.id })
  assert.ok(svg.includes(t.p.card), `theme ${t.id} applies card color`)
  assert.ok(svg.includes(t.p.title), `theme ${t.id} applies title color`)
}
// unknown/empty theme falls back to first theme (no crash)
assert.ok(buildSheetSvg({ template: 'cards', title: 't', entries: [], theme: 'nope' }).startsWith('<svg'))

// formatILPhone: restore leading zero + dash for IL mobiles
assert.equal(formatILPhone('585105577'), '058-5105577', '9-digit → add 0 + dash')
assert.equal(formatILPhone('0543113320'), '054-3113320', '10-digit keeps, adds dash')
assert.equal(formatILPhone('054-3113320'), '054-3113320', 'already formatted unchanged')
assert.equal(formatILPhone(''), '', 'empty stays empty')
assert.equal(formatILPhone('03-1234567'), '03-1234567', 'non-mobile left as-is')

// entriesFromChildren: sorts by Hebrew name, builds parent lines from phones
const kids = [
  { name: 'שי ביטון', parents: [{ name: 'אלי', phone: '050-1' }, { name: 'גל', phone: '052-2' }] },
  { name: 'אבי כהן', parents: [{ name: 'רן', phone: '' }, { name: '', phone: '' }] },
]
const entries = entriesFromChildren(kids)
assert.equal(entries[0].name, 'אבי כהן', 'sorted Hebrew: אבי before שי')
assert.deepEqual(entries[1].lines, ['אלי  050-1', 'גל  052-2'])
assert.deepEqual(entries[0].lines, ['רן'], 'parent with no phone still listed, empty parent dropped')

// each row carries the child id, so its photo survives a name edit in the editor
const idKids = [{ id: 'c1', name: 'תמר', parents: [] }, { id: 'c2', name: 'תמר', parents: [] }]
const idEntries = entriesFromChildren(idKids)
assert.deepEqual(idEntries.map(e => e.id), ['c1', 'c2'], 'entries carry the child id')
assert.equal(photoKeyOf(idKids[0]), 'c1', 'photo key is the id, not the name')
assert.notEqual(photoKeyOf(idKids[0]), photoKeyOf(idKids[1]), 'two children named alike keep separate photos')
assert.equal(photoKeyOf({ name: 'ללא מזהה' }), 'ללא מזהה', 'falls back to the name when there is no id')

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

// child photos: entries with a photo dataURL render a clipped <image>; entries
// without one get an initial-letter disc; photo-less sheets contain no <image>
const photoEntries = [
  { name: 'דנה', lines: ['אמא 050'], photo: 'data:image/jpeg;base64,AAAA' },
  { name: 'יובל', lines: ['אבא 052'] },
]
for (const t of TEMPLATES) {
  const svg = buildSheetSvg({ template: t.id, title: 't', entries: photoEntries })
  assert.ok(svg.includes('<image'), `${t.id} embeds the uploaded photo`)
  assert.ok(svg.includes('clipPath'), `${t.id} clips the photo to a circle`)
  assert.ok(svg.includes('data:image/jpeg;base64,AAAA'), `${t.id} uses the data URL`)
  const noPhotos = buildSheetSvg({ template: t.id, title: 't', entries: [{ name: 'יובל', lines: ['x'] }] })
  assert.ok(!noPhotos.includes('<image'), `${t.id} photo-less sheet has no <image>`)
}

console.log('contactSheet: all checks passed')

// ── birth dates ───────────────────────────────────────────────────────────────
assert.equal(formatBirthDate('2018-03-14'), '14.3.2018', 'stored ISO date reads as Hebrew d.m.yyyy')
assert.equal(formatBirthDate('2018-11-05'), '5.11.2018', 'leading zeros dropped')
for (const bad of ['', null, undefined, '14/03/2018', '2018-3-4', 'לא תאריך']) {
  assert.equal(formatBirthDate(bad), '', `not a stored date: ${bad}`)
}

const bdayKids = [{ id: 'b1', name: 'נועם', birthDate: '2018-03-14', parents: [{ name: 'אמא', phone: '0501' }] }]
assert.equal(entriesFromChildren(bdayKids)[0].birthDate, '2018-03-14', 'entries carry the birth date')

for (const t of TEMPLATES) {
  const withB = buildSheetSvg({ template: t.id, title: 't', entries: entriesFromChildren(bdayKids) })
  assert.ok(withB.includes('14.3.2018'), `${t.id} prints the birth date`)
  // the editor clears birthDate when the checkbox is off — nothing is printed
  const withoutB = buildSheetSvg({ template: t.id, title: 't', entries: [{ name: 'נועם', lines: ['אמא'], birthDate: '' }] })
  assert.ok(!withoutB.includes('14.3.2018'), `${t.id} omits the date when it is off`)
}

// a birthday line makes the card taller, so nothing overlaps the row below
const many = [{ name: 'א', lines: ['הורה 1', 'הורה 2', 'הורה 3'], birthDate: '2018-03-14' }]
const tallerH = (svg) => +/height="(\d+)"/.exec(svg)[1]
for (const t of ['cards', 'compact']) {
  const withB = tallerH(buildSheetSvg({ template: t, title: 't', entries: many }))
  const withoutB = tallerH(buildSheetSvg({ template: t, title: 't', entries: [{ ...many[0], birthDate: '' }] }))
  assert.ok(withB > withoutB, `${t} grows to fit the birthday line`)
}

// clipping must never cut an emoji in half: a lone surrogate makes
// encodeURIComponent throw, and with it the preview AND the export
const emojiRow = [{
  name: 'ילד עם שם ארוך מאוד מאוד מאוד מאוד ארוך',
  lines: ['הורה אחת 050-1234567', 'הורה שני 052-7654321', 'הורה שלישי 054-1111111'],
  birthDate: '2018-03-14',
}]
for (const t of TEMPLATES) {
  const svg = buildSheetSvg({ template: t.id, title: 'כותרת ארוכה במיוחד', entries: emojiRow })
  assert.doesNotThrow(() => encodeURIComponent(svg), `${t.id} survives being turned into a data URL`)
}
