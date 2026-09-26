/** @jest-environment node */
import { familySchemas, familyJsonSchemas, familySchemasForSet, validateFamilyContent } from './family-schemas'
import { familyCatalogueOverride } from './family-fill'

const names = ['site-header','site-footer','local-nav','hero','content','collection','logo-strip','stats','testimonials','pricing','disclosure','cta','form','table','media']
test('all fifteen historical families accept their minimal shared content and publish JSON Schema', () => {
  expect(Object.keys(familySchemas)).toEqual(names)
  for (const name of names) {
    const content = name === 'collection' ? {items:[{}]} : name === 'form' ? {fields:[]} : name === 'table' ? {rows:[]} : {}
    expect(familySchemas[name].safeParse(content).success).toBe(true)
    expect(familyJsonSchemas[name]).toBeDefined()
    expect(familySchemas[name].safeParse({...content, invented: true}).success).toBe(false)
  }
  expect(familySchemas.collection.safeParse({}).success).toBe(false)
  expect(familySchemas.collection.safeParse({items:[]}).success).toBe(false)
  expect(familySchemas.table.safeParse({chartImage:'https://example.com/chart.svg'}).success).toBe(true)
})
test('family contract supplies descriptions and omits old contract/image rules', async () => {
  const {override}=await familyCatalogueOverride('C')
  expect(Object.keys(override.types)).toHaveLength(15)
  expect(override.omitRules).toEqual(expect.arrayContaining(['card-grid','content-feed','mediaId','mediaType']))
  expect(override.contract).toContain('Copy the source words exactly')
})

test('set D has eleven strict schemas and collection item kinds', () => {
  const schemas = familySchemasForSet('D')
  expect(Object.keys(schemas)).toHaveLength(11)
  for (const kind of ['card','stat','quote','price','logo']) {
    const item = kind === 'stat' ? {title:'42',body:'Invented count'}
      : kind === 'quote' ? {body:'Invented quotation',title:'Invented speaker',subtitle:'Invented role'}
      : kind === 'price' ? {title:'Invented plan',meta:[{key:'price',value:'12'},{key:'period',value:'month'}],links:[{type:'external',label:'Choose plan',url:'https://example.com/plan'}]}
      : kind === 'logo' ? {media:{kind:'image',url:'https://example.com/logo.svg'}}
      : {title:'Invented card'}
    expect(schemas.collection.safeParse({items:[item],settings:{itemKind:kind}}).success).toBe(true)
    expect(validateFamilyContent('collection',{items:[item],settings:{itemKind:kind}},'D')).toMatchObject({items:[item],settings:{itemKind:kind}})
  }
  expect(schemas.collection.safeParse({items:[{title:'Invented'}],settings:{itemKind:'invalid'}}).success).toBe(false)
  expect(schemas.collection.safeParse({items:[{title:'Invented',unknown:true}]}).success).toBe(false)
  expect(familySchemas.collection.safeParse({items:[{}],settings:{itemKind:'stat'}}).success).toBe(false)
})
test('icon URLs and nested menu links are preserved; rich text matches production string acceptance', () => {
  expect(familySchemas['site-header'].safeParse({links:[{label:'Products',type:'external',url:'https://example.com/products',emphasis:'plain',children:[{label:'One',type:'external',url:'https://example.com/one',emphasis:'plain'}]}],items:[{media:{kind:'icon',url:'https://example.com/icon.svg',alt:''}}]}).success).toBe(true)
  expect(familySchemas.media.safeParse({media:{kind:'icon',url:'lucide:star',alt:''}}).success).toBe(false)
  expect(familySchemas.content.safeParse({intro:'<h2 class="copy">Words</h2>'}).success).toBe(true)
})
test('sparse source-backed nested content and table alternatives are represented in JSON Schema', () => {
  expect(familySchemas.collection.safeParse({items:[{title:'One',media:{kind:'image',url:'https://example.com/one.png'},links:[{type:'internal',path:'/details',pageId:'details'}]}]}).success).toBe(true)
  expect(familySchemas.form.safeParse({fields:[{type:'email'}]}).success).toBe(true)
  expect(familySchemas.table.safeParse({caption:'Values'}).success).toBe(false)
  const table = JSON.stringify(familyJsonSchemas.table)
  expect(table).toMatch(/anyOf|oneOf/)
  expect(table).toContain('chartImage')
  expect(JSON.stringify(familyJsonSchemas.content)).toContain('HTML')
  expect(JSON.stringify(familyJsonSchemas.media)).toContain('icon')
})
