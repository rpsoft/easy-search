const {
  performance,
  PerformanceObserver
} = require('perf_hooks');

const chalk = require('chalk');
const easysearch = require('../index.js')

// Index used for testing
const INDEX_FILENAME = 'test/performance2Index.json'
const SEARCH_TERM = 'table placebo'

const perfomance = async () => {

  const observer = new PerformanceObserver((list, algo) => {

    let last = 0
    list.getEntries().reverse().forEach(entry => {
    // Display each reported measurement on console
    if (console) {
        console.log(entry)
        console.log(
          "Name: "       + entry.name      +
          ", Type: "     + entry.entryType +
          ", Start: "    + entry.startTime +
          ", Duration: " + entry.duration  +
          ", metaDuration: " + (entry.duration - last) +
          "\n"
        );
        last = entry.duration
    }
    })
  });
  observer.observe({entryTypes: ['resource', 'mark', 'measure'], buffered: true});
  const TEST_PATH = 'test/testDocs'
  var t0 = new Date().getTime()

  performance.mark('registered-observer');
  const index_data = await easysearch.indexFolder(
    [
      TEST_PATH,
      // TEST_PATH + '/1',
      // TEST_PATH + '/2'
    ], html=true
  )

  performance.measure('parse files', 'registered-observer');

  var t1 = new Date().getTime()

  console.log(chalk.blue('[easy-search]'), `index took ${t1 - t0} milliseconds.`)
  performance.mark('index');

  var results = easysearch.search( index_data, SEARCH_TERM );
  performance.measure('index', {detail: '[easy-search] index took ', start: 'index'});

  var t2 = new Date().getTime()
  console.log(chalk.blue('[easy-search]'), `Search took ${t2 - t1} milliseconds.`)

  console.log(chalk.blue('[easy-search]'), results.length+' results')

  easysearch.storeIndex( index_data, INDEX_FILENAME )
}

const perfomanceLoadQuery = async () => {
  index_data = await easysearch.reloadIndex(INDEX_FILENAME)
  results = easysearch.search( index_data, SEARCH_TERM );
  console.log(chalk.blue('[easy-search]'), `RELOAD INDEX TEST: ${results.length} results`)
  console.log(JSON.stringify(results))
}

perfomance()

perfomanceLoadQuery()