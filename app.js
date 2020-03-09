import express from 'express';
import bodyParser from 'body-parser';
import redis from 'redis';
import flow from 'flow-maintained';

const client = redis.createClient();

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const CreateUser = (username, name, cb) => {
  client.incr('next:user:id', (err, userid) => {
    flow.exec(
      function () {
        const userString = `user:${userid}`;
        client.set(
          `user:${username}`,
          userid,
          this.MULTI(),
        );
        client.hset(userString, 'name', name, this.MULTI());
        client.hset(
          userString,
          'username',
          username,
          this.MULTI(),
        );
      },
      () => {
        cb(userid);
      },
    );
  });
};

const GetUserID = (username, name, cb) => {
  client.get(`user:${username}`, (err, userid) => {
    if (userid) {
      cb(userid);
    } else {
      CreateUser(username, name, (newUser) => {
        cb(newUser);
      });
    }
  });
};

const AddMessage = (message, userid, cb) => {
  client.incr('next:message:id', (err, id) => {
    flow.exec(
      function () {
        const messId = `message:${id}`;
        client.set(messId, message, this.MULTI());
        client.set(`${messId}:user`, userid, this.MULTI());
        client.lpush('messages', id, this.MULTI());
      },
      () => {
        cb(id);
      },
    );
  });
};

const FetchMessage = (id, cb) => {
  client.get(`message:${id}`, (err, message) => {
    client.get(`message:${id}:user`, (err, userid) => {
      if (err) {
        console.log(err);
      }
      client.hget(`user:${userid}`, 'name', (err, name) => {
        if (err) {
          console.log(err);
        }
        cb({ message, name });
      });
    });
  });
};

const GetMessages = (cb) => {
  flow.exec(
    function () {
      client.lrange('messages', 0, -1, this);
    },
    (err, messages) => {
      const finalMessages = [];
      flow.serialForEach(
        messages,
        function (el) {
          FetchMessage(el, this);
        },
        (mess) => {
          finalMessages.push(mess);
        },
        () => {
          cb(finalMessages);
        },
      );
    },
  );
};

// app.get('/', (req, res) => {
//   client.incr('test', (err, counter) => {
//     res.json(counter);
//   });
// });
app.get('/', (req, res) => {
  GetMessages((messages) => {
    res.json(messages);
  });
});
app.post('/', (req, res) => {
  const { username } = req.body;
  const { name } = req.body;
  GetUserID(username, name, (userid) => {
    AddMessage(req.body.message, userid, (messid) => {
      console.log(`Added message: ${messid}`);
      res.redirect('/');
    });
  });
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
