import express from 'express';
import redis from 'redis';

let io = require('socket.io');

const redisClient = redis.createClient();

const app = express();
const port = 3000;

app.use(express.static(`${__dirname}/static`));

app.get('/', (req, res) => res.send('Hello World!'));

const server = app.listen(port, () => console.log(`Example app listening on port ${port}!`));

redisClient.subscribe('testpubsub');

io = io.listen(server);

io.on('connection', (socket) => {
  redisClient.on('message', (channel, message) => {
    socket.emit('pubsub', { channel, message });
  });
});
