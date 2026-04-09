/**
 * Netlify Function: generate
 * 使用 DeepSeek API（OpenAI 兼容格式）
 * 内置 https 模块，零外部依赖
 */
const https = require('https');

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function callDeepSeek(apiKey, prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: process.env.AI_MODEL || 'deepseek-chat',
      max_tokens: 2500,
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
          reject(new Error('响应解析失败: ' + data.substring(0, 200)));
        }
      });
    });

    req.setTimeout(9000, () => {
      req.destroy();
      reject(new Error('AI响应超时，请稍后重试'));
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
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: '未配置 DEEPSEEK_API_KEY，请在 Netlify 控制台 Environment Variables 中添加' })
    };
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
      return {
        statusCode: 400,
        headers: CORS,
        body: JSON.stringify({ error: '请至少填写两个条件' })
      };
    }

    const lines = [];
    if (destination?.trim()) lines.push(`目的地：${destination.trim()}`);
    if (days > 0) lines.push(`旅行天数：${days}天`);
    if (budget > 0) lines.push(`总预算：${budget}元人民币`);
    if (preferences?.length > 0) lines.push(`旅游偏好：${preferences.join('、')}`);

    const prompt = `你是专业旅游规划师。根据以下条件生成个性化旅游攻略，直接返回JSON，不要加任何代码块标记：

条件：${lines.join('，')}

要求：GPS坐标真实准确，推荐真实存在的餐厅和酒店，如未指定目的地则智能推荐。

返回JSON格式如下：
{
  "overview": {
    "title": "攻略标题",
    "destination": "目的地",
    "days": 天数数字,
    "budget": "预算描述",
    "summary": "目的地介绍100字",
    "bestSeason": "最佳季节",
    "highlights": ["亮点1","亮点2","亮点3","亮点4"]
  },
  "locations": [
    {"id":1,"name":"景点名","lat":纬度,"lng":经度,"day":天数,"order":顺序,"type":"类型","description":"简介"}
  ],
  "itinerary": [
    {
      "day": 1,
      "theme": "今日主题",
      "imageKeyword": "英文图片关键词",
      "schedule": [
        {"time":"09:00","activity":"活动","location":"地点","lat":纬度,"lng":经度,"duration":"时长","description":"描述50字","tips":"贴士","estimatedCost":"费用"}
      ],
      "meals": {
        "breakfast": {"name":"餐厅","description":"介绍","pricePerPerson":"人均","searchKeyword":"搜索词"},
        "lunch": {"name":"餐厅","cuisine":"菜系","description":"介绍","pricePerPerson":"人均","address":"位置","searchKeyword":"搜索词"},
        "dinner": {"name":"餐厅","cuisine":"菜系","description":"介绍","pricePerPerson":"人均","address":"位置","searchKeyword":"搜索词"}
      },
      "accommodation": {"name":"住宿","type":"类型","pricePerNight":"价格","address":"位置","description":"特色","searchKeyword":"搜索词"}
    }
  ],
  "restaurants": [
    {"name":"餐厅","cuisine":"菜系","priceRange":"人均","specialty":"招牌菜","location":"位置","searchKeyword":"搜索词","reason":"推荐原因","openHours":"营业时间"}
  ],
  "hotels": [
    {"name":"住宿","type":"类型","pricePerNight":"价格","stars":"星级","location":"位置","features":["特点1","特点2"],"searchKeyword":"搜索词","suitable":"适合人群"}
  ],
  "transportation": {
    "arrival": "到达方式",
    "local": "本地交通",
    "tips": ["贴士1","贴士2","贴士3"]
  },
  "shopping": [
    {"name":"购物地","type":"类型","specialty":"商品","priceRange":"价格","location":"位置","tips":"建议"}
  ],
  "budgetBreakdown": {
    "accommodation": 住宿费数字,
    "food": 餐饮费数字,
    "attractions": 门票费数字,
    "transportation": 交通费数字,
    "shopping": 购物费数字,
    "misc": 其他费数字
  },
  "travelTips": {
    "essentials": ["必带1","必带2","必带3"],
    "cultural": ["注意1","注意2"],
    "practical": ["建议1","建议2","建议3"]
  },
  "videoSearchKeyword": "B站搜索词"
}`;

    const apiResp = await callDeepSeek(apiKey, prompt);

    // DeepSeek 错误响应
    if (apiResp.error) {
      throw new Error(`DeepSeek错误: ${apiResp.error.message || JSON.stringify(apiResp.error)}`);
    }
    if (!apiResp.choices || !apiResp.choices[0]) {
      throw new Error(`响应异常: ${JSON.stringify(apiResp).substring(0, 200)}`);
    }

    let text = apiResp.choices[0].message.content.trim();
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

    let itinerary;
    try {
      itinerary = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        itinerary = JSON.parse(match[0]);
      } else {
        throw new Error('JSON解析失败，请重试');
      }
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ success: true, data: itinerary })
    };

  } catch (error) {
    console.error('错误:', error.message);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: error.message || '生成失败，请稍后重试' })
    };
  }
};
