const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const app = express()
app.use(express.json())

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
let db = null
const intializeDBAndSever = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(1)
  }
}
intializeDBAndSever()

const convertDbObjectToResponseObject = dbObject => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    population: dbObject.population,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  }
}
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`
  const dbUser = await db.get(selectUserQuery)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatched === true) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'lakanushmi')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'lakanushmi', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

app.get('/states/', authenticateToken, async (request, response) => {
  const getStatesQuery = `SELECT * FROM state ORDER BY state_id;`
  const states = await db.all(getStatesQuery)
  response.send(states.map(each => convertDbObjectToResponseObject(each)))
})
app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const oneStateQuery = `SELECT * FROM state WHERE state_id = ${stateId};`
  const oneState = await db.get(oneStateQuery)
  response.send(convertDbObjectToResponseObject(oneState))
})
app.post('/districts/', authenticateToken, async (request, response) => {
  const districtDetails = request.body
  const {districtName, stateId, cases, cured, active, deaths} = districtDetails

  const addDistrictQuery = `
    INSERT INTO district (district_name,state_id,cases,cured,active,deaths) 
    VALUES ('${districtName}',${stateId},${cases},${cured},${active},${deaths});`
  await db.run(addDistrictQuery)
  response.send('District Successfully Added')
})
app.get(
  '/districts/:districtId',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const getdistrictQuery = `
     SELECT * FROM district WHERE district_id = ${districtId};`

    const districtArray = await db.get(getdistrictQuery)
    response.send(convertDbObjectToResponseObject(districtArray))
  },
)

app.delete(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteDistrictQuery = `DELETE FROM district WHERE district_id = ${districtId};`

    await db.run(deleteDistrictQuery)
    response.send('District Removed')
  },
)
app.put(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const districtDetails = request.body

    const {districtName, stateId, cases, cured, active, deaths} =
      districtDetails

    const updatedistrictQuery = `UPDATE district SET district_name='${districtName}',state_id= ${stateId},cases=${cases},cured=${cured},active=${active},deaths=${deaths} WHERE district_id = ${districtId};`
    await db.run(updatedistrictQuery)
    response.send('District Details Updated')
  },
)
app.get(
  '/states/:stateId/stats/',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params

    const totalQuery = `SELECT SUM(cases) as totalCases,SUM(cured) as totalCured,SUM(active) as totalActive,SUM(deaths) as totalDeaths FROM district WHERE state_id = ${stateId};`
    const totalObj = await db.get(totalQuery)
    response.send(totalObj)
  },
)
module.exports = app
