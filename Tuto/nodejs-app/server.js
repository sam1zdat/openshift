const express = require('express');
   const app = express();
   const port = process.env.PORT || 8080;
   
   app.get('/', (req, res) => {
     res.send('Hello from Node.js on OpenShift!');
   });
   
   app.get('/health', (req, res) => {
     res.status(200).send('OK');
   });
   
   app.get('/api/info', (req, res) => {
     res.json({
       app: 'nodejs-sample',
       version: '1.0.0',
       environment: process.env.NODE_ENV || 'development',
       hostname: require('os').hostname()
     });
   });
   
   app.listen(port, () => {
     console.log(`Server running on port ${port}`);
   });