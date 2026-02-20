const axios = require('axios');

async function runTests() {
    const baseURL = 'http://localhost:5000/api';
    const testUser = {
        username: 'testuser_' + Date.now(),
        email: 'test' + Date.now() + '@kodbank.com',
        password: 'Password123!',
        phone: '9876543210'
    };

    try {
        console.log('--- Testing Registration ---');
        const regRes = await axios.post(`${baseURL}/register`, testUser);
        console.log('Registration Success:', regRes.data);

        console.log('\n--- Testing Login ---');
        const loginRes = await axios.post(`${baseURL}/login`, {
            username: testUser.username,
            password: testUser.password
        });
        console.log('Login Success:', loginRes.data);
        console.log('Cookies received:', loginRes.headers['set-cookie']);

        const tokenCookie = loginRes.headers['set-cookie'][0];

        console.log('\n--- Testing Balance Check ---');
        const balRes = await axios.get(`${baseURL}/balance`, {
            headers: {
                Cookie: tokenCookie
            }
        });
        console.log('Balance Check Success:', balRes.data);

    } catch (error) {
        console.error('Test Failed:', error.response ? error.response.data : error.message);
        process.exit(1);
    }
}

runTests();
