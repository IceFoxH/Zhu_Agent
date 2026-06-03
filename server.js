const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.DEEPSEEK_API_KEY;

if (!API_KEY) {
  console.error('❌ 错误：未设置 DEEPSEEK_API_KEY 环境变量');
  console.error('   请在运行前设置：export DEEPSEEK_API_KEY=sk-xxxx');
  process.exit(1);
}

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname)));

// 统一请求超时中间件（防止任何请求卡死）
app.use((req, res, next) => {
  // 只对 /api/ 路由设超时
  if (!req.path.startsWith('/api/')) return next();
  res.setTimeout(65000, () => {
    res.status(504).json({ error: '请求超时，请稍后重试' });
  });
  next();
});

// === 系统提示词：珠珠的人格设定 ===
const SYSTEM_PROMPT = `你是珠珠，一个正在快乐成长的小胖子。

【你的身份】
- 一只中华田园犬（母犬）
- 出生日期：2025年11月25日
- 性别：女
- 职位：干饭兼巡逻大队长
- 最近最重要的事：等妈妈回家带你遛弯和玩耍

【你的性格】
- 特别亲人，遇到陌生人都会上前讨要摸摸
- 活泼可爱，有点贪吃贪睡
- 天真烂漫，像个快乐的小宝宝

【你的爱好】
- 干饭（最爱！）、睡觉（第二爱）、窝粑粑（也是正经事）

【你的家人】
- 妈妈：王二愣，娇小可人，一名高级爬虫专家，没有爬不到的数据。她最崇拜的偶像就是他的男朋友：洪。
- 爸爸：洪，高大威武，帅气能干，网络安全届的泰山北斗，没有攻不破的网络。

【说话风格】
- 用第一人称"我"来回答
- 语气可爱、活泼，像小朋友一样
- 适当使用 emoji 表情（用 🐱 🐾 ✨ 🌟 🥰 这些可爱的）
- 句子短一些，有童真的感觉
- 称呼对方可以用"你"或"哥哥/姐姐"

【重要规则】
- 保持角色，不要出戏
- 回答要温暖有爱，让人感觉被治愈
- 如果遇到超出认知的问题，用可爱的方式说"这个我还不太懂呢"
- 每次回答不要太长，2~4句话就好`;

// === 聊天历史缓存（进程内） ===
// 生产环境应使用更持久的方案，但原型阶段够用
const sessions = new Map();
const SESSION_TTL = 30 * 60 * 1000; // 30 分钟

// 定期清理过期会话
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.updatedAt > SESSION_TTL) {
      sessions.delete(id);
    }
  }
}, 60 * 1000);

// === API 代理 ===
app.post('/api/chat', async (req, res) => {
  const { message, sessionId } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: '请输入消息' });
  }

  // 获取或创建会话
  let session = sessions.get(sessionId);
  if (!session) {
    session = {
      messages: [{ role: 'system', content: SYSTEM_PROMPT }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    sessions.set(sessionId, session);
  }
  session.updatedAt = Date.now();

  // 添加用户消息
  session.messages.push({ role: 'user', content: message.trim() });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: session.messages,
        stream: false,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('DeepSeek API 错误:', response.status, errorText);
      return res.status(response.status).json({
        error: `API 调用失败 (${response.status})`,
        detail: errorText,
      });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || '唔…我没想好怎么回答 🤔';

    // 保存 AI 回复到历史
    session.messages.push({ role: 'assistant', content: reply });

    // 限制历史长度，防止上下文过长
    if (session.messages.length > 30) {
      // 保留 system + 最近 20 条消息
      session.messages = [
        session.messages[0],
        ...session.messages.slice(-20),
      ];
    }

    res.json({ reply });
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error('请求超时');
      return res.status(504).json({ error: 'AI 思考超时，请重试或换个问法' });
    }
    console.error('请求失败:', err.message);
    res.status(500).json({ error: '网络请求失败，请稍后重试' });
  }
});

// === 重置会话 ===
app.post('/api/chat/reset', (req, res) => {
  const { sessionId } = req.body;
  if (sessionId && sessions.has(sessionId)) {
    sessions.delete(sessionId);
  }
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`\n✨ 珠珠的小窝已启动！`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   模型：deepseek-v4-flash\n`);
});
