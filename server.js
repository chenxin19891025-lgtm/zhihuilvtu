require('dotenv').config();
const express = require('express');
const OpenAI = require('openai');
const path = require('path');

if (!process.env.DEEPSEEK_API_KEY) {
  console.error('❌ 错误: 未设置 DEEPSEEK_API_KEY，请在 .env 文件中配置');
  process.exit(1);
}

const app = express();
const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com'
});

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/generate', async (req, res) => {
  try {
    const { destination, budget, days, preferences } = req.body;

    // 校验至少两个条件
    const filled = [
      destination?.trim(),
      budget > 0 ? budget : null,
      days > 0 ? days : null,
      preferences?.length > 0 ? preferences : null
    ].filter(Boolean);

    if (filled.length < 2) {
      return res.status(400).json({
        error: '请至少填写两个条件（目的地、旅行天数、预算、旅游偏好中任意两个）'
      });
    }

    const lines = [];
    if (destination?.trim()) lines.push(`目的地：${destination.trim()}`);
    if (days > 0) lines.push(`旅行天数：${days}天`);
    if (budget > 0) lines.push(`总预算：${budget}元人民币（按人均计算）`);
    if (preferences?.length > 0) lines.push(`旅游偏好：${preferences.join('、')}`);

    const prompt = `你是一位经验丰富的专业旅游规划师，拥有丰富的全球旅行知识和实地经验。请根据以下旅行条件，生成一份详尽、实用的个性化旅游攻略。

旅行条件：
${lines.join('\n')}

核心要求：
1. 所有景点的GPS坐标必须精确真实（精确至小数点后4位）
2. 推荐的餐厅和酒店应为目的地真实存在的知名场所
3. 每日行程合理安排，考虑景点距离和游览时长
4. 预算分配符合目的地实际消费水平
5. 如未指定目的地，根据其他条件智能推荐最合适目的地
6. 行程内容丰富有趣，兼顾深度体验和休闲时光

请严格以JSON格式返回（不要包含任何代码块标记或其他文字）：

{
  "overview": {
    "title": "旅游攻略标题（富有吸引力）",
    "destination": "目的地名称",
    "days": 天数数字,
    "budget": "总预算描述",
    "summary": "目的地综合介绍（150-200字，涵盖地理位置、文化特色、最适合的旅游体验）",
    "bestSeason": "最佳旅游季节及推荐理由",
    "highlights": ["核心亮点1", "核心亮点2", "核心亮点3", "核心亮点4", "核心亮点5"]
  },
  "locations": [
    {
      "id": 1,
      "name": "景点或地点名称",
      "lat": 纬度数字,
      "lng": 经度数字,
      "day": 属于第几天数字,
      "order": 当天参观顺序数字,
      "type": "类型（古迹/自然景观/餐厅/购物/文化体验）",
      "description": "40字简介"
    }
  ],
  "itinerary": [
    {
      "day": 1,
      "theme": "今日主题（如：古城探秘 · 感受千年历史）",
      "imageKeyword": "代表今日景色的英文关键词（如：ancient chinese town lijiang）",
      "schedule": [
        {
          "time": "09:00",
          "activity": "活动名称",
          "location": "具体地点",
          "lat": 纬度数字,
          "lng": 经度数字,
          "duration": "建议时长（如：2-3小时）",
          "description": "详细描述（60-100字，包含景点特色和参观建议）",
          "tips": "实用小贴士",
          "estimatedCost": "参考费用（如：免费/50元/人）"
        }
      ],
      "meals": {
        "breakfast": {
          "name": "推荐早餐选项",
          "description": "早餐特色和推荐食物",
          "pricePerPerson": "人均价格",
          "searchKeyword": "大众点评搜索词"
        },
        "lunch": {
          "name": "推荐午餐餐厅名称",
          "cuisine": "菜系",
          "description": "招牌菜和用餐体验",
          "pricePerPerson": "人均价格",
          "address": "大致位置",
          "searchKeyword": "大众点评搜索词"
        },
        "dinner": {
          "name": "推荐晚餐餐厅名称",
          "cuisine": "菜系",
          "description": "招牌菜和用餐体验",
          "pricePerPerson": "人均价格",
          "address": "大致位置",
          "searchKeyword": "大众点评搜索词"
        }
      },
      "accommodation": {
        "name": "推荐住宿名称",
        "type": "住宿类型",
        "pricePerNight": "每晚价格",
        "address": "大致位置",
        "description": "住宿特色和亮点",
        "searchKeyword": "携程/美团搜索词"
      }
    }
  ],
  "restaurants": [
    {
      "name": "餐厅名称",
      "cuisine": "菜系",
      "priceRange": "人均消费",
      "specialty": "招牌菜（2-3道）",
      "location": "位置描述",
      "searchKeyword": "大众点评搜索关键词",
      "reason": "推荐理由（30字）",
      "openHours": "大致营业时间",
      "mustTry": "必点菜品"
    }
  ],
  "hotels": [
    {
      "name": "住宿名称",
      "type": "类型（精品民宿/四星酒店/主题酒店等）",
      "pricePerNight": "每晚价格",
      "stars": "星级或档次",
      "location": "位置描述",
      "features": ["特点1", "特点2", "特点3"],
      "searchKeyword": "携程搜索关键词",
      "suitable": "适合人群"
    }
  ],
  "transportation": {
    "arrival": "抵达目的地的详细交通建议（包含高铁/飞机/汽车等多种方案）",
    "local": "当地交通方式详细说明（地铁/公交/打车/租车等）",
    "tips": ["交通贴士1", "交通贴士2", "交通贴士3", "交通贴士4"]
  },
  "shopping": [
    {
      "name": "购物地点",
      "type": "购物类型（特产市场/商业综合体/古街等）",
      "specialty": "主要商品",
      "priceRange": "价格区间",
      "location": "位置",
      "tips": "购物建议"
    }
  ],
  "budgetBreakdown": {
    "accommodation": 住宿总费用数字,
    "food": 餐饮总费用数字,
    "attractions": 景点门票总费用数字,
    "transportation": 交通总费用数字,
    "shopping": 购物预算数字,
    "misc": 其他费用数字
  },
  "travelTips": {
    "essentials": ["必带物品1", "必带物品2", "必带物品3", "必带物品4"],
    "cultural": ["文化礼仪注意事项1", "注意事项2", "注意事项3"],
    "practical": ["实用建议1", "实用建议2", "实用建议3", "实用建议4", "实用建议5"]
  },
  "videoSearchKeyword": "B站视频搜索关键词（如：丽江旅游攻略2025）"
}`;

    const response = await client.chat.completions.create({
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      max_tokens: 8000,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }]
    });

    const itinerary = JSON.parse(response.choices[0].message.content);

    res.json({ success: true, data: itinerary });

  } catch (error) {
    console.error('生成错误:', error.message);
    res.status(500).json({
      error: error.message || '生成攻略失败，请稍后重试'
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', model: process.env.DEEPSEEK_MODEL || 'deepseek-chat' });
});

// 本地开发时直接启动服务，Vercel 部署时使用 module.exports
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`\n🗺️  智绘旅途 Travel Planner`);
    console.log(`📍 运行地址: http://localhost:${PORT}`);
    console.log(`🤖 AI模型: ${process.env.DEEPSEEK_MODEL || 'deepseek-chat'} (DeepSeek)\n`);
  });
}

module.exports = app;
