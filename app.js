const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

const connectDB = require('./config/db');
const initCronJobs = require('./jobs/cronJobs');
const { errorHandler } = require('./middleware/errorMiddleware');

// Import routes
const authRoutes = require('./routes/authRoutes');
const leadRoutes = require('./routes/leadRoutes');
const templateRoutes = require('./routes/templateRoutes');
const followUpRoutes = require('./routes/followUpRoutes');
const communicationRoutes = require('./routes/communicationRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const auditLogRoutes = require('./routes/auditLogRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const approvalRoutes = require('./routes/approvalRoutes');

const app = express();

// Connect MongoDB
connectDB();

// Initialize Cron jobs
initCronJobs();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/followups', followUpRoutes);
app.use('/api/communications', communicationRoutes);
app.use('/api/reports', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/approvals', approvalRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'Kevalon Technology Outreach CRM',
    timestamp: new Date()
  });
});

// Serve frontend static build files if client/dist exists
const clientDistPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Central Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`[Server] Running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  console.log(`[Server] Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;
