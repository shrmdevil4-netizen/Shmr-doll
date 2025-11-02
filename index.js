// index.js - نقطة البداية الرئيسية للبوت
import express from 'express';
import { startBot } from './client.js';

// إنشاء خادم Express لـ health checks (مطلوب لـ Render)
const app = express();
const PORT = process.env.PORT || 10000;

// Health check endpoint لـ Render
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'online',
    message: 'Discord Bot is running!',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Ping endpoint
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    service: 'discord-gemini-bot'
  });
});

// بدء تشغيل الخادم
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 خادم HTTP يعمل على المنفذ ${PORT}`);
  console.log(`✅ Health check متاح على: http://localhost:${PORT}/health`);
});

// بدء تشغيل بوت ديسكورد
console.log('🚀 جاري تشغيل بوت ديسكورد...');
startBot();

// معالجة إشارات الإيقاف بشكل صحيح
process.on('SIGTERM', () => {
  console.log('📴 تم استلام إشارة SIGTERM، جاري الإيقاف...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📴 تم استلام إشارة SIGINT، جاري الإيقاف...');
  process.exit(0);
});
