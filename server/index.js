const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/users', require('./routes/users'));
app.use('/api/items', require('./routes/items'));
app.use('/api/departments', require('./routes/departments'));
app.use('/api/purchase-orders', require('./routes/purchaseOrders'));
app.use('/api/charge-outs', require('./routes/chargeOuts'));
app.use('/api/gl-swaps', require('./routes/glSwaps'));
app.use('/api/printers', require('./routes/printers'));
app.use('/api/toner', require('./routes/toner'));
app.use('/api/toner-charge-outs', require('./routes/tonerChargeOuts'));
app.use('/api/reports', require('./routes/reports'));

if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`IT Inventory server running on http://localhost:${PORT}`);
});
