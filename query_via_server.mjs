import http from 'http';

// Make a request to the server's tRPC endpoint to get the profile
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/trpc/users.getProfile?input=%7B%7D',
  method: 'GET',
  headers: {
    'Cookie': 'app_session_id=your_session_here'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Response:', data);
  });
});

req.on('error', (e) => {
  console.error('Error:', e);
});

req.end();
