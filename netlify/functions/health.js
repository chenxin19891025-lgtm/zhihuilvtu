exports.handler = async () => ({
  statusCode: 200,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'ok', model: process.env.DEEPSEEK_MODEL || 'deepseek-chat' })
});
