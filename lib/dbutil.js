const fs = require('fs')
const level = require('level')
const rimraf = require('rimraf')
const extend = require('extend')

const dbs = {
  dir: require('path').resolve(__dirname, '../dbs'),
  level: require('path').resolve(__dirname, '../dbs/db'),
  dynamo: require('path').resolve(__dirname, '../dbs/dynamo'),
}

let globalDb = undefined

function nextLetter(s) {
  if (!isNaN(s)) {
    return `${Number(s) + 1}`
  }

  return s.replace(/([a-zA-Z])[^a-zA-Z]*$/, (a) => {
    var c = a.charCodeAt(0)
    switch(c){
      case 90: return 'A'
      case 122: return 'a'
      default: return String.fromCharCode(++c)
    }
  })
}

exports.setup = (callback) => {
  if (globalDb === undefined) {
    if (!fs.existsSync(dbs.dir)) {
      fs.mkdirSync(dbs.dir)
    }

    globalDb = level(dbs.level)
  }

  callback(null, globalDb)
}

exports.put = (db, path, data, callback) => {
  key = path.join('|')
  db.put(key, JSON.stringify(data), (err) => {
    callback(err)
  })
}

exports.del = (db, path, callback) => {
  key = path.join('|')
  db.del(key, (err) => {
    callback(err)
  })
}

exports.get = (db, path, callback) => {
  key = path.join('|')
  db.get(key, (err, results) => {
    callback(err, results)
  })
}

exports.list = (db, path, opts, callback) => {
  const startKey = path.join('|')
  const lastPathItem = path[path.length-1]
  const lastChar = lastPathItem[lastPathItem.length-1]

  let endKey = path.join('|')

  endKey = endKey.split('')
  endKey[endKey.length - 1] = nextLetter(lastChar)
  endKey = endKey.join('')

  const query = {
    gte: startKey,
    lt: endKey
  }

  stream = db.createReadStream(query)

  let count = 0
  let items = []
  const limit = opts.limit || 1000
  const offset = opts.offset || 0

  stream.on('data', (data) => {
    const namespace = []
    for (var iPath in path) {
      namespace.push(data.key.split('|')[iPath])
    }


    if (namespace.join('|') != startKey) {
      return
    }

    count += 1

    const item = JSON.parse(data.value)

    if (count >= offset) {
      items.push(item)

      if (items.length >= limit) {
        stream.end()
      }
    }
  })

  stream.on('error', (err) => {
    console.log("STREAM ERR", err)
  })

  stream.on('end', () => {
    callback(null, items)
  })
}

exports.cleanup = (callback) => {
  if (globalDb === undefined) {
    return callback(null)
  }

  globalDb.close((err) => {
    if (err) {return callback(err)}

    rimraf(dbs.dir, (err) => {
      globalDb = undefined
      callback(err)
    })
  })
}