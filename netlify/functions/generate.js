/**
 * Netlify Function: generate
 * 使用 Node.js 内置 https 模块直接调用 DeepSeek API，无外部依赖
 */
const https = require('https');

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type'
};

/** 调用 DeepSeek API */
function callDeepSeek(apiKey, prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'deepseek-chat',
      max_tokens: 6000,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }]
    });

    const req = https.request({
      hostname: 'api.deepseek.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error('API响应解析失败: ' + data.substring(0, 300)));
        }
      });
    });

    req.setTimeout(24000, () => {
      req.destroy();
      reject(new Error('请求超时，请稍后重试'));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: '未配置 DEEPSEEK_API_KEY 环境变量，请在 Netlify 控制台添加' }) };
  }

  try {
    const { destination, budget, days, preferences } = JSON.parse(event.body || '{}');

    const filled = [
      destination?.trim(),
      budget > 0 ? budget : null,
      days > 0 ? days : null,
      preferences?.length > 0 ? preferences : null
    ].filter(Boolean);

    if (filled.length < 2) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: '请至少填写两个条件（目的地、旅行天数、预算、旅游偏好中任意两个）' }) };
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

请严格以JSON格式返回（不要包含任何代码块标记或其他文字）：

{
  "overview": {
    "title": "旅游攻略标题（富有吸引力）",
    "destination": "目的地名称",
    "days": 天数数字,
    "budget": "总预算描述",
    "summary": "目的地综合介绍（150-200字）",
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
      "theme": "今日主题",
      "imageKeyword": "代表今日景色的英文关键词",
      "schedule": [
        {
          "time": "09:00",
          "activity": "活动名称",
          "location": "具体地点",
          "lat": 纬度数字,
          "lng": 经度数字,
          "duration": "建议时长",
          "description": "详细描述（60-100字）",
          "tips": "实用小贴士",
          "estimatedCost": "参考费用"
        }
      ],
      "meals": {
        "breakfast": { "name": "推荐早餐", "description": "特色介绍", "pricePerPerson": "人均价格", "searchKeyword": "大众点评搜索词" },
        "lunch": { "name": "推荐午餐餐厅", "cuisine": "菜系", "description": "招牌菜介绍", "pricePerPerson": "人均价格", "address": "大致位置", "searchKeyword": "大众点评搜索词" },
        "dinner": { "name": "推荐晚餐餐厅", "cuisine": "菜系", "description": "招牌菜介绍", "pricePerPerson": "人均价格", "address": "大致位置", "searchKeyword": "大众点评搜索词" }
      },
      "accommodation": { "name": "推荐住宿", "type": "住宿类型", "pricePerNight": "每晚价格", "address": "大致位置", "description": "住宿特色", "searchKeyword": "携程/美团搜索词" }
    }
  ],
  "restaurants": [
    { "name": "餐厅名称", "cuisine": "菜系", "priceRange": "人均消费", "specialty": "招牌菜", "location": "位置描述", "searchKeyword": "大众点评搜索关键词", "reason": "推荐理由", "openHours": "营业时间" }
  ],
  "hotels": [
    { "name": "住宿名称", "type": "类型", "pricePerNight": "每晚价格", "stars": "星级", "location": "位置描述", "features": ["特点1", "特点2"], "searchKeyword": "携程搜索关键词", "suitable": "适合人群" }
  ],
  "transportation": {
    "arrival": "抵达目的地的详细交通建议",
    "local": "当地交通方式说明",
    "tips": ["交通贴士1", "交通贴士2", "交通贴士3"]
  },
  "shopping": [
    { "name": "购物地点", "type": "购物类型", "specialty": "主要商品", "priceRange": "价格区间", "location": "位置", "tips": "购物建议" }
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
    "essentials": ["必带物品1", "必带物品2", "必带物品3"],
    "cultural": ["文化礼仪注意事项1", "注意事项2"],
    "practical": ["实用建议1", "实用建议2", "实用建议3", "实用建议4"]
  },
  "videoSearchKeyword": "B站视频搜索关键词"
}`;

    const apiResp = await callDeepSeek(apiKey, prompt);

    if (apiResp.error) {
      throw new Error(apiResp.error.message || 'DeepSeek API 调用失败');
    }

    const itinerary = JSON.parse(apiResp.choices[0].message.content);

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ success: true, data: itinerary })
    };

  } catch (error) {
    console.error('生成错误:', error.message);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: error.message || '生成攻略失败，请稍后重试' })
    };
  }
};
