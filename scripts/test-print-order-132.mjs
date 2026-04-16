import fetch from 'node-fetch';

async function main() {
  try {
    // Call the tRPC endpoint
    const response = await fetch('http://127.0.0.1:3000/api/trpc/print.createPrintJob', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        json: {
          orderId: 132,
          storeId: 1
        }
      })
    });

    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main();
