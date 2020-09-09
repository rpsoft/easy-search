# A Painfully Simple Search System.

Make files in folder/s searchable. (NODE JS)

## Install
```{js}
npm i @sephir/easy-search
```

## Usage
```{js}
var easysearch = require('@sephir/easy-search')

// feed an array of folders containing the documents. It doesn't do subfolders.
var searchIndex = await easysearch.indexFolder( ["some/folder/here", "another/folder/here"] )

// To search feed the index object and the query
var results = easysearch.search( searchIndex, "your query here")

// results contains an array of objects, each object contains a document number and a tf-idf score assigned to it , given your query.
```

## Serialise/Deserialise the Index

```{js}
// Store your index in a file
easysearch.storeIndex( index_data, "/some/file/name" )

// Reload your index from a file 
var index_data = reloadIndex("/some/file/name")
```


## Disclaimer

There are many search solutions much more powerful than this one, however they all require substantial learning before using them. Easy-search has been built to provide a very simple search functionality that should be more than enough for most cases, when your dataset consists of a few thousand documents.
