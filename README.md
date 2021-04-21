# A Painfully Simple Search System.

Make files in folder/s searchable. (NODE JS)

## Install
```javascript
npm i @sephir/easy-search
```

## Usage
```javascript
var easysearch = require('@sephir/easy-search')

// feed an array of folders containing the documents. It doesn't do subfolders.
var searchIndex = await easysearch.indexFolder( ["some/folder/here", "another/folder/here"], html=false, contextWindowSize=10 )
//If your documents are html, then flip the html parameter to true, so that tags can be ignored.

// To search feed the index object and the query
var results = easysearch.search( searchIndex, "your query here")

// results contains an array of objects, each object contains a document number and a tf-idf score assigned to it , given your query.
```

## Serialise/Deserialise the Index

```javascript
// Store your index in a folder
await easysearch.storeIndex( searchIndex, "/some/folder/name" )

// Reload your index from a file
var searchIndex = await easysearch.reloadIndex("/some/folder/name")
```
## UPDATES! v0.9
- Improved storage which allows now a LOT more documents to be indexed. Limit being what you can load into RAM.
  - Performance note: Indexing 128k html documents takes ~300 seconds on my hardware.
- Added context of query words. In search results you can find chunks of text where the query terms have been found.
  - Size of chunks can be configured within the indexFolder parameter ``contextWindowSize''

## Get in touch!

If you like the project and want to tell me or propose features let me know!: [mailto](mailto:rpsoft@gmail.com) 

## Disclaimer

There are many search solutions much more powerful than this one, however they all require substantial learning before using them. Easy-search has been built to provide a very simple search functionality that should be more than enough for most cases, when your dataset consists of a few thousand documents.
