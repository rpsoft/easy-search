const stemmer = require('stemmer')
const path = require('path');
const fs = require('fs/promises');
const cheerio = require('cheerio');
const stopwords = require('stopwords').english;
const serialize = require('serialize-javascript');

// Simple stopwords check
const isStopWord = ( word ) => {
  return stopwords.indexOf(word) > -1
}

// Simple tokenisation and stemming
const tokeniseAndStem = ( text, stem = true ) => {
  return text.replace(/[^a-z]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .split(' ')
    .map( t => stem ? stemmer(t) : t );
}

const fileStateCheck = (_path) => fs.stat(_path).then((status) => status, () => false)
// Check path link status
const pathLinkStatusCheck = (_path) => fs.lstat(_path)

/**
 * Reads all files from an Array of Objects and create an inverted index out of that.
 * 
 * 
 * @param {array} info Reads all files from this array of objects.
 * @param {object} config
 * @param {object} config.filePathFieldName field name of file path to index
 * @param {object} config.linkFieldName field name to order the index
 * @param {boolean} html Parse the file as html. default=false
 * @param {number} contextWindowSize Number of words extracted for doc chunks. default=10
 * @returns {object} doc_chunks, doc_freqs, inv_index
 */
const indexFromDB = async ( info, config, html=false, contextWindowSize=10 ) => {

  let doc_freqs = {}
  let doc_chunks = {}
  let doc_info = {}

  console.log('[easy-search] indexFromDB Processing: ' + info.length + ' number of files')
  try {
    for (let tupla of info) {
      doc_info[tupla[config.linkFieldName]] = tupla
      const doc_path = tupla[config.filePathFieldName];
      const fileStatus = fileStateCheck(doc_path)
      const pathLinkStatus = await pathLinkStatusCheck(doc_path)

      if (
        await fileStatus &&
        pathLinkStatus.isDirectory()
      ) {
        return false
      }

      let doc_content = '';

      doc_content = await fs.readFile(doc_path, 'utf8');

      if ( html ) {
        doc_content = cheerio.load(doc_content).text();
      }

      const text_content = tokeniseAndStem(doc_content);
      const text_content_raw = tokeniseAndStem(doc_content,false);

      let freq_map = {}
      let chunk_array = []

      let i, j, chunk = contextWindowSize;

      for (i=0, j=text_content.length; i<j; i+=chunk) {
        const temparray = text_content.slice(i, i+chunk);
        const temparray_raw = text_content_raw.slice(i, i+chunk);

        chunk_array.push(temparray_raw)

        const chunkNumber = i / chunk

        for (let word of temparray) {
          if ( word.length < 3 || isStopWord(word) ){
            continue
          }

          let docFreq = freq_map[word]

          if ( Array.isArray(docFreq) ){
            if ( docFreq.indexOf(chunkNumber) < 0 ) {
              docFreq.push( chunkNumber)
            }
          } else {
            docFreq = [chunkNumber]
          }

          freq_map[word] = docFreq
        }
      }

      // Reference to working path?
      // doc_chunks[doc_path] = chunk_array
      doc_chunks[tupla[config.linkFieldName]] = chunk_array
      doc_freqs[tupla[config.linkFieldName]] = freq_map
      // return true
    }
  } catch (err) {
    console.log(err)
    return `[easy-search] failed reading files or folder`
  }

  const inv_index = createInvertedIndex(doc_freqs)
  
  return {
    doc_chunks,
    doc_freqs,
    inv_index,
    doc_info,
  }
}

/**
 * Reads all files in a folder and creates a doc->freq map, and an inverted index out of that.
 * 
 * @param {array} documentFolders Reads all files in a folder it is not recursive, don't look inside other folders
 * @param {boolean} html Parse the file as html. default=false
 * @param {number} contextWindowSize Number of words extracted for doc chunks. default=10
 * @returns {object} doc_chunks, doc_freqs, inv_index
 */
const indexFolder = async ( documentFolders, html=false, contextWindowSize=10 ) => {

  let doc_freqs = {}
  let doc_chunks = {}

  try {
    for (let d in documentFolders) {
      const directoryPath = documentFolders[d]
      const inter_folders = directoryPath.split('/')
      const subFolder = inter_folders[inter_folders.length-1]

      console.log('[easy-search] Processing: '+directoryPath)
      const files = await fs.readdir(directoryPath);

      await Promise.all(files.map(async (file) => {
        const doc_path = path.join(directoryPath, file);
        const fileStatus = fileStateCheck(doc_path)
        const pathLinkStatus = await pathLinkStatusCheck(doc_path)

        if (
          await fileStatus &&
          pathLinkStatus.isDirectory()
        ) {
          return false
        }

        let doc_content = '';
        doc_content = await fs.readFile(doc_path, 'utf8');

        if ( html ) {
          doc_content = cheerio.load(doc_content).text();
        }

        const text_content = tokeniseAndStem(doc_content);
        const text_content_raw = tokeniseAndStem(doc_content,false);

        let freq_map = {}
        let chunk_array = []

        let i, j, chunk = contextWindowSize;

        for (i=0, j=text_content.length; i<j; i+=chunk) {
          const temparray = text_content.slice(i, i+chunk);
          const temparray_raw = text_content_raw.slice(i, i+chunk);

          chunk_array.push(temparray_raw)

          const chunkNumber = i / chunk

          for (let word of temparray) {
            if ( word.length < 3 || isStopWord(word) ){
              continue
            }

            let docFreq = freq_map[word]

            if ( Array.isArray(docFreq) ){
              if ( docFreq.indexOf(chunkNumber) < 0 ) {
                docFreq.push( chunkNumber)
              }
            } else {
              docFreq = [chunkNumber]
            }

            freq_map[word] = docFreq
          }
        }

        // Reference to working path?
        // doc_chunks[doc_path] = chunk_array
        doc_chunks[subFolder+'/'+file] = chunk_array
        doc_freqs[subFolder+'/'+file] = freq_map
        return true
      }));
    }
  } catch (err) {
    console.log(err)
    return `[easy-search] failed reading files or folder`
  }

  const inv_index = createInvertedIndex(doc_freqs)

  return {
    doc_chunks,
    doc_freqs,
    inv_index,
  }
}

// Uses the doc->freq map to create an inverted index.
const createInvertedIndex = ( doc_freqs ) => {
  const inv_index = {}

  for (let doc in doc_freqs) {
    // console.log(doc)
    for (let word in doc_freqs[doc]) {
      // console.log(word)
      let doc_vector = inv_index[word]

      if ( doc_vector && (!doc_vector[doc]) ){
        doc_vector.push(doc)
      } else {
        doc_vector = [doc]
      }

      inv_index[word] = doc_vector
    }
  }

  return inv_index
}

const search = ( index_data, query, rankLimit=-1  ) => {
  const queryTokenizedAndStemed = tokeniseAndStem(query);
  const totalNumberDocuments = Object.keys(index_data.doc_freqs).length

  let ranking = Object.keys(index_data.doc_freqs).reduce( (docsList, doc) => {
    let selectedChunks = []
    const doc_tf_idf = queryTokenizedAndStemed.reduce( (total_tf_idf, term) => {

      // IDF(t) = log_e(Total number of documents / Number of documents with term t in it).
      const idf = index_data.inv_index[term] ?
        Math.log(totalNumberDocuments / index_data.inv_index[term].length)
        : 0;

      // TF(t) = (Number of times term t appears in a document) / (Total number of terms in the document).
      const tf = index_data.doc_freqs[ doc ][ term ] == undefined ?
        0
        : index_data.doc_freqs[ doc ][ term ].length
      // / Object.keys(index_data.doc_freqs[ doc ]).length

      if ( tf > 0 ) {
        selectedChunks = [
          ...selectedChunks,
          ...index_data.doc_freqs[ doc ][ term ]
        ]
      }

      return total_tf_idf + (tf * idf)
    }, 0)

    if ( doc_tf_idf > 0 ) {
      selectedChunks = Array.from(new Set(selectedChunks))
      selectedChunks = selectedChunks.map( i => index_data.doc_chunks[doc][i])

      // Add doc_info?
      if (index_data.doc_info) {
        docsList.push({
          doc,
          score: doc_tf_idf,
          selectedChunks,
          info: index_data.doc_info[doc]
        })
      } else {
        docsList.push({
          doc,
          score: doc_tf_idf,
          selectedChunks
        })
      }
    }

    return docsList
  }, [])

  ranking = ranking.sort((a, b) => b.score - a.score);

  if ( rankLimit > -1) {
    ranking = ranking.slice(0, rankLimit)
  }

  return ranking
}

const deserialize = ( serializedJavascript ) => {
  return JSON.parse(serializedJavascript);
  // return eval('(' + serializedJavascript + ')');
}

const reloadIndex = async ( index_path ) => {
  return deserialize(await fs.readFile( index_path, 'utf8' ));
}

const storeIndex = async ( index_data, index_path ) => {
  const dataToSerial = serialize(index_data, {isJSON: true})
  await fs.writeFile( index_path, dataToSerial);
  return 'done'
}

const storeIndexAsJSONFile = async (index_data, index_path) => {
  try {
    console.log("Saving to: "+index_path)
    return fs.writeFile(index_path, JSON.stringify(index_data))
  } catch (err) {
    console.error(err)
  }
}

const readIndexFromJSONFile = async (index_path) => {
  try {
    console.log("Reloading: "+index_path)

    let data = await fs.readFile(index_path, 'utf8')

    return data
  } catch (err) {
    console.error(err)
    return false
  }
}

function readStreamPromise(filePath) {
  return new Promise( (accept,reject) => {
    let newObject = []
    // When we read the file back into memory, ndjson will stream, buffer, and split
    // the content based on the newline character. It will then parse each newline-
    // delimited value as a JSON object and emit it from the TRANSFORM stream.
    let inputStream = fs.createReadStream(filePath);
    let transformStream = inputStream.pipe( ndjson.parse() );

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

function saveStreamPromise(filePath, records) {
  return new Promise((resolve, reject) =>{
    let transformStream = ndjson.stringify();

    // Pipe the ndjson serialized output to the file-system.
    let outputStream = transformStream.pipe( fs.createWriteStream( filePath ) );

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
  indexFromDB,
  search,
  storeIndex,
  reloadIndex,
  tokeniseAndStem,
  storeIndexAsJSONFile,
  readIndexFromJSONFile
}
