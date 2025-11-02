// client.js - إعداد وتهيئة بوت ديسكورد
import { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import { GoogleGenAI } from '@google/genai';
import { DISCORD_TOKEN, GEMINI_API_KEY } from './tokens.js';

// إنشاء عميل ديسكورد مع الصلاحيات المطلوبة
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

// تهيئة Google Gemini AI
const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// تخزين سجل المحادثات لكل مستخدم (للسياق)
const conversationHistory = new Map();

// تخزين القنوات المحددة للعمل التلقائي (البوت يرد على كل رسالة فيها)
const autoReplyChannels = new Map();

// الحد الأقصى لطول السجل لكل مستخدم
const MAX_HISTORY_LENGTH = 10;

// دالة للحصول على أو إنشاء سجل محادثة للمستخدم
function getUserHistory(userId) {
  if (!conversationHistory.has(userId)) {
    conversationHistory.set(userId, []);
  }
  return conversationHistory.get(userId);
}

// دالة لإضافة رسالة إلى سجل المستخدم
function addToHistory(userId, role, content) {
  const history = getUserHistory(userId);
  history.push({ role, parts: [{ text: content }] });
  
  // الحفاظ على حجم السجل محدود
  if (history.length > MAX_HISTORY_LENGTH * 2) {
    history.splice(0, 2); // إزالة أقدم تبادل (سؤال + جواب)
  }
}

// دالة لمسح سجل المستخدم
function clearUserHistory(userId) {
  conversationHistory.delete(userId);
}

// دالة للتحقق من أن القناة للرد التلقائي
function isAutoReplyChannel(guildId, channelId) {
  if (!autoReplyChannels.has(guildId)) {
    return false;
  }
  const guildChannels = autoReplyChannels.get(guildId);
  return guildChannels.has(channelId);
}

// دالة لتعيين قناة للرد التلقائي
function setAutoReplyChannel(guildId, channelId) {
  if (!autoReplyChannels.has(guildId)) {
    autoReplyChannels.set(guildId, new Set());
  }
  autoReplyChannels.get(guildId).add(channelId);
}

// دالة لإزالة قناة من الرد التلقائي
function removeAutoReplyChannel(guildId, channelId) {
  if (autoReplyChannels.has(guildId)) {
    autoReplyChannels.get(guildId).delete(channelId);
  }
}

// دالة لمسح جميع قنوات الرد التلقائي
function clearAutoReplyChannels(guildId) {
  autoReplyChannels.delete(guildId);
}

// دالة للحصول على قائمة قنوات الرد التلقائي
function getAutoReplyChannels(guildId) {
  return autoReplyChannels.get(guildId) || new Set();
}

// دالة للحصول على رد ذكي من Gemini مع السياق
async function getAIResponse(userId, message) {
  try {
    const history = getUserHistory(userId);
    
    // إضافة رسالة المستخدم الجديدة
    const userMessage = { role: 'user', parts: [{ text: message }] };
    
    // بناء المحادثة الكاملة
    const fullConversation = [...history, userMessage];
    
    // استدعاء Gemini API - الطريقة الصحيحة
    const result = await genAI.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: fullConversation,
      config: {
        systemInstruction: `أنت مساعد ذكي ومفيد في ديسكورد. 
يمكنك:
- الإجابة على الأسئلة بدقة واحترافية
- البحث عن المعلومات وتقديمها بطريقة منظمة
- فهم السياق والمحادثات السابقة
- التعامل مع الأسئلة الصعبة والمعقدة
- الرد باللغة العربية أو الإنجليزية حسب لغة السؤال

كن مفيداً ودقيقاً في إجاباتك.`
      }
    });
    
    const responseText = result.text || 'عذراً، لم أتمكن من معالجة طلبك.';
    
    // إضافة الرسالة والرد إلى السجل
    addToHistory(userId, 'user', message);
    addToHistory(userId, 'model', responseText);
    
    return responseText;
  } catch (error) {
    console.error('خطأ في الحصول على رد من Gemini:', error);
    console.error('تفاصيل الخطأ:', error.message);
    if (error.response) {
      console.error('رد الخطأ:', error.response);
    }
    return 'عذراً، حدث خطأ أثناء معالجة طلبك. الرجاء المحاولة مرة أخرى.';
  }
}

// تعريف Slash Commands
const commands = [
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('عرض قائمة الأوامر والمساعدة'),
  
  new SlashCommandBuilder()
    .setName('ask')
    .setDescription('اسأل البوت أي سؤال')
    .addStringOption(option =>
      option.setName('question')
        .setDescription('اكتب سؤالك هنا')
        .setRequired(true)
    ),
  
  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('مسح سجل المحادثة الخاص بك'),
  
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('فحص سرعة استجابة البوت'),
  
  new SlashCommandBuilder()
    .setName('setchannel')
    .setDescription('تحديد قناة للرد التلقائي (البوت يرد على كل رسالة فيها)')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('القناة المراد تحديدها للرد التلقائي')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  
  new SlashCommandBuilder()
    .setName('removechannel')
    .setDescription('إزالة قناة من الرد التلقائي')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('القناة المراد إزالتها')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  
  new SlashCommandBuilder()
    .setName('listchannels')
    .setDescription('عرض القنوات المحددة للرد التلقائي')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  
  new SlashCommandBuilder()
    .setName('clearallchannels')
    .setDescription('إزالة جميع القنوات من الرد التلقائي')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
];

// تسجيل الأوامر عند تشغيل البوت
async function registerCommands() {
  try {
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    
    console.log('🔄 جاري تسجيل slash commands...');
    
    // تسجيل الأوامر بشكل عام (global commands)
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands.map(cmd => cmd.toJSON()) }
    );
    
    console.log('✅ تم تسجيل slash commands بنجاح!');
  } catch (error) {
    console.error('❌ خطأ في تسجيل slash commands:', error);
  }
}

// عند جاهزية البوت
client.on('ready', async () => {
  console.log(`✅ تم تسجيل الدخول كـ ${client.user.tag}`);
  console.log(`📊 البوت متصل بـ ${client.guilds.cache.size} سيرفر`);
  
  // تسجيل الأوامر
  await registerCommands();
  
  // تعيين حالة البوت
  client.user.setActivity('🤖 استخدم /help للمساعدة', { type: 0 });
});

// معالجة Slash Commands
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  
  const { commandName, guildId, channelId } = interaction;
  
  try {
    if (commandName === 'help') {
      const helpEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🤖 مساعد ذكي - الأوامر المتاحة')
        .setDescription('أنا بوت ذكي يستخدم Google Gemini AI للإجابة على أسئلتك')
        .setThumbnail(client.user.displayAvatarURL())
        .addFields(
          { 
            name: '💬 الأوامر الأساسية', 
            value: '`/ask` - اسأل البوت أي سؤال\n`/clear` - مسح سجل المحادثة\n`/ping` - فحص سرعة الاستجابة\n`/help` - عرض هذه الرسالة' 
          },
          { 
            name: '⚙️ أوامر الإدارة', 
            value: '`/setchannel` - تحديد قناة للرد التلقائي\n`/removechannel` - إزالة قناة من الرد التلقائي\n`/listchannels` - عرض القنوات المحددة\n`/clearallchannels` - إزالة جميع القنوات' 
          },
          { 
            name: '✨ القدرات', 
            value: '• الإجابة على الأسئلة المعقدة\n• فهم السياق والمحادثات السابقة\n• البحث عن المعلومات\n• الدعم باللغة العربية والإنجليزية\n• الرد التلقائي في القنوات المحددة' 
          },
          {
            name: '🎯 طريقة الاستخدام',
            value: 'حدد قناة بأمر `/setchannel` ثم اكتب مباشرة في تلك القناة، البوت سيرد تلقائياً!'
          }
        )
        .setFooter({ text: 'Powered by Google Gemini AI' })
        .setTimestamp();
      
      await interaction.reply({ embeds: [helpEmbed] });
    }
    
    else if (commandName === 'ask') {
      const question = interaction.options.getString('question');
      
      await interaction.deferReply();
      
      const response = await getAIResponse(interaction.user.id, question);
      
      // تقسيم الرد إذا كان طويلاً
      if (response.length <= 2000) {
        await interaction.editReply(response);
      } else {
        const chunks = response.match(/.{1,1900}/g) || [];
        await interaction.editReply(chunks[0]);
        for (let i = 1; i < chunks.length; i++) {
          await interaction.followUp(chunks[i]);
        }
      }
    }
    
    else if (commandName === 'clear') {
      clearUserHistory(interaction.user.id);
      await interaction.reply({ content: '✅ تم مسح سجل المحادثة الخاص بك!', ephemeral: true });
    }
    
    else if (commandName === 'ping') {
      const sent = await interaction.reply({ content: '🏓 جاري الفحص...', fetchReply: true });
      const latency = sent.createdTimestamp - interaction.createdTimestamp;
      const apiLatency = Math.round(client.ws.ping);
      
      const pingEmbed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('🏓 Pong!')
        .addFields(
          { name: '📨 زمن الرد', value: `${latency}ms`, inline: true },
          { name: '🌐 زمن الـ API', value: `${apiLatency}ms`, inline: true }
        )
        .setTimestamp();
      
      await interaction.editReply({ content: '', embeds: [pingEmbed] });
    }
    
    else if (commandName === 'setchannel') {
      const channel = interaction.options.getChannel('channel');
      setAutoReplyChannel(guildId, channel.id);
      await interaction.reply({ 
        content: `✅ تم تحديد القناة ${channel} للرد التلقائي!\n\nالآن البوت سيرد على جميع الرسائل في هذه القناة تلقائياً.`, 
        ephemeral: true 
      });
    }
    
    else if (commandName === 'removechannel') {
      const channel = interaction.options.getChannel('channel');
      removeAutoReplyChannel(guildId, channel.id);
      await interaction.reply({ 
        content: `✅ تم إزالة القناة ${channel} من الرد التلقائي!`, 
        ephemeral: true 
      });
    }
    
    else if (commandName === 'listchannels') {
      const channels = getAutoReplyChannels(guildId);
      
      if (channels.size === 0) {
        await interaction.reply({ 
          content: '📋 لا توجد قنوات محددة للرد التلقائي.\nاستخدم `/setchannel` لتحديد قناة.', 
          ephemeral: true 
        });
      } else {
        const channelList = Array.from(channels).map(id => `<#${id}>`).join('\n');
        await interaction.reply({ 
          content: `📋 القنوات المحددة للرد التلقائي:\n${channelList}`, 
          ephemeral: true 
        });
      }
    }
    
    else if (commandName === 'clearallchannels') {
      clearAutoReplyChannels(guildId);
      await interaction.reply({ 
        content: '✅ تم إزالة جميع القنوات من الرد التلقائي!', 
        ephemeral: true 
      });
    }
    
  } catch (error) {
    console.error('خطأ في معالجة الأمر:', error);
    const errorMessage = '❌ عذراً، حدث خطأ أثناء تنفيذ الأمر.';
    
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
});

// معالجة الرسائل العادية
client.on('messageCreate', async (message) => {
  // تجاهل رسائل البوتات
  if (message.author.bot) return;
  
  // تجاهل الرسائل الفارغة
  if (!message.content.trim()) return;
  
  // التحقق من ذكر البوت
  const botMentioned = message.mentions.has(client.user);
  
  // التحقق من الرد على رسالة البوت
  let isReplyToBot = false;
  if (message.reference) {
    try {
      const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
      isReplyToBot = repliedMessage.author.id === client.user.id;
    } catch (error) {
      isReplyToBot = false;
    }
  }
  
  // التحقق من أن القناة محددة للرد التلقائي
  const isAutoChannel = message.guildId && isAutoReplyChannel(message.guildId, message.channelId);
  
  // إذا تم ذكر البوت أو الرد عليه أو كانت القناة محددة للرد التلقائي
  if (botMentioned || isReplyToBot || isAutoChannel) {
    // إزالة mention من النص
    let userMessage = message.content
      .replace(/<@!?\d+>/g, '')
      .trim();
    
    if (!userMessage) {
      return message.reply('مرحباً! كيف يمكنني مساعدتك؟ 😊');
    }
    
    // إظهار أن البوت يكتب
    await message.channel.sendTyping();
    
    try {
      // الحصول على الرد من AI
      const response = await getAIResponse(message.author.id, userMessage);
      
      // تقسيم الرد إذا كان طويلاً جداً
      if (response.length <= 2000) {
        return message.reply(response);
      } else {
        const chunks = response.match(/.{1,1900}/g) || [];
        for (let i = 0; i < chunks.length; i++) {
          if (i === 0) {
            await message.reply(chunks[i]);
          } else {
            await message.channel.send(chunks[i]);
          }
          if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }
    } catch (error) {
      console.error('خطأ في معالجة الرسالة:', error);
      return message.reply('❌ عذراً، حدث خطأ أثناء معالجة رسالتك. الرجاء المحاولة مرة أخرى.');
    }
  }
});

// معالجة الأخطاء
client.on('error', (error) => {
  console.error('❌ خطأ في عميل Discord:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ خطأ غير معالج:', error);
});

// تسجيل دخول البوت
export async function startBot() {
  try {
    await client.login(DISCORD_TOKEN);
  } catch (error) {
    console.error('❌ فشل تسجيل دخول البوت:', error);
    process.exit(1);
  }
}

export { client };
