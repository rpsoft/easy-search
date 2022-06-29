const stemmer = require('stemmer')
const path = require('path');
const fs = require('fs');
const cheerio = require('cheerio');
const stopwords = require('stopwords').english;
const ndjson = require('ndjson');
const chalk = require( "chalk" );

// Simple stopwords check
const isStopWord = ( word ) => {
  return stopwords.indexOf(word) > -1
}

// Simple tokenisation and stemming
const tokeniseAndStem = ( text, stem = true ) =>{
  return text.replace(/[^a-z]+/gi, " ").replace(/\s+/g, " ").toLowerCase().split(" ").map( t => stem ? stemmer(t) : t );
}

// Reads all files in a folder and creates a doc->freq map, and an inverted index out of that.
const indexFolder = async ( documentFolders, html=false, contextWindowSize=10 ) => {

  var doc_process = new Promise( (accept,reject) => {

      var doc_freqs = {}
      var doc_chunks = {}

      try{
        for (var d in documentFolders){
          var directoryPath = documentFolders[d]

          var files = fs.readdirSync(directoryPath);

          var inter_folders = directoryPath.split("/")
          var subFolder = inter_folders[inter_folders.length-1]
          // console.log(subFolder)

          console.log(chalk.blue("[easy-search]"),"Processing: "+directoryPath)

              files.forEach(function (file) {

                  var doc_path = path.join(directoryPath,file);

                  if ( fs.existsSync(doc_path) && fs.lstatSync(doc_path).isDirectory()){
                    return
                  }

                  var doc_content = "";

                  if ( html ){
                    doc_content = cheerio.load(fs.readFileSync(doc_path)).text();
                  } else {
                    doc_content = fs.readFileSync(doc_path, "utf8");
                  }

                  var text_content = tokeniseAndStem(doc_content);

                  var text_content_raw = tokeniseAndStem(doc_content,false);

                  var freq_map = {}
                  var chunk_array = []

                  var i,j,temparray,chunk = contextWindowSize;
                  for (i=0,j=text_content.length; i<j; i+=chunk) {
                      temparray = text_content.slice(i,i+chunk);
                      temparray_raw = text_content_raw.slice(i,i+chunk);


                      chunk_array.push(temparray_raw)

                      var chunkNumber = (i/chunk)

                      freq_map = temparray.reduce( (acc,word) => {

                          if ( word.length < 3 || isStopWord(word) ){
                            return acc
                          }

                          var docFreq = acc[word]

                          if ( Array.isArray(docFreq) ){
                            if ( (docFreq.indexOf(chunkNumber) < 0) ){
                              docFreq.push( chunkNumber)
                            }
                          } else {
                            docFreq = [chunkNumber]
                          }

                          acc[word] = docFreq

                          return acc
                      } , freq_map )

                  }

                  doc_chunks[doc_path] = chunk_array

                  doc_freqs[doc_path] = freq_map
              });
        }
    } catch (err){
       console.log(err)
      reject("[easy-search] failed reading files or folder")
    }
      accept({doc_freqs, doc_chunks})
  });

  doc_process =  await doc_process;
  var doc_freqs = doc_process.doc_freqs
  var doc_chunks = doc_process.doc_chunks
  var inv_index = createInvertedIndex(doc_freqs)

  return {doc_freqs, inv_index, doc_chunks}
}

// Uses the doc->freq map to create an inverted index.
const createInvertedIndex = ( doc_freqs ) => {

  var inv_index = {}

  Object.keys(doc_freqs).map( (doc , i) => {

      Object.keys(doc_freqs[doc]).map ( (word,j) => {

        var doc_vector = inv_index[word]

        if ( doc_vector && (!doc_vector[doc]) ){
          doc_vector.push(doc)
        } else {
          doc_vector = [doc]
        }

        inv_index[word] = doc_vector
      })

  })

  return inv_index
}

const search = ( index_data, query, rankLimit=-1 ) => {
  query = tokeniseAndStem(query);

  var N = Object.keys(index_data.doc_freqs).length

  var ranking = Object.keys(index_data.doc_freqs).reduce( (docsList, doc) => {

    var selectedChunks = []

    var doc_tf_idf = query.reduce( (total_tf_idf, term) => {

      // IDF(t) = log_e(Total number of documents / Number of documents with term t in it).
      var idf = index_data.inv_index[term] ? Math.log(N / index_data.inv_index[term].length) : 0 ;

      // TF(t) = (Number of times term t appears in a document) / (Total number of terms in the document).
      var tf = index_data.doc_freqs[ doc ][ term ] ? index_data.doc_freqs[ doc ][ term ].length : 0 // / Object.keys(index_data.doc_freqs[ doc ]).length

      if ( tf > 0 ){
          selectedChunks = [...selectedChunks, ...index_data.doc_freqs[ doc ][ term ]]
      }

      return total_tf_idf+(tf*idf)
    }, 0)

    if ( doc_tf_idf > 0 ){

      selectedChunks = Array.from(new Set(selectedChunks))
      selectedChunks = selectedChunks.map( i => index_data.doc_chunks[doc][i])

      docsList.push( {doc, score: doc_tf_idf, selectedChunks} )
    }

    return docsList
  },[])

  ranking = ranking.sort(function(a, b) {
    return b.score - a.score;
  });

  if ( rankLimit > -1){
    ranking = ranking.slice(0, rankLimit)
  }

  return ranking
}

const deserialize =( serializedJavascript ) => {
  return eval('(' + serializedJavascript + ')');
}

const reloadIndex = async ( index_path ) => {

  var reloadedData = {}

  reloadedData.doc_freqs = Object.fromEntries(await readStreamPromise(path.join(index_path, "doc_freqs_entries.json")))
  reloadedData.inv_index = Object.fromEntries(await readStreamPromise(path.join(index_path, "inv_index_entries.json")))
  reloadedData.doc_chunks = Object.fromEntries(await readStreamPromise(path.join(index_path, "doc_chunks_entries.json")))

  return reloadedData
}

const storeIndex = async ( index_data, index_path ) => {
  await saveStreamPromise( path.join(index_path, "doc_freqs_entries.json"), Object.entries( index_data.doc_freqs ))
  await saveStreamPromise( path.join(index_path, "inv_index_entries.json"), Object.entries( index_data.inv_index ))
  await saveStreamPromise( path.join(index_path, "doc_chunks_entries.json"), Object.entries( index_data.doc_chunks ))
}

const storeIndexAsJSONFile = async (index_data, index_path) => {
  try {
    console.log("Saving to: "+index_path)
    await fs.writeFile(index_path, JSON.stringify(index_data), function(err, result) {
      if(err) console.log('error', err);
    })
  } catch (err) {
    console.error(err)
  }
}

const readIndexFromJSONFile = async (index_path) => {
    try {
      console.log("Reloading: "+index_path)

      var data = new Promise(( accept, reject ) => {
        fs.readFile(index_path, 'utf8', function (err, data) {
            accept( JSON.parse(data))
        })
      })

      return await data
      
    } catch (err) {
      console.error(err)
      return false
    }
}

function readStreamPromise(filePath){

    return new Promise( (accept,reject) => {
      var newObject = []
  		// When we read the file back into memory, ndjson will stream, buffer, and split
  		// the content based on the newline character. It will then parse each newline-
  		// delimited value as a JSON object and emit it from the TRANSFORM stream.
  		var inputStream = fs.createReadStream(filePath);
  		var transformStream = inputStream.pipe( ndjson.parse() );

  		transformStream
  			// Each "data" event will emit one item from our original record-set.
  			.on(
  				"data",
  				function handleRecord( data ) {
            debugger
            newObject.push(data)
  				}
  			)

  			// Once ndjson has parsed all the input, let's indicate done.
  			.on(
  				"end",
  				function handleEnd() {
            accept(newObject)
  				}
  			);
      });
}

function saveStreamPromise(filePath, records){
  return new Promise((resolve, reject) =>{
    var transformStream = ndjson.stringify();

    // Pipe the ndjson serialized output to the file-system.
    var outputStream = transformStream.pipe( fs.createWriteStream( filePath ) );

    // Iterate over the records and write EACH ONE to the TRANSFORM stream individually.
    // Each one of these records will become a line in the output file.
    records.forEach(
    	function iterator( record ) {
    		transformStream.write( record );
    	}
    );

    // Once we've written each record in the record-set, we have to end the stream so that
    // the TRANSFORM stream knows to flush and close the file output stream.
    transformStream.end();

    // Once ndjson has flushed all data to the output stream, let's indicate done.
    outputStream.on(
    	"finish",
    	function handleFinish() {
        resolve()
    	}
    );

  });
}

module.exports = {
  indexFolder,
  search,
  storeIndex,
  reloadIndex,
  tokeniseAndStem,
  storeIndexAsJSONFile,
  readIndexFromJSONFile
}
