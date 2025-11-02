// tokens.js - إدارة المفاتيح السرية بشكل آمن
import dotenv from 'dotenv';
dotenv.config();

export const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// التحقق من وجود المفاتيح
if (!DISCORD_TOKEN) {
  console.error('❌ خطأ: DISCORD_TOKEN غير موجود في متغيرات البيئة');
  process.exit(1);
}

if (!GEMINI_API_KEY) {
  console.error('❌ خطأ: GEMINI_API_KEY غير موجود في متغيرات البيئة');
  process.exit(1);
}

console.log('✅ تم تحميل المفاتيح السرية بنجاح');
