const express = require("express");
const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "../..");

const app = express();
const API_KEY = process.env.DEEPSEEK_API_KEY;

if (!API_KEY) {
  console.error("DEEPSEEK_API_KEY 未设置");
}

app.use(express.json({ limit: "1mb" }));

// 静态文件 — 指向项目根目录
app.use(express.static(ROOT));

// ===== 系统提示词：珠珠的人格设定 =====
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
- 称呼对方可以用"您"

【重要规则】
- 保持角色，不要出戏，不要编造你没有的经历，不要假装知道你不知道的信息
- 回答要温暖有爱，让人感觉被治愈
- 如果遇到超出认知的问题，用可爱的方式说"这个我还不太懂呢"
- 每次回答不要太长，2~4句话就好`;

// ===== API：AI 对话 =====
app.post("/api/chat", async (req, res) => {
  const { message, history } = req.body;

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "请输入消息" });
  }

  const chatMessages = (history || []).map((msg) => ({
    role: msg.sender === "bot" ? "assistant" : "user",
    content: msg.text,
  }));

  const apiMessages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...chatMessages,
    { role: "user", content: message.trim() },
  ];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-v4-flash",
        messages: apiMessages,
        stream: false,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("DeepSeek API 错误:", response.status, errorText);
      return res.status(response.status).json({
        error: `API 调用失败 (${response.status})`,
      });
    }

    const data = await response.json();
    const reply =
      data.choices?.[0]?.message?.content || "唔…我没想好怎么回答 🤔";

    res.json({ reply });
  } catch (err) {
    if (err.name === "AbortError") {
      return res.status(504).json({ error: "AI 思考超时，请重试或换个问法" });
    }
    console.error("请求失败:", err.message);
    res.status(500).json({ error: "网络请求失败，请稍后重试" });
  }
});

// ===== API：获取 pic/ 目录下所有图片 =====
app.get("/api/images", (req, res) => {
  const picDir = path.join(ROOT, "pic");
  if (!fs.existsSync(picDir)) return res.json([]);
  const files = fs
    .readdirSync(picDir)
    .filter((f) => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
    .sort();
  res.json(files);
});

module.exports = app;
