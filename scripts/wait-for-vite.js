// Wait for Vite dev server to be ready
const http = require('http');

const checkServer = () => {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:5173', (res) => {
      resolve(true);
    });
    req.on('error', () => {
      resolve(false);
    });
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
};

const wait = async () => {
  console.log('Waiting for Vite dev server...');
  let attempts = 0;
  const maxAttempts = 30;
  
  while (attempts < maxAttempts) {
    const ready = await checkServer();
    if (ready) {
      console.log('Vite dev server is ready!');
      return;
    }
    attempts++;
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.error('Vite dev server did not start in time');
  process.exit(1);
};

wait();
