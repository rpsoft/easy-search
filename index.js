const stemmer = require('stemmer')
const path = require('path');
const fs = require('fs');
const cheerio = require('cheerio');
const stopwords = require('stopwords').english;
var serialize = require('serialize-javascript');


// Simple stopwords check
const isStopWord = ( word ) => {
  return stopwords.indexOf(word) > -1
}

// Simple tokenisation and stemming
const tokeniseAndStem = ( text ) =>{
  return text.replace(/[^a-z]+/gi, " ").replace(/\s+/g, " ").toLowerCase().split(" ");
}

// Reads all files in a folder and creates a doc->freq map, and an inverted index out of that.
const indexFolder = async ( documentsFolders  ) => {

  var doc_freqs = new Promise( (accept,reject) => {

      var doc_freqs = {}

      try{
        for (var d in documentsFolders){
          var directoryPath = documentsFolders[d]

          var files = fs.readdirSync(directoryPath);

          console.log("[easy-search] Processing: "+directoryPath)

              files.forEach(function (file) {

                  var doc_path = path.join(directoryPath,file);

                  var doc_content = cheerio.load(fs.readFileSync(doc_path));

                  var text_content = tokeniseAndStem(doc_content.text());

                  var freq_map = text_content.reduce( (acc,word) => {

                      if ( word.length < 3 || isStopWord(word) ){
                        return acc
                      }

                      var docFreq = acc[word]

                      if ( docFreq ){
                        docFreq = docFreq + 1
                      } else {
                        docFreq = 1
                      }

                      acc[word] = docFreq

                      return acc
                  } , {} )

                  doc_freqs[file] = freq_map
              });
        }
    } catch (err){
      reject("[easy-search] failed reading files or folder")
    }
      accept(doc_freqs)
  });

  doc_freqs = await doc_freqs;

  var inv_index = createInvertedIndex(doc_freqs)

  return {doc_freqs, inv_index}
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

const search = ( index_data, query ) => {
  query = tokeniseAndStem(query);

  var N = Object.keys(index_data.doc_freqs).length

  var ranking = Object.keys(index_data.doc_freqs).reduce( (docsList, doc) => {

    var doc_tf_idf = query.reduce( (total_tf_idf, term) => {

      // IDF(t) = log_e(Total number of documents / Number of documents with term t in it).
      var idf = index_data.inv_index[term] ? Math.log(N / index_data.inv_index[term].length) : 0 ;

      // TF(t) = (Number of times term t appears in a document) / (Total number of terms in the document).
      var tf = (index_data.doc_freqs[ doc ][ term ] || 0) / Object.keys(index_data.doc_freqs[ doc ]).length

      return total_tf_idf+(tf*idf)
    }, 0)

    if ( doc_tf_idf > 0 ){
      docsList.push( {doc, score: doc_tf_idf} )
    }

    return docsList
  },[])

  ranking = ranking.sort(function(a, b) {
    return b.score - a.score;
  });

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

  var index_data = await indexFolder(["testDocs"])

  var t1 = new Date().getTime()
  console.log("[easy-search] index took " + (t1 - t0) + " milliseconds.")

  var results = search( index_data, "table placebo" );

  var t2 = new Date().getTime()
  console.log("[easy-search] Search took " + (t2 - t1) + " milliseconds.")

  console.log("[easy-search] " + results.length+" results")

  storeIndex( index_data, "currentIndex" )

}

var test_load_query = () => {

    index_data = reloadIndex("currentIndex")
    results = search( index_data, "table placebo" );
    console.log("[easy-search] RELOAD INDEX TEST: "+results.length+" results")
}
//
// test()
//
// test_load_query()

module.exports = {
  indexFolder,
  search,
  storeIndex,
  reloadIndex
}
