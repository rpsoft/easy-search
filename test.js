var chalk = require( "chalk" );
var easysearch = require( "./index.js")

var test_load_query = async () => {
    var t0 = new Date().getTime()
    index_data = await easysearch.reloadIndex("index")
    var t1 = new Date().getTime()
    console.log(chalk.blue("[easy-search]"),"RELOAD INDEX TEST took: "+ (t1 - t0) + " milliseconds.")
    results = easysearch.search( index_data, "table placebo" );
    var t2 = new Date().getTime()
    console.log(chalk.blue("[easy-search]"),"Search took " + (t2 - t1) + " milliseconds.")
}

var test = async () => {

  var t0 = new Date().getTime()

  var index_data = await easysearch.indexFolder(["testDocs"], html=true, 10)
  
  var t1 = new Date().getTime()
  console.log(chalk.blue("[easy-search]"),"index took " + (t1 - t0) + " milliseconds.")

  var results = easysearch.search( index_data, "table placebo" );

  var t2 = new Date().getTime()
  console.log(chalk.blue("[easy-search]"),"Search took " + (t2 - t1) + " milliseconds.")

  console.log(chalk.blue("[easy-search]"), results.length+" results")
  results.slice(0,10).map( async(res,i) => { console.log(i+" -- "+res.selectedChunks.slice(0,3).flat().join(" "))})

  await easysearch.storeIndex( index_data, "index" )

  await easysearch.storeIndexAsJSONFile(index_data, "indexFile.json")
  index_data = await easysearch.readIndexFromJSONFile("indexFile.json")

  await test_load_query()
}

test()
