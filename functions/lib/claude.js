/**
 * functions/lib/claude.js
 * Ortak Claude API wrapper — Anthropic SDK init + tool_use call + cost tracking
 * Secret: ANTHROPIC_API_KEY (Cloud Secret Manager)
 */

const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions');

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

// Sonnet 4.6 pricing (USD per 1M tokens, as of 2026-04)
const PRICING = {
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5':  { input: 0.8, output:  4.0 },
};

const DEFAULT_MODEL = 'claude-sonnet-4-6';

/**
 * Lazy-init Claude client.
 * Must be called inside a function invocation (secret available).
 */
function getClaudeClient() {
  // Dynamic require so the module loads without the secret at cold-start module scope
  const Anthropic = require('@anthropic-ai/sdk');
  const key = ANTHROPIC_API_KEY.value();
  if (!key) throw new Error('ANTHROPIC_API_KEY secret is not available');
  return new Anthropic.default({ apiKey: key });
}

/**
 * runWithTool — single tool_use call, returns the tool result block.
 *
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @param {object} toolDef — Anthropic tool schema { name, description, input_schema }
 * @param {object} [opts]
 * @param {string} [opts.model]
 * @param {string} [opts.traceId]   — for log correlation
 * @returns {{ result: object, usage: object, costUsd: number, requestId: string }}
 */
async function runWithTool(systemPrompt, userMessage, toolDef, opts = {}) {
  const model   = opts.model   || DEFAULT_MODEL;
  const traceId = opts.traceId || 'no-trace';

  const client = getClaudeClient();

  logger.info('[claude] request', { traceId, model, tool: toolDef.name, msgLen: userMessage.length });

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system: systemPrompt,
    tools: [toolDef],
    tool_choice: { type: 'auto' },
    messages: [{ role: 'user', content: userMessage }],
  });

  const usage = response.usage || {};
  const costUsd = estimateCost(model, usage.input_tokens || 0, usage.output_tokens || 0);
  const requestId = response.id || 'unknown';

  logger.info('[claude] response', {
    traceId,
    requestId,
    inputTokens:  usage.input_tokens,
    outputTokens: usage.output_tokens,
    costUsd,
    stopReason: response.stop_reason,
  });

  // Extract tool_use block
  const toolBlock = response.content.find(b => b.type === 'tool_use');
  if (!toolBlock) {
    throw new Error(`[claude] No tool_use block in response. stop_reason=${response.stop_reason}`);
  }

  return {
    result:    toolBlock.input,
    usage,
    costUsd,
    requestId,
  };
}

function estimateCost(model, inputTokens, outputTokens) {
  const prices = PRICING[model] || PRICING[DEFAULT_MODEL];
  return (
    (inputTokens  / 1_000_000) * prices.input +
    (outputTokens / 1_000_000) * prices.output
  );
}

module.exports = { getClaudeClient, runWithTool, ANTHROPIC_API_KEY };
