const http = require('http');
const server = http.createServer(function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8080');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.writeHead(200);

  const data = {
    items: [
      {
        id: 'Spring',
        text: 'Earrach'
      },
      {
        id: 'Summer',
        text: 'Samhradh'
      },
      {
        id: 'Autumn',
        text: 'Fómhar'
      },
      {
        id: 'Winter',
        text: 'Geimhreadh'
      }
    ],
    more: false
  };

  res.end(JSON.stringify(data));
});

server.listen(8081);