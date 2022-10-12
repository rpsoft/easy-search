const chalk = require('chalk');
const easysearch = require('../index.js')

const test_load_query = async () => {
  const t0 = new Date().getTime()
  index_data = await easysearch.reloadIndex("index")
  const t1 = new Date().getTime()
  console.log(chalk.blue('[easy-search]'), `RELOAD INDEX TEST took: ${t1 - t0} milliseconds.`)
  results = easysearch.search( index_data, "table placebo" );
  const t2 = new Date().getTime()
  console.log(chalk.blue('[easy-search]'), `Search took ${t2 - t1} milliseconds.`)
}

const test = async () => {

  // Generate index
  const t0 = new Date().getTime()
  const index_data = await easysearch.indexFolder(['test/testDocs', 'test/testDocs/1'], html=true, 10)
  const t1 = new Date().getTime()

  console.log(chalk.blue('[easy-search]'), `Index (generation) took ${t1 - t0} milliseconds.`)

  // Search term 
  const searchTerm = 'table placebo'
  const t2 = new Date().getTime()
  let results = easysearch.search( index_data, searchTerm );
  const t3 = new Date().getTime()

  console.log(chalk.blue('[easy-search]'), `Search took ${t3 - t2} milliseconds.`)

  console.log(chalk.blue('[easy-search]'), results.length + ' results')

  results.slice(0,10).map( async(res,i) => {
    console.log(i+' -- '+res.selectedChunks.slice(0,3).flat().join(' '))
  })
  // results.slice(0, 10).map( async(res,i) => { console.log(i + ' -- ' + res.score + ' ' + res.doc )})

  await easysearch.storeIndex( index_data, 'index' )

  await test_load_query()
}

test()
