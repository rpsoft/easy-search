/**
 * indexFolder,
search,
storeIndex,
reloadIndex
 */
const easysearch = require('../index.js')
// const easysearch = require('../temp.js')

// Index used for testing
const TEST_PATH = 'test/testDocs'
const INDEX_FILENAME = 'test/perfomance2Index.json'
const SEARCH_TERM = 'table placebo'

// Format / Serialize snapshot output
//  Added Array length and compact inner arrays 

const SEPARATOR = ',';
let inlineArray = false
function serializeItems(items, config, indentation, depth, refs, printer) {
    if (items.length === 0) {
    return '';
  }
  const indentationItems = indentation + config.indent;
  return (
    config.spacingOuter +
    items
      .map(
        item => {
          //  Added Array length and compact inner arrays 
          if (Array.isArray(item)) {
            return indentationItems + 
              `Array ${item.length} [${item.map(el => `"${el}"`).join(', ').toString()}]`
          }
          return indentationItems +
            printer(item, config, indentationItems, depth, refs) // callback
        }
      )
      .join(SEPARATOR + config.spacingInner) +
    (config.min ? '' : SEPARATOR) + // following the last item
    config.spacingOuter +
    indentation
  );
}

function inlineArrayItems(items, config, indentation, depth, refs, printer) {
  if (items.length === 0) {
    return '';
  }
  const indentationItems = indentation + config.indent;
  return (
    items
      .sort()
      .map(
        (item, i) => {
          //  Added Array length and compact inner arrays 
          if (Array.isArray(item)) {
            return `Array ${item.length} [${item.map(el => `"${el}"`).join(', ').toString()}]`
          }
          return i == 0 ? item: ' '+item
        }
      )
  );
}

const plugin = {
  test(value) {
    return value && Array.isArray(value);
  },
  serialize(array, config, indentation, depth, refs, printer) {
    const name = array.constructor.name;
    //  Added Array length 
    return ++depth > config.maxDepth ?
      `[${name}] ${array.length}`
      : `${config.min ?
          ''
          : `${name} ${array.length} `}[${
            inlineArray ?
            inlineArrayItems(array, config, indentation, depth, refs, printer)
            : serializeItems(
                array,
                config,
                indentation,
                depth,
                refs,
                printer,
              )
          }]`;
  },
}

let formatPrintStatus = 0
const plugin2 = {
  test(value) {
    return value && formatPrintStatus == 0;
  },
  serialize(value, config, indentation, depth, refs, printer) {
    formatPrintStatus = 1
    const indentationItems = indentation + config.indent;
    inlineArray = false

    const doc_chunks = printer(value['doc_chunks'], config, indentationItems, depth, refs)

    inlineArray = true

    const doc_freqs = printer(value['doc_freqs'], config, indentationItems, depth, refs)
    const inv_index = printer(value['inv_index'], config, indentationItems, depth, refs)

    inlineArray = false
    
    return `{
  doc_chunks: ${doc_chunks},
  doc_freqs: ${doc_freqs},
  inv_index: ${inv_index}
}`
  }
}

expect.addSnapshotSerializer(plugin);
expect.addSnapshotSerializer(plugin2);

test('generate index from folder', async () => {
  const index_data = await easysearch.indexFolder(
    // folders
    [
      TEST_PATH,
      // TEST_PATH + '/1',
      // TEST_PATH + '/2'
    ],
    html=true,
    10
  )
  expect(index_data).toMatchSnapshot();
});

test('generate index from DB', async () => {
  const PATH_BASE = 'test/'
  const info = [
    {
      file_path: PATH_BASE + 'testDocs/11442551_1.html',
      collection_id: '1',
      tid: '1',
      doi: '1abcde',
      pmid: '1fghij',
      url: 'http://example1.test',
      user: 'testUser',
      userid: '',
    },
    {
      file_path: PATH_BASE + 'testDocs/1/8596317_1.html',
      collection_id: '1',
      tid: '2',
      doi: '2abcde',
      pmid: '2fghij',
      url: 'http://example2.test',
      user: 'testUser',
      userid: '',
    }
  ]

  const indexFromDB = await easysearch.indexFromDB(
    // DB info
    info,
    {
      filePathFieldName: 'file_path',
      linkFieldName: 'tid',
    },
    html=true,
    10
  )
  // expect(indexFromDB).toEqual(false);
  expect(indexFromDB).toMatchSnapshot();
});

// db tables => easysearch => index order by tid (field) + added metadata