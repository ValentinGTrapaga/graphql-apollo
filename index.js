const { ApolloServer } = require('@apollo/server')
const { expressMiddleware } = require('@apollo/server/express4')
const { ApolloServerPluginDrainHttpServer } = require('@apollo/server/plugin/drainHttpServer')
const { makeExecutableSchema } = require('@graphql-tools/schema')
const express = require('express')
const cors = require('cors')
const http = require('http')
const jwt = require('jsonwebtoken')
const { WebSocketServer } = require('ws')
const { useServer } = require('graphql-ws/lib/use/ws')

require('dotenv').config()
const mongoose = require('mongoose');
const User = require('./models/userLibrary')
const typeDefs = require('./typeDefs')
const resolvers = require('./resolvers')

mongoose.set('strictQuery', false)

require('dotenv').config()
const MONGODB_URI = process.env.MONGODB_URI

console.log('connecting to db')

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to db')
  })
  .catch((error) => console.log(error.message))

const start = async () => {
  const app = express()
  const httpServer = http.createServer(app)

  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/',
  })

  const schema = makeExecutableSchema({ typeDefs, resolvers })
  const serverCleanUp = useServer({ schema }, wsServer)

  const server = new ApolloServer({
    schema,
    introspection: true,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer }),
    {
      async serverWillStart () {
        console.log('Server starting up!')
        return {
          async drainServer () {
            await serverCleanUp.dispose()
          }
        }
      }
    }
    ],
  })

  await server.start()

  app.use(
    '/',
    cors(),
    express.json(),
    expressMiddleware(server, {
      context: async ({ req }) => {
        const auth = req ? req.headers.authorization : null
        if (auth && auth.startsWith('Bearer ')) {
          const decodedToken = jwt.verify(auth.substring(7), process.env.JWT_SECRET)
          const currentUser = await User.findById(decodedToken.id)
          return { currentUser }
        } else {
          return null
        }
      },
    }),
  )

  const PORT = 4000

  httpServer.listen(PORT, () =>
    console.log(`Server is now running on http://localhost:${PORT}`)
  )
}

start()
