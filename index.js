const stemmer = require('stemmer')
const path = require('path');
const fs = require('fs');
const cheerio = require('cheerio');
const stopwords = require('stopwords').english;
var serialize = require('serialize-javascript');

const contextWindowSize = 10

// Simple stopwords check
const isStopWord = ( word ) => {
  return stopwords.indexOf(word) > -1
}

// Simple tokenisation and stemming
const tokeniseAndStem = ( text, stem = true ) =>{
  return text.replace(/[^a-z]+/gi, " ").replace(/\s+/g, " ").toLowerCase().split(" ").map( t => stem ? stemmer(t) : t );
}

// Reads all files in a folder and creates a doc->freq map, and an inverted index out of that.
const indexFolder = async ( documentsFolders, html=false  ) => {

  var doc_process = new Promise( (accept,reject) => {

      var doc_freqs = {}
      var doc_chunks = {}

      try{
        for (var d in documentsFolders){
          var directoryPath = documentsFolders[d]

          var files = fs.readdirSync(directoryPath);

          console.log("[easy-search] Processing: "+directoryPath)

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

                  doc_freqs[doc_path] = freq_map
                  doc_chunks[doc_path] = chunk_array
                  // debugger

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

  // debugger
  return {doc_freqs, inv_index, doc_chunks}
}

// Uses the doc->freq map to create an inverted index.
const createInvertedIndex = ( doc_freqs ) => {

  var inv_index = {}

  Object.keys(doc_freqs).map( (doc , i) => {

      Object.keys(doc_freqs[doc]).map ( (word,j) => {

        var doc_vector = inv_index[word]
        // debugger
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
      // debugger
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

const reloadIndex = ( index_path ) => {
  return deserialize(fs.readFileSync( index_path, 'utf8' ));
}

const storeIndex = ( index_data, index_path ) => {
    var dataToSerial = serialize(index_data, {isJSON: true})
    fs.writeFileSync( index_path, dataToSerial);
}

var test = async () => {

  var t0 = new Date().getTime()

  var index_data = await indexFolder(["testDocs"], html=true) //, "/home/suso/ihw/smalltesting"

  var t1 = new Date().getTime()
  console.log("[easy-search] index took " + (t1 - t0) + " milliseconds.")

  var results = search( index_data, "table placebo" );

  var t2 = new Date().getTime()
  console.log("[easy-search] Search took " + (t2 - t1) + " milliseconds.")

  console.log("[easy-search] " + results.length+" results")
  results.slice(0,10).map( (res,i) => { console.log(i+" -- "+res.selectedChunks.slice(0,3).flat().join(" "))})

  storeIndex( index_data, "currentIndex" )
}

var test_load_query = () => {
    index_data = reloadIndex("currentIndex")
    results = search( index_data, "table placebo" );
    console.log("[easy-search] RELOAD INDEX TEST: "+results.length+" results")
}

test()
//
// test_load_query()

module.exports = {
  indexFolder,
  search,
  storeIndex,
  reloadIndex
}
