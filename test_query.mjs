import fetch from 'node-fetch';

// Query the API endpoint that calls getProfile
const response = await fetch('http://localhost:3000/api/auth/me', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
});

console.log('Status:', response.status);
const data = await response.json();
console.log('Response:', JSON.stringify(data, null, 2));
